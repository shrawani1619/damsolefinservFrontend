import { useState, useEffect, useCallback } from 'react'
import {
  Users,
  FileText,
  CheckCircle,
  AlertCircle,
  FileCheck,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { PieChart, Pie, Cell, ResponsiveContainer, Sector } from 'recharts'
import IndianRupeeIcon from '../components/IndianRupeeIcon'
import StatCard from '../components/StatCard'
import api from '../services/api'
import { authService } from '../services/auth.service'
import { toast } from '../services/toastService'
import AccountantOverview from './AccountantOverview'

const Dashboard = () => {
  const navigate = useNavigate()
  const [stats, setStats] = useState({
    totalLeads: 0,
    totalAgents: 0,
    totalInvoices: 0,
    totalRevenue: 0,
    totalLoanAmount: 0,
  })
  const [relatedLists, setRelatedLists] = useState({
    recentLeads: [],
    recentAgents: [],
    recentFranchises: [],
    recentInvoices: [],
    recentPayouts: [],
  })
  const [agentData, setAgentData] = useState({
    completedLeadsWithoutInvoices: [],
    pendingInvoicesForAction: [],
    escalatedInvoicesList: [],
  })
  const [loanDistribution, setLoanDistribution] = useState([])
  const [leadConversionFunnel, setLeadConversionFunnel] = useState([])
  const [selectedLoanSegmentIndex, setSelectedLoanSegmentIndex] = useState(null)
  const [funnelFilter, setFunnelFilter] = useState('monthly') // 'weekly', 'monthly', 'yearly'

  const [loading, setLoading] = useState(true)

  const userRole = authService.getUser()?.role || 'super_admin'

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true)
      const params = {
        funnelPeriod: funnelFilter, // Add funnel filter parameter
      }

      let dashboardData
      try {
        switch (userRole) {
          case 'agent':
            dashboardData = await api.dashboard.getAgentDashboard(params)
            break
          case 'franchise':
            dashboardData = await api.dashboard.getFranchiseOwnerDashboard(params)
            break
          case 'relationship_manager':
            dashboardData = await api.dashboard.getStaffDashboard(params)
            break
          case 'accounts_manager':
            dashboardData = await api.dashboard.getAccountsDashboard(params)
            break
          case 'regional_manager':
          case 'super_admin':
          default:
            dashboardData = await api.dashboard.getAdminDashboard(params)
            break
        }
      } catch (roleError) {
        if (userRole === 'relationship_manager' || userRole === 'accounts_manager' || userRole === 'agent' || userRole === 'franchise') {
          throw roleError
        }
        console.warn('Role-specific dashboard failed, trying admin:', roleError)
        dashboardData = await api.dashboard.getAdminDashboard(params)
      }

      // Handle different response formats
      const data = dashboardData.data || dashboardData || {}

      console.log('🔍 DEBUG: Dashboard data received:', data)

      if (userRole === 'agent') {
        setStats({
          totalLeads: data.leads?.total || 0,
          totalAgents: 0,
          totalInvoices: (data.invoices?.pending || 0) + (data.invoices?.approved || 0) + (data.invoices?.escalated || 0),
          totalRevenue: data.totalCommission || 0,
          leads: data.leads || {},
          invoices: data.invoices || {},
          payouts: data.payouts || {},
        })
      } else {
        setStats({
          totalLeads: data.totalLeads || data.leads?.total || 0,
          totalAgents: data.totalAgents || data.agents?.total || 0,
          totalInvoices: data.totalInvoices || data.invoices?.total || 0,
          totalRevenue: data.totalRevenue || data.revenue || data.totalCommission || 0,
          totalLoanAmount: data.totalLoanAmount || 0,
        })
      }

      console.log('🔍 DEBUG: Dashboard stats set:', {
        totalLeads: data.totalLeads || data.leads?.total || 0,
        totalAgents: data.totalAgents || data.agents?.total || 0,
        totalInvoices: data.totalInvoices || data.invoices?.total || 0,
        totalRevenue: data.totalRevenue || data.revenue || data.totalCommission || 0,
      })

      // Set agent-specific data
      if (userRole === 'agent') {
        setAgentData({
          completedLeadsWithoutInvoices: Array.isArray(data.completedLeadsWithoutInvoices) ? data.completedLeadsWithoutInvoices : [],
          pendingInvoicesForAction: Array.isArray(data.pendingInvoicesForAction) ? data.pendingInvoicesForAction : [],
          escalatedInvoicesList: Array.isArray(data.escalatedInvoicesList) ? data.escalatedInvoicesList : [],
        })
        setRelatedLists((prev) => ({ ...prev, recentLeads: [] }))
      }

      // Set related lists (for admin, regional manager, and franchise owner dashboards)
      if (userRole === 'super_admin' || userRole === 'regional_manager' || userRole === 'relationship_manager' || userRole === 'franchise') {
        setRelatedLists({
          recentLeads: Array.isArray(data.recentLeads) ? data.recentLeads : [],
          recentAgents: Array.isArray(data.recentAgents) ? data.recentAgents : [],
          recentFranchises: Array.isArray(data.recentFranchises) ? data.recentFranchises : [],
          recentInvoices: Array.isArray(data.recentInvoices) ? data.recentInvoices : [],
          recentPayouts: Array.isArray(data.recentPayouts) ? data.recentPayouts : [],
          relationshipManagers: Array.isArray(data.relationshipManagers) ? data.relationshipManagers : [],
        })
      }
      if (userRole === 'super_admin' || userRole === 'regional_manager' || userRole === 'relationship_manager' || userRole === 'franchise') {
        setLoanDistribution(Array.isArray(data.loanDistribution) ? data.loanDistribution : [])
        setLeadConversionFunnel(Array.isArray(data.leadConversionFunnel) ? data.leadConversionFunnel : [])
        setSelectedLoanSegmentIndex(null)
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
      // Fallback to empty stats on error - app will still render
      setStats({
        totalLeads: 0,
        totalAgents: 0,
        totalInvoices: 0,
        totalRevenue: 0,
      })
    } finally {
      setLoading(false)
    }
  }, [userRole, funnelFilter])

  useEffect(() => {
    fetchDashboardData()
  }, [fetchDashboardData])

  const handleRaiseInvoice = async (leadId) => {
    try {
      // Navigate to lead details page
      // Invoices are typically auto-generated when leads are completed
      // If invoice is missing, admin can generate it from the lead details page
      navigate(`/leads/${leadId}`)
      toast.info('Info', 'Viewing lead details. Contact admin if invoice needs to be generated.')
    } catch (error) {
      console.error('Error navigating to lead:', error)
      toast.error('Error', 'Failed to open lead details')
    }
  }

  const handleAcceptInvoice = async (invoiceId) => {
    try {
      await api.invoices.accept(invoiceId)
      toast.success('Success', 'Invoice accepted successfully')
      fetchDashboardData()
    } catch (error) {
      console.error('Error accepting invoice:', error)
      toast.error('Error', error.message || 'Failed to accept invoice')
    }
  }

  const handleEscalateInvoice = async (invoiceId) => {
    const reason = prompt('Please provide escalation reason:')
    if (!reason) return

    const remarks = prompt('Additional remarks (optional):') || ''

    try {
      await api.invoices.escalate(invoiceId, { reason, remarks })
      toast.success('Success', 'Invoice escalated successfully')
      fetchDashboardData()
    } catch (error) {
      console.error('Error escalating invoice:', error)
      toast.error('Error', error.message || 'Failed to escalate invoice')
    }
  }

  const { totalLeads, totalAgents, totalRevenue, totalLoanAmount } = stats
  const isAgent = userRole === 'agent'
  const isAccountant = userRole === 'accounts_manager'

  // Render Accountant-specific dashboard
  if (isAccountant) {
    return <AccountantOverview />
  }

  return (
    <div className="space-y-6 w-full max-w-full overflow-x-hidden">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-2 text-sm text-gray-600">
        <span>Dashboard</span>
        <span>/</span>
        <span className="text-gray-900 font-medium">Home</span>
        {isAgent && <><span>/</span><span className="text-gray-900 font-medium">Agent Portal</span></>}
        {!isAgent && <><span>/</span><span className="text-gray-900 font-medium">Analytics</span></>}
      </div>

      {/* Agent Dashboard */}
      {isAgent ? (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard
              title="Total Leads"
              value={stats.totalLeads || 0}
              icon={Users}
              color="blue"
            />
            <StatCard
              title="Pending"
              value={stats.leads?.pending || 0}
              icon={FileCheck}
              color="orange"
            />
            <StatCard
              title="Pending Invoices"
              value={stats.invoices?.pending || 0}
              icon={FileText}
              color="purple"
            />
            <StatCard
              title="Total Commission"
              value={`₹${((stats.totalRevenue || 0) / 1000).toFixed(1)}K`}
              icon={IndianRupeeIcon}
              color="green"
            />
          </div>

          {/* Raise Payout Invoices Section */}
          {agentData.completedLeadsWithoutInvoices.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900">Raise Payout Invoices</h2>
                <span className="text-sm text-gray-600">{agentData.completedLeadsWithoutInvoices.length} completed leads without invoices</span>
              </div>
              <div className="space-y-3">
                {agentData.completedLeadsWithoutInvoices.slice(0, 5).map((lead) => (
                  <div key={lead._id || lead.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">{lead.loanAccountNo || 'N/A'}</p>
                      <p className="text-xs text-gray-600">
                        {lead.loanAccountNo || 'N/A'} • {lead.bank?.name || 'N/A'} • ₹{(lead.loanAmount || 0).toLocaleString()}
                      </p>
                    </div>
                    <button
                      onClick={() => handleRaiseInvoice(lead._id || lead.id)}
                      className="px-4 py-2 bg-primary-900 text-white rounded-lg hover:bg-primary-800 transition-colors text-sm"
                    >
                      Request Invoice
                    </button>
                  </div>
                ))}
                {agentData.completedLeadsWithoutInvoices.length > 5 && (
                  <button
                    onClick={() => navigate('/leads?status=completed&hasInvoice=false')}
                    className="w-full text-sm text-primary-900 hover:text-primary-800 font-medium"
                  >
                    View All ({agentData.completedLeadsWithoutInvoices.length} leads)
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Accept or Escalate Invoices Section */}
          {agentData.pendingInvoicesForAction.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900">Pending Invoices - Action Required</h2>
                <span className="text-sm text-gray-600">{agentData.pendingInvoicesForAction.length} pending</span>
              </div>
              <div className="space-y-3">
                {agentData.pendingInvoicesForAction.slice(0, 5).map((invoice) => (
                  <div key={invoice._id || invoice.id} className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">{invoice.invoiceNumber || 'N/A'}</p>
                      <p className="text-xs text-gray-600">
                        {invoice.lead?.loanAccountNo || 'N/A'} • ₹{(invoice.commissionAmount || invoice.netPayable || 0).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleAcceptInvoice(invoice._id || invoice.id)}
                        className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
                      >
                        <CheckCircle className="w-4 h-4" />
                        Accept
                      </button>
                      <button
                        onClick={() => handleEscalateInvoice(invoice._id || invoice.id)}
                        className="flex items-center gap-1 px-3 py-1.5 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors text-sm"
                      >
                        <AlertCircle className="w-4 h-4" />
                        Escalate
                      </button>
                    </div>
                  </div>
                ))}
                {agentData.pendingInvoicesForAction.length > 5 && (
                  <button
                    onClick={() => navigate('/invoices?status=pending')}
                    className="w-full text-sm text-primary-900 hover:text-primary-800 font-medium"
                  >
                    View All ({agentData.pendingInvoicesForAction.length} invoices)
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Escalated Invoices Section */}
          {agentData.escalatedInvoicesList.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900">Escalated Invoices</h2>
                <span className="text-sm text-gray-600">{agentData.escalatedInvoicesList.length} escalated</span>
              </div>
              <div className="space-y-3">
                {agentData.escalatedInvoicesList.slice(0, 5).map((invoice) => (
                  <div key={invoice._id || invoice.id} className="flex items-center justify-between p-3 bg-orange-50 rounded-lg border border-orange-200">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">{invoice.invoiceNumber || 'N/A'}</p>
                      <p className="text-xs text-gray-600">
                        {invoice.lead?.loanAccountNo || 'N/A'} • ₹{(invoice.commissionAmount || invoice.netPayable || 0).toLocaleString()}
                      </p>
                      {invoice.escalationReason && (
                        <p className="text-xs text-orange-700 mt-1">Reason: {invoice.escalationReason}</p>
                      )}
                    </div>
                    <span className="px-3 py-1 bg-orange-200 text-orange-800 rounded-full text-xs font-medium">
                      Under Review
                    </span>
                  </div>
                ))}
                {agentData.escalatedInvoicesList.length > 5 && (
                  <button
                    onClick={() => navigate('/invoices?status=escalated')}
                    className="w-full text-sm text-primary-900 hover:text-primary-800 font-medium"
                  >
                    View All ({agentData.escalatedInvoicesList.length} invoices)
                  </button>
                )}
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          {/* Summary Cards - Admin/Relationship Manager */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard
              title="Total Leads"
              value={totalLeads}
              icon={Users}
              color="blue"
            />
            <StatCard
              title="Active Agents"
              value={totalAgents}
              icon={Users}
              color="green"
            />
            <StatCard
              title="Total Amount"
              value={`₹${(totalLoanAmount / 100000).toFixed(1)}L`}
              icon={IndianRupeeIcon}
              color="orange"
            />
            <StatCard
              title="Total Revenue"
              value={`₹${(totalRevenue / 1000).toFixed(1)}K`}
              icon={IndianRupeeIcon}
              color="purple"
            />
          </div>

          {/* Loan Distribution & Lead Conversion Funnel - Admin, Regional Manager, Relationship Manager & Franchise Owner */}
          {(authService.getUser()?.role === 'super_admin' || authService.getUser()?.role === 'regional_manager' || authService.getUser()?.role === 'relationship_manager' || authService.getUser()?.role === 'franchise') && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h2 className="text-lg font-bold text-gray-900 mb-4">Loan Distribution</h2>
                {loanDistribution.length > 0 ? (
                  <div className="flex flex-col sm:flex-row items-center gap-4">
                    <div className="w-full sm:w-48 h-48 relative flex-shrink-0 [&_svg]:outline-none [&_*]:outline-none">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart style={{ outline: 'none' }}>
                          <Pie
                            data={loanDistribution}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            innerRadius="55%"
                            outerRadius="85%"
                            paddingAngle={1}
                            stroke="none"
                            activeShape={(props) => <Sector {...props} stroke="none" />}
                            onClick={(_, index) => setSelectedLoanSegmentIndex(index)}
                            style={{ cursor: 'pointer', outline: 'none' }}
                          >
                            {loanDistribution.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                            ))}
                          </Pie>
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <span className="text-2xl font-bold text-gray-700">
                          {loanDistribution.length > 0
                            ? `${loanDistribution[Math.min(selectedLoanSegmentIndex ?? 0, loanDistribution.length - 1)].value}%`
                            : '0%'}
                        </span>
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <ul className="space-y-2">
                        {loanDistribution.map((item, idx) => (
                          <li
                            key={idx}
                            role="button"
                            tabIndex={0}
                            onClick={() => setSelectedLoanSegmentIndex(idx)}
                            onKeyDown={(e) => e.key === 'Enter' && setSelectedLoanSegmentIndex(idx)}
                            className={`flex items-center gap-2 text-sm cursor-pointer rounded px-1 py-0.5 -mx-1 hover:bg-gray-100 ${selectedLoanSegmentIndex === idx ? 'bg-gray-100' : ''}`}
                          >
                            <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                            <span className="text-gray-700 truncate">{item.name}</span>
                            <span className="font-medium text-gray-900 ml-auto">{item.value}%</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 text-center py-8">No loan distribution data</p>
                )}
              </div>
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold text-gray-900">Lead Conversion Funnel</h2>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setFunnelFilter('weekly')}
                      className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                        funnelFilter === 'weekly'
                          ? 'bg-primary-900 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      Weekly
                    </button>
                    <button
                      onClick={() => setFunnelFilter('monthly')}
                      className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                        funnelFilter === 'monthly'
                          ? 'bg-primary-900 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      Monthly
                    </button>
                    <button
                      onClick={() => setFunnelFilter('yearly')}
                      className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                        funnelFilter === 'yearly'
                          ? 'bg-primary-900 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      Yearly
                    </button>
                  </div>
                </div>
                {leadConversionFunnel.length > 0 ? (
                  <div className="space-y-2 max-w-md">
                    {leadConversionFunnel.map((stage) => {
                      const maxVal = Math.max(...leadConversionFunnel.map((s) => s.value), 1)
                      const widthPct = maxVal > 0 ? Math.max((stage.value / maxVal) * 100, 18) : 18
                      return (
                        <div key={stage.stage} className="flex items-center gap-3">
                          <div
                            className="h-11 rounded flex items-center px-3 transition-all min-w-[120px]"
                            style={{
                              width: `${widthPct}%`,
                              backgroundColor: stage.fill,
                            }}
                          >
                            <span className="text-white font-medium text-sm truncate">{stage.stage}</span>
                          </div>
                          <span className="text-gray-700 font-semibold tabular-nums w-12 text-right flex-shrink-0">{stage.value}</span>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 text-center py-8">No funnel data</p>
                )}
              </div>
            </div>
          )}

          {/* Related Lists Section - Admin Only */}
          {(authService.getUser()?.role === 'super_admin' || authService.getUser()?.role === 'regional_manager' || authService.getUser()?.role === 'relationship_manager') && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Recent Leads */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-gray-900">Recent Leads</h2>
                  <a href="/leads" className="text-sm text-primary-900 hover:text-primary-800">View All</a>
                </div>
                <div className="space-y-3">
                  {relatedLists.recentLeads.length > 0 ? (
                    relatedLists.recentLeads.map((lead) => (
                      <div key={lead.id || lead._id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900">{lead.loanAccountNo || 'N/A'}</p>
                          <p className="text-xs text-gray-600">
                            {lead.agent?.name || 'N/A'} • {lead.franchise?.name || 'N/A'}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-gray-900">₹{(lead.loanAmount || 0).toLocaleString()}</p>
                          <p className="text-xs text-gray-500">{lead.status || 'N/A'}</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-gray-500 text-center py-4">No recent leads</p>
                  )}
                </div>
              </div>

              {/* Recent Agents */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-gray-900">Recent Agents</h2>
                  <a href="/agents" className="text-sm text-primary-900 hover:text-primary-800">View All</a>
                </div>
                <div className="space-y-3">
                  {relatedLists.recentAgents.length > 0 ? (
                    relatedLists.recentAgents.map((agent) => (
                      <div key={agent.id || agent._id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900">{agent.name || 'N/A'}</p>
                          <p className="text-xs text-gray-600">
                            {agent.email || 'N/A'} • {agent.franchise?.name || 'N/A'}
                          </p>
                        </div>
                        <div className="text-right">
                          <span className={`text-xs px-2 py-1 rounded-full ${agent.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                            }`}>
                            {agent.status || 'N/A'}
                          </span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-gray-500 text-center py-4">No recent agents</p>
                  )}
                </div>
              </div>

              {/* Recent Franchises */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-gray-900">Recent Franchises</h2>
                  <a href="/franchises" className="text-sm text-primary-900 hover:text-primary-800">View All</a>
                </div>
                <div className="space-y-3">
                  {relatedLists.recentFranchises.length > 0 ? (
                    relatedLists.recentFranchises.map((franchise) => (
                      <div key={franchise.id || franchise._id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900">{franchise.name || 'N/A'}</p>
                          <p className="text-xs text-gray-600">
                            {franchise.ownerName || 'N/A'} • {franchise.email || 'N/A'}
                          </p>
                        </div>
                        <div className="text-right">
                          <span className={`text-xs px-2 py-1 rounded-full ${franchise.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                            }`}>
                            {franchise.status || 'N/A'}
                          </span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-gray-500 text-center py-4">No recent franchises</p>
                  )}
                </div>
              </div>

              {/* Recent Invoices */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-gray-900">Recent Invoices</h2>
                  <a href="/invoices" className="text-sm text-primary-900 hover:text-primary-800">View All</a>
                </div>
                <div className="space-y-3">
                  {relatedLists.recentInvoices.length > 0 ? (
                    relatedLists.recentInvoices.map((invoice) => (
                      <div key={invoice.id || invoice._id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900">{invoice.invoiceNumber || 'N/A'}</p>
                          <p className="text-xs text-gray-600">
                            {invoice.agent?.name || 'N/A'} • {invoice.franchise?.name || 'N/A'}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-gray-900">₹{(invoice.commissionAmount || invoice.amount || invoice.netPayable || 0).toLocaleString()}</p>
                          <p className="text-xs text-gray-500">{invoice.status || 'N/A'}</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-gray-500 text-center py-4">No recent invoices</p>
                  )}
                </div>
              </div>

              {/* Recent Payouts */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 lg:col-span-2">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-gray-900">Recent Payouts</h2>
                  <a href="/payouts" className="text-sm text-primary-900 hover:text-primary-800">View All</a>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {relatedLists.recentPayouts.length > 0 ? (
                    relatedLists.recentPayouts.map((payout) => (
                      <div key={payout.id || payout._id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900">{payout.payoutNumber || 'N/A'}</p>
                          <p className="text-xs text-gray-600">
                            {payout.agent?.name || 'N/A'} • {payout.franchise?.name || 'N/A'}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-gray-900">₹{(payout.netPayable || 0).toLocaleString()}</p>
                          <p className="text-xs text-gray-500">{payout.status || 'N/A'}</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-gray-500 text-center py-4 col-span-2">No recent payouts</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default Dashboard
