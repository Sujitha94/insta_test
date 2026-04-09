const express = require('express');
const router = express.Router();
const ApiKey = require('../models/ApiKey');
const ApiKeyUsage = require('../models/ApiKeyUsage');

// Get all API keys for tenant
router.get('/', async (req, res) => {
  try {
    const { tenentId } = req.query;
    
    if (!tenentId) {
      return res.status(400).json({ success: false, error: 'tenentId is required' });
    }
    
    const apiKeys = await ApiKey.find({
      tenentId: tenentId,
      revokedAt: null
    }).select('-hashedKey -key').sort({ createdAt: -1 });
    
    res.json({
      success: true,
      apiKeys: apiKeys.map(key => ({
        id: key._id,
        name: key.name,
        prefix: key.prefix,
        permissions: key.permissions,
        isActive: key.isActive,
        lastUsedAt: key.lastUsedAt,
        usageCount: key.usageCount,
        expiresAt: key.expiresAt,
        createdAt: key.createdAt
      }))
    });
  } catch (error) {
    console.error('Error fetching API keys:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch API keys' });
  }
});

// Create new API key
router.post('/', async (req, res) => {
  try {
    const {
      tenentId,
      name,
      permissions = ['orders.read', 'messages.send'],
      expiresInDays,
      rateLimit,
      webhookUrl
    } = req.body;
    
    if (!tenentId) {
      return res.status(400).json({ success: false, error: 'tenentId is required' });
    }
    
    if (!name) {
      return res.status(400).json({ success: false, error: 'API key name is required' });
    }
    
    // Generate new API key
    const { key, hashedKey, prefix } = ApiKey.generateKey();
    
    // Calculate expiration date if specified
    let expiresAt = null;
    if (expiresInDays && expiresInDays > 0) {
      expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expiresInDays);
    }
    
    // Build rate limit object matching schema structure
    const rateLimitConfig = {};
    if (rateLimit && rateLimit.maxRequests) {
      rateLimitConfig.requestsPerMinute = parseInt(rateLimit.maxRequests) || 60;
      if (rateLimit.windowMs) {
        const minutesInWindow = parseInt(rateLimit.windowMs) / (60 * 1000);
        rateLimitConfig.requestsPerDay = Math.floor((1440 / minutesInWindow) * rateLimitConfig.requestsPerMinute);
      } else {
        rateLimitConfig.requestsPerDay = rateLimitConfig.requestsPerMinute * 1440; // 24 hours
      }
    }
    
    // Create API key
    const apiKey = new ApiKey({
      tenentId: tenentId,
      name,
      key,
      hashedKey,
      prefix,
      permissions,
      expiresAt,
      rateLimit: Object.keys(rateLimitConfig).length > 0 ? rateLimitConfig : undefined,
      webhookUrl
    });
    
    await apiKey.save();
    
    // Return the full key only once
    res.status(201).json({
      success: true,
      message: 'API key created successfully. Please save this key securely - it will not be shown again.',
      apiKey: {
        id: apiKey._id,
        name: apiKey.name,
        key: key, // ⚠️ Only shown once!
        prefix: apiKey.prefix,
        permissions: apiKey.permissions,
        expiresAt: apiKey.expiresAt,
        createdAt: apiKey.createdAt
      }
    });
  } catch (error) {
    console.error('Error creating API key:', error);
    res.status(500).json({ success: false, error: 'Failed to create API key', details: error.message });
  }
});

// Update API key
router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { tenentId, name, permissions, isActive, rateLimit, webhookUrl } = req.body;
    
    if (!tenentId) {
      return res.status(400).json({ success: false, error: 'tenentId is required' });
    }
    
    const apiKey = await ApiKey.findOne({
      _id: id,
      tenentId: tenentId,
      revokedAt: null
    });
    
    if (!apiKey) {
      return res.status(404).json({ success: false, error: 'API key not found' });
    }
    
    // Update fields
    if (name) apiKey.name = name;
    if (permissions) apiKey.permissions = permissions;
    if (typeof isActive === 'boolean') apiKey.isActive = isActive;
    if (rateLimit) {
      apiKey.rateLimit = { ...apiKey.rateLimit.toObject(), ...rateLimit };
    }
    if (webhookUrl !== undefined) apiKey.webhookUrl = webhookUrl;
    
    await apiKey.save();
    
    res.json({
      success: true,
      message: 'API key updated successfully',
      apiKey: {
        id: apiKey._id,
        name: apiKey.name,
        permissions: apiKey.permissions,
        isActive: apiKey.isActive,
        rateLimit: apiKey.rateLimit
      }
    });
  } catch (error) {
    console.error('Error updating API key:', error);
    res.status(500).json({ success: false, error: 'Failed to update API key' });
  }
});

// Revoke API key
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { tenentId } = req.body;
    
    if (!tenentId) {
      return res.status(400).json({ success: false, error: 'tenentId is required' });
    }
    
    const apiKey = await ApiKey.findOne({
      _id: id,
      tenentId: tenentId,
      revokedAt: null
    });
    
    if (!apiKey) {
      return res.status(404).json({ success: false, error: 'API key not found' });
    }
    
    apiKey.revokedAt = new Date();
    apiKey.isActive = false;
    
    await apiKey.save();
    
    res.json({
      success: true,
      message: 'API key revoked successfully'
    });
  } catch (error) {
    console.error('Error revoking API key:', error);
    res.status(500).json({ success: false, error: 'Failed to revoke API key' });
  }
});

// Get API key usage statistics
router.get('/:id/usage', async (req, res) => {
  try {
    const { id } = req.params;
    const { tenentId, days = 7 } = req.query;
    
    if (!tenentId) {
      return res.status(400).json({ success: false, error: 'tenentId is required' });
    }
    
    const apiKey = await ApiKey.findOne({
      _id: id,
      tenentId: tenentId
    });
    
    if (!apiKey) {
      return res.status(404).json({ success: false, error: 'API key not found' });
    }
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));
    
    const usage = await ApiKeyUsage.aggregate([
      {
        $match: {
          apiKeyId: apiKey._id,
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            endpoint: '$endpoint'
          },
          count: { $sum: 1 },
          avgResponseTime: { $avg: '$responseTime' }
        }
      },
      {
        $sort: { '_id.date': -1 }
      }
    ]);
    
    res.json({
      success: true,
      usage: usage,
      summary: {
        totalRequests: apiKey.usageCount,
        lastUsed: apiKey.lastUsedAt
      }
    });
  } catch (error) {
    console.error('Error fetching API key usage:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch usage statistics' });
  }
});

module.exports = router;
