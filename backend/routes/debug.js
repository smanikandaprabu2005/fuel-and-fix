const express = require('express');
const router = express.Router();
const socketManager = require('../socketManager');

// GET /api/debug/room/:roomName
// Returns the list of socket ids and associated user info for a given room
router.get('/room/:roomName', (req, res) => {
  try {
    const io = req.app.get('io');
    const roomName = req.params.roomName;
    if (!io) return res.status(500).json({ msg: 'Socket.IO not initialized' });

    const room = io.sockets.adapter.rooms.get(roomName);
    if (!room) return res.json({ room: roomName, exists: false, members: [] });

    const members = Array.from(room).map(socketId => {
      const socket = io.sockets.sockets.get(socketId);
      return {
        socketId,
        user: socket && socket.user ? socket.user : null,
        rooms: socket ? Array.from(socket.rooms) : []
      };
    });

    return res.json({ room: roomName, exists: true, members });
  } catch (err) {
    console.error('Error in debug room route:', err);
    return res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

// POST /api/debug/emitProviderLocation
// Body: { userId, serviceRequestId, location: { lat, lng } }
router.post('/emitProviderLocation', (req, res) => {
  try {
    const io = req.app.get('io');
    if (!io) return res.status(500).json({ msg: 'Socket.IO not initialized' });

    const { userId, serviceRequestId, location } = req.body;
    if (!userId || !serviceRequestId || !location) {
      return res.status(400).json({ msg: 'Missing userId, serviceRequestId or location' });
    }

    const payload = {
      serviceRequestId,
      location: {
        lat: location.lat,
        lng: location.lng,
        timestamp: Date.now()
      }
    };

    // Emit to the user's room
    io.to(`user_${userId}`).emit('providerLocationUpdate', payload);
    console.log('Debug emit providerLocationUpdate to', `user_${userId}`, payload);

    return res.json({ ok: true, emittedTo: `user_${userId}`, payload });
  } catch (err) {
    console.error('Error in debug emitProviderLocation route:', err);
    return res.status(500).json({ msg: 'Server error', error: err.message });
  }
});
module.exports = router;

// Diagnostic: list registered providers from in-memory socketManager
router.get('/providers', (req, res) => {
  try {
    const providers = [];
    // socketManager exposes internal map; iterate over keys
    const sm = require('../socketManager');
    // Note: socketManager does not currently export a direct iterator; reconstruct from internal methods
    // We'll attempt to access the internal Map if present (for debugging only)
    if (sm && sm.__getInternal) {
      const internal = sm.__getInternal();
      for (const [id, info] of internal.entries()) {
        providers.push({ id, ...info });
      }
    } else {
      // Fallback: try to call findProvidersWithin with a huge radius to collect all
      // This assumes there is no center; we will return an empty array as a safe fallback
      // For better diagnostics, enhance socketManager to expose entries (we can add that if desired)
    }

    res.json({ providers, supported: !!sm.__getInternal });
  } catch (err) {
    console.error('Error returning providers diagnostic:', err);
    res.status(500).json({ msg: 'Error retrieving providers', error: err.message });
  }
});
