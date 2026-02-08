import { useState, useMemo, useEffect } from 'react'
import { Plus, Search, Filter, Eye, Edit, Trash2, ArrowUpDown, ArrowUp, ArrowDown, Users, TrendingUp, ChevronDown, ChevronUp, FileDown, Store } from 'lucide-react'
import IndianRupeeIcon from '../components/IndianRupeeIcon'
import api from '../services/api'
import StatusBadge from '../components/StatusBadge'
import Modal from '../components/Modal'
import RelationshipManagerForm from '../components/RelationshipManagerForm'
import StatCard from '../components/StatCard'
import ConfirmModal from '../components/ConfirmModal'
import { toast } from '../services/toastService'
import { exportToExcel } from '../utils/exportExcel'

const RelationshipManagers = () => {
  const [relationshipManagers, setRelationshipManagers] = useState([])
  const [franchises, setFranchises] = useState([])
  const [leads, setLeads] = useState([])
  const [invoices, setInvoices] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [cityFilter, setCityFilter] = useState('')
  const [stateFilter, setStateFilter] = useState('')
  const [filtersOpen, setFiltersOpen] = useState(true)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)
  const [selectedRM, setSelectedRM] = useState(null)
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' })
  const [confirmDelete, setConfirmDelete] = useState({ isOpen: false, rm: null })

  useEffect(() => {
    fetchRelationshipManagers()
    fetchFranchises()
    fetchLeads()
    fetchInvoices()
  }, [])

  const fetchRelationshipManagers = async () => {
    try {
      setLoading(true)
      const response = await api.relationshipManagers.getAll({ limit: 500 })
      const data = response.data || response || []
      setRelationshipManagers(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Error fetching relationship managers:', error)
      setRelationshipManagers([])
    } finally {
      setLoading(false)
    }
  }

  const fetchFranchises = async () => {
    try {
      const response = await api.franchises.getAll()
      const data = response.data || response || []
      setFranchises(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Error fetching franchises:', error)
      setFranchises([])
    }
  }

  const fetchLeads = async () => {
    try {
      const response = await api.leads.getAll()
      let data = []
      if (Array.isArray(response)) data = response
      else if (response?.data) data = response.data
      setLeads(data)
    } catch (error) {
      console.error('Error fetching leads:', error)
      setLeads([])
    }
  }

  const fetchInvoices = async () => {
    try {
      const response = await api.invoices.getAll()
      let data = []
      if (Array.isArray(response)) data = response
      else if (response?.data) data = response.data
      setInvoices(data)
    } catch (error) {
      console.error('Error fetching invoices:', error)
      setInvoices([])
    }
  }

  const getRMStats = (ownerId) => {
    // Compute simple stats available on the frontend:
    // - agents: count of rm.agents if present on the RM document
    // - leads / revenue remain zero because RMs aren't linked in the current hierarchy
    if (!ownerId) return { agents: 0, leads: 0, revenue: 0 }
    const key = ownerId?._id || ownerId
    const rm = relationshipManagers.find(r => {
      const rOwner = r.owner?._id || r.owner
      const rId = r._id || r.id
      try {
        if (rOwner && key && rOwner.toString() === key.toString()) return true
      } catch (e) { }
      try {
        if (rId && key && rId.toString() === key.toString()) return true
      } catch (e) { }
      return false
    })
    const agentsCount = Array.isArray(rm?.agents) ? rm.agents.length : 0
    return { agents: agentsCount, leads: 0, revenue: 0 }
  }

  const totalRMs = relationshipManagers.length
  const activeRMs = relationshipManagers.filter(r => r.status === 'active').length
  const allRMStats = relationshipManagers.map(r => getRMStats(r.owner?._id || r.owner))
  const totalRevenue = allRMStats.reduce((sum, s) => sum + s.revenue, 0)
  const totalAgentsCount = allRMStats.reduce((sum, s) => sum + s.agents, 0)

  const cityOptions = useMemo(() => {
    const cities = [...new Set(relationshipManagers.map(r => r.address?.city).filter(Boolean))].sort()
    return [{ value: '', label: 'All Cities' }, ...cities.map(c => ({ value: c, label: c }))]
  }, [relationshipManagers])

  const stateOptions = useMemo(() => {
    const states = [...new Set(relationshipManagers.map(r => r.address?.state).filter(Boolean))].sort()
    return [{ value: '', label: 'All States' }, ...states.map(s => ({ value: s, label: s }))]
  }, [relationshipManagers])

  const filteredRMs = useMemo(() => {
    if (!relationshipManagers?.length) return []
    return relationshipManagers.filter((rm) => {
      if (!rm) return false
      const searchLower = searchTerm.toLowerCase()
      const matchesSearch =
        (rm.name && rm.name.toLowerCase().includes(searchLower)) ||
        (rm.address?.city && rm.address.city.toLowerCase().includes(searchLower)) ||
        (rm.address?.state && rm.address.state.toLowerCase().includes(searchLower)) ||
        (rm.ownerName && rm.ownerName.toLowerCase().includes(searchLower)) ||
        (rm.email && rm.email.toLowerCase().includes(searchLower))
      const matchesStatus = statusFilter === 'all' || rm.status === statusFilter
      const matchesCity = !cityFilter || (rm.address?.city || '') === cityFilter
      const matchesState = !stateFilter || (rm.address?.state || '') === stateFilter
      return matchesSearch && matchesStatus && matchesCity && matchesState
    })
  }, [relationshipManagers, searchTerm, statusFilter, cityFilter, stateFilter])

  const hasActiveFilters = searchTerm !== '' || statusFilter !== 'all' || cityFilter !== '' || stateFilter !== ''
  const clearFilters = () => { setSearchTerm(''); setStatusFilter('all'); setCityFilter(''); setStateFilter('') }

  const sortedRMs = useMemo(() => {
    if (!sortConfig.key) return filteredRMs
    return [...filteredRMs].sort((a, b) => {
      if (!a || !b) return 0
      let aVal = sortConfig.key === 'address.city' ? a.address?.city : a[sortConfig.key]
      let bVal = sortConfig.key === 'address.city' ? b.address?.city : b[sortConfig.key]
      if (sortConfig.key === 'franchises' || sortConfig.key === 'leads' || sortConfig.key === 'revenue') {
        const aOwner = a.owner?._id || a.owner
        const bOwner = b.owner?._id || b.owner
        const aStats = getRMStats(aOwner)
        const bStats = getRMStats(bOwner)
        aVal = sortConfig.key === 'franchises' ? aStats.franchises : sortConfig.key === 'leads' ? aStats.leads : aStats.revenue
        bVal = sortConfig.key === 'franchises' ? bStats.franchises : sortConfig.key === 'leads' ? bStats.leads : bStats.revenue
      }
      if (aVal == null) aVal = ''
      if (bVal == null) bVal = ''
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        aVal = aVal.toLowerCase()
        bVal = bVal.toLowerCase()
      }
      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1
      return 0
    })
  }, [filteredRMs, sortConfig])

  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }))
  }

  const getSortIcon = (key) => {
    if (sortConfig.key !== key) return <ArrowUpDown className="w-4 h-4 text-gray-400" />
    return sortConfig.direction === 'asc' ? <ArrowUp className="w-4 h-4 text-primary-900" /> : <ArrowDown className="w-4 h-4 text-primary-900" />
  }

  const handleCreate = () => {
    setSelectedRM(null)
    setIsCreateModalOpen(true)
  }

  const handleEdit = (rm) => {
    setSelectedRM(rm)
    setIsEditModalOpen(true)
  }

  const handleView = (rm) => {
    setSelectedRM(rm)
    setIsDetailModalOpen(true)
  }

  const handleSave = async (formData) => {
    try {
      if (selectedRM) {
        const id = selectedRM.id || selectedRM._id
        if (!id) {
          toast.error('Error', 'Relationship manager ID is missing')
          return
        }
        await api.relationshipManagers.update(id, formData)
        await fetchRelationshipManagers()
        await fetchFranchises()
        setIsEditModalOpen(false)
        setSelectedRM(null)
        toast.success('Success', 'Relationship manager updated successfully')
      } else {
        await api.relationshipManagers.create(formData)
        await fetchRelationshipManagers()
        await fetchFranchises()
        setIsCreateModalOpen(false)
        toast.success('Success', 'Relationship manager created successfully')
      }
    } catch (error) {
      console.error('Error saving relationship manager:', error)
      toast.error('Error', error.message || 'Failed to save relationship manager.')
    }
  }

  const handleDeleteClick = (rm) => setConfirmDelete({ isOpen: true, rm })

  const handleDeleteConfirm = async () => {
    const rm = confirmDelete.rm
    const id = rm?.id || rm?._id
    if (!id) {
      toast.error('Error', 'Relationship manager ID is missing')
      return
    }
    try {
      await api.relationshipManagers.delete(id)
      await fetchRelationshipManagers()
      toast.success('Success', `Relationship manager "${rm?.name || 'this item'}" deleted successfully`)
      setConfirmDelete({ isOpen: false, rm: null })
    } catch (error) {
      console.error('Error deleting relationship manager:', error)
      toast.error('Error', error.message || 'Failed to delete relationship manager')
    }
  }

  const statusOptions = [
    { value: 'all', label: 'All Status' },
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive' },
  ]

  return (
    <div className="space-y-6 w-full max-w-full overflow-x-hidden">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Relationship Managers</h1>
          <p className="text-sm text-gray-600 mt-1">Manage relationship managers</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              const rows = sortedRMs.map((r) => {
                const ownerId = r.owner?._id || r.owner
                const stats = getRMStats(ownerId)
                return {
                  Name: r.name || 'N/A',
                  'Owner Name': r.ownerName || 'N/A',
                  Email: r.email || 'N/A',
                  City: r.address?.city || 'N/A',
                  State: r.address?.state || 'N/A',
                  Agents: stats.agents,
                  Leads: stats.leads,
                  Revenue: stats.revenue,
                  Status: r.status || 'N/A',
                }
              })
              exportToExcel(rows, `relationship_managers_export_${Date.now()}`, 'Relationship Managers')
              toast.success('Export', `Exported ${rows.length} relationship managers to Excel`)
            }}
            disabled={sortedRMs.length === 0}
            title="Export to Excel"
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
            <span>Create Relationship Manager</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Total Relationship Managers" value={totalRMs} change="+1 this year" changeType="positive" icon={Users} color="blue" />
        <StatCard title="Active" value={activeRMs} change={`${totalRMs ? ((activeRMs / totalRMs) * 100).toFixed(0) : 0}% active`} changeType="positive" icon={TrendingUp} color="green" />
        <StatCard title="Total Revenue" value={`₹${(totalRevenue / 1000).toFixed(0)}K`} change="+18.5%" changeType="positive" icon={IndianRupeeIcon} color="purple" />
      </div>

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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="sm:col-span-2 lg:col-span-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input type="text" placeholder="Name, location, owner, email..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm bg-white">
                  {statusOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                <select value={cityFilter} onChange={(e) => setCityFilter(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm bg-white">
                  {cityOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                <select value={stateFilter} onChange={(e) => setStateFilter(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm bg-white">
                  {stateOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            </div>
            {hasActiveFilters && (
              <div className="flex items-center gap-2 pt-1">
                <button type="button" onClick={clearFilters} className="text-sm text-primary-600 hover:text-primary-800 font-medium">Clear all filters</button>
                <span className="text-sm text-gray-500">Showing {filteredRMs.length} of {relationshipManagers.length} relationship managers</span>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => handleSort('name')}>
                  <div className="flex items-center gap-2">Name {getSortIcon('name')}</div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => handleSort('address.city')}>
                  <div className="flex items-center gap-2">Location {getSortIcon('address.city')}</div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Owner</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => handleSort('agents')}>
                  <div className="flex items-center gap-2">Agents {getSortIcon('agents')}</div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => handleSort('leads')}>
                  <div className="flex items-center gap-2">Total Leads {getSortIcon('leads')}</div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => handleSort('revenue')}>
                  <div className="flex items-center gap-2">Revenue {getSortIcon('revenue')}</div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => handleSort('status')}>
                  <div className="flex items-center gap-2">Status {getSortIcon('status')}</div>
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr><td colSpan="8" className="px-6 py-8 text-center text-gray-500">Loading...</td></tr>
              ) : sortedRMs.length === 0 ? (
                <tr><td colSpan="8" className="px-6 py-8 text-center text-gray-500">No relationship managers found</td></tr>
              ) : (
                sortedRMs.map((rm) => {
                  const id = rm.id || rm._id
                  const ownerId = rm.owner?._id || rm.owner
                  const stats = getRMStats(ownerId)
                  return (
                    <tr key={id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap"><div className="text-sm font-medium text-gray-900">{rm.name || 'N/A'}</div></td>
                      <td className="px-6 py-4 whitespace-nowrap"><div className="text-sm text-gray-900">{rm.address?.city || rm.address?.state || 'N/A'}</div></td>
                      <td className="px-6 py-4 whitespace-nowrap"><div className="text-sm text-gray-900">{rm.ownerName || 'N/A'}</div></td>
                      <td className="px-6 py-4 whitespace-nowrap"><div className="text-sm font-medium text-gray-900">{stats.agents}</div></td>
                      <td className="px-6 py-4 whitespace-nowrap"><div className="text-sm font-medium text-primary-900">{stats.leads}</div></td>
                      <td className="px-6 py-4 whitespace-nowrap"><div className="text-sm font-medium text-gray-900">₹{stats.revenue.toLocaleString()}</div></td>
                      <td className="px-6 py-4 whitespace-nowrap"><StatusBadge status={rm.status} /></td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => handleView(rm)} className="text-primary-900 hover:text-primary-900 p-1" title="View Details"><Eye className="w-4 h-4" /></button>
                          <button onClick={() => handleEdit(rm)} className="text-gray-600 hover:text-gray-900 p-1" title="Edit"><Edit className="w-4 h-4" /></button>
                          <button onClick={() => handleDeleteClick(rm)} className="text-red-600 hover:text-red-900 p-1" title="Delete"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
        {sortedRMs.length > 0 && (
          <div className="px-6 py-3 bg-gray-50 border-t border-gray-200">
            <p className="text-sm text-gray-600">Showing <span className="font-medium">{sortedRMs.length}</span> of <span className="font-medium">{sortedRMs.length}</span> relationship managers</p>
          </div>
        )}
      </div>

      <Modal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} title="Create New Relationship Manager">
        <RelationshipManagerForm onSave={handleSave} onClose={() => setIsCreateModalOpen(false)} />
      </Modal>

      <Modal isOpen={isEditModalOpen} onClose={() => { setIsEditModalOpen(false); setSelectedRM(null) }} title="Edit Relationship Manager">
        <RelationshipManagerForm relationshipManager={selectedRM} onSave={handleSave} onClose={() => setIsEditModalOpen(false)} />
      </Modal>

      <Modal isOpen={isDetailModalOpen} onClose={() => { setIsDetailModalOpen(false); setSelectedRM(null) }} title="Relationship Manager Details" size="md">
        {selectedRM && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><label className="text-sm font-medium text-gray-500">Name</label><p className="mt-1 text-sm text-gray-900">{selectedRM.name}</p></div>
              <div><label className="text-sm font-medium text-gray-500">Owner Name</label><p className="mt-1 text-sm text-gray-900">{selectedRM.ownerName || 'N/A'}</p></div>
              <div><label className="text-sm font-medium text-gray-500">Email</label><p className="mt-1 text-sm text-gray-900">{selectedRM.email || 'N/A'}</p></div>
              <div><label className="text-sm font-medium text-gray-500">Mobile</label><p className="mt-1 text-sm text-gray-900">{selectedRM.mobile || 'N/A'}</p></div>
              <div><label className="text-sm font-medium text-gray-500">City</label><p className="mt-1 text-sm text-gray-900">{selectedRM.address?.city || 'N/A'}</p></div>
              <div><label className="text-sm font-medium text-gray-500">Status</label><div className="mt-1"><StatusBadge status={selectedRM.status} /></div></div>
            </div>
            <div className="pt-4 border-t border-gray-200">
              <h4 className="text-sm font-semibold text-gray-900 mb-3">Performance</h4>
              {(() => {
                const ownerId = selectedRM.owner?._id || selectedRM.owner
                const stats = getRMStats(ownerId)
                return (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gray-50 rounded-lg p-3"><p className="text-xs text-gray-500">Agents</p><p className="text-lg font-bold text-gray-900">{stats.agents}</p></div>
                    <div className="bg-gray-50 rounded-lg p-3"><p className="text-xs text-gray-500">Total Leads</p><p className="text-lg font-bold text-primary-900">{stats.leads}</p></div>
                    <div className="bg-gray-50 rounded-lg p-3 col-span-2"><p className="text-xs text-gray-500">Revenue</p><p className="text-lg font-bold text-gray-900">₹{stats.revenue.toLocaleString()}</p></div>
                  </div>
                )
              })()}
            </div>
            <div className="pt-4 border-t border-gray-200">
              <button onClick={() => { setIsDetailModalOpen(false); handleEdit(selectedRM) }} className="w-full px-4 py-2 bg-primary-900 text-white rounded-lg hover:bg-primary-800 transition-colors">Edit Relationship Manager</button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmModal
        isOpen={confirmDelete.isOpen}
        onClose={() => setConfirmDelete({ isOpen: false, rm: null })}
        onConfirm={handleDeleteConfirm}
        title="Delete Relationship Manager"
        message={`Are you sure you want to delete "${confirmDelete.rm?.name || 'this relationship manager'}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        type="danger"
      />
    </div>
  )
}

export default RelationshipManagers
