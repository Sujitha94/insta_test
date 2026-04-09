import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { patchAuthService } from '../utils/AuthPatch';
import { Link } from 'react-router-dom';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

interface Product {
    sku: string;
    productName: string;
    productPhotoUrl: string;
    productType: string;
    productDescription?: string; // Added product description field
    units: { 
      unit: string; 
      price: string | number; 
    }[];
    quantityInStock?: number;
    threshold?: number;
    lastRestocked?: string;
}

interface CartItem {
    sku: string;
    productName: string;
    quantity: number;
    price: number;
    productPhotoUrl?: string;
}

interface ProductCatalogProps {
  bypassTokenCheck?: boolean;
}

// Category Grid Component
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

const ProductCatalog: React.FC<ProductCatalogProps> = ({ bypassTokenCheck = false }) => {
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tenentId, setTenentId] = useState<string>('');
  const [securityAccessToken, setSecurityAccessToken] = useState<string>('');
  const [cartItemCount, setCartItemCount] = useState(0);
  const [showViewCart, setShowViewCart] = useState(false);
  const [cartItems, setCartItems] = useState<Map<string, number>>(new Map());
  
  // Modal related states
  const [showModal, setShowModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  
  // Define appUrl using useMemo to prevent recreating on every render
  const appUrl = useMemo(() => {
    return process.env.REACT_APP_API_URL || 'https://inocencia-shiftiest-nonodorously.ngrok-free.dev' ;                              
  }, []);
  
  // Create axios instance with useMemo
  const axiosInstance = useMemo(() => {
    return axios.create({
      baseURL: appUrl
    });
  }, [appUrl]);

  // Get security token - first try URL params, then localStorage
  const getSecurityToken = (): string => {
    const urlParams = new URLSearchParams(window.location.search);
    const tokenFromUrl = urlParams.get('securityaccessToken');
    console.log("tokenFromUrl",tokenFromUrl);
    if (tokenFromUrl) {
      return tokenFromUrl;
    }
    
    const tokenFromStorage = localStorage.getItem('securityaccessToken');
    console.log("tokenFromStorage",tokenFromStorage);
    return tokenFromStorage || '';
  };
  
  // Get tenant ID - first try URL params, then localStorage
  const getTenantId = (): string => {
    const urlParams = new URLSearchParams(window.location.search);
    const tenantFromUrl = urlParams.get('tenentId');
    
    if (tenantFromUrl) {
      return tenantFromUrl;
    }
    
    const tenantFromStorage = localStorage.getItem('tenentId');
    return tenantFromStorage || '';
  };

  // Handle URL parameters
  useEffect(() => {
    if (bypassTokenCheck) {
      patchAuthService();
    }

    const tenentIdValue = getTenantId();
    const securityTokenValue = getSecurityToken();

    if (!tenentIdValue || !securityTokenValue) {
      setError('Missing authentication information');
      return;
    }
    
    setTenentId(tenentIdValue);
    setSecurityAccessToken(securityTokenValue);
      
    // Store in localStorage for future use
    localStorage.setItem('tenentId', tenentIdValue);
    localStorage.setItem('securityaccessToken', securityTokenValue);

  }, [bypassTokenCheck]);

  // Fetch cart data to get item count and populate cartItems map
  const fetchCartData = async () => {
    const currentToken = getSecurityToken();
    const currentTenantId = getTenantId();
    
    if (!currentTenantId || !currentToken) return;
    
    try {
      const response = await axiosInstance.get(`${appUrl}/api/cartroute/${currentToken}/${currentTenantId}`);
      console.log("response", response.data);
      if (response.data && response.data.items) {
        // Update total count
        setCartItemCount(response.data.items.length);
        setShowViewCart(response.data.items.length > 0);
        
        // Create a map of sku -> quantity for each cart item
        const itemMap = new Map<string, number>();
        response.data.items.forEach((item: CartItem) => {
          itemMap.set(item.sku, item.quantity);
        });
        setCartItems(itemMap);
      }
    } catch (err) {
      console.error('Error fetching cart data:', err);
    }
  };

  // Fetch cart data when securityAccessToken is available
  useEffect(() => {
    if (tenentId && securityAccessToken) {
      fetchCartData();
    }
  }, [tenentId, securityAccessToken]);

  // Fetch categories when tenentId is available
  useEffect(() => {
    if (!tenentId) return;
    
    const fetchCategories = async () => {
      try {
        setIsLoading(true);
        const response = await axiosInstance.get(`${appUrl}/api/productroute/categories`, {
          params: { tenentId }
        });

        if (response.data && Array.isArray(response.data)) {
          setCategories(response.data);
          if (response.data.length > 0 && !selectedCategory) {
            setSelectedCategory(response.data[0]);
          }
        }
      } catch (err) {
        console.error('Error fetching categories:', err);
        setError('Failed to load categories');
      } finally {
        setIsLoading(false);
      }
    };

    fetchCategories();
  }, [tenentId, appUrl, axiosInstance, selectedCategory]);

  // Fetch products when a category is selected
  useEffect(() => {
    if (!selectedCategory || !tenentId) return;

    const fetchProductsByCategory = async () => {
      try {
        setIsLoading(true);
        const response = await axiosInstance.get(`${appUrl}/api/productroute/products`, {
          params: { 
            tenentId, 
            productType: selectedCategory 
          }
        });

        if (response.data && Array.isArray(response.data)) {
          setProducts(response.data);
        }
      } catch (err) {
        console.error('Error fetching products:', err);
        setError(`Failed to load products for ${selectedCategory}`);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProductsByCategory();
  }, [selectedCategory, tenentId, axiosInstance]);

  const handleAddToCart = async (sku: string) => {
    const currentToken = getSecurityToken();
    const currentTenantId = getTenantId();
    
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
    
    try {
      const response = await axiosInstance.post(`${appUrl}/api/cartroute/add`, {
        securityAccessToken: currentToken,
        tenentId: currentTenantId,
        sku,
        quantity: 1  // Add default quantity of 1
      });
  
      if (response.data) {
        // Show success notification using toast
        const productName = response.data.cart?.items?.find((item: CartItem) => item.sku === sku)?.productName || 'Product';
        toast.success(`${productName} added to cart!`, {
          position: "top-center",
          autoClose: 3000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
          className: 'custom-toast',
        });
        
        // Update cart count and cartItems map from the response
        if (response.data.cart && Array.isArray(response.data.cart.items)) {
          const newCartItems = new Map(cartItems);
          
          // Find the item that was just added/updated
          const updatedItem = response.data.cart.items.find((item: CartItem) => item.sku === sku);
          if (updatedItem) {
            newCartItems.set(sku, updatedItem.quantity);
          }
          
          setCartItems(newCartItems);
          setCartItemCount(response.data.cart.items.length);
          setShowViewCart(response.data.cart.items.length > 0);
        } else {
          // Fallback to fetch if response format is unexpected
          fetchCartData();
        }
      }
    } catch (err) {
      console.error('Error adding to cart:', err);
      toast.error('Not enough stock to add the product to your cart', {
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
  
  const handleUpdateQuantity = async (sku: string, newQuantity: number) => {
    const currentToken = getSecurityToken();
    const currentTenantId = getTenantId();
    
    if (!currentTenantId || !currentToken || newQuantity < 0) return;
    
    try {
      if (newQuantity === 0) {
        // Remove item if quantity is 0
        const response = await axiosInstance.delete(`${appUrl}/api/cartroute/remove`, {
          data: {
            securityAccessToken: currentToken,
            tenentId: currentTenantId,
            sku
          }
        });
        
        if (response.data) {
          // Update cart items state
          const newCartItems = new Map(cartItems);
          newCartItems.delete(sku);
          setCartItems(newCartItems);
          
          // Update cart count
          if (response.data.cart && Array.isArray(response.data.cart.items)) {
            setCartItemCount(response.data.cart.items.length);
            setShowViewCart(response.data.cart.items.length > 0);
          } else {
            fetchCartData();
          }
        }
      } else {
        // Update quantity
        const response = await axiosInstance.put(`${appUrl}/api/cartroute/update`, {
          securityAccessToken: currentToken,
          tenentId: currentTenantId,
          sku,
          quantity: newQuantity
        });
        
        if (response.data) {
          // Update cart items state
          const newCartItems = new Map(cartItems);
          newCartItems.set(sku, newQuantity);
          setCartItems(newCartItems);
          
          // Update cart count
          if (response.data.cart && Array.isArray(response.data.cart.items)) {
            setCartItemCount(response.data.cart.items.length);
            setShowViewCart(response.data.cart.items.length > 0);
          }
        }
      }
    } catch (err) {
      console.error('Error updating quantity:', err);
      toast.error('Not enough stock to add the product to your cart', {
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

  // Handle product click to show details modal
  const handleProductClick = (product: Product) => {
    console.log('Clicked Product:', product);
    setSelectedProduct(product);
    setShowModal(true);
  };

  // Close modal
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
      <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
        <p className="font-bold">Authentication Error</p>
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 pb-24 bg-white min-h-screen">
      {/* Custom CSS for larger toast notifications and product hover effects */}
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
      `}</style>
      
      {/* Toast Container - this will render the toast notifications */}
      <ToastContainer />
      
      {/* Header with cart icon */}
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Product Catalog</h1>
        <Link 
          to={`/cart?tenentId=${tenentId}&securityaccessToken=${securityAccessToken}`}
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

      {/* Category Grid Navigation */}
      <CategoryGrid 
        categories={categories}
        selectedCategory={selectedCategory}
        onCategorySelect={setSelectedCategory}
      />

     {/* Product Grid - Updated to reduce spacing and show 2 products per row */}
     <div className="grid grid-cols-2 gap-3 max-w-4xl mx-auto">
        {products.map((product) => {
          // Check if product is out of stock
          const isOutOfStock = !product.hasOwnProperty('quantityInStock') || 
                              product.quantityInStock === 0;
          
          // Check if product is already in cart
          const inCart = cartItems.has(product.sku);
          const quantity = inCart ? cartItems.get(product.sku) || 0 : 0;
          
          return (
            <div 
              key={product.sku} 
              className={`bg-white rounded-lg shadow-md overflow-hidden product-card ${isOutOfStock ? 'opacity-70' : ''}`}
            >
              <div className="relative">
                <img 
                  src={product.productPhotoUrl || `${appUrl}/default-product-image.jpg`} 
                  alt={product.productName}
                  className="w-full h-40 object-cover product-image"
                  onError={(e) => {
                    e.currentTarget.src = `${appUrl}/default-product-image.jpg`;
                  }}
                  onClick={() => handleProductClick(product)}
                />
                
                {/* Out of stock overlay */}
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
                  className="font-semibold text-sm mb-1 text-gray-800 leading-tight cursor-pointer hover:text-blue-600 min-h-10 flex items-start"
                  onClick={() => handleProductClick(product)}
                  style={{ wordBreak: 'break-word', whiteSpace: 'normal' }}
                >
                  {product.productName}
                </h3>
                
                {/* Price Options - Reduced spacing */}
                <div className="mb-1">
                  {product.units && product.units.slice(0, 2).map((unit) => (
                    <div key={unit.unit} className="text-xs text-gray-700">
                      {unit.unit}: <span className="font-medium">₹{parseFloat(unit.price as string).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
                
                {/* Stock status indication - Reduced height */}
                <div className="h-4 mb-1 flex items-center">
                  {!isOutOfStock && product.quantityInStock && (
                    <div className="text-xs text-gray-500">
                      {product.quantityInStock} in stock
                    </div>
                  )}
                </div>
                
                {/* Add to Cart / Quantity Control - Reduced height */}
                {inCart ? (
                  <div className="flex items-center justify-between border border-gray-300 rounded-md overflow-hidden h-8">
                    <button
                      className="px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium text-sm h-full"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleUpdateQuantity(product.sku, quantity - 1);
                      }}
                    >
                      -
                    </button>
                    <span className="flex-1 text-center text-sm font-medium">{quantity}</span>
                    <button
                      className="px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium text-sm h-full"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleUpdateQuantity(product.sku, quantity + 1);
                      }}
                    >
                      +
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAddToCart(product.sku);
                    }}
                    className={`w-full h-8 rounded-md transition-colors text-sm font-medium ${
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

      {/* No Products Message */}
      {products.length === 0 && !isLoading && (
        <div className="text-center py-8 bg-gray-100 rounded-lg">
          <p className="text-gray-600">No products found in this category.</p>
        </div>
      )}

      {/* Product Details Modal */}
      {showModal && selectedProduct && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={closeModal}
        >
          <div 
            className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
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
            
            {/* Modal Body */}
            <div className="p-6">
              <div className="flex flex-col gap-4">
                {/* Product Image */}
                <div className="flex justify-center">
                  <img 
                    src={selectedProduct.productPhotoUrl || `${appUrl}/default-product-image.jpg`} 
                    alt={selectedProduct.productName}
                    className="w-48 h-48 object-cover rounded-lg shadow-md"
                    onError={(e) => {
                      e.currentTarget.src = `${appUrl}/default-product-image.jpg`;
                    }}
                  />
                </div>
                
                {/* Product Name and Price */}
                <div className="bg-white-50 p-2 rounded-md border border-gray-200 max-w-sm">
                  <h2 className="text-xl font-semibold text-gray-900 mb-2">
                    {selectedProduct.productName}
                  </h2>

                  {selectedProduct.units && selectedProduct.units.length > 0 && (
                    <div className="text-lg font-medium text-green-600">
                      ₹{parseFloat(selectedProduct.units[0].price as string).toFixed(2)}
                    </div>
                  )}
                </div>          
                {/* Product Description Section */}
                {selectedProduct?.productDescription && (
                  <div className="bg-white-50 p-4 rounded-lg border border-gray-200">
                    <h4 className="text-lg font-semibold text-gray-800 mb-3">Description:</h4>
                    <p className="text-gray-700 leading-relaxed whitespace-pre-line">
                      {selectedProduct.productDescription}
                    </p>
                  </div>
                )}

                {/* Product Details */}
                <div className="bg-white p-4 rounded-lg border border-gray-200">
                  <h4 className="text-lg font-semibold text-gray-800 mb-3">Product Information:</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-600">SKU:</span>
                      <span className="font-medium text-gray-800">{selectedProduct.sku}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Category:</span>
                      <span className="font-medium text-gray-800">{selectedProduct.productType}</span>
                    </div>
                    {selectedProduct.quantityInStock !== undefined && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Stock:</span>
                        <span className="font-medium text-gray-800">{selectedProduct.quantityInStock} units</span>
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Price Options Section */}
                {selectedProduct.units && selectedProduct.units.length > 1 && (
                  <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                    <h4 className="text-lg font-semibold text-gray-800 mb-3">Available Options:</h4>
                    <div className="space-y-2">
                      {selectedProduct.units.map((unit) => (
                        <div key={unit.unit} className="flex justify-between items-center">
                          <span className="text-gray-700 font-medium">{unit.unit}:</span>
                          <span className="font-semibold text-green-600 text-lg">₹{parseFloat(unit.price as string).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Stock Status */}
                <div className="p-3 rounded-lg border">
                  <div className="flex items-center justify-center">
                    {selectedProduct.quantityInStock && selectedProduct.quantityInStock > 0 ? (
                      <span className="text-green-600 font-medium flex items-center">
                        <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        In Stock ({selectedProduct.quantityInStock} available)
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
              
              {/* Add to Cart Button */}
              <div className="mt-6">
                <button
                  onClick={() => {
                    handleAddToCart(selectedProduct.sku);
                    closeModal();
                  }}
                  className={`w-full py-3 rounded-md transition-colors text-lg font-medium ${
                    !selectedProduct.quantityInStock || selectedProduct.quantityInStock === 0
                      ? 'bg-gray-400 cursor-not-allowed text-gray-100'
                      : 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-xl'
                  }`}
                  disabled={!selectedProduct.quantityInStock || selectedProduct.quantityInStock === 0}
                >
                  {!selectedProduct.quantityInStock || selectedProduct.quantityInStock === 0 ? 'Out of Stock' : 'Add to Cart'}
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
            to={`/cart?tenentId=${tenentId}&securityaccessToken=${securityAccessToken}`}
            className="bg-green-600 text-white py-3 px-8 rounded-md hover:bg-green-700 text-lg font-medium transition-colors"
          >
            View Cart ({cartItemCount} {cartItemCount === 1 ? 'item' : 'items'})
          </Link>
        </div>
      )}
    </div>
  );
};

export default ProductCatalog;

