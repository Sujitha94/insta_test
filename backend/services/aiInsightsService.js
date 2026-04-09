/**
 * aiInsightsService.js
 * Core service: aggregates MongoDB data, summarizes it, and sends to OpenAI.
 * InstaxBot – AI-powered Business Intelligence
 *
 * Field mapping (Order.js actual fields):
 *   total_amount   → revenue totals
 *   products[]     → items array (sku, product_name, quantity, price)
 *   senderId       → customer identifier
 *   created_at     → date field (no Mongoose timestamps)
 *   status         → mixed case handled via $toLower
 */

const axios = require("axios");
const Order = require("../models/Order");

const OPENAI_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const OPENAI_MODEL   = process.env.OPENAI_MODEL || "llama-3.3-70b-versatile";
const DAYS_TREND     = 7;
const DAYS_EXTENDED  = 30;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function safeDiv(a, b) {
  return b === 0 ? 0 : round2(a / b);
}

// Completed statuses — your schema has both lowercase and uppercase variants
const COMPLETED_STATUSES = ["paid", "delivered", "completed", "shipped",
                            "PAID", "DELIVERED", "COMPLETED", "SHIPPED"];

// ─── Data Aggregators ─────────────────────────────────────────────────────────

/**
 * Revenue trend for last N days.
 * Uses: created_at, total_amount, status
 */
async function getRevenueTrend(days = DAYS_TREND) {
  const since = daysAgo(days);

  const dailyRevenue = await Order.aggregate([
    {
      $match: {
        created_at: { $gte: since },
        $expr: {
          $in: [{ $toLower: "$status" }, ["paid", "delivered", "completed", "shipped"]]
        },
      },
    },
    {
      $group: {
        _id:     { $dateToString: { format: "%Y-%m-%d", date: "$created_at" } },
        revenue: { $sum: "$total_amount" },
        orders:  { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  const half       = Math.ceil(dailyRevenue.length / 2);
  const firstHalf  = dailyRevenue.slice(0, half);
  const secondHalf = dailyRevenue.slice(half);
  const avgFirst   = safeDiv(firstHalf.reduce((s, d) => s + d.revenue, 0),  firstHalf.length);
  const avgSecond  = safeDiv(secondHalf.reduce((s, d) => s + d.revenue, 0), secondHalf.length);

  const trendPercent = avgFirst > 0 ? round2(((avgSecond - avgFirst) / avgFirst) * 100) : 0;
  const totalRevenue = dailyRevenue.reduce((s, d) => s + d.revenue, 0);
  const totalOrders  = dailyRevenue.reduce((s, d) => s + d.orders, 0);
  const sortedByRev  = [...dailyRevenue].sort((a, b) => b.revenue - a.revenue);

  return {
    days,
    totalRevenue:   round2(totalRevenue),
    totalOrders,
    avgOrderValue:  safeDiv(totalRevenue, totalOrders),
    trendPercent,
    trendDirection: trendPercent >= 0 ? "up" : "down",
    peakDay:        sortedByRev[0]?._id || null,
  };
}

/**
 * Top selling products by revenue.
 * Uses: products[].sku, products[].product_name, products[].quantity, products[].price
 */
async function getTopProducts(limit = 5, days = DAYS_EXTENDED) {
  const since = daysAgo(days);

  return Order.aggregate([
    {
      $match: {
        created_at: { $gte: since },
        $expr: {
          $in: [{ $toLower: "$status" }, ["paid", "delivered", "completed", "shipped"]]
        },
      },
    },
    { $unwind: "$products" },
    {
      $group: {
        _id:       "$products.sku",
        name:      { $first: "$products.product_name" },
        unitsSold: { $sum: "$products.quantity" },
        revenue:   { $sum: { $multiply: ["$products.price", "$products.quantity"] } },
      },
    },
    { $sort: { revenue: -1 } },
    { $limit: limit },
    {
      $project: {
        _id: 0, sku: "$_id", name: 1, unitsSold: 1,
        revenue: { $round: ["$revenue", 2] },
      },
    },
  ]);
}

/**
 * Low performing products: least revenue, at least 1 unit sold.
 */
async function getLowPerformingProducts(limit = 5, days = DAYS_EXTENDED) {
  const since = daysAgo(days);

  return Order.aggregate([
    {
      $match: {
        created_at: { $gte: since },
        $expr: {
          $in: [{ $toLower: "$status" }, ["paid", "delivered", "completed", "shipped"]]
        },
      },
    },
    { $unwind: "$products" },
    {
      $group: {
        _id:       "$products.sku",
        name:      { $first: "$products.product_name" },
        unitsSold: { $sum: "$products.quantity" },
        revenue:   { $sum: { $multiply: ["$products.price", "$products.quantity"] } },
      },
    },
    { $match: { unitsSold: { $gte: 1 } } },
    { $sort: { revenue: 1 } },
    { $limit: limit },
    {
      $project: {
        _id: 0, sku: "$_id", name: 1, unitsSold: 1,
        revenue: { $round: ["$revenue", 2] },
      },
    },
  ]);
}

/**
 * Customer behaviour: new vs repeat buyers.
 * Uses: senderId (customer identifier), total_amount
 */
async function getCustomerBehaviour(days = DAYS_EXTENDED) {
  const since = daysAgo(days);

  const [cohortData, topSpenders] = await Promise.all([
    Order.aggregate([
      {
        $match: {
          created_at: { $gte: since },
          $expr: {
            $in: [{ $toLower: "$status" }, ["paid", "delivered", "completed", "shipped"]]
          },
        },
      },
      {
        $group: {
          _id:        "$senderId",
          orderCount: { $sum: 1 },
          totalSpent: { $sum: "$total_amount" },
        },
      },
      {
        $group: {
          _id:              null,
          newBuyers:        { $sum: { $cond: [{ $eq: ["$orderCount", 1] }, 1, 0] } },
          repeatBuyers:     { $sum: { $cond: [{ $gt: ["$orderCount", 1] }, 1, 0] } },
          totalCustomers:   { $sum: 1 },
          avgLifetimeValue: { $avg: "$totalSpent" },
        },
      },
    ]),

    Order.aggregate([
      {
        $match: {
          created_at: { $gte: since },
          $expr: {
            $in: [{ $toLower: "$status" }, ["paid", "delivered", "completed", "shipped"]]
          },
        },
      },
      {
        $group: {
          _id:         "$senderId",
          profileName: { $first: "$profile_name" },
          totalSpent:  { $sum: "$total_amount" },
          orderCount:  { $sum: 1 },
        },
      },
      { $sort: { totalSpent: -1 } },
      { $limit: 5 },
      {
        $project: {
          _id: 0,
          customerId:  "$_id",
          profileName: 1,
          totalSpent:  { $round: ["$totalSpent", 2] },
          orderCount:  1,
        },
      },
    ]),
  ]);

  const c = cohortData[0] || { newBuyers: 0, repeatBuyers: 0, totalCustomers: 0, avgLifetimeValue: 0 };

  return {
    totalCustomers:   c.totalCustomers,
    newBuyers:        c.newBuyers,
    repeatBuyers:     c.repeatBuyers,
    repeatRate:       safeDiv(c.repeatBuyers * 100, c.totalCustomers),
    avgLifetimeValue: round2(c.avgLifetimeValue || 0),
    topSpenders,
  };
}

/**
 * Order funnel: status breakdown, completion and cancellation rates.
 * Normalizes status to lowercase for consistent grouping.
 */
async function getOrderFunnel(days = DAYS_EXTENDED) {
  const since = daysAgo(days);

  const statusGroups = await Order.aggregate([
    { $match: { created_at: { $gte: since } } },
    {
      $group: {
        _id:     { $toLower: "$status" },   // normalize PAID → paid, etc.
        count:   { $sum: 1 },
        revenue: { $sum: "$total_amount" },
      },
    },
    { $sort: { count: -1 } },
  ]);

  const total     = statusGroups.reduce((s, g) => s + g.count, 0);
  const cancelled = statusGroups.find((g) => g._id === "cancelled")?.count || 0;
  const completedStatuses = ["paid", "delivered", "completed", "shipped"];
  const completedCount = statusGroups
    .filter((g) => completedStatuses.includes(g._id))
    .reduce((s, g) => s + g.count, 0);

  return {
    totalOrders:      total,
    cancellationRate: safeDiv(cancelled * 100, total),
    completionRate:   safeDiv(completedCount * 100, total),
    statusBreakdown:  statusGroups.map((g) => ({
      status:           g._id,
      count:            g.count,
      revenueGenerated: round2(g.revenue),
      share:            safeDiv(g.count * 100, total),
    })),
  };
}

/**
 * Payment method breakdown.
 * Uses: paymentMethod, total_amount
 */
async function getPaymentInsights(days = DAYS_EXTENDED) {
  const since = daysAgo(days);

  return Order.aggregate([
    {
      $match: {
        created_at: { $gte: since },
        $expr: {
          $in: [{ $toLower: "$status" }, ["paid", "delivered", "completed", "shipped"]]
        },
      },
    },
    {
      $group: {
        _id:     "$paymentMethod",
        count:   { $sum: 1 },
        revenue: { $sum: "$total_amount" },
      },
    },
    { $sort: { revenue: -1 } },
    {
      $project: {
        _id: 0, method: "$_id", count: 1,
        revenue: { $round: ["$revenue", 2] },
      },
    },
  ]);
}

// ─── Predictive Signals (rule-based, no ML) ───────────────────────────────────

function generatePredictiveSignals({ revenueTrend, customerData, orderFunnel }) {
  const signals = [];
  const { trendPercent, trendDirection, totalOrders, avgOrderValue, days } = revenueTrend;

  if (trendDirection === "up" && trendPercent >= 10) {
    signals.push(`Sales likely to continue growing — revenue rose ${trendPercent}% in the second half of the past ${days} days vs the first half.`);
  } else if (trendDirection === "down" && Math.abs(trendPercent) >= 10) {
    signals.push(`Revenue declining (${Math.abs(trendPercent)}% drop in recent days). Immediate intervention recommended.`);
  }

  if (customerData.repeatRate >= 40) {
    signals.push(`Strong retention: ${customerData.repeatRate}% repeat purchase rate. A loyalty program could push this above 55% within 60 days.`);
  } else if (customerData.repeatRate < 15) {
    signals.push(`Repeat rate critically low (${customerData.repeatRate}%). Post-purchase WhatsApp sequences could improve LTV by 30–50%.`);
  }

  if (totalOrders < 10) {
    signals.push(`Order volume is low (${totalOrders} orders in ${days} days). Acquisition campaigns are the top priority.`);
  }

  if (orderFunnel.cancellationRate > 15) {
    signals.push(`Cancellation rate ${orderFunnel.cancellationRate}% exceeds 10% threshold. Investigate payment failures and fulfillment delays.`);
  }

  if (avgOrderValue > 0) {
    signals.push(`AOV is ₹${avgOrderValue}. Product bundling at checkout could increase this by 15–25%.`);
  }

  return signals.length > 0
    ? signals
    : ["Insufficient order data. Allow 7+ days of order history for accurate predictions."];
}

// ─── Summary Builder ──────────────────────────────────────────────────────────

function buildSummaryPayload({ revenueTrend, topProducts, lowProducts, customerData, orderFunnel, paymentInsights, predictiveSignals }) {
  return {
    reporting_period: `Last ${DAYS_EXTENDED} days`,
    revenue: {
      total_30d:        revenueTrend.totalRevenue,
      total_orders_7d:  revenueTrend.totalOrders,
      avg_order_value:  revenueTrend.avgOrderValue,
      trend_7d_percent: revenueTrend.trendPercent,
      trend_direction:  revenueTrend.trendDirection,
      peak_day:         revenueTrend.peakDay,
    },
    customers: {
      total:               customerData.totalCustomers,
      new_buyers:          customerData.newBuyers,
      repeat_buyers:       customerData.repeatBuyers,
      repeat_rate_percent: customerData.repeatRate,
      avg_lifetime_value:  customerData.avgLifetimeValue,
    },
    order_funnel: {
      total_orders:              orderFunnel.totalOrders,
      completion_rate_percent:   orderFunnel.completionRate,
      cancellation_rate_percent: orderFunnel.cancellationRate,
      status_breakdown:          orderFunnel.statusBreakdown,
    },
    top_products:            topProducts.map((p) => ({ name: p.name, sku: p.sku, units_sold: p.unitsSold, revenue: p.revenue })),
    low_performing_products: lowProducts.map((p) => ({ name: p.name, sku: p.sku, units_sold: p.unitsSold, revenue: p.revenue })),
    payment_methods:         paymentInsights,
    predictive_signals:      predictiveSignals,
  };
}

// ─── OpenAI Integration ───────────────────────────────────────────────────────

async function callOpenAI(summaryPayload) {
  const systemPrompt = `You are an elite e-commerce business analyst embedded in InstaxBot, a SaaS Instagram commerce platform used by Indian merchants.

You receive a structured JSON summary of a merchant's 30-day sales data. Analyze it and return a STRICTLY formatted JSON object.

OUTPUT FORMAT — return only this JSON, no markdown, no preamble:
{
  "insights": ["fact-driven insight with specific numbers"],
  "problems": ["concrete problem with supporting data"],
  "suggestions": ["specific, actionable recommendation"],
  "alerts": ["urgent issue requiring immediate attention"],
  "top_opportunities": ["growth opportunity with estimated impact"]
}

CONSTRAINTS:
- insights: 3–5 items | problems: 2–4 | suggestions: 3–5 | alerts: 0–3 | top_opportunities: 2–4
- Currency is INR (₹). Reference rupee amounts specifically.
- Every item MUST reference specific numbers from the data
- No generic advice. Be direct and commercially savvy
- Tone: senior business consultant, not a chatbot
- Return ONLY raw JSON. No markdown code fences.`;

  const response = await axios.post(
    OPENAI_API_URL,
    {
      model:       OPENAI_MODEL,
      temperature: 0.4,
      max_tokens:  1500,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user",   content: `Analyze this merchant's data:\n\n${JSON.stringify(summaryPayload, null, 2)}` },
      ],
    },
    {
      headers: {
        Authorization:  `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      timeout: 30000,
    }
  );

  const rawContent = response.data.choices[0]?.message?.content?.trim();
  if (!rawContent) throw new Error("OpenAI returned empty content");

  const cleaned = rawContent.replace(/^```json\s*/i, "").replace(/\s*```$/i, "").trim();
  const parsed  = JSON.parse(cleaned);

  const keys = ["insights", "problems", "suggestions", "alerts", "top_opportunities"];
  for (const key of keys) {
    if (!Array.isArray(parsed[key])) parsed[key] = [];
  }

  return parsed;
}

// ─── Main Orchestrator ────────────────────────────────────────────────────────

async function generateAIInsights() {
  const [revenueTrend, topProducts, lowProducts, customerData, orderFunnel, paymentInsights] =
    await Promise.all([
      getRevenueTrend(DAYS_TREND),
      getTopProducts(5, DAYS_EXTENDED),
      getLowPerformingProducts(5, DAYS_EXTENDED),
      getCustomerBehaviour(DAYS_EXTENDED),
      getOrderFunnel(DAYS_EXTENDED),
      getPaymentInsights(DAYS_EXTENDED),
    ]);

  const predictiveSignals = generatePredictiveSignals({ revenueTrend, customerData, orderFunnel });

  const summaryPayload = buildSummaryPayload({
    revenueTrend, topProducts, lowProducts, customerData,
    orderFunnel, paymentInsights, predictiveSignals,
  });

  const aiInsights = await callOpenAI(summaryPayload);

  return {
    generated_at: new Date().toISOString(),
    metrics_snapshot: {
      revenue_7d:            revenueTrend.totalRevenue,
      revenue_trend_percent: revenueTrend.trendPercent,
      trend_direction:       revenueTrend.trendDirection,
      avg_order_value:       revenueTrend.avgOrderValue,
      total_customers:       customerData.totalCustomers,
      repeat_rate:           customerData.repeatRate,
      completion_rate:       orderFunnel.completionRate,
      cancellation_rate:     orderFunnel.cancellationRate,
      top_product:           topProducts[0]?.name || null,
      low_product:           lowProducts[0]?.name || null,
    },
    predictive_signals,
    top_products:            topProducts,
    low_performing_products: lowProducts,
    ...aiInsights,
  };
}

module.exports = { generateAIInsights };