import API_BASE_URL from '../config/api';
import { authService } from './auth.service';
import { toast } from './toastService';

// Generic API request function
const apiRequest = async (endpoint, options = {}) => {
  const url = `${API_BASE_URL}${endpoint}`;
  const token = authService.getToken();

  const config = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
    credentials: 'include', // Include cookies for authentication
  };

  // Debug log (remove in production)
  console.log(`API Call: ${options.method || 'GET'} ${url}`);
  console.log('Token present:', !!token);

  try {
    const response = await fetch(url, config);
    
    // Handle non-JSON responses
    const contentType = response.headers.get('content-type');
    let data;
    
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      const text = await response.text();
      data = text ? { message: text } : { message: 'An error occurred' };
    }

    if (!response.ok) {
      const errorMessage = data.message || data.error || `HTTP ${response.status}: ${response.statusText}`;
      
      // Handle 401 - redirect to login (but not for auth endpoints)
      if (response.status === 401 && !endpoint.includes('/auth/login') && !endpoint.includes('/auth/register')) {
        // Clear auth data
        authService.removeToken();
        // Only redirect if not already on login page
        if (!window.location.pathname.includes('/login') && !window.location.pathname.includes('/signup')) {
          toast.error('Authentication Error', 'Please login again');
          setTimeout(() => {
            window.location.href = '/login';
          }, 1000);
        }
        throw new Error('Authentication required');
      }
      
      // Show toast notification for other errors (but not for auth endpoints)
      // Only show toast here - don't show again in catch block
      if (response.status !== 403 && !endpoint.includes('/auth/login') && !endpoint.includes('/auth/register')) {
        toast.error('Error', errorMessage);
      } else if (response.status === 403) {
        toast.error('Permission Denied', errorMessage || 'You do not have permission to perform this action');
      }
      
      // Create error with a flag to prevent duplicate toast
      const apiError = new Error(errorMessage);
      apiError._toastShown = true;
      throw apiError;
    }

    return data;
  } catch (error) {
    // If toast was already shown in the response handler, don't show again
    if (error._toastShown) {
      throw error;
    }
    
    // Check if it's a connection error
    const isConnectionError = error.message && (
      error.message.includes('Failed to fetch') || 
      error.message.includes('NetworkError') ||
      error.name === 'TypeError'
    );
    
    // Only log connection errors once to reduce spam
    if (isConnectionError) {
      // Check if we've already shown an error for this endpoint recently
      const errorKey = `connection_error_${endpoint}`;
      const lastErrorTime = sessionStorage.getItem(errorKey);
      const now = Date.now();
      
      // Only show error if we haven't shown it in the last 5 seconds
      if (!lastErrorTime || (now - parseInt(lastErrorTime)) > 5000) {
        console.error('API Connection Error:', {
          endpoint,
          error: error.message,
          message: 'Backend server is not running or not accessible. Please ensure the server is started on port 5000.'
        });
        sessionStorage.setItem(errorKey, now.toString());
        
        // Only show toast for connection errors, and not for auth endpoints or notification polling
        // Don't show toast for notification endpoints as they poll frequently
        const isNotificationEndpoint = endpoint.includes('/notifications/');
        if (!endpoint.includes('/auth/login') && !endpoint.includes('/auth/register') && !isNotificationEndpoint) {
          toast.error('Connection Error', 'Cannot connect to server. Please ensure the backend server is running on port 5000.');
        }
      }
    } else {
      // Log other errors normally (but don't show toast if already shown)
      console.error('API Error:', error);
    }
    
    // Re-throw with more context
    if (error.message) {
      throw error;
    }
    throw new Error('Network error: Could not connect to server');
  }
};

// API service object with all endpoints
export const api = {
  // Auth endpoints (no auth required)
  auth: {
    login: async (credentials) => {
      // Login doesn't require token, so make direct request
      const url = `${API_BASE_URL}/auth/login`;
      
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify(credentials),
        });

        const contentType = response.headers.get('content-type');
        let data;
        
        if (contentType && contentType.includes('application/json')) {
          data = await response.json();
        } else {
          const text = await response.text();
          data = text ? { message: text } : { message: 'An error occurred' };
        }

        if (!response.ok) {
          const errorMessage = data.message || data.error || `HTTP ${response.status}: ${response.statusText}`;
          throw new Error(errorMessage);
        }

        return data;
      } catch (error) {
        // Re-throw with proper message
        if (error.message) {
          throw error;
        }
        throw new Error('Network error: Could not connect to server');
      }
    },
    register: async (userData) => {
      // Register doesn't require token - use signup endpoint
      const url = `${API_BASE_URL}/auth/signup`;
      
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify(userData),
        });

        const contentType = response.headers.get('content-type');
        let data;
        
        if (contentType && contentType.includes('application/json')) {
          data = await response.json();
        } else {
          const text = await response.text();
          data = text ? { message: text } : { message: 'An error occurred' };
        }

        if (!response.ok) {
          const errorMessage = data.message || data.error || `HTTP ${response.status}: ${response.statusText}`;
          throw new Error(errorMessage);
        }

        return data;
      } catch (error) {
        // Re-throw with proper message
        if (error.message) {
          throw error;
        }
        throw new Error('Network error: Could not connect to server');
      }
    },
    logout: () => apiRequest('/auth/logout', { method: 'POST' }),
    getCurrentUser: () => apiRequest('/auth/me'),
    updateProfile: (data) => apiRequest('/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  },

  // Leads endpoints
  leads: {
    getAll: (params = {}) => {
      const queryString = new URLSearchParams(params).toString();
      return apiRequest(`/leads${queryString ? `?${queryString}` : ''}`);
    },
    getById: (id) => apiRequest(`/leads/${id}`),
    create: (data) => apiRequest('/leads', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    update: (id, data) => apiRequest(`/leads/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
    updateStatus: (id, status) => apiRequest(`/leads/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    }),
    delete: (id) => apiRequest(`/leads/${id}`, { method: 'DELETE' }),
    getHistory: (id, params = {}) => {
      const queryString = new URLSearchParams(params).toString();
      return apiRequest(`/leads/${id}/history${queryString ? `?${queryString}` : ''}`);
    },
  },

  // Agents endpoints
  agents: {
    getAll: (params = {}) => {
      const queryString = new URLSearchParams(params).toString();
      return apiRequest(`/agents${queryString ? `?${queryString}` : ''}`);
    },
    getById: (id) => apiRequest(`/agents/${id}`),
    create: (data) => apiRequest('/agents', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    update: (id, data) => apiRequest(`/agents/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
    updateStatus: (id, status) => apiRequest(`/agents/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    }),
    delete: (id) => apiRequest(`/agents/${id}`, { method: 'DELETE' }),
  },

  // Staff endpoints
  staff: {
    getAll: (params = {}) => {
      const queryString = new URLSearchParams(params).toString();
      return apiRequest(`/staff${queryString ? `?${queryString}` : ''}`);
    },
    getById: (id) => apiRequest(`/staff/${id}`),
    create: (data) => apiRequest('/staff', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    update: (id, data) => apiRequest(`/staff/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
    updateStatus: (id, status) => apiRequest(`/staff/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    }),
    delete: (id) => apiRequest(`/staff/${id}`, { method: 'DELETE' }),
  },

  // Invoices endpoints
  invoices: {
    getAll: (params = {}) => {
      const queryString = new URLSearchParams(params).toString();
      return apiRequest(`/invoices${queryString ? `?${queryString}` : ''}`);
    },
    getById: (id) => apiRequest(`/invoices/${id}`),
    create: (data) => apiRequest('/invoices', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    update: (id, data) => apiRequest(`/invoices/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
    delete: (id) => apiRequest(`/invoices/${id}`, { method: 'DELETE' }),
    accept: (id, data = {}) => apiRequest(`/invoices/${id}/accept`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    escalate: (id, data = {}) => apiRequest(`/invoices/${id}/escalate`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    approve: (id) => apiRequest(`/invoices/${id}/approve`, { method: 'POST' }),
    reject: (id) => apiRequest(`/invoices/${id}/reject`, { method: 'POST' }),
  },

  // Payouts endpoints
  payouts: {
    getAll: (params = {}) => {
      const queryString = new URLSearchParams(params).toString();
      return apiRequest(`/payouts${queryString ? `?${queryString}` : ''}`);
    },
    getById: (id) => apiRequest(`/payouts/${id}`),
    process: () => apiRequest('/payouts/process', { method: 'POST' }),
    generateCsv: (id) => apiRequest(`/payouts/${id}/generate-csv`, { method: 'POST' }),
    confirmPayment: (id) => apiRequest(`/payouts/${id}/confirm`, { method: 'POST' }),
    create: (data) => apiRequest('/payouts', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    update: (id, data) => apiRequest(`/payouts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
    delete: (id) => apiRequest(`/payouts/${id}`, { method: 'DELETE' }),
  },

  // Franchises endpoints
  franchises: {
    getAll: (params = {}) => {
      const queryString = new URLSearchParams(params).toString();
      return apiRequest(`/franchises${queryString ? `?${queryString}` : ''}`);
    },
    getActive: () => apiRequest('/franchises/active'),
    getById: (id) => apiRequest(`/franchises/${id}`),
    create: (data) => apiRequest('/franchises', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    update: (id, data) => apiRequest(`/franchises/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
    updateStatus: (id, status) => apiRequest(`/franchises/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    }),
    delete: (id) => apiRequest(`/franchises/${id}`, { method: 'DELETE' }),
    getAgents: (id) => apiRequest(`/franchises/${id}/agents`),
    getPerformance: (id) => apiRequest(`/franchises/${id}/performance`),
  },

  // Users endpoints
  users: {
    getAll: (params = {}) => {
      const queryString = new URLSearchParams(params).toString();
      return apiRequest(`/users${queryString ? `?${queryString}` : ''}`);
    },
    getById: (id) => apiRequest(`/users/${id}`),
    create: (data) => apiRequest('/users', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  },

  // Banks endpoints
  banks: {
    getAll: (params = {}) => {
      const queryString = new URLSearchParams(params).toString();
      return apiRequest(`/banks${queryString ? `?${queryString}` : ''}`);
    },
    getById: (id) => apiRequest(`/banks/${id}`),
    create: (data) => apiRequest('/banks', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    update: (id, data) => apiRequest(`/banks/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
    updateStatus: (id, status) => apiRequest(`/banks/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    }),
    sendEmail: (id, emailData) => apiRequest(`/banks/${id}/send-email`, {
      method: 'POST',
      body: JSON.stringify(emailData),
    }),
    delete: (id) => apiRequest(`/banks/${id}`, { method: 'DELETE' }),
  },

  // Dashboard endpoints
  dashboard: {
    getAgentDashboard: (params = {}) => {
      const queryString = new URLSearchParams(params).toString();
      return apiRequest(`/dashboard/agent${queryString ? `?${queryString}` : ''}`);
    },
    getStaffDashboard: (params = {}) => {
      const queryString = new URLSearchParams(params).toString();
      return apiRequest(`/dashboard/staff${queryString ? `?${queryString}` : ''}`);
    },
    getAccountsDashboard: (params = {}) => {
      const queryString = new URLSearchParams(params).toString();
      return apiRequest(`/dashboard/accounts${queryString ? `?${queryString}` : ''}`);
    },
    getAdminDashboard: (params = {}) => {
      const queryString = new URLSearchParams(params).toString();
      return apiRequest(`/dashboard/admin${queryString ? `?${queryString}` : ''}`);
    },
    getFranchiseOwnerDashboard: (params = {}) => {
      const queryString = new URLSearchParams(params).toString();
      return apiRequest(`/dashboard/franchise${queryString ? `?${queryString}` : ''}`);
    },
  },

  // Notifications endpoints
  notifications: {
    getAll: () => apiRequest('/notifications'),
    getUnreadCount: () => apiRequest('/notifications/unread-count'),
    markAsRead: (id) => apiRequest(`/notifications/${id}/read`, { method: 'PUT' }),
    markAllAsRead: () => apiRequest('/notifications/read-all', { method: 'PUT' }),
    delete: (id) => apiRequest(`/notifications/${id}`, { method: 'DELETE' }),
  },
};

export default api;
