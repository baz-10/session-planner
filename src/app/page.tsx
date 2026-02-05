'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserSupabaseClient } from '@/lib/auth/supabase-browser';

// Feature data
const features = [
  {
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
      </svg>
    ),
    title: 'Practice Planning',
    description: 'Build structured sessions with timed drills. Drag, drop, and customize every minute of practice.',
    stat: '10K+',
    statLabel: 'Sessions created',
  },
  {
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
    title: 'Team Management',
    description: 'Organize rosters, track player info, and manage multiple teams under one organization.',
    stat: '500+',
    statLabel: 'Teams active',
  },
  {
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
    title: 'Event Scheduling',
    description: 'Schedule games, practices, and tournaments. Collect RSVPs and track attendance effortlessly.',
    stat: '98%',
    statLabel: 'RSVP rate',
  },
  {
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    ),
    title: 'Team Communication',
    description: 'Keep everyone in sync with team feed, direct messages, and real-time chat.',
    stat: '50K+',
    statLabel: 'Messages sent',
  },
];

// Testimonials
const testimonials = [
  {
    quote: "Session Planner transformed how I run practices. My players are more engaged and parents always know what's happening.",
    author: 'Coach Mike Reynolds',
    role: 'U14 Basketball',
    avatar: 'MR',
  },
  {
    quote: "Finally, an app that understands what coaches actually need. The practice builder alone saves me hours every week.",
    author: 'Sarah Chen',
    role: 'Club Director, Elite Soccer Academy',
    avatar: 'SC',
  },
  {
    quote: "Our organization manages 12 teams now. The multi-team support and parent communication features are game-changers.",
    author: 'David Thompson',
    role: 'Youth Sports Administrator',
    avatar: 'DT',
  },
];

export default function HomePage() {
  const router = useRouter();
  const [scrolled, setScrolled] = useState(false);

  // Check for authenticated user and redirect (non-blocking)
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const supabase = createBrowserSupabaseClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          router.push('/dashboard');
        }
      } catch {
        // Ignore auth errors on landing page - just show the content
      }
    };
    checkAuth();
  }, [router]);

  // Handle scroll for navbar
  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-white overflow-x-hidden">
      {/* Navigation */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? 'bg-white/95 backdrop-blur-md shadow-sm' : 'bg-transparent'
      }`}>
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
                scrolled ? 'bg-navy' : 'bg-white/10 backdrop-blur'
              }`}>
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <span className={`text-xl font-display font-bold transition-colors ${
                scrolled ? 'text-navy' : 'text-white'
              }`}>
                Session Planner
              </span>
            </div>

            <div className="hidden md:flex items-center gap-8">
              <a href="#features" className={`text-sm font-medium transition-colors ${
                scrolled ? 'text-text-secondary hover:text-navy' : 'text-white/80 hover:text-white'
              }`}>Features</a>
              <a href="#testimonials" className={`text-sm font-medium transition-colors ${
                scrolled ? 'text-text-secondary hover:text-navy' : 'text-white/80 hover:text-white'
              }`}>Testimonials</a>
              <a href="#pricing" className={`text-sm font-medium transition-colors ${
                scrolled ? 'text-text-secondary hover:text-navy' : 'text-white/80 hover:text-white'
              }`}>Pricing</a>
            </div>

            <div className="flex items-center gap-4">
              <Link
                href="/login"
                className={`text-sm font-semibold transition-colors ${
                  scrolled ? 'text-navy hover:text-teal' : 'text-white hover:text-teal-light'
                }`}
              >
                Sign In
              </Link>
              <Link
                href="/signup"
                className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                  scrolled
                    ? 'bg-teal text-white hover:bg-teal-dark'
                    : 'bg-white text-navy hover:bg-teal hover:text-white'
                }`}
              >
                Get Started Free
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative min-h-screen bg-navy overflow-hidden">
        {/* Background elements */}
        <div className="absolute inset-0 bg-grid-pattern opacity-30" />
        <div className="absolute top-1/4 -right-64 w-[800px] h-[800px] bg-teal/20 rounded-full blur-[150px]" />
        <div className="absolute bottom-0 -left-32 w-[600px] h-[600px] bg-navy-light/50 rounded-full blur-[120px]" />

        {/* Diagonal accent */}
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-white clip-diagonal-reverse" />

        <div className="relative max-w-7xl mx-auto px-6 pt-32 pb-48">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Left content */}
            <div className="animate-slide-in-left" style={{ animationDelay: '0.2s', animationFillMode: 'backwards' }}>
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur rounded-full mb-8">
                <span className="w-2 h-2 bg-teal rounded-full animate-pulse" />
                <span className="text-sm text-white/80">iOS App Coming Soon</span>
              </div>

              <h1 className="font-display text-5xl md:text-6xl lg:text-7xl font-bold text-white leading-[1.1] mb-6">
                Run Better
                <span className="block text-teal">Practices.</span>
                <span className="block text-white/60">Build Better</span>
                <span className="block">Teams.</span>
              </h1>

              <p className="text-xl text-white/70 max-w-lg mb-10 leading-relaxed">
                The all-in-one platform for youth sports coaches. Plan practices, manage rosters,
                and keep everyone connected—from the field to their phones.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 mb-12">
                <Link
                  href="/signup"
                  className="group inline-flex items-center justify-center gap-3 px-8 py-4 bg-teal text-white rounded-xl text-lg font-semibold hover:bg-teal-dark transition-all animate-pulse-glow"
                >
                  Start Free Trial
                  <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </Link>
                <a
                  href="#features"
                  className="inline-flex items-center justify-center gap-2 px-8 py-4 border-2 border-white/30 text-white rounded-xl text-lg font-semibold hover:bg-white/10 transition-all"
                >
                  See How It Works
                </a>
              </div>

              {/* Trust indicators */}
              <div className="flex items-center gap-8 text-white/60">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-teal" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span className="text-sm">Free forever plan</span>
                </div>
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-teal" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span className="text-sm">No credit card required</span>
                </div>
              </div>
            </div>

            {/* Right content - Product mockup */}
            <div className="relative animate-slide-in-right hidden lg:block" style={{ animationDelay: '0.4s', animationFillMode: 'backwards' }}>
              <div className="relative">
                {/* Main card - Session builder preview */}
                <div className="bg-white rounded-2xl shadow-2xl p-6 animate-float">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="text-xs font-semibold text-teal uppercase tracking-wider">Practice Session</p>
                      <h3 className="text-lg font-bold text-navy">Tuesday Drills</h3>
                    </div>
                    <div className="px-3 py-1 bg-teal-glow text-teal-dark text-sm font-semibold rounded-full">
                      90 min
                    </div>
                  </div>

                  {/* Mini timeline */}
                  <div className="space-y-3">
                    {['Warm-up & Stretching', 'Ball Handling Drills', 'Shooting Practice', '5v5 Scrimmage'].map((drill, i) => (
                      <div key={i} className="flex items-center gap-3 p-3 bg-whisper rounded-lg">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-white text-sm font-bold ${
                          i === 0 ? 'bg-teal' : i === 1 ? 'bg-navy' : i === 2 ? 'bg-navy-light' : 'bg-teal-dark'
                        }`}>
                          {[10, 20, 25, 35][i]}m
                        </div>
                        <span className="text-sm font-medium text-navy">{drill}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Floating notification card */}
                <div className="absolute -left-16 top-1/4 bg-white rounded-xl shadow-xl p-4 w-64 animate-float" style={{ animationDelay: '1s' }}>
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                      <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-navy">RSVP Received</p>
                      <p className="text-xs text-text-muted">Marcus confirmed for Saturday's game</p>
                    </div>
                  </div>
                </div>

                {/* Floating stat card */}
                <div className="absolute -right-8 bottom-16 bg-navy rounded-xl shadow-xl p-4 animate-float" style={{ animationDelay: '2s' }}>
                  <p className="text-xs text-teal-light font-semibold mb-1">Team Attendance</p>
                  <p className="text-3xl font-display font-bold text-white">94%</p>
                  <p className="text-xs text-white/60">↑ 12% this month</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 bg-white relative">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <p className="text-sm font-semibold text-teal uppercase tracking-wider mb-4">Features</p>
            <h2 className="font-display text-4xl md:text-5xl font-bold text-navy mb-6">
              Everything you need to<br />
              <span className="text-teal">coach with confidence</span>
            </h2>
            <p className="text-xl text-text-secondary max-w-2xl mx-auto">
              Stop juggling spreadsheets, group texts, and paper plans.
              Session Planner brings it all together.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {features.map((feature, i) => (
              <div
                key={i}
                className="group relative p-8 rounded-2xl border border-border bg-white hover:border-teal hover:shadow-xl transition-all duration-300"
              >
                <div className="flex items-start gap-6">
                  <div className="w-16 h-16 rounded-2xl bg-teal-glow text-teal flex items-center justify-center group-hover:bg-teal group-hover:text-white transition-colors">
                    {feature.icon}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-display font-bold text-navy mb-2">{feature.title}</h3>
                    <p className="text-text-secondary mb-4">{feature.description}</p>
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-display font-bold text-teal">{feature.stat}</span>
                      <span className="text-sm text-text-muted">{feature.statLabel}</span>
                    </div>
                  </div>
                </div>

                {/* Hover accent */}
                <div className="absolute top-0 right-0 w-24 h-24 bg-teal/5 rounded-bl-[100px] opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            ))}
          </div>

          {/* Platform showcase */}
          <div className="mt-24 relative">
            <div className="absolute inset-0 bg-gradient-to-r from-navy via-navy-light to-navy rounded-3xl" />
            <div className="relative p-12 md:p-16 rounded-3xl overflow-hidden">
              <div className="absolute top-0 right-0 w-1/2 h-full bg-teal/10 blur-[100px]" />

              <div className="relative grid md:grid-cols-2 gap-12 items-center">
                <div>
                  <p className="text-teal-light font-semibold mb-4">Multi-Platform</p>
                  <h3 className="font-display text-3xl md:text-4xl font-bold text-white mb-6">
                    Access your team anywhere, anytime
                  </h3>
                  <p className="text-white/70 text-lg mb-8">
                    Use Session Planner on the web, and soon on iOS. Your data syncs instantly
                    across all devices so you're always prepared—at home or on the sidelines.
                  </p>
                  <div className="flex flex-wrap gap-4">
                    <div className="flex items-center gap-3 px-4 py-3 bg-white/10 rounded-xl">
                      <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
                      </svg>
                      <span className="text-white font-medium">Web App</span>
                      <span className="text-xs px-2 py-0.5 bg-teal rounded text-white">Live</span>
                    </div>
                    <div className="flex items-center gap-3 px-4 py-3 bg-white/10 rounded-xl">
                      <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
                      </svg>
                      <span className="text-white font-medium">iOS App</span>
                      <span className="text-xs px-2 py-0.5 bg-white/20 rounded text-white">Coming Soon</span>
                    </div>
                  </div>
                </div>

                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-br from-teal/20 to-transparent rounded-2xl" />
                  <div className="relative bg-white/5 backdrop-blur rounded-2xl p-6 border border-white/10">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-3 h-3 rounded-full bg-red-400" />
                      <div className="w-3 h-3 rounded-full bg-yellow-400" />
                      <div className="w-3 h-3 rounded-full bg-green-400" />
                    </div>
                    <div className="space-y-4">
                      <div className="h-8 bg-white/10 rounded-lg w-3/4" />
                      <div className="h-24 bg-white/10 rounded-lg" />
                      <div className="grid grid-cols-3 gap-3">
                        <div className="h-16 bg-teal/30 rounded-lg" />
                        <div className="h-16 bg-white/10 rounded-lg" />
                        <div className="h-16 bg-white/10 rounded-lg" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section id="testimonials" className="py-24 bg-whisper relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-border to-transparent" />

        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <p className="text-sm font-semibold text-teal uppercase tracking-wider mb-4">Testimonials</p>
            <h2 className="font-display text-4xl md:text-5xl font-bold text-navy mb-6">
              Loved by coaches<br />
              <span className="text-text-secondary">across the country</span>
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, i) => (
              <div
                key={i}
                className="bg-white rounded-2xl p-8 shadow-sm border border-border hover:shadow-lg transition-shadow"
              >
                {/* Stars */}
                <div className="flex gap-1 mb-6">
                  {[...Array(5)].map((_, j) => (
                    <svg key={j} className="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>

                <p className="text-text-secondary mb-8 leading-relaxed">"{testimonial.quote}"</p>

                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-navy flex items-center justify-center">
                    <span className="text-white font-semibold">{testimonial.avatar}</span>
                  </div>
                  <div>
                    <p className="font-semibold text-navy">{testimonial.author}</p>
                    <p className="text-sm text-text-muted">{testimonial.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing / CTA Section */}
      <section id="pricing" className="py-24 bg-white relative">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-teal-glow rounded-full mb-8">
            <span className="text-sm font-semibold text-teal">Free Forever</span>
          </div>

          <h2 className="font-display text-4xl md:text-6xl font-bold text-navy mb-6">
            Start building better<br />practices today
          </h2>

          <p className="text-xl text-text-secondary max-w-2xl mx-auto mb-12">
            Join thousands of coaches who've upgraded their game.
            Create your free account in seconds—no credit card required.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
            <Link
              href="/signup"
              className="group inline-flex items-center justify-center gap-3 px-10 py-5 bg-navy text-white rounded-xl text-lg font-semibold hover:bg-navy-light transition-all shadow-lg shadow-navy/20"
            >
              Create Free Account
              <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center justify-center gap-2 px-10 py-5 border-2 border-border text-navy rounded-xl text-lg font-semibold hover:border-navy hover:bg-whisper transition-all"
            >
              Sign In
            </Link>
          </div>

          {/* Feature checklist */}
          <div className="flex flex-wrap justify-center gap-x-8 gap-y-4 text-text-secondary">
            {['Unlimited sessions', 'Up to 3 teams', 'Team chat', 'RSVP tracking', 'Mobile app access'].map((feature, i) => (
              <div key={i} className="flex items-center gap-2">
                <svg className="w-5 h-5 text-teal" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span className="text-sm">{feature}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-navy-dark py-16">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-4 gap-12 mb-12">
            <div>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <span className="text-xl font-display font-bold text-white">Session Planner</span>
              </div>
              <p className="text-white/60 text-sm leading-relaxed">
                The modern platform for youth sports team management. Plan practices, communicate with your team, and track everything in one place.
              </p>
            </div>

            <div>
              <h4 className="font-semibold text-white mb-4">Product</h4>
              <ul className="space-y-3 text-white/60 text-sm">
                <li><a href="#features" className="hover:text-white transition-colors">Features</a></li>
                <li><a href="#pricing" className="hover:text-white transition-colors">Pricing</a></li>
                <li><a href="#" className="hover:text-white transition-colors">iOS App</a></li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-white mb-4">Company</h4>
              <ul className="space-y-3 text-white/60 text-sm">
                <li><a href="#" className="hover:text-white transition-colors">About</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Blog</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Contact</a></li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-white mb-4">Legal</h4>
              <ul className="space-y-3 text-white/60 text-sm">
                <li><a href="#" className="hover:text-white transition-colors">Privacy Policy</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Terms of Service</a></li>
              </ul>
            </div>
          </div>

          <div className="pt-8 border-t border-white/10 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-white/40 text-sm">
              © {new Date().getFullYear()} Session Planner. All rights reserved.
            </p>
            <div className="flex items-center gap-6">
              <a href="#" className="text-white/40 hover:text-white transition-colors">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M24 4.557c-.883.392-1.832.656-2.828.775 1.017-.609 1.798-1.574 2.165-2.724-.951.564-2.005.974-3.127 1.195-.897-.957-2.178-1.555-3.594-1.555-3.179 0-5.515 2.966-4.797 6.045-4.091-.205-7.719-2.165-10.148-5.144-1.29 2.213-.669 5.108 1.523 6.574-.806-.026-1.566-.247-2.229-.616-.054 2.281 1.581 4.415 3.949 4.89-.693.188-1.452.232-2.224.084.626 1.956 2.444 3.379 4.6 3.419-2.07 1.623-4.678 2.348-7.29 2.04 2.179 1.397 4.768 2.212 7.548 2.212 9.142 0 14.307-7.721 13.995-14.646.962-.695 1.797-1.562 2.457-2.549z" />
                </svg>
              </a>
              <a href="#" className="text-white/40 hover:text-white transition-colors">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
                </svg>
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
