import { useState, useMemo, useEffect } from 'react'
import { Plus, Search, Filter, Eye, Edit, Trash2, ArrowUpDown, ArrowUp, ArrowDown, FileText, Calendar, CheckCircle } from 'lucide-react'
import IndianRupeeIcon from '../components/IndianRupeeIcon'
import api from '../services/api'
import StatusBadge from '../components/StatusBadge'
import Modal from '../components/Modal'
import InvoiceForm from '../components/InvoiceForm'
import StatCard from '../components/StatCard'
import ConfirmModal from '../components/ConfirmModal'
import { toast } from '../services/toastService'

const Invoices = () => {
  const [invoices, setInvoices] = useState([])
  const [leads, setLeads] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)
  const [selectedInvoice, setSelectedInvoice] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState({ isOpen: false, invoice: null })
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' })

  useEffect(() => {
    fetchInvoices()
    fetchLeads()
  }, [])

  const fetchInvoices = async () => {
    try {
      setLoading(true)
      const response = await api.invoices.getAll()
      const invoicesData = response.data || response || []
      setInvoices(Array.isArray(invoicesData) ? invoicesData : [])
    } catch (error) {
      console.error('Error fetching invoices:', error)
      setInvoices([])
    } finally {
      setLoading(false)
    }
  }

  const fetchLeads = async () => {
    try {
      const response = await api.leads.getAll()
      const leadsData = response.data || response || []
      setLeads(Array.isArray(leadsData) ? leadsData : [])
    } catch (error) {
      console.error('Error fetching leads:', error)
      setLeads([])
    }
  }

  // Calculate statistics
  const totalInvoices = invoices.length
  const paidInvoices = invoices.filter(i => i.status === 'paid').length
  const totalAmount = invoices.reduce((sum, inv) => {
    return sum + (inv.commissionAmount || inv.netPayable || inv.amount || 0)
  }, 0)
  const paidAmount = invoices
    .filter(i => i.status === 'paid')
    .reduce((sum, inv) => {
      return sum + (inv.commissionAmount || inv.netPayable || inv.amount || 0)
    }, 0)

  // Filter and search invoices
  const filteredInvoices = useMemo(() => {
    if (!invoices || invoices.length === 0) return []
    
    return invoices.filter((invoice) => {
      if (!invoice) return false
      
      const leadId = invoice.lead?._id || invoice.lead?.id || invoice.lead || invoice.leadId
      const lead = leads.find(l => {
        const lId = l.id || l._id
        return lId === leadId || lId?.toString() === leadId?.toString()
      })
      const searchLower = searchTerm.toLowerCase()
      const matchesSearch =
        (invoice.invoiceNumber && invoice.invoiceNumber.toLowerCase().includes(searchLower)) ||
        (lead && lead.loanAccountNo && lead.loanAccountNo.toLowerCase().includes(searchLower)) ||
        (invoice.agent?.name && invoice.agent.name.toLowerCase().includes(searchLower))
      const matchesStatus = statusFilter === 'all' || invoice.status === statusFilter
      return matchesSearch && matchesStatus
    })
  }, [invoices, searchTerm, statusFilter, leads])

  // Sort invoices
  const sortedInvoices = useMemo(() => {
    if (!sortConfig.key) return filteredInvoices

    return [...filteredInvoices].sort((a, b) => {
      if (!a || !b) return 0
      
      let aValue = a[sortConfig.key]
      let bValue = b[sortConfig.key]

      // Handle null/undefined values
      if (aValue == null) aValue = ''
      if (bValue == null) bValue = ''

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        aValue = aValue.toLowerCase()
        bValue = bValue.toLowerCase()
      }

      if (aValue < bValue) {
        return sortConfig.direction === 'asc' ? -1 : 1
      }
      if (aValue > bValue) {
        return sortConfig.direction === 'asc' ? 1 : -1
      }
      return 0
    })
  }, [filteredInvoices, sortConfig])

  const handleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }))
  }

  const getSortIcon = (key) => {
    if (sortConfig.key !== key) {
      return <ArrowUpDown className="w-4 h-4 text-gray-400" />
    }
    return sortConfig.direction === 'asc' ? (
      <ArrowUp className="w-4 h-4 text-primary-900" />
    ) : (
      <ArrowDown className="w-4 h-4 text-primary-900" />
    )
  }

  const handleCreate = () => {
    setSelectedInvoice(null)
    setIsCreateModalOpen(true)
  }

  const handleEdit = (invoice) => {
    setSelectedInvoice(invoice)
    setIsEditModalOpen(true)
  }

  const handleView = (invoice) => {
    setSelectedInvoice(invoice)
    setIsDetailModalOpen(true)
  }

  const handleSave = async (formData) => {
    try {
      // Validate required fields
      if (!formData.lead) {
        toast.error('Error', 'Lead is required')
        return
      }
      if (!formData.agent) {
        toast.error('Error', 'Agent is required')
        return
      }
      if (!formData.franchise) {
        toast.error('Error', 'Franchise is required')
        return
      }
      if (!formData.invoiceNumber) {
        toast.error('Error', 'Invoice number is required')
        return
      }
      if (!formData.commissionAmount || formData.commissionAmount <= 0) {
        toast.error('Error', 'Commission amount must be greater than 0')
        return
      }
      if (formData.netPayable === undefined || formData.netPayable === null) {
        toast.error('Error', 'Net payable amount is required')
        return
      }
      // Validate status enum
      const validStatuses = ['draft', 'pending', 'approved', 'rejected', 'escalated', 'paid']
      if (!validStatuses.includes(formData.status)) {
        toast.error('Error', `Invalid status. Must be one of: ${validStatuses.join(', ')}`)
        return
      }

      console.log('🔍 DEBUG: Creating/updating invoice with data:', JSON.stringify(formData, null, 2))

      if (selectedInvoice) {
        const invoiceId = selectedInvoice.id || selectedInvoice._id
        if (!invoiceId) {
          toast.error('Error', 'Invoice ID is missing')
          return
        }
        await api.invoices.update(invoiceId, formData)
        await fetchInvoices()
        await fetchLeads() // Refresh leads to update statistics
        setIsEditModalOpen(false)
        toast.success('Success', 'Invoice updated successfully')
      } else {
        await api.invoices.create(formData)
        await fetchInvoices()
        await fetchLeads() // Refresh leads to update statistics
        setIsCreateModalOpen(false)
        toast.success('Success', 'Invoice created successfully')
      }
      setSelectedInvoice(null)
    } catch (error) {
      console.error('Error saving invoice:', error)
      // Only show toast if API error handler hasn't already shown it
      if (!error._toastShown) {
        toast.error('Error', error.message || 'Failed to save invoice')
      }
    }
  }

  const handleDeleteClick = (invoice) => {
    setConfirmDelete({ isOpen: true, invoice })
  }

  const handleDeleteConfirm = async () => {
    const invoice = confirmDelete.invoice
    const invoiceId = invoice.id || invoice._id
    if (!invoiceId) {
      toast.error('Error', 'Invoice ID is missing')
      return
    }

    try {
      await api.invoices.delete(invoiceId)
      await fetchInvoices()
      toast.success('Success', `Invoice "${invoice.invoiceNumber || 'this invoice'}" deleted successfully`)
      setConfirmDelete({ isOpen: false, invoice: null })
    } catch (error) {
      console.error('Error deleting invoice:', error)
      toast.error('Error', error.message || 'Failed to delete invoice')
    }
  }

  const getLeadName = (leadId) => {
    if (!leadId) return 'N/A'
    const lead = leads.find(l => {
      const lId = l.id || l._id
      const compareId = leadId?._id || leadId?.id || leadId
      return lId === compareId || lId?.toString() === compareId?.toString()
    })
    return lead ? (lead.loanAccountNo || 'N/A') : 'N/A'
  }

  const isOverdue = (dueDate) => {
    return new Date(dueDate) < new Date() && statusFilter !== 'paid'
  }

  const statusOptions = [
    { value: 'all', label: 'All Status' },
    { value: 'paid', label: 'Paid' },
    { value: 'pending', label: 'Pending' },
    { value: 'overdue', label: 'Overdue' },
  ]

  return (
    <div className="space-y-6 w-full max-w-full overflow-x-hidden">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Invoices Management</h1>
          <p className="text-sm text-gray-600 mt-1">View and manage all invoices</p>
        </div>
        <button
          onClick={handleCreate}
          className="flex items-center gap-2 px-4 py-2 bg-primary-900 text-white rounded-lg hover:bg-primary-800 transition-colors"
        >
          <Plus className="w-5 h-5" />
          <span>Create Invoice</span>
        </button>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total Invoices"
          value={totalInvoices}
          change="+3 this month"
          changeType="positive"
          icon={FileText}
          color="blue"
        />
        <StatCard
          title="Paid Invoices"
          value={paidInvoices}
          change={`${((paidInvoices / totalInvoices) * 100).toFixed(0)}% paid`}
          changeType="positive"
          icon={CheckCircle}
          color="green"
        />
        <StatCard
          title="Total Amount"
          value={`₹${(totalAmount / 1000).toFixed(1)}K`}
          change="All invoices"
          changeType="positive"
          icon={IndianRupeeIcon}
          color="orange"
        />
        <StatCard
          title="Paid Amount"
          value={`₹${(paidAmount / 1000).toFixed(1)}K`}
          change={totalAmount > 0 ? `${((paidAmount / totalAmount) * 100).toFixed(0)}% collected` : '0% collected'}
          changeType="positive"
          icon={IndianRupeeIcon}
          color="purple"
        />
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by invoice number or lead name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-gray-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('invoiceNumber')}
                >
                  <div className="flex items-center gap-2">
                    Invoice #
                    {getSortIcon('invoiceNumber')}
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Lead
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('amount')}
                >
                  <div className="flex items-center gap-2">
                    Amount
                    {getSortIcon('amount')}
                  </div>
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('status')}
                >
                  <div className="flex items-center gap-2">
                    Status
                    {getSortIcon('status')}
                  </div>
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('dueDate')}
                >
                  <div className="flex items-center gap-2">
                    Due Date
                    {getSortIcon('dueDate')}
                  </div>
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('createdAt')}
                >
                  <div className="flex items-center gap-2">
                    Created
                    {getSortIcon('createdAt')}
                  </div>
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan="7" className="px-6 py-8 text-center text-gray-500">
                    Loading...
                  </td>
                </tr>
              ) : sortedInvoices.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-6 py-8 text-center text-gray-500">
                    No invoices found
                  </td>
                </tr>
              ) : (
                sortedInvoices.map((invoice) => (
                  <tr key={invoice.id || invoice._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{invoice.invoiceNumber || 'N/A'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {invoice.lead?.loanAccountNo || getLeadName(invoice.lead?._id || invoice.lead?.id || invoice.lead || invoice.leadId) || 'N/A'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        ₹{(invoice.commissionAmount || invoice.netPayable || invoice.amount || 0).toLocaleString()}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <StatusBadge status={invoice.status} />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        <div className="text-sm text-gray-900">{invoice.dueDate}</div>
                        {isOverdue(invoice.dueDate) && invoice.status !== 'paid' && (
                          <span className="text-xs text-red-600 font-medium">Overdue</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{invoice.createdAt}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleView(invoice)}
                          className="text-primary-900 hover:text-primary-800 p-1"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleEdit(invoice)}
                          className="text-gray-600 hover:text-gray-900 p-1"
                          title="Edit"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteClick(invoice)}
                          className="text-red-600 hover:text-red-900 p-1"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {sortedInvoices.length > 0 && (
          <div className="px-6 py-3 bg-gray-50 border-t border-gray-200">
            <p className="text-sm text-gray-600">
              Showing <span className="font-medium">{sortedInvoices.length}</span> of{' '}
              <span className="font-medium">{sortedInvoices.length}</span> invoices
            </p>
          </div>
        )}
      </div>

      {/* Create Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Create New Invoice"
      >
        <InvoiceForm onSave={handleSave} onClose={() => setIsCreateModalOpen(false)} />
      </Modal>

      {/* Edit Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false)
          setSelectedInvoice(null)
        }}
        title="Edit Invoice"
      >
        <InvoiceForm invoice={selectedInvoice} onSave={handleSave} onClose={() => setIsEditModalOpen(false)} />
      </Modal>

      {/* Detail Modal */}
      <Modal
        isOpen={isDetailModalOpen}
        onClose={() => {
          setIsDetailModalOpen(false)
          setSelectedInvoice(null)
        }}
        title="Invoice Details"
        size="md"
      >
        {selectedInvoice && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-500">Invoice Number</label>
                <p className="mt-1 text-sm font-mono text-gray-900">{selectedInvoice.invoiceNumber}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Status</label>
                <div className="mt-1">
                  <StatusBadge status={selectedInvoice.status} />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Lead Name</label>
                <p className="mt-1 text-sm text-gray-900">{getLeadName(selectedInvoice.leadId || selectedInvoice.lead)}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Amount</label>
                <p className="mt-1 text-sm font-semibold text-gray-900">
                  ₹{(selectedInvoice.amount || 0).toLocaleString()}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Due Date</label>
                <p className="mt-1 text-sm text-gray-900">{selectedInvoice.dueDate}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Created Date</label>
                <p className="mt-1 text-sm text-gray-900">{selectedInvoice.createdAt}</p>
              </div>
            </div>

            <div className="pt-4 border-t border-gray-200">
              <button
                onClick={() => {
                  setIsDetailModalOpen(false)
                  handleEdit(selectedInvoice)
                }}
                className="w-full px-4 py-2 bg-primary-900 text-white rounded-lg hover:bg-primary-800 transition-colors"
              >
                Edit Invoice
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={confirmDelete.isOpen}
        onClose={() => setConfirmDelete({ isOpen: false, invoice: null })}
        onConfirm={handleDeleteConfirm}
        title="Delete Invoice"
        message={`Are you sure you want to delete invoice "${confirmDelete.invoice?.invoiceNumber || 'this invoice'}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        type="danger"
      />
    </div>
  )
}

export default Invoices
