import { useState, useEffect } from 'react';
import { Search, MessageSquare, ArrowLeft, MessageCircle, Bot, ChevronLeft, ChevronRight } from 'lucide-react';

import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import axios from 'axios';

// --- TYPE DEFINITIONS ---
interface MediaItem {
  ruleId: string;
  mediaId: string;
  triggerText: string;
  commentReply?: string;
  ruleType: 'text' | 'template';
  templateCount?: number;
  totalComments: number;
  triggerMatchComments: number;
  displayUrl?: string;
  caption?: string;
  createdAt: string;
  permalink?: string;
}

interface Comment {
  commentId: string;
  mediaId: string;
  username?: string;
  senderId?: string;
  message: string;
  response?: string | {
    attachment?: {
      type?: string;
      payload?: {
        template_type?: string;
        text?: string;
        buttons?: Array<{
          type: string;
          payload: string;
          title: string;
        }>;
      };
    };
  };
  timestamp: string;
  matchedTriggers?: Array<{
    ruleId: string;
    triggerText: string;
  }>;
  isTriggered?: boolean;
  triggeredRuleIds?: string[];
  triggeredCount?: number;
  responseType?: string;
}

interface TriggeredRule {
  ruleId: string;
  triggerText: string;
  replyCount: number;
  timestamp: string;
  mediaId: string;
}

interface StoryReply {
  ruleId: string;
  username?: string;
  senderId?: string;
  message: string;
  response?: string;
  Timestamp: string;
}

interface PaginationInfo {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

type ActiveView = 'comments' | 'stories';

export default function MediaConversations() {
  // --- STATE MANAGEMENT ---
  const [activeView, setActiveView] = useState<ActiveView>('comments');

  // States for Post Comments
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [selectedMedia, setSelectedMedia] = useState<MediaItem | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);

  // States for Story Chats (Rule-based view)
  const [triggeredRules, setTriggeredRules] = useState<TriggeredRule[]>([]);
  const [selectedRule, setSelectedRule] = useState<TriggeredRule | null>(null);
  const [storyReplies, setStoryReplies] = useState<StoryReply[]>([]);

  // General State
  const [loading, setLoading] = useState<boolean>(true);
  const [detailsLoading, setDetailsLoading] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Responsive State
  const [isMobileView, setIsMobileView] = useState<boolean>(false);
  const [showList, setShowList] = useState<boolean>(true);

  // Pagination States
  const [pagination, setPagination] = useState<PaginationInfo>({
    currentPage: 1,
    totalPages: 1,
    totalItems: 0,
    itemsPerPage: 10,
    hasNextPage: false,
    hasPreviousPage: false
  });
  const [currentPage, setCurrentPage] = useState<number>(1);

  // --- UTILITY FUNCTIONS ---
  const getAxiosErrorData = (error: unknown) => {
    if (axios.isAxiosError(error)) {
      return error.response?.data;
    }
    return null;
  };

  // --- EFFECTS ---
  useEffect(() => {
    const handleResize = () => setIsMobileView(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (activeView === 'comments') {
      fetchMediaWithComments(currentPage);
    } else {
      fetchTriggeredRules();
    }
    resetSelection();
  }, [activeView, currentPage]);

  // Reset page when switching views
  useEffect(() => {
    setCurrentPage(1);
  }, [activeView]);

  // --- DATA FETCHING ---
  const tenentId = typeof window !== 'undefined' ? localStorage.getItem('tenentid') : null;

  const fetchMediaWithComments = async (page: number = 1) => {
    setLoading(true);
    try {
      const response = await axios.get(`/api/commentAutomationroute/rules-by-media?tenentId=${tenentId}&page=${page}&limit=10`);
      if (response.data.success) {
        const sortedRules = response.data.data.sort(
          (a: MediaItem, b: MediaItem) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        setMediaItems(sortedRules);
        setPagination(response.data.pagination);
      } else {
        setMediaItems([]);
        setPagination({
          currentPage: 1,
          totalPages: 1,
          totalItems: 0,
          itemsPerPage: 10,
          hasNextPage: false,
          hasPreviousPage: false
        });
      }
    } catch (error) {
      console.error("Error fetching rules by media:", error);
      setMediaItems([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchCommentsForMedia = async (mediaId: string, triggerText?: string) => {
    setDetailsLoading(true);
    setComments([]);
    try {
      let url = `/api/commentAutomationroute/media-comments/${mediaId}?tenentId=${tenentId}`;
      if (triggerText) {
        url += `&triggerText=${encodeURIComponent(triggerText)}`;
      }

      const response = await axios.get(url);
      if (response.data.success) {
        const fetchedComments = response.data.data || [];
        const sortedComments = fetchedComments.sort((a: Comment, b: Comment) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
        setComments(sortedComments);
      }
    } catch (error) {
      console.error("Error fetching comments:", error);
      const errorData = getAxiosErrorData(error);
      if (errorData) console.error("Error details:", errorData);
    } finally {
      setDetailsLoading(false);
    }
  };

  const fetchTriggeredRules = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`/api/storycommentsAutomationroute/rules-by-reply?tenentId=${tenentId}`);
      if (response.data.success) {
        const sortedRules = response.data.data.sort((a: TriggeredRule, b: TriggeredRule) => {
          return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
        });
        setTriggeredRules(sortedRules);
      }
    } catch (error) {
      console.error("Error fetching triggered rules:", error);
      const errorData = getAxiosErrorData(error);
      if (errorData) console.error("Error details:", errorData);
      setTriggeredRules([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchRepliesForRule = async (ruleId: string) => {
    setDetailsLoading(true);
    setStoryReplies([]);
    try {
      const response = await axios.get(`/api/storycommentsAutomationroute/replies-by-rule/${ruleId}?tenentId=${tenentId}`);
      if (response.data.success) {
        const sortedReplies = response.data.replies.sort((a: StoryReply, b: StoryReply) =>
          new Date(b.Timestamp).getTime() - new Date(a.Timestamp).getTime()
        );
        setStoryReplies(sortedReplies);
      }
    } catch (error) {
      console.error("Error fetching replies for rule:", error);
      const errorData = getAxiosErrorData(error);
      if (errorData) console.error("Error details:", errorData);
    } finally {
      setDetailsLoading(false);
    }
  };

  // --- PAGINATION HANDLERS ---
  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      setCurrentPage(newPage);
      resetSelection();
    }
  };

  const handlePrevious = () => {
    if (pagination.hasPreviousPage) {
      handlePageChange(currentPage - 1);
    }
  };

  const handleNext = () => {
    if (pagination.hasNextPage) {
      handlePageChange(currentPage + 1);
    }
  };

  // --- HANDLERS ---
  const handleMediaSelect = (media: MediaItem) => {
    setSelectedMedia(media);
    setSelectedRule(null);
    if (isMobileView) setShowList(false);
    fetchCommentsForMedia(media.mediaId, media.triggerText);
  };

  const handleRuleSelect = (rule: TriggeredRule) => {
    setSelectedRule(rule);
    setSelectedMedia(null);
    if (isMobileView) setShowList(false);
    fetchRepliesForRule(rule.ruleId);
  };

  const handleBackToList = () => {
    setShowList(true);
    resetSelection();
  };

  const resetSelection = () => {
    setSelectedMedia(null);
    setSelectedRule(null);
    setComments([]);
    setStoryReplies([]);
    setSearchQuery('');
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      return 'Invalid date';
    }
  };

  // --- RENDER LOGIC ---
  const filteredMedia = mediaItems.filter(rule =>
    rule.triggerText?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    rule.caption?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredRules = triggeredRules.filter(rule =>
    rule.triggerText?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const renderMediaList = () => {
    return filteredMedia.map((rule) => (
      <div
        key={rule.ruleId}
        onClick={() => handleMediaSelect(rule)}
        className={`flex items-start p-3 mb-2 rounded-lg cursor-pointer hover:bg-gray-100 border ${selectedMedia?.ruleId === rule.ruleId ? 'bg-gray-100 border-blue-300' : 'border-gray-200'}`}
        style={{ minHeight: '80px' }}
      >
        <div className="w-16 h-16 flex-shrink-0 mr-3 rounded-md overflow-hidden bg-gray-200 border">
          <img
            src={rule.displayUrl || "https://via.placeholder.com/80?text=No+Img"}
            alt="Media thumbnail"
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src = "https://via.placeholder.com/80?text=Failed";
            }}
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm line-clamp-1 font-semibold">
            Trigger: "{rule.triggerText}"
          </div>
          <div className="text-xs text-gray-500 mt-1">
            Rule Type: {rule.ruleType}
          </div>
          <div className="flex items-center justify-between text-xs text-gray-500 mt-1">
            <span>{formatDate(rule.createdAt)}</span>
            <div className="text-xs text-gray-500 mt-1">
              {rule.triggerMatchComments} total comments
            </div>
          </div>
        </div>
      </div>
    ));
  };

  const renderTriggeredRuleList = () => (
    filteredRules.map(rule => (
      <div
        key={rule.ruleId}
        onClick={() => handleRuleSelect(rule)}
        className={`flex items-start p-3 mb-2 rounded-lg cursor-pointer hover:bg-gray-100 border ${selectedRule?.ruleId === rule.ruleId ? 'bg-gray-100 border-black-300' : 'border-gray-200'}`}
      >
        <div className="w-16 h-16 flex-shrink-0 mr-3 rounded-md bg-black-100 flex items-center justify-center">
          <Bot className="h-8 w-8 text-black-600" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold line-clamp-1">Trigger: "{rule.triggerText}"</div>
          <div className="text-xs text-gray-500 mt-1">Last triggered: {formatDate(rule.timestamp)}</div>
          <div className="flex items-center text-xs text-gray-500 mt-1">
            <MessageCircle className="h-3 w-3 mr-1" />
            {rule.replyCount} replies generated
          </div>
        </div>
      </div>
    ))
  );

  const renderPagination = () => {
    if (activeView !== 'comments' || pagination.totalPages <= 1) return null;

    const getPageNumbers = () => {
      const delta = 2;
      const pages = [];
      const start = Math.max(1, pagination.currentPage - delta);
      const end = Math.min(pagination.totalPages, pagination.currentPage + delta);

      if (start > 1) {
        pages.push(1);
        if (start > 2) {
          pages.push('...');
        }
      }

      for (let i = start; i <= end; i++) {
        pages.push(i);
      }

      if (end < pagination.totalPages) {
        if (end < pagination.totalPages - 1) {
          pages.push('...');
        }
        pages.push(pagination.totalPages);
      }

      return pages;
    };

    const pageNumbers = getPageNumbers();

    return (
      // MOBILE FIX: added mb-20 on mobile so pagination isn't hidden behind bottom nav bar
      <div className="flex-shrink-0 p-4 border-t bg-white md:mb-0 mb-20">
        <div className="flex items-center justify-between text-sm">
          <div className="text-gray-500">
            Showing {((pagination.currentPage - 1) * pagination.itemsPerPage) + 1} to{' '}
            {Math.min(pagination.currentPage * pagination.itemsPerPage, pagination.totalItems)} of{' '}
            {pagination.totalItems} posts
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrevious}
              disabled={!pagination.hasPreviousPage}
              className="flex items-center gap-1"
            >
              <ChevronLeft className="h-4 w-4" />
              {/* MOBILE FIX: hide "Previous" text on mobile to save space */}
              <span className="hidden sm:inline">Previous</span>
            </Button>

            <div className="flex items-center space-x-1">
              {pageNumbers.map((pageNum, index) => {
                if (pageNum === '...') {
                  return (
                    <span key={`ellipsis-${index}`} className="px-2 py-1 text-gray-500">
                      ...
                    </span>
                  );
                }

                return (
                  <Button
                    key={pageNum}
                    variant={pageNum === pagination.currentPage ? "default" : "outline"}
                    size="sm"
                    onClick={() => handlePageChange(pageNum as number)}
                    className="w-8 h-8 p-0"
                  >
                    {pageNum}
                  </Button>
                );
              })}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleNext}
              disabled={!pagination.hasNextPage}
              className="flex items-center gap-1"
            >
              {/* MOBILE FIX: hide "Next" text on mobile to save space */}
              <span className="hidden sm:inline">Next</span>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    );
  };

  const showDetailsView = (isMobileView && !showList) || !isMobileView;

  return (
    // MOBILE FIX: on mobile use h-[calc(100dvh-80px)] to account for bottom nav bar (80px)
    // Desktop keeps h-full unchanged
    <div className="flex md:h-full h-[calc(100dvh-80px)] overflow-hidden bg-gray-50">
      {(!isMobileView || showList) && (
        <div className={`${isMobileView ? 'w-full' : 'w-1/3'} border-r bg-white flex flex-col overflow-hidden`}>
          <div className="flex-shrink-0 p-4 pb-0">
            <div className="p-1 bg-gray-100 rounded-lg grid grid-cols-2 gap-1">
              <Button
                variant={activeView === 'comments' ? 'default' : 'ghost'}
                onClick={() => setActiveView('comments')}
                className="flex items-center gap-2"
              >
                <MessageSquare className="h-4 w-4" />
                Post Comments
              </Button>
              <Button
                variant={activeView === 'stories' ? 'default' : 'ghost'}
                onClick={() => setActiveView('stories')}
                className="flex items-center gap-2"
              >
                <Bot className="h-4 w-4" />
                Story Replies
              </Button>
            </div>
          </div>

          <div className="flex-shrink-0 p-4 pb-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-5 w-5" />
              <Input
                type="text"
                placeholder={activeView === 'comments' ? 'Search by caption...' : 'Search by trigger text...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10"
              />
            </div>
          </div>

          <div className="flex-1 p-4 overflow-y-auto">
            {loading ? (
              <div className="text-center p-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
                <p className="mt-2">Loading...</p>
              </div>
            ) : activeView === 'comments' ? (
              <>
                <div className="text-xs text-gray-500 mb-2 p-2 bg-gray-50 rounded">
                  Found {filteredMedia.length} of {mediaItems.length} posts on page {pagination.currentPage}
                  {pagination.totalItems > 0 && ` (${pagination.totalItems} total)`}
                </div>
                {filteredMedia.length > 0 ? (
                  renderMediaList()
                ) : (
                  <div className="text-center p-4 text-gray-500">
                    <p>No commented posts found.</p>
                    {mediaItems.length === 0 && (
                      <div className="mt-4 text-sm">
                        <p>This could be because:</p>
                        <ul className="text-left mt-2 space-y-1">
                          <li>• No posts have comments yet</li>
                          <li>• Instagram API access issues</li>
                          <li>• Token expired</li>
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="text-xs text-gray-500 mb-2 p-2 bg-gray-50 rounded">
                  Found {filteredRules.length} of {triggeredRules.length} triggered rules
                </div>
                {filteredRules.length > 0 ? (
                  renderTriggeredRuleList()
                ) : (
                  <p className="text-center p-4 text-gray-500">No triggered story rules found.</p>
                )}
              </>
            )}
          </div>

          {renderPagination()}
        </div>
      )}

      {showDetailsView && (
        <div className={`${isMobileView ? 'w-full' : 'flex-1'} flex flex-col overflow-hidden`}>
          {selectedMedia && activeView === 'comments' && (
            <CommentsView
              media={selectedMedia}
              comments={comments}
              loading={detailsLoading}
              onBack={handleBackToList}
              isMobile={isMobileView}
              formatDate={formatDate}
            />
          )}
          {selectedRule && activeView === 'stories' && (
            <StoryRepliesView
              rule={selectedRule}
              replies={storyReplies}
              loading={detailsLoading}
              onBack={handleBackToList}
              isMobile={isMobileView}
              formatDate={formatDate}
            />
          )}
          {!selectedMedia && !selectedRule && (
            <div className="flex-1 flex items-center justify-center text-gray-500 p-4 text-center">
              <div>
                {activeView === 'comments' ? (
                  <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                ) : (
                  <Bot className="h-12 w-12 mx-auto mb-4 opacity-50" />
                )}
                <p>Select an item from the list to view its conversation history.</p>
                {activeView === 'comments' && (
                  <p className="text-sm mt-2 opacity-75">
                    Choose a post to see its comments and automated replies.
                  </p>
                )}
                {activeView === 'stories' && (
                  <p className="text-sm mt-2 opacity-75">
                    Choose a rule to see its automated story replies.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const CommentsView = ({
  media,
  comments,
  loading,
  onBack,
  isMobile,
  formatDate
}: {
  media: MediaItem,
  comments: Comment[],
  loading: boolean,
  onBack: () => void,
  isMobile: boolean,
  formatDate: (date: string) => string
}) => (
  <>
    <div className="flex-shrink-0 p-4 border-b bg-white flex items-center gap-3">
      {isMobile && (
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft />
        </Button>
      )}
      <div className="w-12 h-12 rounded-md overflow-hidden bg-gray-200 flex-shrink-0">
        <img
          src={media.displayUrl || "https://via.placeholder.com/48?text=No+Img"}
          className="w-full h-full object-cover"
          alt="Post thumbnail"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).src = "https://via.placeholder.com/48?text=Failed";
          }}
        />
      </div>
      <div className="min-w-0 flex-1">
        <h6
        className="font-bold text-gray-900 text-sm sm:text-base leading-snug text-center"
        style={{
          lineHeight: '1.3',
          whiteSpace: 'normal',
          wordWrap: 'break-word',
          overflowWrap: 'break-word',
        }}
      >
        {media.caption?.replace(/\n+/g, ' • ') || 'Post without caption'}
      </h6>
        <p className="text-sm text-gray-500">
          {comments.length} recent comments • {media.ruleType}
        </p>
      </div>
    </div>
    {/* MOBILE FIX: added pb-20 on mobile so last comment isn't hidden behind bottom nav bar */}
    <div className="flex-1 bg-gray-50 overflow-y-auto p-3 md:pb-3 pb-24">
      {loading ? (
        <div className="text-center p-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-2">Loading comments...</p>
        </div>
      ) : comments.length > 0 ? (
        <>
          <div className="text-xs text-gray-500 mb-3 text-center">
            Showing {comments.length} recent comments
          </div>
          {comments.map((comment, index) => (
            <Card key={`${comment.mediaId}-${index}`} className="mb-3 shadow-sm">
              <CardContent className="p-3">
                <div className="flex justify-between items-center mb-2">
                  <div className="font-medium text-sm text-blue-600">
                    @{comment.username || 'Unknown User'}
                  </div>
                  <div className="text-xs text-gray-500">
                    {formatDate(comment.timestamp)}
                  </div>
                </div>
                <p className="text-sm text-gray-800 break-words mb-2 bg-gray-50 p-2 rounded">
                  "{comment.message}"
                </p>
                {comment.response && (
                  <div className="text-sm p-2 bg-blue-50 border-l-4 border-blue-400 rounded">
                    <strong className="text-blue-700 block mb-1">Automated Reply:</strong>
                    {typeof comment.response === 'string' ? (
                      <p
                        className="mt-1 whitespace-pre-wrap break-words leading-relaxed text-gray-800"
                        style={{
                          wordWrap: 'break-word',
                          whiteSpace: 'pre-line',
                          overflowWrap: 'break-word',
                          lineHeight: '1.6',
                        }}
                      >
                        {comment.response}
                      </p>
                    ) : comment.response?.attachment?.payload?.text ? (
                      <div>
                        <p
                          className="mt-1 whitespace-pre-wrap break-words leading-relaxed text-gray-800"
                          style={{
                            wordWrap: 'break-word',
                            whiteSpace: 'pre-line',
                            overflowWrap: 'break-word',
                            lineHeight: '1.6',
                          }}
                        >
                          {comment.response.attachment.payload.text}
                        </p>
                        {comment.response.attachment.payload.buttons && comment.response.attachment.payload.buttons.length > 0 && (
                          <div className="mt-2 space-y-1">
                            {comment.response.attachment.payload.buttons.map((button, btnIndex) => (
                              <div
                                key={btnIndex}
                                className="inline-block bg-blue-100 text-blue-700 px-3 py-1 rounded text-xs font-medium mr-2"
                              >
                                {button.title}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="mt-1 text-gray-600 italic">
                        Template response (type: {comment.responseType || 'unknown'})
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </>
      ) : (
        <div className="text-center p-8 text-gray-500">
          <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No comments found for this post.</p>
          <p className="text-sm mt-2 opacity-75">
            Comments will appear here once users interact with the post.
          </p>
        </div>
      )}
    </div>
  </>
);

const StoryRepliesView = ({
  rule,
  replies,
  loading,
  onBack,
  isMobile,
  formatDate
}: {
  rule: TriggeredRule,
  replies: StoryReply[],
  loading: boolean,
  onBack: () => void,
  isMobile: boolean,
  formatDate: (date: string) => string
}) => (
  <>
    <div className="flex-shrink-0 p-4 border-b bg-white flex items-center gap-3">
      {isMobile && (
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft />
        </Button>
      )}
      <div className="w-12 h-12 rounded-md bg-black-100 flex items-center justify-center">
        <Bot className="h-6 w-6 text-black-600" />
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="font-medium truncate">Automated Story Replies</h3>
        <p className="text-sm text-gray-500 truncate">
          Trigger: "{rule.triggerText}"
        </p>
      </div>
    </div>
    {/* MOBILE FIX: added pb-24 on mobile so last reply isn't hidden behind bottom nav bar */}
    <div className="flex-1 bg-gray-50 overflow-y-auto p-3 md:pb-3 pb-24">
      {loading ? (
        <div className="text-center p-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-2">Loading replies...</p>
        </div>
      ) : replies.length > 0 ? (
        <>
          <div className="text-xs text-gray-500 mb-3 text-center">
            Showing {replies.length} automated replies
          </div>
          {replies.map((reply, index) => (
            <Card key={`${reply.ruleId}-${index}`} className="mb-3 shadow-sm">
              <CardContent className="p-3">
                <div className="flex justify-between items-center mb-2">
                  <div className="font-medium text-sm text-blue-600">
                    @{reply.username || 'Unknown User'}
                  </div>
                  <div className="text-xs text-gray-500">
                    {formatDate(reply.Timestamp)}
                  </div>
                </div>
                <p className="text-sm text-blue-800 break-words mb-2 bg-gray-50 p-2 rounded">
                  "{reply.message}"
                </p>
                {reply.response && (
                  <div className="text-sm p-2 bg-blue-50 border-l-4 border-blue-400 rounded">
                    <strong className="text-blue-700">Automated Reply:</strong>
                    <p className="mt-1">{reply.response}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </>
      ) : (
        <div className="text-center p-8 text-gray-500">
          <Bot className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No replies found for this rule.</p>
          <p className="text-sm mt-2 opacity-75">
            Story replies will appear here when the trigger is activated.
          </p>
        </div>
      )}
    </div>
  </>
);
