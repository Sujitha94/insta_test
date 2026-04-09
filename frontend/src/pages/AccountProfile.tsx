import { motion } from 'framer-motion'
import { LogOut, User, Mail, Edit2, Save, X } from 'lucide-react'
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
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

export default function AccountProfile() {
  const navigate = useNavigate()
  const [profileData, setProfileData] = useState<AccountProfileData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [editedName, setEditedName] = useState('')
  const [editedEmail, setEditedEmail] = useState('')
  const [saving, setSaving] = useState(false)

  const fetchAccountProfile = async () => {
    try {
      const tenentId = getWithExpiry('tenentid')
      if (!tenentId) {
        navigate('/login')
        return
      }

      const response = await axios.get(
        'https://inocencia-shiftiest-nonodorously.ngrok-free.dev/api/accountprofileroute/accountprofile',
        {
          headers: {
            'Content-Type': 'application/json',
            'ngrok-skip-browser-warning': 'true',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization, ngrok-skip-browser-warning',
          },
          params: { tenentId },
          withCredentials: false,
        }
      )

      if (response.data.error) {
        console.error('Backend returned error response', response)
        setError(response.data.error)
        return
      }

      if (response.data && response.data.name && response.data.email) {
        const accountInfo: AccountProfileData = {
          name: response.data.name,
          email: response.data.email,
          success: response.data.success,
        }
        setProfileData(accountInfo)
        setEditedName(accountInfo.name)
        setEditedEmail(accountInfo.email)
        setError(null)
      } else {
        setError('Invalid data received from server')
      }
    } catch (error: any) {
      console.error('Error fetching account profile:', error.response?.data || error.message)
      if (error.response) {
        console.log('Error response status:', error.response.status)
        console.log('Error response data:', error.response.data)
      }
      setError(error.message || 'Failed to fetch account profile')
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateProfile = async () => {
    try {
      setSaving(true)
      const tenentId = getWithExpiry('tenentid')
      if (!tenentId) {
        navigate('/login')
        return
      }

      const response = await axios.put(
        'https://inocencia-shiftiest-nonodorously.ngrok-free.dev/api/accountprofileroute/accountprofile',
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
        setProfileData({ name: editedName, email: editedEmail, success: true })
        setIsEditing(false)
        setError(null)
      } else if (response.data.error) {
        setError(response.data.error)
      }
    } catch (error: any) {
      setError(error.response?.data?.message || error.message || 'Failed to update profile')
    } finally {
      setSaving(false)
    }
  }

  const handleEditClick = () => {
    setIsEditing(true)
    setEditedName(profileData?.name || '')
    setEditedEmail(profileData?.email || '')
  }

  const handleCancelEdit = () => {
    setIsEditing(false)
    setEditedName(profileData?.name || '')
    setEditedEmail(profileData?.email || '')
    setError(null)
  }

  useEffect(() => {
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

  const retryFetch = () => {
    setLoading(true)
    setError(null)
    fetchAccountProfile()
  }

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={fadeIn}
      className="min-h-screen bg-gray-50 dark:bg-gray-900"
    >
      <div className="container mx-auto p-4 sm:p-6 space-y-6 sm:space-y-8">

        <motion.header
          variants={slideIn}
          className="flex flex-col sm:flex-row sm:justify-between sm:items-center bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 sm:p-6 border-l-4 border-orange-500 gap-4"
        >
          <h1 className="text-2xl sm:text-3xl font-bold text-black dark:text-white">
            Account Profile
          </h1>
          <div className="flex items-center space-x-2 sm:space-x-4">
            {!isEditing && !loading && profileData && (
              <Button
                variant="outline"
                size="sm"
                className="flex-1 sm:flex-none text-orange-600 hover:text-white hover:bg-orange-500 border-orange-200"
                onClick={handleEditClick}
              >
                <Edit2 className="mr-2 h-4 w-4" />
                Edit
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="flex-1 sm:flex-none text-gray-600 hover:text-orange-600 hover:bg-orange-50"
              onClick={handleLogout}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Log Out
            </Button>
          </div>
        </motion.header>

        <motion.div
          variants={slideIn}
          className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 sm:p-8"
        >
          {loading ? (
            <div className="flex items-center justify-center p-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
            </div>
          ) : error ? (
            <div className="text-center p-4 sm:p-8">
              <p className="text-orange-600 mb-4">{error}</p>
              <Button
                variant="outline"
                onClick={retryFetch}
                className="hover:bg-orange-50 border-orange-200 text-orange-600"
              >
                Retry
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row items-center sm:items-start space-y-6 sm:space-y-0 sm:space-x-8">
                <Avatar className="h-24 w-24 ring-4 ring-orange-50">
                  <AvatarFallback className="bg-orange-50 text-orange-600 text-2xl font-bold">
                    {(isEditing ? editedName : profileData?.name)?.[0]?.toUpperCase() || '?'}
                  </AvatarFallback>
                </Avatar>

                <div className="space-y-4 flex-1 w-full">
                  {isEditing ? (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-500 flex items-center">
                          <User className="h-4 w-4 mr-2 text-orange-500" /> Name
                        </label>
                        <Input
                          value={editedName}
                          onChange={(e) => setEditedName(e.target.value)}
                          placeholder="Enter your name"
                          className="text-lg font-semibold focus-visible:ring-orange-500 w-full"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-500 flex items-center">
                          <Mail className="h-4 w-4 mr-2 text-orange-500" /> Email
                        </label>
                        <Input
                          value={editedEmail}
                          onChange={(e) => setEditedEmail(e.target.value)}
                          placeholder="Enter your email"
                          type="email"
                          className="text-lg focus-visible:ring-orange-500 w-full"
                        />
                      </div>
                      <div className="flex flex-col sm:flex-row gap-3 pt-2">
                        <Button
                          onClick={handleUpdateProfile}
                          disabled={saving}
                          className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white border-0 w-full sm:w-auto"
                        >
                          {saving ? (
                            <>
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                              Saving...
                            </>
                          ) : (
                            <>
                              <Save className="mr-2 h-4 w-4" />
                              Save Changes
                            </>
                          )}
                        </Button>
                        <Button
                          onClick={handleCancelEdit}
                          variant="outline"
                          disabled={saving}
                          className="border-gray-200 hover:bg-orange-50 w-full sm:w-auto"
                        >
                          <X className="mr-2 h-4 w-4" />
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center sm:text-left space-y-2">
                      <div className="flex items-center justify-center sm:justify-start space-x-2">
                        <User className="hidden sm:block h-5 w-5 text-orange-500" />
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                          {profileData?.name || 'N/A'}
                        </h2>
                      </div>
                      <div className="flex items-center justify-center sm:justify-start space-x-2">
                        <Mail className="hidden sm:block h-5 w-5 text-orange-500" />
                        <p className="text-gray-600 dark:text-gray-300 text-lg">
                          {profileData?.email || 'N/A'}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {!isEditing && (
                <div className="border-t border-gray-200 dark:border-gray-700 pt-6 mt-6">
                  <h3 className="text-lg font-semibold bg-clip-text text-transparent bg-gradient-to-r from-orange-500 to-orange-600 mb-4 inline-block">
                    Account Details
                  </h3>
                  <div className="space-y-1">
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center py-3 border-b border-gray-50 dark:border-gray-700 gap-1">
                      <span className="text-sm sm:text-base text-gray-500 dark:text-gray-400">Full Name</span>
                      <span className="text-base sm:text-lg text-gray-900 dark:text-white font-medium">
                        {profileData?.name || 'Nil'}
                      </span>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center py-3 border-b border-gray-50 dark:border-gray-700 gap-1">
                      <span className="text-sm sm:text-base text-gray-500 dark:text-gray-400">Email Address</span>
                      <span className="text-base sm:text-lg text-gray-900 dark:text-white font-medium break-all">
                        {profileData?.email || 'Nil'}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </motion.div>

      </div>
    </motion.div>
  )
}
