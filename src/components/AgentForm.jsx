import { useState, useEffect, useMemo } from 'react'
import api from '../services/api'
import { authService } from '../services/auth.service'

const AgentForm = ({ agent, onSave, onClose }) => {
  const currentUser = useMemo(() => authService.getUser(), [])

  const defaultManagedByModel = currentUser?.role === 'franchise' ? 'Franchise' : 'Franchise'

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    status: 'active',
    // new flexible ownership fields
    managedBy: '',
    managedByModel: defaultManagedByModel, // or 'RelationshipManager'
  })

  const [errors, setErrors] = useState({})
  const [franchises, setFranchises] = useState([])
  const [relationshipManagers, setRelationshipManagers] = useState([])
  const [franchiseSearch, setFranchiseSearch] = useState('')
  const [rmSearch, setRmSearch] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [loadingFranchises, setLoadingFranchises] = useState(false)
  const [loadingRMs, setLoadingRMs] = useState(false)

  useEffect(() => {
    // If the logged in user is a franchise owner, default ownership to their franchise and prevent changing it
    if (currentUser && currentUser.role === 'franchise') {
      const franchiseId = currentUser.franchiseOwned || currentUser.franchise?._id || currentUser.franchise
      setFormData(prev => ({
        ...prev,
        managedByModel: 'Franchise',
        managedBy: franchiseId || prev.managedBy,
      }))
      // Pre-fill franchise search text if franchises list already loaded
      if (franchiseId && franchises.length > 0) {
        const found = franchises.find(f => (f._id || f.id)?.toString() === franchiseId?.toString())
        if (found) setFranchiseSearch(found.name)
      } else if (currentUser.franchise && currentUser.franchise.name) {
        setFranchiseSearch(currentUser.franchise.name)
      }
    }

    const fetchFranchises = async () => {
      try {
        setLoadingFranchises(true)
        const response = await api.franchises.getActive()
        const data = response.data || response || []
        if (Array.isArray(data)) {
          setFranchises(data)
        }
      } catch (error) {
        console.error('Failed to fetch franchises:', error)
      } finally {
        setLoadingFranchises(false)
      }
    }
    const fetchRelationshipManagers = async () => {
      try {
        setLoadingRMs(true)
        const resp = await api.relationshipManagers.getAll({ status: 'active' })
        const rmData = resp.data || resp || []
        if (Array.isArray(rmData)) setRelationshipManagers(rmData)
      } catch (err) {
        console.error('Failed to fetch relationship managers:', err)
      } finally {
        setLoadingRMs(false)
      }
    }

    fetchFranchises()
    fetchRelationshipManagers()
  }, [])

  useEffect(() => {
    if (agent) {
      const managedById = agent.managedBy?._id || agent.managedBy || agent.franchise?._id || agent.franchise || ''
      const managedByModel = agent.managedByModel || (agent.franchise ? 'Franchise' : 'Franchise')

      setFormData({
        name: agent.name || '',
        email: agent.email || '',
        phone: agent.phone || agent.mobile || '',
        status: agent.status || 'active',
        managedBy: managedById,
        managedByModel,
      })
      
      // Set initial search string if franchise is populated
      // populate search text for managedBy depending on type
      if (managedByModel === 'Franchise') {
        if (agent.franchise && typeof agent.franchise === 'object' && agent.franchise.name) {
          setFranchiseSearch(agent.franchise.name)
        } else if (managedById && franchises.length > 0) {
          const found = franchises.find(f => f._id === managedById || f.id === managedById)
          if (found) setFranchiseSearch(found.name)
        }
      } else {
        if (agent.managedBy && typeof agent.managedBy === 'object' && agent.managedBy.name) {
          setRmSearch(agent.managedBy.name)
        } else if (managedById && relationshipManagers.length > 0) {
          const found = relationshipManagers.find(r => r._id === managedById || r.id === managedById)
          if (found) setRmSearch(found.name)
        }
      }
    }
  }, [agent, franchises])

  // Whether the current user should be restricted to their own franchise
  const isFranchiseCreator = currentUser?.role === 'franchise'

  const validate = (dataParam) => {
    const newErrors = {}
    const data = dataParam || formData
    if (!data.name.trim()) newErrors.name = 'Name is required'
    if (!data.email.trim()) newErrors.email = 'Email is required'
    else if (!/\S+@\S+\.\S+/.test(data.email)) newErrors.email = 'Email is invalid'
    if (!data.phone.trim()) newErrors.phone = 'Phone is required'
    if (!data.managedBy) newErrors.managedBy = `${data.managedByModel === 'Franchise' ? 'Franchise' : 'Relationship Manager'} is required`

    // Password validation - required for new agents, optional for updates
    if (!agent) {
      if (!formData.password || formData.password.length < 6) {
        newErrors.password = 'Password is required and must be at least 6 characters'
      }
    } else {
      if (formData.password && formData.password.length < 6) {
        newErrors.password = 'Password must be at least 6 characters'
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    // Ensure typed names are resolved to IDs before validation/submit
    const resolveManagedByIfNeeded = () => {
      // already an id
      if (formData.managedBy) return formData
      if (formData.managedByModel === 'Franchise' && franchiseSearch) {
        const f = franchises.find(x => x.name.toLowerCase() === franchiseSearch.toLowerCase())
        if (f) return { ...formData, managedBy: f._id || f.id }
      }
      if (formData.managedByModel === 'RelationshipManager' && rmSearch) {
        const r = relationshipManagers.find(x => x.name.toLowerCase() === rmSearch.toLowerCase())
        if (r) return { ...formData, managedBy: r._id || r.id }
      }
      return formData
    }

    const resolved = resolveManagedByIfNeeded()
    setFormData(resolved)
    if (validate(resolved)) {
      onSave(resolved)
    }
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }))
    }
  }

  const handleFranchiseSearchChange = (e) => {
    const value = e.target.value
    setFranchiseSearch(value)
    setShowSuggestions(true)
    // If user clears input, allow them to see required error on submit
    if (value === '') {
        setFormData(prev => ({ ...prev, managedBy: '' }))
    }
  }

  const handleRmSearchChange = (e) => {
    const value = e.target.value
    setRmSearch(value)
    setShowSuggestions(true)
    if (value === '') {
      setFormData(prev => ({ ...prev, managedBy: '' }))
    }
  }

  const selectFranchise = (franchise) => {
    setFormData(prev => ({ ...prev, managedBy: franchise._id || franchise.id, managedByModel: 'Franchise' }))
    setFranchiseSearch(franchise.name)
    setShowSuggestions(false)
    if (errors.managedBy) {
      setErrors(prev => ({ ...prev, managedBy: '' }))
    }
  }

  const selectRM = (rm) => {
    setFormData(prev => ({ ...prev, managedBy: rm._id || rm.id, managedByModel: 'RelationshipManager' }))
    setRmSearch(rm.name)
    setShowSuggestions(false)
    if (errors.managedBy) {
      setErrors(prev => ({ ...prev, managedBy: '' }))
    }
  }

  const filteredFranchises = franchises.filter(f => f.name.toLowerCase().includes(franchiseSearch.toLowerCase()))
  const filteredRMs = relationshipManagers.filter(r => r.name.toLowerCase().includes(rmSearch.toLowerCase()))

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Full Name <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          name="name"
          value={formData.name}
          onChange={handleChange}
          className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 ${errors.name ? 'border-red-500' : 'border-gray-300'
            }`}
          placeholder="Enter full name"
        />
        {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Email <span className="text-red-500">*</span>
        </label>
        <input
          type="email"
          name="email"
          value={formData.email}
          onChange={handleChange}
          className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 ${errors.email ? 'border-red-500' : 'border-gray-300'
            }`}
          placeholder="Enter email address"
        />
        {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Phone <span className="text-red-500">*</span>
        </label>
        <input
          type="tel"
          name="phone"
          value={formData.phone}
          onChange={handleChange}
          className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 ${errors.phone ? 'border-red-500' : 'border-gray-300'
            }`}
          placeholder="Enter phone number"
        />
        {errors.phone && <p className="mt-1 text-sm text-red-600">{errors.phone}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Managed By <span className="text-red-500">*</span>
        </label>
        <div className="flex gap-3 mb-2">
          {!isFranchiseCreator && (
            <>
              <label className="inline-flex items-center">
                <input
                  type="radio"
                  name="managedByModel"
                  value="Franchise"
                  checked={formData.managedByModel === 'Franchise'}
                  onChange={() => setFormData(prev => ({ ...prev, managedByModel: 'Franchise', managedBy: '' }))}
                  className="mr-2"
                />
                Franchise
              </label>
              <label className="inline-flex items-center">
                <input
                  type="radio"
                  name="managedByModel"
                  value="RelationshipManager"
                  checked={formData.managedByModel === 'RelationshipManager'}
                  onChange={() => setFormData(prev => ({ ...prev, managedByModel: 'RelationshipManager', managedBy: '' }))}
                  className="mr-2"
                />
                Relationship Manager
              </label>
            </>
          )}
          {isFranchiseCreator && (
            <div className="text-sm text-gray-700">Associated with your franchise</div>
          )}
        </div>

        {formData.managedByModel === 'Franchise' ? (
          <div className="relative">
            <input
              type="text"
              value={franchiseSearch}
              onChange={handleFranchiseSearchChange}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 ${errors.managedBy ? 'border-red-500' : 'border-gray-300'
                }`}
              placeholder={isFranchiseCreator ? 'Your franchise' : 'Search and select franchise'}
              autoComplete="off"
              readOnly={isFranchiseCreator}
            />
            {showSuggestions && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                {loadingFranchises ? (
                  <div className="px-3 py-2 text-sm text-gray-500">Loading...</div>
                ) : filteredFranchises.length > 0 ? (
                  filteredFranchises.map((franchise) => (
                    <div
                      key={franchise._id || franchise.id}
                      onMouseDown={(e) => {
                        e.preventDefault()
                        if (!isFranchiseCreator) selectFranchise(franchise)
                      }}
                      className="px-3 py-2 cursor-pointer hover:bg-gray-100 text-sm"
                    >
                      {franchise.name}
                    </div>
                  ))
                ) : (
                  <div className="px-3 py-2 text-sm text-gray-500">No franchises found</div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="relative">
            <input
              type="text"
              value={rmSearch}
              onChange={handleRmSearchChange}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 ${errors.managedBy ? 'border-red-500' : 'border-gray-300'
                }`}
              placeholder="Search and select relationship manager"
              autoComplete="off"
              readOnly={isFranchiseCreator}
            />
            {showSuggestions && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                {loadingRMs ? (
                  <div className="px-3 py-2 text-sm text-gray-500">Loading...</div>
                ) : filteredRMs.length > 0 ? (
                  filteredRMs.map((rm) => (
                    <div
                      key={rm._id || rm.id}
                      onMouseDown={(e) => {
                        e.preventDefault()
                        if (!isFranchiseCreator) selectRM(rm)
                      }}
                      className="px-3 py-2 cursor-pointer hover:bg-gray-100 text-sm"
                    >
                      {rm.name}
                    </div>
                  ))
                ) : (
                  <div className="px-3 py-2 text-sm text-gray-500">No relationship managers found</div>
                )}
              </div>
            )}
          </div>
        )}

        {errors.managedBy && <p className="mt-1 text-sm text-red-600">{errors.managedBy}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Password {agent ? '(Optional)' : <span className="text-red-500">*</span>}
        </label>
        <input
          type="password"
          name="password"
          value={formData.password}
          onChange={handleChange}
          className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 ${errors.password ? 'border-red-500' : 'border-gray-300'
            }`}
          placeholder="Enter password (min 6 characters)"
        />
        {errors.password && <p className="mt-1 text-sm text-red-600">{errors.password}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Status <span className="text-red-500">*</span>
        </label>
        <select
          name="status"
          value={formData.status}
          onChange={handleChange}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="px-4 py-2 text-sm font-medium text-white bg-primary-900 rounded-lg hover:bg-primary-800 transition-colors"
        >
          {agent ? 'Update Agent' : 'Create Agent'}
        </button>
      </div>
    </form>
  )
}

export default AgentForm
