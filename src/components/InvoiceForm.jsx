import { useState, useEffect } from 'react'
import api from '../services/api'
import { toast } from '../services/toastService'

// Generate invoice number
const generateInvoiceNumber = () => {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const random = String(Math.floor(Math.random() * 100000)).padStart(5, '0')
  return `INV-${year}${month}${day}-${random}`
}

const InvoiceForm = ({ invoice, onSave, onClose }) => {
  const [formData, setFormData] = useState({
    leadId: '',
    commissionAmount: '',
    tdsPercentage: 2,
    status: 'pending',
  })

  const [errors, setErrors] = useState({})
  const [leads, setLeads] = useState([])
  const [selectedLead, setSelectedLead] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchLeads = async () => {
      try {
        setLoading(true)
        const response = await api.leads.getAll()
        console.log('🔍 DEBUG: InvoiceForm - Leads API response:', response)
        
        // Handle different response structures
        let leadsData = []
        if (Array.isArray(response)) {
          leadsData = response
        } else if (response && Array.isArray(response.data)) {
          leadsData = response.data
        } else if (response && response.data && Array.isArray(response.data)) {
          leadsData = response.data
        }
        
        console.log('🔍 DEBUG: InvoiceForm - Parsed leads data:', leadsData.length)
        
        // Filter leads that have agent and franchise (required for invoice)
        const validLeads = leadsData.filter(lead => {
          const agentId = lead.agent?._id || lead.agent?.id || lead.agent || lead.agentId
          const franchiseId = lead.franchise?._id || lead.franchise?.id || lead.franchise || lead.franchiseId
          const hasAgent = !!agentId
          const hasFranchise = !!franchiseId
          
          if (!hasAgent || !hasFranchise) {
            console.log('⚠️ InvoiceForm - Lead filtered out:', {
              leadId: lead.id || lead._id,
              hasAgent,
              hasFranchise,
              agent: lead.agent,
              franchise: lead.franchise
            })
          }
          
          return hasAgent && hasFranchise
        })
        
        console.log('🔍 DEBUG: InvoiceForm - Valid leads (with agent & franchise):', validLeads.length)
        setLeads(validLeads)
      } catch (error) {
        console.error('Error fetching leads:', error)
        setLeads([])
      } finally {
        setLoading(false)
      }
    }
    fetchLeads()
  }, [])

  useEffect(() => {
    if (invoice) {
      const leadId = invoice.leadId || (invoice.lead && (invoice.lead._id || invoice.lead.id)) || invoice.lead || ''
      setFormData({
        leadId,
        commissionAmount: invoice.commissionAmount || '',
        tdsPercentage: invoice.tdsPercentage || 2,
        status: invoice.status || 'pending',
      })
      // Set selected lead if available
      if (invoice.lead) {
        setSelectedLead(invoice.lead)
      }
    }
  }, [invoice])

  // Update selected lead when leadId changes
  useEffect(() => {
    if (formData.leadId) {
      const lead = leads.find(l => (l.id || l._id) === formData.leadId)
      setSelectedLead(lead)
      // Auto-populate commission amount from lead if available
      if (lead && (lead.actualCommission || lead.expectedCommission)) {
        setFormData(prev => ({
          ...prev,
          commissionAmount: lead.actualCommission || lead.expectedCommission || prev.commissionAmount
        }))
      }
    } else {
      setSelectedLead(null)
    }
  }, [formData.leadId, leads])

  // Calculate net payable when commission amount or TDS percentage changes
  useEffect(() => {
    if (formData.commissionAmount && formData.tdsPercentage) {
      const commissionAmount = parseFloat(formData.commissionAmount) || 0
      const tdsAmount = (commissionAmount * formData.tdsPercentage) / 100
      const netPayable = commissionAmount - tdsAmount
      // Store calculated values (will be sent in handleSubmit)
    }
  }, [formData.commissionAmount, formData.tdsPercentage])

  const validate = () => {
    const newErrors = {}
    if (!formData.leadId) {
      newErrors.leadId = 'Lead is required'
    }
    if (!formData.commissionAmount || formData.commissionAmount <= 0) {
      newErrors.commissionAmount = 'Commission amount must be greater than 0'
    }
    if (!selectedLead) {
      newErrors.leadId = 'Please select a valid lead'
    } else {
      // Validate that lead has agent and franchise
      const agentId = selectedLead.agent?._id || selectedLead.agent?.id || selectedLead.agent || selectedLead.agentId
      const franchiseId = selectedLead.franchise?._id || selectedLead.franchise?.id || selectedLead.franchise || selectedLead.franchiseId
      if (!agentId) {
        newErrors.leadId = 'Selected lead must have an agent assigned'
      }
      if (!franchiseId) {
        newErrors.leadId = 'Selected lead must have a franchise assigned'
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!validate() || !selectedLead) {
      return
    }

    const commissionAmount = parseFloat(formData.commissionAmount)
    const tdsAmount = (commissionAmount * formData.tdsPercentage) / 100
    const netPayable = commissionAmount - tdsAmount
    
    // Extract agent and franchise IDs - handle both populated objects and IDs
    const agentId = selectedLead.agent?._id || selectedLead.agent?.id || selectedLead.agent || selectedLead.agentId
    const franchiseId = selectedLead.franchise?._id || selectedLead.franchise?.id || selectedLead.franchise || selectedLead.franchiseId
    
    if (!agentId || !franchiseId) {
      toast.error('Error', 'Selected lead must have both agent and franchise assigned')
      return
    }
    
    const invoiceData = {
      invoiceNumber: invoice?.invoiceNumber || generateInvoiceNumber(),
      lead: formData.leadId,
      agent: agentId,
      franchise: franchiseId,
      commissionAmount,
      tdsAmount,
      tdsPercentage: formData.tdsPercentage,
      netPayable,
      status: formData.status,
    }
    
    console.log('🔍 DEBUG: Invoice data being sent:', JSON.stringify(invoiceData, null, 2))
    onSave(invoiceData)
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: name === 'commissionAmount' || name === 'tdsPercentage' 
        ? (value === '' ? '' : parseFloat(value) || value)
        : value,
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
          Lead <span className="text-red-500">*</span>
        </label>
        <select
          name="leadId"
          value={formData.leadId}
          onChange={handleChange}
          className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 ${
            errors.leadId ? 'border-red-500' : 'border-gray-300'
          }`}
        >
          <option value="">Select a lead</option>
          {loading ? (
            <option disabled>Loading leads...</option>
          ) : leads.length === 0 ? (
            <option disabled>No leads available (leads must have agent and franchise assigned)</option>
          ) : (
            leads.map((lead) => (
              <option key={lead.id || lead._id} value={lead.id || lead._id}>
                {lead.loanAccountNo || 'N/A'} - ₹{(lead.loanAmount || 0).toLocaleString()}
              </option>
            ))
          )}
        </select>
        {errors.leadId && <p className="mt-1 text-sm text-red-600">{errors.leadId}</p>}
        {!loading && leads.length === 0 && (
          <p className="mt-1 text-sm text-amber-600">
            ⚠️ No leads available. Please create leads and assign both agent and franchise to them.
          </p>
        )}
      </div>

      {selectedLead && (
        <div className="bg-gray-50 p-3 rounded-lg mb-4">
          <p className="text-sm text-gray-600">
            <strong>Agent:</strong> {selectedLead.agent?.name || 'N/A'} | 
            <strong> Franchise:</strong> {selectedLead.franchise?.name || 'N/A'}
          </p>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Commission Amount (₹) <span className="text-red-500">*</span>
        </label>
        <input
          type="number"
          name="commissionAmount"
          value={formData.commissionAmount}
          onChange={handleChange}
          className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 ${
            errors.commissionAmount ? 'border-red-500' : 'border-gray-300'
          }`}
          placeholder="Enter commission amount"
          min="0"
          step="1000"
        />
        {errors.commissionAmount && <p className="mt-1 text-sm text-red-600">{errors.commissionAmount}</p>}
        {selectedLead && (selectedLead.actualCommission || selectedLead.expectedCommission) && (
          <p className="mt-1 text-xs text-gray-500">
            Suggested: ₹{(selectedLead.actualCommission || selectedLead.expectedCommission).toLocaleString()}
          </p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          TDS Percentage (%) <span className="text-red-500">*</span>
        </label>
        <input
          type="number"
          name="tdsPercentage"
          value={formData.tdsPercentage}
          onChange={handleChange}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          min="0"
          max="100"
          step="0.1"
        />
        {formData.commissionAmount && formData.tdsPercentage && (
          <div className="mt-2 p-2 bg-blue-50 rounded text-sm">
            <p><strong>TDS Amount:</strong> ₹{((parseFloat(formData.commissionAmount) || 0) * formData.tdsPercentage / 100).toLocaleString()}</p>
            <p><strong>Net Payable:</strong> ₹{((parseFloat(formData.commissionAmount) || 0) * (1 - formData.tdsPercentage / 100)).toLocaleString()}</p>
          </div>
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
          <option value="draft">Draft</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="escalated">Escalated</option>
          <option value="paid">Paid</option>
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
          {invoice ? 'Update Invoice' : 'Create Invoice'}
        </button>
      </div>
    </form>
  )
}

export default InvoiceForm
