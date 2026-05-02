const LongToken              = require('../models/LongToken');
const Newuser                = require('../models/Newuser');
const CommentNewuser         = require('../models/CommentNewuser');
const Comment                = require('../models/Comment');
const CommentAutomationRule  = require('../models/CommentAutomationRule');
const CommentAutomationLog   = require('../models/CommentAutomationLog');
const Message                = require('../models/Message');
const Signup                 = require('../models/Signup');
const rateLimiter            = require('../services/rateLimitService');
const axios                  = require('axios');

const {
  sendInstagramMessage,
  sendInstagramCarousel,
  sendInstagramProductTemplateMessage,
  sendInstagramCommentTemplateMessage,
  sendInstagramTemplateMessage,
  sendInstagramProduct_type_quick_reply,
  sendInstagramQuickReplyMessage,
  createWelcomeMessageResponse
} = require('../instagram/messaging');

const {
  sendNewContact,
  sendNewMessage,
  sendChatModeUpdate,
  sendNotificationUpdate
} = require('../utils/websocket');

// ── Moderation config ─────────────────────────────────────────────
const DEEPSEEK_API_URL  = 'https://api.deepseek.com/chat/completions';
const DEEPSEEK_API_KEY  = process.env.DEEPSEEK_API_KEY;

// Only this tenant gets moderation — all others skip it entirely


const SYSTEM_PROMPT = `You are a multilingual comment moderation AI for an Instagram business account.

You MUST understand and moderate comments in:
- Tamil script        (e.g. "நீ ஒரு முட்டாள்", "பயல்", "தேவடியா")
- Tanglish            (Tamil written in English letters — loosu, poda, poriki, thevdiya, baadu, naaye, mokkai)
- English             (standard and slang)
- Mixed / code-switched (e.g. "enna da ithu, total waste of money")
 
Classify the comment as exactly one of:
- "abusive"    — hate speech, slurs, sexual abuse, threats, body shaming, caste slurs, harassment
- "borderline" — rude, passive-aggressive, mildly offensive, ambiguous tone
- "safe"       — neutral question, positive feedback, constructive criticism, price/product inquiry

Common Tamil/Tanglish abusive words (not exhaustive):
loosu, poda, poriki, thevdiya, baadu, di/da with insults, naaye, otha, payale,
mokkai, paandi (derogatory use), koothi, murudu, lavadha, naayi

Respond ONLY with valid JSON — no markdown fences, no extra text:
{
  "verdict": "abusive" | "borderline" | "safe",
  "reason": "<one sentence in English>",
  "score": 0.0-1.0,
  "detected_language": "Tamil" | "Tanglish" | "English" | "Mixed"
}`;

// ── DeepSeek moderation ───────────────────────────────────────────
async function moderateComment(commentText) {
  try {
    const response = await axios.post(
      DEEPSEEK_API_URL,
      {
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user',   content: `Comment: "${commentText}"` }
        ],
        max_tokens: 150,
        temperature: 0.1
      },
      {
        headers: {
          Authorization:  `Bearer ${DEEPSEEK_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 8000
      }
    );

    const raw     = response.data.choices[0].message.content.trim();
    const cleaned = raw.replace(/```json|```/g, '').trim();
    const result  = JSON.parse(cleaned);

    if (!['abusive', 'borderline', 'safe'].includes(result.verdict)) {
      throw new Error(`Unexpected verdict: ${result.verdict}`);
    }

    console.log(
      `[moderation] "${commentText.slice(0, 40)}" → ${result.verdict} ` +
      `(${result.detected_language}, score: ${result.score})`
    );

    return result; // { verdict, reason, score, detected_language }

  } catch (error) {
    console.error('DeepSeek moderation error:', error.message);
    // Fail-open: treat as safe so automation still runs
    return {
      verdict:           'safe',
      reason:            'moderation unavailable',
      score:             0,
      detected_language: 'unknown'
    };
  }
}

// ── Main handler ──────────────────────────────────────────────────
async function handleCommentMessage(eventData) {
  try {
    const commentData    = eventData.commentData;
    console.log('commentData', commentData);

    const commentId      = commentData.id;
    const commentText    = commentData.text;
    const mediaId        = commentData.media.id;
    const senderID       = commentData.from.id;
    const userName       = commentData.from.username;
    const timestamp      = eventData.time;
    const tenentId       = eventData.tenentId;
    const igProAccountId = eventData.accountId;

    let send_reply_status = true;
    console.log('tenentId for comment', tenentId);
    
    // ── STEP 1: Ignore own public replies ────────────────────────
    if (commentData.from?.self_ig_scoped_id && commentData.parent_id) {
      console.log('🟡 Ignoring webhook: public reply by own professional account.');
      return;
    }
     const signupdata = await Signup.findOne({tenentId: tenentId})
      .sort({ createdAt: -1 })
      .limit(1);
    // ── STEP 2: Fetch access token ───────────────────────────────
    const accountData = await LongToken.findOne({ Instagramid: igProAccountId })
      .sort({ createdAt: -1 })
      .limit(1);

    if (!accountData?.userAccessToken) {
      console.error('No access token found for account');
      return;
    }

    const userAccessToken = accountData.userAccessToken;

    // ── STEP 3: Upsert sender in user collections ────────────────
    const existingUser = await CommentNewuser.findOne({ senderId: senderID, tenentId })
      .sort({ createdAt: -1 })
      .limit(1);

    console.log('existingUser', existingUser);

    if (existingUser) {
      console.log('SenderID already exists in comment users');
      await updateCommentUserProfile({ username: userName }, senderID, tenentId);
    } else {
      console.log('SenderID does not exist in comment users');

      try {
        const newUser      = new CommentNewuser({ senderId: senderID, username: userName, mediaId, tenentId });
        const savedNewUser = await newUser.save();
        console.log('Comment user data saved:', savedNewUser);
      } catch (error) {
        console.error('Error saving comment user data:', error);
      }

      const existingNewUser = await Newuser.findOne({ senderId: senderID, tenentId })
        .sort({ createdAt: -1 })
        .limit(1);

      if (existingNewUser) {
        console.log('SenderID already exists in newuser collection');
        await updateCommentUserProfile({ username: userName }, senderID, tenentId);
      } else {
        try {
          const newUser1 = new Newuser({
            senderId:    senderID,
            username:    userName,
            name:        'Nil',
            profile_pic: null,
            tenentId
          });
          const savedNewUser1 = await newUser1.save();
          console.log('User data saved:', savedNewUser1);
          await sendNewContact(savedNewUser1, tenentId, senderID);
        } catch (error) {
          console.error('Error saving user data:', error);
        }
      }
    }

    // ── STEP 4: Fetch automation rules ───────────────────────────
    let matchingRules = [];
    try {
      matchingRules = await CommentAutomationRule.find({ tenentId, mediaId });
      console.log(`Found ${matchingRules.length} rules for media ID ${mediaId}`);
    } catch (error) {
      console.error('Error fetching comment automation rules:', error);
    }

    // ── STEP 5: Moderation (only for specific tenant) ────────────
    const isCommentModerationEnabled = signupdata?.commentmoderation !== false;

    if (isCommentModerationEnabled) {
      const moderation = await moderateComment(commentText);

      console.log(
        `[moderation] tenantId: ${tenentId} | ` +
        `"${commentText.slice(0, 40)}" → ${moderation.verdict} ` +
        `(${moderation.detected_language}, score: ${moderation.score})`
      );

      // ── Abusive: delete + tag ───────────────────────────────
      if (moderation.verdict === 'abusive') {
        try {
          await deleteInstagramComment(commentId, userAccessToken);
          console.log(`🗑️ Abusive comment deleted: ${commentId}`);
        } catch (err) {
          console.error('❌ Failed to delete abusive comment:', err.message);
        }

        try {
          await Comment.createAbusiveComment({
            tenentId,
            mediaId,
            commentId,
            message:     commentText,
            senderId:    senderID,
            username:    userName,
            recipientId: igProAccountId,
            Timestamp:   timestamp,
            moderation: {
              verdict:          'abusive',
              score:            moderation.score,
              detectedLanguage: moderation.detected_language,
              reason:           moderation.reason,
              action:           'deleted'
            }
          });
          console.log(`🏷️ Abusive comment tagged and saved: ${commentId}`);
        } catch (dbErr) {
          console.error('❌ Failed to save abusive comment record:', dbErr.message);
        }

        return; // stop — no automation reply
      }

      // ── Borderline: hide + tag ──────────────────────────────
      if (moderation.verdict === 'borderline') {
        try {
          await hideInstagramComment(commentId, userAccessToken, true);
          console.log(`🙈 Borderline comment hidden: ${commentId}`);
        } catch (err) {
          console.error('❌ Failed to hide borderline comment:', err.message);
        }

        try {
          await Comment.createAbusiveComment({
            tenentId,
            mediaId,
            commentId,
            message:     commentText,
            senderId:    senderID,
            username:    userName,
            recipientId: igProAccountId,
            Timestamp:   timestamp,
            moderation: {
              verdict:          'borderline',
              score:            moderation.score,
              detectedLanguage: moderation.detected_language,
              reason:           moderation.reason,
              action:           'hidden'
            }
          });
          console.log(`🏷️ Borderline comment tagged and saved: ${commentId}`);
        } catch (dbErr) {
          console.error('❌ Failed to save borderline comment record:', dbErr.message);
        }

        return; // stop — no automation reply
      }

      // ── Safe: fall through to automation rules ──────────────
      console.log(`✅ Comment is safe, proceeding to automation rules`);
    }

    // ── STEP 6: Match automation rule ────────────────────────────
    const matchedRule = findMatchingRule(matchingRules, commentText);

    if (!matchedRule) {
      console.log('No matching automation rule found for comment');
      return;
    }

    console.log(`Matched rule with trigger: "${matchedRule.triggerText}"`);

    const { ruleType }       = matchedRule;
    const isFollowerRequired = matchedRule.isFollowerRequired;

    // ── STEP 7: Follower gate ────────────────────────────────────
    if (isFollowerRequired === true) {
      const userdata = await getUserProfileFollowInformation(senderID, tenentId);
      console.log('userdata for getUserProfileFollowInformation', userdata);
      send_reply_status = userdata.is_user_follow_business === true;
    }

    console.log('send_reply_status', send_reply_status);

    // ── STEP 8: Send reply ───────────────────────────────────────
    if (send_reply_status === true) {

      // ── Text rule ─────────────────────────────────────────────
      if (ruleType === 'text') {
        const replyText    = matchedRule.replyText;
        const commentReply = matchedRule.commentReply;

        console.log('isFollowerRequired', isFollowerRequired);

        try {
          if (rateLimiter.canMakePrivateRepliesPostCall(tenentId, igProAccountId)) {
            const response_for_comment = await sendInstagramCommentTextMessage(
              igProAccountId, userAccessToken, commentId, replyText,
              tenentId, senderID, userName, commentText, timestamp, mediaId
            );

            if (commentReply && response_for_comment) {
              try {
                await sendInstagramPublicReply(commentId, userAccessToken, commentReply, tenentId, igProAccountId);
              } catch (replyErr) {
                console.error('⚠️ Public reply failed (non-fatal):', replyErr.message);
              }
            }

          } else {
            console.log(`Rate limit exceeded for tenant ${tenentId}, scheduling retry`);
            safeRetry(async () => {
              if (rateLimiter.canMakePrivateRepliesPostCall(tenentId, igProAccountId)) {
                const response_for_comment = await sendInstagramCommentTextMessage(
                  igProAccountId, userAccessToken, commentId, replyText,
                  tenentId, senderID, userName, commentText, timestamp, mediaId
                );
                if (commentReply && response_for_comment) {
                  await sendInstagramPublicReply(commentId, userAccessToken, commentReply, tenentId, igProAccountId);
                }
              }
            });
          }
        } catch (error) {
          console.error('Error sending comment text reply:', error);
        }

      // ── Template / carousel rule ──────────────────────────────
      } else if (ruleType === 'template') {
        const templateItems = matchedRule.carouselItems || [];
        const commentReply  = matchedRule.commentReply;

        if (templateItems.length === 0) {
          console.error('Template rule has no items to display');
          return;
        }

        const elements = templateItems.map(item => ({
          title:          item.title,
          image_url:      item.image,
          subtitle:       item.subtitle,
          default_action: { type: 'web_url', url: item.buttonUrl },
          buttons: [{ type: 'web_url', title: item.buttonText || 'View', url: item.buttonUrl }]
        }));

        try {
          if (rateLimiter.canMakePrivateRepliesPostCall(tenentId, igProAccountId)) {
            const response_for_comment = await sendInstagramCommentCarousel(
              igProAccountId, userAccessToken, commentId, senderID,
              userName, commentText, timestamp, mediaId, tenentId, elements
            );

            if (commentReply && response_for_comment) {
              try {
                await sendInstagramPublicReply(commentId, userAccessToken, commentReply, tenentId, igProAccountId);
              } catch (replyErr) {
                console.error('⚠️ Public reply failed (non-fatal):', replyErr.message);
              }
            }

          } else {
            console.log(`Rate limit exceeded for carousel, tenant ${tenentId}, scheduling retry`);
            safeRetry(async () => {
              if (rateLimiter.canMakePrivateRepliesPostCall(tenentId, igProAccountId)) {
                const response_for_comment = await sendInstagramCommentCarousel(
                  igProAccountId, userAccessToken, commentId, senderID,
                  userName, commentText, timestamp, mediaId, tenentId, elements
                );
                if (commentReply && response_for_comment) {
                  await sendInstagramPublicReply(commentId, userAccessToken, commentReply, tenentId, igProAccountId);
                }
              }
            });
          }
        } catch (error) {
          console.error('Error sending carousel reply to comment:', error.response?.data || error.message);
        }
      }

    } else {
      // ── STEP 9: Not a follower ───────────────────────────────
      await handleNotFollower(
        senderID, tenentId, commentText, matchedRule,
        mediaId, commentId, igProAccountId, userAccessToken, userName, timestamp
      );
    }

  } catch (error) {
    console.error('Error handling comment message:', error);
    throw error;
  }
}

// ── Safe retry (no unhandled promise rejections) ──────────────────
function safeRetry(fn, delay = 5000) {
  setTimeout(() => {
    Promise.resolve().then(fn).catch(err => {
      console.error('Error in delayed retry:', err.message);
    });
  }, delay);
}

// ── Rule matcher ──────────────────────────────────────────────────
function findMatchingRule(rules, commentText) {
  if (!rules || rules.length === 0 || !commentText) return null;

  const normalizedComment = commentText.toLowerCase().trim();
  const specificRules     = [];
  const wildcardRules     = [];

  rules.forEach(rule => {
    const t = rule.triggerText.toLowerCase().trim();
    if (t === '*') wildcardRules.push(rule);
    else           specificRules.push(rule);
  });

  const specificMatch = specificRules.find(rule =>
    normalizedComment.includes(rule.triggerText.toLowerCase().trim())
  );

  if (specificMatch)        return specificMatch;
  if (wildcardRules.length) return wildcardRules[0];
  return null;
}

// ── updateCommentUserProfile ──────────────────────────────────────
async function updateCommentUserProfile(userData, senderID, tenentId) {
  try {
    await CommentNewuser.findOneAndUpdate(
      { senderId: senderID, tenentId },
      { $set: { username: userData.username || 'Nil' } },
      { upsert: true, new: true }
    );
  } catch (error) {
    console.error('Error updating user profile:', error);
    throw error;
  }
}

// ── sendInstagramPublicReply ──────────────────────────────────────
async function sendInstagramPublicReply(commentId, userAccessToken, messageText, tenentId, igProAccountId) {
  try {
    const response = await axios({
      method:  'post',
      url:     `https://graph.instagram.com/v23.0/${commentId}/replies`,
      headers: {
        'Content-Type': 'application/json',
        Authorization:  `Bearer ${userAccessToken}`
      },
      data:    { message: messageText },
      timeout: 15000
    });
    console.log(`✅ Public reply posted for tenant ${tenentId}:`, response.data);
    return response.data;
  } catch (error) {
    console.error(`❌ Error sending public reply for tenant ${tenentId}:`, error.response?.data || error.message);
    throw error;
  }
}

// ── deleteInstagramComment ────────────────────────────────────────
async function deleteInstagramComment(commentId, userAccessToken) {
  try {
    const response = await axios({
      method:  'DELETE',
      url:     `https://graph.instagram.com/v23.0/${commentId}`,
      headers: { Authorization: `Bearer ${userAccessToken}` },
      timeout: 10000
    });
    console.log(`✅ Deleted comment ${commentId}:`, response.data);
    return response.data;
  } catch (error) {
    console.error(`❌ Error deleting comment ${commentId}:`, error.response?.data || error.message);
    throw error;
  }
}

// ── hideInstagramComment ──────────────────────────────────────────
async function hideInstagramComment(commentId, userAccessToken, hide = true) {
  try {
    const response = await axios({
      method:  'POST',
      url:     `https://graph.instagram.com/v23.0/${commentId}`,
      headers: {
        Authorization:  `Bearer ${userAccessToken}`,
        'Content-Type': 'application/json'
      },
      data:    { hide },
      timeout: 10000
    });
    console.log(`✅ Comment ${hide ? 'hidden' : 'unhidden'} ${commentId}:`, response.data);
    return response.data;
  } catch (error) {
    console.error(`❌ Error hiding comment ${commentId}:`, error.response?.data || error.message);
    throw error;
  }
}

// ── sendInstagramCommentTextMessage ───────────────────────────────
async function sendInstagramCommentTextMessage(
  igProAccountId, userAccessToken, commentId, messageText,
  tenentId, senderID, userName, commentText, timestamp, mediaId
) {
  console.log('sendInstagramCommentTextMessage starts');
  try {
    if (!rateLimiter.canMakePrivateRepliesPostCall(tenentId, igProAccountId)) {
      console.log(`Rate limit exceeded (Posts) for tenant ${tenentId}, delaying comment reply`);
      await new Promise(resolve => setTimeout(resolve, 5000));
      if (!rateLimiter.canMakePrivateRepliesPostCall(tenentId, igProAccountId)) {
        throw new Error('Rate limit still exceeded after waiting');
      }
    }

    const response = await axios({
      method:  'post',
      url:     `https://graph.instagram.com/${igProAccountId}/messages`,
      headers: {
        'Content-Type': 'application/json',
        Authorization:  `Bearer ${userAccessToken}`
      },
      data: {
        recipient: { comment_id: commentId },
        message:   { text: messageText }
      },
      timeout: 15000
    });

    console.log('Private reply sent successfully:', response.data);

    if (response?.data) {
      const messageRecord = await Comment.createCommentMessage({
        senderId:    senderID,
        username:    userName,
        commentId,
        recipientId: igProAccountId,
        message:     commentText,
        response:    messageText,
        Timestamp:   timestamp,
        mediaId,
        tenentId
      });
      console.log('Comment message saved:', messageRecord);
    }

    return response.data;
  } catch (error) {
    console.error('Error sending private reply:', error.response?.data || error.message);
    throw error;
  }
}

// ── sendInstagramCommentCarousel ──────────────────────────────────
async function sendInstagramCommentCarousel(
  igProAccountId, userAccessToken, commentId, senderID,
  userName, commentText, timestamp, mediaId, tenentId, elements
) {
  try {
    if (!rateLimiter.canMakePrivateRepliesPostCall(tenentId, igProAccountId)) {
      console.log(`Rate limit exceeded (Posts) for tenant ${tenentId}, delaying carousel reply`);
      await new Promise(resolve => setTimeout(resolve, 5000));
      if (!rateLimiter.canMakePrivateRepliesPostCall(tenentId, igProAccountId)) {
        throw new Error('Rate limit still exceeded after waiting');
      }
    }

    const response = await axios.post(
      `https://graph.instagram.com/${igProAccountId}/messages`,
      {
        recipient: { comment_id: commentId },
        message: {
          attachment: {
            type:    'template',
            payload: { template_type: 'generic', elements }
          }
        }
      },
      {
        headers: {
          Authorization:  `Bearer ${userAccessToken}`,
          'Content-Type': 'application/json'
        },
        timeout: 15000
      }
    );

    console.log('Carousel comment reply sent successfully:', response.data);

    const carouselProducts = elements.map(el => ({
      title:    el.title,
      subtitle: el.subtitle,
      imageUrl: el.image_url,
      buttons:  el.buttons.map(b => ({
        type:    b.type    || 'web_url',
        title:   b.title   || '',
        url:     b.url     || '',
        payload: b.payload || ''
      }))
    }));

    // ── Save to Comment collection ────────────────────────────
    try {
      const savedComment = await Comment.createCommentMessage({
        senderId:    senderID,
        username:    userName,
        commentId,
        recipientId: igProAccountId,
        message:     commentText,
        response:    'Carousel Message',
        Timestamp:   new Date().toISOString(),
        mediaId,
        tenentId,
        carouselData: {
          totalItems: elements.length,
          items: elements.map(el => ({
            title:      el.title,
            image:      el.image_url,
            subtitle:   el.subtitle,
            buttonText: el.buttons[0]?.title || '',
            buttonUrl:  el.buttons[0]?.url   || ''
          }))
        }
      });
      console.log('Carousel comment data saved:', savedComment);
    } catch (dbError) {
      console.error('Error saving carousel comment data:', dbError.message);
    }

    // ── Save to Message collection ────────────────────────────
    try {
      const messageData = {
        senderId:    senderID,
        recipientId: igProAccountId,
        tenentId,
        messageType: 'carousel',
        message:     '',
        response:    'Carousel Message',
        Timestamp:   new Date().toISOString(),
        carouselData: {
          totalProducts: elements.length,
          products:      carouselProducts
        },
        messageid: response.data.message_id || `comment_${commentId}_reply`
      };
      const savedMessage = await Message.createCarouselMessage(messageData);
      await sendNewMessage(messageData, tenentId, 'carousel');
      console.log('Carousel message saved to Message collection:', savedMessage);
    } catch (msgError) {
      console.error('Error saving carousel to Message collection:', msgError.message);
    }

    return response.data;
  } catch (error) {
    console.error('Error sending carousel comment reply:', error.response?.data || error.message);
    throw error;
  }
}

async function getUserProfileFollowInformation(senderId, tenentId) {
  const IGSID = senderId;
  console.log('sender:', IGSID);

  // ✅ Get latest token
  const latestToken = await LongToken.findOne({ tenentId })
    .sort({ createdAt: -1 })
    .limit(1);

  if (!latestToken || !latestToken.userAccessToken) {
    console.log('No token found for tenant:', tenentId);
    return {
      username: "Nil",
      name: "Nil",
      profile_pic: null,
      follower_count: 0,
      is_user_follow_business: false,
      is_business_follow_user: false
    };
  }

  const userAccessToken = latestToken.userAccessToken;
  const accountId = latestToken.Instagramid;

  try {
    // ✅ Rate limit check
    if (!rateLimiter.canMakeConversationsApiCall(tenentId, accountId, senderId)) {
      console.log(`⚠️ Rate limit exceeded for Conversations API for tenant ${tenentId}`);
      return {
        username: "Nil",
        name: "Nil",
        profile_pic: null,
        follower_count: 0,
        is_user_follow_business: false,
        is_business_follow_user: false
      };
    }

    // ✅ Instagram Graph API call - always fetch fresh data
    const response = await axios.get(
      `https://graph.instagram.com/v24.0/${IGSID}`,
      {
        params: {
          fields: 'name,username,profile_pic,follower_count,is_user_follow_business,is_business_follow_user',
          access_token: userAccessToken
        },
        timeout: 10000
      }
    );

    if (response.data) {
      const profileData = {
        name: response.data.name || "Nil",
        username: response.data.username || "Nil",
        profile_pic: response.data.profile_pic || null,
        follower_count: response.data.follower_count || 0,
        is_user_follow_business: response.data.is_user_follow_business ?? false,
        is_business_follow_user: response.data.is_business_follow_user ?? false
      };

      console.log('User Profile (Fresh):', profileData);

      return profileData;
    }

    return {
      username: "Nil",
      name: "Nil",
      profile_pic: null,
      follower_count: 0,
      is_user_follow_business: false,
      is_business_follow_user: false
    };

  } catch (error) {
    if (error.response) {
      console.error(
        'Error fetching user profile:',
        error.response.status,
        error.response.data
      );

      if (error.response.status === 429) {
        console.error('Rate limit exceeded for Instagram API');
      }
    } else {
      console.error('Error fetching user profile:', error.message);
    }

    // ✅ Always return safe defaults
    return {
      username: "Nil",
      name: "Nil",
      profile_pic: null,
      follower_count: 0,
      is_user_follow_business: false,
      is_business_follow_user: false
    };
  }
}

async function handleNotFollower(
  senderID,
  tenentId,  // Fixed typo
  commentText,
  matchedRule,
  mediaId,
  commentId,
  igProAccountId,
  userAccessToken,
  productcatalogurl,
  securityaccessToken,
  userName,  // Added parameter
  timestamp  // Added parameter
) {
  const notFollowerTemplate = {
    attachment: {
      type: "template",
      payload: {
        template_type: "button",
        text: "You are not a follower. Please follow us to get the link and click the button below.",
        buttons: [
          {
            type: "postback",
            payload: "FOLLOW_STATUS",  // Fixed: lowercase 'payload'
            title: "I'm Follower"
          }
        ]
      }
    }
  };

  try {
    // Send the Instagram message
    const response = await sendInstagramCommentTemplateMessage(
      igProAccountId,
      userAccessToken,
      commentId,
      senderID,
      tenentId,
      notFollowerTemplate
    );

    console.log("✅ Sent follow-required message (comment reply + DM template)");

    // Save to Comment collection (like your comment message example)
    if (response) {
      const commentMessageData = {
        senderId: senderID,
        username: userName,
        commentId,
        recipientId: igProAccountId,
        message: commentText,
        response: notFollowerTemplate,  // Using template instead of text
        Timestamp: timestamp,
        mediaId,
        tenentId
      };

      const commentRecord = await Comment.createCommentMessage(commentMessageData);
      console.log('Comment message saved:', commentRecord);
    }

    // Save to Message collection (like your product template example)
    const timestamp2 = timestamp + 10;
    const messageData = {
      senderId: senderID,
      recipientId: igProAccountId,
      response: notFollowerTemplate,
      Timestamp: timestamp2,
      tenentId: tenentId
    };

    try {
      const message = await Message.createProductTemplateMessage(messageData);
      console.log('Message data saved:', message);

      const type = "template";
      await sendNewMessage(messageData, tenentId, type);
    } catch (error) {
      console.error('Error saving Message user data:', error);
    }

    // Log automation
    await CommentAutomationLog.create({
      senderId: senderID,
      tenentId,
      commentText,
      ruleId: matchedRule.ruleId,
      sendReplyStatus: true,  // Changed to true since message was sent
      mediaId,
      commentId,
      reason: "FOLLOWER_REQUIRED_NOT_FOLLOWING"
    });

  } catch (err) {
    console.error("❌ Error sending follow-required message:", err);

    // Log failure
    await CommentAutomationLog.create({
      senderId: senderID,
      tenentId,
      commentText,
      ruleId: matchedRule.ruleId,
      sendReplyStatus: false,
      mediaId,
      commentId,
      reason: "FOLLOWER_REQUIRED_NOT_FOLLOWING"
    });
  }
}


module.exports = { handleCommentMessage, findMatchingRule };
