import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, CheckCircle2 } from 'lucide-react';
import axios from 'axios';
import { useNavigate, Link } from 'react-router-dom';
import InstaxbotLogo from '../assets/Instaxbot_Logo2.jpeg';
import RobotImage from '../assets/signup.png';

export default function SignupPage(): JSX.Element {
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [name, setName] = useState<string>('');
  const [phonenumber, setPhonenumber] = useState<string>('');
  const [verificationCode, setVerificationCode] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [showSuccessModal, setShowSuccessModal] = useState<boolean>(false);
  const [successMessage, setSuccessMessage] = useState<string>('');

  const navigate = useNavigate();

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await axios.post('https://inocencia-shiftiest-nonodorously.ngrok-free.dev/api/auth/signup', {
        name,
        email,
        password,
        verificationCode,
        phonenumber,
      });
      if (response.status === 201) {
        setSuccessMessage(response.data.alertMessage);
        setShowSuccessModal(true);
      }
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 400) {
        setError(err.response.data.error);
      } else {
        setError('Error registering user. Please try again.');
      }
    }
  };

  const handleModalClose = () => {
    setShowSuccessModal(false);
    navigate('/login');
  };

  return (
    <div className="fixed inset-0 bg-[#F3F4F6] flex overflow-hidden font-sans">

      {/* Success Modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={handleModalClose} />
          <div className="relative bg-white rounded-3xl shadow-2xl max-w-md w-full p-8 animate-in zoom-in-95 duration-300">
            <div className="flex justify-center mb-6">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-[#F05225] to-[#FBAF33] rounded-full blur-xl opacity-40 animate-pulse" />
                <div className="relative bg-gradient-to-r from-[#F05225] to-[#FBAF33] rounded-full p-4">
                  <CheckCircle2 className="w-10 h-10 text-white" strokeWidth={2.5} />
                </div>
              </div>
            </div>
            <div className="text-center mb-6">
              <h3 className="text-lg font-bold text-[#1A1A1A] mb-2">Registration Successful!</h3>
              <p className="text-[#6B7280] text-xs leading-relaxed">{successMessage}</p>
            </div>
            <Button
              onClick={handleModalClose}
              className="w-full bg-gradient-to-r from-[#F05225] to-[#FBAF33] hover:opacity-90 text-white font-bold h-10 rounded-xl text-xs transition-all shadow-lg"
            >
              Continue to Login
            </Button>
          </div>
        </div>
      )}

      {/* Left Side */}
      <div className="w-full lg:w-1/2 bg-[#F3F4F6] flex flex-col overflow-y-auto">

        {/* Mobile-only image */}
        <div className="block lg:hidden mx-8 mt-4 rounded-2xl overflow-hidden" style={{ height: '160px' }}>
          <img
            src={RobotImage}
            alt="Signup illustration"
            className="w-full h-full object-cover select-none"
            style={{ objectPosition: 'center 40%' }}
          />
        </div>

        {/* Centered form content */}
        <div className="flex flex-col justify-center flex-1 px-8 lg:px-16 py-6">

          {/* Logo */}
          <div className="flex items-center mb-4">
            <img src={InstaxbotLogo} alt="Logo" className="w-6 h-6 object-contain mr-2" />
            <h1 className="text-base font-bold text-[#1A1A1A]">InstaX bot</h1>
          </div>

          <div className="mb-5">
            <h2 className="text-2xl font-bold text-[#1A1A1A] mb-1">Sign Up</h2>
            <p className="text-[#6B7280] text-xs">
              Already have an account?{' '}
              <Link to="/login" className="text-[#F05225] font-semibold hover:underline">
                Log in
              </Link>
            </p>
          </div>

          <form className="space-y-3 w-full max-w-md" onSubmit={handleSignUp}>

            {/* Name */}
            <div className="space-y-1">
              <Label htmlFor="name" className="text-xs font-medium text-[#374151]">Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your name"
                className="h-9 text-xs bg-white border border-[#E5E7EB] rounded-xl focus-visible:ring-1 focus-visible:ring-[#F05225] transition-all shadow-sm"
              />
            </div>

            {/* Email */}
            <div className="space-y-1">
              <Label htmlFor="email" className="text-xs font-medium text-[#374151]">E-mail</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="example@gmail.com"
                className="h-9 text-xs bg-white border border-[#E5E7EB] rounded-xl focus-visible:ring-1 focus-visible:ring-[#F05225] transition-all shadow-sm"
              />
            </div>

            {/* Phone Number */}
            <div className="space-y-1">
              <Label htmlFor="phone" className="text-xs font-medium text-[#374151]">Phone Number</Label>
              <Input
                id="phone"
                type="tel"
                value={phonenumber}
                onChange={(e) => setPhonenumber(e.target.value)}
                placeholder="+91 XXXXX XXXXX"
                className="h-9 text-xs bg-white border border-[#E5E7EB] rounded-xl focus-visible:ring-1 focus-visible:ring-[#F05225] transition-all shadow-sm"
              />
            </div>

            {/* Verification Code */}
            <div className="space-y-1">
              <Label htmlFor="code" className="text-xs font-medium text-[#374151]">Verification Code</Label>
              <Input
                id="code"
                type="text"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value)}
                placeholder="Enter verification code"
                className="h-9 text-xs bg-white border border-[#E5E7EB] rounded-xl focus-visible:ring-1 focus-visible:ring-[#F05225] transition-all shadow-sm"
              />
            </div>

            {/* Password */}
            <div className="space-y-1">
              <Label htmlFor="password" className="text-xs font-medium text-[#374151]">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="@#*%"
                  className="h-9 text-xs bg-white border border-[#E5E7EB] rounded-xl focus-visible:ring-1 focus-visible:ring-[#F05225] pr-10 transition-all shadow-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#4B5563]"
                >
                  {showPassword ? <EyeOff size={13} /> : <Eye size={13} />}
                </button>
              </div>
            </div>

            {error && <p className="text-red-500 text-[10px] font-medium">{error}</p>}

            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-[#E8341A] to-[#F5A623] hover:opacity-90 text-white font-bold h-9 rounded-xl text-xs transition-all shadow-sm border-none"
            >
              Create account
            </Button>
          </form>
        </div>

        {/* Footer */}
        <div className="flex justify-center pb-5 px-8">
          <div className="flex items-center space-x-4 text-[10px] font-semibold text-[#9CA3AF]">
            <Link to="/frontterms" className="hover:text-[#F05225] transition-colors">
              Terms & Conditions
            </Link>
            <span className="w-1 h-1 bg-[#D1D5DB] rounded-full"></span>
            <Link to="/frontpolicy" className="hover:text-[#F05225] transition-colors">
              Privacy Policy
            </Link>
          </div>
        </div>
      </div>

      {/* Right Side - Image (Desktop only) */}
      <div className="hidden lg:block lg:w-1/2 p-4 pl-0">
        <div className="h-full w-full overflow-hidden rounded-[28px]">
          <img
            src={RobotImage}
            alt="Signup illustration"
            className="w-full h-full object-cover select-none"
          />
        </div>
      </div>

    </div>
  );
}
