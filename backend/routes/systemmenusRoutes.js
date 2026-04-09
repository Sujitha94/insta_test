// systemmenusRoutes.js - Complete Backend routes for InstaxBot system management
const express = require("express");
const router = express.Router();
const InstaxBotSystemMenu = require("../models/InstaxBotSystemMenu");
const Signup = require("../models/Signup");

// Add the app URL configuration
const appUrl =
  process.env.APP_URL ||
  "https://inocencia-shiftiest-nonodorously.ngrok-free.dev";

// ============================================
// MIDDLEWARE FUNCTIONS
// ============================================

// Input validation middleware
const validateTenentId = (req, res, next) => {
  const tenentId = req.body.tenentId || req.params.tenentId;
  if (!tenentId || tenentId.trim() === "") {
    return res.status(400).json({
      success: false,
      message: "Tenent ID is required",
    });
  }
  next();
};

// Payload validation middleware
const validatePayloads = (req, res, next) => {
  const { payloads } = req.body;

  if (!payloads || !Array.isArray(payloads)) {
    return res.status(400).json({
      success: false,
      message: "Payloads array is required",
    });
  }

  // Check for empty payloads
  if (payloads.length === 0) {
    return res.status(400).json({
      success: false,
      message: "At least one payload is required",
    });
  }

  // Validate each payload structure
  for (const payload of payloads) {
    if (!payload.id || !payload.type || !payload.title || !payload.value) {
      return res.status(400).json({
        success: false,
        message: "Each payload must have id, type, title, and value",
      });
    }

    if (!["payload", "web-url"].includes(payload.type)) {
      return res.status(400).json({
        success: false,
        message: 'Payload type must be either "payload" or "web-url"',
      });
    }
  }

  next();
};

// ============================================
// MAIN ROUTES
// ============================================

// POST route to save InstaxBot system menu
router.post(
  "/save-system-menu",
  validateTenentId,
  validatePayloads,
  async (req, res) => {
    try {
      const { payloads, tenentId } = req.body;

      console.log(`Processing system menu for tenentId: ${tenentId}`);

      // Fetch the latest signup data for this tenent
      const signupData = await Signup.findOne({ tenentId: tenentId })
        .sort({ createdAt: -1 })
        .limit(1);

      let username = null;
      if (signupData) {
        username = signupData.name;
        console.log(`Found username: ${username} for tenentId: ${tenentId}`);
      }

      // Validate business rules
      const webUrlPayloads = payloads.filter((p) => p.type === "web-url");
      if (webUrlPayloads.length > 2) {
        return res.status(400).json({
          success: false,
          message: "Maximum 2 web-url payloads allowed",
        });
      }

      // Check for duplicate IDs
      const payloadIds = payloads.map((p) => p.id);
      if (payloadIds.length !== new Set(payloadIds).size) {
        return res.status(400).json({
          success: false,
          message: "Payload IDs must be unique",
        });
      }

      // Check for duplicate titles
      const payloadTitles = payloads.map((p) => p.title.toLowerCase().trim());
      if (payloadTitles.length !== new Set(payloadTitles).size) {
        return res.status(400).json({
          success: false,
          message: "Payload titles must be unique",
        });
      }

      // Clean and validate payloads
      const validatedPayloads = payloads.map((payload) => ({
        id: payload.id.trim(),
        type: payload.type.trim(),
        title: payload.title.trim(),
        value: payload.value.trim(),
      }));

      console.log(
        `Validated ${validatedPayloads.length} payloads for tenentId: ${tenentId}`,
      );

      // Save using the InstaxBotSystemMenu model
      const savedSystemMenu = await InstaxBotSystemMenu.saveSystemMenu(
        tenentId,
        validatedPayloads,
        username,
      );

      console.log(`Successfully saved system menu for tenentId: ${tenentId}`);

      // Return success response with processed data
      res.status(200).json({
        success: true,
        message: "InstaxBot system menu saved successfully",
        data: {
          tenentId: savedSystemMenu.tenentId,
          username: savedSystemMenu.username,
          payloads: savedSystemMenu.payloads,
          statistics: savedSystemMenu.statistics,
          createdAt: savedSystemMenu.createdAt,
          updatedAt: savedSystemMenu.updatedAt,
        },
        appUrl: appUrl,
      });
    } catch (error) {
      console.error("Error saving InstaxBot system menu:", error);

      // Handle validation errors specifically
      if (error.name === "ValidationError") {
        const validationErrors = Object.values(error.errors).map(
          (err) => err.message,
        );
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: validationErrors,
        });
      }

      res.status(500).json({
        success: false,
        message: "Failed to save InstaxBot system menu",
        error: error.message,
      });
    }
  },
);

// GET route to retrieve InstaxBot system menu by tenent ID
router.get("/get-system-menu/:tenentId", validateTenentId, async (req, res) => {
  try {
    const { tenentId } = req.params;

    console.log(`Retrieving system menu for tenentId: ${tenentId}`);

    // Fetch the latest signup data for this tenent
    const signupData = await Signup.findOne({ tenentId: tenentId })
      .sort({ createdAt: -1 })
      .limit(1);

    let username = null;
    if (signupData) {
      username = signupData.name;
      console.log(`Found username: ${username} for tenentId: ${tenentId}`);
    }

    // Try to get existing system menu data
    const systemMenuData = await InstaxBotSystemMenu.findByTenentId(tenentId);

    // If no system menu data exists, return default structure
    if (!systemMenuData) {
      if (!systemMenuData) {
        // Default template returned when tenant has no saved system menu
        const defaultPayloads = [
          {
            id: `${Date.now()}_HUMAN_AGENT`,
            type: "payload",
            title: "Human Agent",
            value: "HUMAN_AGENT",
          },
          {
            id: `${Date.now()}_AI_ASSISTANT`,
            type: "payload",
            title: "Chatbot",
            value: "AI_ASSISTANT",
          },
          {
            id: `${Date.now()}_PRODUCT_CATEGORY_LINK`,
            type: "payload",
            title: "Browse our Products",
            value: "PRODUCT_CATEGORY_LINK",
          },
          {
            id: `${Date.now()}_VISIT_WEBSITE`,
            type: "web-url",
            title: "Visit Website",
            value: "https://vaseegravedha.com/",
          },
        ];

        const payloadTypesCount = {
          payload: defaultPayloads.filter((p) => p.type === "payload").length,
          "web-url": defaultPayloads.filter((p) => p.type === "web-url").length,
        };

        return res.status(200).json({
          success: true,
          message: "No system menu found. Returning default template.",
          data: {
            tenentId,
            username: signupData ? signupData.name : null,
            payloads: defaultPayloads,
            statistics: {
              totalPayloads: defaultPayloads.length,
              payloadTypes: payloadTypesCount,
              remainingWebUrlSlots: Math.max(
                0,
                2 - payloadTypesCount["web-url"],
              ),
            },
            timestamps: {
              createdAt: null,
              updatedAt: null,
              lastAccessedAt: null,
            },
            isActive: true,
          },
          appUrl,
        });
      }

      console.log(
        `No system menu found, returning default for tenentId: ${tenentId}`,
      );
      return res.status(200).json({
        success: true,
        data: {
          tenentId: tenentId,
          username: username,
          payloads: [],
          statistics: {
            totalPayloads: 0,
            payloadCount: 0,
            webUrlCount: 0,
            remainingWebUrlSlots: 2,
          },
          createdAt: signupData.createdAt,
          updatedAt: signupData.createdAt,
          lastAccessedAt: new Date(),
        },
        appUrl: appUrl,
      });
    }

    // Update last accessed time
    await systemMenuData.updateLastAccessed();

    console.log(`Retrieved system menu for tenentId: ${tenentId}`);
    res.status(200).json({
      success: true,
      data: {
        tenentId: systemMenuData.tenentId,
        username: systemMenuData.username,
        payloads: systemMenuData.payloads,
        statistics: systemMenuData.statistics,
        createdAt: systemMenuData.createdAt,
        updatedAt: systemMenuData.updatedAt,
        lastAccessedAt: systemMenuData.lastAccessedAt,
      },
      appUrl: appUrl,
    });
  } catch (error) {
    console.error("Error retrieving InstaxBot system menu:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve InstaxBot system menu",
      error: error.message,
    });
  }
});

// ============================================
// ADMIN ROUTES
// ============================================

// GET route to retrieve all system menus (admin use)
router.get("/all-system-menus", async (req, res) => {
  try {
    const { limit = 100, page = 1, active = true } = req.query;

    console.log(
      `Retrieving all system menus (limit: ${limit}, page: ${page}, active: ${active})`,
    );

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Build query
    const query = active === "true" ? { isActive: true } : {};

    // Get system menu data with pagination
    const [systemMenus, totalCount] = await Promise.all([
      InstaxBotSystemMenu.find(query)
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      InstaxBotSystemMenu.countDocuments(query),
    ]);

    if (!systemMenus || systemMenus.length === 0) {
      // Fallback to signup data if no system menus exist
      const signups = await Signup.find({})
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit));

      const signupCount = await Signup.countDocuments({});

      if (!signups || signups.length === 0) {
        return res.status(200).json({
          success: true,
          data: [],
          pagination: {
            currentPage: parseInt(page),
            totalPages: 0,
            totalItems: 0,
            itemsPerPage: parseInt(limit),
          },
          message: "No tenents found",
        });
      }

      // Map signups to system menu format
      const menuList = signups.map((signup) => ({
        tenentId: signup.tenentId,
        username: signup.name,
        payloads: [],
        statistics: {
          totalPayloads: 0,
          payloadCount: 0,
          webUrlCount: 0,
          remainingWebUrlSlots: 2,
        },
        createdAt: signup.createdAt,
        updatedAt: signup.createdAt,
        lastAccessedAt: signup.createdAt,
      }));

      return res.status(200).json({
        success: true,
        data: menuList,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(signupCount / parseInt(limit)),
          totalItems: signupCount,
          itemsPerPage: parseInt(limit),
        },
      });
    }

    // Transform data for response
    const transformedData = systemMenus.map((menu) => ({
      tenentId: menu.tenentId,
      username: menu.username,
      payloads: menu.payloads,
      statistics: menu.statistics,
      createdAt: menu.createdAt,
      updatedAt: menu.updatedAt,
      lastAccessedAt: menu.lastAccessedAt,
    }));

    res.status(200).json({
      success: true,
      data: transformedData,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalCount / parseInt(limit)),
        totalItems: totalCount,
        itemsPerPage: parseInt(limit),
      },
    });
  } catch (error) {
    console.error("Error retrieving all InstaxBot system menus:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve InstaxBot system menus",
      error: error.message,
    });
  }
});

// GET route to retrieve system menu statistics
router.get("/statistics/:tenentId", validateTenentId, async (req, res) => {
  try {
    const { tenentId } = req.params;

    console.log(`Retrieving statistics for tenentId: ${tenentId}`);

    const systemMenu = await InstaxBotSystemMenu.findByTenentId(tenentId);

    if (!systemMenu) {
      return res.status(404).json({
        success: false,
        message: "System menu not found",
      });
    }

    // Get detailed statistics
    const statistics = {
      ...systemMenu.statistics,
      tenentId: systemMenu.tenentId,
      username: systemMenu.username,
      lastAccessedAt: systemMenu.lastAccessedAt,
      createdAt: systemMenu.createdAt,
      updatedAt: systemMenu.updatedAt,
      isActive: systemMenu.isActive,
      payloadTypes: {
        payload: systemMenu.payloads.filter((p) => p.type === "payload").length,
        webUrl: systemMenu.payloads.filter((p) => p.type === "web-url").length,
      },
    };

    res.status(200).json({
      success: true,
      data: statistics,
    });
  } catch (error) {
    console.error("Error retrieving statistics:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve statistics",
      error: error.message,
    });
  }
});

// GET route to search system menus
router.get("/search", async (req, res) => {
  try {
    const {
      query,
      type,
      limit = 20,
      page = 1,
      sortBy = "updatedAt",
      sortOrder = "desc",
    } = req.query;

    console.log(`Searching system menus with query: ${query}, type: ${type}`);

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Build search criteria
    let searchCriteria = { isActive: true };

    if (query) {
      searchCriteria.$or = [
        { tenentId: { $regex: query, $options: "i" } },
        { username: { $regex: query, $options: "i" } },
        { "payloads.title": { $regex: query, $options: "i" } },
        { "payloads.value": { $regex: query, $options: "i" } },
      ];
    }

    if (type && ["payload", "web-url"].includes(type)) {
      searchCriteria["payloads.type"] = type;
    }

    // Build sort criteria
    const sortCriteria = {};
    sortCriteria[sortBy] = sortOrder === "desc" ? -1 : 1;

    // Execute search
    const [results, totalCount] = await Promise.all([
      InstaxBotSystemMenu.find(searchCriteria)
        .sort(sortCriteria)
        .skip(skip)
        .limit(parseInt(limit)),
      InstaxBotSystemMenu.countDocuments(searchCriteria),
    ]);

    // Transform results
    const transformedResults = results.map((menu) => ({
      tenentId: menu.tenentId,
      username: menu.username,
      payloads: menu.payloads,
      statistics: menu.statistics,
      createdAt: menu.createdAt,
      updatedAt: menu.updatedAt,
      lastAccessedAt: menu.lastAccessedAt,
    }));

    res.status(200).json({
      success: true,
      data: transformedResults,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalCount / parseInt(limit)),
        totalItems: totalCount,
        itemsPerPage: parseInt(limit),
      },
      searchCriteria: {
        query: query || null,
        type: type || null,
        sortBy,
        sortOrder,
      },
    });
  } catch (error) {
    console.error("Error searching system menus:", error);
    res.status(500).json({
      success: false,
      message: "Failed to search system menus",
      error: error.message,
    });
  }
});

// GET route to export system menu data
router.get("/export/:tenentId", validateTenentId, async (req, res) => {
  try {
    const { tenentId } = req.params;
    const { format = "json" } = req.query;

    console.log(
      `Exporting system menu for tenentId: ${tenentId} in format: ${format}`,
    );

    const systemMenu = await InstaxBotSystemMenu.findByTenentId(tenentId);

    if (!systemMenu) {
      return res.status(404).json({
        success: false,
        message: "System menu not found",
      });
    }

    const exportData = {
      tenentId: systemMenu.tenentId,
      username: systemMenu.username,
      payloads: systemMenu.payloads,
      statistics: systemMenu.statistics,
      exportedAt: new Date(),
      createdAt: systemMenu.createdAt,
      updatedAt: systemMenu.updatedAt,
    };

    if (format === "csv") {
      // Convert to CSV format
      const csvHeader = "ID,Type,Title,Value,Created At,Updated At\n";
      const csvData = systemMenu.payloads
        .map(
          (payload) =>
            `"${payload.id}","${payload.type}","${payload.title}","${payload.value}","${systemMenu.createdAt}","${systemMenu.updatedAt}"`,
        )
        .join("\n");

      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="system-menu-${tenentId}.csv"`,
      );
      res.send(csvHeader + csvData);
    } else {
      // Default JSON format
      res.setHeader("Content-Type", "application/json");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="system-menu-${tenentId}.json"`,
      );
      res.json({
        success: true,
        data: exportData,
      });
    }
  } catch (error) {
    console.error("Error exporting system menu:", error);
    res.status(500).json({
      success: false,
      message: "Failed to export system menu",
      error: error.message,
    });
  }
});

// ============================================
// UPDATE ROUTES
// ============================================

// PUT route to update specific payload in system menu
router.put(
  "/update-payload/:tenentId/:payloadId",
  validateTenentId,
  async (req, res) => {
    try {
      const { tenentId, payloadId } = req.params;
      const { title, value, type } = req.body;

      console.log(`Updating payload ${payloadId} for tenentId: ${tenentId}`);

      // Validate input
      if (!title || !value || !type) {
        return res.status(400).json({
          success: false,
          message: "Title, value, and type are required",
        });
      }

      // Type validation
      if (!["payload", "web-url"].includes(type)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid type. Must be "payload" or "web-url"',
        });
      }

      // Clean input data
      const updateData = {
        title: title.trim(),
        value: value.trim(),
        type: type.trim(),
      };

      // Update payload using the model method
      const updatedPayload = await InstaxBotSystemMenu.updatePayloadById(
        tenentId,
        payloadId,
        updateData,
      );

      res.status(200).json({
        success: true,
        message: "Payload updated successfully",
        data: updatedPayload,
      });
    } catch (error) {
      console.error("Error updating payload:", error);

      // Handle specific error cases
      if (
        error.message === "System menu not found" ||
        error.message === "Payload not found"
      ) {
        return res.status(404).json({
          success: false,
          message: error.message,
        });
      }

      if (error.name === "ValidationError") {
        const validationErrors = Object.values(error.errors).map(
          (err) => err.message,
        );
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: validationErrors,
        });
      }

      res.status(500).json({
        success: false,
        message: "Failed to update payload",
        error: error.message,
      });
    }
  },
);

// ============================================
// ADD/REMOVE PAYLOAD ROUTES
// ============================================

// POST route to add a single payload to existing system menu
router.post("/add-payload/:tenentId", validateTenentId, async (req, res) => {
  try {
    const { tenentId } = req.params;
    const { id, type, title, value } = req.body;

    console.log(`Adding payload to system menu for tenentId: ${tenentId}`);

    // Validate payload data
    if (!id || !type || !title || !value) {
      return res.status(400).json({
        success: false,
        message: "Payload id, type, title, and value are required",
      });
    }

    if (!["payload", "web-url"].includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid type. Must be "payload" or "web-url"',
      });
    }

    // Find the system menu
    const systemMenu = await InstaxBotSystemMenu.findByTenentId(tenentId);

    if (!systemMenu) {
      return res.status(404).json({
        success: false,
        message: "System menu not found",
      });
    }

    // Create payload object
    const newPayload = {
      id: id.trim(),
      type: type.trim(),
      title: title.trim(),
      value: value.trim(),
    };

    // Add payload using instance method
    await systemMenu.addPayload(newPayload);

    res.status(201).json({
      success: true,
      message: "Payload added successfully",
      data: newPayload,
    });
  } catch (error) {
    console.error("Error adding payload:", error);

    if (
      error.message.includes("Maximum") ||
      error.message.includes("already exists")
    ) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to add payload",
      error: error.message,
    });
  }
});

// DELETE route to remove a specific payload
router.delete(
  "/remove-payload/:tenentId/:payloadId",
  validateTenentId,
  async (req, res) => {
    try {
      const { tenentId, payloadId } = req.params;

      console.log(
        `Removing payload ${payloadId} from system menu for tenentId: ${tenentId}`,
      );

      // Find the system menu
      const systemMenu = await InstaxBotSystemMenu.findByTenentId(tenentId);

      if (!systemMenu) {
        return res.status(404).json({
          success: false,
          message: "System menu not found",
        });
      }

      // Remove payload using instance method
      await systemMenu.removePayload(payloadId);

      res.status(200).json({
        success: true,
        message: "Payload removed successfully",
        data: {
          tenentId: tenentId,
          payloadId: payloadId,
          removedAt: new Date(),
        },
      });
    } catch (error) {
      console.error("Error removing payload:", error);

      if (error.message === "Payload not found") {
        return res.status(404).json({
          success: false,
          message: error.message,
        });
      }

      res.status(500).json({
        success: false,
        message: "Failed to remove payload",
        error: error.message,
      });
    }
  },
);

// ============================================
// DELETE ROUTES
// ============================================

// DELETE route to delete InstaxBot system menu (soft delete by default)
router.delete(
  "/delete-system-menu/:tenentId",
  validateTenentId,
  async (req, res) => {
    try {
      const { tenentId } = req.params;
      const { permanent = false } = req.query;

      console.log(
        `Request to delete system menu for tenentId: ${tenentId} (permanent: ${permanent})`,
      );

      let deletedMenu;

      if (permanent === "true") {
        // Permanent delete
        deletedMenu = await InstaxBotSystemMenu.deleteByTenentId(tenentId);
      } else {
        // Soft delete
        deletedMenu = await InstaxBotSystemMenu.softDeleteByTenentId(tenentId);
      }

      if (!deletedMenu) {
        return res.status(404).json({
          success: false,
          message: "System menu not found",
        });
      }

      res.status(200).json({
        success: true,
        message: `InstaxBot system menu ${
          permanent === "true" ? "permanently deleted" : "deactivated"
        } successfully`,
        data: {
          tenentId: tenentId,
          action: permanent === "true" ? "permanently deleted" : "soft deleted",
          deletedAt: new Date(),
        },
      });
    } catch (error) {
      console.error("Error deleting system menu:", error);
      res.status(500).json({
        success: false,
        message: "Failed to delete system menu",
        error: error.message,
      });
    }
  },
);

// ============================================
// UTILITY ROUTES
// ============================================

// POST route to duplicate system menu to another tenent
router.post(
  "/duplicate-system-menu/:sourceTenentId/:targetTenentId",
  async (req, res) => {
    try {
      const { sourceTenentId, targetTenentId } = req.params;

      console.log(
        `Duplicating system menu from ${sourceTenentId} to ${targetTenentId}`,
      );

      // Validate both tenent IDs
      if (!sourceTenentId || !targetTenentId) {
        return res.status(400).json({
          success: false,
          message: "Both source and target tenent IDs are required",
        });
      }

      if (sourceTenentId === targetTenentId) {
        return res.status(400).json({
          success: false,
          message: "Source and target tenent IDs cannot be the same",
        });
      }

      // Find source system menu
      const sourceMenu = await InstaxBotSystemMenu.findByTenentId(
        sourceTenentId,
      );

      if (!sourceMenu) {
        return res.status(404).json({
          success: false,
          message: "Source system menu not found",
        });
      }

      // Get target tenent information
      const targetSignup = await Signup.findOne({ tenentId: targetTenentId })
        .sort({ createdAt: -1 })
        .limit(1);

      if (!targetSignup) {
        return res.status(404).json({
          success: false,
          message: "Target tenent not found",
        });
      }

      // Create new payloads with new IDs to avoid conflicts
      const duplicatedPayloads = sourceMenu.payloads.map((payload) => ({
        ...payload.toObject(),
        id: `${payload.id}_${Date.now()}_${Math.random()
          .toString(36)
          .substr(2, 9)}`,
      }));

      // Save duplicated system menu
      const duplicatedMenu = await InstaxBotSystemMenu.saveSystemMenu(
        targetTenentId,
        duplicatedPayloads,
        targetSignup.name,
      );

      res.status(201).json({
        success: true,
        message: "System menu duplicated successfully",
        data: {
          source: {
            tenentId: sourceTenentId,
            payloadCount: sourceMenu.payloads.length,
          },
          target: {
            tenentId: duplicatedMenu.tenentId,
            username: duplicatedMenu.username,
            payloadCount: duplicatedMenu.payloads.length,
            statistics: duplicatedMenu.statistics,
          },
        },
      });
    } catch (error) {
      console.error("Error duplicating system menu:", error);
      res.status(500).json({
        success: false,
        message: "Failed to duplicate system menu",
        error: error.message,
      });
    }
  },
);

// ============================================
// ERROR HANDLING
// ============================================

// Error handling middleware
router.use((error, req, res, next) => {
  console.error("Router error:", error);
  res.status(500).json({
    success: false,
    message: "Internal server error",
    error:
      process.env.NODE_ENV === "development"
        ? error.message
        : "Something went wrong",
  });
});

module.exports = router;
