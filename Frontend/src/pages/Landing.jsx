import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Landing.css';

const FuelIcon = ({ size = 24, className = '' }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M3 3v13a3 3 0 0 0 3 3h8a3 3 0 0 0 3-3V7l-3-4H6a3 3 0 0 0-3 3z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M19 7v4a2 2 0 0 1-2 2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const WrenchIcon = ({ size = 24, className = '' }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
    <path d="M21 8l-6.5 6.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M14.5 3.5a4 4 0 1 0 5 5L14 14l-4-4 5.5-6.5z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

/** Clock ring with “24” centered (matches reference cards) */
const Clock24Mark = ({ size = 44 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.35" />
    <text
      x="12"
      y="13.5"
      textAnchor="middle"
      fill="currentColor"
      fontSize="6.5"
      fontWeight="800"
      fontFamily="Inter, system-ui, sans-serif"
    >
      24
    </text>
  </svg>
);

const GearIcon = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden className={className}>
    <path
      d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"
      stroke="currentColor"
      strokeWidth="1.4"
    />
    <path
      d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 15z"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const Landing = ({ user: userProp, onLogout: onLogoutProp }) => {
  const navigate = useNavigate();
  const { currentUser, logout } = useAuth();
  const user = currentUser || userProp;
  const onLogout = onLogoutProp || logout;

  React.useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="landing-page">
      <div className="landing-hero-block">
        <header className="landing-header" data-testid="landing-header">
          <div className="landing-container landing-header-inner">
            <div className="logo" data-testid="logo">
              <FuelIcon size={28} className="logo-fuel-svg" />
              <span>Fuel &amp; Fix</span>
            </div>
            <div className="nav-right">
              <nav className="nav-links-inline" aria-label="Primary">
                <a href="#services">Services</a>
                <a href="#about">About</a>
                <a href="#contact">Contact</a>
              </nav>
              {user ? (
                <button type="button" className="btn-logout" onClick={onLogout} data-testid="logout-btn">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M16 17l5-5-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M21 12H9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Logout
                </button>
              ) : (
                <button type="button" className="btn-nav-cta" onClick={() => navigate('/login')} data-testid="get-started-btn">
                  Get Started
                </button>
              )}
            </div>
          </div>
        </header>

        <section className="hero-section" data-testid="hero-section">
          <div className="hero-bg" aria-hidden="true" />
          <div className="landing-container hero-inner">
            <div className="hero-content">
              <h1 className="hero-title" data-testid="hero-title">
                <span className="hero-title-line hero-title-line-primary">
                  <span className="hero-text-white">On-Demand</span>{' '}
                  <span className="hero-highlight">Fuel Delivery</span>
                </span>
                <span className="hero-title-line hero-title-line-secondary">
                  &amp; Vehicle Repair
                </span>
              </h1>
              <p className="hero-subtitle" data-testid="hero-subtitle">
                Get fuel delivered or book a mechanic anytime, anywhere. Fast, reliable, and available 24/7.
              </p>
              <div className="hero-cta">
                {!user && (
                  <button type="button" className="btn-hero-primary" onClick={() => navigate('/register')} data-testid="book-now-btn">
                    <FuelIcon size={22} className="btn-hero-fuel-icon" />
                    Book Now
                  </button>
                )}
                {user && user.role === 'user' && (
                  <button type="button" className="btn-hero-primary" onClick={() => navigate('/dashboard')} data-testid="book-now-btn">
                    <FuelIcon size={22} className="btn-hero-fuel-icon" />
                    Book Now
                  </button>
                )}
                {user && (user.role === 'admin' || user.role === 'mechanic' || user.role === 'delivery') && (
                  <button type="button" className="btn-hero-primary" onClick={() => navigate('/dashboard')} data-testid="go-to-dashboard-btn">
                    <FuelIcon size={22} className="btn-hero-fuel-icon" />
                    Go to Dashboard
                  </button>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>

      <section id="services" className="services-section" data-testid="services-section">
        <div className="landing-container">
          <h2 className="section-title" data-testid="services-title">Our Services</h2>
          <p className="section-subtitle">Bringing the repair shop to you. Here&apos;s what we offer:</p>
          <div className="services-grid">
            <div
              className="service-card"
              data-testid="fuel-service-card"
              role="button"
              tabIndex={0}
              onClick={() => {
                if (!user || user.role === 'user') navigate('/dashboard?service=fuel');
              }}
              onKeyDown={(e) => {
                if ((!user || user.role === 'user') && e.key === 'Enter') navigate('/dashboard?service=fuel');
              }}
            >
              <div className="service-icon">
                <FuelIcon size={44} />
              </div>
              <h3>Fuel Delivery</h3>
              <p>Out of gas? We&apos;ll deliver fuel to you immediately, wherever you are.</p>
            </div>
            <div
              className="service-card"
              data-testid="repair-service-card"
              role="button"
              tabIndex={0}
              onClick={() => {
                if (!user || user.role === 'user') navigate('/dashboard?service=mechanical');
              }}
              onKeyDown={(e) => {
                if ((!user || user.role === 'user') && e.key === 'Enter') navigate('/dashboard?service=mechanical');
              }}
            >
              <div className="service-icon service-icon-wrench-gear" aria-hidden="true">
                <WrenchIcon size={38} className="repair-wrench" />
                <GearIcon size={22} className="repair-gear" />
              </div>
              <h3>Vehicle Repair</h3>
              <p>Need a fix? Our mobile mechanics come to your location to get you back on the road.</p>
            </div>
            <div className="service-card service-card-static" data-testid="availability-service-card">
              <div className="service-icon">
                <Clock24Mark size={48} />
              </div>
              <h3>24/7 Availability</h3>
              <p>We&apos;re here for you day or night. Service you need, when you need it.</p>
            </div>
          </div>
        </div>
      </section>

      <section id="about" className="stats-section" data-testid="features-section">
        <div className="landing-container">
          <h2 className="section-title">Trusted by Thousands of Drivers</h2>
          <p className="section-subtitle">Bringing the repair shop to you. Here&apos;s what we offer:</p>
          <div className="stats-grid">
            <div className="stat-item">
              <span className="stat-value">18,000+</span>
              <span className="stat-label">Happy Customers</span>
            </div>
            <div className="stat-item">
              <span className="stat-value">24/7</span>
              <span className="stat-label">Always Available</span>
            </div>
            <div className="stat-item">
              <span className="stat-value">&lt;30<br />Min</span>
              <span className="stat-label">Fast Response Time</span>
            </div>
            <div className="stat-item">
              <span className="stat-value">25+</span>
              <span className="stat-label">Expert Technicians</span>
            </div>
          </div>
        </div>
      </section>

      <section className="landing-bottom" aria-labelledby="bottom-heading">
        <div className="landing-bottom-bg" aria-hidden="true" />
        <div className="landing-container">
          <h2 id="bottom-heading" className="landing-bottom-title">Get back on the road. Fast.</h2>
        </div>
      </section>

      <footer id="contact" className="landing-footer" data-testid="landing-footer">
        <div className="landing-container">
          <p className="footer-contact">Questions? Reach us at <a href="mailto:support@fuelandfix.com">support@fuelandfix.com</a></p>
          <p className="footer-copy">&copy; {new Date().getFullYear()} Fuel &amp; Fix. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
