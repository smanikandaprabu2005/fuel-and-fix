Fuel and Fix

Monorepo with backend (Express, MongoDB) and frontend (React + Vite).

Getting started (development):

Backend:
- cd backend
- copy .env.example to .env and set MONGO_URI, JWT_SECRET, GOOGLE_MAPS_API_KEY
- npm install
- npm start

Frontend:
- cd Frontend
- npm install
- npm run dev

Notes:
- Socket.IO is used for real-time broadcasts.
- Admin can create mechanics/delivery personnel via admin endpoints (requires admin JWT).
- Payment flows are stubbed; integrate Stripe/Razorpay for production.

Environment variables:
- Backend: put MONGO_URI, JWT_SECRET, GOOGLE_MAPS_API_KEY in `.env` at repo root.
- Frontend (Vite): use `VITE_API_URL` and `VITE_GOOGLE_MAPS_API_KEY` in `.env` (already added to repo .env in development snippet).

Google Maps billing note:
- If you see "Google Maps JavaScript API error: BillingNotEnabledMapError", enable billing on your Google Cloud project for the Maps JavaScript API or use a free/non-billing alternative such as Leaflet + OpenStreetMap for development.
- To use Leaflet instead, replace the `@react-google-maps/api` Map component with a Leaflet map (I can add a fallback implementation if you'd like).
Deployment:
- Frontend: Vercel
- Backend: Render or Railway

Security:
- Move socket provider map to Redis for scale.
- Send credentials via email/SMS in production.
