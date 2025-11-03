const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Mechanic = require('../models/mechanic');
const DeliveryPerson = require('../models/DeliveryPerson');
const config = require('../config/config');

// @route   POST api/auth/register
// @desc    Register a user
router.post('/register', async (req, res) => {
  const { name, email, password, phone } = req.body;

  try {
    console.log('Registration attempt for:', email);

    // Validate input
    if (!name || !email || !password || !phone) {
      return res.status(400).json({ 
        msg: 'Please provide all required fields',
        missing: {
          name: !name,
          email: !email,
          password: !password,
          phone: !phone
        }
      });
    }

    // Check if user exists
    let user = await User.findOne({ email });
    if (user) {
      console.log('User already exists:', email);
      return res.status(400).json({ msg: 'User already exists' });
    }

    // Create new user with role always set to 'user'
    user = new User({
      name,
      email,
      password,
      phone,
      role: 'user' // Regular registration is always 'user' role
    });

    // Hash password
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(password, salt);

    // Save user
    console.log('Saving new user:', email);
    const savedUser = await user.save();
    console.log('User saved successfully:', savedUser._id);

    // Generate token
    const payload = { user: { id: savedUser.id, role: savedUser.role } };

    jwt.sign(payload, config.jwtSecret, { expiresIn: 3600 }, (err, token) => {
      if (err) {
        console.error('Token generation error:', err);
        throw err;
      }
      res.json({ 
        token, 
        user: { 
          id: savedUser.id, 
          name: savedUser.name, 
          email: savedUser.email, 
          phone: savedUser.phone, 
          role: savedUser.role 
        } 
      });
    });
  } catch (err) {
    console.error('Registration error:', err);
    console.error('Full error details:', JSON.stringify(err, null, 2));
    res.status(500).json({
      msg: 'Server error during registration',
      error: err.message
    });
  }
});

// @route   POST api/auth/login
// @desc    Authenticate user & get token
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    // Try to find the user in each collection
    let user = await User.findOne({ email });
    let mechanic = await Mechanic.findOne({ email });
    let deliveryPerson = await DeliveryPerson.findOne({ email });

    // Determine which type of user is trying to log in
    let authenticatedUser = null;
    let userRole = '';

    if (user) {
      const isMatch = await bcrypt.compare(password, user.password);
      if (isMatch) {
        authenticatedUser = user;
        userRole = user.role; // Use the actual role from user object (can be 'user' or 'admin')
      }
    } else if (mechanic) {
      const isMatch = await bcrypt.compare(password, mechanic.password);
      if (isMatch) {
        authenticatedUser = mechanic;
        userRole = 'mechanic';
      }
    } else if (deliveryPerson) {
      const isMatch = await bcrypt.compare(password, deliveryPerson.password);
      if (isMatch) {
        authenticatedUser = deliveryPerson;
        userRole = 'delivery';
      }
    }

    if (!authenticatedUser) {
      return res.status(400).json({ msg: 'Invalid credentials' });
    }

    const payload = { 
      user: { 
        id: authenticatedUser.id, 
        role: userRole 
      } 
    };

    jwt.sign(payload, config.jwtSecret, { expiresIn: 3600 }, (err, token) => {
      if (err) throw err;
      
      // Format user data based on role
      const userData = {
        id: authenticatedUser.id,
        name: authenticatedUser.name,
        email: authenticatedUser.email,
        phone: authenticatedUser.phone,
        role: userRole
      };

      // Add role-specific data
      if (userRole === 'mechanic') {
        userData.specialties = authenticatedUser.specialties;
        userData.location = authenticatedUser.location;
        userData.available = authenticatedUser.available;
      } else if (userRole === 'delivery') {
        userData.vehicleType = authenticatedUser.vehicleType;
        userData.location = authenticatedUser.location;
        userData.available = authenticatedUser.available;
      }

      res.json({ token, user: userData });
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// @route POST api/auth/forgot
// @desc  Request password reset token (email sending is a stub)
router.post('/forgot', async (req, res) => {
  const { email } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ msg: 'User not found' });

    const resetToken = Math.random().toString(36).slice(2, 10);
    user.resetToken = resetToken;
    user.resetTokenExpiry = Date.now() + 3600000; // 1 hour
    await user.save();

    // TODO: send resetToken via email. For now return token in response (dev only)
    res.json({ msg: 'Reset token generated', resetToken });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// @route POST api/auth/reset
// @desc  Reset password with token
router.post('/reset', async (req, res) => {
  const { email, token, newPassword } = req.body;
  try {
    const user = await User.findOne({ email, resetToken: token, resetTokenExpiry: { $gt: Date.now() } });
    if (!user) return res.status(400).json({ msg: 'Invalid or expired token' });

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    user.resetToken = undefined;
    user.resetTokenExpiry = undefined;
    await user.save();

    res.json({ msg: 'Password reset successful' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

module.exports = router;