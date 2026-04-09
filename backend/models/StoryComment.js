const mongoose = require('mongoose');

const storycommentSchema = new mongoose.Schema({
  tenentId: {
    type: String,
    required: true
  },

  senderId: {
    type: String,
    required: true
  },
  
  message: {
    type: String,
    required: true
  },
  messageid: { 
    type: String 
  },
  Timestamp: { 
    type: Date, 
    default: () => new Date().toISOString() 
  },
  response: {
    type: String,
    default: ''
  },
  username:{
    type: String,
    required: true
  },
   ruleId: { type: String, required: true },
  recipientId: {
    type: String,
    default: ''
  }
  
}, { timestamps: true });
storycommentSchema.statics.createStoryCommentMessage = async function(data) {
    return this.create({
      tenentId: data.tenentId,
      ruleId: data.ruleId,
      message:data.message,
      recipientId:data.recipientId,
      senderId: data.senderId,
      response: data.response,
      Timestamp: data.Timestamp,
      username:data.username
    });
  };
  
  storycommentSchema.statics.respondToComment = async function(messageid, responseText) {
    return this.updateOne(
      { messageid },
      {
        response: responseText,
        responseTimestamp: new Date().toISOString()
      }
    );
  };
  const StoryComment= mongoose.model('StoryComment', storycommentSchema);
module.exports = StoryComment;

