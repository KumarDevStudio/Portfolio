
import React from 'react';

const FloatingElement = ({ children, direction = 'up', duration = 3, delay = 0 }) => {
  return (
    <>
      <style>{`
        .floating-element {
          display: inline-block;
        }
        
        @keyframes float-up {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-20px); }
        }
        
        @keyframes float-down {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(20px); }
        }
      `}</style>
      <div
        className="floating-element"
        style={{
          animation: `float-${direction} ${duration}s ease-in-out infinite`,
          animationDelay: `${delay}s`
        }}
      >
        {children}
      </div>
    </>
  );
};
export default FloatingElement;