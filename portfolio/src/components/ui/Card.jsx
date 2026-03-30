import React from 'react';

const Card = ({ children, className = '', hover = true }) => {
  return (
    <div className={`bg-white dark:bg-gray-800 rounded-xl shadow-lg ${hover ? 'hover:shadow-xl transition-shadow duration-300' : ''} ${className}`}>
      {children}
    </div>
  );
};

export default Card;