const mongoose = require('mongoose');

const shippingMethodSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  type: {
    type: String,
    enum: ['FREE_SHIPPING', 'COURIER_PARTNER'],
    required: true,
    default: 'COURIER_PARTNER'
  },
  minAmount: {
    type: Number,
    min: 0,
    default: null
  },
  // Default price applied to all orders regardless of conditions
  defaultPrice: {
    type: Number,
    min: 0,
    default: 0,
    validate: {
      validator: function(value) {
        // Only validate for COURIER_PARTNER type
        if (this.type === 'COURIER_PARTNER') {
          return value !== undefined && value !== null;
        }
        return true;
      },
      message: 'Default price is required for courier partner shipping methods'
    }
  },
  useWeight: {
    type: Boolean,
    default: false
  },
  ratePerKg: {
    type: Number,
    min: 0,
    default: null
  },
  fixedRate: {
    type: Number,
    min: 0,
    default: null
  },
  regionRates: [{
    regions: {
      type: [String],
      required: true,
      validate: [(val) => val.length > 0, 'At least one region is required']
    },
    price: {
      type: Number,
      required: true,
      min: 0
    }
  }],
  // Region & Weight based pricing
  useRegionWeight: {
    type: Boolean,
    default: false
  },
  regionWeightConfigs: [{
    regions: {
      type: [String],
      required: true,
      validate: [(val) => val.length > 0, 'At least one region is required']
    },
    weightRanges: [{
      minWeight: { type: Number, required: true, min: 0 },
      maxWeight: { type: Number, required: true, min: 0 },
      price: { type: Number, required: true, min: 0 }
    }]
  }],
  // NEW: Pan-India Shipping
  isPanIndia: {
    type: Boolean,
    default: false
  },
  excludedRegions: {
    type: [String],
    default: []
  },
  isActive: {
    type: Boolean,
    default: true
  },
  tenentId: {
    type: String,
    required: true
  }
}, {
  timestamps: true,
  collection: 'shipping_methods'
});

// Validation middleware
shippingMethodSchema.pre('save', function(next) {
  // Validate based on shipping type
  if (this.type === 'FREE_SHIPPING') {
    // Free shipping doesn't need default price or other pricing options
    this.defaultPrice = null;
    this.useWeight = false;
    this.ratePerKg = null;
    this.fixedRate = null;
    this.regionRates = [];
    this.useRegionWeight = false;
    this.regionWeightConfigs = [];
    this.isPanIndia = false;
    this.excludedRegions = [];
  } else if (this.type === 'COURIER_PARTNER') {
    // Ensure defaultPrice is set (0 is valid)
    if (this.defaultPrice === undefined || this.defaultPrice === null) {
      this.defaultPrice = 0;
    }

    if (this.isPanIndia) {
      // Pan-India shipping overrides other region-based settings
      this.useWeight = false; // Usually Pan-India implies simple pricing, but could be debated. Assuming fixed for now based on UI.
      // Actually based on UI, Pan-India disables region-based pricing but relies on Default Price.
      // The schema doesn't strictly prevent useWeight with PanIndia, but the UI might.
      // Let's ensure region-specific arrays are empty
      this.regionRates = [];
      this.useRegionWeight = false;
      this.regionWeightConfigs = [];
    } else if (this.useRegionWeight) {
      // Region & Weight based pricing
      this.useWeight = false;
      this.ratePerKg = null;
      this.fixedRate = null;
      this.regionRates = [];
      this.isPanIndia = false;
      this.excludedRegions = [];
      
      // Validate that region weight configs exist
      if (!this.regionWeightConfigs || this.regionWeightConfigs.length === 0) {
        return next(new Error('At least one region weight configuration is required when using region & weight-based pricing'));
      }
      
      // Validate each config has weight ranges
      for (const config of this.regionWeightConfigs) {
        if (!config.regions || config.regions.length === 0) {
          return next(new Error(`Region group must have at least one region selected`));
        }
        
        if (!config.weightRanges || config.weightRanges.length === 0) {
          return next(new Error(`Region group [${config.regions.join(', ')}] must have at least one weight range`));
        }
        
        // Validate weight ranges are logical
        for (const range of config.weightRanges) {
          if (range.minWeight > range.maxWeight) {
            return next(new Error(`Invalid weight range in region group [${config.regions.join(', ')}]: minWeight cannot be greater than maxWeight`));
          }
        }
      }
    } else if (this.useWeight) {
      // Simple weight-based pricing
      this.fixedRate = null;
      this.regionRates = [];
      this.useRegionWeight = false;
      this.regionWeightConfigs = [];
      this.isPanIndia = false;
      this.excludedRegions = [];
      
      if (!this.ratePerKg) {
        return next(new Error('Rate per KG is required for weight-based shipping'));
      }
    } else {
      // Fixed rate or region-based pricing
      this.ratePerKg = null;
      this.useRegionWeight = false;
      this.regionWeightConfigs = [];
      this.isPanIndia = false;
      this.excludedRegions = [];
      
      // Require either fixedRate OR at least one regionRate
      const hasRegionRates = this.regionRates && this.regionRates.length > 0;
      if (this.fixedRate === null && !hasRegionRates) {
        return next(new Error('Fixed rate or at least one region rate is required for non-weight based shipping'));
      }
    }
  }

  next();
});

// Pre-update validation middleware
shippingMethodSchema.pre('findOneAndUpdate', function(next) {
  const update = this.getUpdate();
  
  // Get the type being set
  const type = update.type || update.$set?.type;
  
  if (type === 'FREE_SHIPPING') {
    if (update.$set) {
      update.$set.defaultPrice = null;
      update.$set.useWeight = false;
      update.$set.ratePerKg = null;
      update.$set.fixedRate = null;
      update.$set.regionRates = [];
      update.$set.useRegionWeight = false;
      update.$set.regionWeightConfigs = [];
      update.$set.isPanIndia = false;
      update.$set.excludedRegions = [];
    }
  } else if (type === 'COURIER_PARTNER') {
    if (update.$set && (update.$set.defaultPrice === undefined || update.$set.defaultPrice === null)) {
      update.$set.defaultPrice = 0;
    } else if (update.defaultPrice === undefined || update.defaultPrice === null) {
      update.defaultPrice = 0;
    }
  }
  
  next();
});

// Indexes for performance
shippingMethodSchema.index({ tenentId: 1, isActive: 1 });
shippingMethodSchema.index({ tenentId: 1, type: 1, isActive: 1 });

// Instance method to calculate shipping cost
shippingMethodSchema.methods.calculateShippingCost = function(params = {}) {
  const { weight, region, orderAmount } = params;
  
  let basePrice = 0;
  let additionalCost = 0;
  let breakdown = {
    defaultPrice: 0,
    additionalCharges: 0,
    totalCost: 0,
    appliedRule: 'none'
  };

  if (this.type === 'FREE_SHIPPING') {
    if (!this.minAmount || (orderAmount && orderAmount >= this.minAmount)) {
      return {
        cost: 0,
        isFreeShipping: true,
        breakdown: {
          defaultPrice: 0,
          additionalCharges: 0,
          totalCost: 0,
          appliedRule: 'free_shipping'
        }
      };
    } else {
      throw new Error(`Order amount must be at least ₹${this.minAmount} for free shipping`);
    }
  }

  // Start with default price for COURIER_PARTNER
  basePrice = this.defaultPrice || 0;

  if (this.isPanIndia) {
    // Check if region is excluded
    if (region && this.excludedRegions && this.excludedRegions.length > 0) {
      const isExcluded = this.excludedRegions.some(r => r.trim().toLowerCase() === region.trim().toLowerCase());
      if (isExcluded) {
        throw new Error(`Shipping unavailable for region: ${region}`);
      }
    }
    // Pan-India uses just base price (and maybe weight if we allowed it, but sticking to base logic)
    breakdown.appliedRule = 'pan_india';
    
  } else if (this.useRegionWeight) {
    // Region & Weight Based Pricing
    if (!weight) throw new Error('Weight is required for this shipping method');
    if (!region) throw new Error('Region/State is required for this shipping method');

    // Find config that contains this region in its 'regions' array
    const config = this.regionWeightConfigs.find(
      c => c.regions && c.regions.some(r => r.trim().toLowerCase() === region.trim().toLowerCase())
    );

    if (!config) {
      throw new Error(`Shipping unavailable for region: ${region}`);
    }

    const range = config.weightRanges.find(
      r => weight >= r.minWeight && weight <= r.maxWeight
    );

    if (range) {
      additionalCost = range.price;
      breakdown.appliedRule = 'region_weight_based';
    } else {
      throw new Error(`No shipping rate defined for weight ${weight}kg in ${region}`);
    }

  } else if (this.useWeight) {
    // Simple weight-based pricing
    if (!weight) throw new Error('Weight is required for this shipping method');
    additionalCost = this.ratePerKg * weight;
    breakdown.appliedRule = 'weight_based';

  } else {
    // Fixed or Region-based pricing
    let calculatedCost = this.fixedRate || 0;

    if (region && this.regionRates && this.regionRates.length > 0) {
      const regionRate = this.regionRates.find(r => 
        r.regions && r.regions.some(reg => reg.toLowerCase().trim() === region.toLowerCase().trim())
      );
      
      if (regionRate) {
        calculatedCost = regionRate.price;
        breakdown.appliedRule = 'region_specific';
      } else {
        breakdown.appliedRule = 'fixed_rate';
      }
    } else {
      breakdown.appliedRule = 'fixed_rate';
    }

    additionalCost = calculatedCost;
  }

  const totalCost = basePrice + additionalCost;

  breakdown.defaultPrice = basePrice;
  breakdown.additionalCharges = additionalCost;
  breakdown.totalCost = totalCost;

  return {
    cost: totalCost,
    isFreeShipping: false,
    breakdown
  };
};

// Static method to find active shipping methods for a tenant
shippingMethodSchema.statics.findActiveByTenant = function(tenentId) {
  return this.find({ tenentId, isActive: true }).sort({ createdAt: -1 });
};

// Virtual for display purposes
shippingMethodSchema.virtual('pricingDescription').get(function() {
  if (this.type === 'FREE_SHIPPING') {
    return this.minAmount 
      ? `Free shipping for orders over ₹${this.minAmount}` 
      : 'Always Free Shipping';
  }

  const parts = [];
  
  if (this.defaultPrice > 0) {
    parts.push(`Base: ₹${this.defaultPrice}`);
  }

  if (this.isPanIndia) {
    parts.push('Pan-India');
    if (this.excludedRegions.length > 0) {
       parts.push(`(Excl. ${this.excludedRegions.length} regions)`);
    }
  } else if (this.useRegionWeight) {
    parts.push(`+ Region & Weight-based (${this.regionWeightConfigs.length} groups)`);
  } else if (this.useWeight) {
    parts.push(`+ ₹${this.ratePerKg}/kg`);
  } else if (this.fixedRate) {
    parts.push(`+ Fixed: ₹${this.fixedRate}`);
  }

  if (this.regionRates && this.regionRates.length > 0) {
    parts.push(`(${this.regionRates.length} region exceptions)`);
  }

  return parts.join(' ');
});

// Ensure virtuals are included in JSON
shippingMethodSchema.set('toJSON', { virtuals: true });
shippingMethodSchema.set('toObject', { virtuals: true });

const ShippingMethod = mongoose.model('ShippingMethod', shippingMethodSchema);

module.exports = ShippingMethod;
