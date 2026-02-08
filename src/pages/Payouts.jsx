import { useState, useMemo, useEffect } from 'react'
import { Plus, Search, Filter, Eye, Edit, Trash2, ArrowUpDown, ArrowUp, ArrowDown, CreditCard, Calendar, CheckCircle, ChevronDown, ChevronUp, FileDown } from 'lucide-react'
import IndianRupeeIcon from '../components/IndianRupeeIcon'
import api from '../services/api'
import { authService } from '../services/auth.service'
import StatusBadge from '../components/StatusBadge'
import Modal from '../components/Modal'
import PayoutForm from '../components/PayoutForm'
import StatCard from '../components/StatCard'
import ConfirmModal from '../components/ConfirmModal'
import { toast } from '../services/toastService'
import { exportToExcel } from '../utils/exportExcel'

const Payouts = () => {
  const userRole = authService.getUser()?.role || 'super_admin'
  const isAgent = userRole === 'agent'

  const [payouts, setPayouts] = useState([])
  const [agents, setAgents] = useState([])
  const [franchises, setFranchises] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [franchiseFilter, setFranchiseFilter] = useState('')
  const [agentFilter, setAgentFilter] = useState('')
  const [filtersOpen, setFiltersOpen] = useState(true)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)
  const [selectedPayout, setSelectedPayout] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState({ isOpen: false, payout: null })
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' })

  useEffect(() => {
    fetchPayouts()
    if (!isAgent) {
      fetchAgents()
      fetchFranchises()
    }
  }, [isAgent])

  const fetchFranchises = async () => {
    try {
      const res = await api.franchises.getAll()
      const data = res?.data || res || []
      setFranchises(Array.isArray(data) ? data : [])
    } catch (_) { setFranchises([]) }
  }

  const fetchPayouts = async () => {
    try {
      setLoading(true)
      const response = await api.payouts.getAll()
      const payoutsData = response.data || response || []
      setPayouts(Array.isArray(payoutsData) ? payoutsData : [])
    } catch (error) {
      console.error('Error fetching payouts:', error)
      setPayouts([])
    } finally {
      setLoading(false)
    }
  }

  const fetchAgents = async () => {
    try {
      const response = await api.agents.getAll()
      const agentsData = response.data || response || []
      setAgents(Array.isArray(agentsData) ? agentsData : [])
    } catch (error) {
      console.error('Error fetching agents:', error)
      setAgents([])
    }
  }

  // Calculate statistics
  const totalPayouts = payouts.length
  const completedPayouts = payouts.filter(p => p.status === 'paid' || p.status === 'completed').length
  const totalAmount = payouts.reduce((sum, p) => {
    return sum + (p.netPayable || p.totalAmount || p.amount || 0)
  }, 0)
  const paidAmount = payouts
    .filter(p => p.status === 'paid' || p.status === 'completed')
    .reduce((sum, p) => {
      return sum + (p.netPayable || p.totalAmount || p.amount || 0)
    }, 0)

  // Filter and search payouts
  const filteredPayouts = useMemo(() => {
    if (!payouts || payouts.length === 0) return []

    return payouts.filter((payout) => {
      if (!payout) return false
      if (franchiseFilter) {
        const fid = payout.franchise?._id || payout.franchise?.id || payout.franchise
        if (!fid || (fid !== franchiseFilter && fid.toString() !== franchiseFilter)) return false
      }
      if (agentFilter) {
        const aid = payout.agent?._id || payout.agent?.id || payout.agent
        if (!aid || (aid !== agentFilter && aid.toString() !== agentFilter)) return false
      }
      const searchLower = searchTerm.toLowerCase()
      const agentName = payout.agent?.name || (agents.length > 0 ? agents.find(a => (a.id === payout.agentId) || (a._id === payout.agentId))?.name : '')
      const matchesSearch =
        (payout.payoutNumber && payout.payoutNumber.toLowerCase().includes(searchLower)) ||
        (agentName && agentName.toLowerCase().includes(searchLower))
      const matchesStatus = statusFilter === 'all' || payout.status === statusFilter
      return matchesSearch && matchesStatus
    })
  }, [payouts, searchTerm, statusFilter, franchiseFilter, agentFilter, agents])

  const hasActiveFilters = searchTerm !== '' || statusFilter !== 'all' || franchiseFilter !== '' || agentFilter !== ''
  const clearPayoutFilters = () => { setSearchTerm(''); setStatusFilter('all'); setFranchiseFilter(''); setAgentFilter('') }

  // Sort payouts
  const sortedPayouts = useMemo(() => {
    if (!sortConfig.key) return filteredPayouts

    return [...filteredPayouts].sort((a, b) => {
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
  }, [filteredPayouts, sortConfig])

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
    setSelectedPayout(null)
    setIsCreateModalOpen(true)
  }

  const handleEdit = (payout) => {
    setSelectedPayout(payout)
    setIsEditModalOpen(true)
  }

  const handleView = (payout) => {
    setSelectedPayout(payout)
    setIsDetailModalOpen(true)
  }

  const handleSave = async (formData) => {
    try {
      console.log('🔍 DEBUG: Payout form data received:', formData)

      if (selectedPayout) {
        const payoutId = selectedPayout.id || selectedPayout._id
        if (!payoutId) {
          toast.error('Error', 'Payout ID is missing')
          return
        }

        // Ensure all required fields are present for update
        const updateData = {
          ...formData,
          agent: formData.agent || formData.agentId,
          totalAmount: formData.totalAmount || formData.amount,
          netPayable: formData.netPayable || formData.amount,
        }

        console.log('🔍 DEBUG: Updating payout with data:', updateData)
        await api.payouts.update(payoutId, updateData)
        await fetchPayouts()
        await fetchAgents() // Refresh agents to update statistics
        setIsEditModalOpen(false)
        toast.success('Success', 'Payout updated successfully')
      } else {
        // Validate required fields
        if (!formData.agent) {
          toast.error('Error', 'Agent is required')
          return
        }
        if (!formData.franchise) {
          toast.error('Error', 'Franchise is required')
          return
        }
        if (!formData.totalAmount || formData.totalAmount <= 0) {
          toast.error('Error', 'Total amount must be greater than 0')
          return
        }
        if (!formData.netPayable || formData.netPayable <= 0) {
          toast.error('Error', 'Net payable must be greater than 0')
          return
        }
        if (!formData.payoutNumber) {
          toast.error('Error', 'Payout number is required')
          return
        }

        console.log('🔍 DEBUG: Creating payout with data:', formData)
        await api.payouts.create(formData)
        await fetchPayouts()
        await fetchAgents() // Refresh agents to update statistics
        setIsCreateModalOpen(false)
        toast.success('Success', 'Payout created successfully')
      }
      setSelectedPayout(null)
    } catch (error) {
      console.error('Error saving payout:', error)
      // Only show toast if API error handler hasn't already shown it
      if (!error._toastShown) {
        toast.error('Error', error.message || 'Failed to save payout')
      }
    }
  }

  const handleDeleteClick = (payout) => {
    setConfirmDelete({ isOpen: true, payout })
  }

  const handleDeleteConfirm = async () => {
    const payout = confirmDelete.payout
    const payoutId = payout.id || payout._id
    if (!payoutId) {
      toast.error('Error', 'Payout ID is missing')
      return
    }

    try {
      await api.payouts.delete(payoutId)
      await fetchPayouts()
      toast.success('Success', `Payout "${payout.payoutNumber || 'this payout'}" deleted successfully`)
      setConfirmDelete({ isOpen: false, payout: null })
    } catch (error) {
      console.error('Error deleting payout:', error)
      toast.error('Error', error.message || 'Failed to delete payout')
    }
  }

  const getAgentName = (agentId) => {
    if (!agentId) return 'N/A'
    // For agents, use populated agent data from payout if available
    if (isAgent && payouts.length > 0) {
      const payout = payouts.find(p => {
        const pAgentId = p.agent?._id || p.agent?.id || p.agentId || p.agent
        const compareId = agentId?._id || agentId?.id || agentId
        return pAgentId?.toString() === compareId?.toString()
      })
      if (payout?.agent?.name) return payout.agent.name
    }
    const agent = agents.find(a => {
      const aId = a.id || a._id
      const compareId = agentId?._id || agentId?.id || agentId
      return aId?.toString() === compareId?.toString()
    })
    return agent ? agent.name : 'N/A'
  }

  const getAssociatedForPayout = (p) => {
    if (!p) return 'N/A'
    if (p.agent && typeof p.agent === 'object') {
      if (p.agent.managedByModel === 'RelationshipManager') return p.agent.managedBy?.name || 'N/A'
      if (p.agent.managedByModel === 'Franchise') return p.agent.managedBy?.name || p.franchise?.name || 'N/A'
    }
    const agentId = p.agent?._id || p.agent?.id || p.agent
    if (agentId) {
      const agentObj = agents.find(a => (a._id || a.id) === agentId || (a._id || a.id)?.toString() === agentId?.toString())
      if (agentObj) {
        if (agentObj.managedByModel === 'RelationshipManager') return agentObj.managedBy?.name || 'N/A'
        if (agentObj.managedByModel === 'Franchise') return agentObj.managedBy?.name || p.franchise?.name || 'N/A'
      }
    }
    return p.franchise?.name || 'N/A'
  }

  const statusOptions = [
    { value: 'all', label: 'All Status' },
    { value: 'completed', label: 'Completed' },
    { value: 'pending', label: 'Pending' },
    { value: 'cancelled', label: 'Cancelled' },
  ]

  return (
    <div className="space-y-6 w-full max-w-full overflow-x-hidden">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Payouts Management</h1>
          <p className="text-sm text-gray-600 mt-1">Manage agent payouts and commissions</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              const rows = sortedPayouts.map((p) => ({
                'Payout Number': p.payoutNumber || 'N/A',
                Agent: p.agent?.name || getAgentName(p.agentId || p.agent) || 'N/A',
                Associated: getAssociatedForPayout(p),
                'Total Amount': p.totalAmount ?? '',
                'TDS Amount': p.tdsAmount ?? '',
                'Net Payable': p.netPayable ?? '',
                Status: p.status || 'N/A',
                'Account Number': p.bankDetails?.accountNumber || 'N/A',
                IFSC: p.bankDetails?.ifsc || 'N/A',
                'Bank Name': p.bankDetails?.bankName || 'N/A',
              }))
              exportToExcel(rows, `payouts_export_${Date.now()}`, 'Payouts')
              toast.success('Export', `Exported ${rows.length} payouts to Excel`)
            }}
            disabled={sortedPayouts.length === 0}
            title="Export currently filtered data to Excel"
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FileDown className="w-5 h-5" />
            <span>Export to Excel</span>
          </button>
          <button
            onClick={handleCreate}
            className="flex items-center gap-2 px-4 py-2 bg-primary-900 text-white rounded-lg hover:bg-primary-800 transition-colors"
          >
            <Plus className="w-5 h-5" />
            <span>Create Payout</span>
          </button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total Payouts"
          value={totalPayouts}
          change="+5 this month"
          changeType="positive"
          icon={CreditCard}
          color="blue"
        />
        <StatCard
          title="Completed"
          value={completedPayouts}
          change={totalPayouts > 0 ? `${((completedPayouts / totalPayouts) * 100).toFixed(0)}% paid` : '0% paid'}
          changeType="positive"
          icon={CheckCircle}
          color="green"
        />
        <StatCard
          title="Total Amount"
          value={`₹${(totalAmount / 1000).toFixed(1)}K`}
          change="All payouts"
          changeType="positive"
          icon={IndianRupeeIcon}
          color="orange"
        />
        <StatCard
          title="Paid Amount"
          value={`₹${(paidAmount / 1000).toFixed(1)}K`}
          change={totalAmount > 0 ? `${((paidAmount / totalAmount) * 100).toFixed(0)}% distributed` : '0% distributed'}
          changeType="positive"
          icon={IndianRupeeIcon}
          color="purple"
        />
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <button type="button" onClick={() => setFiltersOpen((o) => !o)} className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition-colors">
          <span className="flex items-center gap-2 font-medium text-gray-900">
            <Filter className="w-5 h-5 text-gray-500" />
            Filter options
            {hasActiveFilters && <span className="text-xs bg-primary-100 text-primary-800 px-2 py-0.5 rounded-full">Active</span>}
          </span>
          {filtersOpen ? <ChevronUp className="w-5 h-5 text-gray-500" /> : <ChevronDown className="w-5 h-5 text-gray-500" />}
        </button>
        {filtersOpen && (
          <div className="border-t border-gray-200 p-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="sm:col-span-2 lg:col-span-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input type="text" placeholder="Payout #, agent name..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm bg-white">
                  {statusOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              {!isAgent && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Associated</label>
                    <select value={franchiseFilter} onChange={(e) => setFranchiseFilter(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm bg-white">
                      <option value="">All franchises</option>
                      {franchises.map((f) => <option key={f._id || f.id} value={f._id || f.id}>{f.name || 'Unnamed'}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Agent</label>
                    <select value={agentFilter} onChange={(e) => setAgentFilter(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm bg-white">
                      <option value="">All agents</option>
                      {agents.map((a) => <option key={a._id || a.id} value={a._id || a.id}>{a.name || a.email || 'Unnamed'}</option>)}
                    </select>
                  </div>
                </>
              )}
            </div>
            {hasActiveFilters && (
              <div className="flex items-center gap-2 pt-1">
                <button type="button" onClick={clearPayoutFilters} className="text-sm text-primary-600 hover:text-primary-800 font-medium">Clear all filters</button>
                <span className="text-sm text-gray-500">Showing {filteredPayouts.length} of {payouts.length} payouts</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('payoutNumber')}
                >
                  <div className="flex items-center gap-2">
                    Payout #
                    {getSortIcon('payoutNumber')}
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Agent
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
                  onClick={() => handleSort('paymentDate')}
                >
                  <div className="flex items-center gap-2">
                    Payment Date
                    {getSortIcon('paymentDate')}
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
              ) : sortedPayouts.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-6 py-8 text-center text-gray-500">
                    No payouts found
                  </td>
                </tr>
              ) : (
                sortedPayouts.map((payout) => (
                  <tr key={payout.id || payout._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{payout.payoutNumber || 'N/A'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {payout.agent?.name || getAgentName(payout.agentId || payout.agent) || 'N/A'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        ₹{(payout.netPayable || payout.totalAmount || payout.amount || 0).toLocaleString()}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <StatusBadge status={payout.status || 'pending'} />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        <div className="text-sm text-gray-900">{payout.paymentDate}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{payout.createdAt}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleView(payout)}
                          className="text-primary-900 hover:text-primary-800 p-1"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleEdit(payout)}
                          className="text-gray-600 hover:text-gray-900 p-1"
                          title="Edit"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteClick(payout)}
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
        {sortedPayouts.length > 0 && (
          <div className="px-6 py-3 bg-gray-50 border-t border-gray-200">
            <p className="text-sm text-gray-600">
              Showing <span className="font-medium">{sortedPayouts.length}</span> of{' '}
              <span className="font-medium">{sortedPayouts.length}</span> payouts
            </p>
          </div>
        )}
      </div>

      {/* Create Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Create New Payout"
      >
        <PayoutForm onSave={handleSave} onClose={() => setIsCreateModalOpen(false)} />
      </Modal>

      {/* Edit Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false)
          setSelectedPayout(null)
        }}
        title="Edit Payout"
      >
        <PayoutForm payout={selectedPayout} onSave={handleSave} onClose={() => setIsEditModalOpen(false)} />
      </Modal>

      {/* Detail Modal */}
      <Modal
        isOpen={isDetailModalOpen}
        onClose={() => {
          setIsDetailModalOpen(false)
          setSelectedPayout(null)
        }}
        title="Payout Details"
        size="md"
      >
        {selectedPayout && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-500">Payout Number</label>
                <p className="mt-1 text-sm font-mono text-gray-900">{selectedPayout.payoutNumber}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Status</label>
                <div className="mt-1">
                  <StatusBadge status={selectedPayout.status} />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Agent Name</label>
                <p className="mt-1 text-sm text-gray-900">{getAgentName(selectedPayout.agentId || selectedPayout.agent)}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Amount</label>
                <p className="mt-1 text-sm font-semibold text-gray-900">
                  ₹{(selectedPayout.amount || 0).toLocaleString()}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Payment Date</label>
                <p className="mt-1 text-sm text-gray-900">{selectedPayout.paymentDate}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Created Date</label>
                <p className="mt-1 text-sm text-gray-900">{selectedPayout.createdAt}</p>
              </div>
            </div>

            <div className="pt-4 border-t border-gray-200">
              <button
                onClick={() => {
                  setIsDetailModalOpen(false)
                  handleEdit(selectedPayout)
                }}
                className="w-full px-4 py-2 bg-primary-900 text-white rounded-lg hover:bg-primary-800 transition-colors"
              >
                Edit Payout
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={confirmDelete.isOpen}
        onClose={() => setConfirmDelete({ isOpen: false, payout: null })}
        onConfirm={handleDeleteConfirm}
        title="Delete Payout"
        message={`Are you sure you want to delete payout "${confirmDelete.payout?.payoutNumber || 'this payout'}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        type="danger"
      />
    </div>
  )
}

export default Payouts
