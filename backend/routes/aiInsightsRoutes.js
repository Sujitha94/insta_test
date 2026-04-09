const express           = require("express");
const rateLimit         = require("express-rate-limit");
const { getAIInsights } = require("../controllers/aiInsightsController");

const router = express.Router();

const insightsLimiter = rateLimit({
  windowMs:        5 * 60 * 1000,
  max:             10,
  standardHeaders: true,
  legacyHeaders:   false,
  message: {
    success: false,
    error:   "Too many requests. Please wait a few minutes.",
  },
});

router.get("/", insightsLimiter, getAIInsights);

module.exports = router;