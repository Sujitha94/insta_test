require("dotenv").config();

const Newuser = require("../models/Newuser");
const Message = require("../models/Message");
const Tokeninfo = require("../models/Tokeninfo");
const LongToken = require("../models/LongToken");
const Mode = require("../models/Mode");
const Profile = require("../models/Profile");
const Userinfo = require("../models/Userinfo");
const Signup = require("../models/Signup");
const Response = require("../models/Response");
const Welcomemessage = require("../models/Welcomemessage");
const Notification = require("../models/Notification");

const path = require("path");
const axios = require("axios");
const express = require("express");
const { json } = express;
const router = express.Router();
const url = require("url");
const https = require("https");
const querystring = require("querystring");
const multer = require("multer");
const cors = require("cors");
const upload = multer({ dest: "uploads/" });
const langdetect = require("langdetect");
const crypto = require("crypto");
const { v4: uuidv4 } = require("uuid");
const bcrypt = require("bcryptjs"); // For password hashing
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");

const { router: messageRouter } = require("./messageRoutes");
const authRoutes = require("./authRoutes");
//const chatmodeRoutes = require('./chatmodeRoutes');
//const { router: chatmodeRouter } = require('./chatmodeRoutes');
const contactRoutes = require("./contactRoutes");
const mainmodeRoutes = require("./mainchatmodeRoutes");
const fileuploadRoutes = require("./fileuploadRoutes");
const instagram_authRoutes = require("./instagram_authRoutes");
const messageRoutes = require("./messageRoutes");
//const notificationRoutes = require('./notificationRoutes');
const profileRoutes = require("./profileRoutes");
const protectedRoutes = require("./protectedRoutes");
const templatesRoutes = require("./templatesRoutes");
const usernameRoutes = require("./usernameRoutes");
const uploadmediaRoutes = require("./uploadmediaRoutes");
const urlconfigurationRoutes = require("./urlconfigurationRoutes");
const imageProxyRoutes = require("./imageProxyRoutes");
const productinventoryRoutes = require("./productinventoryRoutes");
const productinventorysizeRoutes = require("./productinventorysizeRoutes");
const checkoutRoutes = require("./checkoutRoutes");
const shippingmethodRoutes = require("./shippingmethodRoutes");
const productRoutes = require("./productRoutes");
const productsizeRoutes = require("./productsizeRoutes");
const verifysecurityaccessTokenRoutes = require("./verifysecurityaccessTokenRoutes");
const commentAutomationRoutes = require("./commentAutomationRoutes");
const templatemessageRoutes = require("./templatemessageRoutes");
const cartRoutes = require("./cartRoutes");
const cartsizeRoutes = require("./cartsizeRoutes");
const razorpayRoutes = require("./razorpayRoutes");
const dashboardRoutes = require("./dashboardRoutes");
const printingRoutes = require("./printingRoutes");
const packingRoutes = require("./packingRoutes");
const holdingRoutes = require("./holdingRoutes");
const orderRoutes = require("./orderRoutes");
const webhookRoutes = require("./webhookRoutes");
const trackingRoutes = require("./trackingRoutes");
const welcomepageRoutes = require("./welcomepageRoutes");
const pincodeRoutes = require("./pincodeRoutes");
const orderdetailRoutes = require("./orderdetailRoutes");
const systemmenusRoutes = require("./systemmenusRoutes");
const headerRoutes = require("./headerRoutes");
const storycommentsAutomationRoutes = require("./storycommentsAutomationRoutes");
const accountprofileRoutes = require("./accountprofileRoutes");
const chatflowwelcomeRoutes = require("./chatflowwelcomeRoutes");
const apikeyRoutes = require("./apikeyRoutes");
const f3engineapiRoutes = require("./f3engineapiRoutes");
const dashboardnotificationRoutes = require("./dashboardnotificationRoutes");
const commentmoderationRoutes = require("./commentmoderationRoutes");
const analyticsRoutes = require("./analyticsRoutes");
const aiInsightsRoutes = require("./aiInsightsRoutes");
//const websocketRoutes = require('./websocketRoutes');
//const franc = require('franc-min');
//const WebSocket = require('ws');
router.use(
  cors({
    origin: "*", // Replace with your client URL
  }),
);
//const server = require('http').createServer(app);
//const admin = require('../firebase');
// Default route
//let messageSent = false;
//let instagramUserId;
let mode;
const processedMessages = new Set();
const processedPayloads = new Set();
const TIME_WINDOW_MS = 10 * 60;
let lastProcessedTime = 0;

//const WebSocket = require('ws');
//const wss = new WebSocket.Server({ port: 8080 });
const fs = require("fs");

const OpenAI = require("openai");
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

let openai = null;
if (OPENAI_API_KEY) {
  openai = new OpenAI({
    apiKey: OPENAI_API_KEY, // This is the default and can be omitted
  });
} else {
  console.warn("WARNING: OPENAI_API_KEY is missing in routes.js. OpenAI functionality will be disabled.");
}

const appUrl =
  process.env.APP_URL ||
  "https://snaking-outhouse-oppose.ngrok-free.dev";
const regex = /\w+/g;
let vectorDB = [];
const config = require("../services/config");
//const wss = new WebSocket.Server({ server });
const SECRET_KEY = process.env.JWT_SECRET_KEY;
/*function generateToken(user) {
  // Create JWT token with user info (e.g., user ID, role)
  const token = jwt.sign(
    { tenantId: user.id, username: user.instagramAccountId },
    process.env.JWT_SECRET_KEY // Secret key for signing the token
    // Token expiration (e.g., 1 hour)
  );

  return token;
}*/

// Attach routes to the main router
router.use("/auth", authRoutes);
//router.use('/chatmode', chatmodeRouter);
router.use("/contactsroute", contactRoutes);
router.use("/mainmoderoute", mainmodeRoutes);
router.use("/fileuploadroute", fileuploadRoutes);
router.use("/instagram_authroute", instagram_authRoutes);
router.use("/messagesroute", messageRouter);
//router.use('/notificationsroute', notificationRoutes);
router.use("/profileroute", profileRoutes);
router.use("/protectedroute", protectedRoutes);
router.use("/templatesroute", templatesRoutes);
router.use("/usernameroute", usernameRoutes);
router.use("/uploadmediaRoutes", uploadmediaRoutes);
router.use("/urlconfigurationroute", urlconfigurationRoutes);
router.use("/imageproxyroutes", imageProxyRoutes);
router.use("/commentAutomationroute", commentAutomationRoutes);
router.use("/productinventoryroute", productinventoryRoutes);
router.use("/productinventorysizeroute", productinventorysizeRoutes);
router.use("/checkoutroute", checkoutRoutes);
router.use("/shippingmethodroute", shippingmethodRoutes);
router.use("/productroute", productRoutes);
router.use("/productsizeroute", productsizeRoutes);
router.use("/verifysecurityaccesstokenroute", verifysecurityaccessTokenRoutes);
router.use("/webhookroute", webhookRoutes);
router.use("/templatemessageroute", templatemessageRoutes);
router.use("/cartroute", cartRoutes);
router.use("/cartsizeroute", cartsizeRoutes);
router.use("/razorpayroute", razorpayRoutes);
router.use("/dashboardroute", dashboardRoutes);
router.use("/printingroute", printingRoutes);
router.use("/packingroute", packingRoutes);
router.use("/holdingroute", holdingRoutes);
router.use("/orderroute", orderRoutes);
router.use("/trackingroute", trackingRoutes);
router.use("/welcomepageroute", welcomepageRoutes);
router.use("/pincoderoute", pincodeRoutes);
router.use("/orderdetailroute", orderdetailRoutes);
router.use("/systemmenusroute", systemmenusRoutes);
router.use("/headerroute", headerRoutes);
router.use("/storycommentsAutomationroute", storycommentsAutomationRoutes);
router.use("/accountprofileroute", accountprofileRoutes);
router.use("/chatflowwelcomeroute", chatflowwelcomeRoutes);
router.use("/apikeyroute", apikeyRoutes);
router.use("/f3engineapiroute", f3engineapiRoutes);
router.use("/dashboardnotificationroute", dashboardnotificationRoutes);
router.use("/commentmoderationroute", commentmoderationRoutes);
router.use("/analytics", analyticsRoutes);
router.use("/aiInsightsroute", aiInsightsRoutes);

const getJwtIdentity = (req, res, next) => {
  // Get token from Authorization header (Bearer token)
  const token = req.header("Authorization")?.split(" ")[1]; // Extract Bearer token

  if (!token) {
    return res.status(403).json({ message: "Access denied, token missing" });
  }

  // Verify and decode the token
  jwt.verify(token, SECRET_KEY, (err, decoded) => {
    if (err) {
      return res.status(403).json({ message: "Invalid token" });
    }

    // Attach the user identity (e.g., user ID) to the request object
    req.user = decoded; // decoded contains the JWT payload
    next(); // Call the next middleware or route handler
  });
};
function authenticateJWT(req, res, next) {
  const token = req.header("Authorization")?.split(" ")[1]; // Extract token from Authorization header (Bearer token)

  if (!token) {
    return res.status(403).json({ message: "Access denied, token missing" });
  }

  jwt.verify(token, SECRET_KEY, (err, user) => {
    if (err) {
      return res.status(403).json({ message: "Invalid token" });
    }

    req.user = user; // Attach user data to request object
    next(); // Proceed to the next middleware or route handler
  });
}
router.all("*", function (req, res, next) {
  // Use `x-forwarded-proto` if available, otherwise use `req.protocol`
  const reqProtocol = req.get("x-forwarded-proto")
    ? req.get("x-forwarded-proto").split(",")[0]
    : req.protocol;

  const reqAppUrl = reqProtocol + "://" + req.get("host");

  // Only update config.appUrl if it’s different
  if (config.appUrl !== reqAppUrl) {
    console.log(`requrl ${reqAppUrl}`);
    config.appUrl = reqAppUrl;
    console.log(`Updated appUrl to ${config.appUrl}`);
  }
  console.log(`Updated appUrl to ${config.appUrl}`);
  next();
});

module.exports = router;
