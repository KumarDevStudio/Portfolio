// ===========================================
// 10. ProjectPreview.jsx
// ===========================================
import React, { useState, useContext, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, ExternalLink, Github, Calendar, Tag, AlertCircle } from 'lucide-react';
import { AdminContext } from '../pages/Admin';

const ProjectPreview = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { token, apiRequest, apiConfig } = useContext(AdminContext);
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadProject();
  }, [id]);

  const loadProject = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await apiRequest(
        'get',
        `/projects/${id}`,
        null,
        token,
        apiConfig.baseUrl
      );

      if (response.data?.success) {
        setProject(response.data.data);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load project');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
        <span className="ml-3 text-gray-600 dark:text-gray-400">Loading project...</span>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-lg p-8 text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-red-900 dark:text-red-200 mb-2">
            Project Not Found
          </h2>
          <p className="text-red-700 dark:text-red-300 mb-6">{error}</p>
          <button
            onClick={() => navigate('/admin/projects')}
            className="inline-flex items-center px-6 py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
          >
            <ArrowLeft size={20} className="mr-2" />
            Back to Projects
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      <button
        onClick={() => navigate('/admin/projects')}
        className="mb-6 inline-flex items-center text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
      >
        <ArrowLeft size={20} className="mr-2" />
        Back to Projects
      </button>

      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden">
        {project.image && (
          <div className="w-full h-96 bg-gray-200 dark:bg-gray-700">
            <img
              src={project.image}
              alt={project.title}
              className="w-full h-full object-cover"
            />
          </div>
        )}

        <div className="p-8">
          <div className="mb-6">
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
              {project.title}
            </h1>
            <p className="text-xl text-gray-600 dark:text-gray-400">
              {project.description}
            </p>
          </div>

          {project.tags && project.tags.length > 0 && (
            <div className="mb-6 flex flex-wrap gap-2">
              {project.tags.map((tag, index) => (
                <span
                  key={index}
                  className="px-3 py-1 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-full text-sm flex items-center"
                >
                  <Tag size={14} className="mr-1" />
                  {tag}
                </span>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            {project.technologies && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                  Technologies
                </h3>
                <div className="flex flex-wrap gap-2">
                  {project.technologies.map((tech, index) => (
                    <span
                      key={index}
                      className="px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm"
                    >
                      {tech}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {project.date && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center">
                  <Calendar size={20} className="mr-2" />
                  Project Date
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  {new Date(project.date).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </p>
              </div>
            )}
          </div>

          {project.longDescription && (
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                Detailed Description
              </h3>
              <div className="prose dark:prose-invert max-w-none">
                <p className="text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
                  {project.longDescription}
                </p>
              </div>
            </div>
          )}

          <div className="flex gap-4 pt-6 border-t border-gray-200 dark:border-gray-700">
            {project.liveUrl && (
              <a
                href={project.liveUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 inline-flex items-center justify-center px-6 py-3 bg-gradient-to-r from-indigo-500 to-blue-500 text-white rounded-lg hover:from-indigo-600 hover:to-blue-600 transition-all duration-200"
              >
                <ExternalLink size={20} className="mr-2" />
                View Live Demo
              </a>
            )}
            {project.githubUrl && (
              <a
                href={project.githubUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 inline-flex items-center justify-center px-6 py-3 bg-gray-800 dark:bg-gray-700 text-white rounded-lg hover:bg-gray-900 dark:hover:bg-gray-600 transition-colors"
              >
                <Github size={20} className="mr-2" />
                View on GitHub
              </a>
            )}
          </div>

          {project.featured && (
            <div className="mt-6 p-4 bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-700 rounded-lg">
              <p className="text-yellow-800 dark:text-yellow-200 text-sm font-medium">
                ⭐ This project is featured on the portfolio homepage
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProjectPreview;