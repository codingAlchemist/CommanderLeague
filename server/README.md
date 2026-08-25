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

Set `ADMIN_SIGNUP_TOKEN` in the server environment before starting the server. This secret is required to create a new admin account and must not be added to the Angular application.

## API Endpoints

- `GET /api/health` - Health check
- `GET /api/signups` - Get all signups
- `POST /api/signups` - Create a new signup
- `DELETE /api/signups/:id` - Delete a signup
- `GET /api/week-state` - Get current league week state
- `PUT /api/week-state/current` - Start/set current week

## Data Storage

Signup data is stored in `server/data/signups.json`.
Week progression data is stored in `server/data/week-state.json`.
