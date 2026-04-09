import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { Html5Qrcode } from "html5-qrcode";
import { Camera, X, AlertCircle } from 'lucide-react';

interface Product {
  name: string;
  sku: string;
  quantity: number;
  image: string;
}

const CustomLoader: React.FC = () => (
  <div className="flex items-center justify-center">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600"></div>
  </div>
);

const WrongProductPopup: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 2000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 px-4">
      <div
        className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl text-center"
        style={{ animation: 'popIn 0.25s ease-out' }}
      >
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
          <AlertCircle className="h-8 w-8 text-red-600" />
        </div>
        <h3 className="mb-1 text-lg font-bold text-gray-900">Wrong Product!</h3>
        <p className="mb-6 text-sm text-gray-500">The scanned SKU does not match any product in this order.</p>
        <button
          onClick={onClose}
          className="w-full rounded-xl py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
          style={{ background: 'linear-gradient(135deg, #F57F26 0%, #D63031 100%)' }}
        >
          OK
        </button>
      </div>
    </div>
  );
};

const Packing: React.FC<{ onBack?: () => void }> = ({ onBack }) => {
  const [orderNumber, setOrderNumber] = useState<string>('');
  const [products, setProducts] = useState<Product[]>([]);
  const [skuInput, setSkuInput] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [customerNote, setCustomerNote] = useState<string>('');
  const [verifiedSkus, setVerifiedSkus] = useState<string[]>([]);
  const [productsFetched, setProductsFetched] = useState<boolean>(false);
  const [showWrongProduct, setShowWrongProduct] = useState<boolean>(false);

  const [isMobile, setIsMobile] = useState<boolean>(false);
  const [scanning, setScanning] = useState<boolean>(false);
  const [scanType, setScanType] = useState<"order" | "sku" | null>(null);
  const [scannerReady, setScannerReady] = useState<boolean>(false);

  const skuInputRef = useRef<HTMLInputElement>(null);
  const orderInputRef = useRef<HTMLInputElement>(null);
  const html5QrCode = useRef<Html5Qrcode | null>(null);
  const isStartingRef = useRef(false);

  const apiBaseUrl = 'https://inocencia-shiftiest-nonodorously.ngrok-free.dev';

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    if (orderInputRef.current) {
      orderInputRef.current.focus();
    }
  }, []);

  useEffect(() => {
    if (products.length > 0 && skuInputRef.current) {
      skuInputRef.current.focus();
    }
  }, [products]);

  const stopScanner = useCallback(async () => {
    if (html5QrCode.current) {
      try {
        if (html5QrCode.current.isScanning) {
          await html5QrCode.current.stop();
        }
      } catch (err) {
        console.error("Scanner stop failed:", err);
      }
      html5QrCode.current = null;
    }
  }, []);

  const handleCloseScanner = useCallback(async () => {
    await stopScanner();
    setScanning(false);
    setScanType(null);
    setScannerReady(false);
    isStartingRef.current = false;
  }, [stopScanner]);

  useEffect(() => {
    let mounted = true;

    const initScanner = async () => {
      if (!scanning || isStartingRef.current) return;
      isStartingRef.current = true;

      await stopScanner();
      await new Promise((resolve) => setTimeout(resolve, 200));

      if (!mounted) {
        isStartingRef.current = false;
        return;
      }

      try {
        html5QrCode.current = new Html5Qrcode("reader");
        const config = { fps: 10, qrbox: { width: 250, height: 250 } };

        await html5QrCode.current.start(
          { facingMode: isMobile ? "environment" : "user" },
          config,
          (decodedText) => {
            if (scanType === "order") {
              setOrderNumber(decodedText);
              void handleCloseScanner();
              setTimeout(() => fetchProductsAfterScan(decodedText), 300);
            } else if (scanType === "sku") {
              setSkuInput(decodedText);
              void handleCloseScanner();
              setTimeout(() => handleSkuSubmitAfterScan(decodedText), 300);
            }
          },
          () => {}
        );

        if (mounted) {
          setScannerReady(true);
          isStartingRef.current = false;
        }
      } catch (err) {
        console.error("Scanner error:", err);
        toast.error("Camera failed. Check permissions.");
        isStartingRef.current = false;
        setScanning(false);
        setScannerReady(false);
      }
    };

    void initScanner();

    return () => {
      mounted = false;
      void stopScanner();
    };
  }, [scanning, scanType, isMobile, handleCloseScanner, stopScanner]);

  const startOrderScanner = async () => {
    if (isStartingRef.current || scanning) return;
    await stopScanner();
    setScanType("order");
    setScanning(true);
    setScannerReady(false);
  };

  const startSkuScanner = async () => {
    if (isStartingRef.current || scanning) return;
    await stopScanner();
    setScanType("sku");
    setScanning(true);
    setScannerReady(false);
  };

  const fetchProductsAfterScan = async (scannedOrder: string) => {
    setOrderNumber(scannedOrder);
    fetchProducts(scannedOrder);
  };

  const handleSkuSubmitAfterScan = (scannedSku: string) => {
    setSkuInput(scannedSku);
    handleSkuSubmit(scannedSku);
  };

  const fetchProducts = async (passedOrderNum?: string): Promise<void> => {
    const currentOrderNum = passedOrderNum || orderNumber;
    if (!currentOrderNum) return;

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
        `${apiBaseUrl}/api/packingroute/fetch-products/${currentOrderNum}`,
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
      toast.error('Error fetching data. Please try again later.');
      setProducts([]);
      setCustomerNote('');
    } finally {
      setLoading(false);
    }
  };

  const handleFetchClick = (): void => {
    if (orderNumber) {
      fetchProducts();
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter' && orderNumber) {
      fetchProducts();
    }
  };

  const handleSkuSubmit = (passedSku?: string): void => {
    const currentSku = passedSku || skuInput;
    if (!currentSku) return;

    const productIndex = products.findIndex((product) => product.sku === currentSku);

    if (productIndex !== -1) {
      const updatedProducts = [...products];
      const currentQuantity = updatedProducts[productIndex].quantity;

      if (currentQuantity > 1) {
        updatedProducts[productIndex].quantity -= 1;
      } else {
        updatedProducts.splice(productIndex, 1);
      }

      setProducts(updatedProducts);
      const newVerified = [...verifiedSkus, currentSku];
      setVerifiedSkus(newVerified);

      if (updatedProducts.length === 0) {
        submitAllVerifiedSkus(newVerified);
      }
    } else {
      setShowWrongProduct(true);
    }

    setSkuInput('');
    if (skuInputRef.current) {
      skuInputRef.current.focus();
    }
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
      if (orderInputRef.current) {
        orderInputRef.current.focus();
      }
    } catch (error: any) {
      toast.error('Error verifying SKU. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const handleSkuKeyPress = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter') {
      handleSkuSubmit();
    }
  };

  const scannerLabel = scanType === "sku" ? "SKU Mode" : "Order Mode";
  const scannerHint = scanType === "sku" ? "sku barcode" : "order barcode";

  return (
    <div className="w-full min-h-screen bg-white px-3 py-3 pb-24 sm:px-6 sm:py-4 sm:pb-8 lg:px-8">

      {showWrongProduct && (
        <WrongProductPopup onClose={() => {
          setShowWrongProduct(false);
          if (skuInputRef.current) skuInputRef.current.focus();
        }} />
      )}

      {onBack && (
        <div className="mb-4 flex justify-start">
          <button
            onClick={onBack}
            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-[#F57F26] hover:text-[#D63031]"
          >
            {'<-'} Back to Status Menu
          </button>
        </div>
      )}

      <ToastContainer position="top-right" autoClose={3000} />

      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 sm:gap-6">
        <div className="grid gap-2 xl:grid-cols-[250px_minmax(0,1fr)] xl:gap-3">
          <section className="rounded-[14px] border border-slate-200 bg-white p-1.5 shadow-sm sm:rounded-[24px] sm:p-3">
            <div className="mb-1 flex items-start justify-end gap-3 sm:mb-3">
              <div className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-[#D63031]">
                {scannerLabel}
              </div>
            </div>

            <div className="overflow-hidden rounded-[12px] border border-slate-200 bg-slate-950 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)] sm:rounded-[20px]">
              <div className="relative aspect-[1.25/0.62] w-full sm:aspect-[4/3]">
                <div id="reader" className="h-full w-full" />

                {!scanning && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-950/88 text-center text-white">
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/10">
                      <Camera size={24} />
                    </div>
                    <div>
                      <p className="text-base font-semibold">Scanner paused</p>
                      <p className="mt-1 text-sm text-slate-300">
                        Open the camera to scan {scannerHint}.
                      </p>
                    </div>
                  </div>
                )}

                {scanning && !scannerReady && (
                  <div className="absolute inset-0 flex items-center justify-center bg-slate-950/10 text-white">
                    <p className="rounded-full bg-black/40 px-4 py-2 text-sm font-medium">
                      Initializing Camera...
                    </p>
                  </div>
                )}

                <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-2.5 sm:p-5">
                  <div className="relative h-full max-h-[96px] w-full max-w-[122px] border border-white/40 bg-white/5 sm:max-h-[180px] sm:max-w-[210px]">
                    <div className="absolute left-0 top-0 h-5 w-5 border-l-[3px] border-t-[3px] border-white sm:h-8 sm:w-8 sm:border-l-4 sm:border-t-4" />
                    <div className="absolute right-0 top-0 h-5 w-5 border-r-[3px] border-t-[3px] border-white sm:h-8 sm:w-8 sm:border-r-4 sm:border-t-4" />
                    <div className="absolute bottom-0 left-0 h-5 w-5 border-b-[3px] border-l-[3px] border-white sm:h-8 sm:w-8 sm:border-b-4 sm:border-l-4" />
                    <div className="absolute bottom-0 right-0 h-5 w-5 border-b-[3px] border-r-[3px] border-white sm:h-8 sm:w-8 sm:border-b-4 sm:border-r-4" />
                    {scanning && <div className="scanner-line absolute left-3 right-3 h-0.5 rounded-full bg-white/95 shadow-[0_0_18px_rgba(255,255,255,0.9)]" />}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between gap-1.5 border-t border-white/10 bg-white px-1.5 py-1.5 sm:px-3 sm:py-3">
                <button
                  type="button"
                  onClick={() => void (scanType === "sku" ? startSkuScanner() : startOrderScanner())}
                  className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-[linear-gradient(135deg,#F57F26_0%,#D63031_100%)] px-2 py-1.5 text-[10px] font-semibold text-white shadow-[0_12px_30px_rgba(214,48,49,0.28)] transition hover:opacity-95 sm:gap-2 sm:rounded-2xl sm:px-4 sm:py-2.5 sm:text-sm"
                >
                  <Camera size={14} />
                  {scanning ? 'Camera Active' : 'Open Camera'}
                </button>
                <button
                  type="button"
                  onClick={() => void handleCloseScanner()}
                  className="flex items-center justify-center gap-1 rounded-lg bg-rose-50 px-2 py-1.5 text-[10px] font-semibold text-rose-600 transition hover:bg-rose-100 sm:gap-2 sm:rounded-2xl sm:px-4 sm:py-2.5 sm:text-sm"
                >
                  <X size={14} />
                  Close
                </button>
              </div>
            </div>
          </section>

          <section className="flex flex-col gap-4 sm:gap-6 xl:max-w-2xl">
            <div className="rounded-[16px] border border-slate-200 bg-white p-3 shadow-sm sm:rounded-[24px] sm:p-4">
              <div className="flex flex-col gap-5">
                <div className="flex flex-col gap-2 w-full">
                  <h2 className="text-lg font-bold text-gray-800">Enter Order Number</h2>
                  <div className="relative">
                    <input
                      type="text"
                      value={orderNumber}
                      onChange={(e) => setOrderNumber(e.target.value)}
                      onKeyPress={handleKeyPress}
                      className="w-full rounded-lg border border-slate-200 bg-slate-50 p-3 pr-12 text-black placeholder-gray-400 shadow-sm outline-none transition focus:border-[#F57F26] focus:bg-white focus:ring-4 focus:ring-[#F57F26]/10 sm:rounded-2xl"
                      placeholder="Order Number"
                      ref={orderInputRef}
                    />
                    <button
                      type="button"
                      onClick={() => void startOrderScanner()}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-gray-500 hover:text-orange-600"
                    >
                      <Camera size={24} />
                    </button>
                  </div>
                </div>

                <div className="flex justify-center mt-3">
                  <button
                    onClick={handleFetchClick}
                    className="w-full rounded-xl px-8 py-3 text-lg font-medium text-white shadow-md transition-all duration-200"
                    style={{ background: 'linear-gradient(to right, #F57F26, #D63031)' }}
                  >
                    {loading ? "Fetching..." : "Fetch Product"}
                  </button>
                </div>
              </div>

              {loading ? (
                <div className="flex items-center justify-center h-64">
                  <CustomLoader />
                </div>
              ) : (
                <div className="mt-6 flex flex-col items-center w-full">
                  {customerNote && (
                    <div className="mb-5 w-full rounded-xl border-l-4 border-yellow-500 bg-yellow-100 p-4 shadow-md">
                      <h3 className="mb-2 text-lg font-bold text-yellow-800">Customer Note:</h3>
                      <p className="text-gray-800">{customerNote}</p>
                    </div>
                  )}

                  {products.length > 0 && (
                    <div className="mb-6 w-full overflow-hidden rounded-xl border bg-white shadow-lg">
                      <table className="min-w-full">
                        <thead className="text-white" style={{ background: 'linear-gradient(to right, #F57F26, #D63031)' }}>
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
                                  <img src={product.image} alt={product.name} className="mx-auto max-h-[80px] max-w-[80px] object-contain" />
                                ) : (
                                  <div className="mx-auto flex h-[80px] w-[80px] items-center justify-center bg-gray-100 text-xs text-gray-400">No image</div>
                                )}
                              </td>
                              <td className="py-3 px-4 text-center text-lg font-bold">{product.quantity}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {products.length > 0 && (
                    <div className="mt-4 flex w-full flex-col items-center gap-3">
                      <div className="relative w-full">
                        <input
                          type="text"
                          value={skuInput}
                          onChange={(e) => setSkuInput(e.target.value)}
                          onKeyPress={handleSkuKeyPress}
                          className="w-full rounded-xl border p-3 pr-12 text-gray-800 placeholder-gray-400 shadow-md focus:outline-none focus:ring-2 focus:ring-orange-600"
                          placeholder="Scan or Enter SKU"
                          ref={skuInputRef}
                        />
                        <button
                          type="button"
                          onClick={() => void startSkuScanner()}
                          className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-gray-500 hover:text-orange-600"
                        >
                          <Camera size={24} />
                        </button>
                      </div>
                      <button
                        onClick={() => handleSkuSubmit()}
                        className="w-full rounded-xl px-6 py-3 font-semibold text-white shadow-md transition-all duration-200"
                        style={{ background: 'linear-gradient(to right, #F57F26, #D63031)' }}
                      >
                        Verify SKU
                      </button>
                    </div>
                  )}

                  {productsFetched && products.length === 0 && (
                    <div className="w-full animate-pulse rounded-xl border border-green-200 bg-green-50 p-8 text-center shadow-md">
                      <p className="text-2xl font-bold text-green-700">Packed Successfully!</p>
                      <p className="mt-2 text-green-600">All products verified. Ready for next order.</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>
        </div>
      </div>

      <style>{`
        #reader {
          min-height: 100%;
        }

        #reader video {
          width: 100% !important;
          height: 100% !important;
          object-fit: cover !important;
          border-radius: 1rem;
          filter: brightness(1.08) contrast(1.08) saturate(1.05) !important;
        }

        #reader__dashboard_section_csr,
        #reader__dashboard_section_swaplink {
          display: none !important;
        }

        #reader__scan_region {
          background: transparent !important;
          border: none !important;
        }

        #reader__scan_region img,
        #reader__scan_region canvas:not(:first-child) {
          display: none !important;
        }

        .scanner-line {
          animation: packingScanLine 2s ease-in-out infinite;
        }

        @keyframes packingScanLine {
          0% { top: 12%; opacity: 0.4; }
          50% { top: calc(100% - 12%); opacity: 1; }
          100% { top: 12%; opacity: 0.4; }
        }

        @keyframes popIn {
          0% { transform: scale(0.85); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default Packing;
