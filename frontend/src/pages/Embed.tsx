import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth } from '../config/Firebase-config';
import { onAuthStateChanged } from 'firebase/auth';

export default function Embed() {
  const navigate = useNavigate();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setIsChecking(false);
      // Only allow navigation after auth state is confirmed
      if (user) {
        navigate('/dashboard');
      }
    });

    return () => unsubscribe();
  }, [navigate]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data === 'instagramConnected') {
        // Perform any actions needed after Instagram connection
        console.log('Instagram account successfully connected!');
        // Optionally refresh the page or update the UI
        window.location.reload();
      }
    };

    window.addEventListener('message', handleMessage);

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  const handleGetStarted = () => {
    // First check if user is already authenticated
    const tenantId = localStorage.getItem('tenentid');

    const instagramOAuthUrl =
      'https://www.instagram.com/oauth/authorize?enable_fb_login=0&force_authentication=1&' +
      `client_id=1577839799518386&redirect_uri=https://snaking-outhouse-oppose.ngrok-free.dev/api/instagram_authroute/auth/instagram/callback&response_type=code&scope=instagram_business_basic%2Cinstagram_business_manage_messages%2Cinstagram_business_manage_comments&state=${tenantId || ''}`;

    const popupWidth = 600;
    const popupHeight = 700;
    const popupLeft = window.screenX + (window.innerWidth - popupWidth) / 2;
    const popupTop = window.screenY + (window.innerHeight - popupHeight) / 2;

    window.open(
      instagramOAuthUrl,
      'InstagramOAuth',
      `width=${popupWidth},height=${popupHeight},left=${popupLeft},top=${popupTop},resizable,scrollbars`
    );
  };

  if (isChecking) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#fcfcfc]">
        <div className="flex flex-col items-center">
          <div className="w-12 h-12 border-t-4 border-orange-500 border-solid rounded-full animate-spin"></div>
          <p className="mt-4 text-lg font-medium text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fcfcfc] flex items-center justify-center px-4">
      {/* Main Card */}
      <div className="bg-white shadow-[0_8px_30px_rgb(0,0,0,0.06)] p-10 rounded-[24px] max-w-[420px] w-full text-center border border-gray-50">

        {/* Logo/Icon Area */}
        <div className="flex justify-center mb-6">
          <div className="h-20 w-20 rounded-full bg-gradient-to-br from-[#e52d27] to-[#ef8e38] flex items-center justify-center shadow-lg shadow-orange-200">
            <svg viewBox="0 0 24 24" fill="none" className="w-10 h-10 text-white" stroke="currentColor" strokeWidth="2">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" strokeLinecap="round" strokeLinejoin="round" fill="currentColor" />
            </svg>
          </div>
        </div>

        {/* Title */}
        <h1 className="text-2xl font-bold text-[#1a1a1a] mb-6">InstaX Bot</h1>

        {/* Description */}
        <p className="text-[#555555] text-[17px] leading-relaxed mb-8 px-2">
          Automate your Instagram interactions and grow your audience with our powerful AI assistant!
        </p>

        {/* Button */}
        <button
          onClick={handleGetStarted}
          disabled={isChecking}
          className="w-full py-4 bg-gradient-to-r from-[#e52d27] to-[#ef8e38] text-white rounded-[12px] font-semibold text-lg flex items-center justify-center gap-2 hover:opacity-90 transition-all active:scale-[0.98] shadow-md mb-8"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
          </svg>
          Connect Instagram
        </button>

        {/* Footer Links */}
        <div className="space-y-4">
          <p className="text-sm text-gray-500">
            By connecting, you agree to our <span className="text-gray-700 font-medium">Terms of Service</span>
          </p>

          <a
            href="/policy"
            className="text-[#e52d27] text-sm font-medium hover:underline flex items-center justify-center gap-1 transition-colors"
          >
            Privacy Policy
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 3h6v6M10 14L21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
            </svg>
          </a>
        </div>
      </div>
    </div>
  );
}

