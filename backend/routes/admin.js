const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Mechanic = require('../models/mechanic');
const DeliveryPerson = require('../models/DeliveryPerson');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const ServiceRequest = require('../models/ServiceRequest');
const { authenticate, authorizeRoles } = require('../middleware/auth');

// Apply authentication and admin role middleware to all routes in this router
router.use(authenticate);
router.use(authorizeRoles('admin'));

// @route   POST /api/admin/provider
// @desc    Create a new service provider (mechanic or delivery person)
router.post('/provider', async (req, res) => {
  try {
    console.log('Received provider creation request:', req.body);
    const { name, email, phone, role, specialties, vehicleType } = req.body;

    // Validate required fields
    if (!name || !email || !phone || !role) {
      return res.status(400).json({ msg: 'Please provide all required fields (name, email, phone, role)' });
    }

    // Validate role
    if (!['mechanic', 'delivery'].includes(role)) {
      return res.status(400).json({ msg: 'Invalid role. Must be mechanic or delivery.' });
    }

    // Check if user or provider already exists
    const existingUser = await User.findOne({ email });
    const existingMechanic = await Mechanic.findOne({ email });
    const existingDelivery = await DeliveryPerson.findOne({ email });
    
    if (existingUser || existingMechanic || existingDelivery) {
      return res.status(400).json({ msg: 'A user or provider with this email already exists' });
    }

    // Generate random password
    const tempPassword = Math.random().toString(36).slice(-8);
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(tempPassword, salt);

    // Create user first
    user = new User({
      name,
      email,
      password: hashedPassword,
      role,
      phone
    });

    await user.save();
    console.log('User created successfully:', user._id);

    try {
      // Create provider based on role
      if (role === 'mechanic') {
        await Mechanic.create({
          user: user._id,
          name,
          email,
          specialties: specialties?.length > 0 ? specialties : ['general'],
          active: true,
          availability: true,
          location: {
            type: 'Point',
            coordinates: [0, 0]
          }
        });
      } else {
        await DeliveryPerson.create({
          user: user._id,
          name,
          email,
          vehicleType: vehicleType || 'motorcycle',
          active: true,
          availability: true,
          location: {
            type: 'Point',
            coordinates: [0, 0]
          }
        });
      }

      res.status(201).json({
        msg: 'Provider created successfully',
        tempPassword,
        providerId: user._id
      });
    } catch (err) {
      // If provider creation fails, cleanup the user
      await User.findByIdAndDelete(user._id);
      throw err;
    }
  } catch (err) {
    console.error('Error creating provider:', err.message);
    res.status(400).json({ msg: err.message });
  }
});

// @route   GET /api/admin/stats
// @desc    Get admin dashboard statistics
router.get('/stats', async (req, res) => {
  try {
    const stats = {
      users: await User.countDocuments({ role: 'user' }),
      mechanics: await Mechanic.countDocuments(),
      deliveryPersons: await DeliveryPerson.countDocuments(),
      requests: await ServiceRequest.countDocuments(),
      activeRequests: await ServiceRequest.countDocuments({ status: 'in-progress' }),
      completedRequests: await ServiceRequest.countDocuments({ status: 'completed' })
    };
    res.json(stats);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   GET /api/admin/users
// @desc    Get paginated list of regular users
router.get('/users', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;

    const users = await User.find({ role: 'user' })
      .select('-password')  // Exclude password from the response
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await User.countDocuments({ role: 'user' });
    const totalPages = Math.ceil(total / limit);

    res.json({
      users,
      currentPage: page,
      totalPages,
      total
    });
  } catch (err) {
    console.error('Error fetching users:', err.message);
    res.status(500).send('Server Error');
  }
});

// @route   DELETE /api/admin/users/:userId
// @desc    Delete a user and associated data
router.delete('/users/:userId', async (req, res) => {
  try {
    // Validate userId format
    if (!mongoose.Types.ObjectId.isValid(req.params.userId)) {
      return res.status(400).json({ msg: 'Invalid user ID format' });
    }

    // Find user first
    const user = await User.findById(req.params.userId);
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    // Delete from appropriate collection based on role
    if (user.role === 'mechanic') {
      const mechanic = await Mechanic.findOneAndDelete({ user: user._id });
      if (mechanic) {
        await ServiceRequest.deleteMany({ mechanic: mechanic._id });
      }
    } else if (user.role === 'delivery') {
      const deliveryPerson = await DeliveryPerson.findOneAndDelete({ user: user._id });
      if (deliveryPerson) {
        await ServiceRequest.deleteMany({ deliveryPerson: deliveryPerson._id });
      }
    }

    // Delete service requests created by this user
    await ServiceRequest.deleteMany({ user: user._id });
    
    // Finally delete the user
    await User.findByIdAndDelete(user._id);

    res.json({ msg: 'User and all associated data deleted successfully' });
  } catch (err) {
    console.error('Error deleting user:', err);
    res.status(500).json({ msg: 'Server Error', error: err.message });
  }
});

// @route   GET /api/admin/mechanics
// @desc    Get list of mechanics
router.get('/mechanics', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;

    const mechanics = await Mechanic.find()
      .populate('user', 'name email phone')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Mechanic.countDocuments();
    const totalPages = Math.ceil(total / limit);

    const mechanicsWithUserData = mechanics.map(mechanic => ({
      _id: mechanic._id,
      user: mechanic.user._id,
      name: mechanic.user.name,
      email: mechanic.user.email,
      phone: mechanic.user.phone,
      specialties: mechanic.specialties,
      available: mechanic.availability
    }));

    res.json({
      mechanics: mechanicsWithUserData,
      currentPage: page,
      totalPages,
      total
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   GET /api/admin/delivery
// @desc    Get list of delivery personnel
router.get('/delivery', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;

    const delivery = await DeliveryPerson.find()
      .populate('user', 'name email phone')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await DeliveryPerson.countDocuments();
    const totalPages = Math.ceil(total / limit);

    const deliveryWithUserData = delivery.map(person => ({
      _id: person._id,
      user: person.user._id,
      name: person.user.name,
      email: person.user.email,
      phone: person.user.phone,
      vehicleType: person.vehicleType,
      available: person.availability
    }));

    res.json({
      delivery: deliveryWithUserData,
      currentPage: page,
      totalPages,
      total
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   DELETE /api/admin/users/:id
// @desc    Delete a user and associated provider data
router.delete('/users/:id', async (req, res) => {
  try {
    const userId = req.params.id;

    // Start a session for transaction
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Find and delete user
      const user = await User.findById(userId);
      if (!user) {
        await session.abortTransaction();
        return res.status(404).json({ msg: 'User not found' });
      }

      // Check user's role and delete associated data
      if (user.role === 'mechanic') {
        await Mechanic.findOneAndDelete({ user: userId }).session(session);
      } else if (user.role === 'delivery') {
        await DeliveryPerson.findOneAndDelete({ user: userId }).session(session);
      }

      // Delete the user
      await User.findByIdAndDelete(userId).session(session);

      // Delete associated service requests
      await ServiceRequest.deleteMany({ 
        $or: [
          { user: userId },
          { provider: userId }
        ]
      }).session(session);

      // Commit transaction
      await session.commitTransaction();
      res.json({ msg: 'User and associated data deleted successfully' });
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }
  } catch (err) {
    console.error('Error deleting user:', err);
    res.status(500).json({ msg: 'Server error while deleting user' });
  }
});

module.exports = router;