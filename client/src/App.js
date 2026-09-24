import React, { useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import Profile from './pages/Profile';
import Browse from './pages/Browse';
import UserProfile from './pages/UserProfile';
import Swaps from './pages/Swaps';
import SwapDetail from './pages/SwapDetail';
import AdminPanel from './pages/AdminPanel';
import LoadingSpinner from './components/LoadingSpinner';
import AdminLogin from './pages/AdminLogin';
import Footer from './components/Footer';

const PrivateRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  
  if (loading) {
    return <LoadingSpinner />;
  }
  
  return isAuthenticated ? children : <Navigate to="/login" />;
};

const AdminRoute = ({ children }) => {
  const adminToken = localStorage.getItem('adminToken');
  if (!adminToken) {
    return <Navigate to="/admin/login" />;
  }
  return children;
};

function App() {
  const { loading } = useAuth();
  const location = useLocation();

  useEffect(() => {
    const path = location.pathname;
    document.body.classList.remove('browse-page','login-page','register-page','profile-page','swaps-page','userprofile-page','swapdetail-page');
    if (path === '/browse') document.body.classList.add('browse-page');
    else if (path === '/login') document.body.classList.add('login-page');
    else if (path === '/register') document.body.classList.add('register-page');
    else if (path === '/profile') document.body.classList.add('profile-page');
    else if (path === '/swaps') document.body.classList.add('swaps-page');
    else if (path.startsWith('/user/')) document.body.classList.add('userprofile-page');
    else if (path.startsWith('/swaps/')) document.body.classList.add('swapdetail-page');
  }, [location.pathname]);

  if (loading) {
    return <LoadingSpinner />;
  }

  // Hide Navbar and Footer on admin and admin login routes
  const hideNavbar = location.pathname.startsWith('/admin');
  const hideFooter = location.pathname.startsWith('/admin');

  return (
    <div className="min-h-screen flex flex-col bg-transparent">
      {!hideNavbar && <Navbar />}
      <main className="container mx-auto px-4 py-8 flex-1">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/browse" element={<Browse />} />
          <Route path="/user/:id" element={<UserProfile />} />
          <Route 
            path="/profile" 
            element={
              <PrivateRoute>
                <Profile />
              </PrivateRoute>
            } 
          />
          <Route 
            path="/swaps" 
            element={
              <PrivateRoute>
                <Swaps />
              </PrivateRoute>
            } 
          />
          <Route 
            path="/swaps/:id" 
            element={
              <PrivateRoute>
                <SwapDetail />
              </PrivateRoute>
            } 
          />
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route 
            path="/admin" 
            element={
              <AdminRoute>
                <AdminPanel />
              </AdminRoute>
            } 
          />
        </Routes>
      </main>
      {!hideFooter && <Footer />}
    </div>
  );
}

export default App; 