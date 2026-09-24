import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Lock, User } from 'lucide-react';
import api from '../config/api';

const AdminLogin = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const [form, setForm] = useState({ username: '', password: '' });

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    try {
      // Send username as email for backend compatibility
      const response = await api.post('/auth/login', {
        email: form.username, // backend expects email field
        password: form.password
      });
      // Ensure the JWT contains userId: 'admin' and isAdmin: true
      const token = response.data.token;
      const decoded = JSON.parse(atob(token.split('.')[1]));
      if (decoded.userId !== 'admin' || !decoded.isAdmin) {
        setError('You do not have admin permissions.');
        setIsLoading(false);
        return;
      }
      localStorage.setItem('adminToken', token);
      navigate('/admin');
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-6 px-2">
      <div className="w-full max-w-5xl bg-white rounded-3xl shadow-2xl border border-gray-100 flex flex-col md:flex-row overflow-hidden scale-105">
        {/* Left: Form */}
        <div className="flex-1 flex flex-col justify-center px-8 py-8">
          <div className="mb-6">
            <h2 className="text-3xl font-extrabold text-gray-900 mb-1 tracking-tight">Admin Login</h2>
            <p className="text-gray-600 text-base mb-6">Please log in as admin to access the dashboard.</p>
          </div>
          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="space-y-3">
              <div>
                <label htmlFor="username" className="block text-sm font-semibold text-gray-700 mb-1">
                  Username
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    id="username"
                    name="username"
                    type="text"
                    value={form.username}
                    onChange={handleChange}
                    className="w-full pl-10 pr-4 py-3 bg-gray-50 text-gray-900 placeholder-gray-400 border border-gray-200 rounded-xl focus:border-[#5D3C64] focus:ring-2 focus:ring-[#5D3C64]/20 text-base transition-colors duration-200"
                    placeholder="Enter admin username"
                    required
                  />
                </div>
              </div>
              <div>
                <label htmlFor="password" className="block text-sm font-semibold text-gray-700 mb-1">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    value={form.password}
                    onChange={handleChange}
                    className="w-full pl-10 pr-10 py-3 bg-gray-50 text-gray-900 placeholder-gray-400 border border-gray-200 rounded-xl focus:border-[#5D3C64] focus:ring-2 focus:ring-[#5D3C64]/20 text-base transition-colors duration-200"
                    placeholder="Enter admin password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-[#5D3C64] transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>
            </div>
            {error && <div className="text-red-600 text-sm mt-2">{error}</div>}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-[#5D3C64] hover:bg-[#4A2F4F] text-white font-semibold py-3 text-base rounded-xl shadow-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed mt-4"
            >
              {isLoading ? 'Signing in...' : 'LOGIN'}
            </button>
          </form>
        </div>
        {/* Right: Illustration */}
        <div className="flex-1 flex items-center justify-center bg-gray-50">
          <img src="/login.png" alt="Admin Login Illustration" className="max-w-md w-full h-auto" />
        </div>
      </div>
    </div>
  );
};

export default AdminLogin; 