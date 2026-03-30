import React, { useState, useEffect, useContext } from 'react';
import { Upload, Save, Trash2, User, Mail, Github, Linkedin, Twitter, Globe, Image, FileText, Plus, X, AlertCircle } from 'lucide-react';
import { AdminContext } from '../pages/Admin';
import { toast } from 'react-toastify';

const ProfileManagement = () => {
  const { token, apiRequest, apiConfig } = useContext(AdminContext);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadingResume, setUploadingResume] = useState(false);
  
  const [profile, setProfile] = useState({
    firstName: '',
    lastName: '',
    title: '',
    bio: '',
    profileImage: { url: '', filename: '' },
    resume: { url: '', filename: '' },
    socialLinks: {
      github: '',
      linkedin: '',
      email: '',
      twitter: '',
      website: ''
    },
    features: [
      { icon: 'Code', title: 'MERN Stack', description: 'Full stack development' },
      { icon: 'Rocket', title: 'Scalability', description: 'Building scalable apps' },
      { icon: 'Shield', title: 'Security', description: 'Secure coding practices' }
    ],
    metaTitle: '',
    metaDescription: ''
  });

  const [imageFile, setImageFile] = useState(null);
  const [resumeFile, setResumeFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const response = await apiRequest('get', '/profile', null, token, apiConfig.baseUrl);

      if (response.data?.success) {
        const profileData = response.data.data;
        
        // Ensure all required fields exist with defaults
        setProfile({
          firstName: profileData.firstName || '',
          lastName: profileData.lastName || '',
          title: profileData.title || '',
          bio: profileData.bio || '',
          profileImage: profileData.profileImage || { url: '', filename: '' },
          resume: profileData.resume || { url: '', filename: '' },
          socialLinks: {
            github: profileData.socialLinks?.github || '',
            linkedin: profileData.socialLinks?.linkedin || '',
            email: profileData.socialLinks?.email || '',
            twitter: profileData.socialLinks?.twitter || '',
            website: profileData.socialLinks?.website || ''
          },
          features: profileData.features && profileData.features.length > 0 
            ? profileData.features 
            : [
                { icon: 'Code', title: 'MERN Stack', description: 'Full stack development' },
                { icon: 'Rocket', title: 'Scalability', description: 'Building scalable apps' },
                { icon: 'Shield', title: 'Security', description: 'Secure coding practices' }
              ],
          metaTitle: profileData.metaTitle || '',
          metaDescription: profileData.metaDescription || ''
        });

        if (profileData.profileImage?.url) {
          setImagePreview(profileData.profileImage.url);
        }
      }
    } catch (error) {
      console.error('Load profile error:', error);
      toast.error(error.response?.data?.message || 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field, value) => {
    setProfile(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSocialLinkChange = (platform, value) => {
    setProfile(prev => ({
      ...prev,
      socialLinks: {
        ...prev.socialLinks,
        [platform]: value
      }
    }));
  };

  const handleFeatureChange = (index, field, value) => {
    const newFeatures = [...profile.features];
    newFeatures[index] = { ...newFeatures[index], [field]: value };
    setProfile(prev => ({ ...prev, features: newFeatures }));
  };

  const addFeature = () => {
    setProfile(prev => ({
      ...prev,
      features: [...prev.features, { icon: 'Code', title: '', description: '' }]
    }));
  };

  const removeFeature = (index) => {
    if (profile.features.length <= 1) {
      toast.error('You must have at least one feature');
      return;
    }
    setProfile(prev => ({
      ...prev,
      features: prev.features.filter((_, i) => i !== index)
    }));
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
      if (!allowedTypes.includes(file.type)) {
        toast.error('Only JPG, PNG, GIF, and WebP images are allowed');
        e.target.value = '';
        return;
      }

      // Validate file size (5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Image size must be less than 5MB');
        e.target.value = '';
        return;
      }

      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleResumeChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file type
      const allowedTypes = [
        'application/pdf', 
        'application/msword', 
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      ];
      
      if (!allowedTypes.includes(file.type)) {
        toast.error('Only PDF, DOC, and DOCX files are allowed');
        e.target.value = '';
        return;
      }

      // Validate file size (10MB)
      if (file.size > 10 * 1024 * 1024) {
        toast.error('Resume size must be less than 10MB');
        e.target.value = '';
        return;
      }

      setResumeFile(file);
      toast.success('Resume selected: ' + file.name);
    }
  };

  const uploadImage = async () => {
    if (!imageFile) return false;

    try {
      setUploadingImage(true);
      const formData = new FormData();
      formData.append('file', imageFile);

      const response = await apiRequest('post', '/profile/image', formData, token, apiConfig.baseUrl);

      if (response.data?.success) {
        toast.success('Profile image uploaded successfully');
        setProfile(prev => ({
          ...prev,
          profileImage: response.data.data.profileImage
        }));
        setImageFile(null);
        setImagePreview(response.data.data.profileImage.url);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Upload image error:', error);
      toast.error(error.response?.data?.message || 'Failed to upload image');
      return false;
    } finally {
      setUploadingImage(false);
    }
  };

  const uploadResume = async () => {
    if (!resumeFile) return false;

    try {
      setUploadingResume(true);
      const formData = new FormData();
      formData.append('file', resumeFile);

      const response = await apiRequest('post', '/profile/resume', formData, token, apiConfig.baseUrl);

      if (response.data?.success) {
        toast.success('Resume uploaded successfully');
        setProfile(prev => ({
          ...prev,
          resume: response.data.data.resume
        }));
        setResumeFile(null);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Upload resume error:', error);
      toast.error(error.response?.data?.message || 'Failed to upload resume');
      return false;
    } finally {
      setUploadingResume(false);
    }
  };

  const validateProfile = () => {
    // Validate required fields
    if (!profile.firstName?.trim()) {
      toast.error('First name is required');
      return false;
    }
    if (!profile.lastName?.trim()) {
      toast.error('Last name is required');
      return false;
    }
    if (!profile.title?.trim()) {
      toast.error('Title is required');
      return false;
    }
    if (!profile.bio?.trim()) {
      toast.error('Bio is required');
      return false;
    }

    // Validate bio length
    if (profile.bio.length > 500) {
      toast.error('Bio must be less than 500 characters');
      return false;
    }

    // Validate features
    if (profile.features.length === 0) {
      toast.error('At least one feature is required');
      return false;
    }

    for (let i = 0; i < profile.features.length; i++) {
      const feature = profile.features[i];
      if (!feature.icon?.trim()) {
        toast.error(`Feature ${i + 1}: Icon is required`);
        return false;
      }
      if (!feature.title?.trim()) {
        toast.error(`Feature ${i + 1}: Title is required`);
        return false;
      }
      if (!feature.description?.trim()) {
        toast.error(`Feature ${i + 1}: Description is required`);
        return false;
      }
    }

    // Validate email format if provided
    if (profile.socialLinks.email && profile.socialLinks.email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(profile.socialLinks.email)) {
        toast.error('Please enter a valid email address');
        return false;
      }
    }

    // Validate URLs if provided
    const urlFields = ['github', 'linkedin', 'twitter', 'website'];
    for (const field of urlFields) {
      const value = profile.socialLinks[field];
      if (value && value.trim()) {
        try {
          new URL(value);
        } catch {
          toast.error(`Please enter a valid URL for ${field}`);
          return false;
        }
      }
    }

    return true;
  };

  const handleSaveProfile = async () => {
    // Validate profile data
    if (!validateProfile()) {
      return;
    }

    setSaving(true);

    try {
      // Upload files first if they exist
      if (imageFile) {
        const imageSuccess = await uploadImage();
        if (!imageSuccess) {
          setSaving(false);
          return;
        }
      }

      if (resumeFile) {
        const resumeSuccess = await uploadResume();
        if (!resumeSuccess) {
          setSaving(false);
          return;
        }
      }

      // Prepare payload
      const payload = {
        firstName: profile.firstName.trim(),
        lastName: profile.lastName.trim(),
        title: profile.title.trim(),
        bio: profile.bio.trim(),
        socialLinks: {
          github: profile.socialLinks.github?.trim() || '',
          linkedin: profile.socialLinks.linkedin?.trim() || '',
          email: profile.socialLinks.email?.trim() || '',
          twitter: profile.socialLinks.twitter?.trim() || '',
          website: profile.socialLinks.website?.trim() || ''
        },
        features: profile.features.map(({ icon, title, description }) => ({
          icon: icon.trim(),
          title: title.trim(),
          description: description.trim()
        })),
        metaTitle: profile.metaTitle?.trim() || '',
        metaDescription: profile.metaDescription?.trim() || '',
        isPublished: true
      };

      console.log('Sending PUT /profile payload:', JSON.stringify(payload, null, 2));

      const response = await apiRequest('put', '/profile', payload, token, apiConfig.baseUrl);

      if (response.data?.success) {
        toast.success('Profile updated successfully');
        await loadProfile();
      }
    } catch (error) {
      console.error('Save profile error:', error);
      toast.error(error.response?.data?.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const deleteImage = async () => {
    if (!window.confirm('Are you sure you want to delete the profile image?')) return;

    try {
      const response = await apiRequest('delete', '/profile/image', null, token, apiConfig.baseUrl);
      
      if (response.data?.success) {
        toast.success('Profile image deleted successfully');
        setProfile(prev => ({ ...prev, profileImage: { url: '', filename: '' } }));
        setImagePreview('');
        setImageFile(null);
      }
    } catch (error) {
      console.error('Delete image error:', error);
      toast.error(error.response?.data?.message || 'Failed to delete image');
    }
  };

  const deleteResume = async () => {
    if (!window.confirm('Are you sure you want to delete the resume?')) return;

    try {
      const response = await apiRequest('delete', '/profile/resume', null, token, apiConfig.baseUrl);
      
      if (response.data?.success) {
        toast.success('Resume deleted successfully');
        setProfile(prev => ({ ...prev, resume: { url: '', filename: '' } }));
        setResumeFile(null);
      }
    } catch (error) {
      console.error('Delete resume error:', error);
      toast.error(error.response?.data?.message || 'Failed to delete resume');
    }
  };

  const iconOptions = ['Code', 'Rocket', 'Shield', 'Palette', 'Globe', 'User', 'Mail', 'Heart', 'Star', 'Zap'];

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 md:p-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">
            Profile Management
          </h2>
          <button
            onClick={handleSaveProfile}
            disabled={saving || uploadingImage || uploadingResume}
            className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-indigo-500 to-blue-500 text-white rounded-lg hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
          >
            <Save size={18} className="mr-2" />
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>

        {/* Basic Information */}
        <div className="mb-8">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
            <User size={20} className="mr-2" />
            Basic Information
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                First Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={profile.firstName}
                onChange={(e) => handleInputChange('firstName', e.target.value)}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="John"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Last Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={profile.lastName}
                onChange={(e) => handleInputChange('lastName', e.target.value)}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="Doe"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={profile.title}
                onChange={(e) => handleInputChange('title', e.target.value)}
                placeholder="e.g., Full Stack Developer"
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Bio <span className="text-red-500">*</span>
              </label>
              <textarea
                value={profile.bio}
                onChange={(e) => handleInputChange('bio', e.target.value)}
                rows={4}
                maxLength={500}
                placeholder="Tell us about yourself..."
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {profile.bio?.length || 0}/500 characters
              </p>
            </div>
          </div>
        </div>

        {/* Profile Image */}
        <div className="mb-8">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
            <Image size={20} className="mr-2" />
            Profile Image
          </h3>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            {imagePreview && (
              <img 
                src={imagePreview} 
                alt="Profile Preview" 
                className="w-24 h-24 rounded-full object-cover border-4 border-gray-200 dark:border-gray-600 shadow-lg" 
              />
            )}
            <div className="flex-1 w-full">
              <div className="flex flex-wrap gap-2">
                <input
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                  onChange={handleImageChange}
                  className="hidden"
                  id="profile-image"
                />
                <label 
                  htmlFor="profile-image" 
                  className="inline-flex items-center px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg cursor-pointer hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                >
                  <Upload size={16} className="mr-2" />
                  Choose Image
                </label>
                
                {imageFile && (
                  <button
                    onClick={uploadImage}
                    disabled={uploadingImage}
                    className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 flex items-center"
                  >
                    {uploadingImage ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload size={16} className="mr-2" />
                        Upload Now
                      </>
                    )}
                  </button>
                )}
                
                {profile.profileImage?.url && !imageFile && (
                  <button 
                    onClick={deleteImage} 
                    className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors flex items-center"
                  >
                    <Trash2 size={16} className="mr-2" />
                    Delete
                  </button>
                )}
              </div>
              {imageFile && (
                <p className="text-sm text-green-600 dark:text-green-400 mt-2 flex items-center">
                  <AlertCircle size={14} className="mr-1" />
                  Selected: {imageFile.name}
                </p>
              )}
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                Max size: 5MB • Formats: JPG, PNG, GIF, WebP
              </p>
            </div>
          </div>
        </div>

        {/* Resume */}
        <div className="mb-8">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
            <FileText size={20} className="mr-2" />
            Resume
          </h3>
          <div className="flex flex-col sm:flex-row items-start gap-4">
            <div className="flex-1 w-full">
              <div className="flex flex-wrap gap-2">
                {profile.resume?.url && !resumeFile && (
                  <a 
                    href={profile.resume.url} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors inline-flex items-center"
                  >
                    <FileText size={16} className="mr-2" />
                    {profile.resume.filename || 'View Resume'}
                  </a>
                )}
                
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  onChange={handleResumeChange}
                  className="hidden"
                  id="resume-file"
                />
                <label 
                  htmlFor="resume-file" 
                  className="inline-flex items-center px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg cursor-pointer hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                >
                  <Upload size={16} className="mr-2" />
                  Choose Resume
                </label>
                
                {resumeFile && (
                  <button
                    onClick={uploadResume}
                    disabled={uploadingResume}
                    className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 flex items-center"
                  >
                    {uploadingResume ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload size={16} className="mr-2" />
                        Upload Now
                      </>
                    )}
                  </button>
                )}
                
                {profile.resume?.url && !resumeFile && (
                  <button 
                    onClick={deleteResume} 
                    className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors flex items-center"
                  >
                    <Trash2 size={16} className="mr-2" />
                    Delete
                  </button>
                )}
              </div>
              {resumeFile && (
                <p className="text-sm text-green-600 dark:text-green-400 mt-2 flex items-center">
                  <AlertCircle size={14} className="mr-1" />
                  Selected: {resumeFile.name}
                </p>
              )}
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                Max size: 10MB • Formats: PDF, DOC, DOCX
              </p>
            </div>
          </div>
        </div>

        {/* Social Links */}
        <div className="mb-8">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Social Links
          </h3>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Github size={20} className="text-gray-600 dark:text-gray-400 flex-shrink-0" />
              <input
                type="url"
                placeholder="https://github.com/username"
                value={profile.socialLinks.github || ''}
                onChange={(e) => handleSocialLinkChange('github', e.target.value)}
                className="flex-1 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
            <div className="flex items-center gap-2">
              <Linkedin size={20} className="text-gray-600 dark:text-gray-400 flex-shrink-0" />
              <input
                type="url"
                placeholder="https://linkedin.com/in/username"
                value={profile.socialLinks.linkedin || ''}
                onChange={(e) => handleSocialLinkChange('linkedin', e.target.value)}
                className="flex-1 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
            <div className="flex items-center gap-2">
              <Mail size={20} className="text-gray-600 dark:text-gray-400 flex-shrink-0" />
              <input
                type="email"
                placeholder="your.email@example.com"
                value={profile.socialLinks.email || ''}
                onChange={(e) => handleSocialLinkChange('email', e.target.value)}
                className="flex-1 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
            <div className="flex items-center gap-2">
              <Twitter size={20} className="text-gray-600 dark:text-gray-400 flex-shrink-0" />
              <input
                type="url"
                placeholder="https://twitter.com/username"
                value={profile.socialLinks.twitter || ''}
                onChange={(e) => handleSocialLinkChange('twitter', e.target.value)}
                className="flex-1 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
            <div className="flex items-center gap-2">
              <Globe size={20} className="text-gray-600 dark:text-gray-400 flex-shrink-0" />
              <input
                type="url"
                placeholder="https://yourwebsite.com"
                value={profile.socialLinks.website || ''}
                onChange={(e) => handleSocialLinkChange('website', e.target.value)}
                className="flex-1 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>

        {/* Features/Highlights */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
              Features/Highlights
            </h3>
            <button 
              onClick={addFeature} 
              className="px-3 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors flex items-center text-sm"
            >
              <Plus size={16} className="mr-1" />
              Add Feature
            </button>
          </div>
          <div className="space-y-4">
            {profile.features.map((feature, index) => (
              <div key={index} className="flex flex-col sm:flex-row items-start gap-2 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <select
                  value={feature.icon}
                  onChange={(e) => handleFeatureChange(index, 'icon', e.target.value)}
                  className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 w-full sm:w-auto"
                >
                  {iconOptions.map(icon => (
                    <option key={icon} value={icon}>{icon}</option>
                  ))}
                </select>
                <div className="flex-1 w-full space-y-2">
                  <input
                    type="text"
                    placeholder="Feature title (e.g., MERN Stack)"
                    value={feature.title || ''}
                    onChange={(e) => handleFeatureChange(index, 'title', e.target.value)}
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                  <input
                    type="text"
                    placeholder="Feature description (e.g., Full stack development)"
                    value={feature.description || ''}
                    onChange={(e) => handleFeatureChange(index, 'description', e.target.value)}
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
                <button 
                  onClick={() => removeFeature(index)} 
                  className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors flex-shrink-0"
                  title="Remove feature"
                >
                  <X size={20} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* SEO Meta Information (Optional) */}
        <div className="mb-8">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            SEO Meta Information (Optional)
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Meta Title
              </label>
              <input
                type="text"
                value={profile.metaTitle || ''}
                onChange={(e) => handleInputChange('metaTitle', e.target.value)}
                placeholder="SEO title for your profile page"
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Meta Description
              </label>
              <textarea
                value={profile.metaDescription || ''}
                onChange={(e) => handleInputChange('metaDescription', e.target.value)}
                rows={2}
                placeholder="SEO description for your profile page"
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>

        {/* Save Button (Bottom) */}
        <div className="flex justify-end pt-6 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={handleSaveProfile}
            disabled={saving || uploadingImage || uploadingResume}
            className="w-full sm:w-auto px-8 py-3 bg-gradient-to-r from-indigo-500 to-blue-500 text-white rounded-lg hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center font-medium"
          >
            <Save size={18} className="mr-2" />
            {saving ? 'Saving Changes...' : 'Save All Changes'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProfileManagement;