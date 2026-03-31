// ============================================
// src/services/api.js - Unified ApiService
// ============================================
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const REQUEST_TIMEOUT = 30000; // 30 seconds

// Create axios instance with default config
const axiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: REQUEST_TIMEOUT,
  withCredentials: true,        
  headers: {
    'Content-Type': 'application/json',
  },
});

// ============================
// Interceptors
// ============================

// Request interceptor for adding auth token
axiosInstance.interceptors.request.use(
  (config) => {
    if (import.meta.env.DEV) {
      console.log('🚀 API Request:', {
        method: config.method?.toUpperCase(),
        url: config.url,
        hasAuth: !!config.headers?.Authorization,
        contentType: config.headers?.['Content-Type'],
      });
    }
    return config;
  },
  (error) => {
    console.error('Request interceptor error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor for handling success/errors
axiosInstance.interceptors.response.use(
  (response) => {
    if (import.meta.env.DEV) {
      console.log('✅ API Success:', {
        status: response.status,
        url: response.config.url,
        hasData: !!response.data,
      });
    }
    return response;
  },
  (error) => {
    if (import.meta.env.DEV) {
      console.error('❌ API Error:', {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        url: error.config?.url,
        method: error.config?.method?.toUpperCase(),
        responseData: error.response?.data,
      });
    }

    if (error.response?.status === 401) {
      console.warn('🔐 Authentication failed - token may be invalid or expired');
    } else if (error.response?.status === 403) {
      console.warn('🚫 Forbidden - insufficient permissions');
    } else if (error.response?.status === 429) {
      console.warn('⏱️ Rate limit exceeded');
    } else if (!error.response) {
      console.warn('🌐 Network Error - server unreachable');
    }

    return Promise.reject(error);
  }
);

class ApiService {
  // ==========================================
  // Generic request handler (covers JSON, FormData, Raw)
  // ==========================================
  async request(endpoint, options = {}) {
    try {
      const config = {
        url: endpoint,
        ...options,
      };

      // Handle headers safely
      config.headers = {
        ...config.headers,
      };

      // Handle data type
      if (options.data) {
        if (options.data instanceof FormData) {
          config.data = options.data; // axios auto sets headers
          delete config.headers['Content-Type']; // Let browser handle it
        } else if (typeof options.data === 'object') {
          config.data = options.data;
          config.headers['Content-Type'] = 'application/json';
        } else {
          config.data = options.data; // raw string, blob, etc.
        }
      }

      const response = await axiosInstance(config);
      return response.data;
    } catch (error) {
      throw {
        message: error.response?.data?.message || error.message || 'Request failed',
        code: error.response?.data?.code || 'UNKNOWN_ERROR',
        status: error.response?.status,
        details: error.response?.data,
      };
    }
  }

  // ==========================================
  // AUTH ENDPOINTS
  // ==========================================
  async login(username, password) {
    return this.request('/admin/login', {
      method: 'POST',
      data: { username, password },
    });
  }

  async refreshToken(refreshToken) {
    return this.request('/admin/refresh-token', {
      method: 'POST',
      data: { refreshToken },
    });
  }

  async logout(accessToken, refreshToken) {
    return this.request('/admin/logout', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
      data: { refreshToken },
    });
  }

  async logoutAll(accessToken) {
    return this.request('/admin/logout-all', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  }

  // ==========================================
  // PROFILE ENDPOINTS
  // ==========================================
  async getProfile(accessToken) {
    return this.request('/admin/profile', {
      method: 'GET',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  }

  async updateProfile(accessToken, data) {
    return this.request('/admin/profile', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${accessToken}` },
      data,
    });
  }

  // ==========================================
  // SESSION ENDPOINTS
  // ==========================================
  async getSessions(accessToken) {
    return this.request('/admin/sessions', {
      method: 'GET',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  }

  async revokeSession(accessToken, sessionId) {
    return this.request(`/admin/sessions/${sessionId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  }

  // ==========================================
  // PASSWORD ENDPOINTS
  // ==========================================
  async changePassword(accessToken, currentPassword, newPassword) {
    return this.request('/admin/change-password', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
      data: { currentPassword, newPassword },
    });
  }

  // ==========================================
  // ADMIN MANAGEMENT (Super Admin)
  // ==========================================
  async createAdmin(accessToken, adminData) {
    return this.request('/admin/create', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
      data: adminData,
    });
  }

  async getAllAdmins(accessToken, params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return this.request(`/admin/all${queryString ? `?${queryString}` : ''}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  }

  async updateAdminStatus(accessToken, adminId, status) {
    return this.request(`/admin/${adminId}/status`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${accessToken}` },
      data: { status },
    });
  }

  async getSecurityAudit(accessToken) {
    return this.request('/admin/security-audit', {
      method: 'GET',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  }

  async cleanupTokens(accessToken) {
    return this.request('/admin/cleanup-tokens', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  }
}

export default new ApiService();
