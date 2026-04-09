const mongoose = require('mongoose');

const profileSchema = new mongoose.Schema({
  // Basic Identifiers
  recipientId: { 
    type: String, 
    required: true,
    unique: true,
    index: true
  },
  
  // Basic Profile Info
  username: { 
    type: String, 
    required: true,
    default: 'Nil'
  },
  
  name: { 
    type: String,
    default: 'Nil'
  },
  
  // Profile Picture
  profile_picture_url: { 
    type: String,
    default: null
  },
  
  // Profile Statistics
  followers_count: { 
    type: Number,
    default: 0,
    min: 0
  },
  
  follows_count: { 
    type: Number,
    default: 0,
    min: 0
  },
  
  media_count: { 
    type: Number,
    default: 0,
    min: 0
  },
  
  // Account Information
  account_type: { 
  type: String,
  default: 'BUSINESS'
},
  
  biography: { 
    type: String,
    default: null,
    maxlength: 500
  },
  
  website: { 
    type: String,
    default: null,
    validate: {
      validator: function(v) {
        if (!v) return true; // Allow null/empty
        // Basic URL validation
        return /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/.test(v);
      },
      message: props => `${props.value} is not a valid URL!`
    }
  },
  
  // Legacy field for backwards compatibility (kept as alias)
  profile_pic: { 
    type: String,
    default: null
  }
  
}, { 
  timestamps: true // Automatically adds createdAt and updatedAt
});

// Indexes for better query performance
profileSchema.index({ recipientId: 1 });
profileSchema.index({ username: 1 });
profileSchema.index({ createdAt: -1 });

// Virtual field to sync profile_pic with profile_picture_url
profileSchema.virtual('profilePicture').get(function() {
  return this.profile_picture_url || this.profile_pic;
});

// Pre-save hook to ensure profile_pic stays in sync with profile_picture_url
profileSchema.pre('save', function(next) {
  if (this.profile_picture_url && !this.profile_pic) {
    this.profile_pic = this.profile_picture_url;
  }
  next();
});

// Instance method to get formatted follower count
profileSchema.methods.getFormattedFollowers = function() {
  if (this.followers_count >= 1000000) {
    return (this.followers_count / 1000000).toFixed(1) + 'M';
  }
  if (this.followers_count >= 1000) {
    return (this.followers_count / 1000).toFixed(1) + 'K';
  }
  return this.followers_count.toString();
};

// Instance method to check if account is business/creator
profileSchema.methods.isBusinessAccount = function() {
  return this.account_type === 'BUSINESS' || this.account_type === 'CREATOR';
};

// Static method to find profile by username
profileSchema.statics.findByUsername = function(username) {
  return this.findOne({ username: username });
};

// Static method to get profiles with high engagement
profileSchema.statics.getTopProfiles = function(limit = 10) {
  return this.find()
    .sort({ followers_count: -1 })
    .limit(limit);
};

const Profile = mongoose.model('Profile', profileSchema);

module.exports = Profile;

