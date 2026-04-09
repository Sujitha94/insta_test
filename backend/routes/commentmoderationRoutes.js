const express = require('express');
const router  = express.Router();
const Comment = require('../models/Comment');

/**
 * GET /api/comments/moderated
 * Query params:
 *   tenentId  — required
 *   action    — "deleted" | "hidden" | omit for both
 *   page      — default 1
 *   limit     — default 50
 *   search    — optional text search on message / username
 */
router.get('/moderated', async (req, res) => {
  try {
    const { tenentId, action, page = 1, limit = 50, search } = req.query;

    if (!tenentId) {
      return res.status(400).json({ error: 'tenentId is required' });
    }

    // ── Build query ───────────────────────────────────────────────
    const query = {
      tenentId,
      'moderation.action': { $in: ['deleted', 'hidden'] },
    };

    // Filter by specific action if provided
    if (action === 'deleted' || action === 'hidden') {
      query['moderation.action'] = action;
    }

    // Optional text search on message or username
    if (search) {
      query.$or = [
        { message:  { $regex: search, $options: 'i' } },
        { username: { $regex: search, $options: 'i' } },
      ];
    }

    const skip  = (Number(page) - 1) * Number(limit);
    const total = await Comment.countDocuments(query);

    const comments = await Comment.find(query)
      .sort({ 'moderation.moderatedAt': -1 })
      .skip(skip)
      .limit(Number(limit))
      .select('username senderId message mediaId commentId moderation Timestamp createdAt')
      .lean();

    // ── Summary counts ────────────────────────────────────────────
    const [deletedCount, hiddenCount] = await Promise.all([
      Comment.countDocuments({ tenentId, 'moderation.action': 'deleted' }),
      Comment.countDocuments({ tenentId, 'moderation.action': 'hidden'  }),
    ]);

    return res.json({
      comments,
      pagination: {
        total,
        page:       Number(page),
        limit:      Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
      summary: {
        total:        deletedCount + hiddenCount,
        deletedCount,
        hiddenCount,
      },
    });

  } catch (error) {
    console.error('Error fetching moderated comments:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/comments/moderated/stats
 * Returns aggregate stats for the moderation dashboard
 */
router.get('/moderated/stats', async (req, res) => {
  try {
    const { tenentId } = req.query;
    if (!tenentId) return res.status(400).json({ error: 'tenentId is required' });

    const stats = await Comment.aggregate([
      {
        $match: {
          tenentId,
          'moderation.action': { $in: ['deleted', 'hidden'] },
        },
      },
      {
        $group: {
          _id:              null,
          total:            { $sum: 1 },
          avgScore:         { $avg: '$moderation.score' },
          deletedCount:     { $sum: { $cond: [{ $eq: ['$moderation.action', 'deleted'] }, 1, 0] } },
          hiddenCount:      { $sum: { $cond: [{ $eq: ['$moderation.action', 'hidden']  }, 1, 0] } },
          abusiveCount:     { $sum: { $cond: [{ $eq: ['$moderation.verdict', 'abusive']    }, 1, 0] } },
          borderlineCount:  { $sum: { $cond: [{ $eq: ['$moderation.verdict', 'borderline'] }, 1, 0] } },
          languages:        { $addToSet: '$moderation.detectedLanguage' },
        },
      },
    ]);

    return res.json(stats[0] || {
      total: 0, avgScore: 0,
      deletedCount: 0, hiddenCount: 0,
      abusiveCount: 0, borderlineCount: 0, languages: [],
    });

  } catch (error) {
    console.error('Error fetching moderation stats:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
