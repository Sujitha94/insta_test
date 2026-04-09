require("dotenv").config();

const Message = require("../models/Message");
const Newuser = require("../models/Newuser");
const LongToken = require("../models/LongToken");
const Mode = require("../models/Mode");
const Comment = require("../models/Comment");
const CommentNewuser = require("../models/CommentNewuser");
const Notification = require("../models/Notification");
const axios = require("axios");
const express = require("express");
const { json } = express;
const router = express.Router();
const multer = require("multer");
const cors = require("cors");
const WebSocket = require("ws");
const appUrl =
  process.env.APP_URL ||
  "https://inocencia-shiftiest-nonodorously.ngrok-free.dev";
const WS_SECRET_KEY = process.env.WS_SECRET_KEY;
const jwt = require("jsonwebtoken");
const broadcastedModeUpdates = new Set();
router.use(
  cors({
    origin: "*", // Replace with your client URL
  }),
);
/*const server = router.listen(appUrl, () => {
  console.log(`Server running on port ${appUrl}`);
});
const wss = new WebSocket.Server({ server });
*/
const handlers = require("./chatmodewebsocketHandlers");
const mainchathandlers = require("./mainchatmode");
const notifhandlers = require("./notificationRoutes");
const processedMessagesapp = new Set();
const clients = new Map();
let wss = null;
// messageRoutes.js
const initializeWebSocket = (server) => {
  const wss = new WebSocket.Server({
    server: server,
    path: "/ws",
  });

  // Broadcast function
  const broadcast = (tenentId, message) => {
    clients.forEach((ws, clientId) => {
      if (clientId.startsWith(tenentId) && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(message));
      }
    });
  };

  const broadcast1 = (tenentId, message) => {
    // For mode updates, prevent duplicates
    if (message.type === "chat_mode_update" && message.id) {
      if (broadcastedModeUpdates.has(message.id)) {
        return;
      }
      broadcastedModeUpdates.add(message.id);
      setTimeout(() => {
        broadcastedModeUpdates.delete(message.id);
      }, 5000);
    }

    // Keep track of which clients have received this message
    const messageId = message.message?._id || Math.random().toString();
    const sentTo = new Set();

    clients.forEach((ws, clientId) => {
      if (
        clientId.startsWith(tenentId) &&
        ws.readyState === WebSocket.OPEN &&
        !sentTo.has(clientId)
      ) {
        ws.send(JSON.stringify(message));
        sentTo.add(clientId);
      }
    });
  };

  async function sendInstagramMessage(
    igId,
    userAccessToken,
    recipientId,
    messageText1,
    timestamp,
    tenentId,
  ) {
    const url = `https://graph.instagram.com/v23.0/${igId}/messages`;
    const Metadata = "send";
    const messageTextWithEmoji = " 🙎‍♂️:" + messageText1;
    const data = {
      recipient: {
        id: recipientId,
      },
      message: {
        text: messageTextWithEmoji,
      },
    };

    try {
      const response = await axios.post(url, data, {
        headers: {
          Authorization: `Bearer ${userAccessToken}`,
          "Content-Type": "application/json",
        },
      });

      console.log("Message sent successfully", response.data);
      /*const newMessage = {
          senderId: recipientId,
          recipientId: igId,
          response: messageTextWithEmoji,
          tenentId: tenentId,
          Timestamp: timestamp
        };

        const savedMessage = await Message.createTextMessage(newMessage);
        console.log('input data', savedMessage);*/
    } catch (error) {
      console.error(
        "Error sending message:",
        error.response ? error.response.data : error.message,
      );
    }
  }

  async function fetchInstagramMessagesWithUser({ tenentId, senderId }) {
    try {
      // Step 1: Get latest token for tenant
      const latestToken = await LongToken.findOne({ tenentId })
        .sort({ createdAt: -1 })
        .limit(1);

      if (!latestToken) {
        console.warn("⚠️ No access token found for tenant:", tenentId);
        return { error: "No access token available for this tenant" };
      }

      const userAccessToken = latestToken.userAccessToken;
      const instagramid = latestToken.Instagramid;

      // Step 2: Fetch conversation with sender
      const conversationRes = await fetch(
        `https://graph.instagram.com/v23.0/me/conversations?user_id=${senderId}&access_token=${userAccessToken}`,
      );
      const conversationData = await conversationRes.json();
      const conversationId = conversationData?.data?.[0]?.id;

      if (!conversationId) {
        console.warn("⚠️ No conversation found with user:", senderId);
        return {
          messages: [],
          message: "No conversation found",
        };
      }

      // Step 3: Fetch list of messages (IDs + timestamps)
      const messagesRes = await fetch(
        `https://graph.instagram.com/v23.0/${conversationId}?fields=messages&access_token=${userAccessToken}`,
      );
      const messagesJson = await messagesRes.json();
      const messages = messagesJson?.messages?.data || [];

      //console.log(`📨 Found ${messages.length} Instagram messages with user ${senderId}`);
      const detailedMessages = [];

      for (const message of messages.slice(0, 6)) {
        const messageId = message.id;

        const detailRes = await fetch(
          `https://graph.instagram.com/v23.0/${messageId}?fields=id,created_time,from,to,message&access_token=${userAccessToken}`,
        );

        if (!detailRes.ok) {
          const errorText = await detailRes.text();
          console.warn(
            `⚠️ Failed to fetch details for message ID ${messageId}:`,
            errorText,
          );
          continue;
        }

        const detail = await detailRes.json();
        detailedMessages.push(detail);
        //console.log("📨 Full Message Detail:\n", JSON.stringify(detail, null, 2));

        const senderIdFromApi = detail.from.id;
        const recipientId = detail.to.data?.[0]?.id || instagramid;
        const timestamp = new Date(detail.created_time);

        // Check if this message already exists
        const alreadyExists = await Message.findOne({
          senderId: recipientId || senderIdFromApi,
          tenentId,
          Timestamp: timestamp,
        });

        if (alreadyExists) {
          //console.log(`⛔ Message ${detail.id} already exists, skipping save`);
          continue;
        }

        // ✅ Save only if it's sent by our IG account and message is non-empty
        if (
          detail.message &&
          detail.message.trim() !== "" &&
          senderIdFromApi === instagramid
        ) {
          await Message.createTextMessage({
            senderId: recipientId,
            recipientId: senderIdFromApi,
            tenentId,
            messageid: detail.id,
            response: detail.message,
            Timestamp: timestamp,
          });
          //console.log(`✅ Saved message ${detail.id} from our IG account to MongoDB`);
        } else {
          //console.log(`⚠️ Skipped message ${detail.id} (empty or not from our IG account)`);
        }
      }

      return {
        messages: detailedMessages,
        message: "Success",
      };
    } catch (err) {
      console.error(
        "💥 Error fetching Instagram messages with user:",
        err.message,
      );
      return { error: "Error fetching Instagram messages" };
    }
  }

  wss.on("connection", (ws) => {
    let streams = [];
    let tenentId = null;
    let senderId = null;
    let isAuthenticated = false;
    ws.on("message", async (message) => {
      try {
        const data = JSON.parse(message);

        // Handle authentication
        if (data.type === "auth") {
          try {
            if (isAuthenticated) {
              console.log("Client already authenticated");
              return;
            }

            const decoded = jwt.verify(data.wstoken, WS_SECRET_KEY);
            isAuthenticated = true;
            tenentId = decoded.tenentId;

            ws.send(
              JSON.stringify({
                type: "auth",
                status: "success",
              }),
            );
            clients.set(`${tenentId}-${senderId}`, ws);
            //console.log("clients for websocket",clients);
          } catch (error) {
            ws.send(
              JSON.stringify({
                type: "auth",
                status: "error",
                message: "Invalid token",
              }),
            );
            return;
          }
        }

        if (!isAuthenticated) {
          ws.send(
            JSON.stringify({
              type: "error",
              message: "Not authenticated",
            }),
          );
          return;
        }

        switch (data.type) {
          case "init":
            tenentId = data.tenentId;
            senderId = data.senderId;
            /*if(tenentId!="dc7ab140-7206-4451-8af2-6966f969c096"){
               const result = await fetchInstagramMessagesWithUser({ tenentId, senderId});
              }*/
            //clients.set(`${tenentId}-${senderId}`, ws);

            // Only send message history, don't fetch contacts
            const messages = await Message.find({
              tenentId,
              $or: [{ senderId: senderId }, { recipientId: senderId }],
            })
              .sort({ Timestamp: -1 })
              .limit(40);
            //console.log("clients for websocket",clients);
            // Only send history message, not contact list
            ws.send(
              JSON.stringify({
                type: "history",
                messages: messages,
              }),
            );
            break;

          // First, create an index to speed up queries (run this once)
          // await Message.collection.createIndex({ tenentId: 1, Timestamp: -1 });

          case "get_contacts":
            try {
              const tenentId = data.tenentId;
              const page = data.page || 1;
              const limit = data.limit || 6;
              const skip = (page - 1) * limit;

              if (!tenentId) {
                ws.send(
                  JSON.stringify({
                    type: "error",
                    message: "No tenant ID provided",
                  }),
                );
                return;
              }

              // Track omitted contacts for logging
              const omittedContacts = [];

              // OPTIMIZATION 1: Get a limited set of the most recent messages first
              // This reduces the initial dataset size before grouping
              const recentMessages = await Message.find({ tenentId })
                .sort({ Timestamp: -1 })
                .limit(1000) // Use a reasonably high limit to get enough unique contacts
                .lean(); // Convert to plain objects for faster processing

              // OPTIMIZATION 2: Perform grouping in application memory instead of MongoDB
              // Extract unique sender-recipient pairs with their latest message
              const contactMap = new Map();

              recentMessages.forEach((message) => {
                // Create unique key for each contact pair
                const contactKey1 = `${message.senderId}-${message.recipientId}`;
                const contactKey2 = `${message.recipientId}-${message.senderId}`;

                // Check if we've seen either direction of this contact pair
                if (
                  !contactMap.has(contactKey1) &&
                  !contactMap.has(contactKey2)
                ) {
                  // Store first occurrence (which is the latest due to our sort)
                  contactMap.set(contactKey1, message);
                }
              });

              // Convert map to array and sort by timestamp
              let contactsWithLastMessages = Array.from(
                contactMap.values(),
              ).sort((a, b) => new Date(b.Timestamp) - new Date(a.Timestamp));

              // Apply pagination in memory but keep the original list for tracking what we've seen
              let paginatedContacts = contactsWithLastMessages.slice(
                skip,
                skip + limit,
              );

              // Extract unique user IDs to fetch user details
              const userIds = new Set();
              paginatedContacts.forEach((message) => {
                userIds.add(message.senderId);
                userIds.add(message.recipientId);
              });

              // Fetch user details for these IDs
              const users = await Newuser.find({
                tenentId,
                senderId: { $in: Array.from(userIds) },
              });

              // Create a map of user details
              const userMap = new Map(
                users.map((user) => [user.senderId, user]),
              );

              // Combine message data with user details
              let contactsWithDetails = paginatedContacts
                .map((message) => {
                  // Find which ID in the message is the contact we want to show
                  const userDetails =
                    userMap.get(message.senderId) ||
                    userMap.get(message.recipientId);

                  if (!userDetails) {
                    omittedContacts.push({
                      senderId: message.senderId,
                      recipientId: message.recipientId,
                      reason:
                        "No matching user details found in Newuser collection",
                    });
                    return null;
                  }

                  return {
                    ...userDetails.toObject(),
                    lastMessage: {
                      message: message.message,
                      response: message.response,
                      Timestamp: message.Timestamp,
                      messageType: message.messageType,
                    },
                  };
                })
                .filter((contact) => contact !== null);

              // If we have fewer contacts than requested, get additional contacts
              if (contactsWithDetails.length < limit) {
                console.log(
                  `Only ${contactsWithDetails.length} valid contacts found, which is less than the limit of ${limit}.`,
                );
                console.log("Omitted contacts reasons:", omittedContacts);

                // Calculate how many more contacts we need
                const additionalNeeded = limit - contactsWithDetails.length;
                console.log(
                  `Fetching ${additionalNeeded} additional contacts...`,
                );

                // Get the IDs we've already processed to exclude them
                const processedSenderIds = new Set();
                const processedRecipientIds = new Set();
                contactsWithLastMessages.forEach((message) => {
                  processedSenderIds.add(message.senderId);
                  processedRecipientIds.add(message.recipientId);
                });

                // Get more recent messages, excluding the ones we've already seen
                const additionalRecent = await Message.find({
                  tenentId,
                  $nor: [
                    {
                      senderId: { $in: Array.from(processedSenderIds) },
                      recipientId: { $in: Array.from(processedRecipientIds) },
                    },
                  ],
                })
                  .sort({ Timestamp: -1 })
                  .limit(500) // Fetch more potential messages
                  .lean();

                // Apply the same grouping logic
                const additionalContactMap = new Map();

                additionalRecent.forEach((message) => {
                  const contactKey1 = `${message.senderId}-${message.recipientId}`;
                  const contactKey2 = `${message.recipientId}-${message.senderId}`;

                  if (
                    !additionalContactMap.has(contactKey1) &&
                    !additionalContactMap.has(contactKey2)
                  ) {
                    additionalContactMap.set(contactKey1, message);
                  }
                });

                // Convert to array, sort, and take only what we need
                const additionalContacts = Array.from(
                  additionalContactMap.values(),
                )
                  .sort((a, b) => new Date(b.Timestamp) - new Date(a.Timestamp))
                  .slice(0, additionalNeeded);

                console.log(
                  `Found ${additionalContacts.length} additional contacts`,
                );

                if (additionalContacts.length > 0) {
                  // Collect additional user IDs
                  const additionalUserIds = new Set();
                  additionalContacts.forEach((message) => {
                    additionalUserIds.add(message.senderId);
                    additionalUserIds.add(message.recipientId);
                  });

                  // Fetch additional user details
                  const additionalUsers = await Newuser.find({
                    tenentId,
                    senderId: { $in: Array.from(additionalUserIds) },
                  });

                  // Add to existing map
                  additionalUsers.forEach((user) => {
                    userMap.set(user.senderId, user);
                  });

                  // Process additional contacts
                  const additionalProcessedContacts = additionalContacts
                    .map((message) => {
                      const userDetails =
                        userMap.get(message.senderId) ||
                        userMap.get(message.recipientId);

                      if (!userDetails) {
                        omittedContacts.push({
                          senderId: message.senderId,
                          recipientId: message.recipientId,
                          reason:
                            "No matching user details found in Newuser collection (additional fetch)",
                        });
                        return null;
                      }

                      return {
                        ...userDetails.toObject(),
                        lastMessage: {
                          message: message.message,
                          response: message.response,
                          Timestamp: message.Timestamp,
                          messageType: message.messageType,
                        },
                      };
                    })
                    .filter((contact) => contact !== null);

                  // Combine with original contacts
                  contactsWithDetails = [
                    ...contactsWithDetails,
                    ...additionalProcessedContacts,
                  ];
                  console.log(
                    `Final contacts count after refetch: ${contactsWithDetails.length}`,
                  );
                }
              }

              ws.send(
                JSON.stringify({
                  type: "contact_list",
                  contacts: contactsWithDetails,
                }),
              );
            } catch (error) {
              console.error("Error in get_contacts:", error);
              ws.send(
                JSON.stringify({
                  type: "error",
                  message: "Error fetching contacts",
                }),
              );
            }
            break;
          // Add this to your handlers object

          case "get_human_agent_contacts":
            try {
              const { tenentId, page = 1, limit = 6 } = data;

              if (!tenentId) {
                ws.send(
                  JSON.stringify({
                    type: "error",
                    message: "No tenant ID provided",
                  }),
                );
                return;
              }

              // Find contacts with human mode
              const humanAgentModes = await Mode.find({
                tenentId,
                mode: "human",
              }).sort({ updatedAt: -1 });
              console.log(
                "human agents",
                humanAgentModes.map((agent) => agent.senderId),
              );

              // Extract the unique senderIds
              const humanAgentSenderIds = [
                ...new Set(humanAgentModes.map((mode) => mode.senderId)),
              ];

              // If no human agents, return empty list
              if (humanAgentSenderIds.length === 0) {
                ws.send(
                  JSON.stringify({
                    type: "human_agent_contacts",
                    contacts: [],
                    hasMore: false,
                    totalCount: 0,
                  }),
                );
                return;
              }

              // Calculate pagination
              const skip = (page - 1) * limit;
              const paginatedSenderIds = humanAgentSenderIds.slice(
                skip,
                skip + limit,
              );

              // Check if there are more contacts
              let hasMore = humanAgentSenderIds.length > skip + limit;

              // Get the contacts with their latest messages
              const contactsWithLastMessages = await Message.aggregate([
                {
                  $match: {
                    tenentId,
                    $or: [
                      { senderId: { $in: paginatedSenderIds } },
                      { recipientId: { $in: paginatedSenderIds } },
                    ],
                  },
                },
                {
                  $sort: { Timestamp: -1 },
                },
                {
                  $group: {
                    _id: {
                      senderId: "$senderId",
                      recipientId: "$recipientId",
                    },
                    lastMessage: { $first: "$$ROOT" },
                  },
                },
                {
                  $sort: { "lastMessage.Timestamp": -1 },
                },
              ]);

              // Count total human agents with messages for pagination info
              const totalHumanAgentsWithMessages = await Message.aggregate([
                {
                  $match: {
                    tenentId,
                    $or: [
                      { senderId: { $in: humanAgentSenderIds } },
                      { recipientId: { $in: humanAgentSenderIds } },
                    ],
                  },
                },
                {
                  $group: {
                    _id: {
                      senderId: "$senderId",
                      recipientId: "$recipientId",
                    },
                  },
                },
              ]);

              // Extract unique user IDs
              const userIds = new Set();
              contactsWithLastMessages.forEach((item) => {
                userIds.add(item._id.senderId);
                userIds.add(item._id.recipientId);
              });

              // Fetch user details
              const users = await Newuser.find({
                tenentId,
                senderId: { $in: Array.from(userIds) },
              });

              // Create a map of user details
              const userMap = new Map(
                users.map((user) => [user.senderId, user]),
              );

              // Track omitted contacts for logging
              const omittedContacts = [];

              // Combine user details with chat mode and last messages
              let humanAgentContacts = contactsWithLastMessages
                .map((item) => {
                  const senderId = item._id.senderId;
                  const recipientId = item._id.recipientId;

                  // Find the sender ID that matches one of our human agent IDs
                  const agentId = humanAgentSenderIds.includes(senderId)
                    ? senderId
                    : humanAgentSenderIds.includes(recipientId)
                    ? recipientId
                    : null;

                  if (!agentId) {
                    omittedContacts.push({
                      senderId,
                      recipientId,
                      reason: "No matching agent ID found",
                    });
                    return null;
                  }

                  // Get the user details
                  const userDetails = userMap.get(agentId);
                  if (!userDetails) {
                    omittedContacts.push({
                      senderId,
                      recipientId,
                      reason: "No matching user details found",
                    });
                    return null;
                  }

                  return {
                    ...userDetails.toObject(),
                    chatMode: "human", // Explicitly set chatMode to human
                    lastMessage: {
                      message: item.lastMessage.message,
                      response: item.lastMessage.response,
                      Timestamp: item.lastMessage.Timestamp,
                      messageType: item.lastMessage.messageType,
                    },
                  };
                })
                .filter((contact) => contact !== null);

              console.log(
                "Total valid human agent contacts:",
                humanAgentContacts.length,
              );

              // If we have fewer contacts than requested, refetch more to fill the limit
              if (humanAgentContacts.length < limit && hasMore) {
                console.log(
                  `Only ${humanAgentContacts.length} valid contacts found, which is less than the limit of ${limit}.`,
                );
                console.log("Omitted contacts reasons:", omittedContacts);

                // Calculate how many more contacts we need
                const additionalNeeded = limit - humanAgentContacts.length;
                console.log(
                  `Fetching ${additionalNeeded} additional contacts...`,
                );

                // Calculate new skip value to get additional contacts
                const newSkip = skip + paginatedSenderIds.length;
                const additionalSenderIds = humanAgentSenderIds.slice(
                  newSkip,
                  newSkip + additionalNeeded,
                );

                if (additionalSenderIds.length > 0) {
                  // Get additional contacts with their messages
                  const additionalContacts = await Message.aggregate([
                    {
                      $match: {
                        tenentId,
                        $or: [
                          { senderId: { $in: additionalSenderIds } },
                          { recipientId: { $in: additionalSenderIds } },
                        ],
                      },
                    },
                    {
                      $sort: { Timestamp: -1 },
                    },
                    {
                      $group: {
                        _id: {
                          senderId: "$senderId",
                          recipientId: "$recipientId",
                        },
                        lastMessage: { $first: "$$ROOT" },
                      },
                    },
                    {
                      $sort: { "lastMessage.Timestamp": -1 },
                    },
                  ]);

                  console.log(
                    `Found ${additionalContacts.length} additional contacts`,
                  );

                  // Extract additional unique user IDs
                  const additionalUserIds = new Set();
                  additionalContacts.forEach((item) => {
                    additionalUserIds.add(item._id.senderId);
                    additionalUserIds.add(item._id.recipientId);
                  });

                  // Fetch additional user details
                  const additionalUsers = await Newuser.find({
                    tenentId,
                    senderId: { $in: Array.from(additionalUserIds) },
                  });

                  // Add to existing map
                  additionalUsers.forEach((user) => {
                    userMap.set(user.senderId, user);
                  });

                  // Process additional contacts
                  const additionalProcessedContacts = additionalContacts
                    .map((item) => {
                      const senderId = item._id.senderId;
                      const recipientId = item._id.recipientId;

                      // Find the sender ID that matches one of our human agent IDs
                      const agentId = humanAgentSenderIds.includes(senderId)
                        ? senderId
                        : humanAgentSenderIds.includes(recipientId)
                        ? recipientId
                        : null;

                      if (!agentId) return null;

                      // Get the user details
                      const userDetails = userMap.get(agentId);
                      if (!userDetails) return null;

                      return {
                        ...userDetails.toObject(),
                        chatMode: "human", // Explicitly set chatMode to human
                        lastMessage: {
                          message: item.lastMessage.message,
                          response: item.lastMessage.response,
                          Timestamp: item.lastMessage.Timestamp,
                          messageType: item.lastMessage.messageType,
                        },
                      };
                    })
                    .filter((contact) => contact !== null);

                  // Combine with original contacts
                  console.log(
                    "Before reassignment:",
                    humanAgentContacts.length,
                    additionalProcessedContacts.length,
                  );
                  humanAgentContacts = [
                    ...humanAgentContacts,
                    ...additionalProcessedContacts,
                  ];
                  console.log("After reassignment:", humanAgentContacts.length);
                  console.log(
                    `Final contacts count after refetch: ${humanAgentContacts.length}`,
                  );

                  // Update hasMore flag based on the new numbers
                  hasMore =
                    humanAgentSenderIds.length >
                    newSkip + additionalSenderIds.length;
                }
              }

              ws.send(
                JSON.stringify({
                  type: "human_agent_contacts",
                  contacts: humanAgentContacts,
                  totalCount: totalHumanAgentsWithMessages.length,
                  hasMore,
                }),
              );
            } catch (error) {
              console.error("Error fetching human agent contacts:", error);
              ws.send(
                JSON.stringify({
                  type: "error",
                  message: "Error fetching human agent contacts",
                }),
              );
            }
            break;

          case "message":
            tenentId = data.tenentId;
            senderId = data.senderId;
            const data2 = await LongToken.findOne({ tenentId: tenentId })
              .sort({ createdAt: -1 })
              .limit(1);

            console.log("data2:", data2);
            const recipientID = data2.Instagramid;
            const timestamp1 = data.timestamp;

            const message = data.message;
            const savedMessage = await sendInstagramMessage(
              recipientID,
              data2.userAccessToken,
              senderId,
              message,
              timestamp1,
              tenentId,
            );
            const messageemoji = " 🙎‍♂️:" + message;
            const messagedata = {
              recipientId: recipientID,

              senderId: senderId,

              response: messageemoji,
              Timestamp: timestamp1,
              tenentId: tenentId,
            };
            /*ws.send(JSON.stringify({
            type: 'new_message',
            tenentId: message.tenentId,
            message: messagedata
          }));*/
            break;
          case "fetch_contact_details":
            try {
              const message = data.message;
              const tenentId = data.tenentId;
              const senderId = data.senderId;
              console.log("tenentId for fetch_contact_details", tenentId);
              console.log("senderId for fetch_contact_details", senderId);
              // Fetch contact details from the Newuser model
              const contact = await Newuser.findOne({
                tenentId: tenentId,
                senderId: senderId,
              });

              if (contact) {
                console.log("contact found");
                ws.send(
                  JSON.stringify({
                    type: "contact_details",
                    contact: {
                      _id: contact._id,
                      username: contact.username,
                      senderId: contact.senderId,
                      name: contact.name,
                      profile_pic: contact.profile_pic,
                      chatMode: contact.chatMode,
                      createdAt: contact.createdAt,
                      lastMessage: message
                        ? {
                            message: message.message,
                            response: message.response,
                            Timestamp: message.Timestamp,
                          }
                        : null,
                    },
                  }),
                );
              } else {
                // If no contact found, send a basic response
                ws.send(
                  JSON.stringify({
                    type: "contact_details",
                    contact: {
                      senderId: data.senderId,
                      username: data.senderId,
                      name: data.senderId,
                      chatMode: "chat",
                    },
                  }),
                );
              }
            } catch (error) {
              console.error("Error fetching contact details:", error);
              ws.send(
                JSON.stringify({
                  type: "contact_details",
                  contact: null,
                }),
              );
            }
            break;

          case "search_contacts":
            try {
              const { tenentId, query } = data;

              if (!tenentId || !query) {
                ws.send(
                  JSON.stringify({
                    type: "error",
                    message: "Missing required parameters",
                  }),
                );
                return;
              }

              // Create case-insensitive search regex
              const searchRegex = new RegExp(query, "i");

              // Find users matching the search criteria
              const users = await Newuser.find({
                tenentId,
                $or: [{ name: searchRegex }, { username: searchRegex }],
              });

              // Get the latest messages for these users
              const userIds = users.map((user) => user.senderId);

              const lastMessages = await Message.aggregate([
                {
                  $match: {
                    tenentId,
                    $or: [
                      { senderId: { $in: userIds } },
                      { recipientId: { $in: userIds } },
                    ],
                  },
                },
                {
                  $sort: { Timestamp: -1 },
                },
                {
                  $group: {
                    _id: {
                      senderId: "$senderId",
                      recipientId: "$recipientId",
                    },
                    lastMessage: { $first: "$$ROOT" },
                  },
                },
              ]);

              // Create a map of user IDs to their last messages
              const messageMap = new Map();
              lastMessages.forEach((item) => {
                const userId = userIds.find(
                  (id) =>
                    id === item._id.senderId || id === item._id.recipientId,
                );
                if (userId) {
                  messageMap.set(userId, item.lastMessage);
                }
              });

              // Combine user details with their last messages
              const searchResults = users.map((user) => ({
                _id: user._id,
                username: user.username,
                senderId: user.senderId,
                createdAt: user.createdAt,
                name: user.name || "Nil",
                profile_pic: user.profile_pic,
                chatMode: user.chatMode || "chat",
                lastMessage: messageMap.has(user.senderId)
                  ? {
                      message: messageMap.get(user.senderId).message,
                      response: messageMap.get(user.senderId).response,
                      Timestamp: messageMap.get(user.senderId).Timestamp,
                      messageType: messageMap.get(user.senderId).messageType,
                    }
                  : null,
              }));

              // Send search results back to client
              ws.send(
                JSON.stringify({
                  type: "search_results",
                  contacts: searchResults,
                }),
              );
            } catch (error) {
              console.error("Error in search_contacts:", error);
              ws.send(
                JSON.stringify({
                  type: "error",
                  message: "Error searching contacts",
                }),
              );
            }
            break;
          case "update_chat_mode":
            await handlers.handleChatMode(ws, data);
            break;

          case "get_chat_mode":
            await handlers.handleGetChatMode(ws, data);
            break;

          case "get_notifications":
            await notifhandlers.getNotifications(ws, data);
            break;

          case "mark_notification_read":
            await notifhandlers.markAsRead(ws, data);
            break;
          case "main_chat_mode_update":
            await mainchathandlers.handleMainMode(ws, data);
            break;
          case "get_comment_contacts": {
            const { tenentId } = data;

            const contacts = await CommentNewuser.find({ tenentId }).sort({
              createdAt: -1,
            });

            ws.send(
              JSON.stringify({
                type: "comment_contacts",
                contacts,
              }),
            );
            break;
          }

          case "get_comment_messages": {
            const { tenentId, senderId } = data;

            const comments = await Comment.find({ tenentId, senderId }).sort({
              Timestamp: 1,
            });

            ws.send(
              JSON.stringify({
                type: "comment_messages",
                messages: comments,
              }),
            );
            break;
          }
        }
      } catch (error) {
        console.error("WebSocket error:", error);
      }
    });
    const initializeChangeStream = (model, eventHandler) => {
      const stream = model.watch({
        fullDocument: "updateLookup",
      });

      stream.on("change", eventHandler);

      stream.on("error", (error) => {
        console.error("ChangeStream error:", error);
        // Close the current stream
        stream.close();
        // Reinitialize after a delay
        setTimeout(() => initializeChangeStream(model, eventHandler), 5000);
      });

      return stream;
    };
    // Handle new contact creation
    /*const contactStream = initializeChangeStream(Newuser, async (change) => {
      if (change.operationType === 'insert') {
        const newContact = change.fullDocument;

        // Get the last message for this contact
        const lastMessage = await Message.findOne({
          tenentId: newContact.tenentId,
          $or: [
            { senderId: newContact.senderId },
            { recipientId: newContact.senderId }
          ]
        }).sort({ Timestamp: -1 }).limit(1);

        // Format the contact with last message
        const contactWithMessage = {
          _id: newContact._id,
          username: newContact.username,
          senderId: newContact.senderId,
          createdAt: newContact.createdAt,
          name: newContact.name || "Nil",
          profile_pic: newContact.profile_pic,
          chatMode: newContact.chatMode || 'chat',
          tenentId: newContact.tenentId,
          lastMessage: lastMessage ? {
            message: lastMessage.message,
            response: lastMessage.response,
            Timestamp: lastMessage.Timestamp
          } : null
        };

        ws.send(
          JSON.stringify({
            tenantId: newContact.tenantId,
            type: 'new_contact',
            contact: contactWithMessage
          })
        );
        console.log(`Sent new user update for tenant`);
      }
    });
    streams.push(contactStream);*/

    // Message Change Stream
    /*const messageStream = initializeChangeStream(Message, async (change) => {
      if (change.operationType === 'insert') {
        const newMessage = change.fullDocument;
        if (newMessage.tenentId === tenentId && !processedMessagesapp.has(newMessage._id)) {
          processedMessagesapp.add(newMessage._id);
          setTimeout(() => {
            processedMessagesapp.delete(newMessage._id.toString());
          }, 60000); // Clean up after 1 minute
          ws.send(
            JSON.stringify({
              tenantId: newMessage.tenantId,
              type: 'new_message',
              message: newMessage
            })
          );
          console.log(`Sent new message update for tenant`);
          console.log("Sent new message update for tenant:",newMessage.tenantId);
        }
      }
    });
    streams.push(messageStream);*/

    // Mode Change Stream
    /* const modeStream = initializeChangeStream(Mode, async (change) => {
      if (change.operationType === 'update' || change.operationType === 'insert') {
        const updatedMode = change.fullDocument || (await Mode.findOne({ _id: change.documentKey._id }));

        if (updatedMode && updatedMode.tenentId && updatedMode.senderId) {
          // Add a unique ID to the message
          const messageId = `mode_${updatedMode._id}_${Date.now()}`;
          ws.send(
            JSON.stringify({
              tenantId: updatedMode.tenantId,
              type: 'chat_mode_update',
              id: messageId, // Add message ID
              status: 'success',
              data: {
                senderId: updatedMode.senderId,
                mode: updatedMode.mode,
              },
            })
          );
          console.log(`Sent chat mode update for tenant`);

          //console.log(`Broadcasted mode update for tenant`);
        }
      }
    });
    streams.push(modeStream);*/
    /*
   const notificationStream = initializeChangeStream(Notification, async (change) => {
      if (change.operationType === 'insert' || change.operationType === 'update') {
        const notification = change.fullDocument;

        // Broadcast to relevant clients
        ws.send(
          JSON.stringify({
            tenantId: notification.tenantId,
            type: 'notification_update',
            status: 'success',
            data: notification
          })
        );
        console.log(`Sent notification update`);

      }
    });
    streams.push(notificationStream);*/

    ws.on("close", () => {
      // Clear all streams
      if (tenentId && senderId) {
        clients.delete(`${tenentId}-${senderId}`);
        streams.forEach((stream) => {
          if (stream) {
            stream.close().catch(console.error);
          }
        });
      }

      // Clear all handlers
      messageHandlers = [];
      connectHandlers = [];

      // Clear sets used for tracking
      processedMessagesapp.clear();
      broadcastedModeUpdates.clear();
    });
  });

  return wss;
};

module.exports = {
  router,
  initializeWebSocket,
  clients,
};
