const express = require('express');
const connectDB = require('./config/db');
const cors = require('cors');
require('dotenv').config();

// Initialize app
const app = express();

// Connect Database
connectDB().catch(err => {
  console.error('Database connection failed:', err);
  process.exit(1); // Exit if we can't connect to the database
});

// Init Middleware
app.use(cors());
app.use(express.json());

// Define Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/service', require('./routes/service'));
app.use('/api/mechanics', require('./routes/mechanics'));
app.use('/api/delivery', require('./routes/delivery'));
app.use('/api/pricing', require('./routes/pricing'));
const { authenticate, authorizeRoles } = require('./middleware/auth');
app.use('/api/admin', require('./routes/admin'));
app.use('/api/geo', require('./routes/geo'));
// Debugging routes (dev only)
app.use('/api/debug', require('./routes/debug'));

// Export app for server.js to use
module.exports = app;