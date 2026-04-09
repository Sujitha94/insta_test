// models/WelcomePage.js - MongoDB schema for welcome page configuration

const mongoose = require('mongoose');

// Define workflow schema as a subdocument
const workflowSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['payload', 'weburl'],
    required: true
  },
  title: {
    type: String,
    required: true
  },
  payload: {
    type: String
  },
 
  // Main URL field - this is where actual URLs should be stored
  url: {
    type: String,
    default: ''
  },
  // Add fields for custom option handling
  optionType: {
    type: String,
    enum: ['HUMAN AGENT', 'TRACK ORDER', 'TALK WITH AGENT', 'TRACK ORDER WEB URL', 'Enter custom title'],
    default: 'Enter custom title'
  },
  customTitle: {
    type: String,
    default: ''
  },
  displayTitle: {
    type: String,
    default: ''
  }
});

// Add validation to ensure URL is provided when type is 'weburl'
workflowSchema.pre('validate', function(next) {
  if (this.type === 'weburl') {
    // Check the url field (not urlType) for weburl workflows
    if (!this.url || this.url.trim() === '') {
      this.invalidate('url', 'URL is required when workflow type is weburl');
    } else {
      // Validate URL format
      const urlPattern = /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/;
      if (!urlPattern.test(this.url)) {
        this.invalidate('url', 'Please provide a valid URL');
      }
    }
  }
  
  // Handle displayTitle logic
  if (this.optionType === 'Enter custom title') {
    this.displayTitle = this.customTitle || this.title || 'Custom Option';
  } else {
    this.displayTitle = this.optionType;
  }
  
  next();
});

// Define button options schema for carousel items
const buttonOptionSchema = new mongoose.Schema({
  buttonText: String,
  buttonUrl: String,
  buttonPayload: String,
  buttonType: {
    type: String,
    enum: ['url', 'payload'],
    default: 'url'
  }
});

// Define carousel item schema
const carouselItemSchema = new mongoose.Schema({
  image: String,
  title: String,
  subtitle: String, // Optional
  buttons: [buttonOptionSchema]
});

// Define welcome page schema
const welcomePageSchema = new mongoose.Schema({
  tenentId: {
    type: String,
    required: true,
    unique: true
  },
  body: {
    type: String,
    required: true,
    maxlength: 1024
  },
  headerType: {
    type: String,
    enum: ['Text', 'Image', 'Video'],
    default: 'Text'
  },
  mediaPath: {
    type: String,
    default: null
  },
  workflows: {
    type: [workflowSchema],
    validate: [
      {
        validator: function(workflows) {
          // Maximum 3 workflows allowed
          return workflows.length <= 3;
        },
        message: 'Maximum 3 workflows allowed'
      },
      {
        validator: function(workflows) {
          // Validate that weburl workflows have proper URLs
          for (let workflow of workflows) {
            if (workflow.type === 'weburl') {
              if (!workflow.url || workflow.url.trim() === '') {
                return false;
              }
            }
          }
          return true;
        },
        message: 'URL is required for weburl type workflows'
      }
    ],
    default: []
  },
  // Template message fields
  messageType: {
    type: String,
    enum: ['text', 'carousel'],
    default: 'text'
  },
  text: String,
  carouselItems: [carouselItemSchema],
  // Add username field
  username: {
    type: String,
    default: null
  }
}, { timestamps: true });

// Add validation for template message components
welcomePageSchema.pre('validate', function(next) {
  // Only validate template message fields if they are being used
  if (this.messageType === 'text' && this.text !== undefined && (!this.text || this.text.trim() === '')) {
    this.invalidate('text', 'Text is required for text type messages');
  } else if (this.messageType === 'carousel' && this.carouselItems !== undefined) {
    if (!this.carouselItems || this.carouselItems.length === 0) {
      this.invalidate('carouselItems', 'Carousel items are required for carousel type messages');
    } else {
      // Validate each carousel item
      this.carouselItems.forEach((item, index) => {
        if (!item.title) {
          this.invalidate(`carouselItems.${index}.title`, 'Title is required for carousel items');
        }
        
        // Validate buttons
        if (!item.buttons || item.buttons.length === 0) {
          this.invalidate(`carouselItems.${index}.buttons`, 'At least one button is required per carousel item');
        } else {
          item.buttons.forEach((button, buttonIndex) => {
            if (!button.buttonText) {
              this.invalidate(`carouselItems.${index}.buttons.${buttonIndex}.buttonText`, 'Button text is required');
            }
            
            if (button.buttonType === 'url' && (!button.buttonUrl || button.buttonUrl.trim() === '')) {
              this.invalidate(`carouselItems.${index}.buttons.${buttonIndex}.buttonUrl`, 'URL is required for URL type buttons');
            } else if (button.buttonType === 'payload' && (!button.buttonPayload || button.buttonPayload.trim() === '')) {
              this.invalidate(`carouselItems.${index}.buttons.${buttonIndex}.buttonPayload`, 'Payload is required for payload type buttons');
            }
          });
        }
      });
    }
  }
  
  next();
});

// Check if the model already exists before creating it
module.exports = mongoose.models.WelcomePage || mongoose.model('WelcomePage', welcomePageSchema);
