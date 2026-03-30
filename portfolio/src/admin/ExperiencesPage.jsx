import React, { useContext, useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { toast } from 'react-toastify';
import { Plus, Edit, Trash2, Search, ArrowUp, ArrowDown, RefreshCw } from 'lucide-react';
import { debounce } from 'lodash';
import { DateTime } from 'luxon';
import axios from 'axios';
import sanitizeHtml from 'sanitize-html';
import { AdminContext } from '../pages/Admin';
import ConfirmationModal from './ConfirmationModal';

// ─── API utility ──────────────────────────────────────────────────────────────
const apiRequest = async (method, endpoint, data = null, token = null, baseUrl = '', options = {}) => {
  try {
    const config = {
      method,
      url: `${baseUrl}${endpoint}`,
      headers: {
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      data,
      timeout: 30000,
      ...options,
    };
    // Let axios set Content-Type automatically for FormData (with boundary)
    if (data && !(data instanceof FormData) && method.toUpperCase() !== 'DELETE') {
      config.headers['Content-Type'] = 'application/json';
    }
    const response = await axios(config);
    return response;
  } catch (error) {
    console.error(`Error in ${method} ${endpoint}:`, {
      status: error.response?.status,
      data: error.response?.data,
      message: error.message,
    });
    throw error;
  }
};

const sanitizeInput = (input) => {
  if (typeof input !== 'string') return input;
  return sanitizeHtml(input, { allowedTags: [], allowedAttributes: {} }).trim();
};

// ─── Config ───────────────────────────────────────────────────────────────────
const CONFIG = {
  ITEMS_PER_PAGE: 10,
  SEARCH_DEBOUNCE_MS: 300,
  MAX_RETRIES: 3,
  RETRY_BASE_DELAY_MS: 2000,
  FORM_DEFAULTS: {
    company: '',
    position: '',
    location: '',
    type: 'fulltime',
    workType: 'onsite',
    description: '',
    responsibilities: [],
    technologies: [],
    achievements: [],
    tags: [],
    startDate: '',
    endDate: '',
    current: false,
    featured: false,
    status: 'active',
    order: 0,
    companyUrl: '',
  },
};

const isValidObjectId = (id) => {
  if (!id || typeof id !== 'string') return false;
  return /^[0-9a-fA-F]{24}$/.test(id) && id.length === 24;
};

// ─── Skeleton ─────────────────────────────────────────────────────────────────
const SkeletonExperienceCard = () => (
  <div className="p-6 bg-white/90 dark:bg-gray-800/90 border rounded-2xl animate-pulse">
    <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-2"></div>
    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3 mb-2"></div>
    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full mb-2"></div>
    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
  </div>
);

// ─── Experience Card ──────────────────────────────────────────────────────────
const ExperienceCard = ({ experience, isSelected, onSelect, onEdit, onDelete, actionLoading, userRole }) => {
  if (!experience || !isValidObjectId(experience._id)) {
    console.warn('Invalid experience object:', experience);
    return (
      <div className="p-6 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-2xl">
        <p className="text-red-600 dark:text-red-400">Invalid experience data</p>
      </div>
    );
  }

  return (
    <div className="p-6 bg-white/90 dark:bg-gray-800/90 border border-gray-200/50 dark:border-gray-700/50 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-200">
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-4 flex-1">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={onSelect}
            className="mt-1 h-4 w-4 text-indigo-600 rounded focus:ring-indigo-500"
            disabled={actionLoading || userRole !== 'admin'}
            aria-label={`Select experience ${experience.position} at ${experience.company}`}
          />
          <div className="flex-1">
            <h3 className="text-lg font-semibold">{sanitizeInput(experience.position)}</h3>
            <p className="text-gray-600 dark:text-gray-300">{sanitizeInput(experience.company)}</p>
            {experience.description && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                {sanitizeInput(experience.description.substring(0, 150))}
                {experience.description.length > 150 ? '...' : ''}
              </p>
            )}
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
              {DateTime.fromISO(experience.startDate).toFormat('MMM yyyy')} -{' '}
              {experience.current
                ? 'Present'
                : experience.endDate
                  ? DateTime.fromISO(experience.endDate).toFormat('MMM yyyy')
                  : 'N/A'}
            </p>
            {Array.isArray(experience.technologies) && experience.technologies.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {experience.technologies.slice(0, 5).map((tech, index) => (
                  <span key={index} className="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded">
                    {sanitizeInput(tech)}
                  </span>
                ))}
                {experience.technologies.length > 5 && (
                  <span className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded">
                    +{experience.technologies.length - 5} more
                  </span>
                )}
              </div>
            )}
            <div className="flex gap-2 mt-2">
              {experience.featured && (
                <span className="px-2 py-1 text-xs bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 rounded">Featured</span>
              )}
              {experience.current && (
                <span className="px-2 py-1 text-xs bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded">Current</span>
              )}
              {experience.status === 'inactive' && (
                <span className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded">Hidden</span>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => onEdit(experience)}
            className="text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 p-2 rounded"
            disabled={actionLoading || userRole !== 'admin'}
            aria-label={`Edit experience ${experience.position} at ${experience.company}`}
          >
            <Edit size={16} />
          </button>
          <button
            onClick={() => onDelete(experience._id)}
            className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 p-2 rounded"
            disabled={actionLoading || userRole !== 'admin'}
            aria-label={`Delete experience ${experience.position} at ${experience.company}`}
          >
            {actionLoading
              ? <div className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
              : <Trash2 size={16} />}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Experience Form ──────────────────────────────────────────────────────────
const ExperienceForm = ({ formData, onCancel, onSubmit, formErrors, userRole, uploadLimits, isSubmitting }) => {
  const fileInputRef = useRef(null);

  const handleFormSubmit = useCallback((e) => {
    e.preventDefault();
    const formEl = e.target;
    const fd = new FormData();

    formEl.querySelectorAll('input, textarea, select').forEach((input) => {
      const { name, type, value, checked, files } = input;
      if (!name) return;

      if (type === 'checkbox') {
        fd.append(name, String(checked));
      } else if (type === 'file') {
        if (files && files[0]) fd.append(name, files[0]);
      } else if (['responsibilities', 'technologies', 'achievements', 'tags'].includes(name)) {
        fd.append(name, value);
      } else if (value !== undefined && value !== null) {
        fd.append(name, value);
      }
    });

    onSubmit(fd);
  }, [onSubmit]);

  const isDisabled = isSubmitting || userRole !== 'admin';

  const EMPLOYMENT_TYPES = [
    { value: 'fulltime', label: 'Full-time' },
    { value: 'parttime', label: 'Part-time' },
    { value: 'contract', label: 'Contract' },
    { value: 'internship', label: 'Internship' },
    { value: 'freelance', label: 'Freelance' },
  ];

  const WORK_TYPES = [
    { value: 'onsite', label: 'On-site' },
    { value: 'remote', label: 'Remote' },
    { value: 'hybrid', label: 'Hybrid' },
  ];

  return (
    <div className="p-8 mt-8 bg-white/90 dark:bg-gray-800/90 border border-gray-200/50 dark:border-gray-700/50 rounded-2xl shadow-xl">
      <h3 className="text-2xl font-semibold mb-6">
        {formData._id ? 'Edit Experience' : 'Add New Experience'}
      </h3>

      <form onSubmit={handleFormSubmit} className="space-y-6">
        {Object.keys(formErrors).length > 0 && (
          <div className="text-red-600 dark:text-red-400 text-sm bg-red-50 dark:bg-red-900/20 p-4 rounded-lg" role="alert">
            Please fix the following errors:
            <ul className="list-disc pl-5 mt-2">
              {Object.values(formErrors).map((err, idx) => (
                <li key={idx}>{err}</li>
              ))}
            </ul>
          </div>
        )}

        <input type="hidden" name="_id" value={formData._id || ''} />

        {/* Company & Position */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium mb-2">Company *</label>
            <input
              type="text" name="company"
              defaultValue={formData.company || ''}
              required disabled={isDisabled}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              placeholder="Enter company name"
            />
            {formErrors.company && <p className="text-red-600 text-sm mt-1">{formErrors.company}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Position *</label>
            <input
              type="text" name="position"
              defaultValue={formData.position || ''}
              required disabled={isDisabled}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              placeholder="Enter position title"
            />
            {formErrors.position && <p className="text-red-600 text-sm mt-1">{formErrors.position}</p>}
          </div>
        </div>

        {/* Location */}
        <div>
          <label className="block text-sm font-medium mb-2">Location</label>
          <input
            type="text" name="location"
            defaultValue={formData.location || ''}
            disabled={isDisabled}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            placeholder="City, Country"
          />
        </div>

        {/* Employment type + Work arrangement */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium mb-2">Employment Type *</label>
            <select
              name="type"
              defaultValue={formData.type || 'fulltime'}
              required disabled={isDisabled}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            >
              {EMPLOYMENT_TYPES.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            {formErrors.type && <p className="text-red-600 text-sm mt-1">{formErrors.type}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Work Arrangement</label>
            <select
              name="workType"
              defaultValue={formData.workType || 'onsite'}
              disabled={isDisabled}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            >
              {WORK_TYPES.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium mb-2">Description *</label>
          <textarea
            name="description"
            defaultValue={formData.description || ''}
            rows={4} required disabled={isDisabled}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            placeholder="Enter experience description..."
          />
          {formErrors.description && <p className="text-red-600 text-sm mt-1">{formErrors.description}</p>}
        </div>

        {/* Array fields */}
        {[
          { name: 'responsibilities', label: 'Responsibilities', placeholder: 'Led team development, Implemented new features' },
          { name: 'technologies', label: 'Technologies', placeholder: 'React, Node.js, MongoDB' },
          { name: 'achievements', label: 'Achievements', placeholder: 'Reduced load time by 40%, Shipped MVP in 3 months' },
          { name: 'tags', label: 'Tags', placeholder: 'fullstack, leadership, remote' },
        ].map(({ name, label, placeholder }) => (
          <div key={name}>
            <label className="block text-sm font-medium mb-2">{label} (comma-separated)</label>
            <input
              type="text" name={name}
              defaultValue={Array.isArray(formData[name]) ? formData[name].join(', ') : ''}
              disabled={isDisabled}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              placeholder={placeholder}
            />
          </div>
        ))}

        {/* Dates */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium mb-2">Start Date *</label>
            <input
              type="date" name="startDate"
              defaultValue={formData.startDate ? new Date(formData.startDate).toISOString().substr(0, 10) : ''}
              required disabled={isDisabled}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            />
            {formErrors.startDate && <p className="text-red-600 text-sm mt-1">{formErrors.startDate}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">End Date</label>
            <input
              type="date" name="endDate"
              defaultValue={formData.endDate ? new Date(formData.endDate).toISOString().substr(0, 10) : ''}
              disabled={isDisabled || formData.current}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 disabled:bg-gray-100 disabled:cursor-not-allowed"
            />
            {formErrors.endDate && <p className="text-red-600 text-sm mt-1">{formErrors.endDate}</p>}
          </div>
        </div>

        {/* Company URL */}
        <div>
          <label className="block text-sm font-medium mb-2">Company URL</label>
          <input
            type="url" name="companyUrl"
            defaultValue={formData.companyUrl || ''}
            disabled={isDisabled}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            placeholder="https://company.com"
          />
        </div>

        {/* Display Order */}
        <div>
          <label className="block text-sm font-medium mb-2">Display Order</label>
          <input
            type="number" name="order"
            defaultValue={formData.order ?? 0}
            disabled={isDisabled} min="0"
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
          />
        </div>

        {/* Checkboxes */}
        <div className="flex flex-wrap items-center gap-6">
          <label className="flex items-center">
            <input
              type="checkbox" name="current"
              defaultChecked={formData.current}
              className="h-4 w-4 text-indigo-600 rounded focus:ring-indigo-500"
              disabled={isDisabled}
              onChange={(e) => {
                const endDateInput = document.querySelector('input[name="endDate"]');
                if (endDateInput) {
                  endDateInput.disabled = e.target.checked || isDisabled;
                  if (e.target.checked) endDateInput.value = '';
                }
              }}
            />
            <span className="ml-2 text-sm font-medium">Current Position</span>
          </label>

          <label className="flex items-center">
            <input
              type="checkbox" name="featured"
              defaultChecked={formData.featured}
              className="h-4 w-4 text-indigo-600 rounded focus:ring-indigo-500"
              disabled={isDisabled}
            />
            <span className="ml-2 text-sm font-medium">Featured</span>
          </label>

          <label className="flex items-center">
            <input
              type="checkbox" name="isVisible"
              defaultChecked={formData.status !== 'inactive'}
              className="h-4 w-4 text-indigo-600 rounded focus:ring-indigo-500"
              disabled={isDisabled}
            />
            <span className="ml-2 text-sm font-medium">Visible</span>
          </label>
        </div>

        {/* Logo upload */}
        <div>
          <label className="block text-sm font-medium mb-2">Company Logo</label>
          <input
            type="file" name="companyLogo"
            ref={fileInputRef}
            accept="image/*"
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-700"
            disabled={isDisabled}
          />
          {uploadLimits && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Max size: {Math.round(uploadLimits.maxSize / 1024 / 1024)}MB.
              Allowed: {uploadLimits.allowedTypes.join(', ')}
            </p>
          )}
          {formErrors.companyLogo && (
            <p className="text-red-600 dark:text-red-400 text-sm mt-1">{formErrors.companyLogo}</p>
          )}
        </div>

        {/* Current logo preview */}
        {formData.logo?.url && (
          <div>
            <label className="block text-sm font-medium mb-2">Current Logo</label>
            <img
              src={formData.logo.url}
              alt="Company logo"
              className="w-16 h-16 object-cover rounded border"
            />
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-4 pt-6 border-t border-gray-200 dark:border-gray-700">
          <button
            type="button" onClick={onCancel}
            className="text-gray-600 dark:text-gray-300 py-2 px-4 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500"
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white py-2 px-6 rounded-lg flex items-center transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
            disabled={isSubmitting || userRole !== 'admin'}
          >
            {isSubmitting && (
              <div className="animate-spin h-4 w-4 mr-2 border-2 border-white border-t-transparent rounded-full" />
            )}
            {formData._id ? 'Update' : 'Create'} Experience
          </button>
        </div>
      </form>
    </div>
  );
};

// ─── Main ExperiencesPage ─────────────────────────────────────────────────────
const ExperiencesPage = () => {
  const {
    experiences,
    setExperiences,
    totalPages,
    setTotalPages,
    loading,
    setLoading,
    error,
    setError,
    token,
    apiConfig,
    userRole,
    getErrorMessage,
    uploadLimits,
    handleLogout,
    dataLoaded,
  } = useContext(AdminContext);

  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortConfig, setSortConfig] = useState({ key: 'startDate', direction: 'desc' });
  const [selectedItems, setSelectedItems] = useState([]);
  const [formData, setFormData] = useState(null);
  const [formErrors, setFormErrors] = useState({});
  const [actionLoading, setActionLoading] = useState({});
  const [modal, setModal] = useState({ isOpen: false, message: '', onConfirm: () => {} });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isMountedRef = useRef(true);
  const lastFetchRef = useRef({ searchTerm: '', currentPage: 1, timestamp: 0 });
  const abortControllerRef = useRef(null);

  // ─── Form validation ────────────────────────────────────────────────────────
  const validateForm = useCallback((formValues) => {
    const errors = {};
    if (!formValues.company?.trim()) errors.company = 'Company name is required';
    if (!formValues.position?.trim()) errors.position = 'Position is required';
    if (!formValues.description?.trim()) errors.description = 'Description is required';
    if (!formValues.type) errors.type = 'Employment type is required';
    if (!formValues.startDate || !DateTime.fromFormat(formValues.startDate, 'yyyy-MM-dd').isValid) {
      errors.startDate = 'Valid start date is required';
    }
    if (formValues.endDate && !DateTime.fromFormat(formValues.endDate, 'yyyy-MM-dd').isValid) {
      errors.endDate = 'Invalid end date';
    }
    const isCurrent = formValues.current === 'true' || formValues.current === true;
    if (!isCurrent && formValues.endDate && formValues.startDate) {
      if (DateTime.fromFormat(formValues.endDate, 'yyyy-MM-dd') < DateTime.fromFormat(formValues.startDate, 'yyyy-MM-dd')) {
        errors.endDate = 'End date cannot be before start date';
      }
    }
    return errors;
  }, []);

  // ─── Fetch (admin route, requires token) ────────────────────────────────────
  const fetchData = useCallback(async (forceRefresh = false, retryCount = 0) => {
    if (!token || !isMountedRef.current) return;

    const now = Date.now();
    const lastFetch = lastFetchRef.current;
    if (
      !forceRefresh &&
      lastFetch.searchTerm === searchTerm &&
      lastFetch.currentPage === currentPage &&
      now - lastFetch.timestamp < 1000
    ) return;

    lastFetchRef.current = { searchTerm, currentPage, timestamp: now };

    if (abortControllerRef.current) abortControllerRef.current.abort('New request started');
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    if (isMountedRef.current) { setLoading(true); setError(null); }

    try {
      // FIX: /experiences (plural) — was /experience
      const searchQuery = searchTerm ? `&search=${encodeURIComponent(sanitizeInput(searchTerm))}` : '';
      const url = `/experiences?page=${currentPage}&limit=${CONFIG.ITEMS_PER_PAGE}${searchQuery}`;

      const response = await apiRequest('get', url, null, token, apiConfig.baseUrl, {
        signal: abortController.signal,
        timeout: 30000,
      });

      if (abortController.signal.aborted) return;

      if (isMountedRef.current) {
        if (response.data?.success) {
          const experiencesData = response.data.data?.experiences || [];          const validExperiences = experiencesData.filter((exp) => exp && isValidObjectId(exp._id));
          setExperiences(validExperiences);

          const paginationData = response.data.pagination || response.data;
          setTotalPages((prev) => ({
            ...prev,
            experiences: paginationData.pages ||
              Math.ceil((paginationData.total || validExperiences.length) / CONFIG.ITEMS_PER_PAGE)
          }));
        } else {
          throw new Error(response.data?.message || 'Invalid response from server');
        }
      }
    } catch (err) {
      if (err.name === 'AbortError' || err.code === 'ERR_CANCELED') return;

      if (isMountedRef.current) {
        if (err.response?.status === 401) { setError('Session expired. Please log in again.'); handleLogout(); return; }
        if (err.response?.status === 429 && retryCount < CONFIG.MAX_RETRIES) {
          const delay = CONFIG.RETRY_BASE_DELAY_MS * Math.pow(2, retryCount);
          setTimeout(() => { if (isMountedRef.current) fetchData(forceRefresh, retryCount + 1); }, delay);
          return;
        }
        const errorMsg = getErrorMessage(err);
        setError(errorMsg);
        toast.error(errorMsg);
      }
    } finally {
      if (isMountedRef.current) setLoading(false);
    }
  }, [token, searchTerm, currentPage, apiConfig.baseUrl, handleLogout, getErrorMessage, setExperiences, setTotalPages, setLoading, setError]);

  // ─── Delete ─────────────────────────────────────────────────────────────────
  const handleDelete = useCallback(async (id) => {
    if (userRole !== 'admin') { toast.error('Only admins can delete items'); return false; }
    if (!isValidObjectId(id)) { toast.error('Invalid experience ID format'); return false; }

    try {
      setActionLoading((prev) => ({ ...prev, [id]: true }));
      // FIX: /experiences/:id (plural) — was /experience/:id
      const response = await apiRequest('delete', `/experiences/${id}`, null, token, apiConfig.baseUrl, { timeout: 60000 });

      if (response.status === 200 && response.data?.success) {
        setExperiences((prev) => prev.filter((e) => e._id !== id));
        setSelectedItems((prev) => prev.filter((itemId) => itemId !== id));
        toast.success('Experience deleted successfully!');
        return true;
      }
      throw new Error(`Unexpected response: ${JSON.stringify(response.data)}`);
    } catch (err) {
      if (err.response?.status === 401) { handleLogout(); return false; }
      const errorMsg =
        err.response?.status === 404 ? 'Experience not found or already deleted' :
        err.code === 'ECONNABORTED' ? 'Request timed out - please try again' :
        err.response?.data?.error || getErrorMessage(err);
      toast.error(errorMsg);
      return false;
    } finally {
      setActionLoading((prev) => ({ ...prev, [id]: false }));
    }
  }, [token, apiConfig.baseUrl, userRole, setExperiences, setSelectedItems, handleLogout, getErrorMessage]);

  // ─── Bulk delete ─────────────────────────────────────────────────────────────
  const handleBulkDelete = useCallback(async (selectedIds) => {
    if (userRole !== 'admin') { toast.error('Only admins can perform bulk deletes'); return false; }

    const results = [];
    for (const id of selectedIds) {
      try {
        // FIX: /experiences/:id (plural) — was /experience/:id
        await apiRequest('delete', `/experiences/${id}`, null, token, apiConfig.baseUrl, { timeout: 30000 });
        results.push({ id, success: true });
      } catch (err) {
        results.push({ id, success: false, error: err.response?.data?.message || err.message });
      }
    }

    const successful = results.filter((r) => r.success);
    const failed = results.filter((r) => !r.success);

    if (successful.length > 0) {
      const successfulIds = successful.map((r) => r.id);
      setExperiences((prev) => prev.filter((e) => !successfulIds.includes(e._id)));
      setSelectedItems((prev) => prev.filter((id) => !successfulIds.includes(id)));
    }

    if (failed.length === 0) { toast.success(`${successful.length} experience(s) deleted successfully!`); return true; }
    if (successful.length > 0) { toast.warning(`${successful.length} deleted, ${failed.length} failed`); return true; }
    toast.error(`Failed to delete ${failed.length} experience(s)`);
    return false;
  }, [token, apiConfig.baseUrl, userRole, setExperiences, setSelectedItems]);

  // ─── Submit (create / update) ────────────────────────────────────────────────
  const handleSubmit = useCallback(async (formDataObj) => {
    if (userRole !== 'admin') { setFormErrors({ general: 'Insufficient permissions' }); return; }

    setIsSubmitting(true);
    setFormErrors({});

    const formValues = {};
    for (const [key, value] of formDataObj.entries()) {
      if (key !== 'companyLogo') formValues[key] = value;
    }

    const errors = validateForm(formValues);
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      setIsSubmitting(false);
      return;
    }

    try {
      const method = formValues._id ? 'put' : 'post';
      // FIX: /experiences and /experiences/:id (plural) — was /experience
      const url = formValues._id ? `/experiences/${formValues._id}` : '/experiences';

      const response = await apiRequest(method, url, formDataObj, token, apiConfig.baseUrl);

      if (response.data?.success) {
        const updatedExperience = response.data.data;
        if (formValues._id) {
          setExperiences((prev) => prev.map((e) => e._id === formValues._id ? updatedExperience : e));
        } else {
          setExperiences((prev) => [...prev, updatedExperience]);
        }
        toast.success(`Experience ${formValues._id ? 'updated' : 'created'} successfully!`);
        setFormData(null);
        setFormErrors({});
        fetchData(true);
      } else {
        throw new Error(response.data?.message || `Failed to ${formValues._id ? 'update' : 'create'} experience`);
      }
    } catch (err) {
      if (err.name === 'AbortError') return;
      if (err.response?.status === 401) { handleLogout(); setFormErrors({ general: 'Session expired' }); return; }

      const errorMsg = err.response?.data?.message || getErrorMessage(err);

      if (err.response?.status === 400 && err.response?.data?.details) {
        const backendErrors = {};
        err.response.data.details.forEach((detail) => {
          if (detail.includes('company')) backendErrors.company = detail;
          else if (detail.includes('position')) backendErrors.position = detail;
          else if (detail.includes('description')) backendErrors.description = detail;
          else if (detail.includes('type')) backendErrors.type = detail;
          else if (detail.includes('start date')) backendErrors.startDate = detail;
          else if (detail.includes('end date')) backendErrors.endDate = detail;
          else backendErrors.general = detail;
        });
        setFormErrors(backendErrors);
      } else {
        setFormErrors({ general: errorMsg });
      }
      toast.error(errorMsg);
    } finally {
      setIsSubmitting(false);
    }
  }, [token, apiConfig.baseUrl, userRole, handleLogout, getErrorMessage, validateForm, setExperiences, fetchData]);

  // ─── handleEdit ──────────────────────────────────────────────────────────────
  const handleEdit = useCallback(async (experience) => {
    try {
      if (!isValidObjectId(experience._id)) throw new Error('Invalid experience ID');
      // FIX: /experiences/:id (plural) — was /experience/:id
      const response = await apiRequest('get', `/experiences/${experience._id}`, null, token, apiConfig.baseUrl);
      if (response.data.success) {
  const full = response.data.data?.experience;
        setFormData({
          ...CONFIG.FORM_DEFAULTS,
          ...full,
          responsibilities: Array.isArray(full.responsibilities) ? full.responsibilities : [],
          technologies: Array.isArray(full.technologies) ? full.technologies : [],
          achievements: Array.isArray(full.achievements) ? full.achievements : [],
          tags: Array.isArray(full.tags) ? full.tags : [],
        });
      } else {
        throw new Error('Failed to fetch full experience details');
      }
    } catch (err) {
      console.error('Edit experience error:', err);
      toast.error('Failed to load experience details. Using cached data.');
      setFormData({
        ...CONFIG.FORM_DEFAULTS,
        ...experience,
        responsibilities: Array.isArray(experience.responsibilities) ? experience.responsibilities : [],
        technologies: Array.isArray(experience.technologies) ? experience.technologies : [],
        achievements: Array.isArray(experience.achievements) ? experience.achievements : [],
        tags: Array.isArray(experience.tags) ? experience.tags : [],
      });
    }
    setFormErrors({});
  }, [token, apiConfig.baseUrl]);

  // ─── Lifecycle ───────────────────────────────────────────────────────────────
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (abortControllerRef.current) abortControllerRef.current.abort('Component unmounting');
    };
  }, []);

  useEffect(() => {
    if (token) {
      const needsFetch = !dataLoaded || searchTerm || currentPage > 1;
      if (needsFetch) {
        const id = setTimeout(() => { if (isMountedRef.current) fetchData(); }, 150);
        return () => clearTimeout(id);
      }
    }
  }, [token, searchTerm, currentPage, dataLoaded, fetchData]);

  const debouncedSearch = useMemo(
    () => debounce((value) => {
      if (isMountedRef.current) { setSearchTerm(sanitizeInput(value.trim())); setCurrentPage(1); }
    }, CONFIG.SEARCH_DEBOUNCE_MS),
    []
  );

  useEffect(() => () => debouncedSearch.cancel(), [debouncedSearch]);

  // ─── Filtering / sorting (client-side) ──────────────────────────────────────
  const filteredAndSortedExperiences = useMemo(() => {
    if (!Array.isArray(experiences)) return [];

    let filtered = experiences.filter((exp) => {
      if (!exp) return false;
      const s = searchTerm.toLowerCase();
      return ['position', 'company', 'description'].some((f) => exp[f]?.toString().toLowerCase().includes(s));
    });

    if (sortConfig.key) {
      filtered.sort((a, b) => {
        const aVal = a[sortConfig.key] || '';
        const bVal = b[sortConfig.key] || '';
        if (['startDate', 'endDate'].includes(sortConfig.key)) {
          return sortConfig.direction === 'asc'
            ? new Date(aVal) - new Date(bVal)
            : new Date(bVal) - new Date(aVal);
        }
        const r = typeof aVal === 'string' ? aVal.localeCompare(bVal) : aVal - bVal;
        return sortConfig.direction === 'asc' ? r : -r;
      });
    }
    return filtered;
  }, [experiences, searchTerm, sortConfig]);

  const handleSort = useCallback((key) => {
    setSortConfig((prev) => ({ key, direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc' }));
  }, []);

  const confirmDelete = (id) => {
    setModal({
      isOpen: true,
      message: 'Are you sure you want to delete this experience? This action cannot be undone.',
      onConfirm: async () => {
        await handleDelete(id);
        setModal({ isOpen: false, message: '', onConfirm: () => {} });
      }
    });
  };

  const confirmBulkDelete = () => {
    if (!selectedItems.length) return;
    setModal({
      isOpen: true,
      message: `Are you sure you want to delete ${selectedItems.length} experience(s)?`,
      onConfirm: async () => {
        await handleBulkDelete(selectedItems);
        setModal({ isOpen: false, message: '', onConfirm: () => {} });
      }
    });
  };

  const handleAddNew = useCallback(() => {
    setFormData({ ...CONFIG.FORM_DEFAULTS });
    setFormErrors({});
  }, []);

  const handleCancelForm = useCallback(() => { setFormData(null); setFormErrors({}); }, []);

  // ─── Render ──────────────────────────────────────────────────────────────────
  if (loading && !experiences.length) {
    return (
      <div className="space-y-4 py-20">
        {Array(5).fill(null).map((_, i) => <SkeletonExperienceCard key={i} />)}
      </div>
    );
  }

  if (error && !experiences.length) {
    return (
      <div className="text-center py-20">
        <p className="text-red-600 dark:text-red-400 text-xl mb-4">{error}</p>
        <button
          onClick={() => { setError(null); fetchData(true); }}
          className="bg-indigo-600 hover:bg-indigo-700 text-white py-2 px-4 rounded-lg transition-colors flex items-center gap-2 mx-auto"
          disabled={loading}
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header controls */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="relative w-full max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search experiences..."
            onChange={(e) => debouncedSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white/80 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 rounded-full focus:outline-none focus:ring-2 focus:ring-indigo-500"
            disabled={loading}
          />
        </div>
        <div className="flex items-center gap-2">
          <select
            value={sortConfig.key}
            onChange={(e) => handleSort(e.target.value)}
            disabled={loading}
            className="px-4 py-2 bg-white/80 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="startDate">Start Date</option>
            <option value="position">Position</option>
            <option value="company">Company</option>
            <option value="endDate">End Date</option>
          </select>
          <button
            onClick={() => handleSort(sortConfig.key)}
            className="text-gray-600 dark:text-gray-300 p-2 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500"
            disabled={loading}
          >
            {sortConfig.direction === 'asc' ? <ArrowUp size={16} /> : <ArrowDown size={16} />}
          </button>
          <button
            onClick={() => fetchData(true)}
            className="text-gray-600 dark:text-gray-300 p-2 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500"
            disabled={loading}
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Bulk actions */}
      {selectedItems.length > 0 && userRole === 'admin' && (
        <div className="flex justify-between items-center bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-lg">
          <span className="text-indigo-700 dark:text-indigo-300">
            {selectedItems.length} experience{selectedItems.length !== 1 ? 's' : ''} selected
          </span>
          <button
            onClick={confirmBulkDelete}
            className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 flex items-center transition-colors"
            disabled={loading}
          >
            <Trash2 size={16} className="mr-2" />
            Delete Selected ({selectedItems.length})
          </button>
        </div>
      )}

      {/* Add new button */}
      <button
        onClick={handleAddNew}
        className="bg-gradient-to-r from-indigo-500 to-blue-500 hover:from-indigo-600 hover:to-blue-600 disabled:from-gray-400 disabled:to-gray-500 text-white py-2 px-4 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 flex items-center gap-2"
        disabled={loading || userRole !== 'admin'}
      >
        <Plus size={16} />
        Add New Experience
      </button>

      {/* List */}
      <div className="space-y-4">
        {filteredAndSortedExperiences.map((experience) => (
          <ExperienceCard
            key={experience._id}
            experience={experience}
            isSelected={selectedItems.includes(experience._id)}
            onSelect={() =>
              setSelectedItems((prev) =>
                prev.includes(experience._id)
                  ? prev.filter((id) => id !== experience._id)
                  : [...prev, experience._id]
              )
            }
            onEdit={() => handleEdit(experience)}
            onDelete={confirmDelete}
            actionLoading={actionLoading[experience._id]}
            userRole={userRole}
          />
        ))}
      </div>

      {/* Empty state */}
      {filteredAndSortedExperiences.length === 0 && !loading && (
        <div className="p-12 text-center bg-white/90 dark:bg-gray-800/90 rounded-2xl">
          <p className="text-gray-600 dark:text-gray-300 text-lg">
            {searchTerm ? `No experiences found matching "${searchTerm}"` : 'No experiences found'}
          </p>
          {searchTerm && (
            <button
              onClick={() => { setSearchTerm(''); }}
              className="mt-4 text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300"
            >
              Clear search
            </button>
          )}
        </div>
      )}

      {/* Loading indicator when refreshing with data visible */}
      {loading && experiences.length > 0 && (
        <div className="text-center py-4">
          <div className="inline-flex items-center text-indigo-600">
            <div className="animate-spin h-4 w-4 mr-2 border-2 border-indigo-600 border-t-transparent rounded-full" />
            <span className="text-sm">Loading...</span>
          </div>
        </div>
      )}

      {/* Pagination */}
      {totalPages.experiences > 1 && (
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mt-8 p-4 bg-white/90 dark:bg-gray-800/90 rounded-2xl">
          <div className="text-sm text-gray-600 dark:text-gray-300">
            Showing page {currentPage} of {totalPages.experiences}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
              disabled={currentPage === 1 || loading}
              className="bg-indigo-500 hover:bg-indigo-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white py-2 px-4 rounded-lg transition-colors"
            >
              Previous
            </button>
            <div className="flex gap-1">
              {Array.from({ length: Math.min(5, totalPages.experiences) }, (_, i) => {
                const pageNum = Math.max(1, Math.min(totalPages.experiences - 4, currentPage - 2)) + i;
                if (pageNum > totalPages.experiences) return null;
                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`py-2 px-3 rounded-lg transition-colors ${
                      currentPage === pageNum
                        ? 'bg-indigo-600 text-white'
                        : 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300'
                    }`}
                    disabled={loading}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => setCurrentPage((p) => p + 1)}
              disabled={currentPage >= totalPages.experiences || loading}
              className="bg-indigo-500 hover:bg-indigo-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white py-2 px-4 rounded-lg transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Form */}
      {formData && (
        <ExperienceForm
          formData={formData}
          onCancel={handleCancelForm}
          onSubmit={handleSubmit}
          formErrors={formErrors}
          userRole={userRole}
          uploadLimits={uploadLimits}
          isSubmitting={isSubmitting}
        />
      )}

      {/* Confirmation modal */}
      <ConfirmationModal
        isOpen={modal.isOpen}
        message={modal.message}
        onConfirm={modal.onConfirm}
        onCancel={() => setModal({ isOpen: false, message: '', onConfirm: () => {} })}
      />
    </div>
  );
};

export default ExperiencesPage;