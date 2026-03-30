// src/pages/Admin.jsx - Complete Updated Version
import React, { createContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import PropTypes from 'prop-types';
import { toast } from 'react-toastify';
import { LogOut } from 'lucide-react';
import { ErrorBoundary } from 'react-error-boundary';
import axios from 'axios';
import sanitizeHtml from 'sanitize-html';
import LoginPage from '../admin/LoginPage';
import ForgotPassword from '../admin/ForgotPassword';
import ResetPassword from '../admin/ResetPassword';
import Profile from '../admin/Profile';
import Settings from '../admin/Settings';
import SessionManager from '../admin/SessionManager';
import ContactsPage from '../admin/ContactsPage';
import ProjectsPage from '../admin/ProjectsPage';
import SkillsPage from '../admin/SkillsPage';
import ExperiencesPage from '../admin/ExperiencesPage';
import CustomTabPage from '../admin/CustomTabPage';
import ProjectPreview from '../admin/ProjectPreview';
import SecurityAudit from '../admin/SecurityAudit';
import ActivityLogs from '../admin/ActivityLogs';
import Overview from '../admin/Overview';
import ProfileManagement from '../admin/ProfileManagement';
import AboutPage from '../admin/AboutPage';

export const AdminContext = createContext();

const defaultInitialData = {
  contacts: [],
  projects: [],
  skills: [],
  experiences: [],
};

const sanitizeInput = (input, isPassword = false) => {
  if (typeof input !== 'string') return input;
  if (isPassword) return input; // never sanitize passwords
  return sanitizeHtml(input, { allowedTags: [], allowedAttributes: {} }).trim();
};
// Enhanced API Request with Axios
const apiRequest = async (method, endpoint, data, token, baseUrl, options = {}) => {
  try {
    const config = {
      method: method.toLowerCase(),
      url: `${baseUrl}${endpoint}`,
      timeout: options.timeout || 30000,
      ...options,
    };
    config.headers = { ...options.headers };
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    if (data) {
      if (data instanceof FormData) {
        config.data = data;
      } else if (typeof data === 'object') {
        config.data = data;
        config.headers['Content-Type'] = 'application/json';
      } else {
        config.data = data;
      }
    }
    if (import.meta.env.DEV) {
      console.log('🚀 API Request:', {
        method: config.method.toUpperCase(),
        url: config.url,
        hasAuth: !!token,
        contentType: config.headers['Content-Type'],
        dataType: data instanceof FormData ? 'FormData' : typeof data,
      });
    }
    const response = await axios(config);
    if (import.meta.env.DEV) {
      console.log('✅ API Success:', {
        status: response.status,
        url: config.url,
        hasData: !!response.data,
      });
    }
    return response;
  } catch (error) {
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
    if (error.response?.status === 401 && error.response?.data?.code === 'TOKEN_EXPIRED') {
      console.warn('🔐 Token expired, attempting refresh');
      const newToken = await refreshTokens();
      if (newToken) {
        config.headers.Authorization = `Bearer ${newToken}`;
        const retryResponse = await axios(config);
        if (import.meta.env.DEV) {
          console.log('✅ Retry Success:', {
            status: retryResponse.status,
            url: config.url,
            hasData: !!retryResponse.data,
          });
        }
        return retryResponse;
      }
      console.error('Token refresh failed, logging out');
      handleLogout();
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
    throw error;
  }
};

const ProtectedRoute = ({ children, authState, isLoadingAuth }) => {
  const location = useLocation();

  if (isLoadingAuth) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
        <span className="ml-3 text-gray-600 dark:text-gray-400">Loading authentication...</span>
      </div>
    );
  }

  if (!authState.isAuthenticated || !authState.token) {
    return <Navigate to="/admin/login" replace state={{ from: location }} />;
  }

  return children;
};

ProtectedRoute.propTypes = {
  children: PropTypes.node.isRequired,
  authState: PropTypes.object.isRequired,
  isLoadingAuth: PropTypes.bool,
};

const ErrorFallback = ({ error, resetErrorBoundary }) => (
  <div className="p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-lg">
    <p className="text-red-800 dark:text-red-200">Error: {error.message}</p>
    <button
      onClick={resetErrorBoundary}
      className="mt-2 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 underline"
    >
      Reload
    </button>
  </div>
);

ErrorFallback.propTypes = {
  error: PropTypes.object.isRequired,
  resetErrorBoundary: PropTypes.func.isRequired,
};

const Admin = ({
  initialData = defaultInitialData,
  apiConfig = {
    baseUrl: import.meta.env.VITE_API_URL || 'http://127.0.0.1:5000/api',
  },
  theme = 'system',
  onAuthChange = () => {},
  customTabs = [],
  authState: propAuthState = null,
}) => {
  const navigate = useNavigate();
  const location = useLocation();

  const abortControllerRef = useRef(null);
  const isMountedRef = useRef(true);
  const loadingStateRef = useRef({
    isLoading: false,
    lastLoadTime: 0,
  });
  const tokenRefreshInProgressRef = useRef(false);

  const [localAuthState, setLocalAuthState] = useState(() => {
    const token = localStorage.getItem('adminToken');
    const refreshToken = localStorage.getItem('refreshToken');
    const userStr = localStorage.getItem('user');
    const tokenValidationStr = localStorage.getItem('tokenValidation');

    let isAuthenticated = false;
    let user = null;
    let tokenExpiry = null;

    if (token && userStr && tokenValidationStr) {
      try {
        user = JSON.parse(userStr);
        const tokenValidation = JSON.parse(tokenValidationStr);

        const isValid = tokenValidation.token === token &&
          tokenValidation.expires &&
          tokenValidation.expires > Date.now();

        if (isValid) {
          isAuthenticated = true;
          tokenExpiry = tokenValidation.expires;
        } else {
          localStorage.removeItem('adminToken');
          localStorage.removeItem('user');
          localStorage.removeItem('tokenValidation');
          localStorage.removeItem('refreshToken');
        }
      } catch (error) {
        console.error('Error parsing local auth data:', error);
        localStorage.removeItem('adminToken');
        localStorage.removeItem('user');
        localStorage.removeItem('tokenValidation');
        localStorage.removeItem('refreshToken');
      }
    }

    return {
      isAuthenticated,
      token: isAuthenticated ? token : null,
      refreshToken: isAuthenticated ? refreshToken : null,
      user,
      tokenExpiry,
    };
  });

  const authState = propAuthState || localAuthState;
  const setAuthState = propAuthState
    ? (newState) => {
        setLocalAuthState(newState);
        onAuthChange(newState.isAuthenticated, newState.token, newState.user, newState.refreshToken);
      }
    : setLocalAuthState;

  const [contacts, setContacts] = useState(initialData.contacts);
  const [projects, setProjects] = useState(initialData.projects);
  const [skills, setSkills] = useState(initialData.skills);
  const [experiences, setExperiences] = useState(initialData.experiences);
  const [totalPages, setTotalPages] = useState({
    contacts: 1,
    projects: 1,
    skills: 1,
    experiences: 1,
  });
  const [stats, setStats] = useState({
    projects: 0,
    messages: 0,
    skills: 0,
    experiences: 0,
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [apiError, setApiError] = useState(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [dataLoaded, setDataLoaded] = useState(false);

  const [uploadLimits] = useState({
    maxSize: 5 * 1024 * 1024,
    allowedTypes: ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'],
  });
  const [themeClass, setThemeClass] = useState('');

  const getApiUrl = useCallback(() => {
    return import.meta.env.VITE_API_URL || apiConfig.baseUrl || 'http://127.0.0.1:5000/api';
  }, [apiConfig.baseUrl]);

  const getErrorMessage = useCallback((err) => {
    console.error('API Error:', err);

    if (!err?.response) {
      return 'Network error: Unable to reach the server. Please check if the server is running.';
    }

    const status = err.response.status;
    const errorData = err.response.data;

    const errorMessages = {
      401: 'Unauthorized: Your session has expired. Please login again.',
      403: 'Forbidden: You don\'t have permission to perform this action.',
      404: 'Resource not found.',
      422: errorData?.message || 'Validation error: Please check your input.',
      429: 'Too many requests. Please wait before trying again.',
      500: 'Server error: Please try again later.',
    };

    return errorMessages[status] || errorData?.message || `Error ${status}: An unexpected error occurred.`;
  }, []);

  const handleLogout = useCallback(async () => {
    try {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort('User logged out');
      }
      
      // Try to logout from server
      if (authState.token && authState.refreshToken) {
        try {
          await apiRequest(
            'post',
            '/admin/logout',
            { refreshToken: authState.refreshToken },
            authState.token,
            getApiUrl()
          );
        } catch (error) {
          console.warn('Server logout failed:', error);
        }
      }
    } finally {
      if (isMountedRef.current) {
        setAuthState({
          isAuthenticated: false,
          token: null,
          refreshToken: null,
          user: null,
          tokenExpiry: null,
        });
        setDataLoaded(false);
        setApiError(null);
        setError(null);
        setContacts([]);
        setProjects([]);
        setSkills([]);
        setExperiences([]);
        setStats({ projects: 0, messages: 0, skills: 0, experiences: 0 });
        setTotalPages({ contacts: 1, projects: 1, skills: 1, experiences: 1 });

        loadingStateRef.current = {
          isLoading: false,
          lastLoadTime: 0,
        };

        localStorage.removeItem('adminToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
        localStorage.removeItem('tokenValidation');
        toast.info('Logged out successfully');
        navigate('/admin/login', { replace: true });
      }
    }
  }, [navigate, setAuthState, authState, getApiUrl]);

const refreshTokens = useCallback(async () => {
  if (tokenRefreshInProgressRef.current) {
    console.log('Token refresh already in progress');
    return null;
  }
  try {
    tokenRefreshInProgressRef.current = true;
    const refreshToken = localStorage.getItem('refreshToken');
    if (!refreshToken) throw new Error('No refresh token available');
    const apiUrl = getApiUrl();
    const response = await apiRequest('post', '/admin/refresh-token', { refreshToken }, null, apiUrl);
    if (response.data?.success) {
      const { accessToken, refreshToken: newRefreshToken } = response.data.data;
      const tokenExpiry = Date.now() + 14 * 60 * 1000;
      localStorage.setItem('adminToken', accessToken);
      if (newRefreshToken) localStorage.setItem('refreshToken', newRefreshToken);
      localStorage.setItem('tokenValidation', JSON.stringify({ token: accessToken, expires: tokenExpiry }));
      setAuthState(prev => ({
        ...prev,
        token: accessToken,
        refreshToken: newRefreshToken || prev.refreshToken,
        tokenExpiry,
      }));
      console.log('Token refreshed successfully');
      return accessToken;
    }
    throw new Error('Token refresh failed');
  } catch (error) {
    console.error('Token refresh failed:', error);
    handleLogout();
    return null;
  } finally {
    tokenRefreshInProgressRef.current = false;
  }
}, [getApiUrl, setAuthState, handleLogout]);

  const ensureValidToken = useCallback(async () => {
    if (!authState?.token || !authState?.tokenExpiry) {
      return null;
    }

    const timeUntilExpiry = authState.tokenExpiry - Date.now();
    if (timeUntilExpiry < 2 * 60 * 1000) {
      console.log('Token expiring soon, refreshing...');
      return await refreshTokens();
    }

    return authState.token;
  }, [authState, refreshTokens]);

const loadInitialData = useCallback(async (forceReload = false) => {
  const now = Date.now();
  const loadingState = loadingStateRef.current;
  if (!authState?.isAuthenticated || !authState?.token) {
    console.log('Skipping loadInitialData: No authentication');
    return;
  }
  if (dataLoaded && !forceReload) {
    console.log('Data already loaded, skipping');
    return;
  }
  if (!forceReload && (now - loadingState.lastLoadTime < 3000)) {
    console.log('Recent call detected, skipping');
    return;
  }
  if (loadingState.isLoading && !forceReload) {
    console.log('Already loading, skipping');
    return;
  }
  loadingState.isLoading = true;
  loadingState.lastLoadTime = now;
  console.log('Starting loadInitialData');
  if (isMountedRef.current) {
    setLoading(true);
    setError(null);
    setApiError(null);
  }
  try {
    const validToken = await ensureValidToken();
    if (!validToken) {
      throw new Error('Failed to get valid token');
    }
    const apiUrl = getApiUrl();
    console.log('Loading data from API:', apiUrl);
    if (abortControllerRef.current) {
      abortControllerRef.current.abort('New request started');
    }
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    const statsRequest = apiRequest(
      'get',
      '/contacts/stats',
      null,
      validToken,
      apiUrl,
      { signal: abortController.signal }
    ).catch(error => {
      console.warn('Failed to load contact stats:', error);
      return { data: { success: false } };
    });
    const dataEndpoints = [
      ...(location.pathname !== '/admin/contacts' ? [{ name: 'contacts', endpoint: '/contacts?page=1&limit=50' }] : []),
      { name: 'projects', endpoint: '/projects?page=1&limit=50' },
      { name: 'skills', endpoint: '/skills' },
      { name: 'experiences', endpoint: '/experiences?page=1&limit=50' },
    ];
    const dataRequests = dataEndpoints.map(({ name, endpoint }) =>
      apiRequest(
        'get',
        endpoint,
        null,
        validToken,
        apiUrl,
        { signal: abortController.signal }
      ).then(response => ({ name, response, success: true }))
      .catch(error => {
        console.warn(`Failed to load ${name}:`, error);
        return { name, error, success: false };
      })
    );
    const allResults = await Promise.all([statsRequest, ...dataRequests]);
    if (abortController.signal.aborted || !isMountedRef.current) {
      console.log('Data loading was aborted or component unmounted');
      return;
    }
    const [statsResult, ...dataResults] = allResults;
    if (statsResult.data?.success) {
      setStats(prev => ({ ...prev, messages: statsResult.data.data.total ?? 0 }));
    }
    dataResults.forEach((result) => {
      const { name, response, success } = result;
      if (!success || !response?.data?.success) {
        console.warn(`No data for ${name}:`, response?.data);
        return;
      }
      const data = response.data.data ?? {};
      console.log(`Response for ${name}:`, data);
      switch (name) {
        case 'contacts':
          const contactsData = Array.isArray(data.contacts) ? data.contacts : Array.isArray(data) ? data : [];
          if (!Array.isArray(contactsData)) {
            console.warn('Invalid contacts data:', contactsData);
          }
          setContacts(contactsData);
          setTotalPages(prev => ({ ...prev, contacts: data.pagination?.pages ?? 1 }));
          break;
        case 'projects':
          const projectsData = Array.isArray(data.projects) ? data.projects : Array.isArray(data) ? data : [];
          setProjects(projectsData);
          setTotalPages(prev => ({ ...prev, projects: data.pagination?.pages ?? 1 }));
          setStats(prev => ({ ...prev, projects: data.pagination?.total ?? projectsData.length ?? 0 }));
          break;
        case 'skills':
          const skillsData = Array.isArray(data.skills) ? data.skills : Array.isArray(data) ? data : [];
          setSkills(skillsData);
          setTotalPages(prev => ({ ...prev, skills: data.pagination?.pages ?? 1 }));
          setStats(prev => ({ ...prev, skills: data.pagination?.total ?? skillsData.length ?? 0 }));
          break;
        case 'experiences':
          const experiencesData = Array.isArray(data.experiences) ? data.experiences : Array.isArray(data) ? data : [];
          setExperiences(experiencesData);
          setTotalPages(prev => ({ ...prev, experiences: data.pagination?.pages ?? 1 }));
          setStats(prev => ({ ...prev, experiences: data.pagination?.total ?? experiencesData.length ?? 0 }));
          break;
      }
    });
    if (isMountedRef.current) {
      setDataLoaded(true);
      console.log('Data loaded successfully');
      toast.success('Data loaded successfully!');
    }
  } catch (err) {
    if (err.name === 'AbortError' || err.code === 'ERR_CANCELED') {
      console.log('Data loading aborted');
      return;
    }
    if (isMountedRef.current) {
      const errorMsg = getErrorMessage(err);
      console.error('Error loading initial data:', err);
      setError(errorMsg);
      setApiError(errorMsg);
      toast.error(`Failed to load data: ${errorMsg}`);
      // No need for manual refresh here; apiRequest handles it
    }
  } finally {
    loadingState.isLoading = false;
    if (isMountedRef.current) {
      setLoading(false);
    }
  }
}, [authState, dataLoaded, getApiUrl, getErrorMessage, refreshTokens, ensureValidToken, location.pathname]);

  const handleAuthChange = useCallback(
    (isAuth, newToken, user, refreshToken) => {
      console.log('Admin onAuthChange called:', {
        isAuth,
        hasToken: !!newToken,
        hasRefreshToken: !!refreshToken,
      });

      if (isAuth && newToken && isMountedRef.current) {
        const tokenExpiry = Date.now() + 14 * 60 * 1000;

        localStorage.setItem('adminToken', newToken);
        if (refreshToken) {
          localStorage.setItem('refreshToken', refreshToken);
        }
        if (user) {
          localStorage.setItem('user', JSON.stringify(user));
        }
        localStorage.setItem('tokenValidation', JSON.stringify({
          token: newToken,
          expires: tokenExpiry,
        }));

        setAuthState({
          isAuthenticated: true,
          token: newToken,
          refreshToken,
          user,
          tokenExpiry,
        });
        setDataLoaded(false);
        setApiError(null);
        loadingStateRef.current = {
          isLoading: false,
          lastLoadTime: 0,
        };
      } else if (isMountedRef.current) {
        handleLogout();
      }
    },
    [handleLogout, setAuthState]
  );

  // Inactivity timeout (30 minutes)
  useEffect(() => {
    let timeout;
    const resetTimeout = () => {
      clearTimeout(timeout);
      timeout = setTimeout(() => handleLogout(), 30 * 60 * 1000);
    };
    window.addEventListener('mousemove', resetTimeout);
    window.addEventListener('keypress', resetTimeout);
    resetTimeout();
    return () => {
      clearTimeout(timeout);
      window.removeEventListener('mousemove', resetTimeout);
      window.removeEventListener('keypress', resetTimeout);
    };
  }, [handleLogout]);

  useEffect(() => {
    isMountedRef.current = true;
    setIsLoadingAuth(false);

    return () => {
      isMountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort('Component unmounting');
      }
      loadingStateRef.current = {
        isLoading: false,
        lastLoadTime: 0,
      };
    };
  }, []);

  useEffect(() => {
    if (
      authState?.isAuthenticated &&
      authState?.token &&
      !dataLoaded &&
      location.pathname !== '/admin/login' &&
      !loadingStateRef.current.isLoading
    ) {
      console.log('Triggering loadInitialData from effect');
      loadInitialData();
    }
  }, [authState?.isAuthenticated, authState?.token, dataLoaded, loadInitialData, location.pathname]);

  useEffect(() => {
    if (authState?.isAuthenticated && location.pathname === '/admin/login') {
      console.log('Redirecting authenticated user from login to dashboard');
      navigate('/admin/dashboard', { replace: true });
    }
  }, [authState?.isAuthenticated, location.pathname, navigate]);

  useEffect(() => {
    const updateTheme = () => {
      if (theme === 'system') {
        setThemeClass(
          window.matchMedia('(prefers-color-scheme: dark)').matches
            ? 'bg-gray-900 text-white'
            : 'bg-gradient-to-br from-gray-50 to-indigo-50 text-gray-900'
        );
      } else {
        setThemeClass(
          theme === 'dark'
            ? 'bg-gray-900 text-white'
            : 'bg-gradient-to-br from-gray-50 to-indigo-50 text-gray-900'
        );
      }
    };

    updateTheme();
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', updateTheme);
    return () => mediaQuery.removeEventListener('change', updateTheme);
  }, [theme]);

  const allTabs = useMemo(
    () => [
      { id: 'dashboard', label: 'Dashboard', path: '/admin/dashboard', disabled: false },
      { id: 'contacts', label: 'Contacts', path: '/admin/contacts', disabled: false },
      { id: 'projects', label: 'Projects', path: '/admin/projects', disabled: false },
      { id: 'skills', label: 'Skills', path: '/admin/skills', disabled: false },
      { id: 'experiences', label: 'Experiences', path: '/admin/experiences', disabled: false },
      { id: 'profile', label: 'Profile', path: '/admin/profile', disabled: false },
      { id: 'settings', label: 'Settings', path: '/admin/settings', disabled: false },
      { id: 'sessions', label: 'Sessions', path: '/admin/sessions', disabled: false },
        { id: 'about', label: 'About', path: '/admin/about', disabled: false },  // ADD THIS
      { id: 'profile-settings', label: 'ProfileManagement', path: '/admin/profile-settings', disabled: false },
      { id: 'activity', label: 'Activity Logs', path: '/admin/activity-logs', disabled: false },
      ...(authState?.user?.role === 'superadmin' ? [
        { id: 'security', label: 'Security', path: '/admin/security', disabled: false }
      ] : []),
      ...customTabs.map((tab) => ({
        ...tab,
        path: `/admin/custom/${tab.id}`,
        disabled: false,
      })),
    ],
    [customTabs, authState?.user?.role]
  );

  const contextValue = useMemo(
    () => ({
      contacts,
      setContacts,
      projects,
      setProjects,
      skills,
      setSkills,
      experiences,
      setExperiences,
      totalPages,
      setTotalPages,
      stats,
      setStats,
      loading,
      setLoading,
      error,
      setError,
      apiError,
      setApiError,
      token: authState?.token,
      refreshToken: authState?.refreshToken,
      setToken: (token) => setAuthState(prev => ({ ...prev, token })),
      user: authState?.user,
      setUser: (user) => setAuthState(prev => ({ ...prev, user })),
      isTokenValid: authState?.isAuthenticated && authState?.token &&
        (!authState?.tokenExpiry || authState.tokenExpiry > Date.now()),
      uploadLimits,
      apiConfig: { ...apiConfig, baseUrl: getApiUrl() },
userRole: ['admin', 'superadmin'].includes(authState?.user?.role) 
  ? 'admin' 
  : (authState?.user?.role || 'admin'),
        getErrorMessage,
      apiRequest,
      sanitizeInput,
      loadInitialData,
      refreshTokens,
      ensureValidToken,
      abortControllerRef,
      dataLoaded,
      setDataLoaded,
      handleLogout,
    }),
    [
      contacts,
      projects,
      skills,
      experiences,
      totalPages,
      stats,
      loading,
      error,
      apiError,
      authState,
      uploadLimits,
      apiConfig,
      getErrorMessage,
      loadInitialData,
      refreshTokens,
      ensureValidToken,
      dataLoaded,
      getApiUrl,
      handleLogout,
      setAuthState,
    ]
  );

  return (
    <ErrorBoundary
      FallbackComponent={ErrorFallback}
      onReset={() => window.location.reload()}
    >
      <AdminContext.Provider value={contextValue}>
        <section className={`min-h-screen py-20 ${themeClass}`}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            {isLoadingAuth ? (
              <div className="flex justify-center items-center min-h-[400px]">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
                <span className="ml-3 text-gray-600 dark:text-gray-400">Authenticating...</span>
              </div>
            ) : (
              authState.isAuthenticated && authState.token && (
                <>
                  <div className="flex justify-between items-center mb-8">
                    <div>
                      <h2 className="text-3xl md:text-4xl font-bold">Portfolio Admin Dashboard</h2>
                      {authState.user && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          Welcome back, {authState.user.username} ({authState.user.role || 'admin'})
                        </p>
                      )}
                      {stats && (
                        <div className="flex gap-4 mt-2 text-sm text-gray-600 dark:text-gray-400">
                          <span>{stats.projects} Projects</span>
                          <span>{stats.messages} Messages</span>
                          <span>{stats.skills} Skills</span>
                          <span>{stats.experiences} Experiences</span>
                        </div>
                      )}
                    </div>
                    <button
                      onClick={handleLogout}
                      className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 flex items-center transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 px-3 py-2 rounded-lg"
                    >
                      <LogOut size={16} className="mr-2" /> Logout
                    </button>
                  </div>

                  {apiError && (
                    <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <svg className="w-5 h-5 text-red-600 dark:text-red-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 18.5c-.77.833.192 2.5 1.732 2.5z" />
                          </svg>
                          <span className="text-red-800 dark:text-red-200 font-medium">{apiError}</span>
                        </div>
                        <button onClick={() => setApiError(null)} className="text-red-600 hover:text-red-800 dark:text-red-400 text-sm underline">
                          Dismiss
                        </button>
                      </div>
                    </div>
                  )}

                  {loading && !dataLoaded && (
                    <div className="flex justify-center items-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
                      <span className="ml-3 text-gray-600 dark:text-gray-400">Loading data...</span>
                    </div>
                  )}

                  <nav className="flex flex-wrap justify-center gap-2 mb-8">
                    {allTabs.map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => navigate(tab.path)}
                        className={`px-6 py-2 rounded-full transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                          location.pathname === tab.path
                            ? 'bg-gradient-to-r from-indigo-500 to-blue-500 text-white shadow-lg'
                            : 'bg-white/80 dark:bg-gray-800/80 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 border border-gray-200 dark:border-gray-700'
                        }`}
                        disabled={tab.disabled || (loading && !dataLoaded)}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </nav>
                </>
              )
            )}

            <Routes>
              <Route
                path="login"
                element={
                  authState.isAuthenticated ? (
                    <Navigate to="/admin/dashboard" replace />
                  ) : (
                    <LoginPage onAuthChange={handleAuthChange} />
                  )
                }
              />

              <Route
                path="forgot-password"
                element={
                  authState.isAuthenticated ? (
                    <Navigate to="/admin/dashboard" replace />
                  ) : (
                    <ForgotPassword />
                  )
                }
              />

              <Route
                path="reset-password"
                element={
                  authState.isAuthenticated ? (
                    <Navigate to="/admin/dashboard" replace />
                  ) : (
                    <ResetPassword />
                  )
                }
              />
              
              <Route 
                path="dashboard" 
                element={
                  <ProtectedRoute authState={authState} isLoadingAuth={isLoadingAuth}>
                    <Overview />
                  </ProtectedRoute>
                } 
              />
              
              <Route 
                path="contacts" 
                element={
                  <ProtectedRoute authState={authState} isLoadingAuth={isLoadingAuth}>
                    <ContactsPage />
                  </ProtectedRoute>
                } 
              />
              
              <Route 
                path="projects" 
                element={
                  <ProtectedRoute authState={authState} isLoadingAuth={isLoadingAuth}>
                    <ProjectsPage />
                  </ProtectedRoute>
                } 
              />
              
              <Route 
                path="skills" 
                element={
                  <ProtectedRoute authState={authState} isLoadingAuth={isLoadingAuth}>
                    <SkillsPage />
                  </ProtectedRoute>
                } 
              />
              
              <Route 
                path="experiences" 
                element={
                  <ProtectedRoute authState={authState} isLoadingAuth={isLoadingAuth}>
                    <ExperiencesPage />
                  </ProtectedRoute>
                } 
              />

              <Route 
                path="profile" 
                element={
                  <ProtectedRoute authState={authState} isLoadingAuth={isLoadingAuth}>
                    <Profile />
                  </ProtectedRoute>
                } 
              />

              <Route 
  path="profile-settings" 
  element={
    <ProtectedRoute authState={authState} isLoadingAuth={isLoadingAuth}>
      <ProfileManagement />
    </ProtectedRoute>
  } 
/>

<Route 
  path="about" 
  element={
    <ProtectedRoute authState={authState} isLoadingAuth={isLoadingAuth}>
      <AboutPage />
    </ProtectedRoute>
  } 
/>
              <Route 
                path="settings" 
                element={
                  <ProtectedRoute authState={authState} isLoadingAuth={isLoadingAuth}>
                    <Settings />
                  </ProtectedRoute>
                } 
              />
              
              <Route 
                path="sessions" 
                element={
                  <ProtectedRoute authState={authState} isLoadingAuth={isLoadingAuth}>
                    <SessionManager />
                  </ProtectedRoute>
                } 
              />

              <Route 
                path="activity-logs" 
                element={
                  <ProtectedRoute authState={authState} isLoadingAuth={isLoadingAuth}>
                    <ActivityLogs />
                  </ProtectedRoute>
                } 
              />
              
              <Route 
  path="security" 
  element={
    <ProtectedRoute authState={authState} isLoadingAuth={isLoadingAuth}>
      <SecurityAudit />
    </ProtectedRoute>
  } 
/>
              
              <Route 
                path="preview/projects/:id" 
                element={
                  <ProtectedRoute authState={authState} isLoadingAuth={isLoadingAuth}>
                    <ProjectPreview />
                  </ProtectedRoute>
                } 
              />
              
              {customTabs.map((tab) => (
                <Route 
                  key={tab.id} 
                  path={`custom/${tab.id}`} 
                  element={
                    <ProtectedRoute authState={authState} isLoadingAuth={isLoadingAuth}>
                      <CustomTabPage tabConfig={tab} />
                    </ProtectedRoute>
                  } 
                />
              ))}
              
              <Route 
                path="*" 
                element={
                  authState.isAuthenticated ? (
                    <Navigate to="/admin/dashboard" replace />
                  ) : (
                    <Navigate to="/admin/login" replace />
                  )
                } 
              />
            </Routes>
          </div>
        </section>
      </AdminContext.Provider>
    </ErrorBoundary>
  );
};

Admin.propTypes = {
  initialData: PropTypes.shape({
    contacts: PropTypes.array,
    projects: PropTypes.array,
    skills: PropTypes.array,
    experiences: PropTypes.array,
  }),
  apiConfig: PropTypes.shape({
    baseUrl: PropTypes.string,
  }),
  theme: PropTypes.oneOf(['light', 'dark', 'system']),
  onAuthChange: PropTypes.func,
  customTabs: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
    })
  ),
  authState: PropTypes.shape({
    isAuthenticated: PropTypes.bool,
    token: PropTypes.string,
    refreshToken: PropTypes.string,
    user: PropTypes.object,
    tokenExpiry: PropTypes.number,
  }),
};

export default Admin;