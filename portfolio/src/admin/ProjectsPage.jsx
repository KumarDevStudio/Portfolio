import React, { useContext, useState, useCallback, useMemo, useEffect, useRef, useActionState } from 'react';
import { toast } from 'react-toastify';
import { Plus, Edit, Trash2, Eye, Search, ArrowUp, ArrowDown, RefreshCw, Upload, Filter, X, Calendar, Users, Star, Archive } from 'lucide-react';
import { debounce } from 'lodash';
import validator from 'validator';
import axios from 'axios';
import sanitizeHtml from 'sanitize-html';
import { AdminContext } from '../pages/Admin';
import FormInput from './FormInput';
import FormSelect from './FormSelect';
import ConfirmationModal from './ConfirmationModal';

// API utilities defined inline
const apiRequest = async (method, endpoint, data = null, token = null, baseUrl = '', options = {}) => {
  try {
    const { headers: optionHeaders = {}, ...restOptions } = options;
const config = {
  method,
  url: `${baseUrl}${endpoint}`,
  headers: {
    ...(token && { Authorization: `Bearer ${token}` }),
    ...optionHeaders,
  },
  data,
  timeout: 60000,
  ...restOptions,
};
    if (data && !(data instanceof FormData) && method.toUpperCase() !== 'DELETE') {
      config.headers['Content-Type'] = 'application/json';
    }
    if (data instanceof FormData) {
      delete config.headers['Content-Type'];
    }
    console.log(`Sending ${method} request to ${endpoint}:`, { headers: config.headers, data: config.data });
    const response = await axios(config);
    console.log(`Response from ${method} ${endpoint}:`, response.data);
    return response;
  } catch (error) {
    console.error(`Error in ${method} ${endpoint}:`, {
      status: error.response?.status,
      data: error.response?.data,
      message: error.message,
      config: error.config,
    });
    throw error;
  }
};

const sanitizeInput = (input) => {
  if (typeof input !== 'string') return input;
  return sanitizeHtml(input, { allowedTags: [], allowedAttributes: {} }).trim();
};

// Centralized configuration
const CONFIG = {
  ITEMS_PER_PAGE: 12,
  SEARCH_DEBOUNCE_MS: 300,
  MAX_RETRIES: 3,
  RETRY_BASE_DELAY_MS: 2000,
  FORM_DEFAULTS: {
    title: '',
    slug: '',
    description: '',
    longDescription: '',
    category: 'Other',
    technologies: [],
    tags: [],
    githubUrl: '',
    liveUrl: '',
    demoUrl: '',
    features: [],
    challenges: [],
    duration: {},
    teamSize: 1,
    myRole: '',
    clientType: 'Personal',
    featured: false,
    priority: 5,
    status: 'completed',
    visibility: 'public',
    seo: { metaTitle: '', metaDescription: '', keywords: [] },
    startDate: '',
    endDate: '',
    isArchived: false,
    images: [],
  },
};

// Validation utilities
const isValidObjectId = (id) => {
  if (typeof id !== 'string') return false;
  return /^[0-9a-fA-F]{24}$/.test(id);
};

const isValidUrl = (url, options = {}) => {
  if (!url) return true;
  const isValid = validator.isURL(url, { require_protocol: true });
  if (options.githubOnly) {
    return isValid && url.includes('github.com');
  }
  return isValid;
};

const validateProjectForm = (formData) => {
  const errors = {};

  // Required fields
  if (!formData?.title?.trim()) {
    errors.title = 'Project title is required';
  } else if (formData.title.trim().length < 3) {
    errors.title = 'Project title must be at least 3 characters long';
  }

  if (!formData?.description?.trim()) {
    errors.description = 'Project description is required';
  } else if (formData.description.trim().length < 10) {
    errors.description = 'Project description must be at least 10 characters long';
  }

  if (!formData?.slug?.trim()) {
    errors.slug = 'Project slug is required (auto-generated from title if not provided)';
  } else if (!/^[a-z0-9-]+$/.test(formData.slug)) {
    errors.slug = 'Slug must contain only lowercase letters, numbers, and hyphens';
  } else if (formData.slug.length > 100) {
    errors.slug = 'Slug must be less than 100 characters';
  }

  // URL validation
  if (formData?.githubUrl && !isValidUrl(formData.githubUrl)) {
    errors.githubUrl = 'Invalid GitHub URL format';
  }
  if (formData?.liveUrl && !isValidUrl(formData.liveUrl)) {
    errors.liveUrl = 'Invalid Live URL format';
  }
  if (formData?.demoUrl && !isValidUrl(formData.demoUrl)) {
    errors.demoUrl = 'Invalid Demo URL format';
  }

  // Numeric validation
  const teamSize = parseInt(formData?.teamSize);
  if (isNaN(teamSize) || teamSize < 1) {
    errors.teamSize = 'Team size must be at least 1';
  } else if (teamSize > 100) {
    errors.teamSize = 'Team size cannot exceed 100';
  }

  const priority = parseInt(formData?.priority);
  if (isNaN(priority) || priority < 1 || priority > 10) {
    errors.priority = 'Priority must be between 1 and 10';
  }

  // Category validation
  const validCategories = ['Frontend', 'Backend', 'Full Stack', 'Mobile', 'AI/ML', 'Other'];
  if (formData?.category && !validCategories.includes(formData.category)) {
    errors.category = 'Invalid category selected';
  }

  // Status validation
  const validStatuses = ['planning', 'in-progress', 'completed', 'on-hold'];
  if (formData?.status && !validStatuses.includes(formData.status)) {
    errors.status = 'Invalid status selected';
  }

  // Visibility validation
  const validVisibility = ['public', 'private', 'unlisted'];
  if (formData?.visibility && !validVisibility.includes(formData.visibility)) {
    errors.visibility = 'Invalid visibility setting';
  }

  // Date validation
  if (formData?.startDate && formData?.endDate) {
    const startDate = new Date(formData.startDate);
    const endDate = new Date(formData.endDate);
    if (startDate > endDate) {
      errors.endDate = 'End date cannot be before start date';
    }
  }

  return errors;
};


// Custom hooks for better separation of concerns
const useProjectOperations = ({ setActionLoading, setSelectedItems, projects }) => {
  const {
    projects: contextProjects,
    setProjects,
    token,
    apiConfig,
    userRole,
    getErrorMessage,
    uploadLimits,
    handleLogout,
  } = useContext(AdminContext);

  const handleDelete = useCallback(
    async (id) => {
      if (userRole !== 'admin') {
        toast.error('Only admins can delete items');
        return false;
      }
      if (!isValidObjectId(id)) {
        console.error('Invalid ObjectId:', { id, length: id?.length, type: typeof id });
        toast.error('Invalid project ID format');
        return false;
      }
      const project = projects.find((p) => p._id === id);
      if (!project) {
        console.error('Project not found in state:', { id });
        toast.error('Project not found');
        return false;
      }
      try {
        console.log('Sending DELETE request for project:', { id, url: `${apiConfig.baseUrl}/projects/${id}` });
        setActionLoading((prev) => ({ ...prev, [id]: true }));
        const response = await apiRequest('delete', `/projects/${id}`, null, token, apiConfig.baseUrl, {
          timeout: 60000,
        });
        console.log('Delete project response:', {
          status: response.status,
          data: response.data,
          headers: response.headers,
          url: response.config.url,
        });
        if (response.status === 200 && response.data?.success) {
          setProjects((prev) => prev.filter((p) => p._id !== id));
          setSelectedItems((prev) => prev.filter((itemId) => itemId !== id));
          toast.success('Project deleted successfully!');
          return true;
        } else {
          throw new Error(`Unexpected response: ${JSON.stringify(response.data)}`);
        }
      } catch (err) {
        console.error('Delete project error:', {
          id,
          status: err.response?.status,
          statusText: err.response?.statusText,
          data: err.response?.data,
          message: err.message,
          url: `${apiConfig.baseUrl}/projects/${id}`,
          axiosConfig: err.config,
        });
        if (err.response?.status === 401) {
          handleLogout();
          return false;
        }
        let errorMsg = 'Failed to delete project';
        if (err.response?.status === 400) {
          errorMsg = err.response?.data?.error || 'Invalid request';
        } else if (err.response?.status === 404) {
          errorMsg = 'Project not found';
        } else if (err.code === 'ECONNABORTED') {
          errorMsg = 'Request timed out - please try again';
        } else {
          errorMsg = err.response?.data?.error || getErrorMessage(err);
        }
        toast.error(errorMsg);
        return false;
      } finally {
        setActionLoading((prev) => ({ ...prev, [id]: false }));
      }
    },
    [token, apiConfig.baseUrl, userRole, setProjects, getErrorMessage, setActionLoading, setSelectedItems, projects]
  );

  const handleBulkDelete = useCallback(
    async (selectedIds) => {
      if (userRole !== 'admin') {
        toast.error('Only admins can perform bulk deletes');
        return false;
      }
      if (selectedIds.some((id) => !isValidObjectId(id))) {
        toast.error('One or more invalid project IDs');
        return false;
      }
      try {
        setActionLoading((prev) => ({
          ...prev,
          ...Object.fromEntries(selectedIds.map((id) => [id, true])),
        }));
        const response = await apiRequest(
          'patch',
          '/projects/bulk',
          { action: 'delete', projectIds: selectedIds },
          token,
          apiConfig.baseUrl
        );
        if (response.data?.success) {
          setProjects((prev) => prev.filter((p) => !selectedIds.includes(p._id)));
          setSelectedItems([]);
          toast.success(`${selectedIds.length} project(s) deleted successfully!`);
          return true;
        } else {
          throw new Error(response.data?.message || 'Bulk delete failed');
        }
      } catch (err) {
        console.error('Bulk delete error:', {
          status: err.response?.status,
          data: err.response?.data,
          message: err.message,
        });
        if (err.response?.status === 401) {
          handleLogout();
          return false;
        }
        toast.error(getErrorMessage(err) || 'Failed to delete projects');
        return false;
      } finally {
        setActionLoading((prev) => ({
          ...prev,
          ...Object.fromEntries(selectedIds.map((id) => [id, false])),
        }));
      }
    },
    [token, apiConfig.baseUrl, userRole, setProjects, getErrorMessage, handleLogout, setActionLoading, setSelectedItems]
  );

  const handlePreview = useCallback(
    (project) => {
      if (!project || !project._id) {
        toast.error('Invalid project data');
        return;
      }

      console.log('Opening preview for project:', project._id);

      // Open preview in a new tab/window
      const previewUrl = `/admin/preview/projects/${project._id}`;
      window.open(previewUrl, '_blank', 'noopener,noreferrer');
    },
    []
  );

const handleEdit = useCallback(
  async (project, setFormData) => {
    try {
      console.log('Starting edit for project:', { id: project._id });
      const response = await apiRequest('get', `/projects/${project._id}`, null, token, apiConfig.baseUrl);
      console.log('Edit API response:', response.data);
      
      if (response.data.success) {
        const fullProject = response.data.data;
        console.log('Full project data fetched:', fullProject);
        
        // Ensure slug is included and properly formatted
        const slug = (fullProject.slug || fullProject.title || '')
          .toLowerCase()
          .trim()
          .replace(/\s+/g, '-')
          .replace(/[^\w-]+/g, '')
          .substring(0, 100);
        
        const editFormData = {
          ...CONFIG.FORM_DEFAULTS,
          ...fullProject,
          slug: slug, // Explicitly set the slug
          technologies: Array.isArray(fullProject.technologies) ? fullProject.technologies : [],
          tags: Array.isArray(fullProject.tags) ? fullProject.tags : [],
          features: Array.isArray(fullProject.features) ? fullProject.features : [],
          challenges: Array.isArray(fullProject.challenges) ? fullProject.challenges : [],
          duration: fullProject.duration || {},
          seo: fullProject.seo || { metaTitle: '', metaDescription: '', keywords: [] },
          images: Array.isArray(fullProject.images) ? fullProject.images : [],
        };
        
        console.log('Form data set for editing with slug:', editFormData.slug);
        setFormData(editFormData);
      } else {
        throw new Error('Failed to fetch full project details');
      }
    } catch (err) {
      console.error('Edit project error:', {
        id: project._id,
        status: err.response?.status,
        data: err.response?.data,
        message: err.message,
      });
      toast.error('Failed to load full project details. Using available data.');
      
      // Fallback with proper slug
      const slug = (project.slug || project.title || '')
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '-')
        .replace(/[^\w-]+/g, '')
        .substring(0, 100);
      
      const editFormData = {
        ...CONFIG.FORM_DEFAULTS,
        ...project,
        slug: slug,
        technologies: Array.isArray(project.technologies) ? project.technologies : [],
        tags: Array.isArray(project.tags) ? project.tags : [],
        features: Array.isArray(project.features) ? project.features : [],
        challenges: Array.isArray(project.challenges) ? project.challenges : [],
        duration: project.duration || {},
        seo: project.seo || { metaTitle: '', metaDescription: '', keywords: [] },
        images: Array.isArray(project.images) ? project.images : [],
      };
      setFormData(editFormData);
      console.log('Form data set with partial data and slug:', editFormData.slug);
      
      if (err.response?.status === 401) {
        handleLogout();
      }
    }
  },
  [token, apiConfig.baseUrl, handleLogout]
);



const submitProject = useCallback(
  async (previousState, formData) => {
    if (userRole !== 'admin') {
      return { success: false, errors: { general: 'Insufficient permissions' } };
    }

    const files = formData.getAll('images').filter((f) => f.size > 0);
    const hasFiles = files.length > 0;
    const formValues = Object.fromEntries(formData.entries());
    
    // Handle boolean fields properly
    formValues.featured = formValues.featured === 'on' || formValues.featured === 'true';
    formValues.isArchived = formValues.isArchived === 'on' || formValues.isArchived === 'true';

    // Generate slug properly - CRITICAL FIX
    let slug = formValues.slug?.trim() || '';
    
    // If editing and slug exists, keep it (unless it's empty)
    // If creating or slug is empty, generate from title
    if (!slug && formValues.title?.trim()) {
      slug = formValues.title
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '-')
        .replace(/[^\w-]+/g, '')
        .substring(0, 100);
    } else {
      // Ensure existing slug is properly formatted
      slug = slug
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '-')
        .replace(/[^\w-]+/g, '')
        .substring(0, 100);
    }
    
    formValues.slug = slug;
    console.log('Processing slug:', { original: formData.get('slug'), processed: slug, isEdit: !!formValues._id });

    // Basic client-side validation
    const errors = validateProjectForm(formValues);
    if (Object.keys(errors).length > 0) {
      console.error('Validation errors:', errors);
      return { success: false, errors };
    }

    try {
      // Parse comma-separated fields into arrays and sanitize
      const parseCommaSeparated = (input) => {
        if (!input || typeof input !== 'string') return [];
        return input.split(',').map((item) => {
          const trimmed = item.trim();
          return trimmed.replace(/[<>]/g, '');
        }).filter((item) => item);
      };

      // Simple text sanitization function
      const sanitizeText = (text) => {
        if (!text || typeof text !== 'string') return text;
        return text.replace(/[<>]/g, '').trim();
      };

      // Build the request payload as a JSON object (not FormData)
      const payload = {
        title: sanitizeText(formValues.title),
        slug: slug, // Use the processed slug
        description: sanitizeText(formValues.description),
        longDescription: sanitizeText(formValues.longDescription || ''),
        category: sanitizeText(formValues.category || 'Other'),
        technologies: parseCommaSeparated(formValues.technologies),
        tags: parseCommaSeparated(formValues.tags),
        features: parseCommaSeparated(formValues.features),
        challenges: parseCommaSeparated(formValues.challenges),
        githubUrl: formValues.githubUrl?.trim() ? sanitizeText(formValues.githubUrl.trim()) : '',
        liveUrl: formValues.liveUrl?.trim() ? sanitizeText(formValues.liveUrl.trim()) : '',
        demoUrl: formValues.demoUrl?.trim() ? sanitizeText(formValues.demoUrl.trim()) : '',
        teamSize: Math.max(1, parseInt(formValues.teamSize) || 1),
        myRole: sanitizeText(formValues.myRole || ''),
        clientType: sanitizeText(formValues.clientType || 'Personal'),
        featured: Boolean(formValues.featured),
        priority: Math.min(10, Math.max(1, parseInt(formValues.priority) || 5)),
        status: sanitizeText(formValues.status || 'completed'),
        visibility: sanitizeText(formValues.visibility || 'public'),
        startDate: formValues.startDate || '',
        endDate: formValues.endDate || '',
        isArchived: Boolean(formValues.isArchived),
      };

      // Handle duration object
      let duration = {};
      if (formValues.duration) {
        try {
          if (typeof formValues.duration === 'string' && formValues.duration.trim()) {
            duration = JSON.parse(formValues.duration);
          } else if (typeof formValues.duration === 'object') {
            duration = formValues.duration;
          }
        } catch (err) {
          console.warn('Invalid duration format:', err.message);
        }
      }
      payload.duration = duration;

      // Handle SEO object
      const seo = {
        metaTitle: sanitizeText(formValues['seo.metaTitle'] || ''),
        metaDescription: sanitizeText(formValues['seo.metaDescription'] || ''),
        keywords: parseCommaSeparated(formValues['seo.keywords'] || '')
      };
      payload.seo = seo;

      console.log('Sending payload:', JSON.stringify(payload, null, 2));

      // Determine if this is an update or create
      const isUpdate = !!formValues._id;
      const endpoint = isUpdate ? `/projects/${formValues._id}` : '/projects';
      const method = isUpdate ? 'PUT' : 'POST';

      console.log(`Making ${method} request to ${endpoint}`);

      // Send as JSON, not FormData
      const response = await apiRequest(
        method,
        endpoint,
        payload,
        token,
        apiConfig.baseUrl,
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      console.log('Response received:', response.data);

      if (!response.data?.success) {
        throw new Error(response.data?.error || response.data?.message || 'Invalid response from server');
      }

      const projectId = response.data.data._id || formValues._id;

      // Handle image uploads separately if files exist
if (hasFiles && projectId && files.length > 0) {
          try {
          const imageFormData = new FormData();
          files.forEach((file) => imageFormData.append('images', file));

          const imageResponse = await apiRequest(
            'POST',
            `/projects/${projectId}/images`,
            imageFormData,
            token,
            apiConfig.baseUrl
          );

          if (!imageResponse.data?.success) {
            console.warn('Image upload failed, but project was saved successfully');
          }
        } catch (imageErr) {
          console.warn('Image upload error:', imageErr);
        }
      }

      toast.success(isUpdate ? 'Project updated successfully!' : 'Project created successfully!');
      return { success: true, projectId };
    } catch (err) {
      console.error('Submit project error:', {
        status: err.response?.status,
        data: err.response?.data,
        message: err.message,
      });

      if (err.response?.status === 401) {
        handleLogout();
        return { success: false, errors: { general: 'Session expired' } };
      }

      // Extract specific server error if available
      const serverError = err.response?.data?.error || err.response?.data?.message || getErrorMessage(err);
      const fieldErrors = err.response?.data?.errors || {};

      // Handle validation errors specifically
      if (err.response?.status === 400 && err.response?.data?.details) {
        const validationErrors = {};
        err.response.data.details.forEach(detail => {
          const field = detail.path?.[0] || detail.field || 'general';
          validationErrors[field] = detail.message;
        });
        return { success: false, errors: validationErrors };
      }

      return { success: false, errors: { general: serverError, ...fieldErrors } };
    }
  },
  [token, apiConfig.baseUrl, userRole, uploadLimits, handleLogout, getErrorMessage]
);

  return {
    handleDelete,
    handleBulkDelete,
    handlePreview,
    handleEdit,
    submitProject,
  };
};

// Enhanced filter hook for better filtering
const useProjectFilters = (projects) => {
  const [filters, setFilters] = useState({
    category: '',
    status: '',
    featured: '',
    visibility: '',
    archived: '',
    dateRange: { start: '', end: '' },
  });

  const filteredProjects = useMemo(() => {
    if (!Array.isArray(projects)) return [];

    return projects.filter((project) => {
      if (!project) return false;

      // Category filter
      if (filters.category && project.category !== filters.category) return false;

      // Status filter
      if (filters.status && project.status !== filters.status) return false;

      // Featured filter
      if (filters.featured) {
        const isFeatured = project.featured === true;
        if ((filters.featured === 'true' && !isFeatured) || (filters.featured === 'false' && isFeatured)) {
          return false;
        }
      }

      // Visibility filter
      if (filters.visibility && project.visibility !== filters.visibility) return false;

      // Archived filter
      if (filters.archived) {
        const isArchived = project.isArchived === true;
        if ((filters.archived === 'true' && !isArchived) || (filters.archived === 'false' && isArchived)) {
          return false;
        }
      }

      // Date range filter
      if (filters.dateRange.start || filters.dateRange.end) {
        const projectDate = new Date(project.createdAt);
        if (filters.dateRange.start && projectDate < new Date(filters.dateRange.start)) return false;
        if (filters.dateRange.end && projectDate > new Date(filters.dateRange.end)) return false;
      }

      return true;
    });
  }, [projects, filters]);

  const clearFilters = useCallback(() => {
    setFilters({
      category: '',
      status: '',
      featured: '',
      visibility: '',
      archived: '',
      dateRange: { start: '', end: '' },
    });
  }, []);

  const activeFiltersCount = useMemo(() => {
    return Object.values(filters).filter(value =>
      value && value !== '' && !(typeof value === 'object' && !value.start && !value.end)
    ).length;
  }, [filters]);

  return { filters, setFilters, filteredProjects, clearFilters, activeFiltersCount };
};

// Enhanced Project Card Component
const ProjectCard = React.memo(
  ({ project, isSelected, onSelect, onEdit, onDelete, onPreview, actionLoading, userRole }) => {
    const formatDate = (dateString) => {
      if (!dateString) return 'N/A';
      try {
        return new Date(dateString).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        });
      } catch {
        return 'N/A';
      }
    };

    const getStatusColor = (status) => {
      const colors = {
        'completed': 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200',
        'in-progress': 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200',
        'planning': 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200',
        'on-hold': 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200',
      };
      return colors[status] || 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200';
    };

    return (
      <div className={`group p-6 bg-white/95 dark:bg-gray-800/95 border border-gray-200/50 dark:border-gray-700/50 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02] ${project.featured ? 'ring-2 ring-indigo-200 dark:ring-indigo-800' : ''
        }`}>
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-start space-x-4 flex-1">
            <input
              type="checkbox"
              checked={isSelected}
              onChange={onSelect}
              className="mt-1.5 h-4 w-4 text-indigo-600 rounded focus:ring-indigo-500 transition-colors"
              disabled={actionLoading || userRole !== 'admin'}
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 truncate">
                  {sanitizeInput(project.title)}
                </h3>
                {project.featured && (
                  <Star className="w-4 h-4 text-yellow-500" fill="currentColor" />
                )}
                {project.isArchived && (
                  <Archive className="w-4 h-4 text-gray-500" />
                )}
              </div>
              <p className="text-gray-600 dark:text-gray-300 text-sm line-clamp-2 mb-3">
                {sanitizeInput(project.description)}
              </p>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(project.status)}`}>
                    {sanitizeInput(project.status)}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {sanitizeInput(project.category)}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                  <div className="flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    <span>{project.teamSize || 1}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    <span>{formatDate(project.createdAt)}</span>
                  </div>
                  <span className="px-2 py-1 bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 rounded">
                    P{project.priority || 5}
                  </span>
                </div>
              </div>

              {project.technologies?.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-3">
                  {project.technologies.slice(0, 3).map((tech, idx) => (
                    <span
                      key={idx}
                      className="bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-1 rounded-md text-xs font-medium"
                    >
                      {sanitizeInput(tech)}
                    </span>
                  ))}
                  {project.technologies.length > 3 && (
                    <span className="text-gray-500 dark:text-gray-400 text-xs px-2 py-1">
                      +{project.technologies.length - 3} more
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <button
              onClick={() => onPreview(project)}
              className="text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300 transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 p-2 rounded-lg hover:bg-green-50 dark:hover:bg-green-900/30"
              disabled={actionLoading}
              title="Preview project"
            >
              <Eye size={16} />
            </button>
            <button
              onClick={() => onEdit(project)}
              className="text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 p-2 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/30"
              disabled={actionLoading || userRole !== 'admin'}
              title="Edit project"
            >
              <Edit size={16} />
            </button>
            <button
              onClick={() => onDelete(project._id)}
              className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30"
              disabled={actionLoading || userRole !== 'admin'}
              title="Delete project"
            >
              {actionLoading ? (
                <div className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
              ) : (
                <Trash2 size={16} />
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }
);

ProjectCard.displayName = 'ProjectCard';

// Enhanced Filter Panel Component
const FilterPanel = ({ filters, setFilters, clearFilters, activeFiltersCount, isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={onClose}></div>

        <div className="inline-block align-bottom bg-white dark:bg-gray-800 rounded-2xl text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
          <div className="bg-white dark:bg-gray-800 px-6 pt-6 pb-4">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Filters</h3>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X size={24} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Category
                </label>
                <select
                  value={filters.category}
                  onChange={(e) => setFilters(prev => ({ ...prev, category: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                >
                  <option value="">All Categories</option>
                  <option value="Frontend">Frontend</option>
                  <option value="Backend">Backend</option>
                  <option value="Full Stack">Full Stack</option>
                  <option value="Mobile">Mobile</option>
                  <option value="AI/ML">AI/ML</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Status
                </label>
                <select
                  value={filters.status}
                  onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                >
                  <option value="">All Statuses</option>
                  <option value="planning">Planning</option>
                  <option value="in-progress">In Progress</option>
                  <option value="completed">Completed</option>
                  <option value="on-hold">On Hold</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Featured
                </label>
                <select
                  value={filters.featured}
                  onChange={(e) => setFilters(prev => ({ ...prev, featured: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                >
                  <option value="">All Projects</option>
                  <option value="true">Featured Only</option>
                  <option value="false">Non-Featured</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Visibility
                </label>
                <select
                  value={filters.visibility}
                  onChange={(e) => setFilters(prev => ({ ...prev, visibility: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                >
                  <option value="">All Visibility</option>
                  <option value="public">Public</option>
                  <option value="private">Private</option>
                  <option value="unlisted">Unlisted</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Archived
                </label>
                <select
                  value={filters.archived}
                  onChange={(e) => setFilters(prev => ({ ...prev, archived: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                >
                  <option value="">All Projects</option>
                  <option value="false">Active Only</option>
                  <option value="true">Archived Only</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={filters.dateRange.start}
                    onChange={(e) => setFilters(prev => ({
                      ...prev,
                      dateRange: { ...prev.dateRange, start: e.target.value }
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={filters.dateRange.end}
                    onChange={(e) => setFilters(prev => ({
                      ...prev,
                      dateRange: { ...prev.dateRange, end: e.target.value }
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="bg-gray-50 dark:bg-gray-700 px-6 py-4 flex justify-between">
            <button
              onClick={clearFilters}
              className="text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 text-sm font-medium"
              disabled={activeFiltersCount === 0}
            >
              Clear All ({activeFiltersCount})
            </button>
            <button
              onClick={onClose}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              Apply Filters
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Enhanced Project Form Component
const ProjectForm = ({ formData, setFormData, onCancel, formErrors, userRole, uploadLimits, submitProject }) => {
  const { token, apiConfig, getErrorMessage, handleLogout } = useContext(AdminContext);
  const [state, submitAction, isPending] = useActionState(submitProject, null);
  const [uploadingImages, setUploadingImages] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (state?.success) {
      toast.success(formData._id ? 'Project updated successfully!' : 'Project created successfully!');
      onCancel();
    } else if (state?.errors) {
      if (state.errors.general) {
        toast.error(state.errors.general);
      }
    }
  }, [state, formData._id, onCancel]);

  const handleDeleteImage = useCallback(
    async (publicId) => {
      try {
        await apiRequest(
          'delete',
          `/projects/${formData._id}/images/${encodeURIComponent(publicId)}`,
          null,
          token,
          apiConfig.baseUrl
        );
        setFormData((prev) => ({
          ...prev,
          images: prev.images.filter((img) => img.publicId !== publicId),
        }));
        toast.success('Image deleted successfully!');
        return true;
      } catch (err) {
        console.error('Delete image error:', {
          publicId,
          status: err.response?.status,
          data: err.response?.data,
          message: err.message,
        });
        toast.error(getErrorMessage(err));
        if (err.response?.status === 401) {
          handleLogout();
        }
        return false;
      }
    },
    [token, apiConfig.baseUrl, formData._id, getErrorMessage, handleLogout, setFormData]
  );

  const handleUploadImages = useCallback(
    async () => {
      const files = fileInputRef.current?.files;
      if (!files || files.length === 0) return;
      setUploadingImages(true);
      try {
        const imageFormData = new FormData();
        Array.from(files).forEach((file) => imageFormData.append('images', file));
        const response = await apiRequest('post', `/projects/${formData._id}/images`, imageFormData, token, apiConfig.baseUrl);
        if (response.data?.success) {
          toast.success('Images uploaded successfully!');
          setFormData((prev) => ({
            ...prev,
            images: [...(prev.images || []), ...(response.data.data.images || [])],
          }));
          if (fileInputRef.current) fileInputRef.current.value = '';
        } else {
          throw new Error('Image upload failed');
        }
      } catch (err) {
        console.error('Upload images error:', {
          status: err.response?.status,
          data: err.response?.data,
          message: err.message,
        });
        toast.error(getErrorMessage(err));
        if (err.response?.status === 401) {
          handleLogout();
        }
      } finally {
        setUploadingImages(false);
      }
    },
    [token, apiConfig.baseUrl, formData._id, getErrorMessage, handleLogout, setFormData]
  );

  return (
    <div className="p-8 mt-8 bg-white/95 dark:bg-gray-800/95 border border-gray-200/50 dark:border-gray-700/50 rounded-2xl shadow-xl backdrop-blur-sm">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          {formData._id ? 'Edit Project' : 'Create New Project'}
        </h3>
        <div className="flex items-center gap-2">
          {formData._id && (
            <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-sm rounded-full">
              Editing
            </span>
          )}
        </div>
      </div>

      <form action={submitAction} className="space-y-6">
        {formErrors && Object.keys(formErrors).length > 0 && (
          <div className="text-red-600 dark:text-red-400 text-sm bg-red-50 dark:bg-red-900/20 p-4 rounded-lg border border-red-200 dark:border-red-700" role="alert">
            <div className="font-medium mb-2">Please fix the following errors:</div>
            <ul className="list-disc pl-5 space-y-1">
              {Object.values(formErrors).map((err, idx) => (
                <li key={idx}>{err}</li>
              ))}
            </ul>
          </div>
        )}

        {state?.errors && Object.keys(state.errors).length > 0 && (
          <div className="text-red-600 dark:text-red-400 text-sm bg-red-50 dark:bg-red-900/20 p-4 rounded-lg border border-red-200 dark:border-red-700" role="alert">
            <div className="font-medium mb-2">Please fix the following errors:</div>
            <ul className="list-disc pl-5 space-y-1">
              {Object.values(state.errors).map((err, idx) => (
                <li key={idx}>{err}</li>
              ))}
            </ul>
          </div>
        )}

        <input type="hidden" name="_id" value={formData._id || ''} />

        {/* Basic Information */}
        <div className="bg-gray-50 dark:bg-gray-700/50 p-6 rounded-xl">
          <h4 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">Basic Information</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormInput
              label="Project Title"
              type="text"
              name="title"
              defaultValue={formData.title || ''}
              required
              disabled={isPending || userRole !== 'admin'}
              error={formErrors?.title || state?.errors?.title}
              placeholder="Enter project title..."
            />
            <FormInput
              label="Project Slug (URL-friendly identifier)"
              type="text"
              name="slug"
              defaultValue={formData.slug || ''}
              required
              disabled={isPending || userRole !== 'admin'}
              error={formErrors?.slug || state?.errors?.slug}
              placeholder="my-project-slug (auto-generated from title if empty)"
            />
            <FormSelect
              label="Category"
              name="category"
              defaultValue={formData.category || 'Other'}
              options={[
                { value: 'Frontend', label: 'Frontend' },
                { value: 'Backend', label: 'Backend' },
                { value: 'Full Stack', label: 'Full Stack' },
                { value: 'Mobile', label: 'Mobile' },
                { value: 'AI/ML', label: 'AI/ML' },
                { value: 'Other', label: 'Other' },
              ]}
              disabled={isPending || userRole !== 'admin'}
              required
            />
          </div>

          <div className="mt-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Short Description <span className="text-red-500">*</span>
            </label>
            <textarea
              name="description"
              defaultValue={formData.description || ''}
              required
              rows={3}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 resize-none"
              disabled={isPending || userRole !== 'admin'}
              placeholder="Brief description of the project (1-2 sentences)..."
            />
            {(formErrors?.description || state?.errors?.description) && (
              <p className="text-red-600 dark:text-red-400 text-sm mt-1">
                {formErrors?.description || state?.errors?.description}
              </p>
            )}
          </div>

          <div className="mt-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Detailed Description
            </label>
            <textarea
              name="longDescription"
              defaultValue={formData.longDescription || ''}
              rows={6}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 resize-none"
              disabled={isPending || userRole !== 'admin'}
              placeholder="Detailed project description, features, challenges overcome, etc..."
            />
          </div>
        </div>

        {/* Links and URLs */}
        <div className="bg-gray-50 dark:bg-gray-700/50 p-6 rounded-xl">
          <h4 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">Project Links</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormInput
              label="GitHub Repository"
              type="url"
              name="githubUrl"
              defaultValue={formData.githubUrl || ''}
              disabled={isPending || userRole !== 'admin'}
              error={formErrors?.githubUrl || state?.errors?.githubUrl}
              placeholder="https://github.com/username/repo"
            />
            <FormInput
              label="Live Demo URL"
              type="url"
              name="liveUrl"
              defaultValue={formData.liveUrl || ''}
              disabled={isPending || userRole !== 'admin'}
              error={formErrors?.liveUrl || state?.errors?.liveUrl}
              placeholder="https://your-project.com"
            />
            <FormInput
              label="Demo Video URL"
              type="url"
              name="demoUrl"
              defaultValue={formData.demoUrl || ''}
              disabled={isPending || userRole !== 'admin'}
              error={formErrors?.demoUrl || state?.errors?.demoUrl}
              placeholder="https://youtube.com/watch?v=..."
            />
          </div>
        </div>

        {/* Technical Details */}
        <div className="bg-gray-50 dark:bg-gray-700/50 p-6 rounded-xl">
          <h4 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">Technical Details</h4>
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Technologies Used (comma-separated)
              </label>
              <input
                type="text"
                name="technologies"
                defaultValue={Array.isArray(formData.technologies) ? formData.technologies.join(', ') : formData.technologies || ''}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                disabled={isPending || userRole !== 'admin'}
                placeholder="React, Node.js, MongoDB, TypeScript, Tailwind CSS"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Tags (comma-separated)
              </label>
              <input
                type="text"
                name="tags"
                defaultValue={Array.isArray(formData.tags) ? formData.tags.join(', ') : formData.tags || ''}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                disabled={isPending || userRole !== 'admin'}
                placeholder="web, fullstack, responsive, e-commerce"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Key Features (comma-separated)
              </label>
              <input
                type="text"
                name="features"
                defaultValue={Array.isArray(formData.features) ? formData.features.join(', ') : formData.features || ''}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                disabled={isPending || userRole !== 'admin'}
                placeholder="User authentication, Real-time chat, Payment integration"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Challenges Overcome (comma-separated)
              </label>
              <input
                type="text"
                name="challenges"
                defaultValue={Array.isArray(formData.challenges) ? formData.challenges.join(', ') : formData.challenges || ''}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                disabled={isPending || userRole !== 'admin'}
                placeholder="Performance optimization, Complex state management, API integration"
              />
            </div>

            {/* SEO Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormInput
                label="SEO Meta Title"
                type="text"
                name="seo.metaTitle"
                defaultValue={formData.seo?.metaTitle || ''}
                disabled={isPending || userRole !== 'admin'}
                placeholder="SEO title for the project"
              />
              <FormInput
                label="SEO Meta Description"
                type="text"
                name="seo.metaDescription"
                defaultValue={formData.seo?.metaDescription || ''}
                disabled={isPending || userRole !== 'admin'}
                placeholder="SEO description for the project"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                SEO Keywords (comma-separated)
              </label>
              <input
                type="text"
                name="seo.keywords"
                defaultValue={Array.isArray(formData.seo?.keywords) ? formData.seo.keywords.join(', ') : formData.seo?.keywords || ''}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                disabled={isPending || userRole !== 'admin'}
                placeholder="portfolio, web development, full stack"
              />
            </div>
          </div>
        </div>

        {/* Project Settings */}
        <div className="bg-gray-50 dark:bg-gray-700/50 p-6 rounded-xl">
          <h4 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">Project Settings</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <FormInput
              label="Team Size"
              type="number"
              name="teamSize"
              defaultValue={formData.teamSize || 1}
              disabled={isPending || userRole !== 'admin'}
              min="1"
              max="50"
              error={formErrors?.teamSize || state?.errors?.teamSize}
            />
            <FormInput
              label="Priority (1-10)"
              type="number"
              name="priority"
              defaultValue={formData.priority || 5}
              disabled={isPending || userRole !== 'admin'}
              min="1"
              max="10"
              error={formErrors?.priority || state?.errors?.priority}
            />
            <FormSelect
              label="Status"
              name="status"
              defaultValue={formData.status || 'completed'}
              options={[
                { value: 'planning', label: 'Planning' },
                { value: 'in-progress', label: 'In Progress' },
                { value: 'completed', label: 'Completed' },
                { value: 'on-hold', label: 'On Hold' },
              ]}
              disabled={isPending || userRole !== 'admin'}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
            <FormInput
              label="Start Date"
              type="date"
              name="startDate"
              defaultValue={formData.startDate ? new Date(formData.startDate).toISOString().substr(0, 10) : ''}
              disabled={isPending || userRole !== 'admin'}
            />
            <FormInput
              label="End Date"
              type="date"
              name="endDate"
              defaultValue={formData.endDate ? new Date(formData.endDate).toISOString().substr(0, 10) : ''}
              disabled={isPending || userRole !== 'admin'}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
            <FormInput
              label="My Role"
              type="text"
              name="myRole"
              defaultValue={formData.myRole || ''}
              disabled={isPending || userRole !== 'admin'}
              placeholder="Full Stack Developer, Project Lead, etc."
            />
            <FormSelect
              label="Client Type"
              name="clientType"
              defaultValue={formData.clientType || 'Personal'}
              options={[
                { value: 'Personal', label: 'Personal Project' },
                { value: 'Freelance', label: 'Freelance' },
                { value: 'Company', label: 'Company' },
                { value: 'Open Source', label: 'Open Source' },
                { value: 'Academic', label: 'Academic' },
              ]}
              disabled={isPending || userRole !== 'admin'}
            />
          </div>

          <div className="flex flex-wrap items-center gap-6 mt-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                name="featured"
                defaultChecked={Boolean(formData.featured)}
                className="h-4 w-4 text-indigo-600 rounded focus:ring-indigo-500 transition-colors"
                disabled={isPending || userRole !== 'admin'}
              />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Featured Project</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                name="isArchived"
                defaultChecked={Boolean(formData.isArchived)}
                className="h-4 w-4 text-indigo-600 rounded focus:ring-indigo-500 transition-colors"
                disabled={isPending || userRole !== 'admin'}
              />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Archived</span>
            </label>

            <FormSelect
              label="Visibility"
              name="visibility"
              defaultValue={formData.visibility || 'public'}
              options={[
                { value: 'public', label: 'Public' },
                { value: 'private', label: 'Private' },
                { value: 'unlisted', label: 'Unlisted' },
              ]}
              disabled={isPending || userRole !== 'admin'}
            />
          </div>
        </div>

        {/* Project Images */}
        <div className="bg-gray-50 dark:bg-gray-700/50 p-6 rounded-xl">
          <h4 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">Project Images</h4>

          {formData.images?.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              {formData.images.map((img, idx) => (
                <div key={img.publicId || idx} className="relative group">
                  <img
                    src={img.url}
                    alt={`Project image ${idx + 1}`}
                    className="w-full h-32 object-cover rounded-lg border border-gray-200 dark:border-gray-600"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center rounded-lg">
                    <button
                      type="button"
                      onClick={() => handleDeleteImage(img.publicId)}
                      className="text-white hover:text-red-300 focus:outline-none bg-red-600 hover:bg-red-700 p-2 rounded-full transition-colors"
                      title="Delete image"
                      disabled={isPending || uploadingImages || userRole !== 'admin'}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <input
                type="file"
                name="images"
                multiple
                ref={fileInputRef}
                accept={uploadLimits?.allowedTypes?.join(',') || 'image/*'}
                className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                disabled={isPending || uploadingImages || userRole !== 'admin'}
              />
              {formData._id && (
                <button
                  type="button"
                  onClick={handleUploadImages}
                  className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white py-3 px-6 rounded-lg flex items-center gap-2 transition-colors disabled:cursor-not-allowed font-medium"
                  disabled={isPending || uploadingImages || userRole !== 'admin'}
                >
                  <Upload size={16} />
                  {uploadingImages ? 'Uploading...' : 'Upload'}
                </button>
              )}
            </div>

            {uploadLimits && (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Max size per file: {Math.round(uploadLimits.maxSize / 1024 / 1024)}MB.
                Allowed formats: {uploadLimits.allowedTypes.map(type => type.split('/')[1]).join(', ').toUpperCase()}
              </p>
            )}

            {(formErrors?.images || state?.errors?.images) && (
              <p className="text-red-600 dark:text-red-400 text-sm">
                {formErrors?.images || state?.errors?.images}
              </p>
            )}
          </div>
        </div>

        {/* Form Actions */}
        <div className="flex justify-end gap-4 pt-6 border-t border-gray-200 dark:border-gray-600">
          <button
            type="button"
            onClick={onCancel}
            className="text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 py-3 px-6 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 font-medium"
            disabled={isPending}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 disabled:from-gray-400 disabled:to-gray-500 text-white py-3 px-8 rounded-lg flex items-center gap-2 transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium shadow-lg hover:shadow-xl disabled:cursor-not-allowed"
            disabled={isPending || userRole !== 'admin'}
          >
            {isPending && (
              <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
            )}
            {formData._id ? 'Update Project' : 'Create Project'}
          </button>
        </div>
      </form>
    </div>
  );
};

// Main ProjectsPage Component
const ProjectsPage = () => {
  const {
    projects,
    setProjects,
    totalPages,
    setTotalPages,
    loading,
    setLoading,
    error,
    setError,
    token,
    apiConfig,
    userRole,
    isTokenValid,
    getErrorMessage,
    uploadLimits,
    handleLogout,
    dataLoaded,
  } = useContext(AdminContext);

  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortConfig, setSortConfig] = useState({ key: 'createdAt', direction: 'desc' });
  const [selectedItems, setSelectedItems] = useState([]);
  const [formData, setFormData] = useState(null);
  const [formErrors, setFormErrors] = useState({});
  const [actionLoading, setActionLoading] = useState({});
  const [modal, setModal] = useState({ isOpen: false, message: '', onConfirm: () => { } });
  const [localLoading, setLocalLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'list'

  const isMountedRef = useRef(true);
  const lastFetchRef = useRef({ searchTerm: '', currentPage: 1, timestamp: 0 });
  const fetchTimeoutRef = useRef(null);
  const abortControllerRef = useRef(null);

  const { handleDelete, handleBulkDelete, handlePreview, handleEdit, submitProject } = useProjectOperations({
    setActionLoading,
    setSelectedItems,
    projects,
  });

  const { filters, setFilters, filteredProjects, clearFilters, activeFiltersCount } = useProjectFilters(projects);

  useEffect(() => {
    console.log('Current formData:', formData);
  }, [formData]);

  const fetchData = useCallback(
    async (forceRefresh = false) => {
      if (!forceRefresh && dataLoaded && !projects.length > 0) {
        return;
      }
      if (!token || !isMountedRef.current || !isTokenValid) {
        if (!isTokenValid && isMountedRef.current) {
          setError('Session invalid or expired. Please log in again.');
          handleLogout();
        }
        return;
      }
      const now = Date.now();
      const lastFetch = lastFetchRef.current;
      if (
        !forceRefresh &&
        lastFetch.timestamp > 0 &&
        now - lastFetch.timestamp < 1000
      ) {
        return;
      }
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort('New request started');
      }
      lastFetchRef.current = { timestamp: now };
      const newAbortController = new AbortController();
      abortControllerRef.current = newAbortController;
      if (isMountedRef.current) {
        setLocalLoading(true);
        setError(null);
      }
      try {
        const response = await apiRequest(
          'get',
          '/projects?limit=1000',
          null,
          token,
          apiConfig.baseUrl,
          { signal: newAbortController.signal }
        );
        if (newAbortController.signal.aborted) {
          return;
        }
        if (isMountedRef.current) {
          if (response.data?.success) {
            const projectsData = response.data.data || [];
            setProjects(projectsData);
          } else {
            throw new Error(response.data?.message || 'Invalid response from server');
          }
        }
      } catch (err) {
        if (err.name === 'AbortError' || err.code === 'ERR_CANCELED') {
          return;
        }
        if (isMountedRef.current) {
          if (err.response?.status === 401) {
            setError('Session expired. Please log in again.');
            handleLogout();
            return;
          }
          if (err.response?.status === 429) {
            fetchTimeoutRef.current = setTimeout(() => {
              if (isMountedRef.current) {
                fetchData(forceRefresh);
              }
            }, CONFIG.RETRY_BASE_DELAY_MS);
            return;
          }
          const errorMsg = getErrorMessage(err);
          setError(errorMsg);
          console.error('Error fetching projects:', err);
        }
      } finally {
        if (isMountedRef.current) {
          setLocalLoading(false);
        }
      }
    },
    [token, isTokenValid, apiConfig.baseUrl, handleLogout, getErrorMessage, dataLoaded]
  );

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort('Component unmounting');
      }
    };
  }, []);

  useEffect(() => {
    if (token && isTokenValid) {
      if (!dataLoaded) {
        const timeoutId = setTimeout(() => {
          if (isMountedRef.current) {
            fetchData();
          }
        }, 100);
        return () => clearTimeout(timeoutId);
      }
    }
  }, [token, isTokenValid, dataLoaded, fetchData]);

  const debouncedSearch = useMemo(
    () =>
      debounce((value) => {
        if (isMountedRef.current) {
          setSearchTerm(sanitizeInput(value.trim()));
          setCurrentPage(1);
        }
      }, CONFIG.SEARCH_DEBOUNCE_MS),
    []
  );

  useEffect(() => {
    return () => {
      debouncedSearch.cancel();
    };
  }, [debouncedSearch]);

  const searchedProjects = useMemo(() => {
    if (!searchTerm) return projects;
    const searchLower = searchTerm.toLowerCase();
    return projects.filter((project) => {
      return (
        project.title?.toLowerCase().includes(searchLower) ||
        project.description?.toLowerCase().includes(searchLower) ||
        project.technologies?.some(tech => tech.toLowerCase().includes(searchLower)) ||
        project.tags?.some(tag => tag.toLowerCase().includes(searchLower)) ||
        project.category?.toLowerCase().includes(searchLower)
      );
    });
  }, [projects, searchTerm]);

  const searchedAndFilteredProjects = useMemo(() => {
    return filteredProjects.filter(project => searchedProjects.includes(project));
  }, [searchedProjects, filteredProjects]);

  const sortedProjects = useMemo(() => {
    if (!searchedAndFilteredProjects.length) return [];
    return [...searchedAndFilteredProjects].sort((a, b) => {
      const dir = sortConfig.direction === 'asc' ? 1 : -1;
      const key = sortConfig.key;
      if (key === 'createdAt') {
        return dir * (new Date(a[key]) - new Date(b[key]));
      } else if (key === 'title' || key === 'category' || key === 'status') {
        return dir * (a[key] || '').localeCompare(b[key] || '');
      } else if (key === 'priority') {
        return dir * ((a[key] || 0) - (b[key] || 0));
      } else if (key === 'featured') {
        return dir * ((a[key] ? 1 : 0) - (b[key] ? 1 : 0));
      }
      return 0;
    });
  }, [searchedAndFilteredProjects, sortConfig]);

  const displayedProjects = useMemo(() => {
    const start = (currentPage - 1) * CONFIG.ITEMS_PER_PAGE;
    return sortedProjects.slice(start, start + CONFIG.ITEMS_PER_PAGE);
  }, [sortedProjects, currentPage]);

  useEffect(() => {
    const newTotalPages = Math.ceil(sortedProjects.length / CONFIG.ITEMS_PER_PAGE) || 1;
    setTotalPages((prev) => ({ ...prev, projects: newTotalPages }));
    if (currentPage > newTotalPages) {
      setCurrentPage(1);
    }
  }, [sortedProjects, setTotalPages]);

  const handleSort = useCallback(
    (key) => {
      if (isMountedRef.current) {
        setSortConfig((prev) => ({
          key,
          direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
        }));
        setCurrentPage(1);
      }
    },
    []
  );

  const confirmDelete = useCallback(
    (id) => {
      if (isMountedRef.current) {
        setModal({
          isOpen: true,
          message: 'Are you sure you want to delete this project? This action cannot be undone.',
          onConfirm: async () => {
            const success = await handleDelete(id);
            if (success && isMountedRef.current) {
              setModal({ isOpen: false, message: '', onConfirm: () => { } });
            }
          },
        });
      }
    },
    [handleDelete]
  );

  const confirmBulkDelete = useCallback(() => {
    if (selectedItems.length === 0) return;
    if (isMountedRef.current) {
      setModal({
        isOpen: true,
        message: `Are you sure you want to delete ${selectedItems.length} project(s)? This action cannot be undone.`,
        onConfirm: async () => {
          const success = await handleBulkDelete(selectedItems);
          if (success && isMountedRef.current) {
            setModal({ isOpen: false, message: '', onConfirm: () => { } });
          }
        },
      });
    }
  }, [selectedItems, handleBulkDelete]);

  const handleAddNew = useCallback(() => {
    const newFormData = { ...CONFIG.FORM_DEFAULTS };
    setFormData(newFormData);
    setFormErrors({});
  }, []);

  const handleCancelForm = useCallback(() => {
    setFormData(null);
    setFormErrors({});
    fetchData(true);
  }, [fetchData]);

  const handleSelectAll = useCallback(() => {
    if (selectedItems.length === displayedProjects.length) {
      setSelectedItems([]);
    } else {
      setSelectedItems(displayedProjects.map((p) => p._id));
    }
  }, [selectedItems.length, displayedProjects]);

  const handleBulkAction = useCallback((action) => {
    if (selectedItems.length === 0) return;

    switch (action) {
      case 'delete':
        confirmBulkDelete();
        break;
      case 'feature':
        // TODO: Implement bulk feature toggle
        toast.info('Bulk feature toggle coming soon!');
        break;
      case 'archive':
        // TODO: Implement bulk archive
        toast.info('Bulk archive coming soon!');
        break;
      default:
        break;
    }
  }, [selectedItems, confirmBulkDelete]);

  if (localLoading && !projects.length) {
    return (
      <div className="text-center py-20">
        <div className="inline-flex items-center">
          <div className="animate-spin h-8 w-8 border-4 border-indigo-600 border-t-transparent rounded-full" />
          <span className="ml-4 text-lg text-gray-600 dark:text-gray-300">Loading projects...</span>
        </div>
      </div>
    );
  }

  if (error && !projects.length) {
    return (
      <div className="text-center py-20">
        <div className="max-w-md mx-auto">
          <div className="text-red-500 mb-4">
            <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 18.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
          </div>
          <p className="text-red-600 dark:text-red-400 text-xl mb-4">{error}</p>
          <button
            onClick={() => {
              if (isMountedRef.current) {
                setError(null);
                fetchData(true);
              }
            }}
            className="bg-indigo-600 hover:bg-indigo-700 text-white py-3 px-6 rounded-lg transition-colors flex items-center gap-2 mx-auto font-medium"
            disabled={localLoading}
          >
            <RefreshCw size={16} className={localLoading ? 'animate-spin' : ''} />
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Search and Actions */}
      <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
        <div className="flex-1 max-w-2xl">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search projects by title, description, technology..."
              onChange={(e) => debouncedSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-white/80 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent backdrop-blur-sm"
              disabled={localLoading}
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowFilters(true)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${activeFiltersCount > 0
              ? 'bg-indigo-100 dark:bg-indigo-900 border-indigo-300 dark:border-indigo-600 text-indigo-700 dark:text-indigo-300'
              : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            disabled={localLoading}
          >
            <Filter size={16} />
            Filters
            {activeFiltersCount > 0 && (
              <span className="bg-indigo-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                {activeFiltersCount}
              </span>
            )}
          </button>

          <select
            value={sortConfig.key}
            onChange={(e) => handleSort(e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            disabled={localLoading}
          >
            <option value="createdAt">Date Created</option>
            <option value="title">Title</option>
            <option value="category">Category</option>
            <option value="status">Status</option>
            <option value="priority">Priority</option>
            <option value="featured">Featured</option>
          </select>

          <button
            onClick={() => handleSort(sortConfig.key)}
            className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 p-2 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
            title={`Sort ${sortConfig.direction === 'asc' ? 'descending' : 'ascending'}`}
            disabled={localLoading}
          >
            {sortConfig.direction === 'asc' ? <ArrowUp size={16} /> : <ArrowDown size={16} />}
          </button>

          <button
            onClick={() => fetchData(true)}
            className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 p-2 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
            disabled={localLoading}
            title="Refresh data"
          >
            <RefreshCw size={16} className={localLoading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Bulk Actions */}
      {selectedItems.length > 0 && userRole === 'admin' && (
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-xl border border-indigo-200 dark:border-indigo-700">
          <div className="text-indigo-700 dark:text-indigo-300 font-medium">
            {selectedItems.length} project{selectedItems.length !== 1 ? 's' : ''} selected
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleSelectAll}
              className="text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 text-sm font-medium px-3 py-1 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/30 transition-colors"
              disabled={localLoading}
            >
              {selectedItems.length === displayedProjects.length ? 'Deselect All' : 'Select All'}
            </button>
            <button
              onClick={() => handleBulkAction('feature')}
              className="text-yellow-600 hover:text-yellow-800 dark:text-yellow-400 dark:hover:text-yellow-300 flex items-center gap-1 px-3 py-1 rounded-lg hover:bg-yellow-50 dark:hover:bg-yellow-900/30 transition-colors text-sm font-medium"
              disabled={localLoading}
            >
              <Star size={14} />
              Toggle Featured
            </button>
            <button
              onClick={() => handleBulkAction('archive')}
              className="text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-300 flex items-center gap-1 px-3 py-1 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm font-medium"
              disabled={localLoading}
            >
              <Archive size={14} />
              Archive
            </button>
            <button
              onClick={confirmBulkDelete}
              className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 flex items-center gap-1 px-3 py-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors text-sm font-medium"
              disabled={localLoading}
            >
              <Trash2 size={14} />
              Delete ({selectedItems.length})
            </button>
          </div>
        </div>
      )}

      {/* Stats and Add Button */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <button
          onClick={handleAddNew}
          className="bg-gradient-to-r from-indigo-500 to-blue-500 hover:from-indigo-600 hover:to-blue-600 disabled:from-gray-400 disabled:to-gray-500 text-white py-3 px-6 rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 flex items-center gap-2 font-medium shadow-lg hover:shadow-xl disabled:cursor-not-allowed"
          disabled={localLoading || userRole !== 'admin'}
        >
          <Plus size={18} />
          Add New Project
        </button>

        <div className="text-sm text-gray-600 dark:text-gray-400 bg-white/50 dark:bg-gray-800/50 px-4 py-2 rounded-lg backdrop-blur-sm">
          Showing {displayedProjects.length} of {sortedProjects.length} project{sortedProjects.length !== 1 ? 's' : ''}
          {searchTerm && (
            <span className="ml-2 text-indigo-600 dark:text-indigo-400">
              for "{searchTerm}"
            </span>
          )}
          {activeFiltersCount > 0 && (
            <span className="ml-2 text-indigo-600 dark:text-indigo-400">
              ({activeFiltersCount} filter{activeFiltersCount !== 1 ? 's' : ''} active)
            </span>
          )}
        </div>
      </div>

      {/* Projects Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {displayedProjects.map((project) => (
          <ProjectCard
            key={project._id}
            project={project}
            isSelected={selectedItems.includes(project._id)}
            onSelect={() =>
              setSelectedItems((prev) =>
                prev.includes(project._id) ? prev.filter((id) => id !== project._id) : [...prev, project._id]
              )
            }
            onEdit={() => handleEdit(project, setFormData)}
            onDelete={confirmDelete}
            onPreview={handlePreview}
            actionLoading={actionLoading[project._id]}
            userRole={userRole}
          />
        ))}
      </div>

      {/* Empty State */}
      {displayedProjects.length === 0 && !localLoading && (
        <div className="p-12 text-center bg-white/90 dark:bg-gray-800/90 rounded-2xl border border-gray-200/50 dark:border-gray-700/50">
          <div className="text-gray-400 mb-6">
            <svg className="mx-auto h-16 w-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1}
                d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
              />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
            {searchTerm || activeFiltersCount > 0 ? 'No projects match your criteria' : 'No projects found'}
          </h3>
          <p className="text-gray-500 dark:text-gray-400 mb-6">
            {searchTerm || activeFiltersCount > 0
              ? 'Try adjusting your search terms or filters'
              : 'Get started by creating your first project'}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            {(searchTerm || activeFiltersCount > 0) && (
              <button
                onClick={() => {
                  setSearchTerm('');
                  clearFilters();
                  const searchInput = document.querySelector('input[placeholder*="Search projects"]');
                  if (searchInput) searchInput.value = '';
                }}
                className="text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 font-medium"
              >
                Clear search and filters
              </button>
            )}
            {userRole === 'admin' && (
              <button
                onClick={handleAddNew}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
              >
                Create Your First Project
              </button>
            )}
          </div>
        </div>
      )}

      {/* Loading indicator for additional data */}
      {localLoading && projects.length > 0 && (
        <div className="text-center py-6">
          <div className="inline-flex items-center text-indigo-600 dark:text-indigo-400">
            <div className="animate-spin h-5 w-5 border-2 border-indigo-600 border-t-transparent rounded-full mr-3" />
            <span className="text-sm font-medium">Loading...</span>
          </div>
        </div>
      )}

      {/* Pagination */}
      {totalPages.projects > 1 && (
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mt-8 p-6 bg-white/90 dark:bg-gray-800/90 rounded-2xl border border-gray-200/50 dark:border-gray-700/50">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Showing page {currentPage} of {totalPages.projects}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
              disabled={currentPage === 1 || localLoading}
              className="bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:bg-gray-100 disabled:cursor-not-allowed dark:disabled:bg-gray-800 text-gray-700 dark:text-gray-300 py-2 px-4 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 border border-gray-300 dark:border-gray-600 font-medium"
            >
              Previous
            </button>

            <div className="flex gap-1">
              {Array.from({ length: Math.min(5, totalPages.projects) }, (_, i) => {
                const pageNum = Math.max(1, Math.min(totalPages.projects - 4, currentPage - 2)) + i;
                if (pageNum > totalPages.projects) return null;
                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`py-2 px-3 rounded-lg transition-colors font-medium ${currentPage === pageNum
                      ? 'bg-indigo-600 text-white shadow-lg'
                      : 'bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600'
                      }`}
                    disabled={localLoading}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages.projects))}
              disabled={currentPage >= totalPages.projects || localLoading}
              className="bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:bg-gray-100 disabled:cursor-not-allowed dark:disabled:bg-gray-800 text-gray-700 dark:text-gray-300 py-2 px-4 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 border border-gray-300 dark:border-gray-600 font-medium"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Filter Panel */}
      <FilterPanel
        filters={filters}
        setFilters={setFilters}
        clearFilters={clearFilters}
        activeFiltersCount={activeFiltersCount}
        isOpen={showFilters}
        onClose={() => setShowFilters(false)}
      />

      {/* Project Form Modal */}
      {formData && (
        <ProjectForm
          formData={formData}
          setFormData={setFormData}
          onCancel={handleCancelForm}
          formErrors={formErrors}
          userRole={userRole}
          uploadLimits={uploadLimits}
          submitProject={submitProject}
        />
      )}

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={modal.isOpen}
        message={modal.message}
        onConfirm={modal.onConfirm}
        onCancel={() => setModal({ isOpen: false, message: '', onConfirm: () => { } })}
      />
    </div>
  );
};

export default ProjectsPage;