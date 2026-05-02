// routes/aiInsightsRoutes.js
const express = require('express');
const router  = express.Router();
const {
  getAnalyticsReport,
  getFinanceReport,
} = require('../controllers/aiInsightsController');

// GET /api/ai-insights/analytics-report?tenentId=xxx&mode=finance|followers
router.get('/analytics-report', getAnalyticsReport);

// GET /api/ai-insights/finance-report?tenentId=xxx&startDate=&endDate=&status=
router.get('/finance-report', getFinanceReport);

module.exports = router;