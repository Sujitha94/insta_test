require("dotenv").config();

// Keep all your existing model imports
const Newuser = require("../models/Newuser");
const Message = require("../models/Message");
const CommentNewuser = require("../models/CommentNewuser");
const Comment = require("../models/Comment");
const CommentAutomationRule = require("../models/CommentAutomationRule");
const CommentAutomationLog = require("../models/CommentAutomationLog");
const Icebreaker = require("../models/Icebreaker");
const Tokeninfo = require("../models/Tokeninfo");
const LongToken = require("../models/LongToken");
const Mode = require("../models/Mode");
const Mainmode = require("../models/Mainmode");
const Profile = require("../models/Profile");
const Userinfo = require("../models/Userinfo");
const Signup = require("../models/Signup");
const Response = require("../models/Response");
const Welcomemessage = require("../models/Welcomemessage");
const ProductType = require("../models/ProductType");
const ProductList = require("../models/ProductList");
const ProductDetail = require("../models/ProductDetail");
const Notification = require("../models/Notification");
const ProductavailabilityUrl = require("../models/ProductavailabilityUrl");
const OrderstatusUrl = require("../models/OrderstatusUrl");
const PersistentmenuUrl = require("../models/PersistentmenuUrl");
const SecurityAccessToken = require("../models/SecurityAccessToken");
const ecommerceCredentialsService = require("../models/ecommerceCredentialsService");
const TemplateMessage = require("../models/TemplateMessage");
const EngagedUser = require("../models/EngagedUser");
const WelcomePage = require("../models/WelcomePage");
const { updateVectorDB, getVectorDB } = require("./VectorDBRoutes");
const Order = require("../models/Order");
const rateLimitService = require("../services/rateLimitService");
const StoryCommentAutomationRule = require("../models/StoryCommentAutomationRule");
const StoryCommentNewuser = require("../models/StoryCommentNewuser");
const StoryComment = require("../models/StoryComment");
const ChatflowWelcomePage = require("../models/ChatflowWelcomePage");

// Keep all your existing utility imports
const os = require("os");
const v8 = require("v8");
const path = require("path");
const axios = require("axios");
const WebSocket = require("ws");
const express = require("express");
const { json } = express;
const router = express.Router();
const url = require("url");
const https = require("https");
const querystring = require("querystring");
const multer = require("multer");
const cors = require("cors");
const upload = multer({ storage: multer.memoryStorage() });
const langdetect = require("langdetect");
const crypto = require("crypto");
const { v4: uuidv4 } = require("uuid");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const fs = require("fs");
const fsPromises = require("fs").promises;
const FormData = require("form-data");

const deepseekApiKey = process.env.DEEPSEEK_API_KEY;
const deepseekApiUrl = "https://api.deepseek.com/v1";
// OpenAI setup
const OpenAI = require("openai");
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
});
const { Transform } = require("stream");
const readline = require("readline");
const NodeCache = require("node-cache");
const embeddingsCache = new NodeCache({ stdTTL: 3600 }); // Cache for 1 hour
const responseCache = new NodeCache({ stdTTL: 1800 });
//const clients = new Map();
// Message processing constants
const messageQueue = new Map();

const processingLock = new Map();
const messageTracker = new Map();
const PROCESSING_TIMEOUT = 70000;
const MESSAGE_TIMEOUT = 30000;
const processedMessagesapp = new Set();
const RATE_LIMITS = {
  CONVERSATIONS_API: { CALLS_PER_SECOND: 2, INTERVAL_MS: 1000 },
  SEND_API: {
    TEXT_CALLS_PER_SECOND: 300,
    MEDIA_CALLS_PER_SECOND: 10,
    INTERVAL_MS: 1000,
  },
  PRIVATE_REPLIES_API: {
    LIVE_CALLS_PER_SECOND: 100,
    POST_CALLS_PER_HOUR: 750,
    INTERVAL_SECOND_MS: 1000,
    INTERVAL_HOUR_MS: 3600000,
  },
  PLATFORM_API: { CALLS_PER_USER_PER_HOUR: 200, INTERVAL_HOUR_MS: 3600000 },
};
// State tracking
let mode;
const processedMessages = new Set();
const processedPayloads = new Set();
const TIME_WINDOW_MS = 10 * 60;
let lastProcessedTime = 0;
let vectorDB = [];
//const tenantVectorDBs = {};
const tenantVectorDBs = require("./vectorDBState");
const {
  sendInstagramMessage,
  sendInstagramCarousel,
  sendInstagramProductTemplateMessage,
  sendInstagramCommentTemplateMessage,
  sendInstagramTemplateMessage,
  sendInstagramProduct_type_quick_reply,
  sendInstagramQuickReplyMessage,
  createWelcomeMessageResponse,
} = require("../instagram/messaging");
const {
  sendNewContact,
  sendNewMessage,
  sendChatModeUpdate,
  sendNotificationUpdate,
} = require("../utils/websocket");
const {
  handleCommentMessage,
  findMatchingRule,
} = require("../handlers/commentHandler");
// Configuration
//global.tenantVectorDBs = {};
const config = require("../services/config");
const appUrl =
  process.env.APP_URL ||
  "https://inocencia-shiftiest-nonodorously.ngrok-free.dev";
const regex = /\w+/g;
const { Worker } = require("worker_threads");
const { clients } = require("./messageRoutes");

const streamifier = require("streamifier");
const fastq = require("fastq");
const pool = require("generic-pool").createPool(
  {
    create: async () => {
      return new OpenAI({
        baseURL: "https://api.deepseek.com/v1", // DeepSeek's official API endpoint
        apiKey: process.env.DEEPSEEK_API_KEY,
        defaultHeaders: {
          "Content-Type": "application/json",
        },
        timeout: 30000, // 30 seconds timeout
      });
    },
    destroy: async (client) => {
      // Cleanup if needed
    },
  },
  {
    max: 10,
    min: 2,
  },
);
// CORS setup
router.use(
  cors({
    origin: "*",
  }),
);
const queue = fastq(async (task, cb) => {
  try {
    const result = await processMessage(task);
    cb(null, result);
  } catch (err) {
    cb(err);
  }
}, 1);

class RateLimiter {
  constructor() {
    // Initialize API call trackers
    this.conversationsApiCalls = new Map();
    this.sendApiTextCalls = new Map();
    this.sendApiMediaCalls = new Map();
    this.privateRepliesLiveCalls = new Map();
    this.privateRepliesPostCalls = new Map();
    this.platformApiCalls = new Map();

    // Engagement tracking (tenant_account -> Map(userId -> lastActivityTimestamp))
    this.engagedUsers = new Map();
    this.engagementWindow = 24 * 60 * 60 * 1000; // 24 hours

    // Pending database updates
    this.pendingUserUpdates = new Map();
    this.lastCleanupTime = Date.now();

    this.initialize();
    this.loadEngagedUsersFromDatabase();
  }

  initialize() {
    setInterval(() => this.cleanupRateLimits(), 60 * 1000); // Cleanup every 1 min
    setInterval(() => this.logRateLimitStats(), 10 * 60 * 1000); // Log stats every 10 min
    setInterval(() => this.syncEngagedUsers(), 5 * 60 * 1000); // Sync engaged users every 5 min
  }

  // **PROPERLY RECORD ENGAGED USERS**
  recordEngagedUser(tenentId, accountId, userId) {
    if (!tenentId || !accountId || !userId) {
      console.error("recordEngagedUser missing parameters:", {
        tenentId,
        accountId,
        userId,
      });
      return;
    }

    const key = `${tenentId}_${accountId}`;
    if (!this.engagedUsers.has(key)) {
      this.engagedUsers.set(key, new Map());
    }

    const now = Date.now();
    this.engagedUsers.get(key).set(userId, now);

    console.log(
      `✅ Recorded engaged user: ${userId} for tenant ${tenentId} at ${new Date(
        now,
      ).toISOString()}`,
    );

    // Schedule database update
    this.scheduleUserUpdate(tenentId, accountId, userId);
  }

  // **IMPROVED DATABASE SYNC**
  scheduleUserUpdate(tenentId, accountId, userId) {
    const key = `${tenentId}_${accountId}_${userId}`;

    // Clear existing timeout if any
    if (this.pendingUserUpdates.has(key)) {
      clearTimeout(this.pendingUserUpdates.get(key));
    }

    // Schedule update with 30 second debounce
    const timeout = setTimeout(async () => {
      try {
        await EngagedUser.findOneAndUpdate(
          { tenentId, accountId, senderId: userId },
          {
            $set: {
              lastActivity: new Date(),
              updatedAt: new Date(),
            },
            $inc: { engagementCount: 1 },
          },
          { upsert: true, new: true },
        );

        console.log(`✅ Synced engaged user ${userId} to database`);
      } catch (error) {
        console.error(`❌ Error syncing engaged user ${userId}:`, error);
      } finally {
        this.pendingUserUpdates.delete(key);
      }
    }, 30000); // 30 second debounce

    this.pendingUserUpdates.set(key, timeout);
  }

  // **LOAD ENGAGED USERS FROM DATABASE ON STARTUP**
  async loadEngagedUsersFromDatabase() {
    try {
      const cutoffTime = new Date(Date.now() - this.engagementWindow);

      const recentUsers = await EngagedUser.find({
        lastActivity: { $gte: cutoffTime },
      }).select("tenentId accountId senderId lastActivity");

      for (const user of recentUsers) {
        const key = `${user.tenentId}_${user.accountId}`;
        if (!this.engagedUsers.has(key)) {
          this.engagedUsers.set(key, new Map());
        }
        this.engagedUsers
          .get(key)
          .set(user.senderId, user.lastActivity.getTime());
      }

      console.log(
        `✅ Loaded ${recentUsers.length} engaged users from database`,
      );
    } catch (error) {
      console.error("❌ Error loading engaged users from database:", error);
    }
  }

  // **CALCULATE DYNAMIC PLATFORM RATE LIMIT BASED ON ENGAGED USERS**
  getPlatformRateLimit(tenentId, accountId) {
    const key = `${tenentId}_${accountId}`;
    const now = Date.now();
    const cutoff = now - this.engagementWindow; // 24 hours

    if (!this.engagedUsers.has(key)) {
      return RATE_LIMITS.PLATFORM_API.CALLS_PER_USER_PER_HOUR; // Default 200
    }

    // Count active engaged users in the last 24 hours
    let activeEngagedUsers = 0;
    this.engagedUsers.get(key).forEach((lastActive, userId) => {
      if (lastActive >= cutoff) {
        activeEngagedUsers++;
      }
    });

    // Minimum 1 user to avoid zero limits
    activeEngagedUsers = Math.max(1, activeEngagedUsers);

    // Calculate dynamic limit: 200 calls per engaged user per hour
    const dynamicLimit =
      RATE_LIMITS.PLATFORM_API.CALLS_PER_USER_PER_HOUR * activeEngagedUsers;

    console.log(
      `📊 Platform rate limit for ${key}: ${dynamicLimit} calls/hr (${activeEngagedUsers} engaged users)`,
    );
    return dynamicLimit;
  }

  // **PROPERLY CHECK PLATFORM RATE LIMIT**
  checkPlatformRateLimit(tenentId, accountId) {
    const key = `${tenentId}_${accountId}`;
    const now = Date.now();
    const dynamicLimit = this.getPlatformRateLimit(tenentId, accountId);

    if (!this.platformApiCalls.has(key)) {
      this.platformApiCalls.set(key, { timestamps: [], limit: dynamicLimit });
    }

    const data = this.platformApiCalls.get(key);

    // Clean old timestamps (older than 1 hour)
    data.timestamps = data.timestamps.filter(
      (ts) => now - ts < RATE_LIMITS.PLATFORM_API.INTERVAL_HOUR_MS,
    );

    // Update the current limit
    data.limit = dynamicLimit;

    if (data.timestamps.length >= dynamicLimit) {
      console.warn(
        `⚠️  Platform rate limit exceeded for ${key}: ${data.timestamps.length}/${dynamicLimit} in last hour`,
      );
      return false;
    }

    data.timestamps.push(now);
    console.log(
      `✅ Platform API call recorded for ${key}: ${data.timestamps.length}/${dynamicLimit}`,
    );
    return true;
  }

  // **CONVERSATIONS API RATE LIMIT CHECK**
  canMakeConversationsApiCall(tenentId, accountId, userId = null) {
    const key = `${tenentId}_${accountId}`;
    const now = Date.now();

    if (!this.conversationsApiCalls.has(key)) {
      this.conversationsApiCalls.set(key, { timestamps: [] });
    }

    const data = this.conversationsApiCalls.get(key);
    data.timestamps = data.timestamps.filter(
      (ts) => now - ts < RATE_LIMITS.CONVERSATIONS_API.INTERVAL_MS,
    );

    if (
      data.timestamps.length >= RATE_LIMITS.CONVERSATIONS_API.CALLS_PER_SECOND
    ) {
      console.warn(
        `⚠️  Conversations API rate limit exceeded for ${key}: ${data.timestamps.length}/${RATE_LIMITS.CONVERSATIONS_API.CALLS_PER_SECOND} per second`,
      );
      return false;
    }

    // Check platform-wide limit
    if (!this.checkPlatformRateLimit(tenentId, accountId)) {
      return false;
    }

    // Record the API call
    data.timestamps.push(now);

    // Record engaged user if provided
    if (userId) {
      this.recordEngagedUser(tenentId, accountId, userId);
    }

    return true;
  }

  // **SEND API TEXT RATE LIMIT CHECK**
  canMakeSendApiTextCall(tenentId, accountId, recipientId) {
    const key = `${tenentId}_${accountId}`;
    const now = Date.now();

    if (!this.sendApiTextCalls.has(key)) {
      this.sendApiTextCalls.set(key, { timestamps: [] });
    }

    const data = this.sendApiTextCalls.get(key);
    data.timestamps = data.timestamps.filter(
      (ts) => now - ts < RATE_LIMITS.SEND_API.INTERVAL_MS,
    );

    if (data.timestamps.length >= RATE_LIMITS.SEND_API.TEXT_CALLS_PER_SECOND) {
      console.warn(
        `⚠️  Send API (Text) rate limit exceeded for ${key}: ${data.timestamps.length}/${RATE_LIMITS.SEND_API.TEXT_CALLS_PER_SECOND} per second`,
      );
      return false;
    }

    // Check platform-wide limit
    if (!this.checkPlatformRateLimit(tenentId, accountId)) {
      return false;
    }

    // Record the API call
    data.timestamps.push(now);

    // Record engaged user for recipient
    this.recordEngagedUser(tenentId, accountId, recipientId);

    return true;
  }

  // **SEND API MEDIA RATE LIMIT CHECK**
  canMakeSendApiMediaCall(tenentId, accountId, recipientId) {
    const key = `${tenentId}_${accountId}`;
    const now = Date.now();

    if (!this.sendApiMediaCalls.has(key)) {
      this.sendApiMediaCalls.set(key, { timestamps: [] });
    }

    const data = this.sendApiMediaCalls.get(key);
    data.timestamps = data.timestamps.filter(
      (ts) => now - ts < RATE_LIMITS.SEND_API.INTERVAL_MS,
    );

    if (data.timestamps.length >= RATE_LIMITS.SEND_API.MEDIA_CALLS_PER_SECOND) {
      console.warn(
        `⚠️  Send API (Media) rate limit exceeded for ${key}: ${data.timestamps.length}/${RATE_LIMITS.SEND_API.MEDIA_CALLS_PER_SECOND} per second`,
      );
      return false;
    }

    // Check platform-wide limit
    if (!this.checkPlatformRateLimit(tenentId, accountId)) {
      return false;
    }

    // Record the API call
    data.timestamps.push(now);

    // Record engaged user for recipient
    this.recordEngagedUser(tenentId, accountId, recipientId);

    return true;
  }

  // **PRIVATE REPLIES API RATE LIMIT CHECK**
  canMakePrivateRepliesPostCall(tenentId, accountId, commenterId = null) {
    const key = `${tenentId}_${accountId}`;
    const now = Date.now();

    if (!this.privateRepliesPostCalls.has(key)) {
      this.privateRepliesPostCalls.set(key, { timestamps: [] });
    }

    const data = this.privateRepliesPostCalls.get(key);
    data.timestamps = data.timestamps.filter(
      (ts) => now - ts < RATE_LIMITS.PRIVATE_REPLIES_API.INTERVAL_HOUR_MS,
    );

    if (
      data.timestamps.length >=
      RATE_LIMITS.PRIVATE_REPLIES_API.POST_CALLS_PER_HOUR
    ) {
      console.warn(
        `⚠️  Private Replies Post call rate limit exceeded for ${key}: ${data.timestamps.length}/${RATE_LIMITS.PRIVATE_REPLIES_API.POST_CALLS_PER_HOUR} per hour`,
      );
      return false;
    }

    // Check platform-wide limit
    if (!this.checkPlatformRateLimit(tenentId, accountId)) {
      return false;
    }

    // Record the API call
    data.timestamps.push(now);

    // Record engaged user
    if (commenterId) {
      this.recordEngagedUser(tenentId, accountId, commenterId);
    }

    return true;
  }

  canMakePrivateRepliesLiveCall(tenentId, accountId, commenterId) {
    const key = `${tenentId}_${accountId}`;
    const now = Date.now();

    if (!this.privateRepliesLiveCalls.has(key)) {
      this.privateRepliesLiveCalls.set(key, { timestamps: [] });
    }

    const data = this.privateRepliesLiveCalls.get(key);
    data.timestamps = data.timestamps.filter(
      (ts) => now - ts < RATE_LIMITS.PRIVATE_REPLIES_API.INTERVAL_SECOND_MS,
    );

    if (
      data.timestamps.length >=
      RATE_LIMITS.PRIVATE_REPLIES_API.LIVE_CALLS_PER_SECOND
    ) {
      console.warn(
        `⚠️  Private Replies Live call rate limit exceeded for ${key}: ${data.timestamps.length}/${RATE_LIMITS.PRIVATE_REPLIES_API.LIVE_CALLS_PER_SECOND} per second`,
      );
      return false;
    }

    // Check platform-wide limit
    if (!this.checkPlatformRateLimit(tenentId, accountId)) {
      return false;
    }

    // Record engaged user
    if (commenterId) {
      this.recordEngagedUser(tenentId, accountId, commenterId);
    }

    data.timestamps.push(now);
    return true;
  }

  // **CLEANUP FUNCTION**
  cleanupRateLimits() {
    const now = Date.now();

    // Clean up engagement tracking
    this.engagedUsers.forEach((userMap, key) => {
      const cutoff = now - this.engagementWindow;
      const activeUsers = new Map();

      userMap.forEach((lastActive, userId) => {
        if (lastActive >= cutoff) {
          activeUsers.set(userId, lastActive);
        }
      });

      if (activeUsers.size > 0) {
        this.engagedUsers.set(key, activeUsers);
      } else {
        this.engagedUsers.delete(key);
      }
    });

    // Clean up API call tracking
    const cleanupApiCalls = (apiCallsMap, intervalMs) => {
      apiCallsMap.forEach((data, key) => {
        data.timestamps = data.timestamps.filter((ts) => now - ts < intervalMs);
        if (data.timestamps.length === 0) {
          apiCallsMap.delete(key);
        }
      });
    };

    cleanupApiCalls(
      this.conversationsApiCalls,
      RATE_LIMITS.CONVERSATIONS_API.INTERVAL_MS,
    );
    cleanupApiCalls(this.sendApiTextCalls, RATE_LIMITS.SEND_API.INTERVAL_MS);
    cleanupApiCalls(this.sendApiMediaCalls, RATE_LIMITS.SEND_API.INTERVAL_MS);
    cleanupApiCalls(
      this.privateRepliesPostCalls,
      RATE_LIMITS.PRIVATE_REPLIES_API.INTERVAL_HOUR_MS,
    );
    cleanupApiCalls(
      this.platformApiCalls,
      RATE_LIMITS.PLATFORM_API.INTERVAL_HOUR_MS,
    );

    console.log("🧹 Rate limit cleanup completed");
  }

  // **COMPREHENSIVE LOGGING**
  logRateLimitStats() {
    console.log("\n📊 === Rate Limit Stats ===");

    // Log engaged users per tenant
    this.engagedUsers.forEach((userMap, key) => {
      const limit = this.getPlatformRateLimit(...key.split("_"));
      console.log(
        `🏢 ${key}: ${userMap.size} engaged users → ${limit} calls/hour limit`,
      );
    });

    // Log API usage
    console.log("\n📡 API Usage:");
    this.conversationsApiCalls.forEach((data, key) => {
      console.log(
        `  📞 Conversations API ${key}: ${data.timestamps.length}/${RATE_LIMITS.CONVERSATIONS_API.CALLS_PER_SECOND}/sec`,
      );
    });

    this.sendApiTextCalls.forEach((data, key) => {
      console.log(
        `  💬 Send API Text ${key}: ${data.timestamps.length}/${RATE_LIMITS.SEND_API.TEXT_CALLS_PER_SECOND}/sec`,
      );
    });

    this.sendApiMediaCalls.forEach((data, key) => {
      console.log(
        `  🖼️  Send API Media ${key}: ${data.timestamps.length}/${RATE_LIMITS.SEND_API.MEDIA_CALLS_PER_SECOND}/sec`,
      );
    });

    this.privateRepliesPostCalls.forEach((data, key) => {
      console.log(
        `  💭 Private Replies ${key}: ${data.timestamps.length}/${RATE_LIMITS.PRIVATE_REPLIES_API.POST_CALLS_PER_HOUR}/hour`,
      );
    });

    this.platformApiCalls.forEach((data, key) => {
      console.log(
        `  🌐 Platform API ${key}: ${data.timestamps.length}/${data.limit ||
          200}/hour`,
      );
    });

    console.log("=========================\n");
  }

  // **SYNC ENGAGED USERS TO DATABASE**
  async syncEngagedUsers() {
    try {
      const bulkOperations = [];
      const now = new Date();

      this.engagedUsers.forEach((userMap, tenantAccountKey) => {
        const [tenentId, accountId] = tenantAccountKey.split("_");

        userMap.forEach((lastActive, userId) => {
          bulkOperations.push({
            updateOne: {
              filter: { tenentId, accountId, senderId: userId },
              update: {
                $set: {
                  lastActivity: new Date(lastActive),
                  updatedAt: now,
                },
                $inc: { engagementCount: 1 },
              },
              upsert: true,
            },
          });
        });
      });

      if (bulkOperations.length > 0) {
        await EngagedUser.bulkWrite(bulkOperations);
        console.log(
          `✅ Synced ${bulkOperations.length} engaged user records to database`,
        );
      }
    } catch (error) {
      console.error("❌ Error syncing engaged users to database:", error);
    }
  }
}
const rateLimiter = new RateLimiter();
// Initialize rate limiter
//const rateLimiter = new RateLimiter();

// Initialize WhatsApp client at the start of your application
function formatStatus(status) {
  if (!status) return "Unknown";

  // Convert camelCase or snake_case to readable format
  const formatted = status
    .replace(/([A-Z])/g, " $1")
    .replace(/_/g, " ")
    .toLowerCase();

  // Capitalize first letter
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

function formatMetafieldKey(key) {
  if (!key) return "Info";

  // Convert camelCase or snake_case to readable format
  const formatted = key
    .replace(/([A-Z])/g, " $1")
    .replace(/_/g, " ")
    .toLowerCase();

  // Capitalize first letter
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}
// Message Tracking Functions

async function cleanupMessageTracker() {
  const now = Date.now();

  // Remove stale entries
  for (const [messageId, data] of messageTracker.entries()) {
    if (now - data.startTime > PROCESSING_TIMEOUT) {
      messageTracker.delete(messageId);
    }
  }

  // Periodically clear processed messages set
  if (processedMessages.size > 1000) {
    processedMessages.clear();
  }
}

async function isMessageBeingProcessed(messageId) {
  if (!messageId) return false;
  await cleanupMessageTracker();
  return messageTracker.has(messageId);
}

function startProcessingMessage(messageId) {
  messageTracker.set(messageId, {
    startTime: Date.now(),
    status: "processing",
  });
}

function completeMessageProcessing(messageId) {
  messageTracker.delete(messageId);
}

// Utility Functions
function containsRobotEmoji(text) {
  const robotEmoji = "🤖";
  const manEmoji = "🙎‍♂️";
  return text.includes(robotEmoji) || text.includes(manEmoji);
}

function checkGreeting(text) {
  const greetings = ["hi", "hello", "hey"];
  return greetings.some((greeting) => text.toLowerCase().includes(greeting));
}
function cleanupCaches() {
  embeddingsCache.flushAll(); // Clear entire cache
  responseCache.flushAll();

  // Or more selectively
  const now = Date.now();
  embeddingsCache.keys().forEach((key) => {
    if (now - embeddingsCache.getTtl(key) > 3600000) {
      embeddingsCache.del(key);
    }
  });
}

// Run cleanup periodically
setInterval(cleanupCaches, 6 * 60 * 60 * 1000); // Every 6 hours

const getLatestFileContent = async (tenentId) => {
  try {
    const tenantDir = path.join(__dirname, "..", "tenant_files");

    // Check if tenant directory exists
    if (!fs.existsSync(tenantDir)) {
      console.log(`No files directory found for tenant ${tenentId}`);
      return null;
    }

    // Get all files for this tenant
    const files = fs
      .readdirSync(tenantDir)
      .filter((file) => file.startsWith(`responses_${tenentId}_`))
      .map((file) => ({
        name: file,
        path: path.join(tenantDir, file),
        timestamp: parseInt(file.split("_")[2]),
      }))
      .sort((a, b) => b.timestamp - a.timestamp);

    if (files.length > 0) {
      return files[0].path;
    } else {
      console.log(`No files found for tenant ${tenentId}`);
      return null;
    }
  } catch (error) {
    console.error(
      `Error getting latest file content for tenant ${tenentId}:`,
      error,
    );
    throw error;
  }
};

// Helper function to ensure directory exists
const ensureDirectoryExists = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`Created directory: ${dirPath}`);
  }
};

async function getFallbackButtons(tenentId) {
  try {
    const signupdata = await Signup.findOne({ tenentId: tenentId })
      .sort({ createdAt: -1 })
      .limit(1);

    return [
      {
        type: "postback",
        title: "Talk with Human Agent",
        payload: "HUMAN_AGENT",
      },
      {
        type: "postback",
        title: "Browse our Product",
        payload: "PRODUCT_CATAGORY",
      },
    ];
  } catch (error) {
    console.error("Error getting fallback buttons:", error);
    return [
      {
        type: "postback",
        title: "Talk with Human Agent",
        payload: "HUMAN_AGENT",
      },
    ];
  }
}
// Message Processing Queue Functions
async function processNextMessage(tenentId) {
  if (processingLock.get(tenentId)) return;

  try {
    processingLock.set(tenentId, true);
    const queue = messageQueue.get(tenentId) || [];

    while (queue.length > 0) {
      const eventData = queue.shift();

      try {
        // Process based on event type
        switch (eventData.eventType) {
          case "message":
            await processMessage(eventData);
            break;

          case "postback":
            await handlePostback(eventData);
            break;

          case "quick_reply":
            await handleQuickReply(eventData);
            break;

          case "audio":
            await handleInstagramAudioMessage(eventData);
            break;

          case "deleted_message":
            await handleDeletedMessage(eventData);
            break;

          case "image":
            await handleimageMessage(eventData);
            break;

          case "video":
            await handlevideoMessage(eventData);
            break;

          case "ig_reel":
            await handleigreelMessage(eventData);
            break;

          case "ig_story_reply":
            await handleig_story_replyMessage(eventData);
            break;

          case "comment":
            await handleCommentMessage(eventData);
            break;

          default:
            console.warn(`Unknown event type: ${eventData.eventType}`);
        }
      } catch (error) {
        console.error(
          `Error processing message of type ${eventData.eventType}:`,
          error,
        );

        // If it's a rate limit error (429), requeue with delay
        if (error.response && error.response.status === 429) {
          console.log(
            `Rate limit exceeded, requeuing event of type ${eventData.eventType}`,
          );

          // Get retry-after header or default to 60 seconds
          const retryAfter = parseInt(
            error.response.headers["retry-after"] || "60",
          );
          const retryMs = Math.max(retryAfter * 1000, 5000); // At least 5 seconds

          // Add back to queue with delay
          setTimeout(() => {
            if (!messageQueue.has(tenentId)) {
              messageQueue.set(tenentId, []);
            }
            messageQueue.get(tenentId).unshift(eventData); // Add to front of queue
            processNextMessage(tenentId).catch(console.error);
          }, retryMs);
        }
      }

      // Add a small delay between processing messages to avoid rapid API calls
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  } catch (error) {
    console.error("Error processing message queue:", error);
  } finally {
    processingLock.set(tenentId, false);
  }
}

// Update addToMessageQueue to handle metadata
function addToMessageQueue(tenentId, eventData) {
  if (!messageQueue.has(tenentId)) {
    messageQueue.set(tenentId, []);
  }

  const queueData = {
    ...eventData,
    queuedAt: Date.now(),
  };

  messageQueue.get(tenentId).push(queueData);

  console.log(
    `Added ${eventData.eventType} event to queue for tenant ${tenentId}`,
  );

  processNextMessage(tenentId).catch((error) => {
    console.error("Error processing message queue:", error);
  });
}

//Instagram's user Profile information
async function getUserProfileInformation(senderId, tenentId) {
  const IGSID = senderId;
  let userAccessToken;
  console.log("sender:", IGSID);

  // ✅ Define cacheKey at the beginning
  const cacheKey = `profile_${tenentId}_${senderId}`;

  // ✅ Check cache first
  const cachedProfile = responseCache.get(cacheKey);
  if (cachedProfile) {
    console.log("Retrieved profile from cache:", cachedProfile);
    return cachedProfile;
  }

  const latestToken = await LongToken.findOne({ tenentId: tenentId })
    .sort({ createdAt: -1 })
    .limit(1);

  if (latestToken) {
    console.log("Latest token retrieved for Profile_information:", latestToken);
    userAccessToken = latestToken.userAccessToken;
  }

  const accessToken = userAccessToken;

  try {
    if (!latestToken) {
      console.log("No token found for tenant:", tenentId);
      return { username: "Nil", name: "Nil", profile_pic: null };
    }

    const userAccessToken = latestToken.userAccessToken;
    const accountId = latestToken.Instagramid;

    // **CHECK RATE LIMIT BEFORE MAKING API CALL**
    if (
      !rateLimiter.canMakeConversationsApiCall(tenentId, accountId, senderId)
    ) {
      console.log(
        `⚠️  Rate limit exceeded for Conversations API for tenant ${tenentId}, using default profile info`,
      );
      return { username: "Nil", name: "Nil", profile_pic: null };
    }

    const response = await axios.get(
      `https://graph.instagram.com/v23.0/${IGSID}`,
      {
        params: {
          fields: "name,username,profile_pic",
          access_token: userAccessToken,
        },
        timeout: 10000,
      },
    );

    // Check if the response data is defined
    if (response.data) {
      console.log("User Profile:", response.data);
      // ✅ Cache the profile for future use with properly defined cacheKey
      responseCache.set(cacheKey, response.data, 3600); // Cache for 1 hour
      return response.data;
    } else {
      console.log("Response data is undefined.");
      return { username: "Nil", name: "Nil", profile_pic: null }; // ✅ Return default instead of null
    }
  } catch (error) {
    if (error.response) {
      // Log the error response from the API
      console.error(
        "Error fetching user profile:",
        error.response.status,
        error.response.data,
      );
      // Handle rate limiting errors
      if (error.response.status === 429) {
        console.error("Rate limit exceeded for Instagram API");
        return {
          username: "Nil",
          name: "Nil",
          profile_pic: null,
        };
      }
    } else {
      console.error("Error fetching user profile:", error.message);
    }
    // ✅ Return default object instead of null on error
    return { username: "Nil", name: "Nil", profile_pic: null };
  }
}

async function getUserProfileFollowInformation(senderId, tenentId) {
  const IGSID = senderId;
  console.log("sender:", IGSID);

  // ✅ Get latest token
  const latestToken = await LongToken.findOne({ tenentId })
    .sort({ createdAt: -1 })
    .limit(1);

  if (!latestToken || !latestToken.userAccessToken) {
    console.log("No token found for tenant:", tenentId);
    return {
      username: "Nil",
      name: "Nil",
      profile_pic: null,
      follower_count: 0,
      is_user_follow_business: false,
      is_business_follow_user: false,
    };
  }

  const userAccessToken = latestToken.userAccessToken;
  const accountId = latestToken.Instagramid;

  try {
    // ✅ Rate limit check
    if (
      !rateLimiter.canMakeConversationsApiCall(tenentId, accountId, senderId)
    ) {
      console.log(
        `⚠️ Rate limit exceeded for Conversations API for tenant ${tenentId}`,
      );
      return {
        username: "Nil",
        name: "Nil",
        profile_pic: null,
        follower_count: 0,
        is_user_follow_business: false,
        is_business_follow_user: false,
      };
    }

    // ✅ Instagram Graph API call - always fetch fresh data
    const response = await axios.get(
      `https://graph.instagram.com/v24.0/${IGSID}`,
      {
        params: {
          fields:
            "name,username,profile_pic,follower_count,is_user_follow_business,is_business_follow_user",
          access_token: userAccessToken,
        },
        timeout: 10000,
      },
    );

    if (response.data) {
      const profileData = {
        name: response.data.name || "Nil",
        username: response.data.username || "Nil",
        profile_pic: response.data.profile_pic || null,
        follower_count: response.data.follower_count || 0,
        is_user_follow_business: response.data.is_user_follow_business ?? false,
        is_business_follow_user: response.data.is_business_follow_user ?? false,
      };

      console.log("User Profile (Fresh):", profileData);

      return profileData;
    }

    return {
      username: "Nil",
      name: "Nil",
      profile_pic: null,
      follower_count: 0,
      is_user_follow_business: false,
      is_business_follow_user: false,
    };
  } catch (error) {
    if (error.response) {
      console.error(
        "Error fetching user profile:",
        error.response.status,
        error.response.data,
      );

      if (error.response.status === 429) {
        console.error("Rate limit exceeded for Instagram API");
      }
    } else {
      console.error("Error fetching user profile:", error.message);
    }

    // ✅ Always return safe defaults
    return {
      username: "Nil",
      name: "Nil",
      profile_pic: null,
      follower_count: 0,
      is_user_follow_business: false,
      is_business_follow_user: false,
    };
  }
}

async function handleNotFollower(
  senderID,
  tenentId, // Fixed typo
  commentText,
  matchedRule,
  mediaId,
  commentId,
  igProAccountId,
  userAccessToken,
  productcatalogurl,
  securityaccessToken,
  userName, // Added parameter
  timestamp, // Added parameter
) {
  const notFollowerTemplate = {
    attachment: {
      type: "template",
      payload: {
        template_type: "button",
        text:
          "You are not a follower. Please follow us to get the link and click the button below.",
        buttons: [
          {
            type: "postback",
            payload: "FOLLOW_STATUS", // Fixed: lowercase 'payload'
            title: "I'm Follower",
          },
        ],
      },
    },
  };

  try {
    // Send the Instagram message
    const response = await sendInstagramCommentTemplateMessage(
      igProAccountId,
      userAccessToken,
      commentId,
      senderID,
      tenentId,
      notFollowerTemplate,
    );

    console.log(
      "✅ Sent follow-required message (comment reply + DM template)",
    );

    // Save to Comment collection (like your comment message example)
    if (response) {
      const commentMessageData = {
        senderId: senderID,
        username: userName,
        commentId,
        recipientId: igProAccountId,
        message: commentText,
        response: notFollowerTemplate, // Using template instead of text
        Timestamp: timestamp,
        mediaId,
        tenentId,
      };

      const commentRecord = await Comment.createCommentMessage(
        commentMessageData,
      );
      console.log("Comment message saved:", commentRecord);
    }

    // Save to Message collection (like your product template example)
    const timestamp2 = timestamp + 10;
    const messageData = {
      senderId: senderID,
      recipientId: igProAccountId,
      response: notFollowerTemplate,
      Timestamp: timestamp2,
      tenentId: tenentId,
    };

    try {
      const message = await Message.createProductTemplateMessage(messageData);
      console.log("Message data saved:", message);

      const type = "template";
      await sendNewMessage(messageData, tenentId, type);
    } catch (error) {
      console.error("Error saving Message user data:", error);
    }

    // Log automation
    await CommentAutomationLog.create({
      senderId: senderID,
      tenentId,
      commentText,
      ruleId: matchedRule.ruleId,
      sendReplyStatus: true, // Changed to true since message was sent
      mediaId,
      commentId,
      reason: "FOLLOWER_REQUIRED_NOT_FOLLOWING",
    });
  } catch (err) {
    console.error("❌ Error sending follow-required message:", err);

    // Log failure
    await CommentAutomationLog.create({
      senderId: senderID,
      tenentId,
      commentText,
      ruleId: matchedRule.ruleId,
      sendReplyStatus: false,
      mediaId,
      commentId,
      reason: "FOLLOWER_REQUIRED_NOT_FOLLOWING",
    });
  }
}
// Validation Functions
function validateMessageData(webhookEvent) {
  return (
    webhookEvent?.message?.mid &&
    webhookEvent?.message?.text &&
    webhookEvent?.sender?.id &&
    webhookEvent?.recipient?.id
  );
}

// Error Handling
function handleProcessingError(error, context) {
  console.error("Processing Error:", {
    error: error.message,
    context,
    timestamp: new Date().toISOString(),
  });
}

// Core Message Processing Function
async function processMessage(webhookEvent) {
  const messageId = webhookEvent.message?.mid;
  const messageText = webhookEvent.message?.text;
  const senderID = webhookEvent.sender.id;
  const recipientID = webhookEvent.recipient.id;

  const accountId = recipientID;

  try {
    if (webhookEvent.message?.is_echo) {
      //const messageText = webhookEvent.message?.text;
      const recipientID = webhookEvent.recipient.id;
      const messageId = webhookEvent.message?.mid;
      const timestamp = webhookEvent.timestamp;
      const senderID = webhookEvent.sender.id;
      console.log("text sender id", senderID);
      const IdData = await LongToken.findOne({ Instagramid: senderID })
        .sort({ createdAt: -1 })
        .limit(1);

      if (!IdData?.tenentId) {
        console.error("No tenant ID found for recipient:", recipientID);

        return;
      }
      const tenentId = IdData.tenentId;
      if (webhookEvent.message?.attachments) {
        console.log("Skipping generic template message");
        return;
      }
      const messageText = webhookEvent.message?.text;

      if (messageText == "🌺") {
        const mode = "human";

        chatdata = await Mode.findOne({
          senderId: webhookEvent.recipient.id,
          tenentId: tenentId,
        }).sort({ createdAt: -1 });

        console.log("chatdata", chatdata);

        if (chatdata) {
          try {
            const updateQuery = {
              senderId: webhookEvent.recipient.id,
              tenentId: tenentId,
            };
            console.log("Update query:", updateQuery);

            const updatedContact = await Mode.findOneAndUpdate(
              updateQuery,
              { $set: { mode: mode } },
              { new: true },
            );
            console.log("updatedContact2", updatedContact);
            const modedata = {
              senderId: webhookEvent.recipient.id,
              tenentId: tenentId,
              mode: mode,
            };
            const sentstatus = await sendChatModeUpdate(modedata);
            console.log("sentstatus", sentstatus);
          } catch (error) {
            console.error("Update error:", error);
          }
        } else {
          try {
            const modeDocument = {
              mode: mode,
              senderId: webhookEvent.recipient.id, // Now included in the same object
              tenentId: tenentId,
            };
            const mode_c = new Mode(modeDocument);
            const savedMode = await mode_c.save();
            console.log("Mode data saved:", savedMode);

            await sendChatModeUpdate(modeDocument);
          } catch (error) {
            console.error("Error saving mode data:", error);
          }
        }
      }
      const inputmessage = await saveEchoMessage({
        senderId: webhookEvent.recipient.id,
        recipientId: senderID,
        messageid: messageId,
        response: messageText,
        Timestamp: timestamp,
        tenentId,
      });
      if (inputmessage) {
        console.log("inputmessage", inputmessage);
      }
      return;
    }
    // Skip if already being processed or is a delete event
    if (await isMessageBeingProcessed(messageId)) {
      console.log(`Skipping message ${messageId} - already being processed`);
      return;
    }

    startProcessingMessage(messageId);

    // Get tenant info and token
    const IdData = await LongToken.findOne({ Instagramid: recipientID })
      .sort({ createdAt: -1 })
      .limit(1);

    if (!IdData?.tenentId) {
      console.error("No tenant ID found for recipient:", recipientID);
      return;
    }

    const tenentId = IdData.tenentId;
    const userAccessToken = IdData.userAccessToken;
    rateLimiter.recordEngagedUser(tenentId, recipientID, senderID);
    if (webhookEvent.message?.quick_reply) {
      console.log("Quick reply detected - skipping GPT response");
      return;
    }

    // Process new user message
    await processUserMessage({
      webhookEvent,
      tenentId,
      userAccessToken,
      senderID,
      recipientID,
      messageText,
      messageId,
    });
  } catch (error) {
    handleProcessingError(error, {
      messageId,
      senderID,
      recipientID,
    });
  } finally {
    completeMessageProcessing(messageId);
  }
}

// User Message Processing Function
async function processUserMessage({
  webhookEvent,
  tenentId,
  userAccessToken,
  senderID,
  recipientID,
  messageText,
  messageId,
}) {
  try {
    console.log(
      `🔍 DEBUG: Starting processUserMessage for user ${senderID}, message: "${messageText}"`,
    );

    const timestamp = webhookEvent.timestamp;

    // Check if user exists first
    const user1 = await Newuser.findOne({
      senderId: senderID,
      tenentId: tenentId,
    })
      .sort({ createdAt: -1 })
      .limit(1);

    console.log(`🔍 DEBUG: User exists in database: ${!!user1}`);

    // Check if ChatflowWelcomePage exists for this tenentId (only for new users)
    if (!user1) {
      const chatflowWelcomePage = await ChatflowWelcomePage.findOne({
        tenentId: tenentId,
      })
        .sort({ createdAt: -1 })
        .limit(1);

      if (chatflowWelcomePage) {
        console.log(
          `🔍 DEBUG: ChatflowWelcomePage found for new user in tenant ${tenentId}, executing chatflow logic...`,
        );
        // Execute chatflow-specific function for new users only
        await processChatflowMessage({
          webhookEvent,
          tenentId,
          userAccessToken,
          senderID,
          recipientID,
          messageText,
          messageId,
          chatflowWelcomePage,
          timestamp,
        });
        return; // Exit early after processing chatflow for new user
      }
    }

    // Continue with existing logic
    console.log(
      `🔍 DEBUG: ${
        user1 ? "Existing user" : "New user without chatflow"
      }, proceeding with standard logic...`,
    );

    // 1. Update user profile
    const latestMainMode = await Mainmode.findOne({ tenentId }).sort({
      createdAt: -1,
    });
    const currentMainMode = latestMainMode?.mainmode || "offline";

    console.log(`🔍 DEBUG: Current main mode: ${currentMainMode}`);

    if (currentMainMode !== "online") {
      const fileupdatedContent = getLatestFileContent(tenentId);
    }

    // Get user profile data with retry logic
    let userData = null;
    let retries = 3;
    while (retries > 0 && !userData) {
      try {
        userData = await getUserProfileInformation(senderID, tenentId);
        break;
      } catch (error) {
        retries--;
        if (retries === 0) {
          console.error("Failed to get user profile after multiple attempts");
          userData = { username: "Nil", name: "Nil", profile_pic: null };
        } else {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }
    }

    let userName = userData?.username || "Nil";
    let Name = userData?.name || "Nil";
    let profile_Pic = userData?.profile_pic || null;
    console.log("User data retrieved:", { userName, Name, profile_Pic });

    // Check if user exists
    const userid = await Newuser.findOne({
      senderId: senderID,
      tenentId: tenentId,
    })
      .sort({ createdAt: -1 })
      .limit(1);

    console.log(`🔍 DEBUG: User exists in database: ${!!userid}`);

    if (userid) {
      console.log(`🔍 DEBUG: Processing existing user...`);
      console.log("User already exists, updating profile");
      await updateUserProfile(userData, senderID, tenentId);
    } else {
      console.log(`🔍 DEBUG: Creating new user...`);
      console.log("Creating new user");
      const senderdata = {
        senderId: senderID,
        username: userName,
        profile_pic: profile_Pic,
        name: Name,
        tenentId: tenentId,
      };
      const newuser = new Newuser(senderdata);
      try {
        const savednewuser = await newuser.save();
        console.log("User data saved:", savednewuser);
        // Send notification about new contact
        await sendNewContact(savednewuser, tenentId, senderID);
      } catch (error) {
        console.error("Error saving user data:", error);
      }

      // Handle welcome message for new users
      if (currentMainMode !== "online") {
        console.log(
          `🔍 DEBUG: Main mode is offline for new user, checking welcome message...`,
        );

        const welcomePageConfig = await WelcomePage.findOne({
          tenentId: tenentId,
        })
          .sort({ createdAt: -1 })
          .limit(1);

        if (welcomePageConfig) {
          console.log(`🔍 DEBUG: welcomePageConfig found, sending template...`);

          if (
            rateLimiter.canMakeSendApiTextCall(tenentId, recipientID, senderID)
          ) {
            await sendInstagramTemplateMessage(
              recipientID,
              userAccessToken,
              senderID,
              tenentId,
            );

            const firstresponse = await createWelcomeMessageResponse(
              tenentId,
              welcomePageConfig,
            );

            const messagedata = {
              senderId: senderID,
              recipientId: recipientID,
              message: messageText,
              response: firstresponse,
              messageid: messageId,
              Timestamp: timestamp,
              tenentId: tenentId,
            };

            try {
              const message = await Message.createTemplateMessage(messagedata);
              console.log("Template message saved:", message);
              const type = "template";
              await sendNewMessage(messagedata, tenentId, type);
            } catch (error) {
              console.error("Error saving template message:", error);
            }
          } else {
            console.log(
              `Rate limit exceeded for Send API (Text) for tenant ${tenentId}, skipping welcome message`,
            );
          }

          // Check mode (human or bot)
          const latestMode = await Mode.findOne({
            senderId: senderID,
            tenentId,
          }).sort({ createdAt: -1 });
          const currentMode = latestMode?.mode || "chat";
          console.log(`🔍 DEBUG: New user current mode: ${currentMode}`);

          const newtimestamp = timestamp + 1000;
          if (currentMode !== "human") {
            console.log(
              `🔍 DEBUG: New user not in human mode, sending bot response...`,
            );
            // Generate and send GPT response with rate limiting
            console.log(`🔍 DEBUG: Generating bot response for new user...`);
            const botResponse = await getGptResponse(
              messageText,
              tenentId,
              senderID,
            );
            console.log(
              `🔍 DEBUG: Bot response for new user: "${botResponse}"`,
            );

            if (
              botResponse &&
              typeof botResponse === "string" &&
              botResponse.trim()
            ) {
              // Check rate limit for sending a text message (Send API - Text)
              if (
                rateLimiter.canMakeSendApiTextCall(
                  tenentId,
                  recipientID,
                  senderID,
                )
              ) {
                console.log(
                  `🔍 DEBUG: Rate limit OK for new user, calling sendInstagramMessage...`,
                );

                const response = await sendInstagramMessage(
                  recipientID,
                  userAccessToken,
                  senderID,
                  botResponse,
                );

                console.log(
                  `🔍 DEBUG: Bot response sent to new user:`,
                  response,
                );
              } else {
                console.log(
                  `Rate limit exceeded for Send API (Text) for tenant ${tenentId}, delaying bot response`,
                );
                // Schedule retry after short delay
                setTimeout(async () => {
                  try {
                    if (
                      rateLimiter.canMakeSendApiTextCall(
                        tenentId,
                        recipientID,
                        senderID,
                      )
                    ) {
                      await sendInstagramMessage(
                        recipientID,
                        userAccessToken,
                        senderID,
                        botResponse,
                      );
                    }
                  } catch (err) {
                    console.error("Error in delayed bot response:", err);
                  }
                }, 2000);
              }
            }
          } else {
            console.log(
              `🔍 DEBUG: New user in human mode, sending human agent message...`,
            );
            const messagebot =
              "You are currently connected to a human agent. If you wish to speak with the AI assistant, tap the three lines in the top-right corner. This will provide options to switch between a human agent and the chatbot. To chat with a human agent, select 'Human Agent.' To chat with the chatbot, select 'Chatbot.'";

            // Check rate limit for sending a text message (Send API - Text)
            if (
              rateLimiter.canMakeSendApiTextCall(
                tenentId,
                recipientID,
                senderID,
              )
            ) {
              const response = await sendInstagramMessage(
                recipientID,
                userAccessToken,
                senderID,
                messagebot,
              );
            }
          }
        }

        if (!welcomePageConfig) {
          // Check mode (human or bot)
          const latestMode = await Mode.findOne({
            senderId: senderID,
            tenentId,
          }).sort({ createdAt: -1 });
          const currentMode = latestMode?.mode || "chat";
          console.log(
            `🔍 DEBUG: New user (no welcome) current mode: ${currentMode}`,
          );

          if (currentMode !== "human") {
            console.log(
              `🔍 DEBUG: New user (no welcome) not in human mode, sending bot response...`,
            );
            console.log(
              `🔍 DEBUG: No welcome message found, sending direct bot response to new user...`,
            );
            const botResponse = await getGptResponse(
              messageText,
              tenentId,
              senderID,
            );
            console.log(
              `🔍 DEBUG: Direct bot response for new user: "${botResponse}"`,
            );

            if (
              botResponse &&
              typeof botResponse === "string" &&
              botResponse.trim()
            ) {
              // Check rate limit for sending a text message (Send API - Text)
              if (
                rateLimiter.canMakeSendApiTextCall(
                  tenentId,
                  recipientID,
                  senderID,
                )
              ) {
                console.log(
                  `🔍 DEBUG: Rate limit OK for new user (no welcome), calling sendInstagramMessage...`,
                );

                const response = await sendInstagramMessage(
                  recipientID,
                  userAccessToken,
                  senderID,
                  botResponse,
                );

                console.log(
                  `🔍 DEBUG: Direct bot response sent to new user:`,
                  response,
                );
              } else {
                console.log(
                  `Rate limit exceeded for Send API (Text) for tenant ${tenentId}, skipping bot response`,
                );
              }
            }
          }
        }
      } else {
        const signupdata = await Signup.findOne({ tenentId: tenentId })
          .sort({ createdAt: -1 })
          .limit(1);
        if (signupdata) {
          const username = signupdata.name;
          let response;
          if (
            messageText.includes("#") ||
            messageText.includes("*") ||
            messageText.includes("$")
          ) {
            try {
              if (messageText.includes("$")) {
                // Action to take if '$' is found in user_input
                const orderId = messageText.split("$")[0];
                if (!orderId) {
                  const response =
                    "Invalid format. Please enter a valid order ID followed by # (e.g., 12345#).";
                  const response2 = await sendInstagramMessage(
                    recipientID,
                    userAccessToken,
                    senderID,
                    response,
                  );
                  const messagedata = {
                    senderId: senderID,
                    recipientId: recipientID,
                    //response:response,
                    message: messageText,
                    messageid: messageId,
                    Timestamp: timestamp,
                    tenentId: tenentId,
                  };

                  try {
                    const message = await Message.createTextMessage(
                      messagedata,
                    );
                    console.log("Message data four11 saved:", message);
                    const type = "text";
                    await sendNewMessage(messagedata, tenentId, type);
                  } catch (error) {
                    console.error("Error Message user data:", error);
                  }
                  return;
                }

                // Try to get order details from MongoDB
                if (tenentId) {
                  // Make sure you have tenentId available in your context
                  response = await mongoGetOrderDetailsResponse(
                    orderId,
                    tenentId,
                  );
                  console.log("okay for $");
                } else {
                  response = "No tenant ID available to check order details.";
                }
                const response1 = await sendInstagramMessage(
                  recipientID,
                  userAccessToken,
                  senderID,
                  response,
                );
                console.log("messagetext for #", messageText);
                const messagedata = {
                  senderId: senderID,
                  recipientId: recipientID,
                  message: messageText,
                  //response:response,
                  messageid: messageId,
                  Timestamp: timestamp,
                  tenentId: tenentId,
                };

                try {
                  const message = await Message.createTextMessage(messagedata);
                  console.log("Message data four1 saved:", message);
                  const type = "text";
                  await sendNewMessage(messagedata, tenentId, type);
                } catch (error) {
                  console.error("Error Message user data:", error);
                }
                return;
              }
              const storeCredentials = await ecommerceCredentialsService.getCredentialsForAPI(
                tenentId,
              );

              if (
                storeCredentials &&
                storeCredentials.websites &&
                storeCredentials.websites.length > 0
              ) {
                // Find WooCommerce and Shopify credentials if they exist
                const wooCommerceWebsite = storeCredentials.websites.find(
                  (website) => website.type === "woocommerce",
                );
                const shopifyWebsite = storeCredentials.websites.find(
                  (website) => website.type === "shopify",
                );

                // Only access credentials if the website exists
                const wooCredentials = wooCommerceWebsite
                  ? wooCommerceWebsite.credentials
                  : null;
                const shopifyCredentials = shopifyWebsite
                  ? shopifyWebsite.credentials
                  : null;
                console.log("wooCredentials", wooCredentials);
                // Log available credentials
                if (wooCredentials)
                  console.log("WooCommerce credentials found");
                if (shopifyCredentials)
                  console.log("Shopify credentials found");

                if (messageText.includes("#")) {
                  // Action to take if '#' is found in user_input
                  const orderId = messageText.split("#")[0];
                  if (!orderId) {
                    const response =
                      "Invalid format. Please enter a valid order ID followed by # (e.g., 12345#).";
                    const response2 = await sendInstagramMessage(
                      recipientID,
                      userAccessToken,
                      senderID,
                      response,
                    );
                    const messagedata = {
                      senderId: senderID,
                      recipientId: recipientID,
                      //response:response,
                      message: messageText,
                      messageid: messageId,
                      Timestamp: timestamp,
                      tenentId: tenentId,
                    };

                    try {
                      const message = await Message.createTextMessage(
                        messagedata,
                      );
                      console.log("Message data four11 saved:", message);
                      const type = "text";
                      await sendNewMessage(messagedata, tenentId, type);
                    } catch (error) {
                      console.error("Error Message user data:", error);
                    }
                    return;
                  }

                  // Try to get order status using available credentials
                  if (wooCredentials) {
                    response = await wooCommercegetOrderStatusResponse(
                      orderId,
                      wooCredentials,
                    );
                  } else if (shopifyCredentials) {
                    response = await shopifygetOrderStatusResponse(
                      orderId,
                      shopifyCredentials,
                    );
                  } else {
                    response =
                      "No store credentials available to check order status.";
                  }

                  const response1 = await sendInstagramMessage(
                    recipientID,
                    userAccessToken,
                    senderID,
                    response,
                  );
                  console.log("messagetext for #", messageText);
                  const messagedata = {
                    senderId: senderID,
                    recipientId: recipientID,
                    message: messageText,
                    //response:response,
                    messageid: messageId,
                    Timestamp: timestamp,
                    tenentId: tenentId,
                  };

                  try {
                    const message = await Message.createTextMessage(
                      messagedata,
                    );
                    console.log("Message data four1 saved:", message);
                    const type = "text";
                    await sendNewMessage(messagedata, tenentId, type);
                  } catch (error) {
                    console.error("Error Message user data:", error);
                  }
                  return;
                }
                if (messageText.includes("$")) {
                  // Action to take if '$' is found in user_input
                  const orderId = messageText.split("$")[0];
                  if (!orderId) {
                    const response =
                      "Invalid format. Please enter a valid order ID followed by # (e.g., 12345#).";
                    const response2 = await sendInstagramMessage(
                      recipientID,
                      userAccessToken,
                      senderID,
                      response,
                    );
                    const messagedata = {
                      senderId: senderID,
                      recipientId: recipientID,
                      //response:response,
                      message: messageText,
                      messageid: messageId,
                      Timestamp: timestamp,
                      tenentId: tenentId,
                    };

                    try {
                      const message = await Message.createTextMessage(
                        messagedata,
                      );
                      console.log("Message data four11 saved:", message);
                      const type = "text";
                      await sendNewMessage(messagedata, tenentId, type);
                    } catch (error) {
                      console.error("Error Message user data:", error);
                    }
                    return;
                  }

                  // Try to get order details from MongoDB
                  if (tenentId) {
                    // Make sure you have tenentId available in your context
                    response = await mongoGetOrderDetailsResponse(
                      orderId,
                      tenentId,
                    );
                    console.log("okay for $");
                  } else {
                    response = "No tenant ID available to check order details.";
                  }
                  const response1 = await sendInstagramMessage(
                    recipientID,
                    userAccessToken,
                    senderID,
                    response,
                  );
                  console.log("messagetext for #", messageText);
                  const messagedata = {
                    senderId: senderID,
                    recipientId: recipientID,
                    message: messageText,
                    //response:response,
                    messageid: messageId,
                    Timestamp: timestamp,
                    tenentId: tenentId,
                  };

                  try {
                    const message = await Message.createTextMessage(
                      messagedata,
                    );
                    console.log("Message data four1 saved:", message);
                    const type = "text";
                    await sendNewMessage(messagedata, tenentId, type);
                  } catch (error) {
                    console.error("Error Message user data:", error);
                  }
                  return;
                }
                if (messageText.includes("*")) {
                  // Extract the product name
                  const productName = messageText.split("*")[0];
                  if (!productName) {
                    const response1 =
                      "Invalid format. Please enter a valid product name followed by * (e.g., productName*).";
                    const response2 = await sendInstagramMessage(
                      recipientID,
                      userAccessToken,
                      senderID,
                      response1,
                    );
                    const messagedata = {
                      senderId: senderID,
                      recipientId: recipientID,
                      //response:response1,
                      message: messageText,
                      messageid: messageId,
                      Timestamp: timestamp,
                      tenentId: tenentId,
                    };
                    console.log("messagetext for *", messageText);
                    try {
                      const message = await Message.createTextMessage(
                        messagedata,
                      );
                      console.log("Message data four saved:", message);
                      const type = "text";
                      await sendNewMessage(messagedata, tenentId, type);
                    } catch (error) {
                      console.error("Error Message user data:", error);
                    }
                    return;
                  }

                  // Try to check product stock using available credentials
                  let productResponse;
                  if (wooCredentials) {
                    productResponse = await wooCommercecheckProductStock(
                      productName,
                      wooCredentials,
                    );
                  } else if (shopifyCredentials) {
                    productResponse = await shopifycheckProductStock(
                      productName,
                      shopifyCredentials,
                    );
                  } else {
                    return "No store credentials available to check product stock.";
                  }

                  console.log("The input contains a '*' character.");
                  console.log("Product Stock", productResponse);

                  if (
                    !productResponse.success ||
                    !productResponse.data ||
                    productResponse.data.length === 0
                  ) {
                    const response1 = "No matching products found.";
                    const response2 = await sendInstagramMessage(
                      recipientID,
                      userAccessToken,
                      senderID,
                      response1,
                    );
                    const messagedata = {
                      senderId: senderID,
                      recipientId: recipientID,
                      //response:response1,
                      message: messageText,
                      messageid: messageId,
                      Timestamp: timestamp,
                      tenentId: tenentId,
                    };

                    try {
                      const message = await Message.createTextMessage(
                        messagedata,
                      );
                      console.log("Message data four saved:", message);
                      const type = "text";
                      await sendNewMessage(messagedata, tenentId, type);
                    } catch (error) {
                      console.error("Error Message user data:", error);
                    }
                    return;
                  }
                  const productDetails = productResponse.data
                    .map((product) => {
                      const name = product.name;
                      const stock_status1 =
                        product.stock_status === "instock"
                          ? "AVAILABLE"
                          : "OUT OF STOCK";
                      const price = product.price;
                      const link = product.permalink;
                      return `🍀 ${name} is ${stock_status1}!🛒\n\nPrice: ₹${price} \n\nExplore it here: ${link}\n`;
                    })
                    .join("\n\n");
                  // Iterate over all products and build the response
                  const response2 = await sendInstagramMessage(
                    recipientID,
                    userAccessToken,
                    senderID,
                    productDetails,
                  );

                  const messagedata = {
                    senderId: senderID,
                    recipientId: recipientID,
                    message: messageText,
                    messageid: messageId,
                    Timestamp: timestamp,
                    tenentId: tenentId,
                  };

                  try {
                    const message = await Message.createTextMessage(
                      messagedata,
                    );
                    console.log("Message data four saved:", message);
                    const type = "text";
                    await sendNewMessage(messagedata, tenentId, type);
                  } catch (error) {
                    console.error("Error Message user data:", error);
                  }
                  return;
                }
              } else {
                return "No store credentials found for this account.";
              }
            } catch (error) {
              console.error(
                "Error retrieving or processing store credentials:",
                error,
              );
              return "We encountered an error while processing your request. Please try again later.";
            }
          }
        }

        const messagedata = {
          senderId: senderID,
          recipientId: recipientID,
          message: messageText,
          messageid: messageId,
          Timestamp: timestamp,
          tenentId: tenentId,
        };

        try {
          const message = await Message.createTextMessage(messagedata);
          console.log("Message data four saved:", message);
          const type = "text";
          await sendNewMessage(messagedata, tenentId, type);
        } catch (error) {
          console.error("Error Message user data:", error);
        }
        return;
      }
      ///else of first !online close bracket
      return;
    }

    // Handle existing users (this is the main issue area)
    if (userid) {
      console.log(
        `🔍 DEBUG: Processing existing user with currentMainMode: ${currentMainMode}`,
      );

      if (currentMainMode !== "online") {
        console.log(`🔍 DEBUG: Bot response is valid, checking user mode...`);

        // Check mode (human or bot)
        const latestMode = await Mode.findOne({
          senderId: senderID,
          tenentId,
        }).sort({ createdAt: -1 });
        const currentMode = latestMode?.mode || "chat";
        console.log(
          `🔍 DEBUG: Current user mode for existing user: ${currentMode}`,
        );

        if (currentMode !== "human") {
          console.log(
            `🔍 DEBUG: User is NOT in human mode, checking rate limits...`,
          );
          console.log(
            `🔍 DEBUG: Current main mode is NOT online, proceeding with bot response...`,
          );
          const botResponse = await getGptResponse(
            messageText,
            tenentId,
            senderID,
          );
          console.log(
            `🔍 DEBUG: Bot response generated for existing user: "${botResponse}"`,
          );

          if (
            botResponse &&
            typeof botResponse === "string" &&
            botResponse.trim()
          ) {
            // Check rate limit for sending a text message (Send API - Text)
            if (
              rateLimiter.canMakeSendApiTextCall(
                tenentId,
                recipientID,
                senderID,
              )
            ) {
              console.log(
                `🔍 DEBUG: Rate limit check PASSED, calling sendInstagramMessage...`,
              );

              const response = await sendInstagramMessage(
                recipientID,
                userAccessToken,
                senderID,
                botResponse,
              );

              console.log(
                `🔍 DEBUG: sendInstagramMessage completed with response:`,
                response,
              );

              // Save message
              const messageData = {
                senderId: senderID,
                recipientId: recipientID,
                message: messageText,
                messageid: messageId,
                Timestamp: timestamp,
                tenentId,
              };

              try {
                const message = await Message.createTextMessage(messageData);
                console.log("Text message saved:", message);
                const type = "text";
                await sendNewMessage(messageData, tenentId, type);
              } catch (error) {
                console.error("Error saving message:", error);
              }
            } else {
              console.log(`🔍 DEBUG: Rate limit EXCEEDED, scheduling retry...`);
              console.log(
                `Rate limit exceeded for Send API (Text) for tenant ${tenentId}, skipping bot response`,
              );

              // Schedule retry after short delay
              setTimeout(async () => {
                try {
                  if (
                    rateLimiter.canMakeSendApiTextCall(
                      tenentId,
                      recipientID,
                      senderID,
                    )
                  ) {
                    await sendInstagramMessage(
                      recipientID,
                      userAccessToken,
                      senderID,
                      botResponse,
                    );

                    // Save message
                    const messageData = {
                      senderId: senderID,
                      recipientId: recipientID,
                      message: messageText,
                      messageid: messageId,
                      Timestamp: timestamp,
                      tenentId,
                    };

                    try {
                      const message = await Message.createTextMessage(
                        messageData,
                      );
                      console.log("Delayed text message saved:", message);
                      const type = "text";
                      await sendNewMessage(messageData, tenentId, type);
                    } catch (error) {
                      console.error("Error saving delayed message:", error);
                    }
                  }
                } catch (err) {
                  console.error("Error in delayed bot response:", err);
                }
              }, 3000);
            }
          } else {
            console.log(
              `🔍 DEBUG: Bot response is INVALID or empty:`,
              botResponse,
            );
          }
        } else {
          console.log("message for online", messageText);
          const signupdata = await Signup.findOne({ tenentId: tenentId })
            .sort({ createdAt: -1 })
            .limit(1);
          if (signupdata) {
            const username = signupdata.name;
            let response;
            if (
              messageText.includes("#") ||
              messageText.includes("*") ||
              messageText.includes("$")
            ) {
              try {
                if (messageText.includes("$")) {
                  // Action to take if '$' is found in user_input
                  const orderId = messageText.split("$")[0];
                  if (!orderId) {
                    return "Invalid format. Please enter a valid order ID followed by $ (e.g., 12345$).";
                  }

                  // Try to get order details from MongoDB
                  if (tenentId) {
                    // Make sure you have tenentId available in your context
                    response = await mongoGetOrderDetailsResponse(
                      orderId,
                      tenentId,
                    );
                    console.log("okay for $");
                  } else {
                    return "No tenant ID available to check order details.";
                  }

                  console.log("The input contains a '$' character.");
                  return response;
                }
                const storeCredentials = await ecommerceCredentialsService.getCredentialsForAPI(
                  tenentId,
                );

                if (
                  storeCredentials &&
                  storeCredentials.websites &&
                  storeCredentials.websites.length > 0
                ) {
                  // Find WooCommerce and Shopify credentials if they exist
                  const wooCommerceWebsite = storeCredentials.websites.find(
                    (website) => website.type === "woocommerce",
                  );
                  const shopifyWebsite = storeCredentials.websites.find(
                    (website) => website.type === "shopify",
                  );

                  // Only access credentials if the website exists
                  const wooCredentials = wooCommerceWebsite
                    ? wooCommerceWebsite.credentials
                    : null;
                  const shopifyCredentials = shopifyWebsite
                    ? shopifyWebsite.credentials
                    : null;
                  console.log("wooCredentials", wooCredentials);
                  // Log available credentials
                  if (wooCredentials)
                    console.log("WooCommerce credentials found");
                  if (shopifyCredentials)
                    console.log("Shopify credentials found");

                  if (messageText.includes("#")) {
                    // Action to take if '#' is found in user_input
                    const orderId = messageText.split("#")[0];
                    if (!orderId) {
                      const response =
                        "Invalid format. Please enter a valid order ID followed by # (e.g., 12345#).";
                      const response2 = await sendInstagramMessage(
                        recipientID,
                        userAccessToken,
                        senderID,
                        response,
                      );
                      const messagedata = {
                        senderId: senderID,
                        recipientId: recipientID,
                        //response:response,
                        message: messageText,
                        messageid: messageId,
                        Timestamp: timestamp,
                        tenentId: tenentId,
                      };

                      try {
                        const message = await Message.createTextMessage(
                          messagedata,
                        );
                        console.log("Message data four11 saved:", message);
                        const type = "text";
                        await sendNewMessage(messagedata, tenentId, type);
                      } catch (error) {
                        console.error("Error Message user data:", error);
                      }
                      return;
                    }

                    // Try to get order status using available credentials
                    if (wooCredentials) {
                      response = await wooCommercegetOrderStatusResponse(
                        orderId,
                        wooCredentials,
                      );
                    } else if (shopifyCredentials) {
                      response = await shopifygetOrderStatusResponse(
                        orderId,
                        shopifyCredentials,
                      );
                    } else {
                      return "No store credentials available to check order status.";
                    }

                    const response1 = await sendInstagramMessage(
                      recipientID,
                      userAccessToken,
                      senderID,
                      response,
                    );
                    console.log("messagetext for #", messageText);
                    const messagedata = {
                      senderId: senderID,
                      recipientId: recipientID,
                      message: messageText,
                      //response:response,
                      messageid: messageId,
                      Timestamp: timestamp,
                      tenentId: tenentId,
                    };

                    try {
                      const message = await Message.createTextMessage(
                        messagedata,
                      );
                      console.log("Message data four1 saved:", message);
                      const type = "text";
                      await sendNewMessage(messagedata, tenentId, type);
                    } catch (error) {
                      console.error("Error Message user data:", error);
                    }
                    return;
                  }
                  if (messageText.includes("$")) {
                    // Action to take if '$' is found in user_input
                    const orderId = messageText.split("$")[0];
                    if (!orderId) {
                      return "Invalid format. Please enter a valid order ID followed by $ (e.g., 12345$).";
                    }

                    // Try to get order details from MongoDB
                    if (tenentId) {
                      // Make sure you have tenentId available in your context
                      response = await mongoGetOrderDetailsResponse(
                        orderId,
                        tenentId,
                      );
                      console.log("okay for $");
                    } else {
                      return "No tenant ID available to check order details.";
                    }

                    console.log("The input contains a '$' character.");
                    return response;
                  }
                  if (messageText.includes("*")) {
                    // Extract the product name
                    const productName = messageText.split("*")[0];
                    if (!productName) {
                      const response1 =
                        "Invalid format. Please enter a valid product name followed by * (e.g., productName*).";
                      const response2 = await sendInstagramMessage(
                        recipientID,
                        userAccessToken,
                        senderID,
                        response1,
                      );
                      const messagedata = {
                        senderId: senderID,
                        recipientId: recipientID,
                        //response:response1,
                        message: messageText,
                        messageid: messageId,
                        Timestamp: timestamp,
                        tenentId: tenentId,
                      };
                      console.log("messagetext for *", messageText);
                      try {
                        const message = await Message.createTextMessage(
                          messagedata,
                        );
                        console.log("Message data four saved:", message);
                        const type = "text";
                        await sendNewMessage(messagedata, tenentId, type);
                      } catch (error) {
                        console.error("Error Message user data:", error);
                      }
                      return;
                    }

                    // Try to check product stock using available credentials
                    let productResponse;
                    if (wooCredentials) {
                      productResponse = await wooCommercecheckProductStock(
                        productName,
                        wooCredentials,
                      );
                    } else if (shopifyCredentials) {
                      productResponse = await shopifycheckProductStock(
                        productName,
                        shopifyCredentials,
                      );
                    } else {
                      return "No store credentials available to check product stock.";
                    }

                    console.log("The input contains a '*' character.");
                    console.log("Product Stock", productResponse);

                    if (
                      !productResponse.success ||
                      !productResponse.data ||
                      productResponse.data.length === 0
                    ) {
                      const response1 = "No matching products found.";
                      const response2 = await sendInstagramMessage(
                        recipientID,
                        userAccessToken,
                        senderID,
                        response1,
                      );
                      const messagedata = {
                        senderId: senderID,
                        recipientId: recipientID,
                        //response:response1,
                        message: messageText,
                        messageid: messageId,
                        Timestamp: timestamp,
                        tenentId: tenentId,
                      };

                      try {
                        const message = await Message.createTextMessage(
                          messagedata,
                        );
                        console.log("Message data four saved:", message);
                        const type = "text";
                        await sendNewMessage(messagedata, tenentId, type);
                      } catch (error) {
                        console.error("Error Message user data:", error);
                      }
                      return;
                    }
                    const productDetails = productResponse.data
                      .map((product) => {
                        const name = product.name;
                        const stock_status1 =
                          product.stock_status === "instock"
                            ? "AVAILABLE"
                            : "OUT OF STOCK";
                        const price = product.price;
                        const link = product.permalink;
                        return `🍀 ${name} is ${stock_status1}!🛒\n\nPrice: ₹${price} \n\nExplore it here: ${link}\n`;
                      })
                      .join("\n\n");
                    // Iterate over all products and build the response
                    const response2 = await sendInstagramMessage(
                      recipientID,
                      userAccessToken,
                      senderID,
                      productDetails,
                    );

                    const messagedata = {
                      senderId: senderID,
                      recipientId: recipientID,
                      message: messageText,
                      messageid: messageId,
                      Timestamp: timestamp,
                      tenentId: tenentId,
                    };

                    try {
                      const message = await Message.createTextMessage(
                        messagedata,
                      );
                      console.log("Message data four saved:", message);
                      const type = "text";
                      await sendNewMessage(messagedata, tenentId, type);
                    } catch (error) {
                      console.error("Error Message user data:", error);
                    }
                    return;
                  }
                } else {
                  console.error("No store credentials found for this account.");
                }
              } catch (error) {
                console.error(
                  "Error retrieving or processing store credentials:",
                  error,
                );
                //return "We encountered an error while processing your request. Please try again later.";
              }
            }
          }

          const messagedata = {
            senderId: senderID,
            recipientId: recipientID,
            message: messageText,
            messageid: messageId,
            Timestamp: timestamp,
            tenentId: tenentId,
          };

          try {
            const message = await Message.createTextMessage(messagedata);
            console.log("Message data four saved:", message);
            const type = "text";
            await sendNewMessage(messagedata, tenentId, type);
          } catch (error) {
            console.error("Error Message user data:", error);
          }
        }
      } else {
        console.log(
          `🔍 DEBUG: Current main mode IS ONLINE, handling e-commerce...`,
        );

        // Handle online mode with e-commerce integration
        const signupdata = await Signup.findOne({ tenentId: tenentId })
          .sort({ createdAt: -1 })
          .limit(1);

        if (signupdata) {
          const username = signupdata.name;
          let response;

          // Handle special commands for product/order lookup
          if (
            messageText &&
            (messageText.includes("#") ||
              messageText.includes("*") ||
              messageText.includes("$"))
          ) {
            try {
              if (messageText.includes("$")) {
                // Action to take if '$' is found in user_input
                const orderId = messageText.split("$")[0];
                if (!orderId) {
                  return "Invalid format. Please enter a valid order ID followed by $ (e.g., 12345$).";
                }

                // Try to get order details from MongoDB
                if (tenentId) {
                  // Make sure you have tenentId available in your context
                  response = await mongoGetOrderDetailsResponse(
                    orderId,
                    tenentId,
                  );
                  console.log("okay for $");
                } else {
                  return "No tenant ID available to check order details.";
                }

                console.log("The input contains a '$' character.");
                return response;
              }
              const storeCredentials = await ecommerceCredentialsService.getCredentialsForAPI(
                tenentId,
              );
              if (
                storeCredentials &&
                storeCredentials.websites &&
                storeCredentials.websites.length > 0
              ) {
                // Find WooCommerce and Shopify credentials if they exist
                const wooCommerceWebsite = storeCredentials.websites.find(
                  (website) => website.type === "woocommerce",
                );
                const shopifyWebsite = storeCredentials.websites.find(
                  (website) => website.type === "shopify",
                );

                // Only access credentials if the website exists
                const wooCredentials = wooCommerceWebsite
                  ? wooCommerceWebsite.credentials
                  : null;
                const shopifyCredentials = shopifyWebsite
                  ? shopifyWebsite.credentials
                  : null;

                // Handle order status lookup
                if (messageText.includes("#")) {
                  // Action to take if '#' is found in user_input
                  const orderId = messageText.split("#")[0];
                  if (!orderId) {
                    // Check rate limit for sending a text message (Send API - Text)
                    if (
                      rateLimiter.canMakeSendApiTextCall(
                        tenentId,
                        recipientID,
                        senderID,
                      )
                    ) {
                      const response =
                        "Invalid format. Please enter a valid order ID followed by # (e.g., 12345#).";
                      await sendInstagramMessage(
                        recipientID,
                        userAccessToken,
                        senderID,
                        response,
                      );
                    }

                    const messagedata = {
                      senderId: senderID,
                      recipientId: recipientID,
                      message: messageText,
                      messageid: messageId,
                      Timestamp: timestamp,
                      tenentId: tenentId,
                    };

                    try {
                      const message = await Message.createTextMessage(
                        messagedata,
                      );
                      console.log("Text message saved:", message);
                      const type = "text";
                      await sendNewMessage(messagedata, tenentId, type);
                    } catch (error) {
                      console.error("Error saving message:", error);
                    }
                    return;
                  }

                  // Try to get order status using available credentials
                  if (wooCredentials) {
                    response = await wooCommercegetOrderStatusResponse(
                      orderId,
                      wooCredentials,
                    );
                  } else if (shopifyCredentials) {
                    response = await shopifygetOrderStatusResponse(
                      orderId,
                      shopifyCredentials,
                    );
                  } else {
                    response =
                      "No store credentials available to check order status.";
                  }

                  // Check rate limit for sending a text message (Send API - Text)
                  if (
                    rateLimiter.canMakeSendApiTextCall(
                      tenentId,
                      recipientID,
                      senderID,
                    )
                  ) {
                    await sendInstagramMessage(
                      recipientID,
                      userAccessToken,
                      senderID,
                      response,
                    );
                  } else {
                    console.log(
                      `Rate limit exceeded for Send API (Text) for tenant ${tenentId}, delaying order status response`,
                    );
                    // Schedule retry after delay
                    setTimeout(async () => {
                      try {
                        if (
                          rateLimiter.canMakeSendApiTextCall(
                            tenentId,
                            recipientID,
                            senderID,
                          )
                        ) {
                          await sendInstagramMessage(
                            recipientID,
                            userAccessToken,
                            senderID,
                            response,
                          );
                        }
                      } catch (err) {
                        console.error("Error in delayed order response:", err);
                      }
                    }, 3000);
                  }

                  const messagedata = {
                    senderId: senderID,
                    recipientId: recipientID,
                    message: messageText,
                    messageid: messageId,
                    Timestamp: timestamp,
                    tenentId: tenentId,
                  };

                  try {
                    const message = await Message.createTextMessage(
                      messagedata,
                    );
                    console.log("Text message saved:", message);
                    const type = "text";
                    await sendNewMessage(messagedata, tenentId, type);
                  } catch (error) {
                    console.error("Error saving message:", error);
                  }
                  return;
                }
                if (messageText.includes("$")) {
                  // Action to take if '$' is found in user_input
                  const orderId = messageText.split("$")[0];
                  if (!orderId) {
                    return "Invalid format. Please enter a valid order ID followed by $ (e.g., 12345$).";
                  }

                  // Try to get order details from MongoDB
                  if (tenentId) {
                    // Make sure you have tenentId available in your context
                    response = await mongoGetOrderDetailsResponse(
                      orderId,
                      tenentId,
                    );
                    console.log("okay for $");
                  } else {
                    return "No tenant ID available to check order details.";
                  }

                  console.log("The input contains a '$' character.");
                  return response;
                }
                // Handle product stock lookup
                if (messageText.includes("*")) {
                  // Extract the product name
                  const productName = messageText.split("*")[0];
                  if (!productName) {
                    // Check rate limit for sending a text message (Send API - Text)
                    if (
                      rateLimiter.canMakeSendApiTextCall(
                        tenentId,
                        recipientID,
                        senderID,
                      )
                    ) {
                      const response =
                        "Invalid format. Please enter a valid product name followed by * (e.g., productName*).";
                      await sendInstagramMessage(
                        recipientID,
                        userAccessToken,
                        senderID,
                        response,
                      );
                    }

                    const messagedata = {
                      senderId: senderID,
                      recipientId: recipientID,
                      message: messageText,
                      messageid: messageId,
                      Timestamp: timestamp,
                      tenentId: tenentId,
                    };

                    try {
                      const message = await Message.createTextMessage(
                        messagedata,
                      );
                      console.log("Text message saved:", message);
                      const type = "text";
                      await sendNewMessage(messagedata, tenentId, type);
                    } catch (error) {
                      console.error("Error saving message:", error);
                    }
                    return;
                  }

                  // Try to check product stock using available credentials
                  let productResponse;
                  if (wooCredentials) {
                    productResponse = await wooCommercecheckProductStock(
                      productName,
                      wooCredentials,
                    );
                  } else if (shopifyCredentials) {
                    productResponse = await shopifycheckProductStock(
                      productName,
                      shopifyCredentials,
                    );
                  } else {
                    if (
                      rateLimiter.canMakeSendApiTextCall(
                        tenentId,
                        recipientID,
                        senderID,
                      )
                    ) {
                      await sendInstagramMessage(
                        recipientID,
                        userAccessToken,
                        senderID,
                        "No store credentials available to check product stock.",
                      );
                    }
                    return;
                  }

                  if (
                    !productResponse.success ||
                    !productResponse.data ||
                    productResponse.data.length === 0
                  ) {
                    if (
                      rateLimiter.canMakeSendApiTextCall(
                        tenentId,
                        recipientID,
                        senderID,
                      )
                    ) {
                      await sendInstagramMessage(
                        recipientID,
                        userAccessToken,
                        senderID,
                        "No matching products found.",
                      );
                    }

                    const messagedata = {
                      senderId: senderID,
                      recipientId: recipientID,
                      message: messageText,
                      messageid: messageId,
                      Timestamp: timestamp,
                      tenentId: tenentId,
                    };

                    try {
                      const message = await Message.createTextMessage(
                        messagedata,
                      );
                      console.log("Text message saved:", message);
                      const type = "text";
                      await sendNewMessage(messagedata, tenentId, type);
                    } catch (error) {
                      console.error("Error saving message:", error);
                    }
                    return;
                  }

                  // Format product details message
                  const productDetails = productResponse.data
                    .map((product) => {
                      const name = product.name;
                      const stock_status1 =
                        product.stock_status === "instock"
                          ? "AVAILABLE"
                          : "OUT OF STOCK";
                      const price = product.price;
                      const link = product.permalink;
                      return `🍀 ${name} is ${stock_status1}!🛒\n\nPrice: ₹${price} \n\nExplore it here: ${link}\n`;
                    })
                    .join("\n\n");

                  // Check rate limit for sending a text message (Send API - Text)
                  if (
                    rateLimiter.canMakeSendApiTextCall(
                      tenentId,
                      recipientID,
                      senderID,
                    )
                  ) {
                    await sendInstagramMessage(
                      recipientID,
                      userAccessToken,
                      senderID,
                      productDetails,
                    );
                  } else {
                    console.log(
                      `Rate limit exceeded for Send API (Text) for tenant ${tenentId}, delaying product details response`,
                    );
                    // Schedule retry after delay
                    setTimeout(async () => {
                      try {
                        if (
                          rateLimiter.canMakeSendApiTextCall(
                            tenentId,
                            recipientID,
                            senderID,
                          )
                        ) {
                          await sendInstagramMessage(
                            recipientID,
                            userAccessToken,
                            senderID,
                            productDetails,
                          );
                        }
                      } catch (err) {
                        console.error(
                          "Error in delayed product response:",
                          err,
                        );
                      }
                    }, 3000);
                  }

                  const messagedata = {
                    senderId: senderID,
                    recipientId: recipientID,
                    message: messageText,
                    messageid: messageId,
                    Timestamp: timestamp,
                    tenentId: tenentId,
                  };

                  try {
                    const message = await Message.createTextMessage(
                      messagedata,
                    );
                    console.log("Text message saved:", message);
                    const type = "text";
                    await sendNewMessage(messagedata, tenentId, type);
                  } catch (error) {
                    console.error("Error saving message:", error);
                  }
                  return;
                }
              }
            } catch (error) {
              console.error(
                "Error retrieving or processing store credentials:",
                error,
              );
            }
          }
        }

        // Save regular text message
        const messagedata = {
          senderId: senderID,
          recipientId: recipientID,
          message: messageText,
          messageid: messageId,
          Timestamp: timestamp,
          tenentId: tenentId,
        };

        try {
          const message = await Message.createTextMessage(messagedata);
          console.log("Text message saved:", message);
          const type = "text";
          await sendNewMessage(messagedata, tenentId, type);
        } catch (error) {
          console.error("Error saving message:", error);
        }
      }
    }

    console.log(`🔍 DEBUG: processUserMessage completed successfully`);
  } catch (error) {
    console.error("Error in user message processing:", error);
    throw error;
  }
}

async function processChatflowMessage({
  webhookEvent,
  tenentId,
  userAccessToken,
  senderID,
  recipientID,
  messageText,
  messageId,
  chatflowWelcomePage,
  timestamp,
}) {
  console.log(
    `🔍 DEBUG: Processing chatflow message for NEW USER in tenant ${tenentId}`,
  );

  try {
    // 1. Get user profile information
    let userData = null;
    let retries = 3;
    while (retries > 0 && !userData) {
      try {
        userData = await getUserProfileInformation(senderID, tenentId);
        break;
      } catch (error) {
        retries--;
        if (retries === 0) {
          console.error("Failed to get user profile after multiple attempts");
          userData = { username: "Nil", name: "Nil", profile_pic: null };
        } else {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }
    }

    let userName = userData?.username || "Nil";
    let Name = userData?.name || "Nil";
    let profile_Pic = userData?.profile_pic || null;
    console.log("User data retrieved:", { userName, Name, profile_Pic });

    // 2. Create new user entry
    const senderdata = {
      senderId: senderID,
      username: userName,
      profile_pic: profile_Pic,
      name: Name,
      tenentId: tenentId,
    };

    const newuser = new Newuser(senderdata);
    try {
      const savednewuser = await newuser.save();
      console.log("New user data saved for chatflow:", savednewuser);
      // Send notification about new contact
      await sendNewContact(savednewuser, tenentId, senderID);
    } catch (error) {
      console.error("Error saving new user data:", error);
    }

    // 3. Save the incoming user message
    const userMessageData = {
      senderId: senderID,
      recipientId: recipientID,
      message: messageText,
      messageid: messageId,
      Timestamp: timestamp,
      tenentId: tenentId,
    };

    try {
      await Message.createTextMessage(userMessageData);
      await sendNewMessage(userMessageData, tenentId, "text");
      console.log("User message saved for chatflow");
    } catch (error) {
      console.error("Error saving user message:", error);
    }

    // 4. Send welcome message based on chatflow configuration
    if (chatflowWelcomePage.messageType === "text") {
      console.log(`🔍 DEBUG: Sending text template for chatflow`);

      // Build text template with workflows (buttons)
      const textTemplateData = {
        attachment: {
          type: "template",
          payload: {
            template_type: "button",
            text: chatflowWelcomePage.text || chatflowWelcomePage.body,
            buttons: chatflowWelcomePage.workflows
              .map((workflow) => {
                if (workflow.type === "weburl") {
                  return {
                    type: "web_url",
                    title: workflow.displayTitle || workflow.title,
                    url: workflow.url,
                  };
                } else {
                  return {
                    type: "postback",
                    title: workflow.displayTitle || workflow.title,
                    payload: workflow.payload,
                  };
                }
              })
              .slice(0, 3), // Instagram allows max 3 buttons
          },
        },
      };

      // Send text template
      if (rateLimiter.canMakeSendApiTextCall(tenentId, recipientID, senderID)) {
        await sendInstagramProductTemplateMessage(
          recipientID,
          userAccessToken,
          senderID,
          tenentId,
          textTemplateData,
        );

        // Save the template response
        const templateResponseData = {
          senderId: senderID,
          recipientId: recipientID,
          message: "",
          response: textTemplateData,
          messageid: messageId,
          Timestamp: timestamp + 1000,
          tenentId: tenentId,
        };

        try {
          const message = await Message.createTemplateMessage(
            templateResponseData,
          );
          console.log("Chatflow text template message saved:", message);
          await sendNewMessage(templateResponseData, tenentId, "template");
        } catch (error) {
          console.error("Error saving chatflow template message:", error);
        }
      } else {
        console.log(
          `Rate limit exceeded for Send API (Text) for tenant ${tenentId}, skipping chatflow welcome message`,
        );
      }
    } else if (chatflowWelcomePage.messageType === "carousel") {
      console.log(`🔍 DEBUG: Sending carousel template for chatflow`);

      // Build all carousel elements
      const carouselElements = chatflowWelcomePage.carouselItems
        .map((item) => {
          return {
            title: item.title,
            image_url: item.image,
            subtitle: item.subtitle || "",
            buttons: item.buttons
              .map((button) => {
                if (button.buttonType === "url") {
                  return {
                    type: "web_url",
                    title: button.buttonText,
                    url: button.buttonUrl,
                  };
                } else {
                  return {
                    type: "postback",
                    title: button.buttonText,
                    payload: button.buttonPayload,
                  };
                }
              })
              .slice(0, 3), // Max 3 buttons per carousel item
          };
        })
        .slice(0, 10); // Max 10 carousel items

      // Create the complete carousel template
      const carouselTemplateData = {
        attachment: {
          type: "template",
          payload: {
            template_type: "generic",
            elements: carouselElements,
          },
        },
      };

      // Send carousel template
      if (rateLimiter.canMakeSendApiTextCall(tenentId, recipientID, senderID)) {
        await sendInstagramProductTemplateMessage(
          recipientID,
          userAccessToken,
          senderID,
          tenentId,
          carouselTemplateData,
        );

        // Save the carousel template response
        const carouselResponseData = {
          senderId: senderID,
          recipientId: recipientID,
          message: messageText,
          response: carouselTemplateData,
          messageid: messageId,
          Timestamp: timestamp,
          tenentId: tenentId,
        };

        try {
          const message = await Message.createTemplateMessage(
            carouselResponseData,
          );
          console.log("Chatflow carousel template message saved:", message);
          await sendNewMessage(carouselResponseData, tenentId, "template");
        } catch (error) {
          console.error(
            "Error saving chatflow carousel template message:",
            error,
          );
        }
      } else {
        console.log(
          `Rate limit exceeded for Send API (Text) for tenant ${tenentId}, skipping chatflow carousel message`,
        );
      }
    }

    console.log(`🔍 DEBUG: Chatflow message processing completed for new user`);
  } catch (error) {
    console.error("Error in chatflow message processing:", error);
    throw error;
  }
}

// Support Functions for Message Processing
async function saveMessage(messageData) {
  try {
    const message = await Message.createTextMessage(messageData);
    console.log("Message saved:", message);
    const type = "text";
    await sendNewMessage(messageData, messageData.tenentId, type);
  } catch (error) {
    console.error("Error saving message:", error);
    throw error;
  }
}

async function saveEchoMessage(messageData) {
  try {
    const message = await Message.createTextMessage(messageData);
    console.log("Echo message saved:", message);
    const type = "text";
    await sendNewMessage(messageData, messageData.tenentId, type);
  } catch (error) {
    console.error("Error saving echo message:", error);
    throw error;
  }
}

async function updateUserProfile(userData, senderID, tenentId) {
  // ✅ Add null check
  if (!userData) {
    console.log("No user data provided, skipping profile update");
    return;
  }

  const userProfile = {
    username: userData.username || "Nil",
    name: userData.name || "Nil",
    profile_pic: userData.profile_pic || null,
  };

  try {
    await Newuser.findOneAndUpdate(
      { senderId: senderID, tenentId },
      { $set: userProfile },
      { upsert: true, new: true },
    );
    console.log("Profile updated successfully for user:", senderID);
  } catch (error) {
    console.error("Error updating user profile:", error);
    throw error;
  }
}

// Webhook Verification Route
router.get("/webhook", (req, res) => {
  console.log("Got /webhook");
  let mode = req.query["hub.mode"];
  let token = req.query["hub.verify_token"];
  let challenge = req.query["hub.challenge"];

  if (mode && token) {
    if (mode === "subscribe" && token === config.verifyToken) {
      console.log("WEBHOOK_VERIFIED");
      res.status(200).send(challenge);
    } else {
      res.sendStatus(403);
    }
  } else {
    console.warn("Got /webhook but without needed parameters.");
  }
});

// Main Webhook Handler
router.post("/webhook", async (req, res) => {
  const body = req.body;
  console.log("Received Instagram Webhook:", JSON.stringify(body, null, 2));

  if (body.object === "instagram") {
    // Acknowledge receipt immediately
    res.status(200).send("EVENT_RECEIVED");

    try {
      for (const entry of body.entry) {
        // First, modify your webhook event handler to detect comment events
        if (entry.changes) {
          for (const change of entry.changes) {
            //if (change.field === 'comments' || change.field === 'live_comments') {
            if (change.field === "comments") {
              const commentData = change.value;
              // Find tenant ID
              const igProAccountId = entry.id;
              const accountData = await LongToken.findOne({
                Instagramid: igProAccountId,
              })
                .sort({ createdAt: -1 })
                .limit(1);

              if (!accountData?.tenentId) {
                console.error(
                  "No tenant ID found for account:",
                  igProAccountId,
                );
                continue;
              }

              // Add to message queue for processing

              addToMessageQueue(accountData.tenentId, {
                change,
                commentData: change.value,
                accountId: igProAccountId,
                tenentId: accountData.tenentId, // Add this line to include tenentId
                eventType: "comment",
                time: entry.time,
              });

              console.log("Comment added to queue");
            }
          }
        }
        if (!entry.messaging) {
          console.warn("No messaging field in entry");
          continue;
        }

        for (const webhookEvent of entry.messaging) {
          const recipientID = webhookEvent.recipient.id;
          const messageId = webhookEvent.message?.mid;
          const timestamp = webhookEvent.timestamp;
          const senderID = webhookEvent.sender.id;
          let tenentId;
          if (webhookEvent.message?.is_echo) {
            const IdData = await LongToken.findOne({ Instagramid: senderID })
              .sort({ createdAt: -1 })
              .limit(1);
            console.log("tenentid for is_echo", IdData);
            if (!IdData?.tenentId) {
              console.error("No tenant ID found");
              continue;
            }
            tenentId = IdData.tenentId;
          } else {
            const IdData = await LongToken.findOne({ Instagramid: recipientID })
              .sort({ createdAt: -1 })
              .limit(1);

            if (!IdData?.tenentId) {
              console.error("No tenant ID found");
              continue;
            }

            tenentId = IdData.tenentId;
          }

          // Handle postback events
          if (webhookEvent.postback) {
            addToMessageQueue(tenentId, {
              ...webhookEvent,
              eventType: "postback",
            });
          }

          // Handle quick reply events
          if (webhookEvent.message?.quick_reply) {
            addToMessageQueue(tenentId, {
              ...webhookEvent,
              eventType: "quick_reply",
            });
          }
          if (
            webhookEvent.message?.attachments?.some(
              (att) => att.type === "audio",
            )
          ) {
            addToMessageQueue(tenentId, {
              ...webhookEvent,
              eventType: "audio",
            });
          }
          if (
            webhookEvent.message?.attachments?.some(
              (att) => att.type === "image",
            )
          ) {
            // Add to message queue for processing
            addToMessageQueue(tenentId, {
              ...webhookEvent,
              eventType: "image",
            });
            console.log("image message");
          }

          if (
            webhookEvent.message?.attachments?.some(
              (att) => att.type === "video",
            )
          ) {
            // Add to message queue for processing
            addToMessageQueue(tenentId, {
              ...webhookEvent,
              eventType: "video",
            });
            console.log("video message");
          }
          if (
            webhookEvent.message?.attachments?.some(
              (att) => att.type === "ig_reel",
            )
          ) {
            // Add to message queue for processing
            addToMessageQueue(tenentId, {
              ...webhookEvent,
              eventType: "ig_reel",
            });
            console.log("Reels message");
          }
          if (webhookEvent.message?.reply_to?.story?.id) {
            // Add to message queue for processing
            addToMessageQueue(tenentId, {
              ...webhookEvent,
              eventType: "ig_story_reply",
            });
            console.log("Story reply message");
          }

          // Handle message events
          if (webhookEvent.message) {
            const messageId = webhookEvent.message.mid;
            const messageText = webhookEvent.message?.text;
            const is_deleted = webhookEvent.message?.is_deleted;
            if (is_deleted === true) {
              addToMessageQueue(tenentId, {
                ...webhookEvent,
                eventType: "deleted_message",
              });
              return;
            }
            if (webhookEvent.message?.reply_to?.story?.id) {
              return;
            }

            // Handle echo messages

            // Skip if already processed
            if (messageId && processedMessages.has(messageId)) {
              console.log(`Message ${messageId} already processed`);
              continue;
            }

            // Mark as processed
            processedMessages.add(messageId);

            // Get tenant ID
            const recipientID = webhookEvent.recipient.id;

            if (
              webhookEvent.object === "instagram" &&
              webhookEvent.entry[0].messaging &&
              webhookEvent.entry[0].messaging[0].message &&
              webhookEvent.entry[0].messaging[0].message.attachments &&
              webhookEvent.entry[0].messaging[0].message.attachments[0].type ===
                "audio"
            ) {
              await handleInstagramAudioMessage(webhookEvent);
            }
            // Add to processing queue
            if (webhookEvent.message.text) {
              addToMessageQueue(tenentId, {
                ...webhookEvent,
                eventType: "message",
              });
            }
          }
        }
      }
    } catch (error) {
      console.error("Error processing webhook:", error);
    }
  } else {
    console.warn("Unrecognized event type");
    res.sendStatus(404);
  }
});
async function saveAudioFile(audioBuffer, tenentId) {
  try {
    const uploadsDir = path.join(__dirname, "uploads", "audio", tenentId);

    // Create directory recursively using fs.mkdirSync
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const fileName = `voice_${Date.now()}.mp3`;
    const filePath = path.join(uploadsDir, fileName);

    // Write file using fs promises
    await fsPromises.writeFile(filePath, audioBuffer);

    return filePath;
  } catch (error) {
    console.error("Error saving audio file:", error);
    throw error;
  }
}
async function handleVoiceMessage(
  audioBuffer,
  tenentId,
  senderID,
  audiomessagetype,
) {
  const latestMainMode = await Mainmode.findOne({ tenentId }).sort({
    createdAt: -1,
  });

  const currentMainMode = latestMainMode?.mainmode || "offline";

  try {
    // Create FormData
    const formData = new FormData();

    // Convert buffer to readable stream (no file saving needed)
    const audioStream = streamifier.createReadStream(audioBuffer);

    formData.append("file", audioStream, {
      filename: "voice.mp3",
      contentType: "audio/mpeg",
    });

    formData.append("model", "whisper-1");

    // Send to OpenAI Whisper
    const transcriptionResponse = await axios.post(
      "https://api.openai.com/v1/audio/transcriptions",
      formData,
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          ...formData.getHeaders(), // Now this will work with proper FormData
        },
      },
    );

    const transcribedText = transcriptionResponse.data.text;
    console.log("transcribedText", transcribedText);

    // Handle based on main mode
    if (currentMainMode !== "online") {
      if (audiomessagetype === "response") {
        return { transcription: transcribedText };
      } else {
        const response = await getGptResponse(
          transcribedText,
          tenentId,
          senderID,
        );
        console.log("response", response);
        return {
          transcription: transcribedText,
          response: response,
        };
      }
    } else {
      return { transcription: transcribedText };
    }
  } catch (error) {
    console.error("Error processing voice message:", error);
    throw error;
  }
}
async function handleInstagramAudioMessage(webhookEvent) {
  try {
    const senderID = webhookEvent.sender.id;
    const recipientID = webhookEvent.recipient.id;
    const messageId = webhookEvent.message?.mid;
    const timestamp = webhookEvent.timestamp;
    const audioUrl = webhookEvent.message.attachments[0]?.payload?.url;

    if (!audioUrl) {
      console.error("No audio URL found in webhook event:", webhookEvent);
      throw new Error("Audio URL not found in message attachments");
    }

    if (webhookEvent.message?.is_echo) {
      // ── ECHO (outgoing) branch ────────────────────────────────────────────
      const latestToken = await LongToken.findOne({ Instagramid: senderID })
        .sort({ createdAt: -1 })
        .limit(1);

      if (!latestToken) {
        throw new Error("No token found for recipient");
      }

      const tenentId = latestToken.tenentId;
      const userAccessToken = latestToken.userAccessToken;
      const latestMainMode = await Mainmode.findOne({ tenentId }).sort({
        createdAt: -1,
      });

      const userData = await getUserProfileInformation(recipientID, tenentId);
      let userName = userData.username;
      if (!userData.username) {
        userName = "Nil";
      }
      let Name = userData.name;
      if (!Name) {
        Name = "Nil";
      }
      let profile_Pic = userData.profile_pic;
      if (!userData.profile_pic) {
        profile_Pic = null;
      }
      console.log("saved username", userName);

      const userid = await Newuser.findOne({
        senderId: recipientID,
        tenentId: tenentId,
      })
        .sort({ createdAt: -1 })
        .limit(1);

      if (userid) {
        console.log("SenderID already exists");
        await updateUserProfile(userData, recipientID, tenentId);
      } else {
        console.log("SenderID does not exist");
        const senderdata = {
          senderId: recipientID,
          username: userName,
          profile_pic: profile_Pic,
          name: Name,
          tenentId: tenentId,
        };
        const newuser = new Newuser(senderdata);
        try {
          const savednewuser = await newuser.save();
          console.log("User data saved:", savednewuser);
          await sendNewContact(savednewuser, tenentId, recipientID);
        } catch (error) {
          console.error("Error saving user data:", error);
        }
      }

      const messagetype = "audio";
      console.log("messagetype", messagetype);
      console.log("audioUrl", audioUrl);

      const audiomessagedata = {
        senderId: recipientID,
        recipientId: senderID,
        messageType: messagetype,
        audioUrl: audioUrl,
        response: "Audio message",
        messageid: messageId,
        Timestamp: timestamp,
        tenentId: tenentId,
      };

      try {
        const message = await Message.createAudioMessage(audiomessagedata);
        console.log("Message data our saved:", message);
        const type = "audio";
        await sendNewMessage(audiomessagedata, tenentId, type);
      } catch (error) {
        console.error("Error Message user data:", error);
      }
    } else {
      // ── INCOMING (regular) branch ─────────────────────────────────────────
      const latestToken = await LongToken.findOne({ Instagramid: recipientID })
        .sort({ createdAt: -1 })
        .limit(1);

      if (!latestToken) {
        throw new Error("No token found for recipient");
      }

      const tenentId = latestToken.tenentId;
      const userAccessToken = latestToken.userAccessToken;
      const latestMainMode = await Mainmode.findOne({ tenentId }).sort({
        createdAt: -1,
      });

      const userData = await getUserProfileInformation(senderID, tenentId);
      let userName = userData.username;
      if (!userData.username) {
        userName = "Nil";
      }
      let Name = userData.name;
      if (!Name) {
        Name = "Nil";
      }
      let profile_Pic = userData.profile_pic;
      if (!userData.profile_pic) {
        profile_Pic = null;
      }
      console.log("saved username", userName);

      const userid = await Newuser.findOne({
        senderId: senderID,
        tenentId: tenentId,
      })
        .sort({ createdAt: -1 })
        .limit(1);

      if (userid) {
        console.log("SenderID already exists");
        await updateUserProfile(userData, senderID, tenentId);
      } else {
        console.log("SenderID does not exist");
        const senderdata = {
          senderId: senderID,
          username: userName,
          profile_pic: profile_Pic,
          name: Name,
          tenentId: tenentId,
        };
        const newuser = new Newuser(senderdata);
        try {
          const savednewuser = await newuser.save();
          console.log("User data saved:", savednewuser);
          await sendNewContact(savednewuser, tenentId, senderID);
        } catch (error) {
          console.error("Error saving user data:", error);
        }

        // ── processChatflowMessage for new users ────────────────────────────
        const chatflowWelcomePage = await ChatflowWelcomePage.findOne({
          tenentId: tenentId,
        })
          .sort({ createdAt: -1 })
          .limit(1);

        if (chatflowWelcomePage) {
          console.log(
            `🔍 DEBUG: ChatflowWelcomePage found for new user in tenant ${tenentId}, executing chatflow logic...`,
          );
          await processChatflowMessage({
            webhookEvent,
            tenentId,
            userAccessToken,
            senderID,
            recipientID,
            messageText: audioUrl,
            messageId,
            chatflowWelcomePage,
            timestamp,
          });
          return; // Exit early after processing chatflow for new user
        }
        // ───────────────────────────────────────────────────────────────────
      }

      const currentMainMode = latestMainMode?.mainmode || "offline";

      // Download the audio file from Instagram
      const audioResponse = await axios({
        method: "get",
        url: audioUrl,
        responseType: "arraybuffer",
      });

      // Convert to buffer
      const audioBuffer = Buffer.from(audioResponse.data);

      if (currentMainMode !== "online") {
        const latestMode = await Mode.findOne({
          senderId: senderID,
          tenentId,
        }).sort({ createdAt: -1 });
        const currentMode = latestMode?.mode || "chat";

        if (currentMode !== "human") {
          let audiomessagetype = "message";
          const result = await handleVoiceMessage(
            audioBuffer,
            tenentId,
            senderID,
            audiomessagetype,
          );

          if (result && result.response) {
            const response = await sendInstagramMessage(
              recipientID,
              userAccessToken,
              senderID,
              result.response,
            );

            const messagetype = "audio";
            console.log("messagetype", messagetype);
            console.log("audioUrl", audioUrl);

            const audiomessagedata = {
              senderId: senderID,
              recipientId: recipientID,
              messageType: messagetype,
              audioUrl: audioUrl,
              transcription: result.transcription,
              message: "Audio message",
              messageid: messageId,
              Timestamp: timestamp,
              tenentId: tenentId,
            };

            try {
              const message = await Message.createAudioMessage(
                audiomessagedata,
              );
              console.log("Message data our saved:", message);
              const type = "audio";
              await sendNewMessage(audiomessagedata, tenentId, type);
            } catch (error) {
              console.error("Error Message user data:", error);
            }
          }
        } else {
          // human mode
          const messagetype = "audio";
          console.log("messagetype", messagetype);
          console.log("audioUrl", audioUrl);

          const audiomessagedata = {
            senderId: senderID,
            recipientId: recipientID,
            messageType: messagetype,
            audioUrl: audioUrl,
            message: "Audio message",
            messageid: messageId,
            Timestamp: timestamp,
            tenentId: tenentId,
          };

          try {
            const message = await Message.createAudioMessage(audiomessagedata);
            console.log("Message data our saved:", message);
            const type = "audio";
            await sendNewMessage(audiomessagedata, tenentId, type);
          } catch (error) {
            console.error("Error Message user data:", error);
          }
        }
      } else {
        // online mode
        const messagetype = "audio";
        const audiomessagedata = {
          senderId: senderID,
          recipientId: recipientID,
          messageType: messagetype,
          audioUrl: audioUrl,
          message: "Audio message",
          messageid: messageId,
          Timestamp: timestamp,
          tenentId: tenentId,
        };

        try {
          const message = await Message.createAudioMessage(audiomessagedata);
          const type = "audio";
          await sendNewMessage(audiomessagedata, tenentId, type);
          console.log("Message data our saved:", message);
        } catch (error) {
          console.error("Error Message user data:", error);
        }
      }
    }
  } catch (error) {
    console.error("Error handling Instagram audio message:", error);
    throw error;
  }
}
async function handleDeletedMessage(eventData) {
  try {
    const messageId = eventData.message.mid;
    //const tenentId = eventData.tenentId;
    const recipientID = eventData.recipient.id;
    const deletedMessage = "This message is deleted";
    const latestToken = await LongToken.findOne({ Instagramid: recipientID })
      .sort({ createdAt: -1 })
      .limit(1);

    if (!latestToken) {
      throw new Error("No token found for recipient");
    }

    const tenentId = latestToken.tenentId;
    const updateResult = await Message.findOneAndUpdate(
      { messageid: messageId, tenentId: tenentId },
      { $set: { message: deletedMessage } },
      { new: true },
    );

    console.log("Message marked as deleted in queue:", updateResult);
  } catch (error) {
    console.error("Error handling deleted message:", error);
    throw error;
  }
}

async function handleimageMessage(webhookEvent) {
  try {
    const senderID = webhookEvent.sender.id;
    const recipientID = webhookEvent.recipient.id;
    const messageId = webhookEvent.message?.mid;
    const timestamp = webhookEvent.timestamp;
    console.log("text sender id", senderID);

    let tenentId;

    for (const attachment of webhookEvent.message.attachments) {
      if (attachment.type === "image") {
        const imageUrl = attachment.payload.url;
        console.log(`Received Image Message from ${senderID}: ${imageUrl}`);

        if (webhookEvent.message?.is_echo) {
          // ── ECHO (outgoing) branch ──────────────────────────────────────────
          const IdData = await LongToken.findOne({ Instagramid: senderID })
            .sort({ createdAt: -1 })
            .limit(1);

          if (!IdData?.tenentId) {
            console.error("No tenant ID found for senderID:", senderID);
            return;
          }

          tenentId = IdData.tenentId;

          const userData = await getUserProfileInformation(
            recipientID,
            tenentId,
          );
          let userName = userData.username;
          if (!userData.username) {
            userName = "Nil";
          }
          let Name = userData.name;
          if (!Name) {
            Name = "Nil";
          }
          let profile_Pic = userData.profile_pic;
          if (!userData.profile_pic) {
            profile_Pic = null;
          }
          console.log("saved username", userName);

          const userid = await Newuser.findOne({
            senderId: recipientID,
            tenentId: tenentId,
          })
            .sort({ createdAt: -1 })
            .limit(1);

          if (userid) {
            console.log("SenderID already exists");
            await updateUserProfile(userData, recipientID, tenentId);
          } else {
            console.log("SenderID does not exist");
            const senderdata = {
              senderId: recipientID,
              username: userName,
              profile_pic: profile_Pic,
              name: Name,
              tenentId: tenentId,
            };
            const newuser = new Newuser(senderdata);
            try {
              const savednewuser = await newuser.save();
              console.log("User data saved:", savednewuser);
              await sendNewContact(savednewuser, tenentId, recipientID);
            } catch (error) {
              console.error("Error saving user data:", error);
            }
          }

          const savedImage = await Message.createImageMessage({
            senderId: recipientID,
            recipientId: senderID,
            messageid: messageId,
            response: imageUrl,
            timestamp,
            tenentId,
          });

          console.log("Image message saved:", savedImage);
          const type = "image";
          await sendNewMessage(savedImage, tenentId, type);
        } else {
          // ── INCOMING (regular) branch ───────────────────────────────────────
          const IdData = await LongToken.findOne({ Instagramid: recipientID })
            .sort({ createdAt: -1 })
            .limit(1);

          if (!IdData?.tenentId) {
            console.error("No tenant ID found for recipient:", recipientID);
            return;
          }

          tenentId = IdData.tenentId;

          const userData = await getUserProfileInformation(senderID, tenentId);
          let userName = userData.username;
          if (!userData.username) {
            userName = "Nil";
          }
          let Name = userData.name;
          if (!Name) {
            Name = "Nil";
          }
          let profile_Pic = userData.profile_pic;
          if (!userData.profile_pic) {
            profile_Pic = null;
          }
          console.log("saved username", userName);

          const userid = await Newuser.findOne({
            senderId: senderID,
            tenentId: tenentId,
          })
            .sort({ createdAt: -1 })
            .limit(1);

          if (userid) {
            console.log("SenderID already exists");
            await updateUserProfile(userData, senderID, tenentId);
          } else {
            console.log("SenderID does not exist");
            const senderdata = {
              senderId: senderID,
              username: userName,
              profile_pic: profile_Pic,
              name: Name,
              tenentId: tenentId,
            };
            const newuser = new Newuser(senderdata);
            try {
              const savednewuser = await newuser.save();
              console.log("User data saved:", savednewuser);
              await sendNewContact(savednewuser, tenentId, senderID);
            } catch (error) {
              console.error("Error saving user data:", error);
            }

            // ── processChatflowMessage for new users ──────────────────────────
            const chatflowWelcomePage = await ChatflowWelcomePage.findOne({
              tenentId: tenentId,
            })
              .sort({ createdAt: -1 })
              .limit(1);

            if (chatflowWelcomePage) {
              console.log(
                `🔍 DEBUG: ChatflowWelcomePage found for new user in tenant ${tenentId}, executing chatflow logic...`,
              );
              await processChatflowMessage({
                webhookEvent,
                tenentId,
                userAccessToken: IdData.accessToken,
                senderID,
                recipientID,
                messageText: imageUrl,
                messageId,
                chatflowWelcomePage,
                timestamp,
              });
              return; // Exit early after processing chatflow for new user
            }
            // ─────────────────────────────────────────────────────────────────
          }

          const savedImage = await Message.createImageMessage({
            senderId: senderID,
            recipientId: recipientID,
            messageid: messageId,
            message: imageUrl,
            timestamp,
            tenentId,
          });

          console.log("Image message saved:", savedImage);
          const type = "image";
          await sendNewMessage(savedImage, tenentId, type);
        }

        return;
      }
    }
  } catch (error) {
    console.error("Error handling image message:", error);
    throw error;
  }
}

async function handlevideoMessage(webhookEvent) {
  try {
    const senderID = webhookEvent.sender.id;
    const recipientID = webhookEvent.recipient.id;
    const messageId = webhookEvent.message?.mid;
    const timestamp = webhookEvent.timestamp;
    console.log("text sender id", senderID);

    let tenentId;

    for (const attachment of webhookEvent.message.attachments) {
      if (attachment.type === "video") {
        const videoUrl = attachment.payload.url;
        console.log(`Received Video Message from ${senderID}: ${videoUrl}`);

        if (webhookEvent.message?.is_echo) {
          // ── ECHO (outgoing) branch ──────────────────────────────────────────
          const IdData = await LongToken.findOne({ Instagramid: senderID })
            .sort({ createdAt: -1 })
            .limit(1);

          if (!IdData?.tenentId) {
            console.error("No tenant ID found for senderID:", senderID);
            return;
          }

          tenentId = IdData.tenentId;

          const userData = await getUserProfileInformation(
            recipientID,
            tenentId,
          );
          let userName = userData.username;
          if (!userData.username) {
            userName = "Nil";
          }
          let Name = userData.name;
          if (!Name) {
            Name = "Nil";
          }
          let profile_Pic = userData.profile_pic;
          if (!userData.profile_pic) {
            profile_Pic = null;
          }
          console.log("saved username", userName);

          const userid = await Newuser.findOne({
            senderId: recipientID,
            tenentId: tenentId,
          })
            .sort({ createdAt: -1 })
            .limit(1);

          if (userid) {
            console.log("SenderID already exists");
            await updateUserProfile(userData, recipientID, tenentId);
          } else {
            console.log("SenderID does not exist");
            const senderdata = {
              senderId: recipientID,
              username: userName,
              profile_pic: profile_Pic,
              name: Name,
              tenentId: tenentId,
            };
            const newuser = new Newuser(senderdata);
            try {
              const savednewuser = await newuser.save();
              console.log("User data saved:", savednewuser);
              await sendNewContact(savednewuser, tenentId, recipientID);
            } catch (error) {
              console.error("Error saving user data:", error);
            }
          }

          const savedvideo = await Message.createVideoMessage({
            senderId: recipientID,
            recipientId: senderID,
            messageid: messageId,
            response: videoUrl,
            timestamp,
            tenentId,
          });

          console.log("Video message saved:", savedvideo);
          const type = "video";
          await sendNewMessage(savedvideo, tenentId, type);
        } else {
          // ── INCOMING (regular) branch ───────────────────────────────────────
          const IdData = await LongToken.findOne({ Instagramid: recipientID })
            .sort({ createdAt: -1 })
            .limit(1);

          if (!IdData?.tenentId) {
            console.error("No tenant ID found for recipient:", recipientID);
            return;
          }

          tenentId = IdData.tenentId;

          const userData = await getUserProfileInformation(senderID, tenentId);
          let userName = userData.username;
          if (!userData.username) {
            userName = "Nil";
          }
          let Name = userData.name;
          if (!Name) {
            Name = "Nil";
          }
          let profile_Pic = userData.profile_pic;
          if (!userData.profile_pic) {
            profile_Pic = null;
          }
          console.log("saved username", userName);

          const userid = await Newuser.findOne({
            senderId: senderID,
            tenentId: tenentId,
          })
            .sort({ createdAt: -1 })
            .limit(1);

          if (userid) {
            console.log("SenderID already exists");
            await updateUserProfile(userData, senderID, tenentId);
          } else {
            console.log("SenderID does not exist");
            const senderdata = {
              senderId: senderID,
              username: userName,
              profile_pic: profile_Pic,
              name: Name,
              tenentId: tenentId,
            };
            const newuser = new Newuser(senderdata);
            try {
              const savednewuser = await newuser.save();
              console.log("User data saved:", savednewuser);
              await sendNewContact(savednewuser, tenentId, senderID);
            } catch (error) {
              console.error("Error saving user data:", error);
            }

            // ── processChatflowMessage for new users ──────────────────────────
            const chatflowWelcomePage = await ChatflowWelcomePage.findOne({
              tenentId: tenentId,
            })
              .sort({ createdAt: -1 })
              .limit(1);

            if (chatflowWelcomePage) {
              console.log(
                `🔍 DEBUG: ChatflowWelcomePage found for new user in tenant ${tenentId}, executing chatflow logic...`,
              );
              await processChatflowMessage({
                webhookEvent,
                tenentId,
                userAccessToken: IdData.accessToken,
                senderID,
                recipientID,
                messageText: videoUrl,
                messageId,
                chatflowWelcomePage,
                timestamp,
              });
              return; // Exit early after processing chatflow for new user
            }
            // ─────────────────────────────────────────────────────────────────
          }

          const savedvideo = await Message.createVideoMessage({
            senderId: senderID,
            recipientId: recipientID,
            messageid: messageId,
            message: videoUrl,
            timestamp,
            tenentId,
          });

          console.log("Video message saved:", savedvideo);
          const type = "video";
          await sendNewMessage(savedvideo, tenentId, type);
        }

        return;
      }
    }
  } catch (error) {
    console.error("Error handling deleted message:", error);
    throw error;
  }
}
async function handleigreelMessage(webhookEvent) {
  try {
    const senderID = webhookEvent.sender.id;
    const recipientID = webhookEvent.recipient.id;
    const messageId = webhookEvent.message?.mid;
    const timestamp = webhookEvent.timestamp;
    console.log("text sender id", senderID);

    let tenentId;

    for (const attachment of webhookEvent.message.attachments) {
      if (attachment.type === "ig_reel") {
        const igreelUrl = attachment.payload.url;
        const ig_reel_message = "Instagram Reel";

        if (webhookEvent.message?.is_echo) {
          // ── ECHO (outgoing) branch ──────────────────────────────────────────
          const IdData = await LongToken.findOne({ Instagramid: senderID })
            .sort({ createdAt: -1 })
            .limit(1);

          if (!IdData?.tenentId) {
            console.error("No tenant ID found for senderID:", senderID);
            return;
          }

          tenentId = IdData.tenentId;

          const latestMainMode = await Mainmode.findOne({ tenentId }).sort({
            createdAt: -1,
          });
          console.log("latestMainMode", latestMainMode);
          let currentMainMode = latestMainMode?.mainmode || "offline";

          const userData = await getUserProfileInformation(
            recipientID,
            tenentId,
          );
          let userName = userData.username;
          if (!userData.username) {
            userName = "Nil";
          }
          let Name = userData.name;
          if (!Name) {
            Name = "Nil";
          }
          let profile_Pic = userData.profile_pic;
          if (!userData.profile_pic) {
            profile_Pic = null;
          }
          console.log("saved username", userName);

          const userid = await Newuser.findOne({
            senderId: recipientID,
            tenentId: tenentId,
          })
            .sort({ createdAt: -1 })
            .limit(1);

          if (userid) {
            console.log("SenderID already exists");
            await updateUserProfile(userData, recipientID, tenentId);
          } else {
            console.log("SenderID does not exist");
            const senderdata = {
              senderId: recipientID,
              username: userName,
              profile_pic: profile_Pic,
              name: Name,
              tenentId: tenentId,
            };
            const newuser = new Newuser(senderdata);
            try {
              const savednewuser = await newuser.save();
              console.log("User data saved:", savednewuser);
              await sendNewContact(savednewuser, tenentId, recipientID);
            } catch (error) {
              console.error("Error saving user data:", error);
            }
          }

          const savedigreel = await Message.createIgReelMessage({
            senderId: recipientID,
            recipientId: senderID,
            messageid: messageId,
            response: ig_reel_message,
            igreelUrl: igreelUrl,
            timestamp,
            tenentId,
          });

          console.log("IG Reels message saved:", savedigreel);
          const type = "ig_reel";
          await sendNewMessage(savedigreel, tenentId, type);
        } else {
          // ── INCOMING (regular) branch ───────────────────────────────────────
          const IdData = await LongToken.findOne({ Instagramid: recipientID })
            .sort({ createdAt: -1 })
            .limit(1);

          if (!IdData?.tenentId) {
            console.error("No tenant ID found for recipient:", recipientID);
            return;
          }

          tenentId = IdData.tenentId;
          const userAccessToken = IdData.userAccessToken;

          const latestMainMode = await Mainmode.findOne({ tenentId }).sort({
            createdAt: -1,
          });
          console.log("latestMainMode", latestMainMode);
          let currentMainMode = latestMainMode?.mainmode || "offline";

          const userData = await getUserProfileInformation(senderID, tenentId);
          let userName = userData.username;
          if (!userData.username) {
            userName = "Nil";
          }
          let Name = userData.name;
          if (!Name) {
            Name = "Nil";
          }
          let profile_Pic = userData.profile_pic;
          if (!userData.profile_pic) {
            profile_Pic = null;
          }
          console.log("saved username", userName);

          const userid = await Newuser.findOne({
            senderId: senderID,
            tenentId: tenentId,
          })
            .sort({ createdAt: -1 })
            .limit(1);

          if (userid) {
            console.log("SenderID already exists");
            await updateUserProfile(userData, senderID, tenentId);

            const savedigreel = await Message.createIgReelMessage({
              senderId: senderID,
              recipientId: recipientID,
              messageid: messageId,
              message: ig_reel_message,
              igreelUrl: igreelUrl,
              timestamp,
              tenentId,
            });

            console.log("IG Reel message saved:", savedigreel);
            const type = "ig_reel";
            await sendNewMessage(savedigreel, tenentId, type);
          } else {
            console.log("SenderID does not exist");
            const senderdata = {
              senderId: senderID,
              username: userName,
              profile_pic: profile_Pic,
              name: Name,
              tenentId: tenentId,
            };
            const newuser = new Newuser(senderdata);
            try {
              const savednewuser = await newuser.save();
              console.log("User data saved:", savednewuser);
              await sendNewContact(savednewuser, tenentId, senderID);

              const savedigreel = await Message.createIgReelMessage({
                senderId: senderID,
                recipientId: recipientID,
                messageid: messageId,
                message: ig_reel_message,
                igreelUrl: igreelUrl,
                timestamp,
                tenentId,
              });

              console.log("IG Reel message saved:", savedigreel);
              const type = "ig_reel";
              await sendNewMessage(savedigreel, tenentId, type);

              // ── processChatflowMessage for new users ────────────────────────
              const chatflowWelcomePage = await ChatflowWelcomePage.findOne({
                tenentId: tenentId,
              })
                .sort({ createdAt: -1 })
                .limit(1);

              if (chatflowWelcomePage) {
                console.log(
                  `🔍 DEBUG: ChatflowWelcomePage found for new user in tenant ${tenentId}, executing chatflow logic...`,
                );
                await processChatflowMessage({
                  webhookEvent,
                  tenentId,
                  userAccessToken,
                  senderID,
                  recipientID,
                  messageText: igreelUrl,
                  messageId,
                  chatflowWelcomePage,
                  timestamp,
                });
                return; // Exit early after processing chatflow for new user
              }
              // ───────────────────────────────────────────────────────────────

              // Fallback: handle welcome message if no chatflow and mode is not online
              if (currentMainMode !== "online") {
                handlewelcomeMessage(
                  recipientID,
                  userAccessToken,
                  senderID,
                  tenentId,
                  timestamp,
                );
              }
            } catch (error) {
              console.error("Error saving user data:", error);
            }
          }
        }

        return;
      }
    }
  } catch (error) {
    console.error("Error handling deleted message:", error);
    throw error;
  }
}

async function handleig_story_replyMessage(webhookEvent) {
  try {
    const senderID = webhookEvent.sender.id;
    const recipientID = webhookEvent.recipient.id;
    const timestamp = webhookEvent.timestamp;
    const messageId = webhookEvent.message?.mid;
    const storyUrl = webhookEvent.message?.reply_to?.story?.url;
    const messageText = webhookEvent.message?.text || "";
    const formattedMessage = `Instagram Story\n\n Message: ${messageText}`;

    if (!storyUrl) {
      console.error("No story URL found in webhook event");
      return;
    }

    // ── ECHO (outgoing) branch ──────────────────────────────────────────────
    if (webhookEvent.message?.is_echo) {
      const IdData = await LongToken.findOne({ Instagramid: senderID })
        .sort({ createdAt: -1 })
        .limit(1);

      if (!IdData?.tenentId) {
        console.error("No tenant ID found for senderID:", senderID);
        return;
      }

      tenentId = IdData.tenentId;

      const userData = await getUserProfileInformation(recipientID, tenentId);
      let userName = userData.username;
      if (!userData.username) {
        userName = "Nil";
      }
      let Name = userData.name;
      if (!Name) {
        Name = "Nil";
      }
      let profile_Pic = userData.profile_pic;
      if (!userData.profile_pic) {
        profile_Pic = null;
      }
      console.log("saved username", userName);

      const userid = await Newuser.findOne({
        senderId: recipientID,
        tenentId: tenentId,
      })
        .sort({ createdAt: -1 })
        .limit(1);

      if (userid) {
        console.log("SenderID already exists");
        await updateUserProfile(userData, recipientID, tenentId);
      } else {
        console.log("SenderID does not exist");
        const senderdata = {
          senderId: recipientID,
          username: userName,
          profile_pic: profile_Pic,
          name: Name,
          tenentId: tenentId,
        };
        const newuser = new Newuser(senderdata);
        try {
          const savednewuser = await newuser.save();
          console.log("User data saved:", savednewuser);
          await sendNewContact(savednewuser, tenentId, recipientID);
        } catch (error) {
          console.error("Error saving user data:", error);
        }
      }

      const savedigstory = await Message.createIgStroyMessage({
        senderId: recipientID,
        recipientId: senderID,
        messageid: messageId,
        response: formattedMessage,
        igreelUrl: storyUrl,
        timestamp,
        tenentId,
      });

      console.log("IG story message saved:", savedigstory);
      const type = "ig_reel";
      await sendNewMessage(savedigstory, tenentId, type);

      return; // Exit after echo handling
    }

    // ── INCOMING (regular) branch ───────────────────────────────────────────
    const IdData = await LongToken.findOne({ Instagramid: recipientID })
      .sort({ createdAt: -1 })
      .limit(1);

    if (!IdData?.tenentId) {
      console.error("No tenant ID found for recipient:", recipientID);
      return;
    }

    const tenentId = IdData.tenentId;

    if (!IdData?.userAccessToken) {
      console.error("No userAccessToken found for recipient:", recipientID);
      return;
    }

    const userAccessToken = IdData.userAccessToken;

    // ── User management ─────────────────────────────────────────────────────
    const userData = await getUserProfileInformation(senderID, tenentId);
    const userName = userData?.username || `user_${senderID}`;

    const existingUser = await StoryCommentNewuser.findOne({
      senderId: senderID,
      tenentId,
    });

    if (existingUser) {
      console.log("SenderID already exists in story comment users");
    } else {
      console.log(
        "SenderID does not exist in story comment users, creating new user.",
      );

      try {
        const newStoryUser = new StoryCommentNewuser({
          senderId: senderID,
          username: userName,
          name: userData?.name || "N/A",
          tenentId,
        });
        await newStoryUser.save();
        console.log("Story comment user data saved.");
      } catch (error) {
        console.error("Error saving story comment user data:", error);
      }

      const existingNewUser = await Newuser.findOne({
        senderId: senderID,
        tenentId,
      })
        .sort({ createdAt: -1 })
        .limit(1);

      if (existingNewUser) {
        console.log("SenderID already exists in comment users");
        await updateUserProfile(userData, senderID, tenentId);
      } else {
        const senderdata1 = {
          senderId: senderID,
          username: userName,
          name: userData?.name,
          profile_pic: null,
          tenentId,
        };

        try {
          const newUser1 = new Newuser(senderdata1);
          const savedNewUser1 = await newUser1.save();
          console.log("User data saved:", savedNewUser1);
          await sendNewContact(savedNewUser1, tenentId, senderID);
        } catch (error) {
          console.error("Error saving user data:", error);
        }

        // ── processChatflowMessage for new users ──────────────────────────
        const chatflowWelcomePage = await ChatflowWelcomePage.findOne({
          tenentId: tenentId,
        })
          .sort({ createdAt: -1 })
          .limit(1);

        if (chatflowWelcomePage) {
          console.log(
            `🔍 DEBUG: ChatflowWelcomePage found for new user in tenant ${tenentId}, executing chatflow logic...`,
          );
          await processChatflowMessage({
            webhookEvent,
            tenentId,
            userAccessToken,
            senderID,
            recipientID,
            messageText: messageText || storyUrl,
            messageId,
            chatflowWelcomePage,
            timestamp,
          });
          return; // Exit early after processing chatflow for new user
        }
        // ─────────────────────────────────────────────────────────────────
      }
    }

    // ── Automation rule logic ────────────────────────────────────────────────
    const matchingRules = await StoryCommentAutomationRule.find({ tenentId });
    const matchedRule = findMatchingRule(matchingRules, messageText);

    // If no rule matches, process as a regular message and exit
    if (!matchedRule) {
      console.log(
        "No matching story automation rule found. Processing as regular message.",
      );
      return await processUserMessage({
        webhookEvent,
        tenentId,
        userAccessToken,
        senderID,
        recipientID,
        messageText,
        messageId,
      });
    }

    console.log(`Matched story automation rule: ${matchedRule.ruleId}`);
    const { ruleType } = matchedRule;

    // ── Execute automation and save conversation ─────────────────────────────
    if (ruleType === "text") {
      const replyText = matchedRule.replyText;
      console.log(`Executing 'text' rule. Replying with: "${replyText}"`);

      await sendInstagramStoryTextMessage(
        recipientID,
        senderID,
        userAccessToken,
        replyText,
        tenentId,
        messageId,
        formattedMessage,
      );

      const messageData = {
        senderId: senderID,
        username: userName,
        recipientId: recipientID,
        message: messageText,
        response: replyText,
        messageid: messageId,
        Timestamp: timestamp,
        ruleId: matchedRule.ruleId,
        tenentId,
      };

      console.log("ruleId for story", matchedRule.ruleId);
      await StoryComment.createStoryCommentMessage(messageData);
      console.log(
        "Automated story reply (text) saved to StoryComment collection.",
      );
    } else if (ruleType === "template") {
      const templateItems = matchedRule.templateItems || [];

      if (templateItems.length > 0) {
        console.log(
          `Executing 'template' rule with ${templateItems.length} items.`,
        );

        const elements = templateItems.map((item) => ({
          title: item.title,
          image_url: item.image,
          subtitle: item.subtitle,
          default_action: {
            type: "web_url",
            url: item.buttonUrl,
            webview_height_ratio: "tall",
          },
          buttons: [
            {
              type: "web_url",
              title: item.buttonText || "View More",
              url: item.buttonUrl,
            },
          ],
        }));

        await sendInstagramStoryCarouselMessage(
          recipientID,
          senderID,
          userAccessToken,
          tenentId,
          elements,
          messageId,
          formattedMessage,
        );

        const messageData = {
          senderId: senderID,
          username: userName,
          recipientId: recipientID,
          message: messageText,
          response: `Sent a carousel with ${templateItems.length} items.`,
          messageid: messageId,
          Timestamp: timestamp,
          ruleId: matchedRule.ruleId,
          tenentId,
        };

        console.log("ruleId for story", matchedRule.ruleId);
        await StoryComment.createStoryCommentMessage(messageData);
        console.log(
          "Automated story reply (carousel) saved to StoryComment collection.",
        );
      } else {
        console.error("Template rule has no items to display");
      }
    }
  } catch (error) {
    console.error("Error handling story reply message:", error);
    throw error;
  }
}

async function sendInstagramStoryTextMessage(
  igProAccountId,
  recipientId,
  userAccessToken,
  messageText,
  tenentId,
  originalMessageId,
  formattedMessage,
) {
  try {
    // Note: Instagram messaging has its own rate limits. You might need a separate rate limiter
    // if the volume is high, but for now we will proceed directly.

    const response = await axios({
      method: "post",
      url: `https://graph.instagram.com/v19.0/me/messages`, // Use the 'me/messages' endpoint
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${userAccessToken}`,
      },
      data: {
        recipient: { id: recipientId }, // Use the user's ID
        message: { text: messageText },
        messaging_type: "RESPONSE", // Important for replying to user messages
      },
      timeout: 15000,
    });

    console.log("Story text reply sent successfully:", response.data);

    // Save the automated response to your Message database for logging
    const savedMessage = await Message.create({
      // Assuming a generic create method
      senderId: recipientId, // The user
      recipientId: igProAccountId, // Your page
      message: formattedMessage,
      messageid: response.data.message_id,
      response: messageText, // The automated response text
      timestamp: new Date().toISOString(),
      tenentId,
    });
    console.log("Automated story reply saved to DB:", savedMessage);

    return response.data;
  } catch (error) {
    console.error(
      "Error sending story text reply:",
      error.response?.data || error.message,
    );
    throw error;
  }
}

async function sendInstagramStoryCarouselMessage(
  igProAccountId,
  recipientId,
  userAccessToken,
  tenentId,
  elements,
  originalMessageId,
  formattedMessage,
) {
  try {
    const url = `https://graph.instagram.com/v19.0/me/messages`;

    const data = {
      recipient: { id: recipientId },
      message: {
        attachment: {
          type: "template",
          payload: {
            template_type: "generic",
            elements: elements,
          },
        },
      },
      messaging_type: "RESPONSE",
    };

    const response = await axios.post(url, data, {
      headers: {
        Authorization: `Bearer ${userAccessToken}`,
        "Content-Type": "application/json",
      },
      timeout: 15000,
    });

    console.log("Story carousel reply sent successfully:", response.data);

    // Transform elements to match your schema structure
    try {
      // Convert Instagram API elements format to your schema format
      const products = elements.map((element) => ({
        title: element.title || "",
        subtitle: element.subtitle || "",
        imageUrl: element.image_url || "",
        buttons: Array.isArray(element.buttons)
          ? element.buttons.map((button) => ({
              type:
                button.type === "web_url"
                  ? "web_url"
                  : button.type || "web_url",
              title: button.title || "",
              url: button.url || "",
              payload: button.payload || "",
            }))
          : [],
      }));

      const messageData = {
        senderId: recipientId,
        recipientId: igProAccountId,
        message: formattedMessage,
        tenentId: tenentId,
        messageType: "carousel",
        response: "Carousel Message",
        Timestamp: new Date().toISOString(),
        carouselData: {
          totalProducts: products.length,
          products: products,
        },
        messageid: response.data.message_id,
      };

      const savedMessage = await Message.createCarouselMessage(messageData);
      console.log(
        "Carousel story reply saved to Message collection:",
        savedMessage,
      );
    } catch (dbError) {
      console.error(
        "Error saving carousel story reply to DB:",
        dbError.message,
      );
      console.error(
        "Elements data structure:",
        JSON.stringify(elements, null, 2),
      );
    }

    return response.data;
  } catch (error) {
    console.error(
      "Error sending story carousel reply:",
      error.response?.data || error.message,
    );
    throw error;
  }
}

async function handlewelcomeMessage(
  recipientID,
  userAccessToken,
  senderID,
  tenentId,
  timestamp,
) {
  const welcomePageConfig = await WelcomePage.findOne({ tenentId: tenentId })
    .sort({ createdAt: -1 })
    .limit(1);

  if (welcomePageConfig) {
    try {
      await sendInstagramTemplateMessage(
        recipientID,
        userAccessToken,
        senderID,
        tenentId,
      );
    } catch (error) {
      console.error(
        "Failed to send message:",
        error.response?.data || error.message,
      );
      // handle error, log it, or continue app logic without crashing
    }

    // Create welcome message response using dynamic system
    const firstresponse = await createWelcomeMessageResponse(
      tenentId,
      welcomePageConfig,
    );

    const messagedata = {
      senderId: senderID,
      recipientId: recipientID,
      response: firstresponse,
      Timestamp: timestamp,
      tenentId: tenentId,
    };

    try {
      const message = await Message.createTemplateMessage(messagedata);
      console.log("Message data one saved:", message);
      const type = "template";
      await sendNewMessage(messagedata, tenentId, type);
    } catch (error) {
      console.error("Error Message user data:", error);
    }
  }
}
async function handlePayload(
  payload,
  senderID,
  tenentId,
  recipientID,
  title,
  userAccessToken,
  timestamp,
  status,
) {
  let response;
  let response1;
  let messageresponseWithEmoji;
  let email;
  let username;
  let messageData;
  console.log("status", status);

  // Existing code for fetching icebreaker, mode, etc.
  const icebreaker = await Icebreaker.findOne({ tenentId }, "questions");
  const latestMainMode = await Mainmode.findOne({ tenentId }).sort({
    createdAt: -1,
  });
  let currentMainMode = latestMainMode?.mainmode || "offline";
  const latestMode = await Mode.findOne({ senderId: senderID, tenentId }).sort({
    createdAt: -1,
  });
  let currentMode = latestMode?.mode || "chat";
  const emailid = await Signup.findOne({ tenentId: tenentId })
    .sort({ createdAt: -1 })
    .limit(1);
  if (emailid) {
    console.log("Latest emailid retrieved:", emailid);
    email = emailid.email;
    username = emailid.name;
  } else {
    console.log("No email found in the collection");
  }

  // First check if this payload matches a saved template
  const templateMessage = await TemplateMessage.findOne({
    tenentId: tenentId,
    payload: payload,
  });

  // If we found a matching template, process it
  if (templateMessage) {
    console.log(`Found template message with payload: ${payload}`);

    try {
      // Process the template based on its type
      if (templateMessage.messageType === "text") {
        // For text type templates, send the text message
        response = templateMessage.text;
        await sendInstagramMessage(
          recipientID,
          userAccessToken,
          senderID,
          response,
        );

        // Save the message to history
        const messageSaveData = {
          senderId: senderID,
          recipientId: recipientID,
          message: title,
          Timestamp: timestamp,
          tenentId: tenentId,
        };

        const savedMessage = await Message.createTextMessage(messageSaveData);
        if (savedMessage) {
          console.log("Template text message saved:", savedMessage);
          await sendNewMessage(messageSaveData, tenentId, "text");
        }
      }
      // When handling carousel type templates in handlePayload
      else if (templateMessage.messageType === "carousel") {
        // For carousel type templates, create a carousel message

        // Save the user's request to get the template
        const userRequestData = {
          senderId: senderID,
          recipientId: recipientID,
          message: title,
          Timestamp: timestamp,
          tenentId: tenentId,
        };

        await Message.createTextMessage(userRequestData);
        await sendNewMessage(userRequestData, tenentId, "text");

        // Build all carousel elements at once
        const carouselElements = templateMessage.carouselItems.map((item) => {
          return {
            title: item.title,
            image_url: item.image,
            subtitle: item.subtitle || "", // Use the subtitle if available or empty string
            buttons: item.buttons.map((button) => {
              if (button.buttonType === "url") {
                return {
                  type: "web_url",
                  title: button.buttonText,
                  url: button.buttonUrl,
                };
              } else {
                return {
                  type: "postback",
                  title: button.buttonText,
                  payload: button.buttonPayload,
                };
              }
            }),
          };
        });

        // Send the complete carousel using sendInstagramCarousel
        await sendInstagramCarousel(
          senderID,
          recipientID,
          tenentId,
          userAccessToken,
          carouselElements,
        );

        console.log(
          "Carousel template sent successfully via sendInstagramCarousel",
        );
      }

      return "success";
    } catch (error) {
      console.error("Error handling template message:", error);
      response = "Sorry, there was an error processing the template message.";
      await sendInstagramMessage(
        recipientID,
        userAccessToken,
        senderID,
        response,
      );
      return response;
    }
  }

  switch (payload) {
    case "HUMAN_AGENT":
      const usernamedata1 = await Newuser.findOne({
        senderId: senderID,
        tenentId: tenentId,
      })
        .sort({ createdAt: -1 })
        .limit(1);
      let name = usernamedata1.name;
      console.log("name", name);
      if (name == "Nil") {
        name = usernamedata1.username;
      }

      response = `You will be assisted by a human agent. If you want to chat with the chatbot, click the three lines in the top-right corner and then select 'Chatbot'.`;

      if (username == "Vaseegrah Veda" || username == "Vaseegrahveda") {
        if (status == "new") {
          //response = `Welcome to Vaseegrah Veda `;
          response = `Welcome to Vaseegrah Veda!You will be assisted by a human agent. If you want to chat with the chatbot, click the three lines in the top-right corner and then select 'Chatbot'.`;
        }
        if (status == "old") {
          response = `You will be assisted by a human agent. If you want to chat with the chatbot, click the three lines in the top-right corner and then select 'Chatbot'.`;
        }
      }
      mode = "human";
      response = await sendInstagramMessage(
        recipientID,
        userAccessToken,
        senderID,
        response,
      );
      // Create and save the mode with the senderId
      chatdata = await Mode.findOne({ senderId: senderID, tenentId: tenentId })
        .sort({ createdAt: -1 })
        .limit(1);
      console.log("chatdata", chatdata);
      if (chatdata) {
        try {
          const updatedContact = await Mode.findOneAndUpdate(
            { senderId: senderID, tenentId: tenentId },
            // Query to match the document
            { $set: { mode: mode } }, // Update operation
            { new: true }, // Option to return the updated document
          );
          console.log("updatedContact1", updatedContact);
          // Return the updated contact
          const modedata = {
            senderId: senderID,
            tenentId: tenentId,
            mode: mode,
          };
          const sentstatus = await sendChatModeUpdate(modedata);
          console.log("sentstatus", sentstatus);
        } catch (error) {
          console.error(error);
        }
      } else {
        try {
          const modeDocument = {
            mode: mode,
            senderId: senderID, // Now included in the same object
            tenentId: tenentId,
          };
          const mode_c = new Mode(modeDocument);
          const savedMode = await mode_c.save();
          console.log("Mode data saved:", savedMode);

          await sendChatModeUpdate(modeDocument);
        } catch (error) {
          console.error("Error saving mode data:", error);
        }
      }
      // Save message
      const payloadmessagedata = {
        senderId: senderID,
        recipientId: recipientID,
        message: title,
        //response: response,
        Timestamp: timestamp,
        tenentId: tenentId,
      };
      console.log("senderID for notification", senderID);
      console.log("tenentId for notification", tenentId);
      const payloadmessage = await Message.createTextMessage(
        payloadmessagedata,
      );
      if (payloadmessage) {
        console.log("payloadmessage", payloadmessage);
        const type = "text";
        await sendNewMessage(payloadmessagedata, tenentId, type);
      }
      //const phoneNumber="918270307371";
      const tech_response = `A Human Agent has been requested from ${name}.`;
      //await sendEmailAlert(email, senderID);
      console.log("senderID for notification", senderID);
      console.log("tenentId for notification", tenentId);
      /*const tech_recipientID="1052845676641199";
        const tech_response=`A Human Agent has been requested from ${username}.`;
        await sendInstagramMessage(tech_recipientID, userAccessToken, recipientID, tech_response);*/
      await saveNotificationToDashboard(
        senderID,
        tenentId,
        `A Human agent has been requested from ${name}.`,
      );
      //const whatsappNumber = "918015434844"; // Add the number where you want to send notifications
      //const tech_response = `A Human Agent has been requested from ${username}.`;

      // Send WhatsApp message
      break;

    case "AI_ASSISTANT": // Note: corrected spelling here
      response = `You will be assisted by an AI Assistant. If you want to chat with the Human Agent, click the three lines in the top-right corner and then select 'Human Agent'.`;

      if (username == "Vaseegrah Veda") {
        if (status == "new") {
          //response = `Welcome to Vaseegrah Veda `;
          response = `Welcome to Vaseegrah Veda!You will be assisted by an AI Assistant.`;
        }
        if (status == "old") {
          response = `You will be assisted by an AI Assistant.`;
        }
      }
      mode = "chat";
      response = await sendInstagramMessage(
        recipientID,
        userAccessToken,
        senderID,
        response,
      );
      // Create and save the mode with the senderId
      chatdata = await Mode.findOne({ senderId: senderID, tenentId: tenentId })
        .sort({ createdAt: -1 })
        .limit(1);
      console.log("chatdata", chatdata);
      if (chatdata) {
        try {
          const updatedContact = await Mode.findOneAndUpdate(
            { senderId: senderID, tenentId: tenentId },
            // Query to match the document
            { $set: { mode: mode } }, // Update operation
            { new: true }, // Option to return the updated document
          );
          console.log("updatedContact1", updatedContact);
          // Return the updated contact
          const modedata = {
            senderId: senderID,
            tenentId: tenentId,
            mode: mode,
          };
          await sendChatModeUpdate(modedata);
        } catch (error) {
          console.error(error);
        }
      } else {
        try {
          const modeDocument = {
            mode: mode,
            senderId: senderID, // Now included in the same object
            tenentId: tenentId,
          };
          const mode_c = new Mode(modeDocument);
          const savedMode = await mode_c.save();
          console.log("Mode data saved:", savedMode);
          await sendChatModeUpdate(modeDocument);
        } catch (error) {
          console.error("Error saving mode data:", error);
        }
      }
      // Save message
      const payloadmessageAIdata = {
        senderId: senderID,
        recipientId: recipientID,
        message: title,
        //response: response,
        Timestamp: timestamp,
        tenentId: tenentId,
      };
      const payloadmessageAI = await Message.createTextMessage(
        payloadmessageAIdata,
      );
      if (payloadmessageAI) {
        console.log("payloadmessageAI", payloadmessageAI);
        const type = "text";
        await sendNewMessage(payloadmessageAIdata, tenentId, type);
      }
      state = "success";
      break;
    case "PRODUCT_CATAGORY":
      try {
        const signupdata = await Signup.findOne({ tenentId: tenentId })
          .sort({ createdAt: -1 })
          .limit(1);
        if (signupdata) {
          const username = signupdata.name;
          // Fetch product types for this tenant from MongoDB
          const productTypes = await ProductType.findOne({ tenentId });
          if (username != "Techvaseegrah") {
            if (!productTypes || !productTypes.productTypes.length) {
              const response =
                "No product or services categories found. Please contact support.";
              await sendInstagramMessage(
                recipientID,
                userAccessToken,
                senderID,
                response,
              );

              break;
            }
          }
        }

        // Create message data object
        const messageData = {
          senderId: recipientID,
          recipientId: senderID,
          tenentId,
          Timestamp: timestamp,
        };
      } catch (error) {
        console.error("Error handling PRODUCT_CATEGORY:", error);
        const response = "Sorry, something went wrong. Please try again later.";
        await sendInstagramMessage(
          recipientID,
          userAccessToken,
          senderID,
          response,
        );
      }
      try {
        const IdData = await LongToken.findOne({ tenentId: tenentId })
          .sort({ createdAt: -1 })
          .limit(1);

        if (!IdData?.tenentId) return;
        let title = "Browse our Product";
        const signupdata = await Signup.findOne({ tenentId: tenentId })
          .sort({ createdAt: -1 })
          .limit(1);
        if (signupdata) {
          const username = signupdata.name;
          if (username == "Techvaseegrah") {
            title = "Browse our Product and Services";
          }
        }
        //const tenentId = IdData.tenentId;
        //const userAccessToken = IdData.userAccessToken;
        const browseproductmessagedata = {
          senderId: senderID,
          recipientId: recipientID,
          message: title,
          tenentId,
          Timestamp: timestamp,
        };
        const browseproductmessage = await Message.createTextMessage(
          browseproductmessagedata,
        );
        if (browseproductmessage) {
          console.log("browseproductmessage", browseproductmessage);
          const type = "text";
          await sendNewMessage(browseproductmessagedata, tenentId, type);
        }
        await sendInstagramProduct_type_quick_reply(
          recipientID,
          userAccessToken,
          senderID,
          tenentId,
          timestamp,
        );
        response = "success";
      } catch (error) {
        console.error("Failed to send product template:", error);
      }
      break;
    case "PRODUCT_CATAGORY_LINK":
      try {
        const signupdata = await Signup.findOne({ tenentId: tenentId })
          .sort({ createdAt: -1 })
          .limit(1);
        if (signupdata) {
          const username = signupdata.name;
          // Fetch product types for this tenant from MongoDB
          const productTypes = await ProductType.findOne({ tenentId });
          if (username != "Techvaseegrah") {
            if (!productTypes || !productTypes.productTypes.length) {
              const response =
                "No product or services categories found. Please contact support.";
              await sendInstagramMessage(
                recipientID,
                userAccessToken,
                senderID,
                response,
              );
              break;
            }
          }
        }

        // Create message data object
        const messageData = {
          senderId: recipientID,
          recipientId: senderID,
          tenentId,
          Timestamp: timestamp,
        };
      } catch (error) {
        console.error("Error handling PRODUCT_CATEGORY:", error);
        const response = "Sorry, something went wrong. Please try again later.";
        await sendInstagramMessage(
          recipientID,
          userAccessToken,
          senderID,
          response,
        );
      }
      try {
        const IdData = await LongToken.findOne({ tenentId: tenentId })
          .sort({ createdAt: -1 })
          .limit(1);

        if (!IdData?.tenentId) return;
        let title = "Browse our Product";
        let catalogtype;
        const signupdata = await Signup.findOne({ tenentId: tenentId })
          .sort({ createdAt: -1 })
          .limit(1);
        if (signupdata) {
          catalogtype = signupdata.type;
          const username = signupdata.name;
          if (username == "Techvaseegrah") {
            title = "Browse our Product and Services";
          }
        }

        const browseproductmessagedata = {
          senderId: senderID,
          recipientId: recipientID,
          message: title,
          tenentId,
          Timestamp: timestamp,
        };
        const browseproductmessage = await Message.createTextMessage(
          browseproductmessagedata,
        );
        if (browseproductmessage) {
          console.log("browseproductmessage", browseproductmessage);
          const type = "text";
          await sendNewMessage(browseproductmessagedata, tenentId, type);
        }

        let existingToken = await SecurityAccessToken.findOne({
          senderId: senderID,
          tenentId: tenentId,
        });
        let securityaccessToken;
        if (existingToken) {
          console.log("Existing Security Access Token:", existingToken);
          securityaccessToken = existingToken.securityaccessToken;
        } else {
          const accessToken = crypto.randomBytes(32).toString("hex");

          const accessTokenEntry = new SecurityAccessToken({
            senderId: senderID,
            securityaccessToken: accessToken,
            tenentId: tenentId,
          });

          const savedAccessToken = await accessTokenEntry.save();
          console.log("New Security Access Token created:", savedAccessToken);
          let existingToken = await SecurityAccessToken.findOne({
            senderId: senderID,
            tenentId: tenentId,
          });
          if (existingToken) {
            console.log("Existing Security Access Token:", existingToken);
            securityaccessToken = existingToken.securityaccessToken;
          }
        }

        let productcatalogurl =
          "https://inocencia-shiftiest-nonodorously.ngrok-free.dev/productcatalog";
        if (catalogtype === "size-variation") {
          productcatalogurl =
            "https://inocencia-shiftiest-nonodorously.ngrok-free.dev/productcatalogsize";
        }

        const firstresponse = {
          attachment: {
            type: "template",
            payload: {
              template_type: "button",
              text: "Click the button below to browse our products",
              default_action: {
                type: "web_url",
                url: `${productcatalogurl}?tenentId=${tenentId}&securityaccessToken=${securityaccessToken}`,
              },
              buttons: [
                {
                  type: "web_url",
                  title: "View Our Products",
                  url: `${productcatalogurl}?tenentId=${tenentId}&securityaccessToken=${securityaccessToken}`,
                },
              ],
            },
          },
        };

        await sendInstagramProductTemplateMessage(
          recipientID,
          userAccessToken,
          senderID,
          tenentId,
          firstresponse,
        );
        const timestamp2 = timestamp + 10;
        const messagedata = {
          senderId: senderID,
          recipientId: recipientID,
          response: firstresponse,
          Timestamp: timestamp2,
          tenentId: tenentId,
        };
        try {
          const message = await Message.createProductTemplateMessage(
            messagedata,
          );
          console.log("Message data one saved:", message);
          const type = "template";
          await sendNewMessage(messagedata, tenentId, type);
        } catch (error) {
          console.error("Error Message user data:", error);
        }
        response = "success";
      } catch (error) {
        console.error("Failed to send product template:", error);
      }
      break;

    case "FOLLOW_STATUS":
      try {
        console.log("Checking follow status for:", senderID);

        // 1. Check if user is now following
        const userdata = await getUserProfileFollowInformation(
          senderID,
          tenentId,
        );
        console.log("Follow status check result:", userdata);
        const userName = userdata.username;
        const acknowledgeMessageData = {
          senderId: senderID,
          recipientId: recipientID,
          message: title,
          Timestamp: timestamp,
          tenentId: tenentId,
        };
        await Message.createTextMessage(acknowledgeMessageData);
        await sendNewMessage(acknowledgeMessageData, tenentId, "text");
        if (userdata.is_user_follow_business === true) {
          // Save the acknowledgment message
          /*const acknowledgeMessageData = {
        senderId: senderID,
        recipientId: recipientID,
        message: title,
        Timestamp: timestamp,
        tenentId: tenentId
      };
      await Message.createTextMessage(acknowledgeMessageData);
      await sendNewMessage(acknowledgeMessageData, tenentId, "text");*/

          // ✅ User is now following!
          response = "Thanks for your comment! 🎉 Here's our reply for you:";
          await sendInstagramMessage(
            recipientID,
            userAccessToken,
            senderID,
            response,
          );

          // 2. Find the most recent CommentAutomationLog for this user
          const latestLog = await CommentAutomationLog.findOne({
            senderId: senderID,
            tenentId: tenentId,
          })
            .sort({ createdAt: -1 })
            .limit(1);

          if (!latestLog) {
            console.error("No pending follow log found for this user");
            response =
              "We couldn't find your previous request. Please try commenting again!";
            //await sendInstagramMessage(recipientID, userAccessToken, senderID, response);
            break;
          }
          const ruleId = latestLog.ruleId;
          const commentId = latestLog.commentId;
          const commentText = latestLog.commentText;
          const mediaId = latestLog.mediaId;
          console.log("Found pending log:", latestLog);
          console.log("ruleId foe payload", ruleId);
          // 3. Get the rule from the log
          const rule = await CommentAutomationRule.findOne({
            ruleId: latestLog.ruleId,
          });
          console.log("rule for follow", rule);
          if (!rule) {
            console.error("Rule not found for ID:", latestLog.ruleId);
            response =
              "Sorry, we couldn't process your request. Please try again!";
            //await sendInstagramMessage(recipientID, userAccessToken, senderID, response);
            break;
          }

          console.log("Found rule:", rule.triggerText, "Type:", rule.ruleType);
          const ruleType = rule.ruleType;
          // 4. Send the appropriate response based on rule type
          if (ruleType === "text") {
            const replyText = rule.replyText;
            const commentReply = rule.commentReply;

            try {
              if (
                rateLimiter.canMakePrivateRepliesPostCall(tenentId, recipientID)
              ) {
                const response_for_comment = await sendInstagramMessage(
                  recipientID,
                  userAccessToken,
                  senderID,
                  replyText,
                );
                console.log(
                  "successfully send the comment text message",
                  response_for_comment.data,
                );
              } else {
                console.log(
                  `Rate limit exceeded for Private Replies API for tenant ${tenentId}, scheduling retry`,
                );

                setTimeout(async () => {
                  try {
                    if (
                      rateLimiter.canMakePrivateRepliesPostCall(
                        tenentId,
                        recipientID,
                      )
                    ) {
                      const response_for_comment = await sendInstagramMessage(
                        recipientID,
                        userAccessToken,
                        senderID,
                        replyText,
                      );
                    }
                  } catch (retryErr) {
                    console.error("Error in delayed comment reply:", retryErr);
                  }
                }, 5000);
              }
            } catch (error) {
              console.error("Error sending comment text reply:", error);
            }
          } else if (ruleType === "template") {
            const templateItems = rule.carouselItems || [];
            console.log("templateItems", templateItems);
            if (templateItems.length === 0) {
              console.error("Template rule has no items to display");
              response =
                "Sorry, there was an error loading the products. Please try again!";
              await sendInstagramMessage(
                recipientID,
                userAccessToken,
                senderID,
                response,
              );

              // Save error message
              const errorMessageData = {
                senderId: senderID,
                recipientId: recipientID,
                message: title,
                Timestamp: timestamp + 1000,
                tenentId: tenentId,
              };
              await Message.createTextMessage(errorMessageData);
              await sendNewMessage(errorMessageData, tenentId, "text");
              break;
            }

            // Format template items for Instagram carousel
            const elements = templateItems.map((item) => ({
              title: item.title,
              image_url: item.image,
              subtitle: item.subtitle,
              default_action: {
                type: "web_url",
                url: item.buttonUrl,
              },
              buttons: [
                {
                  type: "web_url",
                  title: item.buttonText || "View",
                  url: item.buttonUrl,
                },
              ],
            }));

            try {
              if (
                rateLimiter.canMakePrivateRepliesPostCall(tenentId, recipientID)
              ) {
                // Send as regular DM carousel using sendInstagramCarousel
                await sendInstagramCarousel(
                  senderID, // senderID (user who will receive)
                  recipientID, // recipientID (your business account)
                  tenentId, // tenentId
                  userAccessToken, // userAccessToken
                  elements, // carousel elements
                );
                console.log("✅ Successfully sent carousel via DM");

                // Save carousel to database
                /*const carouselMessageData = {
              senderId: senderID,
              recipientId: recipientID,
              tenentId: tenentId,
              messageType: 'carousel',
              response: "Carousel Message",
              Timestamp: timestamp + 1000,
              carouselData: {
                totalProducts: elements.length,
                products: elements.map((element, index) => ({
                  _id: `carousel_item_${index}`,
                  title: element.title,
                  subtitle: element.subtitle,
                  imageUrl: element.image_url,
                  buttons: element.buttons
                }))
              }
            };
            await Message.createCarouselMessage(carouselMessageData);
            await sendNewMessage(carouselMessageData, tenentId, "carousel");
            */
              } else {
                console.log(
                  `Rate limit exceeded for tenant ${tenentId}, scheduling carousel retry`,
                );

                setTimeout(async () => {
                  try {
                    if (
                      rateLimiter.canMakePrivateRepliesPostCall(
                        tenentId,
                        recipientID,
                      )
                    ) {
                      await sendInstagramCarousel(
                        senderID,
                        recipientID,
                        tenentId,
                        userAccessToken,
                        elements,
                      );
                      console.log(
                        "✅ Successfully sent carousel via DM (delayed)",
                      );

                      // Save carousel to database
                      /*const carouselMessageData = {
                    senderId: senderID,
                    recipientId: recipientID,
                    tenentId: tenentId,
                    messageType: 'carousel',
                    response: "Carousel Message",
                    Timestamp: Date.now(),
                    carouselData: {
                      totalProducts: elements.length,
                      products: elements.map((element, index) => ({
                        _id: `carousel_item_${index}`,
                        title: element.title,
                        subtitle: element.subtitle,
                        imageUrl: element.image_url,
                        buttons: element.buttons
                      }))
                    }
                  };
                  await Message.createCarouselMessage(carouselMessageData);
                  await sendNewMessage(carouselMessageData, tenentId, "carousel");*/
                    }
                  } catch (retryErr) {
                    console.error("Error in delayed carousel:", retryErr);
                  }
                }, 5000);
              }
            } catch (error) {
              console.error(
                "Error sending carousel:",
                error.response?.data || error.message,
              );
            }
          }

          // 5. Update the log to SUCCESS
          await CommentAutomationLog.findOneAndUpdate(
            { ruleId: latestLog.ruleId }, // Must be an object!
            { $set: { sendReplyStatus: true, reason: "SUCCESS" } },
            { new: true },
          );

          console.log(
            "✅ Successfully processed follow verification and sent reply",
          );
        } else {
          // ❌ User is still not following - resend the follow-required template
          console.log(
            "❌ User still not following, resending follow-required template",
          );

          const notFollowerTemplate = {
            attachment: {
              type: "template",
              payload: {
                template_type: "button",
                text:
                  "You are not a follower. Please follow us to get access. Click the button below after following.",
                buttons: [
                  {
                    type: "postback",
                    payload: "FOLLOW_STATUS",
                    title: "I'm a Follower",
                  },
                ],
              },
            },
          };

          try {
            // Add this part - save the acknowledgment for not following
            /*const notFollowingAcknowledgeData = {
      senderId: senderID,
      recipientId: recipientID,
      message:title,
      Timestamp: timestamp2 + 10,
      tenentId: tenentId
    };
    await Message.createTextMessage(notFollowingAcknowledgeData);
    await sendNewMessage(notFollowingAcknowledgeData, tenentId, "text");*/
            // Send the template message again
            await sendInstagramProductTemplateMessage(
              recipientID,
              userAccessToken,
              senderID,
              tenentId,
              notFollowerTemplate,
            );
            console.log(
              "✅ Resent follow-required template to user:",
              senderID,
            );

            // Save to Message collection
            const timestamp2 = timestamp + 1000;
            const messageData = {
              senderId: senderID,
              recipientId: recipientID,
              response: notFollowerTemplate,
              Timestamp: timestamp2,
              tenentId: tenentId,
            };

            try {
              const message = await Message.createProductTemplateMessage(
                messageData,
              );
              console.log("✅ Message data saved:", message._id);
              const type = "template";
              await sendNewMessage(messageData, tenentId, type);
            } catch (error) {
              console.error("❌ Error saving Message user data:", error);
            }
          } catch (error) {
            console.error(
              "❌ Error resending follow-required template:",
              error,
            );
            // Fallback to text message if template fails
            response =
              "It looks like you're not following us yet. Please follow our account first, then click the button again! 😊";
            await sendInstagramMessage(
              recipientID,
              userAccessToken,
              senderID,
              response,
            );

            // Save fallback text message
            const fallbackMessageData = {
              senderId: senderID,
              recipientId: recipientID,
              message: response,
              Timestamp: Date.now(),
              tenentId: tenentId,
            };
            await Message.createTextMessage(fallbackMessageData);
            await sendNewMessage(fallbackMessageData, tenentId, "text");
          }
        }
      } catch (error) {
        console.error("Error handling FOLLOW_STATUS:", error);
        response =
          "Sorry, there was an error checking your follow status. Please try again!";
        await sendInstagramMessage(
          recipientID,
          userAccessToken,
          senderID,
          response,
        );
      }
      break;
    case "ORDER":
      response = `To place an order with VaseegrahVeda, you can browse their products on their website INDIA - www.vaseegrahveda.com. Singapore - www.vaseegrahveda.sg. UAE - www.vaseegrahveda.ae., add the items you want to your cart, proceed to checkout, enter your shipping details, choose a payment method, review your order, and then place the order. You will receive a confirmation via WhatsApp or email after completing the payment. To view specific products, click the three lines in the top-right corner of the Instagram inbox and select 'Browse Our Products' to view product categories and details.`;
      response = await sendInstagramMessage(
        recipientID,
        userAccessToken,
        senderID,
        response,
      );
      state = "success";
      break;

    case "QUESTION_1":
      const firstQuestion = icebreaker.questions[0];
      console.log("firstQuestion", firstQuestion);
      console.log("tenentId for firstquestion", tenentId);

      if (currentMainMode !== "online") {
        messageData = {
          senderId: senderID,
          recipientId: recipientID,
          message: firstQuestion,
          //response:response,
          Timestamp: timestamp,
          tenentId: tenentId,
        };
      }
      messageData = {
        senderId: senderID,
        recipientId: recipientID,
        message: firstQuestion,

        Timestamp: timestamp,
        tenentId: tenentId,
      };
      try {
        const message = await Message.createTextMessage(messageData);
        console.log("Message data four saved:", message);
        const type = "text";
        await sendNewMessage(messageData, tenentId, type);
      } catch (error) {
        console.error("Error Message user data:", error);
      }
      if (status == "new") {
        if (currentMainMode !== "online") {
          const timestamp1 = timestamp + 1000;
          await handlewelcomeMessage(
            recipientID,
            userAccessToken,
            senderID,
            tenentId,
            timestamp1,
          );
        }
      }
      if (currentMode !== "human" && currentMainMode !== "online") {
        response = await getGptResponse(firstQuestion, tenentId, senderID);
        console.log("response", response);
        response1 = await sendInstagramMessage(
          recipientID,
          userAccessToken,
          senderID,
          response,
        );
      }
      break;
    case "QUESTION_2":
      const SecondQuestion = icebreaker.questions[1];
      console.log("SecondQuestion", SecondQuestion);
      console.log("tenentId for SecondQuestion", tenentId);
      if (currentMainMode !== "online") {
        messageData = {
          senderId: senderID,
          recipientId: recipientID,
          message: SecondQuestion,
          //response:response,
          Timestamp: timestamp,
          tenentId: tenentId,
        };
      }
      messageData = {
        senderId: senderID,
        recipientId: recipientID,
        message: SecondQuestion,
        Timestamp: timestamp,
        tenentId: tenentId,
      };
      try {
        const message = await Message.createTextMessage(messageData);
        console.log("Message data four saved:", message);
        const type = "text";
        await sendNewMessage(messageData, tenentId, type);
      } catch (error) {
        console.error("Error Message user data:", error);
      }
      if (status == "new") {
        if (currentMainMode !== "online") {
          const timestamp1 = timestamp + 1000;
          await handlewelcomeMessage(
            recipientID,
            userAccessToken,
            senderID,
            tenentId,
            timestamp1,
          );
        }
      }
      if (currentMode !== "human" && currentMainMode !== "online") {
        response = await getGptResponse(SecondQuestion, tenentId, senderID);
        console.log("response", response);
        response1 = await sendInstagramMessage(
          recipientID,
          userAccessToken,
          senderID,
          response,
        );
      }
      break;
    case "QUESTION_3":
      const ThirdQuestion = icebreaker.questions[2];
      console.log("ThirdQuestion", ThirdQuestion);
      console.log("tenentId for ThirdQuestion", tenentId);
      if (currentMainMode !== "online") {
        messageData = {
          senderId: senderID,
          recipientId: recipientID,
          message: ThirdQuestion,
          //response:response,
          Timestamp: timestamp,
          tenentId: tenentId,
        };
      }
      messageData = {
        senderId: senderID,
        recipientId: recipientID,
        message: ThirdQuestion,
        Timestamp: timestamp,
        tenentId: tenentId,
      };
      try {
        const message = await Message.createTextMessage(messageData);
        console.log("Message data four saved:", message);
        const type = "text";
        await sendNewMessage(messageData, tenentId, type);
      } catch (error) {
        console.error("Error Message user data:", error);
      }
      if (status == "new") {
        if (currentMainMode !== "online") {
          const timestamp1 = timestamp + 1000;
          await handlewelcomeMessage(
            recipientID,
            userAccessToken,
            senderID,
            tenentId,
            timestamp1,
          );
        }
      }
      if (currentMode !== "human" && currentMainMode !== "online") {
        response = await getGptResponse(ThirdQuestion, tenentId, senderID);
        console.log("response", response);
        response1 = await sendInstagramMessage(
          recipientID,
          userAccessToken,
          senderID,
          response,
        );
      }
      break;
    case "QUESTION_4":
      const FourthQuestion = icebreaker.questions[3];
      console.log("FourthQuestion", FourthQuestion);
      console.log("tenentId for FourthQuestion", tenentId);
      if (currentMainMode !== "online") {
        messageData = {
          senderId: senderID,
          recipientId: recipientID,
          message: FourthQuestion,
          //response:response,
          Timestamp: timestamp,
          tenentId: tenentId,
        };
      }
      messageData = {
        senderId: senderID,
        recipientId: recipientID,
        message: FourthQuestion,
        Timestamp: timestamp,
        tenentId: tenentId,
      };
      try {
        const message = await Message.createTextMessage(messageData);
        console.log("Message data four saved:", message);
        const type = "text";
        await sendNewMessage(messageData, tenentId, type);
      } catch (error) {
        console.error("Error Message user data:", error);
      }
      if (status == "new") {
        if (currentMainMode !== "online") {
          const timestamp1 = timestamp + 1000;
          await handlewelcomeMessage(
            recipientID,
            userAccessToken,
            senderID,
            tenentId,
            timestamp1,
          );
        }
      }
      if (currentMode !== "human" && currentMainMode !== "online") {
        response = await getGptResponse(FourthQuestion, tenentId, senderID);
        console.log("response", response);
        response1 = await sendInstagramMessage(
          recipientID,
          userAccessToken,
          senderID,
          response,
        );
      }
      break;
    default:
      response = `Sorry, I didn't understand that.`;
    // Exit early for unknown payloads
  }

  return response; // Return the response after processing
}
// Function to save notification in the database
async function saveNotificationToDashboard(senderID, tenentId, message) {
  const notitimestamp = new Date();
  //const newNotificationKey = `${senderID}_${notitimestamp}`;
  const ID = new Date();
  const notification = new Notification({
    senderId: senderID,
    tenentId: tenentId,
    message: message,
    isRead: false, // Unread notification
    createdAt: new Date(),
    ID: ID,
  });

  try {
    const savedNotification = await notification.save();
    console.log("Notification saved:", savedNotification);
    await sendNotificationUpdate(savedNotification);
  } catch (error) {
    console.error("Error saving notification:", error);
  }
}
async function handleQuickReply(webhookEvent) {
  const payload = webhookEvent.message.quick_reply.payload;
  const senderID = webhookEvent.sender.id;
  const recipientID = webhookEvent.recipient.id;
  const text = webhookEvent.message.text;
  const timestamp = webhookEvent.timestamp;
  const messageId = webhookEvent.message.mid;
  console.log("quick reply text:", text);
  let OrderStatusurl;
  const IdData = await LongToken.findOne({ Instagramid: recipientID })
    .sort({ createdAt: -1 })
    .limit(1);

  if (!IdData?.tenentId) return;

  const tenentId = IdData.tenentId;
  const userAccessToken = IdData.userAccessToken;
  const userData = await getUserProfileInformation(senderID, tenentId);
  let userName = userData.username;
  if (!userData.username) {
    userName = "Nil";
  }
  let Name = userData.name;
  if (!Name) {
    Name = "Nil";
  }
  let profile_Pic = userData.profile_pic;
  if (!userData.profile_pic) {
    profile_Pic = null;
  }
  console.log("saved username", userName);
  const userid = await Newuser.findOne({
    senderId: senderID,
    tenentId: tenentId,
  })
    .sort({ createdAt: -1 })
    .limit(1);
  if (userid) {
    console.log("SenderID already exists");
    await updateUserProfile(userData, senderID, tenentId);
  } else {
    console.log("SenderID does not exist");
    const senderdata = {
      senderId: senderID,
      username: userName,
      profile_pic: profile_Pic,
      name: Name,
      tenentId: tenentId,
    };
    const newuser = new Newuser(senderdata);
    try {
      const savednewuser = await newuser.save();
      console.log("User data saved:", savednewuser);
      await sendNewContact(savednewuser, tenentId, senderID);
    } catch (error) {
      console.error("Error saving user data:", error);
    }
  }
  const quick_text_data = {
    senderId: senderID,
    recipientId: recipientID,
    tenentId,
    message: text,
    Timestamp: timestamp,
    messageid: messageId,
  };
  const quick_text = await Message.createTextMessage(quick_text_data);
  if (quick_text) {
    console.log("quick_text", quick_text);
    const type = "text";
    await sendNewMessage(quick_text_data, tenentId, type);
  }
  if (payload.includes("CATEGORY")) {
    let websiteurl;
    try {
      // Convert "SKIN_CARE_CATEGORY" to "Skin Care"
      const formattedProductType = payload
        .replace("_CATEGORY", "")
        .replace(/_/g, " ")
        .split(" ")
        .map(
          (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase(),
        )
        .join(" ");

      console.log("Searching for product type:", formattedProductType);

      // Fetch products for the selected category from ProductList
      const products = await ProductList.find({
        tenentId,
        productType: formattedProductType,
      }).limit(10); // Limit to 10 products for carousel

      if (!products || products.length === 0) {
        console.log("No products found in this category.");
        const noProductMessage =
          "Sorry, there are no products available in this category.";
        await sendInstagramTextMessage(
          recipientID,
          userAccessToken,
          senderID,
          noProductMessage,
        );
        return;
      }

      console.log("Products found in category:", products);

      // Create an array of product details with the structure expected by createCarouselMessage
      const productsWithDetails = await Promise.all(
        products.map(async (product) => {
          const productDetails = await ProductDetail.findOne({
            tenentId,
            productName: product.productName,
          });
          console.log("carousol products", productDetails);
          // Extract the correct productId dynamically
          const productId = productDetails.productId;
          console.log("carousol productId", productId);
          // Generate pricing details
          const priceList = Array.isArray(productDetails?.units)
            ? productDetails.units
                .map((unit) => `${unit.unit}: ₹${unit.price}`)
                .join("\n")
            : "No pricing details available.";

          // Return the product with enriched details AND the buttons directly
          const storeCredentials = await ecommerceCredentialsService.getCredentialsForAPI(
            tenentId,
          );
          if (
            storeCredentials &&
            storeCredentials.websites &&
            storeCredentials.websites.length > 0
          ) {
            // Find WooCommerce and Shopify credentials if they exist
            const wooCommerceWebsite = storeCredentials.websites.find(
              (website) => website.type === "woocommerce",
            );
            const shopifyWebsite = storeCredentials.websites.find(
              (website) => website.type === "shopify",
            );

            // Only access credentials if the website exists
            const wooCredentials = wooCommerceWebsite
              ? wooCommerceWebsite.credentials
              : null;
            const shopifyCredentials = shopifyWebsite
              ? shopifyWebsite.credentials
              : null;
            if (wooCredentials) {
              websiteurl = wooCredentials.url;
            } else if (shopifyCredentials) {
              websiteurl = shopifyCredentials.websiteUrl;
            } else {
              const returnmessage = "Error occur during showing carousol";
              await sendInstagramMessage(
                recipientID,
                userAccessToken,
                senderID,
                returnmessage,
              );

              return;
            }
          }
          // Return the product with enriched details AND the buttons directly
          return {
            _id: productId,
            title: productDetails?.productName || product.productName,
            subtitle: priceList,
            default_action: {
              type: "web_url",
              url: productDetails?.websiteLink,
            },
            imageUrl:
              productDetails?.productPhotoUrl ||
              product.productPhotoUrl ||
              `${appUrl}/default-product-image.jpg`,
            // Add buttons directly in the product object for database storage
            buttons: [
              {
                type: "web_url",
                title: "Shop Now",
                url: productDetails?.websiteLink,
              },
              {
                type: "web_url",
                title: "🛒 Cart",
                url: `${websiteurl}/cart`,
              },
            ],
          };
        }),
      );

      // Create elements array for Instagram carousel
      const elements = productsWithDetails.map((product) => ({
        title: product.title,
        image_url: product.imageUrl, // Use imageUrl since we're not adding image_url anymore
        subtitle: product.subtitle,
        default_action: product.default_action,
        buttons: product.buttons, // Use the same buttons objects
      }));

      // Send the Instagram carousel
      const response = await sendInstagramCarousel(
        senderID,
        recipientID,
        tenentId,
        userAccessToken,
        elements,
      );
      const nexttimestamp = timestamp + 100;
      // Send to database with correct structure
      const carouselData = {
        senderId: senderID,
        recipientId: recipientID,
        tenentId: tenentId,
        response: "Carousel Message",
        Timestamp: nexttimestamp,
        carouselData: {
          totalProducts: productsWithDetails.length,
          products: productsWithDetails, // These now have the buttons directly included
        },
      };

      // Save to database
      const response1 = await Message.createCarouselMessage(carouselData);

      if (response && response1) {
        console.log("Product carousel sent successfully!");
      }
    } catch (error) {
      console.error("Error fetching category products:", error);
    }
  }
}
// Postback Handler Function
async function handlePostback(webhookEvent) {
  try {
    const title = webhookEvent.postback.title;
    const senderID = webhookEvent.sender.id;
    const recipientID = webhookEvent.recipient.id;
    const timestamp = webhookEvent.timestamp;
    const payload = webhookEvent.postback.payload;
    let status;

    // Skip if already processed
    const currentTimestamp = Date.now();
    if (
      processedPayloads[payload] &&
      currentTimestamp - processedPayloads[payload] < TIME_WINDOW_MS
    ) {
      console.log(`Skipping already processed payload: ${payload}`);
      return;
    }

    // Mark payload as processed
    processedPayloads[payload] = currentTimestamp;

    // Get tenant ID
    const IdData = await LongToken.findOne({ Instagramid: recipientID })
      .sort({ createdAt: -1 })
      .limit(1);

    if (!IdData?.tenentId) return;

    const tenentId = IdData.tenentId;
    const userAccessToken = IdData.userAccessToken;
    const userData = await getUserProfileInformation(senderID, tenentId);
    let userName = userData.username;
    if (!userData.username) {
      userName = "Nil";
    }
    let Name = userData.name;
    if (!Name) {
      Name = "Nil";
    }
    let profile_Pic = userData.profile_pic;
    if (!userData.profile_pic) {
      profile_Pic = null;
    }
    console.log("saved username", userName);
    const userid = await Newuser.findOne({
      senderId: senderID,
      tenentId: tenentId,
    })
      .sort({ createdAt: -1 })
      .limit(1);
    if (userid) {
      console.log("SenderID already exists");
      await updateUserProfile(userData, senderID, tenentId);
      status = "old";
    } else {
      console.log("SenderID does not exist");
      status = "new";
      const senderdata = {
        senderId: senderID,
        username: userName,
        profile_pic: profile_Pic,
        name: Name,
        tenentId: tenentId,
      };
      const newuser = new Newuser(senderdata);
      try {
        const savednewuser = await newuser.save();
        console.log("User data saved:", savednewuser);
        await sendNewContact(savednewuser, tenentId, senderID);
      } catch (error) {
        console.error("Error saving user data:", error);
      }
    }
    // Handle the payload
    console.log(`Processing postback payload: ${payload}`);
    const payloadResponse = await handlePayload(
      payload,
      senderID,
      tenentId,
      recipientID,
      title,
      userAccessToken,
      timestamp,
      status,
    );

    // Send response
    if (payloadResponse) {
      console.log("Payload is handled successfulyvalue", payloadResponse);
      console.log("Payload is handled successfuly");
    }
  } catch (error) {
    console.error("Error handling postback:", error);
  }
}

async function shopifycheckProductStock(productName, shopifyCredentials) {
  const accessToken = shopifyCredentials.apiPassword;
  // Use the correct store URL that Shopify is redirecting to
  const storeUrl = shopifyCredentials.storeUrl;
  const apiVersion = "2023-10";
  const graphqlEndpoint = `https://${storeUrl}/admin/api/${apiVersion}/graphql.json`;

  console.log("Searching for product:", productName);

  try {
    const response = await axios.post(
      graphqlEndpoint,
      {
        query: `query {
          products(first: 10, query: "${productName}") {
            edges {
              node {
                id
                title
                handle
                onlineStoreUrl
                priceRange {
                  minVariantPrice {
                    amount
                    currencyCode
                  }
                }
                totalInventory
                status
                variants(first: 5) {
                  edges {
                    node {
                      id
                      title
                      inventoryQuantity
                      price
                    }
                  }
                }
              }
            }
          }
        }`,
      },
      {
        headers: {
          "X-Shopify-Access-Token": accessToken,
          "Content-Type": "application/json",
        },
      },
    );

    // Safe access to response data with proper checks
    if (
      !response.data ||
      !response.data.data ||
      !response.data.data.products ||
      !response.data.data.products.edges
    ) {
      console.log("Invalid response structure:", response.data);
      return {
        success: false,
        message: "No products found",
      };
    }

    const products = response.data.data.products.edges;

    if (products.length === 0) {
      return {
        success: false,
        message: "No products found",
      };
    }

    // Filter and map product details
    const productDetails = products.map((edge) => {
      const product = edge.node;
      const mainVariant = product.variants.edges[0]?.node;
      const price =
        mainVariant?.price || product.priceRange?.minVariantPrice?.amount || 0;

      const inventoryQuantity = mainVariant?.inventoryQuantity || 0;
      const isActive = product.status === "ACTIVE";

      return {
        name: product.title,
        stock_status:
          isActive && inventoryQuantity > 0 ? "instock" : "outofstock",
        price: price,
        permalink:
          product.onlineStoreUrl ||
          `https://${storeUrl}/products/${product.handle}`,
      };
    });

    console.log("Mapped Product Details:", productDetails);

    return {
      success: true,
      data: productDetails,
    };
  } catch (error) {
    console.error("Error fetching product details:", error);
    // Log more detailed error information
    if (error.response) {
      console.error("Response data:", error.response.data);
      console.error("Response status:", error.response.status);
    }

    return {
      success: false,
      message: "Failed to fetch product details. Please try again later.",
      error: error.message,
    };
  }
}

async function shopifygetOrderStatusResponse(orderName, shopifyCredentials) {
  const apiPassword = shopifyCredentials.apiPassword;
  const storeUrl = shopifyCredentials.storeUrl;
  const apiVersion = "2023-10";
  const graphqlEndpoint = `https://${storeUrl}/admin/api/${apiVersion}/graphql.json`;

  console.log("Fetching Shopify order for:", orderName);

  try {
    // 🔹 Step 1: Fetch Order ID Using GraphQL Instead of REST API
    const orderSearchResponse = await axios.post(
      graphqlEndpoint,
      {
        query: `{
          orders(first: 1, query: "name:${orderName}") {
            edges {
              node {
                id
                name
              }
            }
          }
        }`,
      },
      {
        headers: {
          "X-Shopify-Access-Token": apiPassword,
          "Content-Type": "application/json",
        },
      },
    );

    if (!orderSearchResponse.data.data.orders.edges.length) {
      return `⚠️ Order ${orderName} not found. Please check your order number.`;
    }

    const orderId = orderSearchResponse.data.data.orders.edges[0].node.id; // Correct Shopify Order ID
    console.log(`✅ Found Order ID: ${orderId} for Order Name: ${orderName}`);

    // 🔹 Step 2: Fetch Order Details Using the Correct Order ID
    const response = await axios.post(
      graphqlEndpoint,
      {
        query: `{
          order(id: "${orderId}") {
            id
            name
            displayFinancialStatus
            displayFulfillmentStatus
            note
            events(first: 5) {
              edges {
                node {
                  message
                  createdAt
                }
              }
            }
          }
        }`,
      },
      {
        headers: {
          "X-Shopify-Access-Token": apiPassword,
          "Content-Type": "application/json",
        },
      },
    );

    // 🔹 Step 3: Check if order exists
    if (!response.data.data.order) {
      return `⚠️ Order ${orderName} not found.`;
    }

    const order = response.data.data.order;

    // 🔹 Step 4: Build Order Status Message
    let statusMessage = `📦 *Order #${order.name}*\n\n`;
    statusMessage += `✅ Payment: *${order.displayFinancialStatus}*\n`;
    statusMessage += `🚀 Fulfillment: *${order.displayFulfillmentStatus}*\n`;

    if (order.note && order.note.trim()) {
      statusMessage += `\n📝 Note: _"${order.note}"_\n`;
    }

    if (order.events?.edges.length > 0) {
      statusMessage += `\n📌 *Recent Updates:*\n`;
      order.events.edges.forEach((event) => {
        const date = new Date(event.node.createdAt).toLocaleDateString();
        statusMessage += `• ${date}: ${event.node.message}\n`;
      });
    }

    return statusMessage;
  } catch (error) {
    console.error("Shopify API error details:", {
      message: error.message,
      responseStatus: error.response?.status,
      responseData: error.response?.data,
    });

    return "We're unable to fetch your order information right now. Please try again later or contact customer support.";
  }
}

async function wooCommercecheckProductStock(
  productName,
  Productavailabilityurl,
) {
  const siteUrl = Productavailabilityurl.url;
  const consumerKey = Productavailabilityurl.consumerKey;
  const consumerSecret = Productavailabilityurl.consumerSecret;
  const productsApiUrl = `${siteUrl}/wp-json/wc/v3/products`;

  try {
    // Fetch products using WooCommerce API
    const response = await axios.get(productsApiUrl, {
      params: {
        search: productName,
        consumer_key: consumerKey,
        consumer_secret: consumerSecret,
        per_page: 100,
      },
    });
    //console.log("Response for stockstatus:", response);
    const products = response.data;

    // Log response for debugging
    //console.log("Response Data:", products);

    if (!Array.isArray(products) || products.length === 0) {
      return {
        success: false,
        message: "No products found",
      };
    }

    const productDetails = products
      .filter(
        (product) =>
          product.name.toLowerCase().includes(productName.toLowerCase()) &&
          !product.name.toLowerCase().includes("local"), // Exclude products with "local" in the name
      )
      .map((product) => ({
        name: product.name,
        stock_status: product.stock_status,
        price: product.price,
        permalink: product.permalink,
      }));
    // Return mapped data
    console.log("Mapped Product Details:", productDetails);
    return {
      success: true,
      data: productDetails,
    };
  } catch (error) {
    console.error("Error fetching product details:", error.message);
    return {
      success: false,
      message: "Failed to fetch product details. Please try again later.",
      error: error.message,
    };
  }
}

async function wooCommercegetOrderStatusResponse(orderId, OrderStatusurl) {
  const siteUrl = OrderStatusurl.url;
  const consumerKey = OrderStatusurl.consumerKey;
  const consumerSecret = OrderStatusurl.consumerSecret;
  const notesApiUrl = `${siteUrl}/wp-json/wc/v3/orders/${orderId}/notes?consumer_key=${consumerKey}&consumer_secret=${consumerSecret}`;
  console.log("notesApiUrl", notesApiUrl);
  try {
    const response = await axios.get(notesApiUrl);
    const notes = response.data;

    // Filter customer notes
    const customerNotes = notes.filter((note) => note.customer_note);

    if (customerNotes.length === 0) {
      return "No customer notes found for this order";
    }

    // Sort customer notes by date in descending order
    const sortedCustomerNotes = customerNotes.sort(
      (a, b) => new Date(b.date_created) - new Date(a.date_created),
    );

    // Get the most recent note
    const mostRecentNote = sortedCustomerNotes[0];

    return mostRecentNote.note;
  } catch (error) {
    console.error(`Failed to retrieve the last customer note. Error: ${error}`);
    return "We're unable to fetch the order status right now. Please try again later or contact customer support.";
  }
}
async function mongoGetOrderDetailsResponse(orderId, tenentId) {
  try {
    // Use the existing Order model from your schema
    let order = null;

    // First try to find by orderId
    order = await Order.findOne({
      orderId: orderId,
      tenentId: tenentId,
    }).lean();

    // If not found and it's a valid ObjectId, try by _id
    if (!order && mongoose.Types.ObjectId.isValid(orderId)) {
      order = await Order.findOne({
        _id: orderId,
        tenentId: tenentId,
      }).lean();
    }

    if (!order) {
      return `Order #${orderId} not found. Please check the order ID and try again.`;
    }
    console.log("okay for $2");
    // Format the order details for user-friendly response
    const formattedOrder = formatOrderForUserResponse(order);
    return formattedOrder;
  } catch (error) {
    console.error(`Failed to retrieve order details. Error: ${error}`);
    return "We're unable to fetch the order details right now. Please try again later or contact customer support.";
  }
}
function formatWooCommerceOrder(order) {
  const productList = order.line_items
    .map((p) => `- ${p.name} (Qty: ${p.quantity})`)
    .join("\n");

  let result =
    `✅ Found your WooCommerce order!\n\n` +
    `Order ID: #${order.id}\n` +
    `Status: ${order.status.toUpperCase()}\n` +
    `Customer: ${order.billing.first_name} ${order.billing.last_name}\n` +
    `Total: ${order.currency} ${order.total}\n`;

  // Add payment information if available
  if (order.date_paid) {
    const paidDate = new Date(order.date_paid).toLocaleString("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
    });
    result += `Paid on: ${paidDate}\n`;
  }

  if (order.payment_method_title) {
    result += `Payment Method: ${order.payment_method_title}\n`;
  }

  result += `\nProducts in this order:\n${productList}`;

  // Add latest customer note if available
  if (order.latestCustomerNote) {
    result += `\n\n📝 Latest Note:\n${order.latestCustomerNote}`;
  }

  return result;
}

function formatShopifyOrder(order) {
  const productList = order.lineItems.edges
    .map((edge) => `- ${edge.node.title} (Qty: ${edge.node.quantity})`)
    .join("\n");

  return (
    `✅ Found your Shopify order!\n\n` +
    `Order: ${order.name}\n` +
    `Payment Status: ${order.displayFinancialStatus}\n` +
    `Fulfillment: ${order.displayFulfillmentStatus}\n` +
    `Total: ${order.totalPriceSet.shopMoney.currencyCode} ${order.totalPriceSet.shopMoney.amount}\n\n` +
    `Products in this order:\n${productList}`
  );
}

async function findOrderInWooCommerce(phoneNumber, wooCreds) {
  if (!phoneNumber || !wooCreds) return null;
  console.log(`[WooCommerce] Searching for order with phone: ${phoneNumber}`);

  const { url, consumerKey, consumerSecret } = wooCreds;
  const ordersApiUrl = `${url}/wp-json/wc/v3/orders`;

  // Normalize phone number by removing all non-digits and country code
  const normalizePhone = (phone) => {
    if (!phone) return "";
    // Remove all non-digit characters
    let digits = phone.replace(/\D/g, "");
    // Remove leading country code if present (assuming 10 digit phone number)
    if (digits.length > 10) {
      digits = digits.slice(-10);
    }
    return digits;
  };

  const normalizedSearchPhone = normalizePhone(phoneNumber);
  console.log(
    `[WooCommerce] Normalized search phone: ${normalizedSearchPhone}`,
  );

  try {
    const response = await axios.get(ordersApiUrl, {
      params: {
        search: phoneNumber,
        per_page: 20, // Increased to get more results
        orderby: "date",
        order: "desc",
        status: ["processing", "completed", "on-hold"], // Only fetch paid/processing orders
      },
      auth: {
        username: consumerKey,
        password: consumerSecret,
      },
      timeout: 20000,
    });

    console.log(
      `[WooCommerce] Found ${response.data.length} orders in search results`,
    );

    // Find order with matching phone (normalized comparison) and has payment data
    const foundOrder = (response.data || []).find((order) => {
      const orderPhone = normalizePhone(order.billing.phone);
      const hasPaymentData =
        order.date_paid || order.transaction_id || order.status !== "pending";

      console.log(
        `[WooCommerce] Order #${order.id}: Phone match: ${orderPhone ===
          normalizedSearchPhone}, Has payment: ${hasPaymentData}, Status: ${
          order.status
        }`,
      );

      return orderPhone === normalizedSearchPhone && hasPaymentData;
    });

    if (foundOrder) {
      console.log(
        `[WooCommerce] Found PAID order #${foundOrder.id} with matching phone`,
      );
      console.log(
        `[WooCommerce] Order status: ${foundOrder.status}, Date paid: ${foundOrder.date_paid}, Payment method: ${foundOrder.payment_method_title}`,
      );

      // Fetch customer notes for the order
      try {
        const notesApiUrl = `${url}/wp-json/wc/v3/orders/${foundOrder.id}/notes`;
        console.log(`[WooCommerce] Fetching notes from: ${notesApiUrl}`);

        const notesResponse = await axios.get(notesApiUrl, {
          auth: {
            username: consumerKey,
            password: consumerSecret,
          },
          timeout: 20000,
        });

        const notes = notesResponse.data;

        // Filter and sort customer notes
        const customerNotes = notes
          .filter((note) => note.customer_note)
          .sort((a, b) => new Date(b.date_created) - new Date(a.date_created));

        console.log(
          `[WooCommerce] Found ${customerNotes.length} customer notes`,
        );

        // Add customer notes to the order object
        foundOrder.customerNotes = customerNotes;
        foundOrder.latestCustomerNote =
          customerNotes.length > 0 ? customerNotes[0].note : null;

        // Log the latest note for debugging
        if (foundOrder.latestCustomerNote) {
          console.log(
            `[WooCommerce] Latest customer note: ${foundOrder.latestCustomerNote.substring(
              0,
              100,
            )}...`,
          );
        } else {
          console.log(`[WooCommerce] No customer notes found for this order`);
        }
      } catch (notesError) {
        console.error(
          `[WooCommerce] Error fetching notes for order #${foundOrder.id}:`,
          notesError.message,
        );
        foundOrder.customerNotes = [];
        foundOrder.latestCustomerNote = null;
      }

      return foundOrder;
    }

    console.log(`[WooCommerce] No PAID order found with matching phone number`);
    return null;
  } catch (error) {
    console.error(
      "[WooCommerce] Error searching for order:",
      error.response?.data || error.message,
    );
    return null;
  }
}

async function findOrderInShopify(
  phoneNumber,
  instagramUsername,
  shopifyCreds,
) {
  if ((!phoneNumber && !instagramUsername) || !shopifyCreds) return null;

  const { storeUrl, apiPassword } = shopifyCreds;
  const graphqlEndpoint = `https://${storeUrl}/admin/api/2023-10/graphql.json`;

  let searchQuery = "";
  if (phoneNumber) {
    searchQuery = `phone:${phoneNumber}`;
    console.log(`[Shopify] Searching for order with phone: ${phoneNumber}`);
  } else if (instagramUsername) {
    searchQuery = `customer.name:"${instagramUsername}"`;
    console.log(
      `[Shopify] Searching for order with customer name like: ${instagramUsername}`,
    );
  }

  const query = `
        query {
          orders(first: 1, sortKey: PROCESSED_AT, reverse: true, query: "${searchQuery}") {
            edges {
              node {
                id name displayFinancialStatus displayFulfillmentStatus
                totalPriceSet { shopMoney { amount currencyCode } }
                lineItems(first: 10) { edges { node { title quantity } } }
              }
            }
          }
        }`;

  try {
    const response = await axios.post(
      graphqlEndpoint,
      { query },
      {
        headers: {
          "X-Shopify-Access-Token": apiPassword,
          "Content-Type": "application/json",
        },
        timeout: 20000,
      },
    );

    const order = response.data?.data?.orders?.edges?.[0]?.node;
    if (order) {
      console.log(`[Shopify] Found order ${order.name}`);
      return order;
    }
    return null;
  } catch (error) {
    console.error(
      "[Shopify] Error searching for order:",
      error.response?.data || error.message,
    );
    return null;
  }
}
// Helper function to format order details for user response
function formatOrderForUserResponse(order) {
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
    }).format(amount || 0);
  };

  const formatDate = (date) => {
    if (!date) return "N/A";
    return new Date(date).toLocaleDateString("en-IN", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  let response = `📦 Order Details\n\n`;
  response += `🆔 Order ID: ${order.orderId || "N/A"}\n`;
  response += `👤 Customer: ${order.customer_name ||
    order.profile_name ||
    "N/A"}\n`;
  response += `📱 Phone: ${order.phone_number || "N/A"}\n`;
  response += `💰 Total Amount: ${formatCurrency(order.total_amount)}\n`;
  response += `📊 Status: ${(order.status || "N/A").toUpperCase()}\n`;

  if (order.paymentStatus) {
    response += `💳 Payment Status: ${order.paymentStatus.toUpperCase()}\n`;
  }

  if (order.paymentMethod) {
    response += `💳 Payment Method: ${order.paymentMethod}\n`;
  }

  // Add products information
  if (order.products && order.products.length > 0) {
    response += `\n📋 Products:\n`;
    order.products.forEach((product, index) => {
      response += `${index + 1}. ${product.product_name || "N/A"} `;
      response += `(Qty: ${product.quantity || 1}) - ${formatCurrency(
        product.price,
      )}\n`;
    });
  }

  // Add shipping information
  if (order.address || order.city || order.state) {
    response += `\n🚚 Shipping Address:\n`;
    if (order.address) response += `${order.address}\n`;
    if (order.city) response += `${order.city}`;
    if (order.state) response += `, ${order.state}`;
    if (order.zip_code || order.pincode)
      response += ` - ${order.zip_code || order.pincode}`;
    response += `\n`;
  }

  // Enhanced tracking information - show courier and URL for COMPLETED orders
  if (order.tracking_number) {
    const shippingPartner = determineShippingPartner(order.tracking_number);
    const trackingUrl = getTrackingUrl(shippingPartner, order.tracking_number);

    response += `\n📍 Tracking Number: ${order.tracking_number}\n`;

    // Show courier partner and tracking URL for COMPLETED orders
    if (order.status && order.status.toUpperCase() === "COMPLETED") {
      response += `🚛 Courier Partner: ${shippingPartner}\n`;
      response += `🔗 Track Your Order: ${trackingUrl}\n`;
    }
  }

  if (order.tracking_status && order.tracking_status !== "NOT_SHIPPED") {
    response += `🚛 Tracking Status: ${order.tracking_status.replace(
      "_",
      " ",
    )}\n`;
  }

  if (order.packing_status && order.packing_status !== "PENDING") {
    response += `📦 Packing Status: ${order.packing_status.replace(
      "_",
      " ",
    )}\n`;
  }

  // Add customer notes if available
  if (order.customer_notes) {
    response += `\n📝 Customer Notes: ${order.customer_notes}\n`;
  }

  response += `\nLast Updated: ${formatDate(
    order.updated_at || order.created_at,
  )}`;

  return response;
}

// Determine shipping partner from tracking number
function determineShippingPartner(trackingNumber) {
  if (!trackingNumber) return "Unknown";

  const tracking = String(trackingNumber);

  if (tracking.startsWith("7D109")) return "DTDC";
  if (tracking.startsWith("CT")) return "INDIA POST";
  if (tracking.startsWith("C1")) return "DTDC";
  if (tracking.startsWith("58")) return "ST COURIER";
  if (tracking.startsWith("500")) return "TRACKON";
  if (tracking.startsWith("10000")) return "TRACKON";
  if (/^10(?!000)/.test(tracking)) return "TRACKON";
  if (tracking.startsWith("SM")) return "SINGPOST";
  if (tracking.startsWith("33")) return "ECOM";
  if (tracking.startsWith("SR") || tracking.startsWith("EP")) return "EKART";
  if (tracking.startsWith("14")) return "XPRESSBEES";
  if (tracking.startsWith("S")) return "SHIP ROCKET";
  if (tracking.startsWith("1")) return "SHIP ROCKET";
  if (tracking.startsWith("7")) return "DELHIVERY";
  if (tracking.startsWith("JT")) return "J&T";

  return "Unknown";
}

// Get tracking URL based on shipping partner
function getTrackingUrl(shippingPartner, trackingNumber) {
  switch (shippingPartner) {
    case "INDIA POST":
      return `https://www.indiapost.gov.in/_layouts/15/dop.portal.tracking/trackconsignment.aspx`;
    case "ST COURIER":
      return `https://stcourier.com/track/shipment?${trackingNumber}`;
    case "DTDC":
      return `https://www.dtdc.in/trace.asp`;
    case "TRACKON":
      return `https://trackon.in/data/SingleShipment/`;
    case "SHIP ROCKET":
      return `https://www.shiprocket.in/shipment-tracking/`;
    case "DELHIVERY":
      return `https://www.delhivery.com/`;
    case "ECOM":
      return `https://ecomexpress.in/tracking/`;
    case "EKART":
      return `https://ekartlogistics.com/track`;
    case "XPRESSBEES":
      return `https://www.xpressbees.com/track`;
    case "J&T":
      return `https://www.jtexpress.in/`;
    case "SINGPOST":
      return `https://www.singpost.com/track-items`;
    default:
      return `https://www.dtdc.in/trace.asp`;
  }
}
async function createEmbedding(text, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await openai.embeddings.create({
        model: "text-embedding-ada-002",
        input: text.slice(0, 8000), // Limit text length to avoid token limits
      });
      return response.data[0].embedding;
    } catch (error) {
      if (i === retries - 1) throw error;
      await new Promise((resolve) => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
}
async function processBatch(batch, tenentId) {
  try {
    const text = batch.join(" "); // Join batch chunks into text
    const embedding = await createEmbedding(text);
    tenantVectorDBs[tenentId].push({
      text,
      embedding,
    });
    console;
  } catch (error) {
    console.error("Error processing batch:", error);
    throw error;
  }
}

async function processFileInSections(fileStream) {
  const sections = [];
  let currentSection = "";
  const sectionMarkers = [
    "\n\n", // Double line break
    ". ", // End of sentence
    ":", // Start of list/explanation
    "•", // Bullet point
    "##", // Markdown heading
    "|", // Table separator
  ];

  // Create line interface
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  // Process line by line
  for await (const line of rl) {
    // Skip empty lines
    if (!line.trim()) continue;

    // Check if line contains any section markers
    const hasMarker = sectionMarkers.some((marker) => line.includes(marker));

    if (hasMarker) {
      // If current section is getting too large, split it
      if (currentSection.length > 1500) {
        sections.push(currentSection.trim());
        currentSection = "";
      }
      currentSection += line + " ";
    } else {
      currentSection += line + " ";
    }

    // Check section size and split if needed
    if (currentSection.length > 2000) {
      sections.push(currentSection.trim());
      currentSection = "";
    }
  }

  // Add final section if exists
  if (currentSection.trim()) {
    sections.push(currentSection.trim());
  }

  return sections.filter((section) => section.length >= 100);
}

// Function to get embedding for a text
async function createEmbeddingWithCache(text) {
  const cacheKey = crypto
    .createHash("md5")
    .update(text)
    .digest("hex");

  const cached = embeddingsCache.get(cacheKey);
  if (cached) return cached;

  const embedding = await createEmbedding(text);
  embeddingsCache.set(cacheKey, embedding);
  return embedding;
}
function cleanMessage(message) {
  return message
    .replace(/🤖:/, "")
    .replace(
      /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}]/gu,
      "",
    )
    .trim();
}
async function getConversationHistory(tenentId, senderId) {
  const messages = await Message.find({
    tenentId,
    senderId,
    messageType: "text", // Only get text messages
    $or: [
      { message: { $exists: true, $ne: "" } },
      { response: { $exists: true, $ne: "" } },
    ],
  })
    .sort({ Timestamp: -1 })
    .limit(2)
    .lean();

  return messages.reverse().map((msg) => ({
    role: msg.message ? "user" : "assistant",
    content: cleanMessage(msg.message || msg.response),
  }));
}
// Function to find most relevant document (updated for tenant-specific DB)
// Improved relevance search with context window
async function findMostRelevantDocument(queryEmbedding, tenentId) {
  // First check in-memory cache
  let vectorDB = tenantVectorDBs[tenentId];

  // If not in memory, try to get from MongoDB
  if (!vectorDB || vectorDB.length === 0) {
    try {
      vectorDB = await getVectorDB(tenentId);
      if (vectorDB && vectorDB.length > 0) {
        // Cache in memory only if we got data from DB
        tenantVectorDBs[tenentId] = vectorDB;
        //console.log("vectorDB1",vectorDB);
      } else {
        console.log(`No vector data found for tenant ${tenentId} in database`);
        return { doc: null, similarity: 0 };
      }
    } catch (error) {
      console.error(
        `Error retrieving vector data for tenant ${tenentId}:`,
        error,
      );
      return { doc: null, similarity: 0 };
    }
  }

  const CHUNK_SIZE = 1000;
  let maxSimilarity = -Infinity;
  let mostRelevantDoc = null;

  for (let i = 0; i < vectorDB.length; i += CHUNK_SIZE) {
    const chunk = vectorDB.slice(i, Math.min(i + CHUNK_SIZE, vectorDB.length));

    chunk.forEach((doc) => {
      const similarity = cosineSimilarity(queryEmbedding, doc.embedding);
      if (similarity > maxSimilarity) {
        maxSimilarity = similarity;
        mostRelevantDoc = doc;
      }
    });
  }

  return {
    doc: mostRelevantDoc,
    similarity: maxSimilarity !== -Infinity ? maxSimilarity : 0,
  };
}

// Cosine similarity function
function cosineSimilarity(vecA, vecB) {
  const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
  const magnitudeA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
  const magnitudeB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
  return dotProduct / (magnitudeA * magnitudeB);
}
async function aiDetectIntentJSON(userInput, historyMsgs = []) {
  const system = {
    role: "system",
    content: `You are an intent classifier. Return ONLY minified JSON, no extra text.

Schema:
{"intent":"greeting"|"order_status"|"product_inquiry"|"general","args":{...}}

Args Schema for "order_status":
{"orderId":"<string|null>", "phoneNumber":"<10_digit_string|null>"}

Args Schema for "product_inquiry":
{"productName":"<name|null>"}

Intent Classification Rules:

1. "order_status": User wants to track/check order status
   - Must contain: order ID, tracking number, OR 10-digit phone number
   - Keywords: "track", "order status", "where is my order", "order", "delivery"
   - Fill args: {"orderId":"...", "phoneNumber":"..."} (one or both)

2. "product_inquiry": User wants to CHECK AVAILABILITY, PRICE, or SEARCH for products
   - Keywords indicating SEARCH/CHECK: "available", "stock", "price", "cost", "buy", "purchase", "show me", "do you have", "is there"
   - Examples: "is coconut oil available?", "price of henna", "do you have indigo?"
   - Fill args: {"productName":"<product_name>"}

3. "general": Everything else including HOW-TO, USAGE, INSTRUCTIONS
   - Usage questions: "how to use", "eppadi use pannuvathu", "எப்படி", "steps", "apply", "method"
   - Information questions: "benefits", "what is", "tell me about", "review"
   - Examples: "how to use henna?", "henna eppadi use pannuvathu?", "benefits of indigo"
   - Fill args: {}

CRITICAL: If query contains "how to", "eppadi", "எப்படி", "use pannuvathu", "steps", "apply method" → ALWAYS classify as "general" NOT "product_inquiry"

Tamil keywords:
- Usage/How-to: "eppadi", "எப்படி", "use pannuvathu", "use panna", "vidham", "விதம்", "murai", "முறை"
- These always mean "general" intent`,
  };

  const messages = [
    system,
    ...historyMsgs,
    { role: "user", content: userInput },
  ];

  const resp = await axios.post(
    `${deepseekApiUrl}/chat/completions`,
    {
      model: "deepseek-chat",
      messages,
      max_tokens: 120,
      temperature: 0,
      stream: false,
    },
    {
      headers: {
        Authorization: `Bearer ${deepseekApiKey}`,
        "Content-Type": "application/json",
      },
      timeout: 20000,
    },
  );

  const txt = resp?.data?.choices?.[0]?.message?.content?.trim() || "{}";
  try {
    const parsed = JSON.parse(txt);
    if (!parsed || !parsed.intent) throw new Error("invalid schema");

    // Post-processing validation: Override AI if it clearly misclassified
    const low = userInput.toLowerCase();

    // Force "general" for usage/instruction queries
    const usageKeywords = [
      "how to",
      "eppadi",
      "எப்படி",
      "use pannuvathu",
      "use panna",
      "steps",
      "vidham",
      "விதம்",
      "murai",
      "முறை",
      "method",
      "instructions",
      "apply",
      "prayogam",
      "பிரயோகம்",
    ];

    if (
      usageKeywords.some((kw) => low.includes(kw)) &&
      parsed.intent === "product_inquiry"
    ) {
      console.log(
        `[Intent Override] Changed from product_inquiry to general for usage query: "${userInput}"`,
      );
      return { intent: "general", args: {} };
    }

    // Force "product_inquiry" for clear availability/price queries
    const productKeywords = [
      "available",
      "stock",
      "price",
      "cost",
      "rate",
      "kidaikkuma",
      "கிடைக்குமா",
      "vilai",
      "விலை",
      "irukka",
      "இருக்கா",
    ];
    const hasProductKeyword = productKeywords.some((kw) => low.includes(kw));
    const noUsageKeyword = !usageKeywords.some((kw) => low.includes(kw));

    if (parsed.intent === "general" && hasProductKeyword && noUsageKeyword) {
      console.log(
        `[Intent Override] Changed from general to product_inquiry: "${userInput}"`,
      );
      // Extract product name from input (simple extraction)
      const productName = userInput
        .replace(
          /available|stock|price|cost|rate|kidaikkuma|கிடைக்குமா|vilai|விலை|irukka|இருக்கா|is|do you have|\?/gi,
          "",
        )
        .trim();
      return {
        intent: "product_inquiry",
        args: { productName: productName || null },
      };
    }

    return parsed;
  } catch (err) {
    console.error("[aiDetectIntentJSON] Parse error:", err);
    return { intent: "general", args: {} };
  }
}

// ---------- Tiny helpers for fallback extraction ----------
function extractOrderIdLoose(s) {
  if (!s) return null;
  const m =
    String(s).match(/(?:order|track)?\s*#?(\d{4,})/i) ||
    String(s).match(/(\d{4,})#/);
  return m ? m[1] : null;
}
function extractProductNameLoose(s) {
  if (!s) return null;
  // strip common filler words
  return (
    String(s)
      .replace(
        /\b(do you have|is|are|what|how much|price of|stock of|available|show me|looking for|i want|i need|product|item|stock|price|buy|purchase)\b/gi,
        "",
      )
      .replace(/[?!.:,/\\#\-()]/g, " ")
      .replace(/\s+/g, " ")
      .trim() || null
  );
}
function extractPhoneNumber(message) {
  const m = message.replace(/\D/g, ""); // Remove all non-digit characters
  const phoneMatch = m.match(/\d{10}/); // Find a sequence of 10 digits
  return phoneMatch ? phoneMatch[0] : null;
}

function formatMongoOrder(order, { queryIdentifier }) {
  let shippingInfo = "";

  if (order.shipping_partner) {
    if (
      typeof order.shipping_partner === "object" &&
      order.shipping_partner.name
    ) {
      shippingInfo += `Shipping Partner: ${order.shipping_partner.name}\n`;
    } else if (typeof order.shipping_partner === "string") {
      shippingInfo += `Shipping Partner: ${order.shipping_partner}\n`;
    }
  }

  if (order.tracking_number) {
    shippingInfo += `Tracking Number: ${order.tracking_number}\n`;
  }

  const productList = order.products
    .map((p) => `- ${p.product_name || "N/A"} (Qty: ${p.quantity || 1})`)
    .join("\n");

  return (
    `✅ Found the latest order for ${queryIdentifier}!\n\n` +
    `Order ID: #${order.orderId}\n` +
    `Status: ${(order.status || "N/A").toUpperCase()}\n` +
    shippingInfo +
    `Customer: ${order.customer_name || "N/A"}\n` +
    `Total: ₹${order.total_amount || 0}\n\n` +
    `Products in this order:\n${productList}`
  );
}
// Get response from OpenAI based on user input
async function getGptResponse(userInput, tenentId, senderID) {
  try {
    console.log("userInput for gpt", userInput);

    // Greetings / small-talk short-circuit
    const low = userInput.toLowerCase().trim();
    if (["hi", "hello", "hey"].includes(low)) {
      return "Helloo 🤩, How can I help you?";
    }
    if (["who are you", "what are you"].includes(low)) {
      return "I'm an AI assistant here to help you with your queries about our products and services. How can I assist you?";
    }

    // Hints for follow-ups
    const priceRelatedTerms = ["rate", "price", "cost", "how much"];
    const stockRelatedTerms = [
      "stock",
      "available",
      "out of stock",
      "in stock",
      "availability",
      "is it available",
      "when will be available",
    ];
    const isAskingPrice = priceRelatedTerms.some((term) => low.includes(term));
    const isAskingStock = stockRelatedTerms.some((term) => low.includes(term));
    console.log("isAskingPrice", isAskingPrice);

    // Load business/user name
    const signupdata = await Signup.findOne({ tenentId })
      .sort({ createdAt: -1 })
      .limit(1);
    const brandUsername = signupdata?.name || "Our Store";

    // ---------- Special symbol short-circuits (#, *, $) ----------
    if (
      userInput.includes("#") ||
      userInput.includes("*") ||
      userInput.includes("$")
    ) {
      try {
        if (userInput.includes("$")) {
          const orderId = userInput.split("$")[0]?.trim();
          if (!orderId)
            return "Invalid format. Please enter valid order ID followed by $ (e.g., 12345$).";
          if (!tenentId)
            return "No tenant ID available to check order details.";
          if (typeof mongoGetOrderDetailsResponse === "function") {
            return await mongoGetOrderDetailsResponse(orderId, tenentId);
          }
          return "Order details function not available.";
        }
        const storeCredentials = await ecommerceCredentialsService.getCredentialsForAPI(
          tenentId,
        );
        if (!storeCredentials?.websites?.length) {
          return "No store credentials found for this account.";
        }
        const woo =
          storeCredentials.websites.find((w) => w.type === "woocommerce")
            ?.credentials || null;
        const shop =
          storeCredentials.websites.find((w) => w.type === "shopify")
            ?.credentials || null;

        // ORDER STATUS: "12345#"
        if (userInput.includes("#")) {
          const orderId = userInput.split("#")[0]?.trim();
          if (!orderId)
            return "Invalid format. Please enter valid order ID followed by # (e.g., 12345#).";
          if (woo) return await wooCommercegetOrderStatusResponse(orderId, woo);
          if (shop && typeof shopifygetOrderStatusResponse === "function") {
            return await shopifygetOrderStatusResponse(orderId, shop);
          }
          return "No store credentials available to check order status.";
        }

        // PRODUCT LOOKUP: "coconut oil*"
        if (userInput.includes("*")) {
          const productName = userInput.split("*")[0]?.trim();
          if (!productName)
            return "Invalid format. Please enter product name followed by * (e.g., coconut oil*).";

          let result = null;
          if (woo)
            result = await wooCommercecheckProductStock(productName, woo);
          else if (shop && typeof shopifycheckProductStock === "function")
            result = await shopifycheckProductStock(productName, shop);
          else return "No store credentials available to check product stock.";

          if (
            !result?.success ||
            !Array.isArray(result.data) ||
            result.data.length === 0
          ) {
            return "No matching products found.";
          }
          return result.data
            .map((p) => {
              const stock =
                p.stock_status === "instock" ? "AVAILABLE" : "OUT OF STOCK";
              return `🍀 ${p.name} is ${stock}! 🛒\nPrice: ₹${p.price}\nExplore: ${p.permalink}`;
            })
            .join("\n\n");
        }

        // ORDER DETAILS FROM MONGO: "12345$"
        if (userInput.includes("$")) {
          const orderId = userInput.split("$")[0]?.trim();
          if (!orderId)
            return "Invalid format. Please enter valid order ID followed by $ (e.g., 12345$).";
          if (!tenentId)
            return "No tenant ID available to check order details.";
          if (typeof mongoGetOrderDetailsResponse === "function") {
            return await mongoGetOrderDetailsResponse(orderId, tenentId);
          }
          return "Order details function not available.";
        }
      } catch (e) {
        console.error("Error in symbol short-circuit block:", e);
        // fall-through to AI detection
      }
    }

    // ---------- AI-powered intent detection ----------
    const historyMsgs = await getConversationHistory(tenentId, senderID);
    const aiIntent = await aiDetectIntentJSON(userInput, historyMsgs);
    const intent = aiIntent.intent || "general";
    const args = aiIntent.args || {};

    // --- UPDATED LOGIC: fallback extraction for missing fields ---
    if (intent === "order_status") {
      if (!args.orderId) {
        args.orderId = extractOrderIdLoose(userInput);
      }
      if (!args.phoneNumber) {
        args.phoneNumber = extractPhoneNumber(userInput);
      }
    }

    if (intent === "product_inquiry") {
      if (!args.productName) {
        args.productName = extractProductNameLoose(userInput);
      }
    }

    // ---------- Execute tool intents ----------
    if (intent === "order_status") {
      if (!args.orderId && !args.phoneNumber) {
        return "Please share your order number (e.g., 12345#) or your 10-digit phone number.";
      }

      const storeCredentials = await ecommerceCredentialsService.getCredentialsForAPI(
        tenentId,
      );
      const woo =
        storeCredentials?.websites?.find((w) => w.type === "woocommerce")
          ?.credentials || null;
      const shop =
        storeCredentials?.websites?.find((w) => w.type === "shopify")
          ?.credentials || null;

      let foundOrder = null;

      // Handle Order ID lookup
      if (args.orderId && !foundOrder) {
        const orderId = args.orderId;

        // Check MongoDB
        const escapedOrderId = orderId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const mongoOrder = await Order.findOne({
          tenentId,
          orderId: { $regex: new RegExp(`^${escapedOrderId}$`, "i") },
        });

        if (mongoOrder) {
          console.log("[Orchestrator] Found order in MongoDB by orderId.");
          foundOrder = formatMongoOrder(mongoOrder, {
            queryIdentifier: `ID #${orderId}`,
          });
        }

        // Check WooCommerce
        if (woo && !foundOrder) {
          console.log("woo for orderId", woo);
          const status = await wooCommercegetOrderStatusResponse(orderId, woo);
          if (
            !status.toLowerCase().includes("unable") &&
            !status.toLowerCase().includes("not found")
          ) {
            foundOrder = `📦 Order Status for #${orderId}\n\n${status}\n\nAnything else I can help with?`;
          }
        }

        // Check Shopify
        if (shop && !foundOrder) {
          const status = await shopifygetOrderStatusResponse(orderId, shop);
          if (
            !status.toLowerCase().includes("unable") &&
            !status.toLowerCase().includes("not found")
          ) {
            foundOrder = `📦 Order Status for #${orderId}\n\n${status}\n\nAnything else I can help with?`;
          }
        }
      }

      // Handle Phone Number lookup (only if not found by orderId)
      if (args.phoneNumber && !foundOrder) {
        const phoneNumber = args.phoneNumber;
        console.log("phoneNumber", phoneNumber);

        // Check MongoDB
        const mongoOrder = await Order.findOne({
          tenentId,
          phone_number: phoneNumber,
        }).sort({ created_at: -1 });

        if (mongoOrder) {
          console.log("[Orchestrator] Found order in MongoDB by phone.");
          foundOrder = formatMongoOrder(mongoOrder, {
            queryIdentifier: `Phone ${phoneNumber}`,
          });
        }

        // Check WooCommerce
        if (woo && !foundOrder) {
          console.log("woo for phoneNumber", woo);
          const wooOrder = await findOrderInWooCommerce(phoneNumber, woo);
          if (wooOrder) {
            foundOrder = formatWooCommerceOrder(wooOrder);
          }
        }

        // Check Shopify
        if (shop && !foundOrder) {
          const shopifyOrder = await findOrderInShopify(
            phoneNumber,
            null,
            shop,
          );
          if (shopifyOrder) {
            foundOrder = formatShopifyOrder(shopifyOrder);
          }
        }
      }

      // Return result or error message
      if (foundOrder) {
        return foundOrder;
      }

      // No store connections available
      if (!woo && !shop) {
        return "Store connection isn't configured yet. Please connect your store to check order status.";
      }

      // Build specific error message based on what was provided
      if (args.orderId && args.phoneNumber) {
        return `Sorry, I couldn't find an order with ID #${args.orderId} or phone number ${args.phoneNumber}.`;
      } else if (args.orderId) {
        return `Sorry, I couldn't find an order with ID #${args.orderId}.`;
      } else {
        return "Couldn't find an order linked to that phone number.";
      }
    }

    if (intent === "product_inquiry") {
      if (!args.productName) {
        return "What product are you looking for? Please mention the product name (e.g., coconut oil).";
      }

      const storeCredentials = await ecommerceCredentialsService.getCredentialsForAPI(
        tenentId,
      );
      const woo =
        storeCredentials?.websites?.find((w) => w.type === "woocommerce")
          ?.credentials || null;
      const shop =
        storeCredentials?.websites?.find((w) => w.type === "shopify")
          ?.credentials || null;

      let result = null;
      if (woo)
        result = await wooCommercecheckProductStock(args.productName, woo);
      else if (shop && typeof shopifycheckProductStock === "function")
        result = await shopifycheckProductStock(args.productName, shop);
      else
        return "Store connection isn't configured yet. Please connect your store to search products.";

      if (result?.success && result.data?.length) {
        const top = result.data.slice(0, 5);
        let out = `🛍️ Found ${result.data.length} product(s) for “${args.productName}”:\n\n`;
        top.forEach((p, i) => {
          out += `${i + 1}. ${p.name}\n   💰 Price: ${
            p.price ? `₹${p.price}` : "—"
          }\n   📦 Stock: ${
            p.stock_status === "instock" ? "✅ In Stock" : "❌ Out of Stock"
          }\n   🔗 ${p.permalink}\n\n`;
        });
        if (result.data.length > 5)
          out += `...and ${result.data.length - 5} more.\n`;
        out += `Need anything else? 😊`;
        return out;
      }
      console.log(
        `[Product Inquiry] No products found for "${args.productName}", redirecting to general Q&A`,
      );
    }

    // ---------- General Q&A ----------
    const inputEmbedding = await createEmbedding(userInput.toLowerCase());
    const { doc: relevantDoc, similarity } = await findMostRelevantDocument(
      inputEmbedding,
      tenentId,
    );
    const conversationHistory = historyMsgs;

    const systemPrompt = {
      role: "system",
      content: `You are a professional customer service AI assistant for ${brandUsername}'s business.
Provide accurate, relevant, and concise responses based ONLY on the provided context below.

Context: ${relevantDoc?.text || ""}

Rules:
- Keep answers short and context-based.
- Don’t make assumptions or share programming/code answers.
- Respond only about ${brandUsername}'s products.
- Respond in Tamil if user uses Tamil script, else in English.`,
    };

    const messages = [
      systemPrompt,
      ...conversationHistory,
      { role: "user", content: userInput },
    ];

    const response = await axios.post(
      `${deepseekApiUrl}/chat/completions`,
      { model: "deepseek-chat", messages, max_tokens: 200, temperature: 0.7 },
      {
        headers: {
          Authorization: `Bearer ${deepseekApiKey}`,
          "Content-Type": "application/json",
        },
        timeout: 30000,
      },
    );

    let responseText =
      response?.data?.choices?.[0]?.message?.content?.trim() ||
      "How can I help you today?";
    const sorryPhrases = [
      "I'm sorry",
      "unable to provide",
      "cannot find any information",
      "I don't have any information",
      "I couldn't find",
    ];
    if (
      sorryPhrases.some((phrase) =>
        responseText.toLowerCase().includes(phrase.toLowerCase()),
      )
    ) {
      responseText +=
        " If you’d like to talk to a human agent, open the menu and choose 'Human Agent'.";
    }

    if (
      signupdata == "Vaseegrah Veda" &&
      signupdata == "Vaseegrahveda" &&
      brandUsername !== "Techvaseegrah"
    ) {
      const parts = [responseText];
      if (isAskingPrice) {
        parts.push(
          "To view a product price, type its name followed by * (e.g., coconut oil*).",
        );
      }
      if (isAskingStock) {
        parts.push(
          "To know stock status, type the product name followed by * (e.g., coconut oil*).",
        );
      }
      responseText = parts.join(" ");
    }

    return responseText;
  } catch (error) {
    console.error("Failed in getGptResponse:", error);
    return "I'm sorry, something went wrong. Please contact support or ask to connect to a human agent.";
  }
}

async function comment_response(userInput, tenentId, senderID) {
  console.log("userInput for gpt", userInput);

  if (["hi", "hello", "hey"].includes(userInput.toLowerCase().trim())) {
    return "Helloo 🤩, How can I help you?";
  }

  const priceRelatedTerms = ["rate", "price", "cost", "how much"];
  const isAskingPrice = priceRelatedTerms.some((term) =>
    userInput.toLowerCase().includes(term),
  );
  console.log("isAskingPrice", isAskingPrice);
  const stockRelatedTerms = [
    "stock",
    "available",
    "out of stock",
    "in stock",
    "availability",
    "is it available",
    "when will be available",
  ];
  const isAskingStock = stockRelatedTerms.some((term) =>
    userInput.toLowerCase().includes(term),
  );
  const signupdata = await Signup.findOne({ tenentId: tenentId })
    .sort({ createdAt: -1 })
    .limit(1);
  let username;

  if (signupdata) {
    username = signupdata.name;
    let response;
    if (
      userInput.includes("#") ||
      userInput.includes("*") ||
      userInput.includes("$")
    ) {
      console.log("userinput have# & *");
      try {
        if (userInput.includes("$")) {
          // Action to take if '$' is found in user_input
          const orderId = userInput.split("$")[0];
          if (!orderId) {
            return "Invalid format. Please enter a valid order ID followed by $ (e.g., 12345$).";
          }

          // Try to get order details from MongoDB
          if (tenentId) {
            // Make sure you have tenentId available in your context
            response = await mongoGetOrderDetailsResponse(orderId, tenentId);
            console.log("okay for $");
          } else {
            return "No tenant ID available to check order details.";
          }

          console.log("The input contains a '$' character.");
          return response;
        }
        const storeCredentials = await ecommerceCredentialsService.getCredentialsForAPI(
          tenentId,
        );

        if (
          storeCredentials &&
          storeCredentials.websites &&
          storeCredentials.websites.length > 0
        ) {
          // Find WooCommerce and Shopify credentials if they exist
          const wooCommerceWebsite = storeCredentials.websites.find(
            (website) => website.type === "woocommerce",
          );
          const shopifyWebsite = storeCredentials.websites.find(
            (website) => website.type === "shopify",
          );

          // Only access credentials if the website exists
          const wooCredentials = wooCommerceWebsite
            ? wooCommerceWebsite.credentials
            : null;
          const shopifyCredentials = shopifyWebsite
            ? shopifyWebsite.credentials
            : null;
          console.log("wooCredentials", wooCredentials);
          // Log available credentials
          if (wooCredentials) console.log("WooCommerce credentials found");
          if (shopifyCredentials) console.log("Shopify credentials found");

          if (userInput.includes("#")) {
            // Action to take if '#' is found in user_input
            const orderId = userInput.split("#")[0];
            if (!orderId) {
              return "Invalid format. Please enter a valid order ID followed by # (e.g., 12345#).";
            }

            // Try to get order status using available credentials
            if (wooCredentials) {
              response = await wooCommercegetOrderStatusResponse(
                orderId,
                wooCredentials,
              );
            } else if (shopifyCredentials) {
              response = await shopifygetOrderStatusResponse(
                orderId,
                shopifyCredentials,
              );
            } else {
              return "No store credentials available to check order status.";
            }

            console.log("The input contains a '#' character.");
            return response;
          }
          if (userInput.includes("$")) {
            // Action to take if '$' is found in user_input
            const orderId = userInput.split("$")[0];
            if (!orderId) {
              return "Invalid format. Please enter a valid order ID followed by $ (e.g., 12345$).";
            }

            // Try to get order details from MongoDB
            if (tenentId) {
              // Make sure you have tenentId available in your context
              response = await mongoGetOrderDetailsResponse(orderId, tenentId);
              console.log("okay for $");
            } else {
              return "No tenant ID available to check order details.";
            }

            console.log("The input contains a '$' character.");
            return response;
          }
          if (userInput.includes("*")) {
            // Extract the product name
            const productName = userInput.split("*")[0];
            if (!productName) {
              return "Invalid format. Please enter a valid product name followed by * (e.g., productName*).";
            }

            // Try to check product stock using available credentials
            let productResponse;
            if (wooCredentials) {
              productResponse = await wooCommercecheckProductStock(
                productName,
                wooCredentials,
              );
            } else if (shopifyCredentials) {
              productResponse = await shopifycheckProductStock(
                productName,
                shopifyCredentials,
              );
            } else {
              return "No store credentials available to check product stock.";
            }

            console.log("The input contains a '*' character.");
            console.log("Product Stock", productResponse);

            if (
              !productResponse ||
              !productResponse.success ||
              !productResponse.data ||
              productResponse.data.length === 0
            ) {
              return "No matching products found.";
            }

            // Iterate over all products and build the response
            const productDetails = productResponse.data
              .map((product) => {
                const name = product.name;
                const stock_status1 =
                  product.stock_status === "instock"
                    ? "AVAILABLE"
                    : "OUT OF STOCK";
                const price = product.price;
                const link = product.permalink;
                return `🍀 ${name} is ${stock_status1}!🛒\n\nPrice: ₹${price} \n\nExplore it here: ${link}\n`;
              })
              .join("\n\n");

            return productDetails;
          }
        } else {
          return "No store credentials found for this account.";
        }
      } catch (error) {
        console.error(
          "Error retrieving or processing store credentials:",
          error,
        );
        return;
      }
    }
  }

  return "Helloo 🤩, How can I help you?";
}

// Instagram sending function

// Email Notification Function
async function sendEmailAlert(userEmail, senderID) {
  try {
    const userData = await Newuser.findOne({ senderId: senderID })
      .sort({ createdAt: -1 })
      .limit(1);
    let name = userData.name;
    console.log("name", name);
    if (name == "Nil") {
      name = userData.username;
    }
    const username = name || "Unknown User";

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    await transporter.sendMail({
      from: '"Support Team" <support@example.com>',
      to: userEmail,
      subject: "Human Agent Requested",
      text: `User ${username} has requested human assistance. Please respond promptly.`,
    });

    console.log(`Email alert sent to ${userEmail}`);
  } catch (error) {
    console.error("Email alert error:", error);
    throw error;
  }
}
setInterval(cleanupMessageTracker, 30 * 60 * 1000); // Every 30 minutes
function logMemoryUsage() {
  const memoryUsage = process.memoryUsage();
  console.log("\n🖥️  === System Performance Stats ===");
  console.log("💾 Memory Usage:", {
    rss: `${Math.round(memoryUsage.rss / 1024 / 1024)} MB`,
    heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)} MB`,
    heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)} MB`,
  });

  // Log rate limit stats for active tenants
  console.log("\n📊 Rate Limiter Stats:");

  // Log engaged users summary
  let totalEngagedUsers = 0;
  rateLimiter.engagedUsers.forEach((userMap, key) => {
    totalEngagedUsers += userMap.size;
    const limit = rateLimiter.getPlatformRateLimit(...key.split("_"));
    console.log(`🏢 ${key}: ${userMap.size} engaged users → ${limit} calls/hr`);
  });
  console.log(`👥 Total Engaged Users: ${totalEngagedUsers}`);

  // Log API usage
  console.log("\n📡 API Usage:");
  rateLimiter.conversationsApiCalls.forEach((data, key) => {
    console.log(
      `  📞 Conversations ${key}: ${data.timestamps.length}/${RATE_LIMITS.CONVERSATIONS_API.CALLS_PER_SECOND}/sec`,
    );
  });

  rateLimiter.sendApiTextCalls.forEach((data, key) => {
    console.log(
      `  💬 Send Text ${key}: ${data.timestamps.length}/${RATE_LIMITS.SEND_API.TEXT_CALLS_PER_SECOND}/sec`,
    );
  });

  rateLimiter.sendApiMediaCalls.forEach((data, key) => {
    console.log(
      `  🖼️  Send Media ${key}: ${data.timestamps.length}/${RATE_LIMITS.SEND_API.MEDIA_CALLS_PER_SECOND}/sec`,
    );
  });

  rateLimiter.privateRepliesPostCalls.forEach((data, key) => {
    console.log(
      `  💭 Private Replies ${key}: ${data.timestamps.length}/${RATE_LIMITS.PRIVATE_REPLIES_API.POST_CALLS_PER_HOUR}/hr`,
    );
  });

  rateLimiter.platformApiCalls.forEach((data, key) => {
    console.log(
      `  🌐 Platform ${key}: ${data.timestamps.length}/${data.limit || 200}/hr`,
    );
  });

  // Log message queue stats
  console.log("\n📬 Message Queue Stats:");
  messageQueue.forEach((queue, tenantId) => {
    console.log(`  ${tenantId}: ${queue.length} messages in queue`);
  });

  console.log("=====================================\n");
}

setInterval(logMemoryUsage, 10 * 60 * 1000);
// Export router
module.exports = router;
