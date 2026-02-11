import { useState, useMemo, useEffect } from 'react'
import { Plus, Search, Filter, Eye, Edit, Trash2, ArrowUpDown, ArrowUp, ArrowDown, ChevronDown, ChevronUp, Copy, Settings2, History, X, FileDown } from 'lucide-react'
import api from '../services/api'
import { authService } from '../services/auth.service'
import StatusBadge from '../components/StatusBadge'
import Modal from '../components/Modal'
import LeadForm from '../components/LeadForm'
import ConfirmModal from '../components/ConfirmModal'
import { toast } from '../services/toastService'
import { exportToExcel } from '../utils/exportExcel'

const Leads = () => {
  const userRole = authService.getUser()?.role || 'super_admin'
  const isAgent = userRole === 'agent'
  const canViewHistory = ['super_admin', 'relationship_manager', 'franchise', 'agent'].includes(userRole)
  const canEdit = !isAgent
  const canCreate = true // Agents can create leads

  const [leads, setLeads] = useState([])
  const [agents, setAgents] = useState([])
  const [banks, setBanks] = useState([])
  const [staff, setStaff] = useState([])
  const [bankManagers, setBankManagers] = useState([])
  const [franchises, setFranchises] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [franchiseFilter, setFranchiseFilter] = useState('')
  const [agentFilter, setAgentFilter] = useState('')
  const [bankFilter, setBankFilter] = useState('')
  const [dsaCodeFilter, setDsaCodeFilter] = useState('')
  const [filtersOpen, setFiltersOpen] = useState(true)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false)
  const [leadHistory, setLeadHistory] = useState([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [expandedHistoryItems, setExpandedHistoryItems] = useState(new Set())
  const [selectedLead, setSelectedLead] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState({ isOpen: false, lead: null })
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' })
  const [expandedFields, setExpandedFields] = useState({})
  const [showColumnSettings, setShowColumnSettings] = useState(false)

  // Column configuration with all available fields
  const [columnConfig, setColumnConfig] = useState(() => {
    const saved = localStorage.getItem('leadsColumnConfig')
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        // Remove leadType, contact, caseNumber, verificationStatus and sanctionedAmount columns if they exist in saved config
        const filtered = parsed.filter(col => col.key !== 'leadType' && col.key !== 'contact' && col.key !== 'caseNumber' && col.key !== 'verificationStatus' && col.key !== 'sanctionedAmount')
        // Update codeUse label to 'DSA Code' if it exists
        const updated = filtered.map(col => {
          // Normalize legacy 'franchise' column to 'associated'
          if (col.key === 'franchise') {
            return { ...col, key: 'associated', label: 'Associated' }
          }
          // If label mentions Franchise, rename to Associated
          if (typeof col.label === 'string' && col.label.toLowerCase().includes('franchise')) {
            return { ...col, label: col.label.replace(/franchise/ig, 'Associated') }
          }
          if (col.key === 'codeUse') {
            return { ...col, label: 'DSA Code' }
          }
          return col
        })
        return updated
      } catch (e) {
        console.error('Error parsing saved column config:', e)
      }
    }
    return [
      { key: 'customerName', label: 'Customer Name', visible: true, sortable: true },
      { key: 'loanType', label: 'Loan Type', visible: true, sortable: true },
      { key: 'loanAmount', label: 'Loan Amount', visible: true, sortable: true },
      { key: 'disbursedAmount', label: 'Disbursed Amount', visible: true, sortable: true },
      { key: 'status', label: 'Status', visible: true, sortable: true },
      { key: 'agent', label: 'Agent', visible: true, sortable: false },
      { key: 'associated', label: 'Associated', visible: true, sortable: false },
      { key: 'bank', label: 'Bank', visible: true, sortable: false },
      { key: 'smBm', label: 'SM/BM', visible: true, sortable: false },
      { key: 'asm', label: 'ASM', visible: true, sortable: false },
      { key: 'branch', label: 'Branch', visible: true, sortable: true },
      { key: 'loanAccountNo', label: 'Loan Account No', visible: true, sortable: true },
      { key: 'disbursementDate', label: 'Disbursement Date', visible: true, sortable: true },
      { key: 'sanctionedDate', label: 'Sanctioned Date', visible: true, sortable: true },
      { key: 'codeUse', label: 'DSA Code', visible: true, sortable: true },
      { key: 'remarks', label: 'Remarks', visible: false, sortable: false },
      { key: 'createdAt', label: 'Created', visible: true, sortable: true },
      { key: 'actions', label: 'Actions', visible: true, sortable: false },
    ]
  })

  useEffect(() => {
    // Filter out leadType, contact, caseNumber, and verificationStatus columns before saving
    const filteredConfig = columnConfig.filter(col => col.key !== 'leadType' && col.key !== 'contact' && col.key !== 'caseNumber' && col.key !== 'verificationStatus')
    // Normalize any legacy 'franchise' keys and labels, and ensure codeUse label is 'DSA Code'
    const normalized = filteredConfig.map(col => {
      if (col.key === 'franchise') {
        return { ...col, key: 'associated', label: 'Associated' }
      }
      if (typeof col.label === 'string' && col.label.toLowerCase().includes('franchise')) {
        return { ...col, label: col.label.replace(/franchise/ig, 'Associated') }
      }
      if (col.key === 'codeUse') {
        return { ...col, label: 'DSA Code' }
      }
      return col
    })
    localStorage.setItem('leadsColumnConfig', JSON.stringify(normalized))
  }, [columnConfig])

  useEffect(() => {
    fetchLeads()
    if (!isAgent) {
      fetchAgents()
    }
    fetchBanks()
    fetchBankManagers()
    fetchStaff()
    // Relationship managers are not allowed to view franchises — don't request franchises for them
    if (userRole !== 'relationship_manager') {
      fetchFranchises()
    }
  }, [isAgent, userRole])

  useEffect(() => {
    const handleClickOutside = (event) => {
      const target = event.target
      const isClickInsideOverlay = target.closest('.absolute.z-50') || target.closest('[data-expandable]')
      if (!isClickInsideOverlay) {
        setExpandedFields({})
      }
      const isClickInsideColumnSettings = target.closest('[data-column-settings]')
      if (!isClickInsideColumnSettings && !target.closest('button[data-column-settings-button]')) {
        setShowColumnSettings(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [expandedFields, showColumnSettings])

  const fetchLeads = async () => {
    try {
      setLoading(true)
      const response = await api.leads.getAll()
      console.log('🔍 DEBUG: Leads API response:', response)

      // Handle different response structures
      let leadsData = []
      if (Array.isArray(response)) {
        leadsData = response
      } else if (response && Array.isArray(response.data)) {
        leadsData = response.data
      } else if (response && response.data && Array.isArray(response.data)) {
        leadsData = response.data
      } else {
        console.warn('⚠️ Unexpected response structure:', response)
        leadsData = []
      }

      console.log('🔍 DEBUG: Parsed leads data:', leadsData.length, 'leads')
      if (leadsData.length > 0) {
        console.log('🔍 DEBUG: Sample lead agent data:', {
          leadId: leadsData[0].id || leadsData[0]._id,
          agent: leadsData[0].agent,
          agentId: leadsData[0].agentId,
          agentType: typeof leadsData[0].agent,
          agentName: leadsData[0].agent?.name
        })
      }
      setLeads(leadsData)
    } catch (error) {
      console.error('Error fetching leads:', error)
      setLeads([])
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

  const fetchBanks = async () => {
    try {
      const response = await api.banks.getAll()
      const banksData = response.data || response || []
      setBanks(Array.isArray(banksData) ? banksData : [])
    } catch (error) {
      console.error('Error fetching banks:', error)
      setBanks([])
    }
  }

  const fetchStaff = async () => {
    try {
      const response = await api.staff.getAll()
      const staffData = response.data || response || []
      setStaff(Array.isArray(staffData) ? staffData : [])
    } catch (error) {
      console.error('Error fetching staff:', error)
      setStaff([])
    }
  }

  const fetchBankManagers = async () => {
    try {
      const response = await api.bankManagers.getAll({ limit: 1000 })
      const bmData = response.data || response || []
      setBankManagers(Array.isArray(bmData) ? bmData : [])
    } catch (error) {
      console.error('Error fetching bank managers:', error)
      setBankManagers([])
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

  // Filter and search leads
  const filteredLeads = useMemo(() => {
    if (!leads || leads.length === 0) return []

    const searchLower = (searchTerm || '').trim().toLowerCase()
    const hasSearch = searchLower.length > 0

    return leads.filter((lead) => {
      if (!lead) return false

      const matchesStatus = statusFilter === 'all' || lead.status === statusFilter
      if (!matchesStatus) return false

      if (franchiseFilter) {
        const fid = lead.associated?._id || lead.associated?.id || lead.associated
        if (!fid || (fid !== franchiseFilter && fid.toString() !== franchiseFilter)) return false
      }
      if (agentFilter) {
        const aid = lead.agent?._id || lead.agent?.id || lead.agent
        if (!aid || (aid !== agentFilter && aid.toString() !== agentFilter)) return false
      }
      if (bankFilter) {
        const bid = lead.bank?._id || lead.bank?.id || lead.bank
        if (!bid || (bid !== bankFilter && bid.toString() !== bankFilter)) return false
      }
      if (dsaCodeFilter.trim()) {
        const code = (lead.dsaCode ?? lead.codeUse ?? '').toString().toLowerCase()
        if (!code.includes(dsaCodeFilter.trim().toLowerCase())) return false
      }

      if (!hasSearch) return true

      const applicantEmail = lead.applicantEmail || lead.email || ''
      const applicantMobile = (lead.applicantMobile || lead.phone || lead.mobile || '').toString()
      const customerName = lead.customerName || ''
      const caseNumber = lead.caseNumber || ''
      const loanAccountNo = (lead.loanAccountNo || '').toString()

      return (
        applicantEmail.toLowerCase().includes(searchLower) ||
        applicantMobile.includes(searchTerm.trim()) ||
        customerName.toLowerCase().includes(searchLower) ||
        caseNumber.toLowerCase().includes(searchLower) ||
        loanAccountNo.toLowerCase().includes(searchLower)
      )
    })
  }, [leads, searchTerm, statusFilter, franchiseFilter, agentFilter, bankFilter, dsaCodeFilter])

  const hasActiveFilters = searchTerm !== '' || statusFilter !== 'all' || franchiseFilter !== '' || agentFilter !== '' || bankFilter !== '' || dsaCodeFilter.trim() !== ''
  const clearLeadsFilters = () => {
    setSearchTerm('')
    setStatusFilter('all')
    setFranchiseFilter('')
    setAgentFilter('')
    setBankFilter('')
    setDsaCodeFilter('')
  }

  // Sort leads
  const sortedLeads = useMemo(() => {
    if (!sortConfig.key) return filteredLeads

    return [...filteredLeads].sort((a, b) => {
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
  }, [filteredLeads, sortConfig])

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
    setSelectedLead(null)
    setIsCreateModalOpen(true)
  }

  const handleEdit = (lead) => {
    setSelectedLead(lead)
    setIsEditModalOpen(true)
  }

  const handleView = (lead) => {
    setSelectedLead(lead)
    setIsDetailModalOpen(true)
  }

  const handleViewHistory = async (lead) => {
    setSelectedLead(lead)
    setIsHistoryModalOpen(true)
    setHistoryLoading(true)
    setExpandedHistoryItems(new Set())
    try {
      const response = await api.leads.getHistory(lead.id || lead._id)
      const historyData = response.data || response || []
      setLeadHistory(Array.isArray(historyData) ? historyData : [])
    } catch (error) {
      console.error('Error fetching lead history:', error)
      toast.error('Error', 'Failed to load lead history')
      setLeadHistory([])
    } finally {
      setHistoryLoading(false)
    }
  }

  const toggleHistoryItem = (index) => {
    setExpandedHistoryItems(prev => {
      const newSet = new Set(prev)
      if (newSet.has(index)) {
        newSet.delete(index)
      } else {
        newSet.add(index)
      }
      return newSet
    })
  }

  const isHistoryItemExpanded = (index) => {
    return expandedHistoryItems.has(index)
  }

  const formatFieldName = (field) => {
    const fieldMap = {
      'agent': 'Agent',
      'associated': 'Associated',
      'bank': 'Bank',
      'smBm': 'SM/BM',
      'applicantMobile': 'Mobile',
      'applicantEmail': 'Email',
      'loanType': 'Loan Type',
      'loanAmount': 'Loan Amount',
      'disbursedAmount': 'Disbursed Amount',
      'status': 'Status',
      'disbursementDate': 'Disbursement Date',
      'sanctionedDate': 'Sanctioned Date',
      'customerName': 'Customer Name',
      'loanAccountNo': 'Loan Account No',
      'branch': 'Branch',
      'codeUse': 'DSA Code',
      'asmName': 'ASM Name',
      'asmEmail': 'ASM Email',
      'asmMobile': 'ASM Mobile',
      'smBmEmail': 'SM/BM Email',
      'smBmMobile': 'SM/BM Mobile',
      'remarks': 'Remarks',
      'commissionPercentage': 'Commission Percentage',
      'commissionBasis': 'Commission Basis',
    }
    return fieldMap[field] || field
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .trim()
  }

  const formatFieldValue = (value, fieldName) => {
    if (value === null || value === undefined || value === '') return 'N/A'
    if (typeof value === 'boolean') return value ? 'Yes' : 'No'
    if (value instanceof Date || (typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}/))) {
      return new Date(value).toLocaleString()
    }

    // Handle ObjectId references - try to resolve to names
    if (typeof value === 'string' && value.match(/^[0-9a-fA-F]{24}$/)) {
      // It's an ObjectId, try to resolve it
      if (fieldName === 'agent') {
        const agent = agents.find(a => (a._id || a.id) === value)
        return agent ? agent.name : value.substring(0, 8) + '...'
      }
      if (fieldName === 'bank') {
        const bank = banks.find(b => (b._id || b.id) === value)
        return bank ? bank.name : value.substring(0, 8) + '...'
      }
      if (fieldName === 'associated') {
        const franchise = franchises.find(f => (f._id || f.id) === value)
        return franchise ? franchise.name : value.substring(0, 8) + '...'
      }
      if (fieldName === 'smBm') {
        const staffMember = staff.find(s => (s._id || s.id) === value)
        return staffMember ? staffMember.name : value.substring(0, 8) + '...'
      }
      return value.substring(0, 8) + '...'
    }

    // Handle object values (shouldn't happen, but just in case)
    if (typeof value === 'object') {
      if (value.name) return value.name
      if (value._id || value.id) {
        // Try to resolve
        if (fieldName === 'agent') {
          const agent = agents.find(a => (a._id || a.id) === (value._id || value.id))
          return agent ? agent.name : 'Unknown'
        }
        if (fieldName === 'bank') {
          const bank = banks.find(b => (b._id || b.id) === (value._id || value.id))
          return bank ? bank.name : 'Unknown'
        }
        if (fieldName === 'smBm') {
          const staffMember = staff.find(s => (s._id || s.id) === (value._id || value.id))
          return staffMember ? staffMember.name : 'Unknown'
        }
        return 'Unknown'
      }
      return '[Object]'
    }

    return String(value)
  }

  const handleSave = async (formData) => {
        try {
      // Validate required fields (only fields with red asterisk)
      if (!formData.loanType) {
        toast.error('Error', 'Loan type is required')
        return
      }
      if (!formData.loanAmount || formData.loanAmount <= 0) {
        toast.error('Error', 'Loan amount must be greater than 0')
        return
      }
      if (!formData.bankId) {
        toast.error('Error', 'Bank is required')
        return
      }

      // Map form data to backend API format
      const leadData = {
        caseNumber: formData.caseNumber?.trim() || undefined,
        applicantMobile: formData.applicantMobile?.trim() || undefined,
        applicantEmail: formData.applicantEmail?.trim() || undefined,
        loanType: formData.loanType,
        loanAmount: parseFloat(formData.loanAmount),
        status: formData.status || 'logged',
        agent: formData.agentId || formData.agent || undefined,
        // Support both shapes: payload may include `associated` (from LeadForm) or `associatedId`
        associated: formData.associated || formData.associatedId || formData.franchiseId || undefined,
        associatedModel: formData.associatedModel || (formData.franchiseId ? 'Franchise' : undefined),
        bank: formData.bankId,
        customerName: formData.customerName?.trim() || undefined,
        sanctionedDate: formData.sanctionedDate || undefined,
        disbursedAmount: formData.disbursedAmount ? parseFloat(formData.disbursedAmount) : undefined,
        disbursementDate: formData.disbursementDate || undefined,
        disbursementType: formData.disbursementType || undefined,
        loanAccountNo: formData.loanAccountNo?.trim() || undefined,
        commissionBasis: formData.commissionBasis || undefined,
        commissionPercentage: formData.commissionPercentage ? parseFloat(formData.commissionPercentage) : undefined,
        smBm: formData.smBmId || undefined,
        smBmEmail: formData.smBmEmail?.trim() || undefined,
        smBmMobile: formData.smBmMobile?.trim() || undefined,
        asmName: formData.asmName?.trim() || undefined,
        asmEmail: formData.asmEmail?.trim() || undefined,
        asmMobile: formData.asmMobile?.trim() || undefined,
        dsaCode: formData.dsaCode?.trim() || formData.codeUse?.trim() || undefined,
        branch: formData.branch?.trim() || undefined,
        remarks: formData.remarks?.trim() || undefined,
      }

      console.log('🔍 DEBUG: Form data received:', formData)
      console.log('🔍 DEBUG: Agent ID from form:', formData.agentId)
      console.log('🔍 DEBUG: Creating/updating lead with data:', JSON.stringify(leadData, null, 2))

      if (selectedLead) {
        // Update existing lead
        const leadId = selectedLead.id || selectedLead._id
        if (!leadId) {
          toast.error('Error', 'Lead ID is missing')
          return
        }
        const response = await api.leads.update(leadId, leadData)
        console.log('🔍 DEBUG: Update response:', response)
        console.log('🔍 DEBUG: Updated lead agent data:', response?.data?.agent || response?.agent)

        // Refresh leads list to get updated data with populated agent
        await fetchLeads()

        // Wait a bit to ensure state updates
        setTimeout(() => {
          console.log('🔍 DEBUG: Leads after refresh:', leads.length)
        }, 500)

        // Also refresh agents list in case it's needed for display
        await fetchAgents()

        // Refresh staff list in case a new SM/BM was created
        await fetchStaff()

        setIsEditModalOpen(false)
        toast.success('Success', 'Lead updated successfully')
      } else {
        // Create new lead
        const createResponse = await api.leads.create(leadData)
        console.log('🔍 DEBUG: Create response:', createResponse)
        console.log('🔍 DEBUG: Created lead agent data:', createResponse?.data?.agent || createResponse?.agent)

        await fetchLeads()

        // Refresh staff list in case a new SM/BM was created
        await fetchStaff()

        setIsCreateModalOpen(false)
        toast.success('Success', 'Lead created successfully')
      }
      setSelectedLead(null)
    } catch (error) {
      console.error('Error saving lead:', error)
      // Only show toast if API error handler hasn't already shown it
      if (!error._toastShown) {
        toast.error('Error', error.message || 'Failed to save lead')
      }
    }
  }

  const handleStatusUpdate = async (leadId, newStatus) => {
    if (!leadId) {
      console.error('Lead ID is missing')
      toast.error('Error', 'Lead ID is missing')
      return
    }
    try {
      await api.leads.updateStatus(leadId, newStatus)
      await fetchLeads()
      toast.success('Success', 'Lead status updated successfully')
    } catch (error) {
      console.error('Error updating lead status:', error)
      toast.error('Error', error.message || 'Failed to update lead status')
    }
  }

  const handleDeleteClick = (lead) => {
    setConfirmDelete({ isOpen: true, lead })
  }

  const handleDeleteConfirm = async () => {
    const lead = confirmDelete.lead
    const leadId = lead.id || lead._id
    if (!leadId) {
      toast.error('Error', 'Lead ID is missing')
      return
    }

    try {
      await api.leads.delete(leadId)
      await fetchLeads()
      toast.success('Success', `Lead "${lead.caseNumber || 'this lead'}" deleted successfully`)
      setConfirmDelete({ isOpen: false, lead: null })
    } catch (error) {
      console.error('Error deleting lead:', error)
      toast.error('Error', error.message || 'Failed to delete lead')
    }
  }

  const getAgentName = (agentIdOrObject) => {
    if (!agentIdOrObject) return 'N/A'

    // If it's already an object with name property
    if (typeof agentIdOrObject === 'object' && agentIdOrObject.name) {
      return agentIdOrObject.name
    }

    // For agents, try to get name from populated lead data
    if (isAgent && leads.length > 0) {
      const lead = leads.find(l => {
        const lAgentId = l.agent?._id || l.agent?.id || l.agentId || l.agent
        const compareId = agentIdOrObject?._id || agentIdOrObject?.id || agentIdOrObject
        return lAgentId?.toString() === compareId?.toString()
      })
      if (lead?.agent?.name) return lead.agent.name
    }

    // If it's an object with _id or id
    if (typeof agentIdOrObject === 'object') {
      const id = agentIdOrObject._id || agentIdOrObject.id
      if (id) {
        const agent = agents.find((a) => a.id === id || a._id === id)
        return agent ? (agent.name || 'N/A') : 'N/A'
      }
    }

    // If it's a string ID
    const agent = agents.find((a) => a.id === agentIdOrObject || a._id === agentIdOrObject)
    return agent ? (agent.name || 'N/A') : 'N/A'
  }

  const getBankName = (bankId) => {
    if (!bankId) return 'N/A'
    const bank = banks.find((b) => b.id === bankId || b._id === bankId)
    return bank ? (bank.name || 'N/A') : 'N/A'
  }

  const getFranchiseName = (franchiseIdOrObject) => {
    if (!franchiseIdOrObject) return 'N/A'

    if (typeof franchiseIdOrObject === 'object' && franchiseIdOrObject.name) {
      return franchiseIdOrObject.name
    }

    if (typeof franchiseIdOrObject === 'object') {
      const id = franchiseIdOrObject._id || franchiseIdOrObject.id
      if (id) {
        const franchise = franchises.find((f) => f.id === id || f._id === id)
        return franchise ? (franchise.name || 'N/A') : 'N/A'
      }
    }

    const franchise = franchises.find((f) => f.id === franchiseIdOrObject || f._id === franchiseIdOrObject)
    return franchise ? (franchise.name || 'N/A') : 'N/A'
  }

  // Determine the associated name for a lead (RelationshipManager via agent OR franchise)
  const getAssociatedName = (lead) => {
    if (!lead) return 'N/A'
    // Prefer populated associated object
    if (lead.associated && typeof lead.associated === 'object' && lead.associated.name) {
      return lead.associated.name
    }
    // If agent is populated, prefer the agent's manager
    if (lead.agent && typeof lead.agent === 'object') {
      const agent = lead.agent
      if (agent.managedByModel === 'RelationshipManager') {
        return agent.managedBy?.name || 'N/A'
      }
      if (agent.managedByModel === 'Franchise') {
        return agent.managedBy?.name || 'N/A'
      }
    }

    // If agent is just an ID, try to resolve from agents list
    const agentId = lead.agentId || (lead.agent && (lead.agent._id || lead.agent.id)) || lead.agent
    if (agentId) {
      const agentObj = agents.find(a => (a._id || a.id) === agentId || (a._id || a.id)?.toString() === agentId?.toString())
      if (agentObj) {
        if (agentObj.managedByModel === 'RelationshipManager') return agentObj.managedBy?.name || 'N/A'
        if (agentObj.managedByModel === 'Franchise') return agentObj.managedBy?.name || 'N/A'
      }
    }

    // Fallback to populated associated name or N/A
    return lead.associated?.name || 'N/A'
  }

  const getStaffName = (staffIdOrObject) => {
    if (!staffIdOrObject) return 'N/A'

    if (typeof staffIdOrObject === 'object' && staffIdOrObject.name) {
      return staffIdOrObject.name
    }

    if (typeof staffIdOrObject === 'object') {
      const id = staffIdOrObject._id || staffIdOrObject.id
      if (id) {
        const staffMember = staff.find((s) => s.id === id || s._id === id)
        if (staffMember) return staffMember.name || 'N/A'
        const bm = bankManagers.find((b) => b.id === id || b._id === id)
        if (bm) return bm.name || 'N/A'
        return 'N/A'
      }
    }

    const staffMember = staff.find((s) => s.id === staffIdOrObject || s._id === staffIdOrObject)
    if (staffMember) return staffMember.name || 'N/A'
    const bm = bankManagers.find((b) => b.id === staffIdOrObject || b._id === staffIdOrObject)
    if (bm) return bm.name || 'N/A'
    return 'N/A'
  }

  const toggleExpand = (leadId, field) => {
    const key = `${leadId}-${field}`
    setExpandedFields(prev => ({
      ...prev,
      [key]: !prev[key]
    }))
  }

  const isExpanded = (leadId, field) => {
    const key = `${leadId}-${field}`
    return expandedFields[key] || false
  }

  const copyToClipboard = async (text, label) => {
    if (!text || text === 'N/A') return
    try {
      await navigator.clipboard.writeText(text)
      toast.success('Copied', `${label} copied to clipboard`)
    } catch (error) {
      console.error('Failed to copy:', error)
      toast.error('Error', 'Failed to copy to clipboard')
    }
  }

  const moveColumn = (index, direction) => {
    const newConfig = [...columnConfig]
    const newIndex = direction === 'up' ? index - 1 : index + 1
    if (newIndex < 0 || newIndex >= newConfig.length) return
    const [removed] = newConfig.splice(index, 1)
    newConfig.splice(newIndex, 0, removed)
    setColumnConfig(newConfig)
  }

  const toggleColumnVisibility = (key) => {
    setColumnConfig(prev => prev.map(col =>
      col.key === key ? { ...col, visible: !col.visible } : col
    ))
  }

  const visibleColumns = columnConfig.filter(col => {
    if (!col.visible) return false

    const key = (col.key || '').toString().toLowerCase()
    const label = (col.label || '').toString().toLowerCase()

    // Hide Associated column for Relationship Managers and Franchise users
    if ((userRole === 'relationship_manager' || userRole === 'franchise') && (key === 'associated' || key === 'franchise' || label.includes('associated') || label.includes('franchise'))) {
      return false
    }

    // Agents have a more restrictive view: hide franchise/associated/agent/sanctioned info
    if (isAgent) {
      if (
        key === 'associated' ||
        key === 'franchise' ||
        key === 'agent' ||
        key === 'sanctionedamount' ||
        label.includes('franchise') ||
        label.includes('associated') ||
        label.includes('agent') ||
        label.includes('sanction')
      ) {
        return false
      }
    }

    return true
  })

  const statusOptions = [
    { value: 'all', label: 'All Status' },
    { value: 'logged', label: 'Logged' },
    { value: 'sanctioned', label: 'Sanctioned' },
    { value: 'partial_disbursed', label: 'Partial Disbursed' },
    { value: 'disbursed', label: 'Disbursed' },
    { value: 'completed', label: 'Completed' },
    { value: 'rejected', label: 'Rejected' },
  ]

  return (
    <div className="flex flex-col h-full w-full max-w-full overflow-x-hidden min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Leads Management</h1>
          <p className="text-sm text-gray-600 mt-1">Manage and track all loan leads</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              const rows = sortedLeads.map((lead) => {
                const base = {
                  'Customer Name': lead.customerName || 'N/A',
                  'Loan Type': lead.loanType?.replace(/_/g, ' ') || 'N/A',
                  'Loan Amount': lead.loanAmount ?? '',
                  'Disbursed Amount': lead.disbursedAmount ?? '',
                  Status: lead.status || 'N/A',
                  Bank: lead.bank?.name || getBankName(lead.bankId || lead.bank) || 'N/A',
                  'SM/BM': lead.smBm?.name || getStaffName(lead.smBmId || lead.smBm) || 'N/A',
                  ASM: lead.asmName || 'N/A',
                  Branch: lead.branch || 'N/A',
                  'Loan Account No': lead.loanAccountNo || 'N/A',
                  'Disbursement Date': lead.disbursementDate ? new Date(lead.disbursementDate).toLocaleDateString() : 'N/A',
                  'Sanctioned Date': lead.sanctionedDate ? new Date(lead.sanctionedDate).toLocaleDateString() : 'N/A',
                  'DSA Code': lead.dsaCode || lead.codeUse || 'N/A',
                  Remarks: lead.remarks || 'N/A',
                  Created: lead.createdAt ? new Date(lead.createdAt).toLocaleDateString() : 'N/A',
                }
                // Do not include Associated column for Relationship Managers or Franchise users
                if (!isAgent && userRole !== 'relationship_manager' && userRole !== 'franchise') {
                  base.Associated = getAssociatedName(lead)
                }
                if (!isAgent) {
                  base.Agent = lead.agent?.name || getAgentName(lead.agentId || lead.agent) || 'N/A'
                }
                return base
              })
              exportToExcel(rows, `leads_export_${Date.now()}`, 'Leads')
              toast.success('Export', `Exported ${rows.length} leads to Excel`)
            }}
            disabled={sortedLeads.length === 0}
            title="Export currently filtered data to Excel"
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FileDown className="w-5 h-5" />
            <span>Export to Excel</span>
          </button>
          <div className="relative">
            <button
              data-column-settings-button
              onClick={() => setShowColumnSettings(!showColumnSettings)}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              <Settings2 className="w-5 h-5" />
              <span>Columns</span>
            </button>
            {showColumnSettings && (
              <div data-column-settings className="absolute right-0 top-full mt-2 bg-white rounded-lg shadow-lg border border-gray-200 p-4 z-50 min-w-[350px] max-h-[600px] overflow-y-auto">
                <div className="mb-3 font-semibold text-gray-900">Column Settings</div>
                <div className="text-xs text-gray-500 mb-3">Use arrows to reorder, checkbox to toggle visibility</div>
                <div className="space-y-1 mb-4">
                  {columnConfig
                    .filter(col => {
                      // Hide associated/franchise column from column settings for Relationship Managers and Franchise users
                      if ((userRole === 'relationship_manager' || userRole === 'franchise')) {
                        const k = (col.key || '').toString().toLowerCase()
                        const lbl = (col.label || '').toString().toLowerCase()
                        if (k === 'associated' || k === 'franchise' || lbl.includes('associated') || lbl.includes('franchise')) {
                          return false
                        }
                      }
                      return true
                    })
                    .map((col, index) => (
                    <div key={col.key} className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded">
                      <div className="flex flex-col gap-0.5">
                        <button
                          onClick={() => moveColumn(index, 'up')}
                          disabled={index === 0}
                          className="text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                          title="Move up"
                        >
                          <ChevronUp className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => moveColumn(index, 'down')}
                          disabled={index === columnConfig.length - 1}
                          className="text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                          title="Move down"
                        >
                          <ChevronDown className="w-3 h-3" />
                        </button>
                      </div>
                      <input
                        type="checkbox"
                        checked={col.visible}
                        onChange={() => toggleColumnVisibility(col.key)}
                        className="w-4 h-4 text-primary-900 rounded"
                      />
                      <span className="flex-1 text-sm text-gray-700">{col.label}</span>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => setShowColumnSettings(false)}
                  className="w-full px-4 py-2 bg-primary-900 text-white rounded-lg hover:bg-primary-800 transition-colors"
                >
                  Done
                </button>
              </div>
            )}
          </div>
          {canCreate && (
            <button
              onClick={handleCreate}
              className="flex items-center gap-2 px-4 py-2 bg-primary-900 text-white rounded-lg hover:bg-primary-800 transition-colors"
            >
              <Plus className="w-5 h-5" />
              <span>Create Lead</span>
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden mb-6">
        <button
          type="button"
          onClick={() => setFiltersOpen((o) => !o)}
          className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition-colors"
        >
          <span className="flex items-center gap-2 font-medium text-gray-900">
            <Filter className="w-5 h-5 text-gray-500" />
            Filter options
            {hasActiveFilters && (
              <span className="text-xs bg-primary-100 text-primary-800 px-2 py-0.5 rounded-full">Active</span>
            )}
          </span>
          {filtersOpen ? <ChevronUp className="w-5 h-5 text-gray-500" /> : <ChevronDown className="w-5 h-5 text-gray-500" />}
        </button>
        {filtersOpen && (
          <div className="border-t border-gray-200 p-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Name, email, phone, account..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm bg-white"
                >
                  {statusOptions.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              {!isAgent && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Associated</label>
                    <select
                      value={franchiseFilter}
                      onChange={(e) => setFranchiseFilter(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm bg-white"
                    >
                      <option value="">All Associated</option>
                      {franchises.map((f) => (
                        <option key={f._id || f.id} value={f._id || f.id}>{f.name || 'Unnamed'}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Agent</label>
                    <select
                      value={agentFilter}
                      onChange={(e) => setAgentFilter(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm bg-white"
                    >
                      <option value="">All agents</option>
                      {agents.map((a) => (
                        <option key={a._id || a.id} value={a._id || a.id}>{a.name || a.email || 'Unnamed'}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Bank</label>
                <select
                  value={bankFilter}
                  onChange={(e) => setBankFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm bg-white"
                >
                  <option value="">All banks</option>
                  {banks.map((b) => (
                    <option key={b._id || b.id} value={b._id || b.id}>{b.name || 'Unnamed'}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">DSA Code</label>
                <input
                  type="text"
                  placeholder="Filter by DSA code..."
                  value={dsaCodeFilter}
                  onChange={(e) => setDsaCodeFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                />
              </div>
            </div>
            {hasActiveFilters && (
              <div className="flex items-center gap-2 pt-1">
                <button type="button" onClick={clearLeadsFilters} className="text-sm text-primary-600 hover:text-primary-800 font-medium">
                  Clear all filters
                </button>
                <span className="text-sm text-gray-500">Showing {filteredLeads.length} of {leads.length} leads</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Table */}
      <div className="flex-1 bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden flex flex-col min-h-0">
        <div className="flex-1 overflow-x-auto overflow-y-auto min-h-0">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {visibleColumns.map((col) => (
                  <th
                    key={col.key}
                    className={`px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${col.sortable ? 'cursor-pointer hover:bg-gray-100' : ''
                      } ${col.key === 'actions' ? 'text-right' : ''}`}
                    onClick={col.sortable ? () => handleSort(col.key) : undefined}
                  >
                    <div className={`flex items-center gap-2 ${col.key === 'actions' ? 'justify-end' : ''}`}>
                      {col.label}
                      {col.sortable && getSortIcon(col.key)}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white">
              {loading ? (
                <tr className="border-b border-gray-200">
                  <td colSpan={visibleColumns.length} className="px-6 py-8 text-center text-gray-500">
                    Loading...
                  </td>
                </tr>
              ) : sortedLeads.length === 0 ? (
                <tr className="border-b border-gray-200">
                  <td colSpan={visibleColumns.length} className="px-6 py-8 text-center text-gray-500">
                    No leads found
                  </td>
                </tr>
              ) : (
                sortedLeads.map((lead) => {
                  const renderCell = (col) => {
                    switch (col.key) {
                      case 'caseNumber':
                        return <div className="text-sm font-medium text-gray-900">{lead.caseNumber || 'N/A'}</div>
                      case 'customerName':
                        return (
                          <div className="relative" data-expandable>
                            <div
                              className="flex items-center gap-2 cursor-pointer hover:text-primary-900"
                              onClick={(e) => {
                                e.stopPropagation()
                                toggleExpand(lead.id || lead._id, 'customer')
                              }}
                            >
                              <span className="text-sm text-gray-900">
                                {lead.customerName || 'N/A'}
                              </span>
                              {isExpanded(lead.id || lead._id, 'customer') ? (
                                <ChevronUp className="w-4 h-4 text-gray-400" />
                              ) : (
                                <ChevronDown className="w-4 h-4 text-gray-400" />
                              )}
                            </div>
                            {isExpanded(lead.id || lead._id, 'customer') && (
                              <div className="absolute left-0 top-full mt-1 z-50 bg-white rounded-lg shadow-lg border border-gray-200 p-3 min-w-[200px]" onClick={(e) => e.stopPropagation()}>
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-xs text-gray-600">Name:</span>
                                    <div className="flex items-center gap-1">
                                      <span className="text-xs text-gray-900">{lead.customerName || 'N/A'}</span>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          copyToClipboard(lead.customerName || '', 'Name')
                                        }}
                                        className="p-1 hover:bg-gray-100 rounded"
                                        title="Copy name"
                                      >
                                        <Copy className="w-3 h-3 text-gray-500" />
                                      </button>
                                    </div>
                                  </div>
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-xs text-gray-600">Email:</span>
                                    <div className="flex items-center gap-1">
                                      <span className="text-xs text-gray-900">{lead.applicantEmail || lead.email || 'N/A'}</span>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          copyToClipboard(lead.applicantEmail || lead.email || '', 'Email')
                                        }}
                                        className="p-1 hover:bg-gray-100 rounded"
                                        title="Copy email"
                                      >
                                        <Copy className="w-3 h-3 text-gray-500" />
                                      </button>
                                    </div>
                                  </div>
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-xs text-gray-600">Mobile:</span>
                                    <div className="flex items-center gap-1">
                                      <span className="text-xs text-gray-900">{lead.applicantMobile || lead.phone || lead.mobile || 'N/A'}</span>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          copyToClipboard(lead.applicantMobile || lead.phone || lead.mobile || '', 'Mobile')
                                        }}
                                        className="p-1 hover:bg-gray-100 rounded"
                                        title="Copy mobile"
                                      >
                                        <Copy className="w-3 h-3 text-gray-500" />
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      case 'loanType':
                        return <div className="text-sm text-gray-900">{lead.loanType?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'N/A'}</div>
                      case 'loanAmount':
                        return <div className="text-sm font-medium text-gray-900">₹{(lead.loanAmount || 0).toLocaleString()}</div>
                      // 'sanctionedAmount' column removed
                      case 'disbursedAmount':
                        return <div className="text-sm text-gray-900">₹{(lead.disbursedAmount || 0).toLocaleString()}</div>
                      case 'status':
                        return <StatusBadge status={lead.status || 'logged'} />
                      case 'agent':
                        return (
                          <div className="text-sm text-gray-900">
                            {(() => {
                              if (lead.agent && typeof lead.agent === 'object' && lead.agent.name) {
                                return lead.agent.name
                              }
                              const agentId = lead.agentId || (lead.agent && (lead.agent._id || lead.agent.id)) || lead.agent
                              return getAgentName(agentId)
                            })()}
                          </div>
                        )
                      case 'associated':
                        return <div className="text-sm text-gray-900">{getAssociatedName(lead)}</div>
                      case 'bank':
                        return (
                          <div className="relative" data-expandable>
                            <div
                              className="flex items-center gap-2 cursor-pointer hover:text-primary-900"
                              onClick={(e) => {
                                e.stopPropagation()
                                toggleExpand(lead.id || lead._id, 'bank')
                              }}
                            >
                              <span className="text-sm text-gray-900">
                                {lead.bank?.name || getBankName(lead.bankId || lead.bank) || 'N/A'}
                              </span>
                              {isExpanded(lead.id || lead._id, 'bank') ? (
                                <ChevronUp className="w-4 h-4 text-gray-400" />
                              ) : (
                                <ChevronDown className="w-4 h-4 text-gray-400" />
                              )}
                            </div>
                            {isExpanded(lead.id || lead._id, 'bank') && (
                              <div className="absolute left-0 top-full mt-1 z-50 bg-white rounded-lg shadow-lg border border-gray-200 p-3 min-w-[200px]" onClick={(e) => e.stopPropagation()}>
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-xs text-gray-600">Name:</span>
                                    <div className="flex items-center gap-1">
                                      <span className="text-xs text-gray-900">{lead.bank?.name || getBankName(lead.bankId || lead.bank) || 'N/A'}</span>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          copyToClipboard(lead.bank?.name || getBankName(lead.bankId || lead.bank) || '', 'Name')
                                        }}
                                        className="p-1 hover:bg-gray-100 rounded"
                                        title="Copy name"
                                      >
                                        <Copy className="w-3 h-3 text-gray-500" />
                                      </button>
                                    </div>
                                  </div>
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-xs text-gray-600">Email:</span>
                                    <div className="flex items-center gap-1">
                                      <span className="text-xs text-gray-900">{lead.bank?.contactEmail || 'N/A'}</span>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          copyToClipboard(lead.bank?.contactEmail || '', 'Email')
                                        }}
                                        className="p-1 hover:bg-gray-100 rounded"
                                        title="Copy email"
                                      >
                                        <Copy className="w-3 h-3 text-gray-500" />
                                      </button>
                                    </div>
                                  </div>
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-xs text-gray-600">Contact:</span>
                                    <div className="flex items-center gap-1">
                                      <span className="text-xs text-gray-900">{lead.bank?.contactMobile || 'N/A'}</span>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          copyToClipboard(lead.bank?.contactMobile || '', 'Contact')
                                        }}
                                        className="p-1 hover:bg-gray-100 rounded"
                                        title="Copy contact"
                                      >
                                        <Copy className="w-3 h-3 text-gray-500" />
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      case 'smBm':
                        return (
                          <div className="relative" data-expandable>
                            <div
                              className="flex items-center gap-2 cursor-pointer hover:text-primary-900"
                              onClick={(e) => {
                                e.stopPropagation()
                                toggleExpand(lead.id || lead._id, 'smbm')
                              }}
                            >
                              <span className="text-sm text-gray-900">
                                {(() => {
                                  if (lead.smBm && typeof lead.smBm === 'object' && lead.smBm.name) {
                                    return lead.smBm.name
                                  }
                                  const smBmId = lead.smBmId || (lead.smBm && (lead.smBm._id || lead.smBm.id)) || lead.smBm
                                  return getStaffName(smBmId)
                                })()}
                              </span>
                              {isExpanded(lead.id || lead._id, 'smbm') ? (
                                <ChevronUp className="w-4 h-4 text-gray-400" />
                              ) : (
                                <ChevronDown className="w-4 h-4 text-gray-400" />
                              )}
                            </div>
                            {isExpanded(lead.id || lead._id, 'smbm') && (
                              <div className="absolute left-0 top-full mt-1 z-50 bg-white rounded-lg shadow-lg border border-gray-200 p-3 min-w-[200px]" onClick={(e) => e.stopPropagation()}>
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-xs text-gray-600">Name:</span>
                                    <div className="flex items-center gap-1">
                                      <span className="text-xs text-gray-900">
                                        {(() => {
                                          if (lead.smBm && typeof lead.smBm === 'object' && lead.smBm.name) {
                                            return lead.smBm.name
                                          }
                                          const smBmId = lead.smBmId || (lead.smBm && (lead.smBm._id || lead.smBm.id)) || lead.smBm
                                          return getStaffName(smBmId)
                                        })()}
                                      </span>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          const name = (() => {
                                            if (lead.smBm && typeof lead.smBm === 'object' && lead.smBm.name) {
                                              return lead.smBm.name
                                            }
                                            const smBmId = lead.smBmId || (lead.smBm && (lead.smBm._id || lead.smBm.id)) || lead.smBm
                                            return getStaffName(smBmId)
                                          })()
                                          copyToClipboard(name, 'Name')
                                        }}
                                        className="p-1 hover:bg-gray-100 rounded"
                                        title="Copy name"
                                      >
                                        <Copy className="w-3 h-3 text-gray-500" />
                                      </button>
                                    </div>
                                  </div>
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-xs text-gray-600">Email:</span>
                                    <div className="flex items-center gap-1">
                                      <span className="text-xs text-gray-900">{lead.smBmEmail || (lead.smBm?.email) || 'N/A'}</span>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          copyToClipboard(lead.smBmEmail || lead.smBm?.email || '', 'Email')
                                        }}
                                        className="p-1 hover:bg-gray-100 rounded"
                                        title="Copy email"
                                      >
                                        <Copy className="w-3 h-3 text-gray-500" />
                                      </button>
                                    </div>
                                  </div>
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-xs text-gray-600">Contact:</span>
                                    <div className="flex items-center gap-1">
                                      <span className="text-xs text-gray-900">{lead.smBmMobile || (lead.smBm?.mobile) || 'N/A'}</span>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          copyToClipboard(lead.smBmMobile || lead.smBm?.mobile || '', 'Contact')
                                        }}
                                        className="p-1 hover:bg-gray-100 rounded"
                                        title="Copy contact"
                                      >
                                        <Copy className="w-3 h-3 text-gray-500" />
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      case 'asm':
                        return (
                          <div className="relative" data-expandable>
                            <div
                              className="flex items-center gap-2 cursor-pointer hover:text-primary-900"
                              onClick={(e) => {
                                e.stopPropagation()
                                toggleExpand(lead.id || lead._id, 'asm')
                              }}
                            >
                              <span className="text-sm text-gray-900">
                                {lead.asmName || 'N/A'}
                              </span>
                              {isExpanded(lead.id || lead._id, 'asm') ? (
                                <ChevronUp className="w-4 h-4 text-gray-400" />
                              ) : (
                                <ChevronDown className="w-4 h-4 text-gray-400" />
                              )}
                            </div>
                            {isExpanded(lead.id || lead._id, 'asm') && (
                              <div className="absolute left-0 top-full mt-1 z-50 bg-white rounded-lg shadow-lg border border-gray-200 p-3 min-w-[200px]" onClick={(e) => e.stopPropagation()}>
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-xs text-gray-600">Name:</span>
                                    <div className="flex items-center gap-1">
                                      <span className="text-xs text-gray-900">{lead.asmName || 'N/A'}</span>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          copyToClipboard(lead.asmName || '', 'Name')
                                        }}
                                        className="p-1 hover:bg-gray-100 rounded"
                                        title="Copy name"
                                      >
                                        <Copy className="w-3 h-3 text-gray-500" />
                                      </button>
                                    </div>
                                  </div>
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-xs text-gray-600">Email:</span>
                                    <div className="flex items-center gap-1">
                                      <span className="text-xs text-gray-900">{lead.asmEmail || 'N/A'}</span>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          copyToClipboard(lead.asmEmail || '', 'Email')
                                        }}
                                        className="p-1 hover:bg-gray-100 rounded"
                                        title="Copy email"
                                      >
                                        <Copy className="w-3 h-3 text-gray-500" />
                                      </button>
                                    </div>
                                  </div>
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-xs text-gray-600">Contact:</span>
                                    <div className="flex items-center gap-1">
                                      <span className="text-xs text-gray-900">{lead.asmMobile || 'N/A'}</span>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          copyToClipboard(lead.asmMobile || '', 'Contact')
                                        }}
                                        className="p-1 hover:bg-gray-100 rounded"
                                        title="Copy contact"
                                      >
                                        <Copy className="w-3 h-3 text-gray-500" />
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      case 'branch':
                        return <div className="text-sm text-gray-900">{lead.branch || 'N/A'}</div>
                      case 'loanAccountNo':
                        return <div className="text-sm text-gray-900">{lead.loanAccountNo || 'N/A'}</div>
                      case 'disbursementDate':
                        return <div className="text-sm text-gray-900">{lead.disbursementDate ? new Date(lead.disbursementDate).toLocaleDateString() : 'N/A'}</div>
                      case 'sanctionedDate':
                        return <div className="text-sm text-gray-900">{lead.sanctionedDate ? new Date(lead.sanctionedDate).toLocaleDateString() : 'N/A'}</div>
                      case 'codeUse':
                      case 'dsaCode':
                        return <div className="text-sm text-gray-900">{lead.dsaCode || lead.codeUse || 'N/A'}</div>
                      case 'remarks':
                        return <div className="text-sm text-gray-900 max-w-xs truncate" title={lead.remarks || 'N/A'}>{lead.remarks || 'N/A'}</div>
                      case 'createdAt':
                        return <div className="text-sm text-gray-900">{lead.createdAt ? new Date(lead.createdAt).toLocaleDateString() : lead.created_at ? new Date(lead.created_at).toLocaleDateString() : 'N/A'}</div>
                      case 'actions':
                        return (
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleView(lead)}
                              className="text-primary-900 hover:text-primary-800 p-1"
                              title="View Details"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            {canViewHistory && (
                              <button
                                onClick={() => handleViewHistory(lead)}
                                className="text-blue-600 hover:text-blue-800 p-1"
                                title="View History"
                              >
                                <History className="w-4 h-4" />
                              </button>
                            )}
                            {canEdit && (
                              <>
                                <button
                                  onClick={() => handleEdit(lead)}
                                  className="text-gray-600 hover:text-gray-900 p-1"
                                  title="Edit"
                                >
                                  <Edit className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDeleteClick(lead)}
                                  className="text-red-600 hover:text-red-900 p-1"
                                  title="Delete"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                                <select
                                  value={lead.status || 'logged'}
                                  onChange={(e) => handleStatusUpdate(lead.id || lead._id, e.target.value)}
                                  className="text-xs border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary-500"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <option value="logged">Logged</option>
                                  <option value="sanctioned">Sanctioned</option>
                                  <option value="partial_disbursed">Partial Disbursed</option>
                                  <option value="disbursed">Disbursed</option>
                                  <option value="completed">Completed</option>
                                  <option value="rejected">Rejected</option>
                                </select>
                              </>
                            )}
                          </div>
                        )
                      default:
                        return <div className="text-sm text-gray-900">N/A</div>
                    }
                  }

                  return (
                    <tr key={lead.id || lead._id} className="hover:bg-gray-50 border-b border-gray-200">
                      {visibleColumns.map((col) => (
                        <td
                          key={col.key}
                          className={`px-6 py-4 whitespace-nowrap ${col.key === 'actions' ? 'text-right' : ''}`}
                        >
                          {renderCell(col)}
                        </td>
                      ))}
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
        {sortedLeads.length > 0 && (
          <div className="px-6 py-3 bg-gray-50 border-t border-gray-200">
            <p className="text-sm text-gray-600">
              Showing <span className="font-medium">{sortedLeads.length}</span> of{' '}
              <span className="font-medium">{sortedLeads.length}</span> leads
            </p>
          </div>
        )}
      </div>

      {/* Create Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Create New Lead"
      >
        <LeadForm onSave={handleSave} onClose={() => setIsCreateModalOpen(false)} />
      </Modal>

      {/* Edit Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false)
          setSelectedLead(null)
        }}
        title="Edit Lead"
      >
        <LeadForm lead={selectedLead} onSave={handleSave} onClose={() => setIsEditModalOpen(false)} />
      </Modal>

      {/* Detail Modal */}
      <Modal
        isOpen={isDetailModalOpen}
        onClose={() => {
          setIsDetailModalOpen(false)
          setSelectedLead(null)
        }}
        title="Lead Details"
        size="md"
      >
        {selectedLead && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-500">Email</label>
                <p className="mt-1 text-sm text-gray-900">{selectedLead.applicantEmail || selectedLead.email || 'N/A'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Mobile</label>
                <p className="mt-1 text-sm text-gray-900">{selectedLead.applicantMobile || selectedLead.phone || selectedLead.mobile || 'N/A'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Loan Type</label>
                <p className="mt-1 text-sm text-gray-900">{selectedLead.loanType || 'N/A'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Loan Amount</label>
                <p className="mt-1 text-sm text-gray-900">₹{(selectedLead.loanAmount || 0).toLocaleString()}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Status</label>
                <div className="mt-1">
                  <StatusBadge status={selectedLead.status || 'logged'} />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Agent</label>
                <p className="mt-1 text-sm text-gray-900">
                  {(() => {
                    // Check if agent is populated object
                    if (selectedLead.agent && typeof selectedLead.agent === 'object' && selectedLead.agent.name) {
                      return selectedLead.agent.name
                    }
                    // Check agentId or agent ID
                    const agentId = selectedLead.agentId || (selectedLead.agent && (selectedLead.agent._id || selectedLead.agent.id)) || selectedLead.agent
                    return getAgentName(agentId)
                  })()}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Associated</label>
                <p className="mt-1 text-sm text-gray-900">{getAssociatedName(selectedLead)}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Bank</label>
                <p className="mt-1 text-sm text-gray-900">
                  {selectedLead.bank?.name || getBankName(selectedLead.bankId || selectedLead.bank) || 'N/A'}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Customer Name</label>
                <p className="mt-1 text-sm text-gray-900">{selectedLead.customerName || 'N/A'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Disbursement Date</label>
                <p className="mt-1 text-sm text-gray-900">
                  {selectedLead.disbursementDate ? new Date(selectedLead.disbursementDate).toLocaleDateString() : 'N/A'}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Loan Account No</label>
                <p className="mt-1 text-sm text-gray-900">{selectedLead.loanAccountNo || 'N/A'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">SM/BM Name</label>
                <p className="mt-1 text-sm text-gray-900">
                  {(() => {
                    if (selectedLead.smBm && typeof selectedLead.smBm === 'object' && selectedLead.smBm.name) {
                      return selectedLead.smBm.name
                    }
                    const smBmId = selectedLead.smBmId || (selectedLead.smBm && (selectedLead.smBm._id || selectedLead.smBm.id)) || selectedLead.smBm
                    return getStaffName(smBmId)
                  })()}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">SM/BM Email</label>
                <p className="mt-1 text-sm text-gray-900">{selectedLead.smBmEmail || selectedLead.smBm?.email || 'N/A'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">SM/BM Mobile</label>
                <p className="mt-1 text-sm text-gray-900">{selectedLead.smBmMobile || selectedLead.smBm?.mobile || 'N/A'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">ASM Name</label>
                <p className="mt-1 text-sm text-gray-900">{selectedLead.asmName || 'N/A'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">ASM Email</label>
                <p className="mt-1 text-sm text-gray-900">{selectedLead.asmEmail || 'N/A'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">ASM Mobile</label>
                <p className="mt-1 text-sm text-gray-900">{selectedLead.asmMobile || 'N/A'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">DSA Code</label>
                <p className="mt-1 text-sm text-gray-900">{selectedLead.dsaCode || selectedLead.codeUse || 'N/A'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Branch</label>
                <p className="mt-1 text-sm text-gray-900">{selectedLead.branch || 'N/A'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Created Date</label>
                <p className="mt-1 text-sm text-gray-900">
                  {selectedLead.createdAt ? new Date(selectedLead.createdAt).toLocaleDateString() : selectedLead.created_at ? new Date(selectedLead.created_at).toLocaleDateString() : 'N/A'}
                </p>
              </div>
            </div>
            <div className="pt-4 border-t border-gray-200 flex gap-2">
              {canViewHistory && (
                <button
                  onClick={() => {
                    setIsDetailModalOpen(false)
                    handleViewHistory(selectedLead)
                  }}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  <History className="w-4 h-4" />
                  View History
                </button>
              )}
              {canEdit && (
                <button
                  onClick={() => {
                    setIsDetailModalOpen(false)
                    handleEdit(selectedLead)
                  }}
                  className="flex-1 px-4 py-2 bg-primary-900 text-white rounded-lg hover:bg-primary-800 transition-colors"
                >
                  Edit Lead
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={confirmDelete.isOpen}
        onClose={() => setConfirmDelete({ isOpen: false, lead: null })}
        onConfirm={handleDeleteConfirm}
        title="Delete Lead"
        message={`Are you sure you want to delete lead "${confirmDelete.lead?.caseNumber || 'this lead'}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        type="danger"
      />

      {/* History Sidebar */}
      {isHistoryModalOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-gray-500 bg-opacity-50 z-[10000]"
            onClick={() => {
              setIsHistoryModalOpen(false)
              setSelectedLead(null)
              setLeadHistory([])
              setExpandedHistoryItems(new Set())
            }}
          ></div>

          {/* Sidebar */}
          <div className="fixed right-0 top-16 h-[calc(100vh-4rem)] w-[450px] bg-white shadow-2xl z-[10001] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 flex-shrink-0">
              <h3 className="text-lg font-semibold text-gray-900">
                History - {selectedLead?.caseNumber || 'Lead'}
              </h3>
              <button
                onClick={() => {
                  setIsHistoryModalOpen(false)
                  setSelectedLead(null)
                  setLeadHistory([])
                  setExpandedHistoryItems(new Set())
                }}
                className="text-gray-400 hover:text-gray-500 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-3 py-2">
              {historyLoading ? (
                <div className="py-8 text-center text-gray-500">Loading history...</div>
              ) : leadHistory.length === 0 ? (
                <div className="py-8 text-center text-gray-500">No history available for this lead.</div>
              ) : (
                <div className="space-y-2">
                  {leadHistory.map((historyItem, index) => {
                    const isExpanded = isHistoryItemExpanded(index)
                    const changeCount = historyItem.changes?.length || 0

                    return (
                      <div
                        key={historyItem._id || historyItem.id || index}
                        className="border border-gray-200 rounded-lg bg-white overflow-hidden"
                      >
                        {/* Collapsed Header - Always Visible */}
                        <div
                          className="p-2 cursor-pointer hover:bg-gray-50 transition-colors"
                          onClick={() => toggleHistoryItem(index)}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs font-semibold text-gray-900 capitalize">
                                  {historyItem.action?.replace(/_/g, ' ')}
                                </span>
                                {changeCount > 0 && (
                                  <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
                                    {changeCount} {changeCount === 1 ? 'change' : 'changes'}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 text-xs text-gray-500">
                                {historyItem.changedBy && (
                                  <span>
                                    by <span className="font-medium">{historyItem.changedBy.name || historyItem.changedBy.email || 'Unknown'}</span>
                                  </span>
                                )}
                                <span className="text-gray-400">
                                  {historyItem.createdAt
                                    ? new Date(historyItem.createdAt).toLocaleString()
                                    : historyItem.created_at
                                      ? new Date(historyItem.created_at).toLocaleString()
                                      : 'N/A'}
                                </span>
                              </div>
                            </div>
                            <ChevronDown
                              className={`w-4 h-4 text-gray-400 transition-transform flex-shrink-0 ${isExpanded ? 'transform rotate-180' : ''
                                }`}
                            />
                          </div>
                        </div>

                        {/* Expanded Content */}
                        {isExpanded && (
                          <div className="px-2 pb-2 border-t border-gray-100">
                            {historyItem.changes && historyItem.changes.length > 0 ? (
                              <div className="mt-2 space-y-1.5">
                                {historyItem.changes.map((change, changeIndex) => (
                                  <div key={changeIndex} className="bg-gray-50 rounded p-2 border border-gray-100">
                                    <div className="text-xs font-semibold text-gray-700 mb-1">
                                      {formatFieldName(change.field)}
                                    </div>
                                    <div className="flex items-center gap-2 text-xs">
                                      <span className="text-red-600 line-through flex-1 truncate">
                                        {formatFieldValue(change.oldValue, change.field)}
                                      </span>
                                      <span className="text-gray-400">→</span>
                                      <span className="text-green-600 font-semibold flex-1 truncate">
                                        {formatFieldValue(change.newValue, change.field)}
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="text-xs text-gray-500 italic text-center py-2">
                                {historyItem.action === 'created' ? 'Lead was created' : 'No field changes recorded'}
                              </div>
                            )}

                            {historyItem.remarks && (
                              <div className="mt-2 pt-2 border-t border-gray-200">
                                <div className="text-xs text-gray-600 bg-gray-50 rounded p-2">
                                  <span className="font-semibold text-gray-700">Remarks: </span>
                                  {historyItem.remarks}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default Leads
