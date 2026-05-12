import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Html5Qrcode } from "html5-qrcode";
import { Camera, X } from 'lucide-react';

// Type definitions
interface OrderData {
  orderId?: string;
  customerName?: string;
  status?: string;
  totalAmount?: number;
}

interface Hold {
  id: string;
  orderNumber: string;
  customerName?: string;
  holdingProduct: string;
  holdingResponse?: string;
  expectedDate: string;
  status: 'active' | 'resolved' | 'pending';
  createdAt?: string;
  responses?: Array<{
    message: string;
    timestamp: string;
    respondedAt: string;
  }>;
}

interface StatusBadgeProps {
  status: string;
}

// Configuration
const API_BASE_URL = 'https://snaking-outhouse-oppose.ngrok-free.dev/api';
const ENDPOINTS = {
  ORDER_DETAILS: `${API_BASE_URL}/holdingroute/details`,
  UPDATE_HOLDING: `${API_BASE_URL}/holdingroute/update-holding`,
  HOLDS_LIST: `${API_BASE_URL}/holdingroute/holds/list`,
  RESOLVE_HOLD: `${API_BASE_URL}/holdingroute/holds/resolve`,
  ADD_RESPONSE: `${API_BASE_URL}/holdingroute/holds/response`,
};

// Loader Component
const Loader = () => (
  <div className="flex justify-center items-center py-4">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600"></div>
  </div>
);

// Status Badge Component
const StatusBadge = ({ status }: StatusBadgeProps) => {
  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active': return 'bg-yellow-100 text-yellow-800';
      case 'resolved': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };
  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(status)}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
};

// Toast notification
const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
  const toast = document.createElement('div');
  toast.textContent = message;
  toast.className = `fixed top-4 right-4 px-4 py-2 rounded shadow-lg z-50 transition-opacity duration-300 ${type === 'success' ? 'bg-green-500 text-white' :
      type === 'error' ? 'bg-red-500 text-white' :
        'text-white'
    }`;
  if (type === 'info') toast.className += ' bg-orange-600';
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => document.body.removeChild(toast), 300);
  }, 3000);
};

const HoldingPage: React.FC<{ onBack?: () => void }> = ({ onBack }) => {
  // Form states
  const [orderNumber, setOrderNumber] = useState('');
  const [holdingProduct, setHoldingProduct] = useState('');
  const [holdingResponse, setHoldingResponse] = useState('');
  const [date, setDate] = useState('');

  // UI states
  const [loading, setLoading] = useState(false);
  const [orderData, setOrderData] = useState<OrderData | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [activeTab, setActiveTab] = useState<'add' | 'list'>('add');
  const [holdsList, setHoldsList] = useState<Hold[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [tenentId, setTenentId] = useState<string | null>(null);

  // --- SCANNER STATES & REFS ---
  const [scanning, setScanning] = useState(false);
  const [scannerReady, setScannerReady] = useState(false);
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const isStartingRef = useRef(false);
  const orderInputRef = useRef<HTMLInputElement>(null);

  // --- SCANNER LOGIC ---
  const stopScanner = useCallback(async () => {
    if (html5QrCodeRef.current) {
      try {
        if (html5QrCodeRef.current.isScanning) {
          await html5QrCodeRef.current.stop();
        }
      } catch (error) {
        console.log("Scanner stop error:", error);
      }
      html5QrCodeRef.current = null;
    }
  }, []);

  const handleCloseScanner = useCallback(async () => {
    await stopScanner();
    setScanning(false);
    setScannerReady(false);
    isStartingRef.current = false;
  }, [stopScanner]);

  const startScanning = async () => {
    if (isStartingRef.current || scanning) return;
    await stopScanner();
    setScanning(true);
  };

  useEffect(() => {
    let mounted = true;
    const initScanner = async () => {
      if (!scanning || isStartingRef.current) return;
      isStartingRef.current = true;
      await new Promise(resolve => setTimeout(resolve, 300));
      if (!mounted) { isStartingRef.current = false; return; }

      try {
        const html5QrCode = new Html5Qrcode("reader");
        html5QrCodeRef.current = html5QrCode;
        const config = { fps: 10, qrbox: { width: 250, height: 150 }, aspectRatio: 1.777 };

        await html5QrCode.start(
          { facingMode: "environment" },
          config,
          (decodedText: string) => {
            setOrderNumber(decodedText);
            handleCloseScanner();
            setTimeout(() => triggerSearchFromScan(decodedText), 500);
          },
          () => { }
        );

        if (mounted) {
          setScannerReady(true);
          isStartingRef.current = false;
        }
      } catch (err) {
        console.error("Scanner start error:", err);
        isStartingRef.current = false;
        setScanning(false);
      }
    };

    if (scanning) initScanner();
    return () => { mounted = false; stopScanner(); };
  }, [scanning, handleCloseScanner, stopScanner]);

  const triggerSearchFromScan = (val: string) => {
    if (val.trim()) fetchOrderDetails(val.trim());
  };

  // --- ORIGINAL LOGIC FUNCTIONS ---
  useEffect(() => {
    const storedTenentId = localStorage?.getItem('tenentid');
    setTenentId(storedTenentId);
    if (!storedTenentId) {
      showToast('Tenant ID not found in localStorage. Please log in again.', 'error');
    }
    if (orderInputRef.current) orderInputRef.current.focus();
    if (activeTab === 'list') fetchHoldsList();
  }, [activeTab]);

  const fetchOrderDetails = async (passedOrderNum?: string) => {
    const targetOrderNumber = passedOrderNum || orderNumber;

    if (!targetOrderNumber.trim()) {
      showToast('Please enter an order number', 'error');
      return;
    }

    const currentTenentId = localStorage?.getItem('tenentid');
    if (!currentTenentId) {
      showToast('Tenant ID not found. Please log in again.', 'error');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(ENDPOINTS.ORDER_DETAILS, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderNumber: targetOrderNumber.trim(), tenentId: currentTenentId }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to fetch order details');

      if (data.success && data.order) {
        setOrderData(data.order);
        setShowForm(true);
        showToast('Order found! You can now add holding information.', 'success');
      } else {
        throw new Error(data.message || 'Order not found');
      }
    } catch (err: any) {
      console.error('Error fetching order details:', err);
      showToast(err.message || 'Error fetching order details.', 'error');
      setOrderData(null);
      setShowForm(false);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!orderNumber.trim() || !holdingProduct.trim() || !date || !holdingResponse.trim()) {
      showToast('Please fill in all required fields', 'error');
      return;
    }

    const currentTenentId = localStorage?.getItem('tenentid');
    if (!currentTenentId) {
      showToast('Tenant ID not found. Please log in again.', 'error');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(ENDPOINTS.UPDATE_HOLDING, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderNumber: orderNumber.trim(),
          holdingProduct: holdingProduct.trim(),
          holdingResponse: holdingResponse.trim(),
          date: date,
          tenentId: currentTenentId
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to update holding information');

      if (data.success) {
        showToast('Holding information updated successfully', 'success');
        resetForm();
        if (activeTab === 'list') fetchHoldsList();
      } else {
        throw new Error(data.message || 'Failed to update holding information');
      }
    } catch (err: any) {
      console.error('Error updating holding:', err);
      showToast(err.message || 'Failed to update holding.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setOrderNumber('');
    setHoldingProduct('');
    setHoldingResponse('');
    setDate('');
    setOrderData(null);
    setShowForm(false);
    if (orderInputRef.current) orderInputRef.current.focus();
  };

  const fetchHoldsList = async () => {
    const currentTenentId = localStorage?.getItem('tenentid');
    if (!currentTenentId) {
      showToast('Tenant ID not found. Please log in again.', 'error');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(ENDPOINTS.HOLDS_LIST, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenentId: currentTenentId }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to fetch holds list');

      if (data.success) {
        setHoldsList(data.holds || []);
        showToast(`Loaded ${data.holds?.length || 0} holds`, 'success');
      } else {
        throw new Error(data.message || 'Failed to fetch holds list');
      }
    } catch (err: any) {
      console.error('Error fetching holds list:', err);
      showToast(err.message || 'Error fetching holds list.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const resolveHold = async (holdId: string, orderNumber: string) => {
    if (!window.confirm('Are you sure you want to resolve this hold?')) return;
    const currentTenentId = localStorage?.getItem('tenentid');
    if (!currentTenentId) {
      showToast('Tenant ID not found. Please log in again.', 'error');
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(ENDPOINTS.RESOLVE_HOLD, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ holdId, orderNumber, tenentId: currentTenentId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to resolve hold');
      if (data.success) {
        showToast(`Hold resolved successfully for order #${orderNumber}`, 'success');
        fetchHoldsList();
      } else {
        throw new Error(data.message || 'Failed to resolve hold');
      }
    } catch (err: any) {
      console.error('Error resolving hold:', err);
      showToast(err.message || `Error resolving hold for order #${orderNumber}.`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && orderNumber.trim()) fetchOrderDetails();
  };

  const filteredHolds = holdsList.filter((hold: Hold) => {
    const matchesSearch =
      hold.orderNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      hold.holdingProduct?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      hold.customerName?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || hold.status?.toLowerCase() === filterStatus.toLowerCase();
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="flex flex-col w-full p-4 bg-gray-50 min-h-screen">

      {/* --- SCANNER OVERLAY --- */}
      {scanning && (
        <div className="fixed inset-0 bg-black z-[70] flex flex-col items-center justify-center p-4">
          <div className="w-full max-w-sm relative">
            <div id="reader" className="w-full rounded-2xl overflow-hidden border-2 border-orange-600 bg-black" style={{ minHeight: '250px' }} />
            <div className="text-white text-center mt-4">
              <p className="font-medium animate-pulse">{scannerReady ? '📷 Point at Order Barcode' : 'Initializing Camera...'}</p>
            </div>
          </div>
          <button type="button" onClick={handleCloseScanner} className="mt-10 p-3 rounded-full bg-white/10 text-white border border-white/20 hover:bg-white/20 transition-all">
            <X size={24} />
          </button>
        </div>
      )}

      {onBack && (
        <div className="w-full flex justify-start mb-4">
          <button
            onClick={onBack}
            className="bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 hover:text-orange-600 hover:border-orange-600 shadow-sm flex items-center mt-2 px-4 py-2 rounded-lg transition-all duration-200 font-medium"
          >
            <span className="mr-2 text-xl">←</span> Back to Status Menu
          </button>
        </div>
      )}

      <div className="max-w-4xl mx-auto mb-6 w-full">
        <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg border">
          <button onClick={() => setActiveTab('add')} className={`flex-1 py-2 px-4 rounded-md transition-colors ${activeTab === 'add' ? 'bg-white text-black shadow-sm font-medium border' : 'text-gray-600 hover:text-gray-900'}`}>Add Holding</button>
          <button onClick={() => setActiveTab('list')} className={`flex-1 py-2 px-4 rounded-md transition-colors ${activeTab === 'list' ? 'bg-white text-black shadow-sm font-medium border' : 'text-gray-600 hover:text-gray-900'}`}>Holdings List ({holdsList.length})</button>
        </div>
      </div>

      {activeTab === 'add' && (
        <div className="flex justify-center items-start pt-4 w-full">
          <div className="bg-white p-6 border shadow-sm rounded-xl max-w-lg w-full">
            <h1 className="text-2xl font-bold mb-6 text-gray-800 text-center">Add Holding</h1>
            <div className="space-y-4">
              <div className="flex flex-col items-center space-y-3">
                <div className="relative w-full">
                  <input
                    ref={orderInputRef}
                    type="text"
                    value={orderNumber}
                    onChange={(e) => setOrderNumber(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Order Number"
                    className="w-full p-3 pr-12 border-2 border-orange-600 rounded-lg text-center focus:outline-none focus:ring-1 focus:ring-orange-600"
                    disabled={showForm || !tenentId}
                  />
                  {!showForm && tenentId && (
                    <button
                      type="button"
                      onClick={startScanning}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 hover:text-orange-600 transition-colors"
                    >
                      <Camera size={24} />
                    </button>
                  )}
                </div>
                <button
                  onClick={() => fetchOrderDetails()}
                  disabled={loading || showForm || !tenentId}
                  className="w-full bg-orange-600 text-white py-3 px-4 rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                >
                  {loading ? 'Searching...' : 'Search Order'}
                </button>
              </div>

              {orderData && (
                <div className="p-4 bg-gray-50 rounded-lg border">
                  <h3 className="font-semibold text-gray-800 mb-2">Order Details</h3>
                  <div className="space-y-1 text-sm">
                    <p><span className="font-medium">Order ID:</span> {orderData.orderId || orderNumber}</p>
                    <p><span className="font-medium">Customer:</span> {orderData.customerName || 'N/A'}</p>
                    <p><span className="font-medium">Status:</span> {orderData.status || 'N/A'}</p>
                    {orderData.totalAmount && <p><span className="font-medium">Total:</span> ₹{orderData.totalAmount}</p>}
                  </div>
                </div>
              )}

              {showForm && (
                <div className="space-y-4">
                  <input type="text" value={holdingProduct} onChange={(e) => setHoldingProduct(e.target.value)} placeholder="Holding Product (Required)" className="w-full p-3 border rounded-lg focus:border-orange-600 focus:outline-none" required />
                  <textarea value={holdingResponse} onChange={(e) => setHoldingResponse(e.target.value)} placeholder="Holding Response (Required)" rows={3} className="w-full p-3 border rounded-lg focus:border-orange-600 focus:outline-none resize-none" required />
                  <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full p-3 border rounded-lg focus:border-orange-600 focus:outline-none" required />
                  <div className="flex space-x-3">
                    <button onClick={handleSubmit} disabled={loading} className="flex-1 bg-orange-600 text-white py-3 rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium">{loading ? 'Saving...' : 'Save'}</button>
                    <button onClick={resetForm} className="px-6 bg-gray-500 text-white py-3 rounded-lg hover:bg-gray-600 transition-colors font-medium">Reset</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'list' && (
        <div className="max-w-6xl mx-auto w-full">
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <div className="flex flex-col sm:flex-row gap-4 mb-4">
              <input type="text" placeholder="Search by order number..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="flex-1 p-3 border rounded-lg focus:border-orange-600 focus:outline-none" disabled={!tenentId} />
              <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="p-3 border rounded-lg focus:border-orange-600 focus:outline-none" disabled={!tenentId}>
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="pending">Pending</option>
                <option value="resolved">Resolved</option>
              </select>
              <button onClick={fetchHoldsList} disabled={loading || !tenentId} className="bg-orange-600 text-white px-4 py-2 rounded hover:bg-orange-700 disabled:opacity-50 transition-colors text-sm font-medium">{loading ? 'Refreshing...' : 'Refresh'}</button>
            </div>
            {loading && <Loader />}
            {!loading && tenentId && filteredHolds.length > 0 && (
              <div className="space-y-4">
                {filteredHolds.map((hold) => (
                  <div key={hold.id} className="border p-4 rounded-lg flex justify-between items-start hover:bg-gray-50 transition-shadow">
                    <div>
                      <h3 className="font-bold text-gray-800">Order #{hold.orderNumber}</h3>
                      <p className="text-sm text-gray-600">{hold.customerName || 'Unknown Customer'}</p>
                      <p className="text-sm mt-1"><span className="font-semibold">Product:</span> {hold.holdingProduct}</p>
                    </div>
                    <div className="text-right">
                      <StatusBadge status={hold.status} />
                      {hold.status === 'active' && (
                        <button onClick={() => resolveHold(hold.id, hold.orderNumber)} disabled={loading} className="block mt-2 text-sm text-orange-600 underline hover:text-orange-700">Resolve</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default HoldingPage;
