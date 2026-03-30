import React, { useState, useEffect } from 'react';
import { ArrowUp } from 'lucide-react';
import  useScrollPosition  from '../../hooks/useScrollPosition';

const ScrollToTop = () => {
  const scrollPosition = useScrollPosition();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(scrollPosition > 300);
  }, [scrollPosition]);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (!isVisible) return null;

  return (
    <button
      onClick={scrollToTop}
      className="fixed bottom-8 right-8 w-12 h-12 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg transition-all duration-300 hover:shadow-xl z-50"
      aria-label="Scroll to top"
    >
      <ArrowUp size={24} className="mx-auto" />
    </button>
  );
};

export default ScrollToTop;