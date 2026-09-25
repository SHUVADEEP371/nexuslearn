# NexusLearn

**Real-Time Collaborative Peer-to-Peer Learning & AI-Powered Study Platform**

NexusLearn helps people teach skills, find learning partners, schedule sessions, and collaborate in a shared workspace with chat, notes, and Gemini-powered study aids.

![TypeScript](https://img.shields.io/badge/TypeScript-5.7.3%2B-3178C6?logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-18.2.0%2B-61DAFB?logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-6.1.0%2B-646CFF?logo=vite&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-runtime-339933?logo=nodedotjs&logoColor=white)
![Express](https://img.shields.io/badge/Express-4-000000?logo=express&logoColor=white)
![MongoDB Atlas](https://img.shields.io/badge/MongoDB-Atlas-47A248?logo=mongodb&logoColor=white)
![Upstash Redis](https://img.shields.io/badge/Upstash-Redis-00E9A3?logo=redis&logoColor=black)
![Google Gemini AI](https://img.shields.io/badge/Google-Gemini%202.5%20Flash-8E75B2?logo=googlegemini&logoColor=white)
![Socket.IO](https://img.shields.io/badge/Socket.IO-4-010101?logo=socketdotio&logoColor=white)

## Live Deployments

### Frontend (Vercel)

- **Primary production:** [https://nexuslearn-omega.vercel.app](https://nexuslearn-omega.vercel.app)
- **Branch previews:**
  - [https://nexuslearn-git-main-shuvadeep.vercel.app](https://nexuslearn-git-main-shuvadeep.vercel.app)
  - [https://nexuslearn-lscue6r52-shuvadeep.vercel.app](https://nexuslearn-lscue6r52-shuvadeep.vercel.app)

### Backend (Render, Docker container)

- **Base URL:** [https://nexuslearn-api-9jm4.onrender.com](https://nexuslearn-api-9jm4.onrender.com)
- **API root:** [https://nexuslearn-api-9jm4.onrender.com/api](https://nexuslearn-api-9jm4.onrender.com/api)
- **Health check:** [https://nexuslearn-api-9jm4.onrender.com/health](https://nexuslearn-api-9jm4.onrender.com/health)

## Contents

- [Live deployments](#live-deployments)
- [Features](#features)
- [Architecture](#architecture)
- [Requirements](#requirements)
- [Environment configuration](#environment-configuration)
- [Local development](#local-development)
- [Docker Compose](#docker-compose)
- [Production deployment](#production-deployment)
- [API and real-time overview](#api-and-real-time-overview)
- [Security and operational notes](#security-and-operational-notes)
- [Repository structure](#repository-structure)
- [Known limitations](#known-limitations)
- [Upcoming Features and Improvements](#upcoming-features-and-improvements)

## Features

- **Peer skill exchange:** Create profiles, publish skills offered and wanted, discover peers, and propose or manage exchanges.
- **Reciprocal matching:** Rank candidates by mutually offered/wanted skills, reputation, and configured weekly availability overlap.
- **Session scheduling and credits:** Schedule accepted exchanges, prevent overlapping sessions, and hold/release internal Skill Credits with MongoDB transactions. Paid sessions can use Razorpay when configured.
- **Real-time collaboration:** Authenticated Socket.IO rooms support persistent chat, revision-aware shared Markdown notes, WebRTC call signaling, and low-latency room updates. The notes workspace is collaborative; a separate whiteboard is not currently implemented.
- **Gemini 2.5 Flash study aids:** Configure `GEMINI_MODEL=gemini-2.5-flash` for syllabus generation, contextual note extraction, and post-session feedback. Calls are validated, bounded with retries, and limited to 10 requests per authenticated user (or client IP) per 15-minute window.
- **Redis-backed throttling:** `ioredis` accepts TLS `rediss://` URLs, including Upstash. Shared Redis rate limits fail open if Redis is unavailable so API requests continue.
- **Operational health and shutdown:** Public `GET /health` is outside auth and rate limiting. The server trusts one reverse proxy hop and gracefully drains HTTP/Socket.IO, Redis, and MongoDB on termination signals and fatal process errors.

## Architecture

| Area | Technologies and responsibility |
| --- | --- |
| Frontend | React 18, Vite, TypeScript for newer modules, JavaScript/JSX legacy screens, Tailwind CSS, React Router, Lucide icons |
| Client data and transport | Axios, TanStack Query provider, Socket.IO client, WebRTC browser APIs |
| Backend | Node.js 22, Express 4, TypeScript feature modules with controllers, services, repositories, middleware, and Socket.IO handlers; legacy JavaScript routes remain for compatibility |
| Database | MongoDB/Mongoose; replica-set transactions for session/credit/payment operations |
| In-memory store | Redis via ioredis; shared rate-limit storage and Socket.IO Redis adapter; optional for one local API process |
| AI services | Google GenAI SDK, configurable Gemini model, LangChain prompt utilities, Zod validation |
| Local infrastructure | Docker Compose, MongoDB replica set, Redis, two API instances, Nginx gateway, static client container |
| Cloud hosting | API can run on Render; static Vite frontend can run on Vercel; MongoDB Atlas and Upstash Redis can provide managed data services |

This is an incremental migration from a JavaScript MVP. The typed backend lives in `server/src/`; existing JavaScript route and model modules under `server/routes/` and `server/models/` still serve core profile, swap, and review functionality. The frontend also retains JavaScript pages alongside typed components.

## Requirements

- Node.js 22 or newer and npm
- MongoDB replica set for transaction-backed sessions, credit ledger, and payments
- Redis for shared rate limiting and multi-instance Socket.IO (optional for a single local API process)
- Docker Desktop or Docker Engine with the Compose plugin (optional)
- Gemini API key for AI features

## Environment configuration

Copy `server/.env.example` to `server/.env` and `client/.env.example` to `client/.env.local` for local configuration. Keep all credentials server-side and out of version control. The ignore rules exclude root and nested `.env` and `.env.local` files.

### Server: `server/.env.example`

```dotenv
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb://127.0.0.1:27017/nexuslearn?replicaSet=rs0
JWT_SECRET=
CORS_ORIGINS=http://localhost:3000
COOKIE_SECURE=false
AUTH_COOKIE_SAME_SITE=strict
REDIS_URL=redis://localhost:6379
GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.5-flash
SESSION_PRICE_INR_PER_HOUR=0
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
TURN_SERVER_URL=
TURN_USERNAME=
TURN_CREDENTIAL=
ADMIN_ID=
ADMIN_PASS=
```

`MONGODB_URI` and `JWT_SECRET` are required by the API. Use a MongoDB replica-set URI for features that use transactions. `REDIS_URL` is optional for a single process; use a `rediss://` URL for TLS-enabled hosted Redis. AI, payment, TURN, and legacy admin settings are optional. Use long random production secrets and rotate credentials if exposed. The production backend runs as a Docker container on Render. For the separate Vercel and Render domains, configure `COOKIE_SECURE=true` and `AUTH_COOKIE_SAME_SITE=none` on Render.

### Client: `client/.env.example` (copy to `.env.local`)

```dotenv
VITE_API_URL=http://localhost:5000/api
VITE_SOCKET_URL=http://localhost:5000
```

For local Vite development, these may be omitted: `/api` is proxied to the local server, and the socket client defaults to the current origin. In production, set them to the deployed API origin and base path. `VITE_` values are embedded in browser assets; never put secrets in them.

## Local development

### PowerShell

From the repository root:

```powershell
npm install
npm --prefix server ci
npm --prefix client ci
Copy-Item server/.env.example server/.env
docker compose up -d database redis
npm run dev
```

### Bash

From the repository root:

```bash
npm install
npm --prefix server ci
npm --prefix client ci
cp server/.env.example server/.env
docker compose up -d database redis
npm run dev
```

Set a strong `JWT_SECRET` in `server/.env`; add `GEMINI_API_KEY` to enable AI generation. `npm run dev` starts the API in watch mode and the Vite client. The client is available at `http://localhost:3000`, the API at `http://localhost:5000`, and the public health endpoint at `http://localhost:5000/health`.

The local MongoDB container initializes a single-node replica set needed by transactional features. Redis is optional for local single-process operation, but is required to exercise shared rate limits and cross-process Socket.IO behavior.

### Build commands

```powershell
npm --prefix server run build
npm --prefix client run build
```

The server build emits `server/dist`; the client build emits `client/dist`.

## Docker Compose

After configuring `server/.env`, run:

```bash
docker compose up --build
```

The Compose stack includes MongoDB 7 as a single-node replica set, Redis 7, two API instances, a static Vite client, and an Nginx gateway. Open `http://localhost`. Named MongoDB and Redis volumes persist data across container restarts. `docker compose down -v` deletes those volumes and their data.

The default gateway uses local HTTP configuration. For HTTPS, configure the TLS Nginx file and certificates under `nginx/certs`, set the Compose `NGINX_CONFIG` value to `./nginx/nginx.conf`, and enable secure cookies. Set `CORS_ORIGINS` to the actual frontend origin(s).

## Production deployment

### Render: API

Create a Render **Web Service** connected to the repository and deploy it using the Docker runtime and `server/Dockerfile`:

1. Set the service runtime to **Docker** and set the Dockerfile path to `server/Dockerfile` with the repository root as the build context.
2. The Dockerfile installs dependencies, compiles TypeScript, and starts the API with `npm start`.
3. Set **Health Check Path** to `/health`.
4. Add the environment variables below. Render supplies `PORT`; the API binds to it.

Required and commonly used Render variables:

| Name | Value |
| --- | --- |
| `NODE_ENV` | `production` |
| `MONGODB_URI` | MongoDB Atlas connection string with replica-set support |
| `JWT_SECRET` | Long, unique random value |
| `CORS_ORIGINS` | `https://nexuslearn-omega.vercel.app,https://nexuslearn-git-main-shuvadeep.vercel.app,http://localhost:3000` |
| `COOKIE_SECURE` | `true` |
| `AUTH_COOKIE_SAME_SITE` | `none` |
| `REDIS_URL` | Upstash Redis TLS connection string beginning with `rediss://` |
| `GEMINI_API_KEY` | Gemini API key, if AI features are enabled |
| `GEMINI_MODEL` | `gemini-2.5-flash` |

The `nexuslearn-lscue6r52-shuvadeep.vercel.app` preview origin is not in the `CORS_ORIGINS` value above. Add `https://nexuslearn-lscue6r52-shuvadeep.vercel.app` to that value if this preview needs API access, then redeploy the backend.

Add optional Razorpay credentials, `SESSION_PRICE_INR_PER_HOUR`, or TURN server credentials only when using those features. Do not copy secret values into the README or Vercel client settings.

Render can monitor `/health` using its health check path. For an external availability check, configure a cron-job.org HTTP GET monitor for the service's public `/health` URL at a 10-minute interval. The endpoint reports process health; periodic external requests are not a guarantee against platform cold starts or instance suspension.

### Vercel: frontend

1. Import the same repository into Vercel.
2. Set **Root Directory** to `client`.
3. Use `npm run build` as the build command and `dist` as the output directory.
4. Set these Vercel environment variables for each environment (Production and Preview as needed):

   | Name | Value |
   | --- | --- |
   | `VITE_API_URL` | `https://nexuslearn-api-9jm4.onrender.com/api` |
   | `VITE_SOCKET_URL` | `https://nexuslearn-api-9jm4.onrender.com` |

5. Add each deployed Vercel site origin to Render's comma-separated `CORS_ORIGINS` and redeploy the API after changing it.

Deploy previews use distinct origins; allow only the intended preview domain(s). Do not expose server credentials in any `VITE_` variable. After changing Vercel environment variables, create a new deployment so the Vite build embeds the updated values.

## API and real-time overview

All HTTP API routes use the `/api` prefix except `GET /health`.

| Route | Purpose |
| --- | --- |
| `GET /health` | Public lightweight health probe; returns status, process uptime, and an ISO timestamp. It is mounted before auth and global rate limiting. |
| `/api/auth` | Member registration, login, refresh, logout, and current-user routes |
| `/api/users` | User profiles, search, profile updates, skills, and reviews |
| `/api/swaps` | Exchange proposals and their state transitions |
| `/api/sessions` | Session scheduling, reading, completion, and session logistics |
| `/api/matching` | Automatic and user-specific reciprocal skill matching |
| `/api/ai` | Session notes, post-session feedback, and syllabus generation |
| `/api/payments` | Optional paid-session checkout and verification |

Session Socket.IO rooms persist chat messages and shared notes, broadcast note revisions and AI note chunks, and relay WebRTC signaling. Calls use peer-to-peer media with STUN by default; production networks may require a configured TURN relay. AI endpoints require session authorization and apply a per-user/IP 10-request/15-minute limit.

## Security and operational notes

- Configure `CORS_ORIGINS` as an explicit comma-separated origin allow-list. The server normalizes whitespace and trailing slashes and enables credentials.
- `app.set('trust proxy', 1)` supports the Render/Nginx proxy chain and client IP detection; deploy only behind the expected single proxy hop.
- Refresh credentials are stored hashed and transported in an HttpOnly cookie. Enable `COOKIE_SECURE=true` when serving over HTTPS.
- Redis-backed HTTP throttles use fail-open behavior if Redis is temporarily unavailable. This preserves availability, while rate limiting is temporarily less effective during an outage.
- Fatal process errors and termination signals initiate graceful shutdown of HTTP/Socket.IO, Redis, and MongoDB connections.
- Profile media currently uses the existing upload handling; managed object storage and malware scanning are not configured here.
- Back up MongoDB, rotate secrets, use HTTPS, monitor logs and service health, and validate production CORS and cookie behavior before public launch.

## Repository structure

```text
.
├── client/
│   ├── src/components/       # Shared UI and live session workspace
│   ├── src/pages/            # React application screens
│   ├── src/contexts/         # Client auth context
│   ├── src/config/           # API client configuration
│   └── vite.config.ts
├── server/
│   ├── src/                  # Typed API, AI, session, and realtime modules
│   │   ├── ai/ controllers/ infra/ middleware/ models/
│   │   ├── realtime/ repositories/ routes/ services/
│   ├── routes/               # Legacy JavaScript Express routes
│   ├── models/               # Legacy JavaScript Mongoose models
│   └── scripts/              # Database migration utilities
├── nginx/                    # Development and TLS gateway configuration
├── docs/                     # Architecture and upgrade documentation
├── docker-compose.yml
└── README.md
```

## Known limitations

- The codebase remains a mixed TypeScript/JavaScript migration; not every legacy route uses the typed layered modules.
- Availability is based on a weekly UTC hour grid; a full recurring calendar and date-specific override interface is not implemented.
- External Google/Outlook calendar synchronization is not implemented. Session `.ics` export is available.
- WebRTC uses STUN by default; reliable connectivity across restrictive networks requires a TURN service.
- The collaboration workspace provides persistent chat and shared notes; a separate shared whiteboard is not implemented.
- The production and branch preview URLs are listed in [Live Deployments](#live-deployments). Keep the Render CORS allow-list synchronized with any Vercel deployment that needs API access.

## Upcoming Features and Improvements

- Real-Time Session Start Pop-Up System
- Mobile Number SMS Verification
- Embedded AI Chatbot for Technical Skill Guidance
- Admin Dashboard for Role-Based Management
- Calendar-Based Mentor Availability Booking
- Real-Time Socket.IO Notifications
- Collaborative Code Editor for Live Sessions
- Escrow-Based Dispute Resolution Workflow
- Automated Skill Verification Badges
