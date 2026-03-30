// src/admin/LoginPage.jsx
import React, { useState, useContext, useCallback, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'react-toastify';
import { EyeIcon, EyeSlashIcon, ShieldCheckIcon } from '@heroicons/react/24/outline';
import { AdminContext } from '../pages/Admin';

// Countdown component for locked accounts
const LockCountdown = ({ lockUntil }) => {
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = new Date().getTime();
      const lockTime = new Date(lockUntil).getTime();
      const diff = lockTime - now;

      if (diff <= 0) {
        setTimeLeft('Account unlocked - please refresh');
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      if (hours > 0) {
        setTimeLeft(`${hours}h ${minutes}m ${seconds}s`);
      } else if (minutes > 0) {
        setTimeLeft(`${minutes}m ${seconds}s`);
      } else {
        setTimeLeft(`${seconds}s`);
      }
    };

    calculateTimeLeft();
    const interval = setInterval(calculateTimeLeft, 1000);
    return () => clearInterval(interval);
  }, [lockUntil]);

  return (
    <div className="text-sm font-mono text-yellow-800 dark:text-yellow-200 mt-2">
      Time remaining: {timeLeft}
    </div>
  );
};

const LoginPage = ({ onAuthChange }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const adminContext = useContext(AdminContext);

  const [formData, setFormData] = useState({ username: '', password: '' });
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [lockInfo, setLockInfo] = useState(null);
  // FIX: use state instead of ref so "Reset Form" button re-renders correctly
  const [attemptCount, setAttemptCount] = useState(0);

  const mountedRef = useRef(true);
  const lastAttemptTimeRef = useRef(0);
  const attemptCountRef = useRef(0);
  const abortControllerRef = useRef(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort('Component unmounting');
      }
    };
  }, []);

  const getApiUrl = useCallback(() => {
    return (
      adminContext?.apiConfig?.baseUrl ||
      import.meta.env.VITE_API_URL ||
      'http://127.0.0.1:5000/api'
    );
  }, [adminContext?.apiConfig?.baseUrl]);

  const validateForm = useCallback(() => {
    const newErrors = {};

    if (!formData.username.trim()) {
      newErrors.username = 'Username is required';
    } else if (formData.username.trim().length < 3) {
      newErrors.username = 'Username must be at least 3 characters';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData]);

  const resetForm = useCallback(() => {
    setFormData({ username: '', password: '' });
    setErrors({});
    if (adminContext?.setApiError) {
      adminContext.setApiError(null);
    }
    setLockInfo(null);
    setAttemptCount(0);
    attemptCountRef.current = 0;
    lastAttemptTimeRef.current = 0;
  }, [adminContext]);

  const handleRateLimiting = useCallback(() => {
    const now = Date.now();
    const timeSinceLastAttempt = now - lastAttemptTimeRef.current;
    const minTimeBetweenAttempts = Math.pow(2, Math.min(attemptCountRef.current, 5)) * 1000;

    if (timeSinceLastAttempt < minTimeBetweenAttempts && attemptCountRef.current > 2) {
      const waitTime = Math.ceil((minTimeBetweenAttempts - timeSinceLastAttempt) / 1000);
      if (adminContext?.setApiError) {
        adminContext.setApiError(`Please wait ${waitTime} seconds before trying again.`);
      }
      return false;
    }

    return true;
  }, [adminContext]);

  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault();

      if (isLoading || !mountedRef.current) return;

      if (!handleRateLimiting()) {
        return;
      }

      setIsLoading(true);
      if (adminContext?.setApiError) {
        adminContext.setApiError(null);
      }
      setLockInfo(null);

      attemptCountRef.current += 1;
      lastAttemptTimeRef.current = Date.now();
      setAttemptCount(attemptCountRef.current);

      if (!validateForm()) {
        setIsLoading(false);
        return;
      }

      try {
        if (abortControllerRef.current) {
          abortControllerRef.current.abort('New login attempt');
        }

        const abortController = new AbortController();
        abortControllerRef.current = abortController;

        const sanitizedData = {
          username: adminContext?.sanitizeInput?.(formData.username) || formData.username.trim(),
          password: formData.password,
        };

        const apiUrl = getApiUrl();
        console.log('Login attempt to:', `${apiUrl}/admin/login`);

        const response = await adminContext.apiRequest(
          'post',
          '/admin/login',
          sanitizedData,
          null,
          apiUrl,
          {
            timeout: 60000,
            signal: abortController.signal,
          }
        );

        if (!mountedRef.current) return;

        if (!response.data?.success) {
          throw new Error(response.data?.message || 'Login failed');
        }

        const responseData = response.data.data || response.data;
        console.log('Login successful, response:', responseData);

        const token = responseData.accessToken || responseData.token;
        const refreshToken = responseData.refreshToken;
        const user = responseData.admin || responseData.user || {
          username: sanitizedData.username,
          role: responseData.role || 'admin',
        };

        if (!token) {
          throw new Error('Invalid response from server: Missing authentication token');
        }

        const tokenExpiry = Date.now() + 14 * 60 * 1000;
        const authData = {
          adminToken: token,
          refreshToken: refreshToken || '',
          user: JSON.stringify(user),
          tokenValidation: JSON.stringify({
            token,
            expires: tokenExpiry,
          }),
        };

        Object.entries(authData).forEach(([key, value]) => {
          localStorage.setItem(key, value);
        });

        attemptCountRef.current = 0;
        setAttemptCount(0);

        if (onAuthChange) {
          onAuthChange(true, token, user, refreshToken);
        }

        if (mountedRef.current) {
          toast.success(`Welcome back, ${user.username}!`);
          const targetPath = location.state?.from?.pathname || '/admin/contacts';
          console.log('Navigating to:', targetPath);
          navigate(targetPath, { replace: true });
        }
      } catch (error) {
        if (!mountedRef.current) return;

        console.error('Login error:', error);

        if (error.response?.status === 423) {
          const lockDetails = error.response.data?.data || error.response.data;
          setLockInfo({
            message: error.response.data?.message || 'Account temporarily locked',
            lockUntil: lockDetails?.lockUntil
              ? new Date(lockDetails.lockUntil).toISOString()
              : null,
            attemptsRemaining: lockDetails?.remainingAttempts || 0,
          });
          if (adminContext?.setApiError) {
            adminContext.setApiError(
              `Account locked due to too many failed attempts. Please wait before trying again.`
            );
          }
        } else if (error.response?.status === 429) {
          const retryAfter = error.response.headers?.['retry-after'];
          const waitTime = retryAfter ? parseInt(retryAfter) : 60;
          if (adminContext?.setApiError) {
            adminContext.setApiError(`Too many login attempts. Please wait ${waitTime} seconds.`);
          }
        } else if (error.response?.status === 401) {
          const errorData = error.response.data;
          const remainingAttempts = errorData?.data?.remainingAttempts;

          if (adminContext?.setApiError) {
            let message = 'Invalid username or password.';
            if (remainingAttempts !== undefined && remainingAttempts > 0) {
              message += ` ${remainingAttempts} attempt${remainingAttempts !== 1 ? 's' : ''} remaining.`;
            } else if (remainingAttempts === 0) {
              message = 'Account will be locked after one more failed attempt.';
            }
            adminContext.setApiError(message);
          }
        } else if (error.code === 'ECONNABORTED' || error.name === 'AbortError') {
          if (error.name !== 'AbortError' && adminContext?.setApiError) {
            adminContext.setApiError('Request timed out. Please try again.');
          }
        } else if (error.code === 'NETWORK_ERROR' || !error.response) {
          if (adminContext?.setApiError) {
            adminContext.setApiError('Unable to connect to the server. Please check your connection.');
          }
        } else if (error.response?.status >= 500) {
          if (adminContext?.setApiError) {
            adminContext.setApiError('Server error. Please try again later.');
          }
        } else {
          const errorMessage =
            error.response?.data?.message ||
            error.message ||
            'Login failed. Please check your credentials.';
          if (adminContext?.setApiError) {
            adminContext.setApiError(errorMessage);
          }
        }
      } finally {
        if (mountedRef.current) {
          setIsLoading(false);
        }
      }
    },
    [
      isLoading,
      handleRateLimiting,
      validateForm,
      formData,
      adminContext,
      getApiUrl,
      onAuthChange,
      location.state?.from?.pathname,
      navigate,
    ]
  );

  const handleInputChange = useCallback(
    (e) => {
      const { name, value } = e.target;

      setFormData((prev) => ({ ...prev, [name]: value }));

      if (errors[name]) {
        setErrors((prev) => ({ ...prev, [name]: null }));
      }

      if (adminContext?.apiError && adminContext?.setApiError) {
        adminContext.setApiError(null);
      }

      if (lockInfo) {
        setLockInfo(null);
      }
    },
    [errors, adminContext, lockInfo]
  );

  // FIX: navigate to the dedicated ForgotPassword page instead of using
  // prompt() (bad UX) and calling the wrong endpoint (/reset-password)
  const handleForgotPassword = useCallback(() => {
    navigate('/admin/forgot-password');
  }, [navigate]);

  const togglePasswordVisibility = useCallback(() => {
    setShowPassword((prev) => !prev);
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-indigo-50 dark:from-gray-900 dark:to-indigo-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="bg-white dark:bg-gray-800 shadow-xl rounded-2xl p-8 border border-gray-200 dark:border-gray-700">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="mx-auto w-16 h-16 bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center mb-4">
              <ShieldCheckIcon className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
            </div>
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              Admin Login
            </h2>
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              Sign in to your admin dashboard
            </p>
          </div>

          {/* API Error Alert */}
          {adminContext?.apiError && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-lg">
              <div className="flex items-start">
                <svg
                  className="w-5 h-5 text-red-600 dark:text-red-400 mr-2 mt-0.5 flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 18.5c-.77.833.192 2.5 1.732 2.5z"
                  />
                </svg>
                <div className="flex-1">
                  <span className="text-red-800 dark:text-red-200 text-sm font-medium">
                    {adminContext.apiError}
                  </span>
                  <button
                    onClick={() => adminContext.setApiError?.(null)}
                    className="block mt-2 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 text-xs underline"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Lock Warning */}
          {lockInfo && (
            <div className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-700 rounded-lg">
              <div className="flex items-start">
                <svg
                  className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mr-2 mt-0.5 flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M12 15v2m-4 0h8m-8 0V9a4 4 0 118 0v6M3 20h18a1 1 0 001-1v-8a1 1 0 00-1-1H4a1 1 0 00-1 1v8a1 1 0 001 1z"
                  />
                </svg>
                <div className="text-yellow-800 dark:text-yellow-200 text-sm flex-1">
                  <div className="font-medium mb-1">{lockInfo.message}</div>
                  {lockInfo.lockUntil && (
                    <LockCountdown lockUntil={lockInfo.lockUntil} />
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Login Form */}
          <div className="space-y-6">
            <div>
              <label
                htmlFor="username"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
              >
                Username or Email
              </label>
              <input
                type="text"
                id="username"
                name="username"
                value={formData.username}
                onChange={handleInputChange}
                onKeyDown={(e) => e.key === 'Enter' && handleSubmit(e)}
                placeholder="Enter your username"
                disabled={isLoading || !!lockInfo}
                autoComplete="username"
                className={`w-full px-4 py-3 border rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${
                  errors.username
                    ? 'border-red-300 bg-red-50 dark:bg-red-900/20 dark:border-red-600'
                    : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700'
                } text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400`}
                aria-invalid={errors.username ? 'true' : 'false'}
              />
              {errors.username && (
                <p className="mt-2 text-sm text-red-600 dark:text-red-400">{errors.username}</p>
              )}
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
              >
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  onKeyDown={(e) => e.key === 'Enter' && handleSubmit(e)}
                  placeholder="Enter your password"
                  disabled={isLoading || !!lockInfo}
                  autoComplete="current-password"
                  className={`w-full px-4 py-3 border rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors pr-12 ${
                    errors.password
                      ? 'border-red-300 bg-red-50 dark:bg-red-900/20 dark:border-red-600'
                      : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700'
                  } text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400`}
                  aria-invalid={errors.password ? 'true' : 'false'}
                />
                <button
                  type="button"
                  onClick={togglePasswordVisibility}
                  disabled={isLoading || !!lockInfo}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded-r-lg disabled:opacity-50"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <EyeSlashIcon className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                  ) : (
                    <EyeIcon className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="mt-2 text-sm text-red-600 dark:text-red-400">{errors.password}</p>
              )}
            </div>

            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={handleForgotPassword}
                disabled={isLoading || !!lockInfo}
                className="text-sm text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 rounded px-1 py-1 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Forgot Password?
              </button>
              {/* FIX: was using attemptCountRef.current which doesn't trigger re-render */}
              {attemptCount > 0 && (
                <button
                  type="button"
                  onClick={resetForm}
                  disabled={isLoading}
                  className="text-sm text-gray-600 hover:text-gray-500 dark:text-gray-400 dark:hover:text-gray-300 focus:outline-none focus:underline disabled:opacity-50"
                >
                  Reset Form
                </button>
              )}
            </div>

            <button
              onClick={handleSubmit}
              disabled={isLoading || !!lockInfo}
              className={`w-full flex justify-center items-center py-3 px-4 rounded-lg text-sm font-medium text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-all duration-200 ${
                isLoading || lockInfo
                  ? 'bg-indigo-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 transform hover:scale-105'
              }`}
            >
              {isLoading ? (
                <>
                  <svg
                    className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Signing in...
                </>
              ) : lockInfo ? (
                'Account Locked'
              ) : (
                'Sign In'
              )}
            </button>
          </div>

          {/* Footer */}
          <div className="mt-6 text-center space-y-2">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Having trouble? Contact your system administrator.
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500">
              Protected by enterprise-grade security
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;