const express = require('express');
const router = express.Router();
const DeliveryPerson = require('../models/DeliveryPerson');

// @route   GET api/delivery
// @desc    Get all delivery persons
router.get('/', async (req, res) => {
  try {
    const deliveryPersons = await DeliveryPerson.find();
    res.json(deliveryPersons);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// @route   GET api/delivery/nearby
// @desc    Get nearby delivery persons based on location
router.get('/nearby', async (req, res) => {
  const { lat, lng, distance = 10 } = req.query; // distance in km

  try {
    // Find delivery persons within specified distance
    const deliveryPersons = await DeliveryPerson.find({
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

    res.json(deliveryPersons);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

module.exports = router;