// /mnt/data/Systemmenus.tsx
import React, { useState, useEffect } from 'react';
import { X, Plus, Check } from 'lucide-react';

interface PayloadItem {
  id: string;
  type: 'payload' | 'web-url';
  title: string;
  value: string;
}

// === SET YOUR BACKEND BASE URL HERE ===
// Replace with your active ngrok URL or http://localhost:5000
const API_BASE = 'https://inocencia-shiftiest-nonodorously.ngrok-free.dev';

const InstaxBotSystemMenu: React.FC = () => {
  const [payloads, setPayloads] = useState<PayloadItem[]>([]);

  // ========= FETCH SYSTEM MENU ON PAGE LOAD =========
  const [initialLoading, setInitialLoading] = useState(true);

  useEffect(() => {
    const fetchSystemMenu = async () => {
      try {
        const tenentId = localStorage.getItem('tenentid');
        console.log('fetchSystemMenu - tenentId:', tenentId);

        if (!tenentId) {
          console.error('No tenentId in localStorage');
          setInitialLoading(false);
          return;
        }

        const res = await fetch(`${API_BASE}/api/systemmenusroute/get-system-menu/${tenentId}`, {
          method: 'GET',
          headers: {
            'Accept': 'application/json'
          }
        });

        // quick status logging
        console.log('GET status:', res.status);

        const contentType = res.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
          console.error('Non-JSON response from get-system-menu:', await res.text());
          setInitialLoading(false);
          return;
        }

        const data = await res.json();
        console.log('Loaded data:', data);

        if (res.ok && data.success && Array.isArray(data.data.payloads)) {
          setPayloads(data.data.payloads);
        } else {
          console.warn('get-system-menu returned no payloads or success=false', data);
        }
      } catch (error) {
        console.error('Error loading menu:', error);
      } finally {
        setInitialLoading(false);
      }
    };

    fetchSystemMenu();
    // run once on mount
  }, []);

  // States for save functionality with tenent ID
  const [loading, setLoading] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const addPayloadPayload = () => {
    const newPayload: PayloadItem = {
      id: Date.now().toString(),
      type: 'payload',
      title: '',
      value: ''
    };
    setPayloads(prev => [...prev, newPayload]);
  };

  const addWebUrlPayload = () => {
    const webUrlPayloads = payloads.filter(w => w.type === 'web-url');
    if (webUrlPayloads.length >= 2) {
      return; // Don't add more than 2 web-url payloads
    }

    const newPayload: PayloadItem = {
      id: Date.now().toString(),
      type: 'web-url',
      title: '',
      value: ''
    };
    setPayloads(prev => [...prev, newPayload]);
  };

  const removePayload = (id: string) => {
    setPayloads(prev => prev.filter(item => item.id !== id));
  };

  const updatePayload = (id: string, field: keyof PayloadItem, value: string) => {
    setPayloads(prev => prev.map(item =>
      item.id === id ? { ...item, [field]: value } : item
    ));
  };

  // Save system menu function with tenent ID
  const handleSaveSystemMenu = async () => {
    const tenentId = localStorage.getItem('tenentid');
    console.log('handleSaveSystemMenu - tenentId:', tenentId);

    if (!tenentId) {
      setErrorMessage('Tenent ID not found. Please log in again.');
      setTimeout(() => setErrorMessage(''), 5000);
      return;
    }

    // Validate payloads before saving
    const invalidPayloads = payloads.filter(item => !item.title.trim() || !item.value.trim());
    if (invalidPayloads.length > 0) {
      setErrorMessage('Please fill in all title and value fields before saving.');
      setTimeout(() => setErrorMessage(''), 5000);
      return;
    }

    setLoading(true);
    setShowSuccessModal(false);
    setErrorMessage('');

    try {
      const requestBody = {
        payloads: payloads.map(item => ({
          id: item.id,
          type: item.type,
          title: item.title.trim(),
          value: item.value.trim()
        })),
        tenentId: tenentId
      };

      console.log('Sending request with payloads:', requestBody);

      const response = await fetch(`${API_BASE}/api/systemmenusroute/save-system-menu`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      console.log('POST status:', response.status);

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        console.error('Server returned non-JSON response:', text);
        throw new Error('Server returned non-JSON response. Check if the API endpoint exists.');
      }

      const data = await response.json();
      console.log('POST response data:', data);

      if (response.ok && data.success) {
        setShowSuccessModal(true);
        console.log('Saved data:', data.data);

        // after save, you may re-fetch to refresh state from backend (optional)
        // e.g. call fetch again or setPayloads(data.data.payloads)
      } else {
        setErrorMessage(data.message || 'Failed to save system menu');
        setTimeout(() => setErrorMessage(''), 5000);
      }

    } catch (error) {
      console.error('Error saving system menu:', error);

      if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
        setErrorMessage('Network error. Please check if the server is running and try again.');
      } else if (error instanceof Error && error.message.includes('non-JSON response')) {
        setErrorMessage('API endpoint not found. Please check the server configuration.');
      } else if (error instanceof Error) {
        setErrorMessage(`Error: ${error.message}`);
      } else {
        setErrorMessage('Network error. Please check your connection and try again.');
      }

      setTimeout(() => setErrorMessage(''), 5000);
    } finally {
      setLoading(false);
    }
  };

  // show a simple loading state while the system menu is being fetched
  if (initialLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="mb-2 text-gray-600">Loading system menu…</div>
          <div className="animate-pulse inline-block px-4 py-2 bg-orange-100 text-orange-700 rounded-md">Please wait</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F9FAFB] py-8 px-4 w-full font-sans">
      
      <div className="w-full max-w-2xl mx-auto">
        

        <div className="bg-white rounded-xl shadow-md overflow-hidden border border-gray-100">
          <div className="p-6 space-y-6">
            {errorMessage && (
              <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded mb-4 text-center text-sm font-medium">
                {errorMessage}
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-800">Payload Options</h2>
                <button
                  onClick={addPayloadPayload}
                  className="flex items-center gap-2 px-3 py-1.5 bg-[#F97316] text-white rounded-md hover:bg-[#EA580C] transition-colors text-sm font-semibold shadow-sm"
                >
                  <Plus className="w-4 h-4" />
                  Add Payload
                </button>
              </div>

              <div className="space-y-4">
                {payloads.filter(payload => payload.type === 'payload').map((payload) => (
                  <div key={payload.id} className="border border-orange-100 rounded-lg p-4 bg-orange-50/30">
                    <div className="flex items-center justify-between mb-4">
                      <span className="px-3 py-1 bg-orange-500 text-white text-xs font-bold rounded-full uppercase tracking-wider">
                        PAYLOAD
                      </span>
                      <button
                        onClick={() => removePayload(payload.id)}
                        className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-600 mb-1">
                          Title
                        </label>
                        <input
                          type="text"
                          value={payload.title}
                          onChange={(e) => updatePayload(payload.id, 'title', e.target.value)}
                          className="w-full p-3 border border-gray-200 rounded-md text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all bg-white"
                          placeholder="Enter title"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-600 mb-1">
                          Payload Value
                        </label>
                        <input
                          type="text"
                          value={payload.value}
                          onChange={(e) => updatePayload(payload.id, 'value', e.target.value)}
                          className="w-full p-3 border border-gray-200 rounded-md text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all bg-white"
                          placeholder="Enter payload value"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-800">Web-URL Options</h2>
                <button
                  onClick={addWebUrlPayload}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-md transition-colors text-sm font-semibold shadow-sm ${payloads.filter(w => w.type === 'web-url').length >= 2
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-[#F97316] text-white hover:bg-[#EA580C]'
                    }`}
                  disabled={payloads.filter(w => w.type === 'web-url').length >= 2}
                >
                  <Plus className="w-4 h-4" />
                  Add Web-URL {payloads.filter(w => w.type === 'web-url').length >= 2 && '(Max 2)'}
                </button>
              </div>

              <div className="space-y-4">
                {payloads.filter(payload => payload.type === 'web-url').map((payload) => (
                  <div key={payload.id} className="border border-orange-100 rounded-lg p-4 bg-orange-50/30">
                    <div className="flex items-center justify-between mb-4">
                      <span className="px-3 py-1 bg-orange-500 text-white text-xs font-bold rounded-full uppercase tracking-wider">
                        WEB-URL
                      </span>
                      <button
                        onClick={() => removePayload(payload.id)}
                        className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-600 mb-1">
                          Title
                        </label>
                        <input
                          type="text"
                          value={payload.title}
                          onChange={(e) => updatePayload(payload.id, 'title', e.target.value)}
                          className="w-full p-3 border border-gray-200 rounded-md text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all bg-white"
                          placeholder="Enter title"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-600 mb-1">
                          URL
                        </label>
                        <input
                          type="url"
                          value={payload.value}
                          onChange={(e) => updatePayload(payload.id, 'value', e.target.value)}
                          className="w-full p-3 border border-gray-200 rounded-md text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all bg-white"
                          placeholder="Enter URL (e.g., https://example.com)"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {payloads.length > 0 && (
              <div className="bg-orange-50 p-4 rounded-lg border border-orange-100">
                <h3 className="font-bold text-orange-900 mb-2 text-sm uppercase">Summary</h3>
                <div className="text-sm text-orange-800 space-y-1 font-medium">
                  <p>Total Items: {payloads.length}</p>
                  <p>Payload Items: {payloads.filter(p => p.type === 'payload').length}</p>
                  <p>Web-URL Items: {payloads.filter(p => p.type === 'web-url').length}/2</p>
                </div>
              </div>
            )}

            <div className="flex justify-center pt-4 border-t border-gray-100">
              <button
                onClick={handleSaveSystemMenu}
                className={`py-3 px-8 rounded-md font-bold transition-all shadow-md active:scale-95 ${payloads.length === 0
                  ? 'bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed'
                  : 'bg-[#EA580C] text-white hover:bg-[#C2410C]'
                  }`}
                disabled={loading || payloads.length === 0}
              >
                {loading ? 'Saving...' : 'Save System Menu'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Success Modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-2xl p-8 max-w-md w-full mx-4 border-t-4 border-green-500">
            <div className="flex flex-col items-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                <Check className="w-8 h-8 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-800 mb-2">Saved!</h2>
              <p className="text-gray-600 text-center mb-6 font-medium">
                System menu saved successfully.
              </p>
              <button
                onClick={() => setShowSuccessModal(false)}
                className="w-full py-3 bg-orange-600 text-white rounded-md font-bold hover:bg-orange-700 transition-colors shadow-lg"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InstaxBotSystemMenu;

