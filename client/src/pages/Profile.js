import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import toast from 'react-hot-toast';
import { Edit, X, MapPin, Clock, Star, User, LogOut, Camera } from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';
import api from '../config/api';
import { useNavigate } from 'react-router-dom';

const Profile = () => {
  const navigate = useNavigate();
  const { user, updateUser, logout } = useAuth();
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [profileData, setProfileData] = useState({
    name: user?.name || '',
    location: user?.location || '',
    bio: user?.bio || '',
    isPublic: user?.isPublic ?? true,
    availability: user?.availability || {
      weekdays: false,
      weekends: false,
      evenings: false,
      mornings: false,
      customSchedule: ''
    }
  });
  const [profilePhotoFile, setProfilePhotoFile] = useState(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [newSkillOffered, setNewSkillOffered] = useState({ name: '', description: '', proficiency: 'Intermediate' });
  const [newSkillWanted, setNewSkillWanted] = useState({ name: '', description: '', priority: 'Medium' });
  const [showAddSkillOffered, setShowAddSkillOffered] = useState(false);
  const [showAddSkillWanted, setShowAddSkillWanted] = useState(false);

  useEffect(() => {
    if (user) {
      setProfileData({
        name: user.name || '',
        location: user.location || '',
        bio: user.bio || '',
        isPublic: user.isPublic ?? true,
        availability: user.availability || {
          weekdays: false,
          weekends: false,
          evenings: false,
          mornings: false,
          customSchedule: ''
        }
      });
    }
    // Listen for refresh-users event to update profile
    const handler = async () => {
      try {
        const response = await api.get('/auth/me');
        updateUser(response.data.user);
      } catch (e) {}
    };
    window.addEventListener('refresh-users', handler);
    return () => window.removeEventListener('refresh-users', handler);
  }, [user, updateUser]);

  const handleSave = async () => {
    try {
      setLoading(true);
      const response = await api.put('/users/profile', {
        name: profileData.name,
        location: profileData.location,
        bio: profileData.bio,
        isPublic: profileData.isPublic,
        availability: profileData.availability
      });
      updateUser(response.data);
      setEditing(false);
      toast.success('Profile updated successfully!');
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error('Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handleAddSkillOffered = async () => {
    try {
      const response = await api.post('/users/skills-offered', newSkillOffered);
      updateUser({ ...user, skillsOffered: response.data });
      setNewSkillOffered({ name: '', description: '', proficiency: 'Intermediate' });
      setShowAddSkillOffered(false);
      toast.success('Skill added successfully!');
    } catch (error) {
      console.error('Error adding skill:', error);
      toast.error(error.response?.data?.message || 'Failed to add skill');
    }
  };

  const handleAddSkillWanted = async () => {
    try {
      const response = await api.post('/users/skills-wanted', newSkillWanted);
      updateUser({ ...user, skillsWanted: response.data });
      setNewSkillWanted({ name: '', description: '', priority: 'Medium' });
      setShowAddSkillWanted(false);
      toast.success('Skill added successfully!');
    } catch (error) {
      console.error('Error adding skill:', error);
      toast.error(error.response?.data?.message || 'Failed to add skill');
    }
  };

  const handleRemoveSkillOffered = async (skillId) => {
    try {
      const response = await api.delete(`/users/skills-offered/${skillId}`);
      updateUser({ ...user, skillsOffered: response.data });
      toast.success('Skill removed successfully!');
    } catch (error) {
      console.error('Error removing skill:', error);
      toast.error('Failed to remove skill');
    }
  };

  const handleRemoveSkillWanted = async (skillId) => {
    try {
      const response = await api.delete(`/users/skills-wanted/${skillId}`);
      updateUser({ ...user, skillsWanted: response.data });
      toast.success('Skill removed successfully!');
    } catch (error) {
      console.error('Error removing skill:', error);
      toast.error('Failed to remove skill');
    }
  };

  const renderStars = (rating) => {
    const stars = [];
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 !== 0;

    for (let i = 0; i < fullStars; i++) {
      stars.push(<Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />);
    }

    if (hasHalfStar) {
      stars.push(<Star key="half" className="w-4 h-4 fill-yellow-400 text-yellow-400" />);
    }

    const emptyStars = 5 - Math.ceil(rating);
    for (let i = 0; i < emptyStars; i++) {
      stars.push(<Star key={`empty-${i}`} className="w-4 h-4 text-gray-300" />);
    }

    return stars;
  };

  // Profile photo upload handler
  const handlePhotoChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setPhotoUploading(true);
    const formData = new FormData();
    formData.append('photo', file);
    try {
      const response = await api.post('/users/profile-photo', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      updateUser(response.data.user);
      toast.success('Profile photo updated!');
      setProfilePhotoFile(null);
    } catch (error) {
      toast.error('Failed to upload photo');
    } finally {
      setPhotoUploading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  if (!user) {
    return <LoadingSpinner size="lg" className="py-20" />;
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-start bg-white pt-2 pb-10 px-2">
      {/* Header with greeting and illustration */}
      <div className="w-full max-w-6xl flex flex-col items-start justify-between mb-6 mt-16">
        <h1 className="text-4xl font-bold text-brand-plum mb-2">Hi, {user.name}</h1>
        <p className="text-lg text-brand-orchid">Welcome back! Ready to swap some skills today?</p>
      </div>
      {/* Stat Cards */}
      <div className="w-full max-w-6xl grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
        <div className="rounded-2xl shadow bg-[#5D3C64] text-white p-6 flex flex-col items-center">
          <span className="text-2xl font-bold">{user.skillsOffered?.length || 0}</span>
          <span className="mt-2 text-sm font-medium">Skills Offered</span>
        </div>
        <div className="rounded-2xl shadow bg-[#7B466A] text-white p-6 flex flex-col items-center">
          <span className="text-2xl font-bold">{user.skillsWanted?.length || 0}</span>
          <span className="mt-2 text-sm font-medium">Skills Wanted</span>
        </div>
        <div className="rounded-2xl shadow bg-[#9F6496] text-white p-6 flex flex-col items-center">
          <span className="text-2xl font-bold">{typeof user.swapsCompleted === 'number' ? user.swapsCompleted : 0}</span>
          <span className="mt-2 text-sm font-medium">Swaps Completed</span>
        </div>
        <div className="rounded-2xl shadow bg-[#0C0420] text-white p-6 flex flex-col items-center">
          <span className="text-2xl font-bold">{typeof user.ratingAverage === 'number' ? user.ratingAverage.toFixed(1) : '0.0'}</span>
          <span className="mt-2 text-sm font-medium">Rating</span>
        </div>
      </div>
      {/* Main Card with all details */}
      <div className="w-full max-w-6xl bg-white rounded-3xl shadow-lg border-2 border-[#9F6496] p-12 flex flex-col gap-10 animate-fade-in transition-all duration-500 relative">
        {/* Edit button at top right */}
        {!editing && (
          <button
            onClick={() => setEditing(true)}
            className="absolute top-6 right-6 bg-[#D391B0] text-[#0C0420] hover:bg-[#BA6E8F] px-6 py-3 rounded-lg flex items-center gap-2 font-bold shadow z-20"
            title="Edit Profile"
            style={{ zIndex: 20 }}
          >
            <Edit className="w-5 h-5" /> Edit
          </button>
        )}
        {/* Profile Info */}
        <div className="flex flex-col md:flex-row items-center gap-8 mb-6 relative">
          <div className="flex-shrink-0 flex flex-col items-center gap-2 relative">
            {user.profilePhoto ? (
              <div className="relative">
                <img src={user.profilePhoto} alt={user.name} className="w-32 h-32 rounded-full object-cover border-4 border-[#7B466A] shadow-lg" />
                {editing && (
                  <label className="absolute bottom-2 right-2 bg-[#D391B0] rounded-full p-2 cursor-pointer shadow-lg hover:bg-[#BA6E8F] transition-colors flex items-center justify-center">
                    <Camera className="w-6 h-6 text-[#0C0420]" />
                    <input type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} disabled={photoUploading} />
                  </label>
                )}
              </div>
            ) : (
              <div className="w-32 h-32 bg-[#7B466A] rounded-full flex items-center justify-center relative">
                <span className="text-white font-bold text-5xl">{user.name.charAt(0).toUpperCase()}</span>
                {editing && (
                  <label className="absolute bottom-2 right-2 bg-[#D391B0] rounded-full p-2 cursor-pointer shadow-lg hover:bg-[#BA6E8F] transition-colors flex items-center justify-center">
                    <Camera className="w-6 h-6 text-[#0C0420]" />
                    <input type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} disabled={photoUploading} />
                  </label>
                )}
              </div>
            )}
          </div>
          <div className="flex-1 w-full">
            {editing ? (
              <form
                className="space-y-4"
                onSubmit={async (e) => {
                  e.preventDefault();
                  setLoading(true);
                  try {
                    const response = await api.put('/users/profile', {
                      name: profileData.name,
                      location: profileData.location,
                      bio: profileData.bio,
                      isPublic: profileData.isPublic,
                      availability: profileData.availability
                    });
                    updateUser(response.data);
                    setEditing(false);
                    toast.success('Profile updated successfully!');
                  } catch (error) {
                    toast.error('Failed to update profile');
                  } finally {
                    setLoading(false);
                  }
                }}
              >
                <div>
                  <label className="block text-[#0C0420] font-semibold mb-1">Name</label>
                  <input
                    type="text"
                    className="w-full px-4 py-2 rounded-lg border border-[#7B466A] focus:ring-2 focus:ring-[#D391B0] outline-none bg-white"
                    value={profileData.name}
                    onChange={e => setProfileData({ ...profileData, name: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="block text-[#0C0420] font-semibold mb-1">Location <span className="text-xs text-[#9F6496]">(optional)</span></label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      className="w-full px-4 py-2 rounded-lg border border-[#7B466A] focus:ring-2 focus:ring-[#D391B0] outline-none bg-white"
                      value={profileData.location}
                      onChange={e => setProfileData({ ...profileData, location: e.target.value })}
                      placeholder="Enter your city, state, country or use GPS"
                    />
                    <button
                      type="button"
                      className="flex items-center gap-1 px-3 py-2 rounded-lg bg-[#D391B0] text-[#0C0420] font-semibold shadow hover:bg-[#BA6E8F] transition-colors"
                      onClick={async () => {
                        if (!navigator.geolocation) {
                          toast.error('Geolocation is not supported by your browser');
                          return;
                        }
                        toast.loading('Getting your location...');
                        navigator.geolocation.getCurrentPosition(async (position) => {
                          try {
                            const { latitude, longitude } = position.coords;
                            // Use a free reverse geocoding API (e.g., OpenStreetMap Nominatim)
                            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`);
                            const data = await res.json();
                            const city = data.address.city || data.address.town || data.address.village || '';
                            const state = data.address.state || data.address.state_district || '';
                            const country = data.address.country || '';
                            const locationString = [city, state, country].filter(Boolean).join(', ');
                            setProfileData(pd => ({ ...pd, location: locationString }));
                            toast.dismiss();
                            toast.success('Location updated!');
                          } catch (err) {
                            toast.dismiss();
                            toast.error('Could not determine location');
                          }
                        }, (err) => {
                          toast.dismiss();
                          toast.error('Location access denied');
                        });
                      }}
                      title="Use my current location"
                    >
                      <MapPin className="w-4 h-4" /> Use My Location
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-[#0C0420] font-semibold mb-1">Bio <span className="text-xs text-[#9F6496]">(optional)</span></label>
                  <textarea
                    className="w-full px-4 py-2 rounded-lg border border-[#7B466A] focus:ring-2 focus:ring-[#D391B0] outline-none bg-white"
                    value={profileData.bio}
                    onChange={e => setProfileData({ ...profileData, bio: e.target.value })}
                    rows={3}
                  />
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="isPublic"
                    checked={profileData.isPublic}
                    onChange={e => setProfileData({ ...profileData, isPublic: e.target.checked })}
                  />
                  <label htmlFor="isPublic" className="text-[#0C0420] font-semibold">Public Profile</label>
                </div>
                <div className="flex gap-4 mt-6">
                  <button
                    type="submit"
                    className="bg-[#7B466A] text-white font-bold px-6 py-2 rounded-lg shadow hover:bg-[#5D3C64] transition-colors disabled:opacity-60"
                    disabled={loading}
                  >
                    {loading ? 'Saving...' : 'Save'}
                  </button>
                  <button
                    type="button"
                    className="bg-white text-[#0C0420] font-bold px-6 py-2 rounded-lg border border-[#7B466A] shadow hover:bg-[#D391B0] transition-colors"
                    onClick={() => setEditing(false)}
                    disabled={loading}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <>
                <h2 className="text-2xl font-bold text-[#0C0420] mb-1">{user.name}</h2>
                {user.location && (
                  <div className="text-[#5D3C64] mb-2">{user.location}</div>
                )}
                <div className="flex items-center gap-2 mb-2">
                  {renderStars(user.rating && typeof user.rating.average === 'number' ? user.rating.average : 5.0)}
                  <span className="text-sm text-[#9F6496]">({user.rating && typeof user.rating.count === 'number' ? user.rating.count : 0} reviews)</span>
                </div>
                {user.bio && (
                  <div className="text-md text-[#0C0420] mb-2">{user.bio}</div>
                )}
                <div className="flex items-center gap-4 text-xs text-[#9F6496]">
                  <span>Joined: {new Date(user.createdAt).toLocaleDateString()}</span>
                  <span>|</span>
                  <span>Public Profile: {user.isPublic ? 'Yes' : 'No'}</span>
                </div>
              </>
            )}
          </div>
        </div>
        {/* Skills Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Skills Offered */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-[#5D3C64]">Skills Offered</span>
              <button
                className="bg-[#7B466A] text-white px-3 py-1 rounded-lg shadow hover:bg-[#5D3C64] text-xs font-bold"
                onClick={() => setShowAddSkillOffered(v => !v)}
              >
                {showAddSkillOffered ? 'Cancel' : 'Add'}
              </button>
            </div>
            {showAddSkillOffered && (
              <form
                className="space-y-2 mb-4"
                onSubmit={async (e) => {
                  e.preventDefault();
                  await handleAddSkillOffered();
                }}
              >
                <input
                  type="text"
                  placeholder="Skill name"
                  className="w-full px-3 py-1 rounded border border-[#7B466A] bg-white focus:ring-2 focus:ring-[#D391B0]"
                  value={newSkillOffered.name}
                  onChange={e => setNewSkillOffered({ ...newSkillOffered, name: e.target.value })}
                  required
                />
                <input
                  type="text"
                  placeholder="Description (optional)"
                  className="w-full px-3 py-1 rounded border border-[#7B466A] bg-white focus:ring-2 focus:ring-[#D391B0]"
                  value={newSkillOffered.description}
                  onChange={e => setNewSkillOffered({ ...newSkillOffered, description: e.target.value })}
                />
                <select
                  className="w-full px-3 py-1 rounded border border-[#7B466A] bg-white focus:ring-2 focus:ring-[#D391B0]"
                  value={newSkillOffered.proficiency}
                  onChange={e => setNewSkillOffered({ ...newSkillOffered, proficiency: e.target.value })}
                >
                  <option>Beginner</option>
                  <option>Intermediate</option>
                  <option>Advanced</option>
                  <option>Expert</option>
                </select>
                <button
                  type="submit"
                  className="w-full bg-[#7B466A] text-white font-bold px-4 py-1 rounded-lg shadow hover:bg-[#5D3C64] mt-2"
                >
                  Add Skill
                </button>
              </form>
            )}
            <div className="space-y-2">
              {user.skillsOffered && user.skillsOffered.length > 0 ? (
                user.skillsOffered.map((skill, idx) => (
                  <div key={skill._id || idx} className="flex items-center gap-3 bg-[#D391B0]/30 rounded-lg px-3 py-2 shadow border border-[#7B466A]">
                    <div className="flex-1">
                      <div className="font-semibold text-[#0C0420]">{skill.name}</div>
                      <div className="text-xs text-[#5D3C64]">{skill.description}</div>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-[#7B466A] text-white border border-[#5D3C64]">{skill.proficiency}</span>
                    <button
                      className="ml-2 text-xs text-[#BA6E8F] hover:text-[#0C0420] font-bold"
                      onClick={() => handleRemoveSkillOffered(skill._id)}
                    >
                      Remove
                    </button>
                  </div>
                ))
              ) : (
                <div className="text-[#5D3C64]">No skills offered yet.</div>
              )}
            </div>
          </div>
          {/* Skills Wanted */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-[#5D3C64]">Skills Wanted</span>
              <button
                className="bg-[#9F6496] text-white px-3 py-1 rounded-lg shadow hover:bg-[#7B466A] text-xs font-bold"
                onClick={() => setShowAddSkillWanted(v => !v)}
              >
                {showAddSkillWanted ? 'Cancel' : 'Add'}
              </button>
            </div>
            {showAddSkillWanted && (
              <form
                className="space-y-2 mb-4"
                onSubmit={async (e) => {
                  e.preventDefault();
                  await handleAddSkillWanted();
                }}
              >
                <input
                  type="text"
                  placeholder="Skill name"
                  className="w-full px-3 py-1 rounded border border-[#9F6496] bg-white focus:ring-2 focus:ring-[#D391B0]"
                  value={newSkillWanted.name}
                  onChange={e => setNewSkillWanted({ ...newSkillWanted, name: e.target.value })}
                  required
                />
                <input
                  type="text"
                  placeholder="Description (optional)"
                  className="w-full px-3 py-1 rounded border border-[#9F6496] bg-white focus:ring-2 focus:ring-[#D391B0]"
                  value={newSkillWanted.description}
                  onChange={e => setNewSkillWanted({ ...newSkillWanted, description: e.target.value })}
                />
                <select
                  className="w-full px-3 py-1 rounded border border-[#9F6496] bg-white focus:ring-2 focus:ring-[#D391B0]"
                  value={newSkillWanted.priority}
                  onChange={e => setNewSkillWanted({ ...newSkillWanted, priority: e.target.value })}
                >
                  <option>Low</option>
                  <option>Medium</option>
                  <option>High</option>
                </select>
                <button
                  type="submit"
                  className="w-full bg-[#9F6496] text-white font-bold px-4 py-1 rounded-lg shadow hover:bg-[#7B466A] mt-2"
                >
                  Add Skill
                </button>
              </form>
            )}
            <div className="space-y-2">
              {user.skillsWanted && user.skillsWanted.length > 0 ? (
                user.skillsWanted.map((skill, idx) => (
                  <div key={skill._id || idx} className="flex items-center gap-3 bg-[#D391B0]/30 rounded-lg px-3 py-2 shadow border border-[#9F6496]">
                    <div className="flex-1">
                      <div className="font-semibold text-[#0C0420]">{skill.name}</div>
                      <div className="text-xs text-[#5D3C64]">{skill.description}</div>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-[#9F6496] text-white border border-[#5D3C64]">{skill.priority}</span>
                    <button
                      className="ml-2 text-xs text-[#BA6E8F] hover:text-[#0C0420] font-bold"
                      onClick={() => handleRemoveSkillWanted(skill._id)}
                    >
                      Remove
                    </button>
                  </div>
                ))
              ) : (
                <div className="text-[#5D3C64]">No skills wanted yet.</div>
              )}
            </div>
          </div>
        </div>
        {/* Availability Section */}
        <div className="bg-[#D391B0]/20 rounded-2xl p-6 mt-6">
          <h3 className="text-xl font-bold text-[#0C0420] mb-4">Availability</h3>
          {editing ? (
            <form
              className="space-y-4"
              onSubmit={async (e) => {
                e.preventDefault();
                setLoading(true);
                try {
                  const response = await api.put('/users/profile', {
                    name: profileData.name,
                    location: profileData.location,
                    bio: profileData.bio,
                    isPublic: profileData.isPublic,
                    availability: profileData.availability
                  });
                  updateUser(response.data);
                  setEditing(false);
                  toast.success('Profile updated successfully!');
                } catch (error) {
                  toast.error('Failed to update profile');
                } finally {
                  setLoading(false);
                }
              }}
            >
              <div className="flex flex-wrap gap-6">
                <label className="flex items-center gap-2 text-[#0C0420] font-semibold">
                  <input
                    type="checkbox"
                    checked={profileData.availability.weekdays}
                    onChange={e => setProfileData({
                      ...profileData,
                      availability: { ...profileData.availability, weekdays: e.target.checked }
                    })}
                  />
                  Weekdays
                </label>
                <label className="flex items-center gap-2 text-[#0C0420] font-semibold">
                  <input
                    type="checkbox"
                    checked={profileData.availability.weekends}
                    onChange={e => setProfileData({
                      ...profileData,
                      availability: { ...profileData.availability, weekends: e.target.checked }
                    })}
                  />
                  Weekends
                </label>
                <label className="flex items-center gap-2 text-[#0C0420] font-semibold">
                  <input
                    type="checkbox"
                    checked={profileData.availability.evenings}
                    onChange={e => setProfileData({
                      ...profileData,
                      availability: { ...profileData.availability, evenings: e.target.checked }
                    })}
                  />
                  Evenings
                </label>
                <label className="flex items-center gap-2 text-[#0C0420] font-semibold">
                  <input
                    type="checkbox"
                    checked={profileData.availability.mornings}
                    onChange={e => setProfileData({
                      ...profileData,
                      availability: { ...profileData.availability, mornings: e.target.checked }
                    })}
                  />
                  Mornings
                </label>
              </div>
              <div>
                <label className="block text-[#0C0420] font-semibold mb-1">Custom Schedule <span className="text-xs text-[#9F6496]">(optional)</span></label>
                <input
                  type="text"
                  className="w-full px-4 py-2 rounded-lg border border-[#7B466A] focus:ring-2 focus:ring-[#D391B0] outline-none bg-white"
                  value={profileData.availability.customSchedule}
                  onChange={e => setProfileData({
                    ...profileData,
                    availability: { ...profileData.availability, customSchedule: e.target.value }
                  })}
                />
              </div>
              <div className="flex gap-4 mt-6">
                <button
                  type="submit"
                  className="bg-[#7B466A] text-white font-bold px-6 py-2 rounded-lg shadow hover:bg-[#5D3C64] transition-colors disabled:opacity-60"
                  disabled={loading}
                >
                  {loading ? 'Saving...' : 'Save'}
                </button>
                <button
                  type="button"
                  className="bg-white text-[#0C0420] font-bold px-6 py-2 rounded-lg border border-[#7B466A] shadow hover:bg-[#D391B0] transition-colors"
                  onClick={() => setEditing(false)}
                  disabled={loading}
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <>
              <div className="flex flex-wrap gap-6 mb-4">
                <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${user.availability?.weekdays ? 'bg-[#D391B0] text-[#0C0420] border-[#7B466A]' : 'bg-gray-100 text-gray-400 border-gray-200'}`}>Weekdays: {user.availability?.weekdays ? 'Yes' : 'No'}</span>
                <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${user.availability?.weekends ? 'bg-[#D391B0] text-[#0C0420] border-[#7B466A]' : 'bg-gray-100 text-gray-400 border-gray-200'}`}>Weekends: {user.availability?.weekends ? 'Yes' : 'No'}</span>
                <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${user.availability?.evenings ? 'bg-[#D391B0] text-[#0C0420] border-[#7B466A]' : 'bg-gray-100 text-gray-400 border-gray-200'}`}>Evenings: {user.availability?.evenings ? 'Yes' : 'No'}</span>
                <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${user.availability?.mornings ? 'bg-[#D391B0] text-[#0C0420] border-[#7B466A]' : 'bg-gray-100 text-gray-400 border-gray-200'}`}>Mornings: {user.availability?.mornings ? 'Yes' : 'No'}</span>
              </div>
              <div className="text-[#0C0420] mb-2">Custom: {user.availability?.customSchedule || <span className="text-gray-400">None</span>}</div>
            </>
          )}
        </div>
        <div className="flex w-full justify-between items-end mt-8">
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2 bg-[#5D3C64] hover:bg-[#4A2F4F] text-white rounded-lg font-semibold shadow-md transition-colors duration-200"
          >
            <LogOut className="w-5 h-5" /> Logout
          </button>
        </div>
      </div>
    </div>
  );
};

export default Profile;