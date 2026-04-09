const mongoose = require("mongoose");

const CommentAutomationLogSchema = new mongoose.Schema(
  {
    senderId: {
      type: String,
      required: true,
      index: true
    },

    tenentId: {
      type: String,
      required: true,
      index: true
    },

    commentText: {
      type: String,
      required: true
    },

    ruleId: {
      type: String,
      required: true
    },

    sendReplyStatus: {
      type: Boolean,
      required: true
    },

    // optional but very useful
    reason: {
      type: String,
      enum: [
        "FOLLOWER_REQUIRED_NOT_FOLLOWING",
        "NO_MATCHING_RULE",
        "RATE_LIMIT_EXCEEDED",
        "SUCCESS",
        "ERROR"
      ],
      default: "SUCCESS"
    },

    mediaId: {
      type: String
    },

    commentId: {
      type: String
    },

    errorMessage: {
      type: String
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model(
  "CommentAutomationLog",
  CommentAutomationLogSchema
);

