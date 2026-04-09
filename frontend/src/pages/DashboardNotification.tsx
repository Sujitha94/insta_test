// DashboardNotification.tsx
import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const BASE_URL = 'https://inocencia-shiftiest-nonodorously.ngrok-free.dev';

interface Notification {
  _id: string;
  message: string;
  isActive: boolean;
  createdAt: string;
}

export default function DashboardNotification() {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loadingList, setLoadingList] = useState(false);

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editMessage, setEditMessage] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  // Delete state
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const navigate = useNavigate();

  const getToken = () => localStorage.getItem('token');

  const fetchNotifications = async () => {
    setLoadingList(true);
    try {
      const token = getToken();
      const res = await axios.get(
        `${BASE_URL}/api/dashboardnotificationroute/all`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setNotifications(res.data.data || []);
    } catch {
      // silently fail for list
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const handleSend = async () => {
    if (!message.trim()) return;
    setSending(true);
    setSuccess(null);
    setError(null);
    try {
      const token = getToken();
      await axios.post(
        `${BASE_URL}/api/dashboardnotificationroute/notifications`,
        { message },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setSuccess('Notification saved and sent to all users.');
      setMessage('');
      fetchNotifications();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to send notification.');
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleSend();
  };

  const handleEditStart = (notif: Notification) => {
    setEditingId(notif._id);
    setEditMessage(notif.message);
  };

  const handleEditCancel = () => {
    setEditingId(null);
    setEditMessage('');
  };

  const handleEditSave = async (id: string) => {
    if (!editMessage.trim()) return;
    setEditSaving(true);
    try {
      const token = getToken();
      await axios.put(
        `${BASE_URL}/api/dashboardnotificationroute/${id}`,
        { message: editMessage.trim() },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setEditingId(null);
      setEditMessage('');
      fetchNotifications();
    } catch {
      // handle silently
    } finally {
      setEditSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      const token = getToken();
      await axios.delete(
        `${BASE_URL}/api/dashboardnotificationroute/${id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      fetchNotifications();
    } catch {
      // handle silently
    } finally {
      setDeletingId(null);
    }
  };

  const handleToggle = async (id: string) => {
    try {
      const token = getToken();
      await axios.put(
        `${BASE_URL}/api/dashboardnotificationroute/${id}/toggle`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      fetchNotifications();
    } catch {
      // handle silently
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-2xl mx-auto">

        {/* ── Header ── */}
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-3">
            {/* Orange brand accent bar */}
            <div
              className="w-1 h-8 rounded-full"
              style={{ background: 'linear-gradient(180deg, #fb923c, #ea580c)' }}
            />
            <h1 className="text-3xl font-bold text-gray-900">Dashboard Notification</h1>
          </div>
          <Button
            onClick={() => navigate('/admin')}
            style={{ background: 'linear-gradient(135deg, #f97316, #ea580c)' }}
            className="text-white hover:opacity-90 border-0"
          >
            ← Back to Admin
          </Button>
        </div>

        {/* ── Send Card ── */}
        <div className="bg-white rounded-xl shadow-sm border border-orange-100 p-6">
          {/* Top orange stripe */}
          <div
            className="h-1 w-full rounded-full mb-5"
            style={{ background: 'linear-gradient(90deg, #fb923c, #ea580c)' }}
          />

          <p className="text-sm text-gray-500 mb-4">
            Type a message below and send it as a notification to all users on their dashboard.
          </p>

          {success && (
            <div className="bg-orange-50 border border-orange-200 text-orange-700 px-4 py-3 rounded-lg mb-4 text-sm flex items-center gap-2">
              <svg className="w-4 h-4 flex-shrink-0 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              {success}
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
              {error}
            </div>
          )}

          <div className="flex gap-3">
            <Input
              type="text"
              placeholder="Enter notification message…"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={sending}
              className="flex-1 focus-visible:ring-orange-400 focus-visible:border-orange-400"
            />
            <Button
              onClick={handleSend}
              disabled={sending || !message.trim()}
              style={{ background: 'linear-gradient(135deg, #f97316, #ea580c)' }}
              className="text-white whitespace-nowrap hover:opacity-90 border-0 disabled:opacity-40"
            >
              {sending ? 'Sending…' : 'Send'}
            </Button>
          </div>
        </div>

        {/* ── Notifications List ── */}
        <div className="bg-white rounded-xl shadow-sm border border-orange-100 mt-5 overflow-hidden">

          {/* List header */}
          <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-800 text-base">All Notifications</h2>
            <button
              onClick={fetchNotifications}
              className="text-sm font-medium hover:underline"
              style={{ color: '#f97316' }}
            >
              Refresh
            </button>
          </div>

          {loadingList ? (
            <div className="px-6 py-10 text-center">
              <div
                className="inline-block w-6 h-6 border-2 border-t-transparent rounded-full animate-spin"
                style={{ borderColor: '#fdba74', borderTopColor: 'transparent' }}
              />
            </div>
          ) : notifications.length === 0 ? (
            <div className="px-6 py-8 text-center text-sm text-gray-400">
              No notifications yet. Send one above!
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {notifications.map((notif) => (
                <li
                  key={notif._id}
                  className="px-6 py-4 flex items-start gap-4 transition-colors hover:bg-orange-50"
                >
                  {/* Status dot — click to toggle active/inactive */}
                  <button
                    onClick={() => handleToggle(notif._id)}
                    title={notif.isActive ? 'Active – click to deactivate' : 'Inactive – click to activate'}
                    className={`mt-1 w-3 h-3 rounded-full flex-shrink-0 border-2 transition-colors ${
                      notif.isActive
                        ? 'bg-green-500 border-green-500'
                        : 'bg-gray-300 border-gray-300'
                    }`}
                  />

                  {/* Message / Edit Input */}
                  <div className="flex-1 min-w-0">
                    {editingId === notif._id ? (
                      <div className="flex gap-2 items-center">
                        <Input
                          type="text"
                          value={editMessage}
                          onChange={(e) => setEditMessage(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleEditSave(notif._id);
                            if (e.key === 'Escape') handleEditCancel();
                          }}
                          className="flex-1 text-sm focus-visible:ring-orange-400 focus-visible:border-orange-400"
                          autoFocus
                          disabled={editSaving}
                        />
                        <Button
                          size="sm"
                          onClick={() => handleEditSave(notif._id)}
                          disabled={editSaving || !editMessage.trim()}
                          style={{ background: 'linear-gradient(135deg, #f97316, #ea580c)' }}
                          className="text-white text-xs px-3 hover:opacity-90 border-0 disabled:opacity-40"
                        >
                          {editSaving ? 'Saving…' : 'Save'}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleEditCancel}
                          disabled={editSaving}
                          className="text-xs px-3"
                        >
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <>
                        <p className={`text-sm break-words ${notif.isActive ? 'text-gray-800' : 'text-gray-400 line-through'}`}>
                          {notif.message}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {new Date(notif.createdAt).toLocaleString()}
                        </p>
                      </>
                    )}
                  </div>

                  {/* Actions */}
                  {editingId !== notif._id && (
                    <div className="flex items-center gap-2 flex-shrink-0 mt-0.5">
                      {/* Edit icon */}
                      <button
                        onClick={() => handleEditStart(notif)}
                        title="Edit"
                        className="text-gray-400 hover:text-orange-500 transition-colors"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </button>

                      {/* Delete icon */}
                      <button
                        onClick={() => handleDelete(notif._id)}
                        disabled={deletingId === notif._id}
                        title="Delete"
                        className="text-gray-400 hover:text-red-500 transition-colors disabled:opacity-40"
                      >
                        {deletingId === notif._id ? (
                          <div className="w-4 h-4 border-2 border-red-300 border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                            <path d="M10 11v6M14 11v6" />
                            <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                          </svg>
                        )}
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

      </div>
    </div>
  );
}
