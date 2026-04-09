const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
  tenentId: {
    type: String,
    required: true
  },
  commentId: {
    type: String,
    required: true,
  },
  senderId: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  Timestamp: {
    type: Date,
    default: Date.now
  },
  mediaId: {
    type: String,
    required: true
  },
  response: {
    type: mongoose.Schema.Types.Mixed,
    default: ''
  },
  username: {
    type: String,
    required: false,
    default: ''
  },
  recipientId: {
    type: String,
    default: ''
  },
  responseType: {
    type: String,
    enum: ['text', 'template', 'none'],
    default: 'none'
  },

  // ── Moderation fields (only populated for moderated tenants) ───
  moderation: {
    verdict: {
      type: String,
      enum: ['abusive', 'borderline', 'safe', null],
      default: null
    },
    score: {
      type: Number,
      default: null
    },
    detectedLanguage: {
      type: String,
      default: null
    },
    reason: {
      type: String,
      default: null
    },
    action: {
      type: String,
      enum: ['deleted', 'hidden', null],
      default: null
    },
    moderatedAt: {
      type: Date,
      default: null
    }
  }

}, { timestamps: true });

// ── createCommentMessage ──────────────────────────────────────────
commentSchema.statics.createCommentMessage = async function(data) {
  let timestamp;
  if (data.Timestamp) {
    const timestampNum = Number(data.Timestamp);
    timestamp = timestampNum < 10000000000
      ? new Date(timestampNum * 1000)
      : new Date(timestampNum);

    if (isNaN(timestamp.getTime()) || timestamp.getFullYear() < 2000) {
      console.warn('Invalid timestamp received, using current date');
      timestamp = new Date();
    }
  } else {
    timestamp = new Date();
  }

  let responseType = 'none';
  if (data.response) {
    if (typeof data.response === 'string') responseType = 'text';
    else if (typeof data.response === 'object' && data.response.attachment) responseType = 'template';
  }

  return this.create({
    tenentId:     data.tenentId,
    mediaId:      data.mediaId,
    commentId:    data.commentId,
    message:      data.message,
    recipientId:  data.recipientId,
    senderId:     data.senderId,
    response:     data.response,
    Timestamp:    timestamp,
    username:     data.username || '',
    responseType: responseType
  });
};

// ── createAbusiveComment ──────────────────────────────────────────
commentSchema.statics.createAbusiveComment = async function(data) {
  let timestamp = new Date();

  if (data.Timestamp) {
    const timestampNum = Number(data.Timestamp);
    const parsed = timestampNum < 10000000000
      ? new Date(timestampNum * 1000)
      : new Date(timestampNum);

    if (!isNaN(parsed.getTime()) && parsed.getFullYear() >= 2000) {
      timestamp = parsed;
    }
  }

  return this.create({
    tenentId:     data.tenentId,
    mediaId:      data.mediaId,
    commentId:    data.commentId,
    message:      data.message,
    recipientId:  data.recipientId || '',
    senderId:     data.senderId,
    username:     data.username || '',
    response:     '',
    responseType: 'none',
    Timestamp:    timestamp,
    moderation: {
      verdict:          data.moderation.verdict,
      score:            data.moderation.score,
      detectedLanguage: data.moderation.detectedLanguage,
      reason:           data.moderation.reason,
      action:           data.moderation.action,
      moderatedAt:      new Date()
    }
  });
};

// ── respondToComment ──────────────────────────────────────────────
commentSchema.statics.respondToComment = async function(commentId, responseText) {
  return this.updateOne(
    { commentId },
    { response: responseText, responseTimestamp: new Date() }
  );
};

// ── Indexes ───────────────────────────────────────────────────────
commentSchema.index({ commentId: 1, tenentId: 1 });
commentSchema.index({ senderId: 1, tenentId: 1 });
commentSchema.index({ mediaId: 1, tenentId: 1 });
commentSchema.index({ 'moderation.verdict': 1, tenentId: 1 });

const Comment = mongoose.model('Comment', commentSchema);
module.exports = Comment;
