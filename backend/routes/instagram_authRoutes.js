require("dotenv").config();

const Tokeninfo = require("../models/Tokeninfo");
const LongToken = require("../models/LongToken");
const Icebreaker = require("../models/Icebreaker");
const Signup = require("../models/Signup");
const Mainmode = require("../models/Mainmode");
const ProductavailabilityUrl = require("../models/ProductavailabilityUrl");
const OrderstatusUrl = require("../models/OrderstatusUrl");
const PersistentmenuUrl = require("../models/PersistentmenuUrl");
const ecommerceCredentialsService = require("../models/ecommerceCredentialsService");
const axios = require("axios");
const express = require("express");
const { json } = express;
const router = express.Router();
const https = require("https");
const querystring = require("querystring");
const multer = require("multer");
const cors = require("cors");
const upload = multer({ dest: "uploads/" });
const crypto = require("crypto");
const InstaxBotSystemMenu = require("../models/InstaxBotSystemMenu");

router.use(
  cors({
    origin: "*",
  }),
);

const OpenAI = require("openai");
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
});

const config = require("../services/config");

// Instagram OAuth callback route
router.get("/auth/instagram/callback", async (req, res) => {
  const authCode = req.query.code;
  console.log("req.query", req.query);
  const tenantId = req.query.state;
  console.log("Client ID:", config.clientId);
  console.log("Authorization Code:", authCode);
  console.log("Transfered Tenant ID:", tenantId);
  if (!authCode) {
    return res.status(400).send("Authorization code not found");
  }

  try {
    const postData = querystring.stringify({
      client_id: process.env.CLIENT_ID,
      client_secret: process.env.CLIENT_SECRET,
      grant_type: "authorization_code",
      redirect_uri:
        "https://snaking-outhouse-oppose.ngrok-free.dev/api/instagram_authroute/auth/instagram/callback",
      code: authCode,
    });

    const options = {
      hostname: "api.instagram.com",
      path: "/oauth/access_token",
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Content-Length": Buffer.byteLength(postData),
      },
    };

    const request = https.request(options, (response) => {
      let data = "";

      response.on("data", (chunk) => {
        data += chunk;
      });

      response.on("end", async () => {
        if (response.statusCode === 200) {
          const tokenResponse = JSON.parse(data);
          console.log("tokenResponse", tokenResponse);
          const accessToken = tokenResponse.access_token;
          console.log("Access token received:", accessToken);
          console.log("Access token data:", tokenResponse);
          const shortLivedAccessToken = accessToken;
          const longLivedToken = await getLongLivedAccessToken(
            shortLivedAccessToken,
          );
          const useriddata = await getInstagramUserIdInformation(
            longLivedToken,
          );
          if (useriddata) {
            const user_id = useriddata.user_id;
            console.log("userid", user_id);
            const tenentId = tenantId;
            const latestToken = await LongToken.findOne({ tenentId: tenentId })
              .sort({ createdAt: -1 })
              .limit(1);
            if (latestToken) {
              const Instagramconnectedid = latestToken.Instagramid;

              if (Instagramconnectedid != user_id) {
                res.send(`
                <html>
                  <head>
                    <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>
                  </head>
                  <body>
                    <script>
                      Swal.fire({
                        title: 'Instagram Authorization Error!',
                        text: "You have already connected a different Instagram account and cannot connect another. If you wish to connect a different Instagram account, please contact Tech Vaseegrah for assistance.",
                        icon: 'error',
                        confirmButtonText: 'Close',
                        didClose: () => {
                          if (window.opener) {
                            window.opener.postMessage('instagramConnectionError', '*');
                          }
                          window.close();
                        },
                      });
                    </script>
                  </body>
                </html>
              `);
              } else {
                const user_id = useriddata.user_id;
                console.log("Creating LongToken with data:", {
                  userAccessToken: longLivedToken,
                  Instagramid: user_id,
                  tenentId: tenentId,
                });
                const longtoken = {
                  userAccessToken: longLivedToken,
                  Instagramid: user_id,
                  tenentId: tenentId,
                };
                const newtoken = new LongToken(longtoken);
                console.log("Creating LongToken with data:", {
                  userAccessToken: longLivedToken,
                  Instagramid: user_id,
                  tenentId: tenentId,
                });
                const savedToken = await newtoken.save();
                console.log("longLivedToken saved:", longLivedToken);
                try {
                  const subscribeResponse = await axios.post(
                    `https://graph.instagram.com/v23.0/${user_id}/subscribed_apps`,
                    null,
                    {
                      params: {
                        subscribed_fields:
                          "messages,message_reactions,messaging_postbacks,messaging_referral,messaging_seen,comments,live_comments",
                        access_token: longLivedToken,
                      },
                    },
                  );
                  console.log(
                    "Webhook subscription successful:",
                    subscribeResponse.data,
                  );
                  if (subscribeResponse.data) {
                    res.send(`
                <html>
    <head>
      <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>
    </head>
    <body>
      <script>
        Swal.fire({
          title: 'Instagram Authorization Successful!',
          text: 'You can close this window.',
          icon: 'success',
          confirmButtonText: 'Close',
          timer: 5000,
          didClose: () => {
            if (window.opener) {
              window.opener.postMessage('instagramConnected', '*');
            }
            window.close();
          },
        });
      </script>
    </body>
  </html>
              `);
                  }

                  const savedToken = await newtoken.save();
                  console.log(
                    "User data1 LongLivedAccessTokensaved:",
                    savedToken,
                  );
                  setPersistentMenu(
                    persistentMenuPayload,
                    longLivedToken,
                    user_id,
                    tenentId,
                  );
                  setIceBreakers(longLivedToken, user_id, tenentId);
                } catch (error) {
                  console.error(
                    "Error subscribing to webhook:",
                    error.response?.data || error.message,
                  );
                  res.status(500).send("Error during Instagram authorization");
                }
              }
            } else {
              const user_id = useriddata.user_id;
              console.log("Creating LongToken with data:", {
                userAccessToken: longLivedToken,
                Instagramid: user_id,
                tenentId: tenentId,
              });
              const longtoken = {
                userAccessToken: longLivedToken,
                Instagramid: user_id,
                tenentId: tenentId,
              };
              const newtoken = new LongToken(longtoken);
              console.log("Creating LongToken with data:", {
                userAccessToken: longLivedToken,
                Instagramid: user_id,
                tenentId: tenentId,
              });
              console.log("longLivedToken saved:", longLivedToken);
              try {
                const subscribeResponse = await axios.post(
                  `https://graph.instagram.com/v23.0/${user_id}/subscribed_apps`,
                  null,
                  {
                    params: {
                      subscribed_fields:
                        "messages,message_reactions,messaging_postbacks,messaging_referral,messaging_seen,comments,live_comments",
                      access_token: longLivedToken,
                    },
                  },
                );
                console.log(
                  "Webhook subscription successful:",
                  subscribeResponse.data,
                );
                if (subscribeResponse.data) {
                  res.send(`
                <html>
    <head>
      <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>
    </head>
    <body>
      <script>
        Swal.fire({
          title: 'Instagram Authorization Successful!',
          text: 'You can close this window.',
          icon: 'success',
          confirmButtonText: 'Close',
          timer: 5000,
          didClose: () => {
            if (window.opener) {
              window.opener.postMessage('instagramConnected', '*');
            }
            window.close();
          },
        });
      </script>
    </body>
  </html>
              `);
                }

                const savedToken = await newtoken.save();
                console.log(
                  "User data1 LongLivedAccessTokensaved:",
                  savedToken,
                );
                setPersistentMenu(
                  persistentMenuPayload,
                  longLivedToken,
                  user_id,
                  tenentId,
                );
                setIceBreakers(longLivedToken, user_id, tenentId);
              } catch (error) {
                console.error(
                  "Error subscribing to webhook:",
                  error.response?.data || error.message,
                );
                res.status(500).send("Error during Instagram authorization");
              }
            }
          } else {
            console.error("Error:", data);
            res.status(500).send("Error during Instagram authorization");
          }
        } else {
          console.error("Error:", data);
          res.status(500).send("Error during Instagram authorization");
        }
      });
    });

    request.on("error", (e) => {
      console.error("Error exchanging authorization code:", e.message);
      res.status(500).send("Error during Instagram authorization");
    });

    request.write(postData);
    request.end();
  } catch (error) {
    console.error("Unexpected error:", error);
    res.status(500).send("Unexpected error during Instagram authorization");
  }
});

async function getLongLivedAccessToken(shortLivedAccessToken) {
  console.log("Access token received:", shortLivedAccessToken);
  console.log("CLIENT_ID from .env:", process.env.CLIENT_ID);
  try {
    const response = await axios.get(
      `https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=${process.env.CLIENT_SECRET}&access_token=${shortLivedAccessToken}`,
    );

    const longLivedToken = response.data.access_token;

    console.log("longLivedToken :", longLivedToken);
    const token = new Tokeninfo({ userAccessToken: longLivedToken });
    try {
      const savedToken = await token.save();
      console.log("User data LongLivedAccessTokensaved:", savedToken);
    } catch (error) {
      console.error("Error saving LongLivedAccessToken data:", error);
    }
    return longLivedToken;
  } catch (error) {
    console.error(
      "Error obtaining long-lived token:",
      error.response ? error.response.data : error.message,
    );
    return {
      success: false,
      error: error.response ? error.response.data : error.message,
    };
  }
}

module.exports = {
  port: process.env.PORT || 80,
};

// Data deletion request handler
router.post("/auth/instagram/data_deletion", (req, res) => {
  console.log("app secret", config.clientSecret);
  console.log("Deletion request received:", req.body);
  const { signed_request: signedRequest } = req.body;
  const secret = config.clientSecret;

  if (!signedRequest) {
    return res.status(400).send("Missing signed request");
  }

  const data = parseSignedRequest(signedRequest, secret);
  if (!data) {
    return res.status(400).send("Invalid signed request");
  }

  const userId = data.user_id;

  console.log(`Starting data deletion for user: ${userId}`);

  const confirmationCode = "abc123";
  const statusUrl = `https://snaking-outhouse-oppose.ngrok-free.dev/api/instagram_authroute/auth/instagram/data_deletion?id=${confirmationCode}`;

  res.json({
    url: statusUrl,
    confirmation_code: confirmationCode,
  });
});

// Function to parse and verify the signed_request
function parseSignedRequest(signedRequest, appSecret) {
  const [encodedSig, payload] = signedRequest.split(".");

  const sig = Buffer.from(encodedSig, "base64");
  const data = JSON.parse(Buffer.from(payload, "base64").toString("utf8"));

  if (data.algorithm && data.algorithm.toUpperCase() !== "HMAC-SHA256") {
    console.error("Unknown algorithm: " + data.algorithm);
    return null;
  }

  const expectedSig = crypto
    .createHmac("sha256", appSecret)
    .update(payload)
    .digest();

  if (!crypto.timingSafeEqual(sig, expectedSig)) {
    console.log("Received sig:", sig);
    console.log("Expected sig:", expectedSig);
    console.error("Bad Signed JSON signature!");
    return null;
  }

  return data;
}

// Function to base64 decode a string
function base64UrlDecode(str) {
  return Buffer.from(str, "base64").toString("utf8");
}

// Instagram Deauthorization callback handler
router.post("/auth/instagram/deauthorize", upload.none(), (req, res) => {
  console.log("Headers:", req.headers);

  console.log("Deauthorize request received:", req.body);
  const { signed_request: signedRequest } = req.body;
  const secret = config.clientSecret;

  if (!signedRequest) {
    return res.status(400).send("Missing signed request");
  }

  const [encodedSig, payload] = signedRequest.split(".");

  const expectedSig = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/={1,2}$/, "");

  if (encodedSig !== expectedSig) {
    return res.status(400).send("Invalid signature");
  }

  const data = JSON.parse(Buffer.from(payload, "base64").toString("utf8"));

  const userId = data.user_id;
  console.log(`Deauthorization for user: ${userId}`);

  res.sendStatus(200);
});

async function getInstagramUserIdInformation(userAccessToken) {
  const accessToken = userAccessToken;
  try {
    const response = await axios.get(`https://graph.instagram.com/v23.0/me`, {
      params: {
        fields: "name,username,user_id",
        access_token: accessToken,
      },
    });

    if (response.data) {
      console.log("User Profile:", response.data);
      return response.data;
    } else {
      console.log("Response data is undefined.");
    }
  } catch (error) {
    if (error.response) {
      console.error(
        "Error fetching user profile:",
        error.response.status,
        error.response.data,
      );
    } else {
      console.error("Error fetching user profile:", error.message);
    }
  }
}

async function getInstagramUserProfileInformation(senderId, tenentId) {
  const IGSID = senderId;
  let userAccessToken;
  console.log("sender:", IGSID);
  const latestToken = await LongToken.findOne({ tenentId: tenentId })
    .sort({ createdAt: -1 })
    .limit(1);
  if (latestToken) {
    console.log("Latest token retrieved for Profile_infoemation:", latestToken);
    userAccessToken = latestToken.userAccessToken;
  }
  const accessToken = userAccessToken;
  try {
    const response = await axios.get(
      `https://graph.instagram.com/v23.0/${IGSID}`,
      {
        params: {
          fields: "name,username,user_id",
          access_token: accessToken,
        },
      },
    );

    if (response.data) {
      console.log("User Profile:", response.data);
      return response.data;
    } else {
      console.log("Response data is undefined.");
    }
  } catch (error) {
    if (error.response) {
      console.error(
        "Error fetching user profile:",
        error.response.status,
        error.response.data,
      );
    } else {
      console.error("Error fetching user profile:", error.message);
    }
  }
}

//Instagram's user Profile information
async function getUserProfileInformation(senderId, tenentId) {
  const IGSID = senderId;
  let userAccessToken;
  console.log("sender:", IGSID);
  const latestToken = await LongToken.findOne({ tenentId: tenentId })
    .sort({ createdAt: -1 })
    .limit(1);
  if (latestToken) {
    console.log("Latest token retrieved for Profile_infoemation:", latestToken);
    userAccessToken = latestToken.userAccessToken;
  }
  const accessToken = userAccessToken;
  try {
    const response = await axios.get(
      `https://graph.instagram.com/v23.0/${IGSID}`,
      {
        params: {
          fields: "name,username,profile_pic",
          access_token: accessToken,
        },
      },
    );

    if (response.data) {
      console.log("User Profile:", response.data);
      return response.data;
    } else {
      console.log("Response data is undefined.");
    }
  } catch (error) {
    if (error.response) {
      console.error(
        "Error fetching user profile:",
        error.response.status,
        error.response.data,
      );
    } else {
      console.error("Error fetching user profile:", error.message);
    }
  }
}

// Parse application/json. Verify that callback came from Facebook
router.use(json({ verify: verifyRequestSignature }));

// Verify that the callback came from Facebook.
function verifyRequestSignature(req, res, buf) {
  const signature = req.headers["x-hub-signature"];

  if (!signature) {
    console.warn(`Couldn't find "x-hub-signature" in headers.`);
  } else {
    const elements = signature.split("=");
    const signatureHash = elements[1];
    const expectedHash = crypto
      .createHmac("sha1", config.appSecret)
      .update(buf)
      .digest("hex");
    if (signatureHash != expectedHash) {
      throw new Error(
        "Couldn't validate the request signature. Confirm your App Secret.",
      );
    }
  }
}

let persistentMenuPayload = null;

async function setupPersistentMenu(tenentId, userAccessToken, recipientID) {
  let persistentMenuPayload = null;

  try {
    const signupdata = await Signup.findOne({ tenentId: tenentId })
      .sort({ createdAt: -1 })
      .limit(1);

    if (signupdata) {
      const username = signupdata.name;

      // Fetch saved system menu data
      let savedSystemMenu = null;
      try {
        savedSystemMenu = await InstaxBotSystemMenu.findOne({
          tenentId: tenentId,
        })
          .sort({ createdAt: -1 })
          .limit(1);
        console.log("Saved system menu data:", savedSystemMenu);
      } catch (error) {
        console.error("Error fetching saved system menu:", error);
      }

      // Fetch current mainmode
      const latestMainMode = await Mainmode.findOne({ tenentId }).sort({
        createdAt: -1,
      });

      const currentMainMode = latestMainMode?.mainmode || "offline";
      console.log("mainmode:", currentMainMode);

      // Only use saved system menu data if available
      if (
        savedSystemMenu &&
        savedSystemMenu.payloads &&
        savedSystemMenu.payloads.length > 0
      ) {
        console.log(
          "Using saved system menu configuration with mode consideration",
        );

        const callToActions = [];

        // Process saved payloads
        for (const item of savedSystemMenu.payloads) {
          if (item.type === "payload") {
            callToActions.push({
              type: "postback",
              title: item.title,
              payload: item.value,
            });
          } else if (item.type === "web-url") {
            callToActions.push({
              type: "web_url",
              title: item.title,
              url: item.value,
              webview_height_ratio: "full",
            });
          }
        }

        // Consider main mode with saved menu
        if (currentMainMode === "online") {
          // In online mode, filter out Human Agent and Chatbot options
          const filteredCallToActions = callToActions.filter(
            (action) =>
              action.payload !== "HUMAN_AGENT" &&
              action.payload !== "AI_ASSISTANT",
          );

          persistentMenuPayload = {
            platform: "instagram",
            persistent_menu: [
              {
                composer_input_disabled: false,
                locale: "default",
                call_to_actions: filteredCallToActions,
              },
            ],
          };
        } else {
          // In offline mode, use all saved menu items
          persistentMenuPayload = {
            platform: "instagram",
            persistent_menu: [
              {
                composer_input_disabled: false,
                locale: "default",
                call_to_actions: callToActions,
              },
            ],
          };
        }
      } else {
        console.log(
          "No saved system menu found, persistent menu will not be created",
        );
        persistentMenuPayload = null;
      }

      console.log(
        "Final Instagram persistentMenuPayload:",
        JSON.stringify(persistentMenuPayload, null, 2),
      );
    } else {
      console.log("No signup data found for tenentId:", tenentId);
      persistentMenuPayload = null;
    }
  } catch (error) {
    console.error("Error setting up persistent menu:", error);
    persistentMenuPayload = null;
  }

  return persistentMenuPayload;
}

async function setPersistentMenu(
  persistentMenuPayload,
  userAccessToken,
  recipientID,
  tenentId,
) {
  try {
    // Get the persistent menu payload from setupPersistentMenu
    persistentMenuPayload = await setupPersistentMenu(
      tenentId,
      userAccessToken,
      recipientID,
    );

    console.log("Instagram ID received:", recipientID);
    console.log("User Access Token received:", userAccessToken);
    console.log("Tenant ID received:", tenentId);
    console.log(
      "Instagram persistentMenuPayload:",
      JSON.stringify(persistentMenuPayload, null, 2),
    );

    // If no saved menu exists, don't create persistent menu
    if (!persistentMenuPayload || !persistentMenuPayload.persistent_menu) {
      console.log(
        "No saved system menu found - skipping persistent menu creation",
      );
      return {
        success: false,
        error: "No saved system menu configuration found",
      };
    }

    // Validate that we have at least one menu action
    if (
      !persistentMenuPayload.persistent_menu[0] ||
      !persistentMenuPayload.persistent_menu[0].call_to_actions ||
      persistentMenuPayload.persistent_menu[0].call_to_actions.length === 0
    ) {
      console.error("No menu actions found in persistent menu payload");
      return {
        success: false,
        error: "No menu actions configured",
      };
    }

    const url = `https://graph.instagram.com/v23.0/${recipientID}/messenger_profile`;

    // Post persistent menu data to Instagram API
    const response = await axios.post(url, persistentMenuPayload, {
      headers: {
        Authorization: `Bearer ${userAccessToken}`,
        "Content-Type": "application/json",
      },
    });

    console.log("Persistent menu successfully created:", response.data);

    return {
      success: true,
      data: response.data,
      menuPayload: persistentMenuPayload,
    };
  } catch (error) {
    console.error(
      "Error creating persistent menu:",
      error.response ? error.response.data : error.message,
    );

    return {
      success: false,
      error: error.response ? error.response.data : error.message,
      menuPayload: persistentMenuPayload,
    };
  }
}

const getQuestions = async (tenantId) => {
  try {
    const result = await Icebreaker.find({ tenentId: tenantId }, "questions");
    console.log("result", result);
    if (result.length > 0) {
      const allQuestions = result.map((item) => item.questions).flat();

      const iceBreakersPayload = {
        platform: "instagram",
        ice_breakers: [
          {
            locale: "default",
            call_to_actions: allQuestions.map((question, index) => ({
              question: question,
              payload: `QUESTION_${index + 1}`,
            })),
          },
        ],
      };

      console.log(JSON.stringify(iceBreakersPayload, null, 2));
      return iceBreakersPayload;
    } else {
      console.log("No questions found for this tenant.");
      return null;
    }
  } catch (error) {
    console.error("Error fetching questions:", error);
    throw error;
  }
};

async function setIceBreakers(userAccessToken, recipientID, tenentId) {
  const iceBreakersPayload = await getQuestions(tenentId);
  console.log("iceBreakersPayload:", iceBreakersPayload);
  console.log("Instagram ID received iceBreakers:", recipientID);
  console.log("User Access Token received iceBreakers:", userAccessToken);

  const url = `https://graph.instagram.com/v23.0/${recipientID}/messenger_profile`;

  try {
    const response = await axios.post(url, iceBreakersPayload, {
      headers: {
        Authorization: `Bearer ${userAccessToken}`,
        "Content-Type": "application/json",
      },
    });

    console.log("Ice breakers successfully created:", response.data);

    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error(
      "Error creating ice breakers:",
      error.response ? error.response.data : error.message,
    );
    return {
      success: false,
      error: error.response ? error.response.data : error.message,
    };
  }
}

module.exports = router;
