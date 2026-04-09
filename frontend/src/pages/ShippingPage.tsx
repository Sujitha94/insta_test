import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import Swal from 'sweetalert2';

// Custom SweetAlert styles
const customSwalStyles = `
  .swal2-popup {
    border-radius: 10px !important;
    padding: 1.5rem !important;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
    width: 400px !important;
    max-width: 90vw !important;
    min-height: auto !important;
  }
  .swal2-icon.swal2-warning {
    border-color: #f59e0b !important;
    color: #f59e0b !important;
    font-size: 2rem !important;
    width: 60px !important;
    height: 60px !important;
    margin: 0 auto 1rem auto !important;
  }
  .swal2-title {
    font-size: 1.5rem !important;
    font-weight: 600 !important;
    color: #374151 !important;
    margin: 0 0 0.5rem 0 !important;
  }
  .swal2-html-container {
    font-size: 0.9rem !important;
    color: #6b7280 !important;
    margin: 0 0 1.25rem 0 !important;
  }
  .swal2-actions { margin-top: 1.25rem !important; gap: 0.75rem !important; }
  .swal2-confirm {
    background-color: #dc2626 !important;
    border-radius: 4px !important;
    padding: 0.6rem 1.25rem !important;
    font-size: 0.875rem !important;
  }
  .swal2-cancel {
    background-color: #ea580c !important;
    border-radius: 4px !important;
    padding: 0.6rem 1.25rem !important;
    color: white !important;
  }
`;

if (typeof document !== 'undefined') {
  const styleId = 'shipping-swal-styles';
  if (!document.getElementById(styleId)) {
    const el = document.createElement('style');
    el.id = styleId;
    el.textContent = customSwalStyles;
    document.head.appendChild(el);
  }
}

const INDIAN_STATES = [
  "Andaman and Nicobar Islands","Andhra Pradesh","Arunachal Pradesh","Assam","Bihar",
  "Chandigarh","Chhattisgarh","Dadra and Nagar Haveli and Daman and Diu","Delhi","Goa",
  "Gujarat","Haryana","Himachal Pradesh","Jammu and Kashmir","Jharkhand","Karnataka",
  "Kerala","Ladakh","Lakshadweep","Madhya Pradesh","Maharashtra","Manipur","Meghalaya",
  "Mizoram","Nagaland","Odisha","Puducherry","Punjab","Rajasthan","Sikkim","Tamil Nadu",
  "Telangana","Tripura","Uttar Pradesh","Uttarakhand","West Bengal"
];

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface StateThreshold {
  state: string;
  thresholdAmount: number;
  isActive: boolean;
}

interface RegionRate {
  regions: string[];
  price: number;
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

interface ShippingMethod {
  _id?: string;
  tenentId: string;
  name: string;
  type: 'FREE_SHIPPING' | 'COURIER_PARTNER';
  minAmount?: number;
  defaultPrice?: number;
  useWeight: boolean;
  ratePerKg?: number;
  fixedRate?: number;
  regionRates?: RegionRate[];
  useRegionWeight?: boolean;
  regionWeightConfigs?: RegionWeightConfig[];
  isPanIndia?: boolean;
  excludedRegions?: string[];
  isActive: boolean;
}

interface FreeShippingThreshold {
  _id?: string;
  tenentId: string;
  thresholdAmount: number;
  isActive: boolean;
  stateThresholds: StateThreshold[];
}

// ─── MultiSelect Component ────────────────────────────────────────────────────

interface MultiSelectProps {
  options: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
  className?: string;
}

const MultiSelect: React.FC<MultiSelectProps> = ({
  options, selected, onChange, placeholder = "Select options...", className = ""
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const toggleOption = (option: string) => {
    onChange(selected.includes(option) ? selected.filter(i => i !== option) : [...selected, option]);
  };

  const filtered = options.filter(o => o.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-white border border-gray-300 rounded-md p-2 text-left flex justify-between items-center text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 min-h-[42px]"
      >
        <span className="block truncate text-gray-700">
          {selected.length === 0
            ? <span className="text-gray-400">{placeholder}</span>
            : selected.length === 1 ? selected[0] : `${selected.length} regions selected`}
        </span>
        <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      </button>
      {isOpen && (
        <div className="absolute z-50 mt-1 w-full bg-white shadow-lg rounded-md py-1 text-base ring-1 ring-black ring-opacity-5 overflow-hidden sm:text-sm">
          <div className="p-2 border-b border-gray-100">
            <input
              type="text"
              className="w-full p-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:border-orange-500"
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onClick={(e) => e.stopPropagation()}
            />
          </div>
          <div className="max-h-60 overflow-auto">
            {filtered.length > 0 ? filtered.map(option => (
              <div key={option} className="flex items-center px-4 py-2 hover:bg-gray-50 cursor-pointer" onClick={() => toggleOption(option)}>
                <input type="checkbox" checked={selected.includes(option)} readOnly className="h-4 w-4 text-orange-600 border-gray-300 rounded mr-3 pointer-events-none" />
                <span className={`block truncate ${selected.includes(option) ? 'font-medium text-orange-900' : 'text-gray-900'}`}>{option}</span>
              </div>
            )) : <div className="px-4 py-2 text-gray-500 text-sm">No regions found</div>}
          </div>
          <div className="p-2 border-t border-gray-100 bg-gray-50 flex justify-between">
            <button onClick={() => onChange(options)} className="text-xs text-orange-600 hover:text-orange-800 font-medium">Select All</button>
            <button onClick={() => onChange([])} className="text-xs text-gray-500 hover:text-gray-700">Clear</button>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── StateThresholdRow ────────────────────────────────────────────────────────

interface StateThresholdRowProps {
  row: StateThreshold;
  index: number;
  usedStates: string[];
  onChange: (index: number, updates: Partial<StateThreshold>) => void;
  onRemove: (index: number) => void;
}

const StateThresholdRow: React.FC<StateThresholdRowProps> = ({ row, index, usedStates, onChange, onRemove }) => {
  const availableStates = INDIAN_STATES.filter(s => s === row.state || !usedStates.includes(s));

  return (
    <div className="grid grid-cols-12 gap-3 items-center bg-white border border-gray-200 rounded-lg p-3 shadow-sm">
      {/* State selector */}
      <div className="col-span-5">
        <select
          value={row.state}
          onChange={(e) => onChange(index, { state: e.target.value })}
          className="w-full p-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 bg-white"
        >
          <option value="">— Select State —</option>
          {availableStates.map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {/* Amount */}
      <div className="col-span-4">
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm font-medium">₹</span>
          <input
            type="number"
            value={row.thresholdAmount || ''}
            onChange={(e) => onChange(index, { thresholdAmount: parseFloat(e.target.value) || 0 })}
            className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            placeholder="Min amount"
            min="0"
            step="0.01"
          />
        </div>
      </div>

      {/* Active toggle */}
      <div className="col-span-2 flex justify-center">
        <button
          type="button"
          onClick={() => onChange(index, { isActive: !row.isActive })}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${row.isActive ? 'bg-orange-500' : 'bg-gray-300'}`}
        >
          <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${row.isActive ? 'translate-x-6' : 'translate-x-1'}`} />
        </button>
      </div>

      {/* Remove */}
      <div className="col-span-1 flex justify-center">
        <button
          type="button"
          onClick={() => onRemove(index)}
          className="text-red-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded-full transition-colors"
          title="Remove"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────

const ShippingPage: React.FC = () => {
  const [methods, setMethods] = useState<ShippingMethod[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState<number | null>(null);

  // Free Shipping Threshold state
  const [freeShippingThreshold, setFreeShippingThreshold] = useState<number>(0);
  const [isThresholdActive, setIsThresholdActive] = useState<boolean>(false);
  const [stateThresholds, setStateThresholds] = useState<StateThreshold[]>([]);
  const [isEditingThreshold, setIsEditingThreshold] = useState<boolean>(false);
  const [activeThresholdTab, setActiveThresholdTab] = useState<'global' | 'state'>('global');

  const tenentId = localStorage.getItem('tenentid') || 'test-tenant';
  const appUrl = process.env.REACT_APP_API_URL || 'https://inocencia-shiftiest-nonodorously.ngrok-free.dev';

  // ─── Data Fetching ──────────────────────────────────────────────────────────

  const fetchShippingMethods = async () => {
    try {
      setError(null);
      setIsLoading(true);
      try {
        const response = await axios.get(`${appUrl}/api/shippingmethodroute/${tenentId}`);
        if (Array.isArray(response.data)) {
          const normalized = response.data.map((m: any) => ({
            ...m,
            regionRates: (Array.isArray(m.regionRates) ? m.regionRates : []).map((rr: any) => ({
              ...rr, regions: Array.isArray(rr.regions) ? rr.regions : (rr.region ? [rr.region] : [])
            })),
            regionWeightConfigs: (Array.isArray(m.regionWeightConfigs) ? m.regionWeightConfigs : []).map((rw: any) => ({
              ...rw, regions: Array.isArray(rw.regions) ? rw.regions : (rw.region ? [rw.region] : [])
            })),
            isPanIndia: m.isPanIndia || false,
            excludedRegions: Array.isArray(m.excludedRegions) ? m.excludedRegions : [],
          }));
          setMethods(normalized);
        } else {
          setMethods([]);
        }
      } catch {
        setMethods([]);
      }
    } catch (error: any) {
      setError('Failed to load shipping methods. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchFreeShippingThreshold = async () => {
    try {
      const response = await axios.get<FreeShippingThreshold>(`${appUrl}/api/shippingmethodroute/threshold/${tenentId}`);
      if (response.data) {
        setFreeShippingThreshold(response.data.thresholdAmount || 0);
        setIsThresholdActive(response.data.isActive || false);
        setStateThresholds(Array.isArray(response.data.stateThresholds) ? response.data.stateThresholds : []);
      }
    } catch {
      setFreeShippingThreshold(0);
      setIsThresholdActive(false);
      setStateThresholds([]);
    }
  };

  useEffect(() => {
    if (tenentId) {
      fetchShippingMethods();
      fetchFreeShippingThreshold();
    }
  }, [tenentId]);

  // ─── Threshold Handlers ─────────────────────────────────────────────────────

  const handleSaveThreshold = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await axios.post(`${appUrl}/api/shippingmethodroute/threshold`, {
        tenentId,
        thresholdAmount: freeShippingThreshold,
        isActive: isThresholdActive,
        stateThresholds
      });

      if (response.data?.threshold) {
        setFreeShippingThreshold(response.data.threshold.thresholdAmount);
        setIsThresholdActive(response.data.threshold.isActive);
        setStateThresholds(response.data.threshold.stateThresholds || []);
      }

      setIsEditingThreshold(false);
      await Swal.fire({ title: 'Saved!', text: 'Free shipping threshold has been saved successfully.', icon: 'success', timer: 2000, showConfirmButton: false });
    } catch {
      setIsEditingThreshold(false);
      await Swal.fire({ title: 'Saved (Demo)!', text: 'Threshold saved locally.', icon: 'success', timer: 2000 });
    } finally {
      setIsLoading(false);
    }
  };

  // State threshold row helpers
  const addStateThreshold = () => {
    setStateThresholds(prev => [...prev, { state: '', thresholdAmount: 0, isActive: true }]);
  };

  const updateStateThreshold = (index: number, updates: Partial<StateThreshold>) => {
    setStateThresholds(prev => prev.map((row, i) => i === index ? { ...row, ...updates } : row));
  };

  const removeStateThreshold = (index: number) => {
    setStateThresholds(prev => prev.filter((_, i) => i !== index));
  };

  const usedStates = stateThresholds.map(s => s.state).filter(Boolean);

  // ─── Method Handlers ────────────────────────────────────────────────────────

  const handleAddMethod = () => {
    const newMethod: ShippingMethod = {
      tenentId, name: '', type: 'COURIER_PARTNER',
      defaultPrice: 0, useWeight: false, isActive: true,
      regionRates: [], useRegionWeight: false, regionWeightConfigs: [],
      isPanIndia: false, excludedRegions: []
    };
    setMethods([newMethod, ...methods]);
    setIsEditing(0);
  };

  const handleMethodSave = async (method: ShippingMethod, index: number) => {
    if (!method.name) { setError('Please enter a method name'); return; }
    if (method.type === 'COURIER_PARTNER') {
      const hasFixed = method.fixedRate !== undefined && method.fixedRate !== null;
      const hasRegionRates = method.regionRates && method.regionRates.length > 0;
      const hasRegionWeight = method.useRegionWeight && method.regionWeightConfigs && method.regionWeightConfigs.length > 0;
      if (!method.useWeight && !hasFixed && !hasRegionRates && !hasRegionWeight) {
        setError('Please configure at least one pricing model.'); return;
      }
    }

    setIsLoading(true); setError(null);
    try {
      const url = method._id
        ? `${appUrl}/api/shippingmethodroute/update/${method._id}`
        : `${appUrl}/api/shippingmethodroute/create`;

      const response = await axios[method._id ? 'put' : 'post'](url, { ...method, tenentId });
      const savedMethod = response.data.method || response.data;
      const updatedMethods = [...methods];
      updatedMethods[index] = {
        ...savedMethod,
        regionRates: (Array.isArray(savedMethod.regionRates) ? savedMethod.regionRates : []).map((rr: any) => ({
          ...rr, regions: Array.isArray(rr.regions) ? rr.regions : (rr.region ? [rr.region] : [])
        })),
        regionWeightConfigs: (Array.isArray(savedMethod.regionWeightConfigs) ? savedMethod.regionWeightConfigs : []).map((rw: any) => ({
          ...rw, regions: Array.isArray(rw.regions) ? rw.regions : (rw.region ? [rw.region] : [])
        })),
        excludedRegions: Array.isArray(savedMethod.excludedRegions) ? savedMethod.excludedRegions : []
      };
      setMethods(updatedMethods);
      setIsEditing(null);
      await Swal.fire({ title: 'Saved!', text: 'Shipping method saved successfully.', icon: 'success', timer: 2000, showConfirmButton: false });
    } catch {
      setIsEditing(null);
      await Swal.fire({ title: 'Saved (Demo)', text: 'Saved locally for demonstration.', icon: 'success', timer: 1500 });
    } finally {
      setIsLoading(false);
    }
  };

  const handleMethodDelete = async (id: string) => {
    const result = await Swal.fire({
      title: 'Are you sure?', text: "You won't be able to revert this!", icon: 'warning',
      showCancelButton: true, confirmButtonColor: '#d33', cancelButtonColor: '#ea580c',
      confirmButtonText: 'Yes, delete it!', customClass: { popup: 'swal2-popup' }
    });
    if (result.isConfirmed) {
      try { await axios.delete(`${appUrl}/api/shippingmethodroute/delete/${id}`, { data: { tenentId } }); } catch {}
      setMethods(methods.filter(m => m._id !== id));
      await Swal.fire({ title: 'Deleted!', text: 'Shipping method deleted.', icon: 'success', timer: 1500, customClass: { popup: 'swal2-popup' } });
    }
  };

  const updateMethodField = (index: number, updates: Partial<ShippingMethod>) => {
    const updated = [...methods];
    updated[index] = { ...updated[index], ...updates };
    setMethods(updated);
  };

  const addRegionRate = (index: number) => {
    const updated = [...methods];
    updated[index].regionRates = [...(updated[index].regionRates || []), { regions: [], price: 0 }];
    setMethods(updated);
  };
  const updateRegionRateRegions = (mi: number, ri: number, newRegions: string[]) => {
    const updated = [...methods];
    updated[mi].regionRates![ri] = { ...updated[mi].regionRates![ri], regions: newRegions };
    setMethods(updated);
  };
  const updateRegionRatePrice = (mi: number, ri: number, price: number) => {
    const updated = [...methods];
    updated[mi].regionRates![ri] = { ...updated[mi].regionRates![ri], price };
    setMethods(updated);
  };
  const removeRegionRate = (mi: number, ri: number) => {
    const updated = [...methods];
    updated[mi].regionRates = updated[mi].regionRates!.filter((_, i) => i !== ri);
    setMethods(updated);
  };

  const addRegionWeightConfig = (mi: number) => {
    const updated = [...methods];
    updated[mi].regionWeightConfigs = [...(updated[mi].regionWeightConfigs || []), { regions: [], weightRanges: [{ minWeight: 0, maxWeight: 1, price: 0 }] }];
    setMethods(updated);
  };
  const removeRegionWeightConfig = (mi: number, ci: number) => {
    const updated = [...methods];
    updated[mi].regionWeightConfigs = updated[mi].regionWeightConfigs!.filter((_, i) => i !== ci);
    setMethods(updated);
  };
  const updateRegionWeightConfigRegions = (mi: number, ci: number, regions: string[]) => {
    const updated = [...methods];
    updated[mi].regionWeightConfigs![ci].regions = regions;
    setMethods(updated);
  };
  const addWeightRangeToRegion = (mi: number, ci: number) => {
    const updated = [...methods];
    updated[mi].regionWeightConfigs![ci].weightRanges.push({ minWeight: 0, maxWeight: 0, price: 0 });
    setMethods(updated);
  };
  const removeWeightRangeFromRegion = (mi: number, ci: number, ri: number) => {
    const updated = [...methods];
    updated[mi].regionWeightConfigs![ci].weightRanges = updated[mi].regionWeightConfigs![ci].weightRanges.filter((_, i) => i !== ri);
    setMethods(updated);
  };
  const updateWeightRangeInRegion = (mi: number, ci: number, ri: number, field: keyof WeightRange, value: number) => {
    const updated = [...methods];
    updated[mi].regionWeightConfigs![ci].weightRanges[ri] = { ...updated[mi].regionWeightConfigs![ci].weightRanges[ri], [field]: value };
    setMethods(updated);
  };

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-100 p-6 pb-28">
      <h1 className="text-2xl font-bold mb-6 text-gray-800">Shipping Methods</h1>

      {error && (
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6 rounded shadow-sm">
          <p className="font-medium">Error</p><p>{error}</p>
        </div>
      )}

      {/* ── Free Shipping Threshold Section ── */}
      <div className="bg-gradient-to-r from-orange-50 to-amber-50 rounded-lg shadow-sm mb-6 p-6 border border-orange-200">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900 flex items-center">
              <svg className="w-6 h-6 mr-2 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Free Shipping Threshold
            </h2>
            <p className="text-sm text-gray-600 mt-1">Set a minimum order amount for free shipping — globally or per state</p>
          </div>
          {!isEditingThreshold && (
            <button
              onClick={() => setIsEditingThreshold(true)}
              className="bg-orange-600 hover:bg-orange-700 text-white py-2 px-4 rounded-lg font-medium transition-colors disabled:opacity-50"
              disabled={isLoading}
            >
              Edit Threshold
            </button>
          )}
        </div>

        {isEditingThreshold ? (
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
            {/* Tabs */}
            <div className="flex border-b border-gray-200">
              <button
                type="button"
                onClick={() => setActiveThresholdTab('global')}
                className={`flex-1 py-3 text-sm font-semibold transition-colors ${activeThresholdTab === 'global' ? 'bg-orange-50 text-orange-700 border-b-2 border-orange-500' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}
              >
                🌍 Global Threshold
              </button>
              <button
                type="button"
                onClick={() => setActiveThresholdTab('state')}
                className={`flex-1 py-3 text-sm font-semibold transition-colors ${activeThresholdTab === 'state' ? 'bg-orange-50 text-orange-700 border-b-2 border-orange-500' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}
              >
                📍 State-wise Thresholds
                {stateThresholds.length > 0 && (
                  <span className="ml-2 bg-orange-500 text-white text-xs rounded-full px-1.5 py-0.5">{stateThresholds.length}</span>
                )}
              </button>
            </div>

            <div className="p-5">
              {activeThresholdTab === 'global' ? (
                <div className="space-y-4">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="thresholdActive"
                      checked={isThresholdActive}
                      onChange={(e) => setIsThresholdActive(e.target.checked)}
                      className="w-5 h-5 mr-3 rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                    />
                    <label htmlFor="thresholdActive" className="text-gray-900 font-medium cursor-pointer">
                      Enable Global Free Shipping Threshold
                    </label>
                  </div>
                  {isThresholdActive && (
                    <div>
                      <label className="block text-gray-700 mb-2 font-medium text-sm">
                        Minimum Order Amount for Free Shipping (₹)
                      </label>
                      <input
                        type="number"
                        value={freeShippingThreshold || ''}
                        onChange={(e) => setFreeShippingThreshold(parseFloat(e.target.value) || 0)}
                        className="w-full max-w-xs p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                        placeholder="Enter minimum order amount"
                        min="0" step="0.01"
                      />
                      <p className="text-xs text-gray-500 mt-1">Applies to all orders unless a state-specific rule overrides it.</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-sm text-gray-600">
                        Set different minimum amounts per state. State rules <span className="font-semibold text-orange-700">override</span> the global threshold.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={addStateThreshold}
                      disabled={stateThresholds.length >= INDIAN_STATES.length}
                      className="bg-orange-600 hover:bg-orange-700 text-white text-sm py-2 px-4 rounded-lg transition-colors disabled:opacity-50 whitespace-nowrap"
                    >
                      + Add State Rule
                    </button>
                  </div>

                  {stateThresholds.length > 0 ? (
                    <div className="space-y-3">
                      {/* Header row */}
                      <div className="grid grid-cols-12 gap-3 px-1">
                        <div className="col-span-5 text-xs font-semibold text-gray-500 uppercase tracking-wide">State</div>
                        <div className="col-span-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Min Amount</div>
                        <div className="col-span-2 text-xs font-semibold text-gray-500 uppercase tracking-wide text-center">Active</div>
                        <div className="col-span-1"></div>
                      </div>
                      {stateThresholds.map((row, i) => (
                        <StateThresholdRow
                          key={i}
                          row={row}
                          index={i}
                          usedStates={usedStates}
                          onChange={updateStateThreshold}
                          onRemove={removeStateThreshold}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 text-sm">
                      <svg className="w-10 h-10 mx-auto text-gray-300 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      No state-specific rules yet. Click "+ Add State Rule" to create one.
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-end space-x-3 pt-5 mt-5 border-t border-gray-100">
                <button
                  onClick={() => { setIsEditingThreshold(false); fetchFreeShippingThreshold(); }}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 px-6 rounded-md font-medium transition-colors"
                  disabled={isLoading}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveThreshold}
                  className="bg-orange-600 hover:bg-orange-700 text-white py-2 px-6 rounded-md font-medium disabled:opacity-50 transition-colors"
                  disabled={isLoading}
                >
                  {isLoading ? 'Saving...' : 'Save Threshold'}
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* Display mode */
          <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm space-y-3">
            {/* Global threshold display */}
            {isThresholdActive ? (
              <div className="flex items-center">
                <svg className="w-5 h-5 text-orange-500 mr-2 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span className="text-gray-900 font-medium">Global: Free shipping on orders above ₹{freeShippingThreshold.toFixed(2)}</span>
              </div>
            ) : (
              <div className="flex items-center text-gray-500">
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                </svg>
                <span>Global free shipping threshold is disabled</span>
              </div>
            )}

            {/* State thresholds display */}
            {stateThresholds.length > 0 && (
              <div className="border-t border-gray-100 pt-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">State-specific Rules</p>
                <div className="flex flex-wrap gap-2">
                  {stateThresholds.map((st, i) => (
                    <span key={i} className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium ${st.isActive ? 'bg-orange-100 text-orange-800' : 'bg-gray-100 text-gray-500 line-through'}`}>
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                      </svg>
                      {st.state}: ₹{st.thresholdAmount}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Shipping Methods Section ── */}
      {isLoading && !isEditingThreshold && methods.length === 0 ? (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600"></div>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm overflow-hidden border border-gray-200">
          <div className="flex justify-between items-center p-6 border-b bg-gray-50">
            <h2 className="text-lg font-semibold text-gray-800">Current Shipping Methods</h2>
            <button
              onClick={handleAddMethod}
              className="bg-orange-600 hover:bg-orange-700 text-white py-2 px-4 rounded-lg shadow-sm transition-colors disabled:opacity-50 text-sm font-medium"
              disabled={isEditing !== null}
            >
              + Add New Method
            </button>
          </div>

          {methods.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
              <p>No shipping methods found. Click "Add New Method" to create one.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {methods.map((method, index) => (
                <div key={method._id || index} className="p-6 transition-colors hover:bg-gray-50">
                  {isEditing === index ? (
                    <div className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <label className="block text-gray-700 mb-2 font-medium">Method Name</label>
                          <input
                            type="text"
                            value={method.name}
                            onChange={(e) => updateMethodField(index, { name: e.target.value })}
                            className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                            placeholder="e.g., BlueDart, FedEx"
                          />
                        </div>
                        <div>
                          <label className="block text-gray-700 mb-2 font-medium">Shipping Type</label>
                          <select
                            value={method.type}
                            onChange={(e) => {
                              const newType = e.target.value as ShippingMethod['type'];
                              updateMethodField(index, {
                                type: newType,
                                ...(newType === 'FREE_SHIPPING' ? { useWeight: false, ratePerKg: undefined, fixedRate: undefined, regionRates: [], useRegionWeight: false, regionWeightConfigs: [] } : {})
                              });
                            }}
                            className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none bg-white"
                          >
                            <option value="FREE_SHIPPING">Free Shipping</option>
                            <option value="COURIER_PARTNER">Courier Partner</option>
                          </select>
                        </div>
                      </div>

                      {method.type === 'FREE_SHIPPING' && (
                        <div>
                          <label className="block text-gray-700 mb-2 font-medium">Minimum Order Amount (Optional)</label>
                          <input
                            type="number"
                            value={method.minAmount || ''}
                            onChange={(e) => updateMethodField(index, { minAmount: parseFloat(e.target.value) || undefined })}
                            className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500"
                            placeholder="Leave empty for completely free"
                            min="0" step="0.01"
                          />
                        </div>
                      )}

                      {method.type === 'COURIER_PARTNER' && (
                        <div className="space-y-4">
                          {/* Default Price */}
                          <div className="bg-gradient-to-r from-yellow-50 to-orange-50 border-2 border-yellow-300 rounded-lg p-5">
                            <div className="flex items-start">
                              <svg className="w-6 h-6 text-yellow-600 mr-2 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              <div className="flex-1">
                                <label className="block text-gray-900 font-bold text-base mb-1">Default Base Price (₹)</label>
                                <p className="text-sm text-gray-600 mb-3">Always applied to every order. Additional charges are added on top.</p>
                                <input
                                  type="number"
                                  value={method.defaultPrice ?? 0}
                                  onChange={(e) => updateMethodField(index, { defaultPrice: parseFloat(e.target.value) || 0 })}
                                  className="w-full max-w-xs p-3 border-2 border-yellow-300 rounded-md focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 outline-none bg-white font-medium"
                                  placeholder="Enter default base price"
                                  min="0" step="0.01"
                                />
                              </div>
                            </div>
                          </div>

                          {/* Region & Weight Pricing */}
                          {!method.isPanIndia && (
                            <div className="bg-orange-50 border border-orange-200 rounded-lg p-5">
                              <div className="flex items-center mb-2">
                                <input
                                  type="checkbox"
                                  id={`useRegionWeight-${index}`}
                                  checked={method.useRegionWeight || false}
                                  onChange={(e) => updateMethodField(index, { useRegionWeight: e.currentTarget.checked, useWeight: e.currentTarget.checked ? false : method.useWeight, regionWeightConfigs: method.regionWeightConfigs || [] })}
                                  className="w-5 h-5 mr-3 text-orange-600 rounded border-gray-300 focus:ring-orange-500"
                                />
                                <div>
                                  <label htmlFor={`useRegionWeight-${index}`} className="text-gray-900 font-bold cursor-pointer text-base">Use Region & Weight-Based Pricing</label>
                                  <p className="text-sm text-gray-600">Different pricing for different regions and weight ranges</p>
                                </div>
                              </div>
                              {method.useRegionWeight && (
                                <div className="mt-4 space-y-6">
                                  <div className="flex justify-between items-center">
                                    <h3 className="font-semibold text-gray-800">Region Pricing Configuration</h3>
                                    <button onClick={() => addRegionWeightConfig(index)} className="bg-orange-600 hover:bg-orange-700 text-white text-sm py-2 px-4 rounded shadow-sm transition-colors">+ Add Region Group</button>
                                  </div>
                                  {(method.regionWeightConfigs && method.regionWeightConfigs.length > 0) ? method.regionWeightConfigs.map((config, ci) => (
                                    <div key={ci} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                                      <div className="flex justify-between items-start mb-4">
                                        <div className="w-full max-w-lg">
                                          <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">Select Regions/States</label>
                                          <MultiSelect options={INDIAN_STATES} selected={config.regions} onChange={(r) => updateRegionWeightConfigRegions(index, ci, r)} placeholder="Select states..." />
                                        </div>
                                        <button onClick={() => removeRegionWeightConfig(index, ci)} className="bg-red-500 hover:bg-red-600 text-white text-xs py-2 px-3 rounded ml-4 transition-colors shrink-0">Remove Group</button>
                                      </div>
                                      <div className="bg-gray-50 p-3 rounded border border-gray-100">
                                        <div className="flex justify-between items-center mb-2">
                                          <span className="text-sm font-medium text-gray-700">Weight Ranges</span>
                                          <button onClick={() => addWeightRangeToRegion(index, ci)} className="text-orange-600 text-xs font-medium hover:text-orange-800 bg-orange-50 hover:bg-orange-100 px-2 py-1 rounded">+ Add Range</button>
                                        </div>
                                        {config.weightRanges.length > 0 && (
                                          <div className="grid grid-cols-10 gap-2 mb-1 text-xs text-gray-500 font-medium px-1">
                                            <div className="col-span-3">Min Weight (kg)</div>
                                            <div className="col-span-3">Max Weight (kg)</div>
                                            <div className="col-span-3">Price (₹)</div>
                                            <div className="col-span-1"></div>
                                          </div>
                                        )}
                                        <div className="space-y-2">
                                          {config.weightRanges.map((range, ri) => (
                                            <div key={ri} className="grid grid-cols-10 gap-2 items-center">
                                              <div className="col-span-3"><input type="number" value={range.minWeight} onChange={(e) => updateWeightRangeInRegion(index, ci, ri, 'minWeight', parseFloat(e.target.value))} className="w-full p-2 border border-gray-300 rounded text-sm" min="0" step="0.01" /></div>
                                              <div className="col-span-3"><input type="number" value={range.maxWeight} onChange={(e) => updateWeightRangeInRegion(index, ci, ri, 'maxWeight', parseFloat(e.target.value))} className="w-full p-2 border border-gray-300 rounded text-sm" min="0" step="0.01" /></div>
                                              <div className="col-span-3"><input type="number" value={range.price} onChange={(e) => updateWeightRangeInRegion(index, ci, ri, 'price', parseFloat(e.target.value))} className="w-full p-2 border border-gray-300 rounded text-sm" min="0" /></div>
                                              <div className="col-span-1 text-center"><button onClick={() => removeWeightRangeFromRegion(index, ci, ri)} className="text-red-500 hover:bg-red-50 p-1.5 rounded-full"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button></div>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    </div>
                                  )) : (
                                    <div className="text-center text-sm text-gray-500 py-4 border-2 border-dashed border-gray-300 rounded-lg">No region groups added. Click "+ Add Region Group" to start.</div>
                                  )}
                                </div>
                              )}
                            </div>
                          )}

                          {/* Simple weight / flat rate options */}
                          {(!method.useRegionWeight && !method.isPanIndia) && (
                            <div className="space-y-4">
                              <div className="flex items-center bg-gray-50 p-3 rounded-lg border border-gray-200">
                                <input type="checkbox" id={`useWeight-${index}`} checked={method.useWeight} onChange={(e) => updateMethodField(index, { useWeight: e.currentTarget.checked, ratePerKg: e.currentTarget.checked ? method.ratePerKg : undefined, fixedRate: e.currentTarget.checked ? undefined : method.fixedRate })} className="w-5 h-5 mr-3 text-orange-600 rounded border-gray-300 focus:ring-orange-500" />
                                <label htmlFor={`useWeight-${index}`} className="text-gray-700 font-medium cursor-pointer">Use Simple Weight-based Pricing (Rate per KG)</label>
                              </div>
                              {method.useWeight ? (
                                <div className="pl-8">
                                  <label className="block text-gray-700 mb-2 font-medium">Rate per KG (₹)</label>
                                  <input type="number" value={method.ratePerKg || ''} onChange={(e) => updateMethodField(index, { ratePerKg: parseFloat(e.target.value) || undefined })} className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500" placeholder="Enter rate per KG" min="0" step="0.01" />
                                </div>
                              ) : (
                                <div className="pl-8 border-l-2 border-gray-200">
                                  <div className="mb-4">
                                    <label className="block text-gray-700 mb-2 font-medium">Flat Rate (₹)</label>
                                    <input type="number" value={method.fixedRate ?? ''} onChange={(e) => updateMethodField(index, { fixedRate: e.target.value === '' ? undefined : parseFloat(e.target.value) })} className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500" placeholder="Enter flat rate" min="0" step="0.01" />
                                    <p className="text-xs text-gray-500 mt-2">Applies to all regions unless specific region rates are defined below.</p>
                                  </div>
                                  <div className="mt-4 space-y-3">
                                    <div className="flex items-center justify-between">
                                      <h4 className="text-sm font-medium text-gray-800">Flat Rate Exceptions (Region Specific)</h4>
                                      <button type="button" onClick={() => addRegionRate(index)} className="text-xs bg-gray-600 hover:bg-gray-700 text-white py-1 px-3 rounded">+ Add Exception</button>
                                    </div>
                                    {method.regionRates && method.regionRates.length > 0 ? method.regionRates.map((rr, ri) => (
                                      <div key={ri} className="bg-white p-3 rounded border border-gray-200 flex gap-3 items-start shadow-sm">
                                        <div className="w-1/2">
                                          <label className="block text-xs text-gray-600 mb-1">Regions</label>
                                          <MultiSelect options={INDIAN_STATES} selected={rr.regions} onChange={(r) => updateRegionRateRegions(index, ri, r)} placeholder="Select states..." />
                                        </div>
                                        <div className="w-1/3">
                                          <label className="block text-xs text-gray-600 mb-1">Fixed Price (₹)</label>
                                          <input type="number" value={rr.price ?? 0} onChange={(e) => updateRegionRatePrice(index, ri, parseFloat(e.target.value) || 0)} placeholder="e.g., 40" min="0" step="0.01" className="w-full p-2 border border-gray-300 rounded text-sm min-h-[42px]" />
                                        </div>
                                        <div className="w-auto pt-6">
                                          <button type="button" onClick={() => removeRegionRate(index, ri)} className="text-red-500 hover:bg-red-50 p-2 rounded">
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                          </button>
                                        </div>
                                      </div>
                                    )) : <div className="text-xs text-gray-400 italic">No exceptions added.</div>}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      <div className="flex justify-end space-x-3 pt-6 border-t">
                        <button
                          onClick={() => { setIsEditing(null); if (!method._id) setMethods(methods.filter((_, i) => i !== index)); else fetchShippingMethods(); }}
                          className="bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 px-6 rounded-md font-medium transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleMethodSave(method, index)}
                          className="bg-orange-600 hover:bg-orange-700 text-white py-2 px-6 rounded-md font-medium shadow-md transition-colors"
                        >
                          Save Method
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex justify-between items-center group">
                      <div>
                        <div className="flex items-center flex-wrap gap-2">
                          <h3 className="font-bold text-lg text-gray-900">{method.name}</h3>
                          {method.type === 'COURIER_PARTNER' && <span className="px-2 py-0.5 rounded-full bg-orange-100 text-orange-800 text-xs font-semibold">Courier</span>}
                          {method.type === 'FREE_SHIPPING' && <span className="px-2 py-0.5 rounded-full bg-orange-100 text-orange-800 text-xs font-semibold">Free</span>}
                          {method.isPanIndia && <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 text-xs font-semibold">Pan-India</span>}
                        </div>
                        <div className="text-sm text-gray-600 mt-2">
                          {method.type === 'FREE_SHIPPING'
                            ? method.minAmount ? `Free shipping for orders over ₹${method.minAmount}` : 'Always Free Shipping'
                            : (
                              <div className="flex flex-col gap-1">
                                {(method.defaultPrice !== undefined && method.defaultPrice > 0) && <span className="font-semibold text-yellow-700">Base Price: ₹{method.defaultPrice}</span>}
                                {method.isPanIndia ? (
                                  <>
                                    <span className="font-medium text-purple-700">Uniform pricing across India</span>
                                    {method.excludedRegions && method.excludedRegions.length > 0 && <span className="text-xs text-red-600">{method.excludedRegions.length} region(s) excluded</span>}
                                  </>
                                ) : method.useRegionWeight ? (
                                  <>
                                    <span className="font-medium text-orange-700">+ Region & Weight Based Pricing</span>
                                    <div className="text-xs text-gray-500 mt-1 pl-2 border-l-2 border-orange-200">
                                      {method.regionWeightConfigs?.map((conf, i) => <div key={i}><span className="font-semibold">{conf.regions.join(", ")}</span>: {conf.weightRanges.length} weight rules</div>)}
                                      {(method.regionWeightConfigs?.length || 0) === 0 && <span>No rules configured</span>}
                                    </div>
                                  </>
                                ) : method.useWeight ? <span>+ Rate per KG: ₹{method.ratePerKg}/kg</span> : (
                                  <>
                                    <span>+ Flat Rate: ₹{method.fixedRate || 0}</span>
                                    {(method.regionRates && method.regionRates.length > 0) && (
                                      <div className="text-xs text-gray-500 mt-1 pl-2 border-l-2 border-gray-200">
                                        {method.regionRates.map((rr, i) => <div key={i}><span className="font-semibold">{rr.regions.join(", ")}</span>: ₹{rr.price}</div>)}
                                      </div>
                                    )}
                                  </>
                                )}
                              </div>
                            )}
                        </div>
                      </div>
                      <div className="flex items-center space-x-3 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                        <button onClick={() => setIsEditing(index)} className="bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 px-4 rounded-md font-medium text-sm border border-gray-200">Edit</button>
                        {method._id && <button onClick={() => handleMethodDelete(method._id || '')} className="bg-red-50 hover:bg-red-100 text-red-600 py-2 px-4 rounded-md font-medium text-sm border border-red-200">Delete</button>}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ShippingPage;
