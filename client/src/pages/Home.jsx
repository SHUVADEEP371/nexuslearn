import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ArrowRight, BookOpen, Code2, Palette, Music2, Camera, Search, Sparkles, Users, Repeat2, ShieldCheck, Star, Globe2, MoveUpRight } from 'lucide-react';

const skills = [
  { name: 'Product design', category: 'DESIGN', icon: Palette, color: 'bg-rose-100 text-rose-600' },
  { name: 'JavaScript', category: 'TECHNOLOGY', icon: Code2, color: 'bg-amber-100 text-amber-700' },
  { name: 'Photography', category: 'CREATIVE', icon: Camera, color: 'bg-violet-100 text-violet-600' },
  { name: 'Guitar', category: 'MUSIC', icon: Music2, color: 'bg-teal-100 text-teal-700' },
];

const steps = [
  { number: '01', icon: Search, title: 'Find your people', text: 'Discover generous teachers with the skills you want to learn.' },
  { number: '02', icon: Repeat2, title: 'Make an even trade', text: 'Offer something you know. Every person has something to share.' },
  { number: '03', icon: Sparkles, title: 'Grow together', text: 'Meet, learn, and leave each other a little more capable.' },
];

export default function Home() {
  const { isAuthenticated } = useAuth();
  const [query, setQuery] = useState('');
  const navigate = useNavigate();

  const search = (event) => {
    event.preventDefault();
    navigate(query.trim() ? `/browse?skill=${encodeURIComponent(query.trim())}` : '/browse');
  };

  return (
    <div className="-mx-4 -mt-8 overflow-hidden bg-[#faf9f6] text-[#202520]">
      <section className="relative px-5 pb-20 pt-28 sm:px-8 sm:pb-24 sm:pt-32">
        <div className="pointer-events-none absolute -right-24 -top-36 h-[34rem] w-[34rem] rounded-full bg-[#dbe9d7] opacity-70 blur-3xl" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-14 lg:grid-cols-[1.05fr_.95fr]">
          <div className="max-w-2xl">
            <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-[#dce7d9] bg-white/75 px-4 py-2 text-sm font-semibold text-[#52735a] shadow-sm">
              <Sparkles className="h-4 w-4" /> A little knowledge goes a long way
            </div>
            <h1 className="text-5xl font-semibold leading-[1.06] tracking-[-.055em] sm:text-6xl lg:text-[4.6rem]">
              Learn something.<br /><span className="font-serif italic font-normal text-[#638469]">Teach something.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-[#69716a]">NexusLearn is a collaborative learning community where people share what they know, learn together, and turn curiosity into progress.</p>
            <form onSubmit={search} className="mt-9 flex max-w-xl items-center gap-2 rounded-2xl border border-[#e8e7e1] bg-white p-2 shadow-[0_12px_40px_rgba(48,62,45,.08)] focus-within:border-[#91ad93]">
              <Search className="ml-3 h-5 w-5 shrink-0 text-[#829086]" />
              <input aria-label="Search skills" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="What would you like to learn?" className="min-w-0 flex-1 bg-transparent px-2 py-3 text-sm outline-none placeholder:text-[#9ca39d]" />
              <button className="rounded-xl bg-[#365841] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#294732]" type="submit">Explore</button>
            </form>
            <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-[#758078]">
              <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-[#638469]" /> Community-rated members</span>
              <span className="inline-flex items-center gap-1.5"><Globe2 className="h-4 w-4 text-[#638469]" /> Learn on your terms</span>
            </div>
            <div className="mt-10 flex flex-wrap gap-3">
              <Link to={isAuthenticated ? '/browse' : '/register'} className="inline-flex items-center gap-2 rounded-xl bg-[#365841] px-6 py-3.5 font-semibold text-white shadow-lg shadow-[#365841]/15 transition hover:-translate-y-0.5 hover:bg-[#294732]">{isAuthenticated ? 'Find your next skill' : 'Join the community'} <ArrowRight className="h-4 w-4" /></Link>
              <Link to="/browse" className="inline-flex items-center gap-2 rounded-xl px-5 py-3.5 font-semibold text-[#526457] transition hover:bg-[#edf2ea]">See how it works <MoveUpRight className="h-4 w-4" /></Link>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-[510px] lg:ml-auto">
            <div className="absolute -left-5 top-16 h-32 w-32 rounded-full bg-[#f0d9c7]/70 blur-2xl" />
            <div className="relative rotate-1 rounded-[2rem] border border-white/80 bg-white p-5 shadow-[0_30px_90px_rgba(46,62,48,.14)] sm:p-7">
              <div className="flex items-center justify-between border-b border-[#efefe9] pb-5">
                <div><p className="text-xs font-semibold uppercase tracking-[.14em] text-[#8d978e]">A good place to start</p><h2 className="mt-1 text-xl font-semibold tracking-tight">Skills on the rise</h2></div>
                <span className="rounded-full bg-[#edf4eb] px-3 py-1.5 text-xs font-semibold text-[#52735a]">This week</span>
              </div>
              <div className="space-y-3 py-5">
                {skills.map(({ name, category, icon: Icon, color }, index) => (
                  <Link to={`/browse?skill=${encodeURIComponent(name)}`} key={name} className="group flex items-center gap-4 rounded-2xl border border-[#f0f0eb] p-3 transition hover:-translate-y-0.5 hover:border-[#d9e5d7] hover:bg-[#fbfcfa]">
                    <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${color}`}><Icon className="h-5 w-5" /></div>
                    <div className="min-w-0 flex-1"><p className="text-[10px] font-semibold tracking-[.15em] text-[#9ba39c]">{category}</p><p className="mt-0.5 font-semibold">{name}</p></div>
                    <span className="mr-1 flex h-7 w-7 items-center justify-center rounded-full bg-[#f4f5f1] text-[#7b887c] transition group-hover:bg-[#365841] group-hover:text-white"><ArrowRight className="h-3.5 w-3.5" /></span>
                    {index === 0 && <span className="sr-only">Featured skill</span>}
                  </Link>
                ))}
              </div>
              <div className="flex items-center justify-between rounded-2xl bg-[#f5f7f2] p-4">
                <div className="flex -space-x-2" aria-label="Community members"><span className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-[#e5c8b5] text-xs font-bold text-[#6c5547]">AM</span><span className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-[#c8d8c5] text-xs font-bold text-[#456149]">JL</span><span className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-[#e9d5a8] text-xs font-bold text-[#806d3a]">SK</span></div>
                <div className="text-right"><p className="flex items-center justify-end gap-1 text-sm font-semibold"><Star className="h-3.5 w-3.5 fill-[#d9a74e] text-[#d9a74e]" /> Good things happen here</p><p className="mt-0.5 text-xs text-[#89928a]">One thoughtful swap at a time</p></div>
              </div>
            </div>
            <div className="absolute -bottom-7 -left-4 rounded-2xl border border-white bg-white px-4 py-3 shadow-lg sm:-left-10"><p className="flex items-center gap-2 text-sm font-semibold text-[#456149]"><Users className="h-4 w-4" /> Your next teacher is out there</p></div>
          </div>
        </div>
      </section>

      <section className="border-y border-[#ecebe5] bg-white px-5 py-7 sm:px-8">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-5 sm:flex-row sm:items-center">
          <p className="text-sm font-medium text-[#7a847c]">A community built on give and take</p>
          <div className="flex flex-wrap gap-x-8 gap-y-3 text-sm font-semibold text-[#526457]"><span className="inline-flex items-center gap-2"><Repeat2 className="h-4 w-4 text-[#7e9a7f]" /> Peer skill exchanges</span><span className="inline-flex items-center gap-2"><Star className="h-4 w-4 text-[#c49b51]" /> Real community reviews</span><span className="inline-flex items-center gap-2"><BookOpen className="h-4 w-4 text-[#7e9a7f]" /> Learn at your pace</span></div>
        </div>
      </section>

      <section className="px-5 py-20 sm:px-8 sm:py-24">
        <div className="mx-auto max-w-7xl">
          <div className="mb-12 flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-[#7c997e]">Simple by design</p><h2 className="mt-3 text-3xl font-semibold tracking-[-.04em] sm:text-4xl">A better way to get better</h2></div><p className="max-w-md text-[#737d74]">The best learning happens when we help each other. Here’s how NexusLearn makes it easy to begin.</p></div>
          <div className="grid gap-4 md:grid-cols-3">{steps.map(({ number, icon: Icon, title, text }) => <article key={number} className="rounded-3xl border border-[#eaeae3] bg-white p-7 transition hover:-translate-y-1 hover:shadow-[0_18px_50px_rgba(46,62,48,.08)]"><div className="flex items-center justify-between"><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#edf3ea] text-[#52735a]"><Icon className="h-5 w-5" /></span><span className="font-serif text-2xl italic text-[#b4c3b1]">{number}</span></div><h3 className="mt-7 text-xl font-semibold">{title}</h3><p className="mt-2 leading-7 text-[#778078]">{text}</p></article>)}</div>
        </div>
      </section>

      <section className="px-5 pb-20 sm:px-8 sm:pb-24"><div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-8 overflow-hidden rounded-[2rem] bg-[#e8efe5] px-7 py-10 sm:flex-row sm:items-center sm:px-12 sm:py-12"><div className="max-w-xl"><p className="text-xs font-bold uppercase tracking-[.18em] text-[#66816a]">Small skills. Big momentum.</p><h2 className="mt-3 text-3xl font-semibold tracking-[-.04em] sm:text-4xl">You have more to teach than you think.</h2><p className="mt-3 leading-7 text-[#69766a]">Share what you know, meet curious people, and make your next learning goal feel closer.</p></div><Link to={isAuthenticated ? '/profile' : '/register'} className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-[#365841] px-6 py-3.5 font-semibold text-white transition hover:bg-[#294732]">{isAuthenticated ? 'Complete your profile' : 'Create your profile'} <ArrowRight className="h-4 w-4" /></Link></div></section>
    </div>
  );
}
