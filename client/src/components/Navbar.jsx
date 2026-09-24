import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Menu, X, Sprout, LogOut, UserRound, Compass, Repeat2 } from 'lucide-react';

const Navbar = () => {
  const { isAuthenticated, user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const isHome = location.pathname === '/';
  const navText = isHome ? 'text-white' : 'text-[#34483a]';

  const handleLogout = () => { logout(); setMenuOpen(false); navigate('/'); };
  const linkClass = (path) => `rounded-lg px-3 py-2 text-sm font-medium transition ${location.pathname === path ? (isHome ? 'bg-white/15' : 'bg-[#eef3eb] text-[#365841]') : `hover:bg-white/10 ${navText}`}`;

  return (
    <nav className={`fixed left-0 top-0 z-50 w-full border-b transition-colors ${isHome ? 'border-white/10 bg-[#23372c]/90' : 'border-[#e8eae4] bg-[#faf9f6]/95'} backdrop-blur-xl`}>
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-3 sm:px-8">
        <Link to="/" onClick={() => setMenuOpen(false)} className={`flex items-center gap-2.5 ${navText}`} aria-label="NexusLearn home">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#dbe9d7] text-[#365841]"><Sprout className="h-5 w-5" /></span>
          <span className="text-xl font-semibold tracking-[-.04em]">NexusLearn</span>
        </Link>
        <div className="hidden items-center gap-1 md:flex">
          <Link to="/browse" className={linkClass('/browse')}>Explore skills</Link>
          {isAuthenticated && <Link to="/swaps" className={linkClass('/swaps')}>My exchanges</Link>}
        </div>
        <div className="hidden items-center gap-3 md:flex">
          {isAuthenticated ? <>
            <Link to="/profile" className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition hover:bg-white/10 ${navText}`}>
              {user?.profilePhoto ? <img src={user.profilePhoto} alt="" className="h-8 w-8 rounded-full object-cover" /> : <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#dbe9d7] font-semibold text-[#365841]">{user?.name?.charAt(0).toUpperCase() || 'U'}</span>}
              <span>My profile</span>
            </Link>
            <button onClick={handleLogout} aria-label="Log out" title="Log out" className={`rounded-lg p-2 transition hover:bg-white/10 ${navText}`}><LogOut className="h-4 w-4" /></button>
          </> : <>
            <Link to="/login" className={`rounded-lg px-3 py-2 text-sm font-semibold ${navText}`}>Log in</Link>
            <Link to="/register" className="rounded-xl bg-[#dbe9d7] px-4 py-2.5 text-sm font-semibold text-[#294732] transition hover:bg-white">Join NexusLearn</Link>
          </>}
        </div>
        <button className={`flex h-10 w-10 items-center justify-center rounded-xl md:hidden ${navText}`} onClick={() => setMenuOpen((open) => !open)} aria-label={menuOpen ? 'Close menu' : 'Open menu'} aria-expanded={menuOpen}>{menuOpen ? <X /> : <Menu />}</button>
      </div>
      {menuOpen && <div className={`border-t px-5 pb-5 pt-3 md:hidden ${isHome ? 'border-white/10 bg-[#23372c]' : 'border-[#e8eae4] bg-[#faf9f6]'}`}>
        <Link onClick={() => setMenuOpen(false)} to="/browse" className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium ${navText}`}><Compass className="h-4 w-4" /> Explore skills</Link>
        {isAuthenticated ? <>
          <Link onClick={() => setMenuOpen(false)} to="/swaps" className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium ${navText}`}><Repeat2 className="h-4 w-4" /> My exchanges</Link>
          <Link onClick={() => setMenuOpen(false)} to="/profile" className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium ${navText}`}><UserRound className="h-4 w-4" /> My profile</Link>
          <button onClick={handleLogout} className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium ${navText}`}><LogOut className="h-4 w-4" /> Log out</button>
        </> : <div className="mt-2 grid grid-cols-2 gap-3"><Link onClick={() => setMenuOpen(false)} to="/login" className={`rounded-xl border border-white/20 px-4 py-3 text-center text-sm font-semibold ${navText}`}>Log in</Link><Link onClick={() => setMenuOpen(false)} to="/register" className="rounded-xl bg-[#dbe9d7] px-4 py-3 text-center text-sm font-semibold text-[#294732]">Join free</Link></div>}
      </div>}
    </nav>
  );
};

export default Navbar;
