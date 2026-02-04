import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { MapPin, Search, Building2, Mail, Phone, Plus, Filter, ChevronDown, ChevronUp, Users } from 'lucide-react'
import api from '../services/api'
import { authService } from '../services/auth.service'
import StatCard from '../components/StatCard'
import Modal from '../components/Modal'
import RegionalManagerForm from '../components/RegionalManagerForm'
import { toast } from '../services/toastService'

const RegionalManagers = () => {
  const navigate = useNavigate()
  const [regionalManagers, setRegionalManagers] = useState([])
  const [franchises, setFranchises] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [franchiseFilter, setFranchiseFilter] = useState('')
  const [filtersOpen, setFiltersOpen] = useState(true)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const [usersRes, franchisesRes] = await Promise.all([
        api.users.getAll({ role: 'regional_manager', limit: 200 }),
        api.franchises.getAll({ limit: 500 }),
      ])
      const users = usersRes?.data || []
      const franchList = Array.isArray(franchisesRes?.data) ? franchisesRes.data : franchisesRes?.franchises || []
      setRegionalManagers(Array.isArray(users) ? users : [])
      setFranchises(franchList)
    } catch (err) {
      setRegionalManagers([])
      setFranchises([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (authService.getUser()?.role !== 'super_admin') {
      navigate('/', { replace: true })
      return
    }
    load()
  }, [navigate])

  const getFranchisesForRM = (rmId) =>
    franchises.filter((f) => f.regionalManager && (f.regionalManager._id || f.regionalManager).toString() === (rmId || '').toString())

  const filtered = useMemo(() => {
    return regionalManagers.filter((rm) => {
      const s = searchTerm.toLowerCase()
      const matchesSearch =
        !searchTerm ||
        (rm.name && rm.name.toLowerCase().includes(s)) ||
        (rm.email && rm.email.toLowerCase().includes(s)) ||
        (rm.phone && rm.phone.toString().includes(searchTerm)) ||
        (rm.mobile && rm.mobile.toString().includes(searchTerm))
      const matchesStatus = statusFilter === 'all' || rm.status === statusFilter
      let matchesFranchise = true
      if (franchiseFilter) {
        const rmFranchises = getFranchisesForRM(rm._id)
        matchesFranchise = rmFranchises.some((f) => (f._id || f.id).toString() === franchiseFilter)
      }
      return matchesSearch && matchesStatus && matchesFranchise
    })
  }, [regionalManagers, searchTerm, statusFilter, franchiseFilter, franchises])

  const kpis = useMemo(() => {
    const total = regionalManagers.length
    const active = regionalManagers.filter((r) => r.status === 'active').length
    const franchisesCovered = franchises.filter((f) => f.regionalManager).length
    const getCountForRM = (rmId) =>
      franchises.filter((f) => f.regionalManager && (f.regionalManager._id || f.regionalManager).toString() === (rmId || '').toString()).length
    const withoutFranchises = regionalManagers.filter((r) => getCountForRM(r._id) === 0).length
    return { total, active, franchisesCovered, withoutFranchises }
  }, [regionalManagers, franchises])

  const handleCreateRM = async (data) => {
    try {
      await api.users.create(data)
      toast.success('Success', 'Regional Manager created successfully')
      setIsCreateModalOpen(false)
      load()
    } catch (err) {
      toast.error('Error', err.message || 'Failed to create Regional Manager')
    }
  }

  const hasActiveFilters = searchTerm !== '' || statusFilter !== 'all' || franchiseFilter !== ''
  const clearFilters = () => {
    setSearchTerm('')
    setStatusFilter('all')
    setFranchiseFilter('')
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-gray-600">
        <span>Dashboard</span>
        <span>/</span>
        <span className="text-gray-900 font-medium">Regional Managers</span>
      </div>
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Regional Managers</h1>
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium"
        >
          <Plus className="w-5 h-5" />
          Add Regional Manager
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Regional Managers" value={kpis.total} icon={Users} color="blue" />
        <StatCard title="Active" value={kpis.active} icon={MapPin} color="green" />
        <StatCard title="Franchises Covered" value={kpis.franchisesCovered} icon={Building2} color="purple" />
        <StatCard title="Unassigned" value={kpis.withoutFranchises} icon={MapPin} color="orange" />
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        <button
          type="button"
          onClick={() => setFiltersOpen((o) => !o)}
          className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50"
        >
          <span className="flex items-center gap-2 font-medium text-gray-900">
            <Filter className="w-5 h-5 text-gray-500" />
            Filters
            {hasActiveFilters && (
              <span className="text-xs bg-primary-100 text-primary-800 px-2 py-0.5 rounded-full">Active</span>
            )}
          </span>
          {filtersOpen ? <ChevronUp className="w-5 h-5 text-gray-500" /> : <ChevronDown className="w-5 h-5 text-gray-500" />}
        </button>
        {filtersOpen && (
          <div className="border-t border-gray-200 p-4 flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Name, email, mobile..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white min-w-[120px]"
              >
                <option value="all">All</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Assigned Franchise</label>
              <select
                value={franchiseFilter}
                onChange={(e) => setFranchiseFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white min-w-[180px]"
              >
                <option value="">All franchises</option>
                {franchises.map((f) => (
                  <option key={f._id || f.id} value={f._id || f.id}>
                    {f.name || 'Unnamed'}
                  </option>
                ))}
              </select>
            </div>
            {hasActiveFilters && (
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={clearFilters}
                  className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
                >
                  Clear filters
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading...</div>
      ) : (
        <div className="grid gap-4">
          {filtered.map((rm) => {
            const rmFranchises = getFranchisesForRM(rm._id)
            return (
              <div
                key={rm._id}
                className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
                    <MapPin className="w-6 h-6 text-primary-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-lg font-semibold text-gray-900">{rm.name || 'Unnamed'}</h2>
                    <div className="flex flex-wrap gap-4 mt-2 text-sm text-gray-600">
                      {rm.email && (
                        <span className="flex items-center gap-1">
                          <Mail className="w-4 h-4" />
                          {rm.email}
                        </span>
                      )}
                      {(rm.mobile || rm.phone) && (
                        <span className="flex items-center gap-1">
                          <Phone className="w-4 h-4" />
                          {rm.mobile || rm.phone}
                        </span>
                      )}
                    </div>
                    <div className="mt-4">
                      <h3 className="text-sm font-medium text-gray-700 flex items-center gap-1">
                        <Building2 className="w-4 h-4" />
                        Assigned Franchises ({rmFranchises.length})
                      </h3>
                      {rmFranchises.length > 0 ? (
                        <ul className="mt-2 space-y-1">
                          {rmFranchises.map((f) => (
                            <li key={f._id} className="text-sm text-gray-600 pl-6">
                              {f.name} {f.address && typeof f.address === 'object' ? `• ${f.address.city || f.address.line1 || ''}` : f.address ? `• ${f.address}` : ''}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-gray-500 mt-1 pl-6">No franchises assigned</p>
                      )}
                    </div>
                  </div>
                  <span className={`px-2 py-1 text-xs rounded-full ${rm.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                    {rm.status || 'N/A'}
                  </span>
                </div>
              </div>
            )
          })}
          {filtered.length === 0 && (
            <div className="text-center py-12 text-gray-500">No regional managers found</div>
          )}
        </div>
      )}

      <Modal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} title="Create Regional Manager" size="md">
        <RegionalManagerForm
          onSave={handleCreateRM}
          onClose={() => setIsCreateModalOpen(false)}
        />
      </Modal>
    </div>
  )
}

export default RegionalManagers
