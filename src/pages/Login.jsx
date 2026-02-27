import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'
import { authService } from '../services/auth.service'
import logo from '/damsole.png'

const Login = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    })
    setError('')
  }

  const getDashboardRoute = (role) => {
    const roleRoutes = {
      'agent': '/',
      'relationship_manager': '/',
      'regional_manager': '/',
      'franchise': '/',
      'accounts_manager': '/',
      'super_admin': '/',
    }
    return roleRoutes[role] || '/'
  }

  const performLogin = async (email, password) => {
    setError('')
    setLoading(true)

    try {
      const response = await api.auth.login({ email, password })

      // Backend returns: { success: true, data: user, token }
      if (response.success && response.token) {
        // Store token
        authService.setToken(response.token)

        // Store user data
        if (response.data) {
          authService.setUser(response.data)

          // Get user role and redirect to appropriate dashboard
          const userRole = response.data.role
          const dashboardRoute = getDashboardRoute(userRole)

          // Redirect to role-specific dashboard
          navigate(dashboardRoute)
          // Small delay to ensure token is stored
          setTimeout(() => {
            window.location.reload()
          }, 100)
        } else {
          setError('Login failed. User data not received.')
        }
      } else {
        setError('Login failed. Invalid response from server.')
      }
    } catch (err) {
      setError(err.message || 'Login failed. Please check your credentials.')
      console.error('Login error:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    await performLogin(formData.email, formData.password)
  }

  const handleQuickLogin = async (role) => {
    // Demo credentials per role (must exist in backend)
    // These emails & passwords match the seeded users in the database
    const demoCredentials = {
      admin: {
        email: 'admin@gmail.com',
        password: 'admin@123',
      },
      regional_manager: {
        email: 'regionalmanager@damsole.com',
        password: 'regionalmanager@123',
      },
      relationship_manager: {
        email: 'officestaff@damsole.com',
        password: 'staff@123',
      },
      franchise: {
        email: 'franchiseowner@damsole.com',
        password: 'franchiseowner@123',
      },
      agent: {
        email: 'agent@damsole.com',
        password: 'agent@123',
      },
      accounts_manager: {
        email: 'accountsmanager@damsole.com',
        password: 'accountsmanager@123',
      },
    }

    const credentials = demoCredentials[role] || demoCredentials.admin

    // Update form fields for visual feedback
    setFormData(credentials)

    // Perform login with demo credentials
    await performLogin(credentials.email, credentials.password)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 via-white to-accent-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full">
        {/* Logo and Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-6">
            <img src={logo} alt="YKC FINSERV" className="h-16 w-auto object-contain" />
          </div>
          <h2 className="text-3xl font-bold text-primary-900 mb-2">
            Welcome Back
          </h2>
          <p className="text-sm text-gray-600">
            Sign in to your DAMSOLE FINSERV account
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
          <form className="space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className="bg-red-50 border-l-4 border-red-500 text-red-700 px-4 py-3 rounded-md flex items-center gap-2">
                <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <span className="text-sm">{error}</span>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-semibold text-gray-700 mb-2">
                  Email Address
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                    </svg>
                  </div>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all text-gray-900 placeholder-gray-400"
                    placeholder="Enter your email"
                    value={formData.email}
                    onChange={handleChange}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-semibold text-gray-700 mb-2">
                  Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all text-gray-900 placeholder-gray-400"
                    placeholder="Enter your password"
                    value={formData.password}
                    onChange={handleChange}
                  />
                </div>
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center items-center gap-2 py-3 px-4 border border-transparent text-base font-semibold rounded-lg text-white bg-primary-900 hover:bg-primary-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Signing in...</span>
                  </>
                ) : (
                  <span>Sign In</span>
                )}
              </button>
            </div>
          </form>

          {/* Quick Login Section */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <p className="text-center text-sm font-semibold text-gray-700 mb-4">
              Quick Login (Demo)
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleQuickLogin('admin')}
                disabled={loading}
                className="w-full flex justify-center items-center gap-2 py-2.5 px-4 text-sm font-medium rounded-lg text-primary-900 bg-primary-50 hover:bg-primary-100 border border-primary-200 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                Admin
              </button>
              <button
                type="button"
                onClick={() => handleQuickLogin('accounts_manager')}
                disabled={loading}
                className="w-full flex justify-center items-center gap-2 py-2.5 px-4 text-sm font-medium rounded-lg text-primary-900 bg-primary-50 hover:bg-primary-100 border border-primary-200 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
                Accountant
              </button>
              <button
                type="button"
                onClick={() => handleQuickLogin('franchise')}
                disabled={loading}
                className="w-full flex justify-center items-center gap-2 py-2.5 px-4 text-sm font-medium rounded-lg text-primary-900 bg-primary-50 hover:bg-primary-100 border border-primary-200 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                Franchise
              </button>
              <button
                type="button"
                onClick={() => handleQuickLogin('agent')}
                disabled={loading}
                className="w-full flex justify-center items-center gap-2 py-2.5 px-4 text-sm font-medium rounded-lg text-primary-900 bg-primary-50 hover:bg-primary-100 border border-primary-200 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c1.657 0 3-1.343 3-3S13.657 5 12 5 9 6.343 9 8s1.343 3 3 3zm0 2c-2.21 0-4 1.343-4 3v1h8v-1c0-1.657-1.79-3-4-3z" />
                </svg>
                Agent
              </button>
              <button
                type="button"
                onClick={() => handleQuickLogin('regional_manager')}
                disabled={loading}
                className="w-full flex justify-center items-center gap-2 py-2.5 px-4 text-sm font-medium rounded-lg text-primary-900 bg-primary-50 hover:bg-primary-100 border border-primary-200 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                Regional Manager
              </button>
              <button
                type="button"
                onClick={() => handleQuickLogin('relationship_manager')}
                disabled={loading}
                className="w-full flex justify-center items-center gap-2 py-2.5 px-4 text-sm font-medium rounded-lg text-primary-900 bg-primary-50 hover:bg-primary-100 border border-primary-200 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                Relationship Manager
              </button>
            </div>
            <p className="text-xs text-center text-gray-500 mt-3">
              Each role uses its own demo email & password.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Login
