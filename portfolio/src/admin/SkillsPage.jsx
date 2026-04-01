import React, { useState, useContext, useCallback, useEffect } from 'react';
import { toast } from 'react-toastify';
import { AdminContext } from '../pages/Admin';
import SkillForm from './SkillForm';
import { Plus, Edit2, Trash2, Save, X, Upload, AlertCircle } from 'lucide-react';
import sanitizeHtml from 'sanitize-html';

// Local sanitize function as backup
const localSanitizeInput = (input) =>
  typeof input === 'string'
    ? sanitizeHtml(input, { allowedTags: [], allowedAttributes: {} }).trim()
    : input;

const SkillsPage = () => {
  const {
    skills,
    setSkills,
    loading,
    setLoading,
    error,
    setError,
    token,
    apiConfig,
    uploadLimits,
    getErrorMessage,
    apiRequest,
    sanitizeInput: contextSanitizeInput,
    loadInitialData,
    user,
  } = useContext(AdminContext);

  const sanitizeInput = contextSanitizeInput || localSanitizeInput;

  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [isAdding, setIsAdding] = useState(false);
  const [originalCategory, setOriginalCategory] = useState('');
  const [formData, setFormData] = useState({
    category: '',
    categoryDescription: '',
    skills: [],
    displayOrder: 0,
    isVisible: true,
    iconUrl: '',
    color: '#3B82F6',
  });
  const [files, setFiles] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [debugMode, setDebugMode] = useState(false);

  // Valid categories based on backend enum
  const validCategories = [
    'Frontend', 'Backend', 'Database', 'DevOps', 'Cloud', 'Tools',
    'Languages', 'Frameworks', 'Libraries', 'Mobile', 'Desktop',
    'Design', 'Testing', 'AI/ML', 'Data Science', 'Blockchain',
    'Game Development', 'Security', 'Soft Skills', 'Other'
  ];

  const initializeFormData = useCallback(() => {
    return {
      category: '',
      categoryDescription: '',
      skills: [{
        name: '',
        level: 'Intermediate',
        proficiencyScore: 50,
        yearsOfExperience: 1,
        monthsOfExperience: 0,
        iconUrl: '',
        iconPublicId: '',
        color: '',
        description: '',
        certifications: [],
        projects: [], // Array of project IDs
        lastUsed: new Date(),
        isFavorite: false,
        tags: [],
        learningResources: []
      }],
      displayOrder: 0,
      isVisible: true,
      iconUrl: '',
      color: '#3B82F6',
    };
  }, []);

  const resetForm = useCallback(() => {
    setFormData(initializeFormData());
    setFiles([]);
    setIsEditing(false);
    setEditingId(null);
    setIsAdding(false);
    setOriginalCategory('');
    setError(null);
  }, [initializeFormData, setError]);

  const handleEdit = useCallback((skill) => {
    // skill is now a flat document from backend
    setFormData({
      category: skill.category || '',
      categoryDescription: '',
      skills: [{
        name: skill.name || '',
        level: skill.level
          ? skill.level.charAt(0).toUpperCase() + skill.level.slice(1)
          : 'Intermediate',
        proficiencyScore: skill.proficiency || 50,      // backend field: proficiency
        yearsOfExperience: skill.yearsOfExperience || 0,
        monthsOfExperience: skill.monthsOfExperience || 0,
        iconUrl: skill.icon?.url || '',
        iconPublicId: skill.icon?.publicId || '',
        color: skill.color || '',
        description: skill.description || '',
        certifications: skill.certifications || [],
        projects: skill.projects || [],
        lastUsed: skill.lastUsed ? new Date(skill.lastUsed) : new Date(),
        isFavorite: skill.featured || false,            // backend field: featured
        tags: skill.tags || [],
        learningResources: skill.learningResources || []
      }],
      displayOrder: skill.order || 0,
      isVisible: skill.status === 'active',
      iconUrl: skill.icon?.url || '',
      color: skill.color || '#3B82F6',
    });
    setOriginalCategory(skill.category || '');
    setFiles([]);
    setIsEditing(true);
    setEditingId(skill._id);
    setIsAdding(false);
  }, []);

  const handleAdd = useCallback(() => {
    setFormData(initializeFormData());
    setFiles([]);
    setIsAdding(true);
    setIsEditing(false);
    setEditingId(null);
    setOriginalCategory('');
  }, [initializeFormData]);

  const validateForm = useCallback(() => {
    const errors = [];

    if (!formData.category?.trim()) {
      errors.push('Category name is required');
    }

    // Validate category against enum values
    if (formData.category && !validCategories.includes(formData.category.trim())) {
      errors.push(`Category must be one of: ${validCategories.join(', ')}`);
    }

    // Uniqueness check (case-sensitive since backend uses enum)
const existingCategories = skills
  .filter((s) => s._id !== editingId && s.category !== originalCategory)
  .map((s) => s.category);
if (existingCategories.includes(formData.category)) {
  errors.push('Category name already exists');
}

    if (!Array.isArray(formData.skills) || formData.skills.length === 0) {
      errors.push('At least one skill is required');
    } else {
      formData.skills.forEach((skill, index) => {
        if (!skill.name?.trim()) {
          errors.push(`Skill ${index + 1}: Name is required`);
        }
        if (!skill.level || !['Beginner', 'Intermediate', 'Advanced', 'Expert'].includes(skill.level)) {
          errors.push(`Skill ${index + 1}: Level must be Beginner, Intermediate, Advanced, or Expert`);
        }
        if (typeof skill.proficiencyScore !== 'number' || skill.proficiencyScore < 0 || skill.proficiencyScore > 100) {
          errors.push(`Skill ${index + 1}: Proficiency score must be between 0 and 100`);
        }
        if (typeof skill.yearsOfExperience !== 'number' || skill.yearsOfExperience < 0 || skill.yearsOfExperience > 50) {
          errors.push(`Skill ${index + 1}: Years of experience must be between 0 and 50`);
        }
        if (typeof skill.monthsOfExperience !== 'number' || skill.monthsOfExperience < 0 || skill.monthsOfExperience > 11) {
          errors.push(`Skill ${index + 1}: Months of experience must be between 0 and 11`);
        }
        if (skill.description && skill.description.length > 200) {
          errors.push(`Skill ${index + 1}: Description must be 200 characters or less`);
        }
        if (skill.color && !/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(skill.color)) {
          errors.push(`Skill ${index + 1}: Color must be a valid hex color`);
        }
      });
    }

    if (files.length > formData.skills.length) {
      errors.push('Number of uploaded files exceeds number of skills');
    }

    if (typeof formData.displayOrder !== 'number' || formData.displayOrder < 0) {
      errors.push('Display order must be 0 or greater');
    }

    if (formData.color && !/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(formData.color)) {
      errors.push('Category color must be a valid hex color');
    }

    return errors;
  }, [formData, files, skills, editingId, originalCategory, validCategories]);

  // Debug function to log form data
  const debugFormData = useCallback((data, files) => {
    console.group('🐛 Form Data Debug');
    console.log('Raw Form Data:', data);
    console.log('Files:', files.map(f => f instanceof File ? { name: f.name, size: f.size, type: f.type } : f));
    console.log('Skills:', data.skills);

    const issues = [];
    if (!data.category) issues.push('Missing category');
    if (data.category && !validCategories.map(c => c.toLowerCase()).includes(data.category.toLowerCase())) {
  issues.push('Invalid category');
}
    if (!Array.isArray(data.skills)) issues.push('Skills is not an array');
    if (data.skills?.length === 0) issues.push('No skills provided');

    data.skills?.forEach((skill, index) => {
      if (!skill.name) issues.push(`Skill ${index + 1}: Missing name`);
      if (!['Beginner', 'Intermediate', 'Advanced', 'Expert'].includes(skill.level)) issues.push(`Skill ${index + 1}: Invalid level`);
      if (typeof skill.proficiencyScore !== 'number') issues.push(`Skill ${index + 1}: Invalid proficiencyScore`);
      if (typeof skill.yearsOfExperience !== 'number') issues.push(`Skill ${index + 1}: Invalid yearsOfExperience`);
      if (typeof skill.monthsOfExperience !== 'number') issues.push(`Skill ${index + 1}: Invalid monthsOfExperience`);
    });

    if (issues.length > 0) {
      console.warn('⚠️ Potential Issues:', issues);
    } else {
      console.log('✅ Data looks good');
    }

    console.groupEnd();
  }, [validCategories]);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();

    const validationErrors = validateForm();
    if (validationErrors.length > 0) {
      toast.error(`Validation failed: ${validationErrors.join(', ')}`);
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      // Prepare and sanitize data according to backend schema
      const sanitizedSkills = formData.skills.map((skill, index) => {
        const sanitizedSkill = {
          name: sanitizeInput(skill.name?.trim() || ''),
          level: sanitizeInput(skill.level || 'Intermediate'),
          proficiencyScore: Number(skill.proficiencyScore) || 50,
          yearsOfExperience: Number(skill.yearsOfExperience) || 1,
          monthsOfExperience: Number(skill.monthsOfExperience) || 0,
          iconUrl: sanitizeInput(skill.iconUrl || ''),
          iconPublicId: sanitizeInput(skill.iconPublicId || ''),
          color: sanitizeInput(skill.color || ''),
          description: sanitizeInput(skill.description || ''),
          certifications: Array.isArray(skill.certifications) ? skill.certifications.map(cert => ({
            name: sanitizeInput(cert.name || ''),
            issuer: sanitizeInput(cert.issuer || ''),
            date: cert.date ? new Date(cert.date) : null,
            url: sanitizeInput(cert.url || ''),
            credentialId: sanitizeInput(cert.credentialId || '')
          })) : [],
          projects: Array.isArray(skill.projects) ? skill.projects : [],
          lastUsed: skill.lastUsed ? new Date(skill.lastUsed) : new Date(),
          isFavorite: Boolean(skill.isFavorite),
          tags: Array.isArray(skill.tags) ? skill.tags.map(tag => sanitizeInput(tag)) : [],
          learningResources: Array.isArray(skill.learningResources) ? skill.learningResources.map(resource => ({
            title: sanitizeInput(resource.title || ''),
            url: sanitizeInput(resource.url || ''),
            type: resource.type || 'other'
          })) : []
        };

        // Handle file uploads - the backend will set iconUrl and iconPublicId
        if (files[index] instanceof File) {
          // Remove existing iconUrl and iconPublicId to let backend handle it
          delete sanitizedSkill.iconUrl;
          delete sanitizedSkill.iconPublicId;
        }

        return sanitizedSkill;
      });

      const sanitizedData = {
        category: sanitizeInput(formData.category?.trim() || ''),
        categoryDescription: sanitizeInput(formData.categoryDescription?.trim() || ''),
        displayOrder: parseInt(formData.displayOrder, 10) || 0,
        isVisible: Boolean(formData.isVisible),
        iconUrl: sanitizeInput(formData.iconUrl?.trim() || ''),
        color: sanitizeInput(formData.color || '#3B82F6'),
        skills: sanitizedSkills,
      };

      // Debug data
      if (debugMode) {
        debugFormData(sanitizedData, files);
      }


      const results = await Promise.all(
  sanitizedData.skills.map(async (skill, index) => {
    const formDataToSend = new FormData();
    formDataToSend.append('name', skill.name);
    formDataToSend.append('category', sanitizedData.category);
    formDataToSend.append('level', skill.level);
    formDataToSend.append('proficiency', skill.proficiencyScore);
    formDataToSend.append('yearsOfExperience', skill.yearsOfExperience);
    formDataToSend.append('monthsOfExperience', skill.monthsOfExperience);
    formDataToSend.append('description', skill.description || '');
    formDataToSend.append('color', skill.color || '');
    formDataToSend.append('featured', skill.isFavorite ? 'true' : 'false');
    formDataToSend.append('status', sanitizedData.isVisible ? 'active' : 'inactive');
    formDataToSend.append('order', sanitizedData.displayOrder + index);

    if (files[index] instanceof File) {
      formDataToSend.append('icon', files[index]);
    }

    
const skillId = isEditing && index === 0 ? editingId : null;
const endpoint = skillId ? `/skills/${skillId}` : '/skills';
const method = skillId ? 'PUT' : 'POST';

    return apiRequest(method, endpoint, formDataToSend, token, apiConfig.baseUrl);
  })
);

const response = results[0];

      if (response.data.success) {
        toast.success(isEditing ? 'Skill category updated successfully!' : 'Skill category created successfully!');
        resetForm();
        await loadInitialData(true);
      } else {
        throw new Error(response.data.message || 'Operation failed');
      }
    } catch (err) {
      console.error('❌ Submit error:', err);
      if (err.response) {
        console.group('🔍 Error Response Details');
        console.log('Status:', err.response.status);
        console.log('Status Text:', err.response.statusText);
        console.log('Response Data:', err.response.data);
        console.log('Response Headers:', err.response.headers);
        console.groupEnd();
      }

      const errorMessage = getErrorMessage(err);
      setError(errorMessage);

      let userMessage = errorMessage;
      if (err.response?.status === 400 && err.response.data?.details) {
        userMessage = `Validation error: ${err.response.data.details.join(', ')}`;
      } else if (err.response?.status === 409) {
        userMessage = 'Skill category already exists';
      }
      toast.error(`Failed to ${isEditing ? 'update' : 'create'} skill category: ${userMessage}`);
    } finally {
      setSubmitting(false);
    }
  }, [
    formData,
    files,
    validateForm,
    sanitizeInput,
    isEditing,
    editingId,
    token,
    apiConfig.baseUrl,
    apiRequest,
    getErrorMessage,
    setError,
    resetForm,
    loadInitialData,
    debugMode,
    debugFormData,
  ]);

  const handleDelete = useCallback(async (skillId, categoryName) => {
    if (!window.confirm(`Are you sure you want to delete the "${categoryName}" skill category? This action cannot be undone.`)) {
      return;
    }
    console.log('Token before DELETE request:', token);

    setLoading(true);
    setError(null);

    try {
      const response = await apiRequest(
        'DELETE',
        `/skills/${skillId}`,
        null,
        token,
        apiConfig.baseUrl
      );

      if (response.data.success) {
        toast.success('Skill category deleted successfully!');
        await loadInitialData(true);
      } else {
        throw new Error(response.data.message || 'Delete failed');
      }
    } catch (err) {
      console.error('Delete error:', err);
      const errorMessage = getErrorMessage(err);
      setError(errorMessage);
      toast.error(`Failed to delete skill category: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  }, [token, apiConfig.baseUrl, apiRequest, getErrorMessage, setError, setLoading, loadInitialData]);

  if (loading && !isAdding && !isEditing) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
        <span className="ml-3 text-gray-600 dark:text-gray-400">Loading skills...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
          Skills Management
        </h3>
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setDebugMode(!debugMode)}
            className={`px-3 py-1 rounded text-xs transition-colors ${debugMode
                ? 'bg-yellow-500 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            title="Toggle debug mode for detailed error logging"
          >
            🐛 Debug {debugMode ? 'ON' : 'OFF'}
          </button>

          {!isAdding && !isEditing && (
            <button
              onClick={handleAdd}
              className="bg-indigo-500 hover:bg-indigo-600 text-white py-2 px-4 rounded-lg flex items-center transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
              disabled={loading}
            >
              <Plus size={16} className="mr-2" />
              Add Skill Category
            </button>
          )}
        </div>
      </div>

      {debugMode && (
        <div className="bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-700 rounded-lg p-4">
          <div className="flex items-center">
            <AlertCircle size={16} className="text-yellow-600 dark:text-yellow-400 mr-2" />
            <span className="text-sm text-yellow-800 dark:text-yellow-200">
              Debug mode is active. Check browser console for detailed logs.
            </span>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <p className="text-red-800 dark:text-red-200">{error}</p>
            <button
              onClick={() => setError(null)}
              className="text-red-600 hover:text-red-800 dark:text-red-400"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {(isAdding || isEditing) && (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md border border-gray-200 dark:border-gray-700">
          <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            {isEditing ? 'Edit Skill Category' : 'Add New Skill Category'}
          </h4>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Category Name *
                </label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700"
                  required
                  disabled={submitting}
                >
                  <option value="">Select a category</option>
                  {validCategories.map(category => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Display Order
                </label>
                <input
                  type="number"
                  value={formData.displayOrder}
                  onChange={(e) => setFormData(prev => ({ ...prev, displayOrder: parseInt(e.target.value, 10) || 0 }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700"
                  min="0"
                  disabled={submitting}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Category Color
                </label>
                <input
                  type="color"
                  value={formData.color}
                  onChange={(e) => setFormData(prev => ({ ...prev, color: e.target.value }))}
                  className="w-full h-10 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  disabled={submitting}
                />
              </div>

              <div className="flex items-center">
                <input
                  id="isVisible"
                  type="checkbox"
                  checked={formData.isVisible}
                  onChange={(e) => setFormData(prev => ({ ...prev, isVisible: e.target.checked }))}
                  className="h-4 w-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                  disabled={submitting}
                />
                <label htmlFor="isVisible" className="ml-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                  Visible on portfolio
                </label>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Category Description
              </label>
              <textarea
                value={formData.categoryDescription}
                onChange={(e) => setFormData(prev => ({ ...prev, categoryDescription: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700"
                rows="3"
                maxLength="300"
                placeholder="Brief description of this skill category (max 300 characters)"
                disabled={submitting}
              />
              <div className="text-xs text-gray-500 mt-1">
                {formData.categoryDescription?.length || 0}/300 characters
              </div>
            </div>

            <SkillForm
              skills={formData.skills}
              setSkills={(skills) => setFormData(prev => ({ ...prev, skills }))}
              disabled={submitting}
              files={files}
              setFiles={setFiles}
              uploadLimits={uploadLimits}
            />

            <div className="flex justify-end space-x-4">
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500"
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="bg-indigo-500 hover:bg-indigo-600 text-white py-2 px-4 rounded-lg flex items-center transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-400"
                disabled={submitting}
              >
                {submitting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    {isEditing ? 'Updating...' : 'Creating...'}
                  </>
                ) : (
                  <>
                    <Save size={16} className="mr-2" />
                    {isEditing ? 'Update Category' : 'Create Category'}
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {!isAdding && !isEditing && (
        <div className="space-y-4">
          {skills && skills.length > 0 ? (
            Object.entries(
              skills.reduce((acc, s) => {
                if (!acc[s.category]) acc[s.category] = [];
                acc[s.category].push(s);
                return acc;
              }, {})
            ).map(([categoryName, categorySkills]) => {
              const skillCategory = {
                _id: categorySkills[0]._id,
                category: categoryName,
                skills: categorySkills,
                status: categorySkills[0].status,
                color: categorySkills[0].color,
              };
              return (
                <div
                  key={skillCategory._id || skillCategory.category}
                  className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md border border-gray-200 dark:border-gray-700"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
                          {skillCategory.category}
                        </h4>
                        {skillCategory.color && (
                          <div
                            className="w-4 h-4 rounded-full border border-gray-300"
                            style={{ backgroundColor: skillCategory.color }}
                            title={`Category color: ${skillCategory.color}`}
                          />
                        )}
                        {skillCategory.status !== 'active' && (
                          <span className="px-2 py-1 text-xs bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 rounded">
                            Hidden
                          </span>
                        )}
                      </div>
                      {skillCategory.categoryDescription && (
                        <p className="text-gray-600 dark:text-gray-400 text-sm mb-2">
                          {skillCategory.categoryDescription}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-4 text-sm text-gray-500 dark:text-gray-400">
                        <span>{skillCategory.skills?.length || 0} skills</span>
                        {skillCategory.averageProficiency > 0 && (
                          <span>Avg: {skillCategory.averageProficiency}%</span>
                        )}
                        {skillCategory.totalProjects > 0 && (
                          <span>{skillCategory.totalProjects} projects</span>
                        )}
                        <span>Order: {skillCategory.displayOrder || 0}</span>
                      </div>
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleEdit(categorySkills[0])}
                        className="text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 transition-colors p-1 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        disabled={loading}
                        aria-label={`Edit ${skillCategory.category}`}
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                       onClick={() => handleDelete(skillCategory._id, skillCategory.category)}
                        className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 transition-colors p-1 rounded focus:outline-none focus:ring-2 focus:ring-red-500"
                        disabled={loading}
                        aria-label={`Delete ${skillCategory.category}`}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  {skillCategory.skills && skillCategory.skills.length > 0 && (
                    <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {skillCategory.skills.map((skill, index) => (
                          <div
                            key={`${skillCategory._id}-skill-${index}`}
                            className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded border border-gray-200 dark:border-gray-600"
                          >
                            <div className="flex justify-between items-start mb-1">
                              <h5 className="font-medium text-gray-900 dark:text-white text-sm">
                                {skill.name}
                              </h5>
                              {skill.featured && (
                                <span className="text-xs bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 px-1 py-0.5 rounded">
                                  ⭐ Favorite
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                              <div className="flex justify-between">
                                <span>Level:</span>
                                <span>{skill.level}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Score:</span>
                               <span>{skill.proficiency}%</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Experience:</span>
                                <span>
                                  {skill.yearsOfExperience}y {skill.monthsOfExperience}m
                                </span>
                              </div>
                              {skill.projects && skill.projects.length > 0 && (
                                <div className="flex justify-between">
                                  <span>Projects:</span>
                                  <span>{skill.projects.length}</span>
                                </div>
                              )}
                              {skill.certifications && skill.certifications.length > 0 && (
                                <div className="flex justify-between">
                                  <span>Certifications:</span>
                                  <span>{skill.certifications.length}</span>
                                </div>
                              )}
                              {skill.tags && skill.tags.length > 0 && (
                                <div className="mt-2">
                                  <div className="flex flex-wrap gap-1">
                                    {skill.tags.slice(0, 3).map((tag, tagIndex) => (
                                      <span
                                        key={tagIndex}
                                        className="text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 px-1 py-0.5 rounded"
                                      >
                                        {tag}
                                      </span>
                                    ))}
                                    {skill.tags.length > 3 && (
                                      <span className="text-xs text-gray-500">
                                        +{skill.tags.length - 3} more
                                      </span>
                                    )}
                                  </div>
                                </div>
                              )}
                              {skill.description && (
                                <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                                  {skill.description.length > 50
                                    ? `${skill.description.substring(0, 50)}...`
                                    : skill.description
                                  }
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              
              );
})
          ) : (
            <div className="text-center py-12">
              <div className="text-gray-400 dark:text-gray-500 mb-4">
                <Upload size={48} className="mx-auto mb-2" />
                <p>No skill categories found</p>
                <p className="text-sm">Create your first skill category to get started</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SkillsPage;
