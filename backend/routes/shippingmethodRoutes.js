const express = require('express');
const ShippingMethod = require('../models/ShippingMethod');
const FreeShippingThreshold = require('../models/FreeShippingThreshold');
const router = express.Router();

// ─── Threshold Routes ────────────────────────────────────────────────────────

// GET threshold for a tenant
router.get('/threshold/:tenentId', async (req, res) => {
  try {
    const { tenentId } = req.params;
    const threshold = await FreeShippingThreshold.findOne({ tenentId });
    if (!threshold) return res.status(404).json({ message: 'No threshold found for this tenant' });
    res.status(200).json(threshold);
  } catch (error) {
    console.error('Error fetching free shipping threshold:', error);
    res.status(500).json({ message: 'Server error fetching free shipping threshold', error: error.message });
  }
});

// CREATE / UPDATE threshold (global + per-state)
router.post('/threshold', async (req, res) => {
  try {
    const { tenentId, thresholdAmount, isActive, stateThresholds } = req.body;

    if (!tenentId || thresholdAmount === undefined || thresholdAmount === null) {
      return res.status(400).json({ message: 'Missing required fields' });
    }
    if (thresholdAmount < 0) {
      return res.status(400).json({ message: 'Threshold amount must be 0 or greater' });
    }

    // Validate stateThresholds if provided
    const sanitizedStateThresholds = Array.isArray(stateThresholds)
      ? stateThresholds
          .filter(s => s.state && s.thresholdAmount >= 0)
          .map(s => ({
            state: s.state.trim(),
            thresholdAmount: parseFloat(s.thresholdAmount),
            isActive: s.isActive ?? true
          }))
      : [];

    const threshold = await FreeShippingThreshold.findOneAndUpdate(
      { tenentId },
      {
        tenentId,
        thresholdAmount: parseFloat(thresholdAmount),
        isActive: isActive ?? false,
        stateThresholds: sanitizedStateThresholds
      },
      { new: true, upsert: true, runValidators: true }
    );

    res.status(200).json({ message: 'Free shipping threshold saved successfully', threshold });
  } catch (error) {
    console.error('Error saving free shipping threshold:', error);
    res.status(500).json({ message: 'Server error saving free shipping threshold', error: error.message });
  }
});

// CHECK if an order qualifies for free shipping
router.post('/threshold/check', async (req, res) => {
  try {
    const { tenentId, orderAmount, state } = req.body;

    if (!tenentId || orderAmount === undefined || orderAmount === null) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const threshold = await FreeShippingThreshold.findOne({ tenentId });

    if (!threshold) {
      return res.status(200).json({ qualifies: false, message: 'No free shipping threshold configured' });
    }

    // Use instance method (state-aware)
    const qualifies = threshold.qualifiesForFreeShipping(parseFloat(orderAmount), state);

    // Determine which rule was applied for the response message
    let appliedAmount = threshold.isActive ? threshold.thresholdAmount : null;
    if (state && threshold.stateThresholds && threshold.stateThresholds.length > 0) {
      const stateRule = threshold.stateThresholds.find(
        s => s.state.trim().toLowerCase() === state.trim().toLowerCase()
      );
      if (stateRule && stateRule.isActive) appliedAmount = stateRule.thresholdAmount;
    }

    res.status(200).json({
      qualifies,
      threshold: appliedAmount,
      isActive: threshold.isActive,
      message: qualifies
        ? 'Order qualifies for free shipping'
        : appliedAmount !== null
          ? `Order needs ₹${(appliedAmount - orderAmount).toFixed(2)} more for free shipping`
          : 'Free shipping threshold not active'
    });
  } catch (error) {
    console.error('Error checking free shipping eligibility:', error);
    res.status(500).json({ message: 'Server error checking free shipping eligibility', error: error.message });
  }
});

// ─── Shipping Method Routes ───────────────────────────────────────────────────

// GET all shipping methods for a tenant
router.get('/:tenentId', async (req, res) => {
  try {
    const { tenentId } = req.params;
    const methods = await ShippingMethod.find({ tenentId, isActive: true }).sort({ createdAt: -1 });
    res.status(200).json(methods);
  } catch (error) {
    console.error('Error fetching shipping methods:', error);
    res.status(500).json({ message: 'Server error fetching shipping methods' });
  }
});

// CREATE a new shipping method
router.post('/create', async (req, res) => {
  try {
    const {
      tenentId, name, type, minAmount, defaultPrice,
      useWeight, ratePerKg, fixedRate, regionRates, isActive,
      useRegionWeight, regionWeightConfigs, isPanIndia, excludedRegions
    } = req.body;

    if (!tenentId || !name || !type) return res.status(400).json({ message: 'Missing required fields' });
    if (!['FREE_SHIPPING', 'COURIER_PARTNER'].includes(type)) {
      return res.status(400).json({ message: 'Invalid shipping method type' });
    }

    const newMethod = new ShippingMethod({
      tenentId, name, type,
      minAmount: type === 'FREE_SHIPPING' ? minAmount : null,
      defaultPrice: type === 'COURIER_PARTNER' ? (defaultPrice || 0) : null,
      useWeight: type === 'COURIER_PARTNER' ? useWeight : false,
      ratePerKg: type === 'COURIER_PARTNER' && useWeight ? ratePerKg : null,
      fixedRate: type === 'COURIER_PARTNER' && !useWeight && !useRegionWeight ? fixedRate : null,
      regionRates: type === 'COURIER_PARTNER' && !useWeight && !useRegionWeight && Array.isArray(regionRates) ? regionRates : [],
      useRegionWeight: type === 'COURIER_PARTNER' ? useRegionWeight : false,
      regionWeightConfigs: type === 'COURIER_PARTNER' && useRegionWeight && Array.isArray(regionWeightConfigs) ? regionWeightConfigs : [],
      isPanIndia: type === 'COURIER_PARTNER' ? isPanIndia : false,
      excludedRegions: type === 'COURIER_PARTNER' && isPanIndia && Array.isArray(excludedRegions) ? excludedRegions : [],
      isActive: isActive ?? true
    });

    await newMethod.save();
    res.status(201).json({ message: 'Shipping method created successfully', method: newMethod });
  } catch (error) {
    console.error('Error creating shipping method:', error);
    res.status(500).json({ message: 'Server error creating shipping method', error: error.message });
  }
});

// UPDATE an existing shipping method
router.put('/update/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      tenentId, name, type, minAmount, defaultPrice,
      useWeight, ratePerKg, fixedRate, regionRates, isActive,
      useRegionWeight, regionWeightConfigs, isPanIndia, excludedRegions
    } = req.body;

    if (!tenentId || !id) return res.status(400).json({ message: 'Missing required fields' });
    if (type && !['FREE_SHIPPING', 'COURIER_PARTNER'].includes(type)) {
      return res.status(400).json({ message: 'Invalid shipping method type' });
    }

    const updatedMethod = await ShippingMethod.findOneAndUpdate(
      { _id: id, tenentId },
      {
        name, type,
        minAmount: type === 'FREE_SHIPPING' ? minAmount : null,
        defaultPrice: type === 'COURIER_PARTNER' ? (defaultPrice !== undefined ? defaultPrice : 0) : null,
        useWeight: type === 'COURIER_PARTNER' ? useWeight : false,
        ratePerKg: type === 'COURIER_PARTNER' && useWeight ? ratePerKg : null,
        fixedRate: type === 'COURIER_PARTNER' && !useWeight && !useRegionWeight ? fixedRate : null,
        regionRates: type === 'COURIER_PARTNER' && !useWeight && !useRegionWeight && Array.isArray(regionRates) ? regionRates : [],
        useRegionWeight: type === 'COURIER_PARTNER' ? useRegionWeight : false,
        regionWeightConfigs: type === 'COURIER_PARTNER' && useRegionWeight && Array.isArray(regionWeightConfigs) ? regionWeightConfigs : [],
        isPanIndia: type === 'COURIER_PARTNER' ? isPanIndia : false,
        excludedRegions: type === 'COURIER_PARTNER' && isPanIndia && Array.isArray(excludedRegions) ? excludedRegions : [],
        isActive
      },
      { new: true, runValidators: true }
    );

    if (!updatedMethod) return res.status(404).json({ message: 'Shipping method not found' });
    res.status(200).json({ message: 'Shipping method updated successfully', method: updatedMethod });
  } catch (error) {
    console.error('Error updating shipping method:', error);
    res.status(500).json({ message: 'Server error updating shipping method', error: error.message });
  }
});

// DELETE a shipping method
router.delete('/delete/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { tenentId } = req.body;

    if (!id || !tenentId) return res.status(400).json({ message: 'Missing required fields' });

    const deletedMethod = await ShippingMethod.findOneAndDelete({ _id: id, tenentId });
    if (!deletedMethod) return res.status(404).json({ message: 'Shipping method not found' });

    res.status(200).json({ message: 'Shipping method deleted successfully', method: deletedMethod });
  } catch (error) {
    console.error('Error deleting shipping method:', error);
    res.status(500).json({ message: 'Server error deleting shipping method', error: error.message });
  }
});

// CALCULATE shipping cost for a specific order
router.post('/calculate', async (req, res) => {
  try {
    const { tenentId, methodId, weight, orderAmount, region } = req.body;

    if (!tenentId || !methodId) return res.status(400).json({ message: 'Missing required fields' });

    // Check free shipping threshold (state-aware)
    const threshold = await FreeShippingThreshold.findOne({ tenentId });
    if (threshold && threshold.qualifiesForFreeShipping(parseFloat(orderAmount || 0), region)) {
      return res.status(200).json({
        cost: 0,
        isFreeShipping: true,
        reason: 'Order qualifies for free shipping threshold',
        breakdown: { defaultPrice: 0, additionalCharges: 0, totalCost: 0 }
      });
    }

    const method = await ShippingMethod.findOne({ _id: methodId, tenentId, isActive: true });
    if (!method) return res.status(404).json({ message: 'Shipping method not found' });

    let cost = 0;
    let isFreeShipping = false;
    let breakdown = { defaultPrice: 0, additionalCharges: 0, totalCost: 0 };

    if (method.type === 'FREE_SHIPPING') {
      if (!method.minAmount || (orderAmount && orderAmount >= method.minAmount)) {
        cost = 0;
        isFreeShipping = true;
      } else {
        return res.status(400).json({ message: `Order amount must be at least ₹${method.minAmount} for free shipping` });
      }
    } else if (method.type === 'COURIER_PARTNER') {
      let basePrice = method.defaultPrice || 0;
      let additionalCost = 0;

      if (method.isPanIndia) {
        if (region && method.excludedRegions && method.excludedRegions.length > 0) {
          const isExcluded = method.excludedRegions.some(r => r.trim().toLowerCase() === region.trim().toLowerCase());
          if (isExcluded) return res.status(400).json({ message: `Shipping unavailable for region: ${region}` });
        }
      } else if (method.useRegionWeight) {
        if (!weight) return res.status(400).json({ message: 'Weight is required for this shipping method' });
        if (!region) return res.status(400).json({ message: 'Region/State is required for this shipping method' });

        const config = method.regionWeightConfigs.find(
          c => c.regions && c.regions.some(r => r.trim().toLowerCase() === region.trim().toLowerCase())
        );
        if (!config) return res.status(400).json({ message: `Shipping unavailable for region: ${region}` });

        const range = config.weightRanges.find(r => weight >= r.minWeight && weight <= r.maxWeight);
        if (range) {
          additionalCost = range.price;
        } else {
          return res.status(400).json({ message: `No shipping rate defined for weight ${weight}kg in ${region}` });
        }
      } else if (method.useWeight) {
        if (!weight) return res.status(400).json({ message: 'Weight is required for this shipping method' });
        additionalCost = method.ratePerKg * weight;
      } else {
        let calculatedCost = method.fixedRate || 0;
        if (region && method.regionRates && method.regionRates.length > 0) {
          const regionRate = method.regionRates.find(r =>
            r.regions && r.regions.some(reg => reg.toLowerCase().trim() === region.toLowerCase().trim())
          );
          if (regionRate) calculatedCost = regionRate.price;
        }
        additionalCost = calculatedCost;
      }

      cost = basePrice + additionalCost;
      breakdown = { defaultPrice: basePrice, additionalCharges: additionalCost, totalCost: cost };
    }

    res.status(200).json({
      cost, isFreeShipping, breakdown,
      method: { id: method._id, name: method.name, type: method.type }
    });
  } catch (error) {
    console.error('Error calculating shipping cost:', error);
    res.status(500).json({ message: 'Server error calculating shipping cost', error: error.message });
  }
});

module.exports = router;
