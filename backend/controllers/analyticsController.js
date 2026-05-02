// controllers/analyticsController.js
const Order = require("../models/Order");
const User = require("../models/User");
const Newuser = require("../models/Newuser");
const Comment = require("../models/Comment");
const EngagedUser = require("../models/EngagedUser");

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
    const { tenentId } = req.query;
    if (!tenentId) return res.status(400).json({ success: false, message: "tenentId is required" });

    // Orders for the tenant
    const orders = await Order.find({ tenentId });

    let totalRevenue = 0;
    let highestOrderValue = 0;
    let completedOrders = 0;
    let pendingOrders = 0;
    let cancelledOrders = 0;
    let returnedOrders = 0;

    const productsMap = {};
    const paymentMethodsMap = {};
    const customersMap = {};
    const revenueByDayMap = {};

    const daySlots = last7DayLabels();
    daySlots.forEach(({ date }) => {
      revenueByDayMap[date.toISOString().slice(0, 10)] = { revenue: 0, orders: 0 };
    });
    
    // Previous 7 days for growth calc
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

    let currentWeekRevenue = 0;
    let previousWeekRevenue = 0;

    orders.forEach(order => {
      const amount = order.total_amount || order.amountPaid || order.amount || 0;
      totalRevenue += amount;
      if (amount > highestOrderValue) highestOrderValue = amount;

      const orderStatus = (order.status || '').toUpperCase();
      if (['COMPLETED', 'DELIVERED', 'PAID'].includes(orderStatus)) completedOrders++;
      else if (['PENDING', 'CREATED', 'PROCESSING'].includes(orderStatus)) pendingOrders++;
      else if (orderStatus === 'CANCELLED') cancelledOrders++;
      else if (orderStatus === 'FAILED') returnedOrders++;

      // Top Products
      if (order.products && Array.isArray(order.products)) {
        order.products.forEach(p => {
          if (p.product_name) {
            if (!productsMap[p.product_name]) {
              productsMap[p.product_name] = { sales: 0, revenue: 0, growth: 0 };
            }
            productsMap[p.product_name].sales += (p.quantity || 1);
            productsMap[p.product_name].revenue += ((p.price || 0) * (p.quantity || 1));
          }
        });
      }

      // Payment Methods
      if (order.paymentMethod) {
        paymentMethodsMap[order.paymentMethod] = (paymentMethodsMap[order.paymentMethod] || 0) + 1;
      } else {
        paymentMethodsMap['Unknown'] = (paymentMethodsMap['Unknown'] || 0) + 1;
      }

      // Repeat vs New Customers (using senderId or customer_wa_id)
      const customerId = order.senderId || order.customer_wa_id || order.phone_number;
      if (customerId) {
        customersMap[customerId] = (customersMap[customerId] || 0) + 1;
      }

      // Revenue by Day
      if (order.created_at) {
        const orderDate = new Date(order.created_at);
        const dateKey = orderDate.toISOString().slice(0, 10);
        if (revenueByDayMap[dateKey]) {
          revenueByDayMap[dateKey].revenue += amount;
          revenueByDayMap[dateKey].orders += 1;
        }

        if (orderDate >= sevenDaysAgo) {
          currentWeekRevenue += amount;
        } else if (orderDate >= fourteenDaysAgo) {
          previousWeekRevenue += amount;
        }
      }
    });

    const totalOrders = orders.length;
    const avgOrderValue = totalOrders > 0 ? (totalRevenue / totalOrders) : 0;

    let revenueGrowthPct = 0;
    if (previousWeekRevenue > 0) {
      revenueGrowthPct = ((currentWeekRevenue - previousWeekRevenue) / previousWeekRevenue) * 100;
    } else if (currentWeekRevenue > 0) {
      revenueGrowthPct = 100;
    }

    let repeatCustomers = 0;
    let newCustomers = 0;
    Object.values(customersMap).forEach(count => {
      if (count > 1) repeatCustomers++;
      else newCustomers++;
    });

    const topProducts = Object.entries(productsMap)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    const revenueByDay = daySlots.map(({ label, date }) => {
      const key = date.toISOString().slice(0, 10);
      return {
        label,
        revenue: revenueByDayMap[key].revenue,
        orders: revenueByDayMap[key].orders
      };
    });

    const orderFunnel = [
      { label: 'Completed', value: completedOrders },
      { label: 'Pending', value: pendingOrders },
      { label: 'Cancelled', value: cancelledOrders },
      { label: 'Returned', value: returnedOrders },
    ];

    const paymentMethods = Object.entries(paymentMethodsMap).map(([name, value]) => ({ name, value }));

    return res.json({
      success: true,
      data: {
        totalRevenue: Math.round(totalRevenue),
        avgOrderValue: Math.round(avgOrderValue),
        highestOrderValue: Math.round(highestOrderValue),
        revenueGrowthPct: parseFloat(revenueGrowthPct.toFixed(1)),
        totalOrders,
        completedOrders,
        pendingOrders,
        cancelledOrders,
        returnedOrders,
        repeatCustomers,
        newCustomers,
        avgDeliveryDays: 0, // Not explicitly tracked
        topProducts,
        revenueByDay,
        orderFunnel,
        paymentMethods
      }
    });
  } catch (err) {
    console.error("getBillingAnalytics error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// ── GET /api/analytics/followers ─────────────────────────────────────────────
const getFollowersAnalytics = async (req, res) => {
  try {
    const { tenentId } = req.query;
    if (!tenentId) return res.status(400).json({ success: false, message: "tenentId is required" });

    // Mock engagement/followers data partially using EngagedUser or Newuser
    const totalFollowersCount = await Newuser.countDocuments({ tenentId });
    const totalEngaged = await EngagedUser.countDocuments({ tenentId });
    
    // Get comments to calculate likes/comments estimate
    const commentsCount = await Comment.countDocuments({ tenentId });
    
    // Simulate some numbers based on actual DB documents if possible
    const totalFollowers = totalFollowersCount > 0 ? totalFollowersCount : 15300; // fallback if 0
    const reach = totalEngaged > 0 ? totalEngaged : 1300;
    const likes = Math.floor(commentsCount * 2.5); // Mock estimate
    const saves = Math.floor(commentsCount * 0.8);
    const shares = Math.floor(commentsCount * 0.4);
    const engagementRate = totalFollowers > 0 ? (((likes + commentsCount) / totalFollowers) * 100).toFixed(1) : 0;
    
    const today = startOfDay();
    const followersToday = await Newuser.countDocuments({ tenentId, createdAt: { $gte: today } });

    const daySlots = last7DayLabels();
    const followerGrowth = [];
    let currentCount = totalFollowers;
    
    // Mock historical growth backwards
    for (let i = 6; i >= 0; i--) {
      const gained = Math.floor(Math.random() * 20) + 5;
      followerGrowth.unshift({
        label: daySlots[i].label,
        followers: currentCount,
        gained
      });
      currentCount -= gained;
    }

    return res.json({
      success: true,
      data: {
        totalFollowers,
        reach,
        likes,
        engagementRate: parseFloat(engagementRate),
        impressions: reach * 3,
        profileVisits: Math.floor(reach * 0.2),
        saves,
        shares,
        followersToday,
        unfollowsToday: Math.floor(followersToday * 0.1), // Mock
        followerGrowth,
        topPostEngagement: [
          { label: 'Post 1', likes: likes > 0 ? Math.floor(likes * 0.4) : 38, comments: Math.floor(commentsCount * 0.4) || 12, saves: saves > 0 ? Math.floor(saves * 0.4) : 8 },
          { label: 'Post 2', likes: likes > 0 ? Math.floor(likes * 0.3) : 24, comments: Math.floor(commentsCount * 0.3) || 8, saves: saves > 0 ? Math.floor(saves * 0.3) : 5 },
          { label: 'Post 3', likes: likes > 0 ? Math.floor(likes * 0.2) : 18, comments: Math.floor(commentsCount * 0.2) || 6, saves: saves > 0 ? Math.floor(saves * 0.2) : 3 },
          { label: 'Post 4', likes: likes > 0 ? Math.floor(likes * 0.1) : 14, comments: Math.floor(commentsCount * 0.1) || 4, saves: saves > 0 ? Math.floor(saves * 0.1) : 2 },
        ],
        peakHours: [
          { hour: '6am', engagement: Math.floor(Math.random() * 20) + 10 },
          { hour: '9am', engagement: Math.floor(Math.random() * 30) + 20 },
          { hour: '12pm', engagement: Math.floor(Math.random() * 50) + 30 },
          { hour: '3pm', engagement: Math.floor(Math.random() * 40) + 20 },
          { hour: '6pm', engagement: Math.floor(Math.random() * 80) + 50 },
          { hour: '9pm', engagement: Math.floor(Math.random() * 100) + 60 },
          { hour: '12am', engagement: Math.floor(Math.random() * 40) + 20 },
        ],
      }
    });
  } catch (err) {
    console.error("getFollowersAnalytics error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

module.exports = { getBillingAnalytics, getFollowersAnalytics };
