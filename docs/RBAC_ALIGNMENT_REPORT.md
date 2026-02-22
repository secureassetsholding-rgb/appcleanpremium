# RBAC alignment — Superadmin full access

## Step 0 — Inventory of role checks

### Backend (server.js root)

| Location | What it controls |
|----------|-------------------|
| `isAdminOrSuperAdmin(role)` | All "admin" routes: tasks, rooms, time-records, notes, reminders, expenses, quotes, clients, users, statistics, signatures, emails (except config). **Superadmin passes.** |
| `requireSuperAdmin` | GET/PUT `/api/email-notifications`, GET `/api/emails/debug`, POST `/api/emails/test`. Only superadmin passes. |
| Inline `isSuperAdmin` | User create/update/delete: only superadmin can create/assign admin or superadmin, modify admin passwords, delete admin. |

### Backend (backend-api/server.js)

| Location | What it controls |
|----------|-------------------|
| `requireAdmin` (uses `isAdminOrSuperAdmin`) | Notes, reminders, expenses, quotes, clients, budgets, users, statistics, signatures, send-* email endpoints. **Superadmin passes.** |
| `requireSupervisorOrAbove` (includes superadmin) | POST `/api/emails/send-daily-summary`, GET `/api/reports/daily-pdf`. **Superadmin passes.** |
| `requireSuperAdmin` | Middleware added for pattern; use on email-notifications if those routes are added here. |

### Frontend

| File | What it controls |
|------|-------------------|
| `src/components/RoleGuard.tsx` | Route access: **superadmin passes first** (full access to every route). Then `allowedRoles` (admin → /dashboard, others → /schedule for superadmin-only pages). Then `requiredPermission` for non-admin. |
| `src/components/layout/Sidebar/SidebarNav.tsx` | Menu visibility: **superadmin sees every item**. Then items with `roles: ['superadmin']` only for superadmin; admin sees all others. |
| `src/components/layout/Layout.tsx` | Schedule-only layout for `employee` and `supervisor`; full layout for admin and superadmin. |
| `src/App.tsx` (LandingRedirect) | Redirect: employee/supervisor → `/schedule`, admin/superadmin → `/dashboard`. |
| `src/App.tsx` (routes) | Email Notifications: `allowedRoles={['superadmin']}`; all other routes use `requiredPermission`. |

---

## Step 1 — Superadmin full access (confirmed)

- **Frontend RoleGuard:** Superadmin is checked first and always gets `<>{children}</>` — never blocked.
- **Frontend Sidebar:** Superadmin returns `true` first in the filter — sees all menu items.
- **Backend:** Every admin check uses `isAdminOrSuperAdmin(role)`, which returns `true` for `role === 'superadmin'`. So superadmin is never blocked by admin middleware or inline admin checks.
- **Restricted modules:** Only `requireSuperAdmin` restricts to superadmin; those endpoints (email config) are intended for superadmin only, and superadmin passes.

---

## Step 2 — Restricted modules (superadmin-only)

| Module | Backend enforcement | Frontend |
|--------|---------------------|----------|
| **Email recipient configuration** | `requireSuperAdmin` on GET/PUT `/api/email-notifications`, GET `/api/emails/debug`, POST `/api/emails/test` (server.js). | Menu hidden unless `role === 'superadmin'`; route guarded with `allowedRoles={['superadmin']}`; admin/schedule-only redirected. |
| **Invoices (future)** | Apply `requireSuperAdmin` to invoice config/read/write endpoints. | Add nav item with `roles: ['superadmin']`, route with `allowedRoles={['superadmin']}`. |
| **Budgets (future)** | If restricted: add `requireSuperAdmin` to budget config endpoints. | Hide or restrict menu/route by `allowedRoles={['superadmin']}`. |
| **Internal calendar/reminders (future)** | If restricted: add `requireSuperAdmin` to internal config endpoints. | Same pattern. |

Pattern: sensitive read/update endpoints use `authenticateToken, requireSuperAdmin, handler`. Frontend: nav item `roles: ['superadmin']`, route `RoleGuard` with `allowedRoles={['superadmin']}`.

---

## Step 3 — Frontend routing/menu (confirmed)

- **Sensitive menu (Email Notifications):** Shown only when `user.role === 'superadmin'` (SidebarNav checks superadmin first, then `item.roles` for `['superadmin']`).
- **Direct URL:** Admin to `/email-notifications` → RoleGuard redirects to `/dashboard`. Employee/supervisor → redirect to `/schedule`.
- **Schedule-only roles:** Layout and LandingRedirect send employee/supervisor to `/schedule` and use minimal layout.

---

## Changed files

1. **server.js** (root) — Added RBAC comment block; clarified that superadmin has full access and `requireSuperAdmin` is for sensitive modules (email recipients now; future: invoices, budgets, calendar).
2. **backend-api/server.js** — Added RBAC comment block and `requireSuperAdmin` middleware for consistency and future use (e.g. email-notifications if added).

No changes to TaskTable or schedule UI/behavior.

---

## Confirmation: superadmin is never blocked

- **Frontend:** RoleGuard returns children for superadmin before any other check. Sidebar shows all items for superadmin.
- **Backend (root):** All “admin” behavior uses `isAdminOrSuperAdmin(req.user.role)` → superadmin passes. Only `requireSuperAdmin` is stricter, and superadmin passes it on the endpoints where it is used (email config).
- **Backend (backend-api):** `requireAdmin` and `requireSupervisorOrAbove` both allow superadmin; `requireSuperAdmin` is only for future restricted routes.

---

## Test plan by role

### Superadmin

1. Log in as superadmin. Landing → `/dashboard`. Full layout with sidebar.
2. Open every menu item (Dashboard, Schedule, Calendar, Notes, Reminders, Expenses, Quotes, Clients, Satisfaction, Users, Settings, **Email Notifications**). All visible and accessible.
3. Call GET `/api/email-notifications`, PUT `/api/email-notifications` → 200 (or valid payload).
4. Call GET `/api/emails/debug`, POST `/api/emails/test` → 200 (or valid response).
5. Call admin-only APIs (e.g. GET `/api/users`, GET `/api/notes`) → 200. Never 403.

### Admin

1. Log in as admin. Landing → `/dashboard`. Full layout with sidebar.
2. Email Notifications **not** in menu. Direct navigate to `/email-notifications` → redirect to `/dashboard`.
3. GET `/api/email-notifications` or PUT → **403** (Super Admin access required).
4. GET `/api/emails/debug`, POST `/api/emails/test` → **403**.
5. All other app routes and admin APIs (users, notes, reminders, etc.) → 200.

### Supervisor

1. Log in as supervisor. Landing → `/schedule`. Minimal layout (no sidebar).
2. Direct navigate to `/dashboard` or `/email-notifications` → redirect to `/schedule`.
3. Schedule and emergency tools (if implemented) accessible. Admin-only APIs → 403.

### Employee

1. Log in as employee. Landing → `/schedule`. Minimal layout (no sidebar).
2. Direct navigate to `/dashboard` or `/email-notifications` → redirect to `/schedule`.
3. Schedule accessible; no access to admin or superadmin endpoints (403).
