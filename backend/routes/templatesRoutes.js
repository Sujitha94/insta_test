require("dotenv").config();

const Welcomemessage = require('../models/Welcomemessage');
const ProductType= require('../models/ProductType');
const ProductList= require('../models/ProductList');
const Icebreaker= require('../models/Icebreaker');
const path = require('path');
const axios = require('axios');
const express = require('express');
const { json } = express;
const router = express.Router();

const fs = require('fs');
const ProductDetail = require('../models/ProductDetail');
const multer = require('multer');
const cors = require('cors');

router.use(cors({
  origin: '*' // Replace with your client URL
}));

const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    const uploadDir = 'uploads/products';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function(req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

// Update the multer configuration to handle array of files with specific field name
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
}).fields([
  { name: 'products[0][productPhoto]', maxCount: 1 },
  { name: 'products[1][productPhoto]', maxCount: 1 },
  { name: 'products[2][productPhoto]', maxCount: 1 },
  { name: 'products[3][productPhoto]', maxCount: 1 },
  { name: 'products[4][productPhoto]', maxCount: 1 }
  // Add more fields if needed
]);

// [Keep all your existing routes: welcome, Product-type, Product-type-list, etc.]

router.post("/welcome", async (req, res) => {
    try {
      const { message,tenentId } = req.body;
      const welcome = await Welcomemessage.findOneAndUpdate(
        { tenentId: tenentId },
        { $set: { welcomemessage: message } },
        { new: true, upsert: true }
      );
      res.json({
          success: true,
          message: 'Message sent successfully',
          data: welcome
      });
    } catch (error) {
        console.error('Error sending message:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

router.post("/Product-type", async (req, res) => {
  try {
    const { tenentId, productTypes } = req.body;
    if (!tenentId || !productTypes || !Array.isArray(productTypes)) {
      return res.status(400).json({ success: false, message: 'Invalid request data' });
    }
    if (productTypes.length > 8) {
      return res.status(400).json({ success: false, message: 'Maximum 8 product types allowed' });
    }
    for (const type of productTypes) {
      if (!type.title || !type.payload) {
        return res.status(400).json({ success: false, message: 'Each product type must have title and payload' });
      }
    }
    const newProductTypes = new ProductType({ tenentId, productTypes });
    await newProductTypes.save();
    res.json({ success: true, message: 'Product types saved successfully', data: newProductTypes });
  } catch (error) {
    console.error('Error saving product types:', error);
    res.status(500).json({ success: false, message: 'Failed to save product types', error: error.message });
  }
});

router.post("/Product-type-list", async (req, res) => {
  try {
    const { tenentId } = req.body;
    if (!tenentId) {
      return res.status(400).json({ success: false, message: 'Invalid request: tenant ID is required' });
    }
    const productTypeList = await ProductType.find({ tenentId });
    if (!productTypeList || productTypeList.length === 0) {
      return res.status(404).json({ success: false, message: 'No product types found for this tenant' });
    }
    const allProductTypes = productTypeList.reduce((allTypes, doc) => {
      if (doc.productTypes && Array.isArray(doc.productTypes)) {
        return [...allTypes, ...doc.productTypes];
      }
      return allTypes;
    }, []);
    res.json({ success: true, message: 'Product types retrieved successfully', data: allProductTypes, count: allProductTypes.length });
  } catch (error) {
    console.error('Error retrieving product types:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve product types', error: error.message });
  }
});
const generateUnitSKU = (baseSku, unit) => {
  if (!baseSku || !unit) return null;

  // Clean the unit string - remove spaces, special characters, convert to uppercase
  const cleanUnit = unit
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .trim();

  return `${baseSku}-${cleanUnit}`;
};

// Helper function to process units with auto-generated SKUs
const processUnitsWithSKU = (units, baseSku) => {
  if (!units || !Array.isArray(units)) return [];

  return units.map(unitItem => {
    // If unit already has SKU, keep it; otherwise generate one
    if (!unitItem.sku && baseSku && unitItem.unit) {
      return {
        ...unitItem,
        sku: generateUnitSKU(baseSku, unitItem.unit)
      };
    }
    return unitItem;
  });
};

// Updated generatePayload function to handle colors
const generatePayload = (productName, units) => {
    let nameToProcess = productName;
    let finalUnitPart = '';

    // Handle units (existing logic)


    let cleanProductName = nameToProcess
      .toUpperCase()
      .replace(/[^A-Z0-9\s]/g, '')
      .replace(/\s+/g, '_')
      .trim()
      .replace(/_+$/, '');

    if (finalUnitPart) {
      if (!cleanProductName) return `${finalUnitPart}_PRODUCT`;
      return `${cleanProductName}_${finalUnitPart}_PRODUCT`;
    }

    return `${cleanProductName}_PRODUCT`;
};

// UPDATED: Product Details Save Route
router.post('/product-details', upload, async (req, res) => {
  try {
    const { tenentId, products } = req.body;
    if (!tenentId || !products) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const parsedProducts = typeof products === 'string' ? JSON.parse(products) : products;
    const savedProductDetails = [];
    const savedProductList = [];

    for (let i = 0; i < parsedProducts.length; i++) {
      const product = parsedProducts[i];
      const fileKey = `products[${i}][productPhoto]`;
      const file = req.files[fileKey]?.[0];

      let productPhotoField = {};
      if (product.productPhotoUrl) {
        productPhotoField = { productPhotoUrl: product.productPhotoUrl };
      } else if (file) {
        productPhotoField = { productPhoto: `/uploads/products/${file.filename}` };
      } else {
        return res.status(400).json({ error: `Missing photo for product ${i + 1}` });
      }

      // Process units with SKU and weight
      const processedUnits = processUnitsWithSKU(product.units || [], product.sku);

      const productDetailData = {
        tenentId,
        productName: product.productName,
        productDescription: product.productDescription || '',
        units: processedUnits, // Now includes weight, imageUrl, and SKU
        websiteLink: product.websiteLink ? product.websiteLink.trim() : '',
        ...productPhotoField,
        ...(product.sku && product.sku.trim() && { sku: product.sku.trim() })
      };

      // Only add colors if they exist and are not empty
      if (product.colors && Array.isArray(product.colors) && product.colors.length > 0) {
        productDetailData.colors = product.colors;
      }

      const productDetail = new ProductDetail(productDetailData);
      const savedProductDetail = await productDetail.save();
      savedProductDetails.push(savedProductDetail);

      const payload = generatePayload(product.productName, product.units);
      const productListData = {
        tenentId,
        productName: product.productName,
        productType: product.productType,
        payload: payload
      };

      const productListItem = new ProductList(productListData);
      const savedProductListItem = await productListItem.save();
      savedProductList.push(savedProductListItem);
    }

    res.status(201).json({
      message: 'Products saved successfully to both collections',
      productDetails: savedProductDetails,
      productList: savedProductList
    });
  } catch (error) {
    console.error('Error saving product details:', error);
    res.status(500).json({ error: 'Failed to save product details' });
  }
});

// UPDATED: Product Details Update Route with Weight Support
router.post('/product-details/update', upload, async (req, res) => {
  try {
    const { tenentId, products } = req.body;
    if (!tenentId || !products) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const parsedProducts = typeof products === 'string' ? JSON.parse(products) : products;
    const savedProductDetails = [];
    const savedProductList = [];

    for (let i = 0; i < parsedProducts.length; i++) {
      const product = parsedProducts[i];
      const fileKey = `products[${i}][productPhoto]`;
      const file = req.files[fileKey]?.[0];

      let productPhotoField = {};
      if (product.productPhotoUrl) {
        productPhotoField = { productPhotoUrl: product.productPhotoUrl };
      } else if (file) {
        productPhotoField = { productPhoto: `/uploads/products/${file.filename}` };
      }

      // Process units with weight
      const processedUnits = processUnitsWithSKU(product.units || [], product.sku);

      const updateData = {
        productDescription: product.productDescription || '',
        units: processedUnits, // Now includes weight
        ...productPhotoField,
        ...(product.sku && product.sku.trim() && { sku: product.sku.trim() })
      };

      // Handle websiteLink
      if (product.websiteLink && product.websiteLink.trim()) {
        updateData.websiteLink = product.websiteLink.trim();
      } else {
        updateData.websiteLink = '';
      }

      // Only add colors if they exist and are not empty
      if (product.colors && Array.isArray(product.colors) && product.colors.length > 0) {
        updateData.colors = product.colors;
      } else {
        updateData.colors = [];
      }

      const savedProductDetail = await ProductDetail.findOneAndUpdate(
        { productName: product.productName, tenentId: tenentId },
        updateData,
        { new: true, upsert: true }
      );
      savedProductDetails.push(savedProductDetail);

      const payload = generatePayload(product.productName, product.units);
      const savedProductListItem = await ProductList.findOneAndUpdate(
        { productName: product.productName, tenentId: tenentId },
        { productType: product.productType, payload: payload },
        { new: true, upsert: true }
      );
      savedProductList.push(savedProductListItem);
    }

    res.status(200).json({
      message: 'Products updated successfully in both collections',
      productDetails: savedProductDetails,
      productList: savedProductList
    });
  } catch (error) {
    console.error('Error updating product details:', error);
    res.status(500).json({ error: 'Failed to update product details' });
  }
});

// [Keep all your other existing routes...]
router.post('/product-list', async (req, res) => {
  try {
    const { tenentId, products } = req.body;
    if (!tenentId || !products || !Array.isArray(products)) {
      return res.status(400).json({ error: 'Invalid request data' });
    }
    const savedProducts = await Promise.all(
      products.map(async (product) => {
        const payload = product.payload || generatePayload(product.productName, []);
        const newProduct = new ProductList({
          tenentId,
          productName: product.productName,
          productType: product.productType,
          payload: payload
        });
        return await newProduct.save();
      })
    );
    res.status(201).json({ message: 'Products saved successfully', products: savedProducts });
  } catch (error) {
    console.error('Error saving products:', error);
    res.status(500).json({ error: 'Failed to save products' });
  }
});

router.get('/product-list/:tenentId', async (req, res) => {
  try {
    const { tenentId } = req.params;
    const products = await ProductList.find({ tenentId }).sort({ createdAt: -1 });
    res.status(200).json(products);
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

router.put('/product-list/:productId', async (req, res) => {
  try {
    const { productId } = req.params;
    const updatedProduct = await ProductList.findByIdAndUpdate(productId, req.body, { new: true });
    if (!updatedProduct) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.status(200).json(updatedProduct);
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json({ error: 'Failed to update product' });
  }
});

router.delete('/product-list/:productId', async (req, res) => {
  try {
    const deletedProduct = await ProductList.findByIdAndDelete(req.params.productId);
    if (!deletedProduct) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.status(200).json({ message: 'Product deleted successfully' });
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({ error: 'Failed to delete product' });
  }
});

router.get('/product-details/:tenentId', async (req, res) => {
  try {
    const { tenentId } = req.params;
    const products = await ProductDetail.find({ tenentId }).sort({ createdAt: -1 });
    res.status(200).json(products);
  } catch (error) {
    console.error('Error fetching product details:', error);
    res.status(500).json({ error: 'Failed to fetch product details' });
  }
});

router.post("/Icebreaker", async (req, res) => {
  try {
    const { questions, tenentId } = req.body;
    if (!questions || !Array.isArray(questions) || !tenentId) {
      return res.status(400).json({ success: false, message: 'Invalid input' });
    }
    const cleanedQuestions = questions.filter(q => typeof q === 'string' && q.trim().length > 0);
    const result = await Icebreaker.findOneAndUpdate(
      { tenentId },
      { questions: cleanedQuestions },
      { new: true, upsert: true }
    );
    res.json({ success: true, message: 'Questions saved successfully', data: result });
  } catch (error) {
    console.error('Error saving/updating icebreaker questions:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
