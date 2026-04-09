require("dotenv").config();

const LongToken = require('../models/LongToken');
const Signup = require('../models/Signup');
const Profile = require('../models/Profile');

const express = require('express');
const router = express.Router();
const cors = require('cors');

router.use(cors({
  origin: '*' // Replace with your client URL
}));

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
