// src/pages/Contact.jsx (Updated with real API call)
import React, { useState, useRef, useEffect } from 'react';
import { Mail, Phone, MapPin, Github, Linkedin, Send, CheckCircle, AlertCircle } from 'lucide-react';
import { toast } from 'react-toastify';
import axios from 'axios';

const Contact = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notification, setNotification] = useState(null);
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold: 0.1, rootMargin: '50px' }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => observer.disconnect();
  }, []);

  const showNotification = (type, message) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await axios.post(
        `${import.meta.env.VITE_API_URL}/contacts`,
        formData
      );
      if (response.data.success) {
        setFormData({ name: '', email: '', subject: '', message: '' });
        showNotification('success', "Message sent successfully! I'll get back to you soon.");
        toast.success('Message sent successfully!');
      } else {
        showNotification('error', response.data.message || 'Failed to send message');
        toast.error(response.data.message || 'Failed to send message');
      }
    } catch (error) {
      const msg = error.response?.data?.message || 'Failed to send message. Please try again later.';
      showNotification('error', msg);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  return (
    <>
      {/* Notification */}
      {notification && (
        <div className={`fixed top-4 right-4 z-50 flex items-center p-4 rounded-lg shadow-lg transition-all duration-300 ${
          notification.type === 'success'
            ? 'bg-green-500 text-white'
            : 'bg-red-500 text-white'
        }`}>
          {notification.type === 'success' ? (
            <CheckCircle className="w-5 h-5 mr-2" />
          ) : (
            <AlertCircle className="w-5 h-5 mr-2" />
          )}
          {notification.message}
        </div>
      )}

      <section
        id="contact"
        ref={sectionRef}
        className="py-20 bg-gradient-to-br from-gray-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-blue-900 relative overflow-hidden"
      >
        {/* Background Elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-20 -right-40 w-80 h-80 bg-gradient-to-r from-blue-200/20 to-indigo-200/20 dark:from-blue-800/10 dark:to-indigo-800/10 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-20 -left-40 w-80 h-80 bg-gradient-to-r from-indigo-200/20 to-purple-200/20 dark:from-indigo-800/10 dark:to-purple-800/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '3s' }}></div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          {/* Section Header */}
          <div className={`text-center mb-16 transition-all duration-1000 ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
          }`}>
            <div className="inline-flex items-center justify-center p-3 bg-gradient-to-r from-blue-100 to-indigo-100 dark:from-blue-900/30 dark:to-indigo-900/30 rounded-full mb-6 shadow-lg">
              <Mail className="w-7 h-7 text-blue-600 dark:text-blue-400" />
            </div>
            <h2 className="text-5xl md:text-6xl font-bold text-gray-900 dark:text-white mb-6">
              Get In <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600">Touch</span>
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
              Let's discuss your next project or just say hello. I'm always excited to work on something new and meaningful.
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-12 max-w-6xl mx-auto">
            {/* Contact Information */}
            <div className={`transition-all duration-1000 delay-200 ${
              isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
            }`}>
              <div className="bg-white/90 h-159 dark:bg-gray-800/90 backdrop-blur-lg rounded-3xl shadow-xl p-8 border border-gray-200/50 dark:border-gray-700/50 hover:shadow-2xl transition-all duration-500">
                <h3 className="text-3xl font-bold text-gray-900 dark:text-white mb-8 flex items-center">
                  <div className="w-2 h-8 bg-gradient-to-b from-blue-500 to-indigo-500 rounded-full mr-4"></div>
                  Contact Information
                </h3>

                <div className="space-y-8">
                  <div className="flex items-center group">
                    <div className="flex-shrink-0 w-14 h-14 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-2xl flex items-center justify-center shadow-lg group-hover:shadow-xl group-hover:scale-105 transition-all duration-300">
                      <Mail className="w-6 h-6 text-white" />
                    </div>
                    <div className="ml-6">
                      <p className="font-semibold text-gray-900 dark:text-white text-lg">Email</p>
                      <a
                        href="mailto:kishan.itpro@gmail.com"
                        className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors duration-200"
                      >
                        kishan.itpro@gmail.com
                      </a>
                    </div>
                  </div>

                  <div className="flex items-center group">
                    <div className="flex-shrink-0 w-14 h-14 bg-gradient-to-r from-green-500 to-emerald-500 rounded-2xl flex items-center justify-center shadow-lg group-hover:shadow-xl group-hover:scale-105 transition-all duration-300">
                      <Phone className="w-6 h-6 text-white" />
                    </div>
                    <div className="ml-6">
                      <p className="font-semibold text-gray-900 dark:text-white text-lg">Phone</p>
                      <a
                        href="tel:+918528792348"
                        className="text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 transition-colors duration-200"
                      >
                        +91 85*** ***48
                      </a>
                    </div>
                  </div>

                  <div className="flex items-center group">
                    <div className="flex-shrink-0 w-14 h-14 bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center shadow-lg group-hover:shadow-xl group-hover:scale-105 transition-all duration-300">
                      <MapPin className="w-6 h-6 text-white" />
                    </div>
                    <div className="ml-6">
                      <p className="font-semibold text-gray-900 dark:text-white text-lg">Location</p>
                      <p className="text-gray-600 dark:text-gray-300">Chandigarh, India</p>
                    </div>
                  </div>
                </div>

                {/* Social Links */}
                <div className="pt-8 mt-8 border-t border-gray-200 dark:border-gray-700">
                  <p className="text-lg font-semibold text-gray-900 dark:text-white mb-6">Follow me on</p>
                  <div className="flex space-x-4">
                    <a
                      href="https://github.com/KumarDevStudio"
                      className="group flex items-center justify-center w-14 h-14 bg-gray-100 dark:bg-gray-700 rounded-2xl hover:bg-gray-900 dark:hover:bg-gray-600 transition-all duration-300 hover:scale-105 shadow-lg"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Github className="w-6 h-6 text-gray-600 dark:text-gray-300 group-hover:text-white transition-colors duration-200" />
                    </a>
                    <a
                      href="https://www.linkedin.com/in/kishan-webdev"
                      className="group flex items-center justify-center w-14 h-14 bg-blue-100 dark:bg-blue-900/30 rounded-2xl hover:bg-blue-600 dark:hover:bg-blue-600 transition-all duration-300 hover:scale-105 shadow-lg"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Linkedin className="w-6 h-6 text-blue-600 dark:text-blue-400 group-hover:text-white transition-colors duration-200" />
                    </a>
                  </div>
                </div>
              </div>
            </div>

            {/* Contact Form */}
            <div className={`transition-all duration-1000 delay-400 ${
              isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
            }`}>
              <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-lg rounded-3xl shadow-xl p-8 border border-gray-200/50 dark:border-gray-700/50 hover:shadow-2xl transition-all duration-500">
                <h3 className="text-3xl font-bold text-gray-900 dark:text-white mb-8 flex items-center">
                  <div className="w-2 h-8 bg-gradient-to-b from-indigo-500 to-purple-500 rounded-full mr-4"></div>
                  Send Message
                </h3>

                <div className="space-y-6">
                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <label htmlFor="name" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                        Full Name *
                      </label>
                      <input
                        type="text"
                        id="name"
                        name="name"
                        value={formData.name}
                        onChange={handleChange}
                        required
                        className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-all duration-200 hover:border-blue-300 dark:hover:border-blue-600"
                        placeholder="John Doe"
                      />
                    </div>
                    <div>
                      <label htmlFor="email" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                        Email Address *
                      </label>
                      <input
                        type="email"
                        id="email"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        required
                        className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-all duration-200 hover:border-blue-300 dark:hover:border-blue-600"
                        placeholder="john@example.com"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="subject" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                      Subject *
                    </label>
                    <input
                      type="text"
                      id="subject"
                      name="subject"
                      value={formData.subject}
                      onChange={handleChange}
                      required
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-all duration-200 hover:border-blue-300 dark:hover:border-blue-600"
                      placeholder="What's this about?"
                    />
                  </div>

                  <div>
                    <label htmlFor="message" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                      Message *
                    </label>
                    <textarea
                      id="message"
                      name="message"
                      value={formData.message}
                      onChange={handleChange}
                      required
                      rows={6}
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-all duration-200 hover:border-blue-300 dark:hover:border-blue-600 resize-none"
                      placeholder="Tell me about your project, ideas, or just say hello..."
                    />
                  </div>

                  <button
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                    className="w-full bg-gradient-to-r from-blue-500 to-indigo-500 text-white py-4 px-6 rounded-xl font-semibold text-lg shadow-lg hover:from-blue-600 hover:to-indigo-600 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 transition-all duration-200 disabled:opacity-70 disabled:cursor-not-allowed hover:scale-[1.02] hover:shadow-xl"
                  >
                    {isSubmitting ? (
                      <div className="flex items-center justify-center">
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-3"></div>
                        Sending Message...
                      </div>
                    ) : (
                      <div className="flex items-center justify-center">
                        <Send className="w-5 h-5 mr-3" />
                        Send Message
                      </div>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Call to Action */}
        <div className={`text-center mt-16 transition-all duration-1000 delay-600 ${
  isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
}`}>
  <div className="bg-gradient-to-r from-blue-500/10 to-indigo-500/10 dark:from-blue-500/5 dark:to-indigo-500/5 rounded-3xl p-8 border border-blue-200/50 dark:border-blue-800/50">
    
    <p className="text-lg text-gray-600 dark:text-gray-300 mb-4">
      Prefer a quick chat? Let's connect directly!
    </p>

    <div className="flex flex-wrap justify-center gap-4">
      
      {/* Email */}
      <a
        href="mailto:kishan.itpro@gmail.com"
        className="inline-flex items-center px-6 py-3 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-full hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-200 shadow-lg hover:shadow-xl hover:scale-105 border border-gray-200 dark:border-gray-700"
      >
        <Mail className="w-4 h-4 mr-2" />
        Email Me
      </a>

      {/* WhatsApp */}
      <a
        href="https://wa.me/918528792348?text=Hi%20Kishan%2C%20I%20want%20to%20connect%20with%20you"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center px-6 py-3 bg-green-500 text-white rounded-full hover:bg-green-600 transition-all duration-200 shadow-lg hover:shadow-xl hover:scale-105"
      >
        {/* You can use WhatsApp icon if installed */}
        <span className="mr-2">💬</span>
        WhatsApp
      </a>

    </div>
  </div>
</div>
        </div>
      </section>
    </>
  );
};

export default Contact;