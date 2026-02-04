import { useState, useEffect, useMemo } from 'react'
import api from '../services/api'
import { authService } from '../services/auth.service'

const LeadForm = ({ lead, onSave, onClose }) => {
  const currentUser = useMemo(() => authService.getUser(), [])
  const userRole = currentUser?.role || 'super_admin'
  const isAgent = userRole === 'agent'

  const extractId = (value) => {
    if (!value) return ''
    if (typeof value === 'string') return value
    if (typeof value === 'object') {
      return value._id?.toString() || value.id?.toString() || ''
    }
    return ''
  }

  const agentId = useMemo(() => extractId(currentUser?._id || currentUser?.id), [currentUser])
  const franchiseId = useMemo(() => extractId(currentUser?.franchise), [currentUser])

  const [formData, setFormData] = useState({
    applicantEmail: '',
    applicantMobile: '',
    loanType: '',
    loanAmount: '',
    status: 'logged',
    agentId: agentId,
    franchiseId: franchiseId,
    bankId: '',
    customerName: '',
    sanctionedAmount: '',
    sanctionedDate: '',
    disbursedAmount: '',
    disbursementDate: '',
    disbursementType: '',
    loanAccountNo: '',
    smBmId: '',
    smBmEmail: '',
    smBmMobile: '',
    asmName: '',
    asmEmail: '',
    asmMobile: '',
    dsaCode: '',
    branch: '',
    remarks: '',
  })

  const [errors, setErrors] = useState({})
  const [banks, setBanks] = useState([])
  const [staff, setStaff] = useState([])
  const [loading, setLoading] = useState(true)
  const [smBmSearch, setSmBmSearch] = useState('')
  const [showSmBmSuggestions, setShowSmBmSuggestions] = useState(false)

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        const fetchPromises = [
          api.banks.getAll(),
          api.staff.getAll(),
        ]
        
        const [banksResponse, staffResponse] = await Promise.all(fetchPromises)
        
        // Handle banks
        const banksData = banksResponse?.data || (Array.isArray(banksResponse) ? banksResponse : [])
        setBanks(Array.isArray(banksData) ? banksData : [])
        
        // Handle staff
        const staffData = staffResponse?.data || (Array.isArray(staffResponse) ? staffResponse : [])
        setStaff(Array.isArray(staffData) ? staffData : [])
      } catch (error) {
        console.error('Error fetching data:', error)
        setBanks([])
        setStaff([])
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  useEffect(() => {
    if (lead) {
      const smBmId = extractId(lead.smBmId || lead.smBm)
      const selectedStaff = staff.find((s) => (s.id || s._id) === smBmId)
      setFormData({
        applicantEmail: lead.applicantEmail || lead.email || '',
        applicantMobile: lead.applicantMobile || lead.phone || '',
        loanType: lead.loanType || '',
        loanAmount: lead.loanAmount || '',
        status: lead.status || 'logged',
        agentId: agentId,
        franchiseId: franchiseId,
        bankId: extractId(lead.bankId || lead.bank),
        customerName: lead.customerName || '',
        sanctionedAmount: lead.sanctionedAmount || '',
        sanctionedDate: lead.sanctionedDate ? new Date(lead.sanctionedDate).toISOString().split('T')[0] : '',
        disbursedAmount: lead.disbursedAmount || '',
        disbursementDate: lead.disbursementDate ? new Date(lead.disbursementDate).toISOString().split('T')[0] : '',
        disbursementType: lead.disbursementType || '',
        loanAccountNo: lead.loanAccountNo || '',
        smBmId: smBmId,
        smBmEmail: lead.smBmEmail || lead.smBm?.email || '',
        smBmMobile: lead.smBmMobile || lead.smBm?.mobile || '',
        asmName: lead.asmName || '',
        asmEmail: lead.asmEmail || '',
        asmMobile: lead.asmMobile || '',
        dsaCode: lead.dsaCode || lead.codeUse || '',
        branch: lead.branch || '',
        remarks: lead.remarks || '',
      })
      setSmBmSearch(selectedStaff?.name || '')
    } else {
      setFormData((prev) => ({
        ...prev,
        agentId: agentId,
        franchiseId: franchiseId,
      }))
    }
  }, [lead, agentId, franchiseId, staff])

  const validate = () => {
    const newErrors = {}
    if (formData.applicantEmail && !/\S+@\S+\.\S+/.test(formData.applicantEmail)) newErrors.applicantEmail = 'Email is invalid'
    if (!formData.loanType) newErrors.loanType = 'Loan type is required'
    if (!formData.loanAmount || formData.loanAmount <= 0) newErrors.loanAmount = 'Loan amount must be greater than 0'
    if (!formData.bankId) newErrors.bankId = 'Bank is required'

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (validate()) {
      let finalFormData = { ...formData }
      
      // Check if SM/BM details are provided but no matching staff was selected
      const smBmName = smBmSearch?.trim()
      const hasSmBmName = smBmName && smBmName.length > 0
      const hasSmBmEmail = formData.smBmEmail?.trim()
      const hasSmBmMobile = formData.smBmMobile?.trim()
      
      // Create SM/BM if name is provided and (email or mobile is provided) but no staff ID is selected
      if (hasSmBmName && (hasSmBmEmail || hasSmBmMobile) && !formData.smBmId) {
        try {
          // Create new staff member
          const newStaffData = {
            name: smBmName,
            email: hasSmBmEmail || `${smBmName.toLowerCase().replace(/\s+/g, '.')}@ykc.com`,
            mobile: hasSmBmMobile || '',
            password: 'Default@123', // Default password
            role: 'staff',
            status: 'active',
          }
          
          const response = await api.staff.create(newStaffData)
          const newStaffId = response?.data?._id || response?.data?.id || response?._id || response?.id
          
          if (newStaffId) {
            finalFormData.smBmId = newStaffId
            // Refresh staff list to include the newly created staff member
            try {
              const staffResponse = await api.staff.getAll()
              const staffData = staffResponse?.data || (Array.isArray(staffResponse) ? staffResponse : [])
              setStaff(Array.isArray(staffData) ? staffData : [])
            } catch (refreshError) {
              console.error('Error refreshing staff list:', refreshError)
            }
          }
        } catch (error) {
          console.error('Error creating SM/BM:', error)
          // Continue with submission even if staff creation fails
        }
      }
      
      onSave(finalFormData)
    }
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    const numericFields = ['loanAmount', 'sanctionedAmount', 'disbursedAmount']
    setFormData((prev) => ({
      ...prev,
      [name]: numericFields.includes(name) ? (value === '' ? '' : parseFloat(value) || '') : value,
    }))
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }))
    }
    
  }

  const filteredStaff = staff.filter((staffMember) =>
    (staffMember.name || '').toLowerCase().includes(smBmSearch.toLowerCase())
  )

  const handleSmBmSearchChange = (e) => {
    const value = e.target.value
    setSmBmSearch(value)
    setShowSmBmSuggestions(true)
    if (!value) {
      setFormData((prev) => ({
        ...prev,
        smBmId: '',
        smBmEmail: '',
        smBmMobile: '',
      }))
    }
  }

  const handleSmBmSelect = (staffMember) => {
    setSmBmSearch(staffMember.name || '')
    setShowSmBmSuggestions(false)
    setFormData((prev) => ({
      ...prev,
      smBmId: staffMember.id || staffMember._id,
      smBmEmail: staffMember.email || '',
      smBmMobile: staffMember.mobile || '',
    }))
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Customer Name
        </label>
        <input
          type="text"
          name="customerName"
          value={formData.customerName}
          onChange={handleChange}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          placeholder="Enter customer name"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Mobile Number
        </label>
        <input
          type="tel"
          name="applicantMobile"
          value={formData.applicantMobile}
          onChange={handleChange}
          className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 ${
            errors.applicantMobile ? 'border-red-500' : 'border-gray-300'
          }`}
          placeholder="Enter mobile number (optional)"
        />
        {errors.applicantMobile && <p className="mt-1 text-sm text-red-600">{errors.applicantMobile}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Email
        </label>
        <input
          type="email"
          name="applicantEmail"
          value={formData.applicantEmail}
          onChange={handleChange}
          className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 ${
            errors.applicantEmail ? 'border-red-500' : 'border-gray-300'
          }`}
          placeholder="Enter email address (optional)"
        />
        {errors.applicantEmail && <p className="mt-1 text-sm text-red-600">{errors.applicantEmail}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Loan Type <span className="text-red-500">*</span>
        </label>
        <select
          name="loanType"
          value={formData.loanType}
          onChange={handleChange}
          className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 ${
            errors.loanType ? 'border-red-500' : 'border-gray-300'
          }`}
        >
          <option value="">Select loan type</option>
          <option value="personal_loan">Personal Loan</option>
          <option value="home_loan">Home Loan</option>
          <option value="business_loan">Business Loan</option>
          <option value="loan_against_property">Loan Against Property</option>
          <option value="education_loan">Education Loan</option>
          <option value="car_loan">Car Loan</option>
          <option value="gold_loan">Gold Loan</option>
        </select>
        {errors.loanType && <p className="mt-1 text-sm text-red-600">{errors.loanType}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Loan Account No
        </label>
        <input
          type="text"
          name="loanAccountNo"
          value={formData.loanAccountNo}
          onChange={handleChange}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          placeholder="Enter loan account number"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Loan Amount (₹) <span className="text-red-500">*</span>
        </label>
        <input
          type="number"
          name="loanAmount"
          value={formData.loanAmount}
          onChange={handleChange}
          className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 ${
            errors.loanAmount ? 'border-red-500' : 'border-gray-300'
          }`}
          placeholder="Enter loan amount"
          min="0"
        />
        {errors.loanAmount && <p className="mt-1 text-sm text-red-600">{errors.loanAmount}</p>}
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
          <option value="logged">Login</option>
          <option value="sanctioned">Sanction</option>
          <option value="partial_disbursed">Partially Disburse</option>
          <option value="disbursed">Disburse</option>
          <option value="rejected">Reject</option>
        </select>
      </div>


      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Bank <span className="text-red-500">*</span>
        </label>
        <select
          name="bankId"
          value={formData.bankId}
          onChange={handleChange}
          className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 ${
            errors.bankId ? 'border-red-500' : 'border-gray-300'
          }`}
        >
          <option value="">Select a bank</option>
          {loading ? (
            <option disabled>Loading banks...</option>
          ) : (
            banks.map((bank) => (
              <option key={bank.id || bank._id} value={bank.id || bank._id}>
                {bank.name || 'N/A'}
              </option>
            ))
          )}
        </select>
        {errors.bankId && <p className="mt-1 text-sm text-red-600">{errors.bankId}</p>}
      </div>

      <div className="pt-4 border-t border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Sanction & Disbursement Details</h3>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Sanctioned Amount (₹)
        </label>
        <input
          type="number"
          name="sanctionedAmount"
          value={formData.sanctionedAmount}
          onChange={handleChange}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          placeholder="Enter sanctioned amount"
          min="0"
          step="1000"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Sanctioned Date
        </label>
        <input
          type="date"
          name="sanctionedDate"
          value={formData.sanctionedDate}
          onChange={handleChange}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Disbursed Amount (₹)
        </label>
        <input
          type="number"
          name="disbursedAmount"
          value={formData.disbursedAmount}
          onChange={handleChange}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          placeholder="Enter disbursed amount"
          min="0"
          step="1000"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Disbursement Date
        </label>
        <input
          type="date"
          name="disbursementDate"
          value={formData.disbursementDate}
          onChange={handleChange}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Disbursement Type
        </label>
        <select
          name="disbursementType"
          value={formData.disbursementType}
          onChange={handleChange}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="">Select disbursement type</option>
          <option value="full">Full</option>
          <option value="partial">Partial</option>
        </select>
      </div>

      <div className="pt-4 border-t border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Manager Details</h3>
      </div>

      <div className="relative">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          SM/BM Name
        </label>
        <input
          type="text"
          value={smBmSearch}
          onChange={handleSmBmSearchChange}
          onFocus={() => setShowSmBmSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSmBmSuggestions(false), 200)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          placeholder="Search SM/BM name..."
        />
        {showSmBmSuggestions && smBmSearch && filteredStaff.length > 0 && (
          <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-auto">
            {filteredStaff.map((staffMember) => (
              <div
                key={staffMember.id || staffMember._id}
                onClick={() => handleSmBmSelect(staffMember)}
                className="px-3 py-2 hover:bg-gray-100 cursor-pointer border-b border-gray-100 last:border-b-0"
              >
                <div className="font-medium text-gray-900">{staffMember.name || 'N/A'}</div>
                {staffMember.email && (
                  <div className="text-sm text-gray-500">{staffMember.email}</div>
                )}
              </div>
            ))}
          </div>
        )}
        {showSmBmSuggestions && smBmSearch && filteredStaff.length === 0 && (
          <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg">
            <div className="px-3 py-2 text-gray-500">No staff found</div>
          </div>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          SM/BM Email
        </label>
        <input
          type="email"
          name="smBmEmail"
          value={formData.smBmEmail}
          onChange={handleChange}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          placeholder="Enter SM/BM email"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          SM/BM Mobile
        </label>
        <input
          type="tel"
          name="smBmMobile"
          value={formData.smBmMobile}
          onChange={handleChange}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          placeholder="Enter SM/BM mobile number"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          ASM Name
        </label>
        <input
          type="text"
          name="asmName"
          value={formData.asmName}
          onChange={handleChange}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          placeholder="Enter ASM name"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          ASM Email
        </label>
        <input
          type="email"
          name="asmEmail"
          value={formData.asmEmail}
          onChange={handleChange}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          placeholder="Enter ASM email"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          ASM Mobile
        </label>
        <input
          type="tel"
          name="asmMobile"
          value={formData.asmMobile}
          onChange={handleChange}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          placeholder="Enter ASM mobile number"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          DSA Code
        </label>
        <input
          type="text"
          name="dsaCode"
          value={formData.dsaCode}
          onChange={handleChange}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          placeholder="Enter DSA code"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Branch/Loan Center
        </label>
        <input
          type="text"
          name="branch"
          value={formData.branch}
          onChange={handleChange}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          placeholder="branch, city"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Remarks
        </label>
        <textarea
          name="remarks"
          value={formData.remarks}
          onChange={handleChange}
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          placeholder="Enter remarks"
        />
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
          {lead ? 'Update Lead' : 'Create Lead'}
        </button>
      </div>
    </form>
  )
}

export default LeadForm
