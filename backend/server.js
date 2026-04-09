require("dotenv").config();
const connectDB = require("./config/dbcon");
const routes = require("./routes/routes.js");
const WebSocket = require("ws");
const url = require("url");
const https = require("https");
const querystring = require("querystring");
console.log("PORT from .env:", process.env.PORT);
console.log("CLIENT_ID from .env:", process.env.CLIENT_ID);
console.log(process.env.PAGE_ACCESS_TOKEN);
const axios = require("axios");

const mongoose = require("mongoose");
const Userinfo = require("./models/Userinfo");
const Tokeninfo = require("./models/Tokeninfo");
const User = require("./models/User");
const Message = require("./models/Message");
const Newuser = require("./models/Newuser");
const multer = require("multer");
const debounceInterval = 1000;
//const Mode = require('../models/Mode');
const cors = require("cors");
const upload = multer();
const {
  router: messageRouter,
  initializeWebSocket,
} = require("./routes/messageRoutes");
let messageSent = false;
let instagramUserId;
let mode;
const processedMessages = new Set();
const processedPayloads = new Set();
const TIME_WINDOW_MS = 10 * 60;
let lastProcessedTime = 0;
//const WebSocket = require('ws');
//const wss = new WebSocket.Server({ port: 8080 });
const fs = require("fs");
global.tenantVectorDBs = {};
const OpenAI = require("openai");
const allowedOrigins = ["http://localhost:5173"];

const session = require("express-session");
// Load your API key from an environment variable or secret management service
// (Don't hard-code your API key in your source code!)
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const appUrl =
  process.env.APP_URL ||
  "https://inocencia-shiftiest-nonodorously.ngrok-free.dev";
console.log("App URL:", appUrl);
// Create an instance of the OpenAI class
const openai = new OpenAI({
  apiKey: OPENAI_API_KEY, // This is the default and can be omitted
}); // Ensure you have installed the OpenAI Node.js SDK
//const franc = require('franc'); // Placeholder for language detection, use appropriate library

const regex = /\w+/g;
let vectorDB = [];
//const words = userInput.match(regex);

("use strict");
const bodyParser = require("body-parser");
// Import dependencies and set up http server
var express = require("express"),
  { urlencoded, json } = require("body-parser"),
  config = require("./services/config"),
  path = require("path"),
  app = express();
app.set("trust proxy", 1);
app.use(express.json());
app.use(bodyParser.json()); // Add this line to parse JSON data
app.use(bodyParser.urlencoded({ extended: true }));
app.use(
  cors({
    origin: "https://inocencia-shiftiest-nonodorously.ngrok-free.dev", // Replace with your client URL
    credentials: true,
  }),
);

app.disable("x-powered-by");
app.use((req, res, next) => {
  // Normalize URLs by removing trailing slashes except for root
  if (req.path !== "/" && req.path.endsWith("/")) {
    req.url = req.url.slice(0, -1);
  }
  next();
});

/*
app.use(session({
  secret: 'your_secret_key',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false } // Use true if using HTTPS
}));*/
// Object to store known users.
//var users = {};
const startServer = async () => {
  try {
    await connectDB();
    // Rest of your server initialization code
  } catch (error) {
    console.error("Server startup failed:", error);
    process.exit(1);
  }
};

startServer();
// Parse application/x-www-form-urlencoded
app.use(
  urlencoded({
    extended: true,
  }),
);
app.use((req, res, next) => {
  console.log("Incoming request:", req.method, req.url);
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

connectDB();

//app.use('/', routes);
app.use("/api", routes);

const analyticsRoutes = require("./routes/analyticsRoutes");
app.use("/api/analytics", analyticsRoutes);


const aiInsightsRoutes = require("./routes/aiInsightsRoutes");
app.use("/api/ai-insights", aiInsightsRoutes);



app.get("/test-db", async (req, res) => {
  try {
    const users = await mongoose
      .model("User")
      .find()
      .limit(1);
    res.json({ message: "Database connected", userCount: users.length });
  } catch (error) {
    res.status(500).json({ message: "Database error", error: error.message });
  }
});

app.use("/uploads", express.static("uploads"));
app.use("/images", express.static(path.join(__dirname, "images")));
const distPath = path.join(__dirname, "..", "frontend", "dist");
app.use(express.static(distPath));

app.get("*", (req, res) => {
  if (req.method === "GET" && !req.path.startsWith("/api")) {
    res.sendFile(path.join(distPath, "index.html"));
  }
});
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res
    .status(500)
    .json({ message: "Internal server error", error: err.message });
});

async function main() {
  // Check if all environment variables are set
  config.checkEnvVariables();

  // Set configured locale
  if (config.locale) {
    i18n.setLocale(config.locale);
  }

  // Set our Persistent Menu upon launch
  // await GraphApi.setPersistentMenu(persistentMenu);

  // Set our page subscriptions
  //await GraphApi.setPageSubscriptions();

  // Listen for requests :)
  var listener = app.listen(config.port, function() {
    console.log(`The app is listening on port ${listener.address().port}`);
  });
  const wss = initializeWebSocket(listener);
  //const wss1 = chatmodeinitializeWebSocket(listener);
}

main();
