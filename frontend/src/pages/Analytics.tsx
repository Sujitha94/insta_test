import { useState, useEffect, useRef } from 'react';
import {
  IndianRupee,
  Users,
  Eye,
  Heart,
  Percent,
  TrendingUp,
  TrendingDown,
  Star,
  BarChart2,
  UserCheck,
  RefreshCw,
  Clock,
  CheckCircle,
  XCircle,
  Repeat2,
  CreditCard,
  Award,
  Target,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  PieChart,
  Pie,
} from 'recharts';

// ─── CONFIG ───────────────────────────────────────────────────────────────────
const API_BASE = 'https://inocencia-shiftiest-nonodorously.ngrok-free.dev/api';

// ─── TYPES ────────────────────────────────────────────────────────────────────
interface BillingAnalytics {
  totalRevenue: number;
  avgOrderValue: number;
  highestOrderValue: number;
  revenueGrowthPct: number;
  totalOrders: number;
  completedOrders: number;
  pendingOrders: number;
  cancelledOrders: number;
  returnedOrders: number;
  repeatCustomers: number;
  newCustomers: number;
  avgDeliveryDays: number;
  topProducts: { name: string; sales: number; revenue: number; growth: number }[];
  revenueByDay: { label: string; revenue: number; orders: number }[];
  orderFunnel: { label: string; value: number }[];
  paymentMethods: { name: string; value: number }[];
}

interface FollowersAnalytics {
  totalFollowers: number;
  reach: number;
  likes: number;
  engagementRate: number;
  impressions: number;
  profileVisits: number;
  saves: number;
  shares: number;
  followersToday: number;
  unfollowsToday: number;
  followerGrowth: { label: string; followers: number; gained: number }[];
  topPostEngagement: { label: string; likes: number; comments: number; saves: number }[];
  peakHours: { hour: string; engagement: number }[];
}

// ─── MOCK DATA ────────────────────────────────────────────────────────────────
const MOCK_BILLING: BillingAnalytics = {
  totalRevenue: 2415,
  avgOrderValue: 242,
  highestOrderValue: 1850,
  revenueGrowthPct: 12.4,
  totalOrders: 58,
  completedOrders: 48,
  pendingOrders: 5,
  cancelledOrders: 3,
  returnedOrders: 2,
  repeatCustomers: 8,
  newCustomers: 14,
  avgDeliveryDays: 3.2,
  topProducts: [
    { name: 'Product A', sales: 18, revenue: 900, growth: 22 },
    { name: 'Product B', sales: 14, revenue: 700, growth: 8 },
    { name: 'Product C', sales: 10, revenue: 500, growth: -3 },
    { name: 'Product D', sales: 8, revenue: 315, growth: 15 },
  ],
  revenueByDay: [
    { label: 'Mon', revenue: 320, orders: 4 },
    { label: 'Tue', revenue: 480, orders: 6 },
    { label: 'Wed', revenue: 210, orders: 3 },
    { label: 'Thu', revenue: 690, orders: 9 },
    { label: 'Fri', revenue: 415, orders: 5 },
    { label: 'Sat', revenue: 300, orders: 4 },
    { label: 'Sun', revenue: 0, orders: 0 },
  ],
  orderFunnel: [
    { label: 'Completed', value: 48 },
    { label: 'Pending', value: 5 },
    { label: 'Cancelled', value: 3 },
    { label: 'Returned', value: 2 },
  ],
  paymentMethods: [
    { name: 'Razorpay', value: 42 },
    { name: 'COD', value: 12 },
    { name: 'UPI', value: 4 },
  ],
};

const MOCK_FOLLOWERS: FollowersAnalytics = {
  totalFollowers: 15300,
  reach: 1300,
  likes: 94,
  engagementRate: 4.2,
  impressions: 4800,
  profileVisits: 320,
  saves: 48,
  shares: 22,
  followersToday: 20,
  unfollowsToday: 2,
  followerGrowth: [
    { label: 'Mon', followers: 14800, gained: 12 },
    { label: 'Tue', followers: 14950, gained: 24 },
    { label: 'Wed', followers: 15050, gained: 18 },
    { label: 'Thu', followers: 15100, gained: 10 },
    { label: 'Fri', followers: 15200, gained: 22 },
    { label: 'Sat', followers: 15280, gained: 15 },
    { label: 'Sun', followers: 15300, gained: 20 },
  ],
  topPostEngagement: [
    { label: 'Post 1', likes: 38, comments: 12, saves: 8 },
    { label: 'Post 2', likes: 24, comments: 8, saves: 5 },
    { label: 'Post 3', likes: 18, comments: 6, saves: 3 },
    { label: 'Post 4', likes: 14, comments: 4, saves: 2 },
  ],
  peakHours: [
    { hour: '6am', engagement: 12 },
    { hour: '9am', engagement: 28 },
    { hour: '12pm', engagement: 45 },
    { hour: '3pm', engagement: 38 },
    { hour: '6pm', engagement: 72 },
    { hour: '9pm', engagement: 88 },
    { hour: '12am', engagement: 32 },
  ],
};

// ─── PRIMITIVES ───────────────────────────────────────────────────────────────
const Skeleton = ({ className = '', style = {} }: { className?: string; style?: React.CSSProperties }) => (
  <div className={`rounded-lg ${className}`} style={{
    background: 'linear-gradient(90deg,#e5e7eb 25%,#f3f4f6 50%,#e5e7eb 75%)',
    backgroundSize: '200% 100%', animation: 'shimmer 1.6s infinite', ...style,
  }} />
);

const MiniDonut = ({ percentage, id, size = 48, strokeWidth = 5, color = '#E86C15' }:
  { percentage: number; id: string; color?: string; size?: number; strokeWidth?: number }) => {
  const r = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;
  const pct = Math.min(Math.max(isNaN(percentage) ? 0 : percentage, 0), 100);
  const offset = circ - (pct / 100) * circ;
  return (
    <div className="relative flex items-center justify-center shrink-0" style={{ width: size, height: size }}>
      <svg className="transform -rotate-90 w-full h-full">
        <defs>
          <linearGradient id={id} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={color} />
            <stop offset="100%" stopColor={color === '#E86C15' ? '#D63031' : color} />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="#F3E9E2" strokeWidth={strokeWidth} fill="transparent" strokeLinecap="round" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke={`url(#${id})`} strokeWidth={strokeWidth} fill="transparent"
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          className="transition-all duration-1000 ease-out" />
      </svg>
    </div>
  );
};

const AnimatedCounter = ({ value, formatter }: { value: number; formatter?: (n: number) => string }) => {
  const [count, setCount] = useState(0);
  const rafRef = useRef<number | null>(null);
  useEffect(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    const start = Date.now();
    const to = isNaN(value) ? 0 : value;
    const tick = () => {
      const elapsed = Date.now() - start;
      const p = Math.min(elapsed / 1200, 1);
      const ease = p === 1 ? 1 : 1 - Math.pow(2, -10 * p);
      setCount(Math.floor(ease * to));
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [value]);
  return <>{formatter ? formatter(count) : count}</>;
};

const StatValue = ({ loading, value, prefix = '', suffix = '', formatter, large = false }:
  { loading: boolean; value: number; prefix?: string; suffix?: string; formatter?: (n: number) => string; large?: boolean }) => {
  if (loading) return <Skeleton className={large ? 'h-10 w-28 mt-1' : 'h-8 w-20 mt-1'} />;
  return (
    <h3 className={`${large ? 'text-4xl' : 'text-3xl'} font-semibold text-gray-900 tracking-tight leading-none stat-fade`}>
      {prefix}<AnimatedCounter value={value} formatter={formatter} />{suffix}
    </h3>
  );
};

const GrowthBadge = ({ pct }: { pct: number }) => (
  <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold ${pct >= 0 ? 'bg-[#E5F9ED] text-[#27AE60]' : 'bg-[#FFE5E5] text-[#D63031]'}`}>
    {pct >= 0 ? <TrendingUp size={9} /> : <TrendingDown size={9} />}{Math.abs(pct)}%
  </span>
);

// ─── MAIN ─────────────────────────────────────────────────────────────────────
export default function Analytics() {
  const [mode, setMode] = useState<'billing' | 'followers'>('billing');
  const [loading, setLoading] = useState(false);
  const [billing, setBilling] = useState<BillingAnalytics>(MOCK_BILLING);
  const [followers, setFollowers] = useState<FollowersAnalytics>(MOCK_FOLLOWERS);
  const tenentId = localStorage.getItem('tenentid');

  const fmt = (n: number) =>
    n >= 1_000_000 ? (n / 1_000_000).toFixed(1) + 'M'
      : n >= 1_000 ? (n / 1_000).toFixed(1) + 'k'
        : String(n);

  useEffect(() => {
    if (!tenentId) return;
    setLoading(true);
    const ep = mode === 'billing'
      ? `${API_BASE}/analytics/billing?tenentId=${tenentId}`
      : `${API_BASE}/analytics/followers?tenentId=${tenentId}`;
    fetch(ep, { headers: { 'ngrok-skip-browser-warning': 'true' } })
      .then(r => r.json())
      .then(d => { if (d.success) { if (mode === 'billing') setBilling(d.data); else setFollowers(d.data); } })
      .catch(() => { })
      .finally(() => setLoading(false));
  }, [mode, tenentId]);

  // Style tokens — identical to Dashboard
  const cardBase = 'bg-white rounded-[20px] shadow-[0_4px_20px_rgb(0,0,0,0.03)] border border-gray-100 flex flex-col';
  const inner = 'bg-[#F9FAFB] rounded-[16px] p-3 flex flex-col justify-between border border-transparent hover:border-gray-200/50 hover:bg-gray-100 transition-colors overflow-visible';
  const iconBox = 'bg-[#FFF7ED] rounded-xl w-8 h-8 flex items-center justify-center text-[#E86C15] shadow-sm shrink-0';
  const iconRed = 'bg-[#FFF0F0] rounded-xl w-8 h-8 flex items-center justify-center text-[#D63031] shadow-sm shrink-0';
  const iconGreen = 'bg-[#E5F9ED] rounded-xl w-8 h-8 flex items-center justify-center text-[#27AE60] shadow-sm shrink-0';
  const iconAmber = 'bg-[#FFF9E5] rounded-xl w-8 h-8 flex items-center justify-center text-[#F59E0B] shadow-sm shrink-0';
  const iconPurp = 'bg-[#F0EEFF] rounded-xl w-8 h-8 flex items-center justify-center text-[#6366f1] shadow-sm shrink-0';

  const completionRate = billing.totalOrders > 0 ? Math.round((billing.completedOrders / billing.totalOrders) * 100) : 0;
  const maxSales = Math.max(...billing.topProducts.map(p => p.sales), 1);
  const PIE_COLORS = ['#27AE60', '#F59E0B', '#D63031', '#6366f1'];

  const tooltipStyle = { borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', fontSize: 12 };

  return (
    <div className="min-h-screen w-full bg-[#F6F6F6] font-['Poppins'] text-[#2D3436] flex flex-col">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap');
        @keyframes shimmer { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
        @keyframes fadeSlideIn { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
        .stat-fade { animation: fadeSlideIn 0.35s ease forwards; }
        .pill-tab { font-size:11px;font-weight:600;padding:6px 13px;border-radius:999px;border:none;cursor:pointer;outline:none;transition:all 0.2s cubic-bezier(0.4,0,0.2,1);white-space:nowrap; }
        .pill-tab.active { background:linear-gradient(135deg,#F57F26,#D63031);color:#fff;box-shadow:0 3px 10px rgba(214,48,49,.30); }
        .pill-tab:not(.active){background:transparent;color:#6b7280;}
        .pill-tab:not(.active):hover{background:#f3f4f6;color:#374151;}
        .quad{display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:12px;}
        .quad-card{min-height:130px;display:flex;flex-direction:column;justify-content:space-between;}
        @media(max-width:767px){
          .quad{gap:8px!important;padding:10px!important}
          .quad-card{min-height:118px!important}
          .quad-card h3{font-size:24px!important}
          .op{padding-left:10px!important;padding-right:10px!important;padding-bottom:16px!important}
          .og{gap:10px!important}
        }
      `}</style>

      {/* HEADER */}
      <div className="shrink-0 px-4 md:px-8 pt-5 pb-2">
        <h1 className="text-xl font-semibold text-gray-800 tracking-tight">Analytics</h1>
        <p className="text-xs text-gray-400 font-medium mt-0.5">Track your performance metrics</p>
      </div>

      {/* TOGGLE */}
      <div className="flex justify-center px-4 pb-3 pt-1 sticky top-0 z-30 bg-[#F6F6F6]">
        <div className="inline-flex items-center gap-0.5 bg-white rounded-full px-1 py-1 shadow-md border border-gray-100">
          {(['billing', 'followers'] as const).map(m => (
            <button key={m} className={`pill-tab ${mode === m ? 'active' : ''}`} onClick={() => setMode(m)}>
              {m === 'billing' ? 'Billing' : 'Followers'}
            </button>
          ))}
        </div>
      </div>

      {/* MAIN */}
      <div className="op flex-1 px-4 md:px-8 pb-6 md:pb-8 max-w-[1920px] mx-auto w-full">
        <div className="og grid grid-cols-1 md:grid-cols-12 gap-5">

          {/* ════════════ BILLING ════════════ */}
          {mode === 'billing' && (
            <>
              {/* LEFT */}
              <div className="og col-span-1 md:col-span-12 xl:col-span-5 flex flex-col gap-5">

                {/* QUAD: Revenue hero + 3 unique analytics KPIs */}
                <div className={`${cardBase} p-0`}>
                  <div className="quad">
                    {/* Revenue — gradient hero */}
                    <div className="quad-card rounded-[16px] p-3 text-white shadow-sm"
                      style={{ background: 'linear-gradient(135deg,#C90000 0%,#D74100 44%,#DE6100 68%,#DF7701 100%)' }}>
                      <div className="flex justify-between items-center w-full">
                        <span className="text-xs font-medium">Total Revenue</span>
                        <div className={iconBox}><IndianRupee size={14} /></div>
                      </div>
                      <div className="mt-auto pt-2">
                        {loading
                          ? <Skeleton className="h-8 w-20 opacity-40" style={{ background: 'linear-gradient(90deg,rgba(255,255,255,.25) 25%,rgba(255,255,255,.45) 50%,rgba(255,255,255,.25) 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.6s infinite' }} />
                          : <h3 className="text-3xl font-semibold tracking-tight leading-none stat-fade">₹<AnimatedCounter value={billing.totalRevenue} /></h3>}
                        <div className="flex items-center gap-2 mt-1.5">
                          <span className="bg-white/20 px-2 py-0.5 rounded text-[10px] font-medium">All time</span>
                          {!loading && <GrowthBadge pct={billing.revenueGrowthPct} />}
                        </div>
                      </div>
                    </div>

                    {/* Avg Order Value */}
                    <div className={`quad-card ${inner}`}>
                      <div className="flex justify-between items-center w-full">
                        <span className="text-sm font-medium text-gray-700">Avg Order Value</span>
                        <div className={iconBox}><CreditCard size={16} /></div>
                      </div>
                      <div className="mt-auto pt-2">
                        <StatValue loading={loading} value={billing.avgOrderValue} prefix="₹" />
                        <p className="text-xs text-gray-400 font-medium mt-1">Per order avg</p>
                      </div>
                    </div>

                    {/* Highest Single Order */}
                    <div className={`quad-card ${inner}`}>
                      <div className="flex justify-between items-center w-full">
                        <span className="text-sm font-medium text-gray-700">Highest Order</span>
                        <div className={iconBox}><Award size={16} /></div>
                      </div>
                      <div className="mt-auto pt-2">
                        <StatValue loading={loading} value={billing.highestOrderValue} prefix="₹" />
                        <p className="text-xs text-gray-400 font-medium mt-1">Single order max</p>
                      </div>
                    </div>

                    {/* Completion Rate */}
                    <div className={`quad-card ${inner}`}>
                      <div className="flex justify-between items-center w-full">
                        <span className="text-sm font-medium text-gray-700">Completion Rate</span>
                        <div className={iconGreen}><Target size={16} /></div>
                      </div>
                      <div className="mt-auto pt-2">
                        {loading ? <Skeleton className="h-8 w-16" /> : (
                          <h3 className="text-3xl font-semibold text-gray-900 tracking-tight leading-none stat-fade">{completionRate}%</h3>
                        )}
                        <p className="text-xs text-gray-400 font-medium mt-1">Orders fulfilled</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Order Funnel */}
                <div className={`${cardBase} p-4`}>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Order Funnel</p>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: 'Completed', val: billing.completedOrders, icon: <CheckCircle size={16} />, cls: iconGreen },
                      { label: 'Pending', val: billing.pendingOrders, icon: <Clock size={16} />, cls: iconAmber },
                      { label: 'Cancelled', val: billing.cancelledOrders, icon: <XCircle size={16} />, cls: iconRed },
                      { label: 'Returned', val: billing.returnedOrders, icon: <Repeat2 size={16} />, cls: iconPurp },
                    ].map(({ label, val, icon, cls }) => (
                      <div key={label} className={inner}>
                        <div className="flex justify-between items-center w-full">
                          <span className="text-xs font-medium text-gray-700">{label}</span>
                          <div className={cls}>{icon}</div>
                        </div>
                        <div className="mt-auto pt-2">
                          <StatValue loading={loading} value={val} />
                          <p className="text-[10px] text-gray-400 mt-1">Orders</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Customer Insights */}
                <div className={`${cardBase} p-4`}>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Customer Insights</p>
                  <div className="grid grid-cols-3 gap-3">
                    <div className={`${inner} col-span-1`}>
                      <div className="flex justify-between items-center w-full">
                        <span className="text-xs font-medium text-gray-700">New</span>
                        <div className={iconBox}><Users size={14} /></div>
                      </div>
                      <div className="mt-auto pt-2">
                        <StatValue loading={loading} value={billing.newCustomers} />
                        <p className="text-[10px] text-gray-400 mt-1">Customers</p>
                      </div>
                    </div>
                    <div className={`${inner} col-span-1`}>
                      <div className="flex justify-between items-center w-full">
                        <span className="text-xs font-medium text-gray-700">Repeat</span>
                        <div className={iconGreen}><RefreshCw size={14} /></div>
                      </div>
                      <div className="mt-auto pt-2">
                        <StatValue loading={loading} value={billing.repeatCustomers} />
                        <p className="text-[10px] text-gray-400 mt-1">Customers</p>
                      </div>
                    </div>
                    <div className={`${inner} col-span-1`}>
                      <div className="flex justify-between items-center w-full">
                        <span className="text-xs font-medium text-gray-700">Avg Delivery</span>
                        <div className={iconBox}><Clock size={14} /></div>
                      </div>
                      <div className="mt-auto pt-2">
                        {loading ? <Skeleton className="h-8 w-14" /> : (
                          <h3 className="text-3xl font-semibold text-gray-900 tracking-tight leading-none stat-fade">{billing.avgDeliveryDays}d</h3>
                        )}
                        <p className="text-[10px] text-gray-400 mt-1">Avg days</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* RIGHT */}
              <div className="og col-span-1 md:col-span-12 xl:col-span-7 flex flex-col gap-5">

                {/* Revenue Trend */}
                <div className={`${cardBase} p-4 md:p-6`} style={{ height: 280 }}>
                  <div className="flex justify-between items-start mb-2 shrink-0">
                    <div>
                      <h2 className="text-base font-semibold text-gray-900">Revenue Trend</h2>
                      <p className="text-gray-400 text-[11px] mt-0.5 font-medium">Weekly revenue breakdown</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-sm" style={{ background: 'linear-gradient(135deg,#E86C15,#D63031)' }} />
                      <span className="text-[10px] text-gray-500 font-medium">Revenue (₹)</span>
                    </div>
                  </div>
                  <div style={{ flex: 1, minHeight: 0 }}>
                    {loading ? <Skeleton className="w-full h-full" /> : (
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={billing.revenueByDay} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                          <defs>
                            <linearGradient id="rg" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#f97316" stopOpacity={0.35} />
                              <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                          <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                          <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`₹${v}`, 'Revenue']} />
                          <Area type="monotone" dataKey="revenue" stroke="#f97316" strokeWidth={2.5} fill="url(#rg)" dot={false} activeDot={{ r: 5, fill: '#f97316' }} />
                        </AreaChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>

                {/* Top Products */}
                <div className={`${cardBase} p-4 md:p-5`}>
                  <div className="flex justify-between items-center mb-4">
                    <div>
                      <h2 className="text-base font-semibold text-gray-900">Top Selling Products</h2>
                      <p className="text-gray-400 text-[11px] mt-0.5 font-medium">Revenue leaders with growth trend</p>
                    </div>
                    <div className={iconBox}><Star size={16} /></div>
                  </div>
                  {loading
                    ? <div className="flex flex-col gap-3">{[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
                    : (
                      <div className="flex flex-col gap-3">
                        {billing.topProducts.map((p, i) => (
                          <div key={i} className="flex items-center gap-3">
                            <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
                              style={{ background: i === 0 ? 'linear-gradient(135deg,#C90000,#DF7701)' : '#e5e7eb', color: i === 0 ? '#fff' : '#6b7280' }}>
                              {i + 1}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex justify-between items-center mb-1">
                                <span className="text-xs font-semibold text-gray-800 truncate">{p.name}</span>
                                <div className="flex items-center gap-2 ml-2 shrink-0">
                                  <GrowthBadge pct={p.growth} />
                                  <span className="text-xs font-bold text-gray-700">₹{p.revenue.toLocaleString()}</span>
                                </div>
                              </div>
                              <div className="w-full bg-gray-100 rounded-full h-1.5">
                                <div className="h-1.5 rounded-full transition-all duration-700"
                                  style={{ width: `${(p.sales / maxSales) * 100}%`, background: 'linear-gradient(90deg,#F57F26,#D63031)' }} />
                              </div>
                              <span className="text-[10px] text-gray-400 mt-0.5 block">{p.sales} units sold</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                </div>

                {/* Order Status Pie + Payment Methods */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className={`${cardBase} p-4`}>
                    <h2 className="text-sm font-semibold text-gray-900 mb-1">Order Status Split</h2>
                    <p className="text-gray-400 text-[10px] mb-2 font-medium">Distribution of all orders</p>
                    {loading ? <Skeleton className="w-full h-[140px]" /> : (
                      <ResponsiveContainer width="100%" height={140}>
                        <PieChart>
                          <Pie data={billing.orderFunnel} cx="50%" cy="50%" innerRadius={35} outerRadius={58}
                            dataKey="value" paddingAngle={3} nameKey="label">
                            {billing.orderFunnel.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                          </Pie>
                          <Tooltip contentStyle={{ borderRadius: '10px', border: 'none', fontSize: 11, boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}
                            formatter={(v: number, _: string, props: any) => [v, props.payload.label]} />
                        </PieChart>
                      </ResponsiveContainer>
                    )}
                    <div className="grid grid-cols-2 gap-1 mt-1">
                      {billing.orderFunnel.map((item, i) => (
                        <div key={i} className="flex items-center gap-1.5">
                          <div className="w-2 h-2 rounded-full shrink-0" style={{ background: PIE_COLORS[i] }} />
                          <span className="text-[10px] text-gray-500 font-medium">{item.label} ({item.value})</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className={`${cardBase} p-4`}>
                    <h2 className="text-sm font-semibold text-gray-900 mb-1">Payment Methods</h2>
                    <p className="text-gray-400 text-[10px] mb-2 font-medium">How customers pay</p>
                    {loading ? <Skeleton className="w-full h-[140px]" /> : (
                      <ResponsiveContainer width="100%" height={140}>
                        <BarChart data={billing.paymentMethods} layout="vertical" margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
                          <XAxis type="number" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                          <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#6b7280', fontWeight: 500 }} axisLine={false} tickLine={false} width={58} />
                          <Tooltip contentStyle={{ borderRadius: '10px', border: 'none', fontSize: 11, boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}
                            formatter={(v: number) => [v + ' orders', 'Orders']} />
                          <Bar dataKey="value" radius={[0, 6, 6, 0]} maxBarSize={22}>
                            {billing.paymentMethods.map((_, i) => (
                              <Cell key={i} fill={['#f97316', '#D63031', '#6366f1'][i]} fillOpacity={0.85} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                    <div className="flex items-center gap-3 mt-2 flex-wrap">
                      {billing.paymentMethods.map((m, i) => (
                        <div key={i} className="flex items-center gap-1">
                          <div className="w-2 h-2 rounded-full" style={{ background: ['#f97316', '#D63031', '#6366f1'][i] }} />
                          <span className="text-[10px] text-gray-500 font-medium">{m.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ════════════ FOLLOWERS ════════════ */}
          {mode === 'followers' && (
            <>
              {/* LEFT */}
              <div className="og col-span-1 md:col-span-12 xl:col-span-5 flex flex-col gap-5">
                <div className={`${cardBase} p-0`}>
                  <div className="quad">
                    <div className="quad-card rounded-[16px] p-3 text-white shadow-sm"
                      style={{ background: 'linear-gradient(135deg,#C90000 0%,#D74100 44%,#DE6100 68%,#DF7701 100%)' }}>
                      <div className="flex justify-between items-center w-full">
                        <span className="text-xs font-medium">Total Followers</span>
                        <div className={iconBox}><Users size={14} /></div>
                      </div>
                      <div className="mt-auto pt-2">
                        {loading
                          ? <Skeleton className="h-8 w-20 opacity-40" style={{ background: 'linear-gradient(90deg,rgba(255,255,255,.25) 25%,rgba(255,255,255,.45) 50%,rgba(255,255,255,.25) 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.6s infinite' }} />
                          : <h3 className="text-3xl font-semibold tracking-tight leading-none stat-fade"><AnimatedCounter value={followers.totalFollowers} formatter={fmt} /></h3>}
                        <div className="mt-1.5">
                          <span className="bg-white/20 px-2 py-0.5 rounded text-[10px] font-medium">All time</span>
                        </div>
                      </div>
                    </div>
                    <div className={`quad-card ${inner}`}>
                      <div className="flex justify-between items-center w-full">
                        <span className="text-sm font-medium text-gray-700">Reach</span>
                        <div className={iconBox}><Eye size={16} /></div>
                      </div>
                      <div className="mt-auto pt-2">
                        <StatValue loading={loading} value={followers.reach} formatter={fmt} />
                        <p className="text-xs text-gray-400 font-medium mt-1">Unique accounts</p>
                      </div>
                    </div>
                    <div className={`quad-card ${inner}`}>
                      <div className="flex justify-between items-center w-full">
                        <span className="text-sm font-medium text-gray-700">Impressions</span>
                        <div className={iconRed}><BarChart2 size={16} /></div>
                      </div>
                      <div className="mt-auto pt-2">
                        <StatValue loading={loading} value={followers.impressions} formatter={fmt} />
                        <p className="text-xs text-gray-400 font-medium mt-1">Total views</p>
                      </div>
                    </div>
                    <div className={`quad-card ${inner}`}>
                      <div className="flex justify-between items-center w-full">
                        <span className="text-sm font-medium text-gray-700">Profile Visits</span>
                        <div className={iconGreen}><UserCheck size={16} /></div>
                      </div>
                      <div className="mt-auto pt-2">
                        <StatValue loading={loading} value={followers.profileVisits} formatter={fmt} />
                        <p className="text-xs text-gray-400 font-medium mt-1">This week</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className={`${cardBase} p-4`}>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Engagement Breakdown</p>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: 'Likes', val: followers.likes, icon: <Heart size={14} />, cls: iconRed },
                      { label: 'Saves', val: followers.saves, icon: <Star size={14} />, cls: iconBox },
                      { label: 'Shares', val: followers.shares, icon: <Repeat2 size={14} />, cls: iconPurp },
                      { label: 'Engagement', val: null, disp: `${followers.engagementRate}%`, icon: <Percent size={14} />, cls: iconGreen },
                    ].map(({ label, val, disp, icon, cls }: any) => (
                      <div key={label} className={inner}>
                        <div className="flex justify-between items-center w-full">
                          <span className="text-xs font-medium text-gray-700">{label}</span>
                          <div className={cls}>{icon}</div>
                        </div>
                        <div className="mt-auto pt-2">
                          {loading ? <Skeleton className="h-8 w-16" /> : (
                            <h3 className="text-3xl font-semibold text-gray-900 tracking-tight leading-none stat-fade">
                              {disp ?? <AnimatedCounter value={val} />}
                            </h3>
                          )}
                          <p className="text-[10px] text-gray-400 mt-1">All posts</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className={`${cardBase} p-4`}>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Today Performance</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className={inner}>
                      <div className="flex justify-between items-start w-full">
                        <span className="text-xs font-medium text-gray-700">New Followers</span>
                        <div className={iconBox}><TrendingUp size={14} /></div>
                      </div>
                      <div className="flex justify-between items-center w-full mt-auto pt-2">
                        <div>
                          {loading ? <Skeleton className="h-8 w-16" /> : (
                            <h3 className="text-3xl font-semibold text-gray-900 leading-none stat-fade">+<AnimatedCounter value={followers.followersToday} /></h3>
                          )}
                          <span className="inline-block bg-[#E5F9ED] text-[#27AE60] px-1.5 py-0.5 rounded text-[9px] font-semibold mt-1">Live</span>
                        </div>
                        <MiniDonut percentage={Math.min((followers.followersToday / 100) * 100, 100)} id="fgt" color="#E86C15" />
                      </div>
                    </div>
                    <div className={inner}>
                      <div className="flex justify-between items-start w-full">
                        <span className="text-xs font-medium text-gray-700">Unfollows</span>
                        <div className={iconRed}><TrendingDown size={14} /></div>
                      </div>
                      <div className="flex justify-between items-center w-full mt-auto pt-2">
                        <div>
                          {loading ? <Skeleton className="h-8 w-16" /> : (
                            <h3 className="text-3xl font-semibold text-gray-900 leading-none stat-fade">-<AnimatedCounter value={followers.unfollowsToday} /></h3>
                          )}
                          <span className="inline-block bg-[#FFE5E5] text-[#D63031] px-1.5 py-0.5 rounded text-[9px] font-semibold mt-1">Today</span>
                        </div>
                        <MiniDonut percentage={Math.min((followers.unfollowsToday / 50) * 100, 100)} id="uft" color="#D63031" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* RIGHT */}
              <div className="og col-span-1 md:col-span-12 xl:col-span-7 flex flex-col gap-5">

                <div className={`${cardBase} p-4 md:p-6`} style={{ height: 280 }}>
                  <div className="flex justify-between items-start mb-2 shrink-0">
                    <div>
                      <h2 className="text-base font-semibold text-gray-900">Follower Growth</h2>
                      <p className="text-gray-400 text-[11px] mt-0.5 font-medium">Weekly trend</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-sm" style={{ background: 'linear-gradient(135deg,#E86C15,#D63031)' }} />
                      <span className="text-[10px] text-gray-500 font-medium">Followers</span>
                    </div>
                  </div>
                  <div style={{ flex: 1, minHeight: 0 }}>
                    {loading ? <Skeleton className="w-full h-full" /> : (
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={followers.followerGrowth} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
                          <defs>
                            <linearGradient id="fg" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#f97316" stopOpacity={0.35} />
                              <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                          <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} tickFormatter={fmt} />
                          <Tooltip contentStyle={tooltipStyle} formatter={(v: number, n: string) => [n === 'followers' ? fmt(v) : v, n === 'followers' ? 'Followers' : 'Gained']} />
                          <Area type="monotone" dataKey="followers" stroke="#f97316" strokeWidth={2.5} fill="url(#fg)" dot={false} activeDot={{ r: 5, fill: '#f97316' }} />
                        </AreaChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>

                <div className={`${cardBase} p-4 md:p-5`}>
                  <div className="flex justify-between items-center mb-3">
                    <div>
                      <h2 className="text-sm font-semibold text-gray-900">Top Post Engagement</h2>
                      <p className="text-gray-400 text-[10px] mt-0.5 font-medium">Likes, comments & saves per post</p>
                    </div>
                    <div className={iconBox}><Star size={14} /></div>
                  </div>
                  {loading ? <Skeleton className="w-full h-[160px]" /> : (
                    <ResponsiveContainer width="100%" height={160}>
                      <BarChart data={followers.topPostEngagement} margin={{ top: 4, right: 4, left: -20, bottom: 0 }} barGap={3}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                        <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={tooltipStyle} />
                        <Bar dataKey="likes" name="Likes" fill="#f97316" radius={[4, 4, 0, 0]} maxBarSize={22} fillOpacity={0.9} />
                        <Bar dataKey="comments" name="Comments" fill="#4B4B4B" radius={[4, 4, 0, 0]} maxBarSize={22} fillOpacity={0.7} />
                        <Bar dataKey="saves" name="Saves" fill="#6366f1" radius={[4, 4, 0, 0]} maxBarSize={22} fillOpacity={0.7} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                  <div className="flex items-center gap-4 mt-2">
                    {[['Likes', '#f97316'], ['Comments', '#4B4B4B'], ['Saves', '#6366f1']].map(([l, c]) => (
                      <div key={l} className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-sm" style={{ background: c as string, opacity: 0.85 }} />
                        <span className="text-[10px] text-gray-500 font-medium">{l}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Peak Hours */}
                <div className={`${cardBase} p-4 md:p-5`}>
                  <div className="flex justify-between items-center mb-3">
                    <div>
                      <h2 className="text-sm font-semibold text-gray-900">Peak Engagement Hours</h2>
                      <p className="text-gray-400 text-[10px] mt-0.5 font-medium">When your audience is most active</p>
                    </div>
                    <div className={iconBox}><Clock size={14} /></div>
                  </div>
                  {loading ? <Skeleton className="w-full h-[110px]" /> : (
                    <ResponsiveContainer width="100%" height={110}>
                      <BarChart data={followers.peakHours} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                        <XAxis dataKey="hour" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={{ borderRadius: '10px', border: 'none', fontSize: 11, boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}
                          formatter={(v: number) => [v, 'Engagement']} />
                        <Bar dataKey="engagement" radius={[4, 4, 0, 0]} maxBarSize={28}>
                          {followers.peakHours.map((entry, i) => (
                            <Cell key={i} fill={entry.engagement === Math.max(...followers.peakHours.map(h => h.engagement)) ? '#f97316' : '#e5e7eb'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                  <p className="text-[10px] text-gray-400 mt-1">
                    Peak: <span className="font-semibold text-[#f97316]">{followers.peakHours.reduce((a, b) => a.engagement > b.engagement ? a : b).hour}</span>
                  </p>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
