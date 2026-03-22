import React from 'react';

/** Top-left logo: circle with checkmark + brand name (matches reference mockups) */
const AuthBrand = () => (
  <div className="auth-brand-row">
    <div className="auth-logo-mark" aria-hidden="true">
      <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="20" cy="20" r="18" stroke="url(#authLogoGrad)" strokeWidth="2.5" fill="rgba(13, 28, 58, 0.6)" />
        <path
          d="M12 20.5l5 5 11-11"
          stroke="#1d7fff"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <defs>
          <linearGradient id="authLogoGrad" x1="4" y1="4" x2="36" y2="36">
            <stop stopColor="#2b8cff" />
            <stop offset="1" stopColor="#1566cc" />
          </linearGradient>
        </defs>
      </svg>
    </div>
    <span className="auth-brand-text">Fuel &amp; Fix</span>
  </div>
);

export default AuthBrand;
