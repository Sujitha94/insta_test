import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// --- INTERFACES ---

interface ProductUnit {
  unit: string;
  price: string | number;
  sku?: string;
  quantityInStock?: number;
}

interface CartItem {
  sku: string;
  productName: string;
  productPhotoUrl: string;
  price: number;
  quantity: number;
  quantityInStock: number;
  selectedUnit: string;
  units: ProductUnit[];
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

interface StockValidationResult {
  valid: boolean;
  availableStock: number;
  error?: string;
  stockInfo?: {
    productDetail: any;
    unitData: any;
    unitSku: string;
    unitPrice: number;
  };
}

interface CartStockValidation {
  valid: boolean;
  issues: StockIssue[];
  allResults: StockValidationResult[];
}

interface AxiosErrorType {
  response?: {
    data: any;
    status: number;
  };
  request?: any;
  message?: string;
}

// --- MAIN REACT COMPONENT ---

const CartPageSize: React.FC = () => {
  // --- STATE MANAGEMENT ---
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [cart, setCart] = useState<CartData>({ items: [], total: 0, totalWeight: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checkoutStep, setCheckoutStep] = useState<'shipping' | 'terms' | 'payment'>('shipping');
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

  const TENENT_ID_FOR_FREE_SHIPPING_ONLY = '7bc5fa55-ed43-4d98-89e5-d7bd902f327a';
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

  // --- INITIAL SETUP ---
  const getQueryParams = () => {
    const urlParams = new URLSearchParams(window.location.search);
    return {
      sku: urlParams.get('sku'),
      securityAccessToken: urlParams.get('securityaccessToken') || '',
      tenentId: urlParams.get('tenentId') || localStorage.getItem('tenentId') || ''
    };
  };

  const { sku, securityAccessToken, tenentId } = getQueryParams();
  const appUrl = process.env.REACT_APP_API_URL || 'https://inocencia-shiftiest-nonodorously.ngrok-free.dev';

  // --- ENHANCED STOCK VALIDATION FUNCTIONS ---

  const validateSingleItemStock = async (
    itemSku: string,
    selectedUnit: string,
    requestedQuantity: number
  ): Promise<StockValidationResult> => {
    if (!securityAccessToken || !tenentId) {
      return { valid: false, availableStock: 0, error: 'Authentication required' };
    }

    try {
      const response = await axios.post(`${appUrl}/api/cartsizeroute/validate-single-item`, {
        securityAccessToken,
        tenentId,
        sku: itemSku,
        selectedUnit,
        requestedQuantity
      });

      return {
        valid: response.data.valid,
        availableStock: response.data.availableStock,
        error: response.data.error,
        stockInfo: response.data.stockInfo
      };
    } catch (error) {
      console.error('Error validating single item stock:', error);
      return {
        valid: false,
        availableStock: 0,
        error: 'Failed to validate stock'
      };
    }
  };

  const validateCartStock = async (): Promise<CartStockValidation> => {
    if (!securityAccessToken || !tenentId) {
      return { valid: false, issues: [], allResults: [] };
    }

    setStockValidationInProgress(true);

    try {
      const response = await axios.post(`${appUrl}/api/cartsizeroute/validate-stock`, {
        securityAccessToken,
        tenentId
      });

      if (response.data && response.data.valid !== undefined) {
        const issues = (response.data.insufficientItems || []).map((item: InsufficientStockItem) => ({
          sku: item.sku,
          productName: item.productName,
          requested: item.requestedQuantity,
          available: item.availableQuantity,
          reason: item.reason
        }));

        setStockIssues(issues);

        return {
          valid: response.data.valid,
          issues,
          allResults: response.data.allResults || []
        };
      }

      return { valid: false, issues: [], allResults: [] };
    } catch (error) {
      console.error('Error validating cart stock:', error);
      return { valid: false, issues: [], allResults: [] };
    } finally {
      setStockValidationInProgress(false);
    }
  };

  const validateStock = validateCartStock;

  // --- DATA FETCHING & SIDE EFFECTS ---

  useEffect(() => {
    if (tenentId) localStorage.setItem('tenentId', tenentId);
  }, [tenentId]);

  useEffect(() => {
    const verifySecurity = async () => {
      if (!securityAccessToken || !tenentId) {
        setError('Missing authentication information');
        setIsLoading(false);
        return;
      }
      try {
        await axios.post(`${appUrl}/api/verifysecurityaccesstokenroute/verify-token`, {
          tenentId, securityAccessToken
        });
      } catch (err) {
        setError('Authentication failed. Please try again.');
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

  const fetchAvailableShippingMethods = async (state: string) => {
    if (!state || !tenentId) {
      setAvailableShippingMethods([]);
      return;
    }

    try {
      console.log(`Fetching shipping methods for state: ${state}`);

      const response = await axios.get(`${appUrl}/api/cartsizeroute/shipping-methods/${tenentId}`, {
        params: { state }
      });

      console.log('Available shipping methods for state:', response.data);

      if (Array.isArray(response.data)) {
        setAvailableShippingMethods(response.data);

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

  useEffect(() => {
    const fetchShippingMethods = async () => {
      try {
        const response = await axios.get(`${appUrl}/api/shippingmethodroute/${tenentId}`);

        if (Array.isArray(response.data)) {
          let fetchedMethods = response.data;

          if (tenentId === TENENT_ID_FOR_FREE_SHIPPING_ONLY) {
            fetchedMethods = fetchedMethods.filter((method: ShippingMethod) => method.type === 'FREE_SHIPPING');

            if (fetchedMethods.length > 0) {
              const freeShippingMethod = fetchedMethods[0];
              const partner: ShippingPartner = {
                id: freeShippingMethod._id || 'free-shipping-default',
                name: "Free Shipping",
                cost: 0
              };
              setSelectedShippingPartner(partner);
              setShippingDetails(prev => ({
                ...prev,
                shippingPartner: partner
              }));
            }
          }

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

  useEffect(() => {
    if (shippingDetails.state && tenentId !== TENANT_ID_ST_COURIER && tenentId !== TENENT_ID_FOR_FREE_SHIPPING_ONLY) {
      fetchAvailableShippingMethods(shippingDetails.state);
    }
  }, [shippingDetails.state]);

  const fetchCartData = async () => {
    if (!securityAccessToken || !tenentId) return;
    try {
      setError(null);
      const response = await axios.get(`${appUrl}/api/cartsizeroute/${securityAccessToken}/${tenentId}`);
      if (response.data && typeof response.data === 'object') {
        setCart({
          items: Array.isArray(response.data.items) ? response.data.items : [],
          total: typeof response.data.total === 'number' ? response.data.total : 0,
          totalWeight: typeof response.data.totalWeight === 'number' ? response.data.totalWeight : 0
        });
      } else {
        setCart({ items: [], total: 0, totalWeight: 0 });
        setError('Received invalid data from the server');
      }
    } catch (error) {
      setError('Failed to load your cart. Please try again.');
    } finally {
      setIsLoading(false);
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
          shippingPartner: (tenentId === TENENT_ID_FOR_FREE_SHIPPING_ONLY || tenentId === TENANT_ID_ST_COURIER) && selectedShippingPartner
            ? selectedShippingPartner
            : (response.data.shippingPartner || null)
        }));
      }
    } catch (error) {
      const axiosError = error as AxiosErrorType;
      console.error('Error fetching address info:', axiosError);
    }
  };

  const addProductToCart = async (productSku: string, quantity: number, selectedUnit: string) => {
    if (!securityAccessToken || !tenentId) return;

    const validation = await validateSingleItemStock(productSku, selectedUnit, quantity);

    if (!validation.valid) {
      toast.error(validation.error || 'Cannot add product - stock validation failed', {
        position: "top-center"
      });
      return;
    }

    try {
      await axios.post(`${appUrl}/api/cartsizeroute/add`, {
        securityAccessToken,
        tenentId,
        sku: productSku,
        quantity,
        selectedUnit
      });

      toast.success('Product added to cart', { position: "top-center" });

      await fetchCartData();
      await validateCartStock();

    } catch (error) {
      const axiosError = error as AxiosErrorType;

      if (axiosError.response?.status === 400) {
        toast.error(axiosError.response.data.message || 'Failed to add product');
      } else {
        toast.error('Failed to add product to cart.');
      }
    }
  };

  useEffect(() => {
    const addProductAndFetchCart = async () => {
      if (sku && securityAccessToken && tenentId) {
        try {
          setIsLoading(true);

          await addProductToCart(sku, 1, "Default");

          const url = new URL(window.location.href);
          url.searchParams.delete('sku');
          window.history.replaceState({}, '', url.toString());

        } catch (error) {
          toast.error('Failed to add product to cart.');
        }
      } else {
        await fetchCartData();
      }

      await validateCartStock();
    };

    if (securityAccessToken && tenentId) {
      addProductAndFetchCart();
    }
  }, [sku, securityAccessToken, tenentId, appUrl]);

  useEffect(() => {
    document.body.style.overflow = isDrawerOpen ? 'hidden' : 'auto';
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

  // --- ENHANCED EVENT HANDLERS ---

  const handleQuantityChange = async (
    itemSku: string,
    selectedUnit: string,
    newQuantity: number,
    currentAvailableStock: number
  ) => {
    if (!securityAccessToken || !tenentId) return;

    if (newQuantity <= 0) {
      await handleRemoveItem(itemSku, selectedUnit);
      return;
    }

    if (newQuantity > currentAvailableStock) {
      toast.error(`Not enough stock. Only ${currentAvailableStock} available.`, {
        position: "top-center"
      });
      return;
    }

    const validation = await validateSingleItemStock(itemSku, selectedUnit, newQuantity);

    if (!validation.valid) {
      toast.error(validation.error || 'Stock validation failed', {
        position: "top-center"
      });

      await fetchCartData();
      return;
    }

    try {
      await axios.put(`${appUrl}/api/cartsizeroute/update`, {
        securityAccessToken,
        tenentId,
        sku: itemSku,
        selectedUnit,
        newQuantity
      });

      await fetchCartData();
      await validateCartStock();

    } catch (err) {
      const axiosError = err as AxiosErrorType;

      if (axiosError.response?.status === 400 &&
          axiosError.response?.data?.message?.includes('stock')) {
        toast.error(axiosError.response.data.message, { position: "top-center" });
      } else {
        toast.error('Failed to update quantity.');
      }

      await fetchCartData();
    }
  };

  const handleRemoveItem = async (itemSku: string, selectedUnit: string) => {
    if (!securityAccessToken || !tenentId) return;

    try {
      await axios.delete(`${appUrl}/api/cartsizeroute/remove`, {
        data: { securityAccessToken, tenentId, sku: itemSku, selectedUnit },
      });
      await fetchCartData();
      await validateCartStock();
      toast.success('Item removed from cart.');
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        console.error('[REMOVE_ITEM] Axios error', {
          status: err.response?.status,
          data: err.response?.data,
          url: err.config?.url,
          method: err.config?.method,
          requestData: err.config?.data,
        });
        const msg =
          (err.response?.data as any)?.message ??
          err.message ??
          'Failed to remove item.';
        toast.error(msg);
      } else {
        console.error('[REMOVE_ITEM] Unknown error', err);
        toast.error('Failed to remove item.');
      }
    }
  };

  const handleClearCart = async () => {
    if (!securityAccessToken || !tenentId) return;
    try {
      await axios.delete(`${appUrl}/api/cartsizeroute/clear`, {
        data: { securityAccessToken, tenentId }
      });
      await fetchCartData();
      setStockIssues([]);
      toast.success('Cart cleared.');
    } catch (error) {
      toast.error('Failed to clear cart.');
    }
  };

  const handleProceedToCheckout = async () => {
    const validation = await validateCartStock();

    if (!validation.valid && validation.issues.length > 0) {
      toast.error('Please resolve stock issues before checkout.');
      return;
    }

    setIsDrawerOpen(true);
    setCheckoutStep('shipping');
    fetchAddressInfo();
  };

  const handleInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setShippingDetails(prev => ({ ...prev, [name]: value }));
    if (name === 'pinCode' && value.length === 6) {
      try {
        const response = await axios.get(`${appUrl}/api/pincoderoute/${value}`);
        if (response.data[0]?.Status === 'Success') {
          const postOffice = response.data[0].PostOffice[0];
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

  const handleShippingPartnerSelect = (method: ShippingMethod) => {
    let cost = 0;

    if (method.type === 'FREE_SHIPPING') {
      const minimumAmount = method.minAmount || 0;
      cost = cart.total >= minimumAmount ? 0 : (method.fixedRate || 0);
    } else {
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

      if (tenentId === TENENT_ID_FOR_FREE_SHIPPING_ONLY && shippingMethods.length > 0) {
        if (!selectedShippingPartner) {
          const freeShippingMethod = shippingMethods.find(method => method.type === 'FREE_SHIPPING');
          if (freeShippingMethod) {
            const partner: ShippingPartner = {
              id: freeShippingMethod._id || 'free-shipping-default',
              name: "Free Shipping",
              cost: 0
            };
            setSelectedShippingPartner(partner);
            setShippingDetails(prev => ({
              ...prev,
              shippingPartner: partner
            }));
            finalShippingPartner = partner;
          }
        }
      }

      if (!shippingDetails.name || !shippingDetails.address || !shippingDetails.pinCode ||
          !shippingDetails.city || !shippingDetails.state || !shippingDetails.phoneNumber ||
          !finalShippingPartner) {
        setError('Please fill in all required fields and select a shipping partner');
        return;
      }

      const requestPayload = {
        securityAccessToken,
        tenentId,
        shippingDetails: {
          name: shippingDetails.name,
          address: shippingDetails.address,
          pinCode: shippingDetails.pinCode,
          city: shippingDetails.city,
          state: shippingDetails.state,
          country: shippingDetails.country,
          phoneNumber: shippingDetails.phoneNumber,
          shippingPartner: finalShippingPartner
        }
      };

      await axios.post(`${appUrl}/api/checkoutroute/save_address`, requestPayload);
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

  const SPECIAL_SHIPPING_PARTNERS = ['Ship Rocket', 'Delhivery'];

  const calculateShippingCost = (): number => {
    const subtotal = cart.total || 0;
    const cartWeight = cart.totalWeight || 0;

    const selectedPartnerId = selectedShippingPartner?.id || shippingDetails.shippingPartner?.id;
    const selectedMethod = shippingMethods.find(m => m._id === selectedPartnerId);

    if (freeShippingThreshold) {
      const currentState = shippingDetails.state;
      if (currentState && freeShippingThreshold.stateThresholds?.length > 0) {
        const stateRule = freeShippingThreshold.stateThresholds.find(
          s => normalizeStateName(s.state) === normalizeStateName(currentState)
        );
        if (stateRule && stateRule.isActive && subtotal >= stateRule.thresholdAmount) {
          return 0;
        }
      }
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
      const validation = await validateCartStock();
      if (!validation.valid && validation.issues.length > 0) {
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

      if (tenentId === TENENT_ID_FOR_FREE_SHIPPING_ONLY && !finalShippingPartner && shippingMethods.length > 0) {
        const freeShippingMethod = shippingMethods.find(method => method.type === 'FREE_SHIPPING');
        if (freeShippingMethod) {
          finalShippingPartner = {
            id: freeShippingMethod._id || 'free-shipping-default',
            name: "Free Shipping",
            cost: 0
          };
        }
      }

      const shippingCost = calculateShippingCost();

      const response = await axios.post(
        `${appUrl}/api/cartsizeroute/create-payment-link`,
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

  const getDisplayShippingMethods = (): ShippingMethod[] => {
    if (tenentId === TENANT_ID_ST_COURIER || tenentId === TENENT_ID_FOR_FREE_SHIPPING_ONLY) {
      return shippingMethods;
    }

    if (shippingDetails.state && availableShippingMethods.length > 0) {
      return availableShippingMethods;
    }

    return shippingMethods;
  };

  // --- RENDER LOGIC ---

  if (isLoading && cart.items.length === 0) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative m-6" role="alert">
        <p className="font-bold">An Error Occurred</p>
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4 sm:p-6">
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

      <ToastContainer position="top-center" autoClose={3000} hideProgressBar={false} />

      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800">Your Cart</h1>
        <a
          href={`/productcatalogsize?tenentId=${tenentId}&securityaccessToken=${securityAccessToken}`}
          className="bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded-md transition-colors text-sm"
        >
          Back to Products
        </a>
      </div>

      {stockValidationInProgress && (
        <div className="flex items-center justify-center p-4 mb-4 bg-blue-50 border border-blue-200 rounded-md">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500 mr-3"></div>
          <p className="text-blue-700">Verifying product stock availability...</p>
        </div>
      )}

      {!cart || cart.items.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow-md">
          <p className="text-gray-500 text-lg mb-4">Your cart is empty.</p>
          <a
            href={`/productcatalogsize?tenentId=${tenentId}&securityaccessToken=${securityAccessToken}`}
            className="text-blue-500 hover:text-blue-700 font-semibold"
          >
            Continue Shopping
          </a>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white rounded-lg shadow-md">
            <div className="divide-y divide-gray-200">
              {cart.items.map((item) => {
                const stockIssue = stockIssues.find(issue => issue.sku === item.sku);
                const hasStockIssue = stockIssue !== undefined;

                return (
                  <div
                    key={`${item.sku}-${item.selectedUnit}`}
                    className={`p-4 ${hasStockIssue ? 'border border-red-500 bg-red-50 rounded-md m-2' : ''}`}
                  >
                    <div className="flex items-start space-x-4">
                      {!!item.productPhotoUrl && (
                        <img
                          src={item.productPhotoUrl}
                          alt={item.productName}
                          className="w-24 h-24 object-cover rounded-lg"
                          onError={(e) => { (e.currentTarget as HTMLImageElement).src = `${appUrl}/default-product-image.jpg`; }}
                        />
                      )}

                      <div className="flex-1">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-semibold text-gray-800">{item.productName}</p>
                            <p className="text-sm text-gray-500">SKU: {item.sku}</p>

                            <div className="mt-1 flex items-center">
                              <span className="text-sm text-gray-600">Selected Size/Unit:</span>
                              <span className="ml-2 px-2 py-1 bg-blue-100 text-blue-800 text-sm font-medium rounded-full">
                                {item.selectedUnit || 'Standard'}
                              </span>
                            </div>

                            {hasStockIssue ? (
                              <div className="text-red-600 text-sm mt-1 flex items-center">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                                Only {stockIssue!.available} available
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
                            onClick={() => handleRemoveItem(item.sku, item.selectedUnit)}
                            className="text-gray-400 hover:text-red-500 p-1"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>

                        {hasStockIssue && (
                          <div className="mt-2 bg-red-100 p-3 rounded-md mb-3">
                            <p className="text-red-700 text-sm font-medium">
                              {stockIssue!.available === 0
                                ? "No stock available"
                                : `You selected ${stockIssue!.requested} but only ${stockIssue!.available} are available`
                              }
                              {stockIssue!.reason ? ` (${stockIssue!.reason})` : ''}
                            </p>
                            <div className="flex space-x-2 mt-2">
                              {stockIssue!.available > 0 && (
                                <button
                                  onClick={() => handleQuantityChange(item.sku, item.selectedUnit, stockIssue!.available, stockIssue!.available)}
                                  className="bg-blue-600 text-white text-sm px-3 py-1 rounded-md hover:bg-blue-700 flex items-center"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4" />
                                  </svg>
                                  Update to {stockIssue!.available}
                                </button>
                              )}
                              <button
                                onClick={() => handleRemoveItem(item.sku, item.selectedUnit)}
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

                        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">Quantity</label>
                            <div className="flex items-center border rounded-md w-min">
                              <button
                                onClick={() => handleQuantityChange(item.sku, item.selectedUnit, item.quantity - 1, item.quantityInStock)}
                                className="px-3 py-1 font-bold text-gray-600 hover:bg-gray-100 rounded-l-md"
                              >
                                -
                              </button>
                              <span className="px-4 py-1 text-sm">{item.quantity}</span>
                              <button
                                onClick={() => handleQuantityChange(item.sku, item.selectedUnit, item.quantity + 1, item.quantityInStock)}
                                className="px-3 py-1 font-bold text-gray-600 hover:bg-gray-100 rounded-r-md disabled:opacity-50"
                                disabled={hasStockIssue && item.quantity >= stockIssue!.available}
                              >
                                +
                              </button>
                            </div>
                          </div>

                          <div className="text-left md:text-right">
                            <p className="text-sm text-gray-600">₹{item.price.toFixed(2)} each</p>
                            <p className="font-semibold text-lg text-gray-800">₹{(item.price * item.quantity).toFixed(2)}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-md p-6 sticky top-6">
              <h2 className="text-xl font-semibold mb-4 text-gray-800">Order Summary</h2>
              <div className="space-y-3 mb-4">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span className="font-medium">₹{cart.total.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-gray-500">
                  <span>Shipping</span>
                  <span>Calculated at checkout</span>
                </div>
                 {freeShippingThreshold && (() => {
                  const currentState = shippingDetails.state;
                  let stateRule = null;
                  if (currentState && freeShippingThreshold.stateThresholds?.length > 0) {
                    stateRule = freeShippingThreshold.stateThresholds.find(
                      s => normalizeStateName(s.state) === normalizeStateName(currentState)
                    );
                  }
                  const activeRule = stateRule?.isActive ? stateRule : (freeShippingThreshold.isActive ? freeShippingThreshold : null);
                  return activeRule ? (
                    <div className="flex justify-between text-sm text-green-600">
                      <span>Free Shipping Threshold{stateRule?.isActive ? ` (${currentState})` : ''}</span>
                      <span>₹{activeRule.thresholdAmount.toFixed(2)}</span>
                    </div>
                  ) : null;
                })()}
              </div>
              <div className="border-t border-gray-200 pt-4">
                <div className="flex justify-between font-bold text-lg text-gray-800">
                  <span>Total</span>
                  <span>₹{cart.total.toFixed(2)}</span>
                </div>
              </div>

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
                    className="w-full flex items-center justify-center bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg text-lg transition-colors mt-6"
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
                    className="w-full bg-gray-400 cursor-not-allowed text-white py-3 rounded-lg text-lg mt-3"
                  >
                    Proceed to Checkout
                  </button>

                  <p className="text-red-500 text-sm mt-1 text-center">
                    Please resolve stock issues before checkout
                  </p>
                </>
              ) : (
                <>
                  <button
                    onClick={handleProceedToCheckout}
                    className="w-full mt-6 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg text-lg transition-all duration-300 shadow-lg hover:shadow-xl"
                  >
                    Proceed to Checkout
                  </button>
                  <button onClick={handleClearCart} className="w-full mt-4 text-sm text-red-500 hover:text-red-700">
                    Clear Cart
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      <div
        className={`fixed inset-0 bg-black bg-opacity-50 z-40 transition-opacity ${isDrawerOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={() => setIsDrawerOpen(false)}
      />

      <div
        className={`fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl z-50 p-6 shadow-2xl transform transition-transform duration-300 ease-in-out ${isDrawerOpen ? 'translate-y-0' : 'translate-y-full'}`}
        style={{ maxHeight: '90vh', overflowY: 'auto' }}
      >
        {checkoutStep === 'shipping' && (
          <div className="h-full flex flex-col">
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
                  {shippingDetails.state && tenentId !== TENANT_ID_ST_COURIER && tenentId !== TENENT_ID_FOR_FREE_SHIPPING_ONLY && (
                    <p className="text-xs text-blue-600 mt-1">
                      Showing methods available for {shippingDetails.state}
                    </p>
                  )}
                </div>

                {(tenentId === TENANT_ID_ST_COURIER || tenentId === TENENT_ID_FOR_FREE_SHIPPING_ONLY) ? (
                  <div className="p-4 bg-green-50 border-2 border-green-200 rounded-lg">
                    <div className="flex items-center">
                      <svg className="w-6 h-6 text-green-500 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <div>
                        <span className="text-green-800 text-lg font-medium">
                          {tenentId === TENANT_ID_ST_COURIER ? 'ST Courier' : 'Free Shipping'}
                        </span>
                        <p className="text-green-600 text-sm">Auto-selected shipping partner</p>
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
          <div>
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
                <span>Managed by {tenentId ? "Your Shop" : "Shop"}. </span>
                <a href="#" className="text-pink-500 ml-1">Learn more</a>
              </p>
            </div>
          </div>
        )}

        {checkoutStep === 'payment' && (
          <div>
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
                      key={`${item.sku}-${item.selectedUnit}`}
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
                          <div className="text-xs text-blue-600 mt-1">
                            Unit: {item.selectedUnit || 'Standard'}
                          </div>
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
                                onClick={() => handleQuantityChange(item.sku, item.selectedUnit, stockIssue.available, stockIssue.available)}
                                className="bg-blue-600 text-white text-sm px-3 py-1 rounded-md hover:bg-blue-700 flex items-center"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4" />
                                </svg>
                                Update to {stockIssue.available}
                              </button>
                            )}
                            <button
                              onClick={() => handleRemoveItem(item.sku, item.selectedUnit)}
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
              {cart.totalWeight && cart.totalWeight > 0 && (
                <div className="flex justify-between text-sm text-gray-500 mb-2">
                  <span>Total Weight</span>
                  <span>{cart.totalWeight.toFixed(2)} kg</span>
                </div>
              )}
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
    </div>
  );
};

export default CartPageSize;

