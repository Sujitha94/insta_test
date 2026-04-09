const express = require('express');
const router = express.Router();
const axios = require('axios');
const mongoose = require('mongoose');
const Cart = require('../models/Cart');
const Razorpay = require('razorpay');
const ProductDetail = require('../models/ProductDetail');
const SecurityAccessToken = require('../models/SecurityAccessToken');
const Order = require('../models/Order');
const Razorpay_info = require('../models/Razorpay_info');
const Newuser = require('../models/Newuser');
const FreeShippingThreshold = require('../models/FreeShippingThreshold');
const ShippingMethod = require('../models/ShippingMethod');
const crypto = require('crypto');

// Constants
const FREE_SHIPPING_THRESHOLD = 500;
const SPECIAL_SHIPPING_PARTNERS = ['Ship Rocket', 'Delhivery'];

// Tenant-specific shipping rules (Legacy Fallback)
const TENANT_SHIPPING_RULES = {
  'c28e4bd8-ec43-43f9-a931-e886efaec97d': {
    freeDeliveryStates: ['TN', 'PY', 'TAMILNADU', 'TAMIL NADU', 'PUDUCHERRY', 'PONDICHERRY'],
    panIndiaDeliveryCost: 49,
    panIndiaFreeThreshold: 500,
    shippingPartnerName: 'ST Courier'
  }
};

// Helper function to normalize state names for comparison
function normalizeStateName(state) {
  if (!state) return '';
  return state.toUpperCase().replace(/[^A-Z]/g, '').trim();
}

// Helper function to parse weight string to number (KG)
function parseWeightToKg(weightStr) {
  if (!weightStr) return 0;
  const str = weightStr.toString().toLowerCase();
  const match = str.match(/([\d.]+)/);
  if (!match) return 0;

  let val = parseFloat(match[1]);

  if (str.includes('g') && !str.includes('kg')) {
    val = val / 1000;
  }

  return val;
}

// Helper function to calculate total cart weight
async function calculateCartWeight(cartItems, tenentId) {
  console.log("hi for weight");
  let totalWeight = 0;

  for (const item of cartItems) {
    try {
      const product = await ProductDetail.findOne({ tenentId, sku: item.sku });
      console.log("product for weight",product);
      if (!product) {
        const parentProduct = await ProductDetail.findOne({ tenentId, sku: item.sku });

        if (parentProduct && parentProduct.units && parentProduct.units.length > 0) {
          const unit = parentProduct.units[0];

          if (unit.weight) {
            totalWeight += parseWeightToKg(unit.weight) * item.quantity;
          }
        }
        continue;
      }

      // ⬇️ Removed SKU check here
      if (product.units && product.units.length > 0) {
        const unit = product.units[0]; // take first unit always

        if (unit.weight) {
          totalWeight += parseWeightToKg(unit.weight) * item.quantity;
          console.log("parseWeightToKg",parseWeightToKg);
        }
      }

    } catch (e) {
      console.error(`Error calculating weight for item ${item.sku}:`, e);
    }
  }

  console.log(`Calculated Total Cart Weight: ${totalWeight} kg`);
  return totalWeight;
}


// Helper function to check if state qualifies for free delivery
function isStateEligibleForFreeDelivery(state, eligibleStates) {
  const normalizedState = normalizeStateName(state);
  return eligibleStates.some(eligibleState =>
    normalizeStateName(eligibleState) === normalizedState
  );
}

// Helper function to get senderId from securityAccessToken
async function getSenderIdFromToken(securityAccessToken, tenentId) {
  const tokenData = await SecurityAccessToken.findOne({
    tenentId,
    securityaccessToken: securityAccessToken
  });

  if (!tokenData) {
    throw new Error('Invalid security token');
  }

  return tokenData.senderId;
}

// Function to generate a sequence-based order ID
async function generateOrderId(tenentId) {
  const result = await mongoose.connection.db.collection('counters').findOneAndUpdate(
    { _id: `order_id_${tenentId}` },
    { $inc: { sequence_value: 1 } },
    { upsert: true, returnDocument: 'after' }
  );

  const counter = result.value || result;
  return 1000 + (counter.sequence_value || 0);
}

// Helper function to extract state from shipping address
function extractStateFromAddress(shippingAddressString) {
  try {
    if (!shippingAddressString) return null;
    const addressData = JSON.parse(shippingAddressString);
    return addressData.state || null;
  } catch (error) {
    console.error('Error parsing shipping address for state:', error);
    return null;
  }
}

// Helper function to extract shipping partner info (ID or Object)
function extractShippingPartner(shippingAddressString) {
  try {
    if (!shippingAddressString) return null;
    const addressData = JSON.parse(shippingAddressString);
    return addressData.shippingPartner || null;
  } catch (error) {
    console.error('Error parsing shipping address:', error);
    return null;
  }
}

/**
 * CHECK IF SHIPPING METHOD SUPPORTS A GIVEN STATE
 * Returns true if the method supports the state, false otherwise
 */
function doesShippingMethodSupportState(method, state) {
  if (!method || !state) return false;

  const normalizedState = normalizeStateName(state);

  // 1. Pan-India Check
  if (method.isPanIndia) {
    if (method.excludedRegions && method.excludedRegions.length > 0) {
      // Check if state is excluded
      const isExcluded = method.excludedRegions.some(r => normalizeStateName(r) === normalizedState);
      if (isExcluded) return false;
    }
    return true;
  }

  // 2. Region & Weight Based Check
  if (method.useRegionWeight) {
    if (method.regionWeightConfigs && method.regionWeightConfigs.length > 0) {
      // Check if state is in any config's regions array
      return method.regionWeightConfigs.some(config =>
        config.regions && config.regions.some(r => normalizeStateName(r) === normalizedState)
      );
    }
    // If configured to use region weight but no configs exist/match, it doesn't support the state
    return false;
  }

  // 3. Simple Weight Based
  if (method.useWeight) {
    // Usually applies to all regions if not Pan-India or Region-Specific
    return true;
  }

  // 4. Fixed Rate / Region Rates
  // If a fixed rate is set, it applies generally
  if (method.fixedRate !== null && method.fixedRate !== undefined) {
    return true;
  }

  // If no fixed rate, check if state is in specific region rates
  if (method.regionRates && method.regionRates.length > 0) {
    return method.regionRates.some(rate =>
      rate.regions && rate.regions.some(r => normalizeStateName(r) === normalizedState)
    );
  }

  return false;
}

/**
 * REVISED SHIPPING COST CALCULATION WITH STATE VALIDATION
 */
async function calculateShippingCost(shippingPartnerData, cartTotal, tenentId, state, cartWeight = 0) {
  try {
    console.log('=== SHIPPING COST CALCULATION START ===');
    console.log('Input:', { shippingPartnerData, cartTotal, tenentId, state, cartWeight });

    // ✅ CHECK FREE THRESHOLD FIRST — before any other logic
    const freeShippingThreshold = await FreeShippingThreshold.findOne({ tenentId });
    if (freeShippingThreshold) {
      // Check state-level override first
      if (state && freeShippingThreshold.stateThresholds && freeShippingThreshold.stateThresholds.length > 0) {
        const stateRule = freeShippingThreshold.stateThresholds.find(
          s => normalizeStateName(s.state) === normalizeStateName(state)
        );
        if (stateRule && stateRule.isActive && cartTotal >= stateRule.thresholdAmount) {
          console.log(`=== RESULT: Free shipping via state threshold for ${state} (${cartTotal} >= ${stateRule.thresholdAmount}) ===`);
          return 0;
        }
      }
      // Fall back to global threshold
      if (freeShippingThreshold.isActive && cartTotal >= freeShippingThreshold.thresholdAmount) {
        console.log(`=== RESULT: Free shipping via global threshold (${cartTotal} >= ${freeShippingThreshold.thresholdAmount}) ===`);
        return 0;
      }
    }

    // 1. DYNAMIC SHIPPING METHOD STRATEGY (Database Driven)
    if (shippingPartnerData) {
      let methodId = null;

      // Determine ID from input
      if (typeof shippingPartnerData === 'string') {
        if (mongoose.Types.ObjectId.isValid(shippingPartnerData)) {
          methodId = shippingPartnerData;
        }
      } else if (typeof shippingPartnerData === 'object' && shippingPartnerData._id) {
        methodId = shippingPartnerData._id;
      } else if (typeof shippingPartnerData === 'object' && shippingPartnerData.id) {
        methodId = shippingPartnerData.id;
      }

      console.log('Extracted methodId:', methodId);

      if (methodId) {
        const method = await ShippingMethod.findOne({ _id: methodId, tenentId, isActive: true });

        if (method) {
          console.log(`Found ShippingMethod: ${method.name} (${method.type})`);
          console.log('Method details:', JSON.stringify({
            isPanIndia: method.isPanIndia,
            useRegionWeight: method.useRegionWeight,
            useWeight: method.useWeight,
            defaultPrice: method.defaultPrice,
            ratePerKg: method.ratePerKg,
            fixedRate: method.fixedRate
          }, null, 2));

          // Validate that this method supports the customer's state
          const supportsState = doesShippingMethodSupportState(method, state);
          console.log(`Method supports state ${state}:`, supportsState);

          if (!supportsState) {
            throw new Error(`Shipping method "${method.name}" does not support state: ${state}`);
          }

          if (method.type === 'FREE_SHIPPING') {
            const minAmount = method.minAmount || 0;
            console.log(`FREE_SHIPPING: minAmount=${minAmount}, cartTotal=${cartTotal}`);
            if (minAmount === 0 || cartTotal >= minAmount) {
              console.log('=== RESULT: Free Shipping (threshold met) ===');
              return 0;
            } else {
              console.log(`Cart total ${cartTotal} below free shipping threshold ${minAmount}, using fallback charge`);
              return method.fixedRate || method.defaultPrice || 0;
            }
          }

          if (method.type === 'COURIER_PARTNER') {
            let cost = method.defaultPrice || 0;
            let additionalCost = 0;

            // A. Pan-India Shipping
            if (method.isPanIndia) {
              console.log('Using Pan-India calculation...');
              console.log(`=== RESULT: Pan-India cost = ${cost} ===`);
              return cost;
            }

            // B. Region & Weight Based
            if (method.useRegionWeight && method.regionWeightConfigs && method.regionWeightConfigs.length > 0) {
              console.log('Trying Region & Weight Based calculation...');
              const normalizedTargetRegion = normalizeStateName(state);
              console.log('Normalized target region:', normalizedTargetRegion);

              const config = method.regionWeightConfigs.find(c => {
                return c.regions && c.regions.some(r => normalizeStateName(r) === normalizedTargetRegion);
              });

              if (config) {
                console.log('Found matching region config regions:', config.regions);

                const sortedRanges = [...config.weightRanges].sort((a, b) => a.minWeight - b.minWeight);

                const range = sortedRanges.find(r => {
                  console.log(`Checking weight range: ${r.minWeight} <= ${cartWeight} <= ${r.maxWeight}`);
                  return cartWeight >= r.minWeight && cartWeight <= r.maxWeight;
                });

                if (range) {
                  additionalCost = range.price;
                  console.log(`=== RESULT: Region & Weight price = ${additionalCost} (range: ${range.minWeight}-${range.maxWeight}kg) ===`);
                } else {
                  const maxRange = sortedRanges[sortedRanges.length - 1];
                  if (cartWeight > maxRange.maxWeight) {
                    console.log(`Cart weight ${cartWeight}kg exceeds max range ${maxRange.maxWeight}kg, using highest range price`);
                    additionalCost = maxRange.price;
                  } else {
                    const minRange = sortedRanges[0];
                    console.log(`Cart weight ${cartWeight}kg below all ranges, using lowest range price`);
                    additionalCost = minRange.price;
                  }
                }

                const totalCost = cost + additionalCost;
                console.log(`=== RESULT: Total Cost (Base: ${cost} + Weight: ${additionalCost}) = ${totalCost} ===`);
                return totalCost;
              } else {
                console.log('Region not found in weight config, checking other strategies...');
              }
            }

            // C. Simple Weight Based (Rate per KG)
            if (method.useWeight && method.ratePerKg) {
              console.log('Using Simple Weight Based calculation...');
              const chargeableWeight = Math.max(0.5, cartWeight);
              additionalCost = Math.ceil(chargeableWeight * method.ratePerKg);
              const totalCost = cost + additionalCost;
              console.log(`=== RESULT: Weight-based cost (Base: ${cost} + Weight: ${additionalCost}) = ${totalCost} ===`);
              return totalCost;
            }

            // D. Region Flat Rate Exceptions
            if (method.regionRates && method.regionRates.length > 0) {
              console.log('Trying Region Flat Rate Exceptions calculation...');
              const normalizedTargetRegion = normalizeStateName(state);

              const regionRate = method.regionRates.find(r => {
                return r.regions && r.regions.some(reg => normalizeStateName(reg) === normalizedTargetRegion);
              });

              if (regionRate) {
                additionalCost = regionRate.price;
                const totalCost = cost + additionalCost;
                console.log(`=== RESULT: Region flat rate exception (Base: ${cost} + Region: ${additionalCost}) = ${totalCost} ===`);
                return totalCost;
              }
            }

            // E. Fixed Rate (Fallback)
            if (method.fixedRate !== null && method.fixedRate !== undefined) {
              additionalCost = method.fixedRate;
              const totalCost = cost + additionalCost;
              console.log(`=== RESULT: Fixed rate (Base: ${cost} + Fixed: ${additionalCost}) = ${totalCost} ===`);
              return totalCost;
            }

            // F. Default Price Only
            console.log(`=== RESULT: Default Base Price Only = ${cost} ===`);
            return cost;
          }
        } else {
          console.log('No matching shipping method found in database');
        }
      }
    }

    console.log('Falling back to legacy logic...');

    // 2. LEGACY LOGIC (Fallback)
    const tenantRules = TENANT_SHIPPING_RULES[tenentId];
    if (tenantRules) {
      if (state && isStateEligibleForFreeDelivery(state, tenantRules.freeDeliveryStates)) {
        console.log('=== RESULT: Free delivery via tenant rules (eligible state) ===');
        return 0;
      }
      if (cartTotal >= tenantRules.panIndiaFreeThreshold) {
        console.log('=== RESULT: Free delivery via tenant rules (threshold met) ===');
        return 0;
      }
      console.log(`=== RESULT: Tenant pan-India cost = ${tenantRules.panIndiaDeliveryCost} ===`);
      return tenantRules.panIndiaDeliveryCost;
    }

    // 3. Generic Fallback
    if (shippingPartnerData) {
      const name = typeof shippingPartnerData === 'object' ? shippingPartnerData.name : shippingPartnerData;
      const cost = typeof shippingPartnerData === 'object' ? shippingPartnerData.cost : 0;

      if (SPECIAL_SHIPPING_PARTNERS.includes(name)) {
        console.log(`=== RESULT: Special partner cost = ${cost || 0} ===`);
        return cost > 0 ? cost : 0;
      }
    }

    if (cartTotal >= FREE_SHIPPING_THRESHOLD) {
      console.log('=== RESULT: Free shipping (generic threshold) ===');
      return 0;
    }

    const finalCost = (typeof shippingPartnerData === 'object' && shippingPartnerData.cost) ? shippingPartnerData.cost : 0;
    console.log(`=== RESULT: Generic fallback cost = ${finalCost} ===`);
    return finalCost;

  } catch (error) {
    console.error('=== ERROR in calculateShippingCost ===');
    console.error('Error calculating shipping cost:', error);
    throw error;
  }
}

// ✅ NEW ENDPOINT: Get available shipping methods for a specific state
router.get('/shipping-methods/:tenentId', async (req, res) => {
  try {
    const { tenentId } = req.params;
    const { state } = req.query;

    if (!state) {
      return res.status(400).json({ message: "State is required" });
    }

    // Find all active shipping methods for this tenant
    const methods = await ShippingMethod.find({ tenentId, isActive: true });

    // Filter only methods that support the customer's state
    const availableMethods = methods.filter(method =>
      doesShippingMethodSupportState(method, state)
    );

    console.log(`Found ${availableMethods.length} shipping methods for state: ${state}`);

    res.json(availableMethods);

  } catch (error) {
    console.error('Error fetching shipping methods:', error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Get cart contents using securityAccessToken
router.get('/:securityAccessToken/:tenentId', async (req, res) => {
  try {
    const { securityAccessToken, tenentId } = req.params;
    console.log("securityAccessToken for cart", securityAccessToken);

    const senderId = await getSenderIdFromToken(securityAccessToken, tenentId);

    let cart = await Cart.findOne({ senderId, tenentId });
    console.log("cart", cart);

    if (!cart) {
      return res.status(200).json({ items: [], total: 0 });
    }

    const total = cart.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const totalWeight = await calculateCartWeight(cart.items, tenentId);
    console.log("totalWeight1",totalWeight);
    res.status(200).json({
      items: cart.items,
      total,
      totalWeight
    });
  } catch (error) {
    console.error('Error fetching cart:', error);
    if (error.message === 'Invalid security token') {
      return res.status(401).json({ message: 'Invalid security token' });
    }
    res.status(500).json({ message: 'Server error fetching cart' });
  }
});

// Add product to cart by SKU using securityAccessToken
router.post('/add', async (req, res) => {
  console.log('Cart add request body:', req.body);
  try {
    const { securityAccessToken, tenentId, sku, quantity } = req.body;

    if (!securityAccessToken || !tenentId || !sku || !quantity) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const senderId = await getSenderIdFromToken(securityAccessToken, tenentId);
    const productDetail = await ProductDetail.findOne({ tenentId, sku });

    if (!productDetail) {
      return res.status(404).json({ message: 'Product not found' });
    }

    const availableStock = productDetail.quantityInStock || 0;
    if (quantity > availableStock) {
      return res.status(400).json({ message: `Not enough stock available. Only ${availableStock} items in stock.` });
    }

    const price = parseFloat(productDetail.units[0].price);
    let cart = await Cart.findOne({ senderId, tenentId });

    if (!cart) {
      cart = new Cart({ senderId, tenentId, items: [] });
    }

    const existingItemIndex = cart.items.findIndex(item => item.sku === sku);

    if (existingItemIndex !== -1) {
      cart.items[existingItemIndex].quantity += quantity;
    } else {
      cart.items.push({
        sku,
        productName: productDetail.productName,
        productPhotoUrl: productDetail.productPhotoUrl || productDetail.productPhoto,
        price,
        quantity
      });
    }

    await cart.save();
    const total = cart.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    res.status(200).json({
      message: 'Product added to cart',
      cart: {
        items: cart.items,
        total
      }
    });
  } catch (error) {
    console.error('Error adding product to cart:', error);
    if (error.message === 'Invalid security token') {
      return res.status(401).json({ message: 'Invalid security token' });
    }
    res.status(500).json({ message: 'Server error adding product to cart' });
  }
});

// Update quantity of an item in the cart using securityAccessToken
router.put('/update', async (req, res) => {
  try {
    const { securityAccessToken, tenentId, sku, quantity } = req.body;

    if (!securityAccessToken || !tenentId || !sku || quantity === undefined) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const senderId = await getSenderIdFromToken(securityAccessToken, tenentId);
    const newQuantity = parseInt(quantity);

    if (isNaN(newQuantity) || newQuantity < 0) {
      return res.status(400).json({ message: 'Quantity must be a non-negative number' });
    }

    let cart = await Cart.findOne({ senderId, tenentId });

    if (!cart) {
      return res.status(404).json({ message: 'Cart not found' });
    }

    const productDetail = await ProductDetail.findOne({ tenentId, sku });

    if (!productDetail) {
      return res.status(404).json({ message: 'Product not found' });
    }

    const availableStock = productDetail.quantityInStock || 0;
    const existingItemIndex = cart.items.findIndex(item => item.sku === sku);

    if (existingItemIndex === -1) {
      return res.status(404).json({ message: 'Item not found in cart' });
    }

    const currentQuantity = cart.items[existingItemIndex].quantity;

    if (newQuantity > currentQuantity && newQuantity > availableStock) {
      return res.status(400).json({
        message: `Not enough stock available. Only ${availableStock} items in stock.`,
        insufficientStock: true
      });
    }

    cart.items[existingItemIndex].quantity = newQuantity;
    await cart.save();

    const total = cart.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    res.status(200).json({
      message: 'Cart updated successfully',
      cart: {
        items: cart.items,
        total
      }
    });
  } catch (error) {
    console.error('Error updating cart:', error);
    if (error.message === 'Invalid security token') {
      return res.status(401).json({ message: 'Invalid security token' });
    }
    res.status(500).json({ message: 'Server error updating cart' });
  }
});

// Remove item from cart using securityAccessToken
router.delete('/remove', async (req, res) => {
  try {
    const { securityAccessToken, tenentId, sku } = req.body;

    if (!securityAccessToken || !tenentId || !sku) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const senderId = await getSenderIdFromToken(securityAccessToken, tenentId);
    let cart = await Cart.findOne({ senderId, tenentId });

    if (!cart) {
      return res.status(404).json({ message: 'Cart not found' });
    }

    cart.items = cart.items.filter(item => item.sku !== sku);
    await cart.save();

    const total = cart.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    res.status(200).json({
      message: 'Item removed from cart',
      cart: {
        items: cart.items,
        total
      }
    });
  } catch (error) {
    console.error('Error removing item from cart:', error);
    if (error.message === 'Invalid security token') {
      return res.status(401).json({ message: 'Invalid security token' });
    }
    res.status(500).json({ message: 'Server error removing item from cart' });
  }
});

// Clear cart using securityAccessToken
router.delete('/clear', async (req, res) => {
  try {
    const { securityAccessToken, tenentId } = req.body;

    if (!securityAccessToken || !tenentId) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const senderId = await getSenderIdFromToken(securityAccessToken, tenentId);

    const result = await Cart.findOneAndUpdate(
      { senderId, tenentId },
      { $set: { items: [] } },
      { new: true }
    );

    if (!result) {
      return res.status(404).json({ message: 'Cart not found' });
    }

    res.status(200).json({
      message: 'Cart cleared successfully',
      cart: {
        items: [],
        total: 0
      }
    });
  } catch (error) {
    console.error('Error clearing cart:', error);
    if (error.message === 'Invalid security token') {
      return res.status(401).json({ message: 'Invalid security token' });
    }
    res.status(500).json({ message: 'Server error clearing cart' });
  }
});

// Get product details by SKU
router.get('/product/:tenentId/:sku', async (req, res) => {
  try {
    const { tenentId, sku } = req.params;

    const productDetail = await ProductDetail.findOne({
      tenentId,
      sku
    });

    if (!productDetail) {
      return res.status(404).json({ message: 'Product not found' });
    }

    res.status(200).json(productDetail);
  } catch (error) {
    console.error('Error fetching product details:', error);
    res.status(500).json({ message: 'Server error fetching product details' });
  }
});

// Validate stock availability for all items in cart
router.post('/validate-stock', async (req, res) => {
  try {
    console.log('Starting validate-stock process with body:', req.body);
    const { securityAccessToken, tenentId } = req.body;

    if (!securityAccessToken || !tenentId) {
      console.log('Missing required fields in validate-stock request');
      return res.status(400).json({ message: 'Missing required fields' });
    }

    console.log('Getting senderId from token for tenantId:', tenentId);
    const senderId = await getSenderIdFromToken(securityAccessToken, tenentId);
    console.log('Retrieved senderId:', senderId);

    console.log('Finding cart for senderId:', senderId);
    const cart = await Cart.findOne({ senderId, tenentId });
    console.log('Cart found:', cart ? `Cart with ${cart.items.length} items` : 'No cart found');

    if (!cart || !cart.items || cart.items.length === 0) {
      console.log('Cart is empty or not found');
      return res.status(200).json({
        valid: true,
        message: 'Cart is empty',
        insufficientItems: []
      });
    }

    console.log(`Validating stock for ${cart.items.length} items in cart`);
    const insufficientItems = [];

    for (const item of cart.items) {
      console.log(`Checking stock for SKU: ${item.sku}, Quantity: ${item.quantity}`);
      const productDetail = await ProductDetail.findOne({ tenentId, sku: item.sku });

      if (!productDetail) {
        console.log(`Product not found for SKU: ${item.sku}`);
        insufficientItems.push({
          sku: item.sku,
          productName: item.productName,
          requestedQuantity: item.quantity,
          availableQuantity: 0,
          reason: 'Product no longer exists'
        });
        continue;
      }

      const availableStock = productDetail.quantityInStock || 0;
      console.log(`Available stock for ${item.sku}: ${availableStock}, Requested: ${item.quantity}`);

      if (item.quantity > availableStock) {
        console.log(`Insufficient stock for SKU: ${item.sku}`);
        insufficientItems.push({
          sku: item.sku,
          productName: item.productName,
          requestedQuantity: item.quantity,
          availableQuantity: availableStock,
          reason: 'Insufficient stock'
        });
      }
    }

    const isValid = insufficientItems.length === 0;
    console.log('Stock validation result:', {
      valid: isValid,
      insufficientItemsCount: insufficientItems.length
    });

    const result = {
      valid: isValid,
      message: isValid ? 'All items in cart have sufficient stock' : 'Some items have insufficient stock',
      insufficientItems
    };

    console.log('Validate-stock response:', result);
    res.status(200).json(result);
  } catch (error) {
    console.error('Error validating cart stock:', error);
    if (error.message === 'Invalid security token') {
      return res.status(401).json({ message: 'Invalid security token' });
    }
    res.status(500).json({ message: 'Server error validating cart stock' });
  }
});

async function createRazorpayPaymentLink(accessToken, { amount, customerPhone, description, billNo }) {
  const timestamp = Date.now();
  const reference_id = `PAY-${timestamp}-${Math.random().toString(36).substring(7)}`;

  const payload = {
    amount: Math.round(amount * 100),
    currency: 'INR',
    accept_partial: false,
    reference_id,
    description: description,
    notes: {
      bill_no: billNo.toString(),
      description: description
    },
    reminder_enable: true
  };

  console.log(payload, "link payload");

  const response = await fetch('https://api.razorpay.com/v1/payment_links', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorData = await response.text();
    throw new Error(`Failed to create payment link: ${errorData}`);
  }

  return await response.json();
}

router.post('/create-order', async (req, res) => {
  try {
    const { securityAccessToken, tenentId, amount, currency, receipt, notes } = req.body;
    console.log("notes", notes);
    console.log("amount", amount);

    if (!securityAccessToken || !tenentId || !amount) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    let senderId;
    try {
      senderId = await getSenderIdFromToken(securityAccessToken, tenentId);
    } catch (error) {
      return res.status(401).json({ error: 'Invalid security token' });
    }

    console.log('Validating stock before creating order');

    const cart = await Cart.findOne({ senderId, tenentId });

    if (!cart || !cart.items || cart.items.length === 0) {
      return res.status(400).json({ error: 'Cart is empty' });
    }

    const insufficientItems = [];

    for (const item of cart.items) {
      const productDetail = await ProductDetail.findOne({ tenentId, sku: item.sku });

      if (!productDetail) {
        insufficientItems.push({
          sku: item.sku,
          productName: item.productName,
          requestedQuantity: item.quantity,
          availableQuantity: 0,
          reason: 'Product no longer exists'
        });
        continue;
      }

      const availableStock = productDetail.quantityInStock || 0;

      if (item.quantity > availableStock) {
        insufficientItems.push({
          sku: item.sku,
          productName: item.productName,
          requestedQuantity: item.quantity,
          availableQuantity: availableStock,
          reason: 'Insufficient stock'
        });
      }
    }

    if (insufficientItems.length > 0) {
      return res.status(400).json({
        error: 'Insufficient stock',
        insufficientItems: insufficientItems
      });
    }

    const itemsTotal = cart.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const cartWeight = await calculateCartWeight(cart.items, tenentId);
     console.log("cartWeight",cartWeight);
    // Extract shipping partner and state from notes
    const shippingPartner = extractShippingPartner(notes.shipping_address);
    const state = extractStateFromAddress(notes.shipping_address);

    // ✅ VALIDATE: Check if selected shipping method supports the state
    if (shippingPartner && state) {
      let methodId = null;
      if (typeof shippingPartner === 'string' && mongoose.Types.ObjectId.isValid(shippingPartner)) {
        methodId = shippingPartner;
      } else if (typeof shippingPartner === 'object' && shippingPartner._id) {
        methodId = shippingPartner._id;
      }

      if (methodId) {
        const method = await ShippingMethod.findOne({ _id: methodId, tenentId, isActive: true });
        if (method && !doesShippingMethodSupportState(method, state)) {
          return res.status(400).json({
            error: 'Invalid shipping method',
            message: `Selected shipping method "${method.name}" does not support state: ${state}`
          });
        }
      }
    }

    // Calculate shipping cost (will throw error if method doesn't support state)
    let calculatedShippingCost;
    try {
      calculatedShippingCost = await calculateShippingCost(shippingPartner, itemsTotal, tenentId, state, cartWeight);
    } catch (shippingError) {
      return res.status(400).json({
        error: 'Shipping calculation failed',
        message: shippingError.message
      });
    }

    const total = itemsTotal + calculatedShippingCost;

    console.log("itemsTotal:", itemsTotal);
    console.log("cartWeight:", cartWeight);
    console.log("shippingPartner:", shippingPartner);
    console.log("state:", state);
    console.log("calculatedShippingCost:", calculatedShippingCost);
    console.log("frontend shipping_amount:", notes.shipping_amount);

    const frontendShippingAmount = Number(notes.shipping_amount || 0);
    if (Math.abs(frontendShippingAmount - calculatedShippingCost) > 0.01) {
      console.warn(`Shipping amount mismatch! Frontend: ${frontendShippingAmount}, Backend: ${calculatedShippingCost}`);
    }

    const totalInPaisa = Math.round(total * 100);
    if (amount !== totalInPaisa) {
      console.warn(`Amount mismatch: Request amount ${amount}, calculated total ${totalInPaisa}`);
    }

    const razorpayInfo = await Razorpay_info.findOne({ tenentId });

    if (!razorpayInfo || !razorpayInfo.razorpayAccessToken) {
      return res.status(404).json({
        error: 'Razorpay integration not found',
        message: 'Please connect your Razorpay account first'
      });
    }

    if (razorpayInfo.razorpayTokenExpiresAt && new Date() > new Date(razorpayInfo.razorpayTokenExpiresAt)) {
      return res.status(401).json({
        error: 'Razorpay token expired',
        message: 'Please reconnect your Razorpay account'
      });
    }

    const options = {
      amount: totalInPaisa,
      currency: currency || 'INR',
      receipt: receipt || `receipt_${Date.now()}`,
      notes: {
        ...notes,
        backend_calculated_shipping: calculatedShippingCost,
        backend_calculated_total: total
      }
    };

    try {
      const orderResponse = await axios.post('https://api.razorpay.com/v1/orders', options, {
        headers: {
          'Authorization': `Bearer ${razorpayInfo.razorpayAccessToken}`,
          'Content-Type': 'application/json'
        }
      });

      let key_id = null;
      try {
        const merchantResponse = await axios.get('https://api.razorpay.com/v1/merchants/me', {
          headers: {
            'Authorization': `Bearer ${razorpayInfo.razorpayAccessToken}`,
            'Content-Type': 'application/json'
          }
        });
        key_id = merchantResponse.data.id;
        console.log("merchantResponse", merchantResponse);
      } catch (merchantError) {
        console.warn('Could not fetch merchant details, using key_id from database instead');
        key_id = razorpayInfo.razorpayKeyId;
      }

      const newOrder = new Order({
        tenentId,
        senderId,
        razorpayOrderId: orderResponse.data.id,
        cartItems: cart.items,
        amount: total,
        currency: orderResponse.data.currency,
        status: 'CREATED',
        notes: {
          ...notes,
          backend_calculated_shipping: calculatedShippingCost,
          backend_calculated_total: total
        },
        shippingCost: calculatedShippingCost,
        createdAt: new Date(orderResponse.data.created_at * 1000)
      });

      await newOrder.save();

      res.status(200).json({
        id: orderResponse.data.id,
        amount: totalInPaisa,
        currency: orderResponse.data.currency,
        key_id: key_id || razorpayInfo.razorpayKeyId,
        created_at: orderResponse.data.created_at,
        backend_calculated_total: total,
        backend_calculated_shipping: calculatedShippingCost
      });
    } catch (apiError) {
      console.error('Razorpay API error:', apiError.response?.data || apiError.message);

      return res.status(apiError.response?.status || 500).json({
        error: 'Razorpay API error',
        details: apiError.response?.data || { message: apiError.message }
      });
    }
  } catch (error) {
    console.error('Error creating Razorpay order:', error);

    res.status(500).json({
      error: 'Failed to create order',
      message: error.message
    });
  }
});

router.post('/verify-payment', async (req, res) => {
  try {
    const {
      tenentId,
      razorpay_payment_id,
      razorpay_order_id,
      razorpay_signature,
      securityAccessToken
    } = req.body;

    if (!tenentId || !razorpay_payment_id || !razorpay_order_id || !razorpay_signature || !securityAccessToken) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    let senderId;
    try {
      senderId = await getSenderIdFromToken(securityAccessToken, tenentId);
    } catch (error) {
      return res.status(401).json({ error: 'Invalid security token' });
    }

    const razorpayInfo = await Razorpay_info.findOne({ tenentId });

    if (!razorpayInfo || !razorpayInfo.razorpayAccessToken || !razorpayInfo.razorpayWebhookSecret) {
      return res.status(404).json({ error: 'Razorpay integration not found or incomplete' });
    }

    const generatedSignature = crypto
      .createHmac('sha256', razorpayInfo.razorpayWebhookSecret)
      .update(razorpay_order_id + '|' + razorpay_payment_id)
      .digest('hex');

    if (generatedSignature !== razorpay_signature) {
      return res.status(400).json({
        success: false,
        error: 'Payment verification failed: Invalid signature'
      });
    }

    const paymentResponse = await axios.get(`https://api.razorpay.com/v1/payments/${razorpay_payment_id}`, {
      headers: {
        'Authorization': `Bearer ${razorpayInfo.razorpayAccessToken}`
      }
    });

    const payment = paymentResponse.data;

    if (payment.order_id !== razorpay_order_id) {
      return res.status(400).json({
        success: false,
        error: 'Payment verification failed: Order ID mismatch'
      });
    }

    const session = await mongoose.startSession();
    session.startTransaction();

     try {
    const { orderId, payment, razorpay_payment_id } = req.body;

    // Find the order
    const order = await Order.findById(orderId).session(session);
    if (!order) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: 'Order not found' });
    }
console.log("Updating product stock for:", { tenentId: order.tenentId, sku: item.sku, quantity: item.quantity });

    // Update product stock
    for (const item of order.cartItems) {
      const result = await ProductDetail.updateOne(
        { tenentId: order.tenentId, sku: item.sku },
        { $inc: { quantityInStock: -item.quantity } },
        { session }
      );
console.log("Updating product stock for:", { tenentId: order.tenentId, sku: item.sku, quantity: item.quantity });

      if (result.matchedCount === 0) {
        throw new Error(`Product with SKU ${item.sku} not found`);
      }
    }

    // Update order with payment info
    order.razorpayPaymentId = razorpay_payment_id;
    order.status = payment.status === 'captured' ? 'paid' : payment.status;
    order.paymentDetails = payment;
    order.updatedAt = new Date();

    await order.save({ session });

    // Commit the transaction
    await session.commitTransaction();
    session.endSession();


      res.status(200).json({
        success: true,
        message: 'Payment verified successfully',
        orderId: order._id,
        payment: {
          id: payment.id,
          amount: payment.amount / 100,
          status: payment.status
        }
      });
    } catch (transactionError) {
      await session.abortTransaction();
      session.endSession();
      throw transactionError;
    }
  } catch (error) {
    console.error('Error verifying payment:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to verify payment',
      message: error.message
    });
  }
});

router.post('/create-payment-link', async (req, res) => {
  try {
    const { securityAccessToken, tenentId, amount, description, notes } = req.body;
    console.log("notes", notes);
    console.log("amount", amount);
    console.log("securityAccessToken", securityAccessToken);
    console.log("tenentId", tenentId);

    if (!securityAccessToken || !tenentId || !amount) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    let senderId;
    try {
      senderId = await getSenderIdFromToken(securityAccessToken, tenentId);
      console.log("senderId", senderId);
    } catch (error) {
      return res.status(401).json({ error: 'Invalid security token' });
    }

    console.log('Validating stock before creating payment link');

    const cart = await Cart.findOne({ senderId, tenentId });

    if (!cart || !cart.items || cart.items.length === 0) {
      return res.status(400).json({ error: 'Cart is empty' });
    }

    const insufficientItems = [];

    for (const item of cart.items) {
      const productDetail = await ProductDetail.findOne({ tenentId, sku: item.sku });

      if (!productDetail) {
        insufficientItems.push({
          sku: item.sku,
          productName: item.productName,
          requestedQuantity: item.quantity,
          availableQuantity: 0,
          reason: 'Product no longer exists'
        });
        continue;
      }

      const availableStock = productDetail.quantityInStock || 0;

      if (item.quantity > availableStock) {
        insufficientItems.push({
          sku: item.sku,
          productName: item.productName,
          requestedQuantity: item.quantity,
          availableQuantity: availableStock,
          reason: 'Insufficient stock'
        });
      }
    }

    if (insufficientItems.length > 0) {
      return res.status(400).json({
        error: 'Insufficient stock',
        insufficientItems: insufficientItems
      });
    }

    const itemsTotal = cart.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const cartWeight = await calculateCartWeight(cart.items, tenentId);

    // Extract shipping partner and state from notes
    const shippingPartner = extractShippingPartner(notes.shipping_address);
    const state = extractStateFromAddress(notes.shipping_address);

    // ✅ VALIDATE: Check if selected shipping method supports the state
    if (shippingPartner && state) {
      let methodId = null;
      if (typeof shippingPartner === 'string' && mongoose.Types.ObjectId.isValid(shippingPartner)) {
        methodId = shippingPartner;
      } else if (typeof shippingPartner === 'object' && shippingPartner._id) {
        methodId = shippingPartner._id;
      }

      if (methodId) {
        const method = await ShippingMethod.findOne({ _id: methodId, tenentId, isActive: true });
        if (method && !doesShippingMethodSupportState(method, state)) {
          return res.status(400).json({
            error: 'Invalid shipping method',
            message: `Selected shipping method "${method.name}" does not support state: ${state}`
          });
        }
      }
    }

    // Calculate shipping cost (will throw error if method doesn't support state)
    let calculatedShippingCost;
    try {
      calculatedShippingCost = await calculateShippingCost(shippingPartner, itemsTotal, tenentId, state, cartWeight);
    } catch (shippingError) {
      return res.status(400).json({
        error: 'Shipping calculation failed',
        message: shippingError.message
      });
    }

    const total = itemsTotal + calculatedShippingCost;

    console.log("itemsTotal:", itemsTotal);
    console.log("cartWeight:", cartWeight);
    console.log("shippingPartner:", shippingPartner);
    console.log("state:", state);
    console.log("calculatedShippingCost:", calculatedShippingCost);
    console.log("frontend shipping_amount:", notes.shipping_amount);

    const frontendShippingAmount = Number(notes.shipping_amount || 0);
    if (Math.abs(frontendShippingAmount - calculatedShippingCost) > 0.01) {
      console.warn(`Shipping amount mismatch! Frontend: ${frontendShippingAmount}, Backend: ${calculatedShippingCost}`);
    }

    const billNo = Date.now();

    const razorpayInfo = await Razorpay_info.findOne({ tenentId });

    if (!razorpayInfo) {
      return res.status(404).json({
        error: 'Razorpay integration not found',
        message: 'Please connect your Razorpay account first'
      });
    }
    console.log("razorpayInfo", razorpayInfo);

    let razorpayaccessToken = razorpayInfo.razorpayAccessToken;

    try {
      const customerPhone = notes.customer_phone || '';
      const linkDescription = description || `Order from Cart - ${new Date().toISOString().split('T')[0]}`;

      const paymentLinkResponse = await createRazorpayPaymentLink(razorpayaccessToken, {
        amount: total,
        customerPhone,
        description: linkDescription,
        billNo
      });

      const orderId = await generateOrderId(tenentId);

      let shippingPartnerData = null;
      if (notes.shipping_address) {
        const addressData = JSON.parse(notes.shipping_address);
        if (addressData.shippingPartner) {
          shippingPartnerData = typeof addressData.shippingPartner === 'object'
            ? addressData.shippingPartner.name || JSON.stringify(addressData.shippingPartner)
            : addressData.shippingPartner;
        }
      }

      const userid = await Newuser.findOne({senderId: senderId, tenentId: tenentId}).sort({ createdAt: -1 }).limit(1);
      const name = userid ? userid.name : '';
      const username = userid ? userid.username : '';

      const newOrder = new Order({
        tenentId,
        senderId,
        orderId: orderId,
        bill_no: billNo,
        razorpayPaymentLinkId: paymentLinkResponse.id,
        razorpayPaymentLinkUrl: paymentLinkResponse.short_url,
        customer_name: notes.shipping_address ? JSON.parse(notes.shipping_address).name : "",
        name: name,
        username: username,
        products: cart.items.map(item => ({
          sku: item.sku,
          product_name: item.productName,
          quantity: Number(item.quantity),
          price: Number(item.price)
        })),
        amount: total,
        currency: 'INR',
        status: 'CREATED',
        timestamp: new Date().getTime().toString(),
        shipping_cost: calculatedShippingCost,
        total_amount: total,
        paymentStatus: "",
        paymentMethod: "",
        print_status: "PENDING",
        payment_reminder_sent: false,
        payment_reminder_scheduled: true,
        tracking_status: "NOT_SHIPPED",
        holding_status: "NOT_ON_HOLD",
        is_on_hold: false,
        packing_status: "PENDING",
        address: notes.shipping_address ? JSON.parse(notes.shipping_address).address : "",
        city: notes.shipping_address ? JSON.parse(notes.shipping_address).city : "",
        country: "India",
        phone_number: notes.customer_phone || senderId,
        state: notes.shipping_address ? JSON.parse(notes.shipping_address).state : "",
        zip_code: notes.shipping_address ? JSON.parse(notes.shipping_address).pinCode : "",
        shipping_partner: shippingPartnerData,
        created_at: new Date()
      });

      await newOrder.save();

      res.status(200).json({
        id: paymentLinkResponse.id,
        payment_link_url: paymentLinkResponse.short_url,
        reference_id: paymentLinkResponse.reference_id,
        amount: total,
        currency: 'INR',
        status: paymentLinkResponse.status,
        backend_calculated_total: total,
        backend_calculated_shipping: calculatedShippingCost
      });
    } catch (apiError) {
      console.error('Razorpay API error:', apiError.response?.data || apiError.message);

      return res.status(apiError.response?.status || 500).json({
        error: 'Razorpay API error',
        details: apiError.response?.data || { message: apiError.message }
      });
    }
  } catch (error) {
    console.error('Error creating Razorpay payment link:', error);

    res.status(500).json({
      error: 'Failed to create payment link',
      message: error.message
    });
  }
});

module.exports = router;

