import { useState, useEffect, useRef, useCallback } from "react";
import { Bell, X } from "lucide-react";
import { getWebSocketService, WebSocketService } from '../Services/websocketService';

interface Notification {
  _id: string;
  message: string;
  createdAt: string;
  isRead: boolean;
  ID: string;
}

interface WebSocketNotificationMessage {
  type: 'notifications' | 'notification_update';
  status: 'success' | 'message';
  message?: string;
  data: Notification | Notification[];
}

export default function NotificationIcon() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocketService | null>(null);

  // ✅ Calculate unreadCount directly from notifications state
  const unreadCount = notifications.filter(notif => !notif.isRead).length;

  // ✅ Handle incoming websocket messages
  const handleWebSocketMessage = useCallback((data: WebSocketNotificationMessage) => {
    console.log('WebSocket message received:', data);

    if (data.type === 'notifications' && data.status === 'success') {
      const notificationsData = Array.isArray(data.data) ? data.data : [];
      setNotifications(notificationsData);
    }

    if (data.type === 'notification_update' && data.status === 'success') {
      const newNotification = data.data as Notification;
      setNotifications(prev => {
        const exists = prev.some(n => n.ID === newNotification.ID);
        if (exists) {
          return prev.map(notif =>
            notif.ID === newNotification.ID ? newNotification : notif
          );
        } else {
          return [newNotification, ...prev];
        }
      });
    }
  }, []);

  useEffect(() => {
    const wsService = getWebSocketService();
    wsRef.current = wsService;

    wsService.addMessageHandler(handleWebSocketMessage);

    const wsUrl = `https://snaking-outhouse-oppose.ngrok-free.dev`;
    wsService.connect(wsUrl);

    wsService.onConnect(() => {
      const tenentId = localStorage.getItem('tenentid');
      if (tenentId) {
        wsService.sendMessage({
          type: 'get_notifications',
          tenentId
        });
      }
    });

    return () => {
      wsService.removeMessageHandler(handleWebSocketMessage);
      wsService.disconnect();
    };
  }, [handleWebSocketMessage]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const markAsRead = async (id: string) => {
    const tenentId = localStorage.getItem('tenentid');
    if (wsRef.current?.isConnected() && tenentId) {
      wsRef.current.sendMessage({
        type: 'mark_notification_read',
        id,
        tenentId
      });

      setNotifications(prev =>
        prev.map(notif =>
          notif.ID === id ? { ...notif, isRead: true } : notif
        )
      );
    }
  };

  const markAllAsRead = () => {
    const tenentId = localStorage.getItem('tenentid');
    if (wsRef.current?.isConnected() && tenentId) {
      notifications.filter(n => !n.isRead).forEach(notif => {
        wsRef.current!.sendMessage({
          type: 'mark_notification_read',
          id: notif.ID,
          tenentId
        });
      });

      setNotifications(prev =>
        prev.map(notif => ({ ...notif, isRead: true }))
      );
    }
  };

  return (
    <div className="relative z-[100]" ref={dropdownRef}>
      {/* Bell Icon Button */}
      <button
        onClick={() => setIsDropdownOpen((prev) => !prev)}
        className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-gray-200"
        aria-label="Notifications"
      >
        <Bell
          size={20}
          className={`transition-colors duration-200 ${unreadCount > 0 ? 'text-gray-900' : 'text-gray-600'
            }`}
          strokeWidth={unreadCount > 0 ? 2.5 : 2}
        />

        {/* Unread Badge */}
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-red-500 rounded-full border-2 border-white shadow-sm">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notifications Dropdown - Updated for perfect Mobile Responsiveness */}
      {isDropdownOpen && (
        <div className="absolute right-[-10px] sm:right-0 mt-2 w-[320px] sm:w-96 max-w-[95vw] bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden z-[9999] animate-in fade-in slide-in-from-top-2 duration-200">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-gray-900">Notifications</h3>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 text-xs font-medium text-blue-700 bg-blue-100 rounded-full">
                  {unreadCount} new
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors"
                >
                  Mark all read
                </button>
              )}
              <button
                onClick={() => setIsDropdownOpen(false)}
                className="p-1 rounded-lg hover:bg-gray-200 transition-colors"
                aria-label="Close notifications"
              >
                <X size={16} className="text-gray-500" />
              </button>
            </div>
          </div>

          {/* Notifications List */}
          <div className="max-h-[400px] overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-4">
                <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-3">
                  <Bell size={28} className="text-gray-400" />
                </div>
                <p className="text-sm font-medium text-gray-900 mb-1">No notifications yet</p>
                <p className="text-xs text-gray-500 text-center">
                  We'll notify you when something important happens
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {notifications.map((notif: Notification) => (
                  <div
                    key={notif.ID}
                    // ✅ Dynamic background: light orange if unread, white if read
                    className={`relative px-4 py-3 cursor-pointer transition-colors duration-150 ${notif.isRead
                        ? 'bg-white hover:bg-gray-50 active:bg-gray-100'
                        : 'bg-orange-50 hover:bg-orange-100 active:bg-orange-200'
                      }`}
                    onClick={(e) => {
                      e.stopPropagation();
                      markAsRead(notif.ID);
                    }}
                  >
                    {/* Unread Indicator - Changed to orange */}
                    {!notif.isRead && (
                      <div className="absolute left-3 top-5 w-2 h-2 rounded-full bg-orange-500 shadow-sm" />
                    )}

                    <div className={`${!notif.isRead ? 'pl-4' : ''}`}>
                      <p className={`text-sm leading-relaxed mb-1 ${notif.isRead ? 'text-gray-700' : 'text-gray-900 font-medium'
                        }`}>
                        {notif.message}
                      </p>
                      <p className="text-xs text-gray-500">
                        {new Date(notif.createdAt).toLocaleString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                          hour12: true
                        })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="px-4 py-3 border-t border-gray-100 bg-gray-50">
              <button className="w-full text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors">
                View all notifications
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
