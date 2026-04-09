// services/rateLimitService.js
const EngagedUser = require('../models/EngagedUser');

const RATE_LIMITS = {
  CONVERSATIONS_API: { CALLS_PER_SECOND: 2, INTERVAL_MS: 1000 },
  SEND_API: { TEXT_CALLS_PER_SECOND: 300, MEDIA_CALLS_PER_SECOND: 10, INTERVAL_MS: 1000 },
  PRIVATE_REPLIES_API: {
    LIVE_CALLS_PER_SECOND: 100,
    POST_CALLS_PER_HOUR: 750,
    INTERVAL_SECOND_MS: 1000,
    INTERVAL_HOUR_MS: 3600000,
  },
  PLATFORM_API: { CALLS_PER_USER_PER_HOUR: 200, INTERVAL_HOUR_MS: 3600000 }
};

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
    setInterval(() => this.cleanupRateLimits(), 60 * 1000);       // Cleanup every 1 min
    setInterval(() => this.logRateLimitStats(), 10 * 60 * 1000);  // Log stats every 10 min
    setInterval(() => this.syncEngagedUsers(), 5 * 60 * 1000);    // Sync engaged users every 5 min
  }

  // **PROPERLY RECORD ENGAGED USERS**
  recordEngagedUser(tenentId, accountId, userId) {
    if (!tenentId || !accountId || !userId) {
      console.error('recordEngagedUser missing parameters:', { tenentId, accountId, userId });
      return;
    }

    const key = `${tenentId}_${accountId}`;
    if (!this.engagedUsers.has(key)) {
      this.engagedUsers.set(key, new Map());
    }

    const now = Date.now();
    this.engagedUsers.get(key).set(userId, now);

    console.log(`✅ Recorded engaged user: ${userId} for tenant ${tenentId} at ${new Date(now).toISOString()}`);

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
              updatedAt: new Date()
            },
            $inc: { engagementCount: 1 }
          },
          { upsert: true, new: true }
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
        lastActivity: { $gte: cutoffTime }
      }).select('tenentId accountId senderId lastActivity');

      for (const user of recentUsers) {
        const key = `${user.tenentId}_${user.accountId}`;
        if (!this.engagedUsers.has(key)) {
          this.engagedUsers.set(key, new Map());
        }
        this.engagedUsers.get(key).set(user.senderId, user.lastActivity.getTime());
      }

      console.log(`✅ Loaded ${recentUsers.length} engaged users from database`);
    } catch (error) {
      console.error('❌ Error loading engaged users from database:', error);
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
    const dynamicLimit = RATE_LIMITS.PLATFORM_API.CALLS_PER_USER_PER_HOUR * activeEngagedUsers;

    console.log(`📊 Platform rate limit for ${key}: ${dynamicLimit} calls/hr (${activeEngagedUsers} engaged users)`);
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
    data.timestamps = data.timestamps.filter(ts => now - ts < RATE_LIMITS.PLATFORM_API.INTERVAL_HOUR_MS);

    // Update the current limit
    data.limit = dynamicLimit;

    if (data.timestamps.length >= dynamicLimit) {
      console.warn(`⚠️  Platform rate limit exceeded for ${key}: ${data.timestamps.length}/${dynamicLimit} in last hour`);
      return false;
    }

    data.timestamps.push(now);
    console.log(`✅ Platform API call recorded for ${key}: ${data.timestamps.length}/${dynamicLimit}`);
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
    data.timestamps = data.timestamps.filter(ts => now - ts < RATE_LIMITS.CONVERSATIONS_API.INTERVAL_MS);

    if (data.timestamps.length >= RATE_LIMITS.CONVERSATIONS_API.CALLS_PER_SECOND) {
      console.warn(`⚠️  Conversations API rate limit exceeded for ${key}: ${data.timestamps.length}/${RATE_LIMITS.CONVERSATIONS_API.CALLS_PER_SECOND} per second`);
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
    data.timestamps = data.timestamps.filter(ts => now - ts < RATE_LIMITS.SEND_API.INTERVAL_MS);

    if (data.timestamps.length >= RATE_LIMITS.SEND_API.TEXT_CALLS_PER_SECOND) {
      console.warn(`⚠️  Send API (Text) rate limit exceeded for ${key}: ${data.timestamps.length}/${RATE_LIMITS.SEND_API.TEXT_CALLS_PER_SECOND} per second`);
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
    data.timestamps = data.timestamps.filter(ts => now - ts < RATE_LIMITS.SEND_API.INTERVAL_MS);

    if (data.timestamps.length >= RATE_LIMITS.SEND_API.MEDIA_CALLS_PER_SECOND) {
      console.warn(`⚠️  Send API (Media) rate limit exceeded for ${key}: ${data.timestamps.length}/${RATE_LIMITS.SEND_API.MEDIA_CALLS_PER_SECOND} per second`);
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
    data.timestamps = data.timestamps.filter(ts => now - ts < RATE_LIMITS.PRIVATE_REPLIES_API.INTERVAL_HOUR_MS);

    if (data.timestamps.length >= RATE_LIMITS.PRIVATE_REPLIES_API.POST_CALLS_PER_HOUR) {
      console.warn(`⚠️  Private Replies Post call rate limit exceeded for ${key}: ${data.timestamps.length}/${RATE_LIMITS.PRIVATE_REPLIES_API.POST_CALLS_PER_HOUR} per hour`);
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
    data.timestamps = data.timestamps.filter(ts => now - ts < RATE_LIMITS.PRIVATE_REPLIES_API.INTERVAL_SECOND_MS);

    if (data.timestamps.length >= RATE_LIMITS.PRIVATE_REPLIES_API.LIVE_CALLS_PER_SECOND) {
      console.warn(`⚠️  Private Replies Live call rate limit exceeded for ${key}: ${data.timestamps.length}/${RATE_LIMITS.PRIVATE_REPLIES_API.LIVE_CALLS_PER_SECOND} per second`);
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
        data.timestamps = data.timestamps.filter(ts => now - ts < intervalMs);
        if (data.timestamps.length === 0) {
          apiCallsMap.delete(key);
        }
      });
    };

    cleanupApiCalls(this.conversationsApiCalls, RATE_LIMITS.CONVERSATIONS_API.INTERVAL_MS);
    cleanupApiCalls(this.sendApiTextCalls, RATE_LIMITS.SEND_API.INTERVAL_MS);
    cleanupApiCalls(this.sendApiMediaCalls, RATE_LIMITS.SEND_API.INTERVAL_MS);
    cleanupApiCalls(this.privateRepliesPostCalls, RATE_LIMITS.PRIVATE_REPLIES_API.INTERVAL_HOUR_MS);
    cleanupApiCalls(this.platformApiCalls, RATE_LIMITS.PLATFORM_API.INTERVAL_HOUR_MS);

    console.log('🧹 Rate limit cleanup completed');
  }

  // **COMPREHENSIVE LOGGING**
  logRateLimitStats() {
    console.log('\n📊 === Rate Limit Stats ===');

    // Log engaged users per tenant
    this.engagedUsers.forEach((userMap, key) => {
      const limit = this.getPlatformRateLimit(...key.split('_'));
      console.log(`🏢 ${key}: ${userMap.size} engaged users → ${limit} calls/hour limit`);
    });

    // Log API usage
    console.log('\n📡 API Usage:');
    this.conversationsApiCalls.forEach((data, key) => {
      console.log(`  📞 Conversations API ${key}: ${data.timestamps.length}/${RATE_LIMITS.CONVERSATIONS_API.CALLS_PER_SECOND}/sec`);
    });

    this.sendApiTextCalls.forEach((data, key) => {
      console.log(`  💬 Send API Text ${key}: ${data.timestamps.length}/${RATE_LIMITS.SEND_API.TEXT_CALLS_PER_SECOND}/sec`);
    });

    this.sendApiMediaCalls.forEach((data, key) => {
      console.log(`  🖼️  Send API Media ${key}: ${data.timestamps.length}/${RATE_LIMITS.SEND_API.MEDIA_CALLS_PER_SECOND}/sec`);
    });

    this.privateRepliesPostCalls.forEach((data, key) => {
      console.log(`  💭 Private Replies ${key}: ${data.timestamps.length}/${RATE_LIMITS.PRIVATE_REPLIES_API.POST_CALLS_PER_HOUR}/hour`);
    });

    this.platformApiCalls.forEach((data, key) => {
      console.log(`  🌐 Platform API ${key}: ${data.timestamps.length}/${data.limit || 200}/hour`);
    });

    console.log('=========================\n');
  }

  // **SYNC ENGAGED USERS TO DATABASE**
  async syncEngagedUsers() {
    try {
      const bulkOperations = [];
      const now = new Date();

      this.engagedUsers.forEach((userMap, tenantAccountKey) => {
        const [tenentId, accountId] = tenantAccountKey.split('_');

        userMap.forEach((lastActive, userId) => {
          bulkOperations.push({
            updateOne: {
              filter: { tenentId, accountId, senderId: userId },
              update: {
                $set: {
                  lastActivity: new Date(lastActive),
                  updatedAt: now
                },
                $inc: { engagementCount: 1 }
              },
              upsert: true
            }
          });
        });
      });

      if (bulkOperations.length > 0) {
        await EngagedUser.bulkWrite(bulkOperations);
        console.log(`✅ Synced ${bulkOperations.length} engaged user records to database`);
      }
    } catch (error) {
      console.error('❌ Error syncing engaged users to database:', error);
    }
  }
}

// Create singleton instance
const rateLimiter = new RateLimiter();

module.exports = rateLimiter;
