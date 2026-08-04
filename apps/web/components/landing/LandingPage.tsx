'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

const HERO_IMAGE =
  'https://images.unsplash.com/photo-1541339907198-e08756dedf3f?auto=format&fit=crop&w=2000&q=80';

const DESTINATIONS = [
  { name: 'United Kingdom', detail: 'Undergraduate & postgraduate intakes' },
  { name: 'Canada', detail: 'Study permits with clear timelines' },
  { name: 'Germany', detail: 'Tuition-friendly public pathways' },
  { name: 'Australia', detail: 'Career-led postgraduate options' },
];

export function LandingPage() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className="agency-landing">
      <nav className={`agency-nav${scrolled ? ' agency-nav-scrolled' : ''}`} aria-label="Primary">
        <div className="agency-nav-inner">
          <Link href="/" className="agency-brand" aria-label="Study Abroad home">
            <span>SA</span>
            Study Abroad
          </Link>
          <div className="agency-nav-links">
            <a href="#destinations">Destinations</a>
            <a href="#how-it-works">How it works</a>
            <Link href="/workspace" className="agency-nav-cta">
              Talk to an advisor
            </Link>
          </div>
        </div>
      </nav>

      <header className="agency-hero">
        <img src={HERO_IMAGE} alt="" className="agency-hero-image" />
        <div className="agency-hero-veil" aria-hidden="true" />
        <div className="agency-hero-content">
          <p className="agency-brand-mark">Study Abroad</p>
          <h1>
            Kerala&apos;s quiet path
            <br />
            to global classrooms.
          </h1>
          <p className="agency-hero-lead">
            Counselling from Kochi and Calicut — honest course matches, document clarity, and a workspace that stays with your plan.
          </p>
          <div className="agency-hero-actions">
            <Link href="/workspace" className="agency-btn-primary">
              Start with your advisor
            </Link>
            <a href="#destinations" className="agency-btn-secondary">
              See destinations
            </a>
          </div>
        </div>
      </header>

      <section id="destinations" className="agency-section agency-destinations" aria-labelledby="destinations-title">
        <p className="agency-eyebrow">Where students go</p>
        <h2 id="destinations-title">Partner pathways from Kerala</h2>
        <p className="agency-section-lead">
          We guide applications to universities your family can trust — with local advisors who know Kerala timelines and budgets.
        </p>
        <ul className="agency-destination-list">
          {DESTINATIONS.map((destination, index) => (
            <li key={destination.name} style={{ animationDelay: `${index * 80}ms` }}>
              <strong>{destination.name}</strong>
              <span>{destination.detail}</span>
            </li>
          ))}
        </ul>
      </section>

      <section id="how-it-works" className="agency-section agency-how" aria-labelledby="how-title">
        <p className="agency-eyebrow">How advising works</p>
        <h2 id="how-title">Explore first. Shortlist when you are ready.</h2>
        <p className="agency-section-lead">
          Tell us your background and interests. Course matches land in your workspace — not buried in chat — so you can compare calmly.
        </p>
        <ol className="agency-steps">
          <li>
            <span>01</span>
            <div>
              <strong>Explore</strong>
              <p>Share what you studied and what you want next. We surface fitting course types.</p>
            </div>
          </li>
          <li>
            <span>02</span>
            <div>
              <strong>Shortlist</strong>
              <p>Keep a provisional set of offerings while you compare fees, duration, and fit.</p>
            </div>
          </li>
          <li>
            <span>03</span>
            <div>
              <strong>Documents</strong>
              <p>When you confirm, collect the files your applications will need.</p>
            </div>
          </li>
        </ol>
        <Link href="/workspace" className="agency-btn-primary">
          Open your workspace
        </Link>
      </section>

      <footer className="agency-footer">
        <div>
          <strong>Study Abroad</strong>
          <p>Overseas education counselling · Kochi &amp; Calicut</p>
        </div>
        <p>Made for Kerala students planning their next chapter.</p>
      </footer>
    </div>
  );
}
