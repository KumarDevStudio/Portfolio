import React, { useState, useEffect, useRef, useCallback } from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import Navbar from './components/layout/Navbar';
import Hero from './pages/Hero';
import About from './pages/About';
import Skills from './pages/Skills';
import Projects from './pages/Projects';
import Experience from './pages/Experience';
import Contact from './pages/Contact';
import Admin from './pages/Admin';
import Footer from './components/layout/Footer';
import ScrollToTop from './components/layout/ScrollToTop';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import ErrorBoundary from './services/ErrorBoundary';

const App = () => {
  const [authState, setAuthState] = useState({
    isAuthenticated: false,
    token: null,
    user: null,
    tokenExpiry: null,
    initialized: false,
  });
  
  const initializingRef = useRef(false);

  useEffect(() => {
    if (initializingRef.current) return;
    
    initializingRef.current = true;
    
    const initializeAuth = () => {
      try {
        const token = localStorage.getItem('adminToken');
        const userStr = localStorage.getItem('user');
        const tokenValidationStr = localStorage.getItem('tokenValidation');
        
        if (!token || !userStr || !tokenValidationStr) {
          console.log('No complete auth data found, starting fresh');
          setAuthState(prev => ({ ...prev, initialized: true }));
          return;
        }
        
        const user = JSON.parse(userStr);
        const tokenValidation = JSON.parse(tokenValidationStr);
        
        const isValid = tokenValidation.token === token && 
                       tokenValidation.expires && 
                       tokenValidation.expires > Date.now();
        
        console.log('Initial auth check:', { 
          hasToken: !!token, 
          hasUser: !!user?.username,
          isValid,
          expires: new Date(tokenValidation.expires || 0).toLocaleString(),
        });
        
        setAuthState({
          isAuthenticated: isValid,
          token: isValid ? token : null,
          user: isValid ? user : null,
          tokenExpiry: isValid ? tokenValidation.expires : null,
          initialized: true,
        });
        
        if (!isValid) {
          localStorage.removeItem('adminToken');
          localStorage.removeItem('user');
          localStorage.removeItem('tokenValidation');
          localStorage.removeItem('refreshToken');
        }
        
      } catch (error) {
        console.error('Error initializing auth:', error);
        localStorage.removeItem('adminToken');
        localStorage.removeItem('user');
        localStorage.removeItem('tokenValidation');
        localStorage.removeItem('refreshToken');
        
        setAuthState({
          isAuthenticated: false,
          token: null,
          user: null,
          tokenExpiry: null,
          initialized: true,
        });
      }
    };
    
    initializeAuth();
  }, []);

  const handleAuthChange = useCallback((authenticated, token, user = null) => {
    console.log('App handleAuthChange:', {
      authenticated,
      token: token ? 'present' : 'missing',
      user: user?.username || 'none',
    });

    // Prevent redundant state updates
    if (
      authenticated === authState.isAuthenticated &&
      token === authState.token &&
      JSON.stringify(user) === JSON.stringify(authState.user)
    ) {
      console.log('Skipping redundant handleAuthChange');
      return;
    }
    
    if (authenticated && token) {
      const tokenExpiry = Date.now() + 30 * 60 * 1000;
      const tokenValidation = {
        token,
        expires: tokenExpiry,
      };
      
      localStorage.setItem('adminToken', token);
      localStorage.setItem('tokenValidation', JSON.stringify(tokenValidation));
      if (user) {
        localStorage.setItem('user', JSON.stringify(user));
      }
      
      setAuthState({
        isAuthenticated: true,
        token,
        user: user || authState.user,
        tokenExpiry,
        initialized: true,
      });
      
    } else {
      localStorage.removeItem('adminToken');
      localStorage.removeItem('user');
      localStorage.removeItem('tokenValidation');
      localStorage.removeItem('refreshToken');
      
      setAuthState({
        isAuthenticated: false,
        token: null,
        user: null,
        tokenExpiry: null,
        initialized: true,
      });
    }
  }, [authState]);

  if (!authState.initialized) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Initializing...</p>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <ScrollToTop />
      <div className="min-h-screen bg-white dark:bg-gray-900 transition-colors duration-300">
        <Navbar />
        <main>
          <Routes>
            <Route
              path="/"
              element={
                <>
                  <Hero />
                  <About />
                  <Skills />
                  <Projects />
                  <Experience />
                  <Contact />
                </>
              }
            />
            <Route
              path="/admin/*"
              element={
                <Admin 
                  onAuthChange={handleAuthChange} 
                  authState={authState}
                />
              }
            />
            <Route
              path="*"
              element={
                <div className="text-center py-10 text-red-500">
                  404 Not Found
                </div>
              }
            />
          </Routes>
        </main>
        <Footer />
        <ToastContainer position="top-right" autoClose={3000} />
      </div>
    </Router>
  );
};

export default App;