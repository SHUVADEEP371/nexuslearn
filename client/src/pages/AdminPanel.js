import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../config/api';
import LoadingSpinner from '../components/LoadingSpinner';
import { User as UserIcon, MapPin, Users, Layers, MessageCircle, Flag, BarChart2 } from 'lucide-react';

const summaryColors = [
  'bg-[#5D3C64]',
  'bg-[#7B466A]',
  'bg-[#9F6496]',
  'bg-[#D391B0]'
];

const AdminPanel = () => {
  const [activeTab, setActiveTab] = useState('skills');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const navigate = useNavigate();

  // Fetch all users for skill moderation
  useEffect(() => {
    if (activeTab === 'skills') {
      setLoading(true);
      setError('');
      api.get('/users/all')
        .then(res => {
          setUsers(res.data);
          setLoading(false);
        })
        .catch(err => {
          console.error('Failed to fetch users:', err);
          setError('Failed to fetch users. Please check your admin permissions.');
          setLoading(false);
        });
    }
  }, [activeTab]);

  useEffect(() => {
    const adminToken = localStorage.getItem('adminToken');
    if (!adminToken) {
      navigate('/admin/login');
    }
  }, [navigate]);

  // Remove a skill (offered or wanted)
  const handleRejectSkill = async (userId, skillId, type) => {
    setError('');
    setSuccess('');
    try {
      await api.delete(`/users/${type === 'offered' ? 'skills-offered' : 'skills-wanted'}/${skillId}`);
      setSuccess('Skill rejected successfully.');
      // Refresh users
      setUsers(users => users.map(u => {
        if (u._id !== userId) return u;
        return {
          ...u,
          skillsOffered: type === 'offered' ? u.skillsOffered.filter(s => s._id !== skillId) : u.skillsOffered,
          skillsWanted: type === 'wanted' ? u.skillsWanted.filter(s => s._id !== skillId) : u.skillsWanted,
        };
      }));
    } catch (err) {
      console.error('Failed to reject skill:', err);
      setError('Failed to reject skill. Please try again.');
    }
  };

  // Dashboard summary data (mocked for now)
  const summary = [
    { label: 'Users', value: users.length, icon: <Users className="w-6 h-6" /> },
    { label: 'Skills Offered', value: users.reduce((acc, u) => acc + (u.skillsOffered?.length || 0), 0), icon: <Layers className="w-6 h-6" /> },
    { label: 'Skills Wanted', value: users.reduce((acc, u) => acc + (u.skillsWanted?.length || 0), 0), icon: <BarChart2 className="w-6 h-6" /> },
    { label: 'Reports', value: 0, icon: <Flag className="w-6 h-6" /> },
  ];

  return (
    <div className="min-h-screen bg-[#F8F6FA] flex flex-col items-center">
      {/* Header */}
      <div className="w-full max-w-7xl flex flex-col md:flex-row items-center justify-between bg-white rounded-b-3xl shadow-lg px-10 py-8 border-b-4 border-[#D391B0] mt-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-4xl font-bold text-[#5D3C64]">Hi, Admin</h1>
          <p className="text-lg text-[#7B466A]">Ready to moderate skills and manage the platform?</p>
        </div>
        <div className="flex gap-4 mt-6 md:mt-0">
          <button
            className="bg-[#D391B0] text-[#0C0420] px-6 py-3 rounded-lg font-bold shadow hover:bg-[#BA6E8F] border border-[#7B466A] transition-colors"
            onClick={() => navigate('/')}
          >
            Back to Main
          </button>
          <button
            className="bg-[#7B466A] text-white px-6 py-3 rounded-lg font-bold shadow hover:bg-[#5D3C64] border border-[#5D3C64] transition-colors"
            onClick={() => {
              localStorage.removeItem('adminToken');
              navigate('/admin/login');
            }}
          >
            Logout
          </button>
        </div>
      </div>
      {/* Summary Cards */}
      <div className="w-full max-w-7xl grid grid-cols-2 md:grid-cols-4 gap-6 mt-8 mb-8">
        {summary.map((item, idx) => (
          <div key={item.label} className={`rounded-2xl shadow ${summaryColors[idx]} text-white p-6 flex flex-col items-center`}>
            {item.icon}
            <span className="text-2xl font-bold mt-2">{item.value}</span>
            <span className="mt-1 text-sm font-medium">{item.label}</span>
          </div>
        ))}
      </div>
      {/* Main Content Area */}
      <div className="w-full max-w-7xl flex gap-8">
        {/* Sidebar */}
        <div className="w-64 bg-white border border-[#E5D0E3] rounded-3xl shadow-lg flex flex-col py-8 px-4 gap-2">
          <button className={`flex items-center gap-3 text-left px-4 py-3 rounded-lg font-semibold transition-colors ${activeTab === 'skills' ? 'bg-[#D391B0] text-[#0C0420] shadow' : 'hover:bg-gray-100 text-[#5D3C64]'}`} onClick={() => setActiveTab('skills')}><Layers className="w-5 h-5" /> Skill Moderation</button>
          <button className={`flex items-center gap-3 text-left px-4 py-3 rounded-lg font-semibold transition-colors ${activeTab === 'users' ? 'bg-[#D391B0] text-[#0C0420] shadow' : 'hover:bg-gray-100 text-[#5D3C64]'}`} onClick={() => setActiveTab('users')}><Users className="w-5 h-5" /> User Management</button>
          <button className={`flex items-center gap-3 text-left px-4 py-3 rounded-lg font-semibold transition-colors ${activeTab === 'swaps' ? 'bg-[#D391B0] text-[#0C0420] shadow' : 'hover:bg-gray-100 text-[#5D3C64]'}`} onClick={() => setActiveTab('swaps')}><BarChart2 className="w-5 h-5" /> Swap Monitoring</button>
          <button className={`flex items-center gap-3 text-left px-4 py-3 rounded-lg font-semibold transition-colors ${activeTab === 'messages' ? 'bg-[#D391B0] text-[#0C0420] shadow' : 'hover:bg-gray-100 text-[#5D3C64]'}`} onClick={() => setActiveTab('messages')}><MessageCircle className="w-5 h-5" /> Platform Messages</button>
          <button className={`flex items-center gap-3 text-left px-4 py-3 rounded-lg font-semibold transition-colors ${activeTab === 'reports' ? 'bg-[#D391B0] text-[#0C0420] shadow' : 'hover:bg-gray-100 text-[#5D3C64]'}`} onClick={() => setActiveTab('reports')}><Flag className="w-5 h-5" /> Reports</button>
        </div>
        {/* Main Content */}
        <div className="flex-1 min-h-[500px] bg-white rounded-3xl shadow-lg border-2 border-[#9F6496] p-10 flex flex-col gap-8 animate-fade-in transition-all duration-500 mt-0">
          {activeTab === 'skills' && (
            <div>
              <h2 className="text-2xl font-bold mb-4 text-[#5D3C64]">Skill Moderation</h2>
              <p className="mb-4 text-[#7B466A]">Review and reject inappropriate or spammy skill descriptions here.</p>
              {loading ? <LoadingSpinner /> : (
                <>
                  {error && <div className="text-red-600 mb-4 font-semibold bg-red-50 border border-red-200 rounded-lg px-4 py-2 shadow">{error}</div>}
                  {success && <div className="text-green-600 mb-4 font-semibold bg-green-50 border border-green-200 rounded-lg px-4 py-2 shadow">{success}</div>}
                  <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-2">
                    {users.length === 0 && <div className="text-gray-400">No users found.</div>}
                    {users.filter(user => user._id !== 'admin').map(user => (
                      <div key={user._id} className="w-full bg-white/80 rounded-2xl shadow-lg border-2 border-[#D391B0] p-8 flex flex-col md:flex-row items-center gap-8 hover:shadow-2xl transition-shadow mx-auto relative">
                        {/* Avatar */}
                        <div className="flex-shrink-0 flex flex-col items-center justify-center">
                          {user.profilePhoto ? (
                            <img src={user.profilePhoto} alt="avatar" className="w-28 h-28 rounded-full object-cover border-4 border-[#7B466A] shadow-lg" />
                          ) : (
                            <div className="w-28 h-28 bg-[#7B466A] rounded-full flex items-center justify-center text-5xl text-white font-bold shadow-lg border-4 border-[#7B466A]">
                              <UserIcon className="w-14 h-14" />
                            </div>
                          )}
                        </div>
                        {/* User Info and Skills */}
                        <div className="flex-1 flex flex-col gap-3 justify-center">
                          <div className="flex flex-col md:flex-row md:items-center md:gap-4 mb-2">
                            <span className="font-bold text-2xl text-[#0C0420]">{user.name}</span>
                            {user.location && (
                              <span className="flex items-center gap-1 text-[#7B466A] text-base mt-1 md:mt-0"><MapPin className="w-5 h-5" />{user.location}</span>
                            )}
                          </div>
                          <div className="mt-2">
                            <span className="font-semibold text-[#5D3C64] block mb-1">Skills Offered:</span>
                            <div className="flex flex-wrap gap-3">
                              {user.skillsOffered && user.skillsOffered.length > 0 ? user.skillsOffered.map(skill => (
                                <span key={skill._id} className="inline-flex items-center gap-2 px-5 py-2 rounded-full border-2 border-[#D391B0] bg-white text-[#7B466A] font-semibold shadow-sm text-base">
                                  {skill.name}
                                  <button className="ml-1 px-2 py-0.5 rounded-full text-xs font-bold text-white bg-[#D391B0] hover:bg-[#BA6E8F] transition-colors" onClick={() => handleRejectSkill(user._id, skill._id, 'offered')}>Reject</button>
                                </span>
                              )) : <span className="text-gray-400 ml-2">None</span>}
                            </div>
                          </div>
                          <div className="mt-2">
                            <span className="font-semibold text-[#5D3C64] block mb-1">Skills Wanted:</span>
                            <div className="flex flex-wrap gap-3">
                              {user.skillsWanted && user.skillsWanted.length > 0 ? user.skillsWanted.map(skill => (
                                <span key={skill._id} className="inline-flex items-center gap-2 px-5 py-2 rounded-full border-2 border-[#7B466A] bg-white text-[#0C0420] font-semibold shadow-sm text-base">
                                  {skill.name}
                                  <button className="ml-1 px-2 py-0.5 rounded-full text-xs font-bold text-white bg-[#7B466A] hover:bg-[#5D3C64] transition-colors" onClick={() => handleRejectSkill(user._id, skill._id, 'wanted')}>Reject</button>
                                </span>
                              )) : <span className="text-gray-400 ml-2">None</span>}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
          {activeTab === 'users' && (
            <div className="max-h-[60vh] overflow-y-auto pr-2">
              <h2 className="text-2xl font-bold mb-4 text-[#5D3C64]">User Management</h2>
              <p className="text-[#7B466A] mb-4">Ban users, view user details, and manage user accounts here.</p>
              {/* User management content goes here */}
            </div>
          )}
          {activeTab === 'swaps' && (
            <div className="max-h-[60vh] overflow-y-auto pr-2">
              <h2 className="text-2xl font-bold mb-4 text-[#5D3C64]">Swap Monitoring</h2>
              <p className="text-[#7B466A] mb-4">Monitor all swaps (pending, accepted, cancelled) here.</p>
              {/* Swap monitoring content goes here */}
            </div>
          )}
          {activeTab === 'messages' && (
            <div className="max-h-[60vh] overflow-y-auto pr-2">
              <h2 className="text-2xl font-bold mb-4 text-[#5D3C64]">Platform Messages</h2>
              <p className="text-[#7B466A] mb-4">Send platform-wide messages and alerts here.</p>
              {/* Platform messages content goes here */}
            </div>
          )}
          {activeTab === 'reports' && (
            <div className="max-h-[60vh] overflow-y-auto pr-2">
              <h2 className="text-2xl font-bold mb-4 text-[#5D3C64]">Reports</h2>
              <p className="text-[#7B466A] mb-4">Download user activity, feedback logs, and swap stats here.</p>
              {/* Reports content goes here */}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminPanel; 