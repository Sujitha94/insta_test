require("dotenv").config();

const Mainmode = require('../models/Mainmode');
const path = require('path');
const axios = require('axios');
const express = require('express');
const { json } = express;
const router = express.Router();
const WebSocket = require('ws');
const multer = require('multer');
const cors = require('cors');
const PersistentmenuUrl = require('../models/PersistentmenuUrl');
const ecommerceCredentialsService = require('../models/ecommerceCredentialsService');
const Signup = require('../models/Signup');
const LongToken = require('../models/LongToken');
const InstaxBotSystemMenu = require('../models/InstaxBotSystemMenu');

router.use(cors({
  origin: '*'
}));

const OpenAI = require('openai');
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const clients = new Map();
const openai = new OpenAI({
  apiKey: OPENAI_API_KEY
});

// Broadcast message to all clients with matching tenantId
const broadcast = (tenantId, message) => {
  clients.forEach((ws, clientId) => {
    if (clientId.startsWith(tenantId) && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  });
};

const mainchathandlers = {
    async handleMainMode(ws, data) {
      const { tenentId, mainmode } = data;
      const existingurl = await PersistentmenuUrl.findOne({ tenentId })
        .sort({ createdAt: -1 })
        .limit(1);
      const signupdata = await Signup.findOne({ tenentId: tenentId }).sort({ createdAt: -1 }).limit(1);
      const username = signupdata.name;

      let longLivedToken;
      let user_id;
      const latestToken = await LongToken.findOne({tenentId:tenentId}).sort({ createdAt: -1 }).limit(1);
      if (latestToken) {
        longLivedToken = latestToken.userAccessToken;
        user_id = latestToken.Instagramid;
      }

      let persistentMenuPayload = null;

      async function setupPersistentMenu(tenentId, userAccessToken, recipientID) {
        let persistentMenuPayload = null;

        try {
          const signupdata = await Signup.findOne({ tenentId: tenentId }).sort({ createdAt: -1 }).limit(1);

          if (signupdata) {
            const username = signupdata.name;

            // Fetch saved system menu data
            let savedSystemMenu = null;
            try {
              savedSystemMenu = await InstaxBotSystemMenu.findOne({ tenentId: tenentId })
                .sort({ createdAt: -1 })
                .limit(1);
              console.log("Saved system menu data:", savedSystemMenu);
            } catch (error) {
              console.error("Error fetching saved system menu:", error);
            }

            const latestMainMode = await Mainmode.findOne({ tenentId })
              .sort({ createdAt: -1 });

            const currentMainMode = latestMainMode?.mainmode || 'online';
            console.log("mainmode:", currentMainMode);

            // Only use saved system menu data if available
            if (savedSystemMenu && savedSystemMenu.payloads && savedSystemMenu.payloads.length > 0) {
              console.log("Using saved system menu configuration with mode consideration");

              const callToActions = [];

              // Process saved payloads
              for (const item of savedSystemMenu.payloads) {
                if (item.type === 'payload') {
                  callToActions.push({
                    type: "postback",
                    title: item.title,
                    payload: item.value
                  });
                } else if (item.type === 'web-url') {
                  callToActions.push({
                    type: "web_url",
                    title: item.title,
                    url: item.value,
                    webview_height_ratio: "full"
                  });
                }
              }

              // Consider main mode with saved menu
              if (currentMainMode === "online") {
                // In online mode, filter out Human Agent and Chatbot options
                const filteredCallToActions = callToActions.filter(action =>
                  action.payload !== "HUMAN_AGENT" && action.payload !== "AI_ASSISTANT"
                );

                persistentMenuPayload = {
                  platform: "instagram",
                  persistent_menu: [
                    {
                      composer_input_disabled: false,
                      locale: "default",
                      call_to_actions: filteredCallToActions
                    }
                  ]
                };
              } else {
                // In offline mode, use all saved menu items
                persistentMenuPayload = {
                  platform: "instagram",
                  persistent_menu: [
                    {
                      composer_input_disabled: false,
                      locale: "default",
                      call_to_actions: callToActions
                    }
                  ]
                };
              }
            } else {
              console.log("No saved system menu found, persistent menu will not be created");
              persistentMenuPayload = null;
            }

            console.log('Final Instagram persistentMenuPayload created:', JSON.stringify(persistentMenuPayload, null, 2));
          } else {
            console.log("No signup data found for tenentId:", tenentId);
            persistentMenuPayload = null;
          }

        } catch (error) {
          console.error("Error setting up persistent menu:", error);
          persistentMenuPayload = null;
        }

        console.log('Returning persistentMenuPayload:', persistentMenuPayload);
        return persistentMenuPayload;
      }

      async function setPersistentMenu(userAccessToken, recipientID, tenentId) {
        try {
          console.log('Calling setupPersistentMenu...');
          const persistentMenuPayload = await setupPersistentMenu(tenentId, userAccessToken, recipientID);

          console.log('Instagram ID received:', recipientID);
          console.log('User Access Token received:', userAccessToken);
          console.log('Tenant ID received:', tenentId);
          console.log('Instagram persistentMenuPayload received:', persistentMenuPayload);

          // If no saved menu exists, don't create persistent menu
          if (!persistentMenuPayload || !persistentMenuPayload.persistent_menu) {
            console.log('No saved system menu found - skipping persistent menu creation');
            return {
              success: false,
              error: 'No saved system menu configuration found'
            };
          }

          // Validate that we have at least one menu action
          if (!persistentMenuPayload.persistent_menu[0] ||
              !persistentMenuPayload.persistent_menu[0].call_to_actions ||
              persistentMenuPayload.persistent_menu[0].call_to_actions.length === 0) {
            console.error('No menu actions found in persistent menu payload');
            return {
              success: false,
              error: 'No menu actions configured'
            };
          }

          const url = `https://graph.instagram.com/v21.0/${recipientID}/messenger_profile`;

          console.log('Making API call to Instagram with payload:', JSON.stringify(persistentMenuPayload, null, 2));

          // Post persistent menu data
          const response = await axios.post(url, persistentMenuPayload, {
            headers: {
              'Authorization': `Bearer ${userAccessToken}`,
              'Content-Type': 'application/json'
            }
          });

          console.log('Persistent menu successfully created:', response.data);

          return {
            success: true,
            data: response.data
          };
        } catch (error) {
          console.error('Error creating persistent menu:', error.response ? error.response.data : error.message);
          return {
            success: false,
            error: error.response ? error.response.data : error.message
          };
        }
      }
      
      setPersistentMenu(longLivedToken, user_id, tenentId);

      // Input validation
      if (!tenentId) {
        ws.send(JSON.stringify({
          type: 'main_chat_mode_update',
          status: 'error',
          message: 'Missing required field: tenentId'
        }));
        return;
      }

      // Validate mode
      const validMode = mainmode && ['online', 'offline'].includes(mainmode) ? mainmode : 'online';

      try {
        // Find existing mode or create new one
        const existingMode = await Mainmode.findOne({ tenentId })
          .sort({ createdAt: -1 })
          .limit(1);

        let updatedMode;

        if (existingMode) {
          updatedMode = await Mainmode.findOneAndUpdate(
            { tenentId },
            { $set: { mainmode: validMode }},
            { new: true }
          );
        } else {
          const newMode = new Mainmode({
            tenentId,
            mainmode: validMode
          });
          updatedMode = await newMode.save();
        }

        if (!updatedMode) {
          throw new Error('Failed to update main mode');
        }

        const response = {
          type: 'main_chat_mode_updated',
          status: 'success',
          data: {
            mainmode: validMode,
          },
        };

        // Send response to requesting client
        ws.send(JSON.stringify(response));

      } catch (error) {
        console.error('Error updating main chat mode:', error);
        ws.send(JSON.stringify({
          type: 'main_chat_mode_update',
          status: 'error',
          message: error.message || 'Server error'
        }));
      }
    },

    async handleGetMainMode(ws, data) {
      const { tenentId } = data;

      // Input validation
      if (!tenentId) {
        ws.send(JSON.stringify({
          type: 'main_chat_mode',
          status: 'error',
          message: 'Missing required field: tenentId'
        }));
        return;
      }

      try {
        const latestMode = await Mainmode.findOne({ tenentId })
          .sort({ createdAt: -1 })
          .limit(1);

        const response = {
          type: 'main_chat_mode',
          status: 'success',
          data: {
            mainmode: latestMode?.mainmode || 'online',
          }
        };

        ws.send(JSON.stringify(response));
      } catch (error) {
        console.error('Error getting main chat mode:', error);
        ws.send(JSON.stringify({
          type: 'main_chat_mode',
          status: 'error',
          message: error.message || 'Server error'
        }));
      }
    }
};

module.exports = mainchathandlers;

