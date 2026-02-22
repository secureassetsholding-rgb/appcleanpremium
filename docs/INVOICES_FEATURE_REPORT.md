# Invoices Feature — Implementation Report

## Changed files (one line each)

| File | Purpose |
|------|--------|
| `backend-api/package.json` | Added `pdfkit` dependency for server-side PDF generation. |
| `backend-api/server.js` | Added InvoiceCounter + Invoice models, getNextInvoiceNumber(), getCompanySnapshot(), buildClientSnapshot(), computeInvoiceTotals(), generateInvoicePdf(), GET /api/clients/:clientId, and all six invoice endpoints (list/create/get/update/finalize/pdf) with authenticateToken + requireSuperAdmin. |
| `src/services/invoices.ts` | New API service: listClientInvoices, createClientInvoice, getInvoice, updateInvoice, finalizeInvoice, downloadInvoicePdf. |
| `src/pages/ClientDetail.tsx` | New client detail page with Overview and Invoices tabs; Invoices tab and editor (15 rows, Save/Finalize/Download PDF) shown only for superadmin. |
| `src/App.tsx` | Added route `clients/:id` rendering ClientDetail with RoleGuard `clients`. |
| `src/pages/Clients.tsx` | Wired client name to link to `/clients/:id` for opening client detail. |

---

## RBAC proof

- **Backend:** All invoice routes use `authenticateToken` then `requireSuperAdmin`. Non-superadmin receives **403** with message "Super Admin access required".  
  - `GET/POST /api/clients/:clientId/invoices`  
  - `GET /api/invoices/:invoiceId`  
  - `PUT /api/invoices/:invoiceId`  
  - `POST /api/invoices/:invoiceId/finalize`  
  - `GET /api/invoices/:invoiceId/pdf`  

- **Frontend:**  
  - **Invoices tab** is rendered only when `user.role === 'superadmin'` (see `ClientDetail.tsx`: `isSuperadmin &&` on the Invoices tab button and on the invoices section).  
  - **Route guard:** If the URL has `?tab=invoices` and the user is not superadmin, `ClientDetail` redirects: admin → `/dashboard`, supervisor/employee → `/schedule` (useEffect with `navigate(..., { replace: true })`).

---

## Manual test plan

1. **Superadmin**  
   - Log in as superadmin → Clients → open a client (click name) → open "Invoices" tab.  
   - Click "New invoice" → draft created, editor opens.  
   - Edit line items (category, description, qty, unit price, taxable, tax rate), notes, legal note.  
   - Click "Save" → success toast, totals from backend.  
   - Click "Finalize & Generate PDF" → status FINAL, PDF stored.  
   - Click "Download PDF" → PDF downloads.  
   - In list, confirm Download PDF for finalized invoice and View for draft/final.

2. **Admin**  
   - Log in as admin → Clients → open a client.  
   - Confirm **Invoices tab is not visible**.  
   - Call `GET /api/clients/:clientId/invoices` or `POST .../invoices` (e.g. from dev tools) → backend returns **403**.

3. **Supervisor / Employee**  
   - Log in as supervisor or employee → Clients → open a client.  
   - Confirm **Invoices tab is not visible**.  
   - Navigate directly to `/clients/:id?tab=invoices` → redirect to **/schedule**.  
   - Call any invoice endpoint → backend returns **403**.

4. **TaskTable unchanged**  
   - Open Schedule page; confirm TaskTable layout, structure, responsive behavior, and styling are unchanged. No edits were made to `Schedule.tsx` or TaskTable components.

---

**STOP.**
