import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff } from 'lucide-react';
import axios from 'axios';
import { useNavigate, Link } from 'react-router-dom';
import InstaxbotLogo from '../assets/Instaxbot_Logo2.jpeg';
import loginpic from '../assets/loginpic.png';
import { saveWithExpiry } from '../utils/storage';

export default function LoginPage(): JSX.Element {
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await axios.post('https://inocencia-shiftiest-nonodorously.ngrok-free.dev/api/auth/login', {
        email,
        password,
      });

      if (response.status === 200) {
        const { 
          tenentId, 
          token, 
          wstoken, 
          isAdmin, 
          blocked, 
          type, 
          commentmoderation,
          phonenumber        // ✅ destructure phonenumber
        } = response.data;

        console.log('Logged in successfully. Tenant ID:', tenentId, token);

        saveWithExpiry('tenentid', tenentId, 30);
        saveWithExpiry('token', token, 30);
        saveWithExpiry('wstoken', wstoken, 30);
        saveWithExpiry('isAdmin', String(isAdmin), 30);
        saveWithExpiry('blocked', String(blocked), 30);
        saveWithExpiry('type', type, 30);
        saveWithExpiry('commentmoderation', String(commentmoderation ?? false), 30);
        saveWithExpiry('phonenumber', phonenumber ?? '', 30);   // ✅ save phonenumber, fallback to empty string
        console.log('blocked:', blocked);

        if (isAdmin) {
          navigate('/admin');
        } else {
          if (blocked) {
            navigate('/login');
          } else {
            navigate('/dashboard');
          }
        }
      }
    } catch (err) {
      if (axios.isAxiosError(err)) {
        console.error('Login Error:', {
          message: err.message,
          status: err.response?.status,
          responseData: err.response?.data,
          url: err.config?.url,
        });
        setError(err.response?.data?.error || 'Invalid email or password');
      } else {
        console.error('Unexpected error during login:', err);
        setError('An unexpected error occurred');
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-[#F3F4F6] flex overflow-hidden font-sans">

      {/* Left Side */}
      <div className="w-full lg:w-1/2 bg-[#F3F4F6] flex flex-col overflow-y-auto">

        {/* Mobile-only image */}
        <div className="block lg:hidden mx-6 mt-5 rounded-2xl overflow-hidden" style={{ height: '200px' }}>
          <img
            src={loginpic}
            alt="Login illustration"
            className="w-full h-full object-cover select-none"
            style={{ objectPosition: 'center 15%' }}
          />
        </div>

        {/* Form content */}
        <div className="flex flex-col justify-center flex-1 px-6 lg:px-16 py-6 lg:py-8">

          {/* Logo */}
          <div className="flex items-center mb-5 lg:mb-7">
            <img
              src={InstaxbotLogo}
              alt="Logo"
              className="w-8 h-8 lg:w-10 lg:h-10 object-contain mr-3"
            />
            <h1 className="text-lg lg:text-2xl font-bold text-[#1A1A1A] tracking-tight">
              InstaX bot
            </h1>
          </div>

          <div className="mb-6 lg:mb-10">
            <h2 className="text-4xl font-bold text-[#1A1A1A] mb-2 lg:mb-3">Sign in</h2>
            <p className="text-sm lg:text-base text-[#6B7280]">
              Don't have an account?{' '}
              <Link to="/signup" className="text-[#F05225] font-semibold hover:underline">
                Create now
              </Link>
            </p>
          </div>

          <form className="space-y-4 lg:space-y-6 w-full max-w-md" onSubmit={handleLogin}>

            <div className="space-y-1 lg:space-y-2">
              <Label htmlFor="email" className="text-sm lg:text-base font-semibold text-[#374151]">
                E-mail
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="example@gmail.com"
                className="h-11 lg:h-12 bg-white border border-[#E5E7EB] rounded-xl focus-visible:ring-1 focus-visible:ring-[#F05225] transition-all text-base shadow-sm"
              />
            </div>

            <div className="space-y-1 lg:space-y-2">
              <Label htmlFor="password" className="text-sm lg:text-base font-semibold text-[#374151]">
                Password
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="@#*%"
                  className="h-11 lg:h-12 bg-white border border-[#E5E7EB] rounded-xl focus-visible:ring-1 focus-visible:ring-[#F05225] pr-12 transition-all text-base shadow-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#4B5563]"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && (
              <p className="text-red-500 text-xs lg:text-sm font-medium">{error}</p>
            )}

            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-[#E8341A] to-[#F5A623] hover:opacity-90 text-white font-bold h-11 lg:h-12 rounded-xl text-sm lg:text-base transition-all shadow-sm border-none"
            >
              Sign in
            </Button>

          </form>
        </div>

        {/* Footer */}
        <div className="flex justify-center pb-6 px-8">
          <div className="flex items-center space-x-4 text-[11px] lg:text-sm font-semibold text-[#9CA3AF]">
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

      {/* Right Side - Desktop only */}
      <div className="hidden lg:block lg:w-1/2 p-4 pl-0">
        <div className="h-full w-full overflow-hidden rounded-[28px]">
          <img
            src={loginpic}
            alt="Login illustration"
            className="w-full h-full object-cover select-none"
          />
        </div>
      </div>

    </div>
  );
}
