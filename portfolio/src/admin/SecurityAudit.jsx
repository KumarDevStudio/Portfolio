import React, { useState, useContext, useEffect, useCallback } from 'react';
import { Shield, Activity, Lock, AlertTriangle, CheckCircle, Clock, RefreshCw } from 'lucide-react';
import { AdminContext } from '../pages/Admin';
import { toast } from 'react-toastify';

const SecurityAudit = () => {
  const { token, apiRequest, apiConfig } = useContext(AdminContext);
  const [auditData, setAuditData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cleaningUp, setCleaningUp] = useState(false);
  const [error, setError] = useState('');

  // FIX: wrap in useCallback so it can be safely listed in useEffect deps
  const loadAuditData = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const response = await apiRequest(
        'get',
        '/admin/security-audit',
        null,
        token,
        apiConfig.baseUrl
      );

      if (response.data?.success) {
        setAuditData(response.data.data);
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to load security audit';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [apiRequest, apiConfig.baseUrl, token]);

  useEffect(() => {
    loadAuditData();
  }, [loadAuditData]);

  const handleCleanupTokens = async () => {
    setCleaningUp(true);
    try {
      const response = await apiRequest(
        'post',
        '/admin/cleanup-tokens',
        null,
        token,
        apiConfig.baseUrl
      );

      if (response.data?.success) {
        toast.success(`Cleaned up ${response.data.data?.total || 0} tokens`);
        loadAuditData();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to cleanup tokens');
    } finally {
      setCleaningUp(false);
    }
  };

  // FIX: removed superadmin-only gate — all authenticated admins can view
  // their own security audit (backend already scopes data to req.admin.adminId)

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
        <span className="ml-3 text-gray-600 dark:text-gray-400">Loading security audit...</span>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center">
            <Shield className="w-8 h-8 text-indigo-500 mr-3" />
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              Security Audit
            </h2>
          </div>
          <button
            onClick={handleCleanupTokens}
            disabled={cleaningUp}
            className="flex items-center px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw size={16} className={`mr-2 ${cleaningUp ? 'animate-spin' : ''}`} />
            {cleaningUp ? 'Cleaning...' : 'Cleanup Expired Tokens'}
          </button>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-lg flex items-center">
            <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 mr-2 flex-shrink-0" />
            <p className="text-red-800 dark:text-red-200 text-sm">{error}</p>
          </div>
        )}

        {auditData && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <Activity className="w-8 h-8 text-blue-500" />
                <span className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                  {auditData.sessionStats?.activeSessions || 0}
                </span>
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
                Active Sessions
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Currently logged in devices
              </p>
            </div>

            <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border border-green-200 dark:border-green-700 rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                {/* FIX: was CheckCircle (misleading for failed attempts) — use Lock */}
                <Lock className="w-8 h-8 text-green-500" />
                <span className="text-3xl font-bold text-green-600 dark:text-green-400">
                  {auditData.loginStats?.failedAttempts || 0}
                </span>
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
                Failed Attempts
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Last 24 hours
              </p>
            </div>

            <div className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 border border-purple-200 dark:border-purple-700 rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <Clock className="w-8 h-8 text-purple-500" />
                <span className="text-3xl font-bold text-purple-600 dark:text-purple-400">
                  {auditData.passwordStats?.daysSinceChange ?? '—'}
                </span>
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
                Days Since Password Change
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Last changed:{' '}
                {auditData.passwordStats?.lastChanged
                  ? new Date(auditData.passwordStats.lastChanged).toLocaleDateString()
                  : 'Never'}
              </p>
            </div>
          </div>
        )}

        {/* Last login info */}
        {auditData?.loginStats?.lastLogin && (
          <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              <strong className="text-gray-900 dark:text-white">Last login:</strong>{' '}
              {new Date(auditData.loginStats.lastLogin).toLocaleString()}
            </p>
          </div>
        )}

        {/* Top IPs table */}
        {auditData?.loginStats?.topLoginIPs?.length > 0 && (
          <div className="mt-8">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Top Login IP Addresses (Last 24h)
            </h3>
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-sm text-gray-600 dark:text-gray-400">
                    <th className="pb-2">IP Address</th>
                    <th className="pb-2">Login Count</th>
                  </tr>
                </thead>
                <tbody>
                  {auditData.loginStats.topLoginIPs.map((ip, index) => (
                    <tr key={index} className="border-t border-gray-200 dark:border-gray-600">
                      <td className="py-2 text-gray-900 dark:text-white font-mono text-sm">
                        {ip._id || 'Unknown'}
                      </td>
                      <td className="py-2 text-gray-900 dark:text-white">{ip.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SecurityAudit;