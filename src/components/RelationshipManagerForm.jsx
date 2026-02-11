import { useState, useEffect } from 'react'
import { authService } from '../services/auth.service'
import { api } from '../services/api'

const RelationshipManagerForm = ({ relationshipManager, onSave, onClose }) => {
  const isCreate = !relationshipManager
  const isAdmin = authService.getUser()?.role === 'super_admin'
  const [regionalManagers, setRegionalManagers] = useState([])
  const [allRelationshipManagers, setAllRelationshipManagers] = useState([])
  const [filteredRegionalManagers, setFilteredRegionalManagers] = useState([])
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
  // initialize kyc and bank details
  useEffect(() => {
    setFormData((prev) => ({
      ...prev,
      kyc: prev.kyc || { pan: '', aadhaar: '', gst: '' },
      bankDetails: prev.bankDetails || { accountHolderName: '', accountNumber: '', bankName: '', branch: '', ifsc: '' },
      pendingFile: prev.pendingFile || null,
      documents: prev.documents || [],
    }))
  }, [])

  const [errors, setErrors] = useState({})

  useEffect(() => {
    if (isAdmin) {
      Promise.all([
        api.users.getAll({ role: 'regional_manager', limit: 200 }),
        api.relationshipManagers.getAll({ limit: 500 }),
      ])
        .then(([usersRes, rmsRes]) => {
          setRegionalManagers(usersRes.data || [])
          setAllRelationshipManagers(Array.isArray(rmsRes?.data) ? rmsRes.data : [])
        })
        .catch(() => {
          setRegionalManagers([])
          setAllRelationshipManagers([])
        })
    }
  }, [isAdmin])

  useEffect(() => {
    if (relationshipManager) {
      setFormData({
        name: relationshipManager.name || '',
        ownerName: relationshipManager.ownerName || '',
        email: relationshipManager.email || '',
        mobile: relationshipManager.mobile || '',
        password: '',
        status: relationshipManager.status || 'active',
        regionalManager: relationshipManager.regionalManager?._id || relationshipManager.regionalManager || '',
        address: {
          street: relationshipManager.address?.street || '',
          city: relationshipManager.address?.city || '',
          state: relationshipManager.address?.state || '',
          pincode: relationshipManager.address?.pincode || '',
        },
      kyc: relationshipManager.kyc || { pan: '', aadhaar: '', gst: '' },
      bankDetails: relationshipManager.bankDetails || { accountHolderName: '', accountNumber: '', bankName: '', branch: '', ifsc: '' },
      documents: relationshipManager.documents || [],
      })
    }
  }, [relationshipManager])

  // Compute filtered list of regional managers: only show RMs that are not already assigned
  // to another relationship manager, except allow the one currently assigned to the RM being edited.
  useEffect(() => {
    if (!isAdmin) return
    const assignedRMIds = allRelationshipManagers
      .map((r) => (r.regionalManager ? (r.regionalManager._id || r.regionalManager).toString() : null))
      .filter(Boolean)
    const currentAssigned = relationshipManager ? (relationshipManager.regionalManager?._id || relationshipManager.regionalManager || '') : ''
    const allowed = regionalManagers.filter((rmUser) => {
      const id = rmUser._id || rmUser.id
      if (!id) return false
      const idStr = id.toString()
      // allow if not assigned or it's the current assigned RM for this relationship manager
      return !assignedRMIds.includes(idStr) || idStr === (currentAssigned ? currentAssigned.toString() : '')
    })
    setFilteredRegionalManagers(allowed)
  }, [regionalManagers, allRelationshipManagers, relationshipManager, isAdmin])

  const validate = () => {
    const newErrors = {}
    if (!formData.name.trim()) newErrors.name = 'Relationship manager name is required'
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
      const files = {
        pendingFile: formData.pendingFile || null,
        documents: formData.documents || [],
      }
      onSave(payload, files)
    }
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    if (name.includes('.')) {
      const [parent, child] = name.split('.')
      setFormData((prev) => ({ ...prev, [parent]: { ...(prev[parent] || {}), [child]: value } }))
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }))
    }
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }))
    }
  }

  const handleFileChange = async (e) => {
    const file = e.target.files && e.target.files[0]
    if (!file) return
    if (relationshipManager && (relationshipManager._id || relationshipManager.id)) {
      try {
        const fd = new FormData()
        fd.append('file', file)
        fd.append('entityType', 'user')
        fd.append('entityId', relationshipManager._id || relationshipManager.id)
        fd.append('documentType', 'kyc')
        const resp = await api.documents.upload(fd)
        const doc = resp.data || resp
        setFormData((prev) => ({ ...prev, documents: [...(prev.documents || []), doc] }))
      } catch (err) {
        console.error('File upload failed', err)
      }
    } else {
      setFormData((prev) => ({ ...prev, pendingFile: file }))
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Relationship Manager Name <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          name="name"
          value={formData.name}
          onChange={handleChange}
          className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 ${errors.name ? 'border-red-500' : 'border-gray-300'}`}
          placeholder="Enter relationship manager name"
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
          className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 ${errors.ownerName ? 'border-red-500' : 'border-gray-300'}`}
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
          className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 ${errors.email ? 'border-red-500' : 'border-gray-300'}`}
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
          className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 ${errors.mobile ? 'border-red-500' : 'border-gray-300'}`}
          placeholder="Owner mobile number"
        />
        {errors.mobile && <p className="mt-1 text-sm text-red-600">{errors.mobile}</p>}
      </div>

      {isCreate && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Owner Login Password <span className="text-red-500">*</span>
          </label>
          <input
            type="password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 ${errors.password ? 'border-red-500' : 'border-gray-300'}`}
            placeholder="Min 6 characters"
          />
          {errors.password && <p className="mt-1 text-sm text-red-600">{errors.password}</p>}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Street Address</label>
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
          <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
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
          <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
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
        <label className="block text-sm font-medium text-gray-700 mb-1">Pincode</label>
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

      {/* KYC Fields */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">PAN</label>
          <input type="text" name="kyc.pan" value={formData.kyc?.pan || ''} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="PAN number" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Aadhaar</label>
          <input type="text" name="kyc.aadhaar" value={formData.kyc?.aadhaar || ''} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="Aadhaar number" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">GST</label>
          <input type="text" name="kyc.gst" value={formData.kyc?.gst || ''} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="GST number" />
        </div>
      </div>

      {/* Bank Details */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Account Holder Name</label>
          <input type="text" name="bankDetails.accountHolderName" value={formData.bankDetails?.accountHolderName || ''} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="Account holder name" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Account Number</label>
          <input type="text" name="bankDetails.accountNumber" value={formData.bankDetails?.accountNumber || ''} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="Account number" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Bank Name</label>
          <input type="text" name="bankDetails.bankName" value={formData.bankDetails?.bankName || ''} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="Bank name" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Branch</label>
          <input type="text" name="bankDetails.branch" value={formData.bankDetails?.branch || ''} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="Branch" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">IFSC</label>
          <input type="text" name="bankDetails.ifsc" value={formData.bankDetails?.ifsc || ''} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="IFSC code" />
        </div>
      </div>

      {/* Document upload */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Upload KYC / Bank Document (PDF / Image)</label>
        <input type="file" accept="application/pdf,image/*" onChange={handleFileChange} />
        {formData.pendingFile && !relationshipManager && <p className="text-sm text-gray-500 mt-1">File selected. It will be uploaded after creating the relationship manager.</p>}
        {formData.documents && formData.documents.length > 0 && (
          <ul className="mt-2">
            {formData.documents.map((d) => (
              <li key={d._id || d.id} className="text-sm text-gray-700">
                <a href={d.url || '#'} target="_blank" rel="noreferrer" className="text-primary-700 underline">{d.originalFileName || d.fileName}</a>
              </li>
            ))}
          </ul>
        )}
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
          <label className="block text-sm font-medium text-gray-700 mb-1">Regional Manager</label>
          <select
            name="regionalManager"
            value={formData.regionalManager}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="">None</option>
            {filteredRegionalManagers.map((rm) => (
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
          {relationshipManager ? 'Update Relationship Manager' : 'Create Relationship Manager'}
        </button>
      </div>
    </form>
  )
}

export default RelationshipManagerForm
