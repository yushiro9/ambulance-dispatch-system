# Ambulance Dispatch Board

A deployable, multi-user, secure ambulance dispatch system.

## Setup Instructions

### Prerequisites
- Node.js 20 LTS
- PostgreSQL 16

### 1. Database Setup
1. Create a PostgreSQL database (e.g. `ambulance_db`).
2. Run the initial schema migration:
   ```bash
   psql -d ambulance_db -f backend/migrations/001_initial_schema.sql
   ```

### 2. Backend Setup
1. `cd backend`
2. `npm install`
3. Copy `.env.example` to `.env` and update the `DATABASE_URL` with your local Postgres credentials.
4. Run the seed script to create initial admin users:
   ```bash
   node src/seed.js
   ```
5. Start the backend server:
   ```bash
   npm run dev
   ```

### 3. Frontend Setup
1. `cd frontend`
2. `npm install`
3. Start the dev server:
   ```bash
   npm run dev
   ```

### Testing
Run `npm test` inside the backend directory to execute the Jest integration tests.
