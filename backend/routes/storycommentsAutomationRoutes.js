const express = require('express');
const router = express.Router();
const StoryCommentAutomationRule = require('../models/StoryCommentAutomationRule');
const StoryComment = require('../models/StoryComment'); 
const { v4: uuidv4 } = require('uuid');

//================================================================
// CREATE: Save new story automation rules
//================================================================
router.post("/comment-automation", async (req, res) => {
  const { tenentId, automationRules } = req.body;

  // Basic validation
  if (!tenentId || !Array.isArray(automationRules) || automationRules.length === 0) {
    return res.status(400).json({ 
      success: false, 
      message: "Missing tenentId or automationRules" 
    });
  }
  console.log("tenant id for story",tenentId);
  
  try {
    const savedRules = [];
    for (const rule of automationRules) {
      const { 
        triggerText, 
        replyText,
        ruleType,
        templateItems,
        templateCount
      } = rule;

      // Validate required fields
      if (!triggerText || triggerText.trim() === '') {
        return res.status(400).json({
          success: false,
          message: "Trigger text is required"
        });
      }

      if (ruleType === 'text' && (!replyText || replyText.trim() === '')) {
        return res.status(400).json({
          success: false,
          message: "Reply text is required for text rule type"
        });
      }

      if (ruleType === 'template' && (!templateItems || templateItems.length === 0)) {
        return res.status(400).json({
          success: false,
          message: "Template must have at least one item"
        });
      }

      // Create a new rule instance using the StoryCommentAutomationRule model
      const newRule = new StoryCommentAutomationRule({
        ruleId: uuidv4(),
        tenentId,
        triggerText,
        replyText,
        ruleType: ruleType || 'text',
        templateItems: ruleType === 'template' ? templateItems : [],
        templateCount: ruleType === 'template' ? templateCount : 0
      });

      const saved = await newRule.save();
      savedRules.push(saved);
      console.log('Saved story automation rule:', saved);
    }

    return res.status(201).json({ 
      success: true, 
      message: "Story automation rules saved successfully!",
      data: savedRules
    });

  } catch (error) {
    console.error('Error saving story automation rules:', error.message);
    return res.status(500).json({ 
      success: false, 
      message: "Failed to save story automation rules", 
      error: error.message 
    });
  }
});


//================================================================
// READ: Fetch all existing story automation rules for a tenant
//================================================================
router.get("/rules", async (req, res) => {
  const { tenentId } = req.query;

  if (!tenentId) {
    return res.status(400).json({ success: false, message: "Missing tenentId" });
  }

  try {
    const rules = await StoryCommentAutomationRule.find({ tenentId });

    if (!rules || rules.length === 0) {
      return res.status(404).json({ success: false, message: "No story automation rules found for this tenant" });
    }

    return res.status(200).json({ success: true, rules: rules });
    
  } catch (error) {
    console.error("Error fetching story automation rules:", error.message);
    return res.status(500).json({ success: false, message: "Failed to fetch rules", error: error.message });
  }
});


//================================================================
// UPDATE: Edit an existing story automation rule
//================================================================
router.put("/rule/:ruleId", async (req, res) => {
  const { ruleId } = req.params;
  const { 
    tenentId, 
    triggerText, 
    replyText,
    ruleType,
    templateItems,
    templateCount
  } = req.body;

  // Validate required fields
  if (!ruleId || !tenentId || !triggerText) {
    return res.status(400).json({ 
      success: false, 
      message: "Missing required fields (ruleId, tenentId, or triggerText)" 
    });
  }

  // Validate rule-specific fields
  if (ruleType === 'text' && !replyText) {
    return res.status(400).json({ success: false, message: "Missing replyText for text rule type" });
  }
  if (ruleType === 'template' && (!templateItems || templateItems.length === 0)) {
    return res.status(400).json({ success: false, message: "Template must have at least one item" });
  }

  try {
    // Ensure the rule exists and belongs to the correct tenant before updating
    const existingRule = await StoryCommentAutomationRule.findOne({ ruleId, tenentId });

    if (!existingRule) {
      return res.status(404).json({ 
        success: false, 
        message: "Rule not found or you do not have permission to edit it" 
      });
    }

    // Construct the update object
    const updateData = {
      triggerText,
      replyText: ruleType === 'text' ? replyText : undefined,
      ruleType,
      templateItems: ruleType === 'template' ? templateItems : [],
      templateCount: ruleType === 'template' ? templateCount : 0,
      updatedAt: new Date()
    };
    
    // Find the rule by its ruleId and tenantId and update it
    const updatedRule = await StoryCommentAutomationRule.findOneAndUpdate(
      { ruleId, tenentId },
      updateData,
      { new: true }
    );
    
    console.log(`Updated story rule with ID: ${ruleId}`, updatedRule);
    
    return res.status(200).json({ 
      success: true, 
      message: "Story rule updated successfully",
      rule: updatedRule
    });
    
  } catch (error) {
    console.error("Error updating story rule:", error.message);
    return res.status(500).json({ 
      success: false, 
      message: "Failed to update story rule", 
      error: error.message 
    });
  }
});


//================================================================
// DELETE: Remove a story automation rule by its ID
//================================================================
router.delete("/rule/:ruleId", async (req, res) => {
  const { ruleId } = req.params;
  const { tenentId } = req.query;

  if (!ruleId || !tenentId) {
    return res.status(400).json({ 
      success: false, 
      message: "Missing ruleId or tenentId" 
    });
  }

  try {
    // First, verify the rule exists and belongs to the tenant to ensure security
    const rule = await StoryCommentAutomationRule.findOne({ ruleId, tenentId });

    if (!rule) {
      return res.status(404).json({ 
        success: false, 
        message: "Rule not found or you do not have permission to delete it" 
      });
    }

    // Delete the rule
    await StoryCommentAutomationRule.deleteOne({ ruleId, tenentId });
    
    console.log(`Deleted story rule with ID: ${ruleId}`);
    
    return res.status(200).json({ 
      success: true, 
      message: "Story automation rule deleted successfully" 
    });
    
  } catch (error) {
    console.error("Error deleting story rule:", error.message);
    return res.status(500).json({ 
      success: false, 
      message: "Failed to delete rule", 
      error: error.message 
    });
  }
});


//================================================================
// Analytics: Get rules by reply count
//================================================================
router.get("/rules-by-reply", async (req, res) => {
  const { tenentId } = req.query;

  if (!tenentId) {
    return res.status(400).json({ success: false, message: "Missing tenentId" });
  }

  try {
    const rulesWithReplies = await StoryComment.aggregate([
      { $match: { tenentId: tenentId } },
      { 
        $group: { 
          _id: "$ruleId",
          replyCount: { $sum: 1 },
          lastReplyTimestamp: { $max: "$Timestamp" }
        } 
      },
      {
        $lookup: {
          from: "storycommentautomationrules",
          localField: "_id",
          foreignField: "ruleId",
          as: "ruleDetails"
        }
      },
      { $unwind: "$ruleDetails" },
      {
        $project: {
          _id: 0,
          ruleId: "$_id",
          triggerText: "$ruleDetails.triggerText",
          replyCount: "$replyCount",
          timestamp: "$lastReplyTimestamp"
        }
      },
      { $sort: { timestamp: -1 } }
    ]);
    
    console.log("rulesWithReplies", rulesWithReplies);
    
    return res.status(200).json({ 
      success: true, 
      data: rulesWithReplies 
    });
    
  } catch (error) {
    console.error("Error fetching rules by reply:", error.message);
    return res.status(500).json({ success: false, message: "Failed to fetch rules by reply" });
  }
});


//================================================================
// Analytics: Get replies by specific rule
//================================================================
router.get("/replies-by-rule/:ruleId", async (req, res) => {
  const { ruleId } = req.params;
  const { tenentId } = req.query;
  
  if (!ruleId || !tenentId) {
    return res.status(400).json({ success: false, message: "Missing ruleId or tenentId" });
  }
  
  try {
    const replies = await StoryComment.find({ 
      ruleId: ruleId,
      tenentId: tenentId
    }).sort({ Timestamp: -1 }).limit(50);
    
    return res.status(200).json({
      success: true,
      count: replies.length,
      replies: replies
    });
    
  } catch (error) {
    console.error("Error fetching replies for rule:", error.message);
    return res.status(500).json({ success: false, message: "Failed to fetch replies for this rule" });
  }
});


module.exports = router;
