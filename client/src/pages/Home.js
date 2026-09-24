import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { 
  Search, 
  ArrowRight,
  Code,
  Palette,
  Music,
  Camera,
  BookOpen,
  Repeat,
  Star,
  Users
} from 'lucide-react';

// Helper for random stars
const StarField = ({ count = 60 }) => (
  <>
    {Array.from({ length: count }).map((_, i) => (
      <div
        key={i}
        className="star"
        style={{
          top: `${Math.random() * 40 + 2}%`,
          left: `${Math.random() * 98}%`,
          width: `${Math.random() * 2 + 1.5}px`,
          height: `${Math.random() * 2 + 1.5}px`,
          opacity: Math.random() * 0.5 + 0.5
        }}
      />
    ))}
  </>
);

// SVG Moon
const Moon = () => (
  <svg style={{position:'absolute',top:32,right:64,zIndex:2}} width="48" height="48" viewBox="0 0 48 48" fill="none">
    <circle cx="28" cy="20" r="16" fill="#fff" fillOpacity="0.9" />
    <circle cx="34" cy="18" r="13" fill="#0C0420" />
  </svg>
);

// SVG Hill
const Hill = () => (
  <svg
    width="100%"
    height="100%"
    viewBox="0 0 1440 180"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    preserveAspectRatio="none"
    style={{ display: 'block' }}
  >
    <path d="M0 80 Q 360 180 720 80 T 1440 80 V180 H0Z" fill="#5D3C64" />
  </svg>
);

// SVG Constellation
const Constellation = () => (
  <svg width="340" height="180" viewBox="0 0 340 180" fill="none" style={{margin:'0 auto',display:'block'}}>
    <circle cx="30" cy="120" r="4" fill="#D391B0" />
    <circle cx="90" cy="60" r="4" fill="#BA6E8F" />
    <circle cx="170" cy="90" r="4" fill="#9F6496" />
    <circle cx="250" cy="40" r="4" fill="#7B466A" />
    <circle cx="310" cy="100" r="4" fill="#5D3C64" />
    <polyline points="30,120 90,60 170,90 250,40 310,100" stroke="#fff" strokeWidth="2" fill="none" />
  </svg>
);

// Animated floating constellation for hero
const FloatingConstellation = () => (
  <svg width="220" height="120" viewBox="0 0 220 120" fill="none" className="animate-float-slow hidden md:block absolute right-[-260px] top-10 z-10">
    <circle cx="30" cy="80" r="4" fill="#D391B0" />
    <circle cx="90" cy="30" r="4" fill="#BA6E8F" />
    <circle cx="170" cy="60" r="4" fill="#9F6496" />
    <circle cx="200" cy="100" r="4" fill="#5D3C64" />
    <polyline points="30,80 90,30 170,60 200,100" stroke="#fff" strokeWidth="2" fill="none" />
  </svg>
);

const features = [
  {
    icon: <Search className="w-8 h-8 text-brand-pink group-hover:animate-bounce" />,
    title: 'Find Skills',
    description: 'Browse through thousands of skills offered by our community members.'
  },
  {
    icon: <Repeat className="w-8 h-8 text-brand-pink group-hover:animate-bounce" />,
    title: 'Exchange Skills',
    description: 'Request skill swaps and connect with people who can help you learn.'
  },
  {
    icon: <Star className="w-8 h-8 text-brand-pink group-hover:animate-bounce" />,
    title: 'Rate & Review',
    description: 'Build trust through ratings and reviews after completing swaps.'
  },
  {
    icon: <Users className="w-8 h-8 text-brand-pink group-hover:animate-bounce" />,
    title: 'Build Community',
    description: 'Join a community of learners and teachers from around the world.'
  }
];

const Home = () => {
  const { isAuthenticated } = useAuth();
  // Animation refs
  const heroRef = useRef();
  const featuresRef = useRef();
  const skillsRef = useRef();
  const ctaRef = useRef();
  const heroBtnRef = useRef();
  const [glow, setGlow] = useState(false);

  useEffect(() => {
    // Animate sections in on mount
    const animate = (ref, delay = 0) => {
      if (ref.current) {
        ref.current.style.transition = 'opacity 0.8s cubic-bezier(0.4,0,0.2,1), transform 0.8s cubic-bezier(0.4,0,0.2,1)';
        ref.current.style.opacity = 1;
        ref.current.style.transform = 'none';
      }
    };
    setTimeout(() => animate(heroRef), 100);
    setTimeout(() => animate(featuresRef), 400);
    setTimeout(() => animate(skillsRef), 700);
    setTimeout(() => animate(ctaRef), 1000);
    setTimeout(() => setGlow(true), 300);
    setTimeout(() => {
      if (heroBtnRef.current) {
        heroBtnRef.current.style.transition = 'opacity 0.7s cubic-bezier(0.4,0,0.2,1), transform 0.7s cubic-bezier(0.4,0,0.2,1)';
        heroBtnRef.current.style.opacity = 1;
        heroBtnRef.current.style.transform = 'none';
      }
    }, 600);
  }, []);

  const popularSkills = [
    { name: 'JavaScript', icon: <Code className="w-5 h-5" />, color: 'bg-yellow-100 text-yellow-800' },
    { name: 'Photoshop', icon: <Palette className="w-5 h-5" />, color: 'bg-blue-100 text-blue-800' },
    { name: 'Guitar', icon: <Music className="w-5 h-5" />, color: 'bg-green-100 text-green-800' },
    { name: 'Photography', icon: <Camera className="w-5 h-5" />, color: 'bg-purple-100 text-purple-800' },
    { name: 'Spanish', icon: <BookOpen className="w-5 h-5" />, color: 'bg-red-100 text-red-800' },
  ];

  return (
    <div className="relative min-h-screen overflow-x-hidden px-0 pt-0 flex flex-col">
      {/* Night sky stars and moon */}
      <StarField count={60} />
      <Moon />
      {/* Hero Section */}
      <div
        ref={heroRef}
        style={{ opacity: 0, transform: 'translateY(40px)' }}
        className="relative z-10 flex flex-col items-center justify-center min-h-screen text-center px-4 max-w-4xl w-full mx-auto"
      >
        {/* Animated Glow */}
        <div className={`absolute left-1/2 top-16 -translate-x-1/2 z-0 pointer-events-none ${glow ? 'animate-glow' : ''}`} style={{width:'520px',height:'220px',filter:'blur(80px)',background:'radial-gradient(circle,#D391B0 0%,#5D3C64 80%,transparent 100%)',opacity:0.35}} />
        <h1 className="relative text-4xl md:text-6xl lg:text-7xl font-extrabold text-white mb-8 drop-shadow-[0_2px_16px_rgba(44,0,60,0.25)] z-10 tracking-tight max-w-4xl mx-auto">
           Exchange Skills, Learn Together
        </h1>
        {/* Floating constellation */}
        <div className="relative w-full flex justify-end">
          <FloatingConstellation />
        </div>
        <p className="text-lg text-brand-orchid max-w-2xl mx-auto mb-10 relative z-10">
          Connect with people who have the skills you want to learn, and offer your expertise in return. Build meaningful relationships while expanding your knowledge.
        </p>
        <Link
          ref={heroBtnRef}
          style={{ opacity: 0, transform: 'translateY(30px)' }}
          to={isAuthenticated ? "/browse" : "/register"}
          className="bg-gradient-to-r from-brand-pink via-brand-plum to-brand-mauve bg-[length:200%_200%] animate-gradient-move animate-btn-glow-scale text-white font-semibold text-lg px-10 py-4 rounded-full inline-flex items-center justify-center transition-all duration-500 shadow-lg mb-2 transform transition-transform active:scale-95 hover:scale-105 hover:shadow-2xl hover:bg-brand-pink hover:bg-none"
        >
          {isAuthenticated ? "Browse Skills" : "Get Started"}
        </Link>
      </div>
      {/* Main Content Below Hero */}
      <div>
        {/* Features Section */}
        <section
          ref={featuresRef}
          style={{ opacity: 0, transform: 'translateY(40px)' }}
          className="bg-brand-night bg-opacity-95 rounded-3xl shadow-lg border-0 p-8 md:p-14 max-w-6xl mx-auto w-full mt-20"
        >
          <h2 className="text-3xl font-bold text-center text-brand-pink mb-12">
            How It Works
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">
            {features.map((feature, index) => (
              <div key={index} className="group bg-white/10 backdrop-blur-md rounded-2xl shadow-xl flex flex-col items-center text-center p-7 transition-transform duration-300 hover:scale-105 hover:shadow-2xl border border-brand-blush/30">
                <div className="w-16 h-16 bg-brand-plum/90 rounded-full flex items-center justify-center mb-5 text-white shadow-md border-2 border-brand-blush">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">
                  {feature.title}
                </h3>
                <p className="text-brand-orchid max-w-xs">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </section>
        {/* Popular Skills Section */}
        <section
          ref={skillsRef}
          style={{ opacity: 0, transform: 'translateY(40px)' }}
          className="bg-brand-night rounded-3xl shadow-card-lg px-10 py-14 max-w-6xl mx-auto w-full mt-20 animate-fade-in border border-brand-plum/30"
        >
          <h2 className="text-4xl font-extrabold text-brand-pink text-center mb-10 tracking-wide drop-shadow-lg">
            Popular Skills
          </h2>
          <div className="flex flex-wrap justify-center gap-12 mb-12">
            {popularSkills.map((skill, index) => (
              <div
                key={index}
                className="flex flex-col items-center group transition-transform duration-300 hover:scale-110"
              >
                <div className="bg-brand-plum text-white rounded-full w-20 h-20 flex items-center justify-center mb-4 shadow-card-lg group-hover:ring-4 group-hover:ring-brand-orchid transition-all duration-200">
                  {skill.icon}
                </div>
                <span className="text-lg font-semibold text-brand-pink group-hover:text-brand-orchid transition-colors duration-200 tracking-wide">
                  {skill.name}
                </span>
              </div>
            ))}
          </div>
          <div className="flex justify-center">
            <Link
              to="/browse"
              className="bg-brand-orchid text-white font-bold px-8 py-4 rounded-full shadow-card transition-all duration-200 hover:bg-brand-pink hover:scale-105 focus:outline-none focus:ring-4 focus:ring-brand-pink/40 inline-flex items-center justify-center text-lg"
            >
              Explore All Skills
              <ArrowRight className="w-5 h-5 ml-2" />
            </Link>
          </div>
        </section>
        {/* CTA Section */}
        <section
          ref={ctaRef}
          style={{ opacity: 0, transform: 'translateY(40px)' }}
          className="bg-brand-pink/90 rounded-3xl text-brand-night text-center p-8 md:p-14 shadow-2xl max-w-4xl mx-auto w-full mt-20 mb-32 border border-brand-blush"
        >
          <h2 className="text-3xl font-bold mb-4">
            Ready to Start Learning?
          </h2>
          <p className="text-xl mb-8 opacity-90">
            Join thousands of people who are already exchanging skills and building connections.
          </p>
          {!isAuthenticated && (
            <div className="flex justify-center">
              <Link
                to="/register"
                className="bg-white text-brand-plum hover:bg-brand-blush font-semibold text-lg px-10 py-4 rounded-full inline-flex items-center justify-center transition-colors duration-200 shadow-lg transform transition-transform active:scale-95 hover:scale-105 hover:shadow-2xl"
              >
                Create Your Profile
                <ArrowRight className="w-5 h-5 ml-2" />
              </Link>
            </div>
          )}
        </section>
      </div>
      {/* Hill at the very bottom as a footer background */}
      <div className="w-full absolute left-0 bottom-0 z-0 h-[180px] overflow-visible">
        <Hill />
      </div>
    </div>
  );
};

export default Home;