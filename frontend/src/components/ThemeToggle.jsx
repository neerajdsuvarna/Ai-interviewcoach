import React from 'react';
import { useTheme } from '../hooks/useTheme';

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      title="Toggle Theme"
      className="w-9 h-9 flex items-center justify-center rounded-full border-2 border-[var(--color-primary)] hover:bg-[var(--color-input-bg)] transition"
    >
      <span className="text-lg">
        {theme === 'dark' ? '🌙' : '🌞'}
      </span>
    </button>
  );
}

export default ThemeToggle;
