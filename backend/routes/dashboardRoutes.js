// --- START OF FILE dashboardRoutes.js ---
// routes/dashboard.js

/* eslint-disable no-console */
const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const router = express.Router();

// --- MONGOOSE MODELS (MERGED) ---
const Message = require('../models/Message');
const Comment = require('../models/Comment');
const Order = require('../models/Order');
const ProductDetail = require('../models/ProductDetail');
const LongToken = require('../models/LongToken');

// --- MIDDLEWARE ---
router.use(cors());
router.use(express.json());

// ==================================================================
// SECTION 1: DASHBOARD HELPERS AND ROUTE (FIXED)
// ==================================================================

// Currency formatting helper
function formatCurrency(amount) {
  if (typeof amount !== 'number' || isNaN(amount)) {
    return 0.00;
  }
  return parseFloat(amount.toFixed(2));
}

// --- FIXED: Get Last 12 Months Revenue Stats ---
async function getMonthlyIncomeStats(tenentId) {
  const end = new Date();
  const start = new Date();
  start.setMonth(start.getMonth() - 11);
  start.setDate(1);

  try {
    const monthlyStats = await Order.aggregate([
      {
        $match: {
          tenentId: tenentId,
          status: {
            $in: [
              'PAID', 'Paid', 'paid',
              'DELIVERED', 'Delivered', 'delivered',
              'COMPLETED', 'Completed', 'completed',
              'SHIPPED', 'Shipped', 'shipped'
            ]
          },
          created_at: { $gte: start }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: "$created_at" },
            month: { $month: "$created_at" }
          },
          totalRevenue: { $sum: { $ifNull: ["$total_amount", "$amount"] } }
        }
      },
      {
        $sort: { "_id.year": 1, "_id.month": 1 }
      }
    ]);

    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const formattedData = [];

    const statsMap = {};
    monthlyStats.forEach(stat => {
      const key = `${stat._id.year}-${stat._id.month}`;
      statsMap[key] = stat.totalRevenue;
    });

    let current = new Date(start);
    for (let i = 0; i < 12; i++) {
      const year = current.getFullYear();
      const monthIndex = current.getMonth();
      const mongoMonth = monthIndex + 1;

      const key = `${year}-${mongoMonth}`;

      formattedData.push({
        month: monthNames[monthIndex],
        revenue: statsMap[key] || 0,
        cost: 0
      });

      current.setMonth(current.getMonth() + 1);
    }

    return formattedData;

  } catch (error) {
    console.error("Error calculating monthly income:", error);
    return [];
  }
}

// ✅ FIXED: Correct date range function with proper timeframe values
function getDateRange(timeframe) {
  const endDate = new Date();
  endDate.setHours(23, 59, 59, 999);

  const startDate = new Date();

  switch (timeframe) {
    case 'today':
      startDate.setHours(0, 0, 0, 0);
      break;

    case 'last7days':
      startDate.setDate(startDate.getDate() - 7);
      startDate.setHours(0, 0, 0, 0);
      break;

    case 'last30days':
      startDate.setDate(startDate.getDate() - 30);
      startDate.setHours(0, 0, 0, 0);
      break;

    case 'last12months':
      startDate.setMonth(startDate.getMonth() - 12);
      startDate.setHours(0, 0, 0, 0);
      break;

    default:
      startDate.setDate(startDate.getDate() - 30);
      startDate.setHours(0, 0, 0, 0);
  }

  console.log(`📅 Date Range for ${timeframe}:`, {
    start: startDate.toISOString(),
    end: endDate.toISOString()
  });

  return { startDate, endDate };
}

// ✅ FIXED: Simplified smartOrderQuery
async function smartOrderQuery(tenentId, startDate, endDate, queryType = 'count') {
  console.log(`🔍 Querying orders for ${queryType} between ${startDate.toISOString()} and ${endDate.toISOString()}`);

  const baseMatch = {
    tenentId,
    status: {
      $in: [
        'PAID', 'Paid', 'paid',
        'DELIVERED', 'Delivered', 'delivered',
        'COMPLETED', 'Completed', 'completed',
        'SHIPPED', 'Shipped', 'shipped'
      ]
    },
    created_at: { $gte: startDate, $lte: endDate }
  };

  try {
    if (queryType === 'count') {
      const count = await Order.countDocuments(baseMatch);
      console.log(`✅ Found ${count} orders`);
      return count;
    }

    if (queryType === 'amount') {
      const result = await Order.aggregate([
        { $match: baseMatch },
        {
          $group: {
            _id: null,
            total: { $sum: { $ifNull: ["$total_amount", "$amount"] } }
          }
        }
      ]);

      const total = result.length > 0 ? result[0].total : 0;
      console.log(`✅ Total amount: ₹${total}`);
      return result;
    }
  } catch (error) {
    console.error(`❌ Query failed:`, error.message);
    return queryType === 'count' ? 0 : [];
  }
}

// ✅ FIXED: Clearer fetchTotalOrders function
async function fetchTotalOrders(tenentId, timeframe) {
  const { startDate, endDate } = getDateRange(timeframe);

  const totalOrders = await smartOrderQuery(tenentId, startDate, endDate, 'count');

  const totalOrderAmountResult = await smartOrderQuery(tenentId, startDate, endDate, 'amount');
  const totalOrderAmount = totalOrderAmountResult.length > 0
    ? formatCurrency(totalOrderAmountResult[0].total)
    : 0.00;

  console.log(`📊 Summary for ${timeframe}:`, { totalOrders, totalOrderAmount });

  return { totalOrders, totalOrderAmount };
}

// ✅ FIXED: Main dashboard route with COMPREHENSIVE LOGGING
router.get('/dashboard', async (req, res) => {
  console.log('\n' + '='.repeat(80));
  console.log('🚀 BACKEND: Dashboard API Called');
  console.log('='.repeat(80));
  console.log('📥 Request Query Parameters:', req.query);

  const { tenentId, timeframe = 'today' } = req.query;

  if (!tenentId) {
    console.log('❌ BACKEND ERROR: Missing tenentId');
    return res.status(400).json({
      success: false,
      message: 'Missing tenentId'
    });
  }

  console.log(`\n✅ PROCESSING REQUEST:`);
  console.log(`   - Tenant ID: ${tenentId}`);
  console.log(`   - Timeframe: ${timeframe}`);

  try {
    const { startDate, endDate } = getDateRange(timeframe);
    console.log(`\n📅 DATE RANGE:`);
    console.log(`   - Start: ${startDate.toISOString()}`);
    console.log(`   - End: ${endDate.toISOString()}`);

    const monthlyRevenueData = await getMonthlyIncomeStats(tenentId);

    console.log('\n🔍 Starting database queries...');
    const [
      robotMessages,
      templateMessages,
      carouselMessages,
      commentReplies,
      allTimeOrders,
      allTimeRevenue,
      activeCustomers,
      totalStoryComments
    ] = await Promise.all([
      Message.countDocuments({
        tenentId,
        $or: [
          { message: { $regex: '🤖' } },
          { response: { $regex: '🤖' } },
          { messageType: 'robot' }
        ],
        createdAt: { $gte: startDate, $lte: endDate }
      }).catch(() => 0),

      Message.countDocuments({
        tenentId,
        messageType: 'template',
        createdAt: { $gte: startDate, $lte: endDate }
      }).catch(() => 0),

      Message.countDocuments({
        tenentId,
        messageType: 'carousel',
        createdAt: { $gte: startDate, $lte: endDate }
      }).catch(() => 0),

      Comment.countDocuments({
        tenentId,
        createdAt: { $gte: startDate, $lte: endDate }
      }).catch(() => 0),

      Order.countDocuments({
        tenentId,
        status: { $in: ['PAID', 'paid', 'DELIVERED', 'delivered', 'COMPLETED', 'completed', 'SHIPPED', 'shipped'] }
      }),

      Order.aggregate([
        {
          $match: {
            tenentId,
            status: { $in: ['PAID', 'paid', 'DELIVERED', 'delivered', 'COMPLETED', 'completed', 'SHIPPED', 'shipped'] }
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: { $ifNull: ["$total_amount", "$amount"] } }
          }
        }
      ]),

      Order.aggregate([
        {
          $match: {
            tenentId,
            status: { $in: ['PAID', 'paid', 'DELIVERED', 'delivered', 'COMPLETED', 'completed', 'SHIPPED', 'shipped'] }
          }
        },
        {
          $group: {
            _id: '$senderId',
            orderCount: { $sum: 1 }
          }
        },
        {
          $match: {
            orderCount: { $gt: 0 }
          }
        },
        {
          $count: 'activeCustomers'
        }
      ]),

      Comment.countDocuments({ tenentId }).catch(() => 0)
    ]);

    console.log('\n📊 RAW DATABASE QUERY RESULTS:');
    console.log('   - Robot Messages:', robotMessages);
    console.log('   - Template Messages:', templateMessages);
    console.log('   - Carousel Messages:', carouselMessages);
    console.log('   - Comment Replies:', commentReplies);
    console.log('   - All Time Orders:', allTimeOrders);
    console.log('   - All Time Revenue (raw):', allTimeRevenue);
    console.log('   - Active Customers (raw):', activeCustomers);
    console.log('   - Total Story Comments:', totalStoryComments);

    const { totalOrders, totalOrderAmount } = await fetchTotalOrders(tenentId, timeframe);

    const totalResponses = robotMessages + templateMessages + carouselMessages + commentReplies;
    const botMessages = totalResponses;

    const allTimeOrderAmount = allTimeRevenue.length > 0 ? formatCurrency(allTimeRevenue[0].total) : 0.00;
    const activeCustomerCount = activeCustomers.length > 0 ? activeCustomers[0].activeCustomers : 0;

    console.log('\n🧮 CALCULATED VALUES:');
    console.log('   - Total Responses:', totalResponses);
    console.log('   - Bot Messages:', botMessages);
    console.log('   - Timeframe Orders:', totalOrders);
    console.log('   - Timeframe Order Amount:', totalOrderAmount);
    console.log('   - All Time Order Amount:', allTimeOrderAmount);
    console.log('   - Active Customer Count:', activeCustomerCount);

    const responseData = {
      success: true,

      totalResponses,
      botMessages,
      robotMessages,
      templateMessages,
      carouselMessages,
      commentReplies,
      totalOrders,
      totalOrderAmount,

      monthlyRevenueData,

      loading: false,

      allTimeStats: {
        totalOrders: allTimeOrders,
        totalRevenue: allTimeOrderAmount,
        totalCount: allTimeOrders,
        activeCustomers: activeCustomerCount,
        totalStoryComments: totalStoryComments
      },

      metadata: {
        timeframe,
        dateRange: {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString()
        },
        currency: 'INR',
        queryTimestamp: new Date().toISOString()
      }
    };

    console.log('\n' + '='.repeat(80));
    console.log('📤 SENDING RESPONSE TO FRONTEND');
    console.log('='.repeat(80));
    console.log('\n📦 COMPLETE RESPONSE DATA:');
    console.log(JSON.stringify(responseData, null, 2));
    console.log('\n' + '='.repeat(80));
    console.log('✅ Response sent successfully');
    console.log('='.repeat(80) + '\n');

    return res.status(200).json(responseData);

  } catch (error) {
    console.error('\n' + '❌'.repeat(40));
    console.error('BACKEND ERROR: Dashboard analytics failed');
    console.error('❌'.repeat(40));
    console.error('Error Details:', error);
    console.error('Error Stack:', error.stack);
    console.error('❌'.repeat(40) + '\n');

    return res.status(500).json({
      success: false,
      loading: false,
      message: 'Server error while fetching analytics',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});


// ==================================================================
// SECTION 2: CHATBOT HELPERS AND ROUTES
// ==================================================================

const deepseekApiUrl = 'https://api.deepseek.com/v1';
const deepseekApiKey = process.env.DEEPSEEK_API_KEY;
const ecommerceCredentialsService = require('../models/ecommerceCredentialsService');

const conversationHistory = new Map();

function generateId() {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function cleanMessage(message) {
  let textToClean = message;
  if (typeof message === 'object' && message !== null && typeof message.text === 'string') {
    textToClean = message.text;
  }
  return (String(textToClean || ''))
    .replace(/🤖:/, '')
    .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}]/gu, '')
    .trim();
}

function getConversationHistory(tenentId, senderId, n = 6) {
  const key = `${tenentId}:${senderId}`;
  const history = conversationHistory.get(key) || [];
  return history.slice(-n).map(msg => ({
    role: msg.sender === 'user' ? 'user' : 'assistant',
    content: cleanMessage(msg.text),
  }));
}

function getLastInteraction(tenentId, senderId) {
    const key = `${tenentId}:${senderId}`;
    const history = conversationHistory.get(key) || [];
    for (let i = history.length - 1; i >= 0; i--) {
        if (history[i].sender === 'user' && history[i].intent) {
            return history[i];
        }
    }
    return null;
}

function addToConversationHistory(tenentId, senderId, message, sender, intent = null, args = null) {
  const key = `${tenentId}:${senderId}`;
  const history = conversationHistory.get(key) || [];
  const newEntry = {
    id: generateId(),
    text: message,
    sender: sender,
    timestamp: new Date(),
  };

  if (sender === 'user' && intent) {
    newEntry.intent = intent;
    newEntry.args = args;
  }

  history.push(newEntry);
  if (history.length > 20) history.splice(0, history.length - 20);
  conversationHistory.set(key, history);
}

const calculateOverallProductStatus = (product) => {
    if (!product.units || product.units.length === 0) {
      return 'N/A';
    }
    const totalStock = product.units.reduce((sum, unit) => sum + (unit.quantityInStock || 0), 0);
    if (totalStock <= 0) return 'Out of Stock';
    if (totalStock <= (product.threshold || 10)) return 'Low Stock';
    return 'In Stock';
};

const EN_STOPWORDS = [
  'do you have', 'is', 'are', 'what', 'how much', 'price of', 'stock of', 'available',
  'show me', 'looking for', 'i want', 'i need', 'product', 'item', 'stock', 'price', 'buy', 'purchase',
  'sales', 'report', 'stats', 'how many sold', 'sold', 'for'
];

const TANG_ALIASES = {
  status: ['statusu', 'statuz', 'statu', 'statusuu'],
  track:  ['tracku', 'trak', 'trakku'],
  stock:  ['stokku', 'stak', 'stokk'],
  price:  ['praisu', 'praice', 'prise'],
  order:  ['odder', 'odr', 'orderu'],
  product:['praduct', 'prodct', 'productu'],
  available:['avail', 'aval', 'availableu'],
};

const PUNCT_RE = /[.,!?;:()[\]{}"""''/\\\-]+/g;
function normalize(str = '') { return str.normalize('NFKC').toLowerCase(); }

function tokenize(str, localeHint = 'auto') {
  const s = normalize(str).replace(PUNCT_RE, ' ').replace(/\s+/g, ' ').trim();
  if (!s) return [];
  const isTa = /[\u0B80-\u0BFF]/.test(s);
  const locale = localeHint === 'auto' ? (isTa ? 'ta' : 'en') : localeHint;
  if (typeof Intl !== 'undefined' && Intl.Segmenter) {
    const seg = new Intl.Segmenter(locale, { granularity: 'word' });
    const out = [];
    for (const { segment, isWordLike } of seg.segment(s)) if (isWordLike) out.push(segment);
    return out.length ? out : s.split(' ');
  }
  return s.split(' ');
}

function escapeRegex(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

function compilePhraseRegex(phrases) {
  const alts = (phrases || [])
    .map(p => normalize(p).replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .map(p => escapeRegex(p));
  if (!alts.length) return null;
  return new RegExp(`(?:^|\\s)(?:${alts.join('|')})(?:\\s|$)`, 'i');
}

const STOPWORDS_RE = compilePhraseRegex(EN_STOPWORDS);

function stripStopwords(message) {
  if (!STOPWORDS_RE) return normalize(message);
  return normalize(message).replace(STOPWORDS_RE, ' ').replace(/\s+/g, ' ').trim();
}

function lev1(a, b) {
  if (a === b) return 0;
  const la = a.length, lb = b.length;
  if (Math.abs(la - lb) > 1) return 2;
  let i = 0, j = 0, edits = 0;
  while (i < la && j < lb) {
    if (a[i] === b[j]) { i++; j++; continue; }
    edits++; if (edits > 1) return 2;
    if (la === lb) { i++; j++; continue; }
    if (la > lb) { i++; } else { j++; }
  }
  if (i < la || j < lb) edits++;
  return edits <= 1 ? 1 : 2;
}

function fuzzyIncludes(tokens, keywords, aliases = {}) {
  for (const key of keywords) {
    const cands = [key, ...(aliases[key] || [])];
    for (const cand of cands) {
      for (const tk of tokens) {
        if (tk === cand) return true;
        if (lev1(tk, cand) <= 1) return true;
      }
    }
  }
  return false;
}

function extractOrderId(message) {
  const m = message.trim();
  if (/^\d{4,}$/.test(m) && !/^\d{10}$/.test(m)) {
    return m;
  }
  const patt = [
    /(\d+)#/,
    /order\s*#?([a-zA-Z0-9\-_]+)/i,
    /track\s*#?([a-zA-Z0-9\-_]+)/i,
    /(?:ஆர்டர்|ஸ்டேட்டஸ்)\s*#?([a-zA-Z0-9\-_]+)/i
  ];
  for (const re of patt) {
    const hit = m.match(re);
    if (hit) return hit[1];
  }
  return null;
}

function extractPhoneNumber(message) {
    const m = message.replace(/\D/g, '');
    const phoneMatch = m.match(/\d{10}/);
    return phoneMatch ? phoneMatch[0] : null;
}

function extractProductName(message) {
  const stripped = stripStopwords(message)
    .replace(/[?!.:,/\\#\-()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!stripped || stripped.split(' ').length < 1) return null;
  return stripped;
}

function simpleKeywordMatch(message) {
  const normalizedMessage = normalize(message);

  if (normalizedMessage === 'hi') {
    return { intent: 'greeting' };
  }
  if (/\btoday\s+sales\b/.test(normalizedMessage) || /\bsales\s+today\b/.test(normalizedMessage)) {
    return { intent: 'all_sales_today' };
  }

  const tokens = tokenize(message, 'auto');
  const productKeys = [
    'product', 'item', 'stock', 'available', 'price', 'buy', 'purchase',
    'பொருள்', 'ஸ்டாக்', 'விலை', 'இருக்கா', 'வேண்டும்'
  ];
  const salesKeys = ['sales', 'report', 'stats', 'how many sold', 'sold'];

  const productHit = fuzzyIncludes(tokens, productKeys, TANG_ALIASES);
  const salesHit = fuzzyIncludes(tokens, salesKeys, TANG_ALIASES);

  const orderId = extractOrderId(message);
  const phoneNumber = extractPhoneNumber(message);

  if (salesHit) {
    return { intent: 'product_sales', productName: extractProductName(message) };
  }

  if (productHit) {
    return { intent: 'product_inquiry', productName: extractProductName(message) };
  }

  if (phoneNumber) {
    return { intent: 'order_status', phoneNumber: phoneNumber };
  }

  if (orderId) {
    return { intent: 'order_status', orderId: orderId };
  }

  return { intent: 'general' };
}

async function aiDetectIntentJSON(userInput, historyMsgs = []) {
  const system = {
    role: 'system',
    content:
`You are an intent classifier. Return ONLY minified JSON, no extra text.

Schema:
{"intent":"greeting"|"order_status"|"product_inquiry"|"product_sales"|"all_sales_today"|"general","args":{...}}

Args Schema for "order_status":
{"orderId":"<string|null>", "phoneNumber":"<10_digit_string|null>"}

Rules:
- If user says "hi", "hello": intent="greeting", args:{}
- If user asks to track/check an order using an ID or a 10-digit phone number: intent="order_status", args={"orderId":"...", "phoneNumber":"..."} (fill one, not both)
- If user asks about product availability/price/stock: intent="product_inquiry", args={"productName":"<name or null>"}
- If user asks for sales report of a product: intent="product_sales", args={"productName":"<name or null>"}
- If user asks for today's total sales: intent="all_sales_today", args:{}
- Else: intent="general", args:{}`
  };

  const messages = [system, ...historyMsgs, { role: 'user', content: userInput }];

  const resp = await axios.post(
    `${deepseekApiUrl}/chat/completions`,
    { model: 'deepseek-chat', messages, max_tokens: 150, temperature: 0, stream: false },
    { headers: { Authorization: `Bearer ${deepseekApiKey}`, 'Content-Type': 'application/json' }, timeout: 20000 }
  );

  const txt = resp?.data?.choices?.[0]?.message?.content?.trim() || '{}';
  try {
    const parsed = JSON.parse(txt);
    if (!parsed || !parsed.intent) throw new Error('invalid schema');
    return parsed;
  } catch {
    return { intent: 'general', args: {} };
  }
}

async function wooCommercegetOrderStatusResponse(orderId, OrderStatusurl) {
  const siteUrl = OrderStatusurl.url;
  const consumerKey = OrderStatusurl.consumerKey;
  const consumerSecret = OrderStatusurl.consumerSecret;
  const notesApiUrl = `${siteUrl}/wp-json/wc/v3/orders/${orderId}/notes?consumer_key=${consumerKey}&consumer_secret=${consumerSecret}`;

  try {
    const response = await axios.get(notesApiUrl, { timeout: 20000 });
    const notes = response.data;

    const customerNotes = (notes || []).filter(note => note.customer_note);
    if (customerNotes.length === 0) {
      const orderApiUrl = `${siteUrl}/wp-json/wc/v3/orders/${orderId}?consumer_key=${consumerKey}&consumer_secret=${consumerSecret}`;
      const orderResponse = await axios.get(orderApiUrl, { timeout: 20000 });
      if (orderResponse.data && orderResponse.data.status) {
         return `The status for order #${orderId} is: ${orderResponse.data.status}.`;
      }
      return 'No customer notes found for this order.';
    }

    const sortedCustomerNotes = customerNotes.sort(
      (a, b) => new Date(b.date_created) - new Date(a.date_created)
    );
    const mostRecentNote = sortedCustomerNotes[0];
    return mostRecentNote.note;
  } catch (error) {
    console.error(`Failed to retrieve the last customer note. Error: ${error}`);
    return "We're unable to fetch the order status right now. Please try again later or contact customer support.";
  }
}

async function shopifygetOrderStatusResponse(orderName, shopifyCredentials) {
  const apiPassword  = shopifyCredentials.apiPassword;
  const storeUrl = shopifyCredentials.storeUrl;
  const apiVersion = "2023-10";
  const graphqlEndpoint = `https://${storeUrl}/admin/api/${apiVersion}/graphql.json`;

  try {
    const orderSearchResponse = await axios.post(
      graphqlEndpoint,
      {
        query: `{
          orders(first: 1, query: "name:${orderName}") {
            edges { node { id name } }
          }
        }`,
      },
      { headers: { "X-Shopify-Access-Token": apiPassword, "Content-Type": "application/json" } }
    );

    if (!orderSearchResponse.data.data.orders.edges.length) {
      return `⚠️ Order ${orderName} not found. Please check your order number.`;
    }

    const orderId = orderSearchResponse.data.data.orders.edges[0].node.id;

    const response = await axios.post(
      graphqlEndpoint,
      {
        query: `{
          order(id: "${orderId}") {
            id name displayFinancialStatus displayFulfillmentStatus note
            events(first: 5) { edges { node { message createdAt } } }
          }
        }`,
      },
      { headers: { "X-Shopify-Access-Token": apiPassword, "Content-Type": "application/json" } }
    );

    if (!response.data.data.order) return `⚠️ Order ${orderName} not found.`;

    const order = response.data.data.order;
    let statusMessage = `📦 *Order #${order.name}*\n\n` +
                        `✅ Payment: *${order.displayFinancialStatus}*\n` +
                        `🚀 Fulfillment: *${order.displayFulfillmentStatus}*\n`;
    if (order.note) statusMessage += `\n📝 Note: _"${order.note}"_\n`;
    if (order.events?.edges.length > 0) {
      statusMessage += `\n📌 *Recent Updates:*\n`;
      order.events.edges.forEach((event) => {
        const date = new Date(event.node.createdAt).toLocaleDateString();
        statusMessage += `• ${date}: ${event.node.message}\n`;
      });
    }
    return statusMessage;
  } catch (error) {
    console.error("Shopify API error details:", error.response?.data || error.message);
    return "We're unable to fetch your order information right now. Please try again later.";
  }
}

function formatWooCommerceOrder(order) {
    const productList = order.line_items.map(p =>
        `- ${p.name} (Qty: ${p.quantity})`
    ).join('\n');

    return `✅ Found your WooCommerce order!\n\n` +
        `Order ID: #${order.id}\n` +
        `Status: ${order.status.toUpperCase()}\n` +
        `Customer: ${order.billing.first_name} ${order.billing.last_name}\n` +
        `Total: ${order.currency} ${order.total}\n\n` +
        `Products in this order:\n${productList}`;
}

function formatShopifyOrder(order) {
    const productList = order.lineItems.edges.map(edge =>
        `- ${edge.node.title} (Qty: ${edge.node.quantity})`
    ).join('\n');

    return `✅ Found your Shopify order!\n\n` +
        `Order: ${order.name}\n` +
        `Payment Status: ${order.displayFinancialStatus}\n` +
        `Fulfillment: ${order.displayFulfillmentStatus}\n` +
        `Total: ${order.totalPriceSet.shopMoney.currencyCode} ${order.totalPriceSet.shopMoney.amount}\n\n` +
        `Products in this order:\n${productList}`;
}

async function findOrderInWooCommerce(phoneNumber, wooCreds) {
    if (!phoneNumber || !wooCreds) return null;
    console.log(`[WooCommerce] Searching for order with phone: ${phoneNumber}`);
    const { url, consumerKey, consumerSecret } = wooCreds;
    const ordersApiUrl = `${url}/wp-json/wc/v3/orders`;

    try {
        const response = await axios.get(ordersApiUrl, {
            params: {
                search: phoneNumber,
                per_page: 1,
                orderby: 'date',
                order: 'desc',
                consumer_key: consumerKey,
                consumer_secret: consumerSecret,
            },
            timeout: 20000,
        });

        const foundOrder = (response.data || []).find(order => order.billing.phone === phoneNumber);

        if (foundOrder) {
            console.log(`[WooCommerce] Found order #${foundOrder.id}`);
            return foundOrder;
        }
        return null;
    } catch (error) {
        console.error('[WooCommerce] Error searching for order:', error.message);
        return null;
    }
}

async function findOrderInShopify(phoneNumber, instagramUsername, shopifyCreds) {
    if ((!phoneNumber && !instagramUsername) || !shopifyCreds) return null;

    const { storeUrl, apiPassword } = shopifyCreds;
    const graphqlEndpoint = `https://${storeUrl}/admin/api/2023-10/graphql.json`;

    let searchQuery = '';
    if (phoneNumber) {
        searchQuery = `phone:${phoneNumber}`;
        console.log(`[Shopify] Searching for order with phone: ${phoneNumber}`);
    } else if (instagramUsername) {
        searchQuery = `customer.name:"${instagramUsername}"`;
        console.log(`[Shopify] Searching for order with customer name like: ${instagramUsername}`);
    }

    const query = `
        query {
          orders(first: 1, sortKey: PROCESSED_AT, reverse: true, query: "${searchQuery}") {
            edges {
              node {
                id name displayFinancialStatus displayFulfillmentStatus
                totalPriceSet { shopMoney { amount currencyCode } }
                lineItems(first: 10) { edges { node { title quantity } } }
              }
            }
          }
        }`;

    try {
        const response = await axios.post(
            graphqlEndpoint,
            { query },
            { headers: { 'X-Shopify-Access-Token': apiPassword, 'Content-Type': 'application/json' }, timeout: 20000 }
        );

        const order = response.data?.data?.orders?.edges?.[0]?.node;
        if (order) {
            console.log(`[Shopify] Found order ${order.name}`);
            return order;
        }
        return null;
    } catch (error) {
        console.error('[Shopify] Error searching for order:', error.response?.data || error.message);
        return null;
    }
}

async function findOrderAcrossPlatforms(tenentId, { orderId, phoneNumber, username }) {
    const storeCredentials = await ecommerceCredentialsService.getCredentialsForAPI(tenentId);
    const wooCreds = storeCredentials?.websites?.find(w => w.type === 'woocommerce')?.credentials;
    const shopifyCreds = storeCredentials?.websites?.find(w => w.type === 'shopify')?.credentials;

    if (orderId) {
        console.log(`[Orchestrator] Checking MongoDB for Order ID: ${orderId}...`);
        const mongoOrder = await Order.findOne({
            tenentId,
            orderId: { $regex: new RegExp(`^${orderId}$`, 'i') }
        });
        if (mongoOrder) {
            console.log('[Orchestrator] Found order in MongoDB.');
            return tools.formatMongoOrder(mongoOrder, { queryIdentifier: `ID #${orderId}` });
        }

        if (wooCreds) {
            console.log(`[Orchestrator] Checking WooCommerce for Order ID: ${orderId}...`);
            const wooStatus = await wooCommercegetOrderStatusResponse(orderId, wooCreds);
            if (!wooStatus.toLowerCase().includes("unable") && !wooStatus.toLowerCase().includes("not found")) {
                return `📦 Order Status for #${orderId} (from WooCommerce):\n\n${wooStatus}`;
            }
        }

        if (shopifyCreds) {
            console.log(`[Orchestrator] Checking Shopify for Order Name: ${orderId}...`);
            const shopifyStatus = await shopifygetOrderStatusResponse(orderId, shopifyCreds);
             if (!shopifyStatus.toLowerCase().includes("unable") && !shopifyStatus.toLowerCase().includes("not found")) {
                return shopifyStatus;
            }
        }
    }

    if (phoneNumber) {
        console.log(`[Orchestrator] Checking MongoDB for Phone: ${phoneNumber}...`);
        const mongoOrder = await Order.findOne({ tenentId, phone_number: phoneNumber }).sort({ created_at: -1 });
        if (mongoOrder) {
            console.log('[Orchestrator] Found order in MongoDB.');
            return tools.formatMongoOrder(mongoOrder, { queryIdentifier: `phone ${phoneNumber}` });
        }

        if (wooCreds) {
            console.log(`[Orchestrator] Checking WooCommerce for Phone: ${phoneNumber}...`);
            const wooOrder = await findOrderInWooCommerce(phoneNumber, wooCreds);
            if (wooOrder) {
                console.log('[Orchestrator] Found order in WooCommerce.');
                return formatWooCommerceOrder(wooOrder);
            }
        }

        if (shopifyCreds) {
            console.log(`[Orchestrator] Checking Shopify for Phone: ${phoneNumber}...`);
            const shopifyOrder = await findOrderInShopify(phoneNumber, null, shopifyCreds);
            if (shopifyOrder) {
                console.log('[Orchestrator] Found order in Shopify.');
                return formatShopifyOrder(shopifyOrder);
            }
        }
    }

    console.log('[Orchestrator] Order not found in any platform.');
    const searchCriteria = orderId ? `ID #${orderId}` : (phoneNumber ? `phone ${phoneNumber}` : 'the provided details');
    return `Sorry, I couldn't find any recent order with ${searchCriteria} across our systems. Please double-check the information.`;
}


const tools = {
  async greeting() {
    return "Hi there! 😊 Welcome to Instaxbot—your friendly e-commerce assistant. How can I help you today?";
  },

  async order_status(args, { tenentId, username }) {
    if (!tenentId) return "System error: Tenant ID is missing.";
    if (!args.orderId && !args.phoneNumber) {
      return "Please provide your order number or your 10-digit phone number to find your order.";
    }
    return findOrderAcrossPlatforms(tenentId, { ...args, username });
  },

  formatMongoOrder(order, { queryIdentifier }) {
      let shippingInfo = '';
      if (order.shipping_partner) {
        if (typeof order.shipping_partner === 'object' && order.shipping_partner.name) {
          shippingInfo += `Shipping Partner: ${order.shipping_partner.name}\n`;
        } else if (typeof order.shipping_partner === 'string') {
          shippingInfo += `Shipping Partner: ${order.shipping_partner}\n`;
        }
      }
      if (order.tracking_number) {
        shippingInfo += `Tracking Number: ${order.tracking_number}\n`;
      }

      const productList = order.products.map(p =>
        `- ${p.product_name || 'N/A'} (Qty: ${p.quantity || 1})`
      ).join('\n');

      return `✅ Found the latest order for ${queryIdentifier}!\n\n` +
                  `Order ID: #${order.orderId}\n` +
                  `Status: ${(order.status || 'N/A').toUpperCase()}\n` +
                  shippingInfo +
                  `Customer: ${order.customer_name || 'N/A'}\n` +
                  `Total:₹${order.total_amount || 0}\n\n` +
                  `Products in this order:\n${productList}`;
  },

  async product_inquiry({ productName }, { tenentId }) {
    if (!tenentId) return "System error: Tenant ID is missing.";
    if (!productName) return "What product are you looking for? Please mention the product name.";

    console.log(`[MongoDB] Searching for product: "${productName}" for tenant: ${tenentId}`);
    const product = await ProductDetail.findOne({
      productName: { $regex: new RegExp(escapeRegex(productName), 'i') },
      tenentId: tenentId
    });

    if (product) {
        const stockStatus = calculateOverallProductStatus(product);

        const unitList = (product.units || []).map(u => {
            const skuPart = u.sku ? ` (SKU: ${u.sku})` : '';
            return `- ${u.unit}: ₹${u.price}${skuPart}`;
        }).join('\n');

        let replyText = `✅ Yes, we have ${product.productName}!\n\n` +
                    `Stock Status: ${stockStatus}\n\n`;

        if (unitList) {
            replyText += `${unitList}\n\n`;
        }

        if (product.websiteLink) {
            replyText += `You can view it here: ${product.websiteLink}`;
        }

        return {
          text: replyText.trim(),
          imageUrl: product.productPhotoUrl || null
        };
    } else {
        return {
          text: `😔 Sorry, I couldn't find a product named "${productName}". You can ask me to search for another item.`,
          imageUrl: null
        };
    }
  },

  async product_sales({ productName }, { tenentId }) {
    if (!tenentId) return "System error: Tenant ID is missing.";
    if (!productName) return "Which product's sales report would you like to see?";

    const escapedProductName = escapeRegex(productName.trim());

    const now = new Date();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(now.getDate() - 7);
    const last7DaysStart = new Date(sevenDaysAgo.setHours(0, 0, 0, 0));

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(now.getDate() - 30);
    const last30DaysStart = new Date(thirtyDaysAgo.setHours(0, 0, 0, 0));

    try {
      const aggregationResult = await Order.aggregate([
        { $match: { tenentId: tenentId, 'products.product_name': { $regex: new RegExp(escapedProductName, 'i') } } },
        { $unwind: '$products' },
        { $match: { 'products.product_name': { $regex: new RegExp(escapedProductName, 'i') } } },
        {
          $facet: {
            today: [
              { $match: { created_at: { $gte: todayStart } } },
              { $group: { _id: null, quantity: { $sum: '$products.quantity' }, revenue: { $sum: { $multiply: ['$products.quantity', '$products.price'] } } } }
            ],
            last7Days: [
              { $match: { created_at: { $gte: last7DaysStart } } },
              { $group: { _id: null, quantity: { $sum: '$products.quantity' }, revenue: { $sum: { $multiply: ['$products.quantity', '$products.price'] } } } }
            ],
            last30Days: [
              { $match: { created_at: { $gte: last30DaysStart } } },
              { $group: { _id: null, quantity: { $sum: '$products.quantity' }, revenue: { $sum: { $multiply: ['$products.quantity', '$products.price'] } } } }
            ]
          }
        }
      ]);

      const stats = aggregationResult[0];
      const today = stats.today[0] || { quantity: 0, revenue: 0 };
      const last7Days = stats.last7Days[0] || { quantity: 0, revenue: 0 };
      const last30Days = stats.last30Days[0] || { quantity: 0, revenue: 0 };

      if (last30Days.quantity === 0) {
        return `I couldn't find any sales records for a product matching "${productName}" in the last 30 days.`;
      }

      return `📈 Sales Report for "${productName}":\n\n` +
             `Today: ${today.quantity} units sold (₹${today.revenue.toFixed(2)})\n` +
             `Last 7 Days: ${last7Days.quantity} units sold (₹${last7Days.revenue.toFixed(2)})\n` +
             `Last 30 Days: ${last30Days.quantity} units sold (₹${last30Days.revenue.toFixed(2)})`;

    } catch (error) {
      console.error("Error in product_sales tool:", error);
      return "Sorry, I encountered an error while generating the sales report.";
    }
  },

  async all_sales_today(_, { tenentId }) {
    if (!tenentId) return "System error: Tenant ID is missing.";

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    try {
      const salesData = await Order.aggregate([
        { $match: { tenentId: tenentId, created_at: { $gte: todayStart } } },
        { $unwind: '$products' },
        {
          $group: {
            _id: '$products.product_name',
            totalQuantity: { $sum: '$products.quantity' },
            totalRevenue: { $sum: { $multiply: ['$products.quantity', '$products.price'] } }
          }
        },
        { $sort: { totalQuantity: -1 } },
        { $limit: 20 }
      ]);

      if (salesData.length === 0) {
        return "There have been no sales yet today.";
      }

      const totalOverallRevenue = salesData.reduce((sum, item) => sum + item.totalRevenue, 0);
      const totalOverallQuantity = salesData.reduce((sum, item) => sum + item.totalQuantity, 0);

      let report = `📈 Today's Sales Summary:\n\nTotal Items Sold: ${totalOverallQuantity}\nTotal Revenue: ₹${totalOverallRevenue.toFixed(2)}\n\n-- Top Selling Products --\n`;

      salesData.forEach(item => {
        report += `- ${item._id || 'Unnamed Product'}: ${item.totalQuantity} units (₹${item.totalRevenue.toFixed(2)})\n`;
      });

      return report;

    } catch (error) {
      console.error("Error in all_sales_today tool:", error);
      return "Sorry, I encountered an error while generating today's sales report.";
    }
  },

  async general(_, ctx) {
    const { userInput, tenentId, senderId, username } = ctx;
    const history = getConversationHistory(tenentId, senderId);
    const sys = {
      role: 'system',
      content:
`You are ${username}, an e-commerce assistant.
Keep replies to 2–3 sentences, friendly and helpful.
If user likely wants order tracking, ask for their order number or phone number.
If product query, ask for product name / variant if missing.`
    };
    const messages = [sys, ...history, { role: 'user', content: userInput }];
    const resp = await axios.post(
      `${deepseekApiUrl}/chat/completions`,
      { model: 'deepseek-chat', messages, max_tokens: 300, temperature: 0.7, stream: false },
      { headers: { Authorization: `Bearer ${deepseekApiKey}`, 'Content-Type': 'application/json' }, timeout: 30000 }
    );
    return resp?.data?.choices?.[0]?.message?.content?.trim() || "How can I help you today?";
  },
};

async function dispatchIntent(detected, ctx) {
  const tool = tools[detected.intent] || tools.general;
  return tool(detected.args || {
    orderId: detected.orderId,
    productName: detected.productName,
    phoneNumber: detected.phoneNumber,
  }, ctx);
}

router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    version: '3.0.0',
    timestamp: new Date().toISOString(),
    deepseek_configured: !!deepseekApiKey,
  });
});

router.post('/chatbot', async (req, res) => {
  try {
    const { query, tenentId, senderId = 'anonymous', username = 'Instaxbot' } = req.body || {};
    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Query is required and must be a string' });
    }
    if (!deepseekApiKey) {
      return res.status(500).json({ error: 'DeepSeek API key not configured' });
    }

    const normalizedQuery = query.toLowerCase().trim();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    if (normalizedQuery.includes('this month sales')) {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

        const monthOrders = await Order.find({ tenentId, created_at: { $gte: startOfMonth, $lte: endOfMonth } });
        const orderCount = monthOrders.length;
        const revenue = monthOrders.reduce((sum, order) => sum + (order.total_amount || 0), 0);

        const reply = `📅 Sales for this month:\nTotal Orders: ${orderCount}\n💰 Total Revenue: ₹${revenue.toFixed(2)}`;
        return res.json({ ok: true, intent: 'custom_command_this_month_sales', reply });
    }

    if (normalizedQuery.includes('over all sales')) {
        const now = new Date();
        const twelveMonthsAgo = new Date();
        twelveMonthsAgo.setFullYear(now.getFullYear() - 1);

        const yearOrders = await Order.find({ tenentId, created_at: { $gte: twelveMonthsAgo, $lte: now } });
        const orderCount = yearOrders.length;
        const revenue = yearOrders.reduce((sum, order) => sum + (order.total_amount || 0), 0);

        const reply = `📈 Overall Sales (Last 12 Months):\nTotal Orders: ${orderCount}\n💰 Total Revenue: ₹${revenue.toFixed(2)}`;
        return res.json({ ok: true, intent: 'custom_command_overall_sales', reply });
    }

    if (normalizedQuery.includes('today order')) {
        const todaysOrders = await Order.find({ tenentId, created_at: { $gte: todayStart, $lte: todayEnd } });
        const pendingOrdersCount = await Order.countDocuments({ tenentId, status: { $in: ['PENDING', 'pending', 'CREATED', 'created'] } });
        const orderCount = todaysOrders.length;
        const revenue = todaysOrders.reduce((sum, order) => sum + (order.total_amount || 0), 0);

        const reply = `📦 Today's Orders: ${orderCount}\n💰 Revenue: ₹${revenue.toFixed(2)}\n⏳ Pending: ${pendingOrdersCount}`;
        return res.json({ ok: true, intent: 'custom_command_today_orders', reply });
    }

    if (normalizedQuery.includes('customer contacted us') || normalizedQuery.includes('customers contacted us') || normalizedQuery.includes('customer constacted us')) {
        const todaysMessages = await Message.find({
            tenentId,
            Timestamp: { $gte: todayStart, $lte: todayEnd }
        });

        const totalMessageCount = todaysMessages.length;
        const uniqueCustomers = new Set(todaysMessages.map(msg => msg.senderId));
        const uniqueCustomerCount = uniqueCustomers.size;

        const reply = `📞 ${uniqueCustomerCount} customers contacted us today, with a total of ${totalMessageCount} messages exchanged.`;

        return res.json({ ok: true, intent: 'custom_command_customer_contact', reply });
    }

    if (normalizedQuery.includes('any new order today')) {
        const todaysOrders = await Order.find({ tenentId, created_at: { $gte: todayStart, $lte: todayEnd } });
        const orderCount = todaysOrders.length;
        const revenue = todaysOrders.reduce((sum, order) => sum + (order.total_amount || 0), 0);

        const reply = `📦 Yes! ${orderCount} new orders today. 🎉\n💰 Today's revenue: ₹${revenue.toFixed(2)}`;
        return res.json({ ok: true, intent: 'custom_command_new_orders', reply });
    }

    if (normalizedQuery.includes('inventory status') || normalizedQuery.includes('inventory staues')) {
        const allProducts = await ProductDetail.find({ tenentId });
        const totalProducts = allProducts.length;
        let inStock = 0, outOfStock = 0, lowStock = 0;

        allProducts.forEach(product => {
            const status = calculateOverallProductStatus(product);
            if (status === 'In Stock') inStock++;
            else if (status === 'Out of Stock') outOfStock++;
            else if (status === 'Low Stock') lowStock++;
        });

        const reply = `📦 Inventory Status:\n\nProducts: ${totalProducts}\n🟢 In Stock: ${inStock}\n  🔴 Out of Stock: ${outOfStock}\n🟡 Low Stock: ${lowStock}`;
        return res.json({ ok: true, intent: 'custom_command_inventory_status', reply });
    }

    let detected;
    const lastInteraction = getLastInteraction(tenentId, senderId);

    if (
      (normalizedQuery === 'sales' || normalizedQuery === 'report' || normalizedQuery === 'stats') &&
      lastInteraction &&
      (lastInteraction.intent === 'product_inquiry' || lastInteraction.intent === 'product_sales') &&
      lastInteraction.args.productName
    ) {
      detected = {
        intent: 'product_sales',
        args: { productName: lastInteraction.args.productName }
      };
    } else {
      const historyMsgs = getConversationHistory(tenentId, senderId);

      const rules = simpleKeywordMatch(query);
      detected = { intent: rules.intent, args: {} };
      if (rules.orderId) detected.args.orderId = rules.orderId;
      if (rules.phoneNumber) detected.args.phoneNumber = rules.phoneNumber;
      if (rules.productName) detected.args.productName = rules.productName;

      if (
        detected.intent === 'general' ||
        (detected.intent === 'order_status' && !detected.args.orderId && !detected.args.phoneNumber) ||
        (detected.intent === 'product_inquiry' && !detected.args.productName) ||
        (detected.intent === 'product_sales' && !detected.args.productName)
      ) {
        const ai = await aiDetectIntentJSON(query, historyMsgs);
        if (ai.intent !== 'general') {
          detected.intent = ai.intent;
          detected.args.orderId = ai.args?.orderId || detected.args.orderId || null;
          detected.args.phoneNumber = ai.args?.phoneNumber || detected.args.phoneNumber || null;
          detected.args.productName = ai.args?.productName || detected.args.productName || null;
        }
      }
    }

    const reply = await dispatchIntent(detected, { userInput: query, tenentId, senderId, username });

    addToConversationHistory(tenentId, senderId, query, 'user', detected.intent, detected.args);
    addToConversationHistory(tenentId, senderId, reply, 'assistant');

    return res.json({ ok: true, intent: detected.intent, reply });
  } catch (error) {
    console.error('chatbot error:', error);
    return res.status(500).json({ ok: false, error: 'Internal server error' });
  }
});


router.get('/instagram-data', async (req, res) => {
  const { tenentId } = req.query;

  if (!tenentId) {
    return res.status(400).json({ success: false, message: 'Missing tenentId' });
  }

  try {
    const latestToken = await LongToken.findOne({ tenentId: tenentId })
      .sort({ createdAt: -1 })
      .limit(1);

    if (!latestToken || !latestToken.userAccessToken) {
      return res.status(404).json({
        success: false,
        message: 'No Instagram access token found for this tenant. Please connect your Instagram account.'
      });
    }

    const accessToken = latestToken.userAccessToken;
    const storedInstagramId = latestToken.Instagramid;

    console.log(`📸 Fetching Instagram data for tenentId: ${tenentId}, Instagram ID: ${storedInstagramId}`);

    const meResponse = await axios.get(`https://graph.instagram.com/v24.0/me`, {
      params: {
        fields: 'user_id,username',
        access_token: accessToken
      }
    });

    let igUserId = meResponse.data.user_id;
    if (!igUserId && meResponse.data.data && meResponse.data.data.length > 0) {
       igUserId = meResponse.data.data[0].user_id;
    }

    if (!igUserId) {
        console.error('Instagram /me response:', meResponse.data);
        throw new Error('Could not retrieve Instagram Business User ID from token. Ensure the account is a Business/Creator account.');
    }

    console.log(`✅ Retrieved Instagram User ID: ${igUserId}`);

    const fields = 'name,username,profile_picture_url,followers_count,follows_count,media_count,account_type';

    const profileResponse = await axios.get(`https://graph.instagram.com/v24.0/${igUserId}`, {
      params: {
        fields: fields,
        access_token: accessToken
      }
    });

    console.log(`✅ Successfully fetched Instagram profile for @${profileResponse.data.username}`);

    return res.json({
      success: true,
      data: {
        profile: profileResponse.data,
        media: []
      }
    });

  } catch (error) {
    console.error('❌ Instagram API Error:', error.response?.data || error.message);

    if (error.response?.data?.error?.code === 190) {
      return res.status(401).json({
        success: false,
        message: 'Instagram access token has expired. Please reconnect your Instagram account.',
        details: error.response?.data?.error?.message || error.message
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to fetch Instagram data',
      details: error.response?.data?.error?.message || error.message
    });
  }
});

router.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong',
  });
});

router.use('*', (req, res) => res.status(404).json({ error: 'Endpoint not found' }));

process.on('SIGTERM', () => { console.log('SIGTERM received, shutting down'); process.exit(0); });
process.on('SIGINT', () => { console.log('SIGINT received, shutting down'); process.exit(0); });

setInterval(() => {
  const now = Date.now();
  const maxAge = 24 * 60 * 60 * 1000;
  for (const [key, history] of conversationHistory.entries()) {
    const last = history[history.length - 1];
    if (last && (now - new Date(last.timestamp).getTime()) > maxAge) {
      conversationHistory.delete(key);
      console.log(`Cleaned old conversation: ${key}`);
    }
  }
}, 60 * 60 * 1000);

module.exports = router;
