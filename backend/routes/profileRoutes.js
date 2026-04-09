require("dotenv").config();

// Models
const LongToken = require('../models/LongToken');
const Profile = require('../models/Profile');
const Signup = require('../models/Signup');

// Services & Utilities
const rateLimiter = require('../services/rateLimitService');
const path = require('path');
const axios = require('axios');
const fs = require('fs');
const multer = require('multer');

// Express Setup
const express = require('express');
const { json } = express;
const router = express.Router();
const cors = require('cors');

// Middleware
router.use(cors({
  origin: '*' // Replace with your client URL
}));

// --- Helper Functions ---

async function getInstagramUserProfileInformation(senderId, tenentId) {
  const IGSID = senderId;
  const API_VERSION = 'v21.0';
  
  console.log('Fetching profile for sender:', IGSID);

  // Fetch the latest token for the tenant
  const latestToken = await LongToken.findOne({ tenentId: tenentId })
    .sort({ createdAt: -1 })
    .limit(1);

  if (!latestToken) {
    console.log('No token found for tenant:', tenentId);
    return { username: "Nil", name: "Nil", user_id: senderId };
  }

  const userAccessToken = latestToken.userAccessToken;
  const accountId = latestToken.Instagramid;

  try {
    // ✅ CHECK RATE LIMIT BEFORE MAKING API CALL
    if (!rateLimiter.canMakeConversationsApiCall(tenentId, accountId, senderId)) {
      console.log(`⚠️ Rate limit exceeded for Conversations API for tenant ${tenentId}, using default profile info`);
      return { username: "Nil", name: "Nil", user_id: senderId };
    }

    // Enhanced profile fields including additional data
    const profileFields = 'name,username,user_id,profile_picture_url,followers_count,follows_count,media_count,account_type,biography,website';

    const response = await axios.get(
      `https://graph.instagram.com/${API_VERSION}/${IGSID}`,
      {
        params: {
          fields: profileFields,
          access_token: userAccessToken
        },
        timeout: 10000
      }
    );

    if (response.data) {
      console.log('✅ User Profile Retrieved:', {
        username: response.data.username,
        name: response.data.name,
        user_id: response.data.user_id,
        account_type: response.data.account_type,
        followers: response.data.followers_count,
        following: response.data.follows_count,
        media_count: response.data.media_count
      });
      
      return response.data;
    } else {
      console.log('⚠️ Response data is undefined.');
      return { username: "Nil", name: "Nil", user_id: senderId };
    }

  } catch (error) {
    if (error.response) {
      console.error('❌ Error fetching user profile:', error.response.status, error.response.data);
      
      // Handle specific error codes
      if (error.response.status === 429) {
        console.error('⚠️ Rate limit exceeded for Instagram API');
      } else if (error.response.status === 400) {
        console.error('⚠️ Bad request - check if account is Business/Creator account');
      } else if (error.response.status === 190) {
        console.error('⚠️ Invalid or expired access token');
      }
      
      return { username: "Nil", name: "Nil", user_id: senderId };
    } else if (error.code === 'ECONNABORTED') {
      console.error('⚠️ Request timeout after 10 seconds');
      return { username: "Nil", name: "Nil", user_id: senderId };
    } else {
      console.error('❌ Error fetching user profile:', error.message);
      return { username: "Nil", name: "Nil", user_id: senderId };
    }
  }
}

// --- Instagram Profile Routes ---

router.get("/profile", async (req, res) => {
  try {
    const { tenentId } = req.query;

    // Validate tenentId
    if (!tenentId) {
      return res.status(400).json({ 
        success: false, 
        error: "tenentId is required" 
      });
    }

    // Get the latest token info for the tenant
    const data_info = await LongToken.findOne({ tenentId: tenentId })
      .sort({ createdAt: -1 })
      .limit(1)
      .lean(); // Use lean() for better performance

    if (!data_info) {
      return res.status(404).json({ 
        success: false, 
        error: "No token found for this tenant" 
      });
    }

    const recipientID = data_info.Instagramid;

    // Fetch Instagram profile data
    const instagramProfileData = await getInstagramUserProfileInformation(recipientID, tenentId);
    
    console.log("📱 Instagram Profile Data:", {
      username: instagramProfileData?.username,
      followers: instagramProfileData?.followers_count,
      account_type: instagramProfileData?.account_type
    });

    // Handle case where Instagram API returns default/error data
    if (!instagramProfileData || instagramProfileData.username === "Nil") {
      console.log("⚠️ Instagram API returned default data or failed");
      
      // Try to return existing profile from database if available
      const existingProfile = await Profile.findOne({ recipientId: recipientID })
        .sort({ createdAt: -1 })
        .limit(1);

      if (existingProfile) {
        console.log("✅ Returning cached profile data");
        return res.status(200).json({
          success: true,
          data: existingProfile,
          cached: true,
          message: "Returning cached profile data due to API limitations"
        });
      }

      return res.status(503).json({ 
        success: false, 
        error: "Failed to fetch Instagram profile data and no cached data available" 
      });
    }

    console.log("✅ Instagram profile data retrieved successfully");

    // Prepare profile data with fallbacks
    const profileData = {
      recipientId: recipientID,
      username: instagramProfileData.username || "Nil",
      name: instagramProfileData.name || "Nil",
      profile_picture_url: instagramProfileData.profile_picture_url || null,
      followers_count: instagramProfileData.followers_count || 0,
      follows_count: instagramProfileData.follows_count || 0,
      media_count: instagramProfileData.media_count || 0,
      account_type: instagramProfileData.account_type || "PERSONAL",
      biography: instagramProfileData.biography || null,
      website: instagramProfileData.website || null,
      profile_pic: instagramProfileData.profile_picture_url || null // Backwards compatibility
    };

    // Use findOneAndUpdate with upsert for atomic operation
    const savedProfile = await Profile.findOneAndUpdate(
      { recipientId: recipientID },
      { 
        $set: {
          ...profileData,
          updatedAt: new Date()
        },
        $setOnInsert: {
          createdAt: new Date()
        }
      },
      {
        new: true, // Return updated document
        upsert: true, // Create if doesn't exist
        runValidators: true, // Run schema validations
        setDefaultsOnInsert: true // Set default values on insert
      }
    );

    console.log('✅ Profile saved:', {
      recipientId: savedProfile.recipientId,
      username: savedProfile.username,
      followers: savedProfile.followers_count,
      isNew: !savedProfile.createdAt
    });

    // Return the profile data with additional metadata
    return res.status(200).json({
      success: true,
      data: savedProfile,
      cached: false,
      stats: {
        followers: savedProfile.followers_count,
        following: savedProfile.follows_count,
        posts: savedProfile.media_count
      }
    });

  } catch (error) {
    console.error('❌ Error in /profile route:', error);
    
    // Handle specific MongoDB errors
    if (error.name === 'ValidationError') {
      return res.status(400).json({ 
        success: false,
        error: "Validation error",
        details: Object.values(error.errors).map(err => err.message)
      });
    }

    if (error.code === 11000) {
      return res.status(409).json({ 
        success: false,
        error: "Duplicate profile entry",
        message: "A profile with this recipientId already exists"
      });
    }
    
    return res.status(500).json({ 
      success: false,
      error: "Internal server error",
      message: error.message 
    });
  }
});

// --- Account Profile Routes ---

// GET: Fetch account profile
router.get("/accountprofile", async (req, res) => {
  try {
    const { tenentId } = req.query;

    // Validate tenentId
    if (!tenentId) {
      return res.status(400).json({ error: "tenentId is required" });
    }

    // Get user profile data from Signup model
    const signupData = await Signup.findOne({ tenentId: tenentId })
      .sort({ createdAt: -1 })
      .limit(1);

    if (!signupData) {
      return res.status(404).json({ error: "No signup data found for this tenant" });
    }

    // Extract username and name with fallbacks
    const name = signupData.name || "Nil";
    const email = signupData.email || "Nil";

    console.log("Retrieved from Signup:", { name, email });

    // Return the data as JSON response
    return res.status(200).json({
      name,
      email,
      success: true
    });

  } catch (error) {
    console.error('Error in accountprofile GET:', error);
    res.status(500).json({
      error: "Internal server error",
      message: error.message
    });
  }
});

// PUT: Update account profile
router.put("/accountprofile", async (req, res) => {
  try {
    const { tenentId, name, email } = req.body;

    // Validate required fields
    if (!tenentId) {
      return res.status(400).json({ error: "tenentId is required" });
    }

    if (!name || !email) {
      return res.status(400).json({ error: "Name and email are required" });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: "Invalid email format" });
    }

    // Check if email is already used by another tenant
    const existingEmailUser = await Signup.findOne({
      email: email,
      tenentId: { $ne: tenentId } // Exclude current user
    });

    if (existingEmailUser) {
      return res.status(409).json({ error: "Email already in use by another account" });
    }

    // Update the Signup document
    const updatedSignup = await Signup.findOneAndUpdate(
      { tenentId: tenentId },
      {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        updatedAt: new Date()
      },
      {
        new: true, // Return the updated document
        runValidators: true // Run schema validators
      }
    );

    if (!updatedSignup) {
      return res.status(404).json({ error: "Profile not found for this tenant" });
    }

    console.log("Updated profile:", {
      tenentId,
      name: updatedSignup.name,
      email: updatedSignup.email
    });

    // Return success response
    return res.status(200).json({
      name: updatedSignup.name,
      email: updatedSignup.email,
      success: true,
      message: "Profile updated successfully"
    });

  } catch (error) {
    console.error('Error in accountprofile PUT:', error);

    // Handle MongoDB duplicate key error
    if (error.code === 11000) {
      return res.status(409).json({
        error: "Email already exists",
        message: "This email is already associated with another account"
      });
    }

    // Handle validation errors
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        error: "Validation failed",
        message: error.message
      });
    }

    res.status(500).json({
      error: "Internal server error",
      message: error.message
    });
  }
});

module.exports = router;

