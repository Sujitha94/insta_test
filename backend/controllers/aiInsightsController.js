// backend/controllers/aiInsightsController.js
const Order       = require('../models/Order');
const Newuser     = require('../models/Newuser');
const Comment     = require('../models/Comment');
const EngagedUser = require('../models/EngagedUser');
const Message     = require('../models/Message');

// ── Safe helpers ──────────────────────────────────────────────────────────────
const safe    = (n)  => (n == null || isNaN(Number(n)) ? 0 : Number(n));
const fix1    = (n)  => parseFloat(safe(n).toFixed(1));
const pct     = (n, d) => d > 0 ? fix1((n / d) * 100) : 0;
const daysAgo = (n)  => { const d = new Date(); d.setDate(d.getDate() - n); d.setHours(0,0,0,0); return d; };
const todayStart = () => { const d = new Date(); d.setHours(0,0,0,0); return d; };

const last7Labels = () => {
  const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    d.setHours(0, 0, 0, 0);
    return { label: days[d.getDay()], date: new Date(d), key: d.toISOString().slice(0, 10) };
  });
};

// Status buckets — covers both lowercase and UPPERCASE variants in DB
const COMPLETED = ['paid','completed','delivered','PAID','COMPLETED','DELIVERED'];
const PENDING   = ['pending','processing','created','PENDING','PROCESSING','CREATED'];
const CANCELLED = ['cancelled','failed','CANCELLED','FAILED'];
const RETURNED  = ['HOLDED'];

// ── Rule-based AI Advisor (built from real metrics) ───────────────────────────
const buildAiAdvisor = (metrics) => {
  const eng    = fix1(metrics.engagementRate || 0);
  const engStr = eng + '%';

  // Find peak hour label
  let peakHourLabel = '9pm';
  if (metrics.peakHours && metrics.peakHours.length > 0) {
    const peak = metrics.peakHours.reduce((a, b) => a.engagement > b.engagement ? a : b);
    peakHourLabel = peak.hour;
  }

  // Find top product name
  let topProduct = 'your top product';
  if (metrics.topProductName) topProduct = metrics.topProductName;

  return {
    peak_sales_time:   `${peakHourLabel} daily`,
    sales_trend:       metrics.totalFollowers > 0 ? 'Upward Growth Velocity' : 'Building Momentum',
    top_efficiency:    topProduct,
    attention_needed:  eng < 2
      ? 'Low engagement — increase story frequency'
      : `Improve ${topProduct}`,
    guidance:          eng > 3
      ? 'Leverage high engagement — launch a product collab or poll campaign.'
      : 'Boost Reels frequency and use trending audio to lift reach.',
    off_peak_strategy: 'Offer Early Bird morning deals.',
    lost_velocity:     engStr,
    target_focus:      eng > 3 ? 'Retention Matrix' : 'New deals',
    manpower_tasks: [
      { task: 'Content Calendar Audit',     lead: 'Growth Head',       status: 'Active'      },
      { task: 'Influencer Outreach',        lead: 'Marketing Manager', status: 'In Progress' },
      { task: 'Engagement Response Sprint', lead: 'Community Manager', status: 'Verified'    },
    ],
  };
};

// ══════════════════════════════════════════════════════════════════════════════
// GET /api/analytics/billing   (mode = 'finance')
// GET /api/analytics/followers (mode = 'followers')
// Both require: ?tenentId=xxx
// ══════════════════════════════════════════════════════════════════════════════
const getAnalyticsReport = async (req, res) => {
  try {
    const { tenentId, mode } = req.query;
    if (!tenentId) return res.status(400).json({ success: false, message: 'tenentId required' });

    // ════════════════════════ FINANCE / BILLING ════════════════════════════════
    if (mode === 'finance') {
      const today  = todayStart();
      const week7  = daysAgo(7);
      const week14 = daysAgo(14);
      const labels = last7Labels();

      // All DB queries scoped strictly to this tenant
      const [allOrders, last7Orders, prev7Orders, todayOrders] = await Promise.all([
        Order.find({ tenentId }).lean(),
        Order.find({ tenentId, created_at: { $gte: week7  } }).lean(),
        Order.find({ tenentId, created_at: { $gte: week14, $lt: week7 } }).lean(),
        Order.find({ tenentId, created_at: { $gte: today  } }).lean(),
      ]);

      // ── Order counts ──
      const totalOrders     = allOrders.length;
      const completedOrders = allOrders.filter(o => COMPLETED.includes(o.status)).length;
      const pendingOrders   = allOrders.filter(o => PENDING.includes(o.status)).length;
      const cancelledOrders = allOrders.filter(o => CANCELLED.includes(o.status)).length;
      const returnedOrders  = allOrders.filter(o => RETURNED.includes(o.status)).length;
      const completionRate  = totalOrders > 0 ? Math.round((completedOrders / totalOrders) * 100) : 0;

      // ── Revenue ──
      const totalRevenue      = allOrders.reduce((s, o) => s + safe(o.total_amount), 0);
      const avgOrderValue     = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;
      const highestOrderValue = allOrders.length > 0 ? Math.max(...allOrders.map(o => safe(o.total_amount))) : 0;

      const rev7  = last7Orders.reduce((s, o) => s + safe(o.total_amount), 0);
      const rev14 = prev7Orders.reduce((s, o) => s + safe(o.total_amount), 0);
      const revenueGrowthPct = rev14 > 0 ? fix1(((rev7 - rev14) / rev14) * 100) : 0;

      // ── Revenue by day (last 7) ──
      const revMap = {};
      last7Orders.forEach(o => {
        const k = new Date(o.created_at).toISOString().slice(0, 10);
        revMap[k] = (revMap[k] || 0) + safe(o.total_amount);
      });
      const revenueByDay = labels.map(({ label, key }) => ({
        label,
        revenue: Math.round(revMap[key] || 0),
        orders:  0,
      }));

      // ── Order funnel ──
      const orderFunnel = [
        { label: 'Completed', value: completedOrders },
        { label: 'Pending',   value: pendingOrders   },
        { label: 'Cancelled', value: cancelledOrders },
        { label: 'Returned',  value: returnedOrders  },
      ].filter(f => f.value > 0);

      // ── Customers ──
      const senderCounts = {};
      allOrders.forEach(o => {
        const sid = o.senderId || o.customer_wa_id;
        if (sid) senderCounts[sid] = (senderCounts[sid] || 0) + 1;
      });
      const repeatCustomers = Object.values(senderCounts).filter(c => c > 1).length;
      const newCustomers    = [...new Set(todayOrders.map(o => o.senderId || o.customer_wa_id).filter(Boolean))].length;

      // ── Avg delivery days (from created_at → updated_at on delivered orders) ──
      const deliveredOrders = allOrders.filter(o =>
        COMPLETED.includes(o.status) && o.updated_at && o.created_at
      );
      const avgDeliveryDays = deliveredOrders.length > 0
        ? fix1(deliveredOrders.reduce((s, o) => {
            const diff = (new Date(o.updated_at) - new Date(o.created_at)) / 86400000;
            return s + (diff > 0 ? diff : 0);
          }, 0) / deliveredOrders.length)
        : 0;

      // ── Top products — reads real product_name from Order.products[] ──
      const productMap = {};
      allOrders.forEach(o => {
        (o.products || []).forEach(p => {
          const name = p.product_name || p.sku || 'Unknown';
          if (!productMap[name]) productMap[name] = { sales: 0, revenue: 0, rev7: 0, rev14: 0 };
          productMap[name].sales   += safe(p.quantity) || 1;
          productMap[name].revenue += safe(p.price) * (safe(p.quantity) || 1);
        });
      });
      // Revenue in last 7 days per product
      last7Orders.forEach(o => {
        (o.products || []).forEach(p => {
          const name = p.product_name || p.sku || 'Unknown';
          if (productMap[name]) productMap[name].rev7 += safe(p.price) * (safe(p.quantity) || 1);
        });
      });
      // Revenue in prev 7 days per product
      prev7Orders.forEach(o => {
        (o.products || []).forEach(p => {
          const name = p.product_name || p.sku || 'Unknown';
          if (productMap[name]) productMap[name].rev14 += safe(p.price) * (safe(p.quantity) || 1);
        });
      });

      const topProducts = Object.entries(productMap)
        .map(([name, d]) => ({
          name,
          sales:   d.sales,
          revenue: Math.round(d.revenue),
          growth:  d.rev14 > 0 ? fix1(((d.rev7 - d.rev14) / d.rev14) * 100) : 0,
        }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 4);

      // ── Payment methods ──
      const pmMap = {};
      allOrders.forEach(o => {
        const pm = o.paymentMethod || 'Unknown';
        pmMap[pm] = (pmMap[pm] || 0) + 1;
      });
      const paymentMethods = Object.entries(pmMap)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value);

      const metrics = {
        totalRevenue, avgOrderValue, highestOrderValue, revenueGrowthPct,
        totalOrders, completedOrders, pendingOrders, cancelledOrders, returnedOrders,
        completionRate, newCustomers, repeatCustomers, avgDeliveryDays,
        revenueByDay, orderFunnel, topProducts, paymentMethods,
      };

      return res.json({ success: true, data: { metrics } });
    }

    // ════════════════════════ FOLLOWERS ═══════════════════════════════════════
    if (mode === 'followers') {
      const today = todayStart();
      const week7 = daysAgo(7);
      const labels = last7Labels();

      const [allNewusers, todayNewusers, allComments, allEngagedUsers, allMessages, weekMessages] =
        await Promise.all([
          Newuser.find({ tenentId }).lean(),
          Newuser.find({ tenentId, createdAt: { $gte: today } }).lean(),
          Comment.find({ tenentId }).lean(),
          EngagedUser.find({ tenentId }).lean(),
          Message.find({ tenentId }).lean(),
          Message.find({ tenentId, Timestamp: { $gte: week7 } }).lean(),
        ]);

      const totalFollowers = allNewusers.length;
      const followersToday = todayNewusers.length;

      // Reach = unique senders in EngagedUser
      const uniqueReach   = [...new Set(allEngagedUsers.map(e => e.senderId))].length;
      // Impressions = sum of engagementCount
      const impressions   = allEngagedUsers.reduce((s, e) => s + safe(e.engagementCount), 0);
      // Profile visits = unique senders who messaged this week
      const profileVisits = [...new Set(weekMessages.map(m => m.senderId))].length;
      // Likes = total comments (each comment = a like/engagement)
      const likes         = allComments.length;
      // Saves = engaged users with engagementCount > 3
      const saves         = allEngagedUsers.filter(e => safe(e.engagementCount) > 3).length;
      // Shares = ig_reel or ig_stroy messages
      const shares        = allMessages.filter(m => ['ig_reel', 'ig_stroy'].includes(m.messageType)).length;

      const totalInteractions = allComments.length + allEngagedUsers.length;
      const engagementRate    = totalFollowers > 0 ? fix1(pct(totalInteractions, totalFollowers)) : 0;

      // ── Follower growth chart (last 7 days) ──
      const growthMap = {};
      allNewusers.forEach(u => {
        if (u.createdAt) {
          const k = new Date(u.createdAt).toISOString().slice(0, 10);
          growthMap[k] = (growthMap[k] || 0) + 1;
        }
      });
      const weeklyNew = allNewusers.filter(u => u.createdAt && new Date(u.createdAt) >= week7).length;
      const baseCount = Math.max(0, totalFollowers - weeklyNew);
      let running     = baseCount;
      const followerGrowth = labels.map(({ label, key }) => {
        const gained = growthMap[key] || 0;
        running += gained;
        return { label, followers: running, gained };
      });

      // ── Top post engagement — group by mediaId ──
      const mediaMap = {};
      allComments.forEach(c => {
        const mid = c.mediaId || 'unknown';
        if (!mediaMap[mid]) mediaMap[mid] = { likes: 0, comments: 0, saves: 0 };
        mediaMap[mid].comments += 1;
        mediaMap[mid].likes    += 1;
      });
      allEngagedUsers.forEach(e => {
        const mid = e.accountId || 'unknown';
        if (!mediaMap[mid]) mediaMap[mid] = { likes: 0, comments: 0, saves: 0 };
        if (safe(e.engagementCount) > 3) mediaMap[mid].saves += 1;
      });
      const topPostEngagement = Object.entries(mediaMap)
        .sort((a, b) => (b[1].comments + b[1].likes) - (a[1].comments + a[1].likes))
        .slice(0, 4)
        .map(([, d], i) => ({ label: `Post ${i + 1}`, ...d }));

      // ── Peak engagement hours — from EngagedUser.lastActivity ──
      const hourMap = {};
      allEngagedUsers.forEach(e => {
        if (e.lastActivity) {
          const h = new Date(e.lastActivity).getHours();
          hourMap[h] = (hourMap[h] || 0) + safe(e.engagementCount);
        }
      });
      // Also count comment timestamps
      allComments.forEach(c => {
        const ts = c.Timestamp || c.createdAt;
        if (ts) {
          const h = new Date(ts).getHours();
          hourMap[h] = (hourMap[h] || 0) + 1;
        }
      });
      const hourSlots  = [6, 9, 12, 15, 18, 21, 0];
      const hourLabels = ['6am', '9am', '12pm', '3pm', '6pm', '9pm', '12am'];
      const peakHours  = hourLabels.map((hour, i) => ({
        hour,
        engagement: hourMap[hourSlots[i]] || 0,
      }));
      const peakEntry = peakHours.reduce((a, b) => a.engagement > b.engagement ? a : b, peakHours[0]);
      const peakHour  = peakEntry ? peakEntry.hour : '—';

      // Find top product name from orders (for AI advisor)
      const allOrders   = await Order.find({ tenentId }).lean();
      const prodRevMap  = {};
      allOrders.forEach(o => {
        (o.products || []).forEach(p => {
          const name = p.product_name || p.sku || '';
          if (name) {
            prodRevMap[name] = (prodRevMap[name] || 0) + safe(p.price) * (safe(p.quantity) || 1);
          }
        });
      });
      const topProductName = Object.entries(prodRevMap).sort((a, b) => b[1] - a[1])[0]?.[0] || 'your top product';

      const metrics = {
        totalFollowers, reach: uniqueReach, likes, engagementRate,
        impressions, profileVisits, saves, shares,
        followersToday, unfollowsToday: 0,
        followerGrowth, topPostEngagement, peakHours, peakHour,
        topProductName,
      };

      const ai_advisor = buildAiAdvisor(metrics);
      return res.json({ success: true, data: { metrics, ai_advisor } });
    }

    return res.status(400).json({ success: false, message: 'Invalid mode. Use finance or followers.' });

  } catch (err) {
    console.error('getAnalyticsReport error:', err);
    return res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// GET /api/analytics/finance-report — paginated order list for table view
// ══════════════════════════════════════════════════════════════════════════════
const getFinanceReport = async (req, res) => {
  try {
    const { tenentId, startDate, endDate, status } = req.query;
    if (!tenentId) return res.status(400).json({ success: false, message: 'tenentId required' });

    const filter = { tenentId };
    if (startDate || endDate) {
      filter.created_at = {};
      if (startDate) filter.created_at.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filter.created_at.$lte = end;
      }
    }
    if (status && status !== 'All' && status !== 'All Status') {
      filter.status = { $regex: new RegExp('^' + status + '$', 'i') };
    }

    const orders = await Order.find(filter).sort({ created_at: -1 }).limit(100).lean();
    const normalized = orders.map(o => ({
      _id:           o._id,
      orderId:       o.orderId,
      created_at:    o.created_at,
      status:        o.status || 'Unknown',
      customer_name: o.customer_name || o.profile_name || o.name || 'Anonymous',
      total_amount:  safe(o.total_amount),
      paymentMethod: o.paymentMethod || '-',
    }));

    return res.json({ success: true, orders: normalized, total: normalized.length });
  } catch (err) {
    console.error('getFinanceReport error:', err);
    return res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
};

module.exports = { getAnalyticsReport, getFinanceReport };
