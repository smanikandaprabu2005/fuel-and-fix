const jwt = require('jsonwebtoken');
const config = require('../config/config');

exports.authenticate = (req, res, next) => {
  // Accept token from Authorization header (Bearer ...) or x-auth-token header
  let rawAuth = req.header('Authorization') || req.header('x-auth-token') || null;
  if (!rawAuth) {
    return res.status(401).json({ msg: 'No token, authorization denied' });
  }

  // Normalize to last segment (handles 'Bearer Bearer <token>' or surrounding quotes)
  let token = rawAuth;
  try {
    if (typeof token === 'string') {
      token = token.trim();
      if ((token.startsWith('"') && token.endsWith('"')) || (token.startsWith("'") && token.endsWith("'"))) {
        token = token.slice(1, -1).trim();
      }
      if (token.includes(' ')) token = token.split(/\s+/).pop();
    }
  } catch (e) {
    // fallback: leave token as rawAuth
    token = rawAuth;
  }

  try {
  const decoded = jwt.verify(token, config.jwtSecret);
    req.user = decoded.user;

    // Check if token is close to expiring (within 1 hour) and refresh if needed
    const exp = decoded.exp;
    const now = Math.floor(Date.now() / 1000);
    if (exp - now < 3600) { // Less than 1 hour remaining
      const newToken = jwt.sign(
        { user: decoded.user },
        config.jwtSecret,
        { expiresIn: config.jwtExpiresIn }
      );
      res.setHeader('X-New-Token', newToken);
    }

    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ msg: 'Token has expired', expired: true });
    }
    res.status(401).json({ msg: 'Token is not valid' });
  }
};

exports.authorizeRoles = (...roles) => (req, res, next) => {
  const userRole = req.user?.role;
  if (!userRole || !roles.includes(userRole)) {
    return res.status(403).json({ msg: 'Forbidden: insufficient role' });
  }
  next();
};

module.exports = exports;
