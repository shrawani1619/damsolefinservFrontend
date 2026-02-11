import { useState, useEffect } from 'react'
import api from '../services/api'

const RegionalManagerForm = ({ onSave, onClose }) => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    mobile: '',
    password: '',
    status: 'active',
  })
  const [errors, setErrors] = useState({})

  useEffect(() => {
    setFormData((prev) => ({
      ...prev,
      kyc: prev.kyc || { pan: '', aadhaar: '', gst: '' },
      bankDetails: prev.bankDetails || { accountHolderName: '', accountNumber: '', bankName: '', branch: '', ifsc: '' },
      documents: prev.documents || [],
      pendingFile: prev.pendingFile || null,
    }))
  }, [])

  const validate = () => {
    const newErrors = {}
    if (!formData.name.trim()) newErrors.name = 'Name is required'
    if (!formData.email.trim()) newErrors.email = 'Email is required'
    else if (!/\S+@\S+\.\S+/.test(formData.email)) newErrors.email = 'Invalid email'
    if (!formData.mobile.trim()) newErrors.mobile = 'Mobile is required'
    if (!formData.password || formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters'
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (validate()) {
      onSave({ ...formData, role: 'regional_manager' })
    }
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }))
  }

  const handleNestedChange = (e) => {
    const { name, value } = e.target
    if (name.includes('.')) {
      const [parent, child] = name.split('.')
      setFormData((prev) => ({ ...prev, [parent]: { ...(prev[parent] || {}), [child]: value } }))
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }))
    }
  }

  const handleFileChange = async (e) => {
    const file = e.target.files && e.target.files[0]
    if (!file) return
    // No existing RM id when creating here; keep pendingFile
    setFormData((prev) => ({ ...prev, pendingFile: file }))
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Name <span className="text-red-500">*</span></label>
        <input
          type="text"
          name="name"
          value={formData.name}
          onChange={handleChange}
          className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 ${errors.name ? 'border-red-500' : 'border-gray-300'}`}
          placeholder="Full name"
        />
        {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name}</p>}
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Email <span className="text-red-500">*</span></label>
        <input
          type="email"
          name="email"
          value={formData.email}
          onChange={handleChange}
          className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 ${errors.email ? 'border-red-500' : 'border-gray-300'}`}
          placeholder="email@example.com"
        />
        {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email}</p>}
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Mobile <span className="text-red-500">*</span></label>
        <input
          type="tel"
          name="mobile"
          value={formData.mobile}
          onChange={handleChange}
          className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 ${errors.mobile ? 'border-red-500' : 'border-gray-300'}`}
          placeholder="10-digit mobile number"
        />
        {errors.mobile && <p className="mt-1 text-sm text-red-600">{errors.mobile}</p>}
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Password <span className="text-red-500">*</span></label>
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
      {/* KYC Fields */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">PAN</label>
          <input type="text" name="kyc.pan" value={formData.kyc?.pan || ''} onChange={handleNestedChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="PAN number" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Aadhaar</label>
          <input type="text" name="kyc.aadhaar" value={formData.kyc?.aadhaar || ''} onChange={handleNestedChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="Aadhaar number" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">GST</label>
          <input type="text" name="kyc.gst" value={formData.kyc?.gst || ''} onChange={handleNestedChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="GST number" />
        </div>
      </div>

      {/* Bank Details */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Account Holder Name</label>
          <input type="text" name="bankDetails.accountHolderName" value={formData.bankDetails?.accountHolderName || ''} onChange={handleNestedChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="Account holder name" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Account Number</label>
          <input type="text" name="bankDetails.accountNumber" value={formData.bankDetails?.accountNumber || ''} onChange={handleNestedChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="Account number" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Bank Name</label>
          <input type="text" name="bankDetails.bankName" value={formData.bankDetails?.bankName || ''} onChange={handleNestedChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="Bank name" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Branch</label>
          <input type="text" name="bankDetails.branch" value={formData.bankDetails?.branch || ''} onChange={handleNestedChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="Branch" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">IFSC</label>
          <input type="text" name="bankDetails.ifsc" value={formData.bankDetails?.ifsc || ''} onChange={handleNestedChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="IFSC code" />
        </div>
      </div>

      {/* Document upload */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Upload KYC / Bank Document (PDF / Image)</label>
        <input type="file" accept="application/pdf,image/*" onChange={handleFileChange} />
        {formData.pendingFile && <p className="text-sm text-gray-500 mt-1">File selected. It will be uploaded after creating the regional manager.</p>}
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
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
      <div className="flex gap-3 pt-4">
        <button type="submit" className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium">
          Create Regional Manager
        </button>
        <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium">
          Cancel
        </button>
      </div>
    </form>
  )
}

export default RegionalManagerForm
