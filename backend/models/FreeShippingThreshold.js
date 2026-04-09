const mongoose = require('mongoose');

// Per-state threshold config
const stateThresholdSchema = new mongoose.Schema({
  state: {
    type: String,
    required: true,
    trim: true
  },
  thresholdAmount: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, { _id: false });

// Free Shipping Threshold Schema
const freeShippingThresholdSchema = new mongoose.Schema({
  tenentId: {
    type: String,
    required: true,
    index: true
  },

  // Global (pan-India) threshold
  thresholdAmount: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: false
  },

  // Per-state overrides
  stateThresholds: {
    type: [stateThresholdSchema],
    default: []
  }
}, {
  timestamps: true,
  collection: 'free_shipping_thresholds'
});

// Ensure only one threshold per tenant
freeShippingThresholdSchema.index({ tenentId: 1 }, { unique: true });

/**
 * Check if an order qualifies for free shipping.
 * State-level threshold takes priority over global threshold.
 * @param {number} orderAmount
 * @param {string} [state] - optional buyer state
 */
freeShippingThresholdSchema.methods.qualifiesForFreeShipping = function (orderAmount, state) {
  // Check state-level override first
  if (state && this.stateThresholds && this.stateThresholds.length > 0) {
    const stateRule = this.stateThresholds.find(
      s => s.state.trim().toLowerCase() === state.trim().toLowerCase()
    );
    if (stateRule) {
      return stateRule.isActive && orderAmount >= stateRule.thresholdAmount;
    }
  }

  // Fall back to global threshold
  if (!this.isActive) return false;
  return orderAmount >= this.thresholdAmount;
};

// Static: get or create threshold for a tenant
freeShippingThresholdSchema.statics.getOrCreateForTenant = async function (tenentId) {
  let threshold = await this.findOne({ tenentId });
  if (!threshold) {
    threshold = await this.create({
      tenentId,
      thresholdAmount: 0,
      isActive: false,
      stateThresholds: []
    });
  }
  return threshold;
};

// Static: update threshold for a tenant
freeShippingThresholdSchema.statics.updateForTenant = async function (
  tenentId,
  thresholdAmount,
  isActive,
  stateThresholds = []
) {
  return this.findOneAndUpdate(
    { tenentId },
    { thresholdAmount, isActive, stateThresholds },
    { new: true, upsert: true, runValidators: true }
  );
};

const FreeShippingThreshold = mongoose.model('FreeShippingThreshold', freeShippingThresholdSchema);

module.exports = FreeShippingThreshold;
