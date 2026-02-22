import { apiClient } from './api'

export interface InvoiceLineItem {
  category?: string
  description?: string
  qty?: number
  unitPrice?: number
  taxable?: boolean
  taxRate?: number
  lineSubtotal?: number
  lineTax?: number
  lineTotal?: number
}

export interface Invoice {
  _id: string
  clientId: string
  invoiceNumber: string
  issueDate: string
  dueDate?: string
  status: 'DRAFT' | 'FINAL' | 'SENT' | 'VOID'
  currency?: string
  companySnapshot?: Record<string, string>
  clientSnapshot?: Record<string, string>
  lineItems: InvoiceLineItem[]
  subtotal: number
  salesTaxTotal: number
  total: number
  notes?: string
  legalNote?: string
  sentAt?: string
  sentTo?: string
  createdAt?: string
  updatedAt?: string
}

export async function listClientInvoices(clientId: string): Promise<Invoice[]> {
  return apiClient.get<Invoice[]>(`/api/clients/${clientId}/invoices`)
}

export async function createClientInvoice(
  clientId: string,
  body: { lineItems?: InvoiceLineItem[]; notes?: string; legalNote?: string }
): Promise<Invoice> {
  return apiClient.post<Invoice>(`/api/clients/${clientId}/invoices`, body)
}

export async function getInvoice(invoiceId: string): Promise<Invoice> {
  return apiClient.get<Invoice>(`/api/invoices/${invoiceId}`)
}

export async function updateInvoice(
  invoiceId: string,
  body: {
    lineItems?: InvoiceLineItem[]
    notes?: string
    legalNote?: string
    issueDate?: string
    dueDate?: string
  }
): Promise<Invoice> {
  return apiClient.put<Invoice>(`/api/invoices/${invoiceId}`, body)
}

export async function finalizeInvoice(invoiceId: string): Promise<Invoice> {
  return apiClient.post<Invoice>(`/api/invoices/${invoiceId}/finalize`, {})
}

const getApiBaseUrl = () =>
  import.meta.env.VITE_API_URL || 'https://brightsbrokscleanproclean2026.onrender.com'

export async function downloadInvoicePdf(invoiceId: string): Promise<Blob> {
  const base = getApiBaseUrl()
  const token = localStorage.getItem('brightworks_token')
  const res = await fetch(`${base}/api/invoices/${invoiceId}/pdf`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  if (!res.ok) throw new Error('Failed to download PDF')
  return res.blob()
}

export async function sendInvoiceToClient(
  invoiceId: string,
  options?: { force?: boolean }
): Promise<{ message: string; sentTo: string; invoice: Invoice }> {
  return apiClient.post<{ message: string; sentTo: string; invoice: Invoice }>(
    `/api/invoices/${invoiceId}/send`,
    options ?? {}
  )
}
