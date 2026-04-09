const WebSocket = require('ws');
const Message   = require('../models/Message');
const { clients } = require('../routes/messageRoutes');
const rateLimiter = require('../services/rateLimitService');
const processedMessagesapp = new Set();

async function sendNewContact(newUser, tenentId, senderID) {
  try {
    // Get the last message for this user
    const lastMessage = await Message.findOne({
      tenentId: tenentId,
      $or: [{ senderId: senderID }, { recipientId: senderID }]
    }).sort({ Timestamp: -1 }).limit(1);

    // Format contact data with last message
    const contactWithMessage = {
      //_id: newUser._id,
      username: newUser.username,
      senderId: newUser.senderId,
      createdAt: newUser.createdAt,


      name: newUser.name || "Nil",
      profile_pic: newUser.profile_pic,
      chatMode: newUser.chatMode || 'chat',
      tenentId: newUser.tenentId,
      lastMessage: lastMessage ? {
        message: lastMessage.message,
        response: lastMessage.response,
        Timestamp: lastMessage.Timestamp
      } : null
    };

    console.log(`Connected WebSocket Clients: ${clients.size}`);

    // Send to all connected clients for this tenant
    let sent = false; // Track if message was actually sent
    clients.forEach((ws, clientId) => {
      console.log(`Checking client ${clientId}...`);

      if (clientId.startsWith(tenentId) && ws.readyState === WebSocket.OPEN) {
        console.log(`Sending 'new_contact' WebSocket message to client ${clientId}`);

        ws.send(JSON.stringify({
          type: 'new_contact',
          contact: contactWithMessage
        }), (err) => {
          if (err) {
            console.error(`Error sending message to client ${clientId}:`, err);
          } else {
            console.log(`Message successfully sent to client ${clientId}`);
            sent = true;
          }
        });
      } else {
        console.log(`Skipping client ${clientId}: WebSocket not open or doesn't match tenant.`);
      }
    });

    if (!sent) {
      console.warn(`No clients received 'new_contact' WebSocket message. Clients may not be connected.`);
    }

  } catch (error) {
    console.error('Error sending new contact notification:', error);
  }
}
async function sendNewMessage(message, tenentId,type) {
  try {
    // Format message data
    const messageData = {
      //_id: message._id,
      senderId: message.senderId,
      recipientId: message.recipientId,
      //messageType: message.messageType || "text", // Default to text if undefined
      carouselData: message.carouselData || null,
      message: message.message || "",
      audioUrl: message.audioUrl || null,
      transcription: message.transcription || null,
      response: message.response || "",
      messageid: message.messageid || null,
      Timestamp: message.Timestamp,
      tenentId: message.tenentId,
      messageType: type || "text"

    };
    console.log("Formatted message data for WebSocket:", messageData);
    // Check if all required fields for a carousel are present
    if (type === "carousel" && (!messageData.carouselData || !messageData.carouselData.products)) {
      console.error("Missing carousel data in message:", messageData);
    }
    console.log(`Connected WebSocket Clients: ${clients.size}`);

    // Send to all connected clients for this tenant
    let sent = false; // Track if message was actually sent
    clients.forEach((ws, clientId) => {
      console.log(`Checking client ${clientId}...`);

      if (clientId.startsWith(tenentId) && ws.readyState === WebSocket.OPEN) {
        console.log(`Sending 'new_message' WebSocket message to client ${clientId}`);

        ws.send(JSON.stringify({
          type: 'new_message',
          tenentId: message.tenentId,
          message: messageData
        }), (err) => {
          if (err) {
            console.error(`Error sending message to client ${clientId}:`, err);
          } else {
            console.log(`Message successfully sent to client ${clientId}`);
            sent = true;
          }
        });
      } else {
        console.log(`Skipping client ${clientId}: WebSocket not open or doesn't match tenant.`);
      }
    });

    if (!sent) {
      console.warn(`No clients received 'new_message' WebSocket message. Clients may not be connected.`);
    }

    // Set up message processing tracking
    if (!processedMessagesapp.has(message._id)) {
      processedMessagesapp.add(message._id);
      setTimeout(() => {
        processedMessagesapp.delete(message._id);
      }, 60000); // Clean up after 1 minute
    }

  } catch (error) {
    console.error('Error sending new message notification:', error);
  }
}

async function sendChatModeUpdate(updatedMode) {
  try {
    const messageId = `mode_${updatedMode._id}_${Date.now()}`;
    console.log("messageId for sendChatModeUpdate",sendChatModeUpdate);
    // Format mode update data
    const updateData = {
      tenentId: updatedMode.tenentId,
      type: 'chat_mode_update',
      id: messageId,
      status: 'success',
      data: {
        senderId: updatedMode.senderId,
        mode: updatedMode.mode,
      }
    };

    console.log(`Connected WebSocket Clients: ${clients.size}`);
    console.log("updateData",updateData);
    // Send to all connected clients for this tenant
    let sent = false;
    clients.forEach((ws, clientId) => {
      console.log(`Checking client ${clientId}...`);

      if (clientId.startsWith(updatedMode.tenentId) && ws.readyState === WebSocket.OPEN) {
        console.log(`Sending 'chat_mode_update' WebSocket message to client ${clientId}`);

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
      , (err) => {
          if (err) {
            console.error(`Error sending mode update to client ${clientId}:`, err);
          } else {
            console.log(`Mode update successfully sent to client ${clientId}`);
            sent = true;
          }
        });
      } else {
        console.log(`Skipping client ${clientId}: WebSocket not open or doesn't match tenant.`);
      }
    });

    if (!sent) {
      console.warn(`No clients received 'chat_mode_update' WebSocket message. Clients may not be connected.`);
    }

    //console.log(`Sent chat mode update for tenant ${updatedMode.tenentId}`);
    const sent1 = true;
    return sent1;

  } catch (error) {
    console.error('Error sending chat mode update:', error);
  }
}
async function sendNotificationUpdate(notification) {
  try {
    //const notification = `mode_${updatedMode._id}_${Date.now()}`;
    // Format notification data
    const notificationData = {
      ID: notification.ID,
      senderId: notification.senderId,
      message: notification.message,
      createdAt: notification.createdAt,
      Timestamp: new Date().toISOString(),
      tenentId: notification.tenentId,
      isRead: notification.isRead || false,
      // Add any other notification fields you need
    };

    console.log(`Connected WebSocket Clients: ${clients.size}`);

    // Send to all connected clients for this tenant
    let sent = false;
    clients.forEach((ws, clientId) => {
      console.log(`Checking client ${clientId}...`);

      if (clientId.startsWith(notification.tenentId) && ws.readyState === WebSocket.OPEN) {
        console.log(`Sending 'notification_update' WebSocket message to client ${clientId}`);

        ws.send(JSON.stringify({
          type: 'notification_update',
          tenentId: notification.tenentId,
          status: 'success',
          data: notificationData
        }), (err) => {
          if (err) {
            console.error(`Error sending notification to client ${clientId}:`, err);
          } else {
            console.log(`Notification successfully sent to client ${clientId}`);
            sent = true;
          }
        });
      } else {
        console.log(`Skipping client ${clientId}: WebSocket not open or doesn't match tenant.`);
      }
    });

    if (!sent) {
      console.warn(`No clients received 'notification_update' WebSocket message. Clients may not be connected.`);
    }

  } catch (error) {
    console.error('Error sending notification update:', error);
  }
}

module.exports = {
  sendNewContact,
  sendNewMessage,
  sendChatModeUpdate,
  sendNotificationUpdate
};

