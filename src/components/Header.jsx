import { useState, useEffect, useRef } from 'react'
import ProfileDropdown from './ProfileDropdown'
import { authService } from '../services/auth.service'
import api from '../services/api'

const Header = () => {
  const [isNotificationOpen, setIsNotificationOpen] = useState(false)
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [user, setUser] = useState({
    name: 'User Name',
    email: 'user@example.com',
    profileImage: null,
    role: null,
  })
  const notificationRef = useRef(null)
  const profileRef = useRef(null)

  const updateUserState = (userData) => {
    if (userData) {
      setUser({
        name: userData.name || userData.fullName || 'User Name',
        email: userData.email || 'user@example.com',
        profileImage: userData.profileImage || null,
        role: userData.role || null,
      })
    }
  }

  const getDashboardTitle = () => {
    if (!user.role) return 'Dashboard'

    const roleMap = {
      'agent': 'Agent Dashboard',
      'franchise': 'Franchisee Dashboard',
      'regional_manager': 'Regional Manager Dashboard',
      'relationship_manager': 'Relationship Manager Dashboard',
      'accounts_manager': 'Accounts Manager Dashboard',
      'super_admin': 'Admin Dashboard',
    }

    return roleMap[user.role] || 'Dashboard'
  }

  useEffect(() => {
    // Only fetch user if authenticated
    if (!authService.isAuthenticated()) {
      return
    }

    // Get user from localStorage or fetch from API
    const storedUser = authService.getUser()
    if (storedUser) {
      updateUserState(storedUser)
    } else {
      // Try to fetch current user from API
      api.auth.getCurrentUser()
        .then((response) => {
          const userData = response.data || response
          if (userData) {
            authService.setUser(userData)
            updateUserState(userData)
          }
        })
        .catch((error) => {
          console.error('Error fetching user:', error)
        })
    }

    // Listen for profile update events
    const handleProfileUpdate = (event) => {
      const userData = event.detail
      if (userData) {
        authService.setUser(userData)
        updateUserState(userData)
      }
    }

    window.addEventListener('userProfileUpdated', handleProfileUpdate)

    return () => {
      window.removeEventListener('userProfileUpdated', handleProfileUpdate)
    }
  }, [])

 

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target)) {
        setIsNotificationOpen(false)
      }
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setIsProfileOpen(false)
      }
    }

    if (isNotificationOpen || isProfileOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isNotificationOpen, isProfileOpen])

  return (
    <header className="bg-white border-b border-gray-200 h-16 px-6 flex items-center justify-between relative z-[100] w-full overflow-visible">
      {/* Left Section */}
      <div className="flex items-center gap-4 min-w-0 flex-shrink">
        <h1 className="text-2xl font-bold text-gray-900 truncate">{getDashboardTitle()}</h1>
        <div className="flex items-center gap-2">
        </div>
      </div>

      {/* Right Section */}
      <div className="flex items-center gap-4 pr-0 flex-shrink-0 relative">
        <div className="relative z-[110]" ref={profileRef}>
          <button
            onClick={() => setIsProfileOpen(!isProfileOpen)}
            className="w-8 h-8 rounded-full bg-primary-900 flex items-center justify-center text-white font-semibold hover:bg-primary-800 transition-colors cursor-pointer relative z-[110]"
          >
            {user.profileImage ? (
              <img
                src={user.profileImage}
                alt={user.name}
                className="w-8 h-8 rounded-full object-cover"
              />
            ) : (
              <span>{user.name.charAt(0).toUpperCase()}</span>
            )}
          </button>
          <ProfileDropdown
            isOpen={isProfileOpen}
            onClose={() => setIsProfileOpen(false)}
            user={user}
          />
        </div>
      </div>
    </header>
  )
}

export default Header
