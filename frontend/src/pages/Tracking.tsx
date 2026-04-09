import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Camera, X } from 'lucide-react';

const SuccessPopup: React.FC<{ message: string; onClose: () => void }> = ({ message, onClose }) => (
  <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 px-4">
    <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl text-center" style={{ animation: 'popIn 0.3s ease-out' }}>
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
        <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <h3 className="mb-1 text-lg font-bold text-gray-900">Success!</h3>
      <p className="mb-6 text-sm text-gray-500">{message}</p>
      <button
        onClick={onClose}
        className="w-full rounded-xl py-2.5 text-sm font-semibold text-white bg-[linear-gradient(135deg,#F57F26_0%,#D63031_100%)] shadow-md hover:opacity-90 transition"
      >
        OK
      </button>
    </div>
  </div>
);

const Tracking: React.FC<{ onBack?: () => void }> = ({ onBack }) => {
    const [orderNumber, setOrderNumber] = useState('');
    const [trackingNumber, setTrackingNumber] = useState('');
    const [weight, setWeight] = useState('');
    const [loading, setLoading] = useState(false);
    const [showSuccessPopup, setShowSuccessPopup] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [scanning, setScanning] = useState(false);
    const [scanType, setScanType] = useState<'order' | 'tracking' | null>(null);
    const [scannerReady, setScannerReady] = useState(false);

    const orderNumberInputRef = useRef<HTMLInputElement>(null);
    const trackingNumberInputRef = useRef<HTMLInputElement>(null);
    const weightInputRef = useRef<HTMLInputElement>(null);
    const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
    const isStartingRef = useRef(false);
    const autoScannerStartedRef = useRef(false);

    const stopScanner = useCallback(async () => {
        if (html5QrCodeRef.current) {
            try {
                if (html5QrCodeRef.current.isScanning) {
                    await html5QrCodeRef.current.stop();
                }
            } catch (error) {
                console.log('Scanner stop error:', error);
            }
            html5QrCodeRef.current = null;
        }
    }, []);

    const handleCloseScanner = useCallback(async () => {
        await stopScanner();
        setScanning(false);
        setScannerReady(false);
        isStartingRef.current = false;
    }, [stopScanner]);

    const startScanning = async (type: 'order' | 'tracking') => {
        if (isStartingRef.current || scanning) return;
        await stopScanner();
        setScanType(type);
        setScanning(true);
    };

    useEffect(() => {
        let mounted = true;

        const initScanner = async () => {
            if (!scanning || isStartingRef.current) return;
            isStartingRef.current = true;

            if (!mounted) {
                isStartingRef.current = false;
                return;
            }

            try {
                const html5QrCode = new Html5Qrcode('tracking-reader');
                html5QrCodeRef.current = html5QrCode;

                const config = {
                    fps: 10,
                    qrbox: { width: 210, height: 180 },
                    aspectRatio: 1.2
                };

                await html5QrCode.start(
                    { facingMode: 'environment' },
                    config,
                    (decodedText: string) => {
                        if (scanType === 'order') setOrderNumber(decodedText);
                        else if (scanType === 'tracking') setTrackingNumber(decodedText);

                        handleCloseScanner();
                    },
                    () => {}
                );

                if (mounted) {
                    setScannerReady(true);
                    isStartingRef.current = false;
                }
            } catch (err) {
                console.error('Scanner start error:', err);
                isStartingRef.current = false;
                setScanning(false);
            }
        };

        initScanner();
        return () => {
            mounted = false;
            stopScanner();
        };
    }, [scanning, scanType, handleCloseScanner, stopScanner]);

    useEffect(() => {
        if (autoScannerStartedRef.current) {
            return;
        }

        autoScannerStartedRef.current = true;
        void startScanning('order');
    }, []);

    const showAlert = (type: string, title: string, text: string, showConfirm: boolean = true): Promise<boolean> => {
        return new Promise((resolve) => {
            const alertDiv = document.createElement('div');
            alertDiv.className = 'fixed inset-0 z-[60] flex items-center justify-center bg-black bg-opacity-50';

            const bgColor = type === 'success' ? 'bg-green-50 border-green-200' :
                type === 'error' ? 'bg-red-50 border-red-200' :
                    type === 'warning' ? 'bg-yellow-50 border-yellow-200' :
                        'bg-orange-50 border-[#D9702C]';

            const iconColor = type === 'success' ? 'text-green-600' :
                type === 'error' ? 'text-red-600' :
                    type === 'warning' ? 'text-yellow-600' :
                        'text-[#D9702C]';

            const icon = type === 'success' ? '✓' :
                type === 'error' ? '✕' :
                    type === 'warning' ? '⚠' :
                        'ℹ';

            alertDiv.innerHTML = `
                <div class="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6 ${bgColor} border-2">
                    <div class="text-center">
                        <div class="mx-auto flex items-center justify-center h-12 w-12 rounded-full ${bgColor} mb-4">
                            <span class="text-2xl ${iconColor}">${icon}</span>
                        </div>
                        <h3 class="text-lg font-semibold text-gray-900 mb-2">${title}</h3>
                        <p class="text-gray-600 mb-6">${text}</p>
                        <div class="flex justify-center space-x-3">
                            ${showConfirm ?
                                `<button id="confirm-btn" style="background-color: #D9702C" class="px-4 py-2 text-white rounded hover:opacity-90">Yes</button>
                                 <button id="cancel-btn" class="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400">No</button>`
                                :
                                `<button id="ok-btn" style="background-color: #D9702C" class="px-4 py-2 text-white rounded hover:opacity-90">OK</button>`
                            }
                        </div>
                    </div>
                </div>
            `;

            document.body.appendChild(alertDiv);
            const confirmBtn = alertDiv.querySelector('#confirm-btn') as HTMLButtonElement;
            const cancelBtn = alertDiv.querySelector('#cancel-btn') as HTMLButtonElement;
            const okBtn = alertDiv.querySelector('#ok-btn') as HTMLButtonElement;

            const cleanup = () => { if (document.body.contains(alertDiv)) document.body.removeChild(alertDiv); };

            if (showConfirm) {
                if (confirmBtn) confirmBtn.onclick = () => { cleanup(); resolve(true); };
                if (cancelBtn) cancelBtn.onclick = () => { cleanup(); resolve(false); };
            } else {
                if (okBtn) okBtn.onclick = () => { cleanup(); resolve(true); };
            }
        });
    };

    const resetForm = () => {
        setOrderNumber('');
        setTrackingNumber('');
        setWeight('');
        if (orderNumberInputRef.current) orderNumberInputRef.current.focus();
    };

    const handleForceUpdate = async () => {
        const tenentId = localStorage.getItem('tenentid');
        if (!tenentId) {
            setErrorMessage('Tenent ID not found. Please log in again.');
            setTimeout(() => setErrorMessage(''), 5000);
            return;
        }

        setLoading(true);
        try {
            const requestBody = {
                orderNumber: orderNumber,
                trackingNumber: trackingNumber,
                weight: parseFloat(weight),
                tenentId: tenentId,
                confirmOverride: true
            };

            const response = await fetch('https://inocencia-shiftiest-nonodorously.ngrok-free.dev/api/trackingroute/force-update-tracking', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
            });

            const data = await response.json();
            if (response.ok && data.success) {
                setShowSuccessPopup(true);
                resetForm();
            } else {
                setErrorMessage(data.message || 'Failed to update');
            }
        } catch (error) {
            setErrorMessage('Network error.');
        } finally { setLoading(false); }
    };

    const handleSubmit = async () => {
        if (!orderNumber || !trackingNumber || !weight) {
            setErrorMessage('Please fill in all fields');
            setTimeout(() => setErrorMessage(''), 3000);
            return;
        }

        const tenentId = localStorage.getItem('tenentid');
        if (!tenentId) {
            setErrorMessage('Tenent ID not found.');
            return;
        }

        setLoading(true);
        setErrorMessage('');

        try {
            const requestBody = {
                orderNumber,
                trackingNumber,
                weight: parseFloat(weight),
                tenentId
            };

            const response = await fetch('https://inocencia-shiftiest-nonodorously.ngrok-free.dev/api/trackingroute/update-tracking', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
            });

            const data = await response.json();

            if (response.ok && data.success) {
                setShowSuccessPopup(true);
                resetForm();
            } else {
                if (data.statusCheck) {
                    switch (data.statusCheck) {
                        case 'PAYMENT_PENDING': await showAlert('warning', 'Payment Pending', 'Payment is pending for this order', false); break;
                        case 'PRINT_PACK_PENDING': await showAlert('warning', 'Print and Pack Required', 'You didn\'t take print and pack', false); break;
                        case 'PACK_PENDING': await showAlert('warning', 'Pack Required', 'You didn\'t take pack', false); break;
                        case 'ALREADY_SHIPPED':
                            const confirm = await showAlert('question', 'Order Already Shipped', 'You already shipped this order. Do you really want to change the data?', true);
                            if (confirm) await handleForceUpdate();
                            break;
                        case 'INVALID_STATUS': await showAlert('error', 'Invalid Status', data.message || 'Cannot update tracking', false); break;
                        default: setErrorMessage(data.message || 'Failed to update');
                    }
                } else {
                    setErrorMessage(data.message || 'Failed to update');
                }
            }
        } catch (error) {
            setErrorMessage('Network error.');
        } finally { setLoading(false); }
    };

    const handleKeyDown = (e: React.KeyboardEvent, currentField: string) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            switch (currentField) {
                case 'orderNumber': trackingNumberInputRef.current?.focus(); break;
                case 'trackingNumber': weightInputRef.current?.focus(); break;
                case 'weight': handleSubmit(); break;
            }
        }
    };

    const scannerHint = scanType === 'tracking' ? 'Tracking Number' : 'Order Number';

    return (
        <div className="min-h-screen w-full bg-white px-3 py-3 pb-24 sm:px-6 sm:py-4 sm:pb-8 lg:px-8">

            {showSuccessPopup && (
                <SuccessPopup
                    message="Tracking information updated successfully"
                    onClose={() => setShowSuccessPopup(false)}
                />
            )}

            <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 sm:gap-6">
                {onBack && (
                    <div className="flex justify-start">
                        <button
                            type="button"
                            onClick={onBack}
                            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-[#F57F26] hover:text-[#D63031]"
                        >
                            {'<-'} Back to Status Menu
                        </button>
                    </div>
                )}

                {errorMessage && (
                    <div className="rounded-[22px] border border-red-200 bg-red-50 px-4 py-3 text-center text-red-700 shadow-sm">
                        {errorMessage}
                    </div>
                )}

                <div className="grid gap-2 xl:grid-cols-[250px_minmax(0,1fr)] xl:gap-3">
                    <section className="rounded-[14px] border border-slate-200 bg-white p-1.5 shadow-sm sm:rounded-[24px] sm:p-3">
                        <div className="mb-1 flex items-start justify-end gap-3 sm:mb-3">
                            <div className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-[#D63031]">
                                {scanType === 'tracking' ? 'Tracking Mode' : 'Order Mode'}
                            </div>
                        </div>

                        <div className="overflow-hidden rounded-[12px] border border-slate-200 bg-slate-950 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)] sm:rounded-[20px]">
                            <div className="relative aspect-[1.25/0.62] w-full sm:aspect-[4/3]">
                                <div id="tracking-reader" className="h-full w-full" />

                                {!scanning && (
                                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-950/88 text-center text-white">
                                        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/10">
                                            <Camera size={24} />
                                        </div>
                                        <div>
                                            <p className="text-base font-semibold">Scanner paused</p>
                                            <p className="mt-1 text-sm text-slate-300">
                                                Open the camera to scan {scannerHint.toLowerCase()}.
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
                                    onClick={() => startScanning(scanType === 'tracking' ? 'tracking' : 'order')}
                                    className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-[linear-gradient(135deg,#F57F26_0%,#D63031_100%)] px-2 py-1.5 text-[10px] font-semibold text-white shadow-[0_12px_30px_rgba(214,48,49,0.28)] transition hover:opacity-95 sm:gap-2 sm:rounded-2xl sm:px-4 sm:py-2.5 sm:text-sm"
                                >
                                    <Camera size={14} />
                                    {scanning ? 'Camera Active' : 'Open Camera'}
                                </button>
                                <button
                                    type="button"
                                    onClick={handleCloseScanner}
                                    className="flex items-center justify-center gap-1 rounded-lg bg-rose-50 px-2 py-1.5 text-[10px] font-semibold text-rose-600 transition hover:bg-rose-100 sm:gap-2 sm:rounded-2xl sm:px-4 sm:py-2.5 sm:text-sm"
                                >
                                    <X size={14} />
                                    Close
                                </button>
                            </div>
                        </div>
                    </section>

                    <section className="flex flex-col gap-4 sm:gap-6">
                        <div className="rounded-[16px] border border-slate-200 bg-white p-2 shadow-sm sm:rounded-[24px] sm:p-4">
                            <div className="grid gap-2 lg:grid-cols-2 sm:gap-4">
                                <div>
                                    <div className="mb-1.5 sm:mb-2">
                                        <label className="text-xs font-semibold text-slate-700 sm:text-sm" htmlFor="orderNumber">
                                            Order Number
                                        </label>
                                    </div>
                                    <input
                                        type="text"
                                        id="orderNumber"
                                        value={orderNumber}
                                        onChange={(e) => setOrderNumber(e.target.value)}
                                        onKeyDown={(e) => handleKeyDown(e, 'orderNumber')}
                                        className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 outline-none transition focus:border-[#F57F26] focus:bg-white focus:ring-4 focus:ring-[#F57F26]/10 sm:rounded-2xl sm:px-4 sm:py-3.5 sm:text-base"
                                        ref={orderNumberInputRef}
                                    />
                                </div>

                                <div>
                                    <div className="mb-1.5 sm:mb-2">
                                        <label className="text-xs font-semibold text-slate-700 sm:text-sm" htmlFor="trackingNumber">
                                            Tracking Number
                                        </label>
                                    </div>
                                    <input
                                        type="text"
                                        id="trackingNumber"
                                        value={trackingNumber}
                                        onChange={(e) => setTrackingNumber(e.target.value)}
                                        onKeyDown={(e) => handleKeyDown(e, 'trackingNumber')}
                                        className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 outline-none transition focus:border-[#F57F26] focus:bg-white focus:ring-4 focus:ring-[#F57F26]/10 sm:rounded-2xl sm:px-4 sm:py-3.5 sm:text-base"
                                        ref={trackingNumberInputRef}
                                    />
                                </div>
                            </div>

                            <div className="mt-2 sm:mt-4">
                                <label className="mb-1.5 block text-xs font-semibold text-slate-700 sm:mb-2 sm:text-sm" htmlFor="weight">
                                    Weight (gms)
                                </label>
                                <input
                                    type="number"
                                    id="weight"
                                    value={weight}
                                    onChange={(e) => setWeight(e.target.value)}
                                    onKeyDown={(e) => handleKeyDown(e, 'weight')}
                                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 outline-none transition focus:border-[#F57F26] focus:bg-white focus:ring-4 focus:ring-[#F57F26]/10 sm:rounded-2xl sm:px-4 sm:py-3.5 sm:text-base"
                                    ref={weightInputRef}
                                />
                            </div>

                            <div className="mt-2.5 sm:mt-5">
                                <button
                                    type="button"
                                    onClick={handleSubmit}
                                    disabled={loading}
                                    className={`w-full rounded-lg px-4 py-2 text-xs font-semibold text-white transition sm:rounded-2xl sm:px-6 sm:py-4 sm:text-base ${
                                        loading
                                            ? 'bg-orange-400'
                                            : 'bg-[linear-gradient(135deg,#F57F26_0%,#D63031_100%)] shadow-[0_18px_40px_rgba(214,48,49,0.24)] hover:opacity-95'
                                    }`}
                                >
                                    {loading ? 'Updating...' : 'Update Tracking'}
                                </button>
                            </div>
                        </div>
                    </section>
                </div>
            </div>

            <style>{`
                #tracking-reader {
                    min-height: 100%;
                }

                #tracking-reader video {
                    width: 100% !important;
                    height: 100% !important;
                    object-fit: cover !important;
                    filter: brightness(1.08) contrast(1.08) saturate(1.05) !important;
                }

                #tracking-reader__dashboard_section_csr,
                #tracking-reader__dashboard_section_swaplink {
                    display: none !important;
                }

                #tracking-reader__scan_region {
                    background: transparent !important;
                    border: none !important;
                }

                #tracking-reader__scan_region img,
                #tracking-reader__scan_region canvas:not(:first-child) {
                    display: none !important;
                }

                .scanner-line {
                    animation: trackingScanLine 2s ease-in-out infinite;
                }

                @keyframes trackingScanLine {
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

export default Tracking;
