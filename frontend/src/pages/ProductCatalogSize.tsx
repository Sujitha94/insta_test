import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { patchAuthService } from '../utils/AuthPatch';
import { Link } from 'react-router-dom';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// --- INTERFACES ---

interface ProductUnit {
  unit: string;
  price: string | number;
  imageUrl?: string;  // Unit-specific image URL
  sku: string;        // Unit-specific SKU
  quantityInStock?: number;  // Unit-specific stock
  lastRestocked?: Date;
}

interface Product {
    sku: string;  // Product-level SKU
    productName: string;
    productPhotoUrl: string;  // Main product image
    productType: string;
    productDescription?: string;
    units: ProductUnit[];
    quantityInStock?: number;  // Product-level stock
}

interface CartItem {
    sku: string;        // This should be the unit-specific SKU
    productName: string;
    quantity: number;
    price: number;
    productPhotoUrl?: string;
    selectedUnit?: string;
}

interface ProductCatalogProps {
  bypassTokenCheck?: boolean;
}

// --- CATEGORY GRID COMPONENT ---

const CategoryGrid: React.FC<{
  categories: string[];
  selectedCategory: string | null;
  onCategorySelect: (category: string) => void;
}> = ({ categories, selectedCategory, onCategorySelect }) => {
  if (categories.length === 0) return null;
  return (
    <div className="mb-6">
      <div className="flex flex-wrap gap-2 justify-center">
        {categories.map((category) => (
          <button
            key={category}
            onClick={() => onCategorySelect(category)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 transform hover:scale-105 ${
              selectedCategory === category
                ? 'bg-blue-600 text-white shadow-lg'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            {category}
          </button>
        ))}
      </div>
    </div>
  );
};

// --- MAIN PRODUCT CATALOG COMPONENT ---

const ProductCatalogSize: React.FC<ProductCatalogProps> = ({ bypassTokenCheck = false }) => {
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tenentId, setTenentId] = useState<string>('');
  const [securityAccessToken, setSecurityAccessToken] = useState<string>('');
  const [cartItemCount, setCartItemCount] = useState(0);
  const [showViewCart, setShowViewCart] = useState(false);
  const [cartItems, setCartItems] = useState<Map<string, { quantity: number; selectedUnit?: string }>>(new Map());
  
  const [selectedUnits, setSelectedUnits] = useState<Map<string, string>>(new Map());
  const [showModal, setShowModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  
  const appUrl = useMemo(() => process.env.REACT_APP_API_URL || 'https://inocencia-shiftiest-nonodorously.ngrok-free.dev', []);
  const axiosInstance = useMemo(() => axios.create({ baseURL: appUrl }), [appUrl]);

  // Handle unit selection for dropdowns
  const handleUnitSelection = (productSku: string, unit: string) => {
    setSelectedUnits(prev => new Map(prev).set(productSku, unit));
  };

  // Get the currently selected unit, defaulting to the first one available
  const getSelectedUnit = (product: Product): string => {
    const explicitlySelected = selectedUnits.get(product.sku);
    if (explicitlySelected) return explicitlySelected;

    const defaultUnit = product.units?.[0]?.unit || 'Default';
    // Set default in state if not already present
    if (!selectedUnits.has(product.sku)) {
        setTimeout(() => handleUnitSelection(product.sku, defaultUnit), 0);
    }
    return defaultUnit;
  };

  // Get the selected unit object with all its properties
  const getSelectedUnitData = (product: Product): ProductUnit | null => {
    const unitName = getSelectedUnit(product);
    return product.units.find(u => u.unit === unitName) || null;
  };

  const getSelectedUnitPrice = (product: Product): number => {
    const unitData = getSelectedUnitData(product);
    return unitData ? parseFloat(unitData.price as string) : 0;
  };

  // Get unit-specific image URL or fallback to product image
  const getSelectedUnitImageUrl = (product: Product): string => {
    const unitData = getSelectedUnitData(product);
    return unitData?.imageUrl || product.productPhotoUrl || `${appUrl}/default-product-image.jpg`;
  };

  // Get unit-specific SKU
  const getSelectedUnitSku = (product: Product): string => {
    const unitData = getSelectedUnitData(product);
    return unitData?.sku || product.sku;
  };

  // Get unit-specific stock
  const getSelectedUnitStock = (product: Product): number => {
    const unitData = getSelectedUnitData(product);
    return unitData?.quantityInStock ?? product.quantityInStock ?? 0;
  };

  // Check if selected unit is out of stock
  const isSelectedUnitOutOfStock = (product: Product): boolean => {
    return getSelectedUnitStock(product) <= 0;
  };
  
  const getSecurityToken = (): string => new URLSearchParams(window.location.search).get('securityaccessToken') || localStorage.getItem('securityaccessToken') || '';
  const getTenantId = (): string => new URLSearchParams(window.location.search).get('tenentId') || localStorage.getItem('tenentId') || '';

  useEffect(() => {
    if (bypassTokenCheck) patchAuthService();
    const tenentIdValue = getTenantId();
    const securityTokenValue = getSecurityToken();
    if (!tenentIdValue || !securityTokenValue) {
      setError('Missing authentication information');
      setIsLoading(false);
      return;
    }
    setTenentId(tenentIdValue);
    setSecurityAccessToken(securityTokenValue);
    localStorage.setItem('tenentId', tenentIdValue);
    localStorage.setItem('securityaccessToken', securityTokenValue);
  }, [bypassTokenCheck]);

  // Updated fetchCartData to handle unit-specific SKUs
  const fetchCartData = async () => {
    const currentToken = getSecurityToken();
    const currentTenantId = getTenantId();
    
    console.log('Fetching cart data:', { currentToken: !!currentToken, currentTenantId });
    
    if (!currentTenantId || !currentToken) return;

    try {
      const response = await axiosInstance.get(`/api/cartsizeroute/${currentToken}/${currentTenantId}`);
      console.log('Cart response:', response.data);
      
      if (response.data && Array.isArray(response.data.items)) {
        processCartData(response.data);
      }
    } catch (err) {
      console.error('Error fetching cart data:', err);
    }
  };

  const processCartData = (data: any) => {
    console.log('Processing cart data:', data);
    
    if (data && data.items) {
      console.log('Setting cart count to:', data.items.length);
      setCartItemCount(data.items.length);
      setShowViewCart(data.items.length > 0);
      
      // Use unit-specific SKU as the key
      const itemMap = new Map<string, { quantity: number; selectedUnit?: string }>();
      data.items.forEach((item: CartItem) => {
        const existing = itemMap.get(item.sku);
        const newQuantity = (existing?.quantity || 0) + item.quantity;
        itemMap.set(item.sku, { 
          quantity: newQuantity, 
          selectedUnit: item.selectedUnit || existing?.selectedUnit 
        });
      });
      
      console.log('Final cart items map:', itemMap);
      console.log('Show view cart:', data.items.length > 0);
      setCartItems(itemMap);
    }
  };

  useEffect(() => {
    if (tenentId && securityAccessToken) {
      fetchCartData();
    }
  }, [tenentId, securityAccessToken]);

  useEffect(() => {
    if (!tenentId) return;
    const fetchCategories = async () => {
      setIsLoading(true);
      try {
        const response = await axiosInstance.get(`/api/productsizeroute/categories`, { params: { tenentId } });
        if (response.data && Array.isArray(response.data)) {
          setCategories(response.data);
          if (response.data.length > 0 && !selectedCategory) {
            setSelectedCategory(response.data[0]);
          }
        }
      } catch (err) { 
        setError('Failed to load categories'); 
      } finally { 
        setIsLoading(false); 
      }
    };
    fetchCategories();
  }, [tenentId, axiosInstance, selectedCategory]);

  useEffect(() => {
    if (!selectedCategory || !tenentId) return;
    const fetchProductsByCategory = async () => {
      setIsLoading(true);
      try {
        const response = await axiosInstance.get(`/api/productsizeroute/products`, { 
          params: { tenentId, productType: selectedCategory } 
        });
        setProducts(response.data || []);
      } catch (err) { 
        setError(`Failed to load products for ${selectedCategory}`); 
      } finally { 
        setIsLoading(false); 
      }
    };
    fetchProductsByCategory();
  }, [selectedCategory, tenentId, axiosInstance]);
  
  const handleAddToCart = async (product: Product) => {
    const { productName } = product;
    const currentToken = getSecurityToken();
    const currentTenantId = getTenantId();
    const unitToAddToCart = getSelectedUnit(product);
    const unitSpecificSku = getSelectedUnitSku(product);

    if (!currentTenantId || !currentToken) {
      toast.error('Authentication required', {
        position: "top-center",
        autoClose: 3000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        className: 'custom-toast',
      });
      return;
    }

    if (!unitToAddToCart) {
      toast.error('Product unit not selected. Cannot add to cart.');
      return;
    }

    // Check unit-specific stock
    if (isSelectedUnitOutOfStock(product)) {
      toast.error('Selected unit is out of stock');
      return;
    }

    try {
      const response = await axiosInstance.post(`/api/cartsizeroute/add`, {
        securityAccessToken: currentToken, 
        tenentId: currentTenantId,
        sku: unitSpecificSku,  // Use unit-specific SKU
        quantity: 1, 
        selectedUnit: unitToAddToCart,
      });
      
      if (response.data) {
        toast.success(`${productName} (${unitToAddToCart}) added to cart!`, {
          position: "top-center",
          autoClose: 3000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
          className: 'custom-toast',
        });
        await fetchCartData();
      }
    } catch (err: any) {
      const errorMsg = err.response?.data?.message || 'Not enough stock to add the product to your cart';
      toast.error(errorMsg, {
        position: "top-center",
        autoClose: 3000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        className: 'custom-toast',
      });
    }
  };
  
  const handleUpdateQuantity = async (product: Product, newQuantity: number) => {
    const currentToken = getSecurityToken();
    const currentTenantId = getTenantId();
    const unitSpecificSku = getSelectedUnitSku(product);
    const cartItem = cartItems.get(unitSpecificSku);

    if (!currentTenantId || !currentToken || newQuantity < 0) return;

    const unitToUpdate = cartItem?.selectedUnit || getSelectedUnit(product);

    try {
      if (newQuantity <= 0) {
        await axiosInstance.delete(`/api/cartsizeroute/remove`, {
          data: { 
            securityAccessToken: currentToken, 
            tenentId: currentTenantId, 
            sku: unitSpecificSku,  // Use unit-specific SKU
            selectedUnit: unitToUpdate 
          }
        });
      } else {
        await axiosInstance.put(`/api/cartsizeroute/update`, {
          securityAccessToken: currentToken, 
          tenentId: currentTenantId,
          sku: unitSpecificSku,  // Use unit-specific SKU
          selectedUnit: unitToUpdate, 
          newQuantity: newQuantity
        });
      }
      await fetchCartData();
    } catch (err: any) {
        const errorMsg = err.response?.data?.message || 'Not enough stock to add the product to your cart';
        toast.error(errorMsg, {
          position: "top-center",
          autoClose: 3000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
          className: 'custom-toast',
        });
    }
  };

  const handleProductClick = (product: Product) => {
    console.log('Clicked Product:', product);
    setSelectedProduct(product);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedProduct(null);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 m-4 rounded">
        <p className="font-bold">Authentication Error</p>
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 pb-24">
      <style>{`
        .custom-toast {
          font-size: 18px !important;
          min-height: 64px !important;
          width: 300px !important;
          padding: 15px !important;
        }
        .Toastify__toast-container--top-center {
          top: 20px;
          width: auto;
          margin: 0 auto;
        }
        .product-card {
          cursor: pointer;
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        .product-card:hover {
          transform: scale(1.02);
          box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
        }
        .product-image {
          transition: transform 0.2s ease;
        }
        .product-image:hover {
          transform: scale(1.05);
        }
        .unit-dropdown {
          appearance: none;
          background-image: url("data:image/svg+xml;charset=US-ASCII,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 4 5'><path fill='%23666' d='M2 0L0 2h4zm0 5L0 3h4z'/></svg>");
          background-repeat: no-repeat;
          background-position: right 8px center;
          background-size: 10px;
          padding-right: 24px;
        }
      `}</style>
      
      <ToastContainer />
      
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Product Catalog</h1>
        <Link 
          to={`/cartsize?tenentId=${tenentId}&securityaccessToken=${securityAccessToken}`}
          className="relative p-2"
        >
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            className="h-7 w-7 text-gray-700" 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={1.5} 
              d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" 
            />
          </svg>
          {cartItemCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">
              {cartItemCount}
            </span>
          )}
        </Link>
      </div>

      <CategoryGrid 
        categories={categories} 
        selectedCategory={selectedCategory} 
        onCategorySelect={setSelectedCategory} 
      />

      <div className="grid grid-cols-2 gap-3 max-w-4xl mx-auto">
        {products.map((product) => {
          const isOutOfStock = isSelectedUnitOutOfStock(product);
          const unitSpecificSku = getSelectedUnitSku(product);
          const cartItem = cartItems.get(unitSpecificSku);
          const inCart = !!cartItem;
          const quantity = cartItem?.quantity || 0;
          const currentUnitStock = getSelectedUnitStock(product);
          
          return (
            <div 
              key={`${product.sku}-${getSelectedUnit(product)}`}
              className={`bg-white rounded-lg shadow-md overflow-hidden product-card ${isOutOfStock ? 'opacity-70' : ''}`}
            >
              <div className="relative">
                <img 
                  src={getSelectedUnitImageUrl(product)} 
                  alt={`${product.productName} - ${getSelectedUnit(product)}`} 
                  className="w-full h-40 object-cover product-image" 
                  onError={(e) => { 
                    e.currentTarget.src = product.productPhotoUrl || `${appUrl}/default-product-image.jpg`; 
                  }} 
                  onClick={() => handleProductClick(product)} 
                />
                
                {isOutOfStock && (
                  <div className="absolute inset-0 bg-gray-800 bg-opacity-50 flex items-center justify-center">
                    <span className="bg-red-500 text-white px-3 py-1 rounded-md font-medium text-xs">
                      Out of Stock
                    </span>
                  </div>
                )}
              </div>
              
              <div className="p-2">
                <h3 
                  className="font-semibold text-sm mb-2 text-gray-800 leading-tight cursor-pointer hover:text-blue-600 min-h-10 flex items-start" 
                  onClick={() => handleProductClick(product)} 
                  style={{ wordBreak: 'break-word', whiteSpace: 'normal' }}
                >
                  {product.productName}
                </h3>
                
                {product.units && product.units.length > 1 ? (
                  <div className="mb-2">
                    <select 
                      value={getSelectedUnit(product)} 
                      onChange={(e) => handleUnitSelection(product.sku, e.target.value)} 
                      className="w-full text-xs border border-gray-300 rounded-md px-2 py-1 unit-dropdown focus:outline-none focus:ring-2 focus:ring-blue-500" 
                      onClick={(e) => e.stopPropagation()}
                    >
                      {product.units.map((unit) => (
                        <option key={unit.sku} value={unit.unit}>
                          {unit.unit} - ₹{parseFloat(unit.price as string).toFixed(2)}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="mb-2">
                    <div className="text-xs text-gray-700">
                      {product.units?.[0]?.unit}: <span className="font-medium">₹{getSelectedUnitPrice(product).toFixed(2)}</span>
                    </div>
                  </div>
                )}
                
                <div className="mb-2">
                  <div className="text-sm font-bold text-green-600">
                    ₹{getSelectedUnitPrice(product).toFixed(2)}
                  </div>
                  <div className="text-xs text-gray-500">
                    SKU: {getSelectedUnitSku(product)}
                  </div>
                </div>
                
                <div className="h-4 mb-1 flex items-center">
                  {!isOutOfStock && currentUnitStock > 0 && (
                    <div className="text-xs text-gray-500">
                      {currentUnitStock} in stock
                    </div>
                  )}
                </div>
                
                {inCart ? (
                  <div className="flex items-center justify-between border border-gray-300 rounded-md overflow-hidden h-8">
                    <button 
                      className="px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium text-sm h-full" 
                      onClick={(e) => { 
                        e.stopPropagation(); 
                        handleUpdateQuantity(product, quantity - 1); 
                      }}
                    >
                      -
                    </button>
                    <span className="flex-1 text-center text-sm font-medium">{quantity}</span>
                    <button 
                      className="px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium text-sm h-full" 
                      onClick={(e) => { 
                        e.stopPropagation(); 
                        handleUpdateQuantity(product, quantity + 1); 
                      }}
                    >
                      +
                    </button>
                  </div>
                ) : (
                  <button 
                    onClick={(e) => { 
                      e.stopPropagation(); 
                      handleAddToCart(product); 
                    }} 
                    className={`w-full h-8 rounded-md text-sm font-medium transition-colors ${
                      isOutOfStock 
                        ? 'bg-gray-400 cursor-not-allowed text-gray-100' 
                        : 'bg-blue-600 hover:bg-blue-700 text-white'
                    }`} 
                    disabled={isOutOfStock}
                  >
                    {isOutOfStock ? 'Out of Stock' : 'Add to Cart'}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {products.length === 0 && !isLoading && (
        <div className="text-center py-8 bg-gray-100 rounded-lg">
          <p className="text-gray-600">No products found in this category.</p>
        </div>
      )}

      {/* Enhanced Product Details Modal */}
      {showModal && selectedProduct && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={closeModal}
        >
          <div 
            className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center border-b p-4">
              <h3 className="text-xl font-semibold text-gray-900">Product Details</h3>
              <button 
                onClick={closeModal}
                className="text-gray-400 hover:text-gray-700 focus:outline-none transition-colors"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="p-6">
              <div className="flex flex-col gap-4">
                <div className="flex justify-center">
                  <img 
                    src={getSelectedUnitImageUrl(selectedProduct)} 
                    alt={`${selectedProduct.productName} - ${getSelectedUnit(selectedProduct)}`}
                    className="w-48 h-48 object-cover rounded-lg shadow-md"
                    onError={(e) => {
                      e.currentTarget.src = selectedProduct.productPhotoUrl || `${appUrl}/default-product-image.jpg`;
                    }}
                  />
                </div>
                
                <div className="bg-white-50 p-4 rounded-md border border-gray-200">
                  <h2 className="text-xl font-semibold text-gray-900 mb-3">
                    {selectedProduct.productName}
                  </h2>

                  {/* Unit Selection in Modal */}
                  {selectedProduct.units && selectedProduct.units.length > 0 && (
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Select Unit:
                      </label>
                      <select 
                        value={getSelectedUnit(selectedProduct)}
                        onChange={(e) => handleUnitSelection(selectedProduct.sku, e.target.value)}
                        className="w-full border border-gray-300 rounded-md px-3 py-2 unit-dropdown focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {selectedProduct.units.map((unit) => (
                          <option key={unit.sku} value={unit.unit}>
                            {unit.unit} - ₹{parseFloat(unit.price as string).toFixed(2)}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="text-2xl font-bold text-green-600">
                    ₹{getSelectedUnitPrice(selectedProduct).toFixed(2)}
                  </div>
                </div>

                {selectedProduct?.productDescription && (
                  <div className="bg-white-50 p-4 rounded-lg border border-gray-200">
                    <h4 className="text-lg font-semibold text-gray-800 mb-3">Description:</h4>
                    <p className="text-gray-700 leading-relaxed whitespace-pre-line">
                      {selectedProduct.productDescription}
                    </p>
                  </div>
                )}

                <div className="bg-white p-4 rounded-lg border border-gray-200">
                  <h4 className="text-lg font-semibold text-gray-800 mb-3">Product Information:</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Product SKU:</span>
                      <span className="font-medium text-gray-800">{selectedProduct.sku}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Unit SKU:</span>
                      <span className="font-medium text-gray-800">{getSelectedUnitSku(selectedProduct)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Category:</span>
                      <span className="font-medium text-gray-800">{selectedProduct.productType}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Selected Unit:</span>
                      <span className="font-medium text-gray-800">{getSelectedUnit(selectedProduct)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Unit Stock:</span>
                      <span className="font-medium text-gray-800">{getSelectedUnitStock(selectedProduct)} units</span>
                    </div>
                  </div>
                </div>
                
                <div className="p-3 rounded-lg border">
                  <div className="flex items-center justify-center">
                    {getSelectedUnitStock(selectedProduct) > 0 ? (
                      <span className="text-green-600 font-medium flex items-center">
                        <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        In Stock ({getSelectedUnitStock(selectedProduct)} available)
                      </span>
                    ) : (
                      <span className="text-red-600 font-medium flex items-center">
                        <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                        Out of Stock
                      </span>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="mt-6">
                <button
                  onClick={() => {
                    handleAddToCart(selectedProduct);
                    closeModal();
                  }}
                  className={`w-full py-3 rounded-md transition-colors text-lg font-medium ${
                    isSelectedUnitOutOfStock(selectedProduct)
                      ? 'bg-gray-400 cursor-not-allowed text-gray-100'
                      : 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-xl'
                  }`}
                  disabled={isSelectedUnitOutOfStock(selectedProduct)}
                >
                  {isSelectedUnitOutOfStock(selectedProduct) ? 'Out of Stock' : 'Add to Cart'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* View Cart Button (Fixed at Bottom) */}
      {showViewCart && (
        <div className="fixed bottom-0 left-0 right-0 bg-white shadow-lg p-4 flex justify-center">
          <Link
            to={`/cartsize?tenentId=${tenentId}&securityaccessToken=${securityAccessToken}`}
            className="bg-green-600 text-white py-3 px-8 rounded-md hover:bg-green-700 text-lg font-medium transition-colors"
          >
            View Cart ({cartItemCount} {cartItemCount === 1 ? 'item' : 'items'})
          </Link>
        </div>
      )}
    </div>
  );
};

export default ProductCatalogSize;
