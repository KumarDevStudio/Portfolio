import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { 
  Code, 
  Database, 
  Globe, 
  Server, 
  Palette, 
  Smartphone, 
  GitBranch,
  Settings,
  Cloud,
  Monitor,
  Layers,
  Terminal,
  Star,
  Award,
  TrendingUp,
  AlertCircle,
  RefreshCw
} from 'lucide-react';

// ✅ FIX 1: capitalize helper used for level normalization
const capitalize = (s) =>
  s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : 'Intermediate';

const Skills = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [animatingBars, setAnimatingBars] = useState({});
  const [hoveredSkill, setHoveredSkill] = useState(null);
  const [skillsData, setSkillsData] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const sectionRef = useRef(null);

  // ✅ FIX 2: apiUrl memoized — no longer recreated on every render
  const apiUrl = useMemo(
    () => (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/$/, ''),
    []
  );

  // Icon mappings
  const categoryIcons = {
    frontend: <Monitor className="w-6 h-6" />,
    backend: <Server className="w-6 h-6" />,
    database: <Database className="w-6 h-6" />,
    tools: <Settings className="w-6 h-6" />,
    devops: <Cloud className="w-6 h-6" />,
    cloud: <Cloud className="w-6 h-6" />,
    mobile: <Smartphone className="w-6 h-6" />,
    design: <Palette className="w-6 h-6" />
  };

  const skillIcons = {
    'HTML': <Globe className="w-5 h-5" />,
    'CSS': <Palette className="w-5 h-5" />,
    'Tailwind CSS': <Layers className="w-5 h-5" />,
    'Bootstrap': <Layers className="w-5 h-5" />,
    'React': <Code className="w-5 h-5" />,
    'Vue.js': <Code className="w-5 h-5" />,
    'JavaScript': <Code className="w-5 h-5" />,
    'TypeScript': <Code className="w-5 h-5" />,
    'Next.js': <Layers className="w-5 h-5" />,
    'Node.js': <Server className="w-5 h-5" />,
    'Express.js': <Server className="w-5 h-5" />,
    'Python': <Terminal className="w-5 h-5" />,
    'PHP': <Code className="w-5 h-5" />,
    'MongoDB': <Database className="w-5 h-5" />,
    'PostgreSQL': <Database className="w-5 h-5" />,
    'MySQL': <Database className="w-5 h-5" />,
    'Redis': <Database className="w-5 h-5" />,
    'Git': <GitBranch className="w-5 h-5" />,
    'Docker': <Layers className="w-5 h-5" />,
    'AWS': <Cloud className="w-5 h-5" />,
    'Figma': <Palette className="w-5 h-5" />
  };

  // Get default color based on category
  const getDefaultColor = (category) => {
    const colors = {
      frontend: 'from-blue-400 to-cyan-500',
      backend: 'from-green-500 to-green-700',
      database: 'from-purple-500 to-indigo-600',
      tools: 'from-orange-400 to-red-500',
      devops: 'from-blue-500 to-indigo-600',
      cloud: 'from-yellow-400 to-orange-500',
      mobile: 'from-pink-400 to-rose-500',
      design: 'from-fuchsia-400 to-purple-500'
    };
    return colors[category.toLowerCase()] || 'from-gray-400 to-gray-600';
  };

  // Fetch skills from API
  // ✅ FIX 3: wrapped in useCallback so the dependency array in useEffect is stable
  const fetchSkills = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`${apiUrl}/skills/active`);

      if (!response.ok) {
        throw new Error(`Failed to fetch skills: ${response.status}`);
      }

      const data = await response.json();

      if (data.success && data.data) {
        const transformedData = {};

        if (data.data.groupedSkills) {
          Object.entries(data.data.groupedSkills).forEach(([category, skills]) => {
            const categoryKey = category.toLowerCase().replace(/\s+/g, '');
            transformedData[categoryKey] = skills.map(skill => ({
              name: skill.name,
              proficiencyScore: skill.proficiency || skill.proficiencyScore || 50,
              // ✅ FIX 4: capitalize level so it matches getLevelBadgeColor keys
              // Backend returns lowercase ('intermediate'), keys expect 'Intermediate'
              level: capitalize(skill.level),
              yearsOfExperience: skill.yearsOfExperience || 0,
              monthsOfExperience: skill.monthsOfExperience || 0,
              experienceLabel: skill.yearsOfExperience
                ? `${skill.yearsOfExperience}+ years`
                : 'New to this',
              // color stays as Tailwind gradient string (hex from backend is unusable here)
              color: getDefaultColor(category),
              projects: skill.projects?.length || 0,
              certified: skill.certifications?.length > 0 || false,
              description: skill.description || '',
              tags: skill.tags || [],
              // ✅ FIX 5: backend stores this as 'featured', not 'isFavorite'
              isFavorite: skill.featured || false,
            }));
          });
        }

        setSkillsData(transformedData);
      }
    } catch (err) {
      console.error('Error fetching skills:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [apiUrl]);

  // ✅ FIX 6: fetchSkills is now stable via useCallback, safe in dep array
  useEffect(() => {
    fetchSkills();
  }, [fetchSkills]);

  // Intersection observer for animations
  useEffect(() => {
    if (Object.keys(skillsData).length === 0) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          setTimeout(() => {
            Object.entries(skillsData).forEach((categoryData, categoryIndex) => {
              categoryData[1].forEach((skill, skillIndex) => {
                setTimeout(() => {
                  setAnimatingBars(prev => ({
                    ...prev,
                    [`${categoryData[0]}-${skill.name}`]: true
                  }));
                }, (categoryIndex * 200) + (skillIndex * 150));
              });
            });
          }, 300);
        }
      },
      { threshold: 0.1, rootMargin: '50px' }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => observer.disconnect();
  }, [skillsData]);

  const getCategoryTitle = (category) => {
    const titles = {
      frontend: 'Frontend Development',
      backend: 'Backend Development',
      database: 'Database & Storage',
      tools: 'Tools & DevOps',
      devops: 'DevOps & Cloud',
      cloud: 'Cloud Services',
      mobile: 'Mobile Development',
      design: 'Design & UI/UX'
    };
    return titles[category] || category.charAt(0).toUpperCase() + category.slice(1);
  };

  const getLevelBadgeColor = (level) => {
    const colors = {
      'Expert':       'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
      'Advanced':     'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
      'Intermediate': 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
      'Beginner':     'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
      'Fresher':      'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300'
    };
    return colors[level] || 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
  };

  // const getTotalProjects = () =>
  //   Object.values(skillsData).flat().reduce((total, skill) => total + skill.projects, 0);

  // const getTotalCertifications = () =>
  //   Object.values(skillsData).flat().filter(skill => skill.certified).length;

  // // ✅ FIX 7: returns a readable string instead of raw "0.0"
  // const getTotalExperience = () => {
  //   const skills = Object.values(skillsData).flat();
  //   if (skills.length === 0) return '< 1';
  //   const maxExp = Math.max(
  //     ...skills.map(s => s.yearsOfExperience + (s.monthsOfExperience || 0) / 12)
  //   );
  //   return maxExp > 0 ? maxExp.toFixed(1) : '< 1';
  // };

  // Loading state
  if (loading) {
    return (
      <section id="skills" className="py-20 bg-gradient-to-br from-slate-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-indigo-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center justify-center py-20">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-indigo-600 mb-4"></div>
            <p className="text-gray-600 dark:text-gray-400">Loading skills...</p>
          </div>
        </div>
      </section>
    );
  }

  // Error state
  if (error) {
    return (
      <section id="skills" className="py-20 bg-gradient-to-br from-slate-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-indigo-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center justify-center py-20">
            <AlertCircle className="w-16 h-16 text-red-500 mb-4" />
            <p className="text-red-600 dark:text-red-400 mb-4">Failed to load skills</p>
            <p className="text-gray-600 dark:text-gray-400 text-sm mb-6">{error}</p>
            <button
              onClick={fetchSkills}
              className="flex items-center space-x-2 px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Retry</span>
            </button>
          </div>
        </div>
      </section>
    );
  }

  // Empty state
  if (Object.keys(skillsData).length === 0) {
    return (
      <section id="skills" className="py-20 bg-gradient-to-br from-slate-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-indigo-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center justify-center py-20">
            <Code className="w-16 h-16 text-gray-400 mb-4" />
            <p className="text-gray-600 dark:text-gray-400">No skills data available</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      id="skills"
      ref={sectionRef}
      className="py-20 bg-gradient-to-br from-slate-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-indigo-900 relative overflow-hidden"
    >
      {/* Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 -right-40 w-80 h-80 bg-gradient-to-r from-blue-200/30 to-purple-200/30 dark:from-blue-800/20 dark:to-purple-800/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-20 -left-40 w-80 h-80 bg-gradient-to-r from-indigo-200/30 to-pink-200/30 dark:from-indigo-800/20 dark:to-pink-800/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-gradient-to-r from-violet-100/20 to-blue-100/20 dark:from-violet-900/10 dark:to-blue-900/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }}></div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        {/* Section Header */}
        <div className={`text-center mb-20 transition-all duration-1000 ${
          isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
        }`}>
          <div className="inline-flex items-center justify-center p-3 bg-gradient-to-r from-indigo-100 to-purple-100 dark:from-indigo-900/30 dark:to-purple-900/30 rounded-full mb-6 shadow-lg">
            <Code className="w-7 h-7 text-indigo-600 dark:text-indigo-400" />
          </div>
          <h2 className="text-5xl md:text-6xl font-bold text-gray-900 dark:text-white mb-6">
            Skills &{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 via-purple-600 to-blue-600 animate-pulse">
              Expertise
            </span>
          </h2>
          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto mb-8">
            Technologies and tools I use to bring innovative ideas to life, backed by real-world experience
          </p>

          {/* Stats */}
          {/* <div className="flex justify-center items-center space-x-8 mt-8">
            <div className="text-center">
              <div className="text-3xl font-bold text-indigo-600 dark:text-indigo-400">{getTotalProjects()}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Projects Built</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-purple-600 dark:text-purple-400">{getTotalCertifications()}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Certifications</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">{getTotalExperience()}+</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Years Experience</div>
            </div>
          </div> */}
        </div>

        {/* Skills Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          {Object.entries(skillsData).map(([category, skillList], categoryIndex) => (
            <div
              key={category}
              className={`transition-all duration-1000 ${
                isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
              }`}
              style={{ transitionDelay: `${categoryIndex * 200}ms` }}
            >
              <div className="group h-full p-7 bg-white/90 dark:bg-gray-800/90 backdrop-blur-lg border border-gray-200/50 dark:border-gray-700/50 rounded-3xl shadow-xl hover:shadow-2xl transition-all duration-500 hover:scale-[1.02] hover:border-indigo-300 dark:hover:border-indigo-600">
                {/* Category Header */}
                <div className="flex items-center space-x-4 mb-8">
                  <div className="p-3 rounded-2xl bg-gradient-to-br from-indigo-100 via-purple-50 to-blue-100 dark:from-indigo-900/50 dark:via-purple-900/30 dark:to-blue-900/50 group-hover:scale-110 transition-transform duration-300 shadow-md">
                    <div className="text-indigo-600 dark:text-indigo-400">
                      {categoryIcons[category] || <Code className="w-6 h-6" />}
                    </div>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                      {getCategoryTitle(category)}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {skillList.length} technologies
                    </p>
                  </div>
                </div>

                {/* Skills List */}
                <div className="space-y-6">
                  {skillList.map((skill) => (
                    <div
                      key={skill.name}
                      className="group/skill cursor-pointer"
                      onMouseEnter={() => setHoveredSkill(`${category}-${skill.name}`)}
                      onMouseLeave={() => setHoveredSkill(null)}
                    >
                      {/* Skill Header */}
                      <div className="flex items-center gap-3 mb-3">
                        <div className="p-2 rounded-xl bg-gradient-to-br from-gray-100 to-gray-50 dark:from-gray-700 dark:to-gray-600 group-hover/skill:scale-110 transition-all duration-300 shadow-sm">
                          <div className="text-gray-700 dark:text-gray-300">
                            {skillIcons[skill.name] || <Code className="w-5 h-5" />}
                          </div>
                        </div>
                        <div className="flex-1">
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="flex items-center space-x-2">
                                <span className="text-base font-bold text-gray-900 dark:text-white">
                                  {skill.name}
                                </span>
                                {skill.certified && (
                                  <Award className="w-4 h-4 text-yellow-500" />
                                )}
                                {skill.isFavorite && (
                                  <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                                )}
                              </div>
                              {/* level is now always capitalized so badge colors will match */}
                              <span className={`inline-block px-2 py-1 text-xs font-medium rounded-full mt-1 ${getLevelBadgeColor(skill.level)}`}>
                                {skill.level}
                              </span>
                            </div>
                            <div className="text-right">
                              <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">
                                {skill.proficiencyScore}%
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div className="relative mb-3">
                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden shadow-inner">
                          <div
                            className={`h-3 bg-gradient-to-r ${skill.color} rounded-full transition-all duration-[1500ms] ease-out relative overflow-hidden`}
                            style={{
                              width: animatingBars[`${category}-${skill.name}`]
                                ? `${skill.proficiencyScore}%`
                                : '0%'
                            }}
                          >
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-pulse"></div>
                          </div>
                        </div>
                        {/* Glow layer */}
                        <div
                          className={`absolute top-0 left-0 h-3 bg-gradient-to-r ${skill.color} rounded-full blur-sm opacity-60 transition-all duration-[1500ms] ease-out`}
                          style={{
                            width: animatingBars[`${category}-${skill.name}`]
                              ? `${skill.proficiencyScore}%`
                              : '0%'
                          }}
                        />
                      </div>

                      {/* Experience Tooltip */}
                      <div className={`transition-all duration-300 ${
                        hoveredSkill === `${category}-${skill.name}`
                          ? 'opacity-100 max-h-20'
                          : 'opacity-0 max-h-0 overflow-hidden'
                      }`}>
                        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/50 rounded-lg p-2 mt-2">
                          <span className="flex items-center space-x-1">
                            <TrendingUp className="w-3 h-3" />
                            <span>{skill.yearsOfExperience}y {skill.monthsOfExperience}m</span>
                          </span>
                          <span className="flex items-center space-x-1">
                            <Star className="w-3 h-3" />
                            <span>{skill.projects} projects</span>
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Additional Info */}
        <div className={`mt-20 text-center transition-all duration-1000 delay-1000 ${
          isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
        }`}>
          <div className="inline-flex items-center justify-center space-x-3 px-8 py-4 bg-gradient-to-r from-indigo-100 via-purple-50 to-blue-100 dark:from-indigo-900/30 dark:via-purple-900/20 dark:to-blue-900/30 rounded-full border border-indigo-200 dark:border-indigo-800/50 shadow-lg backdrop-blur-sm">
            <Globe className="w-6 h-6 text-indigo-600 dark:text-indigo-400 animate-spin" style={{ animationDuration: '8s' }} />
            <span className="text-base font-semibold text-gray-700 dark:text-gray-300">
              Always learning and exploring new technologies
            </span>
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Skills;