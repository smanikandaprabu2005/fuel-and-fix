const express = require('express');
const router = express.Router();
const Pricing = require('../models/Pricing');
const { authenticate, authorizeRoles } = require('../middleware/auth');

// GET current pricing (admin-only)
router.get('/', authenticate, authorizeRoles('admin'), async (req, res) => {
  try {
    let pricing = await Pricing.findOne().sort({ updatedAt: -1 }).exec();
    if (!pricing) {
      pricing = await Pricing.create({ pricePerKm: 7 });
    }
    res.json(pricing);
  } catch (err) {
    console.error('Error fetching pricing', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// POST update pricing (admin-only)
router.post('/', authenticate, authorizeRoles('admin'), async (req, res) => {
  const { pricePerKm, currency, minFare } = req.body;
  try {
    const pricing = new Pricing({ pricePerKm, currency, minFare });
    await pricing.save();
    res.json(pricing);
  } catch (err) {
    console.error('Error updating pricing', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

module.exports = router;
