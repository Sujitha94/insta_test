/**
 * Copyright 2021-present, Facebook, Inc. All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * Instagram For Original Coast Clothing
 *
 */

"use strict";

// Use dotenv to read .env vars into Node
require("dotenv").config();

// Required environment variables
const ENV_VARS = [
  "PAGE_ID",
  "APP_ID",
  "PAGE_ACCESS_TOKEN",
  "APP_SECRET",
  "VERIFY_TOKEN",
  "CLIENT_ID",
  "CLIENT_SECRET",
  "OPENAI_API_KEY",
  "CONSUMER_KEY",
  "CONSUMER_SECRET",
  "APP_URL",
  "EMAIL_USER",
  "EMAIL_PASS",
  "WS_SECRET_KEY",
];

module.exports = {
  // Messenger Platform API
  apiDomain: "https://graph.facebook.com",
  apiVersion: "v11.0",

  // Page and Application information
  pageId: process.env.PAGE_ID,
  appId: process.env.APP_ID,
  pageAccesToken: process.env.PAGE_ACCESS_TOKEN,
  appSecret: process.env.APP_SECRET,
  verifyToken: process.env.VERIFY_TOKEN,
  clientId: process.env.CLIENT_ID,
  clientSecret: process.env.CLIENT_SECRET,
  openApiKey: process.env.OPENAI_API_KEY,
  consumerKey: process.env.CONSUMER_KEY,
  consumer_secret: process.env.CONSUMER_SECRET,
  jwt_secret_key: process.env.JWT_SECRET_KEY,
  emailUser: process.env.EMAIL_USER,
  emailPass: process.env.EMAIL_PASS,
  wsSecretKey: process.env.WS_SECRET_KEY,
  chromePath: process.env.CHROME_PATH,

  shopUrl: process.env.SHOP_URL || "https://www.originalcoastclothing.com",

  // URL of your app domain. Will be automatically updated.
  appUrl:
    process.env.APP_URL ||
    "https://inocencia-shiftiest-nonodorously.ngrok-free.dev",

  // Preferred port (default to 3000)
  port: process.env.PORT || 80,

  // Optionally set a locale
  locale: process.env.LOCALE,

  // Base URL for Messenger Platform API calls
  get apiUrl() {
    return `${this.apiDomain}/${this.apiVersion}`;
  },

  // URL of webhook endpoint
  get webhookUrl() {
    return `${this.appUrl}/webhook`;
  },

  checkEnvVariables: function() {
    ENV_VARS.forEach(function(key) {
      if (!process.env[key]) {
        console.warn(`WARNING: Missing required environment variable ${key}`);
      }
    });
  },
};
