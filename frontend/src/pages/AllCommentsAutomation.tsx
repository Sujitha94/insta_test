import React, { useState, useEffect, useRef, lazy, Suspense } from 'react';
import {
  Plus, Save, Loader, Trash2, Edit, X,
  MessageCircle, Send, Heart, Camera,
  ChevronLeft, ChevronRight, User, MoreHorizontal,
  CheckCircle, MessageSquare, ShieldAlert
} from 'lucide-react';
import axios from 'axios';
import Swal from 'sweetalert2';
import Moderationcommentslist from './Moderationcommentslist';

// Lazy-load second file — never merged, loaded on demand only
const MediaConversations = lazy(() => import('./CommentsContainer'));

// ─── Instagram Story Icon ─────────────────────────────────────────────────────
function InstagramStoryIcon({ size = 20, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient id="igStoryGradient" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%"   stopColor="#f09433" />
          <stop offset="40%"  stopColor="#e6683c" />
          <stop offset="70%"  stopColor="#dc2743" />
          <stop offset="100%" stopColor="#bc1888" />
        </linearGradient>
      </defs>
      <circle
        cx="12" cy="12" r="10.5"
        stroke="url(#igStoryGradient)"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeDasharray="3.5 1.2"
        fill="none"
      />
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1" fill="none" opacity="0.12" />
      <path
        d="M10 8.5L16.5 12L10 15.5V8.5Z"
        fill="currentColor"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// --- Types ---

interface MediaItem {
  id: string;
  caption: string;
  media_type: string;
  media_url: string;
  timestamp: string;
  permalink: string;
  thumbnail_url?: string;
}

interface CarouselItem {
  image: string;
  title: string;
  subtitle: string;
  buttonText: string;
  buttonUrl: string;
}

interface TemplateItem {
  image: string;
  title: string;
  subtitle: string;
  buttonText: string;
  buttonUrl: string;
}

interface AutomationRule {
  ruleId?: string;
  mediaId: string;
  triggerText: string;
  replyText: string;
  caption?: string;
  commentReply?: string;
  ruleType: 'text' | 'template';
  carouselItems?: CarouselItem[];
  carouselCount?: number;
  templateItems?: TemplateItem[];
  templateCount?: number;
  thumbnail_url?: string;
  media_url?: string;
  media_type?: string;
  permalink?: string;
  isFollowerRequired: boolean;
  nonFollowerReplyText?: string;
  enableQuickReply?: boolean;
  quickReplyLabel?: string;
}

interface StoryAutomationRule {
  ruleId?: string;
  triggerText: string;
  replyText: string;
  ruleType: 'text' | 'template';
  templateItems?: TemplateItem[];
  templateCount?: number;
  isFollowerRequired: boolean;
  nonFollowerReplyText?: string;
  enableQuickReply?: boolean;
  quickReplyLabel?: string;
}

interface PaginationInfo {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  nextCursor?: string;
  prevCursor?: string;
}

// --- Helper Components ---

const MobilePreview: React.FC<{ rule: AutomationRule | StoryAutomationRule; activeItemIndex?: number }> = ({ rule, activeItemIndex = 0 }) => {
  const [carouselIndex, setCarouselIndex] = useState(0);
  const items = 'carouselItems' in rule ? rule.carouselItems : rule.templateItems;

  useEffect(() => {
    if (activeItemIndex !== undefined && items && activeItemIndex < items.length) {
      setCarouselIndex(activeItemIndex);
    }
  }, [activeItemIndex, items?.length]);

  const nextItem = () => { if (items && carouselIndex < items.length - 1) setCarouselIndex(prev => prev + 1); };
  const prevItem = () => { if (carouselIndex > 0) setCarouselIndex(prev => prev - 1); };

  return (
    <div className="flex flex-col items-center w-full lg:sticky lg:top-8">
      <div className="text-xs font-medium text-slate-700 mb-4 flex items-center gap-2">
        <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
        Live Preview
      </div>

      <div className="relative w-full max-w-[260px] h-[520px] sm:h-[540px] bg-zinc-950 rounded-[2.5rem] border-[6px] border-zinc-900 shadow-2xl overflow-hidden ring-1 ring-white/10">
        <div className="h-8 bg-zinc-950 flex justify-between items-center px-6 pt-2">
          <span className="text-white text-[9px] font-semibold">9:41</span>
          <div className="flex gap-1 items-center">
            <div className="w-2.5 h-2.5 border border-white/40 rounded-sm"></div>
            <div className="w-3 h-1.5 bg-white rounded-full"></div>
          </div>
        </div>

        <div className="h-12 bg-zinc-950/80 backdrop-blur-md border-b border-white/5 flex items-center px-4 justify-between">
          <div className="flex items-center gap-2">
            <ChevronLeft className="text-white" size={18} />
            <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-yellow-400 via-orange-500 to-pink-500 p-[1px]">
              <div className="w-full h-full rounded-full border border-black bg-zinc-800 flex items-center justify-center">
                <User size={12} className="text-zinc-400" />
              </div>
            </div>
            <div className="flex flex-col text-left">
              <span className="text-white text-[10px] font-semibold leading-tight">Your Profile</span>
              <span className="text-zinc-500 text-[8px]">Active now</span>
            </div>
          </div>
          <MoreHorizontal className="text-white" size={16} />
        </div>

        <div className="h-[380px] bg-black p-3 overflow-y-auto scrollbar-hide">
          <div className="flex flex-col gap-4">
            <div className="flex items-end gap-1.5 max-w-[85%]">
              <div className="w-5 h-5 rounded-full bg-zinc-800 flex-shrink-0"></div>
              <div className="bg-zinc-900 rounded-2xl rounded-bl-none px-3 py-1.5 text-left border border-white/5">
                <p className="text-white text-[10px]">
                  {rule.triggerText === '*' ? "Any keyword or mention..." : (rule.triggerText || "User message...")}
                </p>
              </div>
            </div>

            {rule.ruleType === 'text' ? (
              <div className="flex flex-col items-end gap-1">
                <div className="bg-blue-600 rounded-2xl rounded-br-none px-3 py-2 max-w-[85%] self-end shadow-lg text-left" style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
                  <p className="text-white text-[10px] whitespace-pre-wrap leading-normal" style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
                    {rule.replyText || "Your automated reply..."}
                  </p>
                </div>
                <span className="text-[8px] text-zinc-500 font-medium">Seen</span>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <div className="relative">
                  <div className="flex gap-2 transition-transform duration-500 ease-out"
                    style={{ transform: `translateX(-${carouselIndex * 208}px)` }}>
                    {(items && items.length > 0) ? items.map((item, idx) => (
                      <div key={idx} className="w-[200px] flex-shrink-0 bg-zinc-900 rounded-xl overflow-hidden border border-white/10 shadow-xl">
                        <div className="h-28 bg-zinc-800 overflow-hidden flex items-center justify-center relative">
                          {item.image ? (
                            <img src={item.image} alt="" className="w-full h-full object-cover"
                              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                          ) : <Camera size={24} className="text-zinc-700" />}
                        </div>
                        <div className="p-2.5 text-left">
                          <h4 className="text-white text-[10px] font-semibold truncate">{item.title || "Untitled Card"}</h4>
                          <p className="text-zinc-500 text-[9px] mt-0.5 line-clamp-2 h-6 leading-tight">{item.subtitle || "No description provided."}</p>
                          <div className="mt-2 py-1.5 w-full bg-zinc-800 border border-white/5 rounded-lg text-center">
                            <span className="text-blue-400 text-[9px] font-medium">{item.buttonText || "View Detail"}</span>
                          </div>
                        </div>
                      </div>
                    )) : (
                      <div className="w-[200px] bg-zinc-900 rounded-xl p-4 border border-dashed border-zinc-800 text-center flex flex-col items-center gap-2">
                        <Plus size={16} className="text-zinc-700" />
                        <p className="text-zinc-600 text-[9px] font-medium">Cards Empty</p>
                      </div>
                    )}
                  </div>

                  {items && items.length > 1 && (
                    <>
                      {carouselIndex > 0 && (
                        <button onClick={prevItem} className="absolute -left-1 top-1/2 -translate-y-1/2 bg-black/60 p-1 rounded-full text-white z-10 border border-white/10">
                          <ChevronLeft size={12} />
                        </button>
                      )}
                      {carouselIndex < items.length - 1 && (
                        <button onClick={nextItem} className="absolute -right-1 top-1/2 -translate-y-1/2 bg-black/60 p-1 rounded-full text-white z-10 border border-white/10">
                          <ChevronRight size={12} />
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="absolute bottom-6 left-0 right-0 px-3">
          <div className="h-9 bg-zinc-900 rounded-full border border-white/5 px-4 flex items-center justify-between shadow-lg">
            <span className="text-zinc-600 text-[9px]">Message...</span>
            <div className="flex gap-2">
              <Camera size={14} className="text-zinc-500" />
              <Heart size={14} className="text-zinc-500" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- InstagramCommentAutomation ---

const InstagramCommentAutomation: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const formHeadingRef = useRef<HTMLHeadingElement>(null);

  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [loadingMedia, setLoadingMedia] = useState<boolean>(false);
  const [mediaItemsPerPage] = useState<number>(10);
  const [mediaPaginationInfo, setMediaPaginationInfo] = useState<PaginationInfo | null>(null);

  const [automationRules, setAutomationRules] = useState<AutomationRule[]>([{
    mediaId: '', triggerText: '', replyText: '', caption: '', ruleType: 'text', commentReply: '', carouselCount: 1,
    carouselItems: [{ image: '', title: '', subtitle: '', buttonText: '', buttonUrl: '' }],
    isFollowerRequired: false, nonFollowerReplyText: '', enableQuickReply: false, quickReplyLabel: 'Followed'
  }]);
  const [existingRules, setExistingRules] = useState<AutomationRule[]>([]);
  const [showMediaSelector, setShowMediaSelector] = useState<boolean>(false);
  const [currentRuleIndex, setCurrentRuleIndex] = useState<number>(0);
  const [currentEditingItemIdx, setCurrentEditingItemIdx] = useState<number>(0);
  const [loadingRules, setLoadingRules] = useState<boolean>(true);
  const [showRules, setShowRules] = useState<boolean>(true);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [rulesPagination, setRulesPagination] = useState<PaginationInfo | null>(null);
  const rulesPerPage = 5;

  useEffect(() => { fetchExistingRules(); }, []);

  const fetchExistingRules = async (page = 1) => {
    setLoadingRules(true);
    try {
      const tenentId = localStorage.getItem('tenentid');
      const response = await axios.get(
        `/api/commentAutomationroute/rules?tenentId=${tenentId}&page=${page}&limit=${rulesPerPage}`
      );
      if (response.data && response.data.success) {
        const { rules, pagination } = response.data;
        const convertedRules = rules.map((rule: any) => ({
          ...rule,
          mediaId: rule.mediaId || rule.media_id || '',
          isFollowerRequired: rule.isFollowerRequired || false,
          nonFollowerReplyText: rule.nonFollowerReplyText || '',
          enableQuickReply: !!rule.enableQuickReply,
          quickReplyLabel: rule.quickReplyLabel || 'Followed',
          carouselItems: rule.carouselItems || [],
          carouselCount: rule.carouselCount || (rule.carouselItems?.length || 1)
        }));
        setExistingRules(convertedRules);
        setRulesPagination(pagination);
      }
    } catch (error) {
      console.error("Error fetching rules:", error);
    } finally {
      setLoadingRules(false);
    }
  };

  const fetchInstagramMedia = async (cursor?: string | null, direction?: 'next' | 'prev') => {
    try {
      setLoadingMedia(true);
      const tenentId = localStorage.getItem('tenentid');
      const params: any = { tenentId, limit: mediaItemsPerPage };
      if (direction === 'next' && cursor) params.after = cursor;
      else if (direction === 'prev' && cursor) params.before = cursor;
      const response = await axios.get(`/api/commentAutomationroute/media`, { params });
      if (response.data?.data) {
        setMediaItems(response.data.data);
        setMediaPaginationInfo(response.data.pagination);
      }
    } catch (error) {
      console.error("Error fetching media:", error);
    } finally {
      setLoadingMedia(false);
    }
  };

  const updateAutomationRule = (index: number, field: keyof AutomationRule, value: any) => {
    setAutomationRules(prevRules => {
      const newRules = [...prevRules];
      newRules[index] = { ...newRules[index], [field]: value };
      return newRules;
    });
  };

  const selectMedia = (ruleIndex: number, mediaId: string) => {
    const selectedItem = mediaItems.find(m => m.id === mediaId);
    const newRules = [...automationRules];
    newRules[ruleIndex] = { ...newRules[ruleIndex], mediaId, caption: selectedItem?.caption || "No caption" };
    setAutomationRules(newRules);
    setShowMediaSelector(false);
  };

  const openMediaSelector = (ruleIndex: number) => {
    setCurrentRuleIndex(ruleIndex);
    setShowMediaSelector(true);
    fetchInstagramMedia();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const rule = automationRules[0];
    if (!rule.mediaId || !rule.triggerText) return Swal.fire('Wait', 'Select a post and trigger word first', 'info');
    try {
      const tenentId = localStorage.getItem('tenentid');
      const payload = { ...rule, media_id: rule.mediaId };
      if (editingRuleId) {
        await axios.put(`/api/commentAutomationroute/rule/${editingRuleId}`, { tenentId, ...payload });
      } else {
        await axios.post('/api/commentAutomationroute/comment-automation', { tenentId, automationRules: [payload] });
      }
      Swal.fire('Saved', editingRuleId ? 'Rule updated' : 'Automation active', 'success');
      setEditingRuleId(null);
      setAutomationRules([{
        mediaId: '', triggerText: '', replyText: '', caption: '', ruleType: 'text', commentReply: '', carouselCount: 1,
        carouselItems: [{ image: '', title: '', subtitle: '', buttonText: '', buttonUrl: '' }],
        isFollowerRequired: false, nonFollowerReplyText: '', enableQuickReply: false, quickReplyLabel: 'Followed'
      }]);
      fetchExistingRules();
    } catch (error) {
      Swal.fire('Error', 'Save operation failed', 'error');
    }
  };

  const editRule = (rule: AutomationRule) => {
    setEditingRuleId(rule.ruleId || null);
    const existingMedia = mediaItems.find(m => m.id === rule.mediaId);
    setAutomationRules([{
      ...rule,
      mediaId: rule.mediaId,
      caption: existingMedia?.caption || rule.caption || "Selected Post",
      ruleType: rule.ruleType || 'text',
      carouselItems: rule.carouselItems || [{ image: '', title: '', subtitle: '', buttonText: '', buttonUrl: '' }]
    }]);
    formHeadingRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const deleteRule = async (id: string) => {
    const res = await Swal.fire({ title: 'Delete Rule?', text: "This will remove the automation.", icon: 'warning', showCancelButton: true, confirmButtonColor: '#ef4444' });
    if (res.isConfirmed) {
      try {
        const tenentId = localStorage.getItem('tenentid');
        await axios.delete(`/api/commentAutomationroute/rule/${id}?tenentId=${tenentId}`);
        fetchExistingRules();
      } catch (error) { Swal.fire('Error', 'Could not delete', 'error'); }
    }
  };

  const getMediaThumbnailforrule = async (rule: AutomationRule): Promise<string> => {
    try {
      const tenentId = localStorage.getItem("tenentid");
      if (rule.thumbnail_url || rule.media_url) return rule.thumbnail_url || rule.media_url || "";
      const response = await axios.get(`/api/commentAutomationroute/update-thumbnail/${rule.ruleId}`, { params: { tenentId } });
      if (response.data?.success && response.data.updatedRule) {
        const updated = response.data.updatedRule as AutomationRule;
        setExistingRules(prev => prev.map(r => r.ruleId === rule.ruleId ? updated : r));
        return updated.thumbnail_url || updated.media_url || "";
      }
      return "";
    } catch (error) { return ""; }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 max-w-7xl mx-auto items-start">
      <div className="flex-grow w-full lg:w-[65%] space-y-4">
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
            <div>
              <h2 ref={formHeadingRef} className="text-base font-bold text-slate-900">
                {editingRuleId ? 'Edit Configuration' : 'Create New Rule'}
              </h2>
            </div>
            <div className="flex gap-2">
              {editingRuleId && (
                <button type="button" onClick={() => {
                  setEditingRuleId(null);
                  setAutomationRules([{ mediaId: '', triggerText: '', replyText: '', caption: '', ruleType: 'text', isFollowerRequired: false, carouselItems: [{ image: '', title: '', subtitle: '', buttonText: '', buttonUrl: '' }], carouselCount: 1, commentReply: '', nonFollowerReplyText: '', enableQuickReply: false, quickReplyLabel: 'Followed' }]);
                }} className="px-3 py-1.5 bg-slate-200 text-slate-700 rounded-lg text-xs font-medium hover:bg-slate-300">Cancel</button>
              )}
              <button type="button" onClick={onClose} className="p-1.5 hover:bg-slate-200 rounded-md transition-colors"><X size={16} /></button>
            </div>
          </div>

          <div className="p-6 space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-700 ml-1">1. Select the Post</label>
                <button type="button" onClick={() => openMediaSelector(0)} className="w-full h-11 px-4 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between hover:border-orange-500 transition-all text-xs group text-left">
                  <span className="truncate text-slate-700 font-medium">
                    {automationRules[0].mediaId ? (automationRules[0].caption || "Selected Post") : "Choose Instagram content"}
                  </span>
                  <Camera size={16} className="text-slate-400 group-hover:text-orange-500" />
                </button>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-700 ml-1">2. Trigger Keyword</label>
                <div className="flex gap-2 h-11">
                  <input type="text" value={automationRules[0].triggerText} onChange={(e) => updateAutomationRule(0, 'triggerText', e.target.value)} className="flex-1 px-4 bg-gray-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-1 focus:ring-orange-500 outline-none" placeholder="e.g. 'PRICE', 'OFFER'" disabled={automationRules[0].triggerText === '*'} />
                  <button type="button" onClick={() => updateAutomationRule(0, 'triggerText', automationRules[0].triggerText === '*' ? '' : '*')} className={`px-4 rounded-xl text-xs font-medium transition-all border ${automationRules[0].triggerText === '*' ? 'bg-orange-600 border-orange-600 text-white shadow-md' : 'bg-white border-slate-200 text-slate-700 hover:border-orange-200'}`}>
                    {automationRules[0].triggerText === '*' ? 'ANY ✓' : 'ANY'}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-4 items-center p-3 bg-slate-50 rounded-xl border border-slate-100">
              <div className="flex-1 min-w-[200px] flex items-center gap-3">
                <span className="text-xs font-medium text-slate-700 px-1">Reply Type:</span>
                <div className="flex flex-1 p-1 bg-slate-200 rounded-lg gap-1">
                  <button type="button" onClick={() => updateAutomationRule(0, 'ruleType', 'text')} className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-all ${automationRules[0].ruleType === 'text' ? 'bg-white text-orange-600 shadow-sm' : 'text-slate-700 hover:text-slate-700'}`}>Text</button>
                  <button type="button" onClick={() => {
                    updateAutomationRule(0, 'ruleType', 'template');
                    if (!automationRules[0].carouselItems || automationRules[0].carouselItems.length === 0) {
                      updateAutomationRule(0, 'carouselItems', [{ image: '', title: '', subtitle: '', buttonText: '', buttonUrl: '' }]);
                      updateAutomationRule(0, 'carouselCount', 1);
                    }
                  }} className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-all ${automationRules[0].ruleType === 'template' ? 'bg-white text-orange-600 shadow-sm' : 'text-slate-700 hover:text-slate-700'}`}>Carousel</button>
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer group px-3">
                <div className="relative">
                  <input type="checkbox" checked={automationRules[0].isFollowerRequired} onChange={(e) => updateAutomationRule(0, 'isFollowerRequired', e.target.checked)} className="peer sr-only" />
                  <div className="w-8 h-4 bg-slate-300 rounded-full peer-checked:bg-orange-600 transition-colors"></div>
                  <div className="absolute left-0.5 top-0.5 w-3 h-3 bg-white rounded-full peer-checked:translate-x-4 transition-transform shadow-sm"></div>
                </div>
                <span className="text-xs font-medium text-slate-700">Followers Only</span>
              </label>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-700 ml-1">3. Reply Comment (Optional)</label>
              <input type="text" value={automationRules[0].commentReply || ''} onChange={(e) => updateAutomationRule(0, 'commentReply', e.target.value)} className="w-full px-4 h-11 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-1 focus:ring-orange-500 outline-none" placeholder="e.g. 'Just sent you a DM! 💌'" />
            </div>

            {automationRules[0].ruleType === 'text' ? (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-700 ml-1">4. Automated DM Content</label>
                <textarea value={automationRules[0].replyText} onChange={(e) => updateAutomationRule(0, 'replyText', e.target.value)} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl h-24 text-xs font-medium outline-none focus:ring-1 focus:ring-orange-500 resize-none" placeholder="Enter the private message users will receive..." />
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <label className="text-xs font-medium text-slate-700">4. Carousel Cards ({automationRules[0].carouselItems?.length || 0}/10)</label>
                  <button type="button" onClick={() => {
                    setAutomationRules(prevRules => {
                      const currentRule = prevRules[0];
                      const items = currentRule.carouselItems || [];
                      if (items.length >= 10) { Swal.fire('Limit Reached', 'Maximum 10 cards allowed', 'info'); return prevRules; }
                      const newItems = [...items, { image: '', title: '', subtitle: '', buttonText: '', buttonUrl: '' }];
                      setCurrentEditingItemIdx(newItems.length - 1);
                      return [{ ...currentRule, carouselItems: newItems, carouselCount: newItems.length }];
                    });
                  }} className="text-xs px-2 py-1 bg-orange-50 text-orange-600 rounded-md font-medium hover:bg-orange-100">Add Card +</button>
                </div>

                <div className="grid grid-cols-1 gap-2 max-h-64 overflow-y-auto pr-1 scrollbar-thin">
                  {(automationRules[0].carouselItems || []).map((item, idx) => (
                    <div key={idx} onClick={() => setCurrentEditingItemIdx(idx)} className={`p-3 border rounded-xl transition-all relative ${currentEditingItemIdx === idx ? 'border-orange-200 bg-orange-50/20' : 'border-slate-100 bg-white'}`}>
                      {idx > 0 && (
                        <button type="button" onClick={() => {
                          const items = [...(automationRules[0].carouselItems || [])].filter((_, i) => i !== idx);
                          updateAutomationRule(0, 'carouselItems', items);
                          updateAutomationRule(0, 'carouselCount', items.length);
                        }} className="absolute top-2 right-2 text-slate-300 hover:text-red-500 transition-colors"><Trash2 size={14} /></button>
                      )}
                      <div className="space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                          <input type="text" value={item.image} onChange={(e) => { const items = (automationRules[0].carouselItems || []).map((it, i) => i === idx ? { ...it, image: e.target.value } : it); updateAutomationRule(0, 'carouselItems', items); }} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs outline-none" placeholder="Image URL" />
                          <input type="text" value={item.title} onChange={(e) => { const items = (automationRules[0].carouselItems || []).map((it, i) => i === idx ? { ...it, title: e.target.value } : it); updateAutomationRule(0, 'carouselItems', items); }} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold outline-none" placeholder="Title" />
                        </div>
                        <input type="text" value={item.subtitle} onChange={(e) => { const items = (automationRules[0].carouselItems || []).map((it, i) => i === idx ? { ...it, subtitle: e.target.value } : it); updateAutomationRule(0, 'carouselItems', items); }} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs outline-none" placeholder="Description" />
                        <div className="grid grid-cols-2 gap-2">
                          <input type="text" value={item.buttonText} onChange={(e) => { const items = (automationRules[0].carouselItems || []).map((it, i) => i === idx ? { ...it, buttonText: e.target.value } : it); updateAutomationRule(0, 'carouselItems', items); }} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs outline-none" placeholder="Btn Label" />
                          <input type="text" value={item.buttonUrl} onChange={(e) => { const items = (automationRules[0].carouselItems || []).map((it, i) => i === idx ? { ...it, buttonUrl: e.target.value } : it); updateAutomationRule(0, 'carouselItems', items); }} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs outline-none" placeholder="Link" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="block lg:hidden">
              <MobilePreview rule={automationRules[0]} activeItemIndex={currentEditingItemIdx} />
            </div>

            <button type="submit" className="w-full py-4 bg-orange-600 text-white rounded-xl font-bold text-sm shadow-xl hover:shadow-orange-200 transition-all flex items-center justify-center gap-2">
              <Save size={16} /> {editingRuleId ? 'Update Rule' : 'Deploy Automation'}
            </button>
          </div>
        </form>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/30">
            <h3 className="text-sm font-bold text-slate-900">Deployment Management</h3>
            <button type="button" onClick={() => setShowRules(!showRules)} className="text-orange-600 text-xs font-medium">{showRules ? 'Collapse' : 'Expand'}</button>
          </div>
          {showRules && (
            <div className="p-3 space-y-2">
              {loadingRules ? (
                <div className="py-8 text-center"><Loader className="animate-spin mx-auto text-orange-500" size={20} /></div>
              ) : existingRules.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-xs font-medium italic">No rules active.</div>
              ) : (
                <>
                  {existingRules.map(rule => (
                    <div key={rule.ruleId} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100 group transition-all hover:bg-white hover:shadow-md">
                      <div className="w-10 h-10 rounded-lg overflow-hidden bg-slate-200 flex-shrink-0">
                        <img
                          src={rule.thumbnail_url || rule.media_url || 'https://via.placeholder.com/100'}
                          className="w-full h-full object-cover"
                          alt=""
                          onError={async (e) => {
                            const newUrl = await getMediaThumbnailforrule(rule);
                            if (newUrl) (e.target as HTMLImageElement).src = newUrl;
                          }}
                        />
                      </div>
                      <div className="flex-grow min-w-0">
                        <div className="text-xs space-y-1 min-w-0">
                          <div className="flex items-baseline gap-1.5 min-w-0">
                            <span className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded font-medium capitalize leading-tight ${rule.ruleType === 'text' ? 'bg-blue-100 text-blue-600' : 'bg-orange-100 text-orange-600'}`}>
                              {rule.ruleType}
                            </span>
                            <p className="font-semibold text-slate-900 truncate max-w-[160px] sm:max-w-[220px]">
                              &ldquo;{rule.triggerText === '*' ? 'Any' : rule.triggerText}&rdquo;
                            </p>
                          </div>
                          <div className="flex items-baseline gap-1.5 min-w-0">
                            <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded font-medium bg-slate-100 text-slate-500 leading-tight">reply</span>
                            <span className="truncate text-slate-700 max-w-[160px] sm:max-w-[220px] block">
                              {rule.replyText || `${rule.carouselItems?.length || 0} carousel items`}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button type="button" onClick={() => editRule(rule)} className="p-1.5 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"><Edit size={14} /></button>
                        <button type="button" onClick={() => rule.ruleId && deleteRule(rule.ruleId)} className="p-1.5 text-red-600 hover:bg-red-100 rounded-lg transition-colors"><Trash2 size={14} /></button>
                      </div>
                    </div>
                  ))}
                  {rulesPagination && rulesPagination.totalPages > 1 && (
                    <div className="flex justify-between items-center mt-4 px-1 pb-1">
                      <button type="button" disabled={!rulesPagination.hasPreviousPage} onClick={() => fetchExistingRules(rulesPagination.currentPage - 1)} className="px-3 py-1 bg-slate-100 rounded-lg text-xs font-medium disabled:opacity-30">Prev</button>
                      <span className="text-xs font-medium text-slate-400">Page {rulesPagination.currentPage} of {rulesPagination.totalPages}</span>
                      <button type="button" disabled={!rulesPagination.hasNextPage} onClick={() => fetchExistingRules(rulesPagination.currentPage + 1)} className="px-3 py-1 bg-orange-600 text-white rounded-lg text-xs font-medium disabled:opacity-30">Next</button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="hidden lg:flex w-full lg:w-[35%] flex-col items-center">
        <MobilePreview rule={automationRules[0]} activeItemIndex={currentEditingItemIdx} />
      </div>

      {showMediaSelector && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-3xl shadow-2xl p-4 sm:p-6 w-full max-w-4xl h-[80vh] flex flex-col overflow-hidden">
            <div className="p-6 border-b flex justify-between items-center bg-slate-50/50">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Select Instagram Post</h3>
                <p className="text-slate-700 text-xs font-medium mt-1">Choose the source for automation</p>
              </div>
              <button type="button" onClick={() => setShowMediaSelector(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><X size={20} /></button>
            </div>
            <div className="flex-1 overflow-y-auto pr-1 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 scrollbar-thin">
              {loadingMedia ? (
                <div className="col-span-full py-20 text-center"><Loader className="animate-spin mx-auto text-orange-600" size={32} /></div>
              ) : mediaItems.length > 0 ? mediaItems.map(item => (
                <div key={item.id} onClick={() => selectMedia(currentRuleIndex, item.id)} className="cursor-pointer group">
                  <div className={`aspect-square bg-slate-100 rounded-2xl overflow-hidden border-2 transition-all ${automationRules[currentRuleIndex].mediaId === item.id ? 'border-orange-500 shadow-xl' : 'border-transparent group-hover:border-orange-200'}`}>
                    <img src={item.media_type === 'VIDEO' ? item.thumbnail_url : item.media_url} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" alt="" />
                  </div>
                  <p className="text-xs mt-2 text-slate-700 font-medium text-center truncate px-1">{item.caption || 'No caption'}</p>
                </div>
              )) : <div className="col-span-full py-20 text-center text-slate-400 text-sm font-medium">No media data found.</div>}
            </div>
            {mediaPaginationInfo && (
              <div className="flex justify-between items-center mt-6 border-t pt-4">
                <button type="button" disabled={!mediaPaginationInfo.hasPreviousPage} onClick={() => fetchInstagramMedia(mediaPaginationInfo.prevCursor, 'prev')} className="px-4 py-2 bg-slate-100 rounded-xl text-xs font-medium disabled:opacity-30">Prev</button>
                <span className="text-xs font-medium text-slate-400">Page {mediaPaginationInfo.currentPage} of {mediaPaginationInfo.totalPages}</span>
                <button type="button" disabled={!mediaPaginationInfo.hasNextPage} onClick={() => fetchInstagramMedia(mediaPaginationInfo.nextCursor, 'next')} className="px-4 py-2 bg-orange-600 text-white rounded-xl text-xs font-medium disabled:opacity-30">Next</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// --- StoryCommentAutomation ---

const StoryCommentAutomation: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const formHeadingRef = useRef<HTMLDivElement>(null);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [automationRules, setAutomationRules] = useState<StoryAutomationRule[]>([{
    triggerText: '', replyText: '', ruleType: 'text', templateCount: 1,
    templateItems: [{ image: '', title: '', subtitle: '', buttonText: '', buttonUrl: '' }],
    isFollowerRequired: false, nonFollowerReplyText: '', enableQuickReply: false, quickReplyLabel: 'Followed'
  }]);
  const [existingRules, setExistingRules] = useState<StoryAutomationRule[]>([]);
  const [loadingRules, setLoadingRules] = useState(false);
  const [currentEditingItemIdx, setCurrentEditingItemIdx] = useState(0);

  useEffect(() => { fetchExistingRules(); }, []);

  const fetchExistingRules = async () => {
    setLoadingRules(true);
    try {
      const tenentId = localStorage.getItem('tenentid');
      const response = await axios.get(`/api/storycommentsAutomationroute/rules?tenentId=${tenentId}`);
      if (response.data?.success) {
        const rules = response.data.rules.map((rule: any) => ({
          ...rule,
          templateItems: rule.templateItems || [],
          templateCount: rule.templateCount || (rule.templateItems?.length || 1)
        }));
        setExistingRules(rules);
      }
    } catch (e) { console.error(e); } finally { setLoadingRules(false); }
  };

  const updateRule = (field: keyof StoryAutomationRule, value: any) => {
    setAutomationRules(prevRules => { const newRules = [...prevRules]; newRules[0] = { ...newRules[0], [field]: value }; return newRules; });
  };

  const editRule = (rule: StoryAutomationRule) => {
    setEditingRuleId(rule.ruleId || null);
    setAutomationRules([{ ...rule, ruleType: rule.ruleType || 'text', templateItems: rule.templateItems || [{ image: '', title: '', subtitle: '', buttonText: '', buttonUrl: '' }] }]);
    formHeadingRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const cancelEditing = () => {
    setEditingRuleId(null);
    setAutomationRules([{ triggerText: '', replyText: '', ruleType: 'text', templateCount: 1, templateItems: [{ image: '', title: '', subtitle: '', buttonText: '', buttonUrl: '' }], isFollowerRequired: false, nonFollowerReplyText: '', enableQuickReply: false, quickReplyLabel: 'Followed' }]);
  };

  const deleteRule = async (id: string) => {
    const res = await Swal.fire({ title: 'Delete Rule?', text: "Remove story automation.", icon: 'warning', showCancelButton: true, confirmButtonColor: '#ef4444' });
    if (res.isConfirmed) {
      try {
        const tenentId = localStorage.getItem('tenentid');
        await axios.delete(`/api/storycommentsAutomationroute/rule/${id}?tenentId=${tenentId}`);
        setExistingRules(prev => prev.filter(r => r.ruleId !== id));
        if (editingRuleId === id) cancelEditing();
      } catch (e) { Swal.fire('Error', 'Operation failed.', 'error'); }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!automationRules[0].triggerText) return Swal.fire('Wait', 'Enter a story keyword first', 'info');
    try {
      const tenentId = localStorage.getItem('tenentid');
      if (editingRuleId) {
        await axios.put(`/api/storycommentsAutomationroute/rule/${editingRuleId}`, { tenentId, ...automationRules[0] });
      } else {
        await axios.post('/api/storycommentsAutomationroute/comment-automation', { tenentId, automationRules: [automationRules[0]] });
      }
      Swal.fire('Saved', 'Story rule configuration active', 'success');
      cancelEditing();
      fetchExistingRules();
    } catch (e) { Swal.fire('Error', 'Save failed.', 'error'); }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 max-w-7xl mx-auto items-start">
      <div className="flex-grow w-full lg:w-[65%] space-y-4">
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div ref={formHeadingRef} className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
            <h2 className="text-sm font-bold text-slate-900">Story Configuration</h2>
            <div className="flex gap-2">
              {editingRuleId && <button type="button" onClick={cancelEditing} className="px-3 py-1.5 bg-slate-200 text-slate-700 rounded-lg text-xs font-medium">Cancel</button>}
              <button type="button" onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-md"><X size={16} /></button>
            </div>
          </div>

          <div className="p-6 space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-700 ml-1">Story Keyword</label>
                <div className="flex gap-2 h-11">
                  <input type="text" value={automationRules[0].triggerText} onChange={(e) => updateRule('triggerText', e.target.value)} className="flex-1 px-4 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium outline-none" placeholder="e.g. 'WIN'" disabled={automationRules[0].triggerText === '*'} />
                  <button type="button" onClick={() => updateRule('triggerText', automationRules[0].triggerText === '*' ? '' : '*')} className={`px-4 rounded-xl text-xs font-medium border transition-all ${automationRules[0].triggerText === '*' ? 'bg-orange-600 border-orange-600 text-white shadow-md' : 'bg-white border-slate-200 text-slate-400'}`}>ANY</button>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-700 ml-1">Response Type</label>
                <div className="flex p-1 bg-slate-200 rounded-lg gap-1 h-11 items-center">
                  <button type="button" onClick={() => updateRule('ruleType', 'text')} className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-all ${automationRules[0].ruleType === 'text' ? 'bg-white text-orange-600 shadow-sm' : 'text-slate-700'}`}>Text</button>
                  <button type="button" onClick={() => {
                    updateRule('ruleType', 'template');
                    if (!automationRules[0].templateItems || automationRules[0].templateItems.length === 0) {
                      updateRule('templateItems', [{ image: '', title: '', subtitle: '', buttonText: '', buttonUrl: '' }]);
                      updateRule('templateCount', 1);
                    }
                  }} className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-all ${automationRules[0].ruleType === 'template' ? 'bg-white text-orange-600 shadow-sm' : 'text-slate-700'}`}>Template</button>
                </div>
              </div>
            </div>

            {automationRules[0].ruleType === 'text' ? (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-700 ml-1">Automated DM Content</label>
                <textarea value={automationRules[0].replyText} onChange={(e) => updateRule('replyText', e.target.value)} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl h-24 text-xs font-medium outline-none resize-none" placeholder="Write message for mentions..." />
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <label className="text-xs font-medium text-slate-700">Template Cards ({automationRules[0].templateItems?.length || 0}/10)</label>
                  <button type="button" onClick={() => {
                    setAutomationRules(prevRules => {
                      const currentRule = prevRules[0];
                      const items = currentRule.templateItems || [];
                      if (items.length >= 10) { Swal.fire('Limit Reached', 'Maximum 10 cards allowed', 'info'); return prevRules; }
                      const newItems = [...items, { image: '', title: '', subtitle: '', buttonText: '', buttonUrl: '' }];
                      setCurrentEditingItemIdx(newItems.length - 1);
                      return [{ ...currentRule, templateItems: newItems, templateCount: newItems.length }];
                    });
                  }} className="text-xs px-2 py-1 bg-orange-50 text-orange-600 rounded-md font-medium hover:bg-orange-100">Add Card +</button>
                </div>
                <div className="grid grid-cols-1 gap-2 max-h-64 overflow-y-auto pr-1">
                  {(automationRules[0].templateItems || []).map((item, idx) => (
                    <div key={idx} onClick={() => setCurrentEditingItemIdx(idx)} className={`p-3 border rounded-xl relative ${currentEditingItemIdx === idx ? 'border-orange-200 bg-orange-50/20' : 'border-slate-100 bg-white'}`}>
                      {idx > 0 && (
                        <button type="button" onClick={() => {
                          const items = automationRules[0].templateItems?.filter((_, i) => i !== idx) || [];
                          updateRule('templateItems', items);
                          updateRule('templateCount', items.length);
                        }} className="absolute top-2 right-2 text-slate-300 hover:text-red-500"><Trash2 size={14} /></button>
                      )}
                      <div className="space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                          <input type="text" placeholder="Img URL" value={item.image} onChange={(e) => { const items = (automationRules[0].templateItems || []).map((it, i) => i === idx ? { ...it, image: e.target.value } : it); updateRule('templateItems', items); }} className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs outline-none" />
                          <input type="text" placeholder="Title" value={item.title} onChange={(e) => { const items = (automationRules[0].templateItems || []).map((it, i) => i === idx ? { ...it, title: e.target.value } : it); updateRule('templateItems', items); }} className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold outline-none" />
                        </div>
                        <input type="text" placeholder="Description (Subtitle)" value={item.subtitle} onChange={(e) => { const items = (automationRules[0].templateItems || []).map((it, i) => i === idx ? { ...it, subtitle: e.target.value } : it); updateRule('templateItems', items); }} className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs outline-none" />
                        <div className="grid grid-cols-2 gap-2">
                          <input type="text" placeholder="Button Text" value={item.buttonText} onChange={(e) => { const items = (automationRules[0].templateItems || []).map((it, i) => i === idx ? { ...it, buttonText: e.target.value } : it); updateRule('templateItems', items); }} className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs outline-none" />
                          <input type="text" placeholder="Button URL" value={item.buttonUrl} onChange={(e) => { const items = (automationRules[0].templateItems || []).map((it, i) => i === idx ? { ...it, buttonUrl: e.target.value } : it); updateRule('templateItems', items); }} className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs outline-none" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="block lg:hidden">
              <MobilePreview rule={automationRules[0] as any} activeItemIndex={currentEditingItemIdx} />
            </div>

            <button type="submit" className="w-full py-4 bg-orange-600 text-white rounded-xl font-bold text-sm shadow-xl hover:shadow-orange-200 transition-all flex items-center justify-center gap-2">
              <Save size={16} /> {editingRuleId ? 'Update Rule' : 'Activate Rule'}
            </button>
          </div>
        </form>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-slate-50/30">
            <h3 className="text-sm font-bold text-slate-900">Story Deployment</h3>
          </div>
          <div className="p-3 space-y-2">
            {loadingRules ? (
              <div className="py-8 text-center"><Loader className="animate-spin mx-auto text-orange-500" size={20} /></div>
            ) : existingRules.length > 0 ? existingRules.map(r => (
              <div key={r.ruleId} className={`flex justify-between items-center p-3 bg-slate-50 border border-slate-100 rounded-xl group transition-all hover:bg-white hover:shadow-md ${editingRuleId === r.ruleId ? 'border-orange-500 bg-orange-50/20 shadow-sm' : ''}`}>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-gradient-to-br from-orange-50 to-pink-50 border border-orange-100 rounded-lg flex items-center justify-center">
                    <InstagramStoryIcon size={18} className="text-orange-500" />
                  </div>
                  <div className="text-left">
                    <span className="text-xs font-semibold text-slate-900 block">"{r.triggerText === '*' ? 'Every interaction' : r.triggerText}"</span>
                    <span className="text-xs text-slate-700 font-medium">{r.ruleType} config</span>
                  </div>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button type="button" onClick={() => editRule(r)} className="p-1.5 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"><Edit size={14} /></button>
                  <button type="button" onClick={() => r.ruleId && deleteRule(r.ruleId)} className="p-1.5 text-red-600 hover:bg-red-100 rounded-lg transition-colors"><Trash2 size={14} /></button>
                </div>
              </div>
            )) : <p className="text-center text-slate-400 font-medium text-xs py-8 italic">Empty deployment.</p>}
          </div>
        </div>
      </div>

      <div className="hidden lg:flex w-full lg:w-[35%] flex-col items-center">
        <MobilePreview rule={automationRules[0] as any} activeItemIndex={currentEditingItemIdx} />
      </div>
    </div>
  );
};

// ── Main Hub Component ────────────────────────────────────────────
type ActiveTab = 'comment' | 'story' | 'chat' | 'moderation' | null;

const AllCommentsAutomation: React.FC = () => {
  const [activeTab, setActiveTab]           = useState<ActiveTab>(null);
  const [showModeration, setShowModeration] = useState<boolean>(false);

  // ── Check commentmoderation flag for this tenant ──────────────
  useEffect(() => {
  const tenentId = localStorage.getItem('tenentid');
  const isCommentModeration = localStorage.getItem('commentmoderation') !== 'false';

  if (!tenentId) return;

  console.log("Tenant ID:", tenentId);

  setShowModeration(isCommentModeration);
}, []);

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-[#F8F9FB] p-3 sm:p-10 pb-24 sm:pb-10 font-sans selection:bg-orange-100">
      <div className="w-full max-w-7xl mx-auto space-y-6 sm:space-y-10">

        <div className="text-center space-y-2 sm:space-y-3">
          <h1 className="text-xl sm:text-3xl font-bold text-slate-900">Instagram Automation</h1>
          <p className="text-slate-700 max-w-md mx-auto text-xs sm:text-sm font-medium leading-relaxed">Configure response triggers for comments and story replies</p>
        </div>

        {/* ── Tab Cards Grid ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">

          {/* Card 1 — Comment Automation */}
          <button
            onClick={() => setActiveTab(activeTab === 'comment' ? null : 'comment')}
            className={`relative p-4 rounded-2xl border-2 transition-all overflow-hidden group text-left
              ${activeTab === 'comment' ? 'border-orange-500 bg-white shadow-xl scale-[1.02]' : 'border-transparent bg-white hover:border-orange-100 shadow-sm'}`}
          >
            <div className="flex items-center gap-3 relative z-10">
              <div className={`p-2.5 rounded-xl transition-colors flex-shrink-0
                ${activeTab === 'comment' ? 'bg-orange-600 text-white shadow-lg' : 'bg-orange-50 text-orange-500 group-hover:bg-orange-100'}`}>
                <MessageCircle size={20} />
              </div>
              <div>
                <h2 className="text-xs font-bold text-slate-900 leading-tight">Comment Automation</h2>
                <p className="text-slate-400 text-[10px] font-medium mt-0.5">Automate post and reels comment</p>
              </div>
            </div>
            {activeTab === 'comment' && <div className="absolute top-3 right-3 text-orange-600"><CheckCircle size={15} /></div>}
          </button>

          {/* Card 2 — Story Automation */}
          <button
            onClick={() => setActiveTab(activeTab === 'story' ? null : 'story')}
            className={`relative p-4 rounded-2xl border-2 transition-all overflow-hidden group text-left
              ${activeTab === 'story' ? 'border-orange-500 bg-white shadow-xl scale-[1.02]' : 'border-transparent bg-white hover:border-orange-100 shadow-sm'}`}
          >
            <div className="flex items-center gap-3 relative z-10">
              <div className={`p-2.5 rounded-xl transition-colors flex-shrink-0
                ${activeTab === 'story' ? 'bg-orange-600 text-white shadow-lg' : 'bg-orange-50 text-orange-500 group-hover:bg-orange-100'}`}>
                <InstagramStoryIcon size={20} className={activeTab === 'story' ? 'text-white' : 'text-orange-500'} />
              </div>
              <div>
                <h2 className="text-xs font-bold text-slate-900 leading-tight">Story Automation</h2>
                <p className="text-slate-400 text-[10px] font-medium mt-0.5">Automate Replies from story</p>
              </div>
            </div>
            {activeTab === 'story' && <div className="absolute top-3 right-3 text-orange-600"><CheckCircle size={15} /></div>}
          </button>

          {/* Card 3 — Comment Chat */}
          <button
            onClick={() => setActiveTab(activeTab === 'chat' ? null : 'chat')}
            className={`relative p-4 rounded-2xl border-2 transition-all overflow-hidden group text-left
              ${activeTab === 'chat' ? 'border-orange-500 bg-white shadow-xl scale-[1.02]' : 'border-transparent bg-white hover:border-orange-100 shadow-sm'}`}
          >
            <div className="flex items-center gap-3 relative z-10">
              <div className={`p-2.5 rounded-xl transition-colors flex-shrink-0
                ${activeTab === 'chat' ? 'bg-orange-600 text-white shadow-lg' : 'bg-orange-50 text-orange-500 group-hover:bg-orange-100'}`}>
                <MessageSquare size={20} />
              </div>
              <div>
                <h2 className="text-xs font-bold text-slate-900 leading-tight">Comment Chat</h2>
                <p className="text-slate-400 text-[10px] font-medium mt-0.5">View Comments History</p>
              </div>
            </div>
            {activeTab === 'chat' && <div className="absolute top-3 right-3 text-orange-600"><CheckCircle size={15} /></div>}
          </button>

          {/* Card 4 — Moderation (only when commentmoderation === true) */}
          {showModeration && (
            <button
              onClick={() => setActiveTab(activeTab === 'moderation' ? null : 'moderation')}
              className={`relative p-4 rounded-2xl border-2 transition-all overflow-hidden group text-left
                ${activeTab === 'moderation' ? 'border-orange-500 bg-white shadow-xl scale-[1.02]' : 'border-transparent bg-white hover:border-orange-100 shadow-sm'}`}
            >
              <div className="flex items-center gap-3 relative z-10">
                <div className={`p-2.5 rounded-xl transition-colors flex-shrink-0
                  ${activeTab === 'moderation' ? 'bg-orange-600 text-white shadow-lg' : 'bg-orange-50 text-orange-500 group-hover:bg-orange-100'}`}>
                  <ShieldAlert size={20} />
                </div>
                <div>
                  <h2 className="text-xs font-bold text-slate-900 leading-tight">Moderation</h2>
                  <p className="text-slate-400 text-[10px] font-medium mt-0.5">Deleted &amp; hidden comments</p>
                </div>
              </div>
              {activeTab === 'moderation' && <div className="absolute top-3 right-3 text-orange-600"><CheckCircle size={15} /></div>}
            </button>
          )}

        </div>

        {/* ── Panels ── */}
        <div className="pt-4 transition-all duration-500">

          {activeTab === 'comment' && <InstagramCommentAutomation onClose={() => setActiveTab(null)} />}

          {activeTab === 'story' && <StoryCommentAutomation onClose={() => setActiveTab(null)} />}

          {activeTab === 'chat' && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden md:overflow-hidden">
              <div className="px-5 py-3 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <h2 className="text-sm font-bold text-slate-900">Comment Chat History</h2>
                <button type="button" onClick={() => setActiveTab(null)} className="p-1.5 hover:bg-slate-200 rounded-md transition-colors">
                  <X size={15} />
                </button>
              </div>
              <Suspense fallback={
                <div className="flex items-center justify-center py-20 gap-3 text-slate-400">
                  <Loader className="animate-spin" size={20} />
                  <span className="text-sm font-medium">Loading chats...</span>
                </div>
              }>
                <MediaConversations />
              </Suspense>
            </div>
          )}

          {/* ── Moderation panel ── */}
          {activeTab === 'moderation' && showModeration && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="px-5 py-3 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <div className="flex items-center gap-2">
                  <ShieldAlert size={15} className="text-orange-500" />
                  <h2 className="text-sm font-bold text-slate-900">Moderated Comments</h2>
                </div>
                <button type="button" onClick={() => setActiveTab(null)} className="p-1.5 hover:bg-slate-200 rounded-md transition-colors">
                  <X size={15} />
                </button>
              </div>
              <div className="p-4">
                <Moderationcommentslist />
              </div>
            </div>
          )}

          {!activeTab && (
            <div className="text-center py-12 sm:py-20 opacity-10 flex flex-col items-center">
              <div className="p-8 sm:p-10 border-4 border-dashed border-slate-300 rounded-full mb-6">
                <Send size={48} className="sm:hidden text-slate-400" />
                <Send size={60} className="hidden sm:block text-slate-400" />
              </div>
              <p className="font-medium text-slate-400 text-sm">Select a tool to begin configuration</p>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default AllCommentsAutomation;
