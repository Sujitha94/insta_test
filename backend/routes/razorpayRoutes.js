// routes/razorpay.js
const express = require("express");
const Razorpay = require("../models/Razorpay_info");
const Order = require("../models/Order");
const ProductDetail = require("../models/ProductDetail");
const Cart = require("../models/Cart");
const Signup = require("../models/Signup"); // ✅ Added missing import
const crypto = require("crypto");
const axios = require("axios");
const router = express.Router();
const LongToken = require("../models/LongToken");
const BASE_URL = "https://snaking-outhouse-oppose.ngrok-free.dev";
const mongoose = require("mongoose");
// SMS Configuration
const SMS_CONFIG = {
  authkey: process.env.MSG91_AUTH_KEY || "",
  url: "https://control.msg91.com/api/v5/flow/",
  templates: {
    ORDER_CREATED:
      process.env.MSG91_ORDER_CREATED_TEMPLATE_ID || "6751a899d6fc0508417cdff2",
  },
};

// Enhanced Instagram message sending with better error handling
async function sendInstagramMessage(
  igId,
  userAccessToken,
  recipientId,
  messageText1,
) {
  const url = `https://graph.instagram.com/v23.0/${igId}/messages`; // ✅ Fixed typo: igIdd -> igId
  const messageTextWithEmoji = " 🤖:" + messageText1;
  const data = {
    recipient: { id: recipientId },
    message: { text: messageTextWithEmoji },
  };

  try {
    const response = await axios.post(url, data, {
      headers: {
        Authorization: `Bearer ${userAccessToken}`,
        "Content-Type": "application/json",
      },
      timeout: 10000, // 10 second timeout
    });

    console.log("Instagram message sent successfully", response.data);
    return { success: true, message: messageTextWithEmoji };
  } catch (error) {
    console.error("Instagram message sending failed:", {
      error: error.response?.data || error.message,
      status: error.response?.status,
      recipientId: recipientId,
    });

    throw new Error(
      `Instagram message failed: ${error.response?.data?.error?.message ||
      error.message}`,
    );
  }
}

// ✅ Improved address splitting function
function splitAddressIntoThreeParts(address) {
  if (!address || typeof address !== "string") return ["", "", ""];

  const maxLength = 40; // Max length per part for SMS
  const trimmedAddress = address.trim();

  if (trimmedAddress.length <= maxLength) {
    return [trimmedAddress, "", ""];
  }

  if (trimmedAddress.length <= maxLength * 2) {
    const midPoint = Math.ceil(trimmedAddress.length / 2);
    return [
      trimmedAddress.substring(0, midPoint).trim(),
      trimmedAddress.substring(midPoint).trim(),
      "",
    ];
  }

  // Split into 3 parts
  const thirdLength = Math.ceil(trimmedAddress.length / 3);
  return [
    trimmedAddress.substring(0, thirdLength).trim(),
    trimmedAddress.substring(thirdLength, thirdLength * 2).trim(),
    trimmedAddress.substring(thirdLength * 2).trim(),
  ];
}

// ✅ Enhanced address formatting function
function formatAddressForSMS(order) {
  const addressParts = [
    order.address,
    order.zip_code,
    order.city,
    order.state,
  ].filter((part) => part && part.toString().trim().length > 0);

  return addressParts.join(", ");
}

// ✅ Enhanced product formatting function
function formatProductsForSMS(products) {
  console.log("formatProductsForSMS input:", products);

  if (!products || products.length === 0) {
    return { part1: "Your items", part2: "" };
  }

  if (Array.isArray(products)) {
    const productNames = products.map((product) => {
      const name =
        product.product_name ||
        product.name ||
        product.title ||
        product.productName ||
        "Item";
      const qty = product.quantity || 1;
      return `${name} (x${qty})`;
    });

    const allProducts = productNames.join(", ");
    console.log("All products combined:", allProducts);

    // Split products into 2 parts if too long
    const maxLength = 80; // Adjust based on SMS character limits

    if (allProducts.length <= maxLength) {
      return { part1: allProducts, part2: "" };
    }

    // Find a good split point (preferably at a comma)
    const halfLength = Math.ceil(allProducts.length / 2);
    let splitIndex = halfLength;

    // Try to find a comma near the middle
    const nearbyComma = allProducts.lastIndexOf(", ", halfLength + 20);
    if (nearbyComma > halfLength - 20 && nearbyComma > 0) {
      splitIndex = nearbyComma + 2; // +2 to skip the comma and space
    }

    const part1 = allProducts.substring(0, splitIndex).trim();
    const part2 = allProducts.substring(splitIndex).trim();

    console.log("Products split - Part 1:", part1);
    console.log("Products split - Part 2:", part2);

    return { part1, part2 };
  }

  if (typeof products === "string") {
    return { part1: products, part2: "" };
  }

  return { part1: "Your items", part2: "" };
}

// ✅ Enhanced SMS sending function with better error handling
async function sendSMSFallback(phone, orderDetails, order) {
  try {
    console.log("=== SMS FALLBACK DEBUG START ===");
    console.log("Raw order object:", JSON.stringify(order, null, 2));
    console.log(
      "Raw orderDetails object:",
      JSON.stringify(orderDetails, null, 2),
    );

    if (!phone || !SMS_CONFIG.authkey) {
      throw new Error("Missing phone number or SMS configuration");
    }

    const cleanPhone = phone.replace(/\D/g, "");
    if (cleanPhone.length < 10) {
      throw new Error("Invalid phone number format");
    }

    // ✅ STEP 1: Format products and split into 2 parts
    const productsData = formatProductsForSMS(order.products);
    console.log("Step 1 - Products formatted:", productsData);

    // ✅ STEP 2: Format address
    const fullAddress = formatAddressForSMS(order);
    console.log("Step 2 - Full address:", fullAddress);

    // ✅ STEP 3: Split address into 3 parts
    const [
      addressPart1,
      addressPart2,
      addressPart3,
    ] = splitAddressIntoThreeParts(fullAddress);
    console.log("Step 3 - Address parts:", {
      addressPart1,
      addressPart2,
      addressPart3,
    });

    // ✅ STEP 4: Format total amount (ensure it's a clean number)
    let totalAmount = "0.00";
    try {
      const rawAmount =
        order.total_amount || orderDetails.total || order.amount || 0;
      totalAmount = parseFloat(rawAmount).toFixed(2);
    } catch (e) {
      console.warn("Error parsing total amount:", e);
      totalAmount = "0.00";
    }
    console.log("Step 4 - Total amount:", totalAmount);

    // ✅ CORRECTED VARIABLE MAPPING based on your template
    // Template: ##var1## ##var2## ##var3## Total Amount: INR ##var4##. Delivery Address: ##var5## ##var6## ##var7##
    const smsVariables = {
      var1: orderDetails.companyName || "Store", // Company name
      var2: productsData.part1, // Items part 1
      var3: productsData.part2, // Items part 2
      var4: totalAmount, // Total amount
      var5: addressPart1 || "", // Address part 1
      var6: addressPart2 || "", // Address part 2
      var7: addressPart3 || "", // Address part 3
    };

    console.log("=== CORRECTED SMS VARIABLES ===");
    console.log("var1 (company):", smsVariables.var1);
    console.log("var2 (items part 1):", smsVariables.var2);
    console.log("var3 (items part 2):", smsVariables.var3);
    console.log("var4 (total amount):", smsVariables.var4);
    console.log("var5 (address1):", smsVariables.var5);
    console.log("var6 (address2):", smsVariables.var6);
    console.log("var7 (address3):", smsVariables.var7);

    // ✅ Preview how the message will look
    const previewMessage = `Order Confirmed by ${smsVariables.var1}! Your items: ${smsVariables.var2}${smsVariables.var3} Total Amount: INR ${smsVariables.var4}. Delivery Address: ${smsVariables.var5}${smsVariables.var6}${smsVariables.var7} Status: Your order has been successfully placed. Thank you for choosing us!`;
    console.log("=== SMS PREVIEW ===");
    console.log(previewMessage);

    // ✅ Build SMS payload
    const smsPayload = {
      template_id: SMS_CONFIG.templates.ORDER_CREATED,
      short_url: "1",
      recipients: [
        {
          mobiles: `91${cleanPhone}`,
          ...smsVariables,
        },
      ],
    };

    console.log("=== SMS PAYLOAD BEING SENT ===");
    console.log(JSON.stringify(smsPayload, null, 2));

    const response = await axios.post(SMS_CONFIG.url, smsPayload, {
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        authkey: SMS_CONFIG.authkey,
      },
      timeout: 15000,
    });

    console.log("SMS API Response:", response.data);
    console.log("=== SMS FALLBACK DEBUG END ===");

    if (response.status === 200) {
      return { success: true, response: response.data };
    } else {
      throw new Error(`SMS API returned status: ${response.status}`);
    }
  } catch (error) {
    console.error(
      "SMS fallback failed:",
      error.response?.data || error.message,
    );
    throw error;
  }
}

// ✅ Enhanced notification function with proper error handling and variable formatting
async function sendOrderConfirmation(order) {
  const tenentId = order.tenentId;
  const senderId = order.senderId;

  // Fetch username from Signup collection
  let username = "Store";
  try {
    const usernamedata = await Signup.findOne({ tenentId: tenentId })
      .sort({ createdAt: -1 })
      .limit(1);

    if (usernamedata && usernamedata.name) {
      username = usernamedata.name;
    }
  } catch (err) {
    console.warn("Failed to fetch username for SMS:", err.message);
  }

  // ✅ Create orderDetails object
  const orderDetails = {
    orderId: order.orderId,
    total: parseFloat(order.total_amount || 0).toFixed(2),
    companyName: username,
  };

  console.log("Order details created:", orderDetails);

  let notificationSent = false;
  let notificationMethod = null;
  let notificationError = null;

  // Try Instagram first (your existing logic)
  try {
    console.log(
      "Attempting Instagram notification for order:",
      orderDetails.orderId,
    );

    const latestToken = await LongToken.findOne({ tenentId: tenentId })
      .sort({ createdAt: -1 })
      .limit(1);

    if (latestToken && latestToken.userAccessToken && latestToken.Instagramid) {
      const messageText = `✅ Order & Payment Confirmation ✅\n\nThank you for your purchase!\n\nOrder ID: ${orderDetails.orderId}\nAmount Paid: ₹${orderDetails.total}\nOrder Status: Confirmed\nPayment Status: Completed\n\nYour order has been received and payment has been successfully processed.\n\nYou will receive updates about your order via Instagram DM or SMS.\n\nYou can track your order status using the Order ID above by typing your Order ID ending with $ in the Instagram DM (e.g., 78910$).`;

      await sendInstagramMessage(
        latestToken.Instagramid,
        latestToken.userAccessToken,
        senderId,
        messageText,
      );

      notificationSent = true;
      notificationMethod = "instagram";
      console.log("Instagram notification sent successfully");
    } else {
      throw new Error("Instagram credentials not available");
    }
  } catch (instagramError) {
    console.error(
      "Instagram notification failed, trying SMS fallback:",
      instagramError.message,
    );
    notificationError = instagramError.message;

    // SMS Fallback
    try {
      let phoneNumber =
        order.phone_number || order.customerPhone || order.phone;

      if (!phoneNumber) {
        throw new Error("No phone number available for SMS fallback");
      }

      const smsResult = await sendSMSFallback(phoneNumber, orderDetails, order);

      if (smsResult.success) {
        console.log("SMS fallback sent successfully");
        notificationSent = true;
        notificationMethod = "sms_fallback";
      } else {
        throw new Error("SMS API call failed");
      }
    } catch (smsError) {
      console.error("SMS fallback also failed:", smsError.message);
      notificationError = `Instagram: ${instagramError.message}; SMS: ${smsError.message}`;
    }
  }

  // Update order with notification status
  try {
    await Order.findByIdAndUpdate(order._id, {
      $set: {
        notificationSent: notificationSent,
        notificationMethod: notificationMethod,
        notificationError: notificationError,
        notificationAttemptedAt: new Date(),
      },
    });
  } catch (updateError) {
    console.error("Failed to update notification status:", updateError);
  }

  return {
    success: notificationSent,
    method: notificationMethod,
    error: notificationError,
  };
}

// Initiate Razorpay authorization
router.post("/authorize", async (req, res) => {
  try {
    console.log("triggered");

    // Get tenant ID from request body or header
    const tenentId = req.body.tenentId || req.headers["x-tenant-id"];

    if (!tenentId) {
      return res
        .status(401)
        .json({ error: "Unauthorized - No tenant ID provided" });
    }

    // Generate unique state for OAuth
    const state = crypto.randomUUID();

    // Create or update Razorpay document with state
    await Razorpay.findOneAndUpdate(
      { tenentId: tenentId },
      {
        tenentId: tenentId,
        razorpayState: state,
        razorpayStateExpiresAt: new Date(Date.now() + 600000),
      },
      { upsert: true, new: true },
    );

    // Construct Razorpay auth URL
    const authUrl = new URL("https://auth.razorpay.com/authorize");
    authUrl.searchParams.append(
      "client_id",
      process.env.NEXT_RAZORPAY_CLIENT_ID,
    );
    authUrl.searchParams.append(
      "redirect_uri",
      `${BASE_URL}/api/razorpayroute/callback`,
    );
    authUrl.searchParams.append("response_type", "code");
    authUrl.searchParams.append("scope", "read_write");
    authUrl.searchParams.append("state", state);

    console.log(authUrl, "url");

    return res.status(200).json({ authUrl: authUrl.toString() });
  } catch (error) {
    console.error("Error initiating Razorpay authorization:", error);
    return res.status(500).json({
      error: "Server error initiating Razorpay authorization",
      message: error.message,
    });
  }
});

router.get("/callback", async (req, res) => {
  try {
    console.log("trigg the callback");

    // Get state and code from query parameters
    const state = req.query.state;
    const code = req.query.code;
    console.log("code", code);

    // Get razorpay record from database that matches the state
    const razorpayRecord = await Razorpay.findOne({
      razorpayState: state,
      razorpayStateExpiresAt: { $gt: new Date() },
    });

    // Validate state parameter and check if it's expired
    if (!razorpayRecord) {
      return res.redirect(`${BASE_URL}/dashboard?razorpay=invalid`);
    }

    try {
      // Exchange authorization code for tokens
      const tokenResponse = await fetch("https://auth.razorpay.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code: code,
          grant_type: "authorization_code",
          client_id: process.env.NEXT_RAZORPAY_CLIENT_ID,
          client_secret: process.env.NEXT_RAZORPAY_CLIENT_SECRET,
          redirect_uri: `${BASE_URL}/api/razorpayroute/callback`,
        }),
      });

      const tokenData = await tokenResponse.json();
      console.log("Token data received:", tokenData);

      // Calculate token expiry date
      const expiryDate = tokenData.expires_in
        ? new Date(Date.now() + parseInt(tokenData.expires_in) * 1000)
        : null;

      // Get the account ID and fetch key details
      if (tokenData.access_token && tokenData.razorpay_account_id) {
        try {
          console.log(
            "Fetching Razorpay keys for account:",
            tokenData.razorpay_account_id,
          );

          // Store this key_id in your database
          await Razorpay.findByIdAndUpdate(razorpayRecord._id, {
            razorpayAccessToken: tokenData.access_token || null,
            razorpayRefreshToken: tokenData.refresh_token || null,
            razorpayTokenExpiresAt: expiryDate,
            razorpayAccountId: tokenData.razorpay_account_id || null,
            razorpayKeyId: tokenData.public_token, // Store the key_id here
            razorpayState: null,
            razorpayStateExpiresAt: null,
          });
        } catch (keyError) {
          console.error("Could not fetch Razorpay keys:", keyError);

          // Continue without the key_id, store other information
          await Razorpay.findByIdAndUpdate(razorpayRecord._id, {
            razorpayAccessToken: tokenData.access_token || null,
            razorpayRefreshToken: tokenData.refresh_token || null,
            razorpayTokenExpiresAt: expiryDate,
            razorpayAccountId: tokenData.account_id || null,
            razorpayState: null,
            razorpayStateExpiresAt: null,
          });
        }
      } else {
        console.warn("Missing access_token or account_id in token response");

        // Store whatever information we have
        await Razorpay.findByIdAndUpdate(razorpayRecord._id, {
          razorpayAccessToken: tokenData.access_token || null,
          razorpayRefreshToken: tokenData.refresh_token || null,
          razorpayTokenExpiresAt: expiryDate,
          razorpayAccountId: tokenData.account_id || null,
          razorpayState: null,
          razorpayStateExpiresAt: null,
        });
      }

      // Try to get webhook secret if available
      try {
        if (tokenData.access_token) {
          const webhooksResponse = await fetch(
            "https://api.razorpay.com/v1/webhooks",
            {
              method: "GET",
              headers: {
                Authorization: `Bearer ${tokenData.access_token}`,
              },
            },
          );

          const webhooksData = await webhooksResponse.json();

          // If webhooks exist, store the secret of the first active one
          if (webhooksData.items && webhooksData.items.length > 0) {
            const activeWebhook = webhooksData.items.find(
              (webhook) => webhook.active === true,
            );

            if (activeWebhook && activeWebhook.secret) {
              await Razorpay.findByIdAndUpdate(razorpayRecord._id, {
                razorpayWebhookSecret: activeWebhook.secret,
              });
            }
          }
        }
      } catch (webhookError) {
        console.error(
          "Could not fetch Razorpay webhook details:",
          webhookError,
        );
        // Continue without webhook secret
      }

      // Store tenentId in a cookie or URL parameter to use for client-side redirect
      return res.redirect(
        `${BASE_URL}/dashboard?razorpay=connected&tenentId=${razorpayRecord.tenentId}`,
      );
    } catch (error) {
      console.error("Razorpay OAuth error:", error.message);
      return res.redirect(`${BASE_URL}/dashboard?razorpay=error`);
    }
  } catch (error) {
    console.error("Error in Razorpay callback:", error);
    return res.redirect(`${BASE_URL}/dashboard?razorpay=error`);
  }
});

// Check connection and return more detailed information
router.get("/check-connection", async (req, res) => {
  try {
    // Get tenant ID from request header or query parameter
    const tenentId = req.headers["x-tenant-id"] || req.query.tenentId;

    if (!tenentId) {
      return res
        .status(401)
        .json({ error: "Unauthorized - No tenant ID provided" });
    }

    // Find the Razorpay record for this tenant
    const razorpayRecord = await Razorpay.findOne({ tenentId: tenentId });
    console.log("razorpayRecord", razorpayRecord);

    const isConnected = !!razorpayRecord?.razorpayAccessToken;
    console.log("isConnected", isConnected);

    // Return more detailed connection data for the frontend
    return res.status(200).json({
      isConnected: isConnected,
      accountId: isConnected ? razorpayRecord.razorpayAccountId : null,
      keyId: isConnected ? razorpayRecord.razorpayKeyId : null,
      connectedSince: isConnected ? razorpayRecord.createdAt : null,
    });
  } catch (error) {
    console.error("Failed to check Razorpay connection:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Disconnect from Razorpay
router.post("/disconnect", async (req, res) => {
  try {
    // Get tenant ID from request body or header
    const tenentId = req.body.tenentId || req.headers["x-tenant-id"];

    if (!tenentId) {
      return res
        .status(401)
        .json({ error: "Unauthorized - No tenant ID provided" });
    }

    // Find the Razorpay record for this tenant
    const razorpayRecord = await Razorpay.findOne({ tenentId: tenentId });

    if (!razorpayRecord) {
      return res
        .status(404)
        .json({ error: "No Razorpay connection found for this tenant" });
    }

    // Clear all Razorpay connection details while preserving the document
    await Razorpay.findByIdAndUpdate(razorpayRecord._id, {
      razorpayAccessToken: null,
      razorpayRefreshToken: null,
      razorpayTokenExpiresAt: null,
      razorpayAccountId: null,
      razorpayKeyId: null,
      razorpayWebhookSecret: null,
    });

    return res.status(200).json({
      success: true,
      message: "Razorpay connection successfully removed",
    });
  } catch (error) {
    console.error("Error disconnecting from Razorpay:", error);
    return res.status(500).json({
      error: "Server error disconnecting from Razorpay",
      message: error.message,
    });
  }
});

// ✅ Enhanced Webhook handler with proper notification handling
router.post("/webhook", async (req, res) => {
  try {
    const body = JSON.stringify(req.body);
    console.log("Received webhook payload:", body);

    const signature = req.headers["x-razorpay-signature"];
    if (!signature) {
      return res.status(401).json({ error: "Missing signature" });
    }

    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET)
      .update(body)
      .digest("hex");

    if (signature !== expectedSignature) {
      return res.status(401).json({ error: "Invalid signature" });
    }

    const webhookData = req.body;
    console.log("Processing webhook event:", webhookData.event);

    switch (webhookData.event) {
      case "payment_link.paid": {
        const billNo = webhookData.payload.payment_link?.entity.notes.bill_no;
        if (!billNo) {
          throw new Error("Invalid bill number in payment link notes");
        }

        const amount = webhookData.payload.payment_link.entity.amount / 100;
        const paymentId = webhookData.payload.payment?.entity.id;

        // Start database transaction for atomic operations
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
          // Step 1: Update order status
          const order = await Order.findOneAndUpdate(
            { bill_no: billNo },
            {
              amount: amount,
              paymentStatus: "PAID",
              paymentMethod: "razorpay_link",
              razorpayPaymentId: paymentId,
              status: "PROCESSING",
            },
            { new: true, session },
          );

          if (!order) {
            throw new Error(`Order with bill_no ${billNo} not found`);
          }

          // Step 2: Reduce inventory
          console.log("🔄 Starting inventory reduction...");

          for (const orderProduct of order.products) {
            console.log(`\n📦 Processing: ${orderProduct.product_name}`);
            console.log(`   Order SKU: ${orderProduct.sku}`);
            console.log(`   Quantity: ${orderProduct.quantity}`);

            let stockReduced = false;

            // TYPE 1: Check if order SKU matches a unit SKU (unit-level stock)
            const productWithUnit = await ProductDetail.findOne({
              tenentId: order.tenentId,
              "units.sku": orderProduct.sku,
            }).session(session);

            if (productWithUnit) {
              const unit = productWithUnit.units.find(
                (u) => u.sku === orderProduct.sku,
              );

              if (unit) {
                const currentStock = unit.quantityInStock || 0;
                const newQuantity = Math.max(
                  0,
                  currentStock - orderProduct.quantity,
                );

                await ProductDetail.updateOne(
                  {
                    tenentId: order.tenentId,
                    "units.sku": orderProduct.sku,
                  },
                  {
                    $set: { "units.$[elem].quantityInStock": newQuantity },
                  },
                  {
                    arrayFilters: [{ "elem.sku": orderProduct.sku }],
                    session,
                  },
                );

                console.log(
                  `   ✅ Unit stock reduced: ${currentStock} → ${newQuantity} (unit: ${unit.unit})`,
                );

                if (currentStock < orderProduct.quantity) {
                  console.warn(
                    `   ⚠️  Overselling detected! Stock was ${currentStock}, tried to reduce by ${orderProduct.quantity}`,
                  );
                }

                stockReduced = true;
              }
            }

            // TYPE 2: Check if order SKU matches product SKU (product-level stock)
            if (!stockReduced) {
              const productDetail = await ProductDetail.findOne({
                tenentId: order.tenentId,
                sku: orderProduct.sku,
              }).session(session);

              if (productDetail) {
                const currentStock = productDetail.quantityInStock || 0;
                const newQuantity = Math.max(
                  0,
                  currentStock - orderProduct.quantity,
                );

                await ProductDetail.updateOne(
                  { tenentId: order.tenentId, sku: orderProduct.sku },
                  { $set: { quantityInStock: newQuantity } },
                  { session },
                );

                console.log(
                  `   ✅ Product stock reduced: ${currentStock} → ${newQuantity}`,
                );

                if (currentStock < orderProduct.quantity) {
                  console.warn(
                    `   ⚠️  Overselling detected! Stock was ${currentStock}, tried to reduce by ${orderProduct.quantity}`,
                  );
                }

                stockReduced = true;
              }
            }

            // Error if product not found in either type
            if (!stockReduced) {
              const errorMsg = `Product not found for SKU: ${orderProduct.sku}`;
              console.error(`   ❌ ${errorMsg}`);
              throw new Error(errorMsg);
            }
          }

          // Step 3: Clear cart
          await Cart.findOneAndUpdate(
            { senderId: order.senderId, tenentId: order.tenentId },
            { $set: { items: [] } },
            { session },
          );

          // Commit transaction
          await session.commitTransaction();
          session.endSession();

          console.log("\n✅ Transaction committed successfully");

          // Step 4: Send notification (non-blocking)
          sendOrderConfirmation(order)
            .then((result) => {
              console.log("📧 Notification result:", result);
            })
            .catch((err) => {
              console.error("📧 Notification failed:", err.message);
            });

          break;
        } catch (error) {
          // Rollback transaction on any error
          await session.abortTransaction();
          session.endSession();

          console.error(
            "\n❌ Transaction aborted due to error:",
            error.message,
          );
          console.error("📋 Stack trace:", error.stack);

          throw error;
        }
      }

      case "payment.authorized":
      case "payment.captured": {
        const billNo = webhookData.payload.payment?.entity.notes.bill_no;
        if (!billNo) {
          throw new Error("Invalid bill number in payment notes");
        }

        const amount = webhookData.payload.payment.entity.amount / 100;
        const paymentId = webhookData.payload.payment.entity.id;
        /*
        const order = await Order.findOneAndUpdate(
          { bill_no: billNo },
          {
            amount: amount,
            paymentStatus: 'PAID',
            paymentMethod: webhookData.payload.payment.entity.method || 'razorpay',
            razorpayPaymentId: paymentId,
            status: 'processing'
          },
          { new: true }
        );
        
        if (!order) {
          throw new Error(`Order with bill_no ${billNo} not found`);
        }

        // Clear cart
        await Cart.findOneAndUpdate(
          { senderId: order.senderId, tenentId: order.tenentId },
          { $set: { items: [] } }
        );

        // ✅ Send notification with enhanced SMS fallback
        const notificationResult = await sendOrderConfirmation(order);
        console.log('Notification result:', notificationResult);
        */
        console.log("Successfully  payment captured");
        break;
      }

      case "payment_link.failed":
      case "payment.failed": {
        const notes =
          webhookData.event === "payment.failed"
            ? webhookData.payload.payment?.entity.notes
            : webhookData.payload.payment_link?.entity.notes;

        const billNo = notes?.bill_no;
        if (!billNo) {
          throw new Error("Invalid bill number in payment notes");
        }

        await Order.findOneAndUpdate(
          { bill_no: billNo },
          { paymentStatus: "FAILED" },
          { new: true },
        );
        break;
      }

      case "payment_link.expired": {
        const billNo = webhookData.payload.payment_link?.entity.notes.bill_no;
        if (!billNo) {
          throw new Error("Invalid bill number in payment link notes");
        }

        await Order.findOneAndUpdate(
          { bill_no: billNo },
          { paymentStatus: "EXPIRED" },
          { new: true },
        );
        break;
      }
    }

    return res.status(200).json({
      status: "success",
      event: webhookData.event,
      processedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Webhook processing error:", error);
    return res.status(500).json({
      error: "Webhook processing failed",
      message: error.message || "Unknown error",
      timestamp: new Date().toISOString(),
    });
  }
});

module.exports = router;
