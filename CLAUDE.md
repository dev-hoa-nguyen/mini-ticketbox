# 🤖 TICKETBOX MINI - FULLSTACK AI AGENT GUIDELINES

## 1. PROJECT OVERVIEW

- **Project Name:** Concert Ticket Booking System (Mini Ticketbox).
- **Goal:** Build a highly concurrent ticket booking system for an event limited to 500 tickets, with an expected peak traffic of 5,000 concurrent users. The primary focus is on preventing over-selling (race conditions) and ensuring a smooth user experience (UX) under high load.
- **Architecture:** Polyrepo/Monorepo with a strict separation between Frontend and Backend. Services (PostgreSQL, Redis) are orchestrated using Docker-compose.
- **Tech Stack:**
  - **Backend:** ExpressJS, TypeScript, Prisma ORM, PostgreSQL, Redis, Zod, Jest/Vitest.
  - **Frontend:** React, Tanstack Start, TailwindCSS, ShadcnUI.

---

## 2. CRITICAL BUSINESS LOGIC

### A. Ticket Booking & Reservation Flow

1. User clicks "Select Ticket" -> System calls the Hold Ticket API.
2. Backend checks the ticket inventory. If available, it deducts the ticket count and sets the ticket status to `HOLD` (Reserved) for exactly **5 minutes**.
3. During this 5-minute window, no other user can select this specific ticket.
4. If the user successfully pays within 5 minutes -> Update status to `SOLD`.
5. If 5 minutes pass without payment -> The system automatically `RELEASE`s the ticket back to the `AVAILABLE` pool.

### B. Concurrency Handling (Backend - HIGHEST PRIORITY)

- **ABSOLUTELY NO** standard "Read-then-Write" logic (e.g., `SELECT` count -> subtract 1 in code -> `UPDATE` DB). This will immediately result in over-selling.
- **Mandatory Solutions:**
  - Use **Redis Lua Scripts** to check and deduct ticket inventory atomically in RAM.
  - OR use **Pessimistic Locking (`SELECT ... FOR UPDATE`)** via Prisma raw queries.
- The 5-minute auto-release mechanism must utilize **Redis Keyspace Notifications** (listening for Key Expired events) or a robust Job Queue (like BullMQ). Do not rely on Node.js `setTimeout`.

---

## 3. ARCHITECTURE & FOLDER STRUCTURE

### Backend Structure (Clean Architecture)

Ensure a clean codebase with centralized error handling and data validation:

```text
backend/src/
 ├── api/           # Routes & Controllers (Handles Requests/Responses only)
 ├── core/          # Middlewares, Global Error Handler, Logger
 ├── dto/           # Zod Schemas for request body/query validation
 ├── services/      # Business Logic (Interacts with Redis/DB here)
 |-- database/      # Database utilities (Prisma, Redis)
 ├── repositories/  # Database access layer (Prisma queries)
 └── types/         # TypeScript Interfaces
```

### Frontend Structure

```text
frontend/src/
 ├── components/    # Shared UI components (ShadcnUI, layouts)
 ├── features/      # Domain-driven modules (e.g., tickets, checkout, admin)
 │    ├── api/      # API call functions & Tanstack Query hooks
 │    ├── hooks/    # Custom React hooks containing UI logic
 │    └── ui/       # Feature-specific UI components
 ├── routes/        # Tanstack Start file-based routing
 ├── lib/           # Utilities (formatters, axios instances, etc.)
 └── types/         # Types/Interfaces (Should sync with Backend)
```

## 4. FULLSTACK CODING STANDARDS

### A. Global Rules

Language: 100% TypeScript in Strict Mode. The any type is strictly forbidden.

Naming Conventions: Use camelCase for variables/functions, and PascalCase for Classes/Types/Interfaces. Boolean variables must start with is, has, or should.

Principles: Strictly adhere to DRY (Don't Repeat Yourself) and SOLID principles. Write core Unit Tests for critical business logic.

### B. Backend API Rules

- **Data Validation:** All incoming requests (body, params, queries) must be validated at the API gateway using Zod.

- **Standardized Response:** Every API endpoint (including errors) must return a standardized JSON format:

```ts
{
  "success": boolean,
  "data": any | null,
  "error": string | null,
  "message": string
}
```

- **Error Handling:** Centralized Global Error Handling is required. Controllers should use a catchAsync wrapper. Services should throw a CustomError (with an HTTP Status Code), which the Global Middleware will catch and format. Avoid scattered try/catch blocks.

### C. Frontend UX & Resilience Rules

- **Prevent Spam Clicks (Debounce/Throttle):** API call buttons (especially "Book Ticket") must be disabled and show a loading state immediately after the first click to prevent race conditions from the client side. Utilize Tanstack Query's isPending state.

- **Real-time Synchronization:** Display the remaining ticket count in real-time. Use Server-Sent Events (SSE) to receive ticket updates. Implement auto-reconnect logic for dropped connections.

- **Error Boundaries & Fallbacks:** The UI must gracefully handle network lag or slow server responses (HTTP 429 Too Many Requests, HTTP 503 Service Unavailable). Do not leave the user with a blank screen if the server struggles under load.

### 5. INSTRUCTIONS FOR AI AGENT (CLAUDE/CHATGPT/CURSOR)

When executing coding tasks, you (the AI) MUST strictly follow these directives:

- **Prioritize Edge Cases:** Always consider concurrency, high-load scenarios, and race conditions before generating any backend code.

- **Direct Output:** Provide highly optimized, production-ready code. Omit unnecessary apologies, verbose explanations, or conversational filler.

- **Proactive Warnings:** If a user's prompt suggests an implementation that could cause server crashes under load or compromise data integrity, halt immediately, warn the user, and propose the optimal, safe solution.

- **Security & Performance:** Never generate raw SQL strings constructed via concatenation (prevent SQL Injection); always use parameterized queries or Prisma's built-in methods. Do not use SELECT \*; fetch only the required fields.
