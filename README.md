# Velvet Hearts Backend

Last updated: August 10th, 2026  
Source of truth: `/docs/Administrator_Manual.docx` and `/docs/User_Manual.docx`

This folder contains the Velvet Hearts backend service. It is a TypeScript Express application that provides REST APIs, authentication token issuance, approval enforcement, admin workflows, moderation workflows, Cloudinary upload brokering, Prisma database access, and Socket.IO realtime behavior.

The backend is the application authority for users, roles, approval status, account status, moderation records, matches, conversations, messages, notifications, and audit logs.

## What is in this folder

| Path | Purpose |
|---|---|
| `src/app.ts` | Express application setup, security middleware, CORS, body parsers, route mounting, `/health`, Socket.IO initialization, graceful shutdown, and Render self-ping. |
| `src/routes/index.ts` | Complete REST route registry and middleware composition. |
| `src/config/env.ts` | Environment variable validation with Zod. |
| `src/config/database.ts` | Prisma Client setup. |
| `src/config/firebase.ts` | Firebase Admin SDK initialization and credential loading. |
| `src/middlewares/auth.middleware.ts` | App JWT validation, deleted/suspended account blocking, approval checks, and role checks. |
| `src/middlewares/rate-limiter.middleware.ts` | Rate limiters for auth, likes, chat, reports, search, and discover. |
| `src/middlewares/error.middleware.ts` | Central error response handling. |
| `src/controllers` | HTTP request/response layer. |
| `src/services` | Business logic for auth, profile (including `sparkNote` update logic), discover, match (returning `sparkNote` for active connections), chat, safety, admin, upload, search, and notifications. |
| `src/repositories` | Database access helpers around Prisma models. |
| `src/socket.ts` | Socket.IO server setup, JWT socket authentication, conversation rooms, and typing events. |
| `src/utils/jwt.ts` | Access/refresh token generation and verification. |
| `src/utils/logger.ts` | Winston logger setup. |
| `src/validators` | Zod request validation schemas (including `sparkNote` 20-character limit validation). |
| `prisma/schema.prisma` | PostgreSQL schema, Prisma models (with `sparkNote` & `sparkNoteUpdatedAt` fields), relationships, and enums. |
| `prisma/migrations` | Prisma migration history. |
| `package.json` | Scripts and backend dependencies. |
| `tsconfig.json` | TypeScript compiler configuration. |

## Technology stack

| Area | Technology |
|---|---|
| Runtime | Node.js |
| Language | TypeScript |
| HTTP framework | Express |
| Realtime | Socket.IO |
| ORM | Prisma 5.x |
| Database | Neon PostgreSQL |
| Authentication provider validation | Firebase Admin SDK |
| App tokens | JSON Web Tokens |
| Upload storage | Cloudinary |
| Multipart handling | Multer |
| Security middleware | Helmet, CORS, rate limiting |
| Logging | Winston |
| Validation | Zod |

## Main responsibilities

- Verify Firebase Google ID tokens through Firebase Admin SDK.
- Issue Velvet Hearts access and refresh JWTs.
- Enforce account status and approval status.
- Enforce `USER`, `ADMIN`, and `SUPER_ADMIN` roles.
- Store and retrieve profile, discover, match, chat, notification, safety, and admin data.
- Persist moderation and audit events.
- Broker image uploads to Cloudinary.
- Provide Socket.IO room and typing-event behavior.
- Serve a `/health` endpoint for deployment monitoring.

## Prerequisites

- Node.js and npm installed.
- A PostgreSQL database, normally Neon.
- Firebase project with Google Sign-In enabled.
- Firebase Admin SDK service-account credentials.
- Cloudinary account and upload credentials.
- Frontend origin for CORS, usually `http://localhost:5173` locally or the Vercel production URL.

The repository does not declare a specific Node engine in `package.json`. Use a current Node LTS version compatible with the installed dependencies.

## Environment variables

Create a local `.env` file in `/backend`. Do not commit production secrets.

| Variable | Required | Purpose | Example |
|---|---:|---|---|
| `PORT` | No | HTTP listener port. Defaults to `4000`. | `4000` |
| `URL` | Production/self-ping | URL pinged by the Render self-ping code in `src/app.ts`. | `https://your-service.onrender.com/health` |
| `DATABASE_URL` | Yes | PostgreSQL connection string used by Prisma. | `postgresql://user:pass@host/db?sslmode=require` |
| `CORS_ORIGIN` | No | Allowed frontend origin for REST and Socket.IO. Defaults to `http://localhost:5173`. | `https://velvetheart.vercel.app` |
| `JWT_ACCESS_SECRET` | Yes | Secret for signing access tokens. | long random string |
| `JWT_REFRESH_SECRET` | Yes | Secret for signing refresh tokens. | different long random string |
| `JWT_ACCESS_EXPIRY` | No | Access token lifetime. Defaults to `15m`. | `15m` |
| `JWT_REFRESH_EXPIRY` | No | Refresh token lifetime. Defaults to `7d`. | `7d` |
| `CLOUDINARY_CLOUD_NAME` | Yes | Cloudinary cloud name. | `my-cloud` |
| `CLOUDINARY_API_KEY` | Yes | Cloudinary API key. | `123456789012345` |
| `CLOUDINARY_API_SECRET` | Yes | Cloudinary API secret. | `abc123...` |
| `NODE_ENV` | No | Runtime mode. Defaults to `development`. | `development` or `production` |
| `FIREBASE_PROJECT_ID` | Google auth required | Firebase service-account project ID. | `velvet-hearts-prod` |
| `FIREBASE_PRIVATE_KEY` | Google auth required | Firebase service-account private key. | `-----BEGIN PRIVATE KEY-----\n...` |
| `FIREBASE_CLIENT_EMAIL` | Google auth required | Firebase service-account client email. | `firebase-adminsdk-...@...iam.gserviceaccount.com` |

Security recommendations:

- Keep `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` different.
- Use long random JWT secrets.
- Never expose `DATABASE_URL`, JWT secrets, Firebase Admin SDK private key, or Cloudinary API secret to the frontend.
- Preserve Firebase private-key newlines correctly. The backend replaces literal `\n` with real newlines when initializing Firebase.
- Rotate secrets after suspected exposure or staff turnover.

## Local development setup

From the repository root:

```bash
cd backend
npm install
```

Create and fill `.env` with local/staging values.

Generate Prisma Client:

```bash
npm run prisma:generate
```

Run database migrations in development:

```bash
npm run prisma:migrate
```

Start the backend in watch mode:

```bash
npm run dev
```

Default local health check:

```txt
http://localhost:4000/health
```

Expected health response:

| Field | Expected value |
|---|---|
| `success` | `true` |
| `message` | `Velvet Hearts Backend Service is healthy` |
| `timestamp` | Current server timestamp |

## Running with the frontend locally

1. Start the backend on port `4000`.
2. Ensure backend `.env` contains:

   ```txt
   CORS_ORIGIN=http://localhost:5173
   ```

3. In `/frontend/.env`, set:

   ```txt
   VITE_API_URL=http://localhost:4000
   ```

4. Start the frontend with `npm run dev` from `/frontend`.

## Available scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Start TypeScript watch mode with `tsx watch src/app.ts`. |
| `npm run build` | Run `prisma generate` and compile TypeScript to `dist`. |
| `npm start` | Compile TypeScript and start `dist/app.js`. |
| `npm run prisma:generate` | Generate Prisma Client. |
| `npm run prisma:migrate` | Run `prisma migrate dev` for development migrations. |
| `npm run prisma:studio` | Open Prisma Studio. |

Production note from the administrator manual: use deploy-mode migrations in production, normally `npx prisma migrate deploy`, rather than `prisma migrate dev`.

## Build and production start

Build locally:

```bash
cd backend
npm install
npm run build
```

Start:

```bash
npm start
```

`npm start` currently runs:

```txt
tsc && node dist/app.js
```

That means the service compiles at start time before launching the compiled app.

## Production deployment on Render

The administrator manual identifies Render as the backend host.

Recommended Render settings:

| Setting | Value |
|---|---|
| Service type | Web Service |
| Root directory | `backend` |
| Runtime | Node |
| Build command | `npm install && npx prisma generate && npm run build` |
| Start command | `npm start` |
| Health check path | `/health` |

Deployment checklist:

1. Connect the GitHub repository to Render.
2. Set the root directory to `backend`.
3. Configure all backend environment variables.
4. Ensure `DATABASE_URL` points to the production Neon database.
5. Run production migrations with `npx prisma migrate deploy` from a secure production-capable environment.
6. Deploy the service.
7. Confirm `/health` returns success.
8. Copy the Render service URL to frontend `VITE_API_URL`.
9. Set `CORS_ORIGIN` to the exact Vercel frontend origin.
10. Smoke test auth, onboarding, approval, discover, matching, chat, upload, notifications, and admin routes.

## Database and Prisma

Prisma schema lives at:

```txt
prisma/schema.prisma
```

The schema includes:

- Users, profiles, photos, 2-minute voice intro snippet (`voiceIntroUrl`), prompt answers, and settings.
- Likes and matches (with `createdAt` timestamps used for 24h spark countdown calculations).
- Conversations, participants, messages, attachments, and reactions.
- Blocks and reports.
- Notifications.
- Activity logs.

Important enums:

| Enum | Values |
|---|---|
| `Role` | `USER`, `ADMIN`, `SUPER_ADMIN` |
| `ApprovalStatus` | `PENDING`, `APPROVED`, `REJECTED` |
| `UserStatus` | `ACTIVE`, `DELETED`, `SUSPENDED` |
| `ReportStatus` | `PENDING`, `RESOLVED`, `IGNORED` |
| `NotificationType` | `LIKE`, `MATCH`, `MESSAGE`, `SYSTEM`, `REPORT_UPDATE`, `ADMIN_NOTICE` |
| `FileType` | `IMAGE`, `VIDEO`, `AUDIO`, `DOCUMENT` |

No seed script is currently defined in `package.json` or under `prisma`. The administrator manual flags first `SUPER_ADMIN` bootstrap as an operational handover item that must be resolved before production operations depend on admin role management.

## Authentication model

The backend receives Firebase Google ID tokens from the frontend and verifies them with Firebase Admin SDK.

Registration flow:

1. Frontend collects phone number.
2. Frontend obtains Firebase Google ID token.
3. Frontend calls `/api/v1/auth/google-register`.
4. Backend verifies Firebase ID token.
5. Backend creates a pending active user and default settings.
6. Backend issues app access and refresh JWTs.

Login flow:

1. Frontend obtains Firebase Google ID token.
2. Frontend calls `/api/v1/auth/google-login`.
3. Backend verifies the Firebase ID token and finds an active user by email.
4. Backend issues app access and refresh JWTs.

Authorization behavior:

- `requireAuth` validates the app access JWT and rejects missing, deleted, or suspended users.
- `requireApproved` blocks users whose `approvalStatus` is not `APPROVED`.
- `requireRole` protects admin and super-admin routes.

Development note: `AuthService` accepts `dev-google:` tokens only when `NODE_ENV === 'development'`.

## REST API summary

All routes are mounted under:

```txt
/api/v1
```

| Group | Endpoint | Auth | Purpose |
|---|---|---|---|
| Auth | `POST /auth/login` | Public | Phone login/register legacy flow. |
| Auth | `POST /auth/google-login` | Public | Google login for existing user. |
| Auth | `POST /auth/google-register` | Public | Google registration with phone number. |
| Auth | `POST /auth/refresh` | Public with refresh token | Rotate app JWTs. |
| Auth | `POST /auth/logout` | User | Log logout event. |
| Profile | `GET /profile/me` | User | Fetch own user/profile data. |
| Profile | `POST /profile` | User | Create/update profile. |
| Profile | `DELETE /profile` | User | Soft-delete own account. |
| Discover | `GET /discover` | Approved user | Discover recommendations (parallelized exclusions via `Promise.all`). |
| Search | `GET /search` | Approved user | Profile search. |
| Match | `POST /match/like` | Approved user | Send interest (validates target active status). |
| Match | `POST /match/unlike` | Approved user | Undo interest. |
| Match | `POST /match/unmatch` | Approved user | End match. |
| Match | `GET /match/connections` | Approved user | Mutual connections (filters out deleted/inactive partners). |
| Safety | `POST /block` | User | Block user. |
| Safety | `POST /safety/reports` | User | Report user and auto-block. |
| Chat | `GET /chat/conversations` | Approved user | Conversation list (filters out deleted/inactive partners). |
| Chat | `GET /chat/conversations/:conversationId/messages` | Approved user | Message history. |
| Chat | `POST /chat/conversations/:conversationId/messages` | Approved user | Send message (non-blocking background Web Push dispatch). |
| Upload | `POST /upload` | User | Upload profile/media image. |
| Notifications | `GET /notifications` | User | Notification list. |
| Admin | `/admin/*` | Admin/Super Admin | Admin operations. |

Admin-specific routes include dashboard stats, user listing, pending queue, approve/reject, phone history, reports, audit logs, suspend/restore, and super-admin-only admin creation/removal.

## Socket.IO behavior

The backend initializes Socket.IO on the same HTTP server as Express.

Socket authentication:

- Token may be sent through `socket.handshake.auth.token`.
- Token may also be read from the authorization header.
- The token is verified with the same app access JWT verification utility.

Supported events:

| Event | Direction | Purpose |
|---|---|---|
| `join_conversation` | Client → server | Join a conversation room. |
| `leave_conversation` | Client → server | Leave a conversation room. |
| `typing_start` | Client → server → room peers | Broadcast typing active state. |
| `typing_stop` | Client → server → room peers | Broadcast typing inactive state. |

## Upload flow

Uploads go through:

```txt
POST /api/v1/upload
```

The route uses Multer with a 10 MB file-size limit. `UploadService` streams the file buffer or audio blob to Cloudinary and returns Cloudinary metadata such as secure URL, public ID, width, height, and resource type.

- **Profile Photos**: Supported formats include JPEG, PNG, WEBP.
- **Voice Intro Snippets (`voiceIntroUrl`)**: Supports up to 2-minute audio recordings (Base64 data URLs or binary audio blobs) uploaded during onboarding or profile editing. Passing `voiceIntroUrl: null` to `POST /profile` removes the existing recording from the profile record.

Cloudinary API secret must stay backend-only.

## Admin and moderation operations

Admin users can:

- View dashboard stats.
- Review pending users.
- Approve users.
- Reject users.
- View phone/audit history.
- Query users.
- Suspend and restore users.
- View and close reports.
- View audit logs.

Super Admin users can additionally:

- Promote users to `ADMIN`.
- Demote admins to `USER`.

Safety behavior:

- Blocking removes likes and unmatches active matches.
- Reporting creates a report and auto-blocks the reported user.
- Report closure supports `RESOLVED` and `IGNORED`.

## Troubleshooting

| Problem | Likely cause | What to check |
|---|---|---|
| Backend exits immediately with env validation error | Required env var missing or malformed. | Check `DATABASE_URL`, JWT secrets, Cloudinary vars, Firebase Admin vars. |
| `/health` does not respond | Service did not start or port mismatch. | Check Render/local logs and `PORT`. |
| Firebase Admin SDK error | Missing or badly escaped service-account variables. | Verify `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`; preserve newlines. |
| Google login fails with unauthorized/invalid token | Firebase token invalid or wrong project. | Confirm frontend Firebase project matches backend Admin SDK project. |
| User cannot access discover/chat | User is not approved. | Confirm `approvalStatus=APPROVED` and `status=ACTIVE`. |
| Approved user still blocked | Stale JWT contains old approval state. | Refresh token or sign out/in. |
| CORS errors | `CORS_ORIGIN` does not exactly match frontend origin. | Use exact local/Vercel origin. Avoid wildcard with credentials. |
| Socket connection fails | Invalid token, CORS mismatch, wrong frontend `VITE_API_URL`. | Check Socket.IO client URL, access token, and backend logs. |
| Prisma cannot connect | Bad `DATABASE_URL`, Neon branch/connection issue, SSL issue. | Verify Neon connection string and database availability. |
| Prisma migration issue | Using development migration flow in production or schema drift. | Use `npx prisma migrate deploy` for production. Review migrations first. |
| Cloudinary upload fails | Bad credentials, network issue, file too large. | Check Cloudinary vars, 10 MB limit, and backend logs. |
| Render deploy fails | Missing env vars, TypeScript error, Prisma generate issue. | Review Render build/deploy logs and confirm build command. |
| Cold starts on Render | Free-tier inactivity. | Use paid service, external uptime monitor, or the existing self-ping with `URL` set correctly. |
| No admin can access admin tools | No first `SUPER_ADMIN` bootstrap process exists in repo. | Define a controlled one-time bootstrap/seed process before production handover. |

## Operational notes

- Use `prisma migrate dev` only for development.
- Use `npx prisma migrate deploy` for production.
- Keep production provider accounts company-owned with MFA.
- Keep separate development/staging/production databases and secrets.
- Support contact from the user manual: `velvethearts.in@gmail.com`.
- Full operations, infrastructure, and handover documentation lives in `/docs/Administrator_Manual.docx`.
