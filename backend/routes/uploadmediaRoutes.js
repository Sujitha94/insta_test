const express = require('express');
const multer = require('multer');
const ImageKit = require('imagekit');
const dotenv = require('dotenv');
const axios = require('axios');
const LongToken = require('../models/LongToken');
dotenv.config();

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

let imagekit = null;
if (process.env.IMAGEKIT_PUBLIC_KEY && process.env.IMAGEKIT_PRIVATE_KEY && process.env.IMAGEKIT_URL_ENDPOINT) {
    imagekit = new ImageKit({
        publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
        privateKey: process.env.IMAGEKIT_PRIVATE_KEY, // Never expose this on frontend
        urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT
    });
} else {
    console.warn("WARNING: ImageKit configuration is missing. Media upload functionality will be disabled.");
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
// Upload Image
router.post('/uploadmedia/image', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }
        const senderId = req.body.senderId;  // Change from req.senderId
        const tenentId = req.body.tenentId;
        console.log("senderId for uploadmedia",senderId,tenentId);
        let userAccessToken;
        let igId;
        const response = await imagekit.upload({
            file: req.file.buffer.toString('base64'),
            fileName: req.file.originalname,
            folder: `/uploads/${tenentId}/images`
        });
         const imageUrl=response.url;
         const latestToken = await LongToken.findOne({tenentId:tenentId}).sort({ createdAt: -1 }).limit(1);
            if (latestToken) {
                console.log('Latest token retrieved for Profile_infoemation:', latestToken);
                userAccessToken = latestToken.userAccessToken;
                igId= latestToken.Instagramid;
            } 
        
         await sendInstagramImageMessage(igId, userAccessToken, senderId, imageUrl)
         try {
          const savedImage = {
              senderId: senderId,
              recipientId: igId,
              
              response: imageUrl,
              
              tenentId
          };
      
          console.log("Image message saved:", savedImage);
      
          const type = "image";
          await sendNewMessage(savedImage, tenentId, type);
      
      } catch (error) {
          console.error("Error occurred while saving and sending image message:", error);
          // You can also handle the error further if needed, e.g., logging it to a monitoring system
      }
      
        res.json({ imageUrl: response.url });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Upload Video
router.post('/uploadmedia/video', upload.single('video'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const senderId = req.body.senderId;  // Change from req.senderId
        const tenentId = req.body.tenentId;
        console.log("senderId for uploadmedia",senderId,tenentId);
        let userAccessToken;
        let igId;
        
        const response = await imagekit.upload({
            file: req.file.buffer.toString('base64'),
            fileName: req.file.originalname,
            folder: `/uploads/${tenentId}/video`
        });
        const videoUrl=response.url;
        const latestToken = await LongToken.findOne({tenentId:tenentId}).sort({ createdAt: -1 }).limit(1);
            if (latestToken) {
                console.log('Latest token retrieved for Profile_infoemation:', latestToken);
                userAccessToken = latestToken.userAccessToken;
                igId= latestToken.Instagramid;
            } 
        
         await sendInstagramVideoMessage(igId, userAccessToken, senderId, videoUrl)
        res.json({ videoUrl: response.url });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/uploadmedia/audio', upload.single('audio'), async (req, res) => {
  try {
      if (!req.file) {
          return res.status(400).json({ error: 'No file uploaded' });
      }

      const senderId = req.body.senderId;
      const tenentId = req.body.tenentId;
      const transcription = req.body.transcription || '';
      console.log("senderId for uploadmedia/audio", senderId, tenentId);
      
      let userAccessToken;
      let igId;
      
      const response = await imagekit.upload({
          file: req.file.buffer.toString('base64'),
          fileName: req.file.originalname,
          folder: `/uploads/${tenentId}/audio`
      });
      
      const audioUrl = response.url;
      const latestToken = await LongToken.findOne({tenentId: tenentId}).sort({ createdAt: -1 }).limit(1);
      
      if (latestToken) {
          console.log('Latest token retrieved for audio upload:', latestToken);
          userAccessToken = latestToken.userAccessToken;
          igId = latestToken.Instagramid;
      } 
      
      // Send as a file attachment since Instagram doesn't have a dedicated audio type
      await sendInstagramAudioMessage(igId, userAccessToken, senderId, audioUrl, transcription);
      
      res.json({ 
          audioUrl: response.url,
          transcription: transcription 
      });
  } catch (error) {
      console.error('Error uploading audio:', error);
      res.status(500).json({ error: error.message });
  }
});

// Add this function to send audio messages
async function sendInstagramAudioMessage(igId, userAccessToken, recipientId, audioUrl, ) {
  const url = `https://graph.instagram.com/v22.0/${igId}/messages`; 
    const data = {
      recipient: { id: recipientId },
      message: {
        attachment: {
          type: "audio",
          payload: {
            url: audioUrl,
            is_reusable: true 
          }
        }
      }
    };
  
    try {
      // Add retry logic
      let retries = 3;
      let delay = 1000; // Start with 1 second delay
  
      while (retries > 0) {
        try {
          const response = await axios.post(url, data, {
            headers: {
              'Authorization': `Bearer ${userAccessToken}`,
              'Content-Type': 'application/json'
            }
          });
          console.log('audio message sent successfully', response.data);
          return response.data;
        } catch (error) {
          retries--;
          if (retries === 0) throw error;
          await new Promise(resolve => setTimeout(resolve, delay));
          delay *= 2; // Exponential backoff
        }
      }
    } catch (error) {
      console.error('Error sending audio message:', error.response?.data || error);
      throw error;
    }
}


async function sendInstagramImageMessage(igId, userAccessToken, recipientId, imageUrl) {
    const url = `https://graph.instagram.com/v22.0/${igId}/messages`; 
    const data = {
      recipient: { id: recipientId },
      message: {
        attachment: {
          type: "image",
          payload: {
            url: imageUrl
          }
        }
      }
    };
  
    try {
      // Add retry logic
      let retries = 3;
      let delay = 1000; // Start with 1 second delay
  
      while (retries > 0) {
        try {
          const response = await axios.post(url, data, {
            headers: {
              'Authorization': `Bearer ${userAccessToken}`,
              'Content-Type': 'application/json'
            }
          });
          console.log('Image message sent successfully', response.data);
          return response.data;
        } catch (error) {
          retries--;
          if (retries === 0) throw error;
          await new Promise(resolve => setTimeout(resolve, delay));
          delay *= 2; // Exponential backoff
        }
      }
    } catch (error) {
      console.error('Error sending image message:', error.response?.data || error);
      throw error;
    }
  }
  async function sendInstagramVideoMessage(igId, userAccessToken, recipientId, videoUrl) {
    const url = `https://graph.instagram.com/v22.0/${igId}/messages`; 
    const data = {
      recipient: { id: recipientId },
      message: {
        attachment: {
          type: "video",
          payload: {
            url: videoUrl
          }
        }
      }
    };
  
    try {
      // Add retry logic
      let retries = 3;
      let delay = 1000; // Start with 1 second delay
  
      while (retries > 0) {
        try {
          const response = await axios.post(url, data, {
            headers: {
              'Authorization': `Bearer ${userAccessToken}`,
              'Content-Type': 'application/json'
            }
          });
          console.log('Video message sent successfully', response.data);
          return response.data;
        } catch (error) {
          retries--;
          if (retries === 0) throw error;
          await new Promise(resolve => setTimeout(resolve, delay));
          delay *= 2; // Exponential backoff
        }
      }
    } catch (error) {
      console.error('Error sending video message:', error.response?.data || error);
      throw error;
    }
}
module.exports = router;
