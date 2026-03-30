import React, { useState, useEffect } from 'react';
import useInView from '../../hooks/useInView'; 
import { animations } from '../../utils/animations';

const AnimatedSection = ({ children, className = '', animation = 'fadeInUp', delay = 0 }) => {
  const [ref, isInView] = useInView({ threshold: 0.1 });
  const [hasAnimated, setHasAnimated] = useState(false);
  const [loading, setLoading] = useState(true); // Added loading state

  useEffect(() => {
    if (isInView && !loading && !animationRef.current) {
      const targets = ref.current.querySelectorAll(':scope > *');
      const selectedAnimation = animations[animation] || animations.fadeInUp;
      animationRef.current = anime({
        targets,
        ...selectedAnimation,
        delay: anime.stagger(100, { start: delay * 1000 }),
        autoplay: false
      });
      animationRef.current.play();
      setLoading(false); // Set loading to false once animation starts
    }
  }, [isInView, animation, delay, loading]); // Added loading to dependency array

  const animationStyle = animations[animation] || animations.fadeInUp;

  return (
    <div
      ref={ref}
      className={className}
      style={{
        ...animationStyle.initial,
        ...(hasAnimated ? animationStyle.animate : {}),
        transition: animationStyle.transition.replace('0.8s', `${0.8 + delay}s`),
        transitionDelay: `${delay}s`
      }}
    >
      {children}
    </div>
  );
};

export default AnimatedSection;
