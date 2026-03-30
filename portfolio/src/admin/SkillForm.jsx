import React, { useState, useCallback } from 'react';
import { Plus, Trash2, Upload, X, Calendar, Link, Award, BookOpen } from 'lucide-react';
import PropTypes from 'prop-types';

const SkillForm = ({ skills, setSkills, disabled, files, setFiles, uploadLimits }) => {
  const [expandedSkills, setExpandedSkills] = useState(new Set());

  const toggleExpanded = useCallback((index) => {
    setExpandedSkills(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  }, []);

  const addSkill = useCallback(() => {
    const newSkill = {
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
      projects: [],
      lastUsed: new Date(),
      isFavorite: false,
      tags: [],
      learningResources: []
    };
    setSkills([...skills, newSkill]);
  }, [skills, setSkills]);

  const removeSkill = useCallback((index) => {
    if (skills.length > 1) {
      const newSkills = skills.filter((_, i) => i !== index);
      setSkills(newSkills);
      
      // Remove corresponding file if exists
      if (files[index]) {
        const newFiles = files.filter((_, i) => i !== index);
        setFiles(newFiles);
      }
      
      // Update expanded state
      setExpandedSkills(prev => {
        const newSet = new Set();
        prev.forEach(expandedIndex => {
          if (expandedIndex < index) {
            newSet.add(expandedIndex);
          } else if (expandedIndex > index) {
            newSet.add(expandedIndex - 1);
          }
        });
        return newSet;
      });
    }
  }, [skills, setSkills, files, setFiles]);

  const updateSkill = useCallback((index, field, value) => {
    const newSkills = [...skills];
    
    if (field.includes('.')) {
      // Handle nested fields like 'certifications.0.name'
      const [parentField, childIndex, childField] = field.split('.');
      if (!newSkills[index][parentField]) {
        newSkills[index][parentField] = [];
      }
      if (!newSkills[index][parentField][parseInt(childIndex)]) {
        newSkills[index][parentField][parseInt(childIndex)] = {};
      }
      newSkills[index][parentField][parseInt(childIndex)][childField] = value;
    } else {
      newSkills[index][field] = value;
    }
    
    setSkills(newSkills);
  }, [skills, setSkills]);

  const handleFileChange = useCallback((index, event) => {
    const file = event.target.files[0];
    if (file) {
      // Validate file
      if (file.size > uploadLimits.maxSize) {
        alert(`File size must be less than ${uploadLimits.maxSize / 1024 / 1024}MB`);
        return;
      }
      
      if (!uploadLimits.allowedTypes.includes(file.type)) {
        alert(`File type must be one of: ${uploadLimits.allowedTypes.join(', ')}`);
        return;
      }
      
      const newFiles = [...files];
      newFiles[index] = file;
      setFiles(newFiles);
      
      // Update skill to indicate file will be uploaded
      updateSkill(index, 'iconUrl', ''); // Clear existing URL since we're uploading new file
      updateSkill(index, 'iconPublicId', '');
    }
  }, [files, setFiles, uploadLimits, updateSkill]);

  const removeFile = useCallback((index) => {
    const newFiles = [...files];
    newFiles[index] = null;
    setFiles(newFiles);
  }, [files, setFiles]);

  // Certification management
  const addCertification = useCallback((skillIndex) => {
    const newCertification = {
      name: '',
      issuer: '',
      date: null,
      url: '',
      credentialId: ''
    };
    
    const newSkills = [...skills];
    if (!newSkills[skillIndex].certifications) {
      newSkills[skillIndex].certifications = [];
    }
    newSkills[skillIndex].certifications.push(newCertification);
    setSkills(newSkills);
  }, [skills, setSkills]);

  const removeCertification = useCallback((skillIndex, certIndex) => {
    const newSkills = [...skills];
    newSkills[skillIndex].certifications = newSkills[skillIndex].certifications.filter((_, i) => i !== certIndex);
    setSkills(newSkills);
  }, [skills, setSkills]);

  // Learning resource management
  const addLearningResource = useCallback((skillIndex) => {
    const newResource = {
      title: '',
      url: '',
      type: 'other'
    };
    
    const newSkills = [...skills];
    if (!newSkills[skillIndex].learningResources) {
      newSkills[skillIndex].learningResources = [];
    }
    newSkills[skillIndex].learningResources.push(newResource);
    setSkills(newSkills);
  }, [skills, setSkills]);

  const removeLearningResource = useCallback((skillIndex, resourceIndex) => {
    const newSkills = [...skills];
    newSkills[skillIndex].learningResources = newSkills[skillIndex].learningResources.filter((_, i) => i !== resourceIndex);
    setSkills(newSkills);
  }, [skills, setSkills]);

  // Tag management
  const addTag = useCallback((skillIndex, tag) => {
    if (!tag.trim()) return;
    
    const newSkills = [...skills];
    if (!newSkills[skillIndex].tags) {
      newSkills[skillIndex].tags = [];
    }
    
    if (!newSkills[skillIndex].tags.includes(tag.trim())) {
      newSkills[skillIndex].tags.push(tag.trim());
      setSkills(newSkills);
    }
  }, [skills, setSkills]);

  const removeTag = useCallback((skillIndex, tagIndex) => {
    const newSkills = [...skills];
    newSkills[skillIndex].tags = newSkills[skillIndex].tags.filter((_, i) => i !== tagIndex);
    setSkills(newSkills);
  }, [skills, setSkills]);

  const resourceTypes = [
    'course', 'book', 'article', 'video', 'documentation', 'tutorial', 'other'
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h5 className="text-lg font-medium text-gray-900 dark:text-white">
          Skills ({skills.length})
        </h5>
        <button
          type="button"
          onClick={addSkill}
          className="bg-green-500 hover:bg-green-600 text-white py-1 px-3 rounded text-sm flex items-center transition-colors focus:outline-none focus:ring-2 focus:ring-green-500"
          disabled={disabled}
        >
          <Plus size={14} className="mr-1" />
          Add Skill
        </button>
      </div>

      {skills.map((skill, index) => (
        <div
          key={index}
          className="border border-gray-300 dark:border-gray-600 rounded-lg p-4 bg-gray-50 dark:bg-gray-700/50"
        >
          <div className="flex justify-between items-start mb-4">
            <h6 className="text-md font-medium text-gray-900 dark:text-white">
              Skill #{index + 1} {skill.name && `- ${skill.name}`}
            </h6>
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => toggleExpanded(index)}
                className="text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 text-sm"
                disabled={disabled}
              >
                {expandedSkills.has(index) ? 'Collapse' : 'Expand'}
              </button>
              {skills.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeSkill(index)}
                  className="text-red-600 hover:text-red-800 dark:text-red-400 transition-colors p-1 rounded focus:outline-none focus:ring-2 focus:ring-red-500"
                  disabled={disabled}
                  aria-label={`Remove skill ${index + 1}`}
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          </div>

          {/* Basic Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Skill Name *
              </label>
              <input
                type="text"
                value={skill.name}
                onChange={(e) => updateSkill(index, 'name', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700"
                placeholder="e.g., React, Node.js, Python"
                disabled={disabled}
                required
                maxLength={100}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Level *
              </label>
              <select
                value={skill.level}
                onChange={(e) => updateSkill(index, 'level', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700"
                disabled={disabled}
                required
              >
                <option value="Beginner">Beginner</option>
                <option value="Intermediate">Intermediate</option>
                <option value="Advanced">Advanced</option>
                <option value="Expert">Expert</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Proficiency Score (0-100) *
              </label>
              <input
                type="number"
                value={skill.proficiencyScore}
                onChange={(e) => updateSkill(index, 'proficiencyScore', parseInt(e.target.value, 10) || 0)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700"
                min="0"
                max="100"
                disabled={disabled}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Years of Experience *
              </label>
              <input
                type="number"
                value={skill.yearsOfExperience}
                onChange={(e) => updateSkill(index, 'yearsOfExperience', parseInt(e.target.value, 10) || 0)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700"
                min="0"
                max="50"
                disabled={disabled}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Months of Experience (0-11)
              </label>
              <input
                type="number"
                value={skill.monthsOfExperience}
                onChange={(e) => updateSkill(index, 'monthsOfExperience', parseInt(e.target.value, 10) || 0)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700"
                min="0"
                max="11"
                disabled={disabled}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Color
              </label>
              <input
                type="color"
                value={skill.color || '#3B82F6'}
                onChange={(e) => updateSkill(index, 'color', e.target.value)}
                className="w-full h-10 border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500"
                disabled={disabled}
              />
            </div>
          </div>

          {/* Icon Upload */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Skill Icon
            </label>
            <div className="flex items-center space-x-4">
              <div className="flex-1">
                <input
                  type="file"
                  onChange={(e) => handleFileChange(index, e)}
                  accept={uploadLimits.allowedTypes.join(',')}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700"
                  disabled={disabled}
                />
                <div className="text-xs text-gray-500 mt-1">
                  Max size: {uploadLimits.maxSize / 1024 / 1024}MB. Formats: {uploadLimits.allowedTypes.join(', ')}
                </div>
              </div>
              {files[index] && (
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-green-600 dark:text-green-400">
                    {files[index].name}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeFile(index)}
                    className="text-red-600 hover:text-red-800 dark:text-red-400"
                    disabled={disabled}
                  >
                    <X size={14} />
                  </button>
                </div>
              )}
              {skill.iconUrl && !files[index] && (
                <div className="text-sm text-blue-600 dark:text-blue-400">
                  Current icon: {skill.iconUrl.split('/').pop()}
                </div>
              )}
            </div>
          </div>

          {/* Favorite and Description */}
          <div className="mb-4">
            <div className="flex items-center mb-3">
              <input
                id={`favorite-${index}`}
                type="checkbox"
                checked={skill.isFavorite || false}
                onChange={(e) => updateSkill(index, 'isFavorite', e.target.checked)}
                className="h-4 w-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                disabled={disabled}
              />
              <label htmlFor={`favorite-${index}`} className="ml-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                Mark as favorite skill
              </label>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Description
              </label>
              <textarea
                value={skill.description || ''}
                onChange={(e) => updateSkill(index, 'description', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700"
                rows="2"
                maxLength="200"
                placeholder="Brief description of your experience with this skill"
                disabled={disabled}
              />
              <div className="text-xs text-gray-500 mt-1">
                {(skill.description || '').length}/200 characters
              </div>
            </div>
          </div>

          {/* Tags */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Tags
            </label>
            <div className="flex flex-wrap gap-2 mb-2">
              {(skill.tags || []).map((tag, tagIndex) => (
                <span
                  key={tagIndex}
                  className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => removeTag(index, tagIndex)}
                    className="ml-1 text-blue-600 hover:text-blue-800 dark:text-blue-300"
                    disabled={disabled}
                  >
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex">
              <input
                type="text"
                placeholder="Add a tag and press Enter"
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-l focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700"
                disabled={disabled}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addTag(index, e.target.value);
                    e.target.value = '';
                  }
                }}
              />
              <button
                type="button"
                onClick={(e) => {
                  const input = e.target.previousElementSibling;
                  addTag(index, input.value);
                  input.value = '';
                }}
                className="px-3 py-2 bg-indigo-500 text-white rounded-r hover:bg-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                disabled={disabled}
              >
                Add
              </button>
            </div>
          </div>

          {/* Expanded sections */}
          {expandedSkills.has(index) && (
            <div className="space-y-6 mt-6 pt-6 border-t border-gray-200 dark:border-gray-600">
              {/* Certifications */}
              <div>
                <div className="flex justify-between items-center mb-3">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    <Award size={16} className="inline mr-1" />
                    Certifications
                  </label>
                  <button
                    type="button"
                    onClick={() => addCertification(index)}
                    className="text-sm text-indigo-600 hover:text-indigo-800 dark:text-indigo-400"
                    disabled={disabled}
                  >
                    <Plus size={14} className="inline mr-1" />
                    Add Certification
                  </button>
                </div>
                
                {(skill.certifications || []).map((cert, certIndex) => (
                  <div key={certIndex} className="border border-gray-200 dark:border-gray-600 rounded p-3 mb-3">
                    <div className="flex justify-between items-start mb-3">
                      <h6 className="text-sm font-medium text-gray-900 dark:text-white">
                        Certification #{certIndex + 1}
                      </h6>
                      <button
                        type="button"
                        onClick={() => removeCertification(index, certIndex)}
                        className="text-red-600 hover:text-red-800 dark:text-red-400"
                        disabled={disabled}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <input
                        type="text"
                        value={cert.name || ''}
                        onChange={(e) => updateSkill(index, `certifications.${certIndex}.name`, e.target.value)}
                        placeholder="Certification name"
                        className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700"
                        disabled={disabled}
                      />
                      <input
                        type="text"
                        value={cert.issuer || ''}
                        onChange={(e) => updateSkill(index, `certifications.${certIndex}.issuer`, e.target.value)}
                        placeholder="Issuing organization"
                        className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700"
                        disabled={disabled}
                      />
                      <input
                        type="date"
                        value={cert.date ? new Date(cert.date).toISOString().split('T')[0] : ''}
                        onChange={(e) => updateSkill(index, `certifications.${certIndex}.date`, e.target.value ? new Date(e.target.value) : null)}
                        className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700"
                        disabled={disabled}
                      />
                      <input
                        type="text"
                        value={cert.credentialId || ''}
                        onChange={(e) => updateSkill(index, `certifications.${certIndex}.credentialId`, e.target.value)}
                        placeholder="Credential ID"
                        className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700"
                        disabled={disabled}
                      />
                      <input
                        type="url"
                        value={cert.url || ''}
                        onChange={(e) => updateSkill(index, `certifications.${certIndex}.url`, e.target.value)}
                        placeholder="Certificate URL"
                        className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 md:col-span-2"
                        disabled={disabled}
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Learning Resources */}
              <div>
                <div className="flex justify-between items-center mb-3">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    <BookOpen size={16} className="inline mr-1" />
                    Learning Resources
                  </label>
                  <button
                    type="button"
                    onClick={() => addLearningResource(index)}
                    className="text-sm text-indigo-600 hover:text-indigo-800 dark:text-indigo-400"
                    disabled={disabled}
                  >
                    <Plus size={14} className="inline mr-1" />
                    Add Resource
                  </button>
                </div>
                
                {(skill.learningResources || []).map((resource, resourceIndex) => (
                  <div key={resourceIndex} className="border border-gray-200 dark:border-gray-600 rounded p-3 mb-3">
                    <div className="flex justify-between items-start mb-3">
                      <h6 className="text-sm font-medium text-gray-900 dark:text-white">
                        Resource #{resourceIndex + 1}
                      </h6>
                      <button
                        type="button"
                        onClick={() => removeLearningResource(index, resourceIndex)}
                        className="text-red-600 hover:text-red-800 dark:text-red-400"
                        disabled={disabled}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <input
                        type="text"
                        value={resource.title || ''}
                        onChange={(e) => updateSkill(index, `learningResources.${resourceIndex}.title`, e.target.value)}
                        placeholder="Resource title"
                        className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700"
                        disabled={disabled}
                      />
                      <select
                        value={resource.type || 'other'}
                        onChange={(e) => updateSkill(index, `learningResources.${resourceIndex}.type`, e.target.value)}
                        className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700"
                        disabled={disabled}
                      >
                        {resourceTypes.map(type => (
                          <option key={type} value={type}>
                            {type.charAt(0).toUpperCase() + type.slice(1)}
                          </option>
                        ))}
                      </select>
                      <input
                        type="url"
                        value={resource.url || ''}
                        onChange={(e) => updateSkill(index, `learningResources.${resourceIndex}.url`, e.target.value)}
                        placeholder="Resource URL"
                        className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700"
                        disabled={disabled}
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Last Used Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  <Calendar size={16} className="inline mr-1" />
                  Last Used Date
                </label>
                <input
                  type="date"
                  value={skill.lastUsed ? new Date(skill.lastUsed).toISOString().split('T')[0] : ''}
                  onChange={(e) => updateSkill(index, 'lastUsed', e.target.value ? new Date(e.target.value) : new Date())}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700"
                  disabled={disabled}
                />
              </div>
            </div>
          )}
        </div>
      ))}

      {skills.length === 0 && (
        <div className="text-center py-8 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg">
          <Upload size={48} className="mx-auto mb-4 text-gray-400" />
          <p className="text-gray-500 dark:text-gray-400 mb-4">No skills added yet</p>
          <button
            type="button"
            onClick={addSkill}
            className="bg-indigo-500 hover:bg-indigo-600 text-white py-2 px-4 rounded-lg flex items-center mx-auto transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
            disabled={disabled}
          >
            <Plus size={16} className="mr-2" />
            Add Your First Skill
          </button>
        </div>
      )}
    </div>
  );
};

SkillForm.propTypes = {
  skills: PropTypes.arrayOf(
    PropTypes.shape({
      name: PropTypes.string,
      level: PropTypes.string,
      proficiencyScore: PropTypes.number,
      yearsOfExperience: PropTypes.number,
      monthsOfExperience: PropTypes.number,
      iconUrl: PropTypes.string,
      iconPublicId: PropTypes.string,
      color: PropTypes.string,
      description: PropTypes.string,
      certifications: PropTypes.array,
      projects: PropTypes.array,
      lastUsed: PropTypes.oneOfType([PropTypes.string, PropTypes.instanceOf(Date)]),
      isFavorite: PropTypes.bool,
      tags: PropTypes.array,
      learningResources: PropTypes.array,
    })
  ).isRequired,
  setSkills: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
  files: PropTypes.array.isRequired,
  setFiles: PropTypes.func.isRequired,
  uploadLimits: PropTypes.shape({
    maxSize: PropTypes.number,
    allowedTypes: PropTypes.array,
  }).isRequired,
};

SkillForm.defaultProps = {
  disabled: false,
};

export default SkillForm;