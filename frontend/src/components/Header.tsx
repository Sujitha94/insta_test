import { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Bot as BotIcon, X, AlertTriangle, AlertCircle, Info, Settings, BarChart2 } from 'lucide-react';
import { getWebSocketService } from '../Services/websocketService';
import NotificationIcon from './NotificationIcon';
import AIlogo from '../assets/AI_logo.png';
import Humanlogo from '../assets/Human_logo.png';
import instaxbotLogo from "../assets/Instaxbot_Logo2.jpeg";

// --- INTERFACES ---
interface WebSocketNotificationMessage {
  type: string;
  status: 'success' | 'error';
  data: any;
}

interface TenantNotification {
  type: 'warning' | 'expired';
  message: string;
  createdAt: string;
}

interface RazorpayNotification {
  type: 'warning' | 'expired';
  message: string;
  daysLeft: number;
  createdAt: string;
}

interface InstagramProfile {
  name: string;
  username: string;
  profile_picture_url: string;
  account_type: string;
}

interface HeaderProps {
  onToggleSidebar: () => void;
}

const getPageTitle = (path: string): string => {
  const p = path.toLowerCase();
  if (p.includes('packing') && p.includes('status')) return 'Packing Station';
  if (p.includes('tracking') && p.includes('status')) return 'Tracking / Manifest';
  if (p.includes('manifest') && p.includes('status')) return 'Tracking / Manifest';
  if (p.includes('holding') && p.includes('status')) return 'Holding Area';
  if (p === '/status/packing' || p === '/status/packing-station') return 'Packing Station';
  if (p === '/status/tracking' || p === '/status/manifest') return 'Tracking / Manifest';
  if (p === '/status/holding' || p === '/status/holding-area') return 'Holding Area';
  if (p.includes('systemmenus')) return 'Persistent Menu';
  if (p.includes('upload')) return 'File Upload';
  if (p.includes('templates')) return 'Templates';
  if (p.includes('template_message')) return 'Template Message';
  if (p.includes('icebreakers')) return 'Icebreaker Configuration';
  if (p.includes('website-url')) return 'Website URL Configuration';
  if (p.includes('shipping')) return 'Shipping Settings';
  if (p.includes('razorpay')) return 'Razorpay Connect';
  if (p.includes('profile')) return 'Account Profile';
  if (p.includes('allcomments_automation/post')) return 'Post Comments';
  if (p.includes('allcomments_automation/story')) return 'Story Comments';
  if (p.includes('comments_automation')) return 'Instagram Comment Automation';
  if (p.includes('printing') && !p.includes('status')) return 'Printing';
  if (p.includes('packing') && !p.includes('status')) return 'Packing';
  if (p.includes('holding') && !p.includes('status')) return 'Holding';
  if (p.includes('tracking') && !p.includes('status')) return 'Tracking';
  if (p.startsWith('/dashboard')) return 'Dashboard';
  if (p.startsWith('/embed')) return 'Connect Instagram';
  if (p.startsWith('/live-chat')) return 'Live Chat';
  if (p.startsWith('/comments_chat')) return 'Comments Chat';
  if (p.startsWith('/product-inventory')) return 'Products';
  if (p.startsWith('/productcatalog')) return 'Product Catalog';
  if (p.startsWith('/order')) return 'Order';
  if (p.startsWith('/status')) return 'Status';
  if (p.startsWith('/setting')) return 'Settings';
  if (p.startsWith('/terms')) return 'Terms & Condition';
  if (p.startsWith('/policy')) return 'Privacy Policy';
  if (p.startsWith('/frontpolicy')) return 'Privacy Policy';
  if (p.startsWith('/frontterms')) return 'Terms & Condition';
  if (p.startsWith('/welcomepage')) return 'Welcome';
  if (p.startsWith('/chatbot')) return 'Chatbot';
  if (p.startsWith('/appointment')) return 'Appointment';
  if (p.startsWith('/broadcast')) return 'Broadcast';
  if (p.startsWith('/admin')) return 'Admin';
  if (p.startsWith('/cart')) return 'Cart';
  if (p.startsWith('/analytics')) return 'Analytics';
  return 'Dashboard';
};

interface BannerProps {
  bgColor: string;
  icon: React.ReactNode;
  message: string;
  onDismiss: () => void;
}

const NotificationBanner = ({ bgColor, icon, message, onDismiss }: BannerProps) => (
  <div
    style={{
      backgroundColor: bgColor,
      color: '#fff',
      width: '100%',
      zIndex: 20,
      boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      padding: '8px 16px',
      boxSizing: 'border-box',
      gap: '8px',
    }}
  >
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', flex: 1, minWidth: 0 }}>
      <span style={{ flexShrink: 0, marginTop: '2px', opacity: 0.85 }}>{icon}</span>
      <span style={{ fontSize: '13px', fontWeight: 500, lineHeight: '1.45', wordBreak: 'break-word', overflowWrap: 'anywhere', whiteSpace: 'normal' }}>
        {message}
      </span>
    </div>
    <button onClick={onDismiss} style={{ flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.8)', padding: '2px', marginTop: '1px', display: 'flex', alignItems: 'center' }}>
      <X size={15} />
    </button>
  </div>
);

const Header = (_props: HeaderProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const currentTitle = getPageTitle(location.pathname);
  const isNotificationRoute = location.pathname.includes('/notifications');
  const API_BASE_URL = "https://inocencia-shiftiest-nonodorously.ngrok-free.dev/api";

  const [loading, setLoading] = useState<boolean>(true);
  const [agentMode, setAgentMode] = useState<string>('online');
  const [dropdownOpen, setDropdownOpen] = useState<boolean>(false);
  const agentDropdownRef = useRef<HTMLDivElement>(null);
  const mobileAgentDropdownRef = useRef<HTMLDivElement>(null);
  const [tenantNotification, setTenantNotification] = useState<TenantNotification | null>(null);
  const [tenantDismissed, setTenantDismissed] = useState<boolean>(false);
  const [razorpayNotification, setRazorpayNotification] = useState<RazorpayNotification | null>(null);
  const [razorpayDismissed, setRazorpayDismissed] = useState<boolean>(false);
  const [igProfile, setIgProfile] = useState<InstagramProfile | null>(null);
  const [mobileDropdownOpen, setMobileDropdownOpen] = useState<boolean>(false);

  const fetchTenantStatus = useCallback(async () => {
    const tenantId = localStorage.getItem("tenentid");
    if (!tenantId) return;
    try {
      const response = await axios.get(`${API_BASE_URL}/headerroute/tenant-status`, { params: { tenentId: tenantId } });
      if (!response.data.success) return;
      const { tenant, razorpay } = response.data.notifications || {};
      if (tenant) { setTenantNotification(tenant); setTenantDismissed(false); } else { setTenantNotification(null); }
      if (razorpay) { setRazorpayNotification(razorpay); setRazorpayDismissed(false); } else { setRazorpayNotification(null); }
    } catch (error) { console.error("Error fetching tenant status:", error); }
  }, []);

  const fetchInstagramProfile = useCallback(async () => {
    const tenentId = localStorage.getItem("tenentid");
    if (!tenentId) return;
    try {
      const response = await axios.get(`${API_BASE_URL}/headerroute/instagram-profile`, { params: { tenentId } });
      if (response.data.success) { setIgProfile(response.data.profile); }
    } catch (error: any) { console.error("Error fetching Instagram profile:", error); }
  }, []);

  const handleWebSocketMessage = useCallback((data: WebSocketNotificationMessage) => {
    if (data.type === 'main_chat_mode_updated' && data.status === 'success') {
      setAgentMode((data.data as { mainmode: string }).mainmode);
    }
  }, []);

  useEffect(() => {
    const initData = async () => {
      const tenentId = localStorage.getItem('tenentid');
      try {
        const res = await axios.get(`${API_BASE_URL}/mainmoderoute/mainmode`, { params: { tenentId } });
        if (res.data) setAgentMode(res.data.mainmode);
      } catch (error) { console.error('Error fetching AgentMode:', error); } finally { setLoading(false); }
    };
    initData();
    fetchTenantStatus();
    fetchInstagramProfile();
  }, [fetchTenantStatus, fetchInstagramProfile]);

  useEffect(() => {
    const interval = setInterval(fetchTenantStatus, 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchTenantStatus]);

  useEffect(() => {
    const wsService = getWebSocketService();
    if (wsService?.isConnected()) wsService.addMessageHandler(handleWebSocketMessage);
    return () => wsService?.removeMessageHandler(handleWebSocketMessage);
  }, [handleWebSocketMessage]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (agentDropdownRef.current && !agentDropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
      if (mobileAgentDropdownRef.current && !mobileAgentDropdownRef.current.contains(event.target as Node)) {
        setMobileDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleMainModeChange = async (mode: string) => {
    setAgentMode(mode);
    setDropdownOpen(false);
    setMobileDropdownOpen(false);
    const wsService = getWebSocketService();
    const tenentId = localStorage.getItem('tenentid');
    if (wsService?.isConnected() && tenentId) {
      try {
        wsService.sendMessage({ type: 'main_chat_mode_update', tenentId, mainmode: mode, timestamp: new Date().toISOString() });
      } catch (error) { console.error('Error updating main mode:', error); }
    }
  };

  const defaultBadgeCount = 12;
  const shouldShowBadge = !isNotificationRoute;

  return (
    <>
      {tenantNotification?.type === 'warning' && !tenantDismissed && (
        <NotificationBanner bgColor="#EAB308" icon={<AlertTriangle size={15} />} message={tenantNotification.message} onDismiss={() => setTenantDismissed(true)} />
      )}
      {tenantNotification?.type === 'expired' && !tenantDismissed && (
        <NotificationBanner bgColor="#DC2626" icon={<AlertCircle size={15} />} message={tenantNotification.message} onDismiss={() => setTenantDismissed(true)} />
      )}
      {razorpayNotification?.type === 'warning' && !razorpayDismissed && (
        <NotificationBanner bgColor="#F59E0B" icon={<Info size={15} />} message={razorpayNotification.message} onDismiss={() => setRazorpayDismissed(true)} />
      )}
      {razorpayNotification?.type === 'expired' && !razorpayDismissed && (
        <NotificationBanner bgColor="#DC2626" icon={<AlertCircle size={15} />} message={razorpayNotification.message} onDismiss={() => setRazorpayDismissed(true)} />
      )}

      <header className="bg-white w-full z-[9999] h-14 sticky top-0 border-b border-gray-100 shadow-sm">

        {/* ---- MOBILE VIEW ---- */}
        <div className="flex items-center justify-between px-2 sm:px-4 md:hidden h-full">

          {/* Left: Logo/Brand */}
          <div className="flex items-center min-w-0 mr-2" style={{ maxWidth: '45%' }}>
            <div className="flex items-center gap-2 ml-1">
              <img src={instaxbotLogo} alt="Logo" className="h-7 w-7 flex-shrink-0 rounded-sm" />
              <span className="text-black font-bold truncate text-sm sm:text-base tracking-tight">
                Insta<span className="text-orange-600">X</span>bot
              </span>
            </div>
          </div>

          {/* Right side icons */}
          <div className="flex items-center gap-1.5 shrink-0 h-full">

            {/* Settings Button (NOW FIRST) */}
            <button
              onClick={() => navigate('/setting')}
              className="flex items-center justify-center w-9 h-9 text-gray-600 hover:bg-gray-50 rounded-full focus:outline-none flex-shrink-0 transition-colors"
              aria-label="Settings"
            >
              <Settings size={20} />
            </button>

            {/* Analytics Button (NOW SECOND) */}
            <button
              onClick={() => navigate('/analytics')}
              className="flex items-center justify-center w-9 h-9 text-gray-600 hover:bg-orange-50 hover:text-orange-500 rounded-full focus:outline-none flex-shrink-0 transition-colors"
              aria-label="Analytics"
            >
              <BarChart2 size={20} />
            </button>

            {/* Agent Mode Toggle — MOBILE */}
            <div className="relative flex-shrink-0" ref={mobileAgentDropdownRef}>
              <button
                onClick={() => setMobileDropdownOpen(prev => !prev)}
                className={`flex items-center justify-center w-9 h-9 rounded-full transition-colors focus:outline-none ${mobileDropdownOpen ? 'bg-orange-50' : 'hover:bg-gray-50'}`}
                aria-label="Toggle Agent Mode"
              >
                {agentMode === 'offline'
                  ? <BotIcon size={20} className="text-gray-600" />
                  : <img src={Humanlogo} alt="Human Agent" className="w-5 h-5 object-contain" />
                }
              </button>

              {mobileDropdownOpen && (
                <div className="absolute top-full right-0 mt-2 bg-white border border-gray-200 rounded-xl shadow-2xl z-[10001] min-w-[160px] p-1">
                  <button
                    onClick={() => handleMainModeChange('offline')}
                    className={`flex items-center gap-3 w-full px-3 py-2.5 text-xs rounded-lg transition-colors ${agentMode === 'offline' ? 'bg-orange-100 text-[#E86C15] font-bold' : 'hover:bg-gray-50 text-gray-700'}`}
                  >
                    <img src={AIlogo} alt="AI" className="w-4 h-4 object-contain" />
                    <span className="font-semibold">AI Agent</span>
                  </button>
                  <button
                    onClick={() => handleMainModeChange('online')}
                    className={`flex items-center gap-3 w-full px-3 py-2.5 text-xs rounded-lg transition-colors ${agentMode === 'online' ? 'bg-orange-100 text-[#E86C15] font-bold' : 'hover:bg-gray-50 text-gray-700'}`}
                  >
                    <img src={Humanlogo} alt="Human" className="w-4 h-4 object-contain" />
                    <span className="font-semibold">Human Agent</span>
                  </button>
                </div>
              )}
            </div>

            {/* Notification Icon — MOBILE */}
            <div className="relative flex-shrink-0 flex items-center justify-center w-9 h-9">
              <NotificationIcon />
            </div>

            {/* Profile Avatar */}
            <div
              onClick={() => navigate('/profile')}
              className="flex items-center justify-center bg-white rounded-full shadow-md border border-gray-200 p-1 flex-shrink-0 cursor-pointer active:scale-95 transition-transform"
            >
              {igProfile ? (
                <div className="relative p-[2px] rounded-full bg-gradient-to-tr from-yellow-400 via-red-500 to-purple-600 flex-shrink-0">
                  <img src={igProfile.profile_picture_url} alt={igProfile.name} className="w-7 h-7 rounded-full border-2 border-white object-cover" />
                </div>
              ) : (
                <div className="w-7 h-7 rounded-full bg-gray-200 animate-pulse flex-shrink-0" />
              )}
            </div>

          </div>
        </div>

        {/* ---- DESKTOP VIEW ---- */}
        <div className="hidden md:flex items-center justify-between mr-10 px-6 h-full">
          <h1 className="text-2xl font-bold text-black tracking-tight">{currentTitle}</h1>
          <div className="flex items-center space-x-3">

            {/* Settings Button DESKTOP (Added to match mobile alignment) */}
            <button
              onClick={() => navigate('/setting')}
              title="Settings"
              className="flex items-center justify-center w-9 h-9 text-gray-600 hover:text-orange-500 hover:bg-orange-50 rounded-full focus:outline-none transition-colors border border-gray-200 shadow-sm"
              aria-label="Settings"
            >
              <Settings size={18} />
            </button>

            {/* Analytics Button DESKTOP */}
            <button
              onClick={() => navigate('/analytics')}
              title="Analytics"
              className="flex items-center justify-center w-9 h-9 text-gray-600 hover:text-orange-500 hover:bg-orange-50 rounded-full focus:outline-none transition-colors border border-gray-200 shadow-sm"
              aria-label="Analytics"
            >
              <BarChart2 size={18} />
            </button>

            <div className="relative" ref={agentDropdownRef}>
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center gap-2 px-3 py-1.5 border border-gray-300 rounded-lg bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-200 transition-all shadow-sm"
              >
                <img src={agentMode === 'offline' ? AIlogo : Humanlogo} alt="Agent" className="w-5 h-5 flex-shrink-0" />
                <span className="font-semibold text-sm text-black">{agentMode === 'offline' ? 'AI Agent' : 'Human Agent'}</span>
              </button>
              {dropdownOpen && (
                <div className="absolute left-1/2 -translate-x-1/2 mt-2 bg-white border border-gray-200 rounded-lg shadow-xl z-30 min-w-[140px] overflow-hidden">
                  <button
                    onClick={() => handleMainModeChange('offline')}
                    className={`flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-gray-100 ${agentMode === 'offline' ? 'bg-orange-50 text-[#E86C15] font-bold' : ''}`}
                  >
                    <img src={AIlogo} alt="AI" className="w-4 h-4" />
                    <span className="font-semibold">AI Agent</span>
                  </button>
                  <button
                    onClick={() => handleMainModeChange('online')}
                    className={`flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-gray-100 ${agentMode === 'online' ? 'bg-orange-50 text-[#E86C15] font-bold' : ''}`}
                  >
                    <img src={Humanlogo} alt="Human" className="w-4 h-4" />
                    <span className="font-semibold">Human Agent</span>
                  </button>
                </div>
              )}
            </div>

            <div className="relative w-7 h-7 flex items-center justify-center bg-white border border-gray-200 rounded-full shadow-md cursor-pointer">
              <div className="w-5 h-5 text-gray-700 flex items-center justify-center"><NotificationIcon /></div>
              {shouldShowBadge && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-bold rounded-full h-4 w-4 flex items-center justify-center border-2 border-white">
                  {defaultBadgeCount}
                </span>
              )}
            </div>

            <div
              onClick={() => navigate('/profile')}
              className="flex items-center bg-white rounded-full shadow-md cursor-pointer hover:bg-gray-50 transition-all border border-gray-200 pl-1 pr-3 py-1 active:scale-95"
            >
              {igProfile ? (
                <>
                  <div className="relative p-[2px] rounded-full bg-gradient-to-tr from-yellow-400 via-red-500 to-purple-600 flex-shrink-0">
                    <img src={igProfile.profile_picture_url} alt={igProfile.name} className="w-5 h-5 rounded-full border-2 border-white object-cover" />
                  </div>
                  <div className="ml-2 flex flex-col items-start leading-none whitespace-nowrap">
                    <span className="text-xs font-bold text-gray-900">{igProfile.name}</span>
                    <span className="text-[9px] text-gray-500 font-medium mt-0.5 capitalize">
                      Instagram {igProfile.account_type === 'MEDIA_CREATOR' ? 'Influencer' : 'Business'}
                    </span>
                  </div>
                </>
              ) : !loading ? (
                <div className="ml-2 flex flex-col items-start leading-none whitespace-nowrap">
                  <div className="h-3 w-20 bg-gray-200 rounded animate-pulse" />
                  <div className="h-2 w-16 mt-1 bg-gray-200 rounded animate-pulse" />
                </div>
              ) : null}
            </div>

          </div>
        </div>

      </header>
    </>
  );
};

export default Header;