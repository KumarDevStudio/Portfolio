// src/admin/FormSelect.jsx - Fixed Version
import React from 'react';
import PropTypes from 'prop-types';

const FormSelect = ({ 
  label, 
  name,
  value,
  defaultValue,
  onChange, 
  options = [], 
  required = false, 
  disabled = false, 
  error = '', 
  className = '',
  placeholder = 'Select an option',
  ...props 
}) => {
  // Determine if this should be a controlled or uncontrolled component
  const isControlled = value !== undefined;
  
  return (
    <div className={`form-select-group ${className}`}>
      {label && (
        <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}
      <select
        name={name}
        // Use either value (controlled) or defaultValue (uncontrolled), not both
        {...(isControlled ? { value } : { defaultValue })}
        onChange={onChange}
        required={required}
        disabled={disabled}
        className={`w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:cursor-not-allowed transition-colors ${
          error ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : ''
        }`}
        aria-label={label || name}
        aria-invalid={!!error}
        aria-describedby={error ? `${name}-error` : undefined}
        {...props}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error && (
        <p id={`${name}-error`} className="text-red-600 dark:text-red-400 text-sm mt-1" role="alert">
          {error}
        </p>
      )}
    </div>
  );
};

FormSelect.propTypes = {
  label: PropTypes.string,
  name: PropTypes.string,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  defaultValue: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onChange: PropTypes.func,
  options: PropTypes.arrayOf(
    PropTypes.shape({
      value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
      label: PropTypes.string.isRequired,
    })
  ).isRequired,
  required: PropTypes.bool,
  disabled: PropTypes.bool,
  error: PropTypes.string,
  className: PropTypes.string,
  placeholder: PropTypes.string,
};

export default FormSelect;