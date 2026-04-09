const mongoose = require('mongoose');

// Define a schema for template/carousel items with payload support
const templateItemSchema = new mongoose.Schema({
  image: { type: String, default: '' },
  title: { type: String, default: '' },
  subtitle: { type: String, default: '' },
  buttonText: { type: String, default: '' },
  // Button type: 'url' opens a link, 'payload' sends a postback payload
  buttonType: {
    type: String,
    enum: ['url', 'payload'],
    default: 'url'
  },
  // URL to open when buttonType === 'url'
  buttonUrl: { type: String, default: '' },
  // Postback payload when buttonType === 'payload'
  buttonPayload: { type: String, default: '' }
});

const commentautomationruleSchema = new mongoose.Schema({
  mediaId: { type: String, required: true },
  triggerText: { type: String, required: true },
  commentReply: { type: String, required: false },
  replyText: { type: String, required: false },
  ruleId: { type: String, required: true },
  tenentId: { type: String, required: true },
  media_url: { type: String, default: '' },
  thumbnail_url: { type: String, default: '' },
  media_type: { type: String, default: '' },
  permalink: { type: String, default: '' },

  // Rule type
  ruleType: {
    type: String,
    enum: ['text', 'template'],
    default: 'text'
  },

  // Template/Carousel fields — both use the updated templateItemSchema
  templateItems: [templateItemSchema],
  templateCount: Number,
  carouselItems: { type: [templateItemSchema], default: [] },
  carouselCount: { type: Number, default: 0 },

  isFollowerRequired: { type: Boolean, default: false },

}, { timestamps: true });

// Pre-save middleware to sync legacy carousel data
commentautomationruleSchema.pre('save', function (next) {
  // Normalize legacy 'carousel' ruleType to 'template'
  if (this.ruleType === 'carousel') {
    this.ruleType = 'template';
  }

  // Sync carouselItems → templateItems if templateItems is missing
  if (this.ruleType === 'template' && (!this.templateItems || this.templateItems.length === 0) && this.carouselItems && this.carouselItems.length > 0) {
    this.templateItems = this.carouselItems;
    this.templateCount = this.carouselCount;
  }

  // Ensure buttonType defaults to 'url' for any item missing it (legacy data)
  const normalizeItems = (items) => {
    if (!items || items.length === 0) return items;
    return items.map(item => ({
      ...item.toObject ? item.toObject() : item,
      buttonType: item.buttonType || 'url',
      buttonUrl: item.buttonUrl || '',
      buttonPayload: item.buttonPayload || ''
    }));
  };

  if (this.carouselItems && this.carouselItems.length > 0) {
    this.carouselItems = normalizeItems(this.carouselItems);
  }
  if (this.templateItems && this.templateItems.length > 0) {
    this.templateItems = normalizeItems(this.templateItems);
  }

  next();
});

const CommentAutomationRule = mongoose.model('CommentAutomationRule', commentautomationruleSchema);
module.exports = CommentAutomationRule;
