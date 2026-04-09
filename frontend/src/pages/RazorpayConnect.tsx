'use client';
import { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';
import razorpayLogo from '../assets/razorpay_logo.png';

// Define interfaces for type safety
interface ConnectionData {
  isConnected: boolean;
  accountId: string | null;
  keyId: string | null;
  connectedSince: string | null;
}

// Define interface for fetch options
interface FetchOptions extends RequestInit {
  headers?: Record<string, string>;
}

export default function RazorpayConnect() {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [connectionData, setConnectionData] = useState<ConnectionData>({
    isConnected: false,
    accountId: null,
    keyId: null,
    connectedSince: null
  });

  // Get tenant ID from local storage
  const getTenantId = useCallback(() => {
    const tenantId = localStorage.getItem('tenentid');
    if (!tenantId) {
      toast.error("Tenant ID not found. Please login again.");
      return null;
    }
    return tenantId;
  }, []);

  // API helper function with error handling
  const fetchWithErrorHandling = useCallback(async (url: string, options: FetchOptions = {}) => {
    const tenantId = getTenantId();
    if (!tenantId) return null;

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-ID': tenantId,
          ...(options.headers || {})
        }
      });

      const data = await response.json();

      if (!response.ok) {
        const errorMessage = data.message || data.error || `Error: ${response.status}`;
        throw new Error(errorMessage);
      }

      return data;
    } catch (error) {
      console.error(`API Error (${url}):`, error);
      throw error;
    }
  }, [getTenantId]);

  // Check if the user has a connected Razorpay account
  const checkRazorpayConnection = useCallback(async () => {
    try {
      const data = await fetchWithErrorHandling('/api/razorpayroute/check-connection');
      if (!data) return;

      setConnectionData(data);
    } catch (error) {
      toast.error("Could not verify Razorpay connection status.");
    }
  }, [fetchWithErrorHandling]);

  useEffect(() => {
    checkRazorpayConnection();
  }, [checkRazorpayConnection]);

  // Connect to Razorpay OAuth
  const handleConnect = useCallback(async () => {
    try {
      setIsLoading(true);
      const tenantId = getTenantId();
      if (!tenantId) {
        setIsLoading(false);
        return;
      }

      const data = await fetchWithErrorHandling('/api/razorpayroute/authorize', {
        method: 'POST',
        body: JSON.stringify({ tenentId: tenantId })
      });

      if (!data || !data.authUrl) {
        throw new Error('Invalid response from server');
      }

      // Redirect to Razorpay authorization page
      window.location.href = data.authUrl;
    } catch (error) {
      toast.error("Failed to connect with Razorpay. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, [getTenantId, fetchWithErrorHandling]);

  // Disconnect Razorpay integration
  const handleDisconnect = useCallback(async () => {
    try {
      setIsLoading(true);
      const tenantId = getTenantId();
      if (!tenantId) {
        setIsLoading(false);
        return;
      }

      await fetchWithErrorHandling('/api/razorpayroute/disconnect', {
        method: 'POST',
        body: JSON.stringify({ tenentId: tenantId })
      });

      toast.success("Razorpay disconnected successfully");
      setConnectionData({
        isConnected: false,
        accountId: null,
        keyId: null,
        connectedSince: null
      });
    } catch (error) {
      toast.error("Failed to disconnect Razorpay. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, [getTenantId, fetchWithErrorHandling]);

  // Format date for display
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div className="bg-gray-50 min-h-screen p-3 sm:p-8 font-sans">
      {/* Back Button - Styled to match the Orange Outline button in screenshot */}
      

      <div className="flex flex-col items-center">
        {/* Title - Changed to Serif font and Dark Gray to match screenshot header */}
        <h2 className="text-3xl font-serif font-bold text-gray-900 text-center mt-4 mb-8">
          Razorpay Integration
        </h2>

        {/* Connection Status Box - White card with shadow to match the 'Icebreakers' container */}
        <div className="w-full max-w-3xl p-8 rounded-lg shadow-md bg-white mb-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6 sm:gap-0">
            
            <div className="flex items-center gap-4 w-full sm:w-auto">
              {/* Logo Container - Soft gray/cream background */}
              <div className="w-[100px] h-16 bg-gray-50 border border-gray-100 flex items-center justify-center rounded-md">
                <img src={razorpayLogo} alt="Razorpay" className="h-8 w-auto object-contain" />
              </div>
              
              <div>
                <p className="text-lg text-gray-900 font-semibold font-serif">Razorpay Payments</p>
                <p className="text-sm text-gray-500 mt-1">
                  {connectionData.isConnected
                    ? `Connected to account ${connectionData.accountId || 'Unknown'}`
                    : 'Not connected'}
                </p>
                {connectionData.isConnected && connectionData.connectedSince && (
                  <p className="text-xs text-orange-400 mt-1">
                    Connected since {formatDate(connectionData.connectedSince)}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
              {!connectionData.isConnected ? (
                /* Connect Button - Matched to the Orange 'Save' button style */
                <button
                  onClick={handleConnect}
                  disabled={isLoading}
                  className="px-6 py-2.5 bg-orange-600 text-white text-sm font-medium rounded-md hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 disabled:opacity-70 transition-colors shadow-sm"
                >
                  {isLoading ? 'Connecting...' : 'Connect Razorpay'}
                </button>
              ) : (
                <div className="flex items-center gap-4">
                  <span className="px-3 py-1 bg-green-50 text-green-700 text-sm font-medium rounded-full border border-green-200 flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Connected
                  </span>
                </div>
              )}

              {/* Disconnect button - Styled to be clean and minimal alongside the orange theme */}
              <button
                onClick={handleDisconnect}
                disabled={isLoading || !connectionData.isConnected}
                className={`px-4 py-2.5 text-sm font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 transition-colors ${
                  connectionData.isConnected
                    ? 'bg-white text-red-600 border border-red-200 hover:bg-red-50'
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed hidden'
                }`}
              >
                {isLoading && connectionData.isConnected ? 'Disconnecting...' : 'Disconnect'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

