import React, { useState, useEffect } from 'react';
import { Key, Plus, Trash2, Eye, EyeOff, Copy, Check, AlertCircle, BarChart3, Shield, Clock, Activity } from 'lucide-react';
import Swal from 'sweetalert2';

// Configuration
const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://snaking-outhouse-oppose.ngrok-free.dev';

// Helper function to get tenentId from localStorage
const getTenentId = () => {
  try {
    return localStorage.getItem('tenentid') || '';
  } catch (error) {
    console.error('Error accessing localStorage:', error);
    return '';
  }
};

interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  permissions: string[];
  isActive: boolean;
  lastUsedAt: string | null;
  usageCount: number;
  expiresAt: string | null;
  createdAt: string;
}

interface NewApiKeyResponse {
  id: string;
  name: string;
  key: string;
  prefix: string;
  permissions: string[];
  expiresAt: string | null;
  createdAt: string;
}

interface FormData {
  name: string;
  permissions: string[];
  expiresInDays: string;
  rateLimit: {
    maxRequests: string;
    windowMs: string;
  };
  webhookUrl: string;
}

interface UsageData {
  _id: {
    date: string;
    endpoint: string;
  };
  count: number;
  avgResponseTime?: number;
}

interface PermissionOption {
  value: string;
  label: string;
}

interface UsageModalProps {
  apiKey: ApiKey;
  onClose: () => void;
}

const ApiKeyDashboard: React.FC = () => {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [showUsageModal, setShowUsageModal] = useState<boolean>(false);
  const [selectedKey, setSelectedKey] = useState<ApiKey | null>(null);
  const [newApiKey, setNewApiKey] = useState<NewApiKeyResponse | null>(null);
  const [copiedKey, setCopiedKey] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState<FormData>({
    name: '',
    permissions: ['orders.read', 'messages.send'],
    expiresInDays: '',
    rateLimit: {
      maxRequests: '',
      windowMs: ''
    },
    webhookUrl: ''
  });

  useEffect(() => {
    fetchApiKeys();
  }, []);

  const fetchApiKeys = async (): Promise<void> => {
    try {
      setLoading(true);
      const tenentId = getTenentId();

      if (!tenentId) {
        setError('Tenant ID not found. Please login again.');
        setLoading(false);
        return;
      }

      const response = await fetch(`${API_BASE_URL}/api/apikeyroute?tenentId=${tenentId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true'
        }
      });
      const data = await response.json();
      if (data.success) {
        setApiKeys(data.apiKeys);
      } else {
        setError(data.error || 'Failed to fetch API keys');
      }
    } catch (err) {
      setError('Failed to fetch API keys');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const createApiKey = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    try {
      const tenentId = getTenentId();

      if (!tenentId) {
        await Swal.fire({
          title: 'Error',
          text: 'Tenant ID not found. Please login again.',
          icon: 'error',
          confirmButtonColor: '#ea580c',
        });
        return;
      }

      const payload = {
        tenentId: tenentId,
        name: formData.name,
        permissions: formData.permissions,
        expiresInDays: formData.expiresInDays ? parseInt(formData.expiresInDays) : undefined,
        rateLimit: formData.rateLimit.maxRequests ? {
          maxRequests: parseInt(formData.rateLimit.maxRequests),
          windowMs: parseInt(formData.rateLimit.windowMs)
        } : undefined,
        webhookUrl: formData.webhookUrl || undefined
      };

      const response = await fetch(`${API_BASE_URL}/api/apikeyroute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true'
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      if (data.success) {
        setNewApiKey(data.apiKey);
        fetchApiKeys();
        setFormData({
          name: '',
          permissions: ['orders.read', 'messages.send'],
          expiresInDays: '',
          rateLimit: { maxRequests: '', windowMs: '' },
          webhookUrl: ''
        });
      } else {
        await Swal.fire({
          title: 'Error',
          text: data.error || 'Failed to create API key',
          icon: 'error',
          confirmButtonColor: '#ea580c',
        });
      }
    } catch (err) {
      await Swal.fire({
        title: 'Error',
        text: 'Failed to create API key',
        icon: 'error',
        confirmButtonColor: '#ea580c',
      });
      console.error(err);
    }
  };

  const revokeApiKey = async (id: string): Promise<void> => {
    const result = await Swal.fire({
      title: 'Revoke API Key?',
      text: "This action cannot be undone. All requests using this key will fail immediately.",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#ea580c',
      confirmButtonText: 'Yes, revoke it!',
      cancelButtonText: 'Cancel',
    });

    if (!result.isConfirmed) return;

    try {
      const tenentId = getTenentId();

      if (!tenentId) {
        await Swal.fire({
          title: 'Error',
          text: 'Tenant ID not found. Please login again.',
          icon: 'error',
          confirmButtonColor: '#ea580c',
        });
        return;
      }

      const response = await fetch(`${API_BASE_URL}/api/apikeyroute/${id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true'
        },
        body: JSON.stringify({ tenentId: tenentId })
      });

      const data = await response.json();
      if (data.success) {
        fetchApiKeys();
        await Swal.fire({
          title: 'Revoked!',
          text: 'The API key has been revoked successfully.',
          icon: 'success',
          confirmButtonColor: '#ea580c',
          timer: 2000,
          showConfirmButton: false,
        });
      } else {
        await Swal.fire({
          title: 'Error',
          text: data.error || 'Failed to revoke API key',
          icon: 'error',
          confirmButtonColor: '#ea580c',
        });
      }
    } catch (err) {
      await Swal.fire({
        title: 'Error',
        text: 'Failed to revoke API key',
        icon: 'error',
        confirmButtonColor: '#ea580c',
      });
      console.error(err);
    }
  };

  const toggleKeyStatus = async (key: ApiKey): Promise<void> => {
    try {
      const tenentId = getTenentId();

      if (!tenentId) {
        await Swal.fire({
          title: 'Error',
          text: 'Tenant ID not found. Please login again.',
          icon: 'error',
          confirmButtonColor: '#ea580c',
        });
        return;
      }

      const response = await fetch(`${API_BASE_URL}/api/apikeyroute/${key.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true'
        },
        body: JSON.stringify({
          tenentId: tenentId,
          isActive: !key.isActive
        })
      });

      const data = await response.json();
      if (data.success) {
        fetchApiKeys();
        await Swal.fire({
          title: key.isActive ? 'Key Disabled' : 'Key Enabled',
          text: `API key has been ${key.isActive ? 'disabled' : 'enabled'} successfully.`,
          icon: 'success',
          confirmButtonColor: '#ea580c',
          timer: 1500,
          showConfirmButton: false,
        });
      } else {
        await Swal.fire({
          title: 'Error',
          text: data.error || 'Failed to update API key',
          icon: 'error',
          confirmButtonColor: '#ea580c',
        });
      }
    } catch (err) {
      await Swal.fire({
        title: 'Error',
        text: 'Failed to update API key',
        icon: 'error',
        confirmButtonColor: '#ea580c',
      });
      console.error(err);
    }
  };

  const copyToClipboard = (text: string): void => {
    navigator.clipboard.writeText(text);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const formatDate = (date: string | null): string => {
    if (!date) return 'Never';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const permissionOptions: PermissionOption[] = [
    { value: 'orders.read', label: 'Read Orders' },
    { value: 'orders.write', label: 'Write Orders' },
    { value: 'orders.update', label: 'Update Orders' },
    { value: 'messages.send', label: 'Send Messages' },
    { value: 'messages.read', label: 'Read Messages' },
    { value: 'contacts.read', label: 'Read Contacts' },
    { value: 'contacts.write', label: 'Write Contacts' },
    { value: 'inventory.read', label: 'Read Inventory' },
    { value: 'inventory.write', label: 'Write Inventory' },
    { value: 'templates.read', label: 'Read Templates' },
    { value: 'broadcasts.send', label: 'Send Broadcasts' },
    { value: 'webhooks.manage', label: 'Manage Webhooks' }
  ];

  const handlePermissionChange = (value: string, checked: boolean): void => {
    if (checked) {
      setFormData({
        ...formData,
        permissions: [...formData.permissions, value]
      });
    } else {
      setFormData({
        ...formData,
        permissions: formData.permissions.filter(p => p !== value)
      });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-orange-50 p-3 sm:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 flex items-center gap-3">
                <Key className="w-6 h-6 sm:w-8 sm:h-8 text-orange-600" />
                API Key Management
              </h1>
              <p className="text-slate-600 mt-1 text-sm sm:text-base">Manage your InstaxBot API keys and monitor usage</p>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center justify-center gap-2 px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors shadow-lg w-full sm:w-auto"
            >
              <Plus className="w-5 h-5" />
              Create New Key
            </button>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3 text-red-800">
            <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
            <div className="flex-1 text-sm">{error}</div>
            <button onClick={() => setError(null)} className="text-red-600 hover:text-red-800 text-xl leading-none">×</button>
          </div>
        )}

        {/* API Keys List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600"></div>
          </div>
        ) : apiKeys.length === 0 ? (
          <div className="bg-white rounded-xl shadow-md p-8 sm:p-12 text-center">
            <Key className="w-12 h-12 sm:w-16 sm:h-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-slate-900 mb-2">No API Keys Yet</h3>
            <p className="text-slate-600 mb-6">Create your first API key to start using the InstaxBot API</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-2 px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
            >
              <Plus className="w-5 h-5" />
              Create API Key
            </button>
          </div>
        ) : (
          <div className="grid gap-4">
            {apiKeys.map((key) => (
              <div key={key.id} className="bg-white rounded-xl shadow-md hover:shadow-lg transition-shadow p-4 sm:p-6">
                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                  <div className="flex-1 w-full overflow-hidden">
                    <div className="flex flex-wrap items-center gap-2 mb-3">
                      <h3 className="text-lg sm:text-xl font-semibold text-slate-900 truncate">{key.name}</h3>
                      <div className="flex gap-2">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${key.isActive
                            ? 'bg-orange-100 text-orange-800'
                            : 'bg-gray-100 text-gray-800'
                          }`}>
                          {key.isActive ? 'Active' : 'Inactive'}
                        </span>
                        {key.expiresAt && new Date(key.expiresAt) < new Date() && (
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                            Expired
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="mb-4">
                      <code className="inline-block px-3 py-1.5 bg-slate-100 rounded-lg text-xs sm:text-sm font-mono text-slate-700 break-all">
                        {key.prefix}••••••••••••••••
                      </code>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs sm:text-sm">
                      <div className="flex items-center gap-2 text-slate-600">
                        <Shield className="w-4 h-4 shrink-0 text-orange-500" />
                        <span>{key.permissions.length} perms</span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-600">
                        <Activity className="w-4 h-4 shrink-0 text-orange-500" />
                        <span>{key.usageCount || 0} reqs</span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-600">
                        <Clock className="w-4 h-4 shrink-0 text-orange-500" />
                        <span className="truncate">Used: {formatDate(key.lastUsedAt)}</span>
                      </div>
                      {key.expiresAt && (
                        <div className="flex items-center gap-2 text-slate-600">
                          <AlertCircle className="w-4 h-4 shrink-0 text-orange-500" />
                          <span className="truncate">Exp: {formatDate(key.expiresAt)}</span>
                        </div>
                      )}
                    </div>

                    <div className="mt-4 flex flex-wrap gap-1.5">
                      {key.permissions.map((perm) => (
                        <span key={perm} className="px-2 py-0.5 bg-orange-50 text-orange-700 rounded text-[10px] sm:text-xs font-medium">
                          {perm}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-4 lg:pt-0 border-t lg:border-t-0 border-slate-100">
                    <button
                      onClick={() => {
                        setSelectedKey(key);
                        setShowUsageModal(true);
                      }}
                      className="p-2.5 text-slate-600 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors border lg:border-0"
                      title="View Usage"
                    >
                      <BarChart3 className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => toggleKeyStatus(key)}
                      className="p-2.5 text-slate-600 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors border lg:border-0"
                      title={key.isActive ? 'Disable' : 'Enable'}
                    >
                      {key.isActive ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                    <button
                      onClick={() => revokeApiKey(key.id)}
                      className="p-2.5 text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors border lg:border-0"
                      title="Revoke Key"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Create API Key Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center p-0 sm:p-4 z-50">
            <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl max-w-2xl w-full max-h-[95vh] flex flex-col">
              <div className="p-4 sm:p-6 border-b border-slate-200">
                <h2 className="text-xl sm:text-2xl font-bold text-slate-900">Create New API Key</h2>
                <p className="text-slate-600 mt-1 text-xs sm:text-sm">Configure permissions and limits</p>
              </div>

              <div className="flex-1 overflow-y-auto">
                {newApiKey ? (
                  <div className="p-4 sm:p-6">
                    <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-6">
                      <div className="flex items-center gap-2 text-orange-800 mb-2">
                        <Check className="w-5 h-5" />
                        <span className="font-semibold">Key Created Successfully!</span>
                      </div>
                      <p className="text-xs sm:text-sm text-orange-700 mb-4">
                        Save this key securely - it will not be shown again.
                      </p>

                      <div className="bg-white rounded-lg p-3 sm:p-4 border border-orange-200">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
                          <label className="text-sm font-medium text-slate-700">Your API Key</label>
                          <button
                            onClick={() => copyToClipboard(newApiKey.key)}
                            className="flex items-center justify-center gap-2 px-3 py-2 bg-orange-600 text-white text-sm rounded hover:bg-orange-700 transition-colors w-full sm:w-auto"
                          >
                            {copiedKey ? <><Check className="w-4 h-4" /> Copied!</> : <><Copy className="w-4 h-4" /> Copy</>}
                          </button>
                        </div>
                        <code className="block p-3 bg-slate-50 rounded font-mono text-xs sm:text-sm break-all text-slate-900 border border-slate-100">
                          {newApiKey.key}
                        </code>
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <button
                        onClick={() => { setNewApiKey(null); setShowCreateModal(false); }}
                        className="w-full sm:w-auto px-6 py-2.5 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
                      >
                        Done
                      </button>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={createApiKey} className="p-4 sm:p-6 space-y-5">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">Key Name *</label>
                      <input
                        type="text" required value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-sm sm:text-base"
                        placeholder="e.g., Production API Key"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2.5">Permissions</label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-1 border rounded-lg sm:border-0 sm:p-0">
                        {permissionOptions.map((option) => (
                          <label key={option.value} className="flex items-center gap-2 p-2 hover:bg-orange-50 rounded cursor-pointer">
                            <input
                              type="checkbox" checked={formData.permissions.includes(option.value)}
                              onChange={(e) => handlePermissionChange(option.value, e.target.checked)}
                              className="w-4 h-4 text-orange-600 rounded focus:ring-2 focus:ring-orange-500"
                            />
                            <span className="text-sm text-slate-700">{option.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">Expires In (Days)</label>
                        <input
                          type="number" min="1" value={formData.expiresInDays}
                          onChange={(e) => setFormData({ ...formData, expiresInDays: e.target.value })}
                          className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-sm"
                          placeholder="No expiration if empty"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">Webhook URL (Optional)</label>
                        <input
                          type="url" value={formData.webhookUrl}
                          onChange={(e) => setFormData({ ...formData, webhookUrl: e.target.value })}
                          className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-sm"
                          placeholder="https://..."
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">Rate Limit (Requests)</label>
                        <input
                          type="number" value={formData.rateLimit.maxRequests}
                          onChange={(e) => setFormData({ ...formData, rateLimit: { ...formData.rateLimit, maxRequests: e.target.value } })}
                          className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-sm"
                          placeholder="e.g., 1000"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">Window (ms)</label>
                        <input
                          type="number" value={formData.rateLimit.windowMs}
                          onChange={(e) => setFormData({ ...formData, rateLimit: { ...formData.rateLimit, windowMs: e.target.value } })}
                          className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-sm"
                          placeholder="e.g., 60000"
                        />
                      </div>
                    </div>
                  </form>
                )}
              </div>

              {!newApiKey && (
                <div className="p-4 sm:p-6 border-t border-slate-200 flex flex-col sm:flex-row gap-3">
                  <button
                    type="button" onClick={() => setShowCreateModal(false)}
                    className="flex-1 px-6 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={(e: any) => createApiKey(e)}
                    className="flex-1 px-6 py-2.5 bg-orange-600 text-white rounded-lg hover:bg-orange-700 shadow-md"
                  >
                    Create API Key
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Usage Modal */}
        {showUsageModal && selectedKey && (
          <UsageModal
            apiKey={selectedKey}
            onClose={() => {
              setShowUsageModal(false);
              setSelectedKey(null);
            }}
          />
        )}
      </div>
    </div>
  );
};

// Usage Modal Component
const UsageModal: React.FC<UsageModalProps> = ({ apiKey, onClose }) => {
  const [usage, setUsage] = useState<UsageData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [days, setDays] = useState<number>(7);

  useEffect(() => {
    fetchUsage();
  }, [days]);

  const fetchUsage = async (): Promise<void> => {
    try {
      setLoading(true);
      const currentTenentId = getTenentId();
      const response = await fetch(`${API_BASE_URL}/api/apikeyroute/${apiKey.id}/usage?tenentId=${currentTenentId}&days=${days}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true'
        }
      });
      const data = await response.json();
      if (data.success) {
        setUsage(data.usage);
      }
    } catch (err) {
      console.error('Failed to fetch usage:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center p-0 sm:p-4 z-50">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        <div className="p-4 sm:p-6 border-b border-slate-200">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900">Usage Statistics</h2>
              <p className="text-slate-600 text-sm mt-0.5 truncate max-w-[250px] sm:max-w-none">{apiKey.name}</p>
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-3xl leading-none">&times;</button>
          </div>

          <div className="flex gap-2 mt-4 overflow-x-auto pb-2 scrollbar-hide">
            {[7, 14, 30, 90].map((d) => (
              <button
                key={d} onClick={() => setDays(d)}
                className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors shrink-0 ${days === d ? 'bg-orange-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
              >
                {d} days
              </button>
            ))}
          </div>
        </div>

        <div className="p-4 sm:p-6 flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange-600"></div>
            </div>
          ) : usage.length === 0 ? (
            <div className="text-center py-12">
              <BarChart3 className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-600 text-sm">No usage data available for this period</p>
            </div>
          ) : (
            <div className="space-y-3">
              {usage.map((item, index) => (
                <div key={index} className="border border-slate-100 bg-slate-50 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <div className="font-semibold text-slate-900 text-sm sm:text-base">{item._id.date}</div>
                      <div className="text-xs text-slate-500 font-mono truncate max-w-[180px] sm:max-w-none">{item._id.endpoint}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-xl sm:text-2xl font-bold text-orange-600 leading-tight">{item.count}</div>
                      <div className="text-[10px] text-slate-500 uppercase tracking-wider">Requests</div>
                    </div>
                  </div>
                  <div className="text-xs text-slate-500 flex items-center gap-1.5">
                    <Clock className="w-3 h-3" />
                    Avg Response Time: <span className="text-slate-700 font-medium">{item.avgResponseTime?.toFixed(2) || 0}ms</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ApiKeyDashboard;
