# Commander Sign-Up Server

Backend API server for the Commander Pre-Con League sign-up application.

## Setup

1. Install dependencies:
```bash
cd server
npm install
```

2. Start the server:
```bash
npm start
```

For development with auto-reload:
```bash
npm run dev
```

## API Endpoints

- `GET /api/health` - Health check
- `GET /api/signups` - Get all signups
- `POST /api/signups` - Create a new signup
- `DELETE /api/signups/:id` - Delete a signup

## Data Storage

Signup data is stored in `server/data/signups.json`.
