import { useState, useEffect } from 'react'
import { 
  Users, 
  FileText, 
  Plus,
  Upload,
  CheckCircle,
  AlertCircle,
  DollarSign,
  FileCheck,
  XCircle,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import IndianRupeeIcon from '../components/IndianRupeeIcon'
import StatCard from '../components/StatCard'
import api from '../services/api'
import { authService } from '../services/auth.service'
import { toast } from '../services/toastService'

const Dashboard = () => {
  const navigate = useNavigate()
  const [stats, setStats] = useState({
    totalLeads: 0,
    totalAgents: 0,
    totalInvoices: 0,
    totalRevenue: 0,
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
  
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    try {
      setLoading(true)
      
      // Get user role from stored user data
      const user = authService.getUser()
      const userRole = user?.role || 'super_admin'
      
      // Fetch dashboard data based on user role
      let dashboardData
      try {
        switch (userRole) {
          case 'agent':
            dashboardData = await api.dashboard.getAgentDashboard()
            break
          case 'franchise_owner':
            dashboardData = await api.dashboard.getFranchiseOwnerDashboard()
            break
          case 'relationship_manager':
          case 'franchise_manager':
            dashboardData = await api.dashboard.getStaffDashboard()
            break
          case 'accounts_manager':
            dashboardData = await api.dashboard.getAccountsDashboard()
            break
          case 'super_admin':
          default:
            dashboardData = await api.dashboard.getAdminDashboard()
            break
        }
      } catch (roleError) {
        // If role-specific dashboard fails, try admin dashboard
        console.warn('Role-specific dashboard failed, trying admin:', roleError)
        dashboardData = await api.dashboard.getAdminDashboard()
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
        setRelatedLists({
          recentLeads: Array.isArray(data.recentLeads) ? data.recentLeads : [],
        })
      }

      // Set related lists (for admin and franchise owner dashboards)
      if (userRole === 'super_admin' || userRole === 'relationship_manager' || userRole === 'franchise_owner') {
        setRelatedLists({
          recentLeads: Array.isArray(data.recentLeads) ? data.recentLeads : [],
          recentAgents: Array.isArray(data.recentAgents) ? data.recentAgents : [],
          recentFranchises: Array.isArray(data.recentFranchises) ? data.recentFranchises : [],
          recentInvoices: Array.isArray(data.recentInvoices) ? data.recentInvoices : [],
          recentPayouts: Array.isArray(data.recentPayouts) ? data.recentPayouts : [],
          relationshipManagers: Array.isArray(data.relationshipManagers) ? data.relationshipManagers : [],
        })

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
  }

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

  // Calculate statistics
  const { totalLeads, totalAgents, totalInvoices, totalRevenue } = stats
  const userRole = authService.getUser()?.role || 'super_admin'
  const isAgent = userRole === 'agent'




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
              change={`${stats.leads?.fresh || 0} fresh, ${stats.leads?.disbursed || 0} disbursed`}
              changeType="positive"
              icon={Users}
              color="blue"
            />
            <StatCard
              title="Pending Verification"
              value={stats.leads?.pending || 0}
              change={`${stats.leads?.verified || 0} verified`}
              changeType="neutral"
              icon={FileCheck}
              color="orange"
            />
            <StatCard
              title="Pending Invoices"
              value={stats.invoices?.pending || 0}
              change={`${stats.invoices?.approved || 0} approved`}
              changeType="neutral"
              icon={FileText}
              color="purple"
            />
            <StatCard
              title="Total Commission"
              value={`₹${((stats.totalRevenue || 0) / 1000).toFixed(1)}K`}
              change={`${stats.payouts?.paid || 0} paid`}
              changeType="positive"
              icon={IndianRupeeIcon}
              color="green"
            />
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Quick Actions</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <button
                onClick={() => navigate('/leads?action=create&type=fresh')}
                className="flex items-center gap-3 p-4 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors text-left"
              >
                <Plus className="w-6 h-6 text-blue-600" />
                <div>
                  <p className="font-semibold text-gray-900">Submit Fresh Lead</p>
                  <p className="text-sm text-gray-600">Create new lead</p>
                </div>
              </button>
              <button
                onClick={() => navigate('/leads?action=create&type=disbursed')}
                className="flex items-center gap-3 p-4 bg-green-50 hover:bg-green-100 rounded-lg transition-colors text-left"
              >
                <DollarSign className="w-6 h-6 text-green-600" />
                <div>
                  <p className="font-semibold text-gray-900">Submit Disbursed Case</p>
                  <p className="text-sm text-gray-600">Add disbursed case</p>
                </div>
              </button>
              <button
                onClick={() => navigate('/leads')}
                className="flex items-center gap-3 p-4 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors text-left"
              >
                <Upload className="w-6 h-6 text-purple-600" />
                <div>
                  <p className="font-semibold text-gray-900">Upload Documents</p>
                  <p className="text-sm text-gray-600">Manage documents</p>
                </div>
              </button>
              <button
                onClick={() => navigate('/invoices')}
                className="flex items-center gap-3 p-4 bg-orange-50 hover:bg-orange-100 rounded-lg transition-colors text-left"
              >
                <FileText className="w-6 h-6 text-orange-600" />
                <div>
                  <p className="font-semibold text-gray-900">Manage Invoices</p>
                  <p className="text-sm text-gray-600">View all invoices</p>
                </div>
              </button>
            </div>
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

          {/* Recent Leads */}
          {relatedLists.recentLeads.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900">Recent Leads</h2>
                <a href="/leads" className="text-sm text-primary-900 hover:text-primary-800">View All</a>
              </div>
              <div className="space-y-3">
                {relatedLists.recentLeads.map((lead) => (
                  <div key={lead.id || lead._id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">{lead.loanAccountNo || 'N/A'}</p>
                      <p className="text-xs text-gray-600">
                        {lead.bank?.name || 'N/A'} • ₹{(lead.loanAmount || 0).toLocaleString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        lead.verificationStatus === 'verified' ? 'bg-green-100 text-green-800' : 
                        lead.verificationStatus === 'rejected' ? 'bg-red-100 text-red-800' : 
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {lead.verificationStatus || 'pending'}
                      </span>
                    </div>
                  </div>
                ))}
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
              change="+12.5%"
              changeType="positive"
              icon={Users}
              color="blue"
            />
            <StatCard
              title="Active Agents"
              value={totalAgents}
              change="+5.2%"
              changeType="positive"
              icon={Users}
              color="green"
            />
            <StatCard
              title="Total Invoices"
              value={totalInvoices}
              change="+8.1%"
              changeType="positive"
              icon={FileText}
              color="orange"
            />
            <StatCard
              title="Total Revenue"
              value={`₹${(totalRevenue / 1000).toFixed(1)}K`}
              change="+15.3%"
              changeType="positive"
              icon={IndianRupeeIcon}
              color="purple"
            />
          </div>

          {/* Quick Actions - Admin/Relationship Manager */}
          {(authService.getUser()?.role === 'super_admin' || authService.getUser()?.role === 'relationship_manager') && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Quick Actions</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <button
                  onClick={() => navigate('/staff')}
                  className="flex items-center gap-3 p-4 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors text-left"
                >
                  <Users className="w-6 h-6 text-blue-600" />
                  <div>
                    <p className="font-semibold text-gray-900">Staff</p>
                    <p className="text-sm text-gray-600">Manage staff</p>
                  </div>
                </button>
                <button
                  onClick={() => navigate('/agents')}
                  className="flex items-center gap-3 p-4 bg-green-50 hover:bg-green-100 rounded-lg transition-colors text-left"
                >
                  <Users className="w-6 h-6 text-green-600" />
                  <div>
                    <p className="font-semibold text-gray-900">Agents</p>
                    <p className="text-sm text-gray-600">Manage agents</p>
                  </div>
                </button>
                <button
                  onClick={() => navigate('/leads')}
                  className="flex items-center gap-3 p-4 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors text-left"
                >
                  <FileText className="w-6 h-6 text-purple-600" />
                  <div>
                    <p className="font-semibold text-gray-900">Leads</p>
                    <p className="text-sm text-gray-600">View all leads</p>
                  </div>
                </button>
                <button
                  onClick={() => navigate('/invoices')}
                  className="flex items-center gap-3 p-4 bg-orange-50 hover:bg-orange-100 rounded-lg transition-colors text-left"
                >
                  <FileText className="w-6 h-6 text-orange-600" />
                  <div>
                    <p className="font-semibold text-gray-900">Invoices</p>
                    <p className="text-sm text-gray-600">Manage invoices</p>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* Related Lists Section - Admin Only */}
          {(authService.getUser()?.role === 'super_admin' || authService.getUser()?.role === 'relationship_manager') && (
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
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        agent.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
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
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        franchise.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
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
