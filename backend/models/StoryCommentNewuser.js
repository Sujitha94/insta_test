const mongoose = require('mongoose');
const storycommentnewuserSchema = new mongoose.Schema({
  
  
    senderId: { type: String, required: true },
    username: { type: String, required: true },
    name: { type: String, required: true },
    tenentId: { type: String, required: true }
    
  }, { timestamps: true });
  const StoryCommentNewuser = mongoose.model('StoryCommentNewuser', storycommentnewuserSchema);
  module.exports = StoryCommentNewuser;
