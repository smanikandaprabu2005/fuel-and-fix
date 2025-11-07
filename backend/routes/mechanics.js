const express = require('express');
const router = express.Router();
const Mechanic = require('../models/mechanic');

// @route   GET api/mechanics
// @desc    Get all mechanics
router.get('/', async (req, res) => {
  try {
    const mechanics = await Mechanic.find();
    res.json(mechanics);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// @route   GET api/mechanics/nearby
// @desc    Get nearby mechanics based on location
router.get('/nearby', async (req, res) => {
  const { lat, lng, distance = 10 } = req.query; // distance in km

  try {
    // Find mechanics within specified distance
    const mechanics = await Mechanic.find({
      location: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [parseFloat(lng), parseFloat(lat)]
          },
          $maxDistance: distance * 1000 // Convert km to meters
        }
      },
      available: true
    });

    res.json(mechanics);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});
router.get('/:id/requests', async (req, res) => {
  try {
    const mechanicId = req.params.id;

    // Example: Fetch service requests linked to this mechanic
    const ServiceRequest = require('../models/ServiceRequest');
    const requests = await ServiceRequest.find({ mechanic: mechanicId });

    if (!requests || requests.length === 0) {
      return res.status(404).json({ message: 'No requests found for this mechanic' });
    }

    res.json(requests);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

module.exports = router;