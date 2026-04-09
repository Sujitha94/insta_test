import { useState, useEffect, useRef } from 'react';
import { RefreshCw, ChevronLeft, ChevronRight, Instagram, ChevronDown, Download, MapPin } from 'lucide-react';
import * as XLSX from 'xlsx';

interface Product {
  sku?: string;
  product_name?: string;
  quantity?: number;
  price?: number | string;
}

interface Order {
  id: string;
  date: string;
  name: string;
  customer_name: string;
  username: string;
  phoneNumber: string;
  products: Product[];
  totalAmount: number;
  status: string;
  billNo?: string;
  paymentStatus?: string;
  paymentMethod?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  pincode?: string;
  country?: string;
  fullAddress?: string;
  landmark?: string;
  trackingNumber?: string;
}

interface ApiResponse {
  success: boolean;
  data: Order[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalOrders: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

// --- CUSTOM DROPDOWN COMPONENT FOR MOBILE VIEW ---
interface CustomDropdownProps {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  disabled?: boolean;
  isSmall?: boolean;
}

const CustomDropdown = ({ value, onChange, options, placeholder, disabled, isSmall }: CustomDropdownProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (option: string) => {
    if (!disabled) {
      onChange(option);
      setIsOpen(false);
    }
  };

  return (
    <div className={`relative ${isSmall ? 'w-full' : 'w-full'}`} ref={dropdownRef}>
      <button
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`w-full flex items-center justify-between border border-gray-300 rounded-md bg-white text-left transition-all
          ${isSmall ? 'px-3 py-2 text-sm' : 'px-4 py-2 text-sm'}
          ${isOpen ? 'ring-2 ring-orange-500 border-orange-500' : 'hover:border-orange-500'}
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        `}
      >
        <span className={`block truncate ${!value && placeholder ? 'text-gray-500' : 'text-gray-700'}`}>
          {value || placeholder || 'Select'}
        </span>
        <ChevronDown className={`text-gray-400 transition-transform flex-shrink-0 ${isSmall ? 'w-4 h-4' : 'w-4 h-4'} ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute z-[9999] w-full mt-1 bg-white border border-gray-200 rounded-md shadow-xl max-h-60 overflow-y-auto">
          {placeholder && (
            <div
              onClick={() => handleSelect('')}
              className={`cursor-pointer select-none relative ${isSmall ? 'px-3 py-2 text-sm' : 'px-4 py-2 text-sm'} text-gray-500 hover:bg-orange-500 hover:text-white`}
            >
              {placeholder}
            </div>
          )}
          {options.map((option) => (
            <div
              key={option}
              onClick={() => handleSelect(option)}
              className={`cursor-pointer select-none relative ${isSmall ? 'px-3 py-2 text-sm' : 'px-4 py-2 text-sm'}
                ${value === option ? 'bg-orange-50 text-orange-600 font-medium' : 'text-gray-700'}
                hover:bg-orange-500 hover:text-white transition-colors
              `}
            >
              {option}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
// -----------------------------------------------------------

const OrderManagement = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalOrders, setTotalOrders] = useState(0);
  const [statusFilter, setStatusFilter] = useState('');
  const [itemsPerPage] = useState(20);
  const [expandedAddresses, setExpandedAddresses] = useState(new Set<string>());
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);
  const [isMobileView, setIsMobileView] = useState(false);
  const [downloadingExcel, setDownloadingExcel] = useState(false);
  const [isDownloadMenuOpen, setIsDownloadMenuOpen] = useState(false);
  const downloadMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleResize = () => setIsMobileView(window.innerWidth < 768);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (downloadMenuRef.current && !downloadMenuRef.current.contains(event.target as Node)) {
        setIsDownloadMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const API_BASE_URL = 'https://inocencia-shiftiest-nonodorously.ngrok-free.dev/api';

  const statusOptions = [
    'CREATED', 'PENDING', 'PROCESSING', 'PAID',
    'SHIPPED', 'DELIVERED', 'COMPLETED', 'CANCELLED',
    'FAILED', 'HOLDED', 'PRINTED', 'PACKED'
  ];

  const formatPrice = (price: any): string => {
    if (price === null || price === undefined) return '0.00';
    if (typeof price === 'object' && price !== null) {
      if (price.$numberInt !== undefined) return parseFloat(price.$numberInt).toFixed(2);
      if (price.$numberLong !== undefined) return parseFloat(price.$numberLong).toFixed(2);
      if (price.$numberDecimal !== undefined) return parseFloat(price.$numberDecimal).toFixed(2);
      if (price.$numberDouble !== undefined) return parseFloat(price.$numberDouble).toFixed(2);
    }
    const numPrice = parseFloat(String(price));
    return !isNaN(numPrice) ? numPrice.toFixed(2) : '0.00';
  };

  const safeString = (value: any): string => {
    if (value === null || value === undefined) return '';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  };

  const safeNumber = (value: any): number => {
    if (value === null || value === undefined) return 0;
    if (typeof value === 'object' && value !== null) {
      if (value.$numberInt !== undefined) return parseInt(value.$numberInt, 10);
      if (value.$numberLong !== undefined) return parseInt(value.$numberLong, 10);
    }
    const num = parseFloat(String(value));
    return !isNaN(num) ? num : 0;
  };

  const formatCompleteAddress = (order: Order): string => {
    const parts = [
      safeString(order.address),
      safeString(order.landmark),
      safeString(order.city),
      safeString(order.state),
      safeString(order.country),
      safeString(order.zipCode || order.pincode)
    ].filter(part => part && part !== '');
    return parts.length > 0 ? parts.join(', ') : 'N/A';
  };

  const getShortAddress = (order: Order): string => {
    const parts = [safeString(order.city), safeString(order.state)].filter(part => part && part !== '');
    return parts.length > 0 ? parts.join(', ') : 'N/A';
  };

  const getTenentId = () => {
    try {
      return localStorage.getItem('tenentid') || '';
    } catch (error) {
      console.error('Error accessing localStorage:', error);
      return '';
    }
  };

  const toggleAddressExpansion = (orderId: string) => {
    const newExpanded = new Set(expandedAddresses);
    newExpanded.has(orderId) ? newExpanded.delete(orderId) : newExpanded.add(orderId);
    setExpandedAddresses(newExpanded);
  };

  // ---- EXCEL DOWNLOAD FUNCTIONS ----
  const downloadAllOrdersAsExcel = async () => {
    setDownloadingExcel(true);
    const tenentId = getTenentId();

    if (!tenentId) {
      setError('Tenant ID not found. Please login again.');
      setDownloadingExcel(false);
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/orderroute/fetch-orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true'
        },
        body: JSON.stringify({
          page: 1,
          limit: totalOrders || 10000,
          tenentId,
          ...(searchTerm && { search: searchTerm }),
          ...(statusFilter && { status: statusFilter })
        })
      });

      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

      const result: ApiResponse = await response.json();
      if (!result.success) throw new Error('Failed to fetch orders for export');

      exportToExcel(result.data);
    } catch (err) {
      console.error('Error downloading Excel:', err);
      setError(err instanceof Error ? err.message : 'Failed to download Excel');
    } finally {
      setDownloadingExcel(false);
    }
  };

  const downloadCurrentPageAsExcel = () => {
    exportToExcel(orders);
  };

  const exportToExcel = (data: Order[]) => {
    const wb = XLSX.utils.book_new();

    // ---- Sheet 1: Orders Summary ----
    const ordersSheetData = data.map(order => ({
      'Order ID': safeString(order.id),
      'Date': safeString(order.date),
      'Bill No': safeString(order.billNo),
      'Customer Name': safeString(order.customer_name || order.name),
      'Instagram Name': safeString(order.name),
      'Instagram Handle': `@${safeString(order.username)}`,
      'Phone Number': safeString(order.phoneNumber),
      'Status': safeString(order.status),
      'Payment Status': safeString(order.paymentStatus),
      'Payment Method': safeString(order.paymentMethod),
      'Total Amount (₹)': parseFloat(formatPrice(order.totalAmount)),
      'Total Items': order.products.reduce((acc, p) => acc + safeNumber(p.quantity || 1), 0),
      'Address': safeString(order.address),
      'Landmark': safeString(order.landmark),
      'City': safeString(order.city),
      'State': safeString(order.state),
      'Country': safeString(order.country),
      'Zip / Pincode': safeString(order.zipCode || order.pincode),
      'Full Address': formatCompleteAddress(order),
      'Tracking Number': safeString(order.trackingNumber),
    }));

    const ordersSheet = XLSX.utils.json_to_sheet(ordersSheetData);
    const orderColWidths = [
      { wch: 20 }, { wch: 18 }, { wch: 14 }, { wch: 22 }, { wch: 20 },
      { wch: 20 }, { wch: 16 }, { wch: 14 }, { wch: 16 }, { wch: 16 },
      { wch: 18 }, { wch: 12 }, { wch: 30 }, { wch: 20 }, { wch: 16 },
      { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 50 }, { wch: 20 },
    ];
    ordersSheet['!cols'] = orderColWidths;
    XLSX.utils.book_append_sheet(wb, ordersSheet, 'Orders Summary');

    // ---- Sheet 2: Products Detail ----
    const productsSheetData: Record<string, any>[] = [];
    data.forEach(order => {
      if (order.products && order.products.length > 0) {
        order.products.forEach(product => {
          productsSheetData.push({
            'Order ID': safeString(order.id),
            'Date': safeString(order.date),
            'Customer Name': safeString(order.customer_name || order.name),
            'Phone Number': safeString(order.phoneNumber),
            'Status': safeString(order.status),
            'SKU': safeString(product.sku),
            'Product Name': safeString(product.product_name || product.sku || 'Unnamed Product'),
            'Quantity': safeNumber(product.quantity || 1),
            'Unit Price (₹)': parseFloat(formatPrice(product.price)),
            'Line Total (₹)': parseFloat(formatPrice(safeNumber(product.price) * safeNumber(product.quantity || 1))),
          });
        });
      }
    });

    const productsSheet = XLSX.utils.json_to_sheet(productsSheetData);
    productsSheet['!cols'] = [
      { wch: 20 }, { wch: 18 }, { wch: 22 }, { wch: 16 },
      { wch: 14 }, { wch: 18 }, { wch: 30 }, { wch: 10 },
      { wch: 16 }, { wch: 16 },
    ];
    XLSX.utils.book_append_sheet(wb, productsSheet, 'Products Detail');

    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    const filterPart = statusFilter ? `_${statusFilter}` : '';
    const searchPart = searchTerm ? `_${searchTerm.replace(/\s+/g, '-').slice(0, 20)}` : '';
    const fileName = `orders${filterPart}${searchPart}_${dateStr}.xlsx`;

    XLSX.writeFile(wb, fileName);
  };
  // ---- END EXCEL DOWNLOAD FUNCTIONS ----

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    setUpdatingStatus(orderId);
    const tenentId = getTenentId();

    if (!tenentId) {
      setError('Tenant ID not found. Please login again.');
      setUpdatingStatus(null);
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/orderroute/update-status/${orderId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true'
        },
        body: JSON.stringify({ tenentId, status: newStatus.toUpperCase() })
      });

      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

      const result = await response.json();
      if (result.success) {
        setOrders(prev =>
          prev.map(order =>
            order.id === orderId ? { ...order, status: newStatus.toUpperCase() } : order
          )
        );
        setError('');
      } else {
        throw new Error(result.message || 'Failed to update order status');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update order status');
    } finally {
      setUpdatingStatus(null);
    }
  };

  const fetchOrders = async (page: number, search: string, status: string, limit: number) => {
    setLoading(true);
    setError('');

    const tenentId = getTenentId();
    if (!tenentId) {
      setError('Tenant ID not found. Please login again.');
      setLoading(false);
      return;
    }

    try {
      const requestBody = {
        page, limit, tenentId,
        ...(search && { search }),
        ...(status && { status })
      };

      const response = await fetch(`${API_BASE_URL}/orderroute/fetch-orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true'
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

      const result: ApiResponse = await response.json();

      if (result.success) {
        const cleanOrders = result.data.map(order => ({
          ...order,
          id: safeString(order.id),
          name: safeString(order.name),
          customer_name: safeString(order.customer_name),
          username: safeString(order.username),
          totalAmount: safeNumber(order.totalAmount),
          status: safeString(order.status),
          products: Array.isArray(order.products) ? order.products.map(product => ({
            ...product,
            quantity: safeNumber(product.quantity),
            price: safeNumber(product.price)
          })) : []
        }));

        setOrders(cleanOrders);
        setCurrentPage(safeNumber(result.pagination.currentPage));
        setTotalPages(safeNumber(result.pagination.totalPages));
        setTotalOrders(safeNumber(result.pagination.totalOrders));
        setError('');
      } else {
        throw new Error('Failed to fetch orders');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error fetching orders. Please check your connection.');
      setOrders([]);
      setCurrentPage(1);
      setTotalPages(1);
      setTotalOrders(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (currentPage === 1) {
        fetchOrders(1, searchTerm, statusFilter, itemsPerPage);
      } else {
        setCurrentPage(1);
      }
    }, 500);
    return () => clearTimeout(timeoutId);
  }, [searchTerm]);

  useEffect(() => {
    if (currentPage === 1) {
      fetchOrders(1, searchTerm, statusFilter, itemsPerPage);
    } else {
      setCurrentPage(1);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchOrders(currentPage, searchTerm, statusFilter, itemsPerPage);
  }, [currentPage]);

  useEffect(() => {
    fetchOrders(1, '', '', itemsPerPage);
  }, []);

  const handlePrevPage = () => { if (currentPage > 1 && !loading) setCurrentPage(currentPage - 1); };
  const handleNextPage = () => { if (currentPage < totalPages && !loading) setCurrentPage(currentPage + 1); };
  const handlePageClick = (pageNumber: number) => { if (pageNumber !== currentPage && !loading) setCurrentPage(pageNumber); };
  const handleStatusFilterChange = (status: string) => setStatusFilter(status);

  const getStatusBadgeColor = (status: string) => {
    const normalizedStatus = safeString(status).toUpperCase();
    switch (normalizedStatus) {
      case 'COMPLETED': case 'DELIVERED': return 'bg-green-100 text-green-800 border-green-200';
      case 'PENDING': case 'CREATED': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'PROCESSING': case 'PAID': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'SHIPPED': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'CANCELLED': case 'FAILED': return 'bg-red-100 text-red-800 border-red-200';
      case 'HOLDED': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'PRINTED': case 'PACKED': return 'bg-teal-100 text-teal-800 border-teal-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const generatePageNumbers = () => {
    const pageNumbers = [];
    const maxPagesToShow = 5;
    if (totalPages <= maxPagesToShow) {
      for (let i = 1; i <= totalPages; i++) pageNumbers.push(i);
    } else {
      let startPage = Math.max(1, currentPage - Math.floor(maxPagesToShow / 2));
      let endPage = Math.min(totalPages, startPage + maxPagesToShow - 1);
      if (endPage - startPage < maxPagesToShow - 1) startPage = Math.max(1, endPage - maxPagesToShow + 1);
      for (let i = startPage; i <= endPage; i++) pageNumbers.push(i);
    }
    return pageNumbers;
  };

  return (
    <div className="min-h-[100dvh] bg-gray-50 py-4 md:py-8 px-2 sm:px-4 pb-24 md:pb-8 w-full max-w-[100vw] overflow-x-hidden box-border">
      <div className="max-w-7xl mx-auto w-full">

        {/* Header Section */}
        <div className="bg-white rounded-lg shadow-sm border p-3 md:p-6 mb-4 md:mb-6 w-full max-w-full box-border">
          <div className="flex flex-col gap-2 md:gap-3 w-full">

            {/* ── Row 1: Search input + Download button ── */}
            <div className="flex items-center gap-2 w-full">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search orders, names, phone..."
                className="flex-1 min-w-0 px-3 md:px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none text-base sm:text-sm box-border"
              />

              {/* Download button — right side of search bar */}
              <div className="relative flex-shrink-0" ref={downloadMenuRef}>
                <button
                  type="button"
                  onClick={() => setIsDownloadMenuOpen((prev) => !prev)}
                  disabled={loading}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-600 text-white transition-colors hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Download className="w-4 h-4 flex-shrink-0" />
                </button>

                {isDownloadMenuOpen && (
                  <div className="absolute right-0 top-full z-20 mt-2 w-44 rounded-md border border-orange-100 bg-white p-2 shadow-lg">
                    <button
                      onClick={() => {
                        downloadCurrentPageAsExcel();
                        setIsDownloadMenuOpen(false);
                      }}
                      disabled={loading || orders.length === 0}
                      title="Download orders on this page as Excel"
                      className="flex w-full items-center justify-center gap-2 rounded-md bg-orange-600 px-3 py-2 text-sm text-white transition-colors hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Download className="w-4 h-4 flex-shrink-0" />
                      <span>This Page</span>
                    </button>

                    <button
                      onClick={() => {
                        downloadAllOrdersAsExcel();
                        setIsDownloadMenuOpen(false);
                      }}
                      disabled={loading || downloadingExcel || totalOrders === 0}
                      title={`Download all ${totalOrders.toLocaleString()} matching orders as Excel`}
                      className="mt-2 flex w-full items-center justify-center gap-2 rounded-md bg-orange-600 px-3 py-2 text-sm text-white transition-colors hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {downloadingExcel ? (
                        <RefreshCw className="w-4 h-4 animate-spin flex-shrink-0" />
                      ) : (
                        <Download className="w-4 h-4 flex-shrink-0" />
                      )}
                      <span>{downloadingExcel ? 'Preparing...' : `All (${totalOrders.toLocaleString()})`}</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* ── Row 2: Status filter ── */}
            <select
              value={statusFilter}
              onChange={(e) => handleStatusFilterChange(e.target.value)}
              className="w-full px-3 md:px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none bg-white text-base sm:text-sm box-border"
            >
              <option value="">All Statuses</option>
              {statusOptions.map(status => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>

          </div>

          {/* Stats Section */}
          <div className="mt-3 md:mt-4 flex flex-wrap items-center gap-2 md:gap-4 text-xs md:text-sm text-gray-600">
            <span>Total Orders: <strong className="text-gray-900">{totalOrders.toLocaleString()}</strong></span>
            <span>•</span>
            <span>Showing: <strong className="text-gray-900">{orders.length}</strong> orders</span>
            <span>•</span>
            <span>Page: <strong className="text-orange-600">{currentPage}</strong> of <strong className="text-orange-600">{totalPages}</strong></span>
            {statusFilter && (
              <>
                <span>•</span>
                <span>Status: <strong className="text-orange-600">{statusFilter}</strong></span>
              </>
            )}
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-3 md:px-4 py-2 md:py-3 rounded-md mb-4 md:mb-6 text-sm w-full box-border">
            <p className="font-medium">Error:</p>
            <p>{error}</p>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="bg-blue-50 border border-blue-200 text-blue-700 px-3 md:px-4 py-2 md:py-3 rounded-md mb-4 md:mb-6 text-sm w-full box-border">
            <div className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin" />
              <p>Loading orders for page {currentPage}...</p>
            </div>
          </div>
        )}

        {/* Orders Table or Mobile Cards */}
        <div className="bg-white rounded-lg shadow-sm border relative w-full max-w-full box-border">
          {!loading && orders.length === 0 && !error ? (
            <div className="text-center py-8 md:py-12 px-4 w-full">
              <p className="text-gray-500 text-base md:text-lg">No orders found</p>
              <p className="text-gray-400 text-xs md:text-sm mt-2">
                {searchTerm || statusFilter
                  ? 'Try adjusting your search or filter criteria'
                  : 'No orders available at the moment'
                }
              </p>
              {currentPage > 1 && (
                <button
                  onClick={() => setCurrentPage(1)}
                  className="mt-4 px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 transition-colors text-sm"
                >
                  Go to First Page
                </button>
              )}
            </div>
          ) : isMobileView ? (
            // MOBILE VIEW - Card Layout
            <div className="p-2 md:p-4 space-y-3 w-full">
              {orders.map(order => (
                <div key={order.id} className="bg-white rounded-lg shadow border border-gray-200 p-3 relative w-full box-border">

                  {/* ── Card Header: status badge only (top-right) ── */}
                  <div className="flex justify-end mb-2">
                    <div className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wide border ${getStatusBadgeColor(order.status)} whitespace-nowrap`}>
                      {order.status}
                    </div>
                  </div>

                  {/* ── Info Grid ── */}
                  <div className="mb-3 grid grid-cols-2 gap-3 rounded-xl border border-gray-100 bg-gray-50/70 p-3">
                    <div className="min-w-0 space-y-1.5 text-left">
                      <div className="text-xs font-medium text-gray-500">Instagram</div>
                      <div className="flex items-center gap-1 text-sm font-bold text-gray-900">
                        <Instagram className="w-3.5 h-3.5 flex-shrink-0 text-orange-500" />
                        <span className="truncate">{order.name || 'N/A'}</span>
                      </div>
                      <div className="text-xs text-gray-600 truncate">@{order.username || 'N/A'}</div>
                      <div className="text-sm font-bold text-gray-900 truncate">{order.customer_name || order.name}</div>
                      <div className="text-xs text-gray-600 truncate">{order.phoneNumber}</div>
                    </div>
                    <div className="min-w-0 border-l border-gray-200 pl-3 text-right">
                      <div className="space-y-1.5">
                        <div className="text-sm font-bold text-orange-600 truncate">#{order.id}</div>
                        <div className="text-xs text-gray-500">{order.date}</div>
                        <div className="text-xs font-medium text-gray-500">Location</div>
                        <div className="ml-auto inline-flex items-start justify-end gap-1 text-sm text-gray-800">
                          <MapPin className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-orange-500" />
                          <span className="break-words">{getShortAddress(order)}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* ── Products + Amount ── */}
                  <div className="mb-3 grid w-full grid-cols-[minmax(0,1fr)_110px] gap-3">
                    <div className="order-2 min-w-0 rounded border border-gray-100 bg-white p-2.5">
                      <div className="text-xs text-gray-500 mb-0.5">Amount</div>
                      <div className="font-bold text-gray-900 text-sm truncate">₹{formatPrice(order.totalAmount)}</div>
                    </div>

                    <div className="order-1 bg-gray-50 p-2 rounded border border-gray-100 w-full box-border">
                      <div className="text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
                        PRODUCTS ({order.products.reduce((acc, curr) => acc + (curr.quantity || 1), 0)})
                      </div>
                      <div
                    className={`bg-gray-50 p-2 rounded border border-gray-100 w-full box-border
                      ${order.products.length > 2 ? 'max-h-[90px] overflow-y-auto' : ''}
                    `}
                  >
                    <div className="text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
                      PRODUCTS ({order.products.reduce((acc, curr) => acc + (curr.quantity || 1), 0)})
                    </div>

                    {order.products.map((p, i) => (
                      <div
                        key={i}
                        className="flex justify-between items-start text-xs py-1 border-b border-gray-100 last:border-0 gap-2 w-full"
                      >
                        <span className="text-gray-800 flex-1 min-w-0 truncate">
                          {p.product_name || p.sku || 'Unnamed Product'}
                        </span>
                        <span className="text-gray-500 font-medium flex-shrink-0">
                          x{p.quantity || 1}
                        </span>
                      </div>
                    ))}
                  </div>
                      {order.products.length > 3 && (
                        <div className="text-xs text-center text-orange-600 pt-1.5 font-medium border-t border-gray-100 mt-1.5">
                          +{order.products.length - 3} more items
                        </div>
                      )}
                    </div>
                  </div>

                  {/* ── Update Status ── */}
                  <div className="pt-2 border-t border-gray-100 w-full">
                    <div className="text-xs font-semibold text-gray-500 mb-1.5">Update Status</div>
                    <CustomDropdown
                      value={order.status}
                      onChange={(val) => updateOrderStatus(order.id, val)}
                      options={statusOptions}
                      disabled={updatingStatus === order.id}
                      isSmall={true}
                    />
                    {updatingStatus === order.id && (
                      <div className="text-xs text-orange-600 flex items-center gap-1 mt-1.5 font-medium">
                        <RefreshCw className="w-3 h-3 animate-spin" />
                        <span>Updating...</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            // DESKTOP VIEW - Table Layout
            <div className="overflow-x-auto w-full max-w-full">
              <table className="w-full table-auto text-left border-collapse min-w-[900px]">
                <thead className="bg-gradient-to-r from-orange-500 to-orange-600 shadow-md text-white">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">Order Details</th>
                    <th className="px-4 py-3 text-left font-semibold">Date</th>
                    <th className="px-4 py-3 text-left font-semibold">Customer Info</th>
                    <th className="px-4 py-3 text-left font-semibold">Customer Instagram</th>
                    <th className="px-4 py-3 text-left font-semibold">Products</th>
                    <th className="px-4 py-3 text-left font-semibold">Total Amount</th>
                    <th className="px-4 py-3 text-left font-semibold">Status</th>
                    <th className="px-4 py-3 text-left font-semibold">Location</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {orders.map((order, index) => (
                    <tr key={order.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-4 py-4 align-top">
                        <div className="space-y-1">
                          <div className="font-medium text-gray-900">{order.id}</div>
                          {order.billNo && <div className="text-xs text-gray-500">Bill: {order.billNo}</div>}
                          {order.trackingNumber && <div className="text-xs text-gray-500">Tracking: {order.trackingNumber}</div>}
                        </div>
                      </td>
                      <td className="px-4 py-4 align-top">
                        <div className="text-sm text-gray-900">{order.date}</div>
                      </td>
                      <td className="px-4 py-4 align-top">
                        <div className="space-y-1">
                          <div className="font-medium text-gray-900">{order.customer_name || 'N/A'}</div>
                          <div className="text-sm text-gray-600">{order.phoneNumber}</div>
                          {order.paymentStatus && <div className="text-xs text-gray-500">Payment: {order.paymentStatus}</div>}
                          {order.paymentMethod && <div className="text-xs text-gray-500">Method: {order.paymentMethod}</div>}
                        </div>
                      </td>
                      <td className="px-4 py-4 align-top">
                        <div className="space-y-1">
                          <div className="font-medium text-gray-900 flex items-center gap-1">
                            <Instagram className="w-4 h-4 text-orange-500 flex-shrink-0" />
                            {order.name || 'N/A'}
                          </div>
                          <div className="text-sm text-gray-600">@{order.username || 'N/A'}</div>
                        </div>
                      </td>

                      {/* ── Products cell: scrollable when > 2 items ── */}
                      <td className="px-4 py-4 align-top">
                        {order.products && order.products.length > 0 ? (
                          <div
                            className={`space-y-2 pr-1 ${
                              order.products.length > 2
                                ? 'max-h-[120px] overflow-y-auto scrollbar-thin scrollbar-thumb-orange-300 scrollbar-track-gray-100'
                                : ''
                            }`}
                          >
                            {order.products.map((product, idx) => (
                              <div key={idx} className="text-sm">
                                <div className="font-medium text-gray-700 truncate max-w-[200px]">
                                  {typeof product.product_name === 'string'
                                    ? product.product_name
                                    : typeof product.sku === 'string' ? product.sku : 'Unnamed Product'}
                                </div>
                                <div className="text-xs text-gray-500">
                                  Qty: {product.quantity || 1}
                                  <span className="ml-2">₹{formatPrice(product.price)}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-gray-400 text-sm">No products</span>
                        )}
                        {order.products && order.products.length > 2 && (
                          <div className="mt-1 text-xs text-orange-500 font-medium">
                            {order.products.length} items · scroll to see all
                          </div>
                        )}
                      </td>

                      <td className="px-4 py-4 align-top">
                        <div className="font-semibold text-gray-900 whitespace-nowrap">
                          ₹{formatPrice(order.totalAmount) || '0.00'}
                        </div>
                      </td>
                      <td className="px-4 py-4 align-top">
                        <div className="space-y-2">
                          <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium border whitespace-nowrap ${getStatusBadgeColor(order.status)}`}>
                            {order.status}
                          </span>
                          <select
                            value={order.status}
                            onChange={(e) => updateOrderStatus(order.id, e.target.value)}
                            disabled={updatingStatus === order.id}
                            className={`w-full text-xs border border-gray-300 rounded px-2 py-1.5 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none ${
                              updatingStatus === order.id ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                            }`}
                          >
                            {statusOptions.map(status => (
                              <option key={status} value={status}>{status}</option>
                            ))}
                          </select>
                          {updatingStatus === order.id && (
                            <div className="text-xs text-orange-600 font-medium flex items-center gap-1">
                              <RefreshCw className="w-3 h-3 animate-spin" />
                              Updating...
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4 align-top">
                        <div className="space-y-2 max-w-[200px]">
                          <div className="text-sm text-gray-900 break-words">
                            {expandedAddresses.has(order.id) ? formatCompleteAddress(order) : getShortAddress(order)}
                          </div>
                          <button
                            onClick={() => toggleAddressExpansion(order.id)}
                            className="text-xs text-orange-600 hover:text-orange-800 font-medium transition-colors"
                          >
                            {expandedAddresses.has(order.id) ? 'Show Less' : 'Show Full Address'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && !loading && (
            <div className="bg-gray-50 px-3 md:px-6 py-3 md:py-4 border-t border-gray-200 sm:rounded-b-lg w-full box-border">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 md:gap-4 w-full">
                <div className="text-xs md:text-sm text-gray-700 text-center sm:text-left">
                  Showing {Math.min((currentPage - 1) * itemsPerPage + 1, totalOrders)} to{' '}
                  {Math.min(currentPage * itemsPerPage, totalOrders)} of{' '}
                  {totalOrders.toLocaleString()} results
                </div>
                <div className="flex items-center justify-center gap-1.5 md:gap-2 flex-wrap w-full sm:w-auto">
                  <button onClick={() => setCurrentPage(1)} disabled={currentPage === 1 || loading}
                    className="px-2 md:px-3 py-1.5 md:py-2 text-xs md:text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                    First
                  </button>
                  <button onClick={handlePrevPage} disabled={currentPage === 1 || loading}
                    className="flex items-center gap-1 px-2 md:px-3 py-1.5 md:py-2 text-xs md:text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                    <ChevronLeft className="w-3 md:w-4 h-3 md:h-4" />
                    <span className="hidden sm:inline">Previous</span>
                  </button>
                  <div className="flex items-center gap-1">
                    {generatePageNumbers().map(pageNum => (
                      <button key={pageNum} onClick={() => handlePageClick(pageNum)} disabled={loading}
                        className={`px-2.5 md:px-3 py-1.5 md:py-2 text-xs md:text-sm font-medium rounded-md transition-colors ${
                          pageNum === currentPage
                            ? 'bg-orange-600 text-white'
                            : 'text-gray-500 bg-white border border-gray-300 hover:bg-gray-50'
                        } disabled:opacity-50 disabled:cursor-not-allowed`}>
                        {pageNum}
                      </button>
                    ))}
                  </div>
                  <button onClick={handleNextPage} disabled={currentPage === totalPages || loading}
                    className="flex items-center gap-1 px-2 md:px-3 py-1.5 md:py-2 text-xs md:text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                    <span className="hidden sm:inline">Next</span>
                    <ChevronRight className="w-3 md:w-4 h-3 md:h-4" />
                  </button>
                  <button onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages || loading}
                    className="px-2 md:px-3 py-1.5 md:py-2 text-xs md:text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                    Last
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {process.env.NODE_ENV === 'development' && (
          <div className="mt-4 md:mt-6 bg-gray-100 p-3 md:p-4 rounded-lg text-xs md:text-sm w-full box-border">
            <h3 className="font-semibold text-gray-700 mb-2">Debug Info:</h3>
            <div className="text-gray-600 space-y-1">
              <p>API URL: {API_BASE_URL}</p>
              <p>Current Page: {currentPage}</p>
              <p>Total Pages: {totalPages}</p>
              <p>Total Orders: {totalOrders}</p>
              <p>Orders on This Page: {orders.length}</p>
              <p>Status Filter: {statusFilter || 'None'}</p>
              <p>Search Term: {searchTerm || 'None'}</p>
              <p>Loading: {loading ? 'Yes' : 'No'}</p>
              <p>Items Per Page: {itemsPerPage}</p>
              <p>Expected Skip: {(currentPage - 1) * itemsPerPage}</p>
              <p>Mobile View: {isMobileView ? 'Yes' : 'No'}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default OrderManagement;
