import { useState, useMemo, useEffect } from 'react'
import { Plus, Search, Filter, Eye, Edit, Trash2, ArrowUpDown, ArrowUp, ArrowDown, Landmark, Users, ChevronDown, ChevronUp, FileDown } from 'lucide-react'
import api from '../services/api'
import StatusBadge from '../components/StatusBadge'
import Modal from '../components/Modal'
import BankManagerForm from '../components/BankManagerForm'
import StatCard from '../components/StatCard'
import ConfirmModal from '../components/ConfirmModal'
import { toast } from '../services/toastService'
import { exportToExcel } from '../utils/exportExcel'

const ROLE_LABEL = { sm: 'SM', bm: 'BM', asm: 'ASM' }

const BankManagers = () => {
  const [bankManagers, setBankManagers] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [roleFilter, setRoleFilter] = useState('all')
  const [filtersOpen, setFiltersOpen] = useState(true)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)
  const [selectedBM, setSelectedBM] = useState(null)
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' })
  const [confirmDelete, setConfirmDelete] = useState({ isOpen: false, bm: null })

  useEffect(() => {
    fetchBankManagers()
  }, [])

  const fetchBankManagers = async () => {
    try {
      setLoading(true)
      const response = await api.bankManagers.getAll({ limit: 500 })
      const data = response.data || response || []
      setBankManagers(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Error fetching bank managers:', error)
      setBankManagers([])
    } finally {
      setLoading(false)
    }
  }

  const totalBM = bankManagers.length
  const activeBM = bankManagers.filter(b => b.status === 'active').length
  const byRole = useMemo(() => ({
    sm: bankManagers.filter(b => b.role === 'sm').length,
    bm: bankManagers.filter(b => b.role === 'bm').length,
    asm: bankManagers.filter(b => b.role === 'asm').length,
  }), [bankManagers])

  const filteredBM = useMemo(() => {
    if (!bankManagers?.length) return []
    return bankManagers.filter((bm) => {
      const searchLower = searchTerm.toLowerCase()
      const bankName = (bm.bank?.name || '').toLowerCase()
      const matchesSearch =
        (bm.name && bm.name.toLowerCase().includes(searchLower)) ||
        (bm.email && bm.email.toLowerCase().includes(searchLower)) ||
        (bm.mobile && String(bm.mobile).includes(searchTerm)) ||
        bankName.includes(searchLower)
      const matchesStatus = statusFilter === 'all' || bm.status === statusFilter
      const matchesRole = roleFilter === 'all' || bm.role === roleFilter
      return matchesSearch && matchesStatus && matchesRole
    })
  }, [bankManagers, searchTerm, statusFilter, roleFilter])

  const hasActiveFilters = searchTerm !== '' || statusFilter !== 'all' || roleFilter !== 'all'
  const clearFilters = () => { setSearchTerm(''); setStatusFilter('all'); setRoleFilter('all') }

  const sortedBM = useMemo(() => {
    if (!sortConfig.key) return filteredBM
    return [...filteredBM].sort((a, b) => {
      let aVal = sortConfig.key === 'bank' ? (a.bank?.name || '') : a[sortConfig.key]
      let bVal = sortConfig.key === 'bank' ? (b.bank?.name || '') : b[sortConfig.key]
      if (aVal == null) aVal = ''
      if (bVal == null) bVal = ''
      if (typeof aVal === 'string') { aVal = aVal.toLowerCase(); bVal = String(bVal).toLowerCase() }
      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1
      return 0
    })
  }, [filteredBM, sortConfig])

  const handleSort = (key) => {
    setSortConfig(prev => ({ key, direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc' }))
  }
  const getSortIcon = (key) => {
    if (sortConfig.key !== key) return <ArrowUpDown className="w-4 h-4 text-gray-400" />
    return sortConfig.direction === 'asc' ? <ArrowUp className="w-4 h-4 text-primary-900" /> : <ArrowDown className="w-4 h-4 text-primary-900" />
  }

  const handleCreate = () => { setSelectedBM(null); setIsCreateModalOpen(true) }
  const handleEdit = (bm) => { setSelectedBM(bm); setIsEditModalOpen(true) }
  const handleView = (bm) => { setSelectedBM(bm); setIsDetailModalOpen(true) }

  const handleSave = async (formData) => {
    try {
      if (selectedBM) {
        const id = selectedBM.id || selectedBM._id
        await api.bankManagers.update(id, formData)
        await fetchBankManagers()
        setIsEditModalOpen(false)
        setSelectedBM(null)
        toast.success('Success', 'Bank manager updated successfully')
      } else {
        await api.bankManagers.create(formData)
        await fetchBankManagers()
        setIsCreateModalOpen(false)
        toast.success('Success', 'Bank manager created successfully')
      }
    } catch (error) {
      toast.error('Error', error.message || 'Failed to save bank manager.')
    }
  }

  const handleDeleteClick = (bm) => setConfirmDelete({ isOpen: true, bm })
  const handleDeleteConfirm = async () => {
    const id = confirmDelete.bm?.id || confirmDelete.bm?._id
    if (!id) return
    try {
      await api.bankManagers.delete(id)
      await fetchBankManagers()
      toast.success('Success', 'Bank manager deleted successfully')
      setConfirmDelete({ isOpen: false, bm: null })
    } catch (error) {
      toast.error('Error', error.message || 'Failed to delete bank manager')
    }
  }

  const statusOptions = [
    { value: 'all', label: 'All Status' },
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive' },
  ]
  const roleOptions = [
    { value: 'all', label: 'All Roles' },
    { value: 'sm', label: 'SM' },
    { value: 'bm', label: 'BM' },
    { value: 'asm', label: 'ASM' },
  ]

  return (
    <div className="space-y-6 w-full max-w-full overflow-x-hidden">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bank Managers</h1>
          <p className="text-sm text-gray-600 mt-1">Manage bank managers (SM, BM, ASM) and their bank association</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              const rows = sortedBM.map((b) => ({
                Name: b.name || 'N/A',
                Role: ROLE_LABEL[b.role] || b.role,
                Bank: b.bank?.name || 'N/A',
                Email: b.email || 'N/A',
                Mobile: b.mobile || 'N/A',
                Status: b.status || 'N/A',
              }))
              exportToExcel(rows, `bank_managers_export_${Date.now()}`, 'Bank Managers')
              toast.success('Export', `Exported ${rows.length} bank managers to Excel`)
            }}
            disabled={sortedBM.length === 0}
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
            <span>Add Bank Manager</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Total Bank Managers" value={totalBM} change="" changeType="positive" icon={Users} color="blue" />
        <StatCard title="Active" value={activeBM} change={totalBM ? `${((activeBM / totalBM) * 100).toFixed(0)}% active` : ''} changeType="positive" icon={Landmark} color="green" />
        <StatCard title="SM" value={byRole.sm} change="Sales Manager" changeType="neutral" icon={Users} color="orange" />
        <StatCard title="BM / ASM" value={byRole.bm + byRole.asm} change="BM + ASM" changeType="neutral" icon={Landmark} color="purple" />
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input type="text" placeholder="Name, email, mobile, bank..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm bg-white">
                  {roleOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm bg-white">
                  {statusOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            </div>
            {hasActiveFilters && (
              <div className="flex items-center gap-2 pt-1">
                <button type="button" onClick={clearFilters} className="text-sm text-primary-600 hover:text-primary-800 font-medium">Clear all filters</button>
                <span className="text-sm text-gray-500">Showing {filteredBM.length} of {bankManagers.length} bank managers</span>
              </div>
            )}
          </div>
        )}

        <div className="overflow-x-auto border-t border-gray-200">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => handleSort('name')}>
                  <div className="flex items-center gap-2">Name {getSortIcon('name')}</div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => handleSort('role')}>
                  <div className="flex items-center gap-2">Role {getSortIcon('role')}</div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => handleSort('bank')}>
                  <div className="flex items-center gap-2">Bank {getSortIcon('bank')}</div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Mobile</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => handleSort('status')}>
                  <div className="flex items-center gap-2">Status {getSortIcon('status')}</div>
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr><td colSpan="7" className="px-6 py-8 text-center text-gray-500">Loading...</td></tr>
              ) : sortedBM.length === 0 ? (
                <tr><td colSpan="7" className="px-6 py-8 text-center text-gray-500">No bank managers found</td></tr>
              ) : (
                sortedBM.map((bm) => {
                  const id = bm.id || bm._id
                  return (
                    <tr key={id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap"><div className="text-sm font-medium text-gray-900">{bm.name || 'N/A'}</div></td>
                      <td className="px-6 py-4 whitespace-nowrap"><div className="text-sm font-medium text-gray-900">{ROLE_LABEL[bm.role] || bm.role}</div></td>
                      <td className="px-6 py-4 whitespace-nowrap"><div className="text-sm text-gray-900">{bm.bank?.name || 'N/A'}</div></td>
                      <td className="px-6 py-4 whitespace-nowrap"><div className="text-sm text-gray-600">{bm.email || '—'}</div></td>
                      <td className="px-6 py-4 whitespace-nowrap"><div className="text-sm text-gray-600">{bm.mobile || '—'}</div></td>
                      <td className="px-6 py-4 whitespace-nowrap"><StatusBadge status={bm.status} /></td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => handleView(bm)} className="text-primary-900 hover:text-primary-900 p-1" title="View"><Eye className="w-4 h-4" /></button>
                          <button onClick={() => handleEdit(bm)} className="text-gray-600 hover:text-gray-900 p-1" title="Edit"><Edit className="w-4 h-4" /></button>
                          <button onClick={() => handleDeleteClick(bm)} className="text-red-600 hover:text-red-900 p-1" title="Delete"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
        {sortedBM.length > 0 && (
          <div className="px-6 py-3 bg-gray-50 border-t border-gray-200">
            <p className="text-sm text-gray-600">Showing <span className="font-medium">{sortedBM.length}</span> of <span className="font-medium">{bankManagers.length}</span> bank managers</p>
          </div>
        )}
      </div>

      <Modal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} title="Add Bank Manager">
        <BankManagerForm onSave={handleSave} onClose={() => setIsCreateModalOpen(false)} />
      </Modal>
      <Modal isOpen={isEditModalOpen} onClose={() => { setIsEditModalOpen(false); setSelectedBM(null) }} title="Edit Bank Manager">
        <BankManagerForm bankManager={selectedBM} onSave={handleSave} onClose={() => setIsEditModalOpen(false)} />
      </Modal>
      <Modal isOpen={isDetailModalOpen} onClose={() => { setIsDetailModalOpen(false); setSelectedBM(null) }} title="Bank Manager Details" size="md">
        {selectedBM && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><label className="text-sm font-medium text-gray-500">Name</label><p className="mt-1 text-sm text-gray-900">{selectedBM.name}</p></div>
              <div><label className="text-sm font-medium text-gray-500">Role</label><p className="mt-1 text-sm font-medium text-gray-900">{ROLE_LABEL[selectedBM.role] || selectedBM.role}</p></div>
              <div><label className="text-sm font-medium text-gray-500">Bank</label><p className="mt-1 text-sm text-gray-900">{selectedBM.bank?.name || 'N/A'}</p></div>
              <div><label className="text-sm font-medium text-gray-500">Email</label><p className="mt-1 text-sm text-gray-900">{selectedBM.email || '—'}</p></div>
              <div><label className="text-sm font-medium text-gray-500">Mobile</label><p className="mt-1 text-sm text-gray-900">{selectedBM.mobile || '—'}</p></div>
              <div><label className="text-sm font-medium text-gray-500">Status</label><div className="mt-1"><StatusBadge status={selectedBM.status} /></div></div>
            </div>
            <div className="pt-4 border-t border-gray-200">
              <button onClick={() => { setIsDetailModalOpen(false); handleEdit(selectedBM) }} className="w-full px-4 py-2 bg-primary-900 text-white rounded-lg hover:bg-primary-800 transition-colors">Edit Bank Manager</button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmModal
        isOpen={confirmDelete.isOpen}
        onClose={() => setConfirmDelete({ isOpen: false, bm: null })}
        onConfirm={handleDeleteConfirm}
        title="Delete Bank Manager"
        message={`Are you sure you want to delete "${confirmDelete.bm?.name || 'this bank manager'}"?`}
        confirmText="Delete"
        cancelText="Cancel"
        type="danger"
      />
    </div>
  )
}

export default BankManagers
