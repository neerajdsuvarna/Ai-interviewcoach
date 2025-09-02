import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FiUser, FiMenu, FiX, FiLogIn, FiLogOut } from 'react-icons/fi';
import ThemeToggle from './ThemeToggle';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../supabaseClient';

function Navbar() {
  const { user } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const dropdownRef = useRef(null);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.reload();
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="sticky top-0 z-50 bg-[var(--color-bg)] border-b border-[var(--color-border)]">
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="text-2xl font-bold text-[var(--color-primary)] tracking-tight hover:opacity-90">
          Interview<span className="text-[var(--color-accent)]">Coach</span>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex space-x-6 text-sm font-medium">
          <Link to="/" className="hover:text-[var(--color-accent)]">Home</Link>
          {user && (
            <Link to="/dashboard" className="hover:text-[var(--color-accent)]">Dashboard</Link>
          )}
          <Link to="/upload" className="hover:text-[var(--color-accent)]">Upload</Link>
          <Link to="/features" className="hover:text-[var(--color-accent)]">Features</Link>
          <Link to="/contact" className="hover:text-[var(--color-accent)]">Contact</Link>
        </nav>

        {/* Right side icons */}
        <div className="flex items-center space-x-3 relative">
          {/* Theme Toggle */}
          <div className="w-9 h-9 flex items-center justify-center">
            <ThemeToggle />
          </div>

          {/* Desktop User Icon */}
          {user ? (
            <div className="hidden md:block relative" ref={dropdownRef}>
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="w-9 h-9 flex items-center justify-center rounded-full border-2 border-[var(--color-primary)] hover:bg-[var(--color-input-bg)] transition"
              >
                <FiUser size={20} color="var(--color-text-primary)" />
              </button>

              {dropdownOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl shadow-lg py-2 z-50">
                  <div className="px-4 py-2 text-sm text-[var(--color-text-primary)] font-medium">
                    {user.user_metadata.full_name || user.email}
                  </div>
                  <Link
                    to="/dashboard"
                    onClick={() => setDropdownOpen(false)}
                    className="block w-full text-left px-4 py-2 text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-input-bg)]"
                  >
                    Dashboard
                  </Link>
                  <Link
                    to="/profile"
                    onClick={() => setDropdownOpen(false)}
                    className="block w-full text-left px-4 py-2 text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-input-bg)]"
                  >
                    Profile Settings
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="w-full text-left px-4 py-2 text-sm text-[var(--color-error)] hover:bg-[var(--color-input-bg)] rounded-b-md"
                  >
                    Logout
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link
              to="/signup"
              className="hidden md:flex w-9 h-9 items-center justify-center rounded-full border hover:bg-[var(--color-primary)] hover:text-white transition"
            >
              <FiLogIn size={20} />
            </Link>
          )}

          {/* Hamburger Menu (mobile only) */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="md:hidden w-9 h-9 flex items-center justify-center rounded-md border"
            aria-label="Toggle Menu"
          >
            {menuOpen ? <FiX size={20} /> : <FiMenu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {menuOpen && (
        <div className="md:hidden px-6 pb-4">
          <nav className="flex flex-col space-y-4 text-sm font-medium">
            <Link to="/" onClick={() => setMenuOpen(false)} className="hover:text-[var(--color-accent)]">Home</Link>
            {user && (
              <Link to="/dashboard" onClick={() => setMenuOpen(false)} className="hover:text-[var(--color-accent)]">Dashboard</Link>
            )}
            <Link to="/upload" onClick={() => setMenuOpen(false)} className="hover:text-[var(--color-accent)]">Upload</Link>
            <Link to="/features" onClick={() => setMenuOpen(false)} className="hover:text-[var(--color-accent)]">Features</Link>
            <Link to="/contact" onClick={() => setMenuOpen(false)} className="hover:text-[var(--color-accent)]">Contact</Link>

            {/* User Info (mobile only) */}
            {user ? (
              <div className="mt-4 border-t pt-4 border-[var(--color-border)] space-y-2">
                <div className="flex items-center space-x-2 text-[var(--color-text-primary)]">
                  <FiUser />
                  <span>{user.user_metadata.full_name || user.email}</span>
                </div>
                <Link
                  to="/dashboard"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center space-x-2 text-[var(--color-text-primary)] hover:underline"
                >
                  <FiUser />
                  <span>Dashboard</span>
                </Link>
                <Link
                  to="/profile"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center space-x-2 text-[var(--color-text-primary)] hover:underline"
                >
                  <FiUser />
                  <span>Profile Settings</span>
                </Link>
                <button
                  onClick={() => {
                    handleLogout();
                    setMenuOpen(false);
                  }}
                  className="flex items-center space-x-2 text-[var(--color-error)] hover:underline"
                >
                  <FiLogOut />
                  <span>Logout</span>
                </button>
              </div>
            ) : (
              <Link
                to="/signup"
                onClick={() => setMenuOpen(false)}
                className="mt-4 flex items-center space-x-2 px-4 py-2 border rounded-full text-sm font-medium hover:bg-[var(--color-primary)] hover:text-white transition"
              >
                <FiLogIn />
                <span>Login / Signup</span>
              </Link>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}

export default Navbar;
