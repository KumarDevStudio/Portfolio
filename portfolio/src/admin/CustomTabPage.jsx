
import React, { useContext, useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { toast } from 'react-toastify';
import { Plus, Edit, Trash2, Search } from 'lucide-react';
import { debounce } from 'lodash';
import { AdminContext } from '../pages/Admin';
import FormInput from './FormInput';
import ConfirmationModal from './ConfirmationModal';
// import { apiRequest, sanitizeInput } from '../services/api';

const CustomTabPage = () => {
  const {
    customTabs,
    setCustomTabs,
    totalPages,
    setTotalPages,
    loading,
    setLoading,
    error,
    setError,
    token,
    apiConfig,
    userRole,
    validateToken,
    getErrorMessage,
  } = useContext(AdminContext);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [sortConfig, setSortConfig] = useState({ key: '', direction: 'asc' });
  const [selectedItems, setSelectedItems] = useState([]);
  const [formData, setFormData] = useState(null);
  const [actionLoading, setActionLoading] = useState({});
  const [modal, setModal] = useState({ isOpen: false, message: '', onConfirm: () => {} });
  const formRef = useRef(null);
  const abortControllerRef = useRef(new AbortController());

  const fetchData = useCallback(
    async (retryCount = 0) => {
      if (!token) return;
      const isValid = await validateToken();
      if (!isValid) {
        if (retryCount >= 1) {
          setError('Session invalid or expired. Please log in again.');
          toast.error('Session invalid or expired. Please log in again.');
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, Math.pow(2, retryCount) * 2000));
        return fetchData(retryCount + 1);
      }
      setLoading(true);
      try {
        const searchQuery = searchTerm ? `&search=${encodeURIComponent(sanitizeInput(searchTerm))}` : '';
        const response = await apiRequest(
          'get',
          `/custom-tabs?page=${currentPage}&limit=${itemsPerPage}${searchQuery}`,
          null,
          token,
          apiConfig.baseUrl,
          { signal: abortControllerRef.current.signal }
        );
        setCustomTabs(response.data.data.items || []);
        setTotalPages((prev) => ({ ...prev, customTabs: response.data.data.totalPages || 1 }));
        toast.success('Custom tabs loaded successfully!');
      } catch (err) {
        if (err.name === 'AbortError') return;
        if (err.response?.status === 429 && retryCount < 3) {
          toast.warn('Rate limit reached, retrying...');
          await new Promise((resolve) => setTimeout(resolve, Math.pow(2, retryCount) * 2000));
          return fetchData(retryCount + 1);
        }
        setError(getErrorMessage(err));
        toast.error(getErrorMessage(err));
      } finally {
        setLoading(false);
      }
    },
    [token, validateToken, searchTerm, currentPage, itemsPerPage, apiConfig.baseUrl, setCustomTabs, setTotalPages, setLoading, setError, getErrorMessage]
  );

  useEffect(() => {
    fetchData();
    return () => {
      abortControllerRef.current.abort();
      abortControllerRef.current = new AbortController();
    };
  }, [fetchData]);

  const debouncedSearch = useMemo(
    () =>
      debounce((value, signal) => {
        if (signal.aborted) return;
        setSearchTerm(sanitizeInput(value.trim()));
        setCurrentPage(1);
      }, 300),
    []
  );

  const handleSearch = useCallback(
    (value) => {
      abortControllerRef.current.abort();
      abortControllerRef.current = new AbortController();
      debouncedSearch(value, abortControllerRef.current.signal);
    },
    [debouncedSearch]
  );

  const handleDelete = useCallback(
    (id) => {
      if (userRole !== 'admin') {
        toast.error('Only admins can delete items');
        return;
      }
      setModal({
        isOpen: true,
        message: 'Are you sure you want to delete this custom tab?',
        onConfirm: async () => {
          setActionLoading((prev) => ({ ...prev, [id]: true }));
          try {
            await apiRequest('delete', `/custom-tabs/${id}`, null, token, apiConfig.baseUrl, { signal: abortControllerRef.current.signal });
            setCustomTabs((prev) => prev.filter((t) => t._id !== id));
            setSelectedItems((prev) => prev.filter((itemId) => itemId !== id));
            toast.success('Custom tab deleted successfully!');
            setModal({ isOpen: false, message: '', onConfirm: () => {} });
          } catch (err) {
            if (err.name === 'AbortError') return;
            toast.error(getErrorMessage(err));
          } finally {
            setActionLoading((prev) => ({ ...prev, [id]: false }));
          }
        },
      });
    },
    [token, apiConfig.baseUrl, userRole, getErrorMessage, setCustomTabs, setSelectedItems]
  );

  const handleBulkDelete = useCallback(() => {
    if (userRole !== 'admin') {
      toast.error('Only admins can perform bulk deletes');
      return;
    }
    if (!selectedItems.length) {
      toast.warn('No items selected for deletion');
      return;
    }
    setModal({
      isOpen: true,
      message: `Are you sure you want to delete ${selectedItems.length} custom tab(s)?`,
      onConfirm: async () => {
        setLoading(true);
        try {
          await apiRequest(
            'patch',
            '/custom-tabs/bulk',
            { ids: selectedItems, action: 'delete' },
            token,
            apiConfig.baseUrl,
            { signal: abortControllerRef.current.signal }
          );
          setCustomTabs((prev) => prev.filter((t) => !selectedItems.includes(t._id)));
          setSelectedItems([]);
          toast.success(`${selectedItems.length} custom tab(s) deleted successfully!`);
          setModal({ isOpen: false, message: '', onConfirm: () => {} });
        } catch (err) {
          if (err.name === 'AbortError') return;
          toast.error(getErrorMessage(err));
        } finally {
          setLoading(false);
        }
      },
    });
  }, [selectedItems, token, apiConfig.baseUrl, userRole, getErrorMessage, setCustomTabs, setSelectedItems]);

  const validateForm = useCallback(() => {
    if (!formData) {
      toast.error('Form data is missing');
      return false;
    }
    if (!formData.title?.trim()) {
      toast.error('Tab title is required');
      return false;
    }
    if (!formData.content?.trim()) {
      toast.error('Tab content is required');
      return false;
    }
    return true;
  }, [formData]);

  const resetForm = useCallback(() => {
    setFormData(null);
    if (formRef.current) {
      formRef.current.reset();
    }
  }, []);

  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      if (userRole !== 'admin') {
        toast.error('Insufficient permissions to modify this resource');
        return;
      }
      if (!validateForm()) return;
      setLoading(true);
      try {
        const sanitizedFormData = JSON.parse(
          JSON.stringify(formData, (key, value) =>
            typeof value === 'string' ? sanitizeInput(value) : value
          )
        );
        const method = formData._id ? 'put' : 'post';
        const url = formData._id ? `/custom-tabs/${formData._id}` : '/custom-tabs';
        const response = await apiRequest(method, url, sanitizedFormData, token, apiConfig.baseUrl, { signal: abortControllerRef.current.signal });
        setCustomTabs((prev) =>
          formData._id
            ? prev.map((t) => (t._id === formData._id ? response.data.data : t))
            : [...prev, response.data.data]
        );
        resetForm();
        toast.success(`Custom tab ${formData._id ? 'updated' : 'created'} successfully!`);
      } catch (err) {
        if (err.name === 'AbortError') return;
        toast.error(getErrorMessage(err));
      } finally {
        setLoading(false);
      }
    },
    [formData, token, apiConfig.baseUrl, userRole, validateForm, resetForm, getErrorMessage, setCustomTabs]
  );

  const sortData = useMemo(() => (data, key, direction) => {
    if (!key || !data?.length) return data || [];
    return [...data].sort((a, b) => {
      const aValue = a[key] || '';
      const bValue = b[key] || '';
      if (typeof aValue === 'string') {
        return direction === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
      }
      return direction === 'asc' ? aValue - bValue : bValue - aValue;
    });
  }, []);

  const getFilteredAndSortedData = useMemo(() => {
    return (data) => {
      if (!data?.length) return [];
      const filtered = data.filter((item) =>
        ['title', 'content'].some((field) => item[field]?.toString().toLowerCase().includes(searchTerm.toLowerCase()))
      );
      return sortConfig.key ? sortData(filtered, sortConfig.key, sortConfig.direction) : filtered;
    };
  }, [searchTerm, sortConfig, sortData]);

  const paginateData = useMemo(
    () => (data) => {
      if (!data?.length) return [];
      const start = Math.max(0, (currentPage - 1) * itemsPerPage);
      return data.slice(start, start + itemsPerPage);
    },
    [currentPage, itemsPerPage]
  );

  const handleSort = useCallback(
    (key) => {
      setSortConfig((prev) => ({
        key,
        direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
      }));
    },
    []
  );

  if (loading && !formData) {
    return (
      <div className="text-center py-20">
        <div className="inline-flex items-center">
          <svg className="animate-spin h-8 w-8 text-indigo-600" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="ml-4 text-lg">Loading...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-20">
        <p className="text-red-600 dark:text-red-400 text-xl mb-4">{error}</p>
        <button
          onClick={() => {
            setError(null);
            fetchData();
          }}
          className="bg-indigo-600 hover:bg-indigo-700 text-white py-2 px-4 rounded-lg transition-colors"
          aria-label="Try again"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-center mb-8 gap-4">
        <div className="relative w-full max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search custom tabs..."
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white/80 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 rounded-full focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400"
            aria-label="Search custom tabs"
          />
        </div>
        <div className="flex items-center gap-2">
          <FormSelect
            label="Sort By"
            value={sortConfig.key}
            onChange={(e) => handleSort(e.target.value)}
            options={[
              { value: 'title', label: 'Title' },
              { value: 'createdAt', label: 'Created At' },
            ]}
            disabled={loading}
            aria-label="Sort by"
          />
          {sortConfig.key && (
            <button
              onClick={() => handleSort(sortConfig.key)}
              className="text-gray-600 dark:text-gray-300"
              aria-label={`Toggle sort direction for ${sortConfig.key}`}
            >
              {sortConfig.direction === 'asc' ? (
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 5v14M5 12l7-7 7 7" />
                </svg>
              ) : (
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 19V5m7 7l-7 7-7-7" />
                </svg>
              )}
            </button>
          )}
        </div>
      </div>
      {selectedItems.length > 0 && userRole === 'admin' && (
        <div className="flex justify-end mb-6">
          <button
            onClick={handleBulkDelete}
            className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 flex items-center transition-colors"
            disabled={loading}
            aria-label={`Delete ${selectedItems.length} selected custom tabs`}
          >
            <Trash2 size={16} className="mr-2" />
            Delete Selected ({selectedItems.length})
          </button>
        </div>
      )}
      <button
        onClick={() =>
          setFormData({
            title: '',
            content: '',
            isVisible: true,
          })
        }
        className="bg-gradient-to-r from-indigo-500 to-blue-500 hover:from-indigo-600 hover:to-blue-600 text-white py-2 px-4 rounded-lg transition-colors"
        disabled={loading || userRole !== 'admin'}
        aria-label="Add new custom tab"
      >
        <Plus size={16} className="mr-2 inline" />
        Add New Custom Tab
      </button>
      {paginateData(getFilteredAndSortedData(customTabs)).map((tab) => (
        <div
          key={tab._id}
          className="p-6 bg-white/90 dark:bg-gray-800/90 border border-gray-200/50 dark:border-gray-700/50 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-200"
          aria-label={`Custom tab ${sanitizeInput(tab.title)}`}
        >
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-4">
              <input
                type="checkbox"
                checked={selectedItems.includes(tab._id)}
                onChange={() =>
                  setSelectedItems((prev) =>
                    prev.includes(tab._id) ? prev.filter((id) => id !== tab._id) : [...prev, tab._id]
                  )
                }
                className="mt-1 h-4 w-4 text-indigo-600 rounded focus:ring-indigo-500"
                aria-label={`Select custom tab ${sanitizeInput(tab.title)}`}
                disabled={actionLoading[tab._id] || userRole !== 'admin'}
              />
              <div>
                <h3 className="text-lg font-semibold">{sanitizeInput(tab.title)}</h3>
                <p className="text-gray-600 dark:text-gray-300 line-clamp-2">{sanitizeInput(tab.content)}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Visible: {tab.isVisible ? 'Yes' : 'No'}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setFormData(tab)}
                className="text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 transition-colors"
                disabled={actionLoading[tab._id] || userRole !== 'admin'}
                aria-label={`Edit custom tab ${sanitizeInput(tab.title)}`}
              >
                <Edit size={16} />
              </button>
              <button
                onClick={() => handleDelete(tab._id)}
                className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 transition-colors"
                disabled={actionLoading[tab._id] || userRole !== 'admin'}
                aria-label={`Delete custom tab ${sanitizeInput(tab.title)}`}
              >
                {actionLoading[tab._id] ? (
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : (
                  <Trash2 size={16} />
                )}
              </button>
            </div>
          </div>
        </div>
      ))}
      {getFilteredAndSortedData(customTabs).length === 0 && (
        <div className="p-8 text-center bg-white/90 dark:bg-gray-800/90 rounded-2xl">
          <p className="text-gray-600 dark:text-gray-300">No custom tabs found</p>
        </div>
      )}
      {totalPages.customTabs > 1 && (
        <div className="flex justify-center gap-4 mt-6">
          <button
            onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
            disabled={currentPage === 1 || loading}
            className="bg-indigo-500 hover:bg-indigo-600 text-white py-2 px-4 rounded-lg transition-colors"
            aria-label="Previous page"
          >
            Previous
          </button>
          <span className="text-gray-600 dark:text-gray-300">
            Page {currentPage} of {totalPages.customTabs}
          </span>
          <button
            onClick={() => setCurrentPage((p) => p + 1)}
            disabled={currentPage >= totalPages.customTabs || loading}
            className="bg-indigo-500 hover:bg-indigo-600 text-white py-2 px-4 rounded-lg transition-colors"
            aria-label="Next page"
          >
            Next
          </button>
        </div>
      )}
      {formData && (
        <div
          className="p-8 mt-8 bg-white/90 dark:bg-gray-800/90 border border-gray-200/50 dark:border-gray-700/50 rounded-2xl shadow-xl"
          aria-label={`Form for ${formData._id ? 'editing' : 'adding'} custom tab`}
        >
          <h3 className="text-2xl font-semibold mb-6">{formData._id ? 'Edit Custom Tab' : 'Add New Custom Tab'}</h3>
          <form onSubmit={handleSubmit} ref={formRef} className="space-y-6">
            <FormInput
              label="Title"
              type="text"
              value={formData.title}
              onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
              required
              disabled={loading || userRole !== 'admin'}
              aria-required="true"
            />
            <div>
              <label className="block text-sm font-medium mb-2">Content <span className="text-red-500">*</span></label>
              <textarea
                value={formData.content}
                onChange={(e) => setFormData((prev) => ({ ...prev, content: e.target.value }))}
                required
                rows={6}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400"
                disabled={loading || userRole !== 'admin'}
                aria-required="true"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Visible</label>
              <input
                type="checkbox"
                checked={formData.isVisible}
                onChange={(e) => setFormData((prev) => ({ ...prev, isVisible: e.target.checked }))}
                className="h-4 w-4 text-indigo-600 rounded focus:ring-indigo-500"
                disabled={loading || userRole !== 'admin'}
              />
            </div>
            <div className="flex justify-end gap-4">
              <button
                type="button"
                onClick={resetForm}
                className="text-gray-600 dark:text-gray-300 py-2 px-4 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                disabled={loading || userRole !== 'admin'}
                aria-label="Cancel form"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="bg-indigo-600 hover:bg-indigo-700 text-white py-2 px-4 rounded-lg flex items-center transition-colors"
                disabled={loading || userRole !== 'admin'}
                aria-label={formData._id ? 'Update custom tab' : 'Create custom tab'}
              >
                {loading ? (
                  <svg className="animate-spin h-4 w-4 mr-2" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : null}
                {formData._id ? 'Update' : 'Create'} Custom Tab
              </button>
            </div>
          </form>
        </div>
      )}
      <ConfirmationModal
        isOpen={modal.isOpen}
        message={modal.message}
        onConfirm={modal.onConfirm}
        onCancel={() => setModal({ isOpen: false, message: '', onConfirm: () => {} })}
      />
    </div>
  );
};

export default CustomTabPage;
