// controllers/analyticsController.js
const Order = require("../models/Order");
const User = require("../models/User");
const Comment = require("../models/Comment");
// If you have an EngagedUser model, import it; otherwise mock data is used below.
// const EngagedUser = require("../models/EngagedUser");

// ── helpers ──────────────────────────────────────────────────────────────────
const startOfDay = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

const last7DayLabels = () => {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const labels = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    labels.push({ label: days[d.getDay()], date: d });
  }
  return labels;
};

// ── GET /api/analytics/billing ────────────────────────────────────────────────
const getBillingAnalytics = async (req, res) => {
  try {
    const today = startOfDay();

    // Aggregates
    const [revenueAgg] = await Order.aggregate([
      { $group: { _id: null, total: { $sum: "$totalPrice" } } },
    ]);
    const totalRevenue = revenueAgg?.total ?? 0;
    const totalOrders = await Order.countDocuments();
    const activeCustomers = await User.countDocuments({ isActive: true });
    const comments = await Comment.countDocuments();

    // Today
    const [todayAgg] = await Order.aggregate([
      { $match: { createdAt: { $gte: today } } },
      { $group: { _id: null, revenue: { $sum: "$totalPrice" }, count: { $sum: 1 } } },
    ]);
    const ordersToday = todayAgg?.count ?? 0;
    const revenueToday = todayAgg?.revenue ?? 0;

    // Last-7-days graph
    const daySlots = last7DayLabels();
    const graphAgg = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: daySlots[0].date },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          value: { $sum: "$totalPrice" },
        },
      },
    ]);

    const graphMap = {};
    graphAgg.forEach((g) => { graphMap[g._id] = g.value; });

    const graph = daySlots.map(({ label, date }) => {
      const key = date.toISOString().slice(0, 10);
      return { label, value: graphMap[key] ?? 0 };
    });

    return res.json({
      totalRevenue,
      totalOrders,
      activeCustomers,
      comments,
      ordersToday,
      revenueToday,
      graph,
    });
  } catch (err) {
    console.error("getBillingAnalytics error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// ── GET /api/analytics/followers ─────────────────────────────────────────────
const getFollowersAnalytics = async (req, res) => {
  try {
    /*
     * If you have a real EngagedUser / Follower model, replace the
     * mock block below with real DB queries (same pattern as billing above).
     *
     * Example with a Follower model:
     *
     *   const today = startOfDay();
     *   const followers      = await Follower.countDocuments();
     *   const reach          = await Follower.countDocuments({ reached: true });
     *   const likes          = await Follower.countDocuments({ liked: true });
     *   const todayFollowers = await Follower.countDocuments({ createdAt: { $gte: today } });
     *   const engagementRate = ((likes / (followers || 1)) * 100).toFixed(1);
     *   ...
     */

    // ── MOCK (replace once you have real models) ─────────────────────────────
    const daySlots = last7DayLabels();
    const BASE = 14800;
    const growth = daySlots.map(({ label }, i) => ({
      label,
      value: BASE + i * 72,
    }));

    return res.json({
      followers: 15300,
      reach: 1300,
      likes: 94,
      engagementRate: 4.2,
      todayFollowers: 20,
      todayEngagement: 5,
      growth,
    });
    // ── END MOCK ─────────────────────────────────────────────────────────────
  } catch (err) {
    console.error("getFollowersAnalytics error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

module.exports = { getBillingAnalytics, getFollowersAnalytics };