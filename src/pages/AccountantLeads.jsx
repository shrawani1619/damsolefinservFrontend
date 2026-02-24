import React, { useState, useEffect, useMemo } from 'react';
import {
    Search, Filter, ChevronDown, ChevronUp, MoreVertical, FileDown,
    Plus, Edit, Trash2, ArrowRight, User, Building, CreditCard,
    FileText, Calendar, CheckCircle2, AlertCircle, Clock, X, Save, Calculator, PieChart, DollarSign,
    Percent, Hash, Tag, Eye, Download, CheckCircle
} from 'lucide-react';
import api from '../services/api';
import { toast } from '../services/toastService';
import { formatCurrency } from '../utils/formatUtils';
import LeadExpandedDetails from '../components/LeadExpandedDetails';
import DisbursementForm from '../components/DisbursementForm';
import EditDisbursementForm from '../components/EditDisbursementForm';
import ConfirmModal from '../components/ConfirmModal';
import Modal from '../components/Modal';
import LeadForm from '../components/LeadForm';
import DisbursementEmailModal from '../components/DisbursementEmailModal';

// Financial calculation utilities
const calculateRemainingAmount = (loanAmount, disbursedAmount) => {
    const loan = loanAmount || 0;
    const disbursed = disbursedAmount || 0;
    return Math.max(0, loan - disbursed);
};

const calculateProgressPercentage = (disbursedAmount, loanAmount) => {
    const loan = loanAmount || 0;
    const disbursed = disbursedAmount || 0;
    return loan > 0 ? Math.round((disbursed / loan) * 100) : 0;
};

const determineLoanStatus = (loanAmount, disbursedAmount, currentStatus) => {
    const remaining = calculateRemainingAmount(loanAmount, disbursedAmount);
    
    if (remaining === 0) return 'completed';
    if (disbursedAmount > 0 && remaining > 0) return 'partial_disbursed';
    if (currentStatus === 'approved' || currentStatus === 'sanctioned') return 'approved';
    return currentStatus || 'processing';
};

const calculateCommission = (amount, percentage) => {
    const amt = parseFloat(amount) || 0;
    const pct = parseFloat(percentage) || 0;
    return (amt * pct) / 100;
};

const calculateNetCommission = (commission, gst) => {
    const comm = parseFloat(commission) || 0;
    const gstAmount = parseFloat(gst) || 0;
    return Math.max(0, comm - gstAmount);
};

const AccountantLeads = () => {
    const [leads, setLeads] = useState([]);
    const [loading, setLoading] = useState(true);
    const [expandedRow, setExpandedRow] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedLeadId, setSelectedLeadId] = useState(null);
        
    const [isViewModalOpen, setIsViewModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isEditDisbursementModalOpen, setIsEditDisbursementModalOpen] = useState(false);
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
    const [confirmDeleteLead, setConfirmDeleteLead] = useState({ isOpen: false, lead: null });
    const [isDisbursementEmailModalOpen, setIsDisbursementEmailModalOpen] = useState(false);
    const [selectedLeadForEmail, setSelectedLeadForEmail] = useState(null);
        
    const [viewLeadData, setViewLeadData] = useState(null);
    const [selectedLead, setSelectedLead] = useState(null);
    const [selectedDisbursement, setSelectedDisbursement] = useState(null);
    const [disbursementToDelete, setDisbursementToDelete] = useState(null);
        
    const [filters, setFilters] = useState({
        status: '',
        bank: '',
        agent: '',
        dateRange: { from: '', to: '' }
    });
    const [sortConfig, setSortConfig] = useState({ key: 'createdAt', direction: 'desc' });
    const [formData, setFormData] = useState({
        amount: '',
        date: new Date().toISOString().split('T')[0],
        utr: '',
        bankRef: '',
        commission: '',
        gst: '',
        notes: ''
    });

    useEffect(() => {
        fetchLeads();
    }, []);

    const fetchLeads = async () => {
        try {
            setLoading(true);
            const response = await api.accountant.getApprovedLeads({ 
                search: searchTerm,
                page: 1,
                limit: 100
            });
            const leadsData = response?.data?.leads || response?.leads || [];
            setLeads(Array.isArray(leadsData) ? leadsData : []);
        } catch (error) {
            console.error('Error fetching leads:', error);
            toast.error('Error', 'Failed to fetch approved leads');
            setLeads([]);
        } finally {
            setLoading(false);
        }
    };

    const handleEditDisbursement = (leadId, disbursement) => {
        setSelectedLeadId(leadId);
        setSelectedDisbursement(disbursement);
        setIsEditDisbursementModalOpen(true);
    };

    const handleDeleteDisbursement = (leadId, disbursement) => {
        setSelectedLeadId(leadId);
        setDisbursementToDelete(disbursement);
        setIsDeleteConfirmOpen(true);
    };

    const handleEditDisbursementSubmit = async (data) => {
        try {
            const response = await api.accountant.editDisbursement(selectedLeadId, selectedDisbursement._id, data);
            toast.success('Success', response.message || 'Disbursement updated successfully');
            
            // Refresh the leads data
            await fetchLeads();
            
            // Close modal
            setIsEditDisbursementModalOpen(false);
            setSelectedDisbursement(null);
        } catch (error) {
            console.error('Error updating disbursement:', error);
            toast.error('Error', error.message || 'Failed to update disbursement');
        }
    };

    const handleDeleteDisbursementConfirm = async () => {
        try {
            const response = await api.accountant.deleteDisbursement(selectedLeadId, disbursementToDelete._id);
            toast.success('Success', response.message || 'Disbursement deleted successfully');
            
            // Refresh the leads data
            await fetchLeads();
            
            // Close modal
            setIsDeleteConfirmOpen(false);
            setDisbursementToDelete(null);
        } catch (error) {
            console.error('Error deleting disbursement:', error);
            toast.error('Error', error.message || 'Failed to delete disbursement');
        }
    };

    const handleAddDisbursementSubmit = async (data) => {
        try {
            const response = await api.accountant.addDisbursement(selectedLeadId, data);
            toast.success('Success', response.message || 'Disbursement added successfully');
            
            // Refresh the leads data
            await fetchLeads();
            
            // Close modal
            setIsModalOpen(false);
            setSelectedLeadId(null);
        } catch (error) {
            console.error('Error adding disbursement:', error);
            toast.error('Error', error.message || 'Failed to add disbursement');
        }
    };

    useEffect(() => {
        const timeoutId = setTimeout(() => {
            fetchLeads();
        }, 500);
        return () => clearTimeout(timeoutId);
    }, [searchTerm]);


    const openViewModal = (leadId) => {
        const lead = leads.find(l => (l._id || l.id) === leadId);
        setViewLeadData(lead);
        setIsViewModalOpen(true);
    };

    const openEditModal = (leadId) => {
        const lead = leads.find(l => (l._id || l.id) === leadId);
        setSelectedLead(lead);
        setIsEditModalOpen(true);
    };

    const handleSaveEdit = async (formData) => {
        if (!selectedLead) return;
        try {
            const leadId = selectedLead._id || selectedLead.id;
            
            // Map form data to backend API format (similar to Leads.jsx)
            const leadData = {
                leadType: formData.leadType || 'bank',
                caseNumber: formData.caseNumber?.trim() || undefined,
                applicantMobile: formData.applicantMobile?.trim() || undefined,
                applicantEmail: formData.applicantEmail?.trim() || undefined,
                loanType: formData.loanType,
                loanAmount: formData.loanAmount ? Number(formData.loanAmount) : undefined,
                loanAccountNo: formData.loanAccountNo?.trim() || undefined,
                branch: formData.branch?.trim() || undefined,
                dsaCode: formData.dsaCode?.trim() || undefined,
                remarks: formData.remarks?.trim() || undefined,
                bankId: formData.bankId || formData.bank,
                bank: formData.bankId || formData.bank,
                formValues: formData.formValues || undefined,
                leadForm: formData.leadForm || undefined,
                commissionPercentage: (formData.commissionPercentage !== undefined && formData.commissionPercentage !== null && formData.commissionPercentage !== '') 
                    ? parseFloat(formData.commissionPercentage) 
                    : (formData.commissionPercentage === 0 ? 0 : undefined),
                commissionAmount: (formData.commissionAmount !== undefined && formData.commissionAmount !== null && formData.commissionAmount !== '') 
                    ? parseFloat(formData.commissionAmount) 
                    : (formData.commissionAmount === 0 ? 0 : undefined),
            };

            // Remove undefined values
            Object.keys(leadData).forEach(key => {
                if (leadData[key] === undefined) {
                    delete leadData[key];
                }
            });

            await api.leads.update(leadId, leadData);
            toast.success('Success', 'Lead updated successfully');
            await fetchLeads();
            setIsEditModalOpen(false);
            setSelectedLead(null);
        } catch (error) {
            console.error('Error updating lead:', error);
            toast.error('Error', error.message || 'Failed to update lead');
        }
    };

    const handleDeleteLeadClick = (lead) => {
        setConfirmDeleteLead({ isOpen: true, lead });
    };

    const handleDeleteLeadConfirm = async () => {
        const lead = confirmDeleteLead.lead;
        const leadId = lead._id || lead.id;
        if (!leadId) {
            toast.error('Error', 'Lead ID is missing');
            return;
        }

        try {
            await api.leads.delete(leadId);
            await fetchLeads();
            toast.success('Success', `Lead "${lead.leadId || lead.customerName || 'this lead'}" deleted successfully`);
            setConfirmDeleteLead({ isOpen: false, lead: null });
        } catch (error) {
            console.error('Error deleting lead:', error);
            toast.error('Error', error.message || 'Failed to delete lead');
        }
    };

    const handleStatusUpdate = async (leadId, newStatus) => {
        if (!leadId) {
            toast.error('Error', 'Lead ID is missing');
            return;
        }
        try {
            await api.accountant.updateLeadStatus(leadId, { status: newStatus });
            await fetchLeads();
            toast.success('Success', 'Lead status updated successfully');
        } catch (error) {
            console.error('Error updating lead status:', error);
            toast.error('Error', error.message || 'Failed to update lead status');
        }
    };

    const handleDisbursementEmail = (lead) => {
        setSelectedLeadForEmail(lead);
        setIsDisbursementEmailModalOpen(true);
    };

    const handleDeleteInstallment = (leadId, installmentId) => {
        if (!window.confirm('Are you sure you want to delete this disbursement record?')) {
            return;
        }
        toast.error('Feature restricted', 'Deletion of tranches is not allowed for security.');
    };


    const openDisbursementModal = (leadId) => {
        setSelectedLeadId(leadId);
        setFormData({
            amount: '',
            date: new Date().toISOString().split('T')[0],
            utr: '',
            bankRef: '',
            commission: '',
            gst: '',
            notes: ''
        });
        setIsModalOpen(true);
    };

    const handleSaveDisbursement = async (formData) => {
        if (!formData.amount || parseFloat(formData.amount) <= 0) {
            toast.error('Error', 'Please enter a valid amount');
            return;
        }

        try {
            const response = await api.accountant.addDisbursement(selectedLeadId, formData);
            toast.success('Success', response.message || 'Disbursement added successfully');
            
            // Refresh the leads data
            await fetchLeads();
            
            // Close modal
            setIsModalOpen(false);
            setSelectedLeadId(null);
        } catch (error) {
            toast.error('Error', error.message || 'Failed to add disbursement');
        }
    };

    const toggleRow = (id) => {
        if (expandedRow === id) {
            setExpandedRow(null);
        } else {
            setExpandedRow(id);
        }
    };

    // Filtered and sorted leads
    const filteredAndSortedLeads = useMemo(() => {
        if (!Array.isArray(leads)) return [];
        let filtered = [...leads];
        
        // Apply search filter
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            filtered = filtered.filter(lead => 
                (lead.customerName && lead.customerName.toLowerCase().includes(term)) ||
                (lead.leadId && lead.leadId.toLowerCase().includes(term)) ||
                (lead.loanAccountNo && lead.loanAccountNo.toLowerCase().includes(term)) ||
                (lead.agentName && lead.agentName.toLowerCase().includes(term))
            );
        }
        
        // Apply status filter
        if (filters.status) {
            filtered = filtered.filter(lead => lead.status === filters.status);
        }
        
        // Apply bank filter
        if (filters.bank) {
            filtered = filtered.filter(lead => 
                (lead.bank?.name && lead.bank.name === filters.bank) ||
                lead.bankName === filters.bank
            );
        }
        
        // Apply agent filter
        if (filters.agent) {
            filtered = filtered.filter(lead => 
                (lead.agent?.name && lead.agent.name === filters.agent) ||
                lead.agentName === filters.agent
            );
        }
        
        // Apply date range filter
        if (filters.dateRange.from || filters.dateRange.to) {
            filtered = filtered.filter(lead => {
                const leadDate = new Date(lead.createdAt);
                const fromDate = filters.dateRange.from ? new Date(filters.dateRange.from) : null;
                const toDate = filters.dateRange.to ? new Date(filters.dateRange.to) : null;
                
                if (fromDate && leadDate < fromDate) return false;
                if (toDate && leadDate > toDate) return false;
                return true;
            });
        }
        
        // Apply sorting
        if (sortConfig.key) {
            filtered.sort((a, b) => {
                let aValue = a[sortConfig.key];
                let bValue = b[sortConfig.key];
                
                // Handle nested properties
                if (sortConfig.key.includes('.')) {
                    const keys = sortConfig.key.split('.');
                    aValue = keys.reduce((obj, key) => obj?.[key], a);
                    bValue = keys.reduce((obj, key) => obj?.[key], b);
                }
                
                // Handle date comparison
                if (aValue instanceof Date || bValue instanceof Date) {
                    aValue = new Date(aValue);
                    bValue = new Date(bValue);
                }
                
                // Handle null/undefined values
                if (aValue == null) aValue = '';
                if (bValue == null) bValue = '';
                
                if (typeof aValue === 'string') {
                    aValue = aValue.toLowerCase();
                    bValue = bValue.toLowerCase();
                }
                
                if (sortConfig.direction === 'asc') {
                    return aValue > bValue ? 1 : -1;
                } else {
                    return aValue < bValue ? 1 : -1;
                }
            });
        }
        
        return filtered;
    }, [leads, searchTerm, filters, sortConfig]);
    
    const handleSort = (key) => {
        setSortConfig(prev => ({
            key,
            direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
        }));
    };
    
    const getSortIcon = (columnKey) => {
        if (sortConfig.key !== columnKey) return <ChevronDown size={14} className="text-gray-400" />;
        return sortConfig.direction === 'asc' ? 
            <ChevronUp size={14} className="text-primary-600" /> : 
            <ChevronDown size={14} className="text-primary-600" />;
    };
    
    const getStatusColor = (status) => {
        switch (status?.toLowerCase()) {
            case 'approved':
            case 'sanctioned': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
            case 'disbursed': 
            case 'completed': return 'bg-blue-100 text-blue-700 border-blue-200';
            case 'partial_disbursed': return 'bg-cyan-100 text-cyan-700 border-cyan-200';
            case 'processing': return 'bg-amber-100 text-amber-700 border-amber-200';
            case 'rejected': return 'bg-rose-100 text-rose-700 border-rose-200';
            default: return 'bg-slate-100 text-slate-700 border-slate-200';
        }
    };
    
    const getUniqueValues = (array, key) => {
        const values = array.map(item => {
            if (key.includes('.')) {
                const keys = key.split('.');
                return keys.reduce((obj, k) => obj?.[k], item);
            }
            return item[key];
        }).filter(Boolean);
        return [...new Set(values)];
    };
    
    const uniqueBanks = getUniqueValues(leads, 'bank.name');
    const uniqueAgents = getUniqueValues(leads, 'agent.name');
    const uniqueStatuses = getUniqueValues(leads, 'status');

    return (
        <div className="bg-white rounded-3xl border border-gray-200 shadow-sm flex flex-col h-[calc(100vh-100px)] w-full max-w-full overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-gray-100 flex flex-col gap-4 shrink-0">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Approved Loan Leads</h1>
                        <p className="text-sm text-gray-500">Manage disbursements and calculate commissions</p>
                    </div>
                    <div className="flex flex-wrap gap-3 w-full sm:w-auto">
                        <div className="relative flex-1 sm:flex-none min-w-[200px]">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                            <input
                                type="text"
                                placeholder="Search by name, ID, account..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none transition-all"
                            />
                        </div>
                        <button className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-bold text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm whitespace-nowrap">
                            <FileDown size={18} />
                            Export
                        </button>
                        {loading && <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-900"></div>}
                    </div>
                </div>
                
                {/* Filter Section */}
                <div className="flex flex-wrap gap-3 p-4 bg-gray-50 rounded-xl border border-gray-200">
                    <div className="flex-1 min-w-[150px]">
                        <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
                        <select
                            value={filters.status}
                            onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none"
                        >
                            <option value="">All Statuses</option>
                            {uniqueStatuses.map(status => (
                                <option key={status} value={status}>{status}</option>
                            ))}
                        </select>
                    </div>
                    
                    <div className="flex-1 min-w-[150px]">
                        <label className="block text-xs font-medium text-gray-700 mb-1">Bank</label>
                        <select
                            value={filters.bank}
                            onChange={(e) => setFilters(prev => ({ ...prev, bank: e.target.value }))}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none"
                        >
                            <option value="">All Banks</option>
                            {uniqueBanks.map(bank => (
                                <option key={bank} value={bank}>{bank}</option>
                            ))}
                        </select>
                    </div>
                    
                    <div className="flex-1 min-w-[150px]">
                        <label className="block text-xs font-medium text-gray-700 mb-1">Agent</label>
                        <select
                            value={filters.agent}
                            onChange={(e) => setFilters(prev => ({ ...prev, agent: e.target.value }))}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none"
                        >
                            <option value="">All Agents</option>
                            {uniqueAgents.map(agent => (
                                <option key={agent} value={agent}>{agent}</option>
                            ))}
                        </select>
                    </div>
                    
                    <div className="flex items-end gap-2 w-full sm:w-auto">
                        <button
                            onClick={() => setFilters({ status: '', bank: '', agent: '', dateRange: { from: '', to: '' } })}
                            className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors w-full sm:w-auto"
                        >
                            Clear All
                        </button>
                    </div>
                </div>
                
                {/* Results Summary */}
                <div className="text-sm text-gray-600">
                    Showing {filteredAndSortedLeads.length} of {leads.length} leads
                    {searchTerm && ` matching "${searchTerm}"`}
                    {filters.status && ` with status "${filters.status}"`}
                    {filters.bank && ` from bank "${filters.bank}"`}
                    {filters.agent && ` for agent "${filters.agent}"`}
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 overflow-auto bg-gray-50/50">
                {/* Search and Filters */}
                <div className="p-6 bg-white border-b border-gray-100 flex flex-wrap gap-4 items-center">
                    <div className="relative flex-1 min-w-[200px]">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input
                            type="text"
                            placeholder="Search by Name or Mobile..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm focus:ring-2 focus:ring-primary-500/10 focus:border-primary-500 outline-none transition-all placeholder:text-gray-400"
                        />
                    </div>
                </div>

                {/* Main Table Container */}
                <div className="flex-1 overflow-hidden relative flex flex-col w-full">
                    <div className="w-full h-full overflow-auto bg-white [scrollbar-width:thin] [scrollbar-color:theme(colors.slate.400)_theme(colors.slate.100)] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-track]:bg-slate-100 [&::-webkit-scrollbar-thumb]:bg-slate-400 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:border-2 [&::-webkit-scrollbar-thumb]:border-slate-100 hover:[&::-webkit-scrollbar-thumb]:bg-slate-500 md:[&::-webkit-scrollbar]:w-2 md:[&::-webkit-scrollbar]:h-2 sm:[&::-webkit-scrollbar]:w-2 sm:[&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar]:h-2">
                        <table className="w-full text-left border-collapse min-w-[100px]">
                            <thead className="bg-gray-50/80 backdrop-blur-sm sticky top-0 z-10 shadow-sm">
                                <tr className="text-[11px] text-gray-500 font-bold uppercase tracking-wider">
                                    <th className="px-6 py-4 whitespace-nowrap min-w-[60px]"></th>
                                    <th className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center gap-2">
                                            <span>Lead ID</span>
                                        </div>
                                    </th>
                                    <th className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center gap-2">
                                            <span>Customer</span>
                                        </div>
                                    </th>
                                    <th className="px-6 py-4 whitespace-nowrap cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('status')}>
                                        <div className="flex items-center gap-2">
                                            <span>Status</span>

                                        </div>
                                    </th>
                                    <th className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center gap-2">
                                            <span>Account No</span>
                                        </div>
                                    </th>
                                    <th className="px-6 py-4 whitespace-nowrap cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('loanType')}>
                                        <div className="flex items-center gap-2">
                                            <span>Loan Type</span>

                                        </div>
                                    </th>
                                    <th className="px-6 py-4 whitespace-nowrap text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <span>Loan Amount</span>
                                        </div>
                                    </th>
                                    <th className="px-6 py-4 whitespace-nowrap text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <span>Disbursed</span>
                                        </div>
                                    </th>
                                    <th className="px-6 py-4 whitespace-nowrap cursor-pointer hover:bg-gray-100 transition-colors text-right" onClick={() => handleSort('remainingAmount')}>
                                        <div className="flex items-center justify-end gap-2">
                                            <span>Remaining</span>

                                        </div>
                                    </th>
                                    <th className="px-6 py-4 whitespace-nowrap cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('commissionPercentage')}>
                                        <div className="flex items-center gap-2">
                                            <span>Commission %</span>

                                        </div>
                                    </th>
                                    <th className="px-6 py-4 whitespace-nowrap cursor-pointer hover:bg-gray-100 transition-colors text-right" onClick={() => handleSort('commissionAmount')}>
                                        <div className="flex items-center justify-end gap-2">
                                            <span>Commission</span>

                                        </div>
                                    </th>
                                    <th className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center gap-2">
                                            <span>Agent</span>
                                        </div>
                                    </th>
                                    <th className="px-6 py-4 whitespace-nowrap cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('bank.name')}>
                                        <div className="flex items-center gap-2">
                                            <span>Bank</span>

                                        </div>
                                    </th>
                                    <th className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center gap-2">
                                            <span>Date</span>
                                        </div>
                                    </th>
                                    <th className="px-6 py-4 whitespace-nowrap">Remark</th>
                                    <th className="px-6 py-4 whitespace-nowrap">GST</th>
                                    <th className="px-6 py-4 whitespace-nowrap">DSA Code</th>
                                    <th className="px-6 py-4 whitespace-nowrap">UTR Number</th>
                                    <th className="px-6 py-4 whitespace-nowrap">Generate Invoice</th>
                                    <th className="px-6 py-4 whitespace-nowrap">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 bg-white">
                                {filteredAndSortedLeads.map((lead) => {
                                    const isExpanded = expandedRow === lead._id;
                                    const loanAmountValue = lead.loanAmount || lead.amount || 0;
                                    const disbursedAmount = lead.disbursedAmount || 0;
                                    const remainingAmount = calculateRemainingAmount(loanAmountValue, disbursedAmount);
                                    const progressPercentage = calculateProgressPercentage(disbursedAmount, loanAmountValue);
                                    const loanStatus = determineLoanStatus(loanAmountValue, disbursedAmount, lead.status);
                                    const history = lead.disbursementHistory || [];

                                    return (
                                        <React.Fragment key={lead._id}>
                                            <tr
                                                className={`transition-all duration-300 hover:bg-gray-50 cursor-pointer group ${isExpanded ? 'bg-gray-50 shadow-sm' : ''}`}
                                                onClick={() => toggleRow(lead._id)}
                                            >
                                                <td className="px-6 py-4 whitespace-nowrap text-gray-400 group-hover:text-primary-600 transition-colors">
                                                    {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-xs font-mono text-gray-500 font-medium">
                                                    {lead.leadId}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-full bg-primary-50 text-primary-700 flex items-center justify-center font-bold text-xs">
                                                            {(lead.customerName || 'U').charAt(0)}
                                                        </div>
                                                        <div>
                                                            <div className="text-sm font-semibold text-gray-900">{lead.customerName || 'N/A'}</div>
                                                            <div className="text-[11px] text-gray-500">{lead.contactNumber || lead.applicantMobile || lead.applicantEmail || 'N/A'}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${getStatusColor(loanStatus)}`}>
                                                        {loanStatus}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-xs font-mono text-gray-600">
                                                    {lead.loanAccountNo || 'N/A'}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="text-sm font-medium text-gray-900">
                                                        {lead.loanType?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'N/A'}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900 text-right font-mono">
                                                    {formatCurrency(lead.loanAmount || lead.amount)}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-emerald-600 text-right font-mono">
                                                    {formatCurrency(disbursedAmount)}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-orange-600 text-right font-mono">
                                                    {formatCurrency(remainingAmount)}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">
                                                    <div className="flex items-center gap-1">
                                                        <Percent size={12} />
                                                        {lead.commissionPercentage || 0}%
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-blue-600 text-right font-mono">
                                                    {formatCurrency(lead.commissionAmount || 0)}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                                    {lead.agentName || lead.agent?.name || 'N/A'}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                                    {lead.bank?.name || lead.bankName || 'N/A'}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                    {new Date(lead.createdAt).toLocaleDateString()}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 max-w-[120px] truncate">
                                                    <span title={lead.remark || 'N/A'}>
                                                        {lead.remark || 'N/A'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                    {formatCurrency(lead.gst || 0)}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-xs font-mono text-gray-500">
                                                    {lead.dsaCode || 'N/A'}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-xs font-mono text-gray-500 max-w-[100px] truncate">
                                                    <span title={lead.utrNumber || 'N/A'}>
                                                        {lead.utrNumber || 'N/A'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    {lead.invoice || lead.isInvoiceGenerated ? (
                                                        <span className="flex items-center gap-2 px-3 py-1.5 bg-green-100 text-green-700 rounded-lg text-xs font-semibold">
                                                            <CheckCircle2 size={14} />
                                                            Generated
                                                        </span>
                                                    ) : (
                                                        <button
                                                            onClick={async (e) => {
                                                                e.stopPropagation();
                                                                try {
                                                                    // Check if lead is in a status that allows invoice generation
                                                                    const allowedStatuses = ['sanctioned', 'partial_disbursed', 'disbursed', 'completed'];
                                                                    if (!allowedStatuses.includes(lead.status)) {
                                                                        toast.error('Error', 'Invoice can only be generated for approved/disbursed leads');
                                                                        return;
                                                                    }

                                                                    // Check if lead has commission amount
                                                                    const commissionAmount = lead.commissionAmount || 0;
                                                                    if (commissionAmount <= 0) {
                                                                        toast.error('Error', 'Cannot generate invoice. Commission amount is zero or not set.');
                                                                        return;
                                                                    }

                                                                    await api.invoices.generateFromLead(lead._id);
                                                                    toast.success('Success', 'Invoice generated successfully');
                                                                    // Refresh leads to update the UI
                                                                    await fetchLeads();
                                                                } catch (error) {
                                                                    console.error('Error generating invoice:', error);
                                                                    toast.error('Error', error.message || 'Failed to generate invoice');
                                                                }
                                                            }}
                                                            className="flex items-center gap-2 px-3 py-1.5 bg-primary-600 text-white rounded-lg text-xs font-semibold hover:bg-primary-700 transition-colors shadow-sm hover:shadow-md"
                                                        >
                                                            <FileText size={14} />
                                                            Generate
                                                        </button>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                                                        <button
                                                            onClick={() => openViewModal(lead._id)}
                                                            className="text-primary-900 hover:text-primary-800 p-1"
                                                            title="View Details"
                                                        >
                                                            <Eye size={16} />
                                                        </button>
                                                        <button
                                                            onClick={() => openEditModal(lead._id)}
                                                            className="text-gray-600 hover:text-gray-900 p-1"
                                                            title="Edit"
                                                        >
                                                            <Edit size={16} />
                                                        </button>
                                                        {(lead.status === 'disbursed' || lead.status === 'completed') && (
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleDisbursementEmail(lead);
                                                                }}
                                                                className="text-blue-600 hover:text-blue-800 p-1"
                                                                title="Disbursement Confirmation"
                                                            >
                                                                <CheckCircle size={16} />
                                                            </button>
                                                        )}
                                                        <button
                                                            onClick={() => handleDeleteLeadClick(lead)}
                                                            className="text-red-600 hover:text-red-900 p-1"
                                                            title="Delete"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                        <select
                                                            value={lead.status || 'sanctioned'}
                                                            onChange={(e) => handleStatusUpdate(lead._id, e.target.value)}
                                                            className="text-xs border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary-500"
                                                            onClick={(e) => e.stopPropagation()}
                                                        >
                                                            <option value="sanctioned">Sanctioned</option>
                                                            <option value="partial_disbursed">Partial Disbursed</option>
                                                            <option value="disbursed">Disbursed</option>
                                                            <option value="completed">Completed</option>
                                                        </select>
                                                    </div>
                                                </td>
                                            </tr>

                                            {/* EXPANDED ROW */}
                                            {isExpanded && (
                                                <tr className="bg-gray-50/50 animate-in slide-in-from-top-2 duration-300">
                                                    <td colSpan="20" className="p-0 border-b border-gray-100">
                                                        <div className="p-6 border-b border-gray-100 transition-all duration-300">
                                                            <LeadExpandedDetails 
                                                                lead={lead} 
                                                                onAddDisbursement={openDisbursementModal}
                                                                onViewHistory={() => console.log('View history for', lead._id)}
                                                                onEditDisbursement={handleEditDisbursement}
                                                                onDeleteDisbursement={handleDeleteDisbursement}
                                                            />
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    <div className="p-4 border-t border-gray-100 flex items-center justify-between bg-white shrink-0">
                        <p className="text-sm text-gray-500">Showing 1 to {filteredAndSortedLeads.length} of {filteredAndSortedLeads.length} entries</p>
                        <div className="flex gap-2">
                            <button className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50" disabled>Previous</button>
                            <button className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50" disabled>Next</button>
                        </div>
                    </div>
                </div>

                {/* Edit Disbursement Form Modal */}
                <EditDisbursementForm
                    isOpen={isEditDisbursementModalOpen}
                    onClose={() => {
                        setIsEditDisbursementModalOpen(false);
                        setSelectedDisbursement(null);
                    }}
                    onSubmit={handleEditDisbursementSubmit}
                    disbursement={selectedDisbursement}
                    lead={leads.find(lead => lead._id === selectedLeadId)}
                    loading={false}
                />

                {/* Delete Confirmation Modal */}
                {isDeleteConfirmOpen && disbursementToDelete && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                        <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                            <div className="p-6">
                                <div className="flex items-center justify-center w-12 h-12 mx-auto bg-red-100 rounded-full mb-4">
                                    <Trash2 className="w-6 h-6 text-red-600" />
                                </div>
                                <h3 className="text-lg font-semibold text-center text-gray-900 mb-2">
                                    Delete Disbursement Entry
                                </h3>
                                <p className="text-gray-600 text-center mb-6">
                                    Are you sure you want to delete this disbursement entry? This action cannot be undone.
                                </p>
                                <div className="bg-gray-50 rounded-lg p-4 mb-6">
                                    <div className="grid grid-cols-2 gap-4 text-sm">
                                        <div>
                                            <p className="text-gray-600">Date</p>
                                            <p className="font-medium">{new Date(disbursementToDelete.date).toLocaleDateString()}</p>
                                        </div>
                                        <div>
                                            <p className="text-gray-600">Amount</p>
                                            <p className="font-medium text-red-600">{formatCurrency(disbursementToDelete.amount)}</p>
                                        </div>
                                        <div>
                                            <p className="text-gray-600">UTR</p>
                                            <p className="font-medium">{disbursementToDelete.utr}</p>
                                        </div>
                                        <div>
                                            <p className="text-gray-600">Commission</p>
                                            <p className="font-medium">{formatCurrency(disbursementToDelete.commission || 0)}</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex justify-end space-x-3">
                                    <button
                                        onClick={() => setIsDeleteConfirmOpen(false)}
                                        className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleDeleteDisbursementConfirm}
                                        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center space-x-2"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                        <span>Delete</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
                <DisbursementForm
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    onSubmit={handleSaveDisbursement}
                    lead={leads.find(l => (l._id || l.id) === selectedLeadId)}
                    loading={false}
                />

                {/* View Lead Modal */}
                {isViewModalOpen && viewLeadData && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                        <div className="bg-white rounded-3xl w-full max-w-4xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
                            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gradient-to-r from-blue-50 to-indigo-50">
                                <div>
                                    <h3 className="text-xl font-bold text-gray-900">Lead Details</h3>
                                    <p className="text-sm text-gray-500">Complete information for {viewLeadData.customerName}</p>
                                </div>
                                <button onClick={() => setIsViewModalOpen(false)} className="p-2 hover:bg-white rounded-full transition-colors text-gray-500 hover:text-gray-900">
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="p-6 space-y-6">
                                {/* Customer Information */}
                                <div className="bg-gray-50 rounded-2xl p-5 border border-gray-200">
                                    <h4 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-4 flex items-center gap-2">
                                        <User size={16} className="text-primary-600" />
                                        Customer Information
                                    </h4>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-xs font-semibold text-gray-500">Lead ID</label>
                                            <p className="text-sm font-medium text-gray-900 mt-1">{viewLeadData.leadId}</p>
                                        </div>
                                        <div>
                                            <label className="text-xs font-semibold text-gray-500">Customer Name</label>
                                            <p className="text-sm font-medium text-gray-900 mt-1">{viewLeadData.customerName}</p>
                                        </div>
                                        <div>
                                            <label className="text-xs font-semibold text-gray-500">Contact Number</label>
                                            <p className="text-sm font-medium text-gray-900 mt-1">{viewLeadData.contactNumber}</p>
                                        </div>
                                        <div>
                                            <label className="text-xs font-semibold text-gray-500">Email</label>
                                            <p className="text-sm font-medium text-gray-900 mt-1">{viewLeadData.email}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Loan Information */}
                                <div className="bg-gray-50 rounded-2xl p-5 border border-gray-200">
                                    <h4 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-4 flex items-center gap-2">
                                        <CreditCard size={16} className="text-primary-600" />
                                        Loan Information
                                    </h4>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-xs font-semibold text-gray-500">Loan Account No</label>
                                            <p className="text-sm font-medium text-gray-900 mt-1">{viewLeadData.loanAccountNo}</p>
                                        </div>
                                        <div>
                                            <label className="text-xs font-semibold text-gray-500">Loan Type</label>
                                            <p className="text-sm font-medium text-gray-900 mt-1">{viewLeadData.loanType}</p>
                                        </div>
                                        <div>
                                            <label className="text-xs font-semibold text-gray-500">Loan Amount</label>
                                            <p className="text-sm font-bold text-gray-900 mt-1">{formatCurrency(viewLeadData.loanAmount || viewLeadData.amount)}</p>
                                        </div>
                                        <div>
                                            <label className="text-xs font-semibold text-gray-500">Status</label>
                                            <p className="mt-1">
                                                <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${getStatusColor(viewLeadData.status)}`}>
                                                    {viewLeadData.status}
                                                </span>
                                            </p>
                                        </div>
                                        <div>
                                            <label className="text-xs font-semibold text-gray-500">Bank Name</label>
                                            <p className="text-sm font-medium text-gray-900 mt-1">{viewLeadData.bankName}</p>
                                        </div>
                                        <div>
                                            <label className="text-xs font-semibold text-gray-500">Commission %</label>
                                            <p className="text-sm font-medium text-gray-900 mt-1">{viewLeadData.commissionPercent}%</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Agent & Banker Information */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-gray-50 rounded-2xl p-5 border border-gray-200">
                                        <h4 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-4">Agent Details</h4>
                                        <div className="space-y-3">
                                            <div>
                                                <label className="text-xs font-semibold text-gray-500">Agent Name</label>
                                                <p className="text-sm font-medium text-gray-900 mt-1">{viewLeadData.agentName}</p>
                                            </div>
                                            <div>
                                                <label className="text-xs font-semibold text-gray-500">Contact</label>
                                                <p className="text-sm font-medium text-gray-900 mt-1">{viewLeadData.agentContact}</p>
                                            </div>
                                            <div>
                                                <label className="text-xs font-semibold text-gray-500">DSA Code</label>
                                                <p className="text-sm font-medium text-gray-900 mt-1">{viewLeadData.dsaCode}</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="bg-gray-50 rounded-2xl p-5 border border-gray-200">
                                        <h4 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-4">Banker Details</h4>
                                        <div className="space-y-3">
                                            <div>
                                                <label className="text-xs font-semibold text-gray-500">Banker Name</label>
                                                <p className="text-sm font-medium text-gray-900 mt-1">{viewLeadData.banker.name}</p>
                                            </div>
                                            <div>
                                                <label className="text-xs font-semibold text-gray-500">Contact</label>
                                                <p className="text-sm font-medium text-gray-900 mt-1">{viewLeadData.banker.contact}</p>
                                            </div>
                                            <div>
                                                <label className="text-xs font-semibold text-gray-500">Branch</label>
                                                <p className="text-sm font-medium text-gray-900 mt-1">{viewLeadData.banker.branch}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Additional Details */}
                                <div className="bg-gray-50 rounded-2xl p-5 border border-gray-200">
                                    <h4 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-4">Additional Information</h4>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-xs font-semibold text-gray-500">Assigned Date</label>
                                            <p className="text-sm font-medium text-gray-900 mt-1">{viewLeadData.assignedDate}</p>
                                        </div>
                                        <div>
                                            <label className="text-xs font-semibold text-gray-500">Approval Date</label>
                                            <p className="text-sm font-medium text-gray-900 mt-1">{viewLeadData.approvalDate}</p>
                                        </div>
                                        <div className="col-span-2">
                                            <label className="text-xs font-semibold text-gray-500">Remark</label>
                                            <p className="text-sm font-medium text-gray-900 mt-1">{viewLeadData.remark}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="p-6 border-t border-gray-100 bg-gray-50">
                                <button
                                    onClick={() => setIsViewModalOpen(false)}
                                    className="w-full py-3 px-4 bg-primary-900 text-white rounded-xl text-sm font-bold hover:bg-primary-800 shadow-lg shadow-primary-900/10 transition-all"
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Edit Lead Modal */}
                <Modal
                    isOpen={isEditModalOpen}
                    onClose={() => {
                        setIsEditModalOpen(false);
                        setSelectedLead(null);
                    }}
                    title="Edit Lead"
                >
                    <LeadForm lead={selectedLead} onSave={handleSaveEdit} onClose={() => setIsEditModalOpen(false)} />
                </Modal>

                {/* Delete Lead Confirmation Modal */}
                <ConfirmModal
                    isOpen={confirmDeleteLead.isOpen}
                    onClose={() => setConfirmDeleteLead({ isOpen: false, lead: null })}
                    onConfirm={handleDeleteLeadConfirm}
                    title="Delete Lead"
                    message={`Are you sure you want to delete lead "${confirmDeleteLead.lead?.leadId || confirmDeleteLead.lead?.customerName || 'this lead'}"? This action cannot be undone.`}
                    confirmText="Delete"
                    cancelText="Cancel"
                    type="danger"
                />

                {/* Disbursement Email Modal */}
                <DisbursementEmailModal
                    isOpen={isDisbursementEmailModalOpen}
                    onClose={() => {
                        setIsDisbursementEmailModalOpen(false);
                        setSelectedLeadForEmail(null);
                    }}
                    leadId={selectedLeadForEmail?._id || selectedLeadForEmail?.id}
                />

            </div>
        </div>
    );
};

export default AccountantLeads;
