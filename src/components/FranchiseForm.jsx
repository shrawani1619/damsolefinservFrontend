import { useState, useEffect } from 'react'
import { authService } from '../services/auth.service'
import { api } from '../services/api'

const FranchiseForm = ({ franchise, onSave, onClose }) => {
  const isCreate = !franchise
  const isAdmin = authService.getUser()?.role === 'super_admin'
  const [regionalManagers, setRegionalManagers] = useState([])
  const [formData, setFormData] = useState({
    name: '',
    ownerName: '',
    email: '',
    mobile: '',
    password: '',
    status: 'active',
    regionalManager: '',
    address: {
      street: '',
      city: '',
      state: '',
      pincode: '',
    },
  })

  const [errors, setErrors] = useState({})

  useEffect(() => {
    if (isAdmin) {
      api.users.getAll({ role: 'regional_manager', limit: 200 }).then((res) => {
        setRegionalManagers(res.data || [])
      }).catch(() => setRegionalManagers([]))
    }
  }, [isAdmin])

  useEffect(() => {
    if (franchise) {
      setFormData({
        name: franchise.name || '',
        ownerName: franchise.ownerName || '',
        email: franchise.email || '',
        mobile: franchise.mobile || '',
        password: '',
        status: franchise.status || 'active',
        regionalManager: franchise.regionalManager?._id || franchise.regionalManager || '',
        address: {
          street: franchise.address?.street || '',
          city: franchise.address?.city || '',
          state: franchise.address?.state || '',
          pincode: franchise.address?.pincode || '',
        },
      })
    }
  }, [franchise])

  const validate = () => {
    const newErrors = {}
    if (!formData.name.trim()) newErrors.name = 'Franchise name is required'
    if (!formData.ownerName.trim()) newErrors.ownerName = 'Owner name is required'
    if (isCreate) {
      if (!formData.email?.trim()) newErrors.email = 'Email is required for login'
      if (!formData.mobile?.trim()) newErrors.mobile = 'Mobile is required'
      if (!formData.password) newErrors.password = 'Password is required for owner login'
      else if (formData.password.length < 6) newErrors.password = 'Password must be at least 6 characters'
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (validate()) {
      const payload = { ...formData }
      if (!isCreate) {
        delete payload.password
      }
      if (!isAdmin) {
        delete payload.regionalManager
      } else {
        payload.regionalManager = formData.regionalManager || null
      }
      onSave(payload)
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

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Franchise Name <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          name="name"
          value={formData.name}
          onChange={handleChange}
          className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 ${errors.name ? 'border-red-500' : 'border-gray-300'
            }`}
          placeholder="Enter franchise name"
        />
        {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Owner Name <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          name="ownerName"
          value={formData.ownerName}
          onChange={handleChange}
          className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 ${errors.ownerName ? 'border-red-500' : 'border-gray-300'
            }`}
          placeholder="Enter owner name"
        />
        {errors.ownerName && <p className="mt-1 text-sm text-red-600">{errors.ownerName}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Email {isCreate && <span className="text-red-500">*</span>}
        </label>
        <input
          type="email"
          name="email"
          value={formData.email}
          onChange={handleChange}
          className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 ${errors.email ? 'border-red-500' : 'border-gray-300'
            }`}
          placeholder="Owner login email"
        />
        {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Mobile {isCreate && <span className="text-red-500">*</span>}
        </label>
        <input
          type="text"
          name="mobile"
          value={formData.mobile}
          onChange={handleChange}
          className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 ${errors.mobile ? 'border-red-500' : 'border-gray-300'
            }`}
          placeholder="Owner mobile number"
        />
        {errors.mobile && <p className="mt-1 text-sm text-red-600">{errors.mobile}</p>}
      </div>

      {isCreate && (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Owner Login Password <span className="text-red-500">*</span>
            </label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 ${errors.password ? 'border-red-500' : 'border-gray-300'
                }`}
              placeholder="Min 6 characters"
            />
            {errors.password && <p className="mt-1 text-sm text-red-600">{errors.password}</p>}
          </div>
        </>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Street Address
        </label>
        <input
          type="text"
          name="address.street"
          value={formData.address.street}
          onChange={(e) => setFormData(prev => ({
            ...prev,
            address: { ...prev.address, street: e.target.value }
          }))}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          placeholder="Enter street address"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            City
          </label>
          <input
            type="text"
            name="address.city"
            value={formData.address.city}
            onChange={(e) => setFormData(prev => ({
              ...prev,
              address: { ...prev.address, city: e.target.value }
            }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            placeholder="Enter city"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            State
          </label>
          <input
            type="text"
            name="address.state"
            value={formData.address.state}
            onChange={(e) => setFormData(prev => ({
              ...prev,
              address: { ...prev.address, state: e.target.value }
            }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            placeholder="Enter state"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Pincode
        </label>
        <input
          type="text"
          name="address.pincode"
          value={formData.address.pincode}
          onChange={(e) => setFormData(prev => ({
            ...prev,
            address: { ...prev.address, pincode: e.target.value }
          }))}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          placeholder="Enter pincode"
        />
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

      {isAdmin && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Regional Manager
          </label>
          <select
            name="regionalManager"
            value={formData.regionalManager}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="">None</option>
            {regionalManagers.map((rm) => (
              <option key={rm._id} value={rm._id}>
                {rm.name} {rm.email ? `(${rm.email})` : ''}
              </option>
            ))}
          </select>
        </div>
      )}

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
          {franchise ? 'Update Franchise' : 'Create Franchise'}
        </button>
      </div>
    </form>
  )
}

export default FranchiseForm
