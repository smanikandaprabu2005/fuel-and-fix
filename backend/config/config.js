require('dotenv').config();

module.exports = {
  mongoURI: process.env.MONGO_URI || 'mongodb://localhost:27017/fuelAssistance',
  jwtSecret: process.env.JWT_SECRET || 'fuelAssistanceSecret',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d', // Set a longer expiration time
  //googleMapsAPIKey: process.env.GOOGLE_MAPS_API_KEY || 'your-google-maps-api-key'
};