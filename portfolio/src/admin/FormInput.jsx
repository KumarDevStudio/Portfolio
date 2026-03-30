import React from 'react';

const FormInput = ({ 
  label, 
  type = 'text', 
  name,
  value,
  defaultValue,
  onChange, 
  required = false, 
  disabled = false, 
  error = '', 
  placeholder = '',
  min,
  max,
  className = '',
  ...props 
}) => {
  // Determine if this should be a controlled or uncontrolled component
  const isControlled = value !== undefined;
  
  return (
    <div className={`form-input-group ${className}`}>
      {label && (
        <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}
      <input
        type={type}
        name={name}
        // Use either value (controlled) or defaultValue (uncontrolled), not both
        {...(isControlled ? { value } : { defaultValue })}
        onChange={onChange}
        required={required}
        disabled={disabled}
        placeholder={placeholder}
        min={min}
        max={max}
        className={`w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:cursor-not-allowed transition-colors ${
          error ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : ''
        }`}
        {...props}
      />
      {error && (
        <p className="text-red-600 dark:text-red-400 text-sm mt-1">{error}</p>
      )}
    </div>
  );
};

export default FormInput;