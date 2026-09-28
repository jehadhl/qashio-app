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
            ┌──────────────► Next.js :3000   (pages only)
Browser ────┤
            └──────────────► NestJS :4000/api ──► PostgreSQL :5432
             fetch + httpOnly      │
             auth cookies          ├──► Kafka :9092  transaction.created / transaction.updated
                                   │         │
                                   └◄────────┘  BudgetEventsConsumer (same process)
```

- **NestJS owns the API and auth.** The browser calls NestJS directly at `BACKEND_API_URL` with `credentials: 'include'`. Next.js only serves the pages; it does not proxy API calls.
- **Tokens stay in httpOnly cookies.** NestJS sets the `token` and `refreshToken` cookies on login, register and refresh, and reads the access token from the cookie (a `Bearer` header also works, e.g. for Swagger). Page JavaScript never sees a token.
- **Demo API in Next.js.** `app/api/transactions` and `app/api/categories` are small route handlers over a local JSON file (`data/data.json` via `lib/db.ts`). They show the assignment's original API; the UI does not use them.

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

The API container runs the migrations and the seed (demo account + categories) on every start, then starts NestJS. Both are safe to re-run.

> Ports 3000, 4000, 5432 and 9092 must be free: stop any local `npm run dev` / `start:dev` first.

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
| `BODY_LIMIT` | `1mb` | Max request body size (JSON and form); larger bodies get `413` |
| `THROTTLE_TTL_MS` | `60000` | Rate-limit window in milliseconds |
| `THROTTLE_LIMIT` | `4` | Max requests per client IP per window, shared across all routes; over it gets `429` |
| `SEED_DEMO_EMAIL` / `SEED_DEMO_PASSWORD` | `demo@qashio.com` / `Demo@12345` | Demo account |
| `OUTBOX_RELAY_INTERVAL_MS` | `1000` | How often the relay polls the outbox |
| `OUTBOX_BATCH_SIZE` | `50` | Rows claimed per batch (a full batch triggers another in the same tick) |
| `OUTBOX_MAX_ATTEMPTS` | `10` | Permanent failures before an event becomes `FAILED` |
| `OUTBOX_BACKOFF_BASE_MS` / `OUTBOX_BACKOFF_MAX_MS` | `1000` / `60000` | Exponential backoff start and cap (the cap is also the wait while Kafka is down) |
| `OUTBOX_RETENTION_DAYS` | `7` | Age after which `SENT` outbox rows and `processed_events` are deleted |
| `OUTBOX_STUCK_THRESHOLD_MIN` | `5` | Health check warns when the oldest `PENDING` event is older than this |
| `CONSUMER_MAX_RETRIES` | `5` | Redeliveries of a failing message before the consumer gives up on it |

### Frontend (`qashio-frontend-assignment/.env.local`)

| Variable | Default | Purpose |
|---|---|---|
| `BACKEND_API_URL` | — (required) | NestJS base URL the browser calls, e.g. `http://localhost:4000/api`. Inlined into the client bundle by `next.config.js`, so restart `npm run dev` (or rebuild) after changing it. It must be reachable from the browser. |

---

## 🛠 Backend (`qashio-api`)

**Stack:** NestJS 11, TypeORM, PostgreSQL, Kafka (kafkajs), Passport JWT, class-validator, Swagger.

### Structure

```
src/
  common/      decorators (@CurrentUser, @Public, @Roles, @Trim, @NormalizeEmail),
               guards (JWT, roles), pipes (validation), filters (all exceptions),
               interceptors (logging, response envelope), helpers, transformers
  core/        config, database (data source, migrations, seeds), kafka (module, topics), outbox (relay, idempotency, jobs)
  modules/     auth, users, categories, transactions (+ events), budgets (+ Kafka consumer)
```

### Endpoints (all under `/api`)

Every route requires the access token (the `token` httpOnly cookie, or `Authorization: Bearer <accessToken>`) unless marked **public**. Successful responses are wrapped as `{ success, data, timestamp }`; paginated ones as `{ success, data, pagination }`.

Every route, public ones included, is rate limited to `THROTTLE_LIMIT` requests per `THROTTLE_TTL_MS` per client IP (default 4 per minute, `429 Too Many Requests` beyond that), and request bodies are capped at `BODY_LIMIT` (default `1mb`, `413 Payload Too Large` beyond that).

| Method | Path | Notes |
|---|---|---|
| POST | `/auth/register` | public: sets the auth cookies, returns `{ user }` |
| POST | `/auth/login` | public: sets the auth cookies, returns `{ user }`. Optional `rememberMe` |
| POST | `/auth/refresh` | public: swaps the single-use `refreshToken` cookie for a new pair (204). Clears the cookies on 401 |
| POST | `/auth/logout` | public: revokes the refresh token and clears the cookies (204) |
| GET | `/users/me` | the signed-in user |
| GET | `/users` | admin only, paginated |
| POST | `/categories` | create (name unique per user) |
| GET | `/categories` | the user's categories |
| GET | `/categories/all` | admin only, paginated |
| POST | `/transactions` | create: emits `transaction.created` |
| GET | `/transactions` | paginated list, filters below |
| GET | `/transactions/summary` | completed income, expense and net totals, plus a per-category breakdown. Optional `startDate`, `endDate` (inclusive) |
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

Migrations live in `src/core/database/migrations`: users, categories, transactions, budgets, and the outbox (`outbox_events`, `processed_events`).

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

- **Route guard:** `middleware.ts` redirects signed-out users to `/login` and keeps signed-in users away from the login and register pages. It only checks that the `refreshToken` cookie exists; NestJS does the real verification.
- **Auth client:** `app/services/apiClient.ts` wraps `fetch` and calls NestJS at `BACKEND_API_URL` with the cookies. On a 401 it refreshes the session once and retries the request. Parallel 401s share a single refresh. If the refresh fails, it signs the user out.
- **Cache:**
  - React Query data is saved to `localStorage`, so a page refresh shows cached data instantly. Data counts as fresh for 30 minutes.
  - Every create, update or delete refetches what it changed.
  - The saved cache is wiped on login, logout and session expiry.
- **Contract mapping:** `transactionService.ts` converts between the form (category names, capitalised statuses) and the NestJS API (`categoryId`, lowercase enums). NestJS field errors are shown under the matching form input.
- **Design:** gold brand theme across the app, account menu in the navbar, user card in the sidebar.

---

## 🔐 Authentication flow

1. **Sign in:** the browser calls NestJS `POST /api/auth/login`. NestJS sets `token` + `refreshToken` as **httpOnly, SameSite=Lax** cookies and returns only the user.
   - Each cookie expires when its token does.
   - Without "Remember me", both are session cookies that disappear when the browser closes.
   - Cookies are not tied to a port, so the cookies NestJS sets on `localhost` are also visible to the Next.js middleware on `localhost:3000`.
2. **API calls:** the browser calls NestJS with `credentials: 'include'`, so the cookies go along. NestJS reads the access token from the `token` cookie. CORS allows `CORS_ORIGIN` with credentials.
3. **Refresh:** when the 15-minute access token expires, the next call gets a 401. The client calls NestJS `POST /api/auth/refresh` once (refresh tokens are single-use), gets new cookies, and retries.
4. **Log out:** NestJS `POST /api/auth/logout` revokes the refresh token and clears the cookies; the client clears the cached data and goes to `/login`.



## 📨 Events (Kafka)

Creating or updating a transaction emits `transaction.created` / `transaction.updated` (key = `userId`, so one user's events stay in order on one partition). The budgets module consumes them and logs a warning when a budget passes 80% or is exceeded.

### Event delivery guarantees

**Transactional outbox.** The HTTP request never talks to Kafka. `TransactionsService` saves the transaction **and** inserts an `outbox_events` row in one database transaction, so both are committed or neither is. The event's `eventId` is the outbox row id, generated in code so it is part of the payload. A Kafka outage cannot fail the request or lose the event.

**Relay (at-least-once).** `OutboxRelay` polls every `OUTBOX_RELAY_INTERVAL_MS`:

```sql
SELECT * FROM outbox_events
WHERE status = 'PENDING' AND next_attempt_at <= now()
  AND NOT EXISTS (/* an earlier PENDING row for the same key that is waiting for its backoff */)
ORDER BY created_at LIMIT $batch
FOR UPDATE SKIP LOCKED
```

- Each row is published with key = `message_key`, value = `payload` and header `event-id`, and the relay waits for the broker ack before marking it `SENT`.
- `SKIP LOCKED` lets several API instances run relays without publishing a row twice. A `running` flag stops ticks from overlapping, and a full batch triggers another batch in the same tick so a backlog drains quickly.
- If a row fails, later rows with the same key are skipped for the rest of the batch. The `NOT EXISTS` filter keeps them waiting until the earlier row is sent, so one user's events are never reordered. A `FAILED` row no longer blocks its key.
- A crash between publishing and marking `SENT` means the event is sent again, so delivery is **at-least-once** and consumers must be idempotent.

**Retry: transient vs permanent** (`isTransientKafkaError`):

| Failure | Examples | Effect |
|---|---|---|
| **Transient**: Kafka unreachable | `KafkaJSConnectionError`, `KafkaJSRequestTimeoutError`, `KafkaJSNumberOfRetriesExceeded`, `KafkaJSBrokerNotFound` | `attempts` unchanged, `last_error` set, retried after `OUTBOX_BACKOFF_MAX_MS`, **forever**. The rest of the batch is deferred too, without trying. An outage never makes an event `FAILED`. |
| **Permanent**: the message itself | message too large, unknown topic, invalid record, serialization | `attempts + 1`, retried after `min(base · 2^(attempts-1), max)` + 0–20% jitter. At `OUTBOX_MAX_ATTEMPTS` the row becomes `FAILED`. |

A retried error keeps its cause: `NumberOfRetriesExceeded` wrapping "unknown topic" counts as permanent.

**Idempotent consumer.** `BudgetEventsConsumer` runs each message in one DB transaction. It first inserts `(eventId, 'budget-consumer')` into `processed_events` (`ON CONFLICT DO NOTHING`); a conflict means it's a duplicate and is logged `↷ duplicate`. Then it runs the budget check. On an error the transaction rolls back (so the event is *not* marked processed) and the error is rethrown, so Kafka redelivers the message. After `CONSUMER_MAX_RETRIES` redeliveries of the same `topic:partition:offset`, the consumer logs the full payload and moves on, so a poison message cannot block the partition. Messages without an `eventId` are logged and skipped.

**Scheduled jobs** (`@nestjs/schedule`):

- **Health check** (every 5 min, read-only). Logs `⚠ N outbox event(s) in FAILED state need attention` and `⚠ oldest PENDING event is X min old — is Kafka down?` when the oldest pending event is older than `OUTBOX_STUCK_THRESHOLD_MIN`. It logs nothing when healthy.
- **Cleanup** (daily, 03:00). Deletes `SENT` outbox rows and `processed_events` older than `OUTBOX_RETENTION_DAYS`, 1000 at a time. It never deletes `PENDING` or `FAILED` rows. `processed_events` retention must be at least the Kafka topic retention, or a replayed message could be processed twice.

### Production considerations

- **Alerting, not logs.** Export `FAILED` count and oldest-`PENDING` age as metrics (Prometheus / CloudWatch) and alert on them.
- **Dead-letter topic.** Publish poison messages to `<topic>.dlq` instead of counting retries in memory; the counter resets on restart and isn't shared between instances.
- **Durable Kafka.** Use `replicationFactor: 3`, `min.insync.replicas=2`, and an idempotent producer with `acks=all`.
- **Strict per-key order across instances.** The ordering filter covers backoff, but two relays can still interleave one user's rows that are due at the same time. Per-key advisory locks, or one relay per partition, would close that gap.
- **High throughput.** Replace polling with CDC (Debezium reading the Postgres WAL into Kafka) and partition or clean up the outbox table more aggressively.

### Manual test

Follow the logs in one terminal: `docker compose logs -f qashio-api`. Query the database with:

```bash
alias q='docker compose exec -T postgres psql -U postgres -d qashio_points -c'
```

1. **Happy path.** Create a transaction (in the app at http://localhost:3000, or Swagger at http://localhost:4000/docs). Within about 1s the log shows `→ transaction.created [partition … @ offset …] eventId=…`, and:
   ```bash
   q "SELECT id, status, attempts, sent_at FROM outbox_events ORDER BY created_at DESC LIMIT 1"
   q "SELECT * FROM processed_events ORDER BY processed_at DESC LIMIT 1"
   ```
   The row is `SENT` and its id appears in `processed_events`.
2. **Kafka down.** Run `docker compose stop kafka`, then create a transaction. The API still returns `201`, and the row stays `PENDING` with `attempts = 0` and `last_error` set (`⚠ Kafka unavailable … deferred` in the log):
   ```bash
   q "SELECT status, attempts, last_error, next_attempt_at FROM outbox_events ORDER BY created_at DESC LIMIT 1"
   ```
3. **Health check.** Wait 5+ minutes. The next run (every 5 min) logs `⚠ oldest PENDING event is X min old — is Kafka down? (N PENDING)`. To see it sooner, set `OUTBOX_STUCK_THRESHOLD_MIN=1`.
4. **Recovery.** Run `docker compose start kafka`. Within `OUTBOX_BACKOFF_MAX_MS` (60s) the row becomes `SENT` and the budget consumer processes it.
5. **Duplicate delivery.** Re-publish the latest event, with the same `eventId`, twice:
   ```bash
   LINE=$(docker compose exec -T postgres psql -U postgres -d qashio_points -Atc \
     "SELECT message_key || '|' || payload::text FROM outbox_events ORDER BY created_at DESC LIMIT 1")
   printf '%s\n%s\n' "$LINE" "$LINE" | docker compose exec -T kafka \
     /opt/kafka/bin/kafka-console-producer.sh --bootstrap-server localhost:9092 \
     --topic transaction.created --property parse.key=true --property key.separator='|'
   ```
   The log shows `↷ … duplicate eventId=…` (twice, because the original was already processed), and `processed_events` still has one row for that event.

---

## 🧪 Testing

```bash
cd qashio-frontend-assignment && npm test   # 60 tests
cd qashio-api && npm test
```

**Frontend** (Jest + Testing Library, user-event):

| Layer | Covers |
|---|---|
| Unit | Auth form validators, route-guard middleware, api client (refresh and retry, shared refresh, sign-out on failure) |
| UI integration | Login, register and logout flows with a real React Query client: loading states, alerts, validation, cache clearing, navigation. Transaction type: column, signed amounts, filter and `?type=` request |

**Backend:** guards, auth controller (cookies set, refreshed and cleared), auth service, JWT strategy (cookie or Bearer token), transactions service (row + outbox event are atomic), outbox relay (success, permanent vs transient failures, backoff, per-key ordering, overlapping ticks, batch draining), error classification and backoff math, idempotent budget consumer (duplicates, poison messages), health check and cleanup jobs.

**Outbox integration** (real Postgres, `npm run test:e2e`, file `test/outbox.e2e-spec.ts`): creating a transaction writes one `PENDING` row, two concurrent relays publish each row exactly once (`SKIP LOCKED`), a duplicate delivery is processed once, and cleanup keeps `PENDING`/`FAILED` rows.


