import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Bot, ShoppingBag, Activity,
  MessageSquare, Package, IndianRupee, GalleryHorizontal, Send,
  MessageCircle, Plus, History as HistoryIcon, X
} from 'lucide-react';
import chatbotLogo from '../assets/chatbotlogo.png';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import EmojiPicker, { EmojiClickData, Theme } from 'emoji-picker-react';

// ----------------- CONFIG -----------------
const API_BASE_URL_CHATBOT = "https://snaking-outhouse-oppose.ngrok-free.dev/api/dashboardroute/chatbot";
const API_BASE_URL_DASHBOARD = "https://snaking-outhouse-oppose.ngrok-free.dev/api/dashboardroute";

// ----------------- TYPES -----------------
interface Message {
  text: string;
  sender: 'user' | 'bot';
  Timestamp?: string;
}

interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  timestamp: Date;
}

interface DashboardStats {
  totalResponses: number;
  botMessages: number;
  robotMessages: number;
  templateMessages: number;
  carouselMessages: number;
  commentReplies: number;
  totalOrders: number;
  totalOrderAmount: number;
  loading: boolean;
  allTimeStats: {
    totalOrders: number;
    totalRevenue: number;
    totalCount: number;
    activeCustomers?: number;
    totalStoryComments: number;
  };
  monthlyRevenueData: {
    month: string;
    revenue: number;
    cost: number;
  }[];
}

interface InstagramProfile {
  id: string;
  username: string;
  name: string;
  account_type: string;
  profile_picture_url: string;
  followers_count: number;
  follows_count: number;
  media_count: number;
}

interface InstagramDataState {
  profile: InstagramProfile | null;
  loading: boolean;
  error: string | null;
}

const EMPTY_STATS: DashboardStats = {
  totalResponses: 0, botMessages: 0, robotMessages: 0,
  templateMessages: 0, carouselMessages: 0, commentReplies: 0,
  totalOrders: 0, totalOrderAmount: 0, loading: true,
  allTimeStats: { totalOrders: 0, totalRevenue: 0, totalCount: 0, activeCustomers: 0, totalStoryComments: 0 },
  monthlyRevenueData: [],
};

// ----------------- SKELETON -----------------
const Skeleton = ({ className = '', style = {} }: { className?: string; style?: React.CSSProperties }) => (
  <div
    className={`rounded-lg ${className}`}
    style={{
      background: 'linear-gradient(90deg,#e5e7eb 25%,#f3f4f6 50%,#e5e7eb 75%)',
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.6s infinite',
      ...style,
    }}
  />
);

// ----------------- DONUT -----------------
const MiniDonut = ({
  percentage, id, size = 60, strokeWidth = 6, color = '#E86C15',
}: { percentage: number; id: string; color?: string; size?: number; strokeWidth?: number }) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const safePct = Math.min(Math.max(isNaN(percentage) ? 0 : percentage, 0), 100);
  const offset = circumference - (safePct / 100) * circumference;
  return (
    <div className="relative flex items-center justify-center shrink-0" style={{ width: size, height: size }}>
      <svg className="transform -rotate-90 w-full h-full drop-shadow-sm">
        <defs>
          <linearGradient id={id} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={color} />
            <stop offset="100%" stopColor={color === '#E86C15' ? '#D63031' : color} />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={radius} stroke="#F3E9E2" strokeWidth={strokeWidth} fill="transparent" strokeLinecap="round" />
        <circle cx={size / 2} cy={size / 2} r={radius} stroke={`url(#${id})`} strokeWidth={strokeWidth} fill="transparent"
          strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
          className="transition-all duration-1000 ease-out" />
      </svg>
    </div>
  );
};

// ----------------- ANIMATED COUNTER -----------------
const AnimatedCounter = ({ value, formatter }: { value: number; formatter?: (n: number) => string }) => {
  const [count, setCount] = useState(0);
  const rafRef = useRef<number | null>(null);
  useEffect(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    const start = Date.now();
    const to = isNaN(value) ? 0 : value;
    const tick = () => {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / 1200, 1);
      const ease = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      setCount(Math.floor(ease * to));
      if (progress < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [value]);
  return <>{formatter ? formatter(count) : count}</>;
};

// ----------------- STAT VALUE (with skeleton) -----------------
const StatValue = ({
  loading, value, prefix = '', formatter, large = false,
}: { loading: boolean; value: number; prefix?: string; formatter?: (n: number) => string; large?: boolean }) => {
  if (loading) return <Skeleton className={large ? 'h-10 w-28 mt-1' : 'h-8 w-20 mt-1'} />;
  return (
    <h3 className={`${large ? 'text-4xl' : 'text-3xl'} font-semibold text-gray-900 tracking-tight leading-none stat-fade`}>
      {prefix}<AnimatedCounter value={value} formatter={formatter} />
    </h3>
  );
};

// =================== CHATBOT ===================
function Chatbot() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string>('');
  const [isChatbotOpen, setIsChatbotOpen] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const tenentId = localStorage.getItem('tenentid');
  const initialBotMessage: Message = { sender: 'bot', text: "Hello! 🛍️ I'm Instaxbot.\nHow can I help you today?" };

  useEffect(() => {
    try {
      const saved = localStorage.getItem('chatSessions');
      if (saved) setChatSessions(JSON.parse(saved).map((s: any) => ({ ...s, timestamp: new Date(s.timestamp) })));
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (chatSessions.length > 0) localStorage.setItem('chatSessions', JSON.stringify(chatSessions));
  }, [chatSessions]);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, isLoading]);

  const startNewChat = useCallback(() => {
    const id = Date.now().toString();
    const session: ChatSession = { id, title: 'New Chat', messages: [initialBotMessage], timestamp: new Date() };
    setChatSessions(prev => [session, ...prev]);
    setCurrentSessionId(id);
    setMessages([initialBotMessage]);
    setShowHistory(false);
  }, []);

  useEffect(() => {
    if (isChatbotOpen && !currentSessionId) {
      if (chatSessions.length > 0) loadChatSession(chatSessions[0].id);
      else startNewChat();
    }
  }, [isChatbotOpen]);

  const loadChatSession = (sessionId: string) => {
    const session = chatSessions.find(s => s.id === sessionId);
    if (session) { setCurrentSessionId(sessionId); setMessages(session.messages); setShowHistory(false); }
  };

  const updateCurrentSession = (updatedMessages: Message[], sessId: string) => {
    setChatSessions(prev => prev.map(session => {
      if (session.id !== sessId) return session;
      let title = session.title;
      const firstUser = updatedMessages.find(m => m.sender === 'user');
      if (title === 'New Chat' && firstUser)
        title = firstUser.text.slice(0, 20) + (firstUser.text.length > 20 ? '...' : '');
      return { ...session, title, messages: updatedMessages, timestamp: new Date() };
    }));
  };

  const deleteChatSession = (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newSessions = chatSessions.filter(s => s.id !== sessionId);
    setChatSessions(newSessions);
    if (sessionId === currentSessionId) {
      if (newSessions.length > 0) loadChatSession(newSessions[0].id);
      else startNewChat();
    }
  };

  const handleSendMessage = async () => {
    const text = inputValue.trim();
    if (!text || isLoading) return;
    const userMsg: Message = { text, sender: 'user' };
    const withUser = [...messages, userMsg];
    setMessages(withUser);
    updateCurrentSession(withUser, currentSessionId);
    setInputValue('');
    setIsLoading(true);
    let senderId = localStorage.getItem('instaxbot_sender');
    if (!senderId) { senderId = 'web-' + Date.now(); localStorage.setItem('instaxbot_sender', senderId); }
    try {
      const res = await fetch(API_BASE_URL_CHATBOT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
        body: JSON.stringify({ query: text, tenentId, senderId, username: 'Instaxbot' }),
      });
      const data = await res.json();
      const botMsg: Message = { sender: 'bot', text: data.reply?.text || data.reply || "I didn't catch that." };
      const final = [...withUser, botMsg];
      setMessages(final);
      updateCurrentSession(final, currentSessionId);
    } catch {
      const errMsg: Message = { sender: 'bot', text: 'Connection error. Please try again.' };
      const final = [...withUser, errMsg];
      setMessages(final);
      updateCurrentSession(final, currentSessionId);
    } finally { setIsLoading(false); }
  };

  const onEmojiClick = (d: EmojiClickData) => { setInputValue(p => p + d.emoji); setShowEmojiPicker(false); };

  return (
    <>
      {!isChatbotOpen && (
        <button onClick={() => setIsChatbotOpen(true)}
          className="fixed bottom-6 right-6 md:bottom-8 md:right-8 w-12 h-12 md:w-14 md:h-14 bg-gradient-to-r from-[#F57F26] to-[#D63031] rounded-full shadow-2xl flex items-center justify-center text-white hover:scale-110 transition-transform z-[9999]">
          <Bot size={24} className="md:w-7 md:h-7" fill="currentColor" />
        </button>
      )}
      {isChatbotOpen && (
        <div className="fixed bottom-6 right-6 md:bottom-8 md:right-8 w-[calc(100vw-32px)] sm:w-[340px] h-[500px] max-h-[80vh] bg-white rounded-2xl shadow-2xl flex flex-col border border-gray-100 z-[9999] overflow-hidden font-['Poppins'] animate-in slide-in-from-bottom-10 duration-300">
          <div className="bg-gradient-to-r from-[#F57F26] to-[#D63031] text-white p-4 flex justify-between items-center z-20">
            <div className="flex items-center gap-2">
              <div className="bg-white/20 p-1.5 rounded-full"><Bot size={18} /></div>
              <h3 className="font-semibold text-sm">InstaxBot</h3>
            </div>
            <div className="flex gap-1">
              <button onClick={startNewChat} className="hover:bg-white/20 p-1.5 rounded"><Plus size={16} /></button>
              <button onClick={() => setShowHistory(!showHistory)} className="hover:bg-white/20 p-1.5 rounded"><HistoryIcon size={16} /></button>
              <button onClick={() => setIsChatbotOpen(false)} className="hover:bg-white/20 p-1.5 rounded"><X size={16} /></button>
            </div>
          </div>
          {showHistory && (
            <div className="absolute top-[60px] left-0 w-full h-[calc(100   %-60px)] bg-white z-30 flex flex-col">
              <div className="p-2 bg-gray-50 border-b border-gray-100 font-semibold text-gray-600 text-xs px-4">Recent Chats</div>
              <div className="flex-1 overflow-y-auto">
                {chatSessions.length === 0 && <p className="text-xs text-gray-400 text-center mt-8">No chat history yet.</p>}
                {chatSessions.map(session => (
                  <div key={session.id} onClick={() => loadChatSession(session.id)}
                    className={`p-3 border-b border-gray-50 flex justify-between items-center cursor-pointer hover:bg-gray-50 ${currentSessionId === session.id ? 'bg-orange-50' : ''}`}>
                    <div className="flex items-center gap-3 overflow-hidden">
                      <MessageCircle size={16} className="text-gray-400 flex-shrink-0" />
                      <span className="text-xs font-medium text-gray-800 truncate w-48">{session.title}</span>
                    </div>
                    <button onClick={(e) => deleteChatSession(session.id, e)} className="text-gray-400 hover:text-red-500 p-1 flex-shrink-0"><X size={14} /></button>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="flex-1 p-4 overflow-y-auto bg-gray-50">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.sender === 'user' ? 'justify-end' : 'justify-start'} mb-3`}>
                <div className={`max-w-[80%] p-3 rounded-2xl text-xs whitespace-pre-line ${m.sender === 'user' ? 'bg-black text-white rounded-br-none' : 'bg-white text-gray-800 rounded-bl-none shadow-sm'}`}>
                  {m.text}  
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start mb-3">
                <div className="w-6 h-6 rounded-full bg-gradient-to-r from-[#F57F26] to-[#D63031] flex items-center justify-center text-white mr-2"><Bot size={12} /></div>
                <div className="bg-white p-3 rounded-2xl rounded-bl-none shadow-sm flex gap-1 items-center">
                  {[0, 1, 2].map(i => <div key={i} className="w-1.5 h-1.5 bg-gray-400 rounded-full" style={{ animation: `bounce 1s infinite ${i * 0.2}s` }} />)}
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
          <div className="p-3 bg-white border-t flex gap-2 relative">
            <div className="flex-1 flex items-center bg-gray-100 rounded-full px-3 py-2 focus-within:ring-1 focus-within:ring-[#F57F26]">
              <button className="p-1 text-gray-400 hover:text-orange-500 transition-colors focus:outline-none mr-1 flex-shrink-0"
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}>
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" /><path d="M8 14s1.5 2 4 2 4-2 4-2" />
                  <line x1="9" y1="9" x2="9.01" y2="9" /><line x1="15" y1="9" x2="15.01" y2="9" />
                </svg>
              </button>
              {showEmojiPicker && (
                <div className="absolute bottom-16 left-2 z-50 shadow-xl rounded-xl overflow-hidden">
                  <EmojiPicker onEmojiClick={onEmojiClick} theme={Theme.LIGHT} width={280} height={360} />
                </div>
              )}
              <Input className="flex-1 border-0 bg-transparent focus:ring-0 focus:outline-none text-gray-700 placeholder-gray-400 text-xs h-auto p-0"
                placeholder="Ask anything..." value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                disabled={isLoading} />
            </div>
            <Button onClick={handleSendMessage} disabled={isLoading || !inputValue.trim()}
              className="bg-gradient-to-r from-[#F57F26] to-[#D63031] text-white p-0 rounded-full hover:opacity-90 disabled:opacity-40 transition-all flex-shrink-0 w-9 h-9">
              <Send size={14} />
            </Button>
          </div>
        </div>
      )}
    </>
  );
}

// =================== MAIN DASHBOARD ===================
export default function Dashboard() {
  const [tenentId] = useState<string | null>(() => localStorage.getItem('tenentid'));
  const [timeframe, setTimeframe] = useState<'today' | 'last7days' | 'last30days'>('today');
  const [statsLoading, setStatsLoading] = useState(true);
  const [instagramData, setInstagramData] = useState<InstagramDataState>({ profile: null, loading: true, error: null });
  const [stats, setStats] = useState<DashboardStats>({ ...EMPTY_STATS });

  const fetchAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!tenentId) return;
    setInstagramData({ profile: null, loading: true, error: null });
    fetch(`${API_BASE_URL_DASHBOARD}/instagram-data?tenentId=${tenentId}`, {
      headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
    })
      .then(r => r.json())
      .then(result => {
        if (result.success) setInstagramData({ profile: result.data.profile, loading: false, error: null });
        else setInstagramData({ profile: null, loading: false, error: result.message || 'Failed' });
      })
      .catch(() => setInstagramData({ profile: null, loading: false, error: 'Network error' }));
  }, [tenentId]);

  useEffect(() => {
    if (!tenentId) return;
    if (fetchAbortRef.current) fetchAbortRef.current.abort();
    const controller = new AbortController();
    fetchAbortRef.current = controller;
    setStats({ ...EMPTY_STATS, loading: true });
    setStatsLoading(true);
    fetch(
      `${API_BASE_URL_DASHBOARD}/dashboard?timeframe=${timeframe}&tenentId=${tenentId}`,
      { headers: { 'ngrok-skip-browser-warning': 'true' }, signal: controller.signal }
    )
      .then(r => r.json())
      .then(d => {
        if (!d.success) throw new Error(d.message || 'API returned success:false');
        setStats({
          totalResponses: d.totalResponses ?? 0,
          botMessages: d.botMessages ?? 0,
          robotMessages: d.robotMessages ?? 0,
          templateMessages: d.templateMessages ?? 0,
          carouselMessages: d.carouselMessages ?? 0,
          commentReplies: d.commentReplies ?? 0,
          totalOrders: d.totalOrders ?? 0,
          totalOrderAmount: d.totalOrderAmount ?? 0,
          loading: false,
          allTimeStats: {
            totalOrders: d.allTimeStats?.totalOrders ?? 0,
            totalRevenue: d.allTimeStats?.totalRevenue ?? 0,
            totalCount: d.allTimeStats?.totalCount ?? 0,
            activeCustomers: d.allTimeStats?.activeCustomers ?? 0,
            totalStoryComments: d.allTimeStats?.totalStoryComments ?? 0,
          },
          monthlyRevenueData: Array.isArray(d.monthlyRevenueData) ? d.monthlyRevenueData : [],
        });
        setStatsLoading(false);
      })
      .catch(err => {
        if (err.name === 'AbortError') return;
        console.error('[Dashboard] Fetch error:', err);
        setStats(prev => ({ ...prev, loading: false }));
        setStatsLoading(false);
      });
    return () => controller.abort();
  }, [tenentId, timeframe]);

  const formatCount = (num: number) =>
    num >= 1_000_000 ? (num / 1_000_000).toFixed(1) + 'M'
      : num >= 1_000 ? (num / 1_000).toFixed(1) + 'k'
        : String(num);

  const yAxisLabels = ['50k', '40k', '30k', '20k', '10k', '0'];
  const MAX_CHART_VAL = 50000;
  const ordersDonutPct = stats.totalOrders > 0 ? Math.min((stats.totalOrders / 50) * 100, 100) : 0;
  const revenueDonutPct = stats.totalOrderAmount > 0 ? Math.min((stats.totalOrderAmount / 10000) * 100, 100) : 0;
  const timeLabel = timeframe === 'today' ? 'Today' : timeframe === 'last7days' ? 'Last 7 Days' : 'Last 30 Days';

  const cardBase = 'bg-white rounded-[20px] shadow-[0_4px_20px_rgb(0,0,0,0.03)] border border-gray-100 flex flex-col';
  const innerCard = 'bg-[#F9FAFB] rounded-[16px] p-3 flex flex-col justify-between relative hover:bg-gray-100 transition-colors border border-transparent hover:border-gray-200/50 overflow-visible';
  const iconBox = 'bg-[#FFF7ED] rounded-xl w-8 h-8 flex items-center justify-center text-[#E86C15] shadow-sm shrink-0';

  if (!tenentId) return (
    <div className="h-screen w-screen flex items-center justify-center bg-[#F6F6F6] text-gray-500 font-medium font-['Poppins']">
      Please log in to continue.
    </div>
  );

  // Reusable profile stats block
  const ProfileStats = () => (
    <>
      <h2 className="mobile-profile-name text-lg font-semibold text-gray-900 leading-tight">
        {instagramData.profile?.name || instagramData.profile?.username || '—'}
      </h2>
      {/* FIX 1: justify-between spreads items evenly, gap-6 adds comfortable spacing */}
      <div className="mobile-profile-stats flex items-center justify-between mt-4 w-full px-1">
        {[
          { val: instagramData.profile?.media_count ?? 0, label: 'Posts', fmt: undefined },
          { val: instagramData.profile?.followers_count ?? 0, label: 'Followers', fmt: formatCount },
          { val: instagramData.profile?.follows_count ?? 0, label: 'Following', fmt: undefined },
        ].map(({ val, label, fmt }, i) => (
          <div key={label} className={`text-center flex-1 ${i !== 2 ? 'border-r border-gray-200' : ''}`}>
            <span className="mobile-stat-value block text-xl font-semibold text-gray-900 leading-none">
              <AnimatedCounter value={val} formatter={fmt} />
            </span>
            {/* FIX 3: mt-1 gives breathing room between number and label */}
            <span className="mobile-stat-label text-xs text-gray-500 font-medium mt-1 block">{label}</span>
          </div>
        ))}
      </div>
    </>
  );

  return (
    <div className="min-h-screen w-full bg-[#F6F6F6] font-['Poppins'] text-[#2D3436] flex flex-col">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap');

        @keyframes shimmer {
          0%   { background-position: -200% 0; }
          100% { background-position:  200% 0; }
        }
        @keyframes bounce {
          0%,80%,100% { transform:scale(0); opacity:.4; }
          40%          { transform:scale(1); opacity:1;  }
        }
        @keyframes fadeSlideIn {
          from { opacity:0; transform:translateY(6px); }
          to   { opacity:1; transform:translateY(0);   }
        }
        .stat-fade { animation: fadeSlideIn 0.35s ease forwards; }

        /* === Pill tabs === */
        .pill-tab {
          font-size: 11px; font-weight: 600;
          padding: 6px 13px; border-radius: 999px;
          border: none; cursor: pointer; outline: none;
          transition: all 0.2s cubic-bezier(0.4,0,0.2,1);
          white-space: nowrap;
        }
        .pill-tab.active {
          background: linear-gradient(135deg,#F57F26,#D63031);
          color: #fff;
          box-shadow: 0 3px 10px rgba(214,48,49,.30);
        }
        .pill-tab:not(.active)       { background:transparent; color:#6b7280; }
        .pill-tab:not(.active):hover { background:#f3f4f6;     color:#374151; }

        /* === Stats quad grid — true 2x2 equal grid === */
        .stats-quad-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          padding: 12px;
        }
        .stats-equal-card {
          min-height: 130px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
        }

        /* === Mobile reorder: profile first, then tabs, hide header text === */
        @media (max-width:767px) {
          /* Hide "Hey Buddy!" header text on mobile */
          .mobile-header-text { display: none !important; }
          /* Shrink header height since text is hidden */
          .mobile-header { height: 0 !important; padding: 0 !important; overflow: hidden !important; }

          /* Reorder: profile card before tabs using order */
          .mobile-profile-order { order: -2; }
          .mobile-tabs-order    { order: -1; }

          .mobile-profile-card   { padding:14px !important; }
          .mobile-profile-inner  { flex-direction:row !important; align-items:center !important; gap:12px !important; }
          .mobile-profile-avatar { width:48px !important; height:48px !important; flex-shrink:0 !important; }
          .mobile-profile-info   { align-items:flex-start !important; text-align:left !important; }
          .mobile-profile-name   { font-size:14px !important; }

          /* FIX 1 (mobile): ensure stats row fills available width with even spacing */
          .mobile-profile-stats  { justify-content:space-between !important; margin-top:10px !important; padding:0 2px !important; }
          .mobile-stat-value     { font-size:15px !important; }
          .mobile-stat-label     { font-size:10px !important; margin-top:3px !important; }

          .stats-quad-grid       { gap: 8px !important; padding: 10px !important; }
          .stats-equal-card      { min-height: 118px !important; }
          .stats-equal-card h3   { font-size: 24px !important; }

          .mobile-daily-stats-grid       { grid-template-columns:1fr 1fr !important; gap:8px !important; }
          .mobile-daily-stats-grid > div { min-height:95px !important; }
          .mobile-daily-stats-grid h3    { font-size:20px !important; }
          .mobile-bot-stats-grid         { grid-template-columns:1fr 1fr !important; gap:8px !important; }
          .mobile-bot-responses-full     { grid-column:span 2 !important; }
          .mobile-bot-stats-grid > div   { min-height:95px !important; }
          .mobile-bot-stats-grid h3      { font-size:20px !important; }
          .mobile-chart-card             { height:240px !important; padding:12px !important; }
          .mobile-section-gap            { gap:10px !important; }
          .mobile-header                 { padding-left:14px !important; padding-right:14px !important; }
          .mobile-header h1              { font-size:16px !important; }

          /* FIX 2: Extra bottom padding so content isn't hidden behind fixed bottom nav */
          .mobile-outer-padding {
            padding-left:10px !important;
            padding-right:10px !important;
            padding-bottom:90px !important;
          }
        }
      `}</style>

      {/* ===== HEADER ===== */}
      <div className="mobile-header shrink-0 flex items-center justify-between px-4 md:px-8 h-14 bg-[#F6F6F6] sticky top-0 z-40">
        <div className="mobile-header-text">
          <h1 className="text-lg md:text-xl font-semibold text-[#E86C15] tracking-tight">Hey Buddy!</h1>
          <p className="text-[10px] md:text-xs text-gray-400 font-medium">
            Your InstaX bot is ready to put your success in the spotlight.
          </p>
        </div>
      </div>

      {/* ===== MOBILE PROFILE CARD (shown only on mobile, above tabs) ===== */}
      <div className="mobile-profile-order md:hidden px-4 pb-2 pt-3 bg-[#F6F6F6]">
        <div className={`${cardBase} mobile-profile-card p-4`}>
          <div className="mobile-profile-inner flex flex-col sm:flex-row items-center sm:items-start gap-4">
            <div className="mobile-profile-avatar w-16 h-16 rounded-full bg-gradient-to-tr from-[#D63031] to-[#E86C15] p-[3px] shrink-0 shadow-sm">
              <div className="bg-white p-[2px] rounded-full w-full h-full overflow-hidden">
                {instagramData.loading ? (
                  <Skeleton className="w-full h-full rounded-full" />
                ) : (
                  <img
                    src={instagramData.profile?.profile_picture_url || chatbotLogo}
                    className="w-full h-full rounded-full object-cover"
                    alt="profile"
                    onError={(e) => { (e.target as HTMLImageElement).src = chatbotLogo; }}
                  />
                )}
              </div>
            </div>
            <div className="mobile-profile-info flex flex-col flex-1 w-full items-center sm:items-start text-center sm:text-left">
              {instagramData.loading ? (
                <p className="text-sm font-medium text-gray-400 animate-pulse">Loading...</p>
              ) : (
                <ProfileStats />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ===== PILL TIMEFRAME FILTER ===== */}
      <div className="mobile-tabs-order flex justify-center px-4 pb-2 sticky top-0 z-30 bg-[#F6F6F6]">
        <div className="inline-flex items-center gap-0.5 bg-white rounded-full px-1 py-1 shadow-md border border-gray-100">
          {(['today', 'last7days', 'last30days'] as const).map(tf => (
            <button
              key={tf}
              className={`pill-tab ${timeframe === tf ? 'active' : ''}`}
              onClick={() => setTimeframe(tf)}
            >
              {tf === 'today' ? 'Today' : tf === 'last7days' ? 'Last 7 Days' : 'Last 30 Days'}
            </button>
          ))}
        </div>
      </div>

      {/* ===== MAIN CONTENT ===== */}
      <div className="mobile-outer-padding flex-1 px-4 md:px-8 pb-6 md:pb-8 max-w-[1920px] mx-auto w-full">
        <div className="mobile-section-gap grid grid-cols-1 md:grid-cols-12 gap-5">

          {/* ============ LEFT COLUMN ============ */}
          <div className="mobile-section-gap col-span-1 md:col-span-12 xl:col-span-5 flex flex-col gap-5">

            {/* 1 — Profile Card (hidden on mobile since shown above, visible on md+) */}
            <div className={`${cardBase} mobile-profile-card p-4 hidden md:flex`}>
              <div className="mobile-profile-inner flex flex-col sm:flex-row items-center sm:items-start gap-4">
                <div className="mobile-profile-avatar w-16 h-16 rounded-full bg-gradient-to-tr from-[#D63031] to-[#E86C15] p-[3px] shrink-0 shadow-sm">
                  <div className="bg-white p-[2px] rounded-full w-full h-full overflow-hidden">
                    {instagramData.loading ? (
                      <Skeleton className="w-full h-full rounded-full" />
                    ) : (
                      <img
                        src={instagramData.profile?.profile_picture_url || chatbotLogo}
                        className="w-full h-full rounded-full object-cover"
                        alt="profile"
                        onError={(e) => { (e.target as HTMLImageElement).src = chatbotLogo; }}
                      />
                    )}
                  </div>
                </div>
                <div className="mobile-profile-info flex flex-col flex-1 w-full items-center sm:items-start text-center sm:text-left">
                  {instagramData.loading ? (
                    <p className="text-sm font-medium text-gray-400 animate-pulse">Loading...</p>
                  ) : (
                    <ProfileStats />
                  )}
                </div>
              </div>
            </div>

            {/* 2 — Stats Quad (all-time numbers) — FIXED 2x2 GRID */}
            <div className={`${cardBase} p-0`}>
              <div className="stats-quad-grid">

                {/* Total Revenue */}
                <div
                  className="stats-equal-card rounded-[16px] p-3 flex flex-col justify-between text-white shadow-sm relative"
                  style={{
                    background: 'linear-gradient(135deg,#C90000 0%,#D74100 44%,#DE6100 68%,#DF7701 100%)',
                  }}
                >
                  <div className="flex justify-between items-center w-full">
                    <span className="text-xs font-medium">Total Revenue</span>
                    <div className={iconBox}><IndianRupee size={14} /></div>
                  </div>
                  <div className="mt-auto pt-2">
                    {statsLoading ? (
                      <Skeleton className="h-8 w-20 opacity-40" style={{
                        background: 'linear-gradient(90deg,rgba(255,255,255,.25) 25%,rgba(255,255,255,.45) 50%,rgba(255,255,255,.25) 75%)',
                        backgroundSize: '200% 100%', animation: 'shimmer 1.6s infinite',
                      }} />
                    ) : (
                      <h3 className="text-3xl font-semibold tracking-tight leading-none stat-fade">
                        ₹<AnimatedCounter value={stats.allTimeStats.totalRevenue} />
                      </h3>
                    )}
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="bg-white/20 px-2 py-0.5 rounded text-[10px] font-medium backdrop-blur-md">All time</span>
                    </div>
                  </div>
                </div>

                {/* Total Orders */}
                <div className={`stats-equal-card ${innerCard}`}>
                  <div className="flex justify-between items-center w-full">
                    <span className="text-sm font-medium text-gray-700">Total Orders</span>
                    <div className={iconBox}><ShoppingBag size={16} /></div>
                  </div>
                  <div className="mt-auto pt-2">
                    <StatValue loading={statsLoading} value={stats.allTimeStats.totalOrders} />
                    <p className="text-xs text-gray-400 font-medium mt-1">All time</p>
                  </div>
                </div>

                {/* Active Customers */}
                <div className={`stats-equal-card ${innerCard}`}>
                  <div className="flex justify-between items-center w-full">
                    <span className="text-sm font-medium text-gray-700">Active Customers</span>
                    <div className={iconBox} style={{ color: '#D63031', backgroundColor: '#FFF0F0' }}><Activity size={16} /></div>
                  </div>
                  <div className="mt-auto pt-2">
                    <StatValue loading={statsLoading} value={stats.allTimeStats.activeCustomers ?? 0} />
                    <p className="text-xs text-gray-400 font-medium mt-1">All time</p>
                  </div>
                </div>

                {/* Comments */}
                <div className={`stats-equal-card ${innerCard}`}>
                  <div className="flex justify-between items-center w-full">
                    <span className="text-sm font-medium text-gray-700">Comments</span>
                    <div className={iconBox}><MessageSquare size={16} /></div>
                  </div>
                  <div className="mt-auto pt-2">
                    <StatValue loading={statsLoading} value={stats.allTimeStats.totalStoryComments} />
                    <p className="text-xs text-gray-400 font-medium mt-1">All time</p>
                  </div>
                </div>

              </div>
            </div>

            {/* 3 — Timeframe Orders + Revenue (live, changes with filter) */}
            <div className={`${cardBase} p-4`}>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">
                {timeLabel} Performance
              </p>
              <div className="mobile-daily-stats-grid grid grid-cols-1 md:grid-cols-2 gap-4">

                <div className={`${innerCard}`}>
                  <div className="flex justify-between items-start w-full">
                    <span className="text-gray-700 font-medium text-xs">Orders · {timeLabel}</span>
                    <div className={iconBox}><Package size={16} /></div>
                  </div>
                  <div className="flex justify-between items-center w-full mt-auto pt-2">
                    <div>
                      <StatValue loading={statsLoading} value={stats.totalOrders} />
                      <span className="inline-block bg-[#E5F9ED] text-[#27AE60] px-1.5 py-0.5 rounded text-[9px] font-semibold mt-1">Live</span>
                    </div>
                    <MiniDonut percentage={ordersDonutPct} id="gradOrders" size={48} strokeWidth={5} color="#E86C15" />
                  </div>
                </div>

                <div className={`${innerCard}`}>
                  <div className="flex justify-between items-start w-full">
                    <span className="text-gray-700 font-medium text-xs">Revenue · {timeLabel}</span>
                    <div className={iconBox}><IndianRupee size={16} /></div>
                  </div>
                  <div className="flex justify-between items-center w-full mt-auto pt-2">
                    <div>
                      {statsLoading ? (
                        <Skeleton className="h-8 w-24" />
                      ) : (
                        <h3 className="text-3xl font-semibold text-gray-900 leading-none stat-fade">
                          ₹<AnimatedCounter value={stats.totalOrderAmount} />
                        </h3>
                      )}
                      <span className="inline-block bg-[#E5F9ED] text-[#27AE60] px-1.5 py-0.5 rounded text-[9px] font-semibold mt-1">Live</span>
                    </div>
                    <MiniDonut percentage={revenueDonutPct} id="gradRevenue" size={48} strokeWidth={5} color="#D63031" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ============ RIGHT COLUMN ============ */}
          <div className="mobile-section-gap col-span-1 md:col-span-12 xl:col-span-7 flex flex-col gap-5">

            {/* 1 — Revenue Chart */}
            <div className={`${cardBase} mobile-chart-card p-4 md:p-6 h-[300px] md:h-[396px]`}>
              <div className="flex justify-between items-start mb-2 shrink-0">
                <div>
                  <h2 className="text-base font-semibold text-gray-900">Total Income</h2>
                  <p className="text-gray-400 text-[11px] mt-0.5 font-medium">12-month revenue overview</p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 bg-gradient-to-b from-[#E86C15] to-[#D63031] rounded-sm shadow-sm" />
                    <span className="text-[10px] text-gray-500 font-medium">Profit</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 bg-[#4B4B4B] rounded-sm shadow-sm" />
                    <span className="text-[10px] text-gray-500 font-medium">Cost</span>
                  </div>
                </div>
              </div>

              <div className="flex-1 w-full relative min-h-0 bg-[#F9FAFB] rounded-xl p-4 flex flex-col mt-2">
                <div className="absolute inset-0 p-4 flex flex-col justify-between z-0 pointer-events-none">
                  {yAxisLabels.map((val, idx) => (
                    <div key={idx} className="flex items-center w-full h-0">
                      <span className="text-[9px] text-gray-400 w-6 text-right mr-3 font-medium -translate-y-1/2">{val}</span>
                      <div className="flex-1 border-t border-dotted border-gray-200" />
                    </div>
                  ))}
                </div>
                <div className="flex-1 ml-9 mr-2 relative flex items-end justify-between border-b border-gray-300 z-10 pb-1">
                  <div className="absolute inset-0 flex justify-between pointer-events-none overflow-hidden">
                    {Array.from({ length: 12 }).map((_, i) => <div key={i} className="h-full border-r border-dotted border-gray-200 w-px" />)}
                  </div>
                  {statsLoading ? (
                    Array.from({ length: 12 }).map((_, i) => (
                      <div key={i} className="flex flex-col items-center justify-end h-full w-full relative">
                        <div className="w-3 xl:w-4 rounded-t-sm" style={{
                          height: `${[38, 52, 28, 60, 42, 68, 35, 55, 45, 58, 32, 50][i]}%`,
                          background: 'linear-gradient(90deg,#e5e7eb 25%,#f3f4f6 50%,#e5e7eb 75%)',
                          backgroundSize: '200% 100%', animation: 'shimmer 1.6s infinite',
                        }} />
                      </div>
                    ))
                  ) : stats.monthlyRevenueData.length > 0 ? (
                    stats.monthlyRevenueData.map((data, idx) => {
                      const totalH = Math.min((data.revenue / MAX_CHART_VAL) * 100, 100);
                      const costH = Math.min((data.cost / MAX_CHART_VAL) * 100, 100);
                      return (
                        <div key={idx} className="flex flex-col items-center justify-end h-full w-full group cursor-pointer relative pt-2">
                          <div className="w-3 xl:w-4 h-full flex flex-col justify-end transition-transform group-hover:scale-105 duration-200 origin-bottom">
                            {(totalH - costH) > 0 && <div style={{ height: `${totalH - costH}%` }} className="w-full bg-gradient-to-b from-[#E86C15] to-[#D63031] rounded-t-[3px] mb-[1px] shadow-sm" />}
                            {costH > 0 && <div style={{ height: `${costH}%` }} className="w-full bg-[#4B4B4B] rounded-b-[3px] shadow-sm" />}
                          </div>
                          <div className="absolute top-full mt-1.5">
                            <span className="block text-[9px] font-medium text-gray-500 whitespace-nowrap">{data.month}</span>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="w-full flex items-center justify-center text-gray-400 text-xs">No data available yet</div>
                  )}
                </div>
              </div>
            </div>

            {/* 2 — Bot Stats (timeframe-scoped) */}
            <div className={`${cardBase} p-3 overflow-visible`}>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1 pb-2">
                Bot Activity · {timeLabel}
              </p>
              <div className="mobile-bot-stats-grid grid grid-cols-2 lg:grid-cols-3 gap-3">

                {/* Total Responses */}
                <div className={`mobile-bot-responses-full ${innerCard} col-span-2 lg:col-span-2 !p-3 min-h-[140px]`}>
                  <div className="flex justify-between items-center w-full">
                    <span className="text-gray-700 font-medium text-sm">Total Bot Responses</span>
                    <div className={iconBox} style={{ backgroundColor: '#FFF0F0', color: '#D63031' }}><Bot size={18} /></div>
                  </div>
                  <div className="flex items-center justify-between mt-auto">
                    <StatValue loading={statsLoading} value={stats.totalResponses} large />
                    <div className="flex items-center gap-1 bg-white/60 px-2 py-1 rounded-lg whitespace-nowrap">
                      <span className="text-[#27AE60] text-[11px] font-bold">Live</span>
                      <span className="text-[10px] text-gray-500 font-medium">{timeLabel}</span>
                    </div>
                  </div>
                </div>

                {/* Bot Messages */}
                <div className={`${innerCard} col-span-1`}>
                  <div className="flex justify-between items-center w-full">
                    <span className="text-gray-700 font-medium text-xs">Bot Messages</span>
                    <div className={iconBox}><Bot size={16} /></div>
                  </div>
                  <div className="mt-auto">
                    <StatValue loading={statsLoading} value={stats.botMessages} />
                    <p className="text-[10px] text-gray-400 mt-1">{timeLabel}</p>
                  </div>
                </div>

                {/* Templates */}
                <div className={`${innerCard} col-span-1`}>
                  <div className="flex justify-between items-center w-full">
                    <span className="text-gray-700 font-medium text-xs">Templates</span>
                    <div className={iconBox}><MessageSquare size={16} /></div>
                  </div>
                  <div className="mt-auto">
                    <StatValue loading={statsLoading} value={stats.templateMessages} />
                    <p className="text-[10px] text-gray-400 mt-1">{timeLabel}</p>
                  </div>
                </div>

                {/* Carousels */}
                <div className={`${innerCard} col-span-1`}>
                  <div className="flex justify-between items-center w-full">
                    <span className="text-gray-700 font-medium text-xs">Carousals</span>
                    <div className={iconBox} style={{ backgroundColor: '#FFF0F0', color: '#D63031' }}><GalleryHorizontal size={16} /></div>
                  </div>
                  <div className="mt-auto">
                    <StatValue loading={statsLoading} value={stats.carouselMessages} />
                    <p className="text-[10px] text-gray-400 mt-1">{timeLabel}</p>
                  </div>
                </div>

                {/* Replies */}
                <div className={`${innerCard} col-span-1`}>
                  <div className="flex justify-between items-center w-full">
                    <span className="text-gray-700 font-medium text-xs">Replies</span>
                    <div className={iconBox}><Send size={16} /></div>
                  </div>
                  <div className="mt-auto">
                    <StatValue loading={statsLoading} value={stats.commentReplies} />
                    <p className="text-[10px] text-gray-400 mt-1">{timeLabel}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Chatbot />
    </div>
  );
}
