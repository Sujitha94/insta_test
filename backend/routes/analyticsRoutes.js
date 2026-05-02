// backend/routes/analyticsRoutes.js
const express = require('express');
const router  = express.Router();
const { getAnalyticsReport, getFinanceReport } = require('../controllers/aiInsightsController');

// GET /api/analytics/billing?tenentId=xxx
router.get('/billing', (req, res) => {
  req.query.mode = 'finance';
  return getAnalyticsReport(req, res);
});

// GET /api/analytics/followers?tenentId=xxx
router.get('/followers', (req, res) => {
  req.query.mode = 'followers';
  return getAnalyticsReport(req, res);
});

// GET /api/analytics/finance-report?tenentId=xxx (optional table view)
router.get('/finance-report', getFinanceReport);

module.exports = router;