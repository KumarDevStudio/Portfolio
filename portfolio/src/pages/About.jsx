import React, { useState, useEffect, useRef } from 'react';
import { MapPin, Calendar, Coffee, Code, Heart, Zap, Users, BookOpen, Target, Award } from 'lucide-react';

// Icon mapping
const ICON_MAP = {
  MapPin, Calendar, Coffee, Code, Heart, Zap, Users, BookOpen, Target, Award
};

const About = () => {
  const [imageError, setImageError] = useState(false);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const sectionRef = useRef(null);
  const fetchAttemptedRef = useRef(false);

  // Default fallback data - Updated with your actual information
  const defaultData = {
    name: "Kishan Kumar",
    location: "Chandigarh, India",
    experience: "0.5 Years",
    imageUrl: "",
    imageAlt: "Professional headshot of Kishan Kumar, a full-stack developer",
    tagline: "Passionate full-stack developer crafting digital experiences with modern technologies",
    mainDescription: "With 0.5 years of experience as a full-stack developer, I specialize in building scalable applications using the MERN stack, JWT authentication, and RESTful APIs. My journey began with a BCA from Panjab University (2021-2024), fueling my passion for clean code and innovative solutions.",
    secondaryDescription: "Driven by curiosity, I focus on creating maintainable, elegant code to solve real-world problems, continuously learning and contributing to the tech community.",
    beyondCodeTitle: "Beyond the Code",
    beyondCodeContent: "When I'm not coding, I enjoy exploring new frameworks, contributing to open source projects, writing technical articles, and mentoring aspiring developers. I believe in giving back to the community that has given me so much.",
    stats: [
      { icon: 'MapPin', label: 'Location', value: 'Chandigarh, India', color: 'text-blue-600 dark:text-blue-400', order: 0 },
      { icon: 'Calendar', label: 'Experience', value: '0.5 Years', color: 'text-green-600 dark:text-green-400', order: 1 },
      { icon: 'Code', label: 'Projects', value: '3+ Completed', color: 'text-purple-600 dark:text-purple-400', order: 2 }
    ],
    values: [
      { icon: 'Heart', title: 'Passionate', description: 'Love crafting beautiful and functional web experiences', order: 0 },
      { icon: 'Zap', title: 'Innovative', description: 'Always exploring cutting-edge technologies and solutions', order: 1 },
      { icon: 'BookOpen', title: 'Learner', description: 'Continuously updating skills and sharing knowledge', order: 2 },
      { icon: 'Target', title: 'Result-Driven', description: 'Focused on delivering high-quality, scalable solutions', order: 3 }
    ]
  };

  // Fetch about data with improved error handling
  useEffect(() => {
    if (fetchAttemptedRef.current) return;
    fetchAttemptedRef.current = true;

    const fetchAboutData = async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      try {
        setLoading(true);
        
        const apiUrl = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/$/, '');
        const endpoint = `${apiUrl}/about`;
        
        console.log('📡 Fetching about data from:', endpoint);

        const response = await fetch(endpoint, {
          signal: controller.signal,
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();
        console.log('✅ About data received:', result);
        console.log('📦 Stats count:', result.data?.stats?.length || 0);
        console.log('💎 Values count:', result.data?.values?.length || 0);

        if (result.success && result.data) {
          // Deep merge with fallbacks for arrays
          const mergedData = {
            ...defaultData,
            ...result.data,
            stats: Array.isArray(result.data.stats) && result.data.stats.length > 0 
              ? result.data.stats 
              : defaultData.stats,
            values: Array.isArray(result.data.values) && result.data.values.length > 0 
              ? result.data.values 
              : defaultData.values,
          };
          
          console.log('🔀 Merged data stats:', mergedData.stats);
          console.log('🔀 Merged data values:', mergedData.values);
          
          setData(mergedData);
          setError(null);
        } else {
          throw new Error('Invalid response format');
        }
      } catch (err) {
        clearTimeout(timeoutId);
        
        if (err.name === 'AbortError') {
          console.warn('⏱️ Request timeout - using default data');
          setError('Request timeout');
        } else {
          console.error('❌ Fetch error:', err.message);
          setError(err.message);
        }
        
        setData(defaultData);
      } finally {
        setLoading(false);
      }
    };

    fetchAboutData();
  }, []);

  // Use data or fallback
  const aboutData = data || defaultData;
  const {
    name,
    location,
    experience,
    imageUrl,
    imageAlt,
    tagline,
    mainDescription,
    secondaryDescription,
    beyondCodeTitle,
    beyondCodeContent,
    stats = [],
    values = []
  } = aboutData;

  // Sort arrays by order with safety checks
  const sortedStats = Array.isArray(stats) 
    ? [...stats].sort((a, b) => (a.order || 0) - (b.order || 0))
    : [];
  
  const sortedValues = Array.isArray(values)
    ? [...values].sort((a, b) => (a.order || 0) - (b.order || 0))
    : [];

  console.log('🎨 Rendering with:', { 
    loading, 
    hasData: !!data,
    statsCount: sortedStats.length, 
    valuesCount: sortedValues.length 
  });

  // Enhanced placeholder SVG
  const placeholderSvg = `data:image/svg+xml,${encodeURIComponent(`
    <svg width="400" height="500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 500">
      <defs>
        <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#3B82F6;stop-opacity:0.15" />
          <stop offset="100%" style="stop-color:#8B5CF6;stop-opacity:0.15" />
        </linearGradient>
      </defs>
      <rect width="400" height="500" fill="url(#grad)"/>
      <circle cx="200" cy="180" r="70" fill="#E5E7EB" opacity="0.8"/>
      <path d="M130 280 Q200 250 270 280 L270 340 Q200 380 130 340 Z" fill="#E5E7EB" opacity="0.8"/>
      <text x="50%" y="440" font-family="Arial, sans-serif" font-size="18" font-weight="600" fill="#4B5563" text-anchor="middle">${name || 'Developer'}</text>
      <text x="50%" y="465" font-family="Arial, sans-serif" font-size="14" fill="#6B7280" text-anchor="middle">${location || 'Location'}</text>
    </svg>
  `)}`;

  // Loading state
  if (loading) {
    return (
      <section className="py-20 bg-gradient-to-br from-gray-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-blue-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-center items-center min-h-[400px]">
            <div className="flex flex-col items-center space-y-4">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              <span className="text-gray-600 dark:text-gray-400 text-sm sm:text-base">Loading about section...</span>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section 
      id="about" 
      ref={sectionRef}
      className="py-12 sm:py-16 lg:py-20 bg-gradient-to-br from-gray-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-blue-900 relative overflow-hidden"
      aria-label="About section"
    >
      {/* Background effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
        <div className="absolute -top-16 -right-16 sm:-top-24 sm:-right-24 w-64 h-64 sm:w-96 sm:h-96 bg-blue-200/20 dark:bg-blue-800/20 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-16 -left-16 sm:-bottom-24 sm:-left-24 w-64 h-64 sm:w-96 sm:h-96 bg-purple-200/20 dark:bg-purple-800/20 rounded-full blur-3xl"></div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        {/* Error Banner - Only show in development or with user action */}
        {error && import.meta.env.DEV && (
          <div className="mb-6 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg" role="alert">
            <p className="text-xs text-yellow-800 dark:text-yellow-200 text-center">
              ⚠️ Using cached data - {error}
            </p>
          </div>
        )}

        {/* Header Section */}
        <div className="text-center mb-12 sm:mb-16 animate-fade-in">
          <div className="inline-flex items-center justify-center p-2 bg-blue-100 dark:bg-blue-900/30 rounded-full mb-4">
            <Users className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600 dark:text-blue-400" aria-hidden="true" />
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-4">
            About <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">Me</span>
          </h2>
          <p className="text-base sm:text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto px-4">
            {tagline}
          </p>
        </div>

        {/* Main Content Grid */}
        <div className="grid lg:grid-cols-2 gap-8 sm:gap-12 lg:gap-16 items-center">
          
          {/* Content Side */}
          <div className="space-y-6 sm:space-y-8 order-2 lg:order-1 animate-slide-in-left">
            
            {/* Main Description */}
            <div className="space-y-4 sm:space-y-6">
              <div className="prose prose-sm sm:prose-base lg:prose-lg dark:prose-invert max-w-none">
                <p className="text-gray-700 dark:text-gray-300 leading-relaxed text-sm sm:text-base lg:text-lg">
                  {mainDescription}
                </p>
                {secondaryDescription && (
                  <p className="text-gray-700 dark:text-gray-300 leading-relaxed text-sm sm:text-base mt-4">
                    {secondaryDescription}
                  </p>
                )}
              </div>
            </div>

            {/* Stats Grid */}
            {sortedStats.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4" role="list" aria-label="Statistics">
                {sortedStats.map((stat, index) => {
                  const IconComponent = ICON_MAP[stat.icon] || Code;
                  return (
                    <div
                      key={`stat-${index}`}
                      role="listitem"
                      className="group p-3 sm:p-4 rounded-xl bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-gray-200 dark:border-gray-700 hover:shadow-lg hover:scale-105 transition-all duration-300"
                    >
                      <div className="flex items-center space-x-2 sm:space-x-3">
                        <div className="p-1.5 sm:p-2 rounded-lg bg-gray-100 dark:bg-gray-700 group-hover:scale-110 transition-transform duration-200" aria-hidden="true">
                          <IconComponent className={`w-4 h-4 sm:w-5 sm:h-5 ${stat.color}`} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide truncate">
                            {stat.label}
                          </p>
                          <p className="text-xs sm:text-sm font-semibold text-gray-900 dark:text-white truncate">
                            {stat.value}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Values Section */}
            {sortedValues.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white mb-4 sm:mb-6">
                  What Drives Me
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4" role="list" aria-label="Core values">
                  {sortedValues.map((value, index) => {
                    const IconComponent = ICON_MAP[value.icon] || Heart;
                    return (
                      <div
                        key={`value-${index}`}
                        role="listitem"
                        className="group p-3 sm:p-4 rounded-xl bg-gradient-to-br from-blue-50/50 to-purple-50/50 dark:from-blue-900/20 dark:to-purple-900/20 border border-blue-100 dark:border-blue-800/50 hover:shadow-lg hover:scale-105 transition-all duration-300"
                      >
                        <div className="flex items-start space-x-2 sm:space-x-3">
                          <div className="p-1.5 sm:p-2 rounded-lg bg-white dark:bg-gray-800 shadow-sm group-hover:scale-110 transition-transform duration-200 flex-shrink-0" aria-hidden="true">
                            <IconComponent className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-600 dark:text-blue-400" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <h4 className="font-semibold text-gray-900 dark:text-white text-xs sm:text-sm mb-1">
                              {value.title}
                            </h4>
                            <p className="text-gray-600 dark:text-gray-300 text-xs leading-relaxed">
                              {value.description}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Beyond the Code Section */}
            {beyondCodeContent && (
              <div className="p-4 sm:p-6 rounded-2xl bg-gradient-to-r from-amber-50 via-orange-50 to-red-50 dark:from-amber-900/20 dark:via-orange-900/20 dark:to-red-900/20 border border-amber-200 dark:border-amber-800/50">
                <div className="flex items-center space-x-2 sm:space-x-3 mb-2 sm:mb-3">
                  <div className="p-1.5 sm:p-2 rounded-full bg-amber-100 dark:bg-amber-900/50 flex-shrink-0" aria-hidden="true">
                    <Coffee className="w-4 h-4 sm:w-5 sm:h-5 text-amber-600 dark:text-amber-400" />
                  </div>
                  <h4 className="font-semibold text-gray-900 dark:text-white text-sm sm:text-base">
                    {beyondCodeTitle}
                  </h4>
                </div>
                <p className="text-gray-700 dark:text-gray-300 leading-relaxed text-xs sm:text-sm mb-3">
                  {beyondCodeContent}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 text-center italic">
                  Last Updated: {new Date().toLocaleString('en-IN', { 
                    timeZone: 'Asia/Kolkata', 
                    hour12: true,
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </p>
              </div>
            )}
          </div>

          {/* Image Side */}
          <div className="relative order-1 lg:order-2 animate-slide-in-right">
            <div className="relative group max-w-md mx-auto lg:max-w-none">
              {/* Background Effects */}
              <div 
                className="absolute inset-0 bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 rounded-2xl sm:rounded-3xl blur-xl opacity-20 group-hover:opacity-30 transition-all duration-500 scale-105"
                aria-hidden="true"
              ></div>
              
              {/* Image Container */}
              <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl shadow-2xl aspect-[4/5]">
                <img
                  src={imageError || !imageUrl ? placeholderSvg : imageUrl}
                  alt={imageAlt || `${name}, ${tagline}`}
                  className="w-full h-full object-cover transition-all duration-700 group-hover:scale-110"
                  onError={(e) => {
                    console.error('Image failed to load:', imageUrl);
                    setImageError(true);
                  }}
                  loading="lazy"
                />
                
                {/* Overlay Effects */}
                <div 
                  className="absolute inset-0 bg-gradient-to-t from-blue-900/20 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                  aria-hidden="true"
                ></div>
                
                {/* Floating Icons */}
                <div 
                  className="absolute top-3 right-3 sm:top-6 sm:right-6 p-2 sm:p-3 bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-all duration-500 transform translate-y-2 group-hover:translate-y-0"
                  aria-hidden="true"
                >
                  <Heart className="w-4 h-4 sm:w-5 sm:h-5 text-red-500" />
                </div>
                <div 
                  className="absolute bottom-3 left-3 sm:bottom-6 sm:left-6 p-2 sm:p-3 bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-all duration-500 delay-100 transform translate-y-2 group-hover:translate-y-0"
                  aria-hidden="true"
                >
                  <Code className="w-4 h-4 sm:w-5 sm:h-5 text-blue-500" />
                </div>
              </div>

              {/* Floating Decoration */}
              <div className="absolute -top-2 -right-2 sm:-top-4 sm:-right-4 w-16 h-16 sm:w-24 sm:h-24 bg-blue-400/20 rounded-full blur-xl" aria-hidden="true"></div>
              <div className="absolute -bottom-2 -left-2 sm:-bottom-4 sm:-left-4 w-20 h-20 sm:w-32 sm:h-32 bg-purple-400/20 rounded-full blur-xl" aria-hidden="true"></div>
            </div>
          </div>
        </div>
      </div>

      {/* Animations */}
      <style>{`
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes slide-in-left {
          from { opacity: 0; transform: translateX(-30px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes slide-in-right {
          from { opacity: 0; transform: translateX(30px); }
          to { opacity: 1; transform: translateX(0); }
        }
        .animate-fade-in { 
          animation: fade-in 0.6s ease-out; 
        }
        .animate-slide-in-left { 
          animation: slide-in-left 0.7s ease-out 0.2s both; 
        }
        .animate-slide-in-right { 
          animation: slide-in-right 0.7s ease-out 0.3s both; 
        }
        
        @media (prefers-reduced-motion: reduce) {
          .animate-fade-in,
          .animate-slide-in-left,
          .animate-slide-in-right {
            animation: none;
          }
        }
      `}</style>
    </section>
  );
};

export default About;