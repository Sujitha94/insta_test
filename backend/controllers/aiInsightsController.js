const { generateAIInsights } = require("../services/aiInsightsService");

async function getAIInsights(req, res) {
  try {
    const report = await generateAIInsights();
    return res.status(200).json({ success: true, data: report });
  } catch (err) {
    console.error("[aiInsightsController] Error:", err.message);

    const isOpenAIError = err.response?.data || err.message?.includes("OpenAI");
    if (isOpenAIError) {
      return res.status(502).json({
        success: false,
        error:   "AI service unavailable. Check your OPENAI_API_KEY and quota.",
        detail:  err.response?.data?.error?.message || err.message,
      });
    }

    if (err.name === "MongoError" || err.name === "MongoServerError") {
      return res.status(503).json({
        success: false,
        error:   "Database error while aggregating analytics data.",
        detail:  err.message,
      });
    }

    return res.status(500).json({
      success: false,
      error:   "Internal server error. Please try again.",
      detail:  process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
}

module.exports = { getAIInsights };