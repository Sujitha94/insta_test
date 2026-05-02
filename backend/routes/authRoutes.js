require("dotenv").config();
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const Signup = require('../models/Signup');
const LongToken = require('../models/LongToken');
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');
const SECRET_KEY = process.env.JWT_SECRET_KEY;
const WS_SECRET_KEY = process.env.WS_SECRET_KEY;


// User signup
router.post('/signup', async (req, res) => {
  try {
    const { name, email, password, verificationCode, phonenumber } = req.body;
    
    // Check if verification code is provided
    if (!verificationCode) {
      return res.status(400).json({ error: 'Verification code is required' });
    }
    
    // Validate verification code
    if (verificationCode !== process.env.VALID_VERIFICATION_CODE) {
      return res.status(400).json({ error: 'Invalid verification code' });
    }
    
    // Check if email already exists
    const existingEmail = await Signup.findOne({ email });
    if (existingEmail) {
      return res.status(400).json({ error: 'Email ID already registered' });
    }
    
    // Generate tenant ID
    const tenentId = uuidv4();
    
    // Check if user should be admin
    const isAdmin = email === 'dev.vaseegrah@gmail.com';
    
    // Create new user
    const newsignup = new Signup({ 
      name, 
      email, 
      password,
      phonenumber: phonenumber ?? '',   // ✅ save phonenumber, fallback to empty string
      tenentId,
      isAdmin,
      blocked: false,
      commentmoderation: true
    });
    
    await newsignup.save();
    
    res.status(201).json({ 
      message: 'User registered successfully', 
      alertMessage: 'You have been registered successfully!' 
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Failed to register user' });
  }
});

// User login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    const logindata = await Signup.findOne({ email });
    if (!logindata) {
      return res.status(400).json({ error: 'User not found' });
    }

    if (!(password === logindata.password)) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    const isAdmin = logindata.isAdmin;
    const blocked = logindata.blocked;
    const type = logindata.type;
    const commentmoderation = logindata.commentmoderation !== false;
    const phonenumber = logindata.phonenumber ?? '';   // ✅ read phonenumber, fallback to empty string

    const token = jwt.sign(
      { email, password, tenentId: logindata.tenentId, isAdmin }, 
      SECRET_KEY
    );

    const wstoken = jwt.sign(
      { email, password, tenentId: logindata.tenentId, isAdmin }, 
      WS_SECRET_KEY
    );

    res.status(200).json({ 
      message: 'Login successful', 
      tenentId: logindata.tenentId, 
      token,
      wstoken,
      isAdmin,
      blocked,
      type,
      commentmoderation,
      phonenumber    // ✅ returned in response
    });

  } catch (error) {
    res.status(500).json({ error: 'Failed to log in' });
  }
});

router.get('/users', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = jwt.verify(token, SECRET_KEY);
    if (!decoded.isAdmin) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const users = await Signup.find({ isAdmin: false }, '-password');
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

router.put('/users/:userId/block', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = jwt.verify(token, SECRET_KEY);
    if (!decoded.isAdmin) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const userId = req.params.userId;
    const { currentStatus } = req.body;

    // Find user by _id
    const user = await Signup.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Toggle blocked status
    user.blocked = !currentStatus;
    await user.save();

    // If blocking user (changing from unblocked to blocked)
    if (!currentStatus) {
      try {
        const latestToken = await LongToken.findOne({ tenentId: user.tenentId })
          .sort({ createdAt: -1 })
          .limit(1);

        if (latestToken) {
          const instagramId = latestToken.Instagramid;
          const accessToken = latestToken.userAccessToken;
          const APP_ID = process.env.APP_ID;

          if (instagramId && accessToken) {
            try {
              const response = await axios.delete(
                `https://graph.instagram.com/v23.0/${instagramId}/subscribed_apps`,
                {
                  headers: {
                    'Authorization': `Bearer ${accessToken}`
                  }
                }
              );
              console.log('Successfully unsubscribed from webhooks:', response.data);
            } catch (error) {
              console.error('Failed to unsubscribe with Instagram ID:', error);
            }
          }
        }
      } catch (webhookError) {
        console.error('Failed to unsubscribe from webhooks:', webhookError);
      }
    } else {
      try {
        const latestToken = await LongToken.findOne({ tenentId: user.tenentId })
          .sort({ createdAt: -1 })
          .limit(1);

        if (latestToken) {
          const instagramId = latestToken.Instagramid;
          const accessToken = latestToken.userAccessToken;
          const APP_ID = process.env.APP_ID;

          if (instagramId && accessToken) {
            try {
              const subscribeResponse = await axios.post(
                `https://graph.instagram.com/v23.0/${instagramId}/subscribed_apps`,
                null,
                {
                  params: {
                    subscribed_fields: 'messages,message_reactions,messaging_postbacks,messaging_referral,messaging_seen',
                    access_token: accessToken
                  }
                }
              );
              console.log('Webhook subscription successful:', subscribeResponse.data);
            } catch (error) {
              console.error('Failed to subscribe with Instagram ID:', error);
            }
          }
        }
      } catch (webhookError) {
        console.error('Failed to subscribe from webhooks:', webhookError);
      }
    }

    res.json({ 
      success: true,
      message: `User ${user.blocked ? 'blocked' : 'unblocked'} successfully`,
      user: user
    });

  } catch (error) {
    console.error('Error in block/unblock operation:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to update user status'
    });
  }
});

module.exports = router;
