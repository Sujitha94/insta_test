const express = require('express');
const router = express.Router();

const ProductDetail = require('../models/ProductDetail');

// Get all products in inventory for a specific tenant
router.get('/inventory', async (req, res) => {
  try {
    const { tenentId } = req.query;
    
    if (!tenentId) {
      return res.status(400).json({ message: 'Missing required tenant ID' });
    }
    
    // Find all products for the tenant
    const productDetails = await ProductDetail.find({ tenentId });
    
    if (!productDetails || productDetails.length === 0) {
      return res.status(404).json({ message: 'No products found for this tenant' });
    }
    
    // Sort products by name
    const sortedProducts = productDetails.sort((a, b) => {
      return a.productName.localeCompare(b.productName);
    });
    
    res.status(200).json({
      message: 'Products retrieved successfully',
      products: sortedProducts
    });
  } catch (error) {
    console.error('Error retrieving products:', error);
    res.status(500).json({ message: 'Server error retrieving products' });
  }
});

// Get a single product by ID
router.get('/inventory/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { tenentId } = req.query;
    
    if (!tenentId) {
      return res.status(400).json({ message: 'Missing required tenant ID' });
    }
    
    const product = await ProductDetail.findOne({ _id: id, tenentId });
    
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    
    res.status(200).json({
      message: 'Product retrieved successfully',
      product
    });
  } catch (error) {
    console.error('Error retrieving product:', error);
    res.status(500).json({ message: 'Server error retrieving product' });
  }
});

// Add a new product to inventory
router.post('/inventory', async (req, res) => {
  try {
    const { 
      tenentId, 
      productName, 
      sku, 
      units, 
      quantityInStock, 
      threshold,
      productPhotoUrl
    } = req.body;
    
    if (!tenentId || !productName) {
      return res.status(400).json({ message: 'Missing required fields' });
    }
    
    // Check if a product with the same SKU already exists for this tenant
    if (sku) {
      const existingProduct = await ProductDetail.findOne({ tenentId, sku });
      if (existingProduct) {
        return res.status(409).json({ message: 'Product with this SKU already exists' });
      }
    }
    
    // Create new product
    const newProduct = new ProductDetail({
      tenentId,
      productName,
      sku: sku || '',
      units: units || [],
      quantityInStock: quantityInStock || 0,
      threshold: threshold || 5,
      lastRestocked: new Date(),
      productPhotoUrl: productPhotoUrl || ''
    });
    
    await newProduct.save();
    
    res.status(201).json({
      message: 'Product added to inventory successfully',
      product: newProduct
    });
  } catch (error) {
    console.error('Error adding product:', error);
    res.status(500).json({ message: 'Server error adding product' });
  }
});

// Update an existing product

router.put('/inventory/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      tenentId, 
      productName, 
      sku, 
      units, 
      quantityInStock, 
      threshold,
      productDescription  // Add this line
    } = req.body;
    
    if (!tenentId) {
      return res.status(400).json({ message: 'Missing required tenant ID' });
    }
    
    // Check if the product exists
    const product = await ProductDetail.findOne({ _id: id, tenentId });
    
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    
    // Check if another product has the same SKU (if SKU is being updated)
    if (sku && sku !== product.sku) {
      const existingProduct = await ProductDetail.findOne({ 
        tenentId, 
        sku,
        _id: { $ne: id } // Exclude the current product
      });
      
      if (existingProduct) {
        return res.status(409).json({ message: 'Another product with this SKU already exists' });
      }
    }
    
    // Update product
    const updatedProduct = await ProductDetail.findByIdAndUpdate(id, {
      productName: productName || product.productName,
      sku: sku || product.sku,
      units: units || product.units,
      quantityInStock: quantityInStock !== undefined ? quantityInStock : product.quantityInStock,
      threshold: threshold !== undefined ? threshold : product.threshold,
      productDescription: productDescription || product.productDescription  // Add this line
    }, { new: true });
    
    res.status(200).json({
      message: 'Product updated successfully',
      product: updatedProduct
    });
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json({ message: 'Server error updating product' });
  }
});

// Delete a product
router.delete('/inventory/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { tenentId } = req.query;
    
    if (!tenentId) {
      return res.status(400).json({ message: 'Missing required tenant ID' });
    }
    
    // Check if the product exists
    const product = await ProductDetail.findOne({ _id: id, tenentId });
    
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    
    // Delete the product
    await ProductDetail.findByIdAndDelete(id);
    
    res.status(200).json({
      message: 'Product deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({ message: 'Server error deleting product' });
  }
});

// Restock a product
router.post('/inventory/:id/restock', async (req, res) => {
  try {
    const { id } = req.params;
    const { tenentId, addQuantity, newTotal, lastRestocked } = req.body;

    if (!tenentId || !addQuantity) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // Check if the product exists
    const product = await ProductDetail.findOne({ tenentId });

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    // Update stock quantity
    const quantityToAdd = parseInt(addQuantity);
    const updatedQuantity = newTotal || (product.quantityInStock + quantityToAdd);

    const updatedProduct = await ProductDetail.findByIdAndUpdate(id, {
      quantityInStock: updatedQuantity,
      lastRestocked: lastRestocked || new Date()
    }, { new: true });

    res.status(200).json({
      message: 'Product restocked successfully',
      product: updatedProduct
    });
  } catch (error) {
    console.error('Error restocking product:', error);
    res.status(500).json({ message: 'Server error restocking product' });
  }
});

router.get('/inventory/low-stock', async (req, res) => {
  try {
    const { tenentId } = req.query;

    if (!tenentId) {
      return res.status(400).json({ message: 'Missing required tenant ID' });
    }

    // Find products where quantity is less than or equal to threshold
    const lowStockProducts = await ProductDetail.find({
      tenentId,
      $expr: { $lte: ["$quantityInStock", "$threshold"] }
    });

    res.status(200).json({
      message: 'Low stock products retrieved successfully',
      products: lowStockProducts
    });
  } catch (error) {
    console.error('Error retrieving low stock products:', error);
    res.status(500).json({ message: 'Server error retrieving low stock products' });
  }
});

router.get('/inventory/out-of-stock', async (req, res) => {
  try {
    const { tenentId } = req.query;

    if (!tenentId) {
      return res.status(400).json({ message: 'Missing required tenant ID' });
    }

    // Find products where quantity is 0
    const outOfStockProducts = await ProductDetail.find({
      tenentId,
      quantityInStock: 0
    });

    res.status(200).json({
      message: 'Out of stock products retrieved successfully',
      products: outOfStockProducts
    });
  } catch (error) {
    console.error('Error retrieving out of stock products:', error);
    res.status(500).json({ message: 'Server error retrieving out of stock products' });
  }
});

module.exports = router;
