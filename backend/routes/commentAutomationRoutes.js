const express = require('express');
const axios = require('axios');
const router = express.Router();
const LongToken = require('../models/LongToken');
const CommentAutomationRule = require('../models/CommentAutomationRule');
const Comment = require('../models/Comment');
const { v4: uuidv4 } = require('uuid');

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Normalize carousel/template items coming from the frontend.
 * Ensures each item has buttonType ('url' | 'payload') and the
 * correct corresponding value field populated.
 */
function normalizeCarouselItems(items = []) {
  return items.map(item => {
    const buttonType = item.buttonType === 'payload' ? 'payload' : 'url';
    return {
      image: item.image || '',
      title: item.title || '',
      subtitle: item.subtitle || '',
      buttonText: item.buttonText || '',
      buttonType,
      buttonUrl: buttonType === 'url' ? (item.buttonUrl || '') : '',
      buttonPayload: buttonType === 'payload' ? (item.buttonPayload || '') : ''
    };
  });
}

// ─────────────────────────────────────────────
// GET /check-token
// ─────────────────────────────────────────────
router.get("/check-token", async (req, res) => {
  const tenentId = req.query.tenentId;

  if (!tenentId) {
    return res.status(400).json({ success: false, message: "Missing tenentId" });
  }

  try {
    const latestToken = await LongToken.findOne({ tenentId }).sort({ createdAt: -1 });

    if (latestToken) {
      console.log('Latest token retrieved for Profile_information:', latestToken);
      return res.status(200).json({ success: true, valid: true, token: latestToken.userAccessToken });
    } else {
      return res.status(404).json({ success: false, valid: false, message: "No access token found for this tenent" });
    }
  } catch (error) {
    console.error("Error checking token:", error);
    return res.status(500).json({ success: false, message: "Server error while checking token" });
  }
});

// ─────────────────────────────────────────────
// GET /triggered-rules
// ─────────────────────────────────────────────
router.get("/triggered-rules", async (req, res) => {
  const tenentId = req.query.tenentId;

  if (!tenentId) {
    return res.status(400).json({ success: false, message: "Missing tenentId" });
  }

  try {
    const rules = await CommentAutomationRule.find({ tenentId }).lean();

    if (rules.length === 0) {
      return res.status(200).json({ success: true, data: [], message: "No rules found" });
    }

    const allComments = await Comment.find({ tenentId }).lean();
    const triggeredRulesMap = new Map();

    rules.forEach(rule => {
      if (rule.triggerText && rule.triggerText.trim()) {
        const trimmedTrigger = rule.triggerText.trim();
        let matchCount = 0;
        let lastMatchTimestamp = null;
        const isWildcard = trimmedTrigger === "*";

        allComments.forEach(comment => {
          let isMatch = false;
          if (isWildcard) {
            isMatch = comment.mediaId === rule.mediaId;
          } else {
            const escapedTrigger = escapeRegExp(trimmedTrigger.toLowerCase());
            const regex = new RegExp(escapedTrigger, 'i');
            isMatch = comment.mediaId === rule.mediaId && regex.test(comment.message || "");
          }

          if (isMatch) {
            matchCount++;
            const commentTime = new Date(comment.Timestamp || comment.createdAt);
            if (!lastMatchTimestamp || commentTime > lastMatchTimestamp) {
              lastMatchTimestamp = commentTime;
            }
          }
        });

        if (matchCount > 0) {
          triggeredRulesMap.set(rule.ruleId, {
            ruleId: rule.ruleId,
            triggerText: rule.triggerText,
            replyCount: matchCount,
            timestamp: lastMatchTimestamp ? lastMatchTimestamp.toISOString() : rule.createdAt,
            mediaId: rule.mediaId
          });
        }
      }
    });

    const triggeredRules = Array.from(triggeredRulesMap.values());
    return res.status(200).json({ success: true, data: triggeredRules, count: triggeredRules.length });

  } catch (error) {
    console.error("Error fetching triggered rules:", error.message);
    return res.status(500).json({ success: false, message: "Failed to fetch triggered rules", error: error.message });
  }
});

// ─────────────────────────────────────────────
// GET /comments-by-rule/:ruleId
// ─────────────────────────────────────────────
router.get("/comments-by-rule/:ruleId", async (req, res) => {
  const { ruleId } = req.params;
  const tenentId = req.query.tenentId;
  const triggerText = req.query.triggerText;

  if (!ruleId || !tenentId) {
    return res.status(400).json({ success: false, message: "Missing ruleId or tenentId" });
  }

  try {
    const rule = await CommentAutomationRule.findOne({ ruleId, tenentId }).lean();

    if (!rule) {
      return res.status(404).json({ success: false, message: "Rule not found" });
    }

    const effectiveTriggerText = triggerText || rule.triggerText;

    if (!effectiveTriggerText) {
      return res.status(400).json({ success: false, message: "No trigger text available" });
    }

    const allComments = await Comment.find({ tenentId, mediaId: rule.mediaId })
      .sort({ createdAt: -1 })
      .lean();

    const isWildcard = effectiveTriggerText.trim() === "*";

    let matchedComments;
    if (isWildcard) {
      matchedComments = allComments;
    } else {
      const escapedTrigger = escapeRegExp(effectiveTriggerText.trim().toLowerCase());
      const regex = new RegExp(escapedTrigger, 'i');
      matchedComments = allComments.filter(comment => regex.test(comment.message || ""));
    }

    const enrichedComments = matchedComments.map(comment => ({
      commentId: comment.commentId,
      mediaId: comment.mediaId,
      username: comment.username,
      senderId: comment.senderId,
      message: comment.message,
      response: comment.response || "",
      timestamp: comment.Timestamp || comment.createdAt,
      matchedTrigger: { ruleId: rule.ruleId, triggerText: effectiveTriggerText, isWildcard },
      isTriggered: true
    }));

    return res.status(200).json({
      success: true,
      count: enrichedComments.length,
      data: enrichedComments,
      ruleInfo: { ruleId: rule.ruleId, triggerText: effectiveTriggerText, mediaId: rule.mediaId, isWildcard }
    });

  } catch (error) {
    console.error("Error fetching comments by rule:", error.message);
    return res.status(500).json({ success: false, message: "Failed to fetch comments", error: error.message });
  }
});

// ─────────────────────────────────────────────
// GET /comments-by-media
// ─────────────────────────────────────────────
router.get("/comments-by-media", async (req, res) => {
  const tenentId = req.query.tenentId;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  if (!tenentId) {
    return res.status(400).json({ success: false, message: "Missing tenentId" });
  }

  try {
    const latestToken = await LongToken.findOne({ tenentId }).sort({ createdAt: -1 });

    if (!latestToken || !latestToken.userAccessToken) {
      return res.status(404).json({ success: false, message: "Access token not found for this tenent" });
    }

    const totalMediaWithComments = await Comment.aggregate([
      { $match: { tenentId } },
      { $group: { _id: "$mediaId" } },
      { $count: "total" }
    ]);

    const totalCount = totalMediaWithComments.length > 0 ? totalMediaWithComments[0].total : 0;

    const commentsByMedia = await Comment.aggregate([
      { $match: { tenentId } },
      { $group: { _id: "$mediaId", count: { $sum: 1 } } },
      { $skip: skip },
      { $limit: limit }
    ]);

    if (commentsByMedia.length === 0) {
      return res.status(200).json({
        success: true, data: [],
        pagination: { currentPage: page, totalPages: Math.ceil(totalCount / limit), totalItems: totalCount, itemsPerPage: limit, hasNextPage: false, hasPreviousPage: false }
      });
    }

    const mediaIds = commentsByMedia.map(item => item._id);
    const commentCountMap = {};
    commentsByMedia.forEach(item => { commentCountMap[item._id] = item.count; });

    const latestRulesByMedia = await CommentAutomationRule.aggregate([
      { $match: { tenentId, mediaId: { $in: mediaIds } } },
      { $group: { _id: "$mediaId", latestRuleCreatedAt: { $max: "$createdAt" } } }
    ]);

    const ruleCreatedAtMap = {};
    latestRulesByMedia.forEach(item => { ruleCreatedAtMap[item._id] = item.latestRuleCreatedAt; });

    const enrichedMedia = [];
    for (const mediaId of mediaIds) {
      try {
        const mediaResponse = await axios.get(`https://graph.instagram.com/${mediaId}`, {
          params: { access_token: latestToken.userAccessToken, fields: 'id,media_type,media_url,thumbnail_url,caption,timestamp,permalink' }
        });
        if (mediaResponse.data) {
          const media = mediaResponse.data;
          enrichedMedia.push({
            ...media,
            commentCount: commentCountMap[media.id] || 0,
            displayUrl: media.media_type === 'VIDEO' ? media.thumbnail_url : media.media_url,
            latestRuleCreatedAt: ruleCreatedAtMap[media.id] || null
          });
        }
      } catch (error) {
        console.error(`Error fetching media ${mediaId}:`, error.response?.data || error.message);
      }
    }

    const sortedMedia = enrichedMedia.sort((a, b) => {
      if (a.latestRuleCreatedAt && b.latestRuleCreatedAt) return new Date(b.latestRuleCreatedAt) - new Date(a.latestRuleCreatedAt);
      if (a.latestRuleCreatedAt && !b.latestRuleCreatedAt) return -1;
      if (!a.latestRuleCreatedAt && b.latestRuleCreatedAt) return 1;
      return new Date(b.timestamp) - new Date(a.timestamp);
    });

    const totalPages = Math.ceil(totalCount / limit);
    return res.status(200).json({
      success: true, data: sortedMedia,
      pagination: { currentPage: page, totalPages, totalItems: totalCount, itemsPerPage: limit, hasNextPage: page < totalPages, hasPreviousPage: page > 1 }
    });

  } catch (error) {
    console.error("Error fetching comments by media:", error.response?.data || error.message);
    return res.status(500).json({ success: false, message: "Failed to fetch comments by media", error: error.message });
  }
});

// ─────────────────────────────────────────────
// GET /rules-by-media
// ─────────────────────────────────────────────
router.get("/rules-by-media", async (req, res) => {
  const tenentId = req.query.tenentId;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  if (!tenentId) {
    return res.status(400).json({ success: false, message: "Missing tenentId" });
  }

  try {
    const latestToken = await LongToken.findOne({ tenentId }).sort({ createdAt: -1 });

    if (!latestToken || !latestToken.userAccessToken) {
      return res.status(404).json({ success: false, message: "Access token not found for this tenant" });
    }

    const totalRules = await CommentAutomationRule.countDocuments({ tenentId });
    const rules = await CommentAutomationRule.find({ tenentId }).sort({ createdAt: -1 }).skip(skip).limit(limit).lean();

    if (rules.length === 0) {
      return res.status(200).json({
        success: true, data: [],
        pagination: { currentPage: page, totalPages: Math.ceil(totalRules / limit), totalItems: totalRules, itemsPerPage: limit, hasNextPage: false, hasPreviousPage: false }
      });
    }

    const mediaIds = rules.map(rule => rule.mediaId);
    const allComments = await Comment.find({ tenentId, mediaId: { $in: mediaIds } }).lean();

    const commentCountMap = {};
    allComments.forEach(comment => {
      if (!commentCountMap[comment.mediaId]) commentCountMap[comment.mediaId] = 0;
      commentCountMap[comment.mediaId]++;
    });

    const enrichedRules = await Promise.all(rules.map(async (rule) => {
      let displayUrl = rule.media_type === "VIDEO" ? rule.thumbnail_url : rule.media_url;
      let caption = rule.caption || "";
      let permalink = rule.permalink || "";
      let mediaType = rule.media_type || "";

      try {
        const igUrl = `https://graph.instagram.com/v21.0/${rule.mediaId}?fields=id,media_type,media_url,thumbnail_url,caption,timestamp,permalink&access_token=${latestToken.userAccessToken}`;
        const response = await axios.get(igUrl);
        const media = response.data;

        if (media) {
          displayUrl = media.media_type === "VIDEO" ? media.thumbnail_url : media.media_url;
          caption = media.caption || "";
          permalink = media.permalink || permalink;
          mediaType = media.media_type || mediaType;

          CommentAutomationRule.updateOne(
            { _id: rule._id },
            { $set: { media_url: media.media_url || rule.media_url, thumbnail_url: media.thumbnail_url || rule.thumbnail_url, media_type: media.media_type || rule.media_type, permalink: media.permalink || rule.permalink } }
          ).exec().catch(err => console.error(`Failed to update rule ${rule.ruleId}:`, err.message));
        }
      } catch (error) {
        console.error(`⚠️ Failed to fetch Instagram data for media ${rule.mediaId}:`, error.response?.data?.error?.message || error.message);
      }

      await new Promise(resolve => setTimeout(resolve, 50));

      let triggerMatchCount = 0;
      if (rule.triggerText && rule.triggerText.trim()) {
        const trimmedTrigger = rule.triggerText.trim();
        const isWildcard = trimmedTrigger === "*";
        if (isWildcard) {
          triggerMatchCount = allComments.filter(c => c.mediaId === rule.mediaId && c.tenentId === tenentId).length;
        } else {
          const escapedTrigger = escapeRegExp(trimmedTrigger.toLowerCase());
          const regex = new RegExp(escapedTrigger, 'i');
          allComments.forEach(comment => {
            if (comment.mediaId === rule.mediaId && comment.tenentId === tenentId && regex.test(comment.message || "")) triggerMatchCount++;
          });
        }
      }

      return {
        ruleId: rule.ruleId,
        mediaId: rule.mediaId,
        triggerText: rule.triggerText,
        commentReply: rule.commentReply,
        ruleType: rule.ruleType,
        carouselCount: rule.carouselCount || 0,
        totalComments: commentCountMap[rule.mediaId] || 0,
        triggerMatchComments: triggerMatchCount,
        displayUrl: displayUrl || "",
        caption: caption || "",
        createdAt: rule.createdAt,
        permalink: permalink || "",
        mediaType: mediaType || ""
      };
    }));

    const sortedRules = enrichedRules.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return res.status(200).json({
      success: true, data: sortedRules,
      pagination: { currentPage: page, totalPages: Math.ceil(totalRules / limit), totalItems: totalRules, itemsPerPage: limit, hasNextPage: page * limit < totalRules, hasPreviousPage: page > 1 }
    });

  } catch (error) {
    console.error("Error fetching rules by media:", error.response?.data || error.message);
    return res.status(500).json({ success: false, message: "Failed to fetch rules by media", error: error.message });
  }
});

// ─────────────────────────────────────────────
// GET /media-comments/:mediaId
// ─────────────────────────────────────────────
router.get("/media-comments/:mediaId", async (req, res) => {
  const { mediaId } = req.params;
  const tenentId = req.query.tenentId;
  const triggerText = req.query.triggerText;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const skip = (page - 1) * limit;

  if (!mediaId || !tenentId) {
    return res.status(400).json({ success: false, message: "Missing mediaId or tenentId" });
  }

  try {
    const mediaIdStr = String(mediaId);
    let ruleFilter = { tenentId, mediaId: mediaIdStr };
    if (triggerText) ruleFilter.triggerText = triggerText;

    const rules = await CommentAutomationRule.find(ruleFilter).lean();

    if (triggerText && rules.length === 0) {
      return res.status(200).json({
        success: true, count: 0, data: [],
        message: `No rules found with trigger text: "${triggerText}"`,
        stats: { totalComments: 0, fetchedComments: 0, triggeredCount: 0, triggerPercentage: "0%" },
        pagination: { currentPage: 1, totalPages: 0, totalItems: 0, itemsPerPage: limit, hasNextPage: false, hasPreviousPage: false }
      });
    }

    const triggerMap = {};
    rules.forEach(rule => {
      if (rule.triggerText && rule.triggerText.trim()) {
        const trimmedTrigger = rule.triggerText.trim();
        const isWildcard = trimmedTrigger === "*";
        if (isWildcard) {
          triggerMap[rule.ruleId] = { isWildcard: true, triggerText: trimmedTrigger };
        } else {
          const escapedTrigger = escapeRegExp(trimmedTrigger.toLowerCase());
          triggerMap[rule.ruleId] = { regex: new RegExp(escapedTrigger, 'i'), triggerText: trimmedTrigger, isWildcard: false };
        }
      }
    });

    const baseCommentQuery = { mediaId: mediaIdStr, tenentId };
    const totalComments = await Comment.countDocuments(baseCommentQuery);
    const comments = await Comment.find(baseCommentQuery).sort({ createdAt: -1 }).skip(skip).limit(limit).lean();

    if (comments.length === 0) {
      return res.status(200).json({
        success: true, count: 0, data: [],
        stats: { totalComments: 0, fetchedComments: 0, triggeredCount: 0, triggerPercentage: "0%" },
        pagination: { currentPage: page, totalPages: Math.ceil(totalComments / limit), totalItems: totalComments, itemsPerPage: limit, hasNextPage: page * limit < totalComments, hasPreviousPage: page > 1 }
      });
    }

    const enrichedComments = comments.map(comment => {
      const msg = comment.message || "";
      const matchedRules = [];
      Object.entries(triggerMap).forEach(([ruleId, triggerData]) => {
        const isMatch = triggerData.isWildcard ? true : triggerData.regex?.test(msg);
        if (isMatch) matchedRules.push({ ruleId, triggerText: triggerData.triggerText });
      });
      return {
        commentId: comment.commentId,
        mediaId: comment.mediaId,
        message: comment.message,
        username: comment.username,
        senderId: comment.senderId,
        timestamp: comment.Timestamp || comment.createdAt,
        response: comment.response || "",
        matchedTriggers: matchedRules,
        isTriggered: matchedRules.length > 0,
        triggeredRuleIds: matchedRules.map(r => r.ruleId),
        triggeredCount: matchedRules.length
      };
    });

    const finalComments = triggerText ? enrichedComments.filter(c => c.isTriggered) : enrichedComments;
    const triggeredComments = finalComments.filter(c => c.isTriggered);

    return res.status(200).json({
      success: true,
      count: finalComments.length,
      data: finalComments,
      filterApplied: triggerText ? { triggerText } : null,
      stats: {
        totalComments,
        fetchedComments: finalComments.length,
        triggeredCount: triggeredComments.length,
        triggerPercentage: finalComments.length > 0 ? ((triggeredComments.length / finalComments.length) * 100).toFixed(2) + "%" : "0%"
      },
      pagination: { currentPage: page, totalPages: Math.ceil(totalComments / limit), totalItems: totalComments, itemsPerPage: limit, hasNextPage: page * limit < totalComments, hasPreviousPage: page > 1 }
    });

  } catch (error) {
    console.error("Error fetching comments for media:", error.message);
    return res.status(500).json({ success: false, message: "Failed to fetch comments for this media", error: error.message });
  }
});

// ─────────────────────────────────────────────
// GET /media
// ─────────────────────────────────────────────
router.get("/media", async (req, res) => {
  const { tenentId, after, before } = req.query;
  const limit = parseInt(req.query.limit) || 10;

  if (!tenentId) {
    return res.status(400).json({ success: false, message: "Missing tenentId" });
  }

  try {
    const latestToken = await LongToken.findOne({ tenentId }).sort({ createdAt: -1 });
    if (!latestToken?.userAccessToken) {
      return res.status(404).json({ success: false, message: "Access token not found for this tenant" });
    }

    const userAccessToken = latestToken.userAccessToken;
    let igMediaUrl = `https://graph.instagram.com/me/media?fields=id,caption,media_type,media_url,thumbnail_url,timestamp,permalink&limit=${limit}&access_token=${userAccessToken}`;
    if (after) igMediaUrl += `&after=${after}`;
    else if (before) igMediaUrl += `&before=${before}`;

    const response = await axios.get(igMediaUrl);
    const { data = [], paging = {} } = response.data || {};

    return res.status(200).json({
      success: true,
      data,
      pagination: {
        totalItems: data.length,
        itemsPerPage: limit,
        hasNextPage: !!paging.next,
        hasPreviousPage: !!paging.previous,
        nextCursor: paging?.cursors?.after || null,
        prevCursor: paging?.cursors?.before || null,
        nextUrl: paging?.next || null,
        prevUrl: paging?.previous || null
      }
    });
  } catch (error) {
    console.error("Error fetching media:", error.response?.data || error.message);
    return res.status(500).json({ success: false, message: "Failed to fetch media from Instagram", error: error.message });
  }
});

// ─────────────────────────────────────────────
// POST /comment-automation  ← UPDATED: saves buttonType + buttonPayload
// ─────────────────────────────────────────────
router.post("/comment-automation", async (req, res) => {
  const { tenentId, automationRules } = req.body;

  console.log("Received from frontend:");
  console.log("tenentId:", tenentId);
  console.log("automationRules:", JSON.stringify(automationRules, null, 2));

  if (!tenentId || !automationRules) {
    return res.status(400).json({ success: false, message: "Missing tenentId or automationRules" });
  }

  try {
    for (const rule of automationRules) {
      const {
        mediaId,
        commentId,
        triggerText,
        commentReply,
        replyText,
        ruleType,
        carouselItems,
        carouselCount,
        isFollowerRequired,
      } = rule;

      // Validation
      if (!triggerText || triggerText.trim() === '') {
        return res.status(400).json({ success: false, message: "Trigger text is required" });
      }

      if (ruleType === 'text' && (!replyText || replyText.trim() === '')) {
        return res.status(400).json({ success: false, message: "Reply text is required for text rule type" });
      }

      if (ruleType === 'template' && (!carouselItems || carouselItems.length === 0)) {
        return res.status(400).json({ success: false, message: "Carousel must have at least one item" });
      }

      // Fetch Instagram media metadata
      const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN;
      let mediaData = {};
      try {
        const mediaResponse = await axios.get(
          `https://graph.instagram.com/v21.0/${mediaId}?fields=id,media_type,media_url,thumbnail_url,permalink&access_token=${accessToken}`
        );
        mediaData = mediaResponse.data;
      } catch (err) {
        console.error("⚠️ Could not fetch media info:", err.message);
      }

      // Normalize carousel items — preserves buttonType and buttonPayload
      const normalizedCarouselItems = ruleType === 'template'
        ? normalizeCarouselItems(carouselItems)
        : undefined;

      const ruleData = new CommentAutomationRule({
        ruleId: uuidv4(),
        tenentId,
        mediaId,
        commentId,
        triggerText,
        commentReply,
        replyText,
        ruleType: ruleType || 'text',
        carouselItems: normalizedCarouselItems,
        carouselCount: ruleType === 'template' ? (carouselCount || carouselItems.length) : undefined,
        media_url: mediaData.media_url || '',
        thumbnail_url: mediaData.thumbnail_url || '',
        media_type: mediaData.media_type || '',
        permalink: mediaData.permalink || '',
        isFollowerRequired: !!isFollowerRequired,
      });

      await ruleData.save();
      console.log('✅ Saved rule:', ruleData.ruleId, '| carouselItems:', normalizedCarouselItems?.length || 0);
    }

    return res.status(200).json({ success: true, message: "Rules saved successfully!" });

  } catch (error) {
    console.error('Error saving rules:', error.message);
    return res.status(500).json({ success: false, message: "Failed to save rules", error: error.message });
  }
});

// ─────────────────────────────────────────────
// GET /rules
// ─────────────────────────────────────────────
router.get("/rules", async (req, res) => {
  const tenentId = req.query.tenentId;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 5;
  const skip = (page - 1) * limit;

  if (!tenentId) {
    return res.status(400).json({ success: false, message: "Missing tenentId" });
  }

  try {
    const totalCount = await CommentAutomationRule.countDocuments({ tenentId });
    const rules = await CommentAutomationRule.find({ tenentId }).sort({ createdAt: -1 }).skip(skip).limit(limit);

    return res.status(200).json({
      success: true,
      rules: rules || [],
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalCount / limit),
        totalItems: totalCount,
        itemsPerPage: limit,
        hasNextPage: page * limit < totalCount,
        hasPreviousPage: page > 1,
      }
    });
  } catch (error) {
    console.error("Error fetching rules:", error.message);
    return res.status(500).json({ success: false, message: "Failed to fetch rules", error: error.message });
  }
});

// ─────────────────────────────────────────────
// DELETE /rule/:ruleId
// ─────────────────────────────────────────────
router.delete("/rule/:ruleId", async (req, res) => {
  const { ruleId } = req.params;
  const tenentId = req.query.tenentId;

  if (!ruleId || !tenentId) {
    return res.status(400).json({ success: false, message: "Missing ruleId or tenentId" });
  }

  try {
    const rule = await CommentAutomationRule.findOne({ ruleId, tenentId });

    if (!rule) {
      return res.status(404).json({ success: false, message: "Rule not found or doesn't belong to this tenant" });
    }

    await CommentAutomationRule.deleteOne({ ruleId });
    console.log(`Deleted rule with ID: ${ruleId}`);

    return res.status(200).json({ success: true, message: "Rule deleted successfully" });
  } catch (error) {
    console.error("Error deleting rule:", error.message);
    return res.status(500).json({ success: false, message: "Failed to delete rule", error: error.message });
  }
});

// ─────────────────────────────────────────────
// PUT /rule/:ruleId  ← UPDATED: saves buttonType + buttonPayload
// ─────────────────────────────────────────────
router.put("/rule/:ruleId", async (req, res) => {
  const { ruleId } = req.params;
  const {
    tenentId,
    mediaId,
    triggerText,
    commentReply,
    replyText,
    ruleType,
    carouselItems,
    carouselCount,
    isFollowerRequired,
  } = req.body;

  if (!ruleId || !tenentId) {
    return res.status(400).json({ success: false, message: "Missing ruleId or tenentId" });
  }

  if (!mediaId || !triggerText || triggerText.trim() === '') {
    return res.status(400).json({ success: false, message: "Missing required fields (mediaId or triggerText)" });
  }

  if (ruleType === 'text' && (!replyText || replyText.trim() === '')) {
    return res.status(400).json({ success: false, message: "Reply text is required for text rule type" });
  }

  if (ruleType === 'template' && (!carouselItems || carouselItems.length === 0)) {
    return res.status(400).json({ success: false, message: "Carousel must have at least one item" });
  }

  try {
    const rule = await CommentAutomationRule.findOne({ ruleId, tenentId });

    if (!rule) {
      return res.status(404).json({ success: false, message: "Rule not found or doesn't belong to this tenant" });
    }

    // Normalize carousel items — preserves buttonType and buttonPayload
    const normalizedCarouselItems = ruleType === 'template'
      ? normalizeCarouselItems(carouselItems)
      : undefined;

    const updateData = {
      mediaId,
      triggerText,
      commentReply,
      replyText,
      ruleType,
      isFollowerRequired: !!isFollowerRequired,
      updatedAt: new Date()
    };

    if (ruleType === 'template') {
      updateData.carouselItems = normalizedCarouselItems;
      updateData.carouselCount = carouselCount || carouselItems.length;
    }

    const updatedRule = await CommentAutomationRule.findOneAndUpdate(
      { ruleId },
      updateData,
      { new: true }
    );

    console.log(`✅ Updated rule: ${ruleId} | carouselItems:`, normalizedCarouselItems?.length || 0);

    return res.status(200).json({ success: true, message: "Rule updated successfully", rule: updatedRule });
  } catch (error) {
    console.error("Error updating rule:", error.message);
    return res.status(500).json({ success: false, message: "Failed to update rule", error: error.message });
  }
});

// ─────────────────────────────────────────────
// GET /update-thumbnail/:ruleId
// ─────────────────────────────────────────────
router.get("/update-thumbnail/:ruleId", async (req, res) => {
  const { ruleId } = req.params;
  const { tenentId } = req.query;

  try {
    if (!tenentId) {
      return res.status(400).json({ success: false, message: "Missing tenentId in request" });
    }

    const rule = await CommentAutomationRule.findOne({ ruleId, tenentId });
    if (!rule) {
      return res.status(404).json({ success: false, message: "Rule not found for this tenant" });
    }

    const latestToken = await LongToken.findOne({ tenentId }).sort({ createdAt: -1 });
    if (!latestToken || !latestToken.userAccessToken) {
      return res.status(404).json({ success: false, message: "Access token not found for this tenant" });
    }

    const igUrl = `https://graph.instagram.com/v21.0/${rule.mediaId}?fields=id,media_type,media_url,thumbnail_url,caption,timestamp,permalink&access_token=${latestToken.userAccessToken}`;
    const response = await axios.get(igUrl);
    const media = response.data;

    if (!media) {
      return res.status(404).json({ success: false, message: "Media not found in Instagram API" });
    }

    rule.media_url = media.media_url || "";
    rule.thumbnail_url = media.thumbnail_url || "";
    rule.media_type = media.media_type || "";
    rule.permalink = media.permalink || "";

    await rule.save();

    res.status(200).json({ success: true, updatedRule: rule });
  } catch (error) {
    console.error("❌ Error updating thumbnail:", error.message);
    res.status(500).json({ success: false, message: "Failed to update thumbnail", error: error.message });
  }
});

module.exports = router;
