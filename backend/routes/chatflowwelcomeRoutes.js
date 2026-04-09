// welcomePageRoutes.js - Backend routes for welcome page management
const express = require("express");
const router = express.Router();
const ChatflowWelcomePage = require("../models/ChatflowWelcomePage");
const TemplateMessage = require("../models/TemplateMessage");
const Signup = require("../models/Signup"); // Import the Signup model
const multer = require("multer");
const fs = require("fs");
const path = require("path");

// Add the app URL configuration
const appUrl =
  process.env.APP_URL ||
  "https://inocencia-shiftiest-nonodorously.ngrok-free.dev";

// Configure storage for media files
const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    const uploadDir = "uploads/welcomepage";
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function(req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

// Set up multer for file uploads
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
}).single("media");

// NEW ROUTE: Get template messages for workflows
router.get("/template-messages/:tenentId", async (req, res) => {
  try {
    const { tenentId } = req.params;

    // Find all template messages for this tenant
    const templateMessages = await TemplateMessage.find({ tenentId });

    if (!templateMessages || templateMessages.length === 0) {
      return res.status(200).json({
        success: true,
        data: [], // Return empty array rather than 404 for easier frontend handling
        message: "No template messages found for this tenant",
      });
    }

    // Map to return only the necessary fields (title and payload)
    const templates = templateMessages.map((template) => ({
      title: template.title,
      payload: template.payload,
      messageType: template.messageType,
    }));

    res.status(200).json({
      success: true,
      data: templates,
    });
  } catch (error) {
    console.error("Error retrieving template messages:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve template messages",
      error: error.message,
    });
  }
});

// POST route to create or update welcome page configuration
router.post("/welcome-page", upload, async (req, res) => {
  try {
    const { body, tenentId, workflows } = req.body;

    // Add console log for tenentId
    console.log("tenentId", tenentId);

    // Parse workflows if it's a string
    const parsedWorkflows =
      typeof workflows === "string" ? JSON.parse(workflows) : workflows;

    // Validate required fields
    if (!body || !tenentId) {
      return res.status(400).json({
        success: false,
        message: "Message body and tenant ID are required",
      });
    }

    // Fetch the latest signup data for this tenant
    const signupData = await Signup.findOne({ tenentId })
      .sort({ createdAt: -1 })
      .limit(1);
    let username = null;
    if (signupData) {
      username = signupData.name;
      console.log("signupdata username", username);
    }

    // Handle media file if uploaded
    let mediaPath = null;
    if (req.file) {
      mediaPath = `/uploads/welcomepage/${req.file.filename}`;
    }

    // Check if welcome page config already exists for this tenant
    let welcomePage = await ChatflowWelcomePage.findOne({ tenentId });

    if (welcomePage) {
      // Update existing welcome page
      welcomePage.body = body;

      // Only update media if a new file was uploaded
      if (mediaPath) {
        // Remove old file if it exists
        if (
          welcomePage.mediaPath &&
          fs.existsSync(`.${welcomePage.mediaPath}`)
        ) {
          fs.unlinkSync(`.${welcomePage.mediaPath}`);
        }
        welcomePage.mediaPath = mediaPath;
      }

      // Update workflows with enhanced validation
      if (parsedWorkflows && Array.isArray(parsedWorkflows)) {
        // Enhanced workflow validation to handle "Enter custom title"
        const validatedWorkflows = parsedWorkflows.map((workflow) => {
          const validatedWorkflow = { ...workflow };

          // Define valid option types
          const validOptionTypes = [
            "HUMAN AGENT",
            "TRACK ORDER",
            "TALK WITH AGENT",
            "TRACK ORDER WEB URL",
            "Enter custom title",
          ];

          // Validate optionType
          if (
            !validatedWorkflow.optionType ||
            !validOptionTypes.includes(validatedWorkflow.optionType)
          ) {
            validatedWorkflow.optionType = "Enter custom title";
          }

          // Handle custom title logic
          if (validatedWorkflow.optionType === "Enter custom title") {
            if (
              !validatedWorkflow.customTitle ||
              validatedWorkflow.customTitle.trim() === ""
            ) {
              validatedWorkflow.customTitle =
                validatedWorkflow.title || "Custom Option";
            }
            validatedWorkflow.displayTitle = validatedWorkflow.customTitle;
          } else {
            validatedWorkflow.displayTitle = validatedWorkflow.optionType;
          }

          // Handle URL storage for weburl type workflows - FIXED TO USE url FIELD
          if (validatedWorkflow.type === "weburl") {
            // Check payload field first (frontend might send URL here), then url field
            if (
              validatedWorkflow.payload &&
              validatedWorkflow.payload.trim() !== ""
            ) {
              validatedWorkflow.url = validatedWorkflow.payload; // Save to url field
              validatedWorkflow.payload = ""; // Clear payload
            } else if (
              validatedWorkflow.url &&
              validatedWorkflow.url.trim() !== ""
            ) {
              // Keep existing url if it has a value
              validatedWorkflow.url = validatedWorkflow.url;
            } else {
              // If no URL provided in any field, set empty string
              validatedWorkflow.url = "";
            }
            // Clear urlType as we're not using it anymore
            validatedWorkflow.urlType = "";
          } else {
            // For non-weburl types, ensure url is empty
            validatedWorkflow.url = validatedWorkflow.url || "";
            validatedWorkflow.urlType = "";
          }

          return validatedWorkflow;
        });

        // Use validatedWorkflows for saving
        welcomePage.workflows = validatedWorkflows;
      }

      // Add username if available
      if (username) {
        welcomePage.username = username;
      }

      await welcomePage.save();
    } else {
      // Create new welcome page
      let processedWorkflows = [];

      if (parsedWorkflows && Array.isArray(parsedWorkflows)) {
        // Process workflows for new welcome page
        processedWorkflows = parsedWorkflows.map((workflow) => {
          const processedWorkflow = { ...workflow };

          // Define valid option types
          const validOptionTypes = [
            "HUMAN AGENT",
            "TRACK ORDER",
            "TALK WITH AGENT",
            "TRACK ORDER WEB URL",
            "Enter custom title",
          ];

          // Validate and set optionType
          if (
            !processedWorkflow.optionType ||
            !validOptionTypes.includes(processedWorkflow.optionType)
          ) {
            processedWorkflow.optionType = "Enter custom title";
          }

          // Handle custom title logic for new workflows
          if (processedWorkflow.optionType === "Enter custom title") {
            if (
              !processedWorkflow.customTitle ||
              processedWorkflow.customTitle.trim() === ""
            ) {
              processedWorkflow.customTitle =
                processedWorkflow.title || "Custom Option";
            }
            processedWorkflow.displayTitle = processedWorkflow.customTitle;
          } else {
            processedWorkflow.displayTitle = processedWorkflow.optionType;
          }

          // Handle URL storage for weburl type workflows - FIXED TO USE url FIELD
          if (processedWorkflow.type === "weburl") {
            // Check payload field first (frontend might send URL here), then url field
            if (
              processedWorkflow.payload &&
              processedWorkflow.payload.trim() !== ""
            ) {
              processedWorkflow.url = processedWorkflow.payload; // Save to url field
              processedWorkflow.payload = ""; // Clear payload
            } else if (
              processedWorkflow.url &&
              processedWorkflow.url.trim() !== ""
            ) {
              processedWorkflow.url = processedWorkflow.url;
            } else {
              processedWorkflow.url = "";
            }
            // Clear urlType as we're not using it anymore
            processedWorkflow.urlType = "";
          } else {
            // For non-weburl types, ensure url is empty
            processedWorkflow.url = processedWorkflow.url || "";
            processedWorkflow.urlType = "";
          }

          return processedWorkflow;
        });
      }

      const newWelcomePageData = {
        tenentId,
        body,
        mediaPath,
        workflows: processedWorkflows,
        username: username, // Add the username to the new welcome page
      };

      welcomePage = new ChatflowWelcomePage(newWelcomePageData);
      await welcomePage.save();
    }

    // Add app URL and username to the response
    res.status(200).json({
      success: true,
      message: "Welcome page configuration saved successfully",
      data: welcomePage,
      appUrl: appUrl,
      username: username,
    });
  } catch (error) {
    console.error("Error saving welcome page:", error);
    res.status(500).json({
      success: false,
      message: "Failed to save welcome page configuration",
      error: error.message,
    });
  }
});

// GET route to retrieve welcome page configuration by tenant ID
router.get("/welcome-page/:tenentId", async (req, res) => {
  try {
    const { tenentId } = req.params;

    // Add console log for tenentId
    console.log("tenentId", tenentId);

    // Fetch the latest signup data for this tenant
    const signupData = await Signup.findOne({ tenentId })
      .sort({ createdAt: -1 })
      .limit(1);
    let username = null;
    if (signupData) {
      username = signupData.name;
      console.log("signupdata username", username);
    }

    const welcomePage = await ChatflowWelcomePage.findOne({ tenentId });

    if (!welcomePage) {
      return res.status(404).json({
        success: false,
        message: "Welcome page configuration not found for this tenant",
        username: username, // Still return username even if welcome page not found
      });
    }

    // Process workflows to ensure proper handling of custom titles
    if (welcomePage.workflows && Array.isArray(welcomePage.workflows)) {
      welcomePage.workflows = welcomePage.workflows.map((workflow) => {
        const processedWorkflow = { ...workflow.toObject() };

        // Ensure displayTitle is set correctly
        if (processedWorkflow.optionType === "Enter custom title") {
          processedWorkflow.displayTitle =
            processedWorkflow.customTitle ||
            processedWorkflow.title ||
            "Custom Option";
        } else {
          processedWorkflow.displayTitle = processedWorkflow.optionType;
        }

        return processedWorkflow;
      });
    }

    // Get all template messages for this tenant
    const templateMessages = await TemplateMessage.find({ tenentId });
    const templateMessagesList = templateMessages.map((template) => ({
      title: template.title,
      payload: template.payload,
      messageType: template.messageType,
    }));

    // Get associated template message if it exists for backward compatibility
    const templateMessage = await TemplateMessage.findOne({ tenentId });
    let templateMessageData = null;

    if (templateMessage) {
      // Extract only the needed fields
      templateMessageData = {
        title: templateMessage.title,
        payload: templateMessage.payload,
        messageType: templateMessage.messageType,
      };

      // Add type-specific data
      if (templateMessage.messageType === "text") {
        templateMessageData.text = templateMessage.text;
      } else if (templateMessage.messageType === "carousel") {
        templateMessageData.carouselItems = templateMessage.carouselItems;
      }
    }

    console.log("username for welcomepage", username);
    res.status(200).json({
      success: true,
      data: welcomePage,
      templateMessage: templateMessageData,
      templateMessages: templateMessagesList, // Add all template messages
      appUrl: appUrl,
      username: username, // Include the username in the response
    });
  } catch (error) {
    console.error("Error retrieving welcome page:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve welcome page configuration",
      error: error.message,
    });
  }
});

module.exports = router;
