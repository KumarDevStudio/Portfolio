import React, { useState } from 'react';
import { Github, Linkedin, Mail, ArrowUp, Code2, Heart, ExternalLink, CheckCircle, Loader } from 'lucide-react';

const Footer = () => {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('idle'); // 'idle' | 'loading' | 'success' | 'error'
  const [errorMsg, setErrorMsg] = useState('');

  const validateEmail = (val) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);

  const handleSubscribe = async () => {
    setErrorMsg('');

    if (!email.trim()) {
      setErrorMsg('Please enter your email address.');
      return;
    }
    if (!validateEmail(email)) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }

    setStatus('loading');

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Subscription failed. Please try again.');
      }

      setStatus('success');
      setEmail('');
    } catch (err) {
      setStatus('error');
      setErrorMsg(err.message || 'Something went wrong. Please try again later.');
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleSubscribe();
  };

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  };

  const scrollToSection = (sectionId) => {
    const element = document.querySelector(`#${sectionId}`);
    if (element) {
      const navHeight = 64;
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - navHeight;

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });
    }
  };

  const currentYear = new Date().getFullYear();

  return (
    <>
      {/* Enhanced Footer */}
      <footer className="bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white relative overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-purple-600"></div>
          <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.1"/>
            </pattern>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>
        </div>

        <div className="relative z-10">
          {/* Main Footer Content */}
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-12">
            <div className="grid lg:grid-cols-4 md:grid-cols-2 gap-8 mb-12">
              
              {/* Brand Section */}
              <div className="lg:col-span-2">
                <div className="flex items-center space-x-3 mb-6">
                  <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl">
                    <Code2 size={28} className="text-white" />
                  </div>
                  <h3 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                    Kishan.dev
                  </h3>
                </div>
                <p className="text-gray-300 text-lg leading-relaxed mb-6 max-w-md">
                  Full Stack Developer passionate about creating innovative digital solutions that make a difference. 
                  Building the future, one line of code at a time.
                </p>
                
                {/* Social Links */}
                <div className="flex space-x-4">
                  {[
                    { icon: Github, href: "https://github.com/KumarDevStudio", label: "GitHub", color: "hover:text-purple-400" },
                    { icon: Linkedin, href: "https://www.linkedin.com/in/kishan-webdev", label: "LinkedIn", color: "hover:text-blue-400" },
                    { icon: Mail, href: "mailto:kishan.itpro@gmail.com", label: "Email", color: "hover:text-green-400" }
                  ].map(({ icon: Icon, href, label, color }) => (
                    <a
                      key={label}
                      href={href}
                      target={label !== "Email" ? "_blank" : undefined}
                      rel={label !== "Email" ? "noopener noreferrer" : undefined}
                      className={`group p-3 bg-gray-800/50 rounded-xl border border-gray-700/50 ${color} transition-all duration-300 hover:scale-110 hover:border-current hover:shadow-lg hover:shadow-current/20`}
                      aria-label={label}
                    >
                      <Icon size={24} className="transition-transform duration-300 group-hover:rotate-12" />
                    </a>
                  ))}
                </div>
              </div>

              {/* Quick Links */}
              <div>
                <h4 className="text-lg font-semibold mb-6 text-white flex items-center">
                  <span className="w-8 h-0.5 bg-gradient-to-r from-blue-500 to-purple-500 mr-3"></span>
                  Quick Links
                </h4>
                <div className="space-y-3">
                  {[
                    { name: 'Home', id: 'home' },
                    { name: 'About', id: 'about' },
                    { name: 'Projects', id: 'projects' },
                    { name: 'Contact', id: 'contact' }
                  ].map((link) => (
                    <button
                      key={link.name}
                      onClick={() => scrollToSection(link.id)}
                      className="group flex items-center text-gray-400 hover:text-white transition-all duration-200 hover:translate-x-2"
                    >
                      <span className="w-0 h-px bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-300 group-hover:w-4 mr-0 group-hover:mr-3"></span>
                      {link.name}
                      <ExternalLink size={14} className="ml-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                    </button>
                  ))}
                </div>
              </div>

              {/* Skills & Technologies */}
              <div>
                <h4 className="text-lg font-semibold mb-6 text-white flex items-center">
                  <span className="w-8 h-0.5 bg-gradient-to-r from-blue-500 to-purple-500 mr-3"></span>
                  Technologies
                </h4>
                <div className="flex flex-wrap gap-2">
                  {['MongoDB', 'Express.js', 'React', 'Node.js', 'JavaScript', 'Tailwind CSS', 'HTML', 'CSS'].map((tech) => (
                    <span
                      key={tech}
                      className="px-3 py-1 bg-gray-800/50 border border-gray-700/50 rounded-full text-sm text-gray-300 hover:text-white hover:border-gray-600 transition-all duration-200 hover:scale-105"
                    >
                      {tech}
                    </span>
                  ))}
                </div>
                
                <div className="mt-6 p-4 bg-gradient-to-r from-blue-600/10 to-purple-600/10 border border-blue-500/20 rounded-xl">
                  <p className="text-sm text-gray-300 flex items-center">
                    <Heart size={16} className="text-red-400 mr-2 animate-pulse" />
                    Available for freelance work
                  </p>
                </div>
              </div>
            </div>

            {/* Newsletter Section */}
            <div className="border-t border-gray-800/50 pt-8 mb-8">
              <div className="max-w-2xl mx-auto text-center">
                <h4 className="text-xl font-semibold mb-3 text-white">Stay Updated</h4>
                <p className="text-gray-400 mb-6">Get the latest updates on my projects and tech insights</p>

                {status === 'success' ? (
                  <div className="flex items-center justify-center space-x-2 text-green-400 py-3">
                    <CheckCircle size={20} />
                    <span className="font-medium">You're subscribed! Thanks for joining.</span>
                  </div>
                ) : (
                  <>
                    <div className="flex max-w-md mx-auto">
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => {
                          setEmail(e.target.value);
                          setStatus('idle');
                          setErrorMsg('');
                        }}
                        onKeyDown={handleKeyDown}
                        placeholder="Enter your email"
                        disabled={status === 'loading'}
                        className="flex-1 px-4 py-3 bg-gray-800/50 border border-gray-700/50 rounded-l-xl text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                      />
                      <button
                        onClick={handleSubscribe}
                        disabled={status === 'loading'}
                        className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-medium rounded-r-xl hover:from-blue-700 hover:to-purple-700 transition-all duration-200 hover:shadow-lg hover:shadow-blue-500/25 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center min-w-[110px]"
                      >
                        {status === 'loading' ? (
                          <Loader size={18} className="animate-spin" />
                        ) : (
                          <span>Subscribe</span>
                        )}
                      </button>
                    </div>
                    {errorMsg && (
                      <p className="mt-2 text-sm text-red-400">{errorMsg}</p>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Bottom Section */}
            <div className="border-t border-gray-800/50 pt-8 flex flex-col md:flex-row justify-between items-center">
              <div className="text-center md:text-left mb-4 md:mb-0">
                <p className="text-gray-400">
                  © {currentYear} Kishan. All rights reserved.
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  Built with <Heart size={14} className="inline text-red-400 mx-1 animate-pulse" /> using React & Tailwind CSS
                </p>
              </div>

              {/* Back to Top Button */}
              <button
                onClick={scrollToTop}
                className="group flex items-center space-x-2 px-4 py-2 bg-gray-800/50 border border-gray-700/50 rounded-xl text-gray-300 hover:text-white hover:border-gray-600 transition-all duration-300 hover:scale-105"
                aria-label="Back to top"
              >
                <span className="text-sm">Back to top</span>
                <ArrowUp size={16} className="transition-transform duration-300 group-hover:-translate-y-1" />
              </button>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
};

export default Footer;