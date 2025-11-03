const mongoose = require('mongoose');

const PricingSchema = new mongoose.Schema({
  pricePerKm: {
    type: Number,
    required: true,
    default: 7 // default ₹7 per km
  },
  currency: {
    type: String,
    default: 'INR'
  },
  // Default fuel price per litre (used for fuel delivery requests)
  fuelPricePerLitre: {
    type: Number,
    default: 100
  },
  minFare: {
    type: Number,
    default: 0
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Pricing', PricingSchema);
