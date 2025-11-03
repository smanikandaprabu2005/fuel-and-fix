const express = require('express');
const router = express.Router();
const fetch = require('node-fetch');

// Simple in-memory cache
const cache = {
  data: null,
  timestamp: 0,
  TTL: 5 * 60 * 1000 // 5 minutes
};

// Fallback location (can be moved to config)
const fallbackLocation = {
  ip: '0.0.0.0',
  latitude: 40.7128, // New York City coordinates as default
  longitude: -74.0060,
  city: 'New York',
  region: 'New York',
  country: 'US',
  fallback: true
};

// Simple server-side IP geolocation proxy to avoid CORS issues with third-party APIs.
// Uses ipapi.co as a free best-effort fallback. For production consider a paid provider.
router.get('/ip', async (req, res) => {
  try {
    // Check cache first
    const now = Date.now();
    if (cache.data && (now - cache.timestamp) < cache.TTL) {
      return res.json(cache.data);
    }

    const resp = await fetch('https://ipapi.co/json/', {
      headers: { 'User-Agent': 'FuelAssist/1.0' }
    });
    
    if (!resp.ok) {
      console.warn('IP API error:', resp.status, resp.statusText);
      if (resp.status === 429) { // Too Many Requests
        // Return cached data if available, even if expired
        if (cache.data) {
          console.log('Rate limited, using expired cache');
          return res.json(cache.data);
        }
        // Otherwise use fallback
        return res.json(fallbackLocation);
      }
      return res.status(502).json({ 
        msg: 'IP service error', 
        error: resp.statusText,
        fallbackLocation 
      });
    }

    const data = await resp.json();
    
    // validate required fields exist
    if (!data.latitude || !data.longitude) {
      console.warn('IP API response missing coordinates:', data);
      // Return cached data if available
      if (cache.data) {
        return res.json(cache.data);
      }
      return res.json(fallbackLocation);
    }

    // Update cache
    cache.data = data;
    cache.timestamp = now;
    
    return res.json(data);
  } catch (err) {
    console.error('IP lookup failed', err.message || err);
    // Return cached data on error if available
    if (cache.data) {
      return res.json(cache.data);
    }
    return res.json(fallbackLocation);
  }
});

module.exports = router;
