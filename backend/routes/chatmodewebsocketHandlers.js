require("dotenv").config();


const Mode= require('../models/Mode');

const path = require('path');
const axios = require('axios');
const express = require('express');
const { json } = express;
const router = express.Router();
const WebSocket = require('ws');
const multer = require('multer');
const cors = require('cors');
router.use(cors({
  origin: '*' // Replace with your client URL
}));
const OpenAI = require('openai');
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const clients = new Map();
let openai = null;
if (OPENAI_API_KEY) {
  openai = new OpenAI({
    apiKey: OPENAI_API_KEY // This is the default and can be omitted
  });
} else {
  console.warn("WARNING: OPENAI_API_KEY is missing in chatmodewebsocketHandlers. OpenAI functionality will be disabled.");
}

// Broadcast message to all clients with matching tenantId
const broadcast = (tenantId, message) => {
  clients.forEach((ws, clientId) => {
    if (clientId.startsWith(tenantId) && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  });
};

const handlers = {
  async handleChatMode(ws, data) {
    const { senderId, tenentId, chatMode } = data;
    
    // Input validation
    if (!senderId || !tenentId) {
      ws.send(JSON.stringify({
        type: 'chat_mode_update',
        status: 'error',
        message: 'Missing required fields: senderId or tenentId'
      }));
      return;
    }

    // Validate chat mode
    const validMode = chatMode && ['chat', 'human'].includes(chatMode) ? chatMode : 'chat';

    try {
      // Find existing mode or create new one
      const existingMode = await Mode.findOne({ 
        senderId,
        tenentId 
      }).sort({ createdAt: -1 }).limit(1);

      let updatedContact;
      
      if (existingMode) {
        updatedContact = await Mode.findOneAndUpdate(
          { senderId, tenentId },
          { $set: { mode: validMode }},
          { new: true }
        );
      } else {
        const newContact = new Mode({
          senderId,
          tenentId,
          mode: validMode
        });
        updatedContact = await newContact.save();
      }

      if (!updatedContact) {
        throw new Error('Failed to update mode');
      }

      const response = {
        type: 'chat_mode_update',
        status: 'success',
        data: {
          senderId,
          mode: validMode,
        },
      };

      // Send response to requesting client
      ws.send(JSON.stringify(response));
      
      // Broadcast to all clients with same tenentId
      //broadcast(tenentId, response);

    } catch (error) {
      console.error('Error updating chat mode:', error);
      ws.send(JSON.stringify({
        type: 'chat_mode_update',
        status: 'error',
        message: error.message || 'Server error'
      }));
    }
  },

  async handleGetChatMode(ws, data) {
    const { senderId, tenentId } = data;

    // Input validation
    if (!senderId || !tenentId) {
      ws.send(JSON.stringify({
        type: 'chat_mode',
        status: 'error',
        message: 'Missing required fields: senderId or tenentId'
      }));
      return;
    }

    try {
      const latestMode = await Mode.findOne({
        senderId,
        tenentId
      }).sort({ createdAt: -1 }).limit(1);

      const response = {
        type: 'chat_mode',
        status: 'success',
        data: {
          mode: latestMode?.mode || 'chat', // Default to 'chat' if no mode found
          senderId
        }
      };

      ws.send(JSON.stringify(response));

    } catch (error) {
      console.error('Error getting chat mode:', error);
      ws.send(JSON.stringify({
        type: 'chat_mode',
        status: 'error',
        message: error.message || 'Server error'
      }));
    }
  }
};

module.exports = handlers;