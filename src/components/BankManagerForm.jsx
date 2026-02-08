import { useState, useEffect } from 'react'
import { api } from '../services/api'

const BankManagerForm = ({ bankManager, onSave, onClose }) => {
  const isCreate = !bankManager
  const [banks, setBanks] = useState([])
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    mobile: '',
    role: 'bm',
    bank: '',
    status: 'active',
  })
  const [errors, setErrors] = useState({})

  useEffect(() => {
    api.banks.getAll().then((res) => {
      const data = res.data || res || []
      setBanks(Array.isArray(data) ? data : [])
    }).catch(() => setBanks([]))
  }, [])

  useEffect(() => {
    if (bankManager) {
      setFormData({
        name: bankManager.name || '',
        email: bankManager.email || '',
        mobile: bankManager.mobile || '',
        role: bankManager.role || 'bm',
        bank: bankManager.bank?._id || bankManager.bank || '',
        status: bankManager.status || 'active',
      })
    }
  }, [bankManager])

  const validate = () => {
    const newErrors = {}
    if (!formData.name?.trim()) newErrors.name = 'Name is required'
    if (!['sm', 'bm', 'asm'].includes(formData.role)) newErrors.role = 'Role must be SM, BM, or ASM'
    if (!formData.bank) newErrors.bank = 'Bank is required. Every bank manager must be associated with one bank.'
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (validate()) {
      const payload = {
        name: formData.name.trim(),
        email: formData.email?.trim() || undefined,
        mobile: formData.mobile?.trim() || undefined,
        role: formData.role,
        bank: formData.bank,
        status: formData.status,
      }
      onSave(payload)
    }
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }))
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
          placeholder="Bank manager name"
        />
        {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Role <span className="text-red-500">*</span></label>
        <select
          name="role"
          value={formData.role}
          onChange={handleChange}
          className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 ${errors.role ? 'border-red-500' : 'border-gray-300'}`}
        >
          <option value="sm">SM</option>
          <option value="bm">BM</option>
          <option value="asm">ASM</option>
        </select>
        {errors.role && <p className="mt-1 text-sm text-red-600">{errors.role}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Bank <span className="text-red-500">*</span></label>
        <select
          name="bank"
          value={formData.bank}
          onChange={handleChange}
          className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 ${errors.bank ? 'border-red-500' : 'border-gray-300'}`}
        >
          <option value="">Select bank</option>
          {banks.filter(b => b.status !== 'inactive').map((b) => (
            <option key={b._id || b.id} value={b._id || b.id}>{b.name} {b.type ? `(${b.type})` : ''}</option>
          ))}
        </select>
        {errors.bank && <p className="mt-1 text-sm text-red-600">{errors.bank}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
        <input
          type="email"
          name="email"
          value={formData.email}
          onChange={handleChange}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          placeholder="Email"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Mobile</label>
        <input
          type="text"
          name="mobile"
          value={formData.mobile}
          onChange={handleChange}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          placeholder="Mobile number"
        />
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

      <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
        <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
          Cancel
        </button>
        <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-primary-900 rounded-lg hover:bg-primary-800 transition-colors">
          {bankManager ? 'Update Bank Manager' : 'Create Bank Manager'}
        </button>
      </div>
    </form>
  )
}

export default BankManagerForm
