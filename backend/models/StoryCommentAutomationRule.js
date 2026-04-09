const mongoose = require('mongoose');

// Define a schema for template items (formerly carousel items)
const templateItemSchema = new mongoose.Schema({
  image: String,
  title: String,
  subtitle: String,
  buttonText: String,
  buttonUrl: String
});

const storycommentautomationruleSchema = new mongoose.Schema({
  
  triggerText: { type: String, required: true },
  replyText: { type: String, required: false }, // Optional since it's only needed for text type
  ruleId: { type: String, required: true },
  tenentId: { type: String, required: true },
  
  // Rule type - now we only use 'text' or 'template'
  ruleType: { 
    type: String, 
    enum: ['text', 'template'],
    default: 'text'
  },
  
  // Template fields - these now contain the carousel data
  templateItems: [templateItemSchema],
  templateCount: Number,
  
  // Keep carousel fields for backward compatibility with existing data
  // These will be used to handle any legacy data
  carouselItems: [templateItemSchema],
  carouselCount: Number
  
}, { timestamps: true });

// Add a pre-save middleware to sync template and carousel data if needed
storycommentautomationruleSchema.pre('save', function(next) {
  // If this is a template type rule but has carousel data, migrate it to template format
  if (this.ruleType === 'template' && !this.templateItems && this.carouselItems) {
    this.templateItems = this.carouselItems;
    this.templateCount = this.carouselCount;
  }
  
  // If this is a legacy carousel type, convert to template type
  if (this.ruleType === 'carousel') {
    this.ruleType = 'template';
    if (!this.templateItems) {
      this.templateItems = this.carouselItems;
      this.templateCount = this.carouselCount;
    }
  }
  
  next();
});

const StoryCommentAutomationRule = mongoose.model('StoryCommentAutomationRule', storycommentautomationruleSchema);
module.exports = StoryCommentAutomationRule;
