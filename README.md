# WhatsApp Web-Style Chat Application

## Overview

This is a full-stack WhatsApp Web-style chat application for real-time messaging, integrating with **Meta Cloud API WhatsApp Business**. It features a clean, two-panel interface mimicking WhatsApp Web, including conversation management, message threading, archiving, and real-time updates via WebSocket. All conversations and messages are stored in a PostgreSQL database. The application includes a comprehensive statistics dashboard and robust authentication with role-based access control, supporting admin and regular user roles.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Technology Stack:** React with TypeScript, Vite, TanStack Query, Wouter, shadcn/ui (Radix UI), Tailwind CSS.

**Design System:** WhatsApp Web-inspired, custom color palette for light/dark themes, system fonts, `class-variance-authority` for component variants.

**State Management:** TanStack Query for server state, `useWebSocket` hook for real-time updates, local React state for UI, query invalidation on WebSocket events.

**Key Components:** `ConversationList` (with search and archive), `MessageThread`, `MessageBubble`, `MessageInput` (with emoji picker and file upload), `NewConversationDialog`.

### Backend Architecture

**Technology Stack:** Node.js with Express.js, TypeScript, WebSocket (ws library), Drizzle ORM, Neon serverless PostgreSQL driver.

**Server Structure:** Single Express app serving API and static files, WebSocket server co-located.

**API Design:** RESTful endpoints for CRUD operations (conversations, messages), archive functionality, webhook endpoints (`/webhook/meta`), WebSocket at `/ws` for real-time updates. Pagination supported.

**Single Instance Architecture:** WhatsApp Business API is configured using environment variables (access token, phone number ID, webhook verify token, app secret). All conversations and messages use the same WhatsApp instance. Message sending uses a single `MetaProvider` with environment-based credentials.

**Real-time Updates:** WebSocket broadcasts `message_incoming` and `message_outgoing` events, triggering client-side query invalidation.

### Data Storage

**Database:** PostgreSQL (via Drizzle ORM).

**Schema:**
- **Conversations:** `id`, `phone`, `displayName`, `metadata` (JSON), `archived` (boolean), `lastAt`, `createdAt`, `updatedAt`.
- **Messages:** `id`, `conversationId` (FK), `direction`, `body`, `media` (JSON), `providerMessageId`, `status`, `raw` (JSON), `createdAt`.
- **Relations:** One-to-many from Conversations to Messages.

**Storage Layer:** `DatabaseStorage` class for CRUD operations on conversations, messages, users; conversation archiving; and automatic `lastAt` updates.

### Reply Workflow

- Only inbound messages (`direction = inbound`) are eligible reply targets; outbound bubbles never surface the reply affordance.
- Choosing to reply shows a compact context bar above the composer highlighting the sender label (e.g., Customer) and a trimmed snippet, with an accessible clear (`X`) control.
- Composer submissions while a reply target is active send an outbound message that persists `reply_to_message_id` and returns a `replyTo` summary payload with `id`, `content`, `senderLabel`, and `createdAt`.
- Server-side validation enforces conversation ownership and inbound direction; invalid attempts respond with HTTP 400 so the client can display “You can only reply to incoming messages from this conversation.”
- Message bubbles that reference another message render a stub that includes a fallback snippet such as `[Original message unavailable]` and let users jump back to the source message.

### Authentication and Authorization

**Authentication System:** Session-based authentication using Passport.js (local strategy), scrypt hashing for passwords, PostgreSQL-backed session store.

**User Roles:** `admin` (full access, including webhook settings and user management), `user` (standard messaging access).

**Security Model:** No public self-registration; admin-only user creation. `requireAdmin` middleware enforces role-based access.

**Protected Routes:** `/`, `/statistics`, `/settings` (admin-only), `/users` (admin-only).

**Admin Features:** 
- User creation, listing, editing (username/role), and deletion (with self-deletion protection)

**Statistics Dashboard:** Accessible to all authenticated users, displaying total conversations/messages, incoming/outgoing counts, 7-day message activity trends, top 5 active conversations, and a recent activity feed.

**Webhook Security:** Webhook URLs with optional app secret signature validation (SHA-256 HMAC).

## External Dependencies

**WhatsApp API Provider:**
- **Meta Cloud API:** Configured using environment variables:
  - `META_PHONE_NUMBER_ID`: WhatsApp Business Phone Number ID from Meta
  - `META_TOKEN`: System user access token
  - `META_VERIFY_TOKEN`: Custom verify token for webhook setup
  - `META_APP_SECRET` (optional): For webhook signature verification
  - Webhook URL: `/webhook/meta`
- **No Twilio Support:** Application exclusively uses Meta Cloud API for all WhatsApp messaging.

**Database:**
- **Neon Serverless PostgreSQL:** Connected via `DATABASE_URL`.

**UI Component Libraries:**
- Radix UI primitives, shadcn/ui, Lucide React (icons), date-fns.
- `emoji-picker-react` for emoji selection.
- `multer` for file uploads.
- `recharts` for data visualization in the statistics dashboard.

**Development Tools:**
- `vite-plugin-runtime-error-modal`, `cartographer`, `dev-banner` (MUSTAFA JABER), `tsx`, `esbuild`.
