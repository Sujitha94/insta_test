const express = require('express');
const router = express.Router();

const ProductDetail = require('../models/ProductDetail');
const ProductList = require('../models/ProductList');

const calculateOverallProductStatus = (product) => {
  if (!product.units || product.units.length === 0) {
    return 'N/A'; // No units, no stock
  }

  const outOfStockUnits = product.units.filter(unit => unit.quantityInStock <= 0);
  const lowStockUnits = product.units.filter(unit => unit.quantityInStock > 0 && unit.quantityInStock <= unit.threshold);
  const inStockUnits = product.units.filter(unit => unit.quantityInStock > unit.threshold);

  if (outOfStockUnits.length === product.units.length) {
    return 'Out of Stock'; // All units are out of stock
  }
  if (lowStockUnits.length > 0 || outOfStockUnits.length > 0) {
    return 'Low Stock'; // At least one unit is low or out of stock
  }
  return 'In Stock'; // All units are above threshold
};

// Helper function to get appropriate SKU based on units count
const getAppropriateSku = (product, unitIndex = null) => {
  if (!product.units || product.units.length === 0) {
    return product.sku || '';
  }
  
  if (product.units.length === 1) {
    // Single unit: use product SKU
    return product.sku || '';
  } else {
    // Multiple units: use specific unit SKU if unitIndex provided, otherwise return product SKU
    if (unitIndex !== null && product.units[unitIndex]) {
      return product.units[unitIndex].sku || product.sku || '';
    }
    return product.sku || '';
  }
};

// Get all products in inventory for a specific tenant
router.get('/inventory', async (req, res) => {
  try {
    const { tenentId } = req.query;

    if (!tenentId) {
      return res.status(400).json({ message: 'Missing required tenant ID' });
    }

    const productDetails = await ProductDetail.find({ tenentId });

    if (!productDetails || productDetails.length === 0) {
      return res.status(404).json({ message: 'No products found for this tenant' });
    }

    const productsWithStatus = productDetails.map(product => {
        const productObj = product.toObject(); // Convert Mongoose document to plain object
        productObj.overallStatus = calculateOverallProductStatus(productObj); // Add overall status
        
        // Add appropriate SKU information based on units count
        productObj.displaySku = getAppropriateSku(productObj);
        
        return productObj;
    });

    const sortedProducts = productsWithStatus.sort((a, b) => {
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
    const productObj = product.toObject();
    productObj.overallStatus = calculateOverallProductStatus(productObj);
    productObj.displaySku = getAppropriateSku(productObj);

    res.status(200).json({
      message: 'Product retrieved successfully',
      product: productObj
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
      units, // units will now contain quantityInStock and threshold for each unit
      productPhotoUrl,
      productDescription,
      websiteLink,
    } = req.body;

    if (!tenentId || !productName) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // Check SKU uniqueness based on units count
    if (units && units.length > 1) {
      // Multiple units: check each unit SKU for uniqueness
      for (const unit of units) {
        if (unit.sku) {
          const existingProductWithUnitSku = await ProductDetail.findOne({
            tenentId,
            'units.sku': unit.sku
          });
          if (existingProductWithUnitSku) {
            return res.status(409).json({ 
              message: `Unit SKU '${unit.sku}' already exists in another product` 
            });
          }
        }
      }
    } else {
      // Single unit or no units: check product SKU
      if (sku) {
        const existingProduct = await ProductDetail.findOne({ tenentId, sku });
        if (existingProduct) {
          return res.status(409).json({ message: 'Product with this SKU already exists' });
        }
      }
    }

    // Initialize units with default stock and threshold if not provided
    const newUnits = units.map(unit => ({
      ...unit,
      quantityInStock: unit.quantityInStock !== undefined ? unit.quantityInStock : 0,
      threshold: unit.threshold !== undefined ? unit.threshold : 10,
      lastRestocked: unit.lastRestocked || new Date(),
      sku: unit.sku || '' // Ensure unit SKU is preserved
    }));

    const newProduct = new ProductDetail({
      tenentId,
      productName,
      sku: sku || '',
      units: newUnits,
      productPhotoUrl: productPhotoUrl || '',
      productDescription: productDescription || '',
      websiteLink: websiteLink || '',
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
      units, // Units now include quantityInStock, threshold, lastRestocked, sku
      productDescription,
      productPhotoUrl,
      websiteLink,
    } = req.body;

    if (!tenentId) {
      return res.status(400).json({ message: 'Missing required tenant ID' });
    }

    const product = await ProductDetail.findOne({ _id: id, tenentId });

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    // SKU validation based on units count
    if (units && units.length > 1) {
      // Multiple units: check unit SKU uniqueness
      for (const unit of units) {
        if (unit.sku) {
          const existingProductWithUnitSku = await ProductDetail.findOne({
            tenentId,
            'units.sku': unit.sku,
            _id: { $ne: id } // Exclude current product
          });
          if (existingProductWithUnitSku) {
            return res.status(409).json({ 
              message: `Unit SKU '${unit.sku}' already exists in another product` 
            });
          }
        }
      }
    } else {
      // Single unit or no units: check product SKU
      if (sku && sku !== product.sku) {
        const existingProduct = await ProductDetail.findOne({
          tenentId,
          sku,
          _id: { $ne: id }
        });

        if (existingProduct) {
          return res.status(409).json({ message: 'Another product with this SKU already exists' });
        }
      }
    }

    // Update product fields and units.
    const updatedUnits = units.map(unit => ({
      ...unit,
      quantityInStock: unit.quantityInStock !== undefined ? unit.quantityInStock : 0,
      threshold: unit.threshold !== undefined ? unit.threshold : 10,
      lastRestocked: unit.lastRestocked || new Date(),
      sku: unit.sku || '' // Preserve unit SKU
    }));

    const updatedProduct = await ProductDetail.findByIdAndUpdate(id, {
      productName: productName || product.productName,
      sku: sku || product.sku,
      units: updatedUnits,
      productDescription: productDescription || product.productDescription,
      productPhotoUrl: productPhotoUrl || product.productPhotoUrl,
      websiteLink: websiteLink || product.websiteLink,
    }, { new: true });

    if (!updatedProduct) {
        return res.status(404).json({ message: 'Product not found after update attempt.' });
    }

    const productObj = updatedProduct.toObject();
    productObj.overallStatus = calculateOverallProductStatus(productObj);
    productObj.displaySku = getAppropriateSku(productObj);

    res.status(200).json({
      message: 'Product updated successfully',
      product: productObj
    });
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json({ message: 'Server error updating product' });
  }
});

// Delete a product (no change needed here as it's product-level)
router.delete('/inventory/:productName', async (req, res) => {
  try {
    const { productName } = req.params;
    const { tenentId } = req.query;

    if (!tenentId) {
      return res.status(400).json({ message: 'Missing required tenant ID' });
    }

    // Find the product by productName and tenentId
    const product = await ProductDetail.findOne({ productName, tenentId });

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    // Get the product ID for deletion from ProductList
    const productId = product._id;

    // Delete from both collections
    await Promise.all([
      ProductDetail.findOneAndDelete({ productName, tenentId }),
      ProductList.findOneAndDelete({ productName: productName, tenentId })
    ]);

    res.status(200).json({
      message: 'Product deleted successfully from both collections'
    });
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({ message: 'Server error deleting product' });
  }
});

// Restock a product
router.post('/inventory/:productId/units/:unitIndex/restock', async (req, res) => {
  try {
    const { productId, unitIndex } = req.params;
    const { tenentId, addQuantity, newTotal } = req.body;

    if (!tenentId || (addQuantity === undefined && newTotal === undefined)) {
      return res.status(400).json({ message: 'Missing required fields: tenant ID and either addQuantity or newTotal' });
    }

    const product = await ProductDetail.findOne({ _id: productId, tenentId });

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    
    const unitIdx = parseInt(unitIndex);
    if (!product.units || unitIdx >= product.units.length || unitIdx < 0) {
      return res.status(404).json({ message: 'Product unit not found at the specified index' });
    }

    const targetUnit = product.units[unitIdx];
    let updatedQuantity;

    if (newTotal !== undefined) {
      updatedQuantity = parseInt(newTotal);
    } else {
      updatedQuantity = targetUnit.quantityInStock + parseInt(addQuantity);
    }

    product.units[unitIdx].quantityInStock = updatedQuantity;
    product.units[unitIdx].lastRestocked = new Date();

    await product.save();

    const productObj = product.toObject();
    productObj.overallStatus = calculateOverallProductStatus(productObj);
    productObj.displaySku = getAppropriateSku(productObj, unitIdx);

    res.status(200).json({
      message: `Unit '${targetUnit.unit}' restocked successfully`,
      product: productObj,
      updatedUnit: product.units[unitIdx],
      newQuantityInStock: updatedQuantity // Add this for frontend optimization
    });
  } catch (error) {
    console.error('Error restocking product unit:', error);
    res.status(500).json({ message: 'Server error restocking product unit' });
  }
});

// Get low stock products (based on unit-level thresholds)
router.get('/inventory/low-stock', async (req, res) => {
  try {
    const { tenentId } = req.query;

    if (!tenentId) {
      return res.status(400).json({ message: 'Missing required tenant ID' });
    }

    // Find products where at least one unit has quantityInStock <= its threshold
    const lowStockProducts = await ProductDetail.find({
      tenentId,
      'units': {
        $elemMatch: {
          $expr: { $lte: ["$units.quantityInStock", "$units.threshold"] },
          quantityInStock: { $gt: 0 } // Exclude completely out-of-stock units from 'low-stock' category
        }
      }
    });

    const productsWithStatus = lowStockProducts.map(product => {
        const productObj = product.toObject();
        productObj.overallStatus = calculateOverallProductStatus(productObj);
        productObj.displaySku = getAppropriateSku(productObj);
        return productObj;
    });

    res.status(200).json({
      message: 'Low stock products retrieved successfully',
      products: productsWithStatus
    });
  } catch (error) {
    console.error('Error retrieving low stock products:', error);
    res.status(500).json({ message: 'Server error retrieving low stock products' });
  }
});

// Get out of stock products (based on unit-level quantities)
router.get('/inventory/out-of-stock', async (req, res) => {
  try {
    const { tenentId } = req.query;

    if (!tenentId) {
      return res.status(400).json({ message: 'Missing required tenant ID' });
    }

    // Find products where at least one unit has quantityInStock === 0
    const outOfStockProducts = await ProductDetail.find({
      tenentId,
      'units.quantityInStock': 0
    });

    const productsWithStatus = outOfStockProducts.map(product => {
        const productObj = product.toObject();
        productObj.overallStatus = calculateOverallProductStatus(productObj);
        productObj.displaySku = getAppropriateSku(productObj);
        return productObj;
    });

    res.status(200).json({
      message: 'Out of stock products retrieved successfully',
      products: productsWithStatus
    });
  } catch (error) {
    console.error('Error retrieving out of stock products:', error);
    res.status(500).json({ message: 'Server error retrieving out of stock products' });
  }
});

module.exports = router;
