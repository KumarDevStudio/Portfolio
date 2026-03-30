import React, { useState, useEffect, useCallback, useMemo, useRef, memo } from 'react';
import { Github, Linkedin, Mail, Download, Code, Rocket, Shield } from 'lucide-react';

// Memoized feature component
const Feature = memo(({ icon: Icon, text, delay }) => (
  <div
    className="flex items-center space-x-2 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm px-4 py-2 rounded-full border border-gray-200 dark:border-gray-700 hover:scale-105 transition-all duration-300"
    style={{ animationDelay: `${delay}s` }}
  >
    <Icon size={16} className="text-blue-600 dark:text-blue-400" />
    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{text}</span>
  </div>
));

// Memoized social link component
const SocialLink = memo(({ social, delay }) => (
  <a
    href={social.href}
    className={`p-3 rounded-full bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 ${social.color} transform hover:scale-110 transition-all duration-300 shadow-lg hover:shadow-xl`}
    aria-label={social.label}
    target="_blank"
    rel="noopener noreferrer"
    style={{ animationDelay: `${delay}s` }}
  >
    <social.icon size={24} />
  </a>
));

  // After all imports, before const Hero = () => {
const PARTICLES = Array.from({ length: 10 }, (_, i) => ({
  id: i,
  left: `${Math.random() * 100}%`,
  top: `${Math.random() * 100}%`,
  duration: `${3 + Math.random() * 4}s`,
  delay: `${Math.random() * 5}s`,
}));

const Hero = () => {
  const [typedTitle, setTypedTitle] = useState('');
  const [showSubtitle, setShowSubtitle] = useState(false);
  const [showCursor, setShowCursor] = useState(true);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  
  // API data state
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  



  // Refs for cleanup
  const abortControllerRef = useRef(null);

  // Fetch with retry logic
  const fetchWithRetry = useCallback(async (url, options = {}, retries = 3, backoff = 300) => {
    try {
      const response = await fetch(url, options);
      
      if (!response.ok) {
        if (retries > 0 && response.status >= 500) {
          await new Promise(resolve => setTimeout(resolve, backoff));
          return fetchWithRetry(url, options, retries - 1, backoff * 2);
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      return response;
    } catch (err) {
      if (err.name === 'AbortError') {
        throw err;
      }
      
      if (retries > 0) {
        await new Promise(resolve => setTimeout(resolve, backoff));
        return fetchWithRetry(url, options, retries - 1, backoff * 2);
      }
      throw err;
    }
  }, []);

  // Fetch profile data from API with abort controller
  useEffect(() => {
    const fetchProfile = async () => {
      // Cancel previous request if any
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      abortControllerRef.current = new AbortController();

      try {
        // Get API URL and ensure no trailing slash
        const apiUrl = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');
        
        const response = await fetchWithRetry(
          `${apiUrl}/profile/public`,
          {
            signal: abortControllerRef.current.signal,
            headers: {
              'Accept': 'application/json',
            },
          }
        );

        const data = await response.json();
        
        if (data.success) {
          setProfile(data.data);
          setError(null);
        } else {
          throw new Error(data.message || 'Failed to load profile');
        }
      } catch (err) {
        if (err.name === 'AbortError') return;

        console.error('Error fetching profile:', err);
        setError(err.message || 'Unable to connect to server');
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();

    // Cleanup function
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchWithRetry]);

  // Memoized computed values
  const firstName = useMemo(() => profile?.firstName || 'Kishan', [profile]);
  const lastName = useMemo(() => profile?.lastName || 'Kumar', [profile]);
  const fullName = useMemo(() => `${firstName} ${lastName}`, [firstName, lastName]);
  const title = useMemo(() => profile?.title || 'Full Stack Developer', [profile]);
  const bio = useMemo(() => 
    profile?.bio || 'Passionate about creating beautiful, functional, and user-friendly applications that make a difference',
    [profile]
  );
  const profileImageUrl = useMemo(() => profile?.profileImage?.url || null, [profile]);
  const resumeUrl = useMemo(() => profile?.resume?.url || '/Kishan_Kumar_Resume.pdf', [profile]);
  const socialLinks = useMemo(() => profile?.socialLinks || {}, [profile]);
  const profileFeatures = useMemo(() => profile?.features || [], [profile]);

  // Default features
  const defaultFeatures = useMemo(() => [
    { icon: Code, text: 'MERN Stack' },
    { icon: Rocket, text: 'Scalability' },
    { icon: Shield, text: 'Security' }
  ], []);

  // Features list
  const features = useMemo(() => {
    if (profileFeatures.length > 0) {
      return profileFeatures.map(f => ({ 
        icon: Code,
        text: f.title 
      }));
    }
    return defaultFeatures;
  }, [profileFeatures, defaultFeatures]);

  // Social links configuration
  const socialLinksConfig = useMemo(() => {
    return [
      {
        icon: Github,
        href: socialLinks.github || 'https://github.com/kishan-webdev',
        label: 'GitHub Profile',
        color: 'hover:text-gray-800 dark:hover:text-gray-200',
        show: !!socialLinks.github
      },
      {
        icon: Linkedin,
        href: socialLinks.linkedin || 'https://www.linkedin.com/in/kishan-webdev',
        label: 'LinkedIn Profile',
        color: 'hover:text-blue-600 dark:hover:text-blue-400',
        show: !!socialLinks.linkedin
      },
      {
        icon: Mail,
        href: socialLinks.email ? `mailto:${socialLinks.email}` : 'mailto:kishan.itpro@gmail.com',
        label: 'Email',
        color: 'hover:text-red-500 dark:hover:text-red-400',
        show: !!socialLinks.email
      },
    ].filter(link => link.show || !profile);
  }, [socialLinks, profile]);

  // Typing animation
  useEffect(() => {
    let index = 0;
    const timer = setInterval(() => {
      if (index <= title.length) {
        setTypedTitle(title.slice(0, index));
        index++;
      } else {
        clearInterval(timer);
        setTimeout(() => setShowSubtitle(true), 500);
      }
    }, 100);

    return () => clearInterval(timer);
  }, [title]);

  // Cursor blinking
  useEffect(() => {
    const cursorTimer = setInterval(() => {
      setShowCursor(prev => !prev);
    }, 530);

    return () => clearInterval(cursorTimer);
  }, []);

  const scrollToSection = useCallback((sectionId) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  }, []);

  // Placeholder SVG
  const placeholderSvg = useMemo(() => `data:image/svg+xml,${encodeURIComponent(`
    <svg width="200" height="200" xmlns="http://www.w3.org/2000/svg">
      <rect width="200" height="200" fill="#f3f4f6"/>
      <circle cx="100" cy="80" r="30" fill="#d1d5db"/>
      <path d="M70 140 Q100 120 130 140 L130 160 Q100 180 70 160 Z" fill="#d1d5db"/>
    </svg>
  `)}`, []);

  return (
    <section 
      id="home"
      className="min-h-screen flex items-center justify-center relative overflow-hidden bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-gray-900 dark:via-slate-800 dark:to-indigo-900 pt-20 pb-32 md:pb-40 lg:pb-48"
    >
      {/* Skip link for accessibility */}
      <a 
        href="#main-content" 
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 bg-blue-600 text-white px-4 py-2 rounded z-50"
      >
        Skip to main content
      </a>

      {/* Background effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-32 w-96 h-96 bg-gradient-to-br from-blue-400/20 to-purple-600/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-40 -left-32 w-96 h-96 bg-gradient-to-br from-purple-400/20 to-pink-600/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }}></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-72 h-72 bg-gradient-to-br from-indigo-400/10 to-cyan-600/10 rounded-full blur-2xl animate-pulse" style={{ animationDelay: '4s' }}></div>
      </div>

      {/* Floating particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
       {PARTICLES.map((p) => (
  <div
    key={p.id}
    className="absolute w-2 h-2 bg-blue-400/30 rounded-full"
    style={{
      left: p.left,
      top: p.top,
      animation: `float ${p.duration} ease-in-out infinite`,
      animationDelay: p.delay,
    }}
  />
))}
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
        {/* Profile Image */}
        <div className="mb-8 animate-fadeInScale">
          <div className="relative inline-block">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full blur opacity-20 scale-110"></div>
            <img
              src={imageError || !profileImageUrl ? placeholderSvg : profileImageUrl}
              alt={`${fullName} Profile`}
              className={`relative w-32 h-32 sm:w-40 sm:h-40 rounded-full mx-auto border-4 border-white dark:border-gray-700 shadow-2xl transition-all duration-500 hover:scale-105 object-cover ${
                imageLoaded ? 'opacity-100' : 'opacity-0'
              }`}
              onLoad={() => setImageLoaded(true)}
              onError={() => {
                setImageError(true);
                setImageLoaded(true);
              }}
              loading="eager"
            />
          </div>
        </div>

        {/* Name */}
        <div className="mb-6 animate-fadeInUp" style={{ animationDelay: '0.2s' }}>
          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-gray-900 dark:text-white mb-4">
            Hi, I'm{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 animate-gradient">
              {fullName}
            </span>
          </h1>
        </div>

        {/* Typed Title */}
        <div className="mb-8 animate-fadeInUp" style={{ animationDelay: '0.4s' }}>
          <div className="text-xl sm:text-2xl md:text-3xl text-gray-700 dark:text-gray-300 mb-6 h-10 sm:h-12 flex items-center justify-center">
            <span className="font-medium">{typedTitle}</span>
            <span className={`ml-1 ${showCursor ? 'opacity-100' : 'opacity-0'} transition-opacity duration-100`}>|</span>
          </div>
        </div>

        {/* Features and Bio */}
        {showSubtitle && (
          <div className="mb-8 animate-fadeInUp" style={{ animationDelay: '0.6s' }}>
            <div className="flex flex-wrap justify-center gap-3 mb-6">
              {features.map((feature, index) => (
                <Feature
                  key={index}
                  icon={feature.icon}
                  text={feature.text}
                  delay={0.8 + index * 0.1}
                />
              ))}
            </div>
            <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto leading-relaxed">
              {bio}
            </p>
          </div>
        )}

        {/* CTA Buttons */}
        {showSubtitle && (
          <div className="mb-12 animate-fadeInUp" style={{ animationDelay: '1s' }}>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <button 
                onClick={() => scrollToSection('projects')}
                className="group relative px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-300 w-full sm:w-auto"
                aria-label="View My Work"
              >
                <span className="relative z-10">View My Work</span>
                <div className="absolute inset-0 bg-gradient-to-r from-blue-700 to-purple-700 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              </button>
              {resumeUrl && (
                <a 
                  href={resumeUrl}
                  download={`${firstName}_${lastName}_Resume.pdf`}
                  className="group relative px-8 py-4 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 font-semibold rounded-xl border-2 border-gray-300 dark:border-gray-600 hover:border-blue-500 dark:hover:border-blue-400 shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-300 w-full sm:w-auto"
                  aria-label="Download Resume"
                >
                  <div className="flex items-center justify-center">
                    <Download size={20} className="mr-2 group-hover:animate-bounce" />
                    Download Resume
                  </div>
                </a>
              )}
            </div>
          </div>
        )}

        {/* Social Links */}
        {showSubtitle && (
          <div className="animate-fadeInUp" style={{ animationDelay: '1.2s' }}>
            <div className="flex justify-center space-x-8">
              {socialLinksConfig.map((social, index) => (
                <SocialLink
                  key={index}
                  social={social}
                  delay={1.4 + index * 0.1}
                />
              ))}
            </div>
          </div>
        )}

        {/* Loading/Error state */}
        <div aria-live="polite" aria-atomic="true">
          {loading && (
            <div className="text-gray-500 dark:text-gray-400 text-sm mt-4">
              Loading profile...
            </div>
          )}
          {error && !loading && (
            <div role="alert" className="text-red-500 dark:text-red-400 text-sm mt-4">
              {error}
            </div>
          )}
        </div>
      </div>

      {/* Bottom gradient overlay */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-white/80 via-white/40 to-transparent dark:from-gray-900/80 dark:via-gray-900/40 dark:to-transparent pointer-events-none"></div>

      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          33% { transform: translateY(-10px) rotate(1deg); }
          66% { transform: translateY(5px) rotate(-1deg); }
        }

        @keyframes fadeInScale {
          from {
            opacity: 0;
            transform: scale(0.8);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes gradient {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }

        .animate-fadeInScale {
          animation: fadeInScale 0.8s ease-out forwards;
        }

        .animate-fadeInUp {
          animation: fadeInUp 0.6s ease-out forwards;
          opacity: 0;
          animation-fill-mode: both;
        }

        .animate-gradient {
          background-size: 200% 200%;
          animation: gradient 3s ease infinite;
        }

        .sr-only {
          position: absolute;
          width: 1px;
          height: 1px;
          padding: 0;
          margin: -1px;
          overflow: hidden;
          clip: rect(0, 0, 0, 0);
          white-space: nowrap;
          border-width: 0;
        }

        .focus\\:not-sr-only:focus {
          position: static;
          width: auto;
          height: auto;
          padding: 1rem;
          margin: 0;
          overflow: visible;
          clip: auto;
          white-space: normal;
        }

        @media (max-width: 640px) {
          .transform:hover {
            transform: none;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          * {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
          }
        }
      `}</style>
    </section>
  );
};

export default Hero;