const axios     = require('axios');
const LongToken = require('../models/LongToken');
const rateLimiter = require('../services/rateLimitService');

async function sendInstagramMessage(igId, userAccessToken, recipientId, messageText1) {
  console.log("messageText1",messageText1);
    const accountData = await LongToken.findOne({ Instagramid: igId }).sort({ createdAt: -1 }).limit(1);
    const tenentId = accountData?.tenentId;
     console.log("userAccessToken for sendInstagramMessage",userAccessToken);
    if (tenentId) {
      // Record recipient as engaged user for rate limit calculation
      rateLimiter.recordEngagedUser(tenentId, igId, recipientId);

      // Check if we can send the message now (text message Send API rate limits)
      if (!rateLimiter.canMakeSendApiTextCall(tenentId, igId, recipientId)) {
        console.log(`Rate limit exceeded for Send API (Text) for tenant ${tenentId}, delaying message`);

        // Simple delay before retrying
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Retry once after delay
        if (!rateLimiter.canMakeSendApiTextCall(tenentId, igId, recipientId)) {
          console.error('Rate limit still exceeded after retry. Aborting message send.');
          return; // Optionally throw or handle as per your logic
        }
      }
    }
  const url = `https://graph.instagram.com/v23.0/${igId}/messages`;
  const messageTextWithEmoji = " 🤖:" + messageText1;
  const data = {
    recipient: { id: recipientId },
    message: { text: messageTextWithEmoji }
  };

  try {
    // Add retry logic with exponential backoff
    let retries = 3;
    let delay = 1000; // Start with 1 second delay

    while (retries > 0) {
      try {
        const response = await axios.post(url, data, {
          headers: {
            'Authorization': `Bearer ${userAccessToken}`,
            'Content-Type': 'application/json'
          },
          timeout: 10000 // 10 second timeout
        });

        console.log('Message sent successfully');
        return messageTextWithEmoji;
      } catch (error) {
        retries--;

        // Handle rate limiting specifically
        if (error.response && error.response.status === 429) {
          console.log('Instagram API rate limit reached, backing off...');

          // Extract retry-after header if present
          const retryAfter = error.response.headers['retry-after'] || 60;
          const retryMs = parseInt(retryAfter) * 1000;

          // Wait the suggested time plus a little extra
          await new Promise(resolve => setTimeout(resolve, retryMs + 1000));
        } else if (retries === 0) {
          throw error;
        } else {
          // Exponential backoff for other errors
          await new Promise(resolve => setTimeout(resolve, delay));
          delay *= 2; // Double the delay for next retry
        }
      }
    }
  } catch (error) {
    console.error('Error sending message:', error.response?.data || error);

    // Return a default message on failure
    return messageTextWithEmoji;
  }
  }

   async function sendInstagramCarousel(senderID, recipientId, tenentId, userAccessToken, elements) {
      try {
        const url = `https://graph.instagram.com/v23.0/${recipientId}/messages`;
  
        const data = {
          recipient: { id: senderID },
          message: {
            attachment: {
              type: "template",
              payload: {
                template_type: "generic",
                elements: elements
              }
            }
          }
        };
  
        console.log("Sending product carousel:", JSON.stringify(data, null, 2));
  
        // Check rate limit for sending a text message (Send API - Text) - templates count as text
        if (!rateLimiter.canMakeSendApiTextCall(tenentId, recipientId, senderID)) {
          console.log(`Rate limit exceeded for Send API (Text) for tenant ${tenentId}, delaying carousel`);
  
          // Wait for a bit and then check again
          await new Promise(resolve => setTimeout(resolve, 3000));
  
          if (!rateLimiter.canMakeSendApiTextCall(tenentId, recipientId, senderID)) {
            throw new Error("Rate limit still exceeded after waiting");
          }
        }
  
        const response = await axios.post(url, data, {
          headers: {
            'Authorization': `Bearer ${userAccessToken}`,
            'Content-Type': 'application/json'
          },
          timeout: 15000
        });
  
        console.log("Carousel sent successfully:", response.data);
  
        // Prepare message data with carousel details
        const messageData = {
          senderId: senderID,
          recipientId: recipientId,
          messageType: 'carousel',
          message: '',
          response: "Carousel Message",
          carouselData: {
            totalProducts: elements.length,
            products: elements.map(element => ({
              title: element.title,
              subtitle: element.subtitle,
              imageUrl: element.image_url,
              buttons: element.buttons
            }))
          },
          Timestamp: Date.now(),
          tenentId: tenentId,
          messageid: response.data.message_id
        };
      await Message.createCarouselMessage(messageData);
       await sendNewMessage(messageData, tenentId, "carousel");
        return response.data;
      } catch (error) {
        console.error("Error sending product carousel:", error.response ? error.response.data : error);
        throw error;
      }
      }

      async function sendInstagramProductTemplateMessage(igId, userAccessToken, recipientId, tenentId, firstresponse) {
            try {
              console.log('Starting template send process...');
      
              // Check rate limit for sending a template message (Send API - Text)
              if (!rateLimiter.canMakeSendApiTextCall(tenentId, igId, recipientId)) {
                console.log(`Rate limit exceeded for Send API (Text) for tenant ${tenentId}, delaying template message`);
      
                // Wait for a bit and then check again
                await new Promise(resolve => setTimeout(resolve, 3000));
      
                if (!rateLimiter.canMakeSendApiTextCall(tenentId, igId, recipientId)) {
                  throw new Error("Rate limit still exceeded after waiting");
                }
              }
      
              const url = `https://graph.instagram.com/v23.0/${igId}/messages`;
              const data = {
                recipient: { id: recipientId },
                message: firstresponse
              };
      
              const response = await axios.post(url, data, {
                headers: {
                  'Authorization': `Bearer ${userAccessToken}`,
                  'Content-Type': 'application/json'
                },
                timeout: 15000
              });
      
              console.log('Template message sent successfully:', response.data);
              return response.data;
            } catch (error) {
              console.error('Error sending template message:', error.response?.data || error);
              throw error;
            }
            }

              async function sendInstagramCommentTemplateMessage(
              igProAccountId,
              userAccessToken,
              commentId,
              recipientId,
              tenentId,
              templateMessage
            ) {
              try {
                console.log('Starting comment template reply process...');
            
                // Validate required parameters
                if (!igProAccountId || !userAccessToken || !commentId || !templateMessage) {
                  throw new Error('Missing required parameters for comment template reply');
                }
            
                // Check rate limit for Private Replies API
                if (!rateLimiter.canMakePrivateRepliesPostCall(tenentId, igProAccountId)) {
                  console.log(
                    `Rate limit exceeded for Private Replies API for tenant ${tenentId}, delaying template message`
                  );
            
                  // Wait and retry once
                  await new Promise(resolve => setTimeout(resolve, 3000));
            
                  if (!rateLimiter.canMakePrivateRepliesPostCall(tenentId, igProAccountId)) {
                    throw new Error('Rate limit still exceeded after waiting');
                  }
                }
            
                // Using the Private Replies endpoint for comments
                const url = `https://graph.instagram.com/v21.0/${igProAccountId}/messages`;
            
                // ✅ Convert button template to generic template format (NO SUBTITLE)
                const genericTemplateMessage = {
                  attachment: {
                    type: "template",
                    payload: {
                      template_type: "generic",
                      elements: [{
                        title: templateMessage.attachment?.payload?.text || "Follow Required",
                        // ✅ NO subtitle field
                        buttons: templateMessage.attachment?.payload?.buttons?.map(button => ({
                          type: button.type === "web_url" ? "web_url" : "postback",
                          title: button.title,
                          url: button.url || undefined,
                          payload: button.payload || "FOLLOW_STATUS"
                        })) || [{
                          type: "postback",
                          title: "Check Follow Status",
                          payload: "FOLLOW_STATUS"
                        }]
                      }]
                    }
                  }
                };
            
                // Request payload with recipient comment_id
                const data = {
                  recipient: {
                    comment_id: commentId
                  },
                  message: genericTemplateMessage
                };
            
                console.log('Sending generic template reply to comment:', JSON.stringify(data, null, 2));
            
                const response = await axios.post(url, data, {
                  headers: {
                    'Authorization': `Bearer ${userAccessToken}`,
                    'Content-Type': 'application/json'
                  },
                  timeout: 15000
                });
            
                console.log('✅ Comment template reply sent successfully:', response.data);
                return response.data;
            
              } catch (error) {
                console.error(
                  '❌ Error sending comment template reply:',
                  error.response?.data || error.message
                );
            
                // Log additional error details for debugging
                if (error.response) {
                  console.error('Status:', error.response.status);
                  console.error('Headers:', error.response.headers);
                  console.error('Data:', JSON.stringify(error.response.data, null, 2));
                }
            
                throw error;
              }
            }
                  async function sendInstagramTemplateMessage(igId, userAccessToken, recipientId, tenentId) {
                    console.log("RECIPIENTID FOR TEMPLATE", igId);
                    console.log("SENDERID FOR TEMPLATE", recipientId);
                    console.log("ACCESSTOKEN FOR TEMPLATE", userAccessToken);
            
                    try {
                      console.log('Starting template send process...');
            
                      // Check rate limit for sending a template message (Send API - Text)
                      if (!rateLimiter.canMakeSendApiTextCall(tenentId, igId, recipientId)) {
                        console.log(`Rate limit exceeded for Send API (Text) for tenant ${tenentId}, delaying welcome template`);
            
                        // Wait and retry once
                        await new Promise(resolve => setTimeout(resolve, 3000));
            
                        if (!rateLimiter.canMakeSendApiTextCall(tenentId, igId, recipientId)) {
                          throw new Error("Rate limit still exceeded after waiting");
                        }
                      }
            
                      // Add a small delay to prevent rate limiting
                      await new Promise(resolve => setTimeout(resolve, 1000));
            
                      // Get welcome message for fallback
                      const welcomePageConfig = await WelcomePage.findOne({ tenentId: tenentId })
                            .sort({ createdAt: -1 })
                            .limit(1);
            
                      // Create the template response using the same logic as createWelcomeMessageResponse
                      const templateResponse = await createWelcomeMessageResponse(tenentId, welcomePageConfig);
            
                      const url = `https://graph.instagram.com/v23.0/${igId}/messages`;
            
                      const data = {
                        recipient: { id: recipientId },
                        message: templateResponse
                      };
            
                      const response = await axios.post(url, data, {
                        headers: {
                          'Authorization': `Bearer ${userAccessToken}`,
                          'Content-Type': 'application/json'
                        },
                        timeout: 15000
                      });
            
                      console.log('Template message sent successfully:', response.data);
                      return response.data;
                    } catch (error) {
                      console.error('Error sending template message:', error.response?.data || error);
                      throw error;
                    }
                  }
            
            async function sendInstagramProduct_type_quick_reply(igId, userAccessToken, recipientId, tenentId,timestamp) {
              try {
                console.log('Fetching product types for tenant:', tenentId);
                const signupdata=await Signup.findOne({tenentId:tenentId}).sort({ createdAt: -1 }).limit(1);
                  if(signupdata){
                    const username=signupdata.name;
                    if(username=="Techvaseegrah"){
                      const products = await ProductList.find({
                        tenentId,
            
                      });
                    console.log("product type in list",products);
                      // Send products as quick replies
                      const quickReplies = products.map(product => ({
                        content_type: "text",
                        title: product.productName,
                        payload: `PRODUCT_${product._id}`
                      }));
                      let quicktext="Please select a product or services:";
            
                      const response=await sendInstagramQuickReplyMessage(
                        igId,
                        userAccessToken,
                        recipientId,
                        quicktext,
                        quickReplies,
                        tenentId,
            
                        timestamp
                      );
                      if(response){
            
                          console.error('Quick reply send successfully');
            
                    }
            
                return;
            
                    }}
                // Using find() to get all product type documents
                const productTypeDocs = await ProductType.find({ tenentId });
                console.log('Found product or services type documents:', productTypeDocs);
            
                // Check if any documents exist
                if (!productTypeDocs || productTypeDocs.length === 0) {
                  console.error('No product types documents found for tenant:', tenentId);
                  throw new Error('No product types found');
                }
            
                // Collect all product types from all documents
                let allProductTypes = [];
                productTypeDocs.forEach(doc => {
                  if (doc.productTypes && Array.isArray(doc.productTypes)) {
                    allProductTypes = allProductTypes.concat(doc.productTypes);
                  }
                });
            
                // Check if we have any product types
                if (allProductTypes.length === 0) {
                  console.error('No valid product types found');
                  throw new Error('No valid product types available');
                }
            
                console.log('All product types:', allProductTypes);
            
                // Create quick replies from product types
                const quickReplies = allProductTypes
              .filter(type => {
                const lowerTitle = type.title.toLowerCase();
                return lowerTitle !== "browse our product" && lowerTitle !== "browse our product and services"
              })
              .map(type => ({
                content_type: "text",
                title: type.title,
                payload: type.payload
              }));
            
                console.log('Created quick replies:', quickReplies);
                let text="Please select a product category:";
            
            
            
                const url = `https://graph.instagram.com/v23.0/${igId}/messages`;
                const data = {
                  recipient: { id: recipientId },
                  messaging_type: "RESPONSE",
                  message: {
                    text: text,
                    quick_replies: quickReplies
                  }
                };
            
                console.log('Sending quick reply data:', data);
            
                const response = await axios.post(url, data, {
                  headers: {
                    'Authorization': `Bearer ${userAccessToken}`,
                    'Content-Type': 'application/json'
                  }
                });
            
                console.log('Quick replies message sent successfully:', response.data);
            
                if(response){
            
              }
                return response.data;
            
              } catch (error) {
                console.error('Error in sendInstagramProductTemplate:', error);
                console.error('Full error:', {
                  message: error.message,
                  stack: error.stack,
                  response: error.response?.data
                });
                throw error;
              }
            }
            
            async function sendInstagramQuickReplyMessage(igId, userAccessToken, recipientId, text, quickReplies, tenentId,messageId,timestamp) {
              try {
                const url = `https://graph.instagram.com/v23.0/${igId}/messages`;
                const data = {
                  recipient: { id: recipientId },
                  messaging_type: "RESPONSE",
                  message: {
                    text: text,
                    quick_replies: quickReplies
                  }
                };
            
                const response = await axios.post(url, data, {
                  headers: {
                    'Authorization': `Bearer ${userAccessToken}`,
                    'Content-Type': 'application/json'
                  }
                });
            
                return response.data;
              } catch (error) {
                console.error('Error sending quick reply message:', error);
                throw error;
              }
            }
            async function createWelcomeMessageResponse(tenentId, welcomePageConfig) {
  try {

    let buttons = [];

    if (welcomePageConfig) {
      console.log(`🔍 DEBUG: Using welcome page config for tenant ${tenentId}`);
      let welcomeText = welcomePageConfig.body;

      // Process workflows
      if (welcomePageConfig.workflows && welcomePageConfig.workflows.length > 0) {
        console.log(`🔍 DEBUG: Processing ${welcomePageConfig.workflows.length} workflows`);

        buttons = welcomePageConfig.workflows.map((workflow, index) => {
          console.log(`🔍 DEBUG: Processing workflow ${index + 1}: ${workflow.title} (${workflow.type})`);

          if (workflow.type === 'payload') {
            return {
              type: "postback",
              title: workflow.title || `Option ${index + 1}`,
              payload: workflow.payload || "DEFAULT_PAYLOAD",
            };
          } else if (workflow.type === 'weburl') {
            // Validate URL
            const url = workflow.url;
            if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
              return {
                type: "web_url",
                title: workflow.title || `Visit Link ${index + 1}`,
                url: url,
              };
            } else {
              console.log(`🔍 WARNING: Invalid URL in workflow ${index + 1}: ${url}`);
              return null;
            }
          }
          return null;
        }).filter(Boolean);

        console.log(`🔍 DEBUG: Generated ${buttons.length} valid buttons from workflows`);
      }
    }

    // Fallback logic if no valid buttons from welcome page config
    if (buttons.length === 0) {
      console.log(`🔍 DEBUG: No workflows found, using fallback buttons`);
      buttons = await getFallbackButtons(tenentId);
    }

    // Ensure we have at least one button and max 3 buttons
    if (buttons.length === 0) {
      buttons = [{
        type: "postback",
        title: "Talk with Human Agent",
        payload: "HUMAN_AGENT",
      }];
    } else if (buttons.length > 3) {
      console.log(`🔍 WARNING: Truncating ${buttons.length} buttons to 3 (Instagram limit)`);
      buttons = buttons.slice(0, 3);
    }

    return {
      attachment: {
        type: "template",
        payload: {
          template_type: "button",
          text: welcomeText,
          buttons: buttons,
        },
      },
    };

  } catch (error) {
    console.error('Error creating welcome message response:', error);
    // Return basic fallback
    return {
      attachment: {
        type: "template",
        payload: {
          template_type: "button",
          text: welcomeText,
          buttons: [{
            type: "postback",
            title: "Talk with Human Agent",
            payload: "HUMAN_AGENT",
          }],
        },
      },
    };
  }
}

            module.exports = {
  sendInstagramMessage,
  sendInstagramCarousel,
  sendInstagramProductTemplateMessage,
  sendInstagramCommentTemplateMessage,
  sendInstagramTemplateMessage,
  sendInstagramProduct_type_quick_reply,
  sendInstagramQuickReplyMessage,
  createWelcomeMessageResponse
};
