import { useContext } from 'react';
import { ThemeContext } from '../context/ThemeContext';

/**
 * Custom hook to access theme context.
 * @returns {{ theme: 'light' | 'dark', toggleTheme: () => void }} Theme context with current theme and toggle function.
 * @throws {Error} If used outside ThemeProvider.
 */
const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
}

export default useTheme;