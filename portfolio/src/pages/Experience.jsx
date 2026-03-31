import React, { useState, useEffect, useRef } from 'react';
import {
  Briefcase,
  MapPin,
  Calendar,
  Star,
  Trophy,
  ArrowRight,
  Building,
  Clock,
  Award,
  ExternalLink,
  ChevronDown
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

const Experience = () => {
  const [experiences, setExperiences] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isVisible, setIsVisible] = useState(false);
  const [expandedExp, setExpandedExp] = useState(null);
  const sectionRef = useRef(null);

  // ─── Intersection observer for entrance animation ───────────────────────────
  // FIX: depends on [loading] so it re-runs after the spinner unmounts and the
  // real <section ref={sectionRef}> is finally in the DOM.
  useEffect(() => {
    if (loading) return; // section not mounted yet — nothing to observe

    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setIsVisible(true); },
      { threshold: 0.1, rootMargin: '50px' }
    );
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, [loading]); // ← was [], now [loading]

  // ─── Fetch experiences from the public API endpoint ─────────────────────────
  useEffect(() => {
    let cancelled = false;

    const fetchExperiences = async () => {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch(`${API_BASE}/experiences/active`);
        if (!res.ok) {
          throw new Error(`Server responded with ${res.status}`);
        }

        const json = await res.json();

        if (!cancelled) {
          // API wraps data in { success, data: { experiences } }
          const data = json?.data?.experiences ?? json?.data ?? [];
          setExperiences(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Failed to fetch experiences:', err);
          setError('Failed to load experiences. Please try again.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchExperiences();
    return () => { cancelled = true; };
  }, []);

  // ─── Helpers ────────────────────────────────────────────────────────────────
  const getExperienceDuration = (startDate, endDate, isCurrent) => {
    const start = new Date(startDate);
    const end = isCurrent ? new Date() : new Date(endDate);
    const months = Math.round((end - start) / (1000 * 60 * 60 * 24 * 30));
    const years = Math.floor(months / 12);
    const remainingMonths = months % 12;
    if (years > 0) return `${years}y${remainingMonths > 0 ? ` ${remainingMonths}m` : ''}`;
    return `${months}m`;
  };

  const formatDate = (dateString) =>
    new Date(dateString).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

  const getTypeColor = (type) => {
    const colors = {
      fulltime: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
      parttime: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
      contract: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
      internship: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
      freelance: 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300',
    };
    return colors[type] || 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
  };

  const getTypeLabel = (type) => {
    const labels = {
      fulltime: 'Full-time',
      parttime: 'Part-time',
      contract: 'Contract',
      internship: 'Internship',
      freelance: 'Freelance',
    };
    return labels[type] || type;
  };

  // ─── Loading state ───────────────────────────────────────────────────────────
  if (loading) {
    return (
      <section className="py-20 bg-gradient-to-br from-slate-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-indigo-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          <span className="ml-4 text-lg text-gray-600 dark:text-gray-300">Loading experiences...</span>
        </div>
      </section>
    );
  }

  // ─── Error state ─────────────────────────────────────────────────────────────
  if (error) {
    return (
      <section className="py-20 bg-gradient-to-br from-slate-50 via-white to-red-50 dark:from-gray-900 dark:via-gray-800 dark:to-red-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center py-20">
          <p className="text-red-600 dark:text-red-400 text-xl mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </section>
    );
  }

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <section
      id="experience"
      ref={sectionRef}
      className="py-20 bg-gradient-to-br from-slate-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-indigo-900 relative overflow-hidden"
    >
      {/* Background blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 -right-40 w-80 h-80 bg-gradient-to-r from-indigo-200/20 to-blue-200/20 dark:from-indigo-800/10 dark:to-blue-800/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-20 -left-40 w-80 h-80 bg-gradient-to-r from-blue-200/20 to-purple-200/20 dark:from-blue-800/10 dark:to-purple-800/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }}></div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        {/* Heading */}
        <div className={`text-center mb-16 transition-all duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
          <div className="inline-flex items-center justify-center p-3 bg-gradient-to-r from-indigo-100 to-blue-100 dark:from-indigo-900/30 dark:to-blue-900/30 rounded-full mb-6 shadow-lg">
            <Briefcase className="w-7 h-7 text-indigo-600 dark:text-indigo-400" />
          </div>
          <h2 className="text-5xl md:text-6xl font-bold text-gray-900 dark:text-white mb-6">
            Professional{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 via-blue-600 to-purple-600">
              Journey
            </span>
          </h2>
          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
            My career progression and key achievements in software development
          </p>
        </div>

        {/* Empty state */}
        {experiences.length === 0 && (
          <div className="text-center py-20 text-gray-500 dark:text-gray-400">
            No experiences to display yet.
          </div>
        )}

        {/* Experience timeline */}
        <div className="max-w-4xl mx-auto">
          {experiences.map((exp, index) => (
            <div
              key={exp._id}
              className={`relative mb-12 transition-all duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}
              style={{ transitionDelay: `${index * 150}ms` }}
            >
              {/* Connector line between cards */}
              {index !== experiences.length - 1 && (
                <div className="absolute left-8 top-20 w-0.5 h-32 bg-gradient-to-b from-indigo-300 to-blue-300 dark:from-indigo-600 dark:to-blue-600"></div>
              )}

              <div className="flex items-start group">
                {/* Company logo / initial */}
                <div className="flex-shrink-0">
                  <div className="w-16 h-16 bg-white dark:bg-gray-800 rounded-full shadow-lg border-4 border-indigo-200 dark:border-indigo-800 overflow-hidden group-hover:border-indigo-400 dark:group-hover:border-indigo-600 transition-colors duration-300">
                    {exp.logo?.url ? (
                      <img src={exp.logo.url} alt={exp.company} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-indigo-500 to-blue-500 flex items-center justify-center text-white font-bold text-lg">
                        {exp.company?.charAt(0) ?? '?'}
                      </div>
                    )}
                  </div>
                </div>

                {/* Card */}
                <div className="flex-1 ml-6">
                  <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-lg rounded-2xl shadow-lg hover:shadow-xl transition-all duration-500 overflow-hidden border border-gray-200/50 dark:border-gray-700/50 group-hover:border-indigo-300 dark:group-hover:border-indigo-600">
                    <div className="p-6">
                      {/* Title row */}
                      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-4">
                        <div>
                          <h3 className="text-2xl font-bold text-gray-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors duration-200 mb-1">
                            {exp.position}
                          </h3>
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-gray-600 dark:text-gray-300">
                            <div className="flex items-center space-x-1">
                              <Building className="w-4 h-4" />
                              {exp.companyUrl
                                ? <a href={exp.companyUrl} target="_blank" rel="noopener noreferrer" className="font-medium hover:text-indigo-600 dark:hover:text-indigo-400">{exp.company}</a>
                                : <span className="font-medium">{exp.company}</span>
                              }
                            </div>
                            {exp.location && (
                              <div className="flex items-center space-x-1">
                                <MapPin className="w-4 h-4" />
                                <span>{exp.location}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Date / duration */}
                        <div className="flex flex-col lg:items-end mt-3 lg:mt-0 gap-1">
                          <div className="flex items-center space-x-2">
                            <Calendar className="w-4 h-4 text-gray-400" />
                            <span className="text-sm text-gray-600 dark:text-gray-300">
                              {formatDate(exp.startDate)} –{' '}
                              {exp.current ? 'Present' : exp.endDate ? formatDate(exp.endDate) : 'N/A'}
                            </span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Clock className="w-4 h-4 text-gray-400" />
                            <span className="text-sm font-medium text-indigo-600 dark:text-indigo-400">
                              {getExperienceDuration(exp.startDate, exp.endDate, exp.current)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Type badges */}
                      <div className="flex flex-wrap items-center gap-2 mb-4">
                        {exp.type && (
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getTypeColor(exp.type)}`}>
                            {getTypeLabel(exp.type)}
                          </span>
                        )}
                        {exp.workType && exp.workType !== 'onsite' && (
                          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300 capitalize">
                            {exp.workType}
                          </span>
                        )}
                        {exp.featured && (
                          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300">
                            ★ Featured
                          </span>
                        )}
                      </div>

                      {/* Description */}
                      <p className="text-gray-600 dark:text-gray-300 leading-relaxed mb-4">
                        {exp.description}
                      </p>

                      {/* Achievements accordion */}
                      {Array.isArray(exp.achievements) && exp.achievements.length > 0 && (
                        <div className="mb-4">
                          <button
                            onClick={() => setExpandedExp(expandedExp === exp._id ? null : exp._id)}
                            className="flex items-center space-x-2 text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors duration-200"
                          >
                            <Trophy className="w-4 h-4" />
                            <span className="font-medium">Key Achievements</span>
                            <ChevronDown className={`w-4 h-4 transition-transform duration-300 ${expandedExp === exp._id ? 'rotate-180' : ''}`} />
                          </button>
                          <div className={`mt-3 transition-all duration-500 overflow-hidden ${expandedExp === exp._id ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}>
                            <ul className="space-y-2">
                              {exp.achievements.map((achievement, idx) => (
                                <li key={idx} className="flex items-start space-x-3 text-gray-600 dark:text-gray-300">
                                  <div className="flex-shrink-0 w-2 h-2 bg-indigo-500 rounded-full mt-2"></div>
                                  <span className="text-sm leading-relaxed">{achievement}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      )}

                      {/* Technologies */}
                      {Array.isArray(exp.technologies) && exp.technologies.length > 0 && (
                        <div className="mb-4">
                          <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center">
                            <Star className="w-4 h-4 mr-2" />
                            Technologies Used
                          </h4>
                          <div className="flex flex-wrap gap-2">
                            {exp.technologies.map((tech, idx) => (
                              <span key={idx} className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-3 py-1 rounded-full hover:bg-indigo-100 dark:hover:bg-indigo-900/30 hover:text-indigo-700 dark:hover:text-indigo-300 transition-all duration-200 cursor-default">
                                {tech}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Footer link */}
                      <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                        <button className="flex items-center space-x-2 text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors duration-200">
                          <span className="text-sm font-medium">Learn More</span>
                          <ArrowRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* CTA card */}
        <div className={`text-center mt-16 transition-all duration-1000 delay-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
          <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-lg rounded-3xl shadow-xl p-8 border border-gray-200/50 dark:border-gray-700/50 max-w-2xl mx-auto">
            <Award className="w-12 h-12 text-indigo-600 dark:text-indigo-400 mx-auto mb-4" />
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Ready for New Challenges
            </h3>
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              I'm always open to discussing new opportunities and exciting projects
            </p>
           <a href="#contact" className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-indigo-500 to-blue-500 text-white rounded-full hover:from-indigo-600 hover:to-blue-600 transition-all duration-200 hover:scale-105 shadow-lg">
              <span>Let's Connect</span>
              <ExternalLink className="w-4 h-4 ml-2" />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Experience;