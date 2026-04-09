const express = require('express');
const router = express.Router();
const ProductType= require('../models/ProductType');
const ProductList= require('../models/ProductList');
const ProductDetail= require('../models/ProductDetail');

// Get unique product categories for a tenant
router.get('/categories', async (req, res) => {
  try {
    const { tenentId } = req.query;

    if (!tenentId) {
      return res.status(400).json({ error: 'Tenant ID is required' });
    }

    // Find unique product types from ProductList
    const uniqueCategories = await ProductList.distinct('productType', { tenentId });

    // If no categories found, check ProductType collection as a fallback
    if (uniqueCategories.length === 0) {
      const productTypeDoc = await ProductType.findOne({ tenentId });
      if (productTypeDoc) {
        return res.json(productTypeDoc.productTypes.map(pt => pt.title));
      }
    }

    res.json(uniqueCategories);
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Failed to fetch product categories' });
  }
});

// Get products by category
router.get('/products', async (req, res) => {
  try {
    const { tenentId, productType } = req.query;

    if (!tenentId || !productType) {
      return res.status(400).json({ error: 'Tenant ID and Product Type are required' });
    }

    // Find products in the list that match the tenant and product type
    const productList = await ProductList.find({ 
      tenentId, 
      productType 
    });

    // If no products found in ProductList, return empty array
    if (!productList || productList.length === 0) {
      return res.json([]);
    }

    // Fetch detailed product information
    const productsWithDetails = await Promise.all(
      productList.map(async (product) => {
        const productDetail = await ProductDetail.findOne({
          tenentId,
          productName: product.productName
        });

        // If no product detail found, return null
        if (!productDetail) return null;

        return {
          sku: productDetail.sku,
          productName: productDetail.productName,
          productType: product.productType,
          productPhotoUrl: productDetail.productPhotoUrl || `${process.env.APP_URL}/default-product-image.jpg`,
          units: productDetail.units || [],
          websiteLink: productDetail.websiteLink,
           productDescription: productDetail.productDescription || '',
          quantityInStock: productDetail.quantityInStock || 0
        };
      })
    );

    // Filter out any null results
    const validProducts = productsWithDetails.filter(product => product !== null);

    res.json(validProducts);
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// Get product details by SKU
router.get('/product-details', async (req, res) => {
  try {
    const { tenentId, sku } = req.query;

    if (!tenentId || !sku) {
      return res.status(400).json({ error: 'Tenant ID and SKU are required' });
    }

    const productDetail = await ProductDetail.findOne({ 
      tenentId, 
      sku 
    });

    if (!productDetail) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const productList = await ProductList.findOne({
      tenentId,
      productName: productDetail.productName
    });

    res.json({
      ...productDetail.toObject(),
      productType: productList ? productList.productType : null
    });
  } catch (error) {
    console.error('Error fetching product details:', error);
    res.status(500).json({ error: 'Failed to fetch product details' });
  }
});

// Search products
router.get('/search', async (req, res) => {
  try {
    const { tenentId, query } = req.query;

    if (!tenentId || !query) {
      return res.status(400).json({ error: 'Tenant ID and search query are required' });
    }

    // Create a case-insensitive regex search
    const searchRegex = new RegExp(query, 'i');

    // Find products that match the search query
    const productList = await ProductList.find({ 
      tenentId,
      productName: searchRegex
    });

    // Fetch detailed product information
    const productsWithDetails = await Promise.all(
      productList.map(async (product) => {
        const productDetail = await ProductDetail.findOne({
          tenentId,
          productName: product.productName
        });

        if (!productDetail) return null;

        return {
          sku: productDetail.sku,
          productName: productDetail.productName,
          productType: product.productType,
          productPhotoUrl: productDetail.productPhotoUrl || `${process.env.APP_URL}/default-product-image.jpg`,
          units: productDetail.units || [],
          websiteLink: productDetail.websiteLink
        };
      })
    );

    // Filter out any null results
    const validProducts = productsWithDetails.filter(product => product !== null);

    res.json(validProducts);
  } catch (error) {
    console.error('Error searching products:', error);
    res.status(500).json({ error: 'Failed to search products' });
  }
});

// Add a new product (admin route)
router.post('/add', async (req, res) => {
  try {
    const { 
      tenentId, 
      productName, 
      productType, 
      units, 
      websiteLink, 
      productPhotoUrl, 
      sku,
      quantityInStock 
    } = req.body;

    // Validate required fields
    if (!tenentId || !productName || !productType || !sku) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Create or update ProductList entry
    await ProductList.findOneAndUpdate(
      { tenentId, productName },
      { 
        tenentId, 
        productName, 
        productType,
        payload: `${productType.toUpperCase()}_CATEGORY`
      },
      { upsert: true, new: true }
    );

    // Create or update ProductDetail entry
    const productDetail = await ProductDetail.findOneAndUpdate(
      { tenentId, productName },
      {
        tenentId,
        productName,
        units,
        websiteLink,
        productPhotoUrl,
        sku,
        quantityInStock: quantityInStock || 0
      },
      { upsert: true, new: true }
    );

    res.status(201).json(productDetail);
  } catch (error) {
    console.error('Error adding product:', error);
    res.status(500).json({ error: 'Failed to add product' });
  }
});

module.exports = router;
