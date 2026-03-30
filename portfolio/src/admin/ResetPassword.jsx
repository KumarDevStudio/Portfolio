// src/admin/ResetPassword.jsx
import React, { useState, useEffect, useContext } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Lock, Eye, EyeOff, CheckCircle, AlertCircle, ArrowLeft } from 'lucide-react';
import { toast } from 'react-toastify';
import { AdminContext } from '../pages/Admin';

const ResetPassword = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { apiRequest, apiConfig } = useContext(AdminContext);

  const token = searchParams.get('token');

  const [step, setStep] = useState('verifying'); // verifying | form | success | invalid
  const [tokenInfo, setTokenInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [formData, setFormData] = useState({
    newPassword: '',
    confirmPassword: '',
  });

  // ─── Verify token on mount ────────────────────────────────────────────────
  useEffect(() => {
    if (!token) {
      setStep('invalid');
      return;
    }

    const verifyToken = async () => {
      try {
        const response = await apiRequest(
          'get',
          `/admin/verify-reset-token?token=${token}`,
          null,
          null,
          apiConfig.baseUrl
        );

        if (response.data?.success) {
          setTokenInfo(response.data.data);
          setStep('form');
        } else {
          setStep('invalid');
        }
      } catch (err) {
        setStep('invalid');
      }
    };

    verifyToken();
  }, [token, apiRequest, apiConfig.baseUrl]);

  // ─── Password validation ──────────────────────────────────────────────────
  const validatePassword = (password) => {
    if (password.length < 8) return 'Password must be at least 8 characters';
    if (!/[A-Z]/.test(password)) return 'Password must contain an uppercase letter';
    if (!/[a-z]/.test(password)) return 'Password must contain a lowercase letter';
    if (!/[0-9]/.test(password)) return 'Password must contain a number';
    if (!/[@$!%*?&]/.test(password)) return 'Password must contain a special character (@$!%*?&)';
    return null;
  };

  // ─── Submit ───────────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const passwordError = validatePassword(formData.newPassword);
    if (passwordError) {
      setError(passwordError);
      return;
    }

    if (formData.newPassword !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      const response = await apiRequest(
        'post',
        '/admin/reset-password',
        { token, newPassword: formData.newPassword },
        null,
        apiConfig.baseUrl
      );

      if (response.data?.success) {
        setStep('success');
        toast.success('Password reset successfully!');
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to reset password. Please try again.';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  // ─── States ───────────────────────────────────────────────────────────────

  if (step === 'verifying') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-indigo-50 dark:from-gray-900 dark:to-indigo-900">
        <div className="flex items-center space-x-3 text-gray-600 dark:text-gray-400">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
          <span>Verifying reset link...</span>
        </div>
      </div>
    );
  }

  if (step === 'invalid') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-indigo-50 dark:from-gray-900 dark:to-indigo-900 px-4">
        <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Invalid or Expired Link
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            This password reset link is invalid or has expired. Please request a new one.
          </p>
          <Link
            to="/admin/forgot-password"
            className="inline-flex items-center justify-center w-full py-3 px-4 bg-gradient-to-r from-indigo-500 to-blue-500 text-white rounded-lg font-semibold hover:from-indigo-600 hover:to-blue-600 transition-all duration-200 mb-4"
          >
            Request New Reset Link
          </Link>
          <Link
            to="/admin/login"
            className="inline-flex items-center text-sm text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
          >
            <ArrowLeft size={16} className="mr-2" />
            Back to login
          </Link>
        </div>
      </div>
    );
  }

  if (step === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-indigo-50 dark:from-gray-900 dark:to-indigo-900 px-4">
        <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 text-center">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Password Reset!
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Your password has been reset successfully. You can now log in with your new password.
          </p>
          <button
            onClick={() => navigate('/admin/login')}
            className="inline-flex items-center justify-center w-full py-3 px-4 bg-gradient-to-r from-indigo-500 to-blue-500 text-white rounded-lg font-semibold hover:from-indigo-600 hover:to-blue-600 transition-all duration-200"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  // step === 'form'
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-indigo-50 dark:from-gray-900 dark:to-indigo-900 px-4">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
        <div className="text-center mb-8">
          <div className="mx-auto w-16 h-16 bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center mb-4">
            <Lock className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
          </div>
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Reset Password
          </h2>
          {tokenInfo?.username && (
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              Setting new password for <strong>{tokenInfo.username}</strong>
            </p>
          )}
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-lg flex items-center">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 mr-2 flex-shrink-0" />
            <span className="text-red-800 dark:text-red-200 text-sm">{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              New Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type={showNewPassword ? 'text' : 'password'}
                value={formData.newPassword}
                onChange={(e) => setFormData(prev => ({ ...prev, newPassword: e.target.value }))}
                required
                className="w-full pl-10 pr-12 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(p => !p)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showNewPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Min 8 characters with uppercase, lowercase, number, and special character (@$!%*?&)
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Confirm New Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                value={formData.confirmPassword}
                onChange={(e) => setFormData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                required
                className="w-full pl-10 pr-12 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(p => !p)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
            {/* Live match indicator */}
            {formData.confirmPassword && (
              <p className={`mt-1 text-xs flex items-center gap-1 ${
                formData.newPassword === formData.confirmPassword
                  ? 'text-green-600 dark:text-green-400'
                  : 'text-red-600 dark:text-red-400'
              }`}>
                {formData.newPassword === formData.confirmPassword
                  ? <><CheckCircle size={12} /> Passwords match</>
                  : <><AlertCircle size={12} /> Passwords do not match</>
                }
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center py-3 px-4 bg-gradient-to-r from-indigo-500 to-blue-500 text-white rounded-lg font-semibold hover:from-indigo-600 hover:to-blue-600 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Resetting...
              </>
            ) : (
              'Reset Password'
            )}
          </button>
        </form>

        <div className="mt-6 text-center">
          <Link
            to="/admin/login"
            className="inline-flex items-center text-sm text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
          >
            <ArrowLeft size={16} className="mr-2" />
            Back to login
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;