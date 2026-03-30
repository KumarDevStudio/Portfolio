// src/admin/ContactsPage.jsx - Complete Fixed Version with Superadmin Support
import React, { useContext, useState, useCallback, useEffect, useRef } from 'react';
import { toast } from 'react-toastify';
import { Search, Check, Send, Trash2, ChevronUp, ChevronDown, RefreshCw } from 'lucide-react';
import { debounce } from 'lodash';
import { DateTime } from 'luxon';
import { AdminContext } from '../pages/Admin';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import  FormSelect  from './FormSelect';
import  ConfirmationModal from './ConfirmationModal';
import sanitizeHtml from 'sanitize-html';

// Configure axios-retry for exponential backoff
import axiosRetry from 'axios-retry';
axiosRetry(axios, {
  retries: 3,
  retryDelay: (retryCount) => Math.pow(2, retryCount) * 1000,
  retryCondition: (error) => error.response?.status === 429 || !error.response,
});

// Input sanitization function
const sanitizeInput = (input) =>
  typeof input === 'string'
    ? sanitizeHtml(input, { allowedTags: [], allowedAttributes: {} }).trim()
    : input;

// API request function
const apiRequest = async (method, endpoint, data, token, baseUrl, options = {}) => {
  try {
    const config = {
      method,
      url: `${baseUrl}${endpoint}`,
      headers: {
        ...(method.toLowerCase() !== 'delete' && data && { 'Content-Type': 'application/json' }),
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      data,
      timeout: 60000,
      ...options,
    };
    const response = await axios(config);
    return response;
  } catch (error) {
    if (error.name === 'CanceledError' || error.code === 'ECONNABORTED' || error.code === 'ERR_CANCELED') {
      throw new Error('Request timed out or was aborted');
    }
    throw error;
  }
};

// Status badge component
const StatusBadge = ({ status }) => {
  const getStatusStyle = (status) => {
    switch (status) {
      case 'new':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'read':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'replied':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'archived':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
      case 'spam':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  return (
    <span className={`px-2 py-1 text-xs rounded-full capitalize ${getStatusStyle(status)}`}>
      {status}
    </span>
  );
};

// Loading spinner component
const LoadingSpinner = ({ size = 'md', className = '' }) => {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-8 w-8',
  };

  return (
    <div
      className={`animate-spin rounded-full border-2 border-gray-300 border-t-indigo-600 ${sizeClasses[size]} ${className}`}
    ></div>
  );
};

// Skeleton contact card component
const SkeletonContactCard = () => (
  <div className="p-6 bg-white/90 dark:bg-gray-800/90 border rounded-2xl animate-pulse">
    <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-2"></div>
    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3 mb-2"></div>
    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full mb-2"></div>
    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
  </div>
);

// Contact card component
const ContactCard = React.memo(
  ({
    contact,
    isSelected,
    onSelect,
    onMarkRead,
    onReply,
    onDelete,
    isLoading,
    userRole,
    replyData,
    onReplyChange,
    onSendReply,
    onCancelReply,
  }) => {
    // FIXED: Support superadmin, admin, and editor roles
    const effectiveRole = userRole || 'admin';
    const canEdit = ['admin', 'editor', 'superadmin'].includes(effectiveRole);
    const canDelete = ['admin', 'superadmin'].includes(effectiveRole);

    return (
      <div
        className={`p-6 bg-white/90 dark:bg-gray-800/90 border border-gray-200/50 dark:border-gray-700/50 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-200 ${
          contact.status === 'read' || contact.status === 'archived' ? 'opacity-80' : ''
        }`}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-start space-x-4 flex-1">
            {canDelete && (
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => onSelect(contact._id)}
                className="mt-1 h-4 w-4 text-indigo-600 rounded focus:ring-indigo-500"
                disabled={isLoading}
                aria-label={`Select contact from ${sanitizeInput(contact.name)}`}
              />
            )}

            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <h3 className="text-lg font-semibold">{sanitizeInput(contact.name)}</h3>
                <StatusBadge status={contact.status} />
              </div>

              <p className="text-gray-600 dark:text-gray-300 mb-1">{sanitizeInput(contact.email)}</p>

              {contact.subject && (
                <p className="text-gray-800 dark:text-gray-200 font-medium mb-2">
                  Subject: {sanitizeInput(contact.subject)}
                </p>
              )}

              <p className="text-gray-600 dark:text-gray-300 mb-3 line-clamp-3">
                {sanitizeInput(contact.message)}
              </p>

              <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                <span>{DateTime.fromISO(contact.createdAt).toLocaleString(DateTime.DATETIME_MED)}</span>
                {contact.priority && <span className="capitalize">Priority: {contact.priority}</span>}
                {contact.source && <span className="capitalize">Source: {contact.source}</span>}
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            {contact.status === 'new' && canEdit && (
              <button
                onClick={() => onMarkRead(contact._id)}
                className="text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 flex items-center transition-colors px-3 py-1 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/20"
                disabled={isLoading}
                aria-label={`Mark contact from ${sanitizeInput(contact.name)} as read`}
              >
                {isLoading ? (
                  <LoadingSpinner size="sm" className="mr-1" />
                ) : (
                  <Check size={16} className="mr-1" />
                )}
                Mark Read
              </button>
            )}

            {canEdit && contact.status !== 'replied' && (
              <button
                onClick={() => onReply(contact._id)}
                className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 flex items-center transition-colors px-3 py-1 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20"
                disabled={isLoading}
                aria-label={`Reply to contact from ${sanitizeInput(contact.name)}`}
              >
                <Send size={16} className="mr-1" />
                Reply
              </button>
            )}

            {canDelete && (
              <button
                onClick={() => onDelete(contact._id)}
                className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 flex items-center transition-colors px-3 py-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
                disabled={isLoading}
                aria-label={`Delete contact from ${sanitizeInput(contact.name)}`}
              >
                {isLoading ? (
                  <LoadingSpinner size="sm" />
                ) : (
                  <Trash2 size={16} />
                )}
              </button>
            )}
          </div>
        </div>

        {replyData?.contactId === contact._id && (
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <textarea
              value={replyData.message}
              onChange={(e) => onReplyChange(e.target.value)}
              placeholder="Type your reply..."
              rows={4}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 bg-white dark:bg-gray-800"
              disabled={isLoading}
              aria-label={`Reply message to ${sanitizeInput(contact.name)}`}
            />
            <div className="flex justify-end gap-2 mt-3">
              <button
                onClick={onCancelReply}
                className="text-gray-600 dark:text-gray-300 py-2 px-4 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                disabled={isLoading}
                aria-label="Cancel reply"
              >
                Cancel
              </button>
              <button
                onClick={onSendReply}
                className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg flex items-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isLoading || !replyData.message.trim()}
                aria-label="Send reply"
              >
                {isLoading ? (
                  <LoadingSpinner size="sm" className="mr-2" />
                ) : (
                  <Send size={16} className="mr-2" />
                )}
                Send Reply
              </button>
            </div>
          </div>
        )}
      </div>
    );
  },
);

const ContactsPage = () => {
  const {
    contacts,
    setContacts,
    totalPages,
    setTotalPages,
    error,
    setError,
    apiError,
    setApiError,
    token,
    isTokenValid,
    userRole,
    getErrorMessage,
    dataLoaded,
    apiConfig,
  } = useContext(AdminContext);

  // FIXED: Ensure userRole always has a value and support all admin roles
  const effectiveUserRole = userRole || 'admin';
  
  // Permission helper functions
  const hasEditPermission = () => ['admin', 'editor', 'superadmin'].includes(effectiveUserRole);
  const hasDeletePermission = () => ['admin', 'superadmin'].includes(effectiveUserRole);

  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [sortConfig, setSortConfig] = useState({ key: 'createdAt', direction: 'desc' });
  const [selectedItems, setSelectedItems] = useState([]);
  const [actionLoading, setActionLoading] = useState(new Set());
  const [replyData, setReplyData] = useState({ contactId: null, message: '' });
  const [modal, setModal] = useState({ isOpen: false, message: '', onConfirm: () => {}, type: 'warning' });
  const [statusFilter, setStatusFilter] = useState('all');
  const [isAnyLoading, setIsAnyLoading] = useState(false);

  const abortControllerRef = useRef(null);
  const searchTimeoutRef = useRef(null);
  const isMountedRef = useRef(true);
  const navigate = useNavigate();

  // Validate ObjectId
  const isValidObjectId = (id) => /^[0-9a-fA-F]{24}$/.test(id);

  // Fetch state management
  const fetchStateRef = useRef({
    isLoading: false,
    lastFetch: 0,
    currentParams: null,
  });

  // Fetch contacts with server-side search
  const fetchContacts = useCallback(
    debounce(
      async (retryCount = 0) => {
        if (!token || !isTokenValid || !isMountedRef.current) {
          console.log('Skipping fetchContacts: Invalid auth state');
          return;
        }

        const params = {
          page: currentPage,
          limit: itemsPerPage,
          status: statusFilter !== 'all' ? statusFilter : undefined,
          search: searchTerm || undefined,
        };

        const paramsKey = JSON.stringify(params);
        const now = Date.now();

        if (fetchStateRef.current.isLoading && fetchStateRef.current.currentParams === paramsKey) {
          console.log('Skipping duplicate fetchContacts request');
          return;
        }

        if (!retryCount && (now - fetchStateRef.current.lastFetch < 1000)) {
          console.log('Rate limiting fetchContacts request');
          return;
        }

        fetchStateRef.current.isLoading = true;
        fetchStateRef.current.currentParams = paramsKey;
        fetchStateRef.current.lastFetch = now;

        setIsAnyLoading(true);
        setError(null);
        setApiError(null);

        try {
          const queryParams = new URLSearchParams();
          Object.entries(params).forEach(([key, value]) => {
            if (value !== undefined) {
              queryParams.append(key, value.toString());
            }
          });

          if (abortControllerRef.current) {
            abortControllerRef.current.abort('New request started');
          }
          const abortController = new AbortController();
          abortControllerRef.current = abortController;

          const response = await apiRequest(
            'get',
            `/contacts?${queryParams.toString()}`,
            null,
            token,
            apiConfig.baseUrl,
            { signal: abortController.signal },
          );

          if (abortController.signal.aborted) {
            return;
          }

          if (response.data?.success && isMountedRef.current) {
            const data = response.data.data || {};
            const contactsData = Array.isArray(data.contacts) ? data.contacts : Array.isArray(data) ? data : [];
            setContacts(contactsData);
            const totalPagesCount = data.pagination?.pages || 1;
            setTotalPages((prev) => ({ ...prev, contacts: totalPagesCount }));
            if (retryCount === 0) {
              toast.success('Contacts loaded successfully!');
            }
          } else if (isMountedRef.current) {
            throw new Error(response.data?.message || 'Invalid response format');
          }
        } catch (err) {
          if (
            err.name === 'AbortError' ||
            err.name === 'CanceledError' ||
            err.code === 'ERR_CANCELED' ||
            err.code === 'ECONNABORTED'
          ) {
            return;
          }

          if (err.response?.status === 401 && isMountedRef.current) {
            setApiError('Session invalid or expired. Please log in again.');
            toast.error('Session invalid or expired. Please log in again.');
            navigate('/admin/login', { replace: true });
            return;
          }

          if (err.response?.status === 429 && retryCount < 3 && isMountedRef.current) {
            const delay = Math.pow(2, retryCount) * 2000;
            setTimeout(() => fetchContacts(retryCount + 1), delay);
            return;
          }

          if (isMountedRef.current) {
            const errorMessage = err.response?.data?.message || getErrorMessage(err);
            setError(errorMessage);
            setApiError(errorMessage);
            toast.error(errorMessage);
          }
        } finally {
          if (isMountedRef.current) {
            setIsAnyLoading(false);
            fetchStateRef.current.isLoading = false;
          }
        }
      },
      800,
      { leading: false, trailing: true },
    ),
    [
      token,
      isTokenValid,
      currentPage,
      itemsPerPage,
      statusFilter,
      searchTerm,
      apiConfig.baseUrl,
      setContacts,
      setTotalPages,
      setError,
      setApiError,
      navigate,
      getErrorMessage,
    ],
  );

  // Action handlers
  const handleMarkRead = useCallback(
    async (id) => {
      if (!hasEditPermission()) {
        toast.error('Insufficient permissions');
        return;
      }

      if (!isValidObjectId(id)) {
        toast.error('Invalid contact ID');
        return;
      }

      setActionLoading((prev) => new Set(prev).add(id));

      try {
        const response = await apiRequest(
          'patch',
          `/contacts/${id}/read`,
          null,
          token,
          apiConfig.baseUrl,
          { signal: abortControllerRef.current?.signal },
        );

        if (response.data?.success && isMountedRef.current) {
          setContacts((prev) =>
            prev.map((contact) => (contact._id === id ? { ...contact, status: 'read' } : contact)),
          );
          toast.success('Marked as read!');
        } else if (isMountedRef.current) {
          throw new Error(response.data?.message || 'Failed to update contact status');
        }
      } catch (err) {
        if (err.name === 'AbortError' || err.code === 'ERR_CANCELED') {
          return;
        }
        if (isMountedRef.current) {
          const errorMsg = err.response?.data?.message || getErrorMessage(err);
          toast.error(`Failed to mark as read: ${errorMsg}`);
        }
      } finally {
        if (isMountedRef.current) {
          setActionLoading((prev) => {
            const newSet = new Set(prev);
            newSet.delete(id);
            return newSet;
          });
        }
      }
    },
    [token, apiConfig.baseUrl, hasEditPermission, setContacts, getErrorMessage],
  );

  const handleBulkAction = useCallback(
    async (action) => {
      if (selectedItems.length === 0) return;
      if (!hasEditPermission()) {
        toast.error('Insufficient permissions');
        return;
      }

      const invalidIds = selectedItems.filter((id) => !isValidObjectId(id));
      if (invalidIds.length > 0) {
        toast.error('One or more selected contact IDs are invalid');
        return;
      }

      const actionLabel = action === 'read' ? 'mark as read' : action;
      const modalType = action === 'delete' ? 'danger' : 'warning';
      
      setModal({
        isOpen: true,
        type: modalType,
        message: `Are you sure you want to ${actionLabel} ${selectedItems.length} selected contacts?`,
        onConfirm: async () => {
          setActionLoading((prev) => new Set(prev).add('bulk'));
          try {
            const response = await apiRequest(
              'patch',
              '/contacts/bulk',
              {
                ids: selectedItems,
                action,
                data: { status: action },
              },
              token,
              apiConfig.baseUrl,
              { signal: abortControllerRef.current?.signal },
            );

            if (response.data?.success && isMountedRef.current) {
              if (action === 'delete') {
                setContacts((prev) => prev.filter((c) => !selectedItems.includes(c._id)));
                toast.success(`${response.data.data.deletedCount} contacts deleted successfully!`);
              } else {
                setContacts((prev) =>
                  prev.map((contact) =>
                    selectedItems.includes(contact._id) ? { ...contact, status: action } : contact,
                  ),
                );
                toast.success(
                  `${response.data.data.modifiedCount} contacts ${actionLabel} successfully!`,
                );
              }
              setSelectedItems([]);
            } else if (isMountedRef.current) {
              throw new Error(response.data?.message || `Failed to ${actionLabel} contacts`);
            }
          } catch (err) {
            if (err.name !== 'AbortError' && isMountedRef.current) {
              const errorMsg = err.response?.data?.message || getErrorMessage(err);
              toast.error(`Bulk ${actionLabel} failed: ${errorMsg}`);
            }
          } finally {
            if (isMountedRef.current) {
              setActionLoading((prev) => {
                const newSet = new Set(prev);
                newSet.delete('bulk');
                return newSet;
              });
            }
            setModal({ isOpen: false, message: '', onConfirm: () => {}, type: 'warning' });
          }
        },
      });
    },
    [selectedItems, token, apiConfig.baseUrl, hasEditPermission, getErrorMessage, setContacts],
  );

  const handleReply = useCallback((contactId) => {
    if (!isValidObjectId(contactId)) {
      toast.error('Invalid contact ID');
      return;
    }
    setReplyData({ contactId, message: '' });
  }, []);

  const handleSendReply = useCallback(
    async () => {
      if (!hasEditPermission()) {
        toast.error('Insufficient permissions');
        return;
      }

      if (!replyData.message.trim()) {
        toast.error('Reply message cannot be empty');
        return;
      }

      if (!isValidObjectId(replyData.contactId)) {
        toast.error('Invalid contact ID');
        return;
      }

      setActionLoading((prev) => new Set(prev).add(replyData.contactId));

      try {
        const response = await apiRequest(
          'post',
          `/contacts/${replyData.contactId}/reply`,
          { reply: sanitizeInput(replyData.message) },
          token,
          apiConfig.baseUrl,
          { signal: abortControllerRef.current?.signal },
        );

        if (response.data?.success && isMountedRef.current) {
          setReplyData({ contactId: null, message: '' });
          setContacts((prev) =>
            prev.map((contact) =>
              contact._id === replyData.contactId ? { ...contact, status: 'replied' } : contact,
            ),
          );
          toast.success('Reply sent successfully!');
        } else if (isMountedRef.current) {
          throw new Error(response.data?.message || 'Failed to send reply');
        }
      } catch (err) {
        if (err.name === 'AbortError' || err.code === 'ERR_CANCELED') {
          return;
        }
        if (isMountedRef.current) {
          const errorMsg = err.response?.data?.message || getErrorMessage(err);
          toast.error(`Failed to send reply: ${errorMsg}`);
        }
      } finally {
        if (isMountedRef.current) {
          setActionLoading((prev) => {
            const newSet = new Set(prev);
            newSet.delete(replyData.contactId);
            return newSet;
          });
        }
      }
    },
    [replyData, token, apiConfig.baseUrl, hasEditPermission, getErrorMessage, setContacts],
  );

  const handleDelete = useCallback(
    (id) => {
      if (!hasDeletePermission()) {
        toast.error('Only admins can delete items');
        return;
      }

      if (!isValidObjectId(id)) {
        toast.error('Invalid contact ID');
        return;
      }

      setModal({
        isOpen: true,
        type: 'danger',
        message: 'Are you sure you want to delete this contact?',
        onConfirm: async () => {
          setActionLoading((prev) => new Set(prev).add(id));
          try {
            const response = await apiRequest(
              'delete',
              `/contacts/${id}`,
              null,
              token,
              apiConfig.baseUrl,
              { signal: abortControllerRef.current?.signal },
            );

            if (response.data?.success && isMountedRef.current) {
              setContacts((prev) => prev.filter((c) => c._id !== id));
              setSelectedItems((prev) => prev.filter((itemId) => itemId !== id));
              toast.success('Contact deleted successfully!');
              setModal({ isOpen: false, message: '', onConfirm: () => {}, type: 'warning' });
            } else {
              throw new Error(response.data?.message || 'Failed to delete contact');
            }
          } catch (err) {
            if (err.name === 'AbortError' || err.code === 'ERR_CANCELED') {
              return;
            }
            if (isMountedRef.current) {
              const errorMsg = err.response?.data?.message || getErrorMessage(err);
              toast.error(`Failed to delete contact: ${errorMsg}`);
            }
          } finally {
            if (isMountedRef.current) {
              setActionLoading((prev) => {
                const newSet = new Set(prev);
                newSet.delete(id);
                return newSet;
              });
            }
          }
        },
      });
    },
    [token, apiConfig.baseUrl, hasDeletePermission, getErrorMessage, setContacts],
  );

  const handleBulkDelete = useCallback(
    async () => {
      if (selectedItems.length === 0) return;
      if (!hasDeletePermission()) {
        toast.error('Only admins can delete items');
        return;
      }

      const invalidIds = selectedItems.filter((id) => !isValidObjectId(id));
      if (invalidIds.length > 0) {
        toast.error('One or more selected contact IDs are invalid');
        return;
      }

      setModal({
        isOpen: true,
        type: 'danger',
        message: `Are you sure you want to delete ${selectedItems.length} selected contacts?`,
        onConfirm: async () => {
          setActionLoading((prev) => new Set(prev).add('bulk'));
          try {
            const response = await apiRequest(
              'patch',
              '/contacts/bulk',
              { ids: selectedItems, action: 'delete' },
              token,
              apiConfig.baseUrl,
              { signal: abortControllerRef.current?.signal },
            );
            if (response.data?.success && isMountedRef.current) {
              setContacts((prev) => prev.filter((c) => !selectedItems.includes(c._id)));
              setSelectedItems([]);
              toast.success(`${response.data.data.deletedCount} contacts deleted successfully!`);
            } else if (isMountedRef.current) {
              throw new Error(response.data?.message || 'Failed to delete contacts');
            }
          } catch (err) {
            if (err.name !== 'AbortError' && isMountedRef.current) {
              const errorMsg = err.response?.data?.message || getErrorMessage(err);
              toast.error(`Bulk delete failed: ${errorMsg}`);
            }
          } finally {
            if (isMountedRef.current) {
              setActionLoading((prev) => {
                const newSet = new Set(prev);
                newSet.delete('bulk');
                return newSet;
              });
            }
            setModal({ isOpen: false, message: '', onConfirm: () => {}, type: 'warning' });
          }
        },
      });
    },
    [selectedItems, token, apiConfig.baseUrl, hasDeletePermission, getErrorMessage, setContacts],
  );

  const handleSort = useCallback(
    (key) => {
      setSortConfig((prev) => ({
        key,
        direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
      }));
      fetchContacts();
    },
    [fetchContacts],
  );

  const handlePageChange = useCallback((newPage) => {
    setCurrentPage(newPage);
  }, []);

  const handleStatusFilterChange = useCallback((status) => {
    setStatusFilter(status);
    setCurrentPage(1);
  }, []);

  const handleSelectItem = useCallback((contactId) => {
    setSelectedItems((prev) =>
      prev.includes(contactId) ? prev.filter((id) => id !== contactId) : [...prev, contactId],
    );
  }, []);

  const handleSelectAll = useCallback(() => {
    const visibleIds = contacts.map((contact) => contact._id);
    setSelectedItems((prev) => (prev.length === visibleIds.length ? [] : visibleIds));
  }, [contacts]);

  const handleSearch = useCallback((value) => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    searchTimeoutRef.current = setTimeout(() => {
      setSearchTerm(sanitizeInput(value.trim()));
      setCurrentPage(1);
    }, 300);
  }, []);

  // Effect for component setup and cleanup
  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort('Component unmounting');
      }
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
      fetchStateRef.current = {
        isLoading: false,
        lastFetch: 0,
        currentParams: null,
      };
    };
  }, []);

  // Effect for initial data loading
  useEffect(() => {
    if (token && isTokenValid && dataLoaded && contacts.length === 0 && !fetchStateRef.current.isLoading) {
      fetchContacts();
    }
  }, [token, isTokenValid, dataLoaded, contacts, fetchContacts]);

  // Effect for pagination, filter, and search changes
  useEffect(() => {
    if (token && isTokenValid && dataLoaded && !fetchStateRef.current.isLoading) {
      fetchContacts();
    }
  }, [currentPage, statusFilter, searchTerm, token, isTokenValid, dataLoaded, fetchContacts]);

  // Combined loading state
  const isLoading = isAnyLoading || actionLoading.size > 0;

  // Render loading state
  if (isLoading && !contacts?.length) {
    return (
      <div className="space-y-4 py-20">
        {Array(5)
          .fill()
          .map((_, i) => (
            <SkeletonContactCard key={i} />
          ))}
      </div>
    );
  }

  // Render error state
  if ((error || apiError) && !contacts?.length) {
    return (
      <div className="text-center py-20">
        <p className="text-red-600 dark:text-red-400 text-xl mb-4">{error || apiError}</p>
        <button
          onClick={() => {
            setError(null);
            setApiError(null);
            fetchContacts();
          }}
          className="bg-indigo-600 hover:bg-indigo-700 text-white py-2 px-4 rounded-lg transition-colors flex items-center gap-2 mx-auto"
          aria-label="Try again"
        >
          <RefreshCw size={16} />
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <div className="flex flex-col lg:flex-row justify-between items-center mb-8 gap-4">
        <div className="relative w-full max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search contacts..."
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white/80 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 rounded-full focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400"
            aria-label="Search contacts by name, email, subject, or message"
          />
        </div>

        <div className="flex items-center gap-4">
          <FormSelect
            label="Status"
            value={statusFilter}
            onChange={(e) => handleStatusFilterChange(e.target.value)}
            options={[
              { value: 'all', label: 'All' },
              { value: 'new', label: 'New' },
              { value: 'read', label: 'Read' },
              { value: 'replied', label: 'Replied' },
              { value: 'archived', label: 'Archived' },
              { value: 'spam', label: 'Spam' },
            ]}
            disabled={isLoading}
            aria-label="Filter contacts by status"
          />

          <FormSelect
            label="Sort By"
            value={sortConfig.key}
            onChange={(e) => handleSort(e.target.value)}
            options={[
              { value: 'createdAt', label: 'Date' },
              { value: 'name', label: 'Name' },
              { value: 'email', label: 'Email' },
              { value: 'subject', label: 'Subject' },
            ]}
            disabled={isLoading}
            aria-label="Sort contacts by field"
          />

          {sortConfig.key && (
            <button
              onClick={() => handleSort(sortConfig.key)}
              className="text-gray-600 dark:text-gray-300 p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              aria-label={`Toggle sort direction for ${sortConfig.key}`}
            >
              {sortConfig.direction === 'asc' ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          )}

          <button
            onClick={() => fetchContacts()}
            className="text-gray-600 dark:text-gray-300 p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            disabled={isLoading}
            aria-label="Refresh contacts"
          >
            <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Bulk Actions */}
      {selectedItems.length > 0 && hasDeletePermission() && (
        <div className="flex justify-between items-center mb-6 bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-lg">
          <div className="flex items-center gap-4">
            <button
              onClick={handleSelectAll}
              className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300"
              aria-label={selectedItems.length === contacts.length ? 'Deselect all contacts' : 'Select all contacts'}
            >
              {selectedItems.length === contacts.length ? 'Deselect All' : 'Select All'}
            </button>
            <span className="text-gray-600 dark:text-gray-400">{selectedItems.length} selected</span>
          </div>
          <div className="flex gap-4">
            {hasEditPermission() && (
              <>
                <button
                  onClick={() => handleBulkAction('read')}
                  className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 flex items-center transition-colors"
                  disabled={isLoading}
                  aria-label={`Mark ${selectedItems.length} selected contacts as read`}
                >
                  <Check size={16} className="mr-2" />
                  Mark as Read ({selectedItems.length})
                </button>
                <button
                  onClick={() => handleBulkAction('archived')}
                  className="text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-300 flex items-center transition-colors"
                  disabled={isLoading}
                  aria-label={`Archive ${selectedItems.length} selected contacts`}
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"
                    />
                  </svg>
                  Archive ({selectedItems.length})
                </button>
                <button
                  onClick={() => handleBulkAction('spam')}
                  className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 flex items-center transition-colors"
                  disabled={isLoading}
                  aria-label={`Mark ${selectedItems.length} selected contacts as spam`}
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  Mark Spam ({selectedItems.length})
                </button>
              </>
            )}
            <button
              onClick={handleBulkDelete}
              className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 flex items-center transition-colors"
              disabled={isLoading}
              aria-label={`Delete ${selectedItems.length} selected contacts`}
            >
              <Trash2 size={16} className="mr-2" />
              Delete ({selectedItems.length})
            </button>
          </div>
        </div>
      )}

      {/* Error Banner */}
      {(error || apiError) && (
        <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 p-4 rounded-lg mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <svg
                className="w-5 h-5 text-red-600 dark:text-red-400 mr-2"
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
              <span className="text-red-800 dark:text-red-200 font-medium">{error || apiError}</span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setError(null);
                  setApiError(null);
                  fetchContacts();
                }}
                className="text-red-600 hover:text-red-800 dark:text-red-400 text-sm underline"
                aria-label="Retry loading contacts"
              >
                Retry
              </button>
              <button
                onClick={() => {
                  setError(null);
                  setApiError(null);
                }}
                className="text-red-600 hover:text-red-800 dark:text-red-400 text-sm underline"
                aria-label="Dismiss error"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Contacts List */}
      <div className="space-y-4">
        {isLoading && contacts.length > 0 ? (
          Array(5)
            .fill()
            .map((_, i) => <SkeletonContactCard key={i} />)
        ) : (
          contacts.map((contact) => (
            <ContactCard
              key={contact._id}
              contact={contact}
              isSelected={selectedItems.includes(contact._id)}
              onSelect={handleSelectItem}
              onMarkRead={handleMarkRead}
              onReply={handleReply}
              onDelete={handleDelete}
              isLoading={actionLoading.has(contact._id)}
              userRole={effectiveUserRole}
              replyData={replyData}
              onReplyChange={(message) => setReplyData((prev) => ({ ...prev, message }))}
              onSendReply={handleSendReply}
              onCancelReply={() => setReplyData({ contactId: null, message: '' })}
            />
          ))
        )}
      </div>

      {/* Empty State */}
      {!isLoading && contacts.length === 0 && (
        <div className="p-12 text-center bg-white/90 dark:bg-gray-800/90 rounded-2xl">
          <div className="text-gray-400 mb-4">
            <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2M4 13h2m13-8l-4 4m0 0l-4-4m4 4V3"
              />
            </svg>
          </div>
          <p className="text-gray-600 dark:text-gray-300 text-lg">
            {searchTerm || statusFilter !== 'all' ? 'No contacts found matching your criteria' : 'No contacts yet'}
          </p>
          {(searchTerm || statusFilter !== 'all') && (
            <button
              onClick={() => {
                setSearchTerm('');
                setStatusFilter('all');
                const searchInput = document.querySelector('input[placeholder="Search contacts..."]');
                if (searchInput) searchInput.value = '';
              }}
              className="mt-4 text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300"
              aria-label="Clear search and status filters"
            >
              Clear filters
            </button>
          )}
        </div>
      )}

      {/* Pagination */}
      {totalPages.contacts > 1 && (
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mt-8 p-4 bg-white/90 dark:bg-gray-800/90 rounded-2xl">
          <div className="text-sm text-gray-600 dark:text-gray-300">
            Showing page {currentPage} of {totalPages.contacts}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1 || isLoading}
              className="bg-indigo-500 hover:bg-indigo-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white py-2 px-4 rounded-lg transition-colors flex items-center gap-2"
              aria-label="Previous page"
            >
              Previous
            </button>

            <div className="flex gap-1">
              {Array.from(
                { length: Math.min(5, totalPages.contacts) },
                (_, i) => Math.max(1, Math.min(totalPages.contacts - 4, currentPage - 2)) + i,
              )
                .filter((pageNum) => pageNum <= totalPages.contacts)
                .map((pageNum) => (
                  <button
                    key={pageNum}
                    onClick={() => handlePageChange(pageNum)}
                    className={`py-2 px-3 rounded-lg transition-colors ${
                      currentPage === pageNum
                        ? 'bg-indigo-600 text-white'
                        : 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300'
                    }`}
                    disabled={isLoading}
                    aria-label={`Go to page ${pageNum}`}
                    aria-current={currentPage === pageNum ? 'page' : undefined}
                  >
                    {pageNum}
                  </button>
                ))}
            </div>

            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage >= totalPages.contacts || isLoading}
              className="bg-indigo-500 hover:bg-indigo-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white py-2 px-4 rounded-lg transition-colors flex items-center gap-2"
              aria-label="Next page"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Loading Overlay */}
      {isLoading && contacts?.length > 0 && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-xl">
            <div className="flex items-center gap-3">
              <LoadingSpinner size="md" />
              <span className="text-gray-700 dark:text-gray-300">Loading contacts...</span>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={modal.isOpen}
        message={modal.message}
        type={modal.type}
        onConfirm={modal.onConfirm}
        onCancel={() => setModal({ isOpen: false, message: '', onConfirm: () => {}, type: 'warning' })}
        loading={actionLoading.has('bulk')}
      />
    </div>
  );
};

export default ContactsPage;