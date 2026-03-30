import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Github, ExternalLink, Code, Eye, Star, GitBranch, Calendar, Users,
  Award, Zap, Filter, Search, ChevronDown, TrendingUp, Clock, AlertCircle, RefreshCw
} from 'lucide-react';

// ─── Config ──────────────────────────────────────────────────────────────────
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// ─── Helpers ─────────────────────────────────────────────────────────────────
const getStatusColor = (status) => {
  const colors = {
    Completed:   'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
    'In Progress': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    Planning:    'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  };
  return colors[status] || 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
};

const getStatusIcon = (status) => {
  switch (status) {
    case 'Completed':   return <Award className="w-3 h-3" />;
    case 'In Progress': return <Clock className="w-3 h-3" />;
    case 'Planning':    return <TrendingUp className="w-3 h-3" />;
    default:            return null;
  }
};

// ─── Skeleton card ────────────────────────────────────────────────────────────
const SkeletonCard = () => (
  <div className="h-full bg-white/80 dark:bg-gray-800/80 rounded-2xl shadow-lg overflow-hidden border border-gray-200/50 dark:border-gray-700/50 animate-pulse">
    <div className="h-48 bg-gray-200 dark:bg-gray-700" />
    <div className="p-6 space-y-3">
      <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full" />
      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-5/6" />
      <div className="flex gap-2 mt-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-6 w-16 bg-gray-200 dark:bg-gray-700 rounded-full" />
        ))}
      </div>
      <div className="flex gap-2 mt-4">
        <div className="h-10 flex-1 bg-gray-200 dark:bg-gray-700 rounded-lg" />
        <div className="h-10 flex-1 bg-gray-200 dark:bg-gray-700 rounded-lg" />
      </div>
    </div>
  </div>
);

// ─── Main component ───────────────────────────────────────────────────────────
const Projects = () => {
  const [projects, setProjects]           = useState([]);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchTerm, setSearchTerm]       = useState('');
  const [isVisible, setIsVisible]         = useState(false);
  const [hoveredProject, setHoveredProject] = useState(null);
  const [showAll, setShowAll]             = useState(false);
  const [sortBy, setSortBy]               = useState('featured');
  const sectionRef = useRef(null);

  // ── Fetch projects from API ────────────────────────────────────────────────
  const fetchProjects = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/projects/published?limit=100`);
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.message || 'Failed to load projects');
      setProjects(json.data);
    } catch (err) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchProjects(); }, [fetchProjects]);

  // ── Intersection observer ─────────────────────────────────────────────────
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setIsVisible(true); },
      { threshold: 0.1, rootMargin: '50px' }
    );
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  // ── Derived data ──────────────────────────────────────────────────────────
  const categories = useMemo(
    () => ['All', ...new Set(projects.map(p => p.category).filter(Boolean))],
    [projects]
  );

  const filteredProjects = useMemo(() =>
    projects.filter(project => {
      const matchesCategory = selectedCategory === 'All' || project.category === selectedCategory;
      const term = searchTerm.toLowerCase();
      const matchesSearch =
        project.title?.toLowerCase().includes(term) ||
        project.description?.toLowerCase().includes(term) ||
        (project.technologies || []).some(t => t.toLowerCase().includes(term));
      return matchesCategory && matchesSearch;
    }),
    [projects, selectedCategory, searchTerm]
  );

  const sortedProjects = useMemo(() =>
    [...filteredProjects].sort((a, b) => {
      switch (sortBy) {
        case 'stars':  return (b.stars || 0) - (a.stars || 0);
        case 'recent': return new Date(b.completedAt || b.createdAt || 0) - new Date(a.completedAt || a.createdAt || 0);
        case 'featured':
        default:
          if (a.featured !== b.featured) return a.featured ? -1 : 1;
          return (b.stars || 0) - (a.stars || 0);
      }
    }),
    [filteredProjects, sortBy]
  );

  const displayedProjects = showAll ? sortedProjects : sortedProjects.slice(0, 6);
  const featuredProjects  = displayedProjects.filter(p => p.featured);
  const regularProjects   = displayedProjects.filter(p => !p.featured);

  // ── Stats ─────────────────────────────────────────────────────────────────
  const stats = useMemo(() => ({
    total:     projects.length,
    completed: projects.filter(p => p.status === 'Completed').length,
    stars:     projects.reduce((sum, p) => sum + (p.stars || 0), 0),
  }), [projects]);

  // ─── Error state ──────────────────────────────────────────────────────────
  if (error && !loading) {
    return (
      <section id="projects" ref={sectionRef} className="py-20 bg-gradient-to-br from-slate-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-blue-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col items-center justify-center min-h-[400px] text-center">
          <div className="inline-flex items-center justify-center p-6 bg-red-50 dark:bg-red-900/20 rounded-full mb-6">
            <AlertCircle className="w-12 h-12 text-red-500" />
          </div>
          <h3 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">Failed to load projects</h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-md">{error}</p>
          <button
            onClick={fetchProjects}
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-500 text-white rounded-full hover:bg-blue-600 transition-all duration-200 hover:scale-105"
          >
            <RefreshCw className="w-4 h-4" />
            Try Again
          </button>
        </div>
      </section>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <section
      id="projects"
      ref={sectionRef}
      className="py-12 sm:py-16 lg:py-20 bg-gradient-to-br from-slate-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-blue-900 relative overflow-hidden"
    >
      {/* Background blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-10 -right-20 sm:top-20 sm:-right-40 w-48 h-48 sm:w-96 sm:h-96 bg-gradient-to-r from-blue-200/20 via-purple-200/20 to-pink-200/20 dark:from-blue-800/10 dark:via-purple-800/10 dark:to-pink-800/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-10 -left-20 sm:bottom-20 sm:-left-40 w-48 h-48 sm:w-96 sm:h-96 bg-gradient-to-r from-indigo-200/20 via-cyan-200/20 to-teal-200/20 dark:from-indigo-800/10 dark:via-cyan-800/10 dark:to-teal-800/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '3s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 sm:w-64 sm:h-64 bg-gradient-to-r from-violet-200/10 to-fuchsia-200/10 dark:from-violet-800/5 dark:to-fuchsia-800/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1.5s' }} />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">

        {/* ── Header ── */}
        <div className={`text-center mb-12 sm:mb-16 transition-all duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
          <div className="inline-flex items-center justify-center p-2 sm:p-3 bg-gradient-to-r from-blue-100 via-indigo-100 to-purple-100 dark:from-blue-900/30 dark:via-indigo-900/30 dark:to-purple-900/30 rounded-full mb-4 sm:mb-6 shadow-lg backdrop-blur-sm">
            <Code className="w-5 h-5 sm:w-7 sm:h-7 text-blue-600 dark:text-blue-400" />
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 dark:text-white mb-4 sm:mb-6 px-4">
            My <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600">Projects</span>
          </h2>
          <p className="text-base sm:text-lg md:text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto px-4">
            A collection of projects I've built during my apprenticeship and learning journey
          </p>

          {/* Stats bar */}
          <div className="flex justify-center mt-6 sm:mt-8">
            <div className="flex items-center space-x-4 sm:space-x-8 bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm rounded-full px-4 sm:px-6 py-2 sm:py-3 shadow-lg">
              {loading ? (
                [1, 2, 3].map(i => (
                  <div key={i} className="text-center animate-pulse">
                    <div className="h-7 w-8 bg-gray-200 dark:bg-gray-700 rounded mx-auto mb-1" />
                    <div className="h-3 w-14 bg-gray-200 dark:bg-gray-700 rounded" />
                  </div>
                ))
              ) : (
                <>
                  <div className="text-center">
                    <div className="text-lg sm:text-2xl font-bold text-blue-600 dark:text-blue-400">{stats.total}</div>
                    <div className="text-xs text-gray-600 dark:text-gray-400">Projects</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg sm:text-2xl font-bold text-green-600 dark:text-green-400">{stats.completed}</div>
                    <div className="text-xs text-gray-600 dark:text-gray-400">Completed</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg sm:text-2xl font-bold text-purple-600 dark:text-purple-400">{stats.stars}</div>
                    <div className="text-xs text-gray-600 dark:text-gray-400">Stars</div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* ── Filters ── */}
        <div className={`mb-8 sm:mb-12 transition-all duration-1000 delay-200 px-2 sm:px-0 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
          <div className="flex flex-col gap-4 sm:gap-6">
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 w-full max-w-4xl mx-auto">
              <div className="relative flex-1 min-w-0">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 sm:w-5 sm:h-5" />
                <input
                  type="text"
                  placeholder="Search projects, technologies..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 sm:pl-10 pr-4 py-2.5 sm:py-3 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-gray-200 dark:border-gray-700 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 transition-all duration-200 text-sm sm:text-base"
                />
              </div>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-3 sm:px-4 py-2.5 sm:py-3 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-gray-200 dark:border-gray-700 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 transition-all duration-200 text-sm sm:text-base min-w-0 sm:min-w-[160px] flex-shrink-0"
              >
                <option value="featured">Featured First</option>
                <option value="stars">Most Stars</option>
                <option value="recent">Most Recent</option>
              </select>
            </div>

            {/* Category pills */}
            <div className="w-full overflow-hidden">
              <div className="sm:hidden">
                <div className="flex gap-2 overflow-x-auto pb-2 px-2 scrollbar-hide">
                  <div className="flex gap-2 min-w-max">
                    {categories.map(category => (
                      <button
                        key={category}
                        onClick={() => setSelectedCategory(category)}
                        className={`px-4 py-2 rounded-full font-medium transition-all duration-300 whitespace-nowrap text-sm flex items-center gap-1.5 flex-shrink-0 ${
                          selectedCategory === category
                            ? 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-lg'
                            : 'bg-white/80 dark:bg-gray-800/80 text-gray-700 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-gray-700'
                        } backdrop-blur-sm border border-gray-200 dark:border-gray-700`}
                      >
                        <Filter className="w-3.5 h-3.5" />
                        <span>{category}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="hidden sm:flex flex-wrap gap-2 lg:gap-3 justify-center">
                {categories.map(category => (
                  <button
                    key={category}
                    onClick={() => setSelectedCategory(category)}
                    className={`px-4 md:px-6 py-2 md:py-3 rounded-full font-medium transition-all duration-300 transform hover:scale-105 active:scale-95 flex items-center gap-2 text-sm md:text-base ${
                      selectedCategory === category
                        ? 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-lg scale-105'
                        : 'bg-white/80 dark:bg-gray-800/80 text-gray-700 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-gray-700'
                    } backdrop-blur-sm border border-gray-200 dark:border-gray-700`}
                  >
                    <Filter className="w-4 h-4" />
                    <span>{category}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── Loading skeletons ── */}
        {loading && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8 mb-12">
            {[1, 2, 3, 4, 5, 6].map(i => <SkeletonCard key={i} />)}
          </div>
        )}

        {/* ── Featured projects ── */}
        {!loading && featuredProjects.length > 0 && (
          <div className={`mb-12 sm:mb-16 transition-all duration-1000 delay-400 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
            <div className="flex items-center justify-between mb-6 sm:mb-8 px-2 sm:px-0">
              <div className="flex items-center">
                <Star className="w-5 h-5 sm:w-6 sm:h-6 text-yellow-500 mr-2" />
                <h3 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Featured Projects</h3>
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">{featuredProjects.length} featured</div>
            </div>
            <div className="grid lg:grid-cols-2 gap-6 sm:gap-8">
              {featuredProjects.map((project, index) => (
                <div
                  key={project._id}
                  className={`group relative transition-all duration-500 delay-${index * 100} ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}
                  onMouseEnter={() => setHoveredProject(project._id)}
                  onMouseLeave={() => setHoveredProject(null)}
                >
                  <div className="h-full bg-white/90 dark:bg-gray-800/90 backdrop-blur-lg rounded-2xl sm:rounded-3xl shadow-xl hover:shadow-2xl transition-all duration-500 overflow-hidden border border-gray-200/50 dark:border-gray-700/50 hover:scale-[1.02] hover:border-blue-300 dark:hover:border-blue-600">
                    <div className="relative overflow-hidden h-48 sm:h-64">
                      {project.images?.[0]?.url ? (
                        <img src={project.images[0].url} alt={project.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" loading="lazy" />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-blue-100 to-indigo-200 dark:from-blue-900/50 dark:to-indigo-900/50 flex items-center justify-center">
                          <Code className="w-16 h-16 text-blue-400/50" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                      <div className="absolute top-3 sm:top-4 right-3 sm:right-4">
                        <span className={`flex items-center space-x-1 px-2 sm:px-3 py-1 rounded-full text-xs font-semibold backdrop-blur-sm ${getStatusColor(project.status)}`}>
                          {getStatusIcon(project.status)}
                          <span className="hidden sm:inline">{project.status}</span>
                        </span>
                      </div>
                      <div className="absolute bottom-3 sm:bottom-4 left-3 sm:left-4 text-white">
                        <div className="flex items-center space-x-2 sm:space-x-4 text-xs sm:text-sm">
                          {project.stars > 0 && (
                            <div className="flex items-center space-x-1">
                              <Star className="w-3 h-3 sm:w-4 sm:h-4" />
                              <span>{project.stars}</span>
                            </div>
                          )}
                          {project.forks > 0 && (
                            <div className="flex items-center space-x-1">
                              <GitBranch className="w-3 h-3 sm:w-4 sm:h-4" />
                              <span>{project.forks}</span>
                            </div>
                          )}
                          {project.duration && (
                            <div className="flex items-center space-x-1">
                              <Calendar className="w-3 h-3 sm:w-4 sm:h-4" />
                              <span>{project.duration}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      {project.performance?.lighthouse > 0 && (
                        <div className="absolute top-3 sm:top-4 left-3 sm:left-4">
                          <div className="bg-green-500/20 backdrop-blur-sm text-green-300 px-2 py-1 rounded text-xs">
                            <span className="hidden sm:inline">Lighthouse: </span>
                            <span className="sm:hidden">L: </span>
                            {project.performance.lighthouse}
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="p-4 sm:p-6 lg:p-8">
                      <div className="flex items-start justify-between mb-3 sm:mb-4">
                        <h3 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors duration-200 pr-2">
                          {project.title}
                        </h3>
                        <div className="flex items-center space-x-2 flex-shrink-0">
                          <Award className="w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6 text-yellow-500" />
                          <span className="text-xs bg-gradient-to-r from-blue-100 to-indigo-100 dark:from-blue-900/30 dark:to-indigo-900/30 text-blue-700 dark:text-blue-300 px-2 py-1 rounded whitespace-nowrap">
                            {project.category}
                          </span>
                        </div>
                      </div>
                      <p className="text-gray-600 dark:text-gray-300 mb-4 sm:mb-6 leading-relaxed text-sm sm:text-base">
                        {project.description}
                      </p>
                      {project.highlights?.length > 0 && (
                        <div className="mb-4 sm:mb-6">
                          <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2 sm:mb-3 flex items-center">
                            <Zap className="w-3 h-3 sm:w-4 sm:h-4 mr-2 text-yellow-500" />
                            Key Features:
                          </h4>
                          <div className="flex flex-wrap gap-1 sm:gap-2">
                            {project.highlights.map((highlight, idx) => (
                              <span key={idx} className="flex items-center space-x-1 text-xs bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 text-blue-700 dark:text-blue-300 px-2 sm:px-3 py-1 sm:py-2 rounded-full border border-blue-200/50 dark:border-blue-700/50">
                                <Zap className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                                <span>{highlight}</span>
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {project.technologies?.length > 0 && (
                        <div className="mb-4 sm:mb-6">
                          <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2 sm:mb-3">Technologies:</h4>
                          <div className="flex flex-wrap gap-1 sm:gap-2">
                            {project.technologies.map((tech, idx) => (
                              <span key={idx} className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-2 sm:px-3 py-1 sm:py-2 rounded-full hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-all duration-200 hover:scale-105 cursor-default">
                                {tech}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      <div className="flex gap-2 sm:gap-3">
                        {project.githubUrl && (
                          <a href={project.githubUrl} target="_blank" rel="noopener noreferrer"
                            className="flex-1 flex items-center justify-center px-3 sm:px-4 py-2 sm:py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg sm:rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-all duration-200 hover:scale-105 hover:shadow-lg text-sm sm:text-base">
                            <Github className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                            <span className="hidden sm:inline">View Code</span>
                            <span className="sm:hidden">Code</span>
                          </a>
                        )}
                        {project.liveUrl && (
                          <a href={project.liveUrl} target="_blank" rel="noopener noreferrer"
                            className="flex-1 flex items-center justify-center px-3 sm:px-4 py-2 sm:py-3 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-lg sm:rounded-xl hover:from-blue-600 hover:to-indigo-600 transition-all duration-200 hover:scale-105 shadow-lg hover:shadow-xl text-sm sm:text-base">
                            <ExternalLink className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                            <span className="hidden sm:inline">Live Demo</span>
                            <span className="sm:hidden">Demo</span>
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Regular projects grid ── */}
        {!loading && (
          <div className={`transition-all duration-1000 delay-600 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
            {regularProjects.length > 0 && (
              <div className="mb-6 sm:mb-8 px-2 sm:px-0">
                <h3 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-6 sm:mb-8 flex items-center justify-between">
                  <span>All Projects</span>
                  <span className="text-sm font-normal text-gray-600 dark:text-gray-400">{regularProjects.length} projects</span>
                </h3>
              </div>
            )}
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
              {regularProjects.map((project, index) => (
                <div
                  key={project._id}
                  className={`group transition-all duration-500 delay-${index * 50} ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}
                  onMouseEnter={() => setHoveredProject(project._id)}
                  onMouseLeave={() => setHoveredProject(null)}
                >
                  <div className="h-full bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-xl sm:rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden border border-gray-200/50 dark:border-gray-700/50 hover:scale-[1.03] hover:border-blue-300 dark:hover:border-blue-600">
                    <div className="relative overflow-hidden h-40 sm:h-48">
                      {project.images?.[0]?.url ? (
                        <img src={project.images[0].url} alt={project.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" loading="lazy" />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-blue-100 to-indigo-200 dark:from-blue-900/50 dark:to-indigo-900/50 flex items-center justify-center">
                          <Code className="w-12 h-12 text-blue-400/50" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                      <div className="absolute top-2 sm:top-3 right-2 sm:right-3">
                        <span className={`flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium backdrop-blur-sm ${getStatusColor(project.status)}`}>
                          {getStatusIcon(project.status)}
                          <span className="hidden sm:inline">{project.status}</span>
                        </span>
                      </div>
                    </div>
                    <div className="p-4 sm:p-6">
                      <div className="flex items-start justify-between mb-2 sm:mb-3">
                        <h3 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors duration-200 pr-2">
                          {project.title}
                        </h3>
                        <span className="bg-gradient-to-r from-blue-100 to-indigo-100 dark:from-blue-900/30 dark:to-indigo-900/30 text-blue-700 dark:text-blue-300 px-2 py-1 rounded text-xs shrink-0">
                          {project.category}
                        </span>
                      </div>
                      <p className="text-gray-600 dark:text-gray-300 mb-3 sm:mb-4 text-sm leading-relaxed line-clamp-3">
                        {project.description}
                      </p>
                      {project.highlights?.length > 0 && (
                        <div className="mb-3 sm:mb-4">
                          <div className="flex flex-wrap gap-1">
                            {project.highlights.slice(0, 2).map((highlight, idx) => (
                              <span key={idx} className="text-xs bg-yellow-50 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 px-2 py-1 rounded border border-yellow-200/50 dark:border-yellow-700/50">
                                {highlight}
                              </span>
                            ))}
                            {project.highlights.length > 2 && (
                              <span className="text-xs text-gray-500 dark:text-gray-400 px-2 py-1">+{project.highlights.length - 2}</span>
                            )}
                          </div>
                        </div>
                      )}
                      {project.technologies?.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-3 sm:mb-4">
                          {project.technologies.slice(0, 4).map((tech, idx) => (
                            <span key={idx} className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-2 py-1 rounded hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors duration-200 cursor-default">
                              {tech}
                            </span>
                          ))}
                          {project.technologies.length > 4 && (
                            <span className="text-xs text-gray-500 dark:text-gray-400 px-2 py-1">+{project.technologies.length - 4}</span>
                          )}
                        </div>
                      )}
                      <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-3 sm:mb-4">
                        <div className="flex items-center space-x-2 sm:space-x-3">
                          {project.stars > 0 && (
                            <div className="flex items-center space-x-1">
                              <Star className="w-3 h-3" /><span>{project.stars}</span>
                            </div>
                          )}
                          {project.forks > 0 && (
                            <div className="flex items-center space-x-1">
                              <GitBranch className="w-3 h-3" /><span>{project.forks}</span>
                            </div>
                          )}
                          {project.team > 0 && (
                            <div className="flex items-center space-x-1">
                              <Users className="w-3 h-3" /><span>{project.team}</span>
                            </div>
                          )}
                        </div>
                        {project.duration && (
                          <div className="flex items-center space-x-1">
                            <Calendar className="w-3 h-3" />
                            <span>{project.duration}</span>
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2">
                        {project.githubUrl && (
                          <a href={project.githubUrl} target="_blank" rel="noopener noreferrer"
                            className="flex-1 flex items-center justify-center px-2 sm:px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-all duration-200 hover:scale-105 text-sm">
                            <Github className="w-3 h-3 sm:w-4 sm:h-4 mr-1" /><span>Code</span>
                          </a>
                        )}
                        {project.liveUrl && (
                          <a href={project.liveUrl} target="_blank" rel="noopener noreferrer"
                            className="flex-1 flex items-center justify-center px-2 sm:px-3 py-2 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-lg hover:from-blue-600 hover:to-indigo-600 transition-all duration-200 hover:scale-105 text-sm shadow-md">
                            <Eye className="w-3 h-3 sm:w-4 sm:h-4 mr-1" /><span>Demo</span>
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Show more button ── */}
        {!loading && sortedProjects.length > 6 && (
          <div className={`text-center mt-8 sm:mt-12 transition-all duration-1000 delay-800 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
            <button
              onClick={() => setShowAll(!showAll)}
              className="inline-flex items-center px-6 sm:px-8 py-3 sm:py-4 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-full hover:from-blue-600 hover:to-indigo-600 transition-all duration-300 hover:scale-105 shadow-lg hover:shadow-xl text-sm sm:text-base"
            >
              {showAll ? (
                <><span>Show Less</span><ChevronDown className="w-4 h-4 sm:w-5 sm:h-5 ml-2 rotate-180" /></>
              ) : (
                <><span>View All {sortedProjects.length} Projects</span><ChevronDown className="w-4 h-4 sm:w-5 sm:h-5 ml-2" /></>
              )}
            </button>
          </div>
        )}

        {/* ── Empty state ── */}
        {!loading && filteredProjects.length === 0 && projects.length > 0 && (
          <div className={`text-center py-12 sm:py-16 transition-all duration-1000 delay-400 px-4 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
            <div className="inline-flex items-center justify-center p-4 sm:p-6 bg-gradient-to-r from-gray-100 to-blue-50 dark:from-gray-800 dark:to-blue-900/30 rounded-full mb-4 sm:mb-6 shadow-lg">
              <Search className="w-8 h-8 sm:w-12 sm:h-12 text-gray-400" />
            </div>
            <h3 className="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-white mb-2 sm:mb-3">No projects found</h3>
            <p className="text-gray-600 dark:text-gray-300 mb-4 sm:mb-6 text-sm sm:text-base">Try adjusting your search terms or filter criteria.</p>
            <button
              onClick={() => { setSearchTerm(''); setSelectedCategory('All'); }}
              className="inline-flex items-center px-4 sm:px-6 py-2 sm:py-3 bg-blue-500 text-white rounded-full hover:bg-blue-600 transition-all duration-200 hover:scale-105 text-sm sm:text-base"
            >
              Reset Filters
            </button>
          </div>
        )}

        {/* ── CTA banner ── */}
        {!loading && (
          <div className={`text-center mt-16 sm:mt-20 transition-all duration-1000 delay-1000 px-4 sm:px-0 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
            <div className="bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 dark:from-blue-900/20 dark:via-indigo-900/20 dark:to-purple-900/20 rounded-2xl sm:rounded-3xl p-8 sm:p-12 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/50">
              <h3 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-3 sm:mb-4">Want to collaborate on a project?</h3>
              <p className="text-gray-600 dark:text-gray-300 mb-6 sm:mb-8 max-w-2xl mx-auto text-sm sm:text-base">
                I'm open to new opportunities and exciting projects. Let's build something great together!
              </p>
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
                <a href="#contact"
                  className="inline-flex items-center justify-center px-6 sm:px-8 py-3 sm:py-4 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-full hover:from-blue-600 hover:to-indigo-600 transition-all duration-300 hover:scale-105 shadow-lg text-sm sm:text-base">
                  Get In Touch
                </a>
                <a href="https://github.com/kishan-webdev" target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center justify-center px-6 sm:px-8 py-3 sm:py-4 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-full hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-300 hover:scale-105 shadow-lg border border-gray-200 dark:border-gray-700 text-sm sm:text-base">
                  <Github className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />View GitHub
                </a>
              </div>
            </div>
          </div>
        )}
      </div>

      <style>{`
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .line-clamp-3 { display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
      `}</style>
    </section>
  );
};

export default Projects;