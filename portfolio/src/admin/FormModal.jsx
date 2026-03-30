// src/components/admin/FormModal.jsx
import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { Upload, Eye, X } from 'lucide-react';
import Button from '../ui/Button';
import Card from '../ui/Card';
import AnimatedSection from '../ui/AnimatedSection';
import FormInput from '../ui/FormInput';
import FormSelect from '../ui/FormSelect';
import SkillForm from '../ui/SkillForm';
import * as api from '../../services/api';

const FormModal = ({ formData, setFormData, file, setFile, activeTab, token, loading }) => {
  const [imagePreview, setImagePreview] = useState(null);

  useEffect(() => {
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setImagePreview(reader.result);
      reader.readAsDataURL(file);
    } else {
      setImagePreview(null);
    }
  }, [file]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!api.validateForm(formData, activeTab)) return;
    try {
      let imagePublicId = formData.imagePublicId || formData.companyLogoPublicId || formData.skills?.[0]?.iconPublicId;
      if (file) {
        const uploadFormData = new FormData();
        uploadFormData.append('image', file);
        const endpoint = activeTab === 'projects' ? 'project-image' : activeTab === 'experiences' ? 'company-logo' : 'skill-icon';
        const uploadRes = await api.uploadImage(uploadFormData, endpoint, token);
        imagePublicId = uploadRes.data.publicId;
      }

      const payload = { ...formData };
      if (activeTab === 'projects') payload.imagePublicId = imagePublicId;
      if (activeTab === 'experiences') payload.companyLogoPublicId = imagePublicId;
      if (activeTab === 'skills') {
        payload.skills = payload.skills.map((s) => ({ ...s, iconPublicId: imagePublicId || s.iconPublicId }));
      }
      if (activeTab === 'contacts') {
        await api.replyContact(formData._id, formData.replyMessage, token);
        setFormData(null);
        toast.success('Reply sent successfully!', { position: 'top-right' });
        return;
      }

      const response = await (formData._id
        ? api.updateItem(activeTab, formData._id, payload, token)
        : api.createItem(activeTab, payload, token));

      setFormData(null);
      setFile(null);
      toast.success(`${activeTab.slice(0, -1)} saved successfully!`, { position: 'top-right' });
    } catch (err) {
      const error = err.response?.data?.message || `Failed to save ${activeTab.slice(0, -1)}`;
      toast.error(error, { position: 'top-right' });
    }
  };

  return (
    <AnimatedSection>
      <Card className="p-8 mt-8 bg-white/90 dark:bg-gray-800/90">
        <h3 className="text-2xl font-semibold text-gray-900 dark:text-white mb-6">
          {formData._id && activeTab !== 'contacts' ? `Edit ${activeTab.slice(0, -1)}` : `Add New ${activeTab.slice(0, -1)}`}
          {activeTab === 'contacts' && 'Reply to Contact'}
        </h3>
        <form onSubmit={handleSubmit} className="space-y-6">
          {activeTab === 'contacts' && (
            <>
              <FormInput
                label="Reply Message"
                type="text"
                value={formData.replyMessage || ''}
                onChange={(e) => setFormData({ ...formData, replyMessage: e.target.value })}
                required
                disabled={loading}
              />
            </>
          )}
          {activeTab === 'projects' && (
            <>
              <FormInput
                label="Title"
                type="text"
                value={formData.title || ''}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                required
                disabled={loading}
              />
              <FormInput
                label="Description"
                type="textarea"
                value={formData.description || ''}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                required
                disabled={loading}
                rows={4}
              />
              <FormSelect
                label="Category"
                value={formData.category || 'Other'}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                options={['Frontend', 'Backend', 'Full Stack', 'Mobile', 'AI/ML', 'IoT', 'Blockchain', 'Other']}
                disabled={loading}
              />
              <FormInput
                label="Technologies (comma-separated)"
                type="text"
                value={formData.technologies?.join(', ') || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    technologies: e.target.value.split(',').map((t) => t.trim()).filter((t) => t),
                  })
                }
                disabled={loading}
              />
              <FormInput
                label="Image"
                type="file"
                accept="image/*"
                onChange={(e) => setFile(e.target.files[0])}
                disabled={loading}
              />
            </>
          )}
          {activeTab === 'skills' && (
            <>
              <FormInput
                label="Category"
                type="text"
                value={formData.category || ''}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                required
                disabled={loading}
              />
              <SkillForm
                skills={formData.skills || []}
                setSkills={(skills) => setFormData({ ...formData, skills })}
                disabled={loading}
                file={file}
                setFile={setFile}
              />
            </>
          )}
          {activeTab === 'experiences' && (
            <>
              <FormInput
                label="Company"
                type="text"
                value={formData.company || ''}
                onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                required
                disabled={loading}
              />
              <FormInput
                label="Position"
                type="text"
                value={formData.position || ''}
                onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                required
                disabled={loading}
              />
              <FormInput
                label="Start Date"
                type="date"
                value={formData.startDate ? formData.startDate.split('T')[0] : ''}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                required
                disabled={loading}
              />
              <FormInput
                label="Company Logo"
                type="file"
                accept="image/*"
                onChange={(e) => setFile(e.target.files[0])}
                disabled={loading}
              />
            </>
          )}
          {imagePreview && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Image Preview</label>
              <img src={imagePreview} alt="Preview" className="max-w-xs rounded-lg" />
            </div>
          )}
          <div className="flex justify-end gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setFormData(null);
                setFile(null);
              }}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => api.previewItem(formData, activeTab)}
              className="bg-green-600 hover:bg-green-700 text-white"
              disabled={loading}
            >
              <Eye size={16} className="mr-2" />
              Preview
            </Button>
            <Button
              type="submit"
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
              disabled={loading}
            >
              <Upload size={16} className="mr-2" />
              {activeTab === 'contacts' ? 'Send Reply' : 'Save'}
            </Button>
          </div>
        </form>
      </Card>
    </AnimatedSection>
  );
};

export default FormModal;