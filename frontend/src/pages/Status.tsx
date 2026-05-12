import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// ==========================================
// THEME CONSTANTS (InstaXbot Palette)
// ==========================================
// Primary Orange: #D9702C
// Darker Rust (Headers): #BF5B1A
// Neutral Grey: #EAEAEA

// ==========================================
// 1. PACKING COMPONENT
// ==========================================

interface Product {
  name: string;
  sku: string;
  quantity: number;
  image: string;
}

const CustomLoader: React.FC = () => (
  <div className="flex items-center justify-center">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#D9702C]"></div>
  </div>
);

const Packing: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [orderNumber, setOrderNumber] = useState<string>('');
  const [products, setProducts] = useState<Product[]>([]);
  const [skuInput, setSkuInput] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [customerNote, setCustomerNote] = useState<string>('');
  const [verifiedSkus, setVerifiedSkus] = useState<string[]>([]);
  const [productsFetched, setProductsFetched] = useState<boolean>(false);

  const skuInputRef = useRef<HTMLInputElement>(null);
  const orderInputRef = useRef<HTMLInputElement>(null);

  const apiBaseUrl = 'https://snaking-outhouse-oppose.ngrok-free.dev';

  useEffect(() => {
    if (orderInputRef.current) {
      orderInputRef.current.focus();
    }
  }, []);

  useEffect(() => {
    if (products.length > 0 && skuInputRef.current) {
      skuInputRef.current.focus();
    }
  }, [products, customerNote]);

  const fetchProducts = async (): Promise<void> => {
    setLoading(true);
    setProductsFetched(false);

    const tenentId = localStorage.getItem('tenentid');
    if (!tenentId) {
      toast.error('Tenant ID not found. Please log in again.');
      setLoading(false);
      return;
    }

    try {
      const response = await axios.post(
        `${apiBaseUrl}/api/packingroute/fetch-products/${orderNumber}`,
        { tenentId },
        { headers: { 'Content-Type': 'application/json' } }
      );

      if (response.data.showAlert && response.data.alertMessage) {
        if (response.data.alertMessage.includes('Payment')) {
          toast.warning(response.data.alertMessage);
        } else if (response.data.alertMessage.includes('shipped')) {
          toast.info(response.data.alertMessage);
        } else {
          toast.warning(response.data.alertMessage);
        }

        if (!response.data.shouldFetchProducts) {
          setProducts([]);
          setCustomerNote('');
          setVerifiedSkus([]);
          setProductsFetched(false);
          setLoading(false);
          return;
        }
      }

      if (!response.data.showAlert) {
        toast.success('Products fetched successfully');
      }

      setProducts(response.data.products || []);
      setCustomerNote(response.data.customerNote || '');
      setVerifiedSkus([]);
      setProductsFetched(true);

    } catch (error: any) {
      console.error('Error fetching data:', error);
      toast.error('Error fetching data. Please try again later.');
      setProducts([]);
      setCustomerNote('');
    } finally {
      setLoading(false);
    }
  };

  const handleFetchClick = (): void => {
    if (orderNumber) fetchProducts();
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter' && orderNumber) fetchProducts();
  };

  const handleSkuSubmit = (): void => {
    if (!skuInput) return;

    const productIndex = products.findIndex((product) => product.sku === skuInput);

    if (productIndex !== -1) {
      const updatedProducts = [...products];
      const currentQuantity = updatedProducts[productIndex].quantity;

      if (currentQuantity > 1) {
        updatedProducts[productIndex].quantity -= 1;
      } else {
        updatedProducts.splice(productIndex, 1);
      }

      setProducts(updatedProducts);
      setVerifiedSkus([...verifiedSkus, skuInput]);

      if (updatedProducts.length === 0) {
        submitAllVerifiedSkus([...verifiedSkus, skuInput]);
      }
    } else {
      toast.error('Wrong product');
    }

    setSkuInput('');
    if (skuInputRef.current) skuInputRef.current.focus();
  };

  const submitAllVerifiedSkus = async (allVerifiedSkus: string[]): Promise<void> => {
    const tenentId = localStorage.getItem('tenentid');
    if (!tenentId) {
      toast.error('Tenant ID not found. Please log in again.');
      return;
    }

    try {
      setLoading(true);
      await axios.post(
        `${apiBaseUrl}/api/packingroute/verify-sku/${orderNumber}`,
        { tenentId, skuInputs: allVerifiedSkus },
        { headers: { 'Content-Type': 'application/json' } }
      );

      toast.success('All products are verified and packed successfully');
      setOrderNumber('');
      setSkuInput('');
      setProducts([]);
      setVerifiedSkus([]);
      setCustomerNote('');
      if (orderInputRef.current) orderInputRef.current.focus();
    } catch (error: any) {
      console.error('Error verifying SKU:', error);
      toast.error('Error verifying SKU. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const handleSkuKeyPress = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter') handleSkuSubmit();
  };

  return (
    <div className="flex flex-col items-center w-full bg-transparent rounded-lg p-6">

      {/* Back Button - Box Style */}
      <div className="w-full flex justify-start mb-4">
        <button
          onClick={onBack}
          className="bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 hover:text-[#D9702C] hover:border-[#D9702C] shadow-sm flex items-center font-medium px-4 py-2 rounded-lg transition-all duration-200"
        >
          <span className="mr-2 text-xl">←</span> Back to Status Menu
        </button>
      </div>

      <div className="w-full max-w-md flex flex-col items-center relative">

        {/* Changed bg-gray-50 to bg-transparent */}
        <div className="bg-transparent shadow-sm border px-3 py-5 text-center rounded-xl mb-4 w-full">
          <h1 className="text-2xl font-bold text-gray-800">Packing Station</h1>
        </div>

        {/* Changed bg-white to bg-transparent */}
        <div className="bg-transparent border shadow-sm rounded-xl p-8 mb-6 w-full">
          <div className="flex flex-col gap-5">
            <div className="flex items-center w-full">
              <h2 className="text-lg font-bold text-gray-800 mr-3 whitespace-nowrap">Enter Order Number</h2>
              <input
                type="text"
                value={orderNumber}
                onChange={(e) => setOrderNumber(e.target.value)}
                onKeyPress={handleKeyPress}
                className="border rounded-sm p-3 flex-grow text-black placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#D9702C] shadow-sm"
                placeholder="Order Number"
                ref={orderInputRef}
              />
            </div>
            <div className="flex justify-center mt-3">
              <button
                onClick={handleFetchClick}
                className="bg-[#D9702C] text-white px-8 py-3 rounded-md hover:bg-[#BF5B1A] focus:outline-none focus:ring-2 focus:ring-gray-400 shadow-md transition duration-200 font-medium text-lg"
              >
                Fetch Product
              </button>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64"><CustomLoader /></div>
        ) : (
          <div className="flex flex-col items-center w-full">
            {customerNote && (
              <div className="mb-5 p-4 bg-yellow-100 rounded-xl w-full shadow-md border-l-4 border-yellow-500">
                <h3 className="font-bold text-lg mb-2 text-yellow-800">Customer Note:</h3>
                <p className="text-gray-800">{customerNote}</p>
              </div>
            )}

            {products.length > 0 && (
              <div className="w-full bg-white border shadow-lg rounded-xl overflow-hidden mb-6">
                <table className="min-w-full">
                  {/* Table Header: Darker Rust Color */}
                  <thead className="bg-[#BF5B1A] text-white">
                    <tr>
                      <th className="py-3 px-4 text-left">Name</th>
                      <th className="py-3 px-4">Image</th>
                      <th className="py-3 px-4">Quantity</th>
                    </tr>
                  </thead>
                  <tbody className="text-gray-800">
                    {products.map((product, index) => (
                      <tr key={index} className="border-b hover:bg-gray-50">
                        <td className="py-3 px-4">{product.name}</td>
                        <td className="py-3 px-4 text-center">
                          {product.image ? (
                            <img src={product.image} alt={product.name} className="max-w-[100px] max-h-[100px] mx-auto" />
                          ) : (
                            <div className="w-[100px] h-[100px] bg-gray-200 flex items-center justify-center mx-auto text-xs text-gray-500">No image</div>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">{product.quantity}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {products.length > 0 && (
              <div className="mt-4 flex flex-col items-center w-full">
                <input
                  type="text"
                  value={skuInput}
                  onChange={(e) => setSkuInput(e.target.value)}
                  onKeyPress={handleSkuKeyPress}
                  className="border rounded-xl p-3 w-full text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#D9702C] shadow-md"
                  placeholder="Enter SKU"
                  ref={skuInputRef}
                />
                <button
                  onClick={handleSkuSubmit}
                  className="bg-[#D9702C] text-white px-6 py-3 rounded-xl mt-3 w-full md:w-1/2 hover:bg-[#BF5B1A] focus:outline-none focus:ring-2 focus:ring-[#D9702C] shadow-md transition duration-300 font-medium"
                >
                  Submit SKU
                </button>
              </div>
            )}
            {productsFetched && products.length === 0 && (
              <div className="text-center p-8 bg-green-50 border border-green-200 rounded-xl shadow-md w-full">
                <p className="text-2xl text-green-700 font-bold">✓ Packed Successfully!</p>
                <p className="text-green-600 mt-2">All products verified. Ready for next order.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// ==========================================
// 2. HOLDING PAGE COMPONENT
// ==========================================

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

const HoldingPage: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const API_BASE_URL = 'https://snaking-outhouse-oppose.ngrok-free.dev/api';
  const ENDPOINTS = {
    ORDER_DETAILS: `${API_BASE_URL}/holdingroute/details`,
    UPDATE_HOLDING: `${API_BASE_URL}/holdingroute/update-holding`,
    HOLDS_LIST: `${API_BASE_URL}/holdingroute/holds/list`,
    RESOLVE_HOLD: `${API_BASE_URL}/holdingroute/holds/resolve`,
    ADD_RESPONSE: `${API_BASE_URL}/holdingroute/holds/response`,
  };

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    if (type === 'success') toast.success(message);
    else if (type === 'error') toast.error(message);
    else toast.info(message);
  };

  const [orderNumber, setOrderNumber] = useState('');
  const [holdingProduct, setHoldingProduct] = useState('');
  const [holdingResponse, setHoldingResponse] = useState('');
  const [date, setDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [orderData, setOrderData] = useState<OrderData | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [activeTab, setActiveTab] = useState<'add' | 'list'>('add');
  const [holdsList, setHoldsList] = useState<Hold[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus] = useState('all');
  const [tenentId, setTenentId] = useState<string | null>(null);

  const orderInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const storedTenentId = localStorage?.getItem('tenentid');
    setTenentId(storedTenentId);
    if (!storedTenentId) showToast('Tenant ID not found. Please log in again.', 'error');
    if (orderInputRef.current) orderInputRef.current.focus();
    if (activeTab === 'list') fetchHoldsList();
  }, [activeTab]);

  const fetchOrderDetails = async () => {
    if (!orderNumber.trim()) { showToast('Please enter an order number', 'error'); return; }
    const currentTenentId = localStorage?.getItem('tenentid');
    if (!currentTenentId) return;

    setLoading(true);
    try {
      const response = await fetch(ENDPOINTS.ORDER_DETAILS, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderNumber: orderNumber.trim(), tenentId: currentTenentId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);

      if (data.success && data.order) {
        setOrderData(data.order);
        setShowForm(true);
        showToast('Order found!', 'success');
      } else {
        throw new Error('Order not found');
      }
    } catch (err: any) {
      showToast(err.message, 'error');
      setOrderData(null);
      setShowForm(false);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!orderNumber.trim() || !holdingProduct.trim() || !date || !holdingResponse.trim()) {
      showToast('Fill required fields', 'error');
      return;
    }
    const currentTenentId = localStorage?.getItem('tenentid');
    if (!currentTenentId) return;

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
      if (!response.ok) throw new Error(data.message);
      if (data.success) {
        showToast('Updated successfully', 'success');
        resetForm();
        if (activeTab === 'list') fetchHoldsList();
      }
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setOrderNumber(''); setHoldingProduct(''); setHoldingResponse(''); setDate('');
    setOrderData(null); setShowForm(false);
    if (orderInputRef.current) orderInputRef.current.focus();
  };

  const fetchHoldsList = async () => {
    const currentTenentId = localStorage?.getItem('tenentid');
    if (!currentTenentId) return;
    setLoading(true);
    try {
      const response = await fetch(ENDPOINTS.HOLDS_LIST, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenentId: currentTenentId }),
      });
      const data = await response.json();
      if (data.success) {
        setHoldsList(data.holds || []);
      }
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const resolveHold = async (holdId: string, orderNumber: string) => {
    if (!window.confirm('Are you sure?')) return;
    const currentTenentId = localStorage?.getItem('tenentid');
    if (!currentTenentId) return;

    setLoading(true);
    try {
      const response = await fetch(ENDPOINTS.RESOLVE_HOLD, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ holdId, orderNumber, tenentId: currentTenentId }),
      });
      const data = await response.json();
      if (data.success) {
        showToast('Resolved successfully', 'success');
        fetchHoldsList();
      }
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && orderNumber.trim()) fetchOrderDetails();
  };

  const filteredHolds = holdsList.filter((hold) => {
    const matchesSearch =
      hold.orderNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      hold.holdingProduct?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      hold.customerName?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || hold.status?.toLowerCase() === filterStatus.toLowerCase();
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="flex flex-col w-full bg-transparent rounded-lg p-6">

      {/* Back Button - Box Style */}
      <div className="w-full flex justify-start mb-4">
        <button
          onClick={onBack}
          className="bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 hover:text-[#D9702C] hover:border-[#D9702C] shadow-sm flex items-center mt-2 px-4 py-2 rounded-lg transition-all duration-200 font-medium"
        >
          <span className="mr-2 text-xl">←</span> Back to Status Menu
        </button>
      </div>

      <div className="max-w-4xl mx-auto w-full mb-6">
        <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg border">
          <button
            onClick={() => setActiveTab('add')}
            className={`flex-1 py-2 px-4 rounded-md transition-colors ${activeTab === 'add' ? 'bg-white text-black shadow-sm font-medium border' : 'text-gray-600'}`}
          >
            Add Holding
          </button>
          <button
            onClick={() => setActiveTab('list')}
            className={`flex-1 py-2 px-4 rounded-md transition-colors ${activeTab === 'list' ? 'bg-white text-black shadow-sm font-medium border' : 'text-gray-600'}`}
          >
            Holdings List ({holdsList.length})
          </button>
        </div>
      </div>

      {activeTab === 'add' && (
        <div className="flex justify-center items-start pt-4 w-full">
          {/* Changed bg-white to bg-transparent */}
          <div className="bg-transparent p-6 border shadow-sm rounded-xl max-w-lg w-full">
            <h1 className="text-2xl font-bold mb-6 text-gray-800 text-center">Add Holding</h1>
            <div className="space-y-4">
              <div className="flex flex-col items-center space-y-3">
                <input
                  ref={orderInputRef}
                  type="text"
                  value={orderNumber}
                  onChange={(e) => setOrderNumber(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Order Number"
                  // Using Brand Orange for border focus/highlight
                  className="w-full p-3 border-2 border-[#D9702C] rounded-lg text-center focus:outline-none focus:ring-1 focus:ring-[#D9702C]"
                  disabled={showForm || !tenentId}
                />
                <button
                  onClick={fetchOrderDetails}
                  disabled={loading || showForm || !tenentId}
                  className="w-full bg-[#D9702C] text-white py-3 px-4 rounded-lg hover:bg-[#BF5B1A]"
                >
                  {loading ? 'Searching...' : 'Search Order'}
                </button>
              </div>

              {orderData && (
                <div className="p-4 bg-gray-50 rounded-lg border">
                  <p className="text-sm"><b>Customer:</b> {orderData.customerName}</p>
                  <p className="text-sm"><b>Status:</b> {orderData.status}</p>
                </div>
              )}

              {showForm && (
                <div className="space-y-4">
                  <input
                    type="text"
                    value={holdingProduct}
                    onChange={(e) => setHoldingProduct(e.target.value)}
                    placeholder="Holding Product"
                    className="w-full p-3 border rounded-lg focus:border-[#D9702C] focus:outline-none"
                  />
                  <textarea
                    value={holdingResponse}
                    onChange={(e) => setHoldingResponse(e.target.value)}
                    placeholder="Reason/Response"
                    className="w-full p-3 border rounded-lg focus:border-[#D9702C] focus:outline-none"
                  />
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full p-3 border rounded-lg focus:border-[#D9702C] focus:outline-none"
                  />
                  <div className="flex space-x-3">
                    <button onClick={handleSubmit} className="flex-1 bg-[#D9702C] text-white py-3 rounded-lg hover:bg-[#BF5B1A]">Save</button>
                    <button onClick={resetForm} className="px-6 bg-gray-500 text-white py-3 rounded-lg hover:bg-gray-600">Reset</button>
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
              <input
                type="text"
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-1 p-3 border rounded-lg focus:border-[#D9702C] focus:outline-none"
              />
              <button onClick={fetchHoldsList} className="bg-[#D9702C] text-white px-4 py-2 rounded hover:bg-[#BF5B1A]">Refresh</button>
            </div>
            <div className="space-y-4">
              {filteredHolds.map((hold) => (
                <div key={hold.id} className="border p-4 rounded-lg flex justify-between items-start hover:bg-gray-50">
                  <div>
                    <h3 className="font-bold text-gray-800">Order #{hold.orderNumber}</h3>
                    <p className="text-sm text-gray-600">{hold.customerName}</p>
                    <p className="text-sm mt-1"><span className="font-semibold">Product:</span> {hold.holdingProduct}</p>
                  </div>
                  <div className="text-right">
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${hold.status === 'active' ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}`}>{hold.status.toUpperCase()}</span>
                    {hold.status === 'active' && (
                      <button onClick={() => resolveHold(hold.id, hold.orderNumber)} className="block mt-2 text-sm text-[#D9702C] underline hover:text-[#BF5B1A]">Resolve</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ==========================================
// 3. TRACKING COMPONENT
// ==========================================

const Tracking: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [orderNumber, setOrderNumber] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [weight, setWeight] = useState('');
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const orderNumberInputRef = useRef<HTMLInputElement>(null);
  const trackingNumberInputRef = useRef<HTMLInputElement>(null);
  const weightInputRef = useRef<HTMLInputElement>(null);

  // Custom Alert Logic with updated Colors
  const showAlert = (type: string, title: string, text: string, showConfirm: boolean = true): Promise<boolean> => {
    return new Promise((resolve) => {
      const alertDiv = document.createElement('div');
      alertDiv.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50';
      const bgColor = type === 'success' ? 'bg-green-50 border-green-200' : type === 'error' ? 'bg-red-50 border-red-200' : type === 'warning' ? 'bg-yellow-50 border-yellow-200' : 'bg-orange-50 border-[#D9702C]';

      // Buttons using Brand Orange instead of Blue
      alertDiv.innerHTML = `
                <div class="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6 ${bgColor} border-2">
                    <div class="text-center">
                        <h3 class="text-lg font-semibold text-gray-900 mb-2">${title}</h3>
                        <p class="text-gray-600 mb-6">${text}</p>
                        <div class="flex justify-center space-x-3">
                            ${showConfirm ?
          `<button id="confirm-btn" style="background-color: #D9702C" class="px-4 py-2 text-white rounded hover:opacity-90">Yes</button>
                               <button id="cancel-btn" class="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400">No</button>`
          :
          `<button id="ok-btn" style="background-color: #D9702C" class="px-4 py-2 text-white rounded hover:opacity-90">OK</button>`
        }
                        </div>
                    </div>
                </div>`;
      document.body.appendChild(alertDiv);
      const confirmBtn = alertDiv.querySelector('#confirm-btn') as HTMLButtonElement;
      const cancelBtn = alertDiv.querySelector('#cancel-btn') as HTMLButtonElement;
      const okBtn = alertDiv.querySelector('#ok-btn') as HTMLButtonElement;

      const cleanup = () => {
        if (document.body.contains(alertDiv)) {
          document.body.removeChild(alertDiv);
        }
      };

      if (showConfirm) {
        if (confirmBtn) confirmBtn.onclick = () => { cleanup(); resolve(true); };
        if (cancelBtn) cancelBtn.onclick = () => { cleanup(); resolve(false); };
      } else {
        if (okBtn) okBtn.onclick = () => { cleanup(); resolve(true); };
      }
    });
  };

  const handleForceUpdate = async () => {
    const tenentId = localStorage.getItem('tenentid');
    if (!tenentId) return;
    setLoading(true); setSuccessMessage(''); setErrorMessage('');
    try {
      const response = await fetch('https://snaking-outhouse-oppose.ngrok-free.dev/api/trackingroute/force-update-tracking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderNumber, trackingNumber, weight: parseFloat(weight), tenentId, confirmOverride: true })
      });
      const data = await response.json();
      if (response.ok && data.success) {
        setSuccessMessage('Updated successfully');
        setTimeout(() => {
          setOrderNumber(''); setTrackingNumber(''); setWeight(''); setSuccessMessage('');
          if (orderNumberInputRef.current) orderNumberInputRef.current.focus();
        }, 2000);
      } else {
        setErrorMessage(data.message || 'Failed');
      }
    } catch (error) { setErrorMessage('Network error'); } finally { setLoading(false); }
  };

  const handleSubmit = async () => {
    if (!orderNumber || !trackingNumber || !weight) { setErrorMessage('Fill all fields'); return; }
    const tenentId = localStorage.getItem('tenentid');
    if (!tenentId) { setErrorMessage('Tenant ID missing'); return; }

    setLoading(true); setSuccessMessage(''); setErrorMessage('');
    try {
      const response = await fetch('https://snaking-outhouse-oppose.ngrok-free.dev/api/trackingroute/update-tracking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderNumber, trackingNumber, weight: parseFloat(weight), tenentId })
      });
      const data = await response.json();
      if (response.ok && data.success) {
        setSuccessMessage('Updated successfully');
        setTimeout(() => {
          setOrderNumber(''); setTrackingNumber(''); setWeight(''); setSuccessMessage('');
          if (orderNumberInputRef.current) orderNumberInputRef.current.focus();
        }, 2000);
      } else {
        if (data.statusCheck) {
          if (data.statusCheck === 'ALREADY_SHIPPED') {
            const confirm = await showAlert('question', 'Already Shipped', 'Overwrite data?', true);
            if (confirm) await handleForceUpdate();
          } else {
            await showAlert('warning', 'Issue', data.message || 'Check status', false);
          }
        } else {
          setErrorMessage(data.message);
        }
      }
    } catch (error) { setErrorMessage('Network error'); } finally { setLoading(false); }
  };

  const handleKeyDown = (e: React.KeyboardEvent, currentField: string) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (currentField === 'orderNumber' && trackingNumberInputRef.current) trackingNumberInputRef.current.focus();
      if (currentField === 'trackingNumber' && weightInputRef.current) weightInputRef.current.focus();
      if (currentField === 'weight') handleSubmit();
    }
  };

  return (
    <div className="flex flex-col items-center w-full p-6">

      {/* Back Button - Box Style */}
      <div className="w-full flex justify-start mb-4">
        <button
          onClick={onBack}
          className="bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 hover:text-[#D9702C] hover:border-[#D9702C] shadow-sm flex items-center px-4 py-2 rounded-lg transition-all duration-200 font-medium"
        >
          <span className="mr-2 text-xl">←</span> Back to Status Menu
        </button>
      </div>

      <div className="max-w-md w-full">
        <div className="bg-white shadow-sm border rounded-lg p-4 mb-6 text-center">
          <h2 className="text-2xl font-bold text-gray-800">Tracking Station</h2>
        </div>
        {successMessage && <div className="bg-green-100 border border-green-200 text-green-700 px-4 py-3 rounded mb-4 text-center">{successMessage}</div>}
        {errorMessage && <div className="bg-red-100 border border-red-200 text-red-700 px-4 py-3 rounded mb-4 text-center">{errorMessage}</div>}

        <div className="bg-white shadow-sm border rounded-lg">
          <div className="p-6 space-y-3">
            <div>
              <label className="block font-semibold mb-2 text-gray-700">Order Number:</label>
              <input
                ref={orderNumberInputRef}
                type="text"
                value={orderNumber}
                onChange={(e) => setOrderNumber(e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, 'orderNumber')}
                className="w-full border rounded-md p-2 focus:ring-[#D9702C] focus:border-[#D9702C] outline-none"
              />
            </div>
            <div>
              <label className="block font-semibold mb-2 text-gray-700">Tracking Number:</label>
              <input
                ref={trackingNumberInputRef}
                type="text"
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, 'trackingNumber')}
                className="w-full border rounded-md p-2 focus:ring-[#D9702C] focus:border-[#D9702C] outline-none"
              />
            </div>
            <div>
              <label className="block font-semibold mb-2 text-gray-700">Weight (gms):</label>
              <input
                ref={weightInputRef}
                type="number"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, 'weight')}
                className="w-full border rounded-md p-2 focus:ring-[#D9702C] focus:border-[#D9702C] outline-none"
              />
            </div>
          </div>
          <div className="py-4 bg-gray-50 border-t rounded-b-lg flex justify-center">
            <button onClick={handleSubmit} disabled={loading} className={`px-8 py-2 rounded-lg font-medium text-lg text-white ${loading ? 'bg-orange-400' : 'bg-[#D9702C] hover:bg-[#BF5B1A]'}`}>
              {loading ? 'Updating...' : 'Update Tracking'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ==========================================
// 4. MAIN STATUS PAGE COMPONENT
// ==========================================

// UPDATED: Medium sized boxes (h-32) that fit on one screen without scrolling
const DashboardCard = ({ title, icon, onClick, color }: { title: string, icon: string, onClick: () => void, color: string }) => (
  <div
    onClick={onClick}
    className="bg-white p-4 rounded-xl shadow-md border hover:shadow-lg hover:-translate-y-1 transition-all duration-300 cursor-pointer flex flex-col items-center justify-center h-32 border-t-8 w-full group"
    style={{ borderColor: color }}
  >
    <div className="text-4xl mb-2 group-hover:scale-110 transition-transform duration-300">{icon}</div>
    <h3 className="text-xl font-bold text-gray-800 tracking-tight">{title}</h3>
    <p className="text-gray-500 text-xs mt-2 font-medium bg-gray-100 px-3 py-1 rounded-full">Click to open</p>
  </div>
);

const StatusPage: React.FC = () => {
  const [currentView, setCurrentView] = useState<'dashboard' | 'packing' | 'holding' | 'tracking'>('dashboard');

  const renderContent = () => {
    switch (currentView) {
      case 'packing':
        return <Packing onBack={() => setCurrentView('dashboard')} />;
      case 'holding':
        return <HoldingPage onBack={() => setCurrentView('dashboard')} />;
      case 'tracking':
        return <Tracking onBack={() => setCurrentView('dashboard')} />;
      default:
        return (
          // UPDATED LAYOUT: Centered vertically in viewport (h-full + justify-center)
          // Removed padding to prevent scrolling
          <div className="flex flex-col items-center justify-center h-full w-full">
            <div className="mb-8 text-center">
              <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight">Warehouse Operations</h1>
              <p className="text-lg text-gray-600 mt-2 font-medium">Select a station to begin work.</p>
            </div>

            {/* Cards Container - Compact gap */}
            <div className="flex flex-col gap-4 w-full max-w-lg px-4">

              <DashboardCard
                title="Packing Station"
                icon="📦"
                color="#D9702C" // Brand Orange
                onClick={() => setCurrentView('packing')}
              />

              <DashboardCard
                title="Tracking / Manifest"
                icon="🚚"
                color="#BF5B1A" // Darker Rust/Orange
                onClick={() => setCurrentView('tracking')}
              />

              <DashboardCard
                title="Holding Area"
                icon="⏸️"
                color="#D9702C" // Brand Orange
                onClick={() => setCurrentView('holding')}
              />

            </div>
          </div>
        );
    }
  };

  return (
    // Fixed height screen to prevent scrolling on dashboard
    <div className="flex h-screen bg-gray-50 font-sans overflow-hidden">
      <ToastContainer />
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {renderContent()}
      </div>
    </div>
  );
};

export default StatusPage;
