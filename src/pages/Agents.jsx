import { useState, useMemo, useEffect } from 'react'
import { Plus, Search, Filter, Eye, Edit, Trash2, ArrowUpDown, ArrowUp, ArrowDown, TrendingUp, Users } from 'lucide-react'
import IndianRupeeIcon from '../components/IndianRupeeIcon'
import api from '../services/api'
import StatusBadge from '../components/StatusBadge'
import Modal from '../components/Modal'
import AgentForm from '../components/AgentForm'
import StatCard from '../components/StatCard'
import ConfirmModal from '../components/ConfirmModal'
import { toast } from '../services/toastService'

const Agents = () => {
  const [agents, setAgents] = useState([])
  const [franchises, setFranchises] = useState([])
  const [leads, setLeads] = useState([])
  const [invoices, setInvoices] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)
  const [selectedAgent, setSelectedAgent] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState({ isOpen: false, agent: null })
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' })

  useEffect(() => {
    fetchAgents()
    fetchFranchises()
    fetchLeads()
    fetchInvoices()
  }, [])

  const fetchAgents = async () => {
    try {
      setLoading(true)
      const response = await api.agents.getAll()
      const agentsData = response.data || response || []
      setAgents(Array.isArray(agentsData) ? agentsData : [])
    } catch (error) {
      console.error('Error fetching agents:', error)
      setAgents([])
    } finally {
      setLoading(false)
    }
  }

  const fetchFranchises = async () => {
    try {
      const response = await api.franchises.getAll()
      const franchisesData = response.data || response || []
      setFranchises(Array.isArray(franchisesData) ? franchisesData : [])
    } catch (error) {
      console.error('Error fetching franchises:', error)
      setFranchises([])
    }
  }

  const fetchLeads = async () => {
    try {
      const response = await api.leads.getAll()
      let leadsData = []
      if (Array.isArray(response)) {
        leadsData = response
      } else if (response && Array.isArray(response.data)) {
        leadsData = response.data
      }
      console.log('🔍 DEBUG: Fetched leads:', leadsData.length)
      console.log('🔍 DEBUG: Sample lead with agent:', leadsData[0] ? {
        leadId: leadsData[0].id || leadsData[0]._id,
        agent: leadsData[0].agent,
        agentId: leadsData[0].agentId
      } : 'No leads')
      setLeads(leadsData)
    } catch (error) {
      console.error('Error fetching leads:', error)
      setLeads([])
    }
  }

  const fetchInvoices = async () => {
    try {
      const response = await api.invoices.getAll()
      let invoicesData = []
      if (Array.isArray(response)) {
        invoicesData = response
      } else if (response && Array.isArray(response.data)) {
        invoicesData = response.data
      }
      setInvoices(invoicesData)
    } catch (error) {
      console.error('Error fetching invoices:', error)
      setInvoices([])
    }
  }

  // Calculate lead statistics for each agent
  const getAgentLeadStats = (agentId) => {
    if (!agentId) {
      console.log('⚠️ getAgentLeadStats: No agentId provided')
      return { total: 0, active: 0, completed: 0, commission: 0 }
    }

    console.log('🔍 DEBUG: getAgentLeadStats called for agentId:', agentId)
    console.log('🔍 DEBUG: Total leads available:', leads?.length || 0)
    console.log('🔍 DEBUG: Total invoices available:', invoices?.length || 0)

    // Calculate leads statistics
    const agentLeads = leads && leads.length > 0 ? leads.filter(lead => {
      const leadAgentId = lead.agent?._id || lead.agent?.id || lead.agent || lead.agentId
      const matches = leadAgentId === agentId || leadAgentId?.toString() === agentId?.toString()

      // Debug first few leads
      if (leads.indexOf(lead) < 3) {
        console.log('🔍 DEBUG: Lead agent check:', {
          leadId: lead.id || lead._id,
          leadAgentId,
          agentId,
          matches,
          leadAgentType: typeof leadAgentId,
          agentIdType: typeof agentId
        })
      }

      return matches
    }) : []

    console.log('🔍 DEBUG: Agent leads found:', agentLeads.length)

    const total = agentLeads.length
    const active = agentLeads.filter(lead =>
      lead.status === 'logged'
    ).length
    const completed = agentLeads.filter(lead => lead.status === 'completed').length

    // Calculate commission from invoices (more accurate)
    const agentInvoices = invoices && invoices.length > 0 ? invoices.filter(invoice => {
      const invoiceAgentId = invoice.agent?._id || invoice.agent?.id || invoice.agent || invoice.agentId
      return invoiceAgentId === agentId || invoiceAgentId?.toString() === agentId?.toString()
    }) : []

    console.log('🔍 DEBUG: Agent invoices found:', agentInvoices.length)

    const commission = agentInvoices.reduce((sum, invoice) => {
      return sum + (invoice.commissionAmount || invoice.netPayable || invoice.amount || 0)
    }, 0)

    console.log('🔍 DEBUG: Final stats:', { total, active, completed, commission })

    return { total, active, completed, commission }
  }

  // Calculate statistics
  const totalAgents = agents.length
  const activeAgents = agents.filter(a => a.status === 'active').length
  const totalCommission = agents.reduce((sum, agent) => {
    const stats = getAgentLeadStats(agent.id || agent._id)
    return sum + stats.commission
  }, 0)
  const totalLeads = leads.length

  // Filter and search agents
  const filteredAgents = useMemo(() => {
    if (!agents || agents.length === 0) return []

    return agents.filter((agent) => {
      if (!agent) return false

      const searchLower = searchTerm.toLowerCase()
      const matchesSearch =
        (agent.name && agent.name.toLowerCase().includes(searchLower)) ||
        (agent.email && agent.email.toLowerCase().includes(searchLower)) ||
        (agent.phone && agent.phone.toString().includes(searchTerm))
      const matchesStatus = statusFilter === 'all' || agent.status === statusFilter
      return matchesSearch && matchesStatus
    })
  }, [agents, searchTerm, statusFilter])

  // Sort agents
  const sortedAgents = useMemo(() => {
    if (!sortConfig.key) return filteredAgents

    return [...filteredAgents].sort((a, b) => {
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
  }, [filteredAgents, sortConfig])

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
    setSelectedAgent(null)
    setIsCreateModalOpen(true)
  }

  const handleEdit = (agent) => {
    setSelectedAgent(agent)
    setIsEditModalOpen(true)
  }

  const handleView = (agent) => {
    setSelectedAgent(agent)
    setIsDetailModalOpen(true)
  }

  const handleSave = async (formData) => {
    try {
      if (selectedAgent) {
        // Update existing agent
        const agentId = selectedAgent.id || selectedAgent._id
        if (!agentId) {
          toast.error('Error', 'Agent ID is missing')
          return
        }
        // Map frontend fields to backend fields
        const franchiseId = selectedAgent.franchise?._id || selectedAgent.franchise?.id || selectedAgent.franchise
        const updateData = {
          name: formData.name,
          email: formData.email,
          mobile: formData.phone || formData.mobile,
          ...(franchiseId && { franchise: franchiseId }),
          status: formData.status,
        }
        await api.agents.update(agentId, updateData)
        await fetchAgents()
        await fetchLeads() // Refresh leads to update statistics
        await fetchInvoices() // Refresh invoices to update commission
        setIsEditModalOpen(false)
        toast.success('Success', 'Agent updated successfully')
      } else {
        const { phone, ...rest } = formData

        if (!phone || !phone.trim()) {
          toast.error('Error', 'Phone number is required')
          return
        }

        const agentData = {
          name: rest.name,
          email: rest.email,
          mobile: phone.trim(),
          password: rest.password || 'Agent@123',
          role: 'agent',
          status: rest.status || 'active',
        }

        console.log('🔍 DEBUG: Creating agent with data:', JSON.stringify(agentData, null, 2))

        await api.agents.create(agentData)
        await fetchAgents()
        await fetchLeads() // Refresh leads to update statistics
        await fetchInvoices() // Refresh invoices to update commission
        setIsCreateModalOpen(false)
        toast.success('Success', 'Agent created successfully')
      }
      setSelectedAgent(null)
    } catch (error) {
      console.error('Error saving agent:', error)
      toast.error('Error', error.message || 'Failed to save agent')
    }
  }

  const handleDeleteClick = (agent) => {
    setConfirmDelete({ isOpen: true, agent })
  }

  const handleDeleteConfirm = async () => {
    const agent = confirmDelete.agent
    const agentId = agent.id || agent._id
    if (!agentId) {
      toast.error('Error', 'Agent ID is missing')
      return
    }

    try {
      await api.agents.delete(agentId)
      await fetchAgents()
      toast.success('Success', `Agent "${agent.name || 'this agent'}" deleted successfully`)
      setConfirmDelete({ isOpen: false, agent: null })
    } catch (error) {
      console.error('Error deleting agent:', error)
      toast.error('Error', error.message || 'Failed to delete agent')
    }
  }

  const getFranchiseName = (franchiseId) => {
    if (!franchiseId) return 'N/A'
    const franchise = franchises.find((f) => (f.id || f._id) === franchiseId || (f.id || f._id)?.toString() === franchiseId?.toString())
    return franchise ? (franchise.name || 'N/A') : 'N/A'
  }

  const getAgentLeads = (agentId) => {
    if (!agentId || !leads || leads.length === 0) return []
    return leads.filter(lead => {
      const leadAgentId = lead.agent?._id || lead.agent?.id || lead.agent || lead.agentId
      return leadAgentId === agentId || leadAgentId?.toString() === agentId?.toString()
    })
  }

  const statusOptions = [
    { value: 'all', label: 'All Status' },
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive' },
  ]

  return (
    <div className="space-y-6 w-full max-w-full overflow-x-hidden">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Agents Management</h1>
          <p className="text-sm text-gray-600 mt-1">Manage agent profiles and performance</p>
        </div>
        <button
          onClick={handleCreate}
          className="flex items-center gap-2 px-4 py-2 bg-primary-900 text-white rounded-lg hover:bg-primary-800 transition-colors"
        >
          <Plus className="w-5 h-5" />
          <span>Create Agent</span>
        </button>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total Agents"
          value={totalAgents}
          change="+2 this month"
          changeType="positive"
          icon={Users}
          color="blue"
        />
        <StatCard
          title="Active Agents"
          value={activeAgents}
          change={`${((activeAgents / totalAgents) * 100).toFixed(0)}% active`}
          changeType="positive"
          icon={TrendingUp}
          color="green"
        />
        <StatCard
          title="Total Leads"
          value={totalLeads}
          change="+15.2%"
          changeType="positive"
          icon={Users}
          color="orange"
        />
        <StatCard
          title="Total Commission"
          value={`₹${(totalCommission / 1000).toFixed(1)}K`}
          change="+8.5%"
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
              placeholder="Search by name, email, or phone..."
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
                  onClick={() => handleSort('name')}
                >
                  <div className="flex items-center gap-2">
                    Name
                    {getSortIcon('name')}
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Contact
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Franchise
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('totalLeads')}
                >
                  <div className="flex items-center gap-2">
                    Total Leads
                    {getSortIcon('totalLeads')}
                  </div>
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('activeLeads')}
                >
                  <div className="flex items-center gap-2">
                    Active Leads
                    {getSortIcon('activeLeads')}
                  </div>
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('completedLoans')}
                >
                  <div className="flex items-center gap-2">
                    Completed
                    {getSortIcon('completedLoans')}
                  </div>
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('commission')}
                >
                  <div className="flex items-center gap-2">
                    Commission
                    {getSortIcon('commission')}
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
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan="9" className="px-6 py-8 text-center text-gray-500">
                    Loading...
                  </td>
                </tr>
              ) : sortedAgents.length === 0 ? (
                <tr>
                  <td colSpan="9" className="px-6 py-8 text-center text-gray-500">
                    No agents found
                  </td>
                </tr>
              ) : (
                sortedAgents.map((agent, index) => {
                  const agentId = agent.id || agent._id
                  const leadStats = getAgentLeadStats(agentId)
                  const franchiseId = agent.franchise?._id || agent.franchise?.id || agent.franchise || agent.franchiseId

                  return (
                    <tr key={agentId || `agent-${index}`} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{agent.name || 'N/A'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{agent.email || 'N/A'}</div>
                        <div className="text-sm text-gray-500">{agent.mobile || agent.phone || 'N/A'}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900">
                          {agent.franchise?.name || getFranchiseName(franchiseId) || 'N/A'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{leadStats.total}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-primary-900">{leadStats.active}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-green-600">{leadStats.completed}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          ₹{leadStats.commission.toLocaleString()}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <StatusBadge status={agent.status} />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleView(agent)}
                            className="text-primary-900 hover:text-primary-800 p-1"
                            title="View Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleEdit(agent)}
                            className="text-gray-600 hover:text-gray-900 p-1"
                            title="Edit"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteClick(agent)}
                            className="text-red-600 hover:text-red-900 p-1"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
        {sortedAgents.length > 0 && (
          <div className="px-6 py-3 bg-gray-50 border-t border-gray-200">
            <p className="text-sm text-gray-600">
              Showing <span className="font-medium">{sortedAgents.length}</span> of{' '}
              <span className="font-medium">{sortedAgents.length}</span> agents
            </p>
          </div>
        )}
      </div>

      {/* Create Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Create New Agent"
      >
        <AgentForm onSave={handleSave} onClose={() => setIsCreateModalOpen(false)} />
      </Modal>

      {/* Edit Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false)
          setSelectedAgent(null)
        }}
        title="Edit Agent"
      >
        <AgentForm agent={selectedAgent} onSave={handleSave} onClose={() => setIsEditModalOpen(false)} />
      </Modal>

      {/* Detail Modal */}
      <Modal
        isOpen={isDetailModalOpen}
        onClose={() => {
          setIsDetailModalOpen(false)
          setSelectedAgent(null)
        }}
        title="Agent Details"
        size="md"
      >
        {selectedAgent && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-500">Full Name</label>
                <p className="mt-1 text-sm text-gray-900">{selectedAgent.name}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Email</label>
                <p className="mt-1 text-sm text-gray-900">{selectedAgent.email}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Phone</label>
                <p className="mt-1 text-sm text-gray-900">{selectedAgent.phone || selectedAgent.mobile || 'N/A'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Franchise</label>
                <p className="mt-1 text-sm text-gray-900">
                  {selectedAgent.franchise?.name || getFranchiseName(selectedAgent.franchiseId || selectedAgent.franchise?._id || selectedAgent.franchise?.id || selectedAgent.franchise) || 'N/A'}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Status</label>
                <div className="mt-1">
                  <StatusBadge status={selectedAgent.status} />
                </div>
              </div>
            </div>

            {/* Performance Metrics */}
            <div className="pt-4 border-t border-gray-200">
              <h4 className="text-sm font-semibold text-gray-900 mb-3">Performance Metrics</h4>
              {(() => {
                const agentId = selectedAgent.id || selectedAgent._id
                console.log('🔍 DEBUG: Calculating stats for agent:', {
                  agentId,
                  agentName: selectedAgent.name,
                  leadsCount: leads?.length || 0,
                  invoicesCount: invoices?.length || 0
                })
                const stats = getAgentLeadStats(agentId)
                console.log('🔍 DEBUG: Calculated stats:', stats)
                return (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-gray-500">Total Leads</p>
                      <p className="text-lg font-bold text-gray-900">{stats.total}</p>
                      <p className="text-xs text-gray-400 mt-1">From {leads?.length || 0} total leads</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-gray-500">Active Leads</p>
                      <p className="text-lg font-bold text-primary-900">{stats.active}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-gray-500">Completed Loans</p>
                      <p className="text-lg font-bold text-green-600">{stats.completed}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-gray-500">Total Commission</p>
                      <p className="text-lg font-bold text-gray-900">₹{stats.commission.toLocaleString()}</p>
                      <p className="text-xs text-gray-400 mt-1">From {invoices?.length || 0} total invoices</p>
                    </div>
                  </div>
                )
              })()}
            </div>

            <div className="pt-4 border-t border-gray-200">
              <button
                onClick={() => {
                  setIsDetailModalOpen(false)
                  handleEdit(selectedAgent)
                }}
                className="w-full px-4 py-2 bg-primary-900 text-white rounded-lg hover:bg-primary-800 transition-colors"
              >
                Edit Agent
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={confirmDelete.isOpen}
        onClose={() => setConfirmDelete({ isOpen: false, agent: null })}
        onConfirm={handleDeleteConfirm}
        title="Delete Agent"
        message={`Are you sure you want to delete agent "${confirmDelete.agent?.name || 'this agent'}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        type="danger"
      />
    </div>
  )
}

export default Agents
