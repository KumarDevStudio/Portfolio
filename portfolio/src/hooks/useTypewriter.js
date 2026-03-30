import { useState, useEffect } from 'react';

const useTypewriter = (text, speed = 50, onComplete = () => {}) => {
  const [displayText, setDisplayText] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (currentIndex < text.length) {
      const timeout = setTimeout(() => {
        setDisplayText(prev => prev + text[currentIndex]);
        setCurrentIndex(prev => prev + 1);
      }, speed);

      return () => clearTimeout(timeout);
    } else {
      onComplete();  // Call the callback when typing is complete
    }
  }, [currentIndex, text, speed]);

  return displayText;
};

export default useTypewriter;
