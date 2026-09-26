# 💸 Qashio — Expense Tracker

Track income, expenses and budgets. A **NestJS** API (PostgreSQL + TypeORM, Kafka events, JWT auth) and a **Next.js** App Router frontend (MUI v7, React Query).

> The original assignment brief is in [`ASSIGNMENT.md`](./ASSIGNMENT.md). The [requirements checklist](#-requirements-checklist) below tracks it item by item.

---

## Contents

- [Architecture](#-architecture)
- [Quick start (Docker)](#-quick-start-docker)
- [Local development](#-local-development)
- [Demo account](#-demo-account)
- [Environment variables](#-environment-variables)
- [Backend](#-backend-qashio-api)
- [Frontend](#-frontend-qashio-frontend-assignment)
- [Authentication flow](#-authentication-flow)
- [Events (Kafka)](#-events-kafka)
- [Testing](#-testing)
- [Requirements checklist](#-requirements-checklist)

---

## 🏗 Architecture

```
Browser ──► Next.js :3000 ──► NestJS :4000/api ──► PostgreSQL :5432
            (pages + /api/*)       │
            BFF: tokens in         ├──► Kafka :9092  transaction.created / transaction.updated
            httpOnly cookies       │         │
                                   └◄────────┘  BudgetEventsConsumer (same process)
```

- **The browser only talks to Next.js.** The Next.js `/api/*` route handlers forward to NestJS. The JWTs live in **httpOnly cookies**, and the server turns them into `Authorization: Bearer` headers, so page JavaScript never sees a token.
- **Mock fallback.** If NestJS isn't configured or can't be reached, the same `/api/*` routes answer from a small mock API (`data/db.json`), so the UI keeps working. Responses carry an `X-Api-Source: nest | mock` header. Login and register always need NestJS.

| Service | URL |
|---|---|
| Frontend | http://localhost:3000 |
| API | http://localhost:4000/api |
| Swagger docs (non-production) | http://localhost:4000/docs |
| pgAdmin | http://localhost:5050 (admin@admin.com / admin) |
| Kafka UI (optional profile) | http://localhost:8080 |

---

## 🚀 Quick start (Docker)

```bash
docker-compose up --build
```

> ⚠️ **Not working from a clean checkout yet.** See [Known gaps](#known-gaps): the API image is missing its source, and migrations don't run automatically. Until that's fixed, use [Local development](#-local-development).

Once the stack is up, create the tables and the demo account:

```bash
docker compose exec qashio-api npm run migration:run
docker compose exec qashio-api npm run seed
```

Kafka UI is optional:

```bash
docker compose --profile tools up -d kafka-ui
```

---

## 💻 Local development

**Requirements:** Node 20+, Docker (for Postgres and Kafka).

```bash
# 1. Infrastructure only
docker compose up -d postgres kafka

# 2. API
cd qashio-api
cp .env.example .env            # set JWT_SECRET (any long random string)
npm install
npm run migration:run
npm run seed                    # demo user + 10 categories
npm run start:dev               # http://localhost:4000/api, docs at /docs

# 3. Frontend (new terminal)
cd qashio-frontend-assignment
cp .env.example .env.local      # BACKEND_API_URL=http://localhost:4000/api
npm install
npm run dev                     # http://localhost:3000
```

---

## 👤 Demo account

`npm run seed` (in `qashio-api`) creates:

| Email | Password |
|---|---|
| `demo@qashio.com` | `Demo@12345` |

It also creates 10 categories: Salary, Groceries, Rent, Utilities, Transport, Dining Out, Entertainment, Healthcare, Shopping and IT Services.

The seed is safe to run again: it never creates duplicates. It refuses to run when `NODE_ENV=production`. Override the credentials with `SEED_DEMO_EMAIL` / `SEED_DEMO_PASSWORD`.

---

## ⚙️ Environment variables

### API (`qashio-api/.env`)

| Variable | Default | Purpose |
|---|---|---|
| `DATABASE_URL` | — (required) | Postgres connection string |
| `JWT_SECRET` | — (required) | Signs access and refresh tokens |
| `JWT_ACCESS_EXPIRES_IN` | `15m` | Access token lifetime |
| `JWT_REFRESH_EXPIRES_IN` | `7d` | Refresh token lifetime |
| `PORT` | `4000` | HTTP port |
| `CORS_ORIGIN` | `http://localhost:3000` | Allowed origins (comma-separated) |
| `KAFKA_BROKER` | `localhost:9092` | Brokers (comma-separated) |
| `KAFKA_CLIENT_ID` / `KAFKA_GROUP_ID` | `qashio-api` | Kafka client id and consumer group (Nest appends `-server` to the group) |
| `SEED_DEMO_EMAIL` / `SEED_DEMO_PASSWORD` | `demo@qashio.com` / `Demo@12345` | Demo account |

### Frontend (`qashio-frontend-assignment/.env.local`)

| Variable | Default | Purpose |
|---|---|---|
| `BACKEND_API_URL` | — | NestJS base URL, e.g. `http://localhost:4000/api` (Docker: `http://qashio-api:4000/api`). Read at request time. |

---

## 🛠 Backend (`qashio-api`)

**Stack:** NestJS 11, TypeORM, PostgreSQL, Kafka (kafkajs), Passport JWT, class-validator, Swagger.

### Structure

```
src/
  common/      decorators (@CurrentUser, @Public, @Roles, @Trim, @NormalizeEmail),
               guards (JWT, roles), pipes (validation), filters (all exceptions),
               interceptors (logging, response envelope), helpers, transformers
  core/        config, database (data source, migrations, seeds), kafka (module, topics)
  modules/     auth, users, categories, transactions (+ events), budgets (+ Kafka consumer)
```

### Endpoints (all under `/api`)

Every route requires `Authorization: Bearer <accessToken>` unless marked **public**. Successful responses are wrapped as `{ success, data, timestamp }`; paginated ones as `{ success, data, pagination }`.

| Method | Path | Notes |
|---|---|---|
| POST | `/auth/register` | public: returns `{ user, tokens }` |
| POST | `/auth/login` | public |
| POST | `/auth/refresh` | public: single-use refresh token, returns a new pair |
| POST | `/auth/logout` | revokes the refresh token |
| GET | `/users/me` | the signed-in user |
| GET | `/users` | admin only, paginated |
| POST | `/categories` | create (name unique per user) |
| GET | `/categories` | the user's categories |
| GET | `/categories/all` | admin only, paginated |
| POST | `/transactions` | create: emits `transaction.created` |
| GET | `/transactions` | paginated list, filters below |
| GET | `/transactions/:id` | one transaction |
| PUT | `/transactions/:id` | full replace: emits `transaction.updated` |
| DELETE | `/transactions/:id` | 204 |
| POST | `/budgets` | amount per category per `weekly` / `monthly` / `yearly` period |
| GET | `/budgets` | budgets with current spending: `spent`, `remaining`, `percentage`, `isExceeded` |
| GET | `/budgets/:id` | one budget with its spending |
| PUT | `/budgets/:id` | update |
| DELETE | `/budgets/:id` | delete |

**`GET /transactions` query parameters:**
- `page`, `limit` (max 100)
- `sortBy` = `date` | `amount`, `sortOrder` = `asc` | `desc`
- `type` (`income` / `expense`), `status` (`pending` / `completed` / `failed`), `categoryId`
- `startDate`, `endDate`
- `search`: matches reference, counterparty or narration

**Errors** come from one global filter as `{ success: false, statusCode, message, path, timestamp }`. Validation errors add `errors: [{ field, messages }]`.

### Database

Migrations live in `src/core/database/migrations`: users, categories, transactions and budgets.

```bash
npm run migration:run       # apply
npm run migration:revert    # undo the latest
npm run migration:generate  # diff entities against the DB
```

---

## 🖥 Frontend (`qashio-frontend-assignment`)

**Stack:** Next.js 15 (App Router), React 19, MUI v7 + date pickers, TanStack Query v5 (persisted cache), Zustand, Zod, date-fns.

### Pages

| Route | What it does |
|---|---|
| `/login`, `/register` | Validated forms, loading spinner, success and error alerts, "Remember me" |
| `/transactions` | Paginated table (10 per page) with sortable Date and Amount columns. Type column and signed amounts. Filters: search, date preset, type, status, category. Filters live in the URL, so links and reloads keep them. Skeleton while loading, empty state with a call to action, row click opens a detail drawer. |
| `/transactions/new`, `/transactions/:id/edit` | Zod-validated form: type (income/expense), status, date-time picker, category dropdown with "add new category", amount, reference, counterparty, narration |
| `/profile` | Account details and log out |

### Highlights

- **Route guard:** `middleware.ts` redirects signed-out users to `/login` and keeps signed-in users away from the login and register pages.
- **Auth client:** `app/services/apiClient.ts` wraps `fetch`. On a 401 it refreshes the session once and retries the request. Parallel 401s share a single refresh. If the refresh fails, it signs the user out.
- **Cache:**
  - React Query data is saved to `localStorage`, so a page refresh shows cached data instantly. Data counts as fresh for 30 minutes.
  - Every create, update or delete refetches what it changed.
  - The saved cache is wiped on login, logout and session expiry.
- **Contract mapping:** `transactionService.ts` converts between the form (category names, capitalised statuses) and the NestJS API (`categoryId`, lowercase enums). NestJS field errors are shown under the matching form input.
- **Design:** gold brand theme across the app, account menu in the navbar, user card in the sidebar.

---

## 🔐 Authentication flow

1. **Sign in:** `POST /api/auth/login` (Next.js) calls NestJS `/auth/login` and stores `token` + `refreshToken` as **httpOnly, SameSite=Lax** cookies. It returns only the user.
   - Each cookie expires when its token does.
   - Without "Remember me", both are session cookies that disappear when the browser closes.
2. **API calls:** the browser sends the cookies to `/api/*`, and Next.js forwards the access token to NestJS as a Bearer header.
3. **Refresh:** when the 15-minute access token expires, the next call gets a 401. The client calls `POST /api/auth/refresh` once, gets a new token pair (refresh tokens are single-use), and retries.
4. **Log out:** revokes the refresh token in NestJS, clears the cookies and the cached data, then goes to `/login`.



## 🧪 Testing

```bash
cd qashio-frontend-assignment && npm test   # 85 tests
cd qashio-api && npm test
```

**Frontend** (Jest + Testing Library, user-event):

| Layer | Covers |
|---|---|
| Unit | Auth cookie helpers, route-guard middleware, api client (refresh and retry, shared refresh, sign-out on failure) |
| Server integration | The real `/api/auth/*` handlers and the backend proxy against a fake NestJS HTTP server |
| UI integration | Login, register and logout flows with a real React Query client: loading states, alerts, validation, cache clearing, navigation. Transaction type: column, signed amounts, filter and `?type=` request |

**Backend:** guards, auth service, JWT strategy, Kafka publisher, transactions service.

