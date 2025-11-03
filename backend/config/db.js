const mongoose = require('mongoose');
const config = require('./config');

const connectDB = async () => {
  try {
    console.log('Attempting to connect to MongoDB...', config.mongoURI);
    
    await mongoose.connect(config.mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    console.log('MongoDB Connected Successfully');
    
    // Test the connection by getting the collections
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log('Available collections:', collections.map(c => c.name));
    
  } catch (err) {
    console.error('MongoDB Connection Error:', err);
    console.error('Full error details:', JSON.stringify(err, null, 2));
    console.log('Please make sure MongoDB is installed and running, or use MongoDB Atlas.');
    throw err; // Rethrow to handle it in server.js
  }
};

module.exports = connectDB;