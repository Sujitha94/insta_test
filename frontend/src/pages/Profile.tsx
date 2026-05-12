import { motion } from 'framer-motion'
import { LogOut, Instagram, User, Mail, ChevronLeft, Edit2, Users, Image, Globe } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useNavigate } from 'react-router-dom'
import { signOut } from 'firebase/auth'
import { auth } from '../config/Firebase-config'
import { useState, useEffect } from 'react'
import axios from 'axios'
import { getWithExpiry, clearStorage } from '../utils/storage'

axios.defaults.headers.common['ngrok-skip-browser-warning'] = 'true'
axios.defaults.headers.common['Access-Control-Allow-Origin'] = '*'
axios.defaults.withCredentials = false

interface InstagramProfileData {
  username: string;
  name: string;
  profile_picture_url?: string;
  followers_count?: number;
  follows_count?: number;
  media_count?: number;
  account_type?: string;
  biography?: string;
  website?: string;
}

interface AccountProfileData {
  name: string;
  email: string;
  success?: boolean;
}

const fadeIn = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.5 } }
}

const slideIn = {
  hidden: { x: -20, opacity: 0 },
  visible: { x: 0, opacity: 1, transition: { duration: 0.5 } }
}

const formatNumber = (num: number | undefined): string => {
  if (!num) return '0'
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M'
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K'
  return num.toString()
}

export default function Profile() {
  const navigate = useNavigate()

  const [instaData, setInstaData] = useState<InstagramProfileData | null>(null)
  const [instaLoading, setInstaLoading] = useState(true)
  const [instaError, setInstaError] = useState<string | null>(null)

  const [accountData, setAccountData] = useState<AccountProfileData | null>(null)
  const [accountLoading, setAccountLoading] = useState(true)
  const [accountError, setAccountError] = useState<string | null>(null)

  const [isEditing, setIsEditing] = useState(false)
  const [editedName, setEditedName] = useState('')
  const [editedEmail, setEditedEmail] = useState('')
  const [saving, setSaving] = useState(false)

  const fetchInstaProfile = async () => {
    try {
      const tenentId = getWithExpiry('tenentid')
      if (!tenentId) {
        navigate('/login')
        return
      }
      const response = await axios.get('https://snaking-outhouse-oppose.ngrok-free.dev/api/profileroute/profile', {
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
          'Access-Control-Allow-Origin': '*',
        },
        params: { tenentId },
        withCredentials: false,
      })

      if (response.data === 'error') {
        setInstaError('Failed to fetch profile data')
        return
      }

      const profileData = response.data.data || response.data

      if (response.data.success !== false && profileData) {
        setInstaData({
          username: profileData.username || 'N/A',
          name: profileData.name || 'N/A',
          profile_picture_url: profileData.profile_picture_url || undefined,
          followers_count: profileData.followers_count || 0,
          follows_count: profileData.follows_count || 0,
          media_count: profileData.media_count || 0,
          account_type: profileData.account_type || 'PERSONAL',
          biography: profileData.biography || undefined,
          website: profileData.website || undefined,
        })
        setInstaError(null)
      } else {
        setInstaError('Invalid data received from server')
      }
    } catch (error: any) {
      console.error('Error fetching insta profile:', error)
      setInstaError(error.message || 'Failed to fetch profile data')
    } finally {
      setInstaLoading(false)
    }
  }

  const fetchAccountProfile = async () => {
    try {
      const tenentId = getWithExpiry('tenentid')
      if (!tenentId) {
        navigate('/login')
        return
      }
      const response = await axios.get('https://snaking-outhouse-oppose.ngrok-free.dev/api/profileroute/accountprofile', {
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
          'Access-Control-Allow-Origin': '*',
        },
        params: { tenentId },
        withCredentials: false,
      })

      if (response.data.error) {
        setAccountError(response.data.error)
        return
      }

      if (response.data && response.data.name && response.data.email) {
        const accountInfo: AccountProfileData = {
          name: response.data.name,
          email: response.data.email,
          success: response.data.success,
        }
        setAccountData(accountInfo)
        setEditedName(accountInfo.name)
        setEditedEmail(accountInfo.email)
        setAccountError(null)
      } else {
        setAccountError('Invalid data received from server')
      }
    } catch (error: any) {
      console.error('Error fetching account profile:', error)
      setAccountError(error.message || 'Failed to fetch account profile')
    } finally {
      setAccountLoading(false)
    }
  }

  const handleUpdateAccount = async () => {
    try {
      setSaving(true)
      const tenentId = getWithExpiry('tenentid')
      if (!tenentId) {
        navigate('/login')
        return
      }
      const response = await axios.put(
        'https://snaking-outhouse-oppose.ngrok-free.dev/api/profileroute/accountprofile',
        { name: editedName, email: editedEmail, tenentId },
        {
          headers: {
            'Content-Type': 'application/json',
            'ngrok-skip-browser-warning': 'true',
            'Access-Control-Allow-Origin': '*',
          },
          withCredentials: false,
        }
      )

      if (response.data.success || response.data.name) {
        setAccountData({ name: editedName, email: editedEmail, success: true })
        setIsEditing(false)
        setAccountError(null)
      } else if (response.data.error) {
        setAccountError(response.data.error)
      }
    } catch (error: any) {
      console.error('Error updating profile:', error)
      setAccountError(error.response?.data?.message || error.message || 'Failed to update profile')
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => {
    fetchInstaProfile()
    fetchAccountProfile()
  }, [])

  const handleLogout = async () => {
    try {
      await signOut(auth)
      clearStorage()
      navigate('/')
    } catch (error) {
      console.error('Error signing out:', error)
    }
  }

  const handleBack = () => {
    try {
      if (window.history.length > 1) {
        window.history.back()
      } else {
        navigate('/')
      }
    } catch {
      window.history.back()
    }
  }

  const handleEditClick = () => {
    setIsEditing(true)
    setEditedName(accountData?.name || '')
    setEditedEmail(accountData?.email || '')
  }

  const handleCancelEdit = () => {
    setIsEditing(false)
    setEditedName(accountData?.name || '')
    setEditedEmail(accountData?.email || '')
    setAccountError(null)
  }

  const renderInstaContent = () => {
    if (instaLoading) {
      return (
        <div className="flex items-center justify-center p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#e52d27]"></div>
        </div>
      )
    }
    if (instaError) {
      return (
        <div className="text-center p-8">
          <p className="text-[#e52d27] mb-4">{instaError}</p>
          <Button variant="outline" onClick={fetchInstaProfile} className="hover:bg-orange-50 border-orange-200 text-[#e52d27]">
            Retry
          </Button>
        </div>
      )
    }
    return (
      <div className="space-y-6">
        <div className="flex flex-row items-start space-x-4 sm:space-x-6">
          <Avatar className="h-16 w-16 sm:h-24 sm:w-24 ring-4 ring-orange-100 shrink-0">
            {instaData?.profile_picture_url ? (
              <AvatarImage src={instaData.profile_picture_url} alt={instaData.username} />
            ) : (
              <AvatarFallback className="bg-gradient-to-br from-[#e52d27] to-[#ef8e38] text-white text-xl">
                {instaData?.username?.[0]?.toUpperCase() || '?'}
              </AvatarFallback>
            )}
          </Avatar>

          <div className="space-y-1 sm:space-y-3 flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center min-w-0 max-w-full">
                <Instagram className="h-4 w-4 sm:h-5 sm:w-5 text-[#e52d27] mr-1 sm:mr-2 shrink-0" />
                <h2 className="text-base sm:text-2xl font-semibold text-[#1a1a1a] truncate">
                  @{instaData?.username || 'N/A'}
                </h2>
              </div>
              {instaData?.account_type && (
                <span className="px-2 py-0.5 text-[10px] sm:text-xs font-medium bg-orange-100 text-[#e52d27] rounded-full uppercase">
                  {instaData.account_type.replace('_', ' ')}
                </span>
              )}
            </div>

            <p className="text-[#1a1a1a] font-medium text-sm sm:text-lg break-words">
              {instaData?.name || 'N/A'}
            </p>

            {instaData?.biography && (
              <p className="text-gray-500 text-xs sm:text-sm break-words line-clamp-4 sm:line-clamp-none">
                {instaData.biography}
              </p>
            )}

            {instaData?.website && (
              <a
                href={instaData.website}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center space-x-1 text-[#e52d27] hover:text-[#ef8e38] text-xs sm:text-sm transition-colors max-w-full"
              >
                <Globe className="h-3 w-3 sm:h-4 sm:w-4 shrink-0" />
                <span className="truncate break-all">{instaData.website}</span>
              </a>
            )}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 sm:gap-4 pt-6 border-t border-gray-100">
          <div className="text-center p-2 sm:p-4 bg-gradient-to-br from-orange-50 to-red-50 rounded-[12px]">
            <div className="flex items-center justify-center mb-1 sm:mb-2">
              <Users className="h-3 w-3 sm:h-5 sm:w-5 text-[#e52d27]" />
            </div>
            <p className="text-sm sm:text-2xl font-bold text-[#1a1a1a]">{formatNumber(instaData?.followers_count)}</p>
            <p className="text-[9px] sm:text-sm text-[#555555]">Followers</p>
          </div>

          <div className="text-center p-2 sm:p-4 bg-gradient-to-br from-orange-50 to-amber-50 rounded-[12px]">
            <div className="flex items-center justify-center mb-1 sm:mb-2">
              <Users className="h-3 w-3 sm:h-5 sm:w-5 text-[#ef8e38]" />
            </div>
            <p className="text-sm sm:text-2xl font-bold text-[#1a1a1a]">{formatNumber(instaData?.follows_count)}</p>
            <p className="text-[9px] sm:text-sm text-[#555555]">Following</p>
          </div>

          <div className="text-center p-2 sm:p-4 bg-gradient-to-br from-red-50 to-orange-50 rounded-[12px]">
            <div className="flex items-center justify-center mb-1 sm:mb-2">
              <Image className="h-3 w-3 sm:h-5 sm:w-5 text-[#e52d27]" />
            </div>
            <p className="text-sm sm:text-2xl font-bold text-[#1a1a1a]">{formatNumber(instaData?.media_count)}</p>
            <p className="text-[9px] sm:text-sm text-[#555555]">Posts</p>
          </div>
        </div>
      </div>
    )
  }

  const renderAccountContent = () => {
    if (accountLoading) {
      return (
        <div className="flex items-center justify-center p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#e52d27]"></div>
        </div>
      )
    }
    if (accountError) {
      return (
        <div className="text-center p-8">
          <p className="text-[#e52d27] mb-4">{accountError}</p>
          <Button variant="outline" onClick={fetchAccountProfile} className="hover:bg-orange-50 border-orange-200 text-[#e52d27]">
            Retry
          </Button>
        </div>
      )
    }
    return (
      <div className="space-y-6">
        <div className="flex flex-row items-center space-x-4 sm:space-x-6">
          <Avatar className="h-16 w-16 sm:h-24 sm:w-24 ring-4 ring-orange-100 shrink-0">
            <AvatarFallback className="bg-gradient-to-br from-[#e52d27] to-[#ef8e38] text-white text-xl">
              {(isEditing ? editedName : accountData?.name)?.[0]?.toUpperCase() || '?'}
            </AvatarFallback>
          </Avatar>

          <div className="space-y-2 sm:space-y-3 flex-1 min-w-0">
            {isEditing ? (
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <User className="h-4 w-4 text-[#e52d27] shrink-0" />
                  <Input
                    value={editedName}
                    onChange={(e) => setEditedName(e.target.value)}
                    placeholder="Name"
                    className="h-9 text-sm sm:text-base border-orange-200 focus:ring-[#e52d27]"
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <Mail className="h-4 w-4 text-[#ef8e38] shrink-0" />
                  <Input
                    value={editedEmail}
                    onChange={(e) => setEditedEmail(e.target.value)}
                    placeholder="Email"
                    type="email"
                    className="h-9 text-sm sm:text-base border-orange-200 focus:ring-[#e52d27]"
                  />
                </div>
                <div className="flex gap-2 pt-1">
                  <Button
                    onClick={handleUpdateAccount}
                    disabled={saving}
                    className="bg-gradient-to-r from-[#e52d27] to-[#ef8e38] text-white text-xs h-8 px-3"
                  >
                    {saving ? '...' : 'Save'}
                  </Button>
                  <Button onClick={handleCancelEdit} variant="outline" className="text-xs h-8 px-3">
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div>
                <div className="flex items-center space-x-2 min-w-0 mb-2">
                  <User className="h-4 w-4 text-[#e52d27] shrink-0" />
                  <h2 className="text-base sm:text-2xl font-semibold text-[#1a1a1a] truncate">
                    {accountData?.name || 'N/A'}
                  </h2>
                </div>
                <div className="flex items-center space-x-2 min-w-0">
                  <Mail className="h-4 w-4 text-[#ef8e38] shrink-0" />
                  <p className="text-[#555555] text-xs sm:text-lg truncate">
                    {accountData?.email || 'N/A'}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {!isEditing && (
          <div className="border-t border-gray-100 pt-4 mt-4">
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-1">
                <span className="text-gray-400 text-[11px] sm:text-sm uppercase tracking-wider">Full Name</span>
                <span className="text-[#1a1a1a] font-medium text-sm sm:text-base break-words">
                  {accountData?.name || 'Nil'}
                </span>
              </div>
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-1">
                <span className="text-gray-400 text-[11px] sm:text-sm uppercase tracking-wider">Email Address</span>
                <span className="text-[#1a1a1a] font-medium text-sm sm:text-base break-all">
                  {accountData?.email || 'Nil'}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={fadeIn}
      className="min-h-[100dvh] bg-[#fcfcfc] overflow-x-hidden pb-10"
    >
      <div className="container max-w-4xl mx-auto p-4 sm:p-6 space-y-6 sm:space-y-8">

        <button
          onClick={handleBack}
          className="inline-flex mb-2 px-4 py-2 bg-white text-[#555555] rounded-lg font-medium hover:bg-orange-50 shadow-sm transition-all duration-300 border border-orange-100 items-center gap-2"
        >
          <ChevronLeft size={18} className="text-gray-600 shrink-0" />
          Back
        </button>

        <motion.header
          variants={slideIn}
          className="flex justify-between items-center bg-white rounded-[24px] shadow-[0_8px_30px_rgb(0,0,0,0.06)] p-4 sm:p-6 border border-gray-50 gap-4"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-full bg-gradient-to-br from-[#e52d27] to-[#ef8e38] flex items-center justify-center shadow-md shadow-orange-200 shrink-0">
              <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5 sm:w-6 sm:h-6 text-white" stroke="currentColor" strokeWidth="2">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" strokeLinecap="round" strokeLinejoin="round" fill="currentColor" />
              </svg>
            </div>
            <h1 className="text-xl sm:text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-[#e52d27] to-[#ef8e38] truncate">
              Profile Settings
            </h1>
          </div>
          <div className="flex items-center shrink-0">
            <Button
              variant="ghost"
              size="sm"
              className="text-[#e52d27] hover:text-[#e52d27] hover:bg-orange-50 px-2 sm:px-4"
              onClick={handleLogout}
            >
              <LogOut className="sm:mr-2 h-4 w-4 shrink-0" />
              <span className="hidden sm:inline">Log Out</span>
            </Button>
          </div>
        </motion.header>

        <motion.div
          variants={slideIn}
          className="bg-white rounded-[24px] shadow-[0_8px_30px_rgb(0,0,0,0.06)] p-4 sm:p-8 border border-gray-50"
        >
          <h2 className="text-lg sm:text-xl font-semibold text-[#1a1a1a] mb-6 border-b pb-2 border-gray-100">
            Instagram Profile
          </h2>
          {renderInstaContent()}
        </motion.div>

        <motion.div
          variants={slideIn}
          className="bg-white rounded-[24px] shadow-[0_8px_30px_rgb(0,0,0,0.06)] p-5 sm:p-8 border border-gray-50"
        >
          <div className="flex justify-between items-center mb-6 border-b pb-2 border-gray-100">
            <h2 className="text-lg sm:text-xl font-semibold text-[#1a1a1a]">
              Account Details
            </h2>
            {!isEditing && !accountLoading && accountData && (
              <Button
                variant="outline"
                size="sm"
                className="text-[#e52d27] hover:text-[#e52d27] hover:bg-orange-50 border-orange-200 h-8 text-xs sm:h-10 sm:text-sm"
                onClick={handleEditClick}
              >
                <Edit2 className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                <span>Edit</span>
              </Button>
            )}
          </div>
          {renderAccountContent()}
        </motion.div>

      </div>
    </motion.div>
  )
}
