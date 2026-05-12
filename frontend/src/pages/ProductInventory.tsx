import { useState, useEffect, useRef } from 'react';
import { Search, Edit, Trash2, Plus, ArrowUpDown, AlertCircle, Package, AlertTriangle, XCircle, Upload } from 'lucide-react';
import axios from 'axios';
import Swal from 'sweetalert2';

interface ProductInventory {
  id: string;
  productName: string;
  sku: string;
  unitSize: string;
  price: string;
  quantityInStock: number;
  threshold: number;
  lastRestocked: string;
  status: 'In Stock' | 'Low Stock' | 'Out of Stock';
  imageUrl: string;
  productDescription: string;
}

const ORANGE = '#E8470A';
const ORANGE_GRADIENT = 'linear-gradient(135deg, #C93500 0%, #F07020 100%)';
const ORANGE_SHADOW = 'rgba(232,71,10,0.35)';

const mobileStyles = `
  * { -webkit-tap-highlight-color: transparent; box-sizing: border-box; }
  html { -webkit-text-size-adjust: 100%; text-size-adjust: 100%; }
  body { overscroll-behavior-y: contain; }
  input, textarea, select {
    font-size: 16px !important;
    -webkit-appearance: none;
    appearance: none;
    border-radius: 12px;
  }
  button { -webkit-appearance: none; appearance: none; touch-action: manipulation; }
  .scroll-smooth { -webkit-overflow-scrolling: touch; scroll-behavior: smooth; }
  .swipe-card-inner {
    transition: transform 0.25s cubic-bezier(0.25, 0.46, 0.45, 0.94);
    will-change: transform;
  }
`;

const SWIPE_REVEAL_WIDTH = 152;

const ProductInventory: React.FC = () => {
  const [products, setProducts] = useState<ProductInventory[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<ProductInventory[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<keyof ProductInventory | ''>('');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [loading, setLoading] = useState(true);
  const [editingProduct, setEditingProduct] = useState<ProductInventory | null>(null);
  const [isMobileView, setIsMobileView] = useState(
    typeof window !== 'undefined' ? window.innerWidth < 768 : true
  );
  const [activeFilter, setActiveFilter] = useState<'all' | 'low' | 'out'>('all');
  const [openSwipeId, setOpenSwipeId] = useState<string | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef<number>(0);
  const touchStartY = useRef<number>(0);
  const isSwiping = useRef<boolean>(false);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      const existing = document.getElementById('mobile-inv-styles');
      if (!existing) {
        const tag = document.createElement('style');
        tag.id = 'mobile-inv-styles';
        tag.textContent = mobileStyles;
        document.head.appendChild(tag);
      }
    }
  }, []);

  useEffect(() => {
    fetchProducts();
    const handleResize = () => setIsMobileView(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (editingProduct) {
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
    } else {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
    }
    return () => {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
    };
  }, [editingProduct]);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const tenentId = localStorage.getItem('tenentid');
      const response = await axios.get(
        'https://snaking-outhouse-oppose.ngrok-free.dev/api/productinventoryroute/inventory',
        { params: { tenentId } }
      );
      if (response.data && response.data.products) {
        const transformed = response.data.products.map((item: any) => ({
          id: item._id || item.id,
          productName: item.productName,
          sku: item.sku || '',
          unitSize: item.units?.[0]?.unit || '',
          price: item.units?.[0]?.price || '',
          quantityInStock: item.quantityInStock || 0,
          threshold: item.threshold || 5,
          lastRestocked: item.lastRestocked || new Date().toISOString().split('T')[0],
          status: calculateStatus(item.quantityInStock || 0, item.threshold || 5),
          imageUrl: item.productPhotoUrl || '',
          productDescription: item.productDescription || '',
        }));
        setProducts(transformed);
        setFilteredProducts(transformed);
      }
    } catch {
      Swal.fire({ icon: 'error', title: 'Failed to Load Inventory', text: 'Could not fetch products from the server.' });
      setProducts([]); setFilteredProducts([]);
    } finally {
      setLoading(false);
    }
  };

  const calculateStatus = (qty: number, threshold: number): ProductInventory['status'] => {
    if (qty <= 0) return 'Out of Stock';
    if (qty <= threshold) return 'Low Stock';
    return 'In Stock';
  };

  const applyFilters = (term: string, filter: 'all' | 'low' | 'out', source = products) => {
    let f = source;
    if (term) f = f.filter(p => p.productName.toLowerCase().includes(term) || p.sku.toLowerCase().includes(term));
    if (filter === 'low') f = f.filter(p => p.status === 'Low Stock');
    if (filter === 'out') f = f.filter(p => p.status === 'Out of Stock');
    setFilteredProducts(f);
  };

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const term = e.target.value.toLowerCase();
    setSearchTerm(term);
    applyFilters(term, activeFilter);
  };

  const handleFilterClick = (filter: 'all' | 'low' | 'out') => {
    setActiveFilter(filter);
    setOpenSwipeId(null);
    applyFilters(searchTerm, filter);
  };

  const handleSort = (field: keyof ProductInventory) => {
    const dir = sortField === field && sortDirection === 'asc' ? 'desc' : 'asc';
    setSortField(field); setSortDirection(dir);
    const sorted = [...filteredProducts].sort((a, b) => {
      if (field === 'quantityInStock' || field === 'threshold')
        return dir === 'asc' ? Number(a[field]) - Number(b[field]) : Number(b[field]) - Number(a[field]);
      const va = String(a[field]).toLowerCase(), vb = String(b[field]).toLowerCase();
      return dir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
    });
    setFilteredProducts(sorted);
  };

  const handleEdit = (product: ProductInventory) => {
    setOpenSwipeId(null);
    setEditingProduct({ ...product });
  };

  const handleUpdateProduct = (field: keyof ProductInventory, value: any) => {
    if (editingProduct) setEditingProduct({ ...editingProduct, [field]: value });
  };

  const saveEditedProduct = async () => {
    if (!editingProduct) return;
    try {
      const tenentId = localStorage.getItem('tenentid');
      const status = calculateStatus(editingProduct.quantityInStock, editingProduct.threshold);
      await axios.put(`https://snaking-outhouse-oppose.ngrok-free.dev/api/productinventoryroute/inventory/${editingProduct.id}`, {
        id: editingProduct.id, tenentId,
        productName: editingProduct.productName, sku: editingProduct.sku,
        units: [{ unit: editingProduct.unitSize, price: editingProduct.price }],
        quantityInStock: editingProduct.quantityInStock, threshold: editingProduct.threshold,
        lastRestocked: editingProduct.lastRestocked,
        productDescription: editingProduct.productDescription, status,
      });
      const updated = products.map(p => p.id === editingProduct.id ? { ...p, ...editingProduct, status } : p);
      setProducts(updated); applyFilters(searchTerm, activeFilter, updated);
      setEditingProduct(null);
      Swal.fire({ icon: 'success', title: 'Success', text: 'Product updated successfully!' });
    } catch {
      Swal.fire({ icon: 'error', title: 'Update Failed', text: 'Failed to update product. Please try again.' });
    }
  };

  const handleDelete = async (id: string) => {
    setOpenSwipeId(null);
    Swal.fire({
      title: 'Are you sure?', text: "You won't be able to revert this!", icon: 'warning',
      showCancelButton: true, confirmButtonColor: ORANGE, cancelButtonColor: '#6b7280',
      confirmButtonText: 'Yes, delete it!',
    }).then(async result => {
      if (result.isConfirmed) {
        try {
          const tenentId = localStorage.getItem('tenentid');
          await axios.delete(`https://snaking-outhouse-oppose.ngrok-free.dev/api/productinventoryroute/inventory/${id}`, { params: { tenentId } });
          const updated = products.filter(p => p.id !== id);
          setProducts(updated); applyFilters(searchTerm, activeFilter, updated);
          Swal.fire('Deleted!', 'Product removed from inventory.', 'success');
        } catch {
          Swal.fire({ icon: 'error', title: 'Delete Failed', text: 'Failed to delete product.' });
        }
      }
    });
  };

  const handleRestock = async (id: string) => {
    Swal.fire({
      title: 'Restock Product', input: 'number',
      inputLabel: 'Enter quantity to add', inputPlaceholder: 'Quantity',
      showCancelButton: true,
      inputValidator: (value) => {
        if (!value || parseInt(value) <= 0) return 'Please enter a valid quantity';
        return null;
      }
    }).then(async (result) => {
      if (result.isConfirmed && result.value) {
        try {
          const quantity = parseInt(result.value);
          const tenentId = localStorage.getItem('tenentid');
          const product = products.find(p => p.id === id);
          if (!product) return;
          const newQuantity = product.quantityInStock + quantity;
          const status = calculateStatus(newQuantity, product.threshold);
          await axios.post(`https://snaking-outhouse-oppose.ngrok-free.dev/api/productinventoryroute/inventory/${id}/restock`, {
            tenentId, addQuantity: quantity, newTotal: newQuantity,
            lastRestocked: new Date().toISOString().split('T')[0]
          });
          const updated = products.map(p => p.id === id
            ? { ...p, quantityInStock: newQuantity, lastRestocked: new Date().toISOString().split('T')[0], status }
            : p
          );
          setProducts(updated);
          applyFilters(searchTerm, activeFilter, updated);
          Swal.fire('Restocked!', `Added ${quantity} items to inventory.`, 'success');
        } catch {
          Swal.fire({ icon: 'error', title: 'Restock Failed', text: 'Failed to restock product. Please try again.' });
        }
      }
    });
  };

  const allCount = products.length;
  const lowCount = products.filter(p => p.status === 'Low Stock').length;
  const outCount = products.filter(p => p.status === 'Out of Stock').length;

  const handleAddNewProduct = () => { window.location.href = '/product-details-template'; };

  /* ── SWIPE HANDLERS ── */
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    isSwiping.current = false;
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    const dx = e.touches[0].clientX - touchStartX.current;
    const dy = e.touches[0].clientY - touchStartY.current;
    if (!isSwiping.current && (Math.abs(dx) > 5 || Math.abs(dy) > 5))
      isSwiping.current = Math.abs(dx) > Math.abs(dy);
    if (isSwiping.current) e.preventDefault();
  };
  const handleTouchEnd = (e: React.TouchEvent, id: string) => {
    const dx = touchStartX.current - e.changedTouches[0].clientX;
    const dy = Math.abs(e.changedTouches[0].clientY - touchStartY.current);
    if (dy > 40) return;
    if (dx > 40) setOpenSwipeId(id);
    else if (dx < -20) { if (openSwipeId === id) setOpenSwipeId(null); }
    else if (Math.abs(dx) < 10 && openSwipeId && openSwipeId !== id) setOpenSwipeId(null);
  };

  /* ── MOBILE CARD ── */
  const renderMobileProductCard = (product: ProductInventory) => {
    const isRevealed = openSwipeId === product.id;
    const isLow = product.status === 'Low Stock';
    const isOut = product.status === 'Out of Stock';
    return (
      <div
        key={product.id}
        style={{ position: 'relative', marginBottom: 10, borderRadius: 18, overflow: 'hidden', background: 'white', border: '1px solid #f0f0f0', boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={e => handleTouchEnd(e, product.id)}
      >
        {/* Action Buttons */}
        <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: SWIPE_REVEAL_WIDTH, display: 'flex' }}>
          <button onClick={() => handleEdit(product)} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 5, background: ORANGE_GRADIENT, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 800, color: 'white', letterSpacing: 0.3 }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(255,255,255,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Edit size={16} color="white" />
            </div>
            Edit
          </button>
          <button onClick={() => handleDelete(product.id)} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 5, background: 'white', border: 'none', borderLeft: '1px solid #f0f0f0', cursor: 'pointer', fontSize: 11, fontWeight: 800, color: '#374151', letterSpacing: 0.3 }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Trash2 size={16} color="#374151" />
            </div>
            Delete
          </button>
        </div>

        {/* Card Face — FIX 1: removed ChevronDown icon */}
        <div
          className="swipe-card-inner"
          style={{ position: 'relative', zIndex: 1, transform: isRevealed ? `translateX(-${SWIPE_REVEAL_WIDTH}px)` : 'translateX(0)', background: 'white', borderRadius: 16, display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', minHeight: 72, userSelect: 'none', WebkitUserSelect: 'none' }}
          onClick={() => { if (openSwipeId === product.id) setOpenSwipeId(null); else setOpenSwipeId(product.id); }}
        >
          <div style={{ width: 50, height: 50, minWidth: 50, borderRadius: 12, overflow: 'hidden', background: '#f9f9f9', border: '1px solid #ebebeb', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            {product.imageUrl
              ? <img src={product.imageUrl} alt={product.productName} style={{ width: 50, height: 50, objectFit: 'cover' }} />
              : <Upload size={16} color="#aaa" />}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 14, fontWeight: 700, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0, lineHeight: 1.3 }}>{product.productName}</p>
            <p style={{ fontSize: 12, color: '#9ca3af', margin: '3px 0 0', lineHeight: 1 }}>ID: {product.sku}</p>
          </div>
          {/* FIX 1: No ChevronDown — just the status badge + qty */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2, flexShrink: 0 }}>
            {(isLow || isOut) && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 99, background: isOut ? '#fff1f2' : '#fff7ed', color: isOut ? '#e11d48' : '#ea580c', border: `1px solid ${isOut ? '#fecaca' : '#fed7aa'}` }}>
                {isLow && <AlertTriangle size={8} />}{isOut ? 'Out' : 'Low'}
              </span>
            )}
            <span style={{ fontSize: 14, fontWeight: 700, color: '#374151' }}>Qty: {product.quantityInStock}</span>
          </div>
        </div>
      </div>
    );
  };

  /* ── DESKTOP styles ── */
  const desktopStyles = {
    wrapper: { background: '#fff', borderRadius: '16px', boxShadow: '0 4px 24px rgba(0,0,0,0.07)', overflow: 'hidden', border: '1px solid #f0f0f0' } as React.CSSProperties,
    table: { width: '100%', borderCollapse: 'collapse' as const } as React.CSSProperties,
    th: { padding: '14px 18px', textAlign: 'left' as const, fontSize: '11px', fontWeight: '700', color: 'rgba(255,255,255,0.92)', textTransform: 'uppercase' as const, letterSpacing: '0.8px', whiteSpace: 'nowrap' as const } as React.CSSProperties,
    thBtn: { display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.92)', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase' as const, letterSpacing: '0.8px', padding: 0 } as React.CSSProperties,
    row: { borderBottom: '1px solid #f5f5f5', transition: 'background 0.15s' } as React.CSSProperties,
    td: { padding: '13px 18px', fontSize: '13.5px', color: '#374151', verticalAlign: 'middle' as const } as React.CSSProperties,
    avatarWrap: { display: 'flex', alignItems: 'center', gap: '11px' } as React.CSSProperties,
    avatar: { width: '38px', height: '38px', borderRadius: '50%', background: 'linear-gradient(135deg, #fff3e0, #ffe0b2)', border: '2px solid #ffcc80', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' } as React.CSSProperties,
    avatarInitials: { fontSize: '12px', fontWeight: '700', color: '#e65100' } as React.CSSProperties,
    productName: { fontSize: '13.5px', fontWeight: '600', color: '#111827' } as React.CSSProperties,
    skuText: { fontSize: '12px', color: '#9ca3af', fontFamily: 'monospace', background: '#f9fafb', padding: '2px 7px', borderRadius: '5px', border: '1px solid #e5e7eb' } as React.CSSProperties,
    quantityBadge: (qty: number, threshold: number) => ({ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: '36px', padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '700', background: qty <= 0 ? '#fee2e2' : qty <= threshold ? '#fef3c7' : '#f0fdf4', color: qty <= 0 ? '#dc2626' : qty <= threshold ? '#d97706' : '#16a34a', border: `1px solid ${qty <= 0 ? '#fca5a5' : qty <= threshold ? '#fde68a' : '#bbf7d0'}` } as React.CSSProperties),
    actionBtn: { padding: '6px', borderRadius: '8px', border: 'none', cursor: 'pointer', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s', color: '#6b7280' } as React.CSSProperties,
    restockBtn: { padding: '5px 14px', borderRadius: '20px', border: '1.5px solid #fed7aa', background: 'linear-gradient(135deg, #fff7ed, #ffedd5)', color: '#c2410c', fontSize: '12px', fontWeight: '600', cursor: 'pointer', transition: 'all 0.15s', whiteSpace: 'nowrap' as const } as React.CSSProperties,
  };

  const getStatusBadge = (status: string) => {
    const configs: Record<string, { bg: string; color: string; border: string; dot: string }> = {
      'In Stock': { bg: 'linear-gradient(135deg,#d1fae5,#a7f3d0)', color: '#065f46', border: '#6ee7b7', dot: '#10b981' },
      'Low Stock': { bg: 'linear-gradient(135deg,#fef3c7,#fde68a)', color: '#92400e', border: '#fbbf24', dot: '#f59e0b' },
      'Out of Stock': { bg: 'linear-gradient(135deg,#fee2e2,#fecaca)', color: '#991b1b', border: '#f87171', dot: '#ef4444' },
    };
    const c = configs[status]; if (!c) return null;
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: c.bg, color: c.color, border: `1px solid ${c.border}`, letterSpacing: 0.3 }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: c.dot, display: 'inline-block' }} />{status}
      </span>
    );
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100dvh', background: '#f9fafb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ background: 'white', padding: 32, borderRadius: 20, textAlign: 'center', boxShadow: '0 2px 12px rgba(0,0,0,0.08)' }}>
          <div style={{ width: 40, height: 40, border: `2.5px solid ${ORANGE}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite', margin: '0 auto 12px' }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          <p style={{ fontSize: 13, color: '#6b7280', fontWeight: 500 }}>Loading inventory...</p>
        </div>
      </div>
    );
  }

  /* ══════════════════════════
     MOBILE LAYOUT
     FIX 2: Order = Header → Stock Cards → Search+Add → Products
  ══════════════════════════ */
  if (isMobileView) {
    return (
      <div style={{ minHeight: '100dvh', background: '#f3f4f6' }} onClick={() => { if (openSwipeId) setOpenSwipeId(null); }}>
        <div className="scroll-smooth" style={{ paddingTop: `calc(env(safe-area-inset-top, 0px) + 16px)`, paddingBottom: `calc(env(safe-area-inset-bottom, 0px) + 90px)`, paddingLeft: 16, paddingRight: 16, maxWidth: 768, margin: '0 auto' }} onClick={e => e.stopPropagation()}>

          {/* Header */}

          {/* FIX 2: Stock Summary Cards FIRST */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 14 }}>
            {([
              { key: 'all', label: 'ALL STOCK', count: allCount, icon: Package },
              { key: 'low', label: 'LOW STOCK', count: lowCount, icon: AlertTriangle },
              { key: 'out', label: 'OUT STOCK', count: outCount, icon: XCircle },
            ] as const).map(({ key, label, count, icon: Icon }) => {
              const isActive = activeFilter === key;
              return (
                <button key={key} onClick={() => handleFilterClick(key)}
                  style={{ background: isActive ? ORANGE_GRADIENT : 'white', border: isActive ? 'none' : '1px solid #f0f0f0', borderRadius: 18, padding: '14px 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, cursor: 'pointer', boxShadow: isActive ? `0 4px 12px ${ORANGE_SHADOW}` : '0 1px 4px rgba(0,0,0,0.06)', transition: 'all 0.2s' }}>
                  <div style={{ width: 34, height: 34, borderRadius: 10, background: isActive ? 'rgba(255,255,255,0.22)' : '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon size={16} color={isActive ? 'white' : ORANGE} />
                  </div>
                  <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: 0.5, textTransform: 'uppercase', textAlign: 'center', lineHeight: 1.2, color: isActive ? 'rgba(255,255,255,0.9)' : '#9ca3af' }}>{label}</span>
                  <span style={{ fontSize: 22, fontWeight: 800, lineHeight: 1, color: isActive ? 'white' : '#111827' }}>{count}</span>
                </button>
              );
            })}
          </div>

          {/* FIX 2: Search + Add SECOND */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center' }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', pointerEvents: 'none' }} />
              <input type="search" placeholder="Search by name or SKU..." value={searchTerm} onChange={handleSearch}
                style={{ width: '100%', paddingLeft: 36, paddingRight: 14, paddingTop: 11, paddingBottom: 11, background: 'white', border: '1.5px solid #e5e7eb', borderRadius: 14, fontSize: 14, color: '#111827', outline: 'none', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', WebkitAppearance: 'none' }} />
            </div>
            <button onClick={handleAddNewProduct} style={{ width: 44, height: 44, minWidth: 44, background: ORANGE_GRADIENT, border: 'none', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: `0 2px 8px ${ORANGE_SHADOW}`, flexShrink: 0 }}>
              <Plus size={20} color="white" />
            </button>
          </div>

          {/* Product List THIRD */}
          {filteredProducts.length === 0 ? (
            <div style={{ background: 'white', borderRadius: 20, padding: '48px 24px', textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
              <AlertCircle size={44} style={{ color: '#e5e7eb', margin: '0 auto 12px' }} />
              <p style={{ fontSize: 15, fontWeight: 700, color: '#6b7280', margin: 0 }}>No products found</p>
              <p style={{ fontSize: 13, color: '#9ca3af', marginTop: 4 }}>Try a different search or add new products.</p>
            </div>
          ) : (
            <div>{filteredProducts.map(renderMobileProductCard)}</div>
          )}
        </div>

        {/* Mobile Edit Modal — bottom sheet */}
        {editingProduct && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 999, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)', display: 'flex', alignItems: 'flex-end' }}
            onClick={e => { if (e.target === e.currentTarget) setEditingProduct(null); }}>
            <div ref={modalRef} style={{ background: 'white', borderRadius: '24px 24px 0 0', width: '100%', maxHeight: '78dvh', overflowY: 'auto', WebkitOverflowScrolling: 'touch', paddingBottom: `calc(env(safe-area-inset-bottom, 0px) + 80px)`, boxShadow: '0 -4px 30px rgba(0,0,0,0.15)' }}>
              <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 10, paddingBottom: 2 }}>
                <div style={{ width: 36, height: 4, borderRadius: 99, background: '#e5e7eb' }} />
              </div>
              <div style={{ padding: '10px 16px 0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                  <div style={{ width: 32, height: 32, background: '#fff3e8', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Edit size={14} color={ORANGE} />
                  </div>
                  <h2 style={{ fontSize: 16, fontWeight: 800, color: '#111827', margin: 0 }}>Edit Product</h2>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 }}>Product Name</label>
                    <input type="text" value={editingProduct.productName} onChange={e => handleUpdateProduct('productName', e.target.value)} style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #e5e7eb', borderRadius: 10, fontSize: 14, color: '#111827', outline: 'none', background: 'white' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 }}>Description</label>
                    <textarea value={editingProduct.productDescription} onChange={e => handleUpdateProduct('productDescription', e.target.value)} rows={2} placeholder="Enter product description..." style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #e5e7eb', borderRadius: 10, fontSize: 14, color: '#111827', outline: 'none', background: 'white', resize: 'none' }} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    {[{ label: 'SKU', field: 'sku' }, { label: 'Unit Size', field: 'unitSize' }].map(({ label, field }) => (
                      <div key={field}>
                        <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 }}>{label}</label>
                        <input type="text" value={(editingProduct as any)[field]} onChange={e => handleUpdateProduct(field as any, e.target.value)} style={{ width: '100%', padding: '10px 10px', border: '1.5px solid #e5e7eb', borderRadius: 10, fontSize: 14, color: '#111827', outline: 'none', background: 'white' }} />
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 }}>Price</label>
                      <input type="text" value={editingProduct.price} onChange={e => handleUpdateProduct('price', e.target.value)} style={{ width: '100%', padding: '10px 10px', border: '1.5px solid #e5e7eb', borderRadius: 10, fontSize: 14, color: '#111827', outline: 'none', background: 'white' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 }}>In Stock</label>
                      <input type="number" value={editingProduct.quantityInStock} min={0} onChange={e => handleUpdateProduct('quantityInStock', parseInt(e.target.value) || 0)} style={{ width: '100%', padding: '10px 10px', border: '1.5px solid #e5e7eb', borderRadius: 10, fontSize: 14, color: '#111827', outline: 'none', background: 'white' }} />
                    </div>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 }}>Low Stock Threshold</label>
                    <input type="number" value={editingProduct.threshold} min={0} onChange={e => handleUpdateProduct('threshold', parseInt(e.target.value) || 0)} style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #e5e7eb', borderRadius: 10, fontSize: 14, color: '#111827', outline: 'none', background: 'white' }} />
                  </div>
                </div>
                <div style={{ position: 'sticky', bottom: 0, background: 'white', paddingTop: 12, paddingBottom: 12, marginTop: 14, borderTop: '1px solid #f3f4f6', display: 'flex', gap: 10 }}>
                  <button onClick={() => setEditingProduct(null)} style={{ flex: 1, padding: '13px 0', border: '1.5px solid #e5e7eb', borderRadius: 14, fontSize: 14, fontWeight: 700, color: '#6b7280', background: 'white', cursor: 'pointer', minHeight: 46 }}>Cancel</button>
                  <button onClick={saveEditedProduct} style={{ flex: 1, padding: '13px 0', border: 'none', borderRadius: 14, fontSize: 14, fontWeight: 800, color: 'white', background: ORANGE_GRADIENT, cursor: 'pointer', boxShadow: `0 3px 10px ${ORANGE_SHADOW}`, minHeight: 46 }}>Save Changes</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  /* ══════════════════════════
     DESKTOP LAYOUT
  ══════════════════════════ */
  return (
    <div className="min-h-screen bg-gray-50 relative">
      <div className="py-12 px-4 sm:px-6 pt-16">
        <div className="max-w-7xl mx-auto">

          {/* Header */}
          <div className="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <h1 className="text-3xl font-bold text-slate-900">Product Inventory</h1>
            <div className="flex w-full sm:w-auto items-center gap-4">
              <div className="relative flex-grow">
                <input type="text" placeholder="Search products..." value={searchTerm} onChange={handleSearch}
                  className="pl-10 pr-4 py-1.5 bg-white text-black border-2 border-orange-200 rounded-lg font-semibold placeholder-gray-500 focus:outline-none focus:bg-orange-100 hover:bg-orange-100 transition-all duration-300 text-sm md:text-base w-full" />
                <Search className="absolute left-3 top-2.5 text-gray-500" size={16} />
              </div>
              <button onClick={handleAddNewProduct} className="flex items-center gap-2 px-3 py-1.5 bg-white text-black border-2 border-orange-200 rounded-lg font-semibold hover:bg-orange-100 transition-all duration-300 text-sm md:text-base">
                <Plus size={16} /><span className="hidden sm:inline">Add Product</span>
              </button>
            </div>
          </div>

          {/* Empty state */}
          {filteredProducts.length === 0 ? (
            <div className="bg-white p-8 rounded-xl text-center shadow-lg">
              <AlertCircle className="mx-auto text-slate-600 mb-4" size={48} />
              <h2 className="text-2xl font-bold text-slate-900 mb-2">No products found</h2>
              <p className="text-slate-700">Try adjusting your search or add new products to your inventory.</p>
            </div>
          ) : (
            <div style={desktopStyles.wrapper}>
              <div style={{ overflowX: 'auto' }}>
                <table style={desktopStyles.table}>
                  <thead style={{ background: ORANGE_GRADIENT }}>
                    <tr>
                      {[
                        { label: 'Product', field: 'productName' }, { label: 'SKU', field: 'sku' },
                        { label: 'Unit', field: 'unitSize' }, { label: 'Price', field: 'price' },
                        { label: 'In Stock', field: 'quantityInStock' }, { label: 'Status', field: 'status' },
                      ].map(col => (
                        <th key={col.field} style={desktopStyles.th}>
                          <button style={desktopStyles.thBtn} onClick={() => handleSort(col.field as keyof ProductInventory)}>
                            {col.label}<ArrowUpDown size={12} style={{ opacity: sortField === col.field ? 1 : 0.45 }} />
                          </button>
                        </th>
                      ))}
                      <th style={desktopStyles.th}>Last Restocked</th>
                      <th style={{ ...desktopStyles.th, textAlign: 'right' as const }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProducts.map((product, idx) => (
                      <tr key={product.id} style={{ ...desktopStyles.row, background: idx % 2 === 0 ? '#ffffff' : '#fafafa' }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#fff8f0')}
                        onMouseLeave={e => (e.currentTarget.style.background = idx % 2 === 0 ? '#ffffff' : '#fafafa')}>
                        <td style={desktopStyles.td}>
                          <div style={desktopStyles.avatarWrap}>
                            <div style={desktopStyles.avatar}>
                              {product.imageUrl
                                ? <img src={product.imageUrl} alt={product.productName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                : <span style={desktopStyles.avatarInitials}>{product.productName.substring(0, 2).toUpperCase()}</span>}
                            </div>
                            <span style={desktopStyles.productName}>{product.productName}</span>
                          </div>
                        </td>
                        <td style={desktopStyles.td}><span style={desktopStyles.skuText}>{product.sku}</span></td>
                        <td style={{ ...desktopStyles.td, color: '#6b7280' }}>{product.unitSize}</td>
                        <td style={{ ...desktopStyles.td, fontWeight: '600', color: '#111827' }}>{product.price}</td>
                        <td style={desktopStyles.td}><span style={desktopStyles.quantityBadge(product.quantityInStock, product.threshold)}>{product.quantityInStock}</span></td>
                        <td style={desktopStyles.td}>{getStatusBadge(product.status)}</td>
                        <td style={{ ...desktopStyles.td, color: '#9ca3af', fontSize: '12.5px' }}>{product.lastRestocked}</td>
                        <td style={{ ...desktopStyles.td, textAlign: 'right' as const }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                            <button style={desktopStyles.actionBtn} onClick={() => handleEdit(product)}
                              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#fff7ed'; (e.currentTarget as HTMLButtonElement).style.color = '#ea580c'; }}
                              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; (e.currentTarget as HTMLButtonElement).style.color = '#6b7280'; }}
                              title="Edit"><Edit size={15} /></button>
                            <button style={desktopStyles.actionBtn} onClick={() => handleDelete(product.id)}
                              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#fef2f2'; (e.currentTarget as HTMLButtonElement).style.color = '#dc2626'; }}
                              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; (e.currentTarget as HTMLButtonElement).style.color = '#6b7280'; }}
                              title="Delete"><Trash2 size={15} /></button>
                            <button style={desktopStyles.restockBtn} onClick={() => handleRestock(product.id)}
                              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'linear-gradient(135deg,#ffedd5,#fed7aa)'; (e.currentTarget as HTMLButtonElement).style.borderColor = '#fb923c'; }}
                              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'linear-gradient(135deg,#fff7ed,#ffedd5)'; (e.currentTarget as HTMLButtonElement).style.borderColor = '#fed7aa'; }}>
                              + Restock
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {/* Footer */}
              <div style={{ padding: '11px 20px', background: '#fafafa', borderTop: '1px solid #f0f0f0', fontSize: '12px', color: '#9ca3af', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Showing <strong style={{ color: '#374151' }}>{filteredProducts.length}</strong> product{filteredProducts.length !== 1 ? 's' : ''}</span>
                {searchTerm && <span>Results for "<strong style={{ color: '#ea580c' }}>{searchTerm}</strong>"</span>}
              </div>
            </div>
          )}

          {/* Desktop Edit Modal */}
          {editingProduct && (
            <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
              <div className="bg-white p-6 rounded-xl max-w-md w-full shadow-xl border-t-4 border-orange-500 max-h-[90vh] overflow-y-auto">
                <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
                  <Edit size={20} className="text-orange-500" /> Edit Product
                </h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-slate-700 text-sm font-medium mb-1">Product Name</label>
                    <input type="text" value={editingProduct.productName} onChange={e => handleUpdateProduct('productName', e.target.value)} className="w-full px-3 py-2 border border-orange-200 rounded bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-400" />
                  </div>
                  <div>
                    <label className="block text-slate-700 text-sm font-medium mb-1">Product Description</label>
                    <textarea value={editingProduct.productDescription} onChange={e => handleUpdateProduct('productDescription', e.target.value)} rows={3} className="w-full px-3 py-2 border border-orange-200 rounded bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-400 resize-vertical" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-slate-700 text-sm font-medium mb-1">SKU</label>
                      <input type="text" value={editingProduct.sku} onChange={e => handleUpdateProduct('sku', e.target.value)} className="w-full px-3 py-2 border border-orange-200 rounded bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-400" />
                    </div>
                    <div>
                      <label className="block text-slate-700 text-sm font-medium mb-1">Unit Size</label>
                      <input type="text" value={editingProduct.unitSize} onChange={e => handleUpdateProduct('unitSize', e.target.value)} className="w-full px-3 py-2 border border-orange-200 rounded bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-400" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-slate-700 text-sm font-medium mb-1">Price</label>
                      <input type="text" value={editingProduct.price} onChange={e => handleUpdateProduct('price', e.target.value)} className="w-full px-3 py-2 border border-orange-200 rounded bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-400" />
                    </div>
                    <div>
                      <label className="block text-slate-700 text-sm font-medium mb-1">In Stock</label>
                      <input type="number" value={editingProduct.quantityInStock} min={0} onChange={e => handleUpdateProduct('quantityInStock', parseInt(e.target.value) || 0)} className="w-full px-3 py-2 border border-orange-200 rounded bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-400" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-slate-700 text-sm font-medium mb-1">Low Stock Threshold</label>
                    <input type="number" value={editingProduct.threshold} min={0} onChange={e => handleUpdateProduct('threshold', parseInt(e.target.value) || 0)} className="w-full px-3 py-2 border border-orange-200 rounded bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-400" />
                  </div>
                </div>
                <div className="mt-6 flex justify-end gap-3">
                  <button onClick={() => setEditingProduct(null)} className="px-4 py-2 border border-slate-300 text-slate-700 rounded hover:bg-slate-100 transition-colors">Cancel</button>
                  <button onClick={saveEditedProduct} className="px-4 py-2 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded hover:from-orange-600 hover:to-orange-700 transition-all duration-200 shadow-md">Save Changes</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProductInventory;
