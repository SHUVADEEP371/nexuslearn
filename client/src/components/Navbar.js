import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { 
  User, 
  Search, 
  LogOut, 
  Users,
  Moon,
  Sun,
  LogIn,
  Home,
  Shield
} from 'lucide-react';
import Footer from './Footer';

const Navbar = () => {
  const { isAuthenticated, user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [darkMode, setDarkMode] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  // Determine if current page is home
  const isHome = location.pathname === '/';
  // Use lighter navbar for non-home pages
  const navBg = isHome
    ? (scrolled ? 'bg-brand-night/80 backdrop-blur-md shadow-md' : 'bg-transparent')
    : 'bg-white/90 shadow-card-lg border-b border-brand-pink/40';
  const navText = isHome ? 'text-white' : 'text-brand-plum';
  const navAccent = isHome ? 'hover:text-brand-pink' : 'hover:text-brand-orchid';
  const navLogo = isHome ? 'text-white' : 'text-brand-plum';

  return (
    <nav className={`fixed top-0 left-0 w-full z-50 transition-all duration-300 ${navBg}`} style={{backdropFilter: isHome ? undefined : 'blur(8px)'}}>
      <div className="max-w-7xl mx-auto flex items-center justify-between px-8 py-3">
        {/* Logo */}
        <div className="flex items-center">
          <span className={`text-2xl font-extrabold tracking-tight ${navLogo}`}>SkillSwap</span>
        </div>
        {/* Centered Nav Links */}
        <div className="flex-1 flex justify-center">
          <div className={`flex space-x-10 text-lg font-medium ${navText}`}>
            <Link to="/" className={`${navAccent} transition-colors`}>Home</Link>
            <Link to="/browse" className={`${navAccent} transition-colors`}>Browse</Link>
            <Link to="/swaps" className={`${navAccent} transition-colors`}>My Swap Requests</Link>
          </div>
        </div>
        {/* Right: Login or Profile */}
        <div className="flex items-center">
          {isAuthenticated ? (
            <Link to="/profile" className="ml-4">
              {user && user.profilePhoto ? (
                <img src={user.profilePhoto} alt="Profile" className="w-10 h-10 rounded-full object-cover border-2 border-brand-orchid shadow" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-brand-orchid flex items-center justify-center text-white font-bold text-xl">
                  {user && user.name ? user.name.charAt(0).toUpperCase() : 'U'}
                </div>
              )}
            </Link>
          ) : (
            <Link to="/login" className={`ml-4 px-5 py-2 rounded-lg border font-semibold transition-colors ${isHome ? 'border-brand-orchid text-white hover:bg-brand-orchid hover:text-white' : 'border-brand-plum text-brand-plum hover:bg-brand-plum hover:text-white'}`}>Login</Link>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;