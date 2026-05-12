import { useState } from 'react';
import axios from 'axios';
import { Globe, ShoppingBag, ShoppingCart } from 'lucide-react';

interface ShopifyCredentials {
  apiKey: string;
  apiPassword: string;
  storeUrl: string;
  websiteUrl?: string;
}

interface WooCommerceCredentials {
  consumerKey: string;
  consumerSecret: string;
  url: string;
}

type StoreCredentials = ShopifyCredentials | WooCommerceCredentials;

interface Website {
  id: number;
  type: 'shopify' | 'woocommerce';
  credentials: StoreCredentials;
}

export default function WebsiteUrlConfiguration() {
  const [websites, setWebsites] = useState<Website[]>([
    {
      id: 1,
      type: 'shopify',
      credentials: {
        apiKey: '',
        apiPassword: '',
        storeUrl: '',
        websiteUrl: ''
      }
    }
  ]);

  const [loading, setLoading] = useState<boolean>(false);

  const handleTypeChange = (id: number, newType: 'shopify' | 'woocommerce') => {
    setWebsites(prev =>
      prev.map(website =>
        website.id === id ? {
          ...website,
          type: newType,
          credentials: newType === 'shopify'
            ? { apiKey: '', apiPassword: '', storeUrl: '', websiteUrl: '' }
            : { consumerKey: '', consumerSecret: '', url: '' }
        } : website
      )
    );
  };

  const handleCredentialChange = (id: number, field: string, value: string) => {
    setWebsites(prev =>
      prev.map(website =>
        website.id === id ? {
          ...website,
          credentials: {
            ...website.credentials,
            [field]: value
          }
        } : website
      )
    );
  };

  const addWebsite = () => {
    setWebsites(prev => [
      ...prev,
      {
        id: prev.length + 1,
        type: 'shopify',
        credentials: {
          apiKey: '',
          apiPassword: '',
          storeUrl: '',
          websiteUrl: ''
        }
      }
    ]);
  };

  const removeWebsite = (id: number) => {
    if (websites.length === 1) {
      alert('You need at least one website configuration.');
      return;
    }
    setWebsites(prev => prev.filter(website => website.id !== id));
  };

  const validateCredentials = (website: Website) => {
    if (website.type === 'shopify') {
      const credentials = website.credentials as ShopifyCredentials;
      return credentials.apiKey && credentials.apiPassword && credentials.storeUrl;
    } else {
      const credentials = website.credentials as WooCommerceCredentials;
      return credentials.consumerKey && credentials.consumerSecret && credentials.url;
    }
  };

  const handleSave = async () => {
    const tenentId = localStorage.getItem('tenentid');
    if (!tenentId) {
      alert('Session information missing. Please log in again.');
      return;
    }

    const invalidWebsites = websites.filter(website => !validateCredentials(website));
    if (invalidWebsites.length > 0) {
      alert('Please fill in all credential fields for all websites with valid information.');
      return;
    }

    setLoading(true);

    try {
      await axios.post(
        'https://snaking-outhouse-oppose.ngrok-free.dev/api/urlconfigurationroute/storeCredentials',
        { websites, tenentId }
      );
      alert('Website credentials have been saved!');
    } catch (error) {
      console.error('Error saving credentials:', error);
      alert('An error occurred while saving your credentials. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-[#F8F9FB] min-h-screen w-full pb-36"> {/* ← pb-36 added here */}
      <div className="max-w-4xl mx-auto p-4 sm:p-6">

        {/* Header Section */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 sm:mb-6 gap-4">
          <div className="flex-1 text-center sm:text-right sm:pr-4">
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 flex items-center justify-center sm:justify-end gap-2">
              <Globe className="w-6 h-6 sm:w-8 sm:h-8 text-orange-600" />
              E-commerce Integration
            </h1>
            <p className="text-slate-500 font-normal mt-1 text-xs sm:text-sm">
              Configure your store credentials for order status
            </p>
          </div>
        </div>

        {/* Main Card */}
        <div className="bg-white shadow-sm border border-slate-200 rounded-2xl p-3 sm:p-6 space-y-4 sm:space-y-6">
          {websites.map((website) => (
            <div key={website.id} className="bg-slate-50 rounded-xl border border-slate-100 p-3 sm:p-5">

              <div className="flex justify-between items-center mb-3 sm:mb-4 pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  {website.type === 'shopify'
                    ? <ShoppingBag className="w-4 h-4 sm:w-5 sm:h-5 text-orange-600" />
                    : <ShoppingCart className="w-4 h-4 sm:w-5 sm:h-5 text-orange-600" />
                  }
                  <h2 className="text-base sm:text-lg font-semibold text-slate-900">Store #{website.id}</h2>
                </div>
                <button
                  onClick={() => removeWebsite(website.id)}
                  className="text-orange-600 hover:text-orange-700 text-xs sm:text-sm font-medium"
                >
                  Remove
                </button>
              </div>

              {/* Platform Type Toggle */}
              <div className="mb-4 sm:mb-6">
                <label className="block text-xs font-medium text-slate-700 mb-1 sm:mb-2 ml-1">Platform Type</label>
                <div className="flex gap-1 flex-wrap p-1 bg-slate-200 rounded-lg w-fit">
                  <button
                    onClick={() => handleTypeChange(website.id, 'shopify')}
                    className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-md text-xs sm:text-sm font-medium transition-all duration-200 ${website.type === 'shopify'
                        ? 'bg-white text-orange-600 shadow-sm'
                        : 'text-slate-600 hover:text-slate-800'
                      }`}
                  >
                    Shopify
                  </button>
                  <button
                    onClick={() => handleTypeChange(website.id, 'woocommerce')}
                    className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-md text-xs sm:text-sm font-medium transition-all duration-200 ${website.type === 'woocommerce'
                        ? 'bg-white text-orange-600 shadow-sm'
                        : 'text-slate-600 hover:text-slate-800'
                      }`}
                  >
                    WooCommerce
                  </button>
                </div>
              </div>

              {website.type === 'shopify' ? (
                <div className="space-y-3 sm:space-y-4">
                  <h3 className="font-semibold text-slate-900 border-b border-slate-100 pb-2 mb-3 sm:mb-4 text-sm sm:text-base">
                    Shopify Website Integration
                  </h3>

                  <div className="space-y-1.5">
                    <label className="flex items-center text-xs font-medium text-slate-700 mb-1 ml-1">
                      <span className="mr-1">1.</span> Shopify API Key
                      <span className="text-red-400 ml-1">*</span>
                    </label>
                    <input
                      type="text"
                      value={(website.credentials as ShopifyCredentials).apiKey}
                      onChange={(e) => handleCredentialChange(website.id, 'apiKey', e.target.value)}
                      placeholder="Enter your Shopify API Key"
                      className="w-full px-4 h-11 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:ring-1 focus:ring-orange-500 outline-none text-slate-900 placeholder-slate-300"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="flex items-center text-xs font-medium text-slate-700 mb-1 ml-1">
                      <span className="mr-1">2.</span> Shopify API Password
                      <span className="text-red-400 ml-1">*</span>
                    </label>
                    <input
                      type="password"
                      value={(website.credentials as ShopifyCredentials).apiPassword}
                      onChange={(e) => handleCredentialChange(website.id, 'apiPassword', e.target.value)}
                      placeholder="Enter your Shopify API Password"
                      className="w-full px-4 h-11 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:ring-1 focus:ring-orange-500 outline-none text-slate-900 placeholder-slate-300"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="flex flex-wrap items-center text-xs font-medium text-slate-700 mb-1 ml-1">
                      <span className="mr-1">3.</span> Shopify Store URL
                      <span className="text-red-400 ml-1">*</span>
                      <span className="text-slate-400 font-normal ml-2 w-full sm:w-auto mt-0.5 sm:mt-0">(Format: your-store.myshopify.com)</span>
                    </label>
                    <input
                      type="text"
                      value={(website.credentials as ShopifyCredentials).storeUrl}
                      onChange={(e) => handleCredentialChange(website.id, 'storeUrl', e.target.value)}
                      placeholder="your-store.myshopify.com"
                      className="w-full px-4 h-11 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:ring-1 focus:ring-orange-500 outline-none text-slate-900 placeholder-slate-300"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="flex items-center text-xs font-medium text-slate-700 mb-1 ml-1">
                      <span className="mr-1">4.</span> Shopify Website URL
                    </label>
                    <input
                      type="text"
                      value={(website.credentials as ShopifyCredentials).websiteUrl || ''}
                      onChange={(e) => handleCredentialChange(website.id, 'websiteUrl', e.target.value)}
                      placeholder="https://your-shop-name.com"
                      className="w-full px-4 h-11 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:ring-1 focus:ring-orange-500 outline-none text-slate-900 placeholder-slate-300"
                    />
                    <p className="text-[10px] text-slate-400 ml-1">Enter your public-facing Shopify website URL (optional)</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3 sm:space-y-4">
                  <h3 className="font-semibold text-slate-900 border-b border-slate-100 pb-2 mb-3 sm:mb-4 text-sm sm:text-base">
                    WooCommerce Website Integration
                  </h3>

                  <div className="space-y-1.5">
                    <label className="flex items-center text-xs font-medium text-slate-700 mb-1 ml-1">
                      <span className="mr-1">1.</span> WooCommerce Consumer Key
                      <span className="text-red-400 ml-1">*</span>
                    </label>
                    <input
                      type="text"
                      value={(website.credentials as WooCommerceCredentials).consumerKey}
                      onChange={(e) => handleCredentialChange(website.id, 'consumerKey', e.target.value)}
                      placeholder="Enter your WooCommerce Consumer Key"
                      className="w-full px-4 h-11 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:ring-1 focus:ring-orange-500 outline-none text-slate-900 placeholder-slate-300"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="flex items-center text-xs font-medium text-slate-700 mb-1 ml-1">
                      <span className="mr-1">2.</span> WooCommerce Consumer Secret
                      <span className="text-red-400 ml-1">*</span>
                    </label>
                    <input
                      type="password"
                      value={(website.credentials as WooCommerceCredentials).consumerSecret}
                      onChange={(e) => handleCredentialChange(website.id, 'consumerSecret', e.target.value)}
                      placeholder="Enter your WooCommerce Consumer Secret"
                      className="w-full px-4 h-11 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:ring-1 focus:ring-orange-500 outline-none text-slate-900 placeholder-slate-300"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="flex items-center text-xs font-medium text-slate-700 mb-1 ml-1">
                      <span className="mr-1">3.</span> WooCommerce Site URL
                      <span className="text-red-400 ml-1">*</span>
                    </label>
                    <input
                      type="text"
                      value={(website.credentials as WooCommerceCredentials).url}
                      onChange={(e) => handleCredentialChange(website.id, 'url', e.target.value)}
                      placeholder="https://your-woocommerce-site.com"
                      className="w-full px-4 h-11 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:ring-1 focus:ring-orange-500 outline-none text-slate-900 placeholder-slate-300"
                    />
                    <p className="text-[10px] text-slate-400 ml-1">Enter your complete WooCommerce website URL including https://</p>
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Footer Actions */}
          <div className="flex flex-col sm:flex-row sm:justify-between pt-3 sm:pt-4 border-t border-slate-100 gap-3 sm:gap-0">
            <button
              onClick={addWebsite}
              className="px-4 py-2 bg-slate-50 text-slate-700 border border-slate-200 rounded-xl hover:bg-slate-100 text-xs font-medium transition-all"
            >
              Add Another Store
            </button>

            <button
              onClick={handleSave}
              disabled={loading}
              className="px-6 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-orange-200 text-xs font-semibold disabled:opacity-60"
            >
              {loading ? 'Saving...' : 'Save All Credentials'}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
