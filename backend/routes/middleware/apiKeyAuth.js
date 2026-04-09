const ApiKey = require('../models/ApiKey');
const ApiKeyUsage = require('../models/ApiKeyUsage');

/**
 * InstaxBot API Key Authentication Middleware
 * Validates API keys, checks permissions, enforces rate limits, and logs usage
 */
const apiKeyAuth = (requiredPermissions = []) => {
  return async (req, res, next) => {
    try {
      // Extract API key from Authorization header
      const authHeader = req.headers['authorization'];
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required',
          message: 'Please provide an API key in the Authorization header as "Bearer YOUR_API_KEY"'
        });
      }
      
      const key = authHeader.substring(7); // Remove "Bearer " prefix
      
      // Verify and validate API key
      const apiKey = await ApiKey.verifyKey(key);
      
      if (!apiKey) {
        return res.status(401).json({
          success: false,
          error: 'Invalid API key',
          message: 'The provided API key is invalid, expired, revoked, or inactive'
        });
      }
      
      // IP Whitelist Validation
      /*if (apiKey.ipWhitelist && apiKey.ipWhitelist.length > 0) {
        const clientIp = req.ip || 
                        req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
                        req.connection.remoteAddress || 
                        req.socket.remoteAddress;
        
        const normalizedClientIp = clientIp.replace(/^::ffff:/, ''); // Handle IPv6-mapped IPv4
        
        const isIpAllowed = apiKey.ipWhitelist.some(allowedIp => {
          const normalizedAllowedIp = allowedIp.replace(/^::ffff:/, '');
          return normalizedAllowedIp === normalizedClientIp;
        });
        
        if (!isIpAllowed) {
          return res.status(403).json({
            success: false,
            error: 'IP not whitelisted',
            message: `Your IP address (${normalizedClientIp}) is not authorized to use this API key`
          });
        }
      }*/
      
      // Rate Limit Validation
      const rateLimitCheck = await apiKey.checkRateLimit();
      if (!rateLimitCheck.allowed) {
        return res.status(429).json({
          success: false,
          error: 'Rate limit exceeded',
          message: rateLimitCheck.reason,
          retryAfter: rateLimitCheck.retryAfter || null
        });
      }
      
      // Permission Validation
      if (requiredPermissions.length > 0) {
        const missingPermissions = [];
        
        for (const permission of requiredPermissions) {
          if (!apiKey.hasPermission(permission)) {
            missingPermissions.push(permission);
          }
        }
        
        if (missingPermissions.length > 0) {
          return res.status(403).json({
            success: false,
            error: 'Insufficient permissions',
            message: `This API key lacks required permissions: ${missingPermissions.join(', ')}`,
            requiredPermissions: requiredPermissions,
            missingPermissions: missingPermissions,
            availablePermissions: apiKey.permissions
          });
        }
      }
      
      // Attach authenticated data to request object
      req.apiKey = apiKey;
      req.tenentId = apiKey.tenentId; // Using tenentId to match your schema
      req.user = { 
        tenant_id: apiKey.tenentId,
        tenentId: apiKey.tenentId
      };
      
      // Track request start time for response time calculation
      const startTime = Date.now();
      
      // Log API usage after response is sent (non-blocking)
      res.on('finish', async () => {
        try {
          const responseTime = Date.now() - startTime;
          
          // Get client IP
          const clientIp = req.ip || 
                          req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
                          req.connection.remoteAddress || 
                          req.socket.remoteAddress;
          
          // Create usage log entry
          await ApiKeyUsage.create({
            apiKeyId: apiKey._id,
            tenentId: apiKey.tenentId,
            endpoint: req.originalUrl || req.path,
            method: req.method,
            statusCode: res.statusCode,
            ipAddress: clientIp,
            userAgent: req.headers['user-agent'] || 'Unknown',
            responseTime: responseTime,
            success: res.statusCode >= 200 && res.statusCode < 400
          });
          
          // Update last used timestamp and usage count
          await ApiKey.findByIdAndUpdate(apiKey._id, {
            lastUsedAt: new Date(),
            $inc: { usageCount: 1 }
          });
          
          // Trigger webhook if configured and request was successful
          if (apiKey.webhookUrl && res.statusCode >= 200 && res.statusCode < 400) {
            // Fire and forget webhook (don't await)
            triggerWebhook(apiKey.webhookUrl, {
              apiKeyId: apiKey._id.toString(),
              apiKeyName: apiKey.name,
              tenentId: apiKey.tenentId,
              endpoint: req.originalUrl || req.path,
              method: req.method,
              statusCode: res.statusCode,
              responseTime: responseTime,
              timestamp: new Date().toISOString()
            }).catch(err => {
              console.error('Webhook trigger failed:', err.message);
            });
          }
          
        } catch (error) {
          console.error('Error logging API key usage:', error);
          // Don't throw - logging failures shouldn't break the response
        }
      });
      
      // Proceed to next middleware/route handler
      next();
      
    } catch (error) {
      console.error('API key authentication error:', error);
      res.status(500).json({
        success: false,
        error: 'Authentication error',
        message: 'An error occurred while authenticating your request. Please try again.'
      });
    }
  };
};

/**
 * Helper function to trigger webhooks
 * @param {string} webhookUrl - The webhook URL to call
 * @param {object} data - The data to send to the webhook
 */
async function triggerWebhook(webhookUrl, data) {
  try {
    const fetch = require('node-fetch');
    
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'InstaxBot-API-Key-Webhook/1.0'
      },
      body: JSON.stringify(data),
      timeout: 5000 // 5 second timeout
    });
    
    if (!response.ok) {
      throw new Error(`Webhook returned status ${response.status}`);
    }
    
    console.log(`Webhook triggered successfully: ${webhookUrl}`);
  } catch (error) {
    console.error(`Webhook trigger failed for ${webhookUrl}:`, error.message);
    throw error;
  }
}

/**
 * Optional middleware to check if API key has any of the specified permissions
 * Useful when multiple permissions can satisfy a requirement
 */
const apiKeyAuthAny = (permissions = []) => {
  return async (req, res, next) => {
    try {
      const authHeader = req.headers['authorization'];
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required',
          message: 'Please provide an API key in the Authorization header'
        });
      }
      
      const key = authHeader.substring(7);
      const apiKey = await ApiKey.verifyKey(key);
      
      if (!apiKey) {
        return res.status(401).json({
          success: false,
          error: 'Invalid API key',
          message: 'The provided API key is invalid, expired, or revoked'
        });
      }
      
      // Check if API key has ANY of the required permissions
      const hasAnyPermission = permissions.some(permission => 
        apiKey.hasPermission(permission)
      );
      
      if (!hasAnyPermission) {
        return res.status(403).json({
          success: false,
          error: 'Insufficient permissions',
          message: `This API key needs at least one of: ${permissions.join(', ')}`
        });
      }
      
      req.apiKey = apiKey;
      req.tenentId = apiKey.tenentId;
      req.user = { tenant_id: apiKey.tenentId, tenentId: apiKey.tenentId };
      
      next();
    } catch (error) {
      console.error('API key authentication error:', error);
      res.status(500).json({
        success: false,
        error: 'Authentication error',
        message: 'An error occurred while authenticating your request'
      });
    }
  };
};

module.exports = {
  apiKeyAuth,
  apiKeyAuthAny
};
