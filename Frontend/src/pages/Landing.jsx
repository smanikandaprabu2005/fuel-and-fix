import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
// Lightweight inline SVG icons to avoid additional peer-dependency issues
const FuelIcon = ({ size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
    <path d="M3 3v13a3 3 0 0 0 3 3h8a3 3 0 0 0 3-3V7l-3-4H6a3 3 0 0 0-3 3z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M19 7v4a2 2 0 0 1-2 2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const WrenchIcon = ({ size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M21 8l-6.5 6.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M14.5 3.5a4 4 0 1 0 5 5L14 14l-4-4 5.5-6.5z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const MapPinIcon = ({ size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 21s8-5.5 8-11a8 8 0 1 0-16 0c0 5.5 8 11 8 11z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
    <circle cx="12" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.2"/>
  </svg>
);
const ClockIcon = ({ size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.2"/>
    <path d="M12 7v6l4 2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const ShieldIcon = ({ size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 2l7 4v6c0 5-3.5 9-7 10-3.5-1-7-5-7-10V6l7-4z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const ZapIcon = ({ size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
import './Landing.css';

const Landing = ({ user: userProp, onLogout: onLogoutProp }) => {
  const navigate = useNavigate();
  const { currentUser, logout } = useAuth();
  const user = currentUser || userProp;
  const onLogout = onLogoutProp || logout;

  return (
    <div className="landing-page">
      {/* Header */}
      <header className="landing-header" data-testid="landing-header">
        <div className="container">
          <div className="header-content">
              <div className="logo" data-testid="logo">
              <FuelIcon size={32} />
              <span>Fuel & Fix</span>
            </div>
            <nav className="nav-links">
              {user ? (
                <button className="btn-logout" onClick={onLogout} data-testid="logout-btn">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M16 17l5-5-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M21 12H9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Logout
                </button>
              ) : (
                <button className="btn btn-primary" onClick={() => navigate('/login')} data-testid="get-started-btn">
                  Get Started
                </button>
              )}
            </nav>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="hero-section" data-testid="hero-section">
        <div className="container">
          <div className="hero-content">
            <h1 className="hero-title" data-testid="hero-title">
              On-Demand <span className="gradient-text">Fuel Delivery</span>
              <br />& Vehicle Repair
            </h1>
            <p className="hero-subtitle" data-testid="hero-subtitle">
              Get fuel delivered or book a mechanic instantly. Fast, reliable, and available 24/7.
            </p>
            <div className="hero-cta">
              {!user && (
                <button className="btn btn-primary btn-lg" onClick={() => navigate('/register')} data-testid="book-now-btn">
                  <FuelIcon size={20} />
                  Book Now
                </button>
              )}
              {user && user.role === 'user' && (
                <button className="btn btn-primary btn-lg" onClick={() => navigate('/dashboard')} data-testid="book-now-btn">
                  <FuelIcon size={20} />
                  Book Now
                </button>
              )}
              {user && (user.role === 'admin' || user.role === 'mechanic' || user.role === 'delivery') && (
                <button className="btn btn-primary btn-lg" onClick={() => navigate('/dashboard')} data-testid="go-to-dashboard-btn">
                  Go to Dashboard
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section className="services-section" data-testid="services-section">
        <div className="container">
          <h2 className="section-title" data-testid="services-title">Our Services</h2>
          <div className="services-grid">
            <div
              className="service-card"
              data-testid="fuel-service-card"
              role="button"
              tabIndex={0}
              onClick={() => {
                if (!user || user.role === 'user') {
                  navigate('/dashboard?service=fuel');
                }
              }}
              onKeyDown={(e) => { 
                if ((!user || user.role === 'user') && e.key === 'Enter') {
                  navigate('/dashboard?service=fuel');
                }
              }}
            >
              <div className="service-icon">
                <FuelIcon size={40} />
              </div>
              <h3>Fuel Delivery</h3>
              <p>Get petrol, diesel, or CNG delivered directly to your location within minutes.</p>
            </div>
            <div
              className="service-card"
              data-testid="repair-service-card"
              role="button"
              tabIndex={0}
              onClick={() => {
                if (!user || user.role === 'user') {
                  navigate('/dashboard?service=mechanical');
                }
              }}
              onKeyDown={(e) => { 
                if ((!user || user.role === 'user') && e.key === 'Enter') {
                  navigate('/dashboard?service=mechanical');
                }
              }}
            >
              <div className="service-icon">
                <WrenchIcon size={40} />
              </div>
              <h3>Vehicle Repair</h3>
              <p>Expert mechanics available for engine repairs, battery replacement, tire service, and more.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="features-section" data-testid="features-section">
        <div className="container">
          <h2 className="section-title" data-testid="features-title">Why Choose Us</h2>
          <div className="features-grid">
            <div className="feature-item" data-testid="realtime-tracking-feature">
              <MapPinIcon size={32} />
              <h4>Real-time Tracking</h4>
              <p>Track your service provider in real-time</p>
            </div>
            <div className="feature-item" data-testid="fast-response-feature">
              <ClockIcon size={32} />
              <h4>Fast Response</h4>
              <p>Average response time under 10 minutes</p>
            </div>
            <div className="feature-item" data-testid="secure-payments-feature">
              <ShieldIcon size={32} />
              <h4>Secure Payments</h4>
              <p>Safe and encrypted payment processing</p>
            </div>
            <div className="feature-item" data-testid="24-7-available-feature">
              <ZapIcon size={32} />
              <h4>24/7 Available</h4>
              <p>Service available round the clock</p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer" data-testid="landing-footer">
        <div className="container">
          <p>&copy; 2025 Fuel & Fix. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
