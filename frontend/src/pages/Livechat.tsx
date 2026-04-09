import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, Clock } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import TemplateMessage, { TemplateMessageProps } from '@/components/TemplateMessage';
import AudioMessage from '@/components/AudioMessage';
import ImageMessage from '@/components/ImageMessage';
import VideoMessage from '@/components/VideoMessage';
import CarouselMessage from '@/components/CarouselMessage';
import { getWebSocketService, WebSocketService } from '../Services/websocketService';
import EmojiPicker, { EmojiClickData, Theme } from 'emoji-picker-react';



// --- Instagram Profile Picture Component ---
const InstagramProfilePic = ({
  src,
  alt,
  size = "w-12 h-12",
  borderSize = "p-0.5"
}: {
  src?: string;
  alt: string;
  size?: string;
  borderSize?: string;
}) => {
  const [imageError, setImageError] = useState(false);

  return (
    <div className={`${size} rounded-full bg-gradient-to-tr from-yellow-400 via-red-500 to-pink-500 ${borderSize} flex-shrink-0`}>
      <div className="w-full h-full rounded-full bg-white p-0.5">
        {src && !imageError ? (
          <img
            src={src}
            alt={alt}
            className="w-full h-full rounded-full object-cover"
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="w-full h-full rounded-full bg-gray-100 flex items-center justify-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-3/5 h-3/5 text-gray-400"
            >
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
          </div>
        )}
      </div>
    </div>
  );
};

// --- Interface Definitions ---
interface CarouselProduct {
  title: string;
  subtitle: string;
  imageUrl: string;
  buttons: {
    type: string;
    title: string;
    url?: string;
    payload?: string;
  }[];
}

interface Contact {
  _id: string;
  username: string;
  senderId: string;
  createdAt: string;
  name: string;
  profile_pic?: string;
  chatMode: 'chat' | 'human';
  lastMessage?: {
    message: string;
    response: string;
    Timestamp: string;
    messageType?: 'text' | 'template' | 'audio' | 'image' | 'video' | 'ig_reel' | 'ig_stroy' | 'carousel';
  };
}

interface Message {
  _id: string;
  senderId: string;
  recipientId: string;
  tenentId: string;
  messageType: 'text' | 'template' | 'audio' | 'image' | 'video' | 'ig_reel' | 'ig_stroy' | 'carousel';
  message: string;
  response?: string;
  Timestamp: string;
  audioUrl?: string;
  transcription?: string;
  carouselData?: {
    totalProducts: number;
    products: CarouselProduct[];
  };
}

interface Order {
  _id: string;
  flow_token: string;
  orderId: string;
  bill_no: string;
  tenentId: string;
  senderId: string;
  paymentStatus: string;
  products: {
    sku: string;
    product_name: string;
    quantity: number;
    price: number;
  }[];
  amount: number;
  amountPaid: number;
  shipping_cost: number;
  total_amount: number;
  currency: string;
  status: string;
  confirmation_sent: boolean;
  print_status: string;
  tracking_status: string;
  holding_status: string;
  is_on_hold: boolean;
  packing_status: string;
  customer_name: string;
  address: string;
  city: string;
  country: string;
  phone_number: string;
  state: string;
  zip_code: string;
  shipping_partner: { name: string } | null;
  tracking_number: string;
  weight: number;
  created_at: string;
  timestamp: string;
  updated_at: string;
}

interface WebSocketAuthMessage {
  type: 'auth';
  status: 'success' | 'error';
  message?: string;
}

interface WebSocketHistoryMessage {
  type: 'history';
  messages: Message[];
}

interface WebSocketNewMessage {
  type: 'new_message';
  message: Message;
}

interface WebSocketContactListMessage {
  type: 'contact_list';
  contacts: Contact[];
  messages: Message[];
}

interface WebSocketErrorMessage {
  type: 'error';
  message: string;
}

interface WebSocketNewContact {
  type: 'new_contact';
  contact: Contact;
}

interface WebSocketContactDetailsMessage {
  type: 'contact_details';
  contact: Contact;
}

interface WebSocketChatModeUpdateMessage {
  type: 'chat_mode_update';
  messageId?: string;
  status: 'success' | 'error';
  message?: string;
  data: {
    senderId: string;
    mode: 'chat' | 'human';
  } | null;
}

interface WebSocketChatModeMessage {
  type: 'chat_mode';
  status: 'success' | 'error';
  message?: string;
  data: {
    mode: 'chat' | 'human';
  } | null;
}

interface WebSocketHumanAgentContactsMessage {
  type: 'human_agent_contacts';
  contacts: Contact[];
  hasMore: boolean;
  totalCount: number;
}

interface SearchResponse {
  type: 'search_results';
  contacts: Contact[];
}

type WebSocketMessage =
  | WebSocketAuthMessage
  | WebSocketHistoryMessage
  | WebSocketNewMessage
  | WebSocketContactListMessage
  | WebSocketNewContact
  | WebSocketErrorMessage
  | WebSocketChatModeUpdateMessage
  | WebSocketChatModeMessage
  | WebSocketContactDetailsMessage
  | WebSocketHumanAgentContactsMessage
  | SearchResponse;

// --- Reusable style for word-breaking in message bubbles ---
const msgTextStyle: React.CSSProperties = {
  wordBreak: 'break-word',
  overflowWrap: 'anywhere',
  whiteSpace: 'pre-wrap',
};

export default function LiveChat() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const wsServiceRef = useRef<WebSocketService | null>(null);
  const processedMessageIds = useRef(new Set<string>());
  const processedModeUpdateIds = useRef(new Set<string>());
  const [showLoadLess, setShowLoadLess] = useState(false);
  const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'humanAgent'>('all');
  const [hasMoreHumanAgents, setHasMoreHumanAgents] = useState(true);
  const [isLoadingMoreHumanAgents, setIsLoadingMoreHumanAgents] = useState(false);
  const [showLoadLessHumanAgents, setShowLoadLessHumanAgents] = useState(false);
  const [humanAgentPage, setHumanAgentPage] = useState(1);
  const [humanAgentContacts, setHumanAgentContacts] = useState<Contact[]>([]);
  const [totalHumanAgentCount, setTotalHumanAgentCount] = useState(0);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [latestOrders, setLatestOrders] = useState<Order[]>([]);
  const [totalOrderCount, setTotalOrderCount] = useState<number>(0);
  const [showOrderDetails, setShowOrderDetails] = useState<boolean>(false);
  const [isWindowExpired, setIsWindowExpired] = useState(false);

  useEffect(() => {
    const checkWindowStatus = () => {
      if (!selectedContact || messages.length === 0) {
        setIsWindowExpired(true);
        return;
      }

      const lastCustomerMessage = messages
        .filter(msg => msg.message && msg.message.trim() !== "")
        .sort((a, b) => new Date(b.Timestamp).getTime() - new Date(a.Timestamp).getTime())[0];

      if (!lastCustomerMessage) {
        setIsWindowExpired(true);
        return;
      }

      const lastMessageTime = new Date(lastCustomerMessage.Timestamp).getTime();
      const now = new Date().getTime();
      const hoursSince = (now - lastMessageTime) / (1000 * 60 * 60);
      setIsWindowExpired(hoursSince > 24);
    };

    checkWindowStatus();
    const interval = setInterval(checkWindowStatus, 60 * 1000);
    return () => clearInterval(interval);
  }, [selectedContact, messages]);

  const formatMessageTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return !isNaN(date.getTime())
      ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : '';
  };

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const updateContactLastMessage = useCallback((message: Message) => {
    setContacts(prev => prev.map(contact => {
      if (contact.senderId === message.senderId || contact.senderId === message.recipientId) {
        return {
          ...contact,
          lastMessage: {
            message: message.message,
            response: message.response || '',
            Timestamp: message.Timestamp,
            messageType: message.messageType
          }
        };
      }
      return contact;
    }));

    setHumanAgentContacts(prev => prev.map(contact => {
      if (contact.senderId === message.senderId || contact.senderId === message.recipientId) {
        return {
          ...contact,
          lastMessage: {
            message: message.message,
            response: message.response || '',
            Timestamp: message.Timestamp,
            messageType: message.messageType
          }
        };
      }
      return contact;
    }));
  }, []);

  const handleWebSocketMessage = useCallback((data: WebSocketMessage) => {
    switch (data.type) {
      case 'error':
        console.error('Received error from server:', data.message);
        setLoading(false);
        break;

      case 'contact_list':
        if (Array.isArray(data.contacts)) {
          setContacts(prevContacts => {
            const newContacts = [...prevContacts];
            data.contacts.forEach(newContact => {
              const existingIndex = newContacts.findIndex(
                existing => existing.senderId === newContact.senderId
              );
              if (newContact.lastMessage) {
                let messageType: 'text' | 'image' | 'audio' | 'template' | 'video' | 'ig_reel' | 'ig_stroy' | 'carousel' = 'text';
                if (newContact.lastMessage.messageType) {
                  messageType = newContact.lastMessage.messageType;
                }
                newContact.lastMessage = { ...newContact.lastMessage, messageType };
              }
              if (existingIndex === -1) {
                newContacts.push(newContact);
              }
            });
            const sortedContacts = newContacts.sort((a, b) => {
              const aTime = a.lastMessage?.Timestamp || a.createdAt;
              const bTime = b.lastMessage?.Timestamp || b.createdAt;
              return new Date(bTime).getTime() - new Date(aTime).getTime();
            });
            setShowLoadLess(sortedContacts.length > 6);
            setHasMore(data.contacts.length === 6);
            setIsLoadingMore(false);
            return sortedContacts;
          });
          setLoading(false);
        }
        break;

      case 'new_contact':
        setContacts(prevContacts => {
          const exists = prevContacts.some(c => c.senderId === data.contact.senderId);
          if (exists) return prevContacts;
          const updatedContacts = [...prevContacts, data.contact].sort((a, b) => {
            const aTime = a.lastMessage?.Timestamp || a.createdAt;
            const bTime = b.lastMessage?.Timestamp || b.createdAt;
            return new Date(bTime).getTime() - new Date(aTime).getTime();
          });
          return updatedContacts.slice(0, 6);
        });
        break;

      case 'new_message': {
        const message = data.message;
        const messageKey = `${message.senderId}_${message.Timestamp}`;
        if (processedMessageIds.current.has(messageKey)) return;
        processedMessageIds.current.add(messageKey);

        const contactExists = contacts.some(contact => contact.senderId === message.senderId);
        if (!contactExists) {
          const wsService = wsServiceRef.current;
          if (wsService?.isConnected()) {
            const tenentId = localStorage.getItem('tenentid');
            wsService.sendMessage({ type: 'fetch_contact_details', senderId: message.senderId, tenentId, message });
          }
        }

        setContacts(prevContacts => {
          const updatedContacts = prevContacts.map(contact => {
            if (contact.senderId === message.senderId || contact.senderId === message.recipientId) {
              return {
                ...contact,
                lastMessage: {
                  message: message.message,
                  response: message.response || '',
                  Timestamp: message.Timestamp,
                  messageType: message.messageType
                }
              };
            }
            return contact;
          });
          return updatedContacts.sort((a, b) => {
            const aTime = a.lastMessage?.Timestamp || a.createdAt;
            const bTime = b.lastMessage?.Timestamp || b.createdAt;
            return new Date(bTime).getTime() - new Date(aTime).getTime();
          });
        });

        if (selectedContact?.senderId === message.senderId) {
          setMessages(prevMessages => {
            if (!prevMessages.some(m => `${m.senderId}_${m.Timestamp}` === messageKey)) {
              const newMessages = [...prevMessages, message];
              setTimeout(scrollToBottom, 100);
              return newMessages;
            }
            return prevMessages;
          });
        }
        updateContactLastMessage(data.message);
        break;
      }

      case 'contact_details': {
        if (data.contact) {
          const newContact: Contact = {
            _id: data.contact._id,
            username: data.contact.username,
            senderId: data.contact.senderId,
            createdAt: data.contact.createdAt || new Date().toISOString(),
            name: data.contact.name || data.contact.username,
            profile_pic: data.contact.profile_pic,
            chatMode: data.contact.chatMode || 'chat',
            lastMessage: data.contact.lastMessage ? {
              message: data.contact.lastMessage.message || '',
              response: data.contact.lastMessage.response || '',
              Timestamp: data.contact.lastMessage.Timestamp || new Date().toISOString(),
              messageType: data.contact.lastMessage.messageType || 'text'
            } : undefined
          };

          setContacts(prevContacts => {
            const existingContactIndex = prevContacts.findIndex(
              contact => contact.senderId === newContact.senderId
            );
            if (existingContactIndex === -1) {
              const updatedContacts = [...prevContacts, newContact];
              const sortedContacts = updatedContacts.sort((a, b) => {
                const aTime = a.lastMessage?.Timestamp || a.createdAt;
                const bTime = b.lastMessage?.Timestamp || b.createdAt;
                return new Date(bTime).getTime() - new Date(aTime).getTime();
              });
              setShowLoadLess(sortedContacts.length > 6);
              return sortedContacts.slice(0, 6);
            }
            return prevContacts;
          });
        }
        break;
      }

      case 'search_results':
        setContacts(data.contacts);
        setLoading(false);
        break;

      case 'history':
        setMessages([...data.messages].reverse());
        setTimeout(() => scrollToBottom(), 100);
        break;

      case 'chat_mode_update': {
        if (data.status === 'success' && data.data) {
          const messageId = data.messageId;
          if (messageId && processedModeUpdateIds.current.has(messageId)) return;
          if (messageId) {
            processedModeUpdateIds.current.add(messageId);
            setTimeout(() => { processedModeUpdateIds.current.delete(messageId); }, 5000);
          }
          const { senderId, mode } = data.data;
          setContacts(prevContacts =>
            prevContacts.map(contact =>
              contact.senderId === senderId && contact.chatMode !== mode
                ? { ...contact, chatMode: mode }
                : contact
            )
          );
          if (selectedContact?.senderId === senderId) {
            setSelectedContact(prev =>
              prev && prev.chatMode !== mode ? { ...prev, chatMode: mode } : prev
            );
          }
        }
        break;
      }

      case 'chat_mode':
        if (data.status === 'success' && data.data !== null) {
          const { mode } = data.data;
          if (selectedContact) {
            setSelectedContact(prev => prev ? { ...prev, chatMode: mode } : null);
            setContacts(prevContacts =>
              prevContacts.map(contact =>
                contact.senderId === selectedContact.senderId
                  ? { ...contact, chatMode: mode }
                  : contact
              )
            );
          }
        }
        break;

      case 'human_agent_contacts':
        if (Array.isArray(data.contacts)) {
          if ('totalCount' in data) setTotalHumanAgentCount(data.totalCount);
          setHumanAgentContacts(prevContacts => {
            const newContacts = [...prevContacts];
            data.contacts.forEach(newContact => {
              const existingIndex = newContacts.findIndex(
                existing => existing.senderId === newContact.senderId
              );
              if (newContact.lastMessage) {
                let messageType: 'text' | 'image' | 'audio' | 'template' | 'video' | 'ig_reel' | 'ig_stroy' | 'carousel' = 'text';
                if (newContact.lastMessage.messageType) {
                  messageType = newContact.lastMessage.messageType as typeof messageType;
                }
                newContact.lastMessage = { ...newContact.lastMessage, messageType };
              }
              if (existingIndex === -1) newContacts.push(newContact);
            });
            const sortedContacts = newContacts.sort((a, b) => {
              const aTime = a.lastMessage?.Timestamp || a.createdAt;
              const bTime = b.lastMessage?.Timestamp || b.createdAt;
              return new Date(bTime).getTime() - new Date(aTime).getTime();
            });
            setShowLoadLessHumanAgents(sortedContacts.length > 6);
            setHasMoreHumanAgents(prevContacts.length < data.totalCount);
            setIsLoadingMoreHumanAgents(false);
            return sortedContacts;
          });
          setLoading(false);
        }
        break;
    }
  }, [selectedContact, scrollToBottom, updateContactLastMessage]);

  useEffect(() => {
    let isComponentMounted = true;
    const wsService = getWebSocketService();
    wsServiceRef.current = wsService;

    const messageHandler = (data: WebSocketMessage) => {
      if (!isComponentMounted) return;
      handleWebSocketMessage(data);
    };

    wsService.addMessageHandler(messageHandler);

    const handleConnect = () => {
      if (!isComponentMounted) return;
      const tenentId = localStorage.getItem('tenentid');
      if (tenentId) {
        setTimeout(() => {
          if (isComponentMounted) {
            wsService.sendMessage({ type: 'get_contacts', tenentId, page: 1, limit: 6 });
          }
        }, 1000);
      }
    };
    wsService.onConnect(handleConnect);

    if (!wsService.isConnected()) {
      const appUrl = process.env.REACT_APP_API_URL || 'https://inocencia-shiftiest-nonodorously.ngrok-free.dev';
      wsService.connect(appUrl);
    }

    return () => {
      isComponentMounted = false;
      wsService.removeMessageHandler(messageHandler);
      processedModeUpdateIds.current.clear();
      processedMessageIds.current.clear();
    };
  }, [handleWebSocketMessage, contacts.length]);

  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      const cutoffTime = Date.now() - (5 * 60 * 1000);
      processedMessageIds.current = new Set(
        Array.from(processedMessageIds.current).filter(
          id => Number(id.split('_')[0]) > cutoffTime
        )
      );
    }, 10 * 60 * 1000);
    return () => clearInterval(cleanupInterval);
  }, []);

  useEffect(() => {
    if (activeTab === 'humanAgent') {
      const wsService = wsServiceRef.current;
      if (wsService?.isConnected()) {
        const tenentId = localStorage.getItem('tenentid');
        if (tenentId) {
          setIsLoadingMoreHumanAgents(true);
          wsService.sendMessage({ type: 'get_human_agent_contacts', tenentId, page: 1, limit: 6 });
        }
      }
    }
  }, [activeTab]);

  const sanitizeMongoData = (data: any): any => {
    if (data === null || data === undefined) return data;
    if (Array.isArray(data)) return data.map(sanitizeMongoData);
    if (typeof data === 'object') {
      if (data.$numberDouble !== undefined) return Number(data.$numberDouble);
      if (data.$numberInt !== undefined) return Number(data.$numberInt);
      if (data.$numberLong !== undefined) return Number(data.$numberLong);
      if (data.$date !== undefined) return new Date(data.$date);
      const sanitized: any = {};
      for (const [key, value] of Object.entries(data)) {
        sanitized[key] = sanitizeMongoData(value);
      }
      return sanitized;
    }
    return data;
  };

  const fetchOrders = async (): Promise<void> => {
    try {
      const tenentId = localStorage.getItem('tenentid');
      const senderId = selectedContact?.senderId;
      if (!senderId || !tenentId) return;

      const summaryResponse = await fetch(
        `/api/orderdetailroute/orders/summary?senderId=${senderId}&tenentId=${tenentId}`
      );
      if (!summaryResponse.ok) throw new Error('Failed to fetch order summary');
      const summaryData = sanitizeMongoData(await summaryResponse.json());

      const ordersResponse = await fetch(
        `/api/orderdetailroute/orders?senderId=${senderId}&tenentId=${tenentId}&limit=10&includeStats=true`
      );
      if (!ordersResponse.ok) throw new Error('Failed to fetch orders');
      const ordersData = sanitizeMongoData(await ordersResponse.json());

      setLatestOrders(ordersData.orders || []);
      setTotalOrderCount(summaryData.totalOrders || 0);
    } catch (error) {
      console.error('Error fetching orders:', error);
    }
  };

  const formatOrderDate = (timestamp: string | number): string => {
    const date = new Date(parseInt(timestamp.toString()));
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const getStatusColor = (status: string): string => {
    switch (status?.toLowerCase()) {
      case 'delivered': return 'bg-green-100 text-green-800';
      case 'shipped': return 'bg-blue-100 text-blue-800';
      case 'processing': return 'bg-yellow-100 text-yellow-800';
      case 'pending': return 'bg-orange-100 text-orange-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const handleContactSelect = useCallback((contact: Contact) => {
    setSelectedContact(contact);
    const wsService = wsServiceRef.current;
    if (wsService?.isConnected()) {
      const tenentId = localStorage.getItem('tenentid');
      if (tenentId) {
        wsService.sendMessage({ type: 'init', senderId: contact.senderId, tenentId });
        wsService.sendMessage({ type: 'get_chat_mode', senderId: contact.senderId, tenentId });
        setMessages([]);
      }
    }
  }, []);

  const handleSend = useCallback(async () => {
    const wsService = wsServiceRef.current;
    if (!selectedContact || !newMessage.trim() || sendingMessage || !wsService?.isConnected()) return;
    try {
      setSendingMessage(true);
      const tenentId = localStorage.getItem('tenentid');
      wsService.sendMessage({
        type: 'message',
        senderId: selectedContact.senderId,
        tenentId,
        message: newMessage.trim(),
        timestamp: new Date().toISOString()
      });
      setNewMessage('');
      scrollToBottom();
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setSendingMessage(false);
    }
  }, [selectedContact, newMessage, sendingMessage, scrollToBottom]);

  const handleChatModeChange = useCallback(async (senderId: string, newMode: 'chat' | 'human') => {
    const wsService = wsServiceRef.current;
    if (wsService?.isConnected()) {
      const tenentId = localStorage.getItem('tenentid');
      wsService.sendMessage({ type: 'update_chat_mode', senderId, tenentId, chatMode: newMode });
    }
  }, []);

  const filteredContacts = contacts
    .filter(contact => {
      const searchTerms = searchQuery.toLowerCase();
      const name = contact.name?.toLowerCase() || '';
      const username = contact.username?.toLowerCase() || '';
      return name.includes(searchTerms) || username.includes(searchTerms);
    })
    .sort((a, b) => {
      const aTime = a.lastMessage?.Timestamp || a.createdAt;
      const bTime = b.lastMessage?.Timestamp || b.createdAt;
      return new Date(bTime).getTime() - new Date(aTime).getTime();
    });

  const formatMessageDate = (timestamp: string) => {
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (!isNaN(date.getTime())) {
      if (date.toDateString() === today.toDateString()) return 'Today';
      if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
      return date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    }
    return '';
  };

  const formatLastMessageTime = (timestamp: string) => {
    const messageDate = new Date(timestamp);
    const now = new Date();
    if (messageDate.toDateString() === now.toDateString()) return formatMessageTime(timestamp);
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (messageDate.toDateString() === yesterday.toDateString()) return 'Yesterday';
    const lastWeek = new Date(now);
    lastWeek.setDate(lastWeek.getDate() - 7);
    if (messageDate > lastWeek) {
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      return days[messageDate.getDay()];
    }
    return messageDate.toLocaleDateString();
  };

  const shouldShowDate = (messages: Message[], currentIndex: number) => {
    if (currentIndex === 0) return true;
    const currentDate = new Date(messages[currentIndex].Timestamp).toDateString();
    const prevDate = new Date(messages[currentIndex - 1].Timestamp).toDateString();
    return currentDate !== prevDate;
  };

  const loadMoreContacts = useCallback(() => {
    setIsLoadingMore(true);
    const nextPage = page + 1;
    setPage(nextPage);
    const wsService = wsServiceRef.current;
    if (wsService?.isConnected()) {
      const tenentId = localStorage.getItem('tenentid');
      if (tenentId) wsService.sendMessage({ type: 'get_contacts', tenentId, page: nextPage, limit: 6 });
    }
  }, [page]);

  const handleLoadLess = useCallback(() => {
    setContacts(prevContacts => {
      const currentPages = Math.ceil(prevContacts.length / 6);
      if (currentPages > 1) {
        const newContactCount = (currentPages - 1) * 6;
        const reducedContacts = prevContacts.slice(0, newContactCount);
        setShowLoadLess(reducedContacts.length > 6);
        setPage(currentPages - 1);
        return reducedContacts;
      }
      return prevContacts;
    });
  }, []);

  const loadMoreHumanAgents = useCallback(() => {
    setIsLoadingMoreHumanAgents(true);
    const nextPage = humanAgentPage + 1;
    setHumanAgentPage(nextPage);
    const wsService = wsServiceRef.current;
    if (wsService?.isConnected()) {
      const tenentId = localStorage.getItem('tenentid');
      if (tenentId) wsService.sendMessage({ type: 'get_human_agent_contacts', tenentId, page: nextPage, limit: 6 });
    }
  }, [humanAgentPage]);

  const handleLoadLessHumanAgents = useCallback(() => {
    setHumanAgentContacts(prevContacts => {
      const currentPages = Math.ceil(prevContacts.length / 6);
      if (currentPages > 1) {
        const newContactCount = (currentPages - 1) * 6;
        const reducedContacts = prevContacts.slice(0, newContactCount);
        setShowLoadLessHumanAgents(reducedContacts.length > 6);
        setHumanAgentPage(1);
        setHasMoreHumanAgents(true);
        return reducedContacts;
      }
      return prevContacts;
    });
  }, []);

  const handleTemplateButtonClick = async (payload: string) => {
    if (payload === 'HUMAN_AGENT' && selectedContact) {
      await handleChatModeChange(selectedContact.senderId, 'human');
    }
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    if (searchTimeout) clearTimeout(searchTimeout);
    if (!query.trim()) {
      const wsService = wsServiceRef.current;
      if (wsService?.isConnected()) {
        const tenentId = localStorage.getItem('tenentid');
        wsService.sendMessage({ type: 'get_contacts', tenentId, page: 1, limit: 6 });
      }
      return;
    }
    const timeout = setTimeout(() => {
      const wsService = wsServiceRef.current;
      if (wsService?.isConnected()) {
        const tenentId = localStorage.getItem('tenentid');
        wsService.sendMessage({ type: 'search_contacts', tenentId, query: query.trim() });
      }
    }, 300);
    setSearchTimeout(timeout);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedContact || uploadingMedia) return;
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    try {
      setUploadingMedia(true);
      const formData = new FormData();
      formData.append('image', file);
      formData.append('senderId', selectedContact.senderId);
      formData.append('tenentId', localStorage.getItem('tenentid') || '');
      const apiUrl = process.env.REACT_APP_API_URL?.replace(/\/$/, '') || '';
      const response = await fetch(`${apiUrl}/api/uploadmediaRoutes/uploadmedia/image`, {
        method: 'POST',
        body: formData,
      });
      if (!response.ok) throw new Error('Failed to upload image');
    } catch (error) {
      console.error('Error uploading image:', error);
      alert('Failed to upload image. Please try again.');
    } finally {
      setUploadingMedia(false);
    }
  };

  const handleHeartSend = async () => {
    if (!selectedContact || sendingMessage) return;
    try {
      setSendingMessage(true);
      const wsService = wsServiceRef.current;
      if (wsService?.isConnected()) {
        wsService.sendMessage({
          type: 'message',
          senderId: selectedContact.senderId,
          tenentId: localStorage.getItem('tenentid'),
          message: "❤️",
          messageType: 'text'
        });
      }
    } catch (error) {
      console.error('Error sending heart:', error);
    } finally {
      setSendingMessage(false);
    }
  };

  const onEmojiClick = (emojiClickData: EmojiClickData) => {
    setNewMessage((prevMessage) => prevMessage + emojiClickData.emoji);
    setShowEmojiPicker(false);
  };

  const ChatWindowExpiredIndicator = () => (
    <div className="flex-shrink-0 p-4 border-t bg-white">
      <div className="flex items-center bg-gray-100 border border-gray-300 rounded-lg p-3">
        <Clock className="w-6 h-6 text-gray-600 mr-3 flex-shrink-0" />
        <div className="text-sm">
          <p className="font-semibold text-black">Conversation window expired</p>
          <p className="text-gray-700">Please send the messages from your professional Business or creator account</p>
        </div>
      </div>
    </div>
  );

  const renderLastMessage = (contact: Contact) => {
    if (!contact.lastMessage) return null;
    const { messageType, response, message } = contact.lastMessage;
    if (messageType === 'audio') return 'Voice message';
    if (messageType === 'image') return 'Image message';
    if (messageType === 'video') return 'Video message';
    if (messageType === 'template') return 'Template message';
    if (messageType === 'carousel') return 'Product carousel';
    if (messageType === 'ig_reel') return 'IG Reel message';
    const text = (typeof response === 'string' && response) ? response : (message || 'No message');
    return text.length > 40 ? text.slice(0, 40) + '...' : text;
  };

  return (
    <div className="flex overflow-hidden bg-white md:h-[91vh]" style={{ height: 'calc(100dvh - 80px)' }}>

      {/* Left Sidebar - Contact List */}
      <div className={`
        ${selectedContact ? 'hidden' : 'flex'}
        lg:flex lg:w-1/4 w-full border-r border-gray-100 bg-white p-4 overflow-hidden flex-col
      `}>
        <div className="mb-4 flex-shrink-0">
          {/* ── MOBILE search — matches ProductInventory pill style ── */}
          <div className="lg:hidden" style={{ position: 'relative' }}>
            <Search
              size={14}
              style={{
                position: 'absolute',
                left: 12,
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#9ca3af',
                pointerEvents: 'none',
              }}
            />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Search contacts..."
              style={{
                width: '100%',
                paddingLeft: 36,
                paddingRight: 14,
                paddingTop: 11,
                paddingBottom: 11,
                background: 'white',
                border: '1.5px solid #e5e7eb',
                borderRadius: 14,
                fontSize: 14,
                color: '#111827',
                outline: 'none',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                WebkitAppearance: 'none' as any,
                boxSizing: 'border-box' as any,
              }}
              onFocus={e => {
                e.currentTarget.style.borderColor = '#F57F26';
                e.currentTarget.style.boxShadow = '0 0 0 3px rgba(245,127,38,0.15)';
              }}
              onBlur={e => {
                e.currentTarget.style.borderColor = '#e5e7eb';
                e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)';
              }}
            />
          </div>

          {/* ── DESKTOP search — original style unchanged ── */}
          <div className="hidden lg:block relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
            <Input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Search"
              className="w-full pl-10 pr-4 py-2 border-gray-200 bg-gray-50 rounded-full focus:ring-0 focus:border-gray-300"
            />
          </div>
        </div>

        <div className="flex mb-4 border-b border-gray-100 w-full flex-shrink-0">
          <button
            className={`px-4 py-2 font-medium text-sm flex-1 whitespace-nowrap relative ${activeTab === 'all' ? 'text-orange-500' : 'text-gray-400 hover:text-gray-600'}`}
            onClick={() => setActiveTab('all')}
          >
            <span className="truncate">All Contacts</span>
            {activeTab === 'all' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-orange-500"></div>}
          </button>
          <button
            className={`px-4 py-2 font-medium text-sm flex-1 whitespace-nowrap relative ${activeTab === 'humanAgent' ? 'text-orange-500' : 'text-gray-400 hover:text-gray-600'}`}
            onClick={() => setActiveTab('humanAgent')}
          >
            <span className="truncate">Support Agents {totalHumanAgentCount > 0 && `(${totalHumanAgentCount})`}</span>
            {activeTab === 'humanAgent' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-orange-500"></div>}
          </button>
        </div>

        <div className="overflow-y-auto flex-1 pr-1 pb-20 md:pb-0">
          {loading ? (
            <div className="flex justify-center items-center py-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" />
            </div>
          ) : (
            <>
              {activeTab === 'humanAgent' ? (
                <>
                  {humanAgentContacts.length > 0 ? (
                    humanAgentContacts.map((contact) => (
                      <div
                        key={contact._id}
                        onClick={() => handleContactSelect(contact)}
                        className={`flex items-start p-3 rounded-xl cursor-pointer hover:bg-gray-50 mb-2 transition-colors ${selectedContact?.senderId === contact.senderId ? 'bg-orange-50' : ''}`}
                      >
                        <InstagramProfilePic
                          src={contact.profile_pic}
                          alt={contact.name === "Nil" ? contact.username : contact.name}
                          size="w-12 h-12"
                        />
                        <div className="ml-3 flex-1 min-w-0 overflow-hidden">
                          <div className="flex justify-between items-start gap-2">
                            {/* ── Contact name: lg+ keeps original, mobile matches ProductInventory label size (14px bold) ── */}
                            <span
                              className="truncate lg:font-semibold lg:text-sm font-bold text-[14px] text-gray-800"
                              style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}
                            >
                              {contact.name === "Nil" ? contact.username : contact.name}
                            </span>
                            <span className="text-xs text-gray-400 flex-shrink-0 whitespace-nowrap">
                              {contact.lastMessage ? formatLastMessageTime(contact.lastMessage.Timestamp) : formatLastMessageTime(contact.createdAt)}
                            </span>
                          </div>
                          <p className="text-sm text-gray-500 truncate">{renderLastMessage(contact)}</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-gray-500 text-center p-4">No support agents available</div>
                  )}
                  {humanAgentContacts.length > 0 && (
                    <div className="mt-3 flex space-x-4">
                      {hasMoreHumanAgents && (
                        <Button onClick={loadMoreHumanAgents} disabled={isLoadingMoreHumanAgents} className="flex-1 bg-white text-orange-500 hover:text-orange-600 border border-orange-500 hover:bg-orange-50">
                          {isLoadingMoreHumanAgents ? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-orange-500" /> : 'Load More'}
                        </Button>
                      )}
                      {showLoadLessHumanAgents && (
                        <Button onClick={handleLoadLessHumanAgents} className="flex-1 bg-white text-red-500 hover:text-red-600 border border-red-500 hover:bg-red-50">
                          Load Less
                        </Button>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <>
                  {filteredContacts.map((contact) => (
                    <div
                      key={contact._id}
                      onClick={() => handleContactSelect(contact)}
                      className={`flex items-start p-3 rounded-xl cursor-pointer hover:bg-gray-50 mb-2 transition-colors ${selectedContact?.senderId === contact.senderId ? 'bg-orange-50' : ''}`}
                    >
                      <InstagramProfilePic
                        src={contact.profile_pic}
                        alt={contact.name === "Nil" ? contact.username : contact.name}
                        size="w-12 h-12"
                      />
                      <div className="ml-3 flex-1 min-w-0 overflow-hidden">
                        <div className="flex justify-between items-start gap-2">
                          {/* ── Contact name: lg+ keeps original, mobile matches ProductInventory label size (14px bold) ── */}
                          <span
                            className="truncate lg:font-semibold lg:text-sm font-bold text-[14px] text-gray-800"
                            style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}
                          >
                            {contact.name === "Nil" ? contact.username : contact.name}
                          </span>
                          <span className="text-xs text-gray-400 flex-shrink-0 whitespace-nowrap">
                            {contact.lastMessage ? formatLastMessageTime(contact.lastMessage.Timestamp) : formatLastMessageTime(contact.createdAt)}
                          </span>
                        </div>
                        <p className="text-sm text-gray-500 truncate">{renderLastMessage(contact)}</p>
                      </div>
                    </div>
                  ))}
                  {hasMore && (
                    <Button onClick={loadMoreContacts} disabled={isLoadingMore} className="bg-white text-orange-500 hover:text-orange-600 border border-orange-500 hover:bg-orange-50 w-full mt-2">
                      {isLoadingMore ? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-orange-500" /> : 'Load More'}
                    </Button>
                  )}
                  {showLoadLess && (
                    <Button onClick={handleLoadLess} className="bg-white text-red-500 hover:text-red-600 border border-red-500 hover:bg-red-50 w-full mt-2">
                      Load Less
                    </Button>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* Right Panel - Chat Area */}
      <div className={`
        ${selectedContact ? 'flex w-full' : 'hidden'}
        lg:flex lg:flex-1 flex-col overflow-hidden bg-white min-h-0
      `}>
        {selectedContact ? (
          <>
            {/* Chat Header */}
            <div className="flex-shrink-0 p-3 sm:p-4 border-b border-gray-100 bg-white">
              <div className="flex items-center justify-between gap-2 overflow-hidden">
                <div className="flex items-center min-w-0 flex-1 overflow-hidden">
                  <button
                    onClick={() => setSelectedContact(null)}
                    className="lg:hidden p-1.5 sm:p-2 mr-1 sm:mr-2 text-gray-600 hover:text-gray-800 flex-shrink-0"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
                  </button>
                  <div className="flex-shrink-0">
                    <InstagramProfilePic
                      src={selectedContact.profile_pic}
                      alt={selectedContact.name === "Nil" ? selectedContact.username : selectedContact.name}
                      size="w-9 h-9 sm:w-10 sm:h-10"
                    />
                  </div>
                  <div className="ml-2 sm:ml-4 min-w-0 flex-1 overflow-hidden">
                    <div className="font-bold text-sm sm:text-lg text-gray-900" style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
                      {selectedContact.name === "Nil" ? selectedContact.username : selectedContact.name}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 sm:gap-3 flex-shrink-0 max-w-[40%] sm:max-w-none">
                  <select
                    value={selectedContact.chatMode || 'chat'}
                    onChange={(e) => handleChatModeChange(selectedContact.senderId, e.target.value as 'chat' | 'human')}
                    className="hidden sm:block border-gray-200 p-2 rounded-lg text-sm bg-white hover:border-orange-500 focus:ring focus:ring-orange-100 transition-colors cursor-pointer"
                  >
                    <option value="chat">🤖 Chatbot</option>
                    <option value="human">🙎‍♂️ Human Agent</option>
                  </select>
                  <select
                    value={selectedContact.chatMode || 'chat'}
                    onChange={(e) => handleChatModeChange(selectedContact.senderId, e.target.value as 'chat' | 'human')}
                    className="sm:hidden border-gray-200 p-1.5 rounded-lg text-xs bg-white hover:border-orange-500 focus:ring focus:ring-orange-100 transition-colors cursor-pointer"
                  >
                    <option value="chat">🤖</option>
                    <option value="human">🙎‍♂️</option>
                  </select>

                  <button
                    onClick={() => { setShowOrderDetails(!showOrderDetails); if (!showOrderDetails) fetchOrders(); }}
                    className="hidden sm:flex border border-gray-200 p-2 rounded-lg text-sm bg-white hover:border-orange-500 hover:bg-orange-50 text-gray-600 hover:text-orange-600 transition-colors items-center"
                  >
                    {showOrderDetails ? (
                      <><svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>Hide Orders</>
                    ) : (
                      <><svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>Orders</>
                    )}
                  </button>
                  <button
                    onClick={() => { setShowOrderDetails(!showOrderDetails); if (!showOrderDetails) fetchOrders(); }}
                    className="sm:hidden border border-gray-200 p-1.5 rounded-lg text-xs bg-white hover:border-orange-500 hover:bg-orange-50 text-gray-600 hover:text-orange-600 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                    </svg>
                  </button>
                </div>
              </div>

              {showOrderDetails && (
                <div className="mt-3 p-3 border-t border-gray-100 bg-gray-50 rounded-lg max-h-[250px] overflow-y-auto">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-gray-800">Orders</h3>
                    <span className="text-lg font-bold text-orange-500">{totalOrderCount}</span>
                  </div>
                  {latestOrders.length > 0 ? (
                    <div className="space-y-2">
                      {latestOrders[0] && (
                        <div className="bg-white p-3 rounded-lg border border-gray-100 shadow-sm">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="text-sm font-semibold text-gray-800">Latest Order</h4>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(latestOrders[0].status)}`}>
                              {latestOrders[0].status}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div><span className="text-gray-500">Order ID:</span><p className="font-medium text-gray-900">#{latestOrders[0].orderId}</p></div>
                            <div><span className="text-gray-500">Amount:</span><p className="font-medium text-green-600">₹{latestOrders[0].total_amount}</p></div>
                            <div><span className="text-gray-500">Date:</span><p className="font-medium text-gray-900">{formatOrderDate(latestOrders[0].timestamp)}</p></div>
                            <div><span className="text-gray-500">Payment:</span><p className="font-medium text-gray-900">{latestOrders[0].paymentStatus}</p></div>
                          </div>
                          {latestOrders[0].tracking_number && (
                            <div className="mt-2">
                              <span className="text-gray-500 text-xs">Tracking:</span>
                              <p className="font-mono text-xs text-gray-700">{latestOrders[0].tracking_number}</p>
                            </div>
                          )}
                          <div className="flex space-x-2 mt-2">
                            <button className="px-2 py-1 bg-orange-500 text-white rounded text-xs hover:bg-orange-600 transition-colors">View</button>
                            <button className="px-2 py-1 bg-gray-200 text-gray-700 rounded text-xs hover:bg-gray-300 transition-colors">Details</button>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-4 text-gray-500">
                      <svg className="mx-auto h-8 w-8 text-gray-300 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                      </svg>
                      <p className="text-xs">No orders found</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Messages Area */}
            <div className="flex-1 min-h-0 overflow-y-auto bg-white">
              <div className="flex flex-col p-4 sm:p-6">
                {messages.length === 0 ? (
                  <div className="text-center text-gray-400 mt-10">No messages yet</div>
                ) : (
                  <div className="flex flex-col space-y-4">
                    {messages.map((message, index) => (
                      <div key={message._id}>
                        {shouldShowDate(messages, index) && (
                          <div className="flex justify-center my-4">
                            <div className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                              {formatMessageDate(message.Timestamp)}
                            </div>
                          </div>
                        )}

                        {message.messageType === 'carousel' ? (
                          <CarouselMessage
                            message={message as any}
                            isOutgoing={message.senderId !== selectedContact?.senderId}
                            onButtonClick={handleTemplateButtonClick}
                          />
                        ) : message.messageType === 'video' ? (
                          <VideoMessage message={message} selectedContact={selectedContact} formatMessageTime={formatMessageTime} />
                        ) : message.messageType === 'image' ? (
                          <ImageMessage message={message} selectedContact={selectedContact} formatMessageTime={formatMessageTime} />
                        ) : message.messageType === 'audio' ? (
                          <>
                            <AudioMessage
                              audioUrl={message.audioUrl}
                              transcription={message.transcription}
                              timestamp={formatMessageTime(message.Timestamp)}
                              isOutgoing={message.senderId !== selectedContact?.senderId}
                              message={message.message}
                            />
                            {message.response && typeof message.response === 'string' && message.response !== 'Audio message' && message.response !== 'Carousel Message' && (
                              <div className="flex justify-end mt-2 items-end">
                                <div className="max-w-[75%] min-w-0 rounded-2xl rounded-tr-sm px-4 py-3 bg-gray-100 text-gray-800">
                                  <p style={msgTextStyle} className="leading-relaxed text-[15px]">{message.response}</p>
                                  <div className="text-xs text-gray-400 mt-1 text-right">{formatMessageTime(message.Timestamp)}</div>
                                </div>
                              </div>
                            )}
                          </>
                        ) : message.messageType === 'template' ? (
                          <TemplateMessage
                            message={message as unknown as TemplateMessageProps['message']}
                            isOutgoing={message.senderId !== selectedContact?.senderId}
                            onButtonClick={handleTemplateButtonClick}
                          />
                        ) : (
                          <>
                            {/* Incoming message (from contact) */}
                            {message.senderId === selectedContact?.senderId && message.message && (
                              <div className="flex justify-start items-end mb-1">
                                <div className="flex-shrink-0 mr-2">
                                  <InstagramProfilePic
                                    src={selectedContact.profile_pic}
                                    alt="profile"
                                    size="w-8 h-8"
                                    borderSize="p-[2px]"
                                  />
                                </div>
                                <div
                                  className="max-w-[75%] min-w-0 rounded-2xl rounded-tl-sm px-4 py-3 text-[15px] leading-relaxed shadow-sm bg-gray-100 text-gray-900"
                                  style={{ minWidth: 0 }}
                                >
                                  <p style={msgTextStyle}>
                                    {typeof message.message === 'string' ? message.message : ''}
                                  </p>
                                  <div className="text-xs text-gray-400 mt-1">
                                    {formatMessageTime(message.Timestamp)}
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Outgoing message (sent by agent) */}
                            {message.senderId !== selectedContact?.senderId && message.message && (
                              <div className="flex justify-end items-end mb-1">
                                <div
                                  className="max-w-[75%] min-w-0 rounded-2xl rounded-tr-sm px-4 py-3 text-[15px] leading-relaxed shadow-sm bg-[#FAE8D6] text-gray-900"
                                  style={{ minWidth: 0 }}
                                >
                                  <p style={msgTextStyle}>
                                    {typeof message.message === 'string' ? message.message : ''}
                                  </p>
                                  <div className="text-xs text-gray-500 mt-1 text-right">
                                    {formatMessageTime(message.Timestamp)}
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Bot/agent response bubble */}
                            {message.response && typeof message.response === 'string' && (
                              <div className="flex justify-end items-end mb-1">
                                <div
                                  className="max-w-[75%] min-w-0 rounded-2xl rounded-tr-sm px-4 py-3 text-[15px] leading-relaxed shadow-sm bg-[#FAE8D6] text-gray-900"
                                  style={{ minWidth: 0 }}
                                >
                                  <p style={msgTextStyle}>{message.response}</p>
                                  <div className="text-xs text-gray-500 mt-1 text-right">
                                    {formatMessageTime(message.Timestamp)}
                                  </div>
                                </div>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </div>

            {/* Input or expired indicator */}
            {isWindowExpired ? (
              <ChatWindowExpiredIndicator />
            ) : (
              <div className="flex-shrink-0 p-4 sm:p-6 bg-white border-t border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="flex-1 flex items-center bg-gray-50 rounded-2xl px-4 py-3 border border-gray-100 focus-within:ring-2 focus-within:ring-orange-100 transition-all min-w-0">

                    {/* Emoji Trigger */}
                    <div className="relative flex-shrink-0">
                      <button
                        className="p-1 text-gray-400 hover:text-orange-500 transition-colors focus:outline-none mr-2"
                        onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/>
                          <line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/>
                        </svg>
                      </button>
                      {showEmojiPicker && (
                        <div className="absolute bottom-12 left-0 z-10 shadow-xl rounded-xl overflow-hidden">
                          <EmojiPicker onEmojiClick={onEmojiClick} theme={Theme.LIGHT} width={300} height={400} />
                        </div>
                      )}
                    </div>

                    <Input
                      type="text"
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                      placeholder="Type Something..."
                      className="flex-1 min-w-0 border-0 bg-transparent focus:ring-0 focus:outline-none text-gray-700 placeholder-gray-400 text-sm"
                      disabled={sendingMessage}
                    />

                    {/* Image Attachment */}
                    <label htmlFor="image-upload" className="p-1 text-gray-400 hover:text-gray-600 cursor-pointer mx-1 flex-shrink-0">
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/>
                        <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
                      </svg>
                      <input id="image-upload" type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                    </label>

                    {/* Heart Button */}
                    {!newMessage.trim() && (
                      <button
                        className="p-1 text-gray-400 hover:text-red-500 transition-colors focus:outline-none ml-1 flex-shrink-0"
                        onClick={handleHeartSend}
                        disabled={sendingMessage}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>
                        </svg>
                      </button>
                    )}
                  </div>

                  {/* Send Button */}
                  <Button
                    onClick={handleSend}
                    disabled={sendingMessage || (!newMessage.trim() && !uploadingMedia)}
                    className={`h-[50px] w-[50px] flex-shrink-0 rounded-xl flex items-center justify-center transition-all shadow-md ${
                      newMessage.trim()
                        ? 'bg-gradient-to-r from-red-600 to-orange-400 hover:shadow-lg hover:opacity-90'
                        : 'bg-gray-200 cursor-not-allowed'
                    }`}
                  >
                    {sendingMessage
                      ? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
                      : <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2 11 13" /><path d="m22 2-7 20-4-9-9-4 20-7Z" /></svg>
                    }
                  </Button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-400 bg-gray-50">
            <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center mb-4 shadow-sm">
              <svg className="w-10 h-10 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <p className="text-lg font-medium text-gray-500">Select a contact to start chatting</p>
          </div>
        )}
      </div>
    </div>
  );
}
