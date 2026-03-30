// Fixed SessionManager.jsx
import React, { useState, useContext, useEffect } from 'react';
import { Monitor, Smartphone, Tablet, Globe, Trash2, AlertCircle, RefreshCw } from 'lucide-react';
import { AdminContext } from '../pages/Admin';
import { toast } from 'react-toastify';

const SessionManager = () => {
  const { token, refreshToken, apiRequest, apiConfig } = useContext(AdminContext);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revoking, setRevoking] = useState(null);

  useEffect(() => {
    loadSessions();
  }, []);

const loadSessions = async () => {
  setLoading(true);
  setError('');

  try {
    const response = await apiRequest(
      'get',
      '/admin/sessions',
      { refreshToken: refreshToken || '' }, // Pass in body instead of header
      token,
      apiConfig.baseUrl
    );

    if (response.data?.success) {
      setSessions(response.data.data?.sessions || []);
    }
  } catch (err) {
    console.error('Load sessions error:', err);
    setError(err.response?.data?.message || 'Failed to load sessions');
    toast.error('Failed to load sessions');
  } finally {
    setLoading(false);
  }
};

  const handleRevokeSession = async (sessionId) => {
    if (!confirm('Are you sure you want to revoke this session?')) return;

    setRevoking(sessionId);

    try {
      const response = await apiRequest(
        'delete',
        `/admin/sessions/${sessionId}`,
        null,
        token,
        apiConfig.baseUrl
      );

      if (response.data?.success) {
        setSessions(sessions.filter(s => s.id !== sessionId));
        toast.success('Session revoked successfully');
      }
    } catch (err) {
      console.error('Revoke session error:', err);
      toast.error(err.response?.data?.message || 'Failed to revoke session');
    } finally {
      setRevoking(null);
    }
  };

  const handleLogoutAll = async () => {
    if (!confirm('Are you sure you want to logout from all devices? You will need to login again.')) return;

    setLoading(true);

    try {
      const response = await apiRequest(
        'post',
        '/admin/logout-all',
        null,
        token,
        apiConfig.baseUrl
      );

      if (response.data?.success) {
        toast.success('Logged out from all devices');
        // Clear local storage and redirect
        localStorage.removeItem('adminToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
        localStorage.removeItem('tokenValidation');
        setTimeout(() => {
          window.location.href = '/admin/login';
        }, 1000);
      }
    } catch (err) {
      console.error('Logout all error:', err);
      toast.error(err.response?.data?.message || 'Failed to logout from all devices');
      setLoading(false);
    }
  };

  const getDeviceIcon = (deviceType) => {
    switch (deviceType?.toLowerCase()) {
      case 'mobile':
        return <Smartphone className="w-5 h-5" />;
      case 'tablet':
        return <Tablet className="w-5 h-5" />;
      case 'desktop':
        return <Monitor className="w-5 h-5" />;
      default:
        return <Globe className="w-5 h-5" />;
    }
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleString();
  };

  const getTimeAgo = (date) => {
    const seconds = Math.floor((new Date() - new Date(date)) / 1000);
    
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
        <span className="ml-3 text-gray-600 dark:text-gray-400">Loading sessions...</span>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Active Sessions
          </h2>
          <div className="flex gap-3">
            <button
              onClick={loadSessions}
              disabled={loading}
              className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors flex items-center disabled:opacity-50"
            >
              <RefreshCw size={16} className="mr-2" />
              Refresh
            </button>
            <button
              onClick={handleLogoutAll}
              disabled={loading}
              className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50"
            >
              Logout All Devices
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-lg flex items-center">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 mr-2 flex-shrink-0" />
            <span className="text-red-800 dark:text-red-200 text-sm">{error}</span>
          </div>
        )}

        <div className="mb-4 text-sm text-gray-600 dark:text-gray-400">
          You have {sessions.length} active session{sessions.length !== 1 ? 's' : ''}
        </div>

        <div className="space-y-4">
          {sessions.map((session) => (
            <div
              key={session.id}
              className={`border ${
                session.isCurrentSession
                  ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                  : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-700/50'
              } rounded-lg p-4 transition-all duration-200`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-3">
                  <div className="text-gray-600 dark:text-gray-400 mt-1">
                    {getDeviceIcon(session.deviceType)}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-gray-900 dark:text-white">
                        {session.deviceType || 'Unknown Device'}
                      </h3>
                      {session.isCurrentSession && (
                        <span className="px-2 py-1 bg-indigo-500 text-white text-xs rounded-full">
                          Current Session
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      <span className="font-medium">IP:</span> {session.ipAddress || 'Unknown'}
                    </p>
                    {session.location && (
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        <span className="font-medium">Location:</span> {session.location}
                      </p>
                    )}
                    {session.userAgent && session.userAgent !== 'unknown' && (
                      <p className="text-xs text-gray-500 dark:text-gray-500 mt-1 break-all">
                        {session.userAgent}
                      </p>
                    )}
                    <div className="flex gap-4 mt-2 text-xs text-gray-500 dark:text-gray-400">
                      <span>
                        <span className="font-medium">Last active:</span> {getTimeAgo(session.lastUsed)}
                      </span>
                      <span>
                        <span className="font-medium">Created:</span> {formatDate(session.createdAt)}
                      </span>
                    </div>
                  </div>
                </div>
                {!session.isCurrentSession && (
                  <button
                    onClick={() => handleRevokeSession(session.id)}
                    disabled={revoking === session.id}
                    className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                    title="Revoke this session"
                  >
                    {revoking === session.id ? (
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-red-600"></div>
                    ) : (
                      <Trash2 size={18} />
                    )}
                  </button>
                )}
              </div>
            </div>
          ))}

          {sessions.length === 0 && !loading && (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              <Globe className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">No active sessions found</p>
              <p className="text-sm mt-2">Your sessions will appear here when you login.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SessionManager;