import React, { useState, useEffect, useContext, useCallback } from 'react';
import { AdminContext } from '../pages/Admin';
import { toast } from 'react-toastify';
import { 
  Save, X, Plus, Trash2, Eye, EyeOff, RefreshCw, 
  User, MapPin, Calendar, Code, Heart, Zap, BookOpen, 
  Target, Users, Coffee, Award, Upload, AlertCircle, Info, Image as ImageIcon
} from 'lucide-react';

const ICON_OPTIONS = [
  { value: 'Heart', label: 'Heart', Icon: Heart },
  { value: 'Zap', label: 'Zap', Icon: Zap },
  { value: 'BookOpen', label: 'Book', Icon: BookOpen },
  { value: 'Target', label: 'Target', Icon: Target },
  { value: 'Code', label: 'Code', Icon: Code },
  { value: 'Users', label: 'Users', Icon: Users },
  { value: 'Coffee', label: 'Coffee', Icon: Coffee },
  { value: 'MapPin', label: 'Map Pin', Icon: MapPin },
  { value: 'Calendar', label: 'Calendar', Icon: Calendar },
  { value: 'Award', label: 'Award', Icon: Award }
];

const COLOR_OPTIONS = [
  { value: 'text-blue-600 dark:text-blue-400', label: 'Blue' },
  { value: 'text-green-600 dark:text-green-400', label: 'Green' },
  { value: 'text-purple-600 dark:text-purple-400', label: 'Purple' },
  { value: 'text-red-600 dark:text-red-400', label: 'Red' },
  { value: 'text-yellow-600 dark:text-yellow-400', label: 'Yellow' },
  { value: 'text-indigo-600 dark:text-indigo-400', label: 'Indigo' }
];

const DEFAULT_FORM_DATA = {
  name: '',
  location: '',
  experience: '',
  imageUrl: '',
  imageAlt: '',
  tagline: '',
  mainDescription: '',
  secondaryDescription: '',
  beyondCodeTitle: 'Beyond the Code',
  beyondCodeContent: '',
  stats: [],
  values: [],
  isActive: true
};

const AboutPage = () => {
  const { token, apiConfig, loading, setLoading } = useContext(AdminContext);
  
  const [aboutData, setAboutData] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imagePreview, setImagePreview] = useState(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [formData, setFormData] = useState(DEFAULT_FORM_DATA);

  // Fetch about data on mount
  useEffect(() => {
    fetchAboutData();
  }, []);

  // Track unsaved changes
  useEffect(() => {
    if (aboutData && isEditing) {
      const hasChanges = JSON.stringify(formData) !== JSON.stringify(aboutData);
      setHasUnsavedChanges(hasChanges);
    } else {
      setHasUnsavedChanges(false);
    }
  }, [formData, aboutData, isEditing]);

  // Warn user about unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  const fetchAboutData = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`${apiConfig.baseUrl}/about/admin`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();
      
      if (response.ok && data.success && data.data) {
        setAboutData(data.data);
        setFormData(data.data);
        setImagePreview(data.data.imageUrl);
      } else if (response.status === 404) {
        toast.info('No about content found. Create one to get started.');
        setAboutData(null);
        setFormData(DEFAULT_FORM_DATA);
      } else {
        throw new Error(data.message || 'Failed to fetch about data');
      }
    } catch (error) {
      console.error('Error fetching about data:', error);
      toast.error(error.message || 'Failed to load about data');
    } finally {
      setLoading(false);
    }
  }, [apiConfig.baseUrl, token, setLoading]);

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validation
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Please upload a valid image file (JPEG, PNG, WebP, or GIF)');
      e.target.value = ''; // Reset input
      return;
    }

    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      toast.error(`Image size must be less than 5MB (current: ${(file.size / 1024 / 1024).toFixed(2)}MB)`);
      e.target.value = '';
      return;
    }

    setUploadingImage(true);

    try {
      const formDataUpload = new FormData();
      formDataUpload.append('file', file); // Changed from 'image' to 'file' to match backend

      const response = await fetch(`${apiConfig.baseUrl}/about/admin/upload-image`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formDataUpload
      });

      const data = await response.json();

      if (response.ok && data.success) {
        toast.success('Image uploaded successfully');
        setFormData(prev => ({
          ...prev,
          imageUrl: data.data.fullUrl,
          imageAlt: prev.imageAlt || `Profile photo - ${data.data.originalName}`
        }));
        setImagePreview(data.data.fullUrl);
      } else {
        throw new Error(data.message || 'Failed to upload image');
      }
    } catch (error) {
      console.error('Image upload error:', error);
      toast.error(error.message || 'Failed to upload image');
    } finally {
      setUploadingImage(false);
      e.target.value = ''; // Reset input
    }
  };

const handleImageRemove = async () => {
  if (!formData.imageUrl) return;

  if (!formData.imageUrl.includes('cloudinary.com')) {
    setFormData(prev => ({ ...prev, imageUrl: '', imageAlt: '' }));
    setImagePreview(null);
    toast.success('Image URL cleared');
    return;
  }

  let publicId;
  try {
    const afterUpload = formData.imageUrl.split('/upload/')[1];
    const withoutVersion = afterUpload.replace(/^v\d+\//, '');
    publicId = withoutVersion.replace(/\.[^.]+$/, '');
  } catch {
    toast.error('Could not determine image identifier');
    return;
  }

  try {
    const response = await fetch(
      `${apiConfig.baseUrl}/about/admin/image/${encodeURIComponent(publicId)}`,
      {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      }
    );
    const data = await response.json();
    if (response.ok && data.success) {
      toast.success('Image removed successfully');
      setFormData(prev => ({ ...prev, imageUrl: '', imageAlt: '' }));
      setImagePreview(null);
    } else {
      throw new Error(data.message || 'Failed to remove image');
    }
  } catch (error) {
    console.error('Image remove error:', error);
    toast.error(error.message || 'Failed to remove image');
  }
};

  const validateForm = () => {
    const errors = [];

    if (!formData.name?.trim()) errors.push('Name is required');
    if (!formData.location?.trim()) errors.push('Location is required');
    if (!formData.experience?.trim()) errors.push('Experience is required');
    if (!formData.tagline?.trim()) errors.push('Tagline is required');
    if (!formData.mainDescription?.trim()) errors.push('Main description is required');

    // Validate stats
    formData.stats.forEach((stat, index) => {
      if (!stat.label?.trim()) errors.push(`Stat ${index + 1}: Label is required`);
      if (!stat.value?.trim()) errors.push(`Stat ${index + 1}: Value is required`);
    });

    // Validate values
    formData.values.forEach((value, index) => {
      if (!value.title?.trim()) errors.push(`Value ${index + 1}: Title is required`);
      if (!value.description?.trim()) errors.push(`Value ${index + 1}: Description is required`);
    });

    if (errors.length > 0) {
      errors.forEach(error => toast.error(error));
      return false;
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    setLoading(true);

    try {
      const url = aboutData 
        ? `${apiConfig.baseUrl}/about/admin/${aboutData._id}`
        : `${apiConfig.baseUrl}/about/admin`;
      
      const method = aboutData ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      const data = await response.json();
      
      if (response.ok && data.success) {
        toast.success(data.message || 'About data saved successfully');
        setAboutData(data.data);
        setIsEditing(false);
        setHasUnsavedChanges(false);
        await fetchAboutData();
      } else {
        throw new Error(data.message || 'Failed to save about data');
      }
    } catch (error) {
      console.error('Error saving about data:', error);
      toast.error(error.message || 'Failed to save about data');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async () => {
    if (!aboutData?._id) return;
    
    if (!window.confirm(`Are you sure you want to ${aboutData.isActive ? 'deactivate' : 'activate'} this content?`)) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${apiConfig.baseUrl}/about/admin/${aboutData._id}/toggle`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();
      
      if (response.ok && data.success) {
        toast.success(data.message || 'Status updated successfully');
        await fetchAboutData();
      } else {
        throw new Error(data.message || 'Failed to toggle status');
      }
    } catch (error) {
      console.error('Error toggling status:', error);
      toast.error(error.message || 'Failed to toggle status');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    if (hasUnsavedChanges) {
      if (!window.confirm('You have unsaved changes. Are you sure you want to cancel?')) {
        return;
      }
    }

    setIsEditing(false);
    if (aboutData) {
      setFormData(aboutData);
      setImagePreview(aboutData.imageUrl);
    } else {
      setFormData(DEFAULT_FORM_DATA);
      setImagePreview(null);
    }
    setHasUnsavedChanges(false);
  };

  const addStat = () => {
    if (formData.stats.length >= 6) {
      toast.warning('Maximum 6 stats allowed');
      return;
    }
    setFormData(prev => ({
      ...prev,
      stats: [...prev.stats, {
        icon: 'MapPin',
        label: '',
        value: '',
        color: COLOR_OPTIONS[0].value,
        order: prev.stats.length
      }]
    }));
  };

  const removeStat = (index) => {
    if (!window.confirm('Are you sure you want to remove this stat?')) return;
    
    setFormData(prev => ({
      ...prev,
      stats: prev.stats.filter((_, i) => i !== index).map((stat, i) => ({
        ...stat,
        order: i
      }))
    }));
  };

  const updateStat = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      stats: prev.stats.map((stat, i) => 
        i === index ? { ...stat, [field]: value } : stat
      )
    }));
  };

  const addValue = () => {
    if (formData.values.length >= 8) {
      toast.warning('Maximum 8 values allowed');
      return;
    }
    setFormData(prev => ({
      ...prev,
      values: [...prev.values, {
        icon: 'Heart',
        title: '',
        description: '',
        order: prev.values.length
      }]
    }));
  };

  const removeValue = (index) => {
    if (!window.confirm('Are you sure you want to remove this value?')) return;
    
    setFormData(prev => ({
      ...prev,
      values: prev.values.filter((_, i) => i !== index).map((val, i) => ({
        ...val,
        order: i
      }))
    }));
  };

  const updateValue = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      values: prev.values.map((val, i) => 
        i === index ? { ...val, [field]: value } : val
      )
    }));
  };

  if (loading && !aboutData && !isEditing) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
        <span className="ml-3 text-gray-600 dark:text-gray-400">Loading about data...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h3 className="text-2xl font-bold text-gray-900 dark:text-white">About Section Management</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Manage your about page content and information
          </p>
          {hasUnsavedChanges && (
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-1 flex items-center">
              <AlertCircle size={12} className="mr-1" />
              You have unsaved changes
            </p>
          )}
        </div>
        <div className="flex gap-2">
          {aboutData && (
            <button
              onClick={handleToggleStatus}
              disabled={loading}
              className={`flex items-center px-4 py-2 rounded-lg transition-colors ${
                aboutData.isActive
                  ? 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400'
              }`}
            >
              {aboutData.isActive ? <Eye size={16} /> : <EyeOff size={16} />}
              <span className="ml-2">{aboutData.isActive ? 'Active' : 'Inactive'}</span>
            </button>
          )}
          {!isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              <User size={16} />
              <span className="ml-2">Edit</span>
            </button>
          )}
          <button
            onClick={fetchAboutData}
            disabled={loading}
            className="flex items-center px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {!aboutData && !isEditing && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6 text-center">
          <Info className="w-12 h-12 text-blue-600 dark:text-blue-400 mx-auto mb-3" />
          <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No About Content Found</h4>
          <p className="text-gray-600 dark:text-gray-400 mb-4">Get started by creating your about section content</p>
          <button
            onClick={() => setIsEditing(true)}
            className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Create About Content
          </button>
        </div>
      )}

      {/* Form */}
      {(isEditing || aboutData) && (
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Information */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
            <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Basic Information</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  disabled={!isEditing}
                  required
                  maxLength={100}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-white disabled:bg-gray-100 dark:disabled:bg-gray-900"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Location *
                </label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                  disabled={!isEditing}
                  required
                  maxLength={100}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-white disabled:bg-gray-100 dark:disabled:bg-gray-900"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Experience *
                </label>
                <input
                  type="text"
                  value={formData.experience}
                  onChange={(e) => setFormData(prev => ({ ...prev, experience: e.target.value }))}
                  disabled={!isEditing}
                  required
                  maxLength={50}
                  placeholder="e.g., 0.5 Years"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-white disabled:bg-gray-100 dark:disabled:bg-gray-900"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Profile Image
                </label>
                
                {/* Image Preview */}
                <div className="mb-4">
                  {(formData.imageUrl || imagePreview) ? (
                    <div className="relative inline-block">
                      <img
                        src={imagePreview || formData.imageUrl}
                        alt={formData.imageAlt || 'Profile preview'}
                        onError={(e) => {
                          e.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="128" height="128"%3E%3Crect fill="%23ddd" width="128" height="128"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em" fill="%23999" font-size="14"%3EImage Error%3C/text%3E%3C/svg%3E';
                        }}
                        className="w-32 h-32 object-cover rounded-lg border-2 border-gray-300 dark:border-gray-600"
                      />
                      {isEditing && formData.imageUrl && (
                        <button
                          type="button"
                          onClick={handleImageRemove}
                          className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                          title="Remove image"
                        >
                          <X size={16} />
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="w-32 h-32 bg-gray-100 dark:bg-gray-700 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 flex items-center justify-center">
                      <ImageIcon size={32} className="text-gray-400" />
                    </div>
                  )}
                </div>

                {/* Upload Controls */}
                {isEditing && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <label className={`flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 cursor-pointer transition-colors ${uploadingImage ? 'opacity-50 cursor-not-allowed' : ''}`}>
                        {uploadingImage ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                            Uploading...
                          </>
                        ) : (
                          <>
                            <Upload size={16} className="mr-2" />
                            Upload Image
                          </>
                        )}
                        <input
                          type="file"
                          accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
                          onChange={handleImageUpload}
                          disabled={uploadingImage}
                          className="hidden"
                        />
                      </label>
                      
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        JPEG, PNG, WebP, GIF (max 5MB)
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Or enter image URL manually:</p>
                      <input
                        type="url"
                        value={formData.imageUrl}
                        onChange={(e) => {
                          setFormData(prev => ({ ...prev, imageUrl: e.target.value }));
                          setImagePreview(e.target.value);
                        }}
                        placeholder="https://example.com/image.jpg"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-white"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Image Alt Text
                </label>
                <input
                  type="text"
                  value={formData.imageAlt}
                  onChange={(e) => setFormData(prev => ({ ...prev, imageAlt: e.target.value }))}
                  disabled={!isEditing}
                  maxLength={200}
                  placeholder="Professional headshot description for accessibility"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-white disabled:bg-gray-100 dark:disabled:bg-gray-900"
                />
              </div>
            </div>
          </div>

          {/* Descriptions */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
            <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Descriptions</h4>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Tagline * <span className="text-xs text-gray-500">(max 200 chars)</span>
                </label>
                <input
                  type="text"
                  value={formData.tagline}
                  onChange={(e) => setFormData(prev => ({ ...prev, tagline: e.target.value }))}
                  disabled={!isEditing}
                  required
                  maxLength={200}
                  placeholder="Passionate full-stack developer..."
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-white disabled:bg-gray-100 dark:disabled:bg-gray-900"
                />
                <p className="text-xs text-gray-500 mt-1">{formData.tagline?.length || 0}/200</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Main Description * <span className="text-xs text-gray-500">(max 1000 chars)</span>
                </label>
                <textarea
                  value={formData.mainDescription}
                  onChange={(e) => setFormData(prev => ({ ...prev, mainDescription: e.target.value }))}
                  disabled={!isEditing}
                  required
                  maxLength={1000}
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-white disabled:bg-gray-100 dark:disabled:bg-gray-900"
                />
                <p className="text-xs text-gray-500 mt-1">{formData.mainDescription?.length || 0}/1000</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Secondary Description <span className="text-xs text-gray-500">(max 500 chars)</span>
                </label>
                <textarea
                  value={formData.secondaryDescription}
                  onChange={(e) => setFormData(prev => ({ ...prev, secondaryDescription: e.target.value }))}
                  disabled={!isEditing}
                  maxLength={500}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-white disabled:bg-gray-100 dark:disabled:bg-gray-900"
                />
                <p className="text-xs text-gray-500 mt-1">{formData.secondaryDescription?.length || 0}/500</p>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="flex justify-between items-center mb-4">
              <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
                Stats <span className="text-sm font-normal text-gray-500">(max 6)</span>
              </h4>
              {isEditing && formData.stats.length < 6 && (
                <button
                  type="button"
                  onClick={addStat}
                  className="flex items-center px-3 py-1 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm"
                >
                  <Plus size={14} className="mr-1" /> Add Stat
                </button>
              )}
            </div>
            <div className="space-y-4">
              {formData.stats.map((stat, index) => (
                <div key={index} className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Icon</label>
                      <select
                        value={stat.icon}
                        onChange={(e) => updateStat(index, 'icon', e.target.value)}
                        disabled={!isEditing}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-white disabled:bg-gray-100 dark:disabled:bg-gray-800"
                      >
                        {ICON_OPTIONS.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Label *</label>
                      <input
                        type="text"
                        value={stat.label}
                        onChange={(e) => updateStat(index, 'label', e.target.value)}
                        disabled={!isEditing}
                        required
                        maxLength={50}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-white disabled:bg-gray-100 dark:disabled:bg-gray-800"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Value *</label>
                      <input
                        type="text"
                        value={stat.value}
                        onChange={(e) => updateStat(index, 'value', e.target.value)}
                        disabled={!isEditing}
                        required
                        maxLength={100}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-white disabled:bg-gray-100 dark:disabled:bg-gray-800"
                      />
                    </div>
                    <div className="flex items-end gap-2">
                      <div className="flex-1">
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Color</label>
                        <select
                          value={stat.color}
                          onChange={(e) => updateStat(index, 'color', e.target.value)}
                          disabled={!isEditing}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-white disabled:bg-gray-100 dark:disabled:bg-gray-800"
                        >
                          {COLOR_OPTIONS.map(color => (
                            <option key={color.value} value={color.value}>{color.label}</option>
                          ))}
                        </select>
                      </div>
                      {isEditing && (
                        <button
                          type="button"
                          onClick={() => removeStat(index)}
                          className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400"
                          title="Remove stat"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {formData.stats.length === 0 && (
                <p className="text-center text-gray-500 dark:text-gray-400 py-4">
                  No stats added yet. Click "Add Stat" to get started.
                </p>
              )}
            </div>
          </div>

          {/* Values */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="flex justify-between items-center mb-4">
              <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
                Values <span className="text-sm font-normal text-gray-500">(max 8)</span>
              </h4>
              {isEditing && formData.values.length < 8 && (
                <button
                  type="button"
                  onClick={addValue}
                  className="flex items-center px-3 py-1 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm"
                >
                  <Plus size={14} className="mr-1" /> Add Value
                </button>
              )}
            </div>
            <div className="space-y-4">
              {formData.values.map((value, index) => (
                <div key={index} className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Icon</label>
                      <select
                        value={value.icon}
                        onChange={(e) => updateValue(index, 'icon', e.target.value)}
                        disabled={!isEditing}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-white disabled:bg-gray-100 dark:disabled:bg-gray-800"
                      >
                        {ICON_OPTIONS.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Title *</label>
                      <input
                        type="text"
                        value={value.title}
                        onChange={(e) => updateValue(index, 'title', e.target.value)}
                        disabled={!isEditing}
                        required
                        maxLength={50}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-white disabled:bg-gray-100 dark:disabled:bg-gray-800"
                      />
                    </div>
                    <div className="flex items-end gap-2">
                      {isEditing && (
                        <button
                          type="button"
                          onClick={() => removeValue(index)}
                          className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 ml-auto"
                          title="Remove value"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                    <div className="md:col-span-3">
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Description *</label>
                      <textarea
                        value={value.description}
                        onChange={(e) => updateValue(index, 'description', e.target.value)}
                        disabled={!isEditing}
                        required
                        maxLength={200}
                        rows={2}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-white disabled:bg-gray-100 dark:disabled:bg-gray-800"
                      />
                      <p className="text-xs text-gray-500 mt-1">{value.description?.length || 0}/200</p>
                    </div>
                  </div>
                </div>
              ))}
              {formData.values.length === 0 && (
                <p className="text-center text-gray-500 dark:text-gray-400 py-4">
                  No values added yet. Click "Add Value" to get started.
                </p>
              )}
            </div>
          </div>

          {/* Beyond Code Section */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
            <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Beyond the Code</h4>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Section Title <span className="text-xs text-gray-500">(max 100 chars)</span>
                </label>
                <input
                  type="text"
                  value={formData.beyondCodeTitle}
                  onChange={(e) => setFormData(prev => ({ ...prev, beyondCodeTitle: e.target.value }))}
                  disabled={!isEditing}
                  maxLength={100}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-white disabled:bg-gray-100 dark:disabled:bg-gray-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Content <span className="text-xs text-gray-500">(max 500 chars)</span>
                </label>
                <textarea
                  value={formData.beyondCodeContent}
                  onChange={(e) => setFormData(prev => ({ ...prev, beyondCodeContent: e.target.value }))}
                  disabled={!isEditing}
                  maxLength={500}
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-white disabled:bg-gray-100 dark:disabled:bg-gray-900"
                />
                <p className="text-xs text-gray-500 mt-1">{formData.beyondCodeContent?.length || 0}/500</p>
              </div>
            </div>
          </div>

          {/* Submit Buttons */}
          {isEditing && (
            <div className="flex justify-end gap-3 sticky bottom-4 bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700 shadow-lg">
              <button
                type="button"
                onClick={handleCancel}
                disabled={loading}
                className="px-6 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || uploadingImage}
                className="flex items-center px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Saving...
                  </>
                ) : (
                  <>
                    <Save size={16} className="mr-2" />
                    Save Changes
                  </>
                )}
              </button>
            </div>
          )}
        </form>
      )}
    </div>
  );
};

export default AboutPage;