# Architecture Overview

## Frontend (Vite + HTML/CSS/JS)
- **Frameworkless**: We use plain HTML/CSS/JS for minimal dependency overhead, served via Vite during development.
- **Styling**: Vanilla CSS utilizing CSS variables for easy theming (Light/Dark mode) and Glassmorphism design tokens for a modern, user-centered feel.
- **State**: The `currentUser` and JWT token are maintained via `fetch()` API calls. 

## Backend (Node.js + Express)
- **REST API**: Built with Express 4.x. Handles authentication, booking logic, and audit trails.
- **Security**: 
  - `bcrypt` for secure password hashing.
  - `jsonwebtoken` for stateless sessions.
  - `helmet` for secure HTTP headers.
  - `express-rate-limit` to prevent brute force attacks on login endpoints.
- **Validation**: Strict schema validation ensures only expected payload fields reach the database.

## Database (PostgreSQL 16)
- **Relational Integrity**: Foreign keys ensure bookings reference valid ambulances and users.
- **Audit Log**: An append-only table (`audit_log`) tracks all state changes in the system (Login, Create Booking, Update Status). In a production environment, the DB user would only have `INSERT` grants on this table to prevent tampering.
