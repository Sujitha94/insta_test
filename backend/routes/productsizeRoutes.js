const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const ProductList = require('../models/ProductList');
const ProductDetail = require('../models/ProductDetail');
const ProductType = require('../models/ProductType');


// Get unique product categories for a tenant (Unchanged, this is efficient)
router.get('/categories', async (req, res) => {
  try {
    const { tenentId } = req.query;
    if (!tenentId) {
      return res.status(400).json({ error: 'Tenant ID is required' });
    }
    const uniqueCategories = await ProductList.distinct('productType', { tenentId });
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

/**
 * [PERFORMANCE UPGRADE]
 * Get products by category using a single efficient database query.
 */
router.get('/products', async (req, res) => {
    try {
        const { tenentId, productType } = req.query;
        if (!tenentId || !productType) {
            return res.status(400).json({ error: 'Tenant ID and Product Type are required' });
        }

        const products = await ProductList.aggregate([
            // Stage 1: Match the initial documents from ProductList
            { $match: { tenentId, productType } },

            // Stage 2: Join with ProductDetail collection
            {
                $lookup: {
                    from: 'productdetails', // The actual name of the collection in MongoDB
                    localField: 'productName',
                    foreignField: 'productName',
                    // Pipeline to ensure tenentId also matches in the joined collection
                    let: { list_tenentId: "$tenentId" },
                    pipeline: [
                        { $match: { $expr: { $eq: ["$tenentId", "$$list_tenentId"] } } }
                    ],
                    as: 'details'
                }
            },

            // Stage 3: Deconstruct the 'details' array
            { $unwind: '$details' },

            // Stage 4: Project the final desired fields
            {
                $project: {
                    _id: '$details._id', // Use the ID from the details collection
                    sku: '$details.sku',
                    productName: '$productName',
                    productType: '$productType',
                    productPhotoUrl: { $ifNull: ['$details.productPhotoUrl', 'default-image.jpg'] },
                    units: '$details.units',
                    websiteLink: '$details.websiteLink',
                    productDescription: '$details.productDescription',
                    quantityInStock: '$details.quantityInStock'
                }
            }
        ]);
        
        res.json(products);

    } catch (error) {
        console.error('Error fetching products:', error);
        res.status(500).json({ error: 'Failed to fetch products' });
    }
});

// Get product details by SKU (Unchanged, already efficient)
router.get('/product-details', async (req, res) => {
  try {
    const { tenentId, sku } = req.query;
    if (!tenentId || !sku) {
      return res.status(400).json({ error: 'Tenant ID and SKU are required' });
    }
    const productDetail = await ProductDetail.findOne({ tenentId, sku });
    if (!productDetail) {
      return res.status(404).json({ error: 'Product not found' });
    }
    const productList = await ProductList.findOne({ tenentId, productName: productDetail.productName });
    res.json({ ...productDetail.toObject(), productType: productList ? productList.productType : null });
  } catch (error) {
    console.error('Error fetching product details:', error);
    res.status(500).json({ error: 'Failed to fetch product details' });
  }
});

/**
 * [PERFORMANCE UPGRADE]
 * Search products using a single efficient database query.
 */
router.get('/search', async (req, res) => {
    try {
        const { tenentId, query } = req.query;
        if (!tenentId || !query) {
            return res.status(400).json({ error: 'Tenant ID and search query are required' });
        }
        const searchRegex = new RegExp(query, 'i');

        const products = await ProductList.aggregate([
            { $match: { tenentId, productName: searchRegex } },
            {
                $lookup: {
                    from: 'productdetails',
                    localField: 'productName',
                    foreignField: 'productName',
                    let: { list_tenentId: "$tenentId" },
                    pipeline: [
                        { $match: { $expr: { $eq: ["$tenentId", "$$list_tenentId"] } } }
                    ],
                    as: 'details'
                }
            },
            { $unwind: '$details' },
            {
                $project: {
                    _id: '$details._id', sku: '$details.sku', productName: '$productName',
                    productType: '$productType', productPhotoUrl: { $ifNull: ['$details.productPhotoUrl', ''] },
                    units: '$details.units', websiteLink: '$details.websiteLink'
                }
            }
        ]);
        
        res.json(products);

    } catch (error) {
        console.error('Error searching products:', error);
        res.status(500).json({ error: 'Failed to search products' });
    }
});

// Add a new product (admin route - unchanged)
router.post('/add', async (req, res) => {
  try {
    const { tenentId, productName, productType, units, websiteLink, productPhotoUrl, sku, quantityInStock } = req.body;
    if (!tenentId || !productName || !productType || !sku) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    await ProductList.findOneAndUpdate(
      { tenentId, productName },
      { tenentId, productName, productType, payload: `${productType.toUpperCase()}_CATEGORY` },
      { upsert: true, new: true }
    );
    const productDetail = await ProductDetail.findOneAndUpdate(
      { tenentId, productName },
      { tenentId, productName, units, websiteLink, productPhotoUrl, sku, quantityInStock: quantityInStock || 0 },
      { upsert: true, new: true }
    );
    res.status(201).json(productDetail);
  } catch (error) {
    console.error('Error adding product:', error);
    res.status(500).json({ error: 'Failed to add product' });
  }
});

module.exports = router;
