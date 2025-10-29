# 💬 ChatSphere — WhatsApp Web-Style Chat Platform

A full-stack WhatsApp Web-style chat application built for **real-time business messaging** using the **Meta Cloud API for WhatsApp Business**.  
It features a responsive WhatsApp-inspired interface, secure authentication, message threading, media ingestion, webhook diagnostics, and a powerful admin dashboard.

--- 

## 🧭 Table of Contents

- [Overview](#overview)  
- [Architecture](#architecture)  
- [Installation](#installation)  
- [Environment Configuration](#environment-configuration)  
- [Run Commands](#run-commands)  
- [Project Structure](#project-structure)  
- [Database Schema](#database-schema)  
- [Media System](#media-system)  
- [Diagnostics & Debugging](#diagnostics--debugging)  
- [UI & Design Audit](#ui--design-audit)  
- [Common Issues](#common-issues)  
- [Quality Assurance](#quality-assurance)  
- [License](#license)

---

## 🏷️ Overview

ChatSphere is a **React + Node.js** application that replicates WhatsApp Web UX with full backend control and integration to Meta Cloud API for WhatsApp Business.  
It supports real-time messaging, conversation management, archiving, role-based access, and secure signed media delivery.

**Key Features**
- WhatsApp Web-style dual-panel UI  
- Real-time WebSocket updates  
- Reply-to message support  
- Role-based authentication (Admin / User)  
- Integrated webhook listener & diagnostics  
- Signed media delivery & thumbnail generation  
- PostgreSQL via Drizzle ORM  
- Docker-ready for deployment  
- Cloudflare Tunnel compatible for public SSL access  

---

## 🧱 Architecture

### Frontend
- **Stack:** React + TypeScript + Vite + Tailwind CSS + shadcn/ui (Radix)  
- **State:** TanStack Query for server state; local UI state for interactions  
- **Live updates:** WebSocket hook + query invalidation  
- **Key Components:**  
  - `ConversationList` — search, archive, pinning  
  - `MessageThread` — infinite scroll, skeletons  
  - `MessageBubble` — dynamic layout & reply threading  
  - `MessageInput` — emoji picker, file upload  

### Backend
- **Stack:** Node.js + Express + TypeScript + WebSocket (ws) + Drizzle ORM  
- **Endpoints:** REST CRUD for conversations, messages, users, settings  
- **Realtime:** WebSocket at `/ws` broadcasting incoming/outgoing events  
- **Webhook:** `/webhook/meta` for Meta signature-verified message intake  
- **Auth:** Session-based via Passport.js (scrypt password hashing)  
- **DB:** PostgreSQL (local or Neon serverless)  

---

## ⚙️ Installation

### 1️⃣ Prerequisites
Ensure the following are installed:
```bash
Node.js >= 18
PostgreSQL
Git
```

Optional: run PostgreSQL via Docker
```bash
docker run --name whatsapp-db   -e POSTGRES_PASSWORD=yourpassword   -e POSTGRES_DB=whatsapp_chat   -p 5432:5432 -d postgres
```

### 2️⃣ Clone & Install
```bash
git clone https://github.com/yourusername/chatsphere.git
cd chatsphere
npm install
```

### 3️⃣ Database Setup
```bash
psql -U postgres
CREATE DATABASE whatsapp_chat;
CREATE USER whatsapp_user WITH PASSWORD 'securepassword';
GRANT ALL PRIVILEGES ON DATABASE whatsapp_chat TO whatsapp_user;
\q
npm run db:push
```

### 4️⃣ Create Admin User
Run this Node script:
```bash
npm run seed:admin
```

### 5️⃣ Run Development Server
```bash
npm run dev
```
Visit: [http://localhost:8080](http://localhost:8080)

---

## 🔐 Environment Configuration

Create `.env` in the project root:

```bash
DATABASE_URL=postgresql://postgres:yourpassword@localhost:5432/whatsapp_chat
SESSION_SECRET=your-secret
FILES_SIGNING_SECRET=your-file-secret

META_PHONE_NUMBER_ID=your_meta_phone_number_id
META_TOKEN=your_meta_access_token
META_VERIFY_TOKEN=your_verify_token
META_APP_SECRET=your_meta_app_secret

NODE_ENV=development
PORT=8080
```

**Optional Media Config**
```bash
MEDIA_SIGNED_URL_TTL_SECONDS=900
MEDIA_MAX_ORIGINAL_BYTES=25000000
MEDIA_THUMBNAIL_MAX_WIDTH=512
MEDIA_THUMBNAIL_MAX_HEIGHT=512
MEDIA_STORAGE_ROOT=uploads
```

---

## 🚀 Run Commands

| Command | Description |
|----------|-------------|
| `npm run dev` | Run in development mode |
| `npm run build` | Build production bundles |
| `npm run start` | Start production server |
| `npm run db:push` | Sync schema with DB |
| `npm run check` | TypeScript validation |
| `npm run seed:admin` | Create admin user |

---

## 🗂️ Project Structure

```
chatsphere/
├── client/
│   └── src/
│       ├── components/
│       ├── pages/
│       └── lib/
├── server/
│   ├── index.ts
│   ├── auth.ts
│   ├── routes.ts
│   ├── providers/
│   └── storage.ts
├── shared/
│   └── schema.ts
├── uploads/
│   ├── incoming/
│   └── outbound/
├── .env
├── package.json
└── vite.config.ts
```

---

## 🗄️ Database Schema

| Table | Fields |
|--------|--------|
| `users` | id, username, password, role |
| `whatsapp_instances` | id, name, token, phone_number_id, active |
| `conversations` | id, phone, displayName, archived, lastAt |
| `messages` | id, conversationId, direction, body, media, status, createdAt |
| `sessions` | id, userId, expiresAt |

One-to-many relation: `conversation → messages`  
Drizzle ORM migrations handle schema consistency.

---

## 🎞️ Media System

### Inbound Flow
1. **Webhook Intake** — `/webhook/meta` verifies Meta signature and writes pending message with `messages.media` metadata.  
2. **Ingestion Queue** — downloads media from Graph API, applies size limits, saves to `uploads/incoming/original`.  
3. **Thumbnailing** — via `sharp`; saved to `uploads/incoming/thumbnails`.  
4. **Persistence** — database updates with media metadata and rebroadcasts via WebSocket.  
5. **Delivery** — `/media/*` endpoint serves signed URLs (TTL 15 min).

### Outbound Uploads
Operator uploads stored under `uploads/outbound/original`, re-signed before sending to WhatsApp.

### Security
- Requires `FILES_SIGNING_SECRET`  
- Graph URLs are never exposed — only signed local URLs.  

---

## 🧰 Diagnostics & Debugging

### Webhook Diagnostics Tool
Accessible via the user dropdown → **Webhook Diagnostics**

#### Steps
1. Launch app and sign in as Admin.  
2. Navigate to `/diagnostics`.  
3. Test system status, send test messages, or debug webhook payloads.

#### API Endpoints
```bash
GET  /api/webhook/status/{instanceId}
POST /api/test-message
POST /webhook/debug/{instanceId}
```

#### Example Log Output
```
✅ Webhook verified
💬 Processing message from: +1234567890
💾 Message saved: msg_456
📡 Broadcast complete in 45ms
```

---

## 🎨 UI & Design Audit

- Responsive split-pane desktop / single-pane mobile layout  
- Consistent global actions (theme toggle, account menu)  
- Message bubbles redesigned with balanced padding and typography  
- Unified attachment previews (image, doc, pdf)  
- Improved focus/hover states and accessibility feedback  
- Mobile layout prioritizes reachable controls and single-pane thread navigation  

---

## 🐞 Common Issues

| Problem | Solution |
|----------|-----------|
| **Instance not found** | Verify instance exists and active |
| **Invalid signature** | Check `META_APP_SECRET` and webhook signature |
| **Database connection failed** | Verify `DATABASE_URL` and service is running |
| **No messages showing** | Check WebSocket connection |
| **Port in use** | `lsof -ti:8080 | xargs kill -9` |

---

## 🧪 Quality Assurance

Before release, validate all media and messaging flows:

1. Send inbound images, PDFs, and DOCX/XLSX/TXT/ZIP files  
2. Confirm thumbnail rendering and accessibility  
3. Verify expired URLs regenerate correctly  
4. Test mobile responsiveness ≤420px  
5. Run through diagnostic tool for each instance  

---

## 📜 License

This project is released under the **MIT License**.  
Feel free to fork, modify, and contribute.
