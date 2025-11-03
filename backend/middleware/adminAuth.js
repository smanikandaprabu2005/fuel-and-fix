const jwt = require('jsonwebtoken');
const config = require('../config/config');

module.exports = function(req, res, next) {
  // Get token from header
  let token = req.header('Authorization');
  
  // Check for x-auth-token if Authorization header is not present
  if (!token) {
    token = req.header('x-auth-token');
  }

  // If Authorization header is in Bearer format, extract the token
  if (token && token.startsWith('Bearer ')) {
    token = token.slice(7);
  }

  // Check if no token
  if (!token) {
    return res.status(401).json({ msg: 'No token, authorization denied' });
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, config.jwtSecret);
    
    // Add user from payload
    req.user = decoded.user;

    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ msg: 'Access denied. Admin privileges required.' });
    }

    next();
  } catch (err) {
    res.status(401).json({ msg: 'Token is not valid' });
  }
};