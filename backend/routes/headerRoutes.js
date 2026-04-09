// routes/headerRoutes.js
const express = require('express');
const router = express.Router();
const axios = require('axios');
const Razorpay = require('../models/Razorpay_info');
const LongToken = require('../models/LongToken');

// ============================================================
// GET /api/headerroute/tenant-status
//
// Returns TWO independent notification objects:
//   1. tenant   — subscription/plan status (date-based, original system)
//   2. razorpay — Razorpay token expiry (new system)
//
// Response shape:
// {
//   success: true,
//   notifications: {
//     tenant:   { type: 'warning'|'expired', message: string, lastUpdated: string } | null,
//     razorpay: { type: 'warning'|'expired', message: string, daysLeft: number, createdAt: string } | null
//   }
// }
// ============================================================
router.get('/tenant-status', async (req, res) => {
  const { tenentId } = req.query;

  if (!tenentId) {
    return res.status(400).json({ success: false, message: 'tenentId is required' });
  }

  try {

    // ============================================================
    // 1. TENANT NOTIFICATION — original date-based logic
    //    Checks how long ago the LongToken was last updated.
    //    > 90 days → expired
    //    > 80 days → warning
    // ============================================================
    let tenantNotification = null;

    try {
      const latestToken = await LongToken.findOne({ tenentId }).sort({ updatedAt: -1 });

      if (latestToken) {
        const lastUpdatedDate = new Date(latestToken.updatedAt);
        const now = new Date();
        const diffDays = Math.ceil((now - lastUpdatedDate) / (1000 * 60 * 60 * 24));

        if (diffDays > 90) {
          tenantNotification = {
            type: 'expired',
            message: 'Tenant warning period has expired. Please take immediate action.',
            lastUpdated: lastUpdatedDate.toISOString()
          };
        } else if (diffDays > 80) {
          tenantNotification = {
            type: 'warning',
            message: 'Tenant Warning: Please update your tenant configuration.',
            lastUpdated: lastUpdatedDate.toISOString()
          };
        }
      }
    } catch (tenantErr) {
      // Don't crash the whole route if the tenant check fails
      console.warn('Could not check tenant status:', tenantErr.message);
    }

    // ============================================================
    // 2. RAZORPAY NOTIFICATION — token expiry system
    //    Checks razorpayTokenExpiresAt on the Razorpay model.
    //    <= 0 days  → expired
    //    <= 10 days → warning
    //    null expiresAt → treat as expired (unknown expiry)
    // ============================================================
    let razorpayNotification = null;

    try {
      const razorpayRecord = await Razorpay.findOne({ tenentId });

      if (razorpayRecord && razorpayRecord.razorpayAccessToken) {
        if (razorpayRecord.razorpayTokenExpiresAt) {
          const now = new Date();
          const expiresAt = new Date(razorpayRecord.razorpayTokenExpiresAt);
          const daysUntilExpiry = Math.ceil((expiresAt - now) / (1000 * 60 * 60 * 24));

          if (daysUntilExpiry <= 0) {
            razorpayNotification = {
              type: 'expired',
              message: 'Your Razorpay access token has expired. Payments will fail until you reconnect.',
              daysLeft: 0,
              createdAt: new Date().toISOString()
            };
          } else if (daysUntilExpiry <= 10) {
            razorpayNotification = {
              type: 'warning',
              message: `Your Razorpay connection expires in ${daysUntilExpiry} day(s). Reconnect to avoid payment disruptions.`,
              daysLeft: daysUntilExpiry,
              createdAt: new Date().toISOString()
            };
          }
        } else {
          // expiresAt was never saved — treat as expired to be safe
          razorpayNotification = {
            type: 'expired',
            message: 'Your Razorpay token expiry date is unknown. Please reconnect to ensure payments keep working.',
            daysLeft: 0,
            createdAt: new Date().toISOString()
          };
        }
      }
    } catch (razorpayErr) {
      console.warn('Could not check Razorpay status:', razorpayErr.message);
    }

    return res.json({
      success: true,
      notifications: {
        tenant: tenantNotification,
        razorpay: razorpayNotification
      }
    });

  } catch (error) {
    console.error('Error in /tenant-status:', error.message);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});


// ============================================================
// GET /api/headerroute/instagram-profile
// ============================================================
router.get('/instagram-profile', async (req, res) => {
  const { tenentId } = req.query;

  if (!tenentId) {
    return res.status(400).json({ success: false, message: 'tenentId is required' });
  }

  try {
    const tokenRecord = await LongToken.findOne({ tenentId })
      .sort({ createdAt: -1 })
      .limit(1);

    if (!tokenRecord || !tokenRecord.userAccessToken) {
      return res.status(404).json({
        success: false,
        message: 'No Instagram token found for this tenant'
      });
    }

    // Local expiry check (if you store expiresAt on the token model)
    if (tokenRecord.expiresAt && new Date(tokenRecord.expiresAt) < new Date()) {
      return res.status(401).json({
        success: false,
        message: 'Instagram token expired - please reconnect'
      });
    }

    // Use the stored Instagram ID directly — avoids an extra /me round-trip
    const igResponse = await axios.get(
      `https://graph.instagram.com/v23.0/${tokenRecord.Instagramid}`,
      {
        params: {
          fields: 'name,username,profile_picture_url,account_type',
          access_token: tokenRecord.userAccessToken
        },
        timeout: 10000
      }
    );

    return res.json({
      success: true,
      profile: {
        name: igResponse.data.name || '',
        username: igResponse.data.username || '',
        profile_picture_url: igResponse.data.profile_picture_url || '',
        account_type: igResponse.data.account_type || ''
      }
    });

  } catch (error) {
    console.error('Instagram profile error:', error?.response?.data || error.message);

    const igErrorCode = error?.response?.data?.error?.code;
    const httpStatus = error?.response?.status;

    if (httpStatus === 401 || igErrorCode === 190) {
      return res.status(401).json({
        success: false,
        message: 'Instagram token is invalid or expired. Please reconnect your account.'
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to fetch Instagram profile'
    });
  }
});


module.exports = router;
