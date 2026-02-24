import { useEffect, useState, useMemo } from 'react';
import api from '../services/api';
import { toast } from '../services/toastService';
import { authService } from '../services/auth.service';

const NEW_LEAD_OPTION = 'new_lead';

// Simple mapping of loan types for legacy form
const LOAN_TYPES = [
  { value: 'personal_loan', label: 'Personal' },
  { value: 'home_loan', label: 'Home' },
  { value: 'business_loan', label: 'Business' },
  { value: 'car_loan', label: 'Car' },
  { value: 'education_loan', label: 'Education' },
];

export default function LeadForm({ lead = null, onSave, onClose }) {
  const userRole = authService.getUser()?.role || '';
  const isAgent = userRole === 'agent';
  const isAdmin = userRole === 'super_admin';
  const isAccountant = userRole === 'accounts_manager';
  const isRelationshipManager = userRole === 'relationship_manager';
  const isFranchise = userRole === 'franchise';
  const canSetCommission = isAdmin || isAccountant || isRelationshipManager || isFranchise;

  const [banks, setBanks] = useState([]);
  const [selectedBank, setSelectedBank] = useState(() => {
    if (lead?.leadType === 'new_lead') return NEW_LEAD_OPTION;
    return lead?.bank?._id || lead?.bank || '';
  });
  const [leadFormDef, setLeadFormDef] = useState(null);
  const [loadingFormDef, setLoadingFormDef] = useState(false);

  const [formValues, setFormValues] = useState(() => ({ ...lead?.formValues }));
  const [standard, setStandard] = useState(() => {
    const leadFormValues = lead?.formValues || {};
    return {
      bankId: lead?.bank?._id || lead?.bank || '',
      customerName: lead?.customerName || lead?.leadName || leadFormValues.customerName || leadFormValues.leadName || '',
      leadName: lead?.leadName || lead?.customerName || leadFormValues.leadName || leadFormValues.customerName || '',
      applicantEmail: lead?.applicantEmail || lead?.email || leadFormValues.email || leadFormValues.applicantEmail || '',
      applicantMobile: lead?.applicantMobile || lead?.phone || lead?.mobile || leadFormValues.mobile || leadFormValues.applicantMobile || '',
      address: lead?.address || leadFormValues.address || '',
      loanType: lead?.loanType || leadFormValues.loanType || '',
      loanAmount: lead?.loanAmount || leadFormValues.loanAmount || '',
      branch: lead?.branch || leadFormValues.branch || '',
      loanAccountNo: lead?.loanAccountNo || leadFormValues.loanAccountNo || leadFormValues.loanAccountNumber || '',
      dsaCode: lead?.dsaCode || lead?.codeUse || leadFormValues.dsaCode || leadFormValues.codeUse || '',
      remarks: lead?.remarks || leadFormValues.remark || leadFormValues.remarks || '',
      smBmEmail: lead?.smBmEmail || leadFormValues.smBmEmail || '',
      smBmMobile: lead?.smBmMobile || leadFormValues.smBmMobile || '',
      commissionPercentage: lead?.commissionPercentage !== undefined && lead?.commissionPercentage !== null ? lead.commissionPercentage : '',
      commissionAmount: lead?.commissionAmount !== undefined && lead?.commissionAmount !== null ? lead.commissionAmount : '',
    };
  });

  // When editing new_lead, RM can assign bank - track it separately for the "Assign Bank" section
  const [assignBankId, setAssignBankId] = useState(lead?.bank?._id || lead?.bank || '');

  // Agent assignment for relationship managers
  const [agents, setAgents] = useState([]);
  const [loadingAgents, setLoadingAgents] = useState(false);
  const currentUser = authService.getUser();
  const [selectedAgentId, setSelectedAgentId] = useState(() => {
    if (lead?.agent) {
      return lead.agent._id || lead.agent || '';
    }
    // Default to 'self' for relationship managers and franchise owners
    return (isRelationshipManager || isFranchise) ? 'self' : '';
  });
  const isSelfSelected = selectedAgentId === 'self';
  // Allow franchise to set commission even when assigned to self
  const canSetCommissionForSelf = isFranchise;

  // Sub-agent selection for agents
  const [subAgents, setSubAgents] = useState([]);
  const [loadingSubAgents, setLoadingSubAgents] = useState(false);
  const [selectedSubAgentId, setSelectedSubAgentId] = useState(() => {
    if (lead?.subAgent) {
      return lead.subAgent._id || lead.subAgent || '';
    }
    return '';
  });

  const [documentTypes, setDocumentTypes] = useState(() => (lead?.documentTypes || []));
  const [uploadedDocs, setUploadedDocs] = useState(() => (lead?.documents || []));
  const [uploading, setUploading] = useState(false);

  // temp id for pre-uploading docs before lead is created
  const tempEntityId = useMemo(() => `temp-${Date.now()}-${Math.round(Math.random() * 1e6)}`, []);

  useEffect(() => {
    const load = async () => {
      try {
        const resp = await api.banks.getAll();
        setBanks(resp?.data || []);
      } catch (err) {
        console.error('Failed to load banks', err);
      }
    };
    load();
  }, []);

  // Fetch agents for all roles (except agents themselves)
  useEffect(() => {
    const loadAgents = async () => {
      if (isAgent || lead) return; // Skip for agents and when editing
      try {
        setLoadingAgents(true);
        const resp = await api.agents.getAll();
        const agentsData = resp?.data || resp || [];
        setAgents(Array.isArray(agentsData) ? agentsData : []);
      } catch (err) {
        console.error('Failed to load agents', err);
        setAgents([]);
      } finally {
        setLoadingAgents(false);
      }
    };
    loadAgents();
  }, [isAgent, lead]);

  // Fetch sub-agents for agents when creating leads
  useEffect(() => {
    const loadSubAgents = async () => {
      if (!isAgent || lead) return; // Only for agents creating new leads
      try {
        setLoadingSubAgents(true);
        const resp = await api.subAgents.getAll();
        const subAgentsData = resp?.data || resp || [];
        setSubAgents(Array.isArray(subAgentsData) ? subAgentsData : []);
      } catch (err) {
        console.error('Failed to load sub-agents', err);
        setSubAgents([]);
      } finally {
        setLoadingSubAgents(false);
      }
    };
    loadSubAgents();
  }, [isAgent, lead]);

  useEffect(() => {
    // when bank/leadType changes, load lead form
    const loadLeadForm = async () => {
      if (!selectedBank) {
        setLeadFormDef(null);
        return;
      }
      try {
        setLoadingFormDef(true);
        const resp = selectedBank === NEW_LEAD_OPTION
          ? await api.leadForms.getNewLeadForm()
          : await api.leadForms.getByBank(selectedBank);
        const data = resp?.data || null;
        // normalize field flags (ensure `required` is boolean even if backend returns strings)
        const normalized = data
          ? {
            ...data,
            fields: (data.fields || []).map((f) => ({
              ...f,
              required: !!(f.required === true || f.required === 'true' || f.required === 1 || f.required === '1'),
            })),
            agentFields: (data.agentFields || []).map((f) => ({
              ...f,
              required: !!(f.required === true || f.required === 'true' || f.required === 1 || f.required === '1'),
            })),
          }
          : null;
        setLeadFormDef(normalized);
        setDocumentTypes(normalized?.documentTypes || []);
        // if lead has formValues, keep; else reset
        if (!lead) {
          setFormValues({});
        }
      } catch (err) {
        console.error('Failed to load lead form for bank', err);
        setLeadFormDef(null);
        setDocumentTypes([]);
      } finally {
        setLoadingFormDef(false);
      }
    };
    loadLeadForm();
  }, [selectedBank]);

  const handleFieldChange = (key, value) => {
    setFormValues((p) => ({ ...(p || {}), [key]: value }));
    // Synchronize with standard state if key matches a standard field
    if (Object.keys(standard).includes(key)) {
      setStandard((p) => ({ ...p, [key]: value }));
    }
  };

  const handleStandardChange = (k, v) => {
    setStandard((p) => {
      const updated = { ...p, [k]: v };
      
      // Auto-calculate commission amount when percentage is filled
      if (k === 'commissionPercentage' && v && p.loanAmount) {
        const loanAmount = parseFloat(p.loanAmount) || 0;
        const percentage = parseFloat(v) || 0;
        if (loanAmount > 0 && percentage >= 0 && percentage <= 100) {
          updated.commissionAmount = ((loanAmount * percentage) / 100).toFixed(2);
        }
      }
      
      // Auto-calculate commission percentage when amount is filled
      if (k === 'commissionAmount' && v && p.loanAmount) {
        const loanAmount = parseFloat(p.loanAmount) || 0;
        const amount = parseFloat(v) || 0;
        if (loanAmount > 0 && amount >= 0) {
          updated.commissionPercentage = ((amount / loanAmount) * 100).toFixed(2);
        }
      }
      
      // Auto-recalculate commission amount when loan amount changes (if percentage exists)
      if (k === 'loanAmount' && v && p.commissionPercentage) {
        const loanAmount = parseFloat(v) || 0;
        const percentage = parseFloat(p.commissionPercentage) || 0;
        if (loanAmount > 0 && percentage >= 0 && percentage <= 100) {
          updated.commissionAmount = ((loanAmount * percentage) / 100).toFixed(2);
        }
      }
      
      return updated;
    });
    if (k === 'bankId') setSelectedBank(v);
  };

  const handleFileSelect = async (file, docTypeKey, description = '') => {
    if (!file || !docTypeKey) return;
    try {
      setUploading(true);
      const fd = new FormData();
      fd.append('file', file);
      fd.append('entityType', 'lead');
      // upload against temporary id so we can provide URL in create payload
      fd.append('entityId', tempEntityId);
      fd.append('documentType', docTypeKey);
      fd.append('description', description || '');
      const resp = await api.documents.upload(fd);
      const doc = resp?.data;
      if (doc) {
        setUploadedDocs((p) => [...(p || []), { documentType: docTypeKey, url: doc.url || doc.filePath || '', meta: doc }]);
        toast.success('Uploaded', 'Document uploaded');
      } else {
        toast.error('Upload failed', 'No response data');
      }
    } catch (err) {
      console.error('Upload error', err);
      toast.error('Upload failed', err.message || '');
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveUploaded = (index) => {
    setUploadedDocs((p) => p.filter((_, i) => i !== index));
  };

  const validateAndSubmit = async () => {
    const isNewLead = selectedBank === NEW_LEAD_OPTION || leadFormDef?.leadType === 'new_lead';

    // Agent selection required for relationship managers and franchise owners creating new leads
    if ((isRelationshipManager || isFranchise) && !lead && (!selectedAgentId || selectedAgentId === '')) {
      return toast.error('Please select an agent to assign this lead to');
    }

    // Bank required only for bank-type leads
    if (!isNewLead && !standard.bankId) return toast.error('Bank is required');

    // For agents: If a bank/newLead is selected but no form exists, and it's not currently loading, that's an error state
    // For non-agents: They don't need leadFormDef, they use standard fields
    if (isAgent && !leadFormDef && !loadingFormDef && selectedBank) {
      return toast.error(isNewLead ? 'No New Lead form configured. Ask Admin to set up in Lead Forms.' : 'No Lead Form configured for this bank');
    }

    // Validate commission fields only for bank-type leads (Admin/Accountant/Relationship Manager/Franchise)
    // But skip validation if RM assigned lead to self (Franchise can set commission even when assigned to self)
    if (canSetCommission && !isNewLead && !(isRelationshipManager && isSelfSelected && !canSetCommissionForSelf)) {
      // When creating, both fields are required
      if (!lead) {
        if (!standard.commissionPercentage || standard.commissionPercentage === '') {
          return toast.error('Commission Percentage is required');
        }
        if (!standard.commissionAmount || standard.commissionAmount === '') {
          return toast.error('Commission Amount is required');
        }
      }
      // Validate numeric values if provided
      if (standard.commissionPercentage && standard.commissionPercentage !== '') {
        if (isNaN(parseFloat(standard.commissionPercentage)) || parseFloat(standard.commissionPercentage) < 0 || parseFloat(standard.commissionPercentage) > 100) {
          return toast.error('Commission Percentage must be between 0 and 100');
        }
      }
      if (standard.commissionAmount && standard.commissionAmount !== '') {
        if (isNaN(parseFloat(standard.commissionAmount)) || parseFloat(standard.commissionAmount) < 0) {
          return toast.error('Commission Amount must be a positive number');
        }
      }

      // Validate franchise commission limits (only for franchise users)
      if (isFranchise && standard.bankId) {
        try {
          const limitResponse = await api.franchiseCommissionLimits.getByBank(standard.bankId);
          const commissionLimit = limitResponse.data;

          if (commissionLimit) {
            let exceedsLimit = false;
            let errorMessage = '';

            if (commissionLimit.limitType === 'percentage') {
              const franchisePercentage = standard.commissionPercentage ? parseFloat(standard.commissionPercentage) : 0;
              if (franchisePercentage > commissionLimit.maxCommissionValue) {
                exceedsLimit = true;
                errorMessage = `Commission cannot exceed Admin maximum limit of ${commissionLimit.maxCommissionValue}%`;
              }
            } else if (commissionLimit.limitType === 'amount') {
              const franchiseAmount = standard.commissionAmount ? parseFloat(standard.commissionAmount) : 0;
              if (franchiseAmount > commissionLimit.maxCommissionValue) {
                exceedsLimit = true;
                errorMessage = `Commission cannot exceed Admin maximum limit of ₹${commissionLimit.maxCommissionValue.toLocaleString()}`;
              }
            }

            if (exceedsLimit) {
              return toast.error('Commission Limit Exceeded', errorMessage);
            }
          }
        } catch (error) {
          console.error('Error checking franchise commission limit:', error);
          // Don't block submission if limit check fails, but log the error
        }
      }
    }

    // For agents: If leadFormDef exists, validate required fields
    // For non-agents: Validate standard required fields
    if (isAgent && leadFormDef) {
      const fieldsToValidate = leadFormDef.agentFields && leadFormDef.agentFields.length > 0 
        ? leadFormDef.agentFields 
        : (leadFormDef.fields || []);
      const missing = [];
      fieldsToValidate.forEach((f) => {
        if (f.required) {
          const val = formValues?.[f.key] ?? standard[f.key];
          if (val === undefined || val === null || val === '') missing.push(f.label || f.key);
        }
      });
      const missingDocs = [];
      (leadFormDef.documentTypes || []).forEach((dt) => {
        if (dt.required) {
          const found = (uploadedDocs || []).find((d) => d.documentType === dt.key && d.url);
          if (!found) missingDocs.push(dt.name || dt.key);
        }
      });
      if (missing.length > 0) {
        return toast.error(`Required fields missing: ${missing.join(', ')}`);
      }
      if (missingDocs.length > 0) {
        return toast.error(`Required documents missing: ${missingDocs.join(', ')}`);
      }
    } else if (!isAgent && !isNewLead) {
      // For non-agents creating/editing bank leads: validate standard required fields
      if (!standard.customerName || standard.customerName.trim() === '') {
        return toast.error('Customer Name is required');
      }
      // When editing, check if original lead has mobile; if not, validate it's provided
      const originalMobile = lead?.applicantMobile || lead?.phone || lead?.mobile || lead?.formValues?.mobile || lead?.formValues?.applicantMobile;
      if ((!standard.applicantMobile || standard.applicantMobile.trim() === '') && (!lead || !originalMobile)) {
        return toast.error('Mobile is required');
      }
      if (!standard.dsaCode || standard.dsaCode.trim() === '') {
        return toast.error('DSA Code is required');
      }
      if (!standard.remarks || standard.remarks.trim() === '') {
        return toast.error('Remark is required');
      }
      if (!standard.loanType || standard.loanType.trim() === '') {
        return toast.error('Loan Type is required');
      }
      if (!standard.loanAmount || standard.loanAmount <= 0) {
        return toast.error('Loan Amount must be greater than 0');
      }
    }

    const payload = {
      leadType: isNewLead ? 'new_lead' : 'bank',
      bankId: isNewLead ? undefined : standard.bankId,
      bank: isNewLead ? undefined : standard.bankId,
      leadForm: (isAgent && leadFormDef) ? leadFormDef._id : undefined,
      formValues: (isAgent && leadFormDef) ? formValues : undefined,
      documents: (uploadedDocs || []).map((d) => ({ documentType: d.documentType, url: d.url })),
    };

    // Add sub-agent assignment for agents
    if (isAgent && selectedSubAgentId && selectedSubAgentId !== '') {
      payload.subAgent = selectedSubAgentId;
    }

    // Add agent assignment for relationship managers and franchise owners
    if ((isRelationshipManager || isFranchise) && selectedAgentId && selectedAgentId !== '') {
      payload.agent = selectedAgentId === 'self' ? currentUser._id || currentUser.id : selectedAgentId;
    }

    // Standard fields for non-agents
    if (!isAgent) {
      payload.customerName = standard.customerName?.trim() || standard.leadName?.trim() || undefined;
      payload.leadName = standard.leadName?.trim() || standard.customerName?.trim() || undefined;
      payload.applicantEmail = standard.applicantEmail?.trim() || undefined;
      // When editing, preserve original mobile if form field is empty
      const originalMobile = lead?.applicantMobile || lead?.phone || lead?.mobile || lead?.formValues?.mobile || lead?.formValues?.applicantMobile;
      payload.applicantMobile = standard.applicantMobile?.trim() || (lead && originalMobile ? originalMobile : undefined);
      payload.address = standard.address?.trim() || undefined;
      payload.branch = standard.branch?.trim() || undefined;
      payload.loanAccountNo = standard.loanAccountNo?.trim() || undefined;
      payload.dsaCode = standard.dsaCode?.trim() || undefined;
      payload.remarks = standard.remarks?.trim() || undefined;
      payload.smBmEmail = standard.smBmEmail?.trim() || undefined;
      payload.smBmMobile = standard.smBmMobile?.trim() || undefined;
    }

    // Bank-specific fields only for bank-type leads
    if (!isNewLead) {
      payload.loanType = standard.loanType || formValues?.loanType || undefined;
      payload.loanAmount = (standard.loanAmount || formValues?.loanAmount) ? Number(standard.loanAmount || formValues?.loanAmount) : undefined;
      // Only set commission if not assigned to self (except for franchise)
      if (canSetCommission && !(isRelationshipManager && isSelfSelected && !canSetCommissionForSelf)) {
        payload.commissionPercentage = (standard.commissionPercentage !== undefined && standard.commissionPercentage !== null && standard.commissionPercentage !== '') 
          ? parseFloat(standard.commissionPercentage) 
          : (standard.commissionPercentage === 0 ? 0 : undefined);
        payload.commissionAmount = (standard.commissionAmount !== undefined && standard.commissionAmount !== null && standard.commissionAmount !== '') 
          ? parseFloat(standard.commissionAmount) 
          : (standard.commissionAmount === 0 ? 0 : undefined);
      }
    } else if (lead && isNewLead && assignBankId) {
      // RM editing new_lead: allow adding bank and bank-specific fields
      payload.bankId = assignBankId;
      payload.bank = assignBankId;
      payload.loanType = standard.loanType || formValues?.loanType || undefined;
      payload.loanAmount = (standard.loanAmount || formValues?.loanAmount) ? Number(standard.loanAmount || formValues?.loanAmount) : undefined;
      payload.loanAccountNo = standard.loanAccountNo || formValues?.loanAccountNo || undefined;
      payload.branch = standard.branch || formValues?.branch || undefined;
      // Only set commission if not assigned to self (except for franchise)
      if (canSetCommission && !(isRelationshipManager && isSelfSelected && !canSetCommissionForSelf)) {
        payload.commissionPercentage = (standard.commissionPercentage !== undefined && standard.commissionPercentage !== null && standard.commissionPercentage !== '') 
          ? parseFloat(standard.commissionPercentage) 
          : (standard.commissionPercentage === 0 ? 0 : undefined);
        payload.commissionAmount = (standard.commissionAmount !== undefined && standard.commissionAmount !== null && standard.commissionAmount !== '') 
          ? parseFloat(standard.commissionAmount) 
          : (standard.commissionAmount === 0 ? 0 : undefined);
      }
    }

    // Pass to parent
    if (onSave) onSave(payload);
  };

  const isNewLead = selectedBank === NEW_LEAD_OPTION || leadFormDef?.leadType === 'new_lead';

  return (
    <div className="space-y-6">
      <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 shadow-sm">
        <label className="block text-sm font-bold text-gray-700 mb-2">
          {isNewLead ? 'Lead Type' : 'Select Bank'} {!isNewLead && '*'}
        </label>
        <select
          value={selectedBank}
          onChange={(e) => {
            const v = e.target.value;
            setSelectedBank(v);
            setStandard((p) => ({ ...p, bankId: v === NEW_LEAD_OPTION ? '' : v }));
          }}
          className="w-full px-4 py-3 border-2 border-primary-100 rounded-lg focus:border-primary-500 transition-colors bg-white text-lg font-medium"
        >
          <option value="">-- Choose Lead Type or Bank --</option>
          <option value={NEW_LEAD_OPTION}>New Lead</option>
          {banks.map((b) => (
            <option key={b._id || b.id} value={b._id || b.id}>{b.name}</option>
          ))}
        </select>
      </div>

      {!selectedBank && !lead && (
        <div className="text-center py-10 border-2 border-dashed border-gray-200 rounded-xl bg-white">
          <p className="text-gray-500 font-medium">Please select New Lead or a bank to load the form.</p>
        </div>
      )}

      {selectedBank && (
        <>
          {loadingFormDef && isAgent ? (
            <div className="py-12 text-center text-gray-600 font-medium whitespace-nowrap overflow-hidden">
              <div className="animate-pulse inline-block">Loading form configuration...</div>
            </div>
          ) : (isAgent && leadFormDef) ? (
            <div className="space-y-8 p-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Sub-Agent Selection Dropdown - For agents when creating new leads */}
                {isAgent && !lead && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                      Select Sub Agent (Optional)
                    </label>
                    <select
                      value={selectedSubAgentId}
                      onChange={(e) => setSelectedSubAgentId(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                      disabled={loadingSubAgents}
                    >
                      <option value="">-- Select Sub Agent --</option>
                      {subAgents.map((subAgent) => (
                        <option key={subAgent._id || subAgent.id} value={subAgent._id || subAgent.id}>
                          {subAgent.name || subAgent.email || 'Unknown Sub Agent'}
                        </option>
                      ))}
                    </select>
                    {loadingSubAgents && (
                      <p className="text-sm text-gray-500 mt-1">Loading sub-agents...</p>
                    )}
                    {!loadingSubAgents && subAgents.length === 0 && (
                      <p className="text-sm text-gray-500 mt-1">No sub-agents available. Create sub-agents from Sub Agents page.</p>
                    )}
                  </div>
                )}
                {((leadFormDef.agentFields && leadFormDef.agentFields.length > 0) 
                  ? leadFormDef.agentFields 
                  : (leadFormDef.fields || []))
                  .filter((f) => {
                    const key = (f.key || '').toLowerCase();
                    const label = (f.label || '').toLowerCase();

                    // For New Lead: show all fields admin selected (including leadName, customerName)
                    if (isNewLead) return true;

                    // For bank forms: exclude system-handled fields
                    const excludedKeys = [
                      'applicantEmail', 'applicantMobile', 'customerName', 'leadName',
                      'asmName', 'asmEmail', 'asmMobile',
                      'smBmName', 'smBmEmail', 'smBmMobile',
                      'salary', 'Salary'
                    ];
                    if (excludedKeys.some(excluded => key === excluded.toLowerCase() || label.includes(excluded.toLowerCase()))) {
                      return false;
                    }
                    return true;
                  })
                  .filter((f, index, array) => {
                    // Remove duplicate DSA Code fields - keep only the first one
                    const key = (f.key || '').toLowerCase();
                    const label = (f.label || '').toLowerCase();
                    const isDsaCode = key === 'dsacode' || key === 'dsa_code' || key === 'codeuse' || label.includes('dsa code');
                    
                    if (isDsaCode) {
                      // Keep only the first DSA Code field found (by original array order)
                      const firstDsaIndex = array.findIndex((item) => {
                        const itemKey = (item.key || '').toLowerCase();
                        const itemLabel = (item.label || '').toLowerCase();
                        return itemKey === 'dsacode' || itemKey === 'dsa_code' || itemKey === 'codeuse' || itemLabel.includes('dsa code');
                      });
                      return index === firstDsaIndex;
                    }
                    
                    return true;
                  })
                  .sort((a, b) => (a.order || 0) - (b.order || 0))
                  .map((f) => {
                  const val = formValues?.[f.key] ?? standard[f.key] ?? '';
                  const inputClass = "w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none";
                  return (
                    <div key={f.key}>
                      <label className="block text-sm font-semibold text-gray-700 mb-1.5">{f.label}{f.required && ' *'}</label>
                      {f.type === 'select' ? (
                        <select value={val} onChange={(e) => handleFieldChange(f.key, e.target.value)} className={inputClass}>
                          <option value="">-- select --</option>
                          {(f.options || []).map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                      ) : f.type === 'textarea' ? (
                        <textarea value={val} onChange={(e) => handleFieldChange(f.key, e.target.value)} className={inputClass} />
                      ) : (
                        <input type={f.type || 'text'} value={val} onChange={(e) => handleFieldChange(f.key, e.target.value)} className={inputClass} />
                      )}
                    </div>
                  );
                })}
              </div>
              {(leadFormDef.documentTypes || []).length > 0 && (
                <div className="border-t pt-6 space-y-4">
                  <h5 className="font-bold text-gray-800">Required Documents</h5>
                  {(leadFormDef.documentTypes || []).map(dt => (
                    <div key={dt.key} className="flex items-center justify-between p-3 border rounded-lg bg-gray-50">
                      <span className="text-sm font-medium">{dt.name}{dt.required && ' *'}</span>
                      <div className="flex items-center gap-2">
                        <input type="file" className="hidden" id={`file-${dt.key}`} onChange={(e) => handleFileSelect(e.target.files?.[0], dt.key, dt.name)} />
                        <label htmlFor={`file-${dt.key}`} className="px-3 py-1 bg-white border rounded text-xs cursor-pointer hover:bg-gray-100">Upload</label>
                        {uploadedDocs.filter(d => d.documentType === dt.key).map((d, i) => (
                          <div key={i} className="text-xs text-green-600 font-bold">Uploaded</div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : !isAgent ? (
            // Non-agents see standard fields
            <div className="space-y-8 p-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Agent Assignment Dropdown - For all roles except agents when creating new leads */}
                {!isAgent && !lead && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                      Assign Agent *
                    </label>
                    <select
                      value={selectedAgentId}
                      onChange={(e) => setSelectedAgentId(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                      disabled={loadingAgents}
                    >
                      <option value="">-- Select Agent --</option>
                      {(isRelationshipManager || isFranchise) && (
                        <option value="self">Self ({currentUser?.name || 'Me'})</option>
                      )}
                      {agents.map((agent) => (
                        <option key={agent._id || agent.id} value={agent._id || agent.id}>
                          {agent.name || agent.email || 'Unknown Agent'}
                        </option>
                      ))}
                    </select>
                    {loadingAgents && (
                      <p className="text-sm text-gray-500 mt-1">Loading agents...</p>
                    )}
                  </div>
                )}

                {/* Customer Name */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    Customer Name {!isNewLead && '*'}
                  </label>
                  <input
                    type="text"
                    value={standard.customerName || ''}
                    onChange={(e) => handleStandardChange('customerName', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                    required={!isNewLead}
                  />
                </div>

                {/* Applicant Email */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Email</label>
                  <input
                    type="email"
                    value={standard.applicantEmail || ''}
                    onChange={(e) => handleStandardChange('applicantEmail', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                  />
                </div>

                {/* Applicant Mobile */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    Mobile {!isNewLead && '*'}
                  </label>
                  <input
                    type="tel"
                    value={standard.applicantMobile || ''}
                    onChange={(e) => handleStandardChange('applicantMobile', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                    required={!isNewLead}
                  />
                </div>

                {/* Loan Type - only for bank leads */}
                {!isNewLead && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Loan Type *</label>
                    <select
                      value={standard.loanType || ''}
                      onChange={(e) => handleStandardChange('loanType', e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                      required
                    >
                      <option value="">-- select --</option>
                      {LOAN_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </div>
                )}

                {/* Loan Amount - only for bank leads */}
                {!isNewLead && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Loan Amount *</label>
                    <input
                      type="number"
                      value={standard.loanAmount || ''}
                      onChange={(e) => handleStandardChange('loanAmount', e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                      placeholder="0"
                      required
                      min="0"
                    />
                  </div>
                )}

                {/* Branch - only for bank leads */}
                {!isNewLead && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Branch</label>
                    <input
                      type="text"
                      value={standard.branch || ''}
                      onChange={(e) => handleStandardChange('branch', e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                    />
                  </div>
                )}

                {/* Loan Account No - only for bank leads */}
                {!isNewLead && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Loan Account No</label>
                    <input
                      type="text"
                      value={standard.loanAccountNo || ''}
                      onChange={(e) => handleStandardChange('loanAccountNo', e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                    />
                  </div>
                )}

                {/* Lead Name */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Lead Name</label>
                  <input
                    type="text"
                    value={standard.leadName || ''}
                    onChange={(e) => handleStandardChange('leadName', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                  />
                </div>

                {/* DSA Code - required for bank leads */}
                {!isNewLead && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">DSA Code *</label>
                    <input
                      type="text"
                      value={standard.dsaCode || ''}
                      onChange={(e) => handleStandardChange('dsaCode', e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                      required
                    />
                  </div>
                )}

                {/* SM/BM Email - only for bank leads */}
                {!isNewLead && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">SM/BM Email</label>
                    <input
                      type="email"
                      value={standard.smBmEmail || ''}
                      onChange={(e) => handleStandardChange('smBmEmail', e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                    />
                  </div>
                )}

                {/* SM/BM Mobile - only for bank leads */}
                {!isNewLead && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">SM/BM Mobile</label>
                    <input
                      type="tel"
                      value={standard.smBmMobile || ''}
                      onChange={(e) => handleStandardChange('smBmMobile', e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                    />
                  </div>
                )}
              </div>

              {/* Address - textarea, full width */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Address</label>
                <textarea
                  value={standard.address || ''}
                  onChange={(e) => handleStandardChange('address', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                  rows={3}
                />
              </div>

              {/* Remark - required for bank leads */}
              {!isNewLead && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Remark *</label>
                  <textarea
                    value={standard.remarks || ''}
                    onChange={(e) => handleStandardChange('remarks', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                    rows={3}
                    required
                  />
                </div>
              )}

              {/* Assign Bank - RM can add bank when editing new_lead */}
              {lead && isNewLead && canSetCommission && (
                <div className="border-t pt-6 space-y-4">
                  <h5 className="font-bold text-gray-800">Assign Bank & Bank Details (Optional)</h5>
                  <p className="text-sm text-gray-600">Relationship Manager can assign this lead to a bank and fill bank-specific details.</p>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Bank</label>
                    <select
                      value={assignBankId}
                      onChange={(e) => setAssignBankId(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                    >
                      <option value="">-- Not assigned --</option>
                      {banks.map((b) => (
                        <option key={b._id || b.id} value={b._id || b.id}>{b.name}</option>
                      ))}
                    </select>
                  </div>
                  {assignBankId && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                      {/* Only show commission fields if not assigned to self (but allow franchise) */}
                      {!(isRelationshipManager && isSelfSelected && !canSetCommissionForSelf) && (
                        <>
                          <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Commission Percentage (%)</label>
                            <input
                              type="number"
                              value={standard.commissionPercentage || ''}
                              onChange={(e) => handleStandardChange('commissionPercentage', e.target.value)}
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                              placeholder="0.00"
                              step="0.01"
                              min="0"
                              max="100"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Commission Amount (₹)</label>
                            <input
                              type="number"
                              value={standard.commissionAmount || ''}
                              onChange={(e) => handleStandardChange('commissionAmount', e.target.value)}
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                              placeholder="0.00"
                              step="0.01"
                              min="0"
                            />
                          </div>
                        </>
                      )}
                      {/* Show message when RM assigns to self (but not for franchise) */}
                      {isRelationshipManager && isSelfSelected && !canSetCommissionForSelf && (
                        <div className="col-span-2">
                          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                            <p className="text-sm text-yellow-800 font-medium">
                              Commission cannot be set when lead is assigned to self.
                            </p>
                          </div>
                        </div>
                      )}
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">Loan Type</label>
                        <select
                          value={standard.loanType || ''}
                          onChange={(e) => handleStandardChange('loanType', e.target.value)}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                        >
                          <option value="">-- select --</option>
                          {LOAN_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">Loan Amount</label>
                        <input
                          type="number"
                          value={standard.loanAmount || ''}
                          onChange={(e) => handleStandardChange('loanAmount', e.target.value)}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                          placeholder="0"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Commission Fields - Only for bank-type leads and non-agents */}
              {/* Disabled if RM assigned lead to self (but allow franchise) */}
              {canSetCommission && !isNewLead && !isAgent && !(isRelationshipManager && isSelfSelected && !canSetCommissionForSelf) && (
                <div className="border-t pt-6 space-y-4">
                  <h5 className="font-bold text-gray-800">Commission Details</h5>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                        Commission Percentage (%) {!lead && '*'}
                      </label>
                      <input
                        type="number"
                        value={standard.commissionPercentage || ''}
                        onChange={(e) => handleStandardChange('commissionPercentage', e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                        placeholder="0.00"
                        step="0.01"
                        min="0"
                        max="100"
                        required={!lead}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                        Commission Amount (₹) {!lead && '*'}
                      </label>
                      <input
                        type="number"
                        value={standard.commissionAmount || ''}
                        onChange={(e) => handleStandardChange('commissionAmount', e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                        placeholder="0.00"
                        step="0.01"
                        min="0"
                        required={!lead}
                      />
                    </div>
                  </div>
                </div>
              )}
              {/* Show message when RM assigns to self (but not for franchise) */}
              {isRelationshipManager && isSelfSelected && !isNewLead && !canSetCommissionForSelf && (
                <div className="border-t pt-6">
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <p className="text-sm text-yellow-800 font-medium">
                      Commission cannot be set when lead is assigned to self.
                    </p>
                  </div>
                </div>
              )}
            </div>
          ) : isAgent ? (
            <div className="py-12 bg-red-50 text-red-700 text-center rounded-xl border border-red-200">
              No Lead Form configured for this bank.
            </div>
          ) : null}
        </>
      )}

      <div className="flex justify-end gap-3 pt-6 border-t font-semibold">
        <button type="button" className="px-5 py-2 border rounded-lg" onClick={onClose}>Cancel</button>
        <button
          type="button"
          className="px-8 py-2 bg-primary-900 text-white rounded-lg disabled:opacity-50"
          disabled={uploading || (isAgent && selectedBank && !leadFormDef && !loadingFormDef)}
          onClick={validateAndSubmit}
        >
          {uploading ? 'Processing...' : (lead ? 'Update' : 'Create')}
        </button>
      </div>
    </div>
  );
}

