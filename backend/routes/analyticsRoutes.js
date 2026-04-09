// routes/analyticsRoutes.js
const express = require("express");
const router = express.Router();
const {
  getBillingAnalytics,
  getFollowersAnalytics,
} = require("../controllers/analyticsController");

// GET /api/analytics/billing
router.get("/billing", getBillingAnalytics);

// GET /api/analytics/followers
router.get("/followers", getFollowersAnalytics);

module.exports = router;