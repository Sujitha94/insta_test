import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

interface CartItem {
  sku: string;
  productName: string;
  productPhotoUrl: string;
  price: number;
  quantity: number;
  quantityInStock: number;
}

interface CartData {
  items: CartItem[];
  total: number;
  totalWeight?: number;
}

interface ShippingPartner {
  id: string;
  name: string;
  cost: number;
}

interface ShippingDetails {
  name: string;
  address: string;
  pinCode: string;
  city: string;
  state: string;
  country: string;
  phoneNumber: string;
  shippingPartner?: ShippingPartner | null;
}

interface WeightRange {
  minWeight: number;
  maxWeight: number;
  price: number;
}

interface RegionWeightConfig {
  regions: string[];
  weightRanges: WeightRange[];
}

interface RegionRate {
  regions: string[];
  price: number;
}

interface ShippingMethod {
  _id?: string;
  name: string;
  type: 'FREE_SHIPPING' | 'COURIER_PARTNER';
  ratePerKg?: number;
  fixedRate?: number;
  minAmount?: number;
  isActive: boolean;
  useWeight?: boolean;
  useRegionWeight?: boolean;
  regionRates?: RegionRate[];
  regionWeightConfigs?: RegionWeightConfig[];
  defaultPrice?: number;
  isPanIndia?: boolean;
  excludedRegions?: string[];
}

interface StateThreshold {
  state: string;
  thresholdAmount: number;
  isActive: boolean;
}

interface FreeShippingThreshold {
  _id?: string;
  tenentId: string;
  thresholdAmount: number;
  isActive: boolean;
  stateThresholds: StateThreshold[];
}

interface StockIssue {
  sku: string;
  productName: string;
  requested: number;
  available: number;
  reason: string;
}

interface InsufficientStockItem {
  sku: string;
  productName: string;
  requestedQuantity: number;
  availableQuantity: number;
  reason: string;
}

interface AxiosErrorType {
  response?: {
    data: any;
    status: number;
  };
  request?: any;
  message?: string;
}

const CartPage: React.FC = () => {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [cart, setCart] = useState<CartData>({ items: [], total: 0, totalWeight: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checkoutStep, setCheckoutStep] = useState<'shipping' | 'terms' | 'payment'>('shipping');
  const [senderId, setSenderId] = useState<string>('');
  const [shippingMethods, setShippingMethods] = useState<ShippingMethod[]>([]);
  const [availableShippingMethods, setAvailableShippingMethods] = useState<ShippingMethod[]>([]);
  const [selectedShippingPartner, setSelectedShippingPartner] = useState<ShippingPartner | null>(null);
  const [stockIssues, setStockIssues] = useState<StockIssue[]>([]);
  const [stockValidationInProgress, setStockValidationInProgress] = useState(false);
  const [freeShippingThreshold, setFreeShippingThreshold] = useState<FreeShippingThreshold | null>(null);

  const [shippingDetails, setShippingDetails] = useState<ShippingDetails>({
    name: '',
    address: '',
    pinCode: '',
    city: '',
    state: '',
    country: 'India',
    phoneNumber: '',
    shippingPartner: null
  });

  const TENANT_ID_ST_COURIER = 'c28e4bd8-ec43-43f9-a931-e886efaec97d';

  const TENANT_SHIPPING_RULES: {
    [key: string]: {
      freeDeliveryStates: string[],
      panIndiaDeliveryCost: number,
      panIndiaFreeThreshold: number,
      shippingPartnerName: string
    }
  } = {
    'c28e4bd8-ec43-43f9-a931-e886efaec97d': {
      freeDeliveryStates: ['TN', 'PY', 'TAMILNADU', 'TAMIL NADU', 'PUDUCHERRY', 'PONDICHERRY'],
      panIndiaDeliveryCost: 49,
      panIndiaFreeThreshold: 500,
      shippingPartnerName: 'ST Courier'
    }
  };

  const normalizeStateName = (state: string): string => {
    return state.toUpperCase().replace(/[^A-Z]/g, '').trim();
  };

  const isStateEligibleForFreeDelivery = (state: string, eligibleStates: string[]): boolean => {
    const normalizedState = normalizeStateName(state);
    return eligibleStates.some(eligibleState =>
      normalizeStateName(eligibleState) === normalizedState
    );
  };

  const getQueryParams = () => {
    const urlParams = new URLSearchParams(window.location.search);
    const skuParam = urlParams.get('sku');
    const securityAccessTokenParam = urlParams.get('securityaccessToken');
    const tenentIdParam = urlParams.get('tenentId');

    return {
      sku: skuParam,
      securityAccessToken: securityAccessTokenParam || '',
      tenentId: tenentIdParam || localStorage.getItem('tenentId') || ''
    };
  };

  const { sku, securityAccessToken, tenentId } = getQueryParams();

  useEffect(() => {
    if (tenentId) localStorage.setItem('tenentId', tenentId);
  }, [tenentId]);

  const appUrl = process.env.REACT_APP_API_URL || 'https://inocencia-shiftiest-nonodorously.ngrok-free.dev';

  useEffect(() => {
    const verifySecurity = async () => {
      if (!securityAccessToken || !tenentId) {
        setError('Missing authentication information');
        setIsLoading(false);
        return;
      }

      try {
        const response = await axios.post(`${appUrl}/api/verifysecurityaccesstokenroute/verify-token`, {
          tenentId,
          securityAccessToken
        });

        if (response && response.data && response.data.senderId) {
          setSenderId(response.data.senderId);
        } else {
          setError('Invalid security token');
          setIsLoading(false);
        }
      } catch (err) {
        console.error('Error verifying security token:', err);
        setError('Authentication failed. Please try again.');
        setIsLoading(false);
      }
    };

    verifySecurity();
  }, [securityAccessToken, tenentId, appUrl]);

  useEffect(() => {
    const fetchFreeShippingThreshold = async () => {
      if (!tenentId) return;

      try {
        const response = await axios.get(`${appUrl}/api/shippingmethodroute/threshold/${tenentId}`);

        if (response.data) {
          setFreeShippingThreshold(response.data);
        }
      } catch (error) {
        const axiosError = error as AxiosErrorType;
        if (axiosError.response && axiosError.response.status === 404) {
          console.log('No free shipping threshold configured for this tenant');
          setFreeShippingThreshold(null);
        } else {
          console.error('Error fetching free shipping threshold:', axiosError);
        }
      }
    };

    fetchFreeShippingThreshold();
  }, [appUrl, tenentId]);

  // Fetch shipping methods filtered by state
  const fetchAvailableShippingMethods = async (state: string) => {
    if (!state || !tenentId) {
      setAvailableShippingMethods([]);
      return;
    }

    try {
      console.log(`Fetching shipping methods for state: ${state}`);
      
      const response = await axios.get(`${appUrl}/api/cartroute/shipping-methods/${tenentId}`, {
        params: { state }
      });

      console.log('Available shipping methods for state:', response.data);

      if (Array.isArray(response.data)) {
        setAvailableShippingMethods(response.data);
        
        // If current selection is not available for this state, clear it
        if (selectedShippingPartner) {
          const isStillValid = response.data.some(method => method._id === selectedShippingPartner.id);
          if (!isStillValid) {
            setSelectedShippingPartner(null);
            setShippingDetails(prev => ({
              ...prev,
              shippingPartner: null
            }));
            toast.warning('Previous shipping method not available for this state. Please select a new one.', {
              position: 'top-center',
              autoClose: 3000,
              className: 'custom-toast',
            });
          }
        }
      }
    } catch (error) {
      console.error('Error fetching available shipping methods:', error);
      setAvailableShippingMethods([]);
    }
  };

  // Fetch all shipping methods (for initial load)
  useEffect(() => {
    const fetchShippingMethods = async () => {
      try {
        const response = await axios.get(`${appUrl}/api/shippingmethodroute/${tenentId}`);

        if (Array.isArray(response.data)) {
          let fetchedMethods = response.data;

          if (tenentId === TENANT_ID_ST_COURIER) {
            fetchedMethods = fetchedMethods.filter(method => method.type === 'FREE_SHIPPING');

            if (fetchedMethods.length > 0) {
              const freeShippingMethod = fetchedMethods[0];
              const tenantRule = TENANT_SHIPPING_RULES[tenentId];

              const partner: ShippingPartner = {
                id: freeShippingMethod._id || 'st-courier-default',
                name: tenantRule?.shippingPartnerName || "ST Courier",
                cost: 0
              };
              setSelectedShippingPartner(partner);
              setShippingDetails(prev => ({
                ...prev,
                shippingPartner: partner
              }));
            }
          }
          setShippingMethods(fetchedMethods);
        } else {
          setError('Failed to load shipping methods');
        }
      } catch (err) {
        setError('Failed to fetch shipping methods');
        console.error(err);
      }
    };

    if (tenentId) {
      fetchShippingMethods();
    }
  }, [appUrl, tenentId]);

  // When state changes, fetch available methods for that state
  useEffect(() => {
    if (shippingDetails.state && tenentId !== TENANT_ID_ST_COURIER) {
      fetchAvailableShippingMethods(shippingDetails.state);
    }
  }, [shippingDetails.state]);

  const fetchCartData = async () => {
    if (!securityAccessToken || !tenentId) return;

    try {
      setError(null);

      const response = await axios.get(
        `${appUrl}/api/cartroute/${securityAccessToken}/${tenentId}`
      );

      if (response.data && typeof response.data === 'object') {
        const items = Array.isArray(response.data.items) ? response.data.items : [];
        const total = typeof response.data.total === 'number' ? response.data.total : 0;
        const totalWeight = typeof response.data.totalWeight === 'number' ? response.data.totalWeight : 0;
        setCart({ items, total, totalWeight });
      } else {
        console.error('Invalid response format:', response.data);
        setCart({ items: [], total: 0, totalWeight: 0 });
        setError('Received invalid data from server');
      }

      setIsLoading(false);
    } catch (error) {
      setError('Failed to load your cart. Please try again.');
      setIsLoading(false);
    }
  };

  const validateStock = async (): Promise<{ valid: boolean; issues: StockIssue[] }> => {
    if (!securityAccessToken || !tenentId) return { valid: false, issues: [] };

    try {
      setError(null);

      const response = await axios.post(`${appUrl}/api/cartroute/validate-stock`, {
        securityAccessToken,
        tenentId
      });

      if (response.data && response.data.valid !== undefined) {
        return {
          valid: response.data.valid,
          issues: (response.data.insufficientItems || []).map((item: InsufficientStockItem) => ({
            sku: item.sku,
            productName: item.productName,
            requested: item.requestedQuantity,
            available: item.availableQuantity,
            reason: item.reason
          }))
        };
      }

      return { valid: false, issues: [] };
    } catch (error) {
      console.error('Error validating stock:', error);
      setError('Failed to validate product stock. Please try again.');
      return { valid: false, issues: [] };
    }
  };

  const validateCartStockOnLoad = async () => {
    if (!securityAccessToken || !tenentId) return;

    try {
      setStockValidationInProgress(true);

      const stockValidation = await validateStock();

      if (!stockValidation.valid) {
        setStockIssues(stockValidation.issues);
      }
    } catch (error) {
      console.error('Error validating stock on load:', error);
      toast.error('Failed to verify product availability. Please try again later.', {
        position: "top-center",
        autoClose: 3000,
        className: 'custom-toast',
      });
    } finally {
      setStockValidationInProgress(false);
    }
  };

  const fetchAddressInfo = async () => {
    if (!securityAccessToken || !tenentId) return;

    try {
      const response = await axios.get(
        `${appUrl}/api/addressroute/address_info?securityAccessToken=${securityAccessToken}&tenentId=${tenentId}`
      );

      if (response.data) {
        setShippingDetails(prev => ({
          ...prev,
          name: response.data.name || '',
          address: response.data.address || '',
          pinCode: response.data.pinCode || '',
          city: response.data.city || '',
          state: response.data.state || '',
          country: response.data.country || 'India',
          phoneNumber: response.data.phoneNumber || '',
          shippingPartner: tenentId === TENANT_ID_ST_COURIER && selectedShippingPartner
            ? selectedShippingPartner
            : (response.data.shippingPartner || null)
        }));
      }
    } catch (error) {
      const axiosError = error as AxiosErrorType;
      console.error('Error fetching address info:', axiosError);
    }
  };

  useEffect(() => {
    if (securityAccessToken && tenentId) {
      fetchCartData().then(() => {
        validateCartStockOnLoad();
      });
    }
  }, [securityAccessToken, tenentId, senderId]);

  useEffect(() => {
    const addProductToCart = async () => {
      if (!securityAccessToken || !tenentId) return;

      if (sku) {
        try {
          setIsLoading(true);

          await axios.post(`${appUrl}/api/cartroute/add`, {
            securityAccessToken,
            tenentId,
            sku,
            quantity: 1
          });

          await fetchCartData();

          const url = new URL(window.location.href);
          url.searchParams.delete('sku');
          window.history.replaceState({}, '', url.toString());
        } catch (error) {
          const axiosError = error as AxiosErrorType;
          console.error('Error adding product to cart:', axiosError);

          setError('Failed to add product to cart. Please try again.');
          setIsLoading(false);
        }
      }
    };

    if (securityAccessToken && tenentId && sku) {
      addProductToCart();
    }
  }, [sku, securityAccessToken, tenentId, appUrl]);

  useEffect(() => {
    if (isDrawerOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
    }
  }, [isDrawerOpen]);

  useEffect(() => {
    const checkStockOnPaymentPage = async () => {
      if (checkoutStep === 'payment') {
        setStockValidationInProgress(true);

        try {
          const stockValidation = await validateStock();

          if (!stockValidation.valid) {
            setStockIssues(stockValidation.issues);
            stockValidation.issues.forEach((issue) => {
              toast.error(`Stock issue: ${issue.productName} - Only ${issue.available} available`, {
                position: "top-center",
                autoClose: 5000,
                className: 'custom-toast',
              });
            });
            await fetchCartData();
          } else {
            setStockIssues([]);
          }
        } catch (error) {
          console.error('Error validating stock:', error);
          toast.error('Unable to verify product availability. Please try again.', {
            position: "top-center",
            autoClose: 3000,
            className: 'custom-toast',
          });
        } finally {
          setStockValidationInProgress(false);
        }
      }
    };

    checkStockOnPaymentPage();
  }, [checkoutStep]);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const shouldOpenCheckout = urlParams.get('checkout') === 'true';

    if (shouldOpenCheckout && cart.items && cart.items.length > 0 && !isLoading) {
      if (stockIssues.length > 0) {
        toast.error('Please resolve stock issues before proceeding to checkout', {
          position: 'top-center',
          autoClose: 3000,
          className: 'custom-toast',
        });
        return;
      }

      setIsDrawerOpen(true);
      setCheckoutStep('shipping');
      fetchAddressInfo();

      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete('checkout');
      window.history.replaceState({}, '', newUrl.toString());
    }
  }, [cart.items, isLoading, stockIssues.length]);

  const handleQuantityChange = async (sku: string, newQuantity: number, availableStock: number) => {
    if (!securityAccessToken || !tenentId) return;

    const isIncreasingQuantity = (cart.items.find(item => item.sku === sku)?.quantity || 0) < newQuantity;

    if (isIncreasingQuantity && newQuantity > availableStock) {
      toast.error(`Not enough stock to add the product to your cart`, {
        position: "top-center",
        autoClose: 3000,
        className: 'custom-toast',
      });
      return;
    }

    if (newQuantity <= 0) {
      await handleRemoveItem(sku);
      return;
    }

    try {
      setError(null);

      const response = await axios.put(`${appUrl}/api/cartroute/update`, {
        securityAccessToken,
        tenentId,
        sku,
        quantity: newQuantity
      });

      if (response.data && response.data.cart) {
        setCart({ items: response.data.cart.items, total: response.data.cart.total, totalWeight: cart.totalWeight });
        await fetchCartData();
        validateCartStockOnLoad();
      } else {
        await fetchCartData();
      }
    } catch (error) {
      const axiosError = error as AxiosErrorType;
      console.error('Error updating quantity:', axiosError);

      if (axiosError.response &&
          axiosError.response.status === 400 &&
          axiosError.response.data &&
          axiosError.response.data.insufficientStock) {
        alert(axiosError.response.data.message);
        setError(axiosError.response.data.message);
      } else {
        setError('Failed to update product quantity. Please try again.');
      }

      await fetchCartData();
    }
  };

  const handleShippingPartnerSelect = (method: ShippingMethod) => {
    let cost = 0;

    if (method.type === 'FREE_SHIPPING') {
      const minimumAmount = method.minAmount || 0;
      cost = cart.total >= minimumAmount ? 0 : (method.fixedRate || 0); // Default to 0 if fixedRate missing for Free Shipping type
    } else {
      // For calculation display only, the real calculation happens in calculateShippingCost
      cost = method.defaultPrice || 0;
    }

    const partner: ShippingPartner = {
      id: method._id || 'default-id',
      name: method.name,
      cost: cost
    };

    setSelectedShippingPartner(partner);
    setShippingDetails(prev => ({
      ...prev,
      shippingPartner: partner
    }));
  };

  const handleRemoveItem = async (sku: string) => {
    if (!securityAccessToken || !tenentId) return;

    try {
      setError(null);

      const response = await axios.delete(`${appUrl}/api/cartroute/remove`, {
        data: {
          securityAccessToken,
          tenentId,
          sku
        }
      });

      if (response.data && response.data.cart) {
         await fetchCartData();
         
         const items = response.data.cart.items || [];
         if (items.length > 0) {
            validateCartStockOnLoad();
         } else {
            setStockIssues([]);
         }
      } else {
        await fetchCartData();
      }
    } catch (error) {
      const axiosError = error as AxiosErrorType;
      console.error('Error removing item:', axiosError);
      setError('Failed to remove product. Please try again.');
      await fetchCartData();
    }
  };

  const handleClearCart = async () => {
    if (!securityAccessToken || !tenentId) return;

    try {
      setError(null);

      const response = await axios.delete(`${appUrl}/api/cartroute/clear`, {
        data: {
          securityAccessToken,
          tenentId
        }
      });

      if (response.data && response.data.cart) {
        setCart({ items: [], total: 0, totalWeight: 0 });
        setStockIssues([]);
      } else {
        await fetchCartData();
      }
    } catch (error) {
      const axiosError = error as AxiosErrorType;
      console.error('Error clearing cart:', axiosError);
      setError('Failed to clear cart. Please try again.');
      await fetchCartData();
    }
  };

  const handleShippingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setError(null);

      let finalShippingPartner = shippingDetails.shippingPartner || selectedShippingPartner;

      if (tenentId === TENANT_ID_ST_COURIER) {
        const tenantRule = TENANT_SHIPPING_RULES[tenentId];
        finalShippingPartner = {
          id: 'st-courier-default',
          name: tenantRule?.shippingPartnerName || "ST Courier",
          cost: 0
        };

        setSelectedShippingPartner(finalShippingPartner);
        setShippingDetails(prev => ({
          ...prev,
          shippingPartner: finalShippingPartner
        }));
      }

      if (!shippingDetails.name || !shippingDetails.address || !shippingDetails.pinCode ||
          !shippingDetails.city || !shippingDetails.state || !shippingDetails.phoneNumber ||
          !finalShippingPartner) {
        setError('Please fill in all required fields and select a shipping partner');
        return;
      }

      await axios.post(`${appUrl}/api/checkoutroute/save_address`, {
        securityAccessToken,
        tenentId,
        shippingDetails: { ...shippingDetails, shippingPartner: finalShippingPartner }
      });

      setCheckoutStep('terms');
    } catch (error) {
      const axiosError = error as AxiosErrorType;
      console.error('Error saving shipping details:', axiosError);

      if (axiosError.response) {
        console.error('Response data:', axiosError.response.data);
        console.error('Response status:', axiosError.response.status);
      }

      setError('Failed to save your shipping details. Please try again.');
    }
  };

  const handleProceedToCheckout = () => {
    if (stockIssues.length > 0) {
      toast.error('Please resolve stock issues before proceeding to checkout', {
        position: 'top-center',
        autoClose: 3000,
        className: 'custom-toast',
      });
      return;
    }

    setIsDrawerOpen(true);
    setCheckoutStep('shipping');
    fetchAddressInfo();
  };

  const handleInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setShippingDetails(prev => ({
      ...prev,
      [name]: value
    }));

    if (name === 'pinCode' && value.length === 6) {
      try {
        const response = await axios.get(`${appUrl}/api/pincoderoute/${value}`);

        const data = response.data[0];

        if (data.Status === 'Success') {
          const postOffice = data.PostOffice[0];
          setShippingDetails(prev => ({
            ...prev,
            city: postOffice.District || postOffice.Block,
            state: postOffice.State
          }));
        }
      } catch (error) {
        console.error('Failed to fetch pincode details:', error);
      }
    }
  };

  const SPECIAL_SHIPPING_PARTNERS = ['Ship Rocket', 'Delhivery'];

  const calculateShippingCost = (): number => {
    const subtotal = cart.total || 0;
    const cartWeight = cart.totalWeight || 0;
    
    const selectedPartnerId = selectedShippingPartner?.id || shippingDetails.shippingPartner?.id;
    const selectedMethod = shippingMethods.find(m => m._id === selectedPartnerId);

    if (freeShippingThreshold) {
      const currentState = shippingDetails.state;
      // Check state-level override first
      if (currentState && freeShippingThreshold.stateThresholds?.length > 0) {
        const stateRule = freeShippingThreshold.stateThresholds.find(
          s => normalizeStateName(s.state) === normalizeStateName(currentState)
        );
        if (stateRule && stateRule.isActive && subtotal >= stateRule.thresholdAmount) {
          return 0;
        }
      }
      // Fall back to global threshold
      if (freeShippingThreshold.isActive && subtotal >= freeShippingThreshold.thresholdAmount) {
        return 0;
      }
    }

    const tenantRules = TENANT_SHIPPING_RULES[tenentId];
    if (tenantRules) {
      if (shippingDetails.state && isStateEligibleForFreeDelivery(shippingDetails.state, tenantRules.freeDeliveryStates)) {
        return 0;
      }
      if (subtotal >= tenantRules.panIndiaFreeThreshold) {
        return 0;
      }
      return tenantRules.panIndiaDeliveryCost;
    }

    if (selectedMethod) {
        if (selectedMethod.type === 'FREE_SHIPPING') {
            const min = selectedMethod.minAmount || 0;
            if (subtotal >= min) return 0;
            return 0; 
        }

        if (selectedMethod.type === 'COURIER_PARTNER') {
            const basePrice = selectedMethod.defaultPrice || 0;
            let additionalCost = 0;

            if (selectedMethod.isPanIndia) {
                // Pan-India shipping uses only base price
                return basePrice;
            }

            if (selectedMethod.useRegionWeight && selectedMethod.regionWeightConfigs && shippingDetails.state) {
                 const normalizedState = normalizeStateName(shippingDetails.state);
                 const config = selectedMethod.regionWeightConfigs.find(c => 
                    c.regions && c.regions.some(r => normalizeStateName(r) === normalizedState)
                 );
                 
                 if (config) {
                     const range = config.weightRanges.find(r => cartWeight >= r.minWeight && cartWeight <= r.maxWeight);
                     if (range) {
                         additionalCost = range.price;
                     } else {
                         // Fallback logic for weights outside defined ranges
                         const sortedRanges = [...config.weightRanges].sort((a, b) => a.minWeight - b.minWeight);
                         if (cartWeight > sortedRanges[sortedRanges.length - 1].maxWeight) {
                             additionalCost = sortedRanges[sortedRanges.length - 1].price;
                         } else {
                             additionalCost = sortedRanges[0].price;
                         }
                     }
                     return basePrice + additionalCost;
                 }
            }

            if (selectedMethod.useWeight && selectedMethod.ratePerKg) {
                 const chargeableWeight = Math.max(0.5, cartWeight); 
                 additionalCost = Math.ceil(chargeableWeight * selectedMethod.ratePerKg);
                 return basePrice + additionalCost;
            }

            if (selectedMethod.regionRates && selectedMethod.regionRates.length > 0 && shippingDetails.state) {
                 const normalizedState = normalizeStateName(shippingDetails.state);
                 const rate = selectedMethod.regionRates.find(r => 
                    r.regions && r.regions.some(reg => normalizeStateName(reg) === normalizedState)
                 );
                 if (rate) {
                     additionalCost = rate.price;
                     return basePrice + additionalCost;
                 }
            }

            if (selectedMethod.fixedRate !== undefined && selectedMethod.fixedRate !== null) {
                additionalCost = selectedMethod.fixedRate;
                return basePrice + additionalCost;
            }
            
            // Default base price if no other rules match
            return basePrice;
        }
    }

    const currentPartner = selectedShippingPartner || shippingDetails.shippingPartner;
    if (currentPartner && SPECIAL_SHIPPING_PARTNERS.includes(currentPartner.name)) {
      return currentPartner.cost || 0;
    }

    return currentPartner?.cost || 0;
  };

  const calculateTotal = () => {
    const subtotal = cart.total || 0;
    const shippingCost = calculateShippingCost();
    return subtotal + shippingCost;
  };

  const initiateRazorpayPayment = async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const urlToken = urlParams.get('securityaccessToken');

    if (!urlToken || !tenentId) {
      toast.error('Authentication error. Please check URL parameters and try again.', {
        position: 'top-center',
        autoClose: 3000,
        className: 'custom-toast',
      });
      return;
    }

    try {
      if (stockIssues.length > 0) {
        toast.error('Please resolve stock issues before proceeding', {
          position: 'top-center',
          autoClose: 3000,
          className: 'custom-toast',
        });
        return;
      }

      let finalShippingPartner = selectedShippingPartner;
      if (tenentId === TENANT_ID_ST_COURIER && !finalShippingPartner && shippingMethods.length > 0) {
        const freeShippingMethod = shippingMethods.find(method => method.type === 'FREE_SHIPPING');
        if (freeShippingMethod) {
          const tenantRule = TENANT_SHIPPING_RULES[tenentId];
          finalShippingPartner = {
            id: freeShippingMethod._id || 'st-courier-default',
            name: tenantRule?.shippingPartnerName || "ST Courier",
            cost: 0
          };
        }
      }

      const shippingCost = calculateShippingCost();

      const response = await axios.post(
        `${appUrl}/api/cartroute/create-payment-link`,
        {
          securityAccessToken: urlToken,
          tenentId,
          amount: calculateTotal() * 100,
          description: `Order from ${shippingDetails.name}`,
          notes: {
            customer_phone: shippingDetails.phoneNumber,
            shipping_address: JSON.stringify(shippingDetails),
            shipping_amount: shippingCost
          }
        }
      );

      if (response.data && response.data.payment_link_url) {
        localStorage.setItem('currentOrderId', response.data.id || '');
        localStorage.setItem('currentReferenceId', response.data.reference_id || '');

        window.location.href = response.data.payment_link_url;
      } else {
        toast.error('Failed to create payment link', {
          position: 'top-center',
          autoClose: 3000,
          className: 'custom-toast',
        });
      }
    } catch (error) {
      console.error('Payment link creation error:', error);

      const axiosError = error as AxiosErrorType;
      if (axiosError.response) {
        if (axiosError.response.data && axiosError.response.data.insufficientItems) {
          setStockIssues(axiosError.response.data.insufficientItems.map((item: InsufficientStockItem) => ({
            sku: item.sku,
            productName: item.productName,
            requested: item.requestedQuantity,
            available: item.availableQuantity,
            reason: item.reason
          })));

          toast.error('Some items in your cart have stock issues', {
            position: 'top-center',
            autoClose: 4000,
            className: 'custom-toast',
          });
        } else if (axiosError.response.data && axiosError.response.data.message) {
          toast.error(axiosError.response.data.message, {
            position: 'top-center',
            autoClose: 5000,
            className: 'custom-toast',
          });
        } else if (axiosError.response.data && axiosError.response.data.error) {
          toast.error(axiosError.response.data.error, {
            position: 'top-center',
            autoClose: 3000,
            className: 'custom-toast',
          });
        } else {
          toast.error('Payment initialization failed', {
            position: 'top-center',
            autoClose: 3000,
            className: 'custom-toast',
          });
        }
      } else {
        toast.error('Payment initialization failed', {
          position: 'top-center',
          autoClose: 3000,
          className: 'custom-toast',
        });
      }
    }
  };

  // Display list for shipping methods (use available methods if state is selected)
  const getDisplayShippingMethods = (): ShippingMethod[] => {
    // For ST Courier tenant, always use filtered methods
    if (tenentId === TENANT_ID_ST_COURIER) {
      return shippingMethods;
    }
    
    // If state is selected and we have filtered methods, use those
    if (shippingDetails.state && availableShippingMethods.length > 0) {
      return availableShippingMethods;
    }
    
    // Otherwise, show all methods
    return shippingMethods;
  };

  return (
    <div className="min-h-screen bg-gray-100 p-6">
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
      `}</style>

      <ToastContainer />

      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Your Cart</h1>
        <a
          href={`/productcatalog?tenentId=${tenentId}&securityaccessToken=${securityAccessToken}`}
          className="bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded-md transition-colors"
        >
          Back to Products
        </a>
      </div>

      {error && (
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6">
          <p>{error}</p>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center items-center py-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
      ) : !cart || !cart.items || cart.items.length === 0 ? (
        <div className="text-center py-8 bg-white rounded-lg shadow">
          <p className="text-gray-500 mb-4">Your cart is empty</p>
          <a
            href={`/productcatalog?tenentId=${tenentId}&securityaccessToken=${securityAccessToken}`}
            className="text-blue-500 hover:text-blue-700"
          >
            Continue Shopping
          </a>
        </div>
      ) : (
        <>
          {stockValidationInProgress && (
            <div className="flex items-center justify-center p-4 mb-4 bg-blue-50 border border-blue-200 rounded-md">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500 mr-3"></div>
              <p className="text-blue-700">Verifying product stock availability...</p>
            </div>
          )}

          {stockIssues.length > 0 && (
            <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6">
              <div className="flex">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div>
                  <p className="font-medium">Stock availability issues</p>
                  <p className="text-sm">Some items in your cart have limited availability. Please review and adjust quantities.</p>
                </div>
              </div>
            </div>
          )}

          <div className="bg-white rounded-lg shadow overflow-hidden mb-6">
            <div className="px-4 sm:px-6 py-4 border-b">
              <div className="hidden sm:flex px-6 py-4 border-b justify-between font-medium text-gray-500">
                <div className="w-2/5">Product</div>
                <div className="w-1/5 text-center">Price</div>
                <div className="w-1/5 text-center">Quantity</div>
                <div className="w-1/5 text-right">Total</div>
              </div>
            </div>

            <div className="divide-y">
              {cart.items.map((item) => {
                const stockIssue = stockIssues.find(issue => issue.sku === item.sku);
                const hasStockIssue = stockIssue !== undefined;

                return (
                  <div key={item.sku} className={`p-4 ${hasStockIssue ? 'border border-red-500 bg-red-50 rounded-md m-2' : ''}`}>
                    <div className="flex items-center mb-3">
                      {item.productPhotoUrl && (
                        <img
                          src={item.productPhotoUrl}
                          alt={item.productName}
                          className="w-16 h-16 object-cover rounded mr-3"
                          onError={(e) => {
                            e.currentTarget.onerror = null;
                            e.currentTarget.src = `${appUrl}/default-product-image.jpg`;
                          }}
                        />
                      )}
                      <div>
                        <div className="font-medium">{item.productName}</div>
                        <div className="text-sm text-gray-500">SKU: {item.sku}</div>

                        {hasStockIssue ? (
                          <div className="text-red-600 text-sm mt-1 flex items-center">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                            Only {stockIssue.available} available
                          </div>
                        ) : (
                          <div className="text-green-600 text-sm mt-1 flex items-center">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            In Stock
                          </div>
                        )}
                      </div>
                      <button
                        className="ml-auto text-gray-400 hover:text-red-500"
                        onClick={() => handleRemoveItem(item.sku)}
                        aria-label={`Remove ${item.productName} from cart`}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </div>

                    {hasStockIssue && (
                    <div className="mt-2 bg-red-100 p-3 rounded-md mb-3">
                      <p className="text-red-700 text-sm font-medium">
                        {stockIssue.available === 0 ?
                          "No stock available" :
                          `You selected ${stockIssue.requested} but only ${stockIssue.available} are available`
                        }
                      </p>
                      <div className="flex space-x-2 mt-2">
                        {stockIssue.available > 0 && (
                          <button
                            onClick={() => handleQuantityChange(item.sku, stockIssue.available, stockIssue.available)}
                            className="bg-blue-600 text-white text-sm px-3 py-1 rounded-md hover:bg-blue-700 flex items-center"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4" />
                            </svg>
                            Update to {stockIssue.available}
                          </button>
                        )}
                        <button
                          onClick={() => handleRemoveItem(item.sku)}
                          className="bg-red-500 text-white text-sm px-3 py-1 rounded-md hover:bg-red-600 flex items-center"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                          Remove Item
                        </button>
                      </div>
                    </div>
                  )}

                    <div className="grid grid-cols-3 gap-2 items-center">
                      <div>
                        <div className="text-xs text-gray-500 mb-1">Price</div>
                        <div>₹{parseFloat(String(item.price)).toFixed(2)}</div>
                      </div>

                      <div>
                        <div className="text-xs text-gray-500 mb-1">Quantity</div>
                        <div className="flex items-center border rounded-md w-min">
                          <button
                            className="px-2 py-1 text-gray-500 hover:text-gray-700"
                            onClick={() => handleQuantityChange(item.sku, item.quantity - 1, item.quantityInStock)}
                          >
                            -
                          </button>
                          <span className="px-2">{item.quantity}</span>
                          <button
                            className="px-2 py-1 text-gray-500 hover:text-gray-700"
                            onClick={() => handleQuantityChange(item.sku, item.quantity + 1, item.quantityInStock)}
                            disabled={hasStockIssue && item.quantity >= stockIssue.available}
                          >
                            +
                          </button>
                        </div>
                      </div>

                      <div>
                        <div className="text-xs text-gray-500 mb-1">Total</div>
                        <div className="font-medium">
                          ₹{(parseFloat(String(item.price)) * item.quantity).toFixed(2)}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col md:flex-row justify-between items-start mb-6 gap-4">
            <button
              className="text-red-500 hover:text-red-700"
              onClick={handleClearCart}
            >
              Clear Cart
            </button>

            <div className="bg-white rounded-lg shadow p-6 w-full md:w-80">
            <h2 className="text-lg font-medium mb-4">Order Summary</h2>

            <div className="space-y-2 mb-4">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>₹{cart.total.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-gray-500">
                <span>Shipping</span>
                <span>Calculated at checkout</span>
              </div>
              {freeShippingThreshold && freeShippingThreshold.isActive && (
                <div className="flex justify-between text-sm text-green-600">
                  <span>Free Shipping Threshold</span>
                  <span>₹{freeShippingThreshold.thresholdAmount.toFixed(2)}</span>
                </div>
              )}
            </div>

            <div className="border-t pt-4 mb-6">
              <div className="flex justify-between font-medium">
                <span>Total</span>
                <span>₹{cart.total.toFixed(2)}</span>
              </div>
            </div>

            <div className="space-y-2">
              {stockIssues.length > 0 ? (
                <>
                  <button
                    onClick={async () => {
                      try {
                        setIsLoading(true);
                        setStockIssues([]);
                        await fetchCartData();
                        const stockValidation = await validateStock();

                        if (!stockValidation.valid) {
                          setStockIssues(stockValidation.issues);
                          toast.info("Stock check complete. Please review your cart.", {
                            position: "top-center",
                            autoClose: 3000,
                            className: 'custom-toast',
                          });
                        } else {
                          setStockIssues([]);
                          toast.success("Your cart is ready for checkout!", {
                            position: "top-center",
                            autoClose: 3000,
                            className: 'custom-toast',
                          });
                        }
                      } catch (error) {
                        console.error("Error refreshing cart:", error);
                        toast.error("Failed to refresh cart. Please try again.", {
                          position: "top-center",
                          autoClose: 3000,
                          className: 'custom-toast',
                        });
                      } finally {
                        setIsLoading(false);
                      }
                    }}
                    className="w-full flex items-center justify-center bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg text-lg transition-colors"
                  >
                    {isLoading ? (
                      <span className="flex items-center">
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                        Refreshing...
                      </span>
                    ) : (
                      <>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Refresh Cart
                      </>
                    )}
                  </button>

                  <button
                    disabled
                    className="w-full bg-gray-400 cursor-not-allowed text-white py-3 rounded-lg text-lg"
                  >
                    Proceed to Checkout
                  </button>

                  <p className="text-red-500 text-sm mt-1 text-center">
                    Please resolve stock issues before checkout
                  </p>
                </>
              ) : (
                <button
                  onClick={handleProceedToCheckout}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg text-lg transition-colors"
                >
                  Proceed to Checkout
                </button>
              )}
            </div>
          </div>
          </div>
        </>
      )}

      <div
        className={`fixed inset-0 bg-black bg-opacity-50 z-40 transition-opacity ${
          isDrawerOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setIsDrawerOpen(false)}
      />

      {checkoutStep === 'shipping' && (
        <div
          className={`fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl z-50 p-6 shadow-lg transform transition-transform duration-300 ease-in-out ${
            isDrawerOpen ? 'translate-y-0' : 'translate-y-full'
          }`}
          style={{ height: '80vh', overflowY: 'auto' }}
        >
          <div className="w-12 h-1.5 bg-gray-300 rounded-full mx-auto mb-6" />

          <div className="flex items-center mb-4">
            <button
              onClick={() => setIsDrawerOpen(false)}
              className="p-2"
              aria-label="Close"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <h2 className="text-xl font-medium mx-auto pr-8">Your details</h2>
          </div>

          <div className="w-full h-2 bg-gray-100 mb-6">
            <div className="w-1/3 h-full bg-pink-500"></div>
          </div>

          {error && (
            <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4">
              <p>{error}</p>
            </div>
          )}

          <form className="space-y-4" onSubmit={handleShippingSubmit}>
            <div>
              <input
                type="text"
                placeholder="Name"
                name="name"
                value={shippingDetails.name}
                onChange={handleInputChange}
                className={`w-full p-3 border rounded-md focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-pink-500 ${
                  error && !shippingDetails.name ? 'border-red-500' : ''
                }`}
                required
              />
            </div>

            <div>
              <input
                type="text"
                placeholder="Address"
                name="address"
                value={shippingDetails.address}
                onChange={handleInputChange}
                className={`w-full p-3 border rounded-md focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-pink-500 ${
                  error && !shippingDetails.address ? 'border-red-500' : ''
                }`}
                required
              />
            </div>

            <div>
              <input
                type="text"
                placeholder="Pin code"
                name="pinCode"
                value={shippingDetails.pinCode}
                onChange={handleInputChange}
                className={`w-full p-3 border rounded-md focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-pink-500 ${
                  error && !shippingDetails.pinCode ? 'border-red-500' : ''
                }`}
                required
                maxLength={6}
                pattern="[0-9]{6}"
              />
            </div>

            <div>
              <input
                type="text"
                placeholder="City"
                name="city"
                value={shippingDetails.city}
                onChange={handleInputChange}
                className={`w-full p-3 border rounded-md focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-pink-500 ${
                  error && !shippingDetails.city ? 'border-red-500' : ''
                }`}
                required
              />
            </div>

            <div className="relative">
              <input
                type="text"
                placeholder="State"
                name="state"
                value={shippingDetails.state}
                onChange={handleInputChange}
                className={`w-full p-3 border rounded-md focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-pink-500 ${
                  error && !shippingDetails.state ? 'border-red-500' : ''
                }`}
                required
              />
            </div>

            <div>
              <label className="block text-gray-500 text-sm mb-1">Country</label>
              <input
                type="text"
                name="country"
                value="India"
                readOnly
                className="w-full p-3 border rounded-md focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
              />
            </div>

            <div>
              <input
                type="tel"
                placeholder="Phone number"
                name="phoneNumber"
                value={shippingDetails.phoneNumber}
                onChange={handleInputChange}
                className={`w-full p-3 border rounded-md focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-pink-500 ${
                  error && !shippingDetails.phoneNumber ? 'border-red-500' : ''
                }`}
                required
              />
            </div>

            <div className="mt-6 mb-4 bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="mb-6">
                <h4 className="text-sm font-normal text-gray-800 mb-1 flex items-center">
                  <svg className="w-3.5 h-3.5 mr-1 text-pink-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                  Shipping Partner
                </h4>
                {shippingDetails.state && tenentId !== TENANT_ID_ST_COURIER && (
                  <p className="text-xs text-blue-600 mt-1">
                    Showing methods available for {shippingDetails.state}
                  </p>
                )}
              </div>

              {tenentId === TENANT_ID_ST_COURIER ? (
                <div className="p-4 bg-blue-50 border-2 border-blue-200 rounded-lg">
                  <div className="flex items-center">
                    <svg className="w-6 h-6 text-blue-500 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <div>
                      <span className="text-blue-800 text-lg font-medium">ST Courier</span>
                      <p className="text-blue-600 text-sm">Auto-selected shipping partner</p>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
                    <p className="text-xs text-gray-500 italic bg-gray-50 px-2 py-0.5 rounded-full">
                      Final charges calculated at checkout based on address & weight
                    </p>
                  </div>

                  {!shippingDetails.state && (
                    <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                      <p className="text-sm text-yellow-800">
                        Please enter your state to see available shipping options
                      </p>
                    </div>
                  )}

                  {shippingDetails.state && getDisplayShippingMethods().length === 0 && (
                    <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                      <p className="text-sm text-red-800">
                        No shipping methods available for {shippingDetails.state}. Please contact support.
                      </p>
                    </div>
                  )}

                  <div className="relative">
                    <select
                      className="w-full p-2.5 bg-white border-2 border-gray-200 rounded-lg shadow-sm
                                focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-pink-500
                                text-sm font-normal text-gray-700 cursor-pointer
                                hover:border-gray-300 transition-all duration-200
                                appearance-none bg-no-repeat bg-right pr-12"
                      style={{
                        backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
                        backgroundPosition: 'right 1rem center',
                        backgroundSize: '1rem'
                      }}
                      value={shippingDetails.shippingPartner?.id || ''}
                      onChange={(e) => {
                        const selectedMethod = getDisplayShippingMethods().find(method => method._id === e.target.value);
                        if (selectedMethod) {
                          handleShippingPartnerSelect(selectedMethod);
                        }
                      }}
                      disabled={!shippingDetails.state || getDisplayShippingMethods().length === 0}
                    >
                      <option value="" disabled className="text-gray-400">
                        {!shippingDetails.state ? 'Please select state first' : 'Choose your shipping partner'}
                      </option>
                      {getDisplayShippingMethods().map((method) => (
                        <option key={method._id} value={method._id} className="text-lg py-2 text-gray-700">
                          {method.name}
                          {method.type === 'FREE_SHIPPING' ? (
                            cart.total >= (method.minAmount || 0) ?
                              " • FREE SHIPPING" :
                              ` • Free on orders above ₹${method.minAmount || 0}`
                          ) : (
                            ""
                          )}
                        </option>
                      ))}
                    </select>

                    <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none">
                      <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>

                  {shippingDetails.shippingPartner && (
                    <div className="mt-3 p-2.5 bg-green-50 border border-green-200 rounded-lg">
                      <div className="flex items-center">
                        <svg className="w-5 h-5 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <span className="text-green-800 text-sm font-normal">
                          Selected: {shippingDetails.shippingPartner.name}
                        </span>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            <button
              type="submit"
              className="w-full bg-pink-500 hover:bg-pink-600 text-white py-3 rounded-md text-lg mt-4 transition-colors"
            >
              Continue
            </button>
          </form>
        </div>
      )}

      {checkoutStep === 'terms' && (
        <div
          className={`fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl z-50 p-6 shadow-lg transform transition-transform duration-300 ease-in-out ${
            isDrawerOpen ? 'translate-y-0' : 'translate-y-full'
          }`}
          style={{ height: '80vh', overflowY: 'auto' }}
        >
          <div className="w-12 h-1.5 bg-gray-300 rounded-full mx-auto mb-6" />

          <div className="flex items-center mb-4">
            <button
              onClick={() => setCheckoutStep('shipping')}
              className="p-2"
              aria-label="Back"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h2 className="text-xl font-medium mx-auto pr-8">Terms and Conditions</h2>
            <div className="w-6"></div>
          </div>

          <div className="w-full h-2 bg-gray-100 mb-6">
            <div className="w-2/3 h-full bg-pink-500"></div>
          </div>

          <div className="mb-8">
            <h3 className="text-2xl font-bold mb-4">Our Terms</h3>
            <p className="mb-4">
              Your personal data will be used to process your order, support your experience on Instagram, and for other purposes as outlined in our privacy policy.
            </p>
          </div>

          <button
            onClick={() => setCheckoutStep('payment')}
            className="w-full bg-pink-500 hover:bg-pink-600 text-white py-3 rounded-md text-lg transition-colors mb-4"
          >
            Accept and Submit
          </button>

          <div className="flex items-center justify-center mt-6 text-sm text-gray-600">
            <p className="flex items-center">
              <span>Managed by {tenentId ? "Vaseegrah Shop" : "Shop"}. </span>
              <a href="#" className="text-pink-500 ml-1">Learn more</a>
            </p>
          </div>
        </div>
      )}

      {checkoutStep === 'payment' && (
        <div
          className={`fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl z-50 p-6 shadow-lg transform transition-transform duration-300 ease-in-out ${
            isDrawerOpen ? 'translate-y-0' : 'translate-y-full'
          }`}
          style={{ height: '85vh', overflowY: 'auto' }}
        >
          <div className="w-12 h-1.5 bg-gray-300 rounded-full mx-auto mb-6" />

          <div className="flex items-center mb-4">
            <button
              onClick={() => setCheckoutStep('terms')}
              className="p-2"
              aria-label="Back"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h2 className="text-xl font-medium mx-auto pr-8">Order Summary</h2>
            <div className="w-6"></div>
          </div>

          <div className="w-full h-2 bg-gray-100 mb-6">
            <div className="w-full h-full bg-pink-500"></div>
          </div>

          {stockValidationInProgress && (
            <div className="flex items-center justify-center p-4 mb-4 bg-blue-50 border border-blue-200 rounded-md">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500 mr-3"></div>
              <p className="text-blue-700">Verifying product stock availability...</p>
            </div>
          )}

          {stockIssues.length > 0 && (
            <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4">
              <div className="flex">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <p className="font-medium">Some items in your cart have stock issues</p>
              </div>
              <p className="ml-8 text-sm">Please adjust quantities before proceeding with payment</p>
            </div>
          )}

          <div className="mb-6">
            <h3 className="text-lg font-medium mb-3">Products</h3>
            <div className="space-y-4 max-h-64 overflow-y-auto">
              {cart.items.map((item) => {
                const stockIssue = stockIssues.find(issue => issue.sku === item.sku);
                const hasStockIssue = stockIssue !== undefined;

                return (
                  <div
                    key={item.sku}
                    className={`border rounded-md p-4 ${hasStockIssue ? 'border-red-500 bg-red-50' : ''}`}
                  >
                    <div className="flex items-center">
                      {item.productPhotoUrl && (
                        <img
                          src={item.productPhotoUrl}
                          alt={item.productName}
                          className="w-16 h-16 object-cover rounded mr-3"
                          onError={(e) => {
                            e.currentTarget.onerror = null;
                            e.currentTarget.src = `${appUrl}/default-product-image.jpg`;
                          }}
                        />
                      )}
                      <div className="flex-1">
                        <div className="font-medium">{item.productName}</div>
                        <div className="text-sm text-gray-500">SKU: {item.sku}</div>
                        <div className="flex justify-between items-center mt-2">
                          <div className="text-gray-700">₹{parseFloat(String(item.price)).toFixed(2)} × {item.quantity}</div>
                          <div className="font-medium">₹{(parseFloat(String(item.price)) * item.quantity).toFixed(2)}</div>
                        </div>

                        {!hasStockIssue && (
                          <div className="mt-1 text-green-600 text-xs flex items-center">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            In Stock
                          </div>
                        )}
                      </div>
                    </div>

                    {hasStockIssue && (
                      <div className="mt-2 bg-red-100 p-3 rounded-md mb-3">
                        <p className="text-red-700 text-sm font-medium">
                          {stockIssue.available === 0 ?
                            "No stock available" :
                            `You selected ${stockIssue.requested} but only ${stockIssue.available} are available`
                          }
                        </p>
                        <div className="flex space-x-2 mt-2">
                          {stockIssue.available > 0 && (
                            <button
                              onClick={() => handleQuantityChange(item.sku, stockIssue.available, stockIssue.available)}
                              className="bg-blue-600 text-white text-sm px-3 py-1 rounded-md hover:bg-blue-700 flex items-center"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4" />
                              </svg>
                              Update to {stockIssue.available}
                            </button>
                          )}
                          <button
                            onClick={() => handleRemoveItem(item.sku)}
                            className="bg-red-500 text-white text-sm px-3 py-1 rounded-md hover:bg-red-600 flex items-center"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            Remove Item
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mb-4">
            <h3 className="text-lg font-medium mb-2">Shipping Address</h3>
            <div className="border rounded-md p-4">
              <p>{shippingDetails.name}</p>
              <p>{shippingDetails.address}</p>
              <p>
                {shippingDetails.city}, {shippingDetails.state} {shippingDetails.pinCode}
              </p>
              <p>{shippingDetails.country}</p>
              <p className="mt-1">Phone: {shippingDetails.phoneNumber}</p>
            </div>
          </div>

          {shippingDetails.shippingPartner && (
            <div className="mb-6">
              <h3 className="text-lg font-medium mb-2">Shipping Method</h3>
              <div className="border rounded-md p-4">
                <p className="font-medium">{shippingDetails.shippingPartner.name}</p>
                <p className="text-gray-700">
                  {(() => {
                    const shippingCost = calculateShippingCost();
                    return shippingCost === 0 ? 'Free Shipping' : `₹${shippingCost.toFixed(2)}`;
                  })()}
                </p>
              </div>
            </div>
          )}

          <div className="border-t border-b py-4 mb-6">
            <div className="flex justify-between text-gray-700 mb-2">
              <span>Subtotal</span>
              <span>₹{cart.total.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-gray-700 mb-2">
              <span>Shipping</span>
              <span>
                {(() => {
                  const shippingCost = calculateShippingCost();
                  return shippingCost === 0 ? 'Free' : `₹${shippingCost.toFixed(2)}`;
                })()}
              </span>
            </div>
            {freeShippingThreshold && (() => {
              const currentState = shippingDetails.state;
              let applicableThreshold = freeShippingThreshold.isActive ? freeShippingThreshold.thresholdAmount : null;
              if (currentState && freeShippingThreshold.stateThresholds?.length > 0) {
                const stateRule = freeShippingThreshold.stateThresholds.find(
                  s => normalizeStateName(s.state) === normalizeStateName(currentState)
                );
                if (stateRule?.isActive) applicableThreshold = stateRule.thresholdAmount;
              }
              return applicableThreshold !== null && cart.total < applicableThreshold ? (
                <div className="flex justify-between text-sm text-blue-600 mb-2">
                  <span>Add ₹{(applicableThreshold - cart.total).toFixed(2)} more for free shipping</span>
                </div>
              ) : null;
            })()}
            <div className="flex justify-between font-bold text-lg mt-2 text-pink-600">
              <span>Total</span>
              <span>₹{calculateTotal().toFixed(2)}</span>
            </div>
          </div>

          <div className="flex justify-center mb-6">
            {stockIssues.length > 0 ? (
              <button
                onClick={async () => {
                  try {
                    setStockValidationInProgress(true);
                    const stockValidation = await validateStock();

                    if (stockValidation.valid) {
                      setStockIssues([]);
                      toast.success("All items are now in stock!", {
                        position: "top-center",
                        autoClose: 3000,
                        className: 'custom-toast',
                      });
                    } else {
                      setStockIssues(stockValidation.issues);
                      toast.warning("Some items still have stock issues. Please review your cart.", {
                        position: "top-center",
                        autoClose: 3000,
                        className: 'custom-toast',
                      });
                    }
                  } catch (error) {
                    console.error("Error validating stock:", error);
                    toast.error("Failed to check stock availability. Please try again.", {
                      position: "top-center",
                      autoClose: 3000,
                      className: 'custom-toast',
                    });
                  } finally {
                    setStockValidationInProgress(false);
                  }
                }}
                className="w-full flex items-center justify-center bg-green-600 hover:bg-green-700 text-white py-3 rounded-md text-lg transition-colors"
              >
                {stockValidationInProgress ? (
                  <span className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
                    Checking inventory...
                  </span>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Verify Stock Availability
                  </>
                )}
              </button>
            ) : (
              <button
                onClick={initiateRazorpayPayment}
                disabled={stockValidationInProgress}
                className={`w-full ${
                  stockValidationInProgress
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-pink-600 hover:bg-pink-700'
                } text-white py-3 rounded-md text-lg transition-colors`}
              >
                {stockValidationInProgress ? (
                  <span className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
                    Verifying...
                  </span>
                ) : (
                  `Pay ₹${calculateTotal().toFixed(2)}`
                )}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CartPage;

