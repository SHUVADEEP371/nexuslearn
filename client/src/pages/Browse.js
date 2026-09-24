import React, { useState, useEffect, useCallback } from 'react';

import axios from 'axios';
import toast from 'react-hot-toast';
import { Search, MapPin, Clock, Filter, X } from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';
import { useAuth } from '../contexts/AuthContext';
import api from '../config/api';

const Browse = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [location, setLocation] = useState('');
  const [availability, setAvailability] = useState('');
  const [filters, setFilters] = useState({});
  const [showFilters, setShowFilters] = useState(false);
  const { user: currentUser } = useAuth();
  const [showSwapModal, setShowSwapModal] = useState(false);
  const [swapTarget, setSwapTarget] = useState(null);
  const [mySkill, setMySkill] = useState('');
  const [theirSkill, setTheirSkill] = useState('');
  const [swapMessage, setSwapMessage] = useState('');
  const [swapLoading, setSwapLoading] = useState(false);
  const USERS_PER_PAGE = 10;
  const [currentPage, setCurrentPage] = useState(1);
  const publicUsers = users.filter(user => user.isPublic);
  const totalPages = Math.ceil(publicUsers.length / USERS_PER_PAGE);
  const paginatedUsers = publicUsers.slice((currentPage - 1) * USERS_PER_PAGE, currentPage * USERS_PER_PAGE);

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      
      if (filters.skill) params.append('skill', filters.skill);
      if (filters.location) params.append('location', filters.location);
      if (filters.availability) params.append('availability', filters.availability);

      const response = await axios.get(`/api/users/browse?${params}`);
      setUsers(response.data);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchUsers();
    // Listen for refresh-users event
    const handler = () => fetchUsers();
    window.addEventListener('refresh-users', handler);
    return () => window.removeEventListener('refresh-users', handler);
  }, [fetchUsers]);

  const handleSearch = () => {
    setFilters({
      skill: searchTerm,
      location,
      availability
    });
  };

  const clearFilters = () => {
    setSearchTerm('');
    setLocation('');
    setAvailability('');
    setFilters({});
  };

  const getAvailabilityText = (user) => {
    const avail = user.availability;
    const options = [];
    
    if (avail.weekdays) options.push('Weekdays');
    if (avail.weekends) options.push('Weekends');
    if (avail.evenings) options.push('Evenings');
    if (avail.mornings) options.push('Mornings');
    
    return options.length > 0 ? options.join(', ') : 'Not specified';
  };

  const openSwapModal = (targetUser) => {
    setSwapTarget(targetUser);
    setMySkill('');
    setTheirSkill('');
    setSwapMessage('');
    setShowSwapModal(true);
  };
  const closeSwapModal = () => {
    setShowSwapModal(false);
    setSwapTarget(null);
  };
  const handleSendSwap = async () => {
    if (!mySkill || !theirSkill) {
      toast.error('Please select both skills');
      return;
    }
    setSwapLoading(true);
    try {
      await api.post('/swaps', {
        recipientId: swapTarget._id,
        requestedSkill: { name: theirSkill },
        offeredSkill: { name: mySkill },
        message: swapMessage
      });
      toast.success('Swap request sent!');
      closeSwapModal();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to send swap request');
    } finally {
      setSwapLoading(false);
    }
  };

  // Add a renderStars function for displaying stars
  const renderStars = (rating) => {
    const stars = [];
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 !== 0;
    for (let i = 0; i < fullStars; i++) {
      stars.push(<svg key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.967a1 1 0 00.95.69h4.175c.969 0 1.371 1.24.588 1.81l-3.38 2.455a1 1 0 00-.364 1.118l1.287 3.966c.3.922-.755 1.688-1.54 1.118l-3.38-2.454a1 1 0 00-1.175 0l-3.38 2.454c-.784.57-1.838-.196-1.54-1.118l1.287-3.966a1 1 0 00-.364-1.118L2.05 9.394c-.783-.57-.38-1.81.588-1.81h4.175a1 1 0 00.95-.69l1.286-3.967z"/></svg>);
    }
    if (hasHalfStar) {
      stars.push(<svg key="half" className="w-4 h-4 fill-yellow-400 text-yellow-400" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.967a1 1 0 00.95.69h4.175c.969 0 1.371 1.24.588 1.81l-3.38 2.455a1 1 0 00-.364 1.118l1.287 3.966c.3.922-.755 1.688-1.54 1.118l-3.38-2.454a1 1 0 00-1.175 0l-3.38 2.454c-.784.57-1.838-.196-1.54-1.118l1.287-3.966a1 1 0 00-.364-1.118L2.05 9.394c-.783-.57-.38-1.81.588-1.81h4.175a1 1 0 00.95-.69l1.286-3.967z"/></svg>);
    }
    const emptyStars = 5 - Math.ceil(rating);
    for (let i = 0; i < emptyStars; i++) {
      stars.push(<svg key={`empty-${i}`} className="w-4 h-4 text-gray-300" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.967a1 1 0 00.95.69h4.175c.969 0 1.371 1.24.588 1.81l-3.38 2.455a1 1 0 00-.364 1.118l1.287 3.966c.3.922-.755 1.688-1.54 1.118l-3.38-2.454a1 1 0 00-1.175 0l-3.38 2.454c-.784.57-1.838-.196-1.54-1.118l1.287-3.966a1 1 0 00-.364-1.118L2.05 9.394c-.783-.57-.38-1.81.588-1.81h4.175a1 1 0 00.95-.69l1.286-3.967z"/></svg>);
    }
    return stars;
  };

  if (loading) {
    return <LoadingSpinner size="lg" className="py-20" />;
  }

  return (
    <div className="min-h-screen flex flex-col items-center bg-white pt-8 px-2 animate-fade-in">
      <div className="w-full max-w-6xl flex flex-col items-start mb-8 mt-4">
        <h1 className="text-4xl font-extrabold text-brand-plum mb-2 drop-shadow-lg">Browse Skills</h1>
        <p className="text-lg text-brand-orchid">Find people with the skills you want to learn</p>
      </div>

      {/* Search and Filters */}
      <div className="w-full max-w-6xl mb-10 bg-white rounded-3xl shadow-card-lg border border-brand-plum/30 p-8 flex flex-col gap-6 animate-slide-up" style={{ animationDelay: '0.2s' }}>
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-brand-mauve w-5 h-5" />
              <input
                type="text"
                placeholder="Search for skills (e.g., Photoshop, JavaScript, Guitar)"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-10 py-3 rounded-lg border border-brand-plum focus:ring-2 focus:ring-brand-orchid outline-none bg-white text-brand-plum placeholder-brand-mauve shadow"
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              />
            </div>
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 px-5 py-3 rounded-full bg-brand-mauve text-white font-semibold shadow-card hover:bg-brand-orchid transition-colors lg:w-auto"
          >
            <Filter className="w-4 h-4 mr-2" />
            Filters
          </button>
          <button
            onClick={handleSearch}
            className="flex items-center gap-2 px-5 py-3 rounded-full bg-brand-plum text-white font-semibold shadow-card hover:bg-brand-mauve transition-colors lg:w-auto"
          >
            <Search className="w-4 h-4 mr-2" />
            Search
          </button>
        </div>

        {/* Advanced Filters */}
        {showFilters && (
          <div className="mt-6 pt-6 border-t border-brand-orchid">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-brand-plum mb-1">
                  Location
                </label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 text-brand-mauve w-4 h-4" />
                  <input
                    type="text"
                    placeholder="Enter location"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="w-full px-10 py-2 rounded-lg border border-brand-plum focus:ring-2 focus:ring-brand-orchid outline-none bg-white text-brand-plum placeholder-brand-mauve shadow"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-brand-plum mb-1">
                  Availability
                </label>
                <div className="relative">
                  <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-brand-mauve w-4 h-4" />
                  <select
                    value={availability}
                    onChange={(e) => setAvailability(e.target.value)}
                    className="w-full px-10 py-2 rounded-lg border border-brand-plum focus:ring-2 focus:ring-brand-orchid outline-none bg-white text-brand-plum shadow"
                  >
                    <option value="">Any availability</option>
                    <option value="weekdays">Weekdays</option>
                    <option value="weekends">Weekends</option>
                    <option value="evenings">Evenings</option>
                    <option value="mornings">Mornings</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="mt-4 flex justify-between items-center">
              <button
                onClick={clearFilters}
                className="text-sm text-brand-plum hover:text-brand-orchid flex items-center"
              >
                <X className="w-4 h-4 mr-1" />
                Clear filters
              </button>
            </div>
          </div>
        )}
      </div>

      {/* User Cards */}
      <div className="w-full max-w-6xl mx-auto flex flex-col gap-8">
        {publicUsers.length === 0 ? (
          <div className="text-center py-12 animate-fade-in" style={{ animationDelay: '0.3s' }}>
            <p className="text-brand-orchid text-lg">No users found</p>
          </div>
        ) : (
          paginatedUsers.map((user, idx) => (
            <div
              key={user._id}
              className="w-full bg-white rounded-2xl shadow-card-lg border border-brand-orchid p-8 flex flex-row items-center gap-8 hover:shadow-2xl transition-shadow mx-auto relative group hover:scale-[1.02] transition-transform duration-200 animate-slide-up"
              style={{ animationDelay: `${0.15 + idx * 0.07}s` }}
            >
              {/* Left: Profile photo */}
              <div className="flex-shrink-0 flex flex-col items-center justify-center">
                {user.profilePhoto ? (
                  <img
                    src={user.profilePhoto}
                    alt={user.name}
                    className="w-28 h-28 rounded-full object-cover border-4 border-brand-plum shadow-lg"
                  />
                ) : (
                  <div className="w-28 h-28 bg-brand-plum rounded-full flex items-center justify-center text-5xl text-white font-bold shadow-lg border-4 border-brand-plum">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              {/* Center: Info */}
              <div className="flex-1 flex flex-col justify-center min-w-0">
                <div className="flex items-center gap-4 flex-wrap">
                  <h2 className="text-2xl font-bold text-brand-pink whitespace-nowrap">{user.name}</h2>
                  {user.location && (
                    <div className="text-brand-orchid flex items-center">
                      <MapPin className="w-4 h-4 mr-1" />
                      <span className="truncate">{user.location}</span>
                    </div>
                  )}
                </div>
                <div className="mt-2 flex flex-col md:flex-row md:items-center gap-2 md:gap-8">
                  <div>
                    <span className="text-sm font-semibold text-green-700">Skills Offered:</span>
                    <span className="ml-2 flex flex-wrap gap-2">
                      {user.skillsOffered.slice(0, 3).map((skill, index) => (
                        <span key={index} className="px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800 border border-green-300">
                          {skill.name}
                        </span>
                      ))}
                      {user.skillsOffered.length > 3 && (
                        <span className="text-xs text-green-700">
                          +{user.skillsOffered.length - 3} more
                        </span>
                      )}
                    </span>
                  </div>
                  <div>
                    <span className="text-sm font-semibold text-blue-700">Skill wanted:</span>
                    <span className="ml-2 flex flex-wrap gap-2">
                      {user.skillsWanted.slice(0, 3).map((skill, index) => (
                        <span key={index} className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-300">
                          {skill.name}
                        </span>
                      ))}
                      {user.skillsWanted.length > 3 && (
                        <span className="text-xs text-blue-700">
                          +{user.skillsWanted.length - 3} more
                        </span>
                      )}
                    </span>
                  </div>
                </div>
                <div className="mt-3 flex items-center text-sm text-brand-orchid">
                  <Clock className="w-4 h-4 mr-1" />
                  <span>{getAvailabilityText(user)}</span>
                </div>
              </div>
              {/* Right: Request/View Profile button and rating */}
              <div className="flex flex-col items-end justify-between h-full min-w-[160px] gap-4">
                {currentUser && user._id !== currentUser._id && (
                  <button
                    className="px-7 py-3 rounded-lg bg-brand-plum text-white font-bold shadow hover:bg-brand-mauve transition-colors text-lg"
                    onClick={() => openSwapModal(user)}
                  >
                    Request Swap
                  </button>
                )}
                <div className="text-right mt-4">
                  {typeof user.ratingAverage === 'number' && user.ratingCount > 0 ? (
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-yellow-100 text-yellow-800 font-bold text-sm shadow">
                      {renderStars(user.ratingAverage)}
                      {user.ratingAverage.toFixed(1)}/5
                      <span className="ml-1 text-xs text-gray-500">({user.ratingCount})</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-gray-100 text-gray-500 font-semibold text-sm shadow">
                      Not yet rated
                    </span>
                  )}
                  {/* Reviews preview: show all in recentReviews */}
                  {user.recentReviews && user.recentReviews.length > 0 && (
                    <div className="mt-2 text-left">
                      {user.recentReviews.map((review, i) => (
                        <div key={i} className="mb-2 p-2 bg-gray-50 rounded shadow-sm border border-gray-100">
                          <div className="flex items-center gap-2 mb-1">
                            {review.reviewer && review.reviewer.profilePhoto ? (
                              <img src={review.reviewer.profilePhoto} alt={review.reviewer.name} className="w-6 h-6 rounded-full object-cover" />
                            ) : (
                              <span className="w-6 h-6 rounded-full bg-gray-300 flex items-center justify-center text-xs font-bold text-gray-700">{review.reviewer && review.reviewer.name ? review.reviewer.name.charAt(0).toUpperCase() : '?'}</span>
                            )}
                            <span className="font-semibold text-xs text-brand-plum">{review.reviewer && review.reviewer.name}</span>
                            <span className="text-xs text-yellow-600 font-bold">{renderStars(review.rating)}</span>
                            <span className="text-xs text-gray-400 ml-2">{new Date(review.date).toLocaleDateString()}</span>
                          </div>
                          {review.comment && <div className="text-xs text-gray-700 italic">"{review.comment}"</div>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
      {/* Swap Modal */}
      {showSwapModal && swapTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md animate-fade-in">
            <h2 className="text-xl font-bold text-brand-plum mb-4">Request Swap with {swapTarget.name}</h2>
            <form
              onSubmit={e => { e.preventDefault(); handleSendSwap(); }}
              className="space-y-4"
            >
              <div>
                <label className="block text-brand-plum font-semibold mb-1">Choose one of your offered skills</label>
                <select
                  className="w-full px-4 py-2 rounded-lg border border-brand-orchid focus:ring-2 focus:ring-brand-pink outline-none bg-white/80"
                  value={mySkill}
                  onChange={e => setMySkill(e.target.value)}
                  required
                >
                  <option value="">Select a skill</option>
                  {currentUser?.skillsOffered?.map(skill => (
                    <option key={skill.name} value={skill.name}>{skill.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-brand-orchid font-semibold mb-1">Choose one of their offered skills</label>
                <select
                  className="w-full px-4 py-2 rounded-lg border border-brand-orchid focus:ring-2 focus:ring-brand-pink outline-none bg-white/80"
                  value={theirSkill}
                  onChange={e => setTheirSkill(e.target.value)}
                  required
                >
                  <option value="">Select a skill</option>
                  {swapTarget.skillsOffered?.map(skill => (
                    <option key={skill.name} value={skill.name}>{skill.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-brand-plum font-semibold mb-1">Message</label>
                <textarea
                  className="w-full px-4 py-2 rounded-lg border border-brand-orchid focus:ring-2 focus:ring-brand-pink outline-none bg-white/80"
                  value={swapMessage}
                  onChange={e => setSwapMessage(e.target.value)}
                  rows={3}
                  placeholder="Add a message..."
                />
              </div>
              <div className="flex gap-4 mt-6">
                <button
                  type="submit"
                  className="bg-brand-plum text-white font-bold px-6 py-2 rounded-lg shadow hover:bg-brand-mauve transition-colors disabled:opacity-60"
                  disabled={swapLoading}
                >
                  {swapLoading ? 'Sending...' : 'Submit'}
                </button>
                <button
                  type="button"
                  className="bg-white/80 text-brand-plum font-bold px-6 py-2 rounded-lg border border-brand-orchid shadow hover:bg-brand-orchid/30 transition-colors"
                  onClick={closeSwapModal}
                  disabled={swapLoading}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Pagination */}
      {totalPages > 1 && (
        <div className="w-full max-w-6xl flex justify-center mt-8">
          <nav className="flex items-center gap-2">
            <button
              className="px-3 py-1 rounded bg-brand-orchid text-white font-bold"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              {'<'}
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
              <button
                key={page}
                className={`px-3 py-1 rounded border border-brand-orchid text-brand-plum font-bold hover:bg-brand-orchid hover:text-white transition-colors ${page === currentPage ? 'bg-brand-orchid text-white' : ''}`}
                onClick={() => setCurrentPage(page)}
              >
                {page}
              </button>
            ))}
            <button
              className="px-3 py-1 rounded bg-brand-orchid text-white font-bold"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              {'>'}
            </button>
          </nav>
        </div>
      )}
    </div>
  );
};

export default Browse;