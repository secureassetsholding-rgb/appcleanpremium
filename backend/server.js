import express from 'express'
import path from 'path'
import { fileURLToPath } from 'url'
import cors from "cors";
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import compression from 'compression'
import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'
import sgMail from '@sendgrid/mail'
import jwt from 'jsonwebtoken'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()

// Trust proxy para Render.com y rate limiting
// Render.com usa un proxy, así que confiamos en el primer proxy (1)
app.set('trust proxy', 1)
app.use(
  cors({
    origin: true,
    credentials: true,
  })
)
const PORT = process.env.PORT || 4173
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://brightworks:4heM5D6ER6s2XUUW@cluster0.9zhmytf.mongodb.net/brightwork?retryWrites=true&w=majority'

// ═══════════════════════════════════════════════════════════════
// 🔐 JWT CONFIGURATION
// ═══════════════════════════════════════════════════════════════

const JWT_SECRET = process.env.JWT_SECRET || 'brightworks-secret-key-2024-change-in-production'
const JWT_EXPIRATION = process.env.JWT_EXPIRATION || '7d'

// Helper function para generar tokens JWT reales
function generateJWTToken(userData) {
  const payload = {
    userId: userData.userId || userData.id || userData._id,
    username: userData.username,
    role: userData.role,
    fullName: userData.fullName,
    email: userData.email,
    permissions: userData.permissions || []
  }
  
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRATION })
}

// ═══════════════════════════════════════════════════════════════
// 🗄️ MONGODB CONNECTION
// ═══════════════════════════════════════════════════════════════

let mongoConnected = false

// Conectar a MongoDB de forma asíncrona, no bloquear el inicio
mongoose.connect(MONGODB_URI, {
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 30000,
  connectTimeoutMS: 5000,
  dbName: 'brightwork' // ✅ Usar brightwork (sin 's') según permisos MongoDB
})
  .then(() => {
    mongoConnected = true
    console.log(`✅ MongoDB connected to: ${mongoose.connection.name}`)
    // Ejecutar ensureAdminExists de forma asíncrona, no bloquear
    ensureAdminExists().catch(err => {
      console.error('Error in ensureAdminExists:', err.message)
    })
  })
  .catch(err => {
    console.error('❌ MongoDB error:', err.message)
    mongoConnected = false
    // No bloquear el inicio del servidor si MongoDB falla
    console.log('⚠️ Servidor iniciará sin MongoDB')
  })

// No esperar MongoDB para iniciar el servidor

mongoose.connection.on('disconnected', () => {
  mongoConnected = false
  console.log('⚠️ MongoDB disconnected')
})

mongoose.connection.on('reconnected', () => {
  mongoConnected = true
  console.log('✅ MongoDB reconnected')
})

// ═══════════════════════════════════════════════════════════════
// 📧 SENDGRID EMAIL CONFIGURATION
// ═══════════════════════════════════════════════════════════════

let emailConfigured = false
const emailFrom = process.env.SENDGRID_FROM_EMAIL || 'brightbroks@gmail.com'

if (process.env.SENDGRID_API_KEY && emailFrom) {
  try {
    sgMail.setApiKey(process.env.SENDGRID_API_KEY)
    emailConfigured = true
    console.log('✅ SendGrid configured')
    console.log(`   From: ${emailFrom}`)
  } catch (error) {
    console.error('❌ SendGrid configuration error:', error.message)
  }
} else {
  console.warn('⚠️  SendGrid not configured - emails will not be sent')
  if (!process.env.SENDGRID_API_KEY) console.warn('   Missing: SENDGRID_API_KEY')
  if (!emailFrom) console.warn('   Missing: SENDGRID_FROM_EMAIL')
}

async function sendEmail(to, subject, html) {
  if (!emailConfigured) {
    console.warn('⚠️  Email not sent: SendGrid not configured')
    console.warn(`   To: ${Array.isArray(to) ? to.join(', ') : to}`)
    console.warn(`   Subject: ${subject}`)
    return { success: false, message: 'Email service not configured' }
  }
  
  if (!to || (Array.isArray(to) && to.length === 0)) {
    console.warn('⚠️  Email not sent: No recipient provided')
    return { success: false, message: 'No recipient provided' }
  }
  
  try {
    const recipients = Array.isArray(to) ? to : [to]
    const validRecipients = recipients.filter(email => email && email.includes('@'))
    
    if (validRecipients.length === 0) {
      console.warn('⚠️  Email not sent: No valid email addresses')
      console.warn(`   Recipients:`, recipients)
      return { success: false, message: 'No valid email addresses' }
    }
    
    // Extract plain text from HTML for better deliverability
    const plainText = html
      .replace(/<style[^>]*>.*?<\/style>/gis, '')
      .replace(/<script[^>]*>.*?<\/script>/gis, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .trim()
    
    const msg = {
      to: validRecipients,
      from: {
        email: emailFrom,
        name: 'Bright Works Professional'
      },
      subject: subject,
      html: html,
      trackingSettings: {
        clickTracking: { enable: false },
        openTracking: { enable: false }
      }
    }
    
    console.log(`[sendEmail] Attempting to send email to: ${validRecipients.join(', ')}`)
    console.log(`[sendEmail] Subject: ${subject}`)
    console.log(`[sendEmail] From: ${emailFrom}`)
    console.log(`[sendEmail] Message config:`, JSON.stringify({
      to: validRecipients,
      from: emailFrom,
      subject: subject.substring(0, 50),
      hasHtml: !!html,
      htmlLength: html ? html.length : 0
    }, null, 2))
    
    const response = await sgMail.send(msg)
    console.log(`✅ Email sent successfully to: ${validRecipients.join(', ')}`)
    
    // Log response details safely (SendGrid response format may vary)
    try {
      if (Array.isArray(response) && response[0]) {
        console.log(`[sendEmail] SendGrid response:`, JSON.stringify({
          statusCode: response[0].statusCode,
          headers: response[0].headers ? Object.keys(response[0].headers) : [],
          body: response[0].body ? 'present' : 'missing'
        }, null, 2))
      } else {
        console.log(`[sendEmail] SendGrid response:`, typeof response, response ? 'object received' : 'null/undefined')
      }
    } catch (logErr) {
      console.log(`[sendEmail] Could not log response details:`, logErr.message)
    }
    
    return { success: true, message: 'Email sent successfully', recipients: validRecipients.length, response }
  } catch (err) {
    const errorMessage = err.response?.body?.errors?.[0]?.message || err.message
    const errorDetails = err.response?.body?.errors || []
    console.error('❌ Email send error:', errorMessage)
    console.error('❌ Error details:', JSON.stringify(errorDetails, null, 2))
    console.error('❌ Full error:', err)
    return { success: false, message: errorMessage, error: err }
  }
}

// Get admin emails based on notification configuration
async function getAdminEmails(type = 'sectionCompletion') {
  try {
    if (!mongoConnected) {
      console.log(`[getAdminEmails] MongoDB not connected, returning empty array for type: ${type}`)
      return []
    }
    
    // Obtener configuración de notificaciones
    let config = await EmailNotificationConfig.findOne()
    
    // Si no existe configuración, crear una por defecto con todos los admins y superadmins
    if (!config) {
      console.log(`[getAdminEmails] No email notification config found, creating default...`)
      const allAdmins = await User.find({ 
        $or: [{ role: 'admin' }, { role: 'superadmin' }],
        isActive: true 
      }).select('_id email username')
      
      console.log(`[getAdminEmails] Found ${allAdmins.length} admins for default config`)
      
      config = await EmailNotificationConfig.create({
        sectionCompletion: {
          enabledAdmins: allAdmins.map(a => a._id),
          enabled: true
        },
        dayCompletion: {
          enabledAdmins: allAdmins.map(a => a._id),
          enabled: true
        }
      })
      console.log(`[getAdminEmails] Default email notification config created`)
    }
    
    // Obtener la configuración del tipo de notificación solicitado
    const notificationConfig = config[type] || config.sectionCompletion
    
    console.log(`[getAdminEmails] Type: ${type}, Enabled: ${notificationConfig?.enabled}, EnabledAdmins count: ${notificationConfig?.enabledAdmins?.length || 0}`)
    
    // Si está deshabilitado, retornar array vacío
    if (!notificationConfig || !notificationConfig.enabled) {
      console.log(`[getAdminEmails] Email notifications disabled for type: ${type}`)
      return []
    }
    
    // Obtener emails de los admins habilitados
    if (notificationConfig.enabledAdmins && notificationConfig.enabledAdmins.length > 0) {
      const enabledUsers = await User.find({
        _id: { $in: notificationConfig.enabledAdmins },
        isActive: true,
        $or: [{ role: 'admin' }, { role: 'superadmin' }]
      }).select('email username fullName')
      
      const emails = enabledUsers.map(u => u.email).filter(Boolean)
      console.log(`[getAdminEmails] Found ${emails.length} enabled admin emails for ${type}:`, emails)
      return emails
    }
    
    // Si no hay admins específicos habilitados, retornar todos los admins
    console.log(`[getAdminEmails] No specific admins enabled, returning all admins...`)
    const allAdmins = await User.find({ 
      $or: [{ role: 'admin' }, { role: 'superadmin' }],
      isActive: true 
    }).select('email username')
    
    const emails = allAdmins.map(u => u.email).filter(Boolean)
    console.log(`[getAdminEmails] Returning all ${emails.length} admin emails:`, emails)
    return emails
  } catch (err) {
    console.error(`[getAdminEmails] Error getting admin emails for type ${type}:`, err.message)
    console.error(`[getAdminEmails] Error stack:`, err.stack)
    // Fallback: retornar todos los admins
    try {
      const admins = await User.find({ 
        $or: [{ role: 'admin' }, { role: 'superadmin' }],
        isActive: true 
      }).select('email username')
      const emails = admins.map(u => u.email).filter(Boolean)
      console.log(`[getAdminEmails] Fallback: returning ${emails.length} admin emails:`, emails)
      return emails
    } catch (fallbackErr) {
      console.error(`[getAdminEmails] Fallback error:`, fallbackErr.message)
      return []
    }
  }
}

// User Schema
const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, trim: true, lowercase: true },
  password: { type: String, required: true },
  fullName: { type: String, required: true },
  email: { type: String, trim: true, lowercase: true },
  role: { type: String, enum: ['superadmin', 'admin', 'employee'], default: 'employee' },
  permissions: { 
    type: [String], 
    default: ['schedule', 'daily_report'],
    enum: ['schedule', 'daily_report', 'dashboard', 'calendar', 'notes', 'reminders', 'expenses', 'quotes', 'clients', 'users', 'settings']
  },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
})

const User = mongoose.model('User', UserSchema)

// Email Notification Configuration Schema - Para gestionar qué admins reciben emails
const EmailNotificationConfigSchema = new mongoose.Schema({
  sectionCompletion: {
    enabledAdmins: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    enabled: { type: Boolean, default: true }
  },
  dayCompletion: {
    enabledAdmins: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    enabled: { type: Boolean, default: true }
  },
  updatedAt: { type: Date, default: Date.now },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true })

const EmailNotificationConfig = mongoose.model('EmailNotificationConfig', EmailNotificationConfigSchema)

// Task Schema
const TaskSchema = new mongoose.Schema({
  week: { type: Number, required: true, min: 1, max: 52 },
  taskName: { type: String, required: true, trim: true },
  day: { type: Number, required: true, min: 1, max: 7 },
  completed: { type: Boolean, default: false },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  room: { type: String, trim: true, default: 'General' },
  roomKey: { type: String, trim: true, default: 'general' },
  completedAt: { type: Date },
  updatedAt: { type: Date, default: Date.now },
  completedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  completedByName: { type: String },
  completedByRole: { type: String }
})

TaskSchema.index({ userId: 1, week: 1, taskName: 1, day: 1, room: 1 }, { unique: true })
TaskSchema.index({ userId: 1, week: 1 })
TaskSchema.index({ userId: 1, week: 1, room: 1 })

const Task = mongoose.model('Task', TaskSchema)

// TimeRecord Schema
const TimeRecordSchema = new mongoose.Schema({
  week: { type: Number, required: true, min: 1, max: 52 },
  day: { type: Number, min: 1, max: 7 },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  checkIn: { type: String },
  checkOut: { type: String },
  signature: { type: String },
  observations: { type: String, trim: true }, // Observaciones del día
  room: { type: String, trim: true, default: 'General' },
  roomKey: { type: String, trim: true, default: 'general' },
  employeeName: { type: String },
  totalHours: { type: String, default: '0h 0m' },
  date: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
})

TimeRecordSchema.index({ userId: 1, week: 1, day: 1, room: 1 }, { unique: true })
TimeRecordSchema.index({ userId: 1, week: 1 })

const TimeRecord = mongoose.model('TimeRecord', TimeRecordSchema)

// Room Schema - Para guardar las rooms independientemente
const RoomSchema = new mongoose.Schema({
  label: { type: String, required: true, trim: true },
  key: { type: String, required: true, trim: true, unique: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
})

RoomSchema.index({ key: 1, userId: 1 }, { unique: true })
RoomSchema.index({ userId: 1 })

const Room = mongoose.model('Room', RoomSchema)

// Customer Satisfaction Schema
const CustomerSatisfactionSchema = new mongoose.Schema({
  clientName: { type: String, required: true, trim: true },
  clientEmail: { type: String, trim: true },
  clientPhone: { type: String, trim: true },
  rating: { type: Number, required: true, min: 1, max: 5 },
  npsScore: { type: Number, min: 0, max: 10 }, // Net Promoter Score (0-10)
  categories: {
    serviceQuality: { type: Number, min: 1, max: 5 },
    communication: { type: Number, min: 1, max: 5 },
    timeliness: { type: Number, min: 1, max: 5 },
    value: { type: Number, min: 1, max: 5 },
  },
  comment: { type: String, trim: true },
  wouldRecommend: { type: Boolean },
  submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  submittedAt: { type: Date, default: Date.now },
  location: { type: String, trim: true },
  serviceType: { type: String, trim: true },
})

CustomerSatisfactionSchema.index({ clientEmail: 1, submittedAt: -1 })
CustomerSatisfactionSchema.index({ submittedAt: -1 })
CustomerSatisfactionSchema.index({ rating: 1 })

const CustomerSatisfaction = mongoose.model('CustomerSatisfaction', CustomerSatisfactionSchema)

// TaskConfig Schema - Para guardar la configuración de tareas por usuario
const TaskConfigSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  sections: [{
    id: { type: String, required: true },
    title: { type: String, required: true },
    tasks: [{ type: String }],
    order: { type: Number, default: 0 },
    icon: { type: String }
  }],
  version: { type: Number, default: 1 },
  lastUpdated: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
})

// TaskConfigSchema.index({ userId: 1 }, { unique: true }) // ❌ REMOVIDO: userId ya tiene unique:true en la definición del campo (línea 401), lo cual crea automáticamente el índice

const TaskConfig = mongoose.model('TaskConfig', TaskConfigSchema)

// Note Schema
const NoteSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true, trim: true },
  content: { type: String, required: true },
  week: { type: Number, min: 1, max: 52 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
})

NoteSchema.index({ userId: 1, createdAt: -1 })

const Note = mongoose.model('Note', NoteSchema)

// Reminder Schema
const ReminderSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  dueDate: { type: Date, required: true },
  completed: { type: Boolean, default: false },
  priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
  createdAt: { type: Date, default: Date.now },
  completedAt: { type: Date }
})

ReminderSchema.index({ userId: 1, dueDate: 1 })
ReminderSchema.index({ userId: 1, completed: 1 })

const Reminder = mongoose.model('Reminder', ReminderSchema)

// Expense Schema
const ExpenseSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true, trim: true },
  category: { type: String, required: true, trim: true },
  amount: { type: Number, required: true, min: 0 },
  description: { type: String, trim: true },
  date: { type: Date, required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
})

ExpenseSchema.index({ userId: 1, date: -1 })
ExpenseSchema.index({ userId: 1, createdAt: -1 })

const Expense = mongoose.model('Expense', ExpenseSchema)

// Budget/Quote Schema
const BudgetSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  budgetNumber: { type: String },
  clientName: { type: String, required: true, trim: true },
  contactPerson: { type: String, trim: true },
  email: { type: String, trim: true, lowercase: true },
  phone: { type: String, trim: true },
  address: { type: String, trim: true },
  facilityType: { type: String, trim: true },
  service: { type: String, required: true, trim: true },
  services: [{ type: String }],
  isoStandards: [{ type: String }],
  epaRegulations: [{ type: String }],
  greenSeal: { type: Boolean, default: false },
  osha: { type: Boolean, default: false },
  lineItems: [{
    description: { type: String },
    quantity: { type: Number },
    rate: { type: Number },
    amount: { type: Number }
  }],
  subtotal: { type: Number, default: 0 },
  tax: { type: Number, default: 0 },
  amount: { type: Number, required: true, min: 0 },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  description: { type: String },
  validUntil: { type: Date },
  paymentTerms: { type: String },
  // Additional fields for quotes/budgets
  squareFootage: { type: String, trim: true },
  humidityProfile: { type: String, trim: true },
  sanitationScope: { type: String, trim: true },
  compliance: [{ type: String }],
  notes: { type: String, trim: true },
  qrLink: { type: String, trim: true },
  startDate: { type: Date },
  endDate: { type: Date },
  photos: [{ type: String }], // Array of base64 encoded images
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
})

BudgetSchema.index({ userId: 1, createdAt: -1 })
BudgetSchema.index({ userId: 1, status: 1 })
BudgetSchema.index({ budgetNumber: 1 }, { unique: true, sparse: true })

BudgetSchema.pre('save', async function(next) {
  if (!this.budgetNumber) {
    const count = await mongoose.model('Budget').countDocuments()
    const year = new Date().getFullYear()
    this.budgetNumber = `BW-${year}-${String(count + 1).padStart(5, '0')}`
  }
  next()
})

const Budget = mongoose.model('Budget', BudgetSchema)

// Client Schema
const ClientSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true, trim: true },
  contact: { type: String, trim: true },
  email: { type: String, trim: true, lowercase: true },
  phone: { type: String, trim: true },
  address: { type: String, trim: true },
  facilityType: { type: String, trim: true },
  rating: { type: Number, min: 0, max: 5, default: 0 },
  notes: { type: String },
  satisfactionHistory: [{
    date: { type: Date, default: Date.now },
    rating: { type: Number, min: 0, max: 5 },
    comment: { type: String },
    service: { type: String }
  }],
  totalServices: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
})

ClientSchema.index({ userId: 1, createdAt: -1 })
ClientSchema.index({ userId: 1, name: 1 })

const Client = mongoose.model('Client', ClientSchema)

// Crear admin por defecto si no existe
async function ensureAdminExists() {
  try {
    // Crear superadmin
    let superadmin = await User.findOne({ username: 'superadmin' })
    if (!superadmin) {
      const hashedPassword = await bcrypt.hash('superadmin123', 10)
      superadmin = await User.create({
        username: 'superadmin',
        password: hashedPassword,
        fullName: 'Super Administrator',
        email: 'brightbroks@gmail.com',
        role: 'superadmin',
        permissions: ['schedule', 'daily_report', 'dashboard', 'calendar', 'notes', 'reminders', 'expenses', 'quotes', 'clients', 'users', 'settings'],
        isActive: true
      })
      console.log('✅ Super Admin user created with full permissions')
      console.log('   Username: superadmin')
      console.log('   Password: superadmin123')
      console.log('   Email: brightbroks@gmail.com')
    } else {
      // Asegurar que el superadmin existe y tiene los datos correctos
      if (superadmin.role !== 'superadmin') {
        superadmin.role = 'superadmin'
        console.log('✅ User upgraded to Super Admin')
      }
      // Actualizar email si no está configurado correctamente
      if (!superadmin.email || superadmin.email !== 'brightbroks@gmail.com') {
        superadmin.email = 'brightbroks@gmail.com'
        console.log('✅ Super Admin email updated to brightbroks@gmail.com')
      }
      if (!superadmin.permissions || superadmin.permissions.length === 0) {
        superadmin.permissions = ['schedule', 'daily_report', 'dashboard', 'calendar', 'notes', 'reminders', 'expenses', 'quotes', 'clients', 'users', 'settings']
      }
      superadmin.isActive = true
      await superadmin.save()
    }
    
    // Crear admin regular
    const admin = await User.findOne({ username: 'admin' })
    if (!admin) {
      const hashedPassword = await bcrypt.hash('admin123', 10)
      await User.create({
        username: 'admin',
        password: hashedPassword,
        fullName: 'Administrator',
        email: 'admin@brightworks.app',
        role: 'admin',
        permissions: ['schedule', 'daily_report', 'dashboard', 'calendar', 'notes', 'reminders', 'expenses', 'quotes', 'clients', 'users', 'settings']
      })
      console.log('✅ Admin user created with full permissions')
    } else if (!admin.permissions || admin.permissions.length === 0) {
      // Si admin existe pero no tiene permisos, agregarlos
      admin.permissions = ['schedule', 'daily_report', 'dashboard', 'calendar', 'notes', 'reminders', 'expenses', 'quotes', 'clients', 'users', 'settings']
      await admin.save()
      console.log('✅ Admin permissions updated')
    }
    
    // Inicializar configuración de emails si no existe
    const emailConfig = await EmailNotificationConfig.findOne()
    if (!emailConfig) {
      const allAdmins = await User.find({ 
        $or: [{ role: 'admin' }, { role: 'superadmin' }],
        isActive: true 
      }).select('_id')
      
      await EmailNotificationConfig.create({
        sectionCompletion: {
          enabledAdmins: allAdmins.map(a => a._id),
          enabled: true
        },
        dayCompletion: {
          enabledAdmins: allAdmins.map(a => a._id),
          enabled: true
        },
        updatedBy: superadmin?._id || allAdmins[0]?._id
      })
      console.log('✅ Email notification configuration initialized')
    }
  } catch (err) {
    console.error('Error creating admin:', err.message)
  }
}

// ═══════════════════════════════════════════════════════════════
// 🛡️ SEGURIDAD (CSP relajado para React SPA)
// ═══════════════════════════════════════════════════════════════

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      scriptSrcAttr: ["'unsafe-inline'"],  // ✅ Permite onclick handlers
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      connectSrc: [
        "'self'",
        "https://fonts.googleapis.com",
        "https://fonts.gstatic.com",
        "https://bright-works-schedule.onrender.com"
      ],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      upgradeInsecureRequests: []
    }
  },
  crossOriginEmbedderPolicy: false,  // ✅ Permite cargar recursos externos
  crossOriginResourcePolicy: { policy: "cross-origin" }
}))

// Rate limiting general
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,  // Aumentado para SPA
  message: { error: 'Demasiadas solicitudes, intente más tarde' }
})

// Rate limiting ESTRICTO para login
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,  // 10 intentos de login
  message: { 
    error: 'Demasiados intentos de login',
    message: 'Cuenta bloqueada temporalmente. Intente en 15 minutos.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const body = req.body || {}
    return `${req.ip}-${body.email || 'unknown'}`
  }
})

app.use(compression())
app.use(express.json())

// ═══════════════════════════════════════════════════════════════
// 🔐 LOGIN (MongoDB)
// ═══════════════════════════════════════════════════════════════

app.post('/api/login', authLimiter, async (req, res) => {
  try {
    const { username, password } = req.body || {}
    
    if (!username || !password) {
      console.log(`[Login] Missing credentials`)
      return res.status(400).json({ message: 'Username and password required' })
    }
    
    // Normalizar username: trim, lowercase, y quitar TODOS los espacios
    const normalizedUser = String(username).trim().toLowerCase().replace(/\s+/g, '')
    // Normalizar password: trim, quitar espacios, y convertir a minúsculas (para comparación case-insensitive)
    const normalizedPassword = String(password).trim().replace(/\s+/g, '').toLowerCase()
    
    console.log(`[Login] Attempting login for: "${username}" -> normalized: "${normalizedUser}"`)
    console.log(`[Login] Password received (length: ${password?.length || 0}), normalized: "${normalizedPassword.substring(0, 5)}..."`)
    
    // Fallback local para superadmin/admin/employee - SIEMPRE verificar primero (ANTES de MongoDB)
    const allPerms = ['schedule', 'daily_report', 'dashboard', 'calendar', 'notes', 'reminders', 'expenses', 'quotes', 'clients', 'users', 'settings']
    
    // Superadmin fallback - SIEMPRE tiene prioridad sobre MongoDB
    // Aceptar contraseña en cualquier caso: "superadmin123", "SUPERADMIN123", "SuperAdmin123", etc.
    if (normalizedUser === 'superadmin') {
      if (normalizedPassword === 'superadmin123') {
        console.log(`✅ Login OK (local fallback - PRIORITY): superadmin - Password match!`)
        const userData = { 
          userId: 'superadmin',
          id: 'superadmin', 
          username: 'superadmin', 
          fullName: 'Super Administrator', 
          email: 'brightbroks@gmail.com',
          role: 'superadmin',
          permissions: allPerms
        }
        return res.json({
          token: generateJWTToken(userData),
          user: userData
        })
      } else {
        console.log(`❌ Login FAIL: superadmin password mismatch`)
        console.log(`   Expected: "superadmin123" (normalized, lowercase)`)
        console.log(`   Received: "${password}" (raw) or "${normalizedPassword}" (normalized)`)
        return res.status(401).json({ message: 'Invalid username or password' })
      }
    }
    
    // Admin fallback
    if (normalizedUser === 'admin' && normalizedPassword === 'admin123') {
      console.log(`✅ Login OK (local): ${normalizedUser}`)
      const userData = { 
        userId: 'admin',
        id: 'admin', 
        username: 'admin', 
        fullName: 'Administrator', 
        role: 'admin',
        permissions: allPerms
      }
      return res.json({
        token: generateJWTToken(userData),
        user: userData
      })
    }
    
    // Employee fallback
    if (normalizedUser === 'employee' && normalizedPassword === 'employee123') {
      console.log(`✅ Login OK (local): ${normalizedUser}`)
      const userData = { 
        userId: 'employee',
        id: 'employee', 
        username: 'employee', 
        fullName: 'Employee', 
        role: 'employee',
        permissions: ['schedule', 'daily_report']
      }
      return res.json({
        token: generateJWTToken(userData),
        user: userData
      })
    }
    
    // Si es superadmin pero la contraseña no es correcta, no buscar en MongoDB (evitar confusión)
    if (normalizedUser === 'superadmin') {
      console.log(`❌ Login FAIL: superadmin password incorrect (received length: ${password?.length || 0})`)
      return res.status(401).json({ message: 'Invalid username or password' })
    }
    
    console.log(`[Login] User "${normalizedUser}" not found in local fallback, checking MongoDB...`)
    
    // Intentar MongoDB si está conectado
    if (!mongoConnected) {
      console.log(`❌ Login FAIL: MongoDB not connected, user not found in fallback: ${normalizedUser}`)
      return res.status(401).json({ message: 'Invalid username or password' })
    }
    
    try {
      // Buscar con username normalizado (sin espacios, lowercase)
      // También buscar con regex para encontrar variaciones (case-insensitive, sin espacios)
      const dbUser = await User.findOne({ 
        $or: [
          { username: normalizedUser, isActive: true },
          { username: new RegExp(`^${normalizedUser.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'), isActive: true }
        ]
      })
      
      console.log(`[Login] MongoDB search for: "${normalizedUser}"`)
      if (dbUser) {
        console.log(`[Login] User found in DB: username="${dbUser.username}", role="${dbUser.role}", id="${dbUser._id}"`)
      } else {
        console.log(`❌ Login FAIL: ${normalizedUser} not found in database`)
        // Si no existe, intentar crear superadmin si es el caso
        if (normalizedUser === 'superadmin') {
          try {
            const hashedPassword = await bcrypt.hash('superadmin123', 10)
            const newSuperAdmin = await User.create({
              username: 'superadmin',
              password: hashedPassword,
              fullName: 'Super Administrator',
              email: 'brightbroks@gmail.com',
              role: 'superadmin',
              permissions: allPerms,
              isActive: true
            })
            console.log(`✅ Super Admin created automatically for login`)
            const validPassword = await bcrypt.compare(password, newSuperAdmin.password)
            if (validPassword) {
              console.log(`✅ Login OK (MongoDB - new superadmin): ${normalizedUser}`)
              const userData = {
                userId: newSuperAdmin._id,
                id: newSuperAdmin._id,
                _id: newSuperAdmin._id,
                username: newSuperAdmin.username,
                fullName: newSuperAdmin.fullName,
                email: newSuperAdmin.email,
                role: newSuperAdmin.role,
                permissions: newSuperAdmin.permissions
              }
              return res.json({
                token: generateJWTToken(userData),
                user: userData
              })
            }
          } catch (createError) {
            console.error('Error creating superadmin:', createError.message)
          }
        }
        return res.status(401).json({ message: 'Invalid username or password' })
      }
      
      const validPassword = await bcrypt.compare(password, dbUser.password)
      if (!validPassword) {
        console.log(`❌ Login FAIL: ${normalizedUser} wrong password`)
        return res.status(401).json({ message: 'Invalid username or password' })
      }
      
      // Asegurar que los permisos sean correctos según el rol
      let userPerms = dbUser.permissions || []
      if (dbUser.role === 'superadmin' || dbUser.role === 'admin') {
        userPerms = allPerms
      } else if (dbUser.role === 'employee' && (!userPerms || userPerms.length === 0)) {
        userPerms = ['schedule', 'daily_report']
      }
      
      console.log(`✅ Login OK (MongoDB): ${normalizedUser}, role="${dbUser.role}", permissions count=${userPerms.length}`)
      console.log(`[Login] Returning user data: role="${dbUser.role}", username="${dbUser.username}"`)
      
      const userData = {
        userId: dbUser._id,
        id: dbUser._id,
        _id: dbUser._id,
        username: dbUser.username,
        fullName: dbUser.fullName,
        email: dbUser.email,
        role: dbUser.role, // Asegurar que se devuelve el rol correcto
        permissions: userPerms
      }
      
      res.json({
        token: generateJWTToken(userData),
        user: userData
      })
    } catch (dbError) {
      // Si hay error de permisos de MongoDB, usar fallback local
      if (dbError.message.includes('not allowed') || dbError.message.includes('permission')) {
        console.warn('⚠️ MongoDB permission error, using local fallback')
        // Intentar fallback para superadmin primero
        if (normalizedUser === 'superadmin' && password === 'superadmin123') {
          const userData = { 
            userId: 'superadmin',
            id: 'superadmin', 
            username: 'superadmin', 
            fullName: 'Super Administrator',
            email: 'brightbroks@gmail.com',
            role: 'superadmin',
            permissions: allPerms
          }
          return res.json({
            token: generateJWTToken(userData),
            user: userData
          })
        }
        if (normalizedUser === 'admin' && password === 'admin123') {
          const userData = { 
            userId: 'admin',
            id: 'admin', 
            username: 'admin', 
            fullName: 'Administrator', 
            role: 'admin',
            permissions: allPerms
          }
          return res.json({
            token: generateJWTToken(userData),
            user: userData
          })
        }
      }
      throw dbError
    }
  } catch (err) {
    console.error('❌ Login error:', err.message)
    console.error('Error stack:', err.stack)
    
    // Si hay un error, pero el usuario es superadmin, intentar fallback como último recurso
    try {
      const { username, password } = req.body || {}
      if (username && password) {
        const normalizedUser = String(username).trim().toLowerCase().replace(/\s+/g, '')
        if (normalizedUser === 'superadmin' && password === 'superadmin123') {
          console.log(`✅ Login OK (fallback after error): superadmin`)
          const userData = { 
            userId: 'superadmin',
            id: 'superadmin', 
            username: 'superadmin', 
            fullName: 'Super Administrator', 
            email: 'brightbroks@gmail.com',
            role: 'superadmin',
            permissions: ['schedule', 'daily_report', 'dashboard', 'calendar', 'notes', 'reminders', 'expenses', 'quotes', 'clients', 'users', 'settings']
          }
          return res.json({
            token: generateJWTToken(userData),
            user: userData
          })
        }
      }
    } catch (fallbackErr) {
      console.error('Fallback error:', fallbackErr.message)
    }
    
    res.status(401).json({ message: 'Invalid username or password' })
  }
})

// Password recovery endpoint
app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const { email } = req.body
    
    if (!email) {
      return res.status(400).json({ message: 'Email is required' })
    }
    
    if (!mongoConnected) {
      return res.status(503).json({ message: 'Database not available' })
    }
    
    if (!emailConfigured) {
      return res.status(503).json({ message: 'Email service not configured' })
    }
    
    // Buscar usuario por email
    const user = await User.findOne({ email: email.toLowerCase().trim(), isActive: true })
    
    if (!user) {
      // Por seguridad, no revelar si el email existe o no
      return res.json({ message: 'If the email exists, a password reset link has been sent' })
    }
    
    // Generar nueva contraseña temporal
    const tempPassword = Math.random().toString(36).slice(-10) + Math.random().toString(36).slice(-10).toUpperCase()
    const hashedPassword = await bcrypt.hash(tempPassword, 10)
    
    // Actualizar contraseña
    user.password = hashedPassword
    await user.save()
    
    // Enviar email con la nueva contraseña
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f5f5f5;">
        <div style="background: white; border-radius: 8px; padding: 30px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <h1 style="color: #333; margin-top: 0;">Password Recovery - Bright Works Professional</h1>
          <div style="border-top: 2px solid #e0e0e0; padding-top: 20px; margin-top: 20px;">
            <p>Hello ${user.fullName},</p>
            <p>Your password has been reset. Please use the following temporary password to log in:</p>
            <div style="background: #f0f0f0; border: 2px solid #333; border-radius: 4px; padding: 15px; margin: 20px 0; text-align: center;">
              <p style="font-size: 18px; font-weight: bold; color: #333; margin: 0; font-family: monospace;">${tempPassword}</p>
            </div>
            <p><strong>Username:</strong> ${user.username}</p>
            <p>Please log in and change your password immediately after accessing your account.</p>
            <p style="color: #666; font-size: 12px; margin-top: 20px;"><em>This is an automated message. Please do not reply.</em></p>
          </div>
        </div>
      </div>
    `
    
    const emailResult = await sendEmail(
      user.email,
      'Password Recovery - Bright Works Professional',
      html
    )
    
    if (emailResult.success) {
      console.log(`✅ Password reset email sent to: ${user.email}`)
      res.json({ message: 'Password reset email sent successfully' })
    } else {
      // Revert password change if email fails
      const originalHashedPassword = await bcrypt.hash('superadmin123', 10)
      user.password = originalHashedPassword
      await user.save()
      res.status(500).json({ message: 'Error sending email. Please try again later.' })
    }
  } catch (err) {
    console.error('Password recovery error:', err.message)
    res.status(500).json({ message: 'Error processing password recovery request' })
  }
})

// Health check del API
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// ═══════════════════════════════════════════════════════════════
// 👥 USUARIOS (MongoDB)
// ═══════════════════════════════════════════════════════════════

// Obtener todos los usuarios
app.get('/api/users', async (_req, res) => {
  try {
    if (!mongoConnected) {
      return res.json([{ id: 'admin', username: 'admin', fullName: 'Administrator', role: 'admin' }])
    }
    const users = await User.find({ isActive: true }).select('-password')
    res.json(users)
  } catch (err) {
    console.error('Get users error:', err.message)
    // Fallback local si hay error de permisos
    if (err.message.includes('not allowed') || err.message.includes('permission')) {
      return res.json([{ id: 'admin', username: 'admin', fullName: 'Administrator', role: 'admin' }])
    }
    res.status(500).json({ message: 'Server error' })
  }
})

// Obtener usuario actual (verificación de token)
app.get('/api/users/me', authenticateToken, async (req, res) => {
  try {
    const currentUser = req.user
    
    if (!currentUser || !currentUser.userId) {
      return res.status(401).json({ message: 'Unauthorized' })
    }
    
    // Si es un usuario local (fallback), devolver datos del token
    if (currentUser.isLocalFallback || currentUser.userId === null) {
      return res.json({
        user: {
          _id: currentUser.userId || currentUser.username,
          id: currentUser.userId || currentUser.username,
          username: currentUser.username,
          fullName: currentUser.fullName || currentUser.username,
          email: currentUser.email || '',
          role: currentUser.role,
          permissions: currentUser.permissions || [],
          isActive: true
        }
      })
    }
    
    // Buscar usuario en MongoDB si está conectado
    if (mongoConnected) {
      try {
        // Si userId es un ObjectId válido, buscar en BD
        if (currentUser.userId && currentUser.userId.length === 24 && /^[0-9a-fA-F]{24}$/.test(currentUser.userId)) {
          const dbUser = await User.findById(currentUser.userId)
          if (dbUser && dbUser.isActive) {
            // Asegurar permisos según rol
            let userPerms = dbUser.permissions || []
            const allPerms = ['schedule', 'daily_report', 'dashboard', 'calendar', 'notes', 'reminders', 'expenses', 'quotes', 'clients', 'users', 'settings']
            if (dbUser.role === 'superadmin' || dbUser.role === 'admin') {
              userPerms = allPerms
            } else if (dbUser.role === 'employee' && (!userPerms || userPerms.length === 0)) {
              userPerms = ['schedule', 'daily_report']
            }
            
            return res.json({
              user: {
                _id: dbUser._id,
                id: dbUser._id,
                username: dbUser.username,
                fullName: dbUser.fullName,
                email: dbUser.email || '',
                role: dbUser.role,
                permissions: userPerms,
                isActive: dbUser.isActive,
                createdAt: dbUser.createdAt,
                updatedAt: dbUser.updatedAt,
                lastLoginAt: dbUser.lastLoginAt
              }
            })
          }
        }
      } catch (dbError) {
        console.warn('Error fetching user from DB:', dbError.message)
        // Continuar con datos del token
      }
    }
    
    // Si no se encuentra en BD o MongoDB no está conectado, usar datos del token
    return res.json({
      user: {
        _id: currentUser.userId,
        id: currentUser.userId,
        username: currentUser.username,
        fullName: currentUser.fullName || currentUser.username,
        email: currentUser.email || '',
        role: currentUser.role,
        permissions: currentUser.permissions || [],
        isActive: true
      }
    })
  } catch (err) {
    console.error('Get current user error:', err.message)
    return res.status(500).json({ message: 'Server error' })
  }
})

// Crear usuario
app.post('/api/users', authenticateToken, async (req, res) => {
  try {
    const { username, fullName, email, role, password, permissions } = req.body || {}
    const currentUser = req.user
    
    // Obtener usuario actual desde DB para verificar role
    let dbCurrentUser = null
    try {
      if (currentUser && currentUser.userId) {
        dbCurrentUser = await User.findById(currentUser.userId)
      }
    } catch (err) {
      console.warn('Could not fetch current user from DB:', err.message)
    }
    
    const isSuperAdmin = dbCurrentUser?.role === 'superadmin' || currentUser?.role === 'superadmin'
    const isAdmin = dbCurrentUser?.role === 'admin' || currentUser?.role === 'admin' || isSuperAdmin
    
    if (!isAdmin) {
      return res.status(403).json({ message: 'Only administrators can create users' })
    }
    
    if (!username || !fullName) {
      return res.status(400).json({ message: 'Username and fullName required' })
    }
    
    // Solo superadmin puede crear usuarios con role admin o superadmin
    if ((role === 'admin' || role === 'superadmin') && !isSuperAdmin) {
      return res.status(403).json({ message: 'Only Super Admin can create admin or superadmin users' })
    }
    
    if (!mongoConnected) {
      return res.status(503).json({ message: 'Database not available. Please configure MongoDB permissions.' })
    }
    
    try {
      const id = username.toLowerCase().trim()
      const existing = await User.findOne({ username: id })
      if (existing) {
        return res.status(400).json({ message: 'User already exists' })
      }
      
      const hashedPassword = await bcrypt.hash(password || 'password123', 10)
      
      // Si es admin o superadmin, dar todos los permisos. Si es employee, usar los proporcionados o default
      const finalRole = role || 'employee'
      const allPerms = ['schedule', 'daily_report', 'dashboard', 'calendar', 'notes', 'reminders', 'expenses', 'quotes', 'clients', 'users', 'settings']
      const finalPermissions = (finalRole === 'admin' || finalRole === 'superadmin')
        ? allPerms 
        : (permissions && Array.isArray(permissions) ? permissions : ['schedule', 'daily_report'])
      
      const newUser = await User.create({
        username: id,
        password: hashedPassword,
        fullName,
        email: email || `${id}@brightworks.app`,
        role: finalRole,
        permissions: finalPermissions
      })
      
      console.log(`✅ User created: ${id} with role: ${finalRole} by ${currentUser?.username || 'unknown'}`)
      const { password: _, ...userWithoutPassword } = newUser.toObject()
      res.status(201).json(userWithoutPassword)
    } catch (dbError) {
      if (dbError.message.includes('not allowed') || dbError.message.includes('permission')) {
        return res.status(503).json({ 
          message: 'MongoDB permission denied. Please grant Read/Write permissions to the user in MongoDB Atlas.' 
        })
      }
      throw dbError
    }
  } catch (err) {
    console.error('Create user error:', err.message)
    res.status(500).json({ message: 'Server error' })
  }
})

// Actualizar usuario
app.put('/api/users/:id', authenticateToken, async (req, res) => {
  try {
    if (!mongoConnected) {
      return res.status(503).json({ message: 'Database not available' })
    }
    
    const { id } = req.params
    const updateData = { ...req.body }
    const currentUser = req.user
    
    // Obtener usuario actual desde DB
    let dbCurrentUser = null
    try {
      if (currentUser && currentUser.userId) {
        dbCurrentUser = await User.findById(currentUser.userId)
      }
    } catch (err) {
      console.warn('Could not fetch current user from DB:', err.message)
    }
    
    const isSuperAdmin = dbCurrentUser?.role === 'superadmin' || currentUser?.role === 'superadmin'
    const isAdmin = dbCurrentUser?.role === 'admin' || currentUser?.role === 'admin' || isSuperAdmin
    
    // Obtener usuario a actualizar
    const targetUser = await User.findById(id)
    if (!targetUser) {
      return res.status(404).json({ message: 'User not found' })
    }
    
    const isTargetAdmin = targetUser.role === 'admin' || targetUser.role === 'superadmin'
    
    // Solo superadmin puede modificar roles de admins/superadmins
    if (updateData.role && isTargetAdmin && !isSuperAdmin) {
      return res.status(403).json({ message: 'Only Super Admin can modify roles of admin users' })
    }
    
    // Solo superadmin puede cambiar passwords de admins/superadmins
    if (updateData.password && isTargetAdmin && !isSuperAdmin) {
      return res.status(403).json({ message: 'Only Super Admin can modify passwords of admin users' })
    }
    
    // Solo superadmin puede crear superadmins o convertir a superadmin
    if (updateData.role === 'superadmin' && !isSuperAdmin) {
      return res.status(403).json({ message: 'Only Super Admin can create or assign superadmin role' })
    }
    
    // Solo superadmin puede cambiar role a admin
    if (updateData.role === 'admin' && isTargetAdmin && !isSuperAdmin) {
      return res.status(403).json({ message: 'Only Super Admin can assign admin role' })
    }
    
    if (updateData.password) {
      updateData.password = await bcrypt.hash(updateData.password, 10)
    }
    
    // Manejar permisos según el rol
    if (updateData.role || updateData.permissions) {
      const allPerms = ['schedule', 'daily_report', 'dashboard', 'calendar', 'notes', 'reminders', 'expenses', 'quotes', 'clients', 'users', 'settings']
      const finalRole = updateData.role || targetUser.role
      
      console.log(`[Update User] Role update - targetUser.role: "${targetUser.role}", updateData.role: "${updateData.role}", finalRole: "${finalRole}"`)
      
      if (finalRole === 'admin' || finalRole === 'superadmin') {
        updateData.permissions = allPerms
      } else if (finalRole === 'employee' && updateData.permissions) {
        // Asegurar que siempre tenga schedule y daily_report
        const perms = Array.isArray(updateData.permissions) ? updateData.permissions : []
        updateData.permissions = [...new Set([...perms, 'schedule', 'daily_report'])]
      } else if (!updateData.permissions && finalRole === 'employee') {
        updateData.permissions = ['schedule', 'daily_report']
      }
    }
    
    // Asegurar que el rol se guarde exactamente como viene
    if (updateData.role) {
      console.log(`[Update User] Saving role: "${updateData.role}" for user ${id} (was: "${targetUser.role}")`)
      // Forzar el rol exactamente como viene (sin transformaciones)
      updateData.role = String(updateData.role).toLowerCase().trim()
    }
    
    // Guardar directamente en la base de datos
    const user = await User.findByIdAndUpdate(
      id, 
      { $set: updateData }, 
      { new: true, runValidators: true }
    ).select('-password')
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' })
    }
    
    // Verificar que el rol se guardó correctamente haciendo una nueva consulta
    const verifyUser = await User.findById(id).select('role username permissions')
    if (!verifyUser) {
      console.error(`❌ ERROR: User ${id} not found after update!`)
    } else {
      console.log(`✅ User updated: ${verifyUser.username} by ${currentUser?.username || 'unknown'}`)
      console.log(`   Previous role: "${targetUser.role}"`)
      console.log(`   Requested role: "${updateData.role || 'no change'}"`)
      console.log(`   Saved role (from update): "${user.role}"`)
      console.log(`   Verified role (from DB): "${verifyUser.role}"`)
      console.log(`   User ID: ${verifyUser._id}, Username: ${verifyUser.username}`)
      console.log(`   Permissions: ${JSON.stringify(verifyUser.permissions)}`)
      
      // Si el rol no coincide, hay un problema
      if (updateData.role && verifyUser.role !== updateData.role) {
        console.error(`❌ ROLE MISMATCH! Expected: "${updateData.role}", Got: "${verifyUser.role}"`)
        // Intentar forzar el rol nuevamente
        await User.findByIdAndUpdate(id, { $set: { role: updateData.role } })
        const retryUser = await User.findById(id).select('role')
        console.log(`   Retry - Role after force update: "${retryUser?.role}"`)
      }
      
      // Usar el usuario verificado en la respuesta
      Object.assign(user, {
        role: verifyUser.role,
        permissions: verifyUser.permissions || user.permissions
      })
    }
    
    // Asegurar que el rol devuelto sea el correcto
    const responseUser = {
      ...user.toObject(),
      role: user.role,
      permissions: user.permissions || []
    }
    
    res.json(responseUser)
  } catch (err) {
    console.error('Update user error:', err.message)
    res.status(500).json({ message: 'Server error' })
  }
})

// Eliminar usuario
app.delete('/api/users/:id', authenticateToken, async (req, res) => {
  try {
    if (!mongoConnected) {
      return res.status(503).json({ message: 'Database not available' })
    }
    
    const { id } = req.params
    const currentUser = req.user
    
    // Obtener usuario actual desde DB
    let dbCurrentUser = null
    try {
      if (currentUser && currentUser.userId) {
        dbCurrentUser = await User.findById(currentUser.userId)
      }
    } catch (err) {
      console.warn('Could not fetch current user from DB:', err.message)
    }
    
    const isSuperAdmin = dbCurrentUser?.role === 'superadmin' || currentUser?.role === 'superadmin'
    
    const user = await User.findById(id)
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' })
    }
    
    // No se puede eliminar superadmin
    if (user.role === 'superadmin') {
      return res.status(400).json({ message: 'Cannot delete superadmin user' })
    }
    
    // Solo superadmin puede eliminar admins
    if (user.role === 'admin' && !isSuperAdmin) {
      return res.status(403).json({ message: 'Only Super Admin can delete admin users' })
    }
    
    await User.findByIdAndDelete(id)
    console.log(`✅ User deleted: ${user.username} by ${currentUser?.username || 'unknown'}`)
    res.json({ message: 'User deleted' })
  } catch (err) {
    console.error('Delete user error:', err.message)
    res.status(500).json({ message: 'Server error' })
  }
})

// ═══════════════════════════════════════════════════════════════
// 🔐 MIDDLEWARE DE AUTENTICACIÓN SIMPLE
// ═══════════════════════════════════════════════════════════════

// Helper function to check if user is admin or superadmin
const isAdminOrSuperAdmin = (role) => {
  return role === 'admin' || role === 'superadmin';
};

// Helper function to check if user is superadmin
const isSuperAdmin = (role) => {
  return role === 'superadmin';
};

// Helper function to get target userId (allows superadmins to create data for other users)
const getTargetUserId = async (req, targetUserId) => {
  if (targetUserId && isSuperAdmin(req.user.role)) {
    // Verify that the target user exists
    const targetUser = await User.findById(targetUserId);
    if (!targetUser) {
      throw new Error('Target user not found');
    }
    return targetUserId;
  }
  return req.user.userId;
};

async function authenticateToken(req, res, next) {
  try {
    const authHeader = req.headers.authorization
    const token = authHeader && authHeader.split(' ')[1]
    
    if (!token) {
      // Si no hay token, usar usuario local (solo para algunas rutas públicas)
      req.user = { userId: null, username: 'guest', role: 'guest' }
      return next()
    }
    
    // PRIMERO: Intentar verificar como JWT real (tokens nuevos empiezan con 'eyJ')
    if (token.startsWith('eyJ')) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET)
        
        // Si el token es válido, buscar el usuario en MongoDB si es posible
        if (mongoConnected && decoded.userId) {
          // Si userId es un ObjectId válido, buscar en BD
          if (decoded.userId.length === 24 && /^[0-9a-fA-F]{24}$/.test(decoded.userId)) {
            try {
              const user = await User.findById(decoded.userId)
              if (user && user.isActive) {
                req.user = { 
                  userId: user._id, 
                  username: user.username, 
                  role: user.role, 
                  fullName: user.fullName,
                  email: user.email,
                  permissions: user.permissions || []
                }
                return next()
              }
            } catch (dbError) {
              // Si no se encuentra en BD, usar datos del token
            }
          }
        }
        
        // Usar datos del token JWT decodificado
        req.user = {
          userId: decoded.userId || decoded.id,
          username: decoded.username,
          role: decoded.role,
          fullName: decoded.fullName,
          email: decoded.email,
          permissions: decoded.permissions || []
        }
        return next()
      } catch (jwtError) {
        // Token JWT inválido o expirado
        console.warn('JWT verification failed:', jwtError.message)
        // Continuar con fallback para tokens antiguos
      }
    }
    
    // FALLBACK: Compatibilidad con tokens antiguos (formato: jwt_userId_timestamp)
    const parts = token.split('_')
    if (parts.length >= 2 && parts[0] === 'jwt') {
      const userId = parts[1]
      
      // Si es superadmin del fallback local, buscar el usuario real en la BD
      if (userId === 'superadmin' && mongoConnected) {
        const realUser = await User.findOne({ username: 'superadmin' })
        if (realUser) {
          req.user = { userId: realUser._id, username: realUser.username, role: realUser.role, fullName: realUser.fullName }
          return next()
        }
        // Si no existe en BD pero es superadmin del fallback, crear usuario especial
        req.user = { userId: null, username: 'superadmin', role: 'superadmin', isLocalFallback: true }
        return next()
      }
      
      // Intentar buscar en MongoDB si es un ObjectId válido
      if (mongoConnected && userId && userId.length === 24 && /^[0-9a-fA-F]{24}$/.test(userId)) {
        try {
          const user = await User.findById(userId)
          if (user && user.isActive) {
            req.user = { userId: user._id, username: user.username, role: user.role, fullName: user.fullName }
            return next()
          }
        } catch (dbError) {
          // Si no es un ObjectId válido o hay error, continuar con fallback
        }
      }
      
      // Fallback: si el userId es conocido, usar info básica
      if (userId === 'superadmin') {
        req.user = { userId: null, username: 'superadmin', role: 'superadmin', isLocalFallback: true }
      } else if (userId === 'admin') {
        req.user = { userId: null, username: 'admin', role: 'admin', isLocalFallback: true }
      } else {
        req.user = { userId: null, username: 'guest', role: 'guest' }
      }
      return next()
    }
    
    req.user = { userId: null, username: 'guest', role: 'guest' }
    next()
  } catch (err) {
    console.error('Auth error:', err.message)
    req.user = { userId: null, username: 'guest', role: 'guest' }
    next()
  }
}

// ═══════════════════════════════════════════════════════════════
// ✅ TASKS
// ═══════════════════════════════════════════════════════════════

// POST /api/tasks/initialize - Initialize all tasks for a room (creates pending tasks from config)
// This allows superadmins to see all tasks for rooms created by other users
app.post('/api/tasks/initialize', authenticateToken, async (req, res) => {
  try {
    const { week, room, roomKey } = req.body
    
    if (!week || !room) {
      return res.status(400).json({ message: 'Week and room are required' })
    }
    
    if (!mongoConnected) {
      return res.status(503).json({ message: 'Database not connected' })
    }
    
    console.log(`[POST /api/tasks/initialize] User: ${req.user.username}, Role: ${req.user.role}, Week: ${week}, Room: ${room}`)
    
    // Get user config for sections
    let userConfig = null
    try {
      // First try to find config for the current user
      userConfig = await TaskConfig.findOne({ userId: req.user.userId })
      
      // If not found and user is admin/superadmin, try to find ANY config
      if (!userConfig && isAdminOrSuperAdmin(req.user.role)) {
        userConfig = await TaskConfig.findOne({})
        console.log(`[POST /api/tasks/initialize] Using fallback config from another user`)
      }
    } catch (err) {
      console.error('[POST /api/tasks/initialize] Error getting config:', err.message)
    }
    
    if (!userConfig || !userConfig.sections || !Array.isArray(userConfig.sections)) {
      return res.status(404).json({ message: 'No task configuration found' })
    }
    
    const normalizedRoom = room.trim()
    const normalizedRoomKey = roomKey?.trim().toLowerCase().replace(/\s+/g, '-') || normalizedRoom.toLowerCase().replace(/\s+/g, '-')
    
    console.log(`[POST /api/tasks/initialize] Config has ${userConfig.sections.length} sections`)
    
    // Collect all task names from all sections
    const allTaskNames = []
    userConfig.sections.forEach(section => {
      if (section.tasks && Array.isArray(section.tasks)) {
        section.tasks.forEach(taskName => {
          if (!allTaskNames.includes(taskName)) {
            allTaskNames.push(taskName)
          }
        })
      }
    })
    
    console.log(`[POST /api/tasks/initialize] Total unique tasks to initialize: ${allTaskNames.length}`)
    
    // Check which tasks already exist for this room/week
    const existingTasks = await Task.find({
      week,
      $or: [
        { room: normalizedRoom },
        { room: normalizedRoom.toLowerCase() },
        { roomKey: normalizedRoomKey }
      ]
    })
    
    console.log(`[POST /api/tasks/initialize] Existing tasks for this room/week: ${existingTasks.length}`)
    
    // Create a set of existing task keys for fast lookup
    const existingTaskKeys = new Set(
      existingTasks.map(t => `${t.taskName}-${t.day}`)
    )
    
    // Create tasks that don't exist (for all 5 days)
    const tasksToCreate = []
    const days = [1, 2, 3, 4, 5] // Monday to Friday
    
    for (const taskName of allTaskNames) {
      for (const day of days) {
        const taskKey = `${taskName}-${day}`
        if (!existingTaskKeys.has(taskKey)) {
          tasksToCreate.push({
            week,
            day,
            taskName,
            completed: false,
            room: normalizedRoom,
            roomKey: normalizedRoomKey,
            userId: req.user.userId, // Tasks created by current user
            createdAt: new Date(),
            updatedAt: new Date()
          })
        }
      }
    }
    
    console.log(`[POST /api/tasks/initialize] Tasks to create: ${tasksToCreate.length}`)
    
    if (tasksToCreate.length > 0) {
      // Insert all new tasks
      await Task.insertMany(tasksToCreate, { ordered: false }).catch(err => {
        // Ignore duplicate key errors
        if (err.code !== 11000) {
          console.error('[POST /api/tasks/initialize] Error inserting tasks:', err.message)
        }
      })
    }
    
    // Return all tasks for this room/week
    const allTasks = await Task.find({
      week,
      $or: [
        { room: normalizedRoom },
        { room: normalizedRoom.toLowerCase() },
        { roomKey: normalizedRoomKey }
      ]
    }).sort({ day: 1, taskName: 1 })
    
    console.log(`[POST /api/tasks/initialize] ✅ Total tasks after initialization: ${allTasks.length}`)
    
    res.json({
      message: `Initialized ${tasksToCreate.length} new tasks`,
      totalTasks: allTasks.length,
      tasks: allTasks
    })
    
  } catch (err) {
    console.error('[POST /api/tasks/initialize] Error:', err.message)
    res.status(500).json({ message: 'Error initializing tasks', error: err.message })
  }
})

// GET /api/tasks?week=X&room=Y&roomKey=Z
app.get('/api/tasks', authenticateToken, async (req, res) => {
  try {
    const week = parseInt(req.query.week)
    const room = req.query.room
    const roomKey = req.query.roomKey
    
    if (!week || week < 1 || week > 52) {
      return res.status(400).json({ message: 'Invalid week number (1-52)' })
    }
    
    if (!mongoConnected) {
      return res.json([])
    }
    
    // IMPORTANTE: Admins y superadmins pueden ver TODAS las tareas
    // Cuando se filtra por una room específica, mostrar TODAS las tareas de esa room (sin importar userId)
    // Solo filtrar por userId cuando NO se está filtrando por una room específica (General o sin room)
    const query = { week }
    
    console.log(`[GET /api/tasks] User: ${req.user.username}, Role: ${req.user.role}, Week: ${week}, IsAdmin: ${isAdminOrSuperAdmin(req.user.role)}`)
    
    // Filter by room or roomKey - prioritize roomKey for better accuracy
    // SKIP room filter for "general" to show ALL tasks
    const isGeneral = (!roomKey || roomKey.trim().toLowerCase() === 'general') && (!room || room.trim().toLowerCase() === 'general')
    
    console.log(`[GET /api/tasks] Room filter params:`, { room, roomKey, isGeneral })
    
    // Si NO es admin/superadmin Y NO se está filtrando por una room específica, filtrar por userId
    // Si se está filtrando por una room específica, NO filtrar por userId (mostrar todas las tareas de esa room)
    if (!isAdminOrSuperAdmin(req.user.role) && isGeneral) {
      query.userId = req.user.userId
      console.log(`[GET /api/tasks] Filtering by userId: ${req.user.userId} (General view, not admin)`)
    } else if (!isAdminOrSuperAdmin(req.user.role) && !isGeneral) {
      console.log(`[GET /api/tasks] NOT filtering by userId (specific room requested, showing all tasks for that room)`)
    }
    
    if (!isGeneral) {
      // Build search conditions - search by both room and roomKey to catch all variations
      const roomConditions = []
      
      // Get the search value (prefer roomKey, fallback to room)
      const searchValue = (roomKey && roomKey.trim() !== '') ? roomKey.trim() : (room && room.trim() !== '') ? room.trim() : null
      
      if (searchValue && searchValue.toLowerCase() !== 'general') {
        const normalizedSearch = searchValue.toLowerCase().trim()
        const normalizedSearchKey = normalizedSearch.replace(/\s+/g, '-')
        
        // Search by exact room match (case sensitive)
        roomConditions.push({ room: searchValue.trim() })
        // Search by room as string (exact match)
        roomConditions.push({ room: String(searchValue.trim()) })
        // Search by roomKey (normalized)
        roomConditions.push({ roomKey: normalizedSearchKey })
        // Search by roomKey (exact as provided)
        if (roomKey && roomKey.trim() !== '') {
          roomConditions.push({ roomKey: roomKey.trim() })
          roomConditions.push({ roomKey: roomKey.trim().toLowerCase() })
        }
        // Search by room (normalized lowercase)
        roomConditions.push({ room: normalizedSearch })
        // Also search by roomKey as room (in case roomKey value is stored as room)
        roomConditions.push({ room: normalizedSearchKey })
        // Search by room as number if it's a numeric string like "121", "205", "206"
        if (/^\d+$/.test(searchValue.trim())) {
          const numericValue = searchValue.trim()
          roomConditions.push({ room: numericValue })
          roomConditions.push({ roomKey: numericValue })
          roomConditions.push({ roomKey: numericValue.toLowerCase() })
        }
      }
      
      // If we have room conditions, use $or to search by any of them
      if (roomConditions.length > 0) {
        // Remove duplicates
        const uniqueConditions = roomConditions.filter((condition, index, self) => 
          index === self.findIndex(c => JSON.stringify(c) === JSON.stringify(condition))
        )
        query.$or = uniqueConditions
        console.log(`[GET /api/tasks] Filtering by room/roomKey with $or (${uniqueConditions.length} conditions):`, JSON.stringify(uniqueConditions, null, 2))
      } else {
        console.log(`[GET /api/tasks] WARNING: No room conditions built, searchValue was:`, searchValue)
      }
    } else {
      console.log(`[GET /api/tasks] General view - showing all tasks for admin/superadmin`)
      // For General view with admin/superadmin, show ALL tasks from ALL users
      if (isAdminOrSuperAdmin(req.user.role)) {
        // Remove any userId filter if present (shouldn't be, but just in case)
        delete query.userId
        console.log(`[GET /api/tasks] Admin/SuperAdmin General view - no userId filter`)
      }
    }
    
    const tasks = await Task.find(query).sort({ userId: 1, room: 1, day: 1, taskName: 1 })
    console.log(`[GET /api/tasks] Found ${tasks.length} tasks for query:`, JSON.stringify(query, null, 2))
    
    if (tasks.length > 0) {
      console.log(`[GET /api/tasks] Sample tasks (first 5):`, JSON.stringify(tasks.slice(0, 5).map(t => ({
        _id: t._id,
        taskName: t.taskName,
        day: t.day,
        week: t.week,
        room: t.room,
        roomKey: t.roomKey,
        completed: t.completed,
        completedType: typeof t.completed,
        userId: t.userId?.toString()
      })), null, 2))
    } else if (!isGeneral && isAdminOrSuperAdmin(req.user.role)) {
      // AUTO-INITIALIZE: If admin/superadmin requests a specific room with no tasks, initialize them
      console.log(`[GET /api/tasks] Admin/SuperAdmin requested room with no tasks - auto-initializing...`)
      
      const searchValue = (roomKey && roomKey.trim() !== '') ? roomKey.trim() : (room && room.trim() !== '') ? room.trim() : null
      if (searchValue && searchValue.toLowerCase() !== 'general') {
        const normalizedRoom = searchValue.trim()
        const normalizedRoomKey = searchValue.toLowerCase().trim().replace(/\s+/g, '-')
        
        // Get user config for sections
        let userConfig = null
        try {
          userConfig = await TaskConfig.findOne({ userId: req.user.userId })
          if (!userConfig) {
            userConfig = await TaskConfig.findOne({}) // Fallback to any config
          }
        } catch (err) {
          console.error('[GET /api/tasks] Error getting config for auto-init:', err.message)
        }
        
        if (userConfig && userConfig.sections && Array.isArray(userConfig.sections)) {
          // Collect all task names from all sections
          const allTaskNames = []
          userConfig.sections.forEach(section => {
            if (section.tasks && Array.isArray(section.tasks)) {
              section.tasks.forEach(taskName => {
                if (!allTaskNames.includes(taskName)) {
                  allTaskNames.push(taskName)
                }
              })
            }
          })
          
          console.log(`[GET /api/tasks] Auto-init: Creating ${allTaskNames.length} tasks x 5 days = ${allTaskNames.length * 5} tasks`)
          
          // Create tasks for all 5 days
          const tasksToCreate = []
          const days = [1, 2, 3, 4, 5]
          
          for (const taskName of allTaskNames) {
            for (const day of days) {
              tasksToCreate.push({
                week,
                day,
                taskName,
                completed: false,
                room: normalizedRoom,
                roomKey: normalizedRoomKey,
                userId: req.user.userId,
                createdAt: new Date(),
                updatedAt: new Date()
              })
            }
          }
          
          if (tasksToCreate.length > 0) {
            try {
              await Task.insertMany(tasksToCreate, { ordered: false })
              console.log(`[GET /api/tasks] ✅ Auto-initialized ${tasksToCreate.length} tasks for room ${normalizedRoom}`)
              
              // Re-fetch the tasks
              const initializedTasks = await Task.find(query).sort({ userId: 1, room: 1, day: 1, taskName: 1 })
              console.log(`[GET /api/tasks] Returning ${initializedTasks.length} auto-initialized tasks`)
              return res.json(initializedTasks)
            } catch (insertErr) {
              if (insertErr.code !== 11000) {
                console.error('[GET /api/tasks] Error auto-initializing tasks:', insertErr.message)
              }
            }
          }
        }
      }
    } else {
      console.log(`[GET /api/tasks] No tasks found. Query was:`, JSON.stringify(query, null, 2))
    }
    
    // Ensure all tasks have roomKey set
    const tasksWithRoomKey = tasks.map(task => {
      if (!task.roomKey && task.room) {
        task.roomKey = task.room.toLowerCase().replace(/\s+/g, '-')
      }
      return task
    })
    
    console.log(`[GET /api/tasks] Returning ${tasksWithRoomKey.length} tasks`)
    res.json(tasksWithRoomKey)
  } catch (err) {
    console.error('Get tasks error:', err.message)
    res.status(500).json({ message: 'Error loading tasks' })
  }
})

// GET /api/tasks/debug/:room - Debug endpoint to see all tasks for a room (any week)
app.get('/api/tasks/debug/:room', authenticateToken, async (req, res) => {
  try {
    if (!mongoConnected) {
      return res.json({ message: 'Database not connected', tasks: [] })
    }
    
    const roomParam = req.params.room
    const normalizedRoom = roomParam.toLowerCase().trim()
    
    // Search for ALL tasks for this room (any week, any user)
    const tasks = await Task.find({
      $or: [
        { room: roomParam },
        { room: normalizedRoom },
        { roomKey: roomParam },
        { roomKey: normalizedRoom }
      ]
    }).sort({ week: -1, day: 1 })
    
    console.log(`[DEBUG /api/tasks/debug/${roomParam}] Found ${tasks.length} tasks for room`)
    
    res.json({
      room: roomParam,
      totalTasks: tasks.length,
      tasks: tasks.map(t => ({
        _id: t._id,
        taskName: t.taskName,
        day: t.day,
        week: t.week,
        room: t.room,
        roomKey: t.roomKey,
        completed: t.completed,
        userId: t.userId?.toString(),
        createdAt: t.createdAt,
        updatedAt: t.updatedAt
      }))
    })
  } catch (err) {
    console.error('Debug tasks error:', err.message)
    res.status(500).json({ message: 'Error debugging tasks', error: err.message })
  }
})

// POST /api/tasks - Create or update task
app.post('/api/tasks', authenticateToken, async (req, res) => {
  try {
    if (!mongoConnected) {
      return res.status(503).json({ message: 'Database not available' })
    }
    
    const { week, taskName, day, completed, room, roomKey } = req.body
    
    if (!week || !taskName || !day) {
      return res.status(400).json({ message: 'Week, taskName, and day are required' })
    }
    
    if (!req.user.userId) {
      console.error('❌ Cannot save task: userId is missing', { user: req.user })
      return res.status(401).json({ message: 'User ID is required' })
    }
    
    const normalizedRoom = (room && room.trim() !== '') ? room.trim() : 'General'
    const normalizedRoomKey = (roomKey && roomKey.trim() !== '') ? roomKey.trim().toLowerCase().replace(/\s+/g, '-') : normalizedRoom.toLowerCase().replace(/\s+/g, '-')
    
    console.log(`[POST /api/tasks] Saving task:`, { week, taskName, day, completed, room: normalizedRoom, roomKey: normalizedRoomKey, userId: req.user.userId })
    
    // Buscar tarea existente en la misma room (puede ser de cualquier usuario)
    // Buscar por múltiples variaciones para encontrar la tarea
    const searchQuery = {
      week,
      taskName,
      day,
      $or: [
        { room: normalizedRoom },
        { roomKey: normalizedRoomKey },
        { room: normalizedRoom.toLowerCase() },
        { roomKey: normalizedRoom.toLowerCase() },
        // Si room es numérico como "121", también buscar como string numérico
        ...(/^\d+$/.test(normalizedRoom) ? [
          { room: normalizedRoom },
          { roomKey: normalizedRoom }
        ] : [])
      ]
    }
    
    console.log(`[POST /api/tasks] Search query:`, JSON.stringify(searchQuery, null, 2))
    const existingTask = await Task.findOne(searchQuery)
    console.log(`[POST /api/tasks] Existing task found:`, existingTask ? {
      _id: existingTask._id,
      room: existingTask.room,
      roomKey: existingTask.roomKey,
      completed: existingTask.completed,
      userId: existingTask.userId?.toString()
    } : 'None')
    
    const updateData = {
      completed: completed === true,
      roomKey: normalizedRoomKey,
      room: normalizedRoom, // Asegurar que room se guarde exactamente como se proporciona
      updatedAt: new Date(),
      completedBy: completed ? req.user.userId : null,
      completedByName: completed ? (req.user.fullName || req.user.username) : null,
      completedByRole: completed ? req.user.role : null,
      completedAt: completed ? new Date() : null
    }
    
    let task
    if (existingTask) {
      // Actualizar tarea existente (puede ser de otro usuario)
      console.log(`[POST /api/tasks] Updating existing task:`, existingTask._id)
      Object.assign(existingTask, updateData)
      // Asegurar que room y roomKey se guarden correctamente
      existingTask.room = normalizedRoom
      existingTask.roomKey = normalizedRoomKey
      await existingTask.save()
      task = existingTask
      console.log(`[POST /api/tasks] Task updated:`, {
        _id: task._id,
        room: task.room,
        roomKey: task.roomKey,
        completed: task.completed
      })
    } else {
      // Crear nueva tarea con userId del usuario actual
      console.log(`[POST /api/tasks] Creating new task`)
      task = await Task.create({
        userId: req.user.userId,
        week,
        taskName,
        day,
        room: normalizedRoom, // Guardar room exactamente como se proporciona
        roomKey: normalizedRoomKey, // Guardar roomKey normalizado
        completed: completed === true,
        createdAt: new Date(),
        updatedAt: new Date(),
        completedBy: completed ? req.user.userId : null,
        completedByName: completed ? (req.user.fullName || req.user.username) : null,
        completedByRole: completed ? req.user.role : null,
        completedAt: completed ? new Date() : null
      })
      console.log(`[POST /api/tasks] Task created:`, {
        _id: task._id,
        room: task.room,
        roomKey: task.roomKey,
        completed: task.completed
      })
    }
    
    console.log(`✅ Task saved (upsert): ${taskName} - Week ${week} - Day ${day} - Room ${normalizedRoom} (${normalizedRoomKey}) - Completed: ${task.completed} - UserId: ${req.user.userId}`)
    
    res.json({ message: 'Task saved successfully', task })
  } catch (err) {
    console.error('[POST /api/tasks] Save task error:', err.message)
    console.error('[POST /api/tasks] Error stack:', err.stack)
    res.status(500).json({ message: 'Error saving task' })
  }
})

// PUT /api/tasks - Same as POST
app.put('/api/tasks', authenticateToken, async (req, res) => {
  try {
    if (!mongoConnected) {
      return res.status(503).json({ message: 'Database not available' })
    }
    
    const { week, taskName, day, completed, room, roomKey } = req.body
    
    if (!week || !taskName || !day) {
      return res.status(400).json({ message: 'Week, taskName, and day are required' })
    }
    
    if (!req.user.userId) {
      console.error('❌ Cannot update task: userId is missing', { user: req.user })
      return res.status(401).json({ message: 'User ID is required' })
    }
    
    const normalizedRoom = (room && room.trim() !== '') ? room.trim() : 'General'
    const normalizedRoomKey = (roomKey && roomKey.trim() !== '') ? roomKey.trim().toLowerCase().replace(/\s+/g, '-') : normalizedRoom.toLowerCase().replace(/\s+/g, '-')
    
    console.log(`[PUT /api/tasks] Updating task:`, { week, taskName, day, completed, room: normalizedRoom, roomKey: normalizedRoomKey, userId: req.user.userId })
    
    // Buscar tarea existente en la misma room (puede ser de cualquier usuario)
    // Buscar por múltiples variaciones para encontrar la tarea
    const searchQuery = {
      week,
      taskName,
      day,
      $or: [
        { room: normalizedRoom },
        { roomKey: normalizedRoomKey },
        { room: normalizedRoom.toLowerCase() },
        { roomKey: normalizedRoom.toLowerCase() },
        // Si room es numérico como "121", también buscar como string numérico
        ...(/^\d+$/.test(normalizedRoom) ? [
          { room: normalizedRoom },
          { roomKey: normalizedRoom }
        ] : [])
      ]
    }
    
    console.log(`[PUT /api/tasks] Search query:`, JSON.stringify(searchQuery, null, 2))
    const existingTask = await Task.findOne(searchQuery)
    console.log(`[PUT /api/tasks] Existing task found:`, existingTask ? {
      _id: existingTask._id,
      room: existingTask.room,
      roomKey: existingTask.roomKey,
      completed: existingTask.completed,
      userId: existingTask.userId?.toString()
    } : 'None')
    
    const updateData = {
      completed: completed === true,
      roomKey: normalizedRoomKey,
      room: normalizedRoom, // Asegurar que room se guarde exactamente como se proporciona
      updatedAt: new Date(),
      completedBy: completed ? req.user.userId : null,
      completedByName: completed ? (req.user.fullName || req.user.username) : null,
      completedByRole: completed ? req.user.role : null,
      completedAt: completed ? new Date() : null
    }
    
    let task
    if (existingTask) {
      // Actualizar tarea existente (puede ser de otro usuario)
      console.log(`[PUT /api/tasks] Updating existing task:`, existingTask._id)
      Object.assign(existingTask, updateData)
      // Asegurar que room y roomKey se guarden correctamente
      existingTask.room = normalizedRoom
      existingTask.roomKey = normalizedRoomKey
      await existingTask.save()
      task = existingTask
      console.log(`[PUT /api/tasks] Task updated:`, {
        _id: task._id,
        room: task.room,
        roomKey: task.roomKey,
        completed: task.completed
      })
    } else {
      // Crear nueva tarea con userId del usuario actual
      console.log(`[PUT /api/tasks] Creating new task`)
      task = await Task.create({
        userId: req.user.userId,
        week,
        taskName,
        day,
        room: normalizedRoom, // Guardar room exactamente como se proporciona
        roomKey: normalizedRoomKey, // Guardar roomKey normalizado
        completed: completed === true,
        createdAt: new Date(),
        updatedAt: new Date(),
        completedBy: completed ? req.user.userId : null,
        completedByName: completed ? (req.user.fullName || req.user.username) : null,
        completedByRole: completed ? req.user.role : null,
        completedAt: completed ? new Date() : null
      })
      console.log(`[PUT /api/tasks] Task created:`, {
        _id: task._id,
        room: task.room,
        roomKey: task.roomKey,
        completed: task.completed
      })
    }
    
    console.log(`✅ Task updated (upsert): ${taskName} - Week ${week} - Day ${day} - Room ${normalizedRoom} (${normalizedRoomKey}) - Completed: ${task.completed}`)
    
    res.json({ message: 'Task saved successfully', task })
  } catch (err) {
    console.error('[PUT /api/tasks] Update task error:', err.message)
    console.error('[PUT /api/tasks] Error stack:', err.stack)
    res.status(500).json({ message: 'Error updating task' })
  }
})

// ═══════════════════════════════════════════════════════════════
// 🏠 ROOMS
// ═══════════════════════════════════════════════════════════════

// GET /api/rooms - Get all rooms for user
app.get('/api/rooms', authenticateToken, async (req, res) => {
  try {
    console.log(`[GET /api/rooms] User: ${req.user.username}, Role: ${req.user.role}, IsAdmin: ${isAdminOrSuperAdmin(req.user.role)}`)
    
    if (!mongoConnected) {
      return res.json([{ label: 'General', key: 'general', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }])
    }
    
    // Primero obtener rooms guardadas en la colección Room
    // Admins y superadmins pueden ver todas las rooms, employees solo las suyas
    let savedRooms = []
    try {
      const roomQuery = {}
      if (!isAdminOrSuperAdmin(req.user.role)) {
        roomQuery.userId = req.user.userId
      }
      console.log(`[GET /api/rooms] Room query:`, JSON.stringify(roomQuery))
      savedRooms = await Room.find(roomQuery).sort({ label: 1 })
      console.log(`[GET /api/rooms] Found ${savedRooms.length} saved rooms`)
    } catch (err) {
      console.warn('Error getting saved rooms, continuing with fallback:', err.message)
    }
    
    // Si hay rooms guardadas, devolverlas
    if (savedRooms.length > 0) {
      const result = savedRooms.map(room => ({
        key: room.key,
        label: room.label,
        createdAt: room.createdAt || new Date().toISOString(),
        updatedAt: room.updatedAt || new Date().toISOString(),
      }))
      
      // Asegurar que siempre exista 'General'
      const hasGeneral = result.some(r => r.key === 'general')
      if (!hasGeneral) {
        result.unshift({
          label: 'General',
          key: 'general',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
      }
      
      return res.json(result)
    }
    
    // Fallback: obtener rooms de Tasks existentes
    // Admins y superadmins pueden ver todas las rooms, employees solo las suyas
    try {
      const taskQuery = {}
      if (!isAdminOrSuperAdmin(req.user.role)) {
        taskQuery.userId = req.user.userId
      }
      const rooms = await Task.distinct('room', taskQuery)
      const roomsWithKeys = await Task.distinct('roomKey', taskQuery)
      
      const roomMap = new Map()
      rooms.forEach((room, idx) => {
        if (room) {
          roomMap.set(room, roomsWithKeys[idx] || room.toLowerCase().replace(/\s+/g, '-'))
        }
      })
      
      const result = Array.from(roomMap.entries()).map(([label, key]) => ({
        label,
        key,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }))
      
      // Asegurar que siempre exista 'General'
      const hasGeneral = result.some(r => r.key === 'general')
      if (!hasGeneral) {
        result.unshift({
          label: 'General',
          key: 'general',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
      }
      
      if (result.length === 0) {
        return res.json([{ label: 'General', key: 'general', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }])
      }
      
      return res.json(result)
    } catch (taskErr) {
      console.warn('Error getting rooms from tasks:', taskErr.message)
      return res.json([{ label: 'General', key: 'general', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }])
    }
  } catch (err) {
    console.error('Get rooms error:', err.message)
    res.json([{ label: 'General', key: 'general', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }])
  }
})

// POST /api/rooms - Create a new room
app.post('/api/rooms', authenticateToken, async (req, res) => {
  try {
    if (!mongoConnected) {
      return res.status(503).json({ message: 'Database not available' })
    }
    
    const { label } = req.body || {}
    
    if (!label || !label.trim()) {
      return res.status(400).json({ message: 'Room label is required' })
    }
    
    const trimmedLabel = label.trim()
    const roomKey = trimmedLabel.toLowerCase().replace(/\s+/g, '-')
    
    try {
      // Verificar si ya existe
      const existing = await Room.findOne({ key: roomKey, userId: req.user.userId })
      if (existing) {
        console.log(`Room already exists: ${roomKey}`)
        return res.json({
          key: existing.key,
          label: existing.label,
          createdAt: existing.createdAt || new Date().toISOString(),
          updatedAt: existing.updatedAt || new Date().toISOString(),
        })
      }
      
      // Crear nueva room
      const newRoom = await Room.create({
        label: trimmedLabel,
        key: roomKey,
        userId: req.user.userId,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      
      console.log(`✅ Room created: ${roomKey} (${trimmedLabel})`)
      
      res.status(201).json({
        key: newRoom.key,
        label: newRoom.label,
        createdAt: newRoom.createdAt || new Date().toISOString(),
        updatedAt: newRoom.updatedAt || new Date().toISOString(),
      })
    } catch (dbError) {
      if (dbError.code === 11000 || dbError.message.includes('duplicate')) {
        // Ya existe, devolverla
        const existing = await Room.findOne({ key: roomKey, userId: req.user.userId })
        if (existing) {
          return res.json({
            key: existing.key,
            label: existing.label,
            createdAt: existing.createdAt || new Date().toISOString(),
            updatedAt: existing.updatedAt || new Date().toISOString(),
          })
        }
      }
      
      if (dbError.message.includes('not allowed') || dbError.message.includes('permission')) {
        return res.status(503).json({ 
          message: 'MongoDB permission denied. Please grant Read/Write permissions.' 
        })
      }
      
      throw dbError
    }
  } catch (err) {
    console.error('Create room error:', err.message)
    res.status(500).json({ message: 'Error creating room' })
  }
})

// ═══════════════════════════════════════════════════════════════
// ⏰ TIME RECORDS
// ═══════════════════════════════════════════════════════════════

// GET /api/time-records?week=X&room=Y&roomKey=Z
app.get('/api/time-records', authenticateToken, async (req, res) => {
  try {
    const week = parseInt(req.query.week)
    const room = req.query.room
    const roomKey = req.query.roomKey
    
    console.log(`[GET /api/time-records] User: ${req.user.username}, Role: ${req.user.role}, Week: ${week}, IsAdmin: ${isAdminOrSuperAdmin(req.user.role)}`)
    
    if (!week || week < 1 || week > 52) {
      return res.status(400).json({ message: 'Invalid week number' })
    }
    
    if (!mongoConnected) {
      return res.json([])
    }
    
    const query = { week }
    
    // Admins y superadmins pueden ver todos los registros, employees solo los suyos
    if (!isAdminOrSuperAdmin(req.user.role)) {
      query.userId = req.user.userId
    }
    
    // Filter by roomKey (more accurate) or room (fallback)
    if (roomKey && roomKey.trim() !== '' && roomKey.trim().toLowerCase() !== 'general') {
      query.roomKey = roomKey.trim().toLowerCase()
    } else if (room && room.trim() !== '' && room.trim().toLowerCase() !== 'general') {
      const normalizedRoom = room.trim()
      const normalizedRoomKey = normalizedRoom.toLowerCase().replace(/\s+/g, '-')
      query.$or = [
        { room: normalizedRoom },
        { roomKey: normalizedRoomKey }
      ]
    }
    
    console.log(`[GET /api/time-records] Query:`, JSON.stringify(query))
    // Si no hay room/roomKey o es 'General', retornar todos los registros
    
    const records = await TimeRecord.find(query).sort({ userId: 1, day: 1, room: 1 })
    
    // Ensure all records have roomKey set
    const recordsWithRoomKey = records.map(record => {
      if (!record.roomKey && record.room) {
        record.roomKey = record.room.toLowerCase().replace(/\s+/g, '-')
      }
      return record
    })
    
    res.json(recordsWithRoomKey)
  } catch (err) {
    console.error('Get time records error:', err.message)
    res.status(500).json({ message: 'Error loading time records' })
  }
})

// POST /api/time-records - Create or update time record
app.post('/api/time-records', authenticateToken, async (req, res) => {
  try {
    if (!mongoConnected) {
      return res.status(503).json({ message: 'Database not available' })
    }
    
    const { week, day, checkIn, checkOut, signature, room, roomKey, employeeName } = req.body
    
    if (!week || !day) {
      return res.status(400).json({ message: 'Week and day are required' })
    }
    
    const normalizedRoom = (room && room.trim() !== '') ? room.trim() : 'General'
    const normalizedRoomKey = (roomKey && roomKey.trim() !== '') ? roomKey.trim().toLowerCase().replace(/\s+/g, '-') : normalizedRoom.toLowerCase().replace(/\s+/g, '-')
    
    // Buscar record por roomKey (más preciso) o por room (fallback)
    // Superadmins pueden editar registros de cualquier usuario, otros solo los suyos
    const recordQuery = {
      week,
      day,
      $or: [
        { roomKey: normalizedRoomKey },
        { room: normalizedRoom }
      ]
    }
    if (!isAdminOrSuperAdmin(req.user.role)) {
      recordQuery.userId = req.user.userId
    }
    let record = await TimeRecord.findOne(recordQuery)
    
    if (record) {
      if (checkIn) record.checkIn = checkIn
      if (checkOut) record.checkOut = checkOut
      if (signature) record.signature = signature
      if (employeeName) record.employeeName = employeeName
      record.room = normalizedRoom
      record.roomKey = normalizedRoomKey
      record.updatedAt = new Date()
      await record.save()
    } else {
      record = await TimeRecord.create({
        userId: req.user.userId,
        week,
        day,
        checkIn,
        checkOut,
        signature,
        room: normalizedRoom,
        roomKey: normalizedRoomKey,
        employeeName: employeeName || req.user.fullName || req.user.username
      })
    }
    
    console.log(`✅ Time record saved: Week ${week} - Day ${day} - Room ${normalizedRoom} (${normalizedRoomKey})`)
    res.json({ message: 'Time record saved successfully', record })
  } catch (err) {
    console.error('Save time record error:', err.message)
    res.status(500).json({ message: 'Error saving time record' })
  }
})

// PUT /api/time-records - Same as POST
app.put('/api/time-records', authenticateToken, async (req, res) => {
  try {
    if (!mongoConnected) {
      return res.status(503).json({ message: 'Database not available' })
    }
    
    const { week, day, checkIn, checkOut, signature, observations, room, roomKey, employeeName } = req.body
    
    if (!week || !day) {
      return res.status(400).json({ message: 'Week and day are required' })
    }
    
    const normalizedRoom = (room && room.trim() !== '') ? room.trim() : 'General'
    const normalizedRoomKey = (roomKey && roomKey.trim() !== '') ? roomKey.trim().toLowerCase().replace(/\s+/g, '-') : normalizedRoom.toLowerCase().replace(/\s+/g, '-')
    
    // Buscar record por roomKey (más preciso) o por room (fallback)
    // Superadmins pueden editar registros de cualquier usuario, otros solo los suyos
    const recordQuery = {
      week,
      day,
      $or: [
        { roomKey: normalizedRoomKey },
        { room: normalizedRoom }
      ]
    }
    if (!isAdminOrSuperAdmin(req.user.role)) {
      recordQuery.userId = req.user.userId
    }
    let record = await TimeRecord.findOne(recordQuery)
    
    if (record) {
      if (checkIn) record.checkIn = checkIn
      if (checkOut) record.checkOut = checkOut
      if (signature) record.signature = signature
      if (observations !== undefined) record.observations = observations // Guardar observaciones
      if (employeeName) record.employeeName = employeeName
      record.room = normalizedRoom
      record.roomKey = normalizedRoomKey
      record.updatedAt = new Date()
      await record.save()
    } else {
      record = await TimeRecord.create({
        userId: req.user.userId,
        week,
        day,
        checkIn,
        checkOut,
        signature,
        observations, // Incluir observaciones en nuevo registro
        room: normalizedRoom,
        roomKey: normalizedRoomKey,
        employeeName: employeeName || req.user.fullName || req.user.username
      })
    }
    
    res.json({ message: 'Time record saved successfully', record })
  } catch (err) {
    console.error('Update time record error:', err.message)
    res.status(500).json({ message: 'Error updating time record' })
  }
})

// ═══════════════════════════════════════════════════════════════
// 📝 NOTES
// ═══════════════════════════════════════════════════════════════

app.get('/api/notes', authenticateToken, async (req, res) => {
  try {
    console.log(`[GET /api/notes] User: ${req.user.username}, Role: ${req.user.role}, IsAdmin: ${isAdminOrSuperAdmin(req.user.role)}`)
    
    if (!mongoConnected) {
      return res.json([])
    }
    const limit = parseInt(req.query.limit) || 100
    const query = {}
    
    // Admins y superadmins pueden ver todas las notes, employees solo las suyas
    if (!isAdminOrSuperAdmin(req.user.role)) {
      query.userId = req.user.userId
    }
    
    const notes = await Note.find(query)
      .sort({ userId: 1, createdAt: -1 })
      .limit(limit)
    
    console.log(`[GET /api/notes] Found ${notes.length} notes`)
    res.json(notes)
  } catch (err) {
    console.error('Get notes error:', err.message)
    res.status(500).json({ message: 'Error loading notes' })
  }
})

app.post('/api/notes', authenticateToken, async (req, res) => {
  try {
    console.log(`[POST /api/notes] User: ${req.user.username}, Creating note:`, req.body.title)
    
    if (!mongoConnected) {
      return res.status(503).json({ message: 'Database not available' })
    }
    
    const { title, content, week } = req.body
    
    if (!title || !content) {
      return res.status(400).json({ message: 'Title and content are required' })
    }
    
    const note = await Note.create({
      userId: req.user.userId,
      title: title.trim(),
      content: content.trim(),
      week: week || null
    })
    
    console.log(`[POST /api/notes] ✅ Note created with ID: ${note._id}`)
    res.status(201).json(note)
  } catch (err) {
    console.error('Create note error:', err.message)
    res.status(500).json({ message: 'Error creating note' })
  }
})

app.put('/api/notes/:id', authenticateToken, async (req, res) => {
  try {
    if (!mongoConnected) {
      return res.status(503).json({ message: 'Database not available' })
    }
    
    const { id } = req.params
    const { title, content, week } = req.body
    
    const query = { _id: id }
    if (!isAdminOrSuperAdmin(req.user.role)) {
      query.userId = req.user.userId
    }
    
    const note = await Note.findOne(query)
    if (!note) {
      return res.status(404).json({ message: 'Note not found' })
    }
    
    if (title !== undefined) note.title = title.trim()
    if (content !== undefined) note.content = content.trim()
    if (week !== undefined) note.week = week
    note.updatedAt = new Date()
    await note.save()
    
    res.json(note)
  } catch (err) {
    console.error('Update note error:', err.message)
    res.status(500).json({ message: 'Error updating note' })
  }
})

app.delete('/api/notes/:id', authenticateToken, async (req, res) => {
  try {
    if (!mongoConnected) {
      return res.status(503).json({ message: 'Database not available' })
    }
    
    const { id } = req.params
    const query = { _id: id }
    if (!isAdminOrSuperAdmin(req.user.role)) {
      query.userId = req.user.userId
    }
    
    const note = await Note.findOneAndDelete(query)
    if (!note) {
      return res.status(404).json({ message: 'Note not found' })
    }
    
    res.json({ message: 'Note deleted successfully' })
  } catch (err) {
    console.error('Delete note error:', err.message)
    res.status(500).json({ message: 'Error deleting note' })
  }
})

// ═══════════════════════════════════════════════════════════════
// 🔔 REMINDERS
// ═══════════════════════════════════════════════════════════════

app.get('/api/reminders', authenticateToken, async (req, res) => {
  try {
    console.log(`[GET /api/reminders] User: ${req.user.username}, Role: ${req.user.role}, IsAdmin: ${isAdminOrSuperAdmin(req.user.role)}`)
    
    if (!mongoConnected) {
      return res.json([])
    }
    const { completed } = req.query
    const query = {}
    
    // Admins y superadmins pueden ver todos los reminders, employees solo los suyos
    if (!isAdminOrSuperAdmin(req.user.role)) {
      query.userId = req.user.userId
    }
    
    if (completed !== undefined) {
      query.completed = completed === 'true'
    }
    
    const reminders = await Reminder.find(query)
      .sort({ userId: 1, dueDate: 1 })
    
    console.log(`[GET /api/reminders] Found ${reminders.length} reminders`)
    res.json(reminders)
  } catch (err) {
    console.error('Get reminders error:', err.message)
    res.status(500).json({ message: 'Error loading reminders' })
  }
})

app.post('/api/reminders', authenticateToken, async (req, res) => {
  try {
    console.log(`[POST /api/reminders] User: ${req.user.username}, Creating reminder:`, req.body.title)
    
    if (!mongoConnected) {
      return res.status(503).json({ message: 'Database not available' })
    }
    
    const { title, description, dueDate, priority } = req.body
    
    if (!title || !dueDate) {
      return res.status(400).json({ message: 'Title and dueDate are required' })
    }
    
    const reminder = await Reminder.create({
      userId: req.user.userId,
      title: title.trim(),
      description: description?.trim() || '',
      dueDate: new Date(dueDate),
      priority: priority || 'medium'
    })
    
    console.log(`[POST /api/reminders] ✅ Reminder created with ID: ${reminder._id}`)
    res.status(201).json(reminder)
  } catch (err) {
    console.error('Create reminder error:', err.message)
    res.status(500).json({ message: 'Error creating reminder' })
  }
})

app.put('/api/reminders/:id', authenticateToken, async (req, res) => {
  try {
    if (!mongoConnected) {
      return res.status(503).json({ message: 'Database not available' })
    }
    
    const { id } = req.params
    const { completed, title, description, dueDate, priority } = req.body
    
    const query = { _id: id }
    if (!isAdminOrSuperAdmin(req.user.role)) {
      query.userId = req.user.userId
    }
    
    const reminder = await Reminder.findOne(query)
    if (!reminder) {
      return res.status(404).json({ message: 'Reminder not found' })
    }
    
    if (completed !== undefined) {
      reminder.completed = completed
      reminder.completedAt = completed ? new Date() : null
    }
    if (title !== undefined) reminder.title = title.trim()
    if (description !== undefined) reminder.description = description?.trim() || ''
    if (dueDate !== undefined) reminder.dueDate = new Date(dueDate)
    if (priority !== undefined) reminder.priority = priority
    
    await reminder.save()
    
    res.json(reminder)
  } catch (err) {
    console.error('Update reminder error:', err.message)
    res.status(500).json({ message: 'Error updating reminder' })
  }
})

app.delete('/api/reminders/:id', authenticateToken, async (req, res) => {
  try {
    if (!mongoConnected) {
      return res.status(503).json({ message: 'Database not available' })
    }
    
    const { id } = req.params
    const query = { _id: id }
    if (!isAdminOrSuperAdmin(req.user.role)) {
      query.userId = req.user.userId
    }
    
    const reminder = await Reminder.findOneAndDelete(query)
    if (!reminder) {
      return res.status(404).json({ message: 'Reminder not found' })
    }
    
    res.json({ message: 'Reminder deleted successfully' })
  } catch (err) {
    console.error('Delete reminder error:', err.message)
    res.status(500).json({ message: 'Error deleting reminder' })
  }
})

// ═══════════════════════════════════════════════════════════════
// 💰 EXPENSES
// ═══════════════════════════════════════════════════════════════

app.get('/api/expenses', authenticateToken, async (req, res) => {
  try {
    console.log(`[GET /api/expenses] User: ${req.user.username}, Role: ${req.user.role}, IsAdmin: ${isAdminOrSuperAdmin(req.user.role)}`)
    
    if (!mongoConnected) {
      return res.json([])
    }
    const query = {}
    
    // Admins y superadmins pueden ver todos los expenses, employees solo los suyos
    if (!isAdminOrSuperAdmin(req.user.role)) {
      query.userId = req.user.userId
    }
    
    const expenses = await Expense.find(query)
      .sort({ userId: 1, date: -1 })
    
    console.log(`[GET /api/expenses] Found ${expenses.length} expenses`)
    res.json(expenses)
  } catch (err) {
    console.error('Get expenses error:', err.message)
    res.status(500).json({ message: 'Error loading expenses' })
  }
})

app.post('/api/expenses', authenticateToken, async (req, res) => {
  try {
    console.log(`[POST /api/expenses] User: ${req.user.username}, Creating expense:`, req.body.title)
    
    if (!mongoConnected) {
      return res.status(503).json({ message: 'Database not available' })
    }
    
    const { title, category, amount, description, date } = req.body
    
    if (!title || !category || amount === undefined || !date) {
      return res.status(400).json({ message: 'Title, category, amount, and date are required' })
    }
    
    const expense = await Expense.create({
      userId: req.user.userId,
      title: title.trim(),
      category: category.trim(),
      amount: parseFloat(amount),
      description: description?.trim() || '',
      date: new Date(date)
    })
    
    console.log(`[POST /api/expenses] ✅ Expense created with ID: ${expense._id}`)
    res.status(201).json(expense)
  } catch (err) {
    console.error('Create expense error:', err.message)
    res.status(500).json({ message: 'Error creating expense' })
  }
})

app.put('/api/expenses/:id', authenticateToken, async (req, res) => {
  try {
    if (!mongoConnected) {
      return res.status(503).json({ message: 'Database not available' })
    }
    
    const { id } = req.params
    const { title, category, amount, description, date } = req.body
    
    const query = { _id: id }
    if (!isAdminOrSuperAdmin(req.user.role)) {
      query.userId = req.user.userId
    }
    
    const expense = await Expense.findOne(query)
    if (!expense) {
      return res.status(404).json({ message: 'Expense not found' })
    }
    
    if (title !== undefined) expense.title = title.trim()
    if (category !== undefined) expense.category = category.trim()
    if (amount !== undefined) expense.amount = parseFloat(amount)
    if (description !== undefined) expense.description = description?.trim() || ''
    if (date !== undefined) expense.date = new Date(date)
    expense.updatedAt = new Date()
    await expense.save()
    
    res.json(expense)
  } catch (err) {
    console.error('Update expense error:', err.message)
    res.status(500).json({ message: 'Error updating expense' })
  }
})

app.delete('/api/expenses/:id', authenticateToken, async (req, res) => {
  try {
    if (!mongoConnected) {
      return res.status(503).json({ message: 'Database not available' })
    }
    
    const { id } = req.params
    const query = { _id: id }
    if (!isAdminOrSuperAdmin(req.user.role)) {
      query.userId = req.user.userId
    }
    
    const expense = await Expense.findOneAndDelete(query)
    if (!expense) {
      return res.status(404).json({ message: 'Expense not found' })
    }
    
    res.json({ message: 'Expense deleted successfully' })
  } catch (err) {
    console.error('Delete expense error:', err.message)
    res.status(500).json({ message: 'Error deleting expense' })
  }
})

// ═══════════════════════════════════════════════════════════════
// 📋 QUOTES (alias for budgets)
// ═══════════════════════════════════════════════════════════════

app.get('/api/quotes', authenticateToken, async (req, res) => {
  try {
    console.log(`[GET /api/quotes] User: ${req.user.username}, Role: ${req.user.role}, UserId: ${req.user.userId}, IsAdmin: ${isAdminOrSuperAdmin(req.user.role)}`)
    
    if (!mongoConnected) {
      console.log(`[GET /api/quotes] MongoDB not connected, returning empty array`)
      return res.json([])
    }
    const { status } = req.query
    const query = {}
    
    // Admins y superadmins pueden ver todos los quotes, employees solo los suyos
    if (!isAdminOrSuperAdmin(req.user.role)) {
      query.userId = req.user.userId
      console.log(`[GET /api/quotes] Filtering by userId: ${req.user.userId}`)
    } else {
      console.log(`[GET /api/quotes] Admin/SuperAdmin: showing all quotes`)
    }
    
    if (status) {
      query.status = status
      console.log(`[GET /api/quotes] Filtering by status: ${status}`)
    }
    
    const budgets = await Budget.find(query)
      .sort({ userId: 1, createdAt: -1 })
    
    console.log(`[GET /api/quotes] Found ${budgets.length} quotes/budgets`)
    res.json(budgets)
  } catch (err) {
    console.error('[GET /api/quotes] Get quotes error:', err.message)
    console.error('[GET /api/quotes] Error stack:', err.stack)
    res.status(500).json({ message: 'Error loading quotes' })
  }
})

app.post('/api/quotes', authenticateToken, async (req, res) => {
  try {
    if (!mongoConnected) {
      return res.status(503).json({ message: 'Database not available' })
    }
    
    console.log(`[POST /api/quotes] User: ${req.user.username}, Role: ${req.user.role}`)
    
    const { targetUserId, ...budgetData } = req.body
    
    // Validate targetUserId if provided (must be superadmin)
    if (targetUserId && !isSuperAdmin(req.user.role)) {
      return res.status(403).json({ message: 'Only superadmins can specify targetUserId' })
    }
    
    // Get target userId - superadmins can create quotes for other users
    let finalUserId
    try {
      finalUserId = await getTargetUserId(req, targetUserId)
      console.log(`[POST /api/quotes] Final userId: ${finalUserId}`)
    } catch (error) {
      console.error(`[POST /api/quotes] Error getting target userId:`, error.message)
      return res.status(404).json({ message: error.message || 'Target user not found' })
    }
    
    const budget = await Budget.create({
      ...budgetData,
      userId: finalUserId
    })
    
    console.log(`[POST /api/quotes] Budget created successfully: ${budget._id}`)
    res.status(201).json(budget)
  } catch (err) {
    console.error('[POST /api/quotes] Create quote error:', err.message)
    console.error('[POST /api/quotes] Error stack:', err.stack)
    res.status(500).json({ message: 'Error creating quote', error: err.message })
  }
})

app.put('/api/quotes/:id', authenticateToken, async (req, res) => {
  try {
    if (!mongoConnected) {
      return res.status(503).json({ message: 'Database not available' })
    }
    
    console.log(`[PUT /api/quotes/:id] User: ${req.user.username}, Role: ${req.user.role}, QuoteId: ${req.params.id}`)
    
    const { id } = req.params
    const query = { _id: id }
    if (!isAdminOrSuperAdmin(req.user.role)) {
      query.userId = req.user.userId
      console.log(`[PUT /api/quotes/:id] Filtering by userId: ${req.user.userId}`)
    }
    
    const budget = await Budget.findOne(query)
    if (!budget) {
      console.log(`[PUT /api/quotes/:id] Quote not found with query:`, query)
      return res.status(404).json({ message: 'Quote not found' })
    }
    
    // Update fields, excluding userId (can't change ownership)
    const { userId, _id, ...updateData } = req.body
    Object.assign(budget, updateData)
    budget.updatedAt = new Date()
    await budget.save()
    
    console.log(`[PUT /api/quotes/:id] Quote updated successfully: ${budget._id}`)
    res.json(budget)
  } catch (err) {
    console.error('[PUT /api/quotes/:id] Update quote error:', err.message)
    console.error('[PUT /api/quotes/:id] Error stack:', err.stack)
    res.status(500).json({ message: 'Error updating quote', error: err.message })
  }
})

app.delete('/api/quotes/:id', authenticateToken, async (req, res) => {
  try {
    if (!mongoConnected) {
      return res.status(503).json({ message: 'Database not available' })
    }
    
    const { id } = req.params
    const query = { _id: id }
    if (!isAdminOrSuperAdmin(req.user.role)) {
      query.userId = req.user.userId
    }
    
    const budget = await Budget.findOneAndDelete(query)
    if (!budget) {
      return res.status(404).json({ message: 'Quote not found' })
    }
    
    res.json({ message: 'Quote deleted successfully' })
  } catch (err) {
    console.error('Delete quote error:', err.message)
    res.status(500).json({ message: 'Error deleting quote' })
  }
})

// ═══════════════════════════════════════════════════════════════
// 👥 CLIENTS
// ═══════════════════════════════════════════════════════════════

app.get('/api/clients', authenticateToken, async (req, res) => {
  try {
    console.log(`[GET /api/clients] User: ${req.user.username}, Role: ${req.user.role}, IsAdmin: ${isAdminOrSuperAdmin(req.user.role)}`)
    
    if (!mongoConnected) {
      return res.json([])
    }
    const { isActive } = req.query
    const query = {}
    
    // Admins y superadmins pueden ver todos los clients, employees solo los suyos
    if (!isAdminOrSuperAdmin(req.user.role)) {
      query.userId = req.user.userId
    }
    
    if (isActive !== undefined) {
      query.isActive = isActive === 'true'
    }
    
    const clients = await Client.find(query)
      .sort({ userId: 1, createdAt: -1 })
    
    console.log(`[GET /api/clients] Found ${clients.length} clients`)
    res.json(clients)
  } catch (err) {
    console.error('Get clients error:', err.message)
    res.status(500).json({ message: 'Error loading clients' })
  }
})

app.post('/api/clients', authenticateToken, async (req, res) => {
  try {
    console.log(`[POST /api/clients] User: ${req.user.username}, Creating client:`, req.body.name)
    
    if (!mongoConnected) {
      return res.status(503).json({ message: 'Database not available' })
    }
    
    const clientData = { ...req.body, userId: req.user.userId }
    
    if (req.body.rating && req.body.rating > 0) {
      clientData.satisfactionHistory = [{
        date: new Date(),
        rating: req.body.rating,
        comment: req.body.notes || '',
        service: 'Initial Service'
      }]
      clientData.totalServices = 1
    }
    
    const client = await Client.create(clientData)
    
    console.log(`[POST /api/clients] ✅ Client created with ID: ${client._id}`)
    res.status(201).json(client)
  } catch (err) {
    console.error('Create client error:', err.message)
    res.status(500).json({ message: 'Error creating client' })
  }
})

app.put('/api/clients/:id', authenticateToken, async (req, res) => {
  try {
    if (!mongoConnected) {
      return res.status(503).json({ message: 'Database not available' })
    }
    
    const { id } = req.params
    const query = { _id: id }
    if (!isAdminOrSuperAdmin(req.user.role)) {
      query.userId = req.user.userId
    }
    
    const client = await Client.findOne(query)
    if (!client) {
      return res.status(404).json({ message: 'Client not found' })
    }
    
    Object.assign(client, req.body)
    client.updatedAt = new Date()
    await client.save()
    
    res.json(client)
  } catch (err) {
    console.error('Update client error:', err.message)
    res.status(500).json({ message: 'Error updating client' })
  }
})

app.delete('/api/clients/:id', authenticateToken, async (req, res) => {
  try {
    if (!mongoConnected) {
      return res.status(503).json({ message: 'Database not available' })
    }
    
    const { id } = req.params
    const query = { _id: id }
    if (!isAdminOrSuperAdmin(req.user.role)) {
      query.userId = req.user.userId
    }
    
    const client = await Client.findOneAndDelete(query)
    if (!client) {
      return res.status(404).json({ message: 'Client not found' })
    }
    
    res.json({ message: 'Client deleted successfully' })
  } catch (err) {
    console.error('Delete client error:', err.message)
    res.status(500).json({ message: 'Error deleting client' })
  }
})

// ═══════════════════════════════════════════════════════════════
// ⭐ CUSTOMER SATISFACTION
// ═══════════════════════════════════════════════════════════════

// Obtener todas las respuestas de satisfacción
app.get('/api/customer-satisfaction', authenticateToken, async (req, res) => {
  try {
    if (!mongoConnected) {
      return res.json([])
    }
    const limit = parseInt(req.query.limit) || 100
    const surveys = await CustomerSatisfaction.find()
      .sort({ submittedAt: -1 })
      .limit(limit)
      .populate('submittedBy', 'username fullName')
    res.json(surveys)
  } catch (err) {
    console.error('Get customer satisfaction error:', err.message)
    res.status(500).json({ message: 'Error loading surveys' })
  }
})

// Crear nueva respuesta de satisfacción
app.post('/api/customer-satisfaction', authenticateToken, async (req, res) => {
  try {
    if (!mongoConnected) {
      return res.status(503).json({ message: 'Database not available' })
    }
    
    const { 
      clientName, 
      clientEmail, 
      clientPhone, 
      rating, 
      npsScore,
      categories,
      comment, 
      wouldRecommend,
      location,
      serviceType
    } = req.body
    
    if (!clientName || !rating) {
      return res.status(400).json({ message: 'Client name and rating are required' })
    }
    
    if (rating < 1 || rating > 5) {
      return res.status(400).json({ message: 'Rating must be between 1 and 5' })
    }
    
    const survey = await CustomerSatisfaction.create({
      clientName,
      clientEmail,
      clientPhone,
      rating,
      npsScore,
      categories: categories || {},
      comment,
      wouldRecommend,
      location,
      serviceType,
      submittedBy: req.user.userId
    })
    
    // Enviar notificación a admins
    try {
      const adminEmails = await getAdminEmails()
      if (adminEmails.length > 0) {
        const ratingStars = '⭐'.repeat(rating) + '☆'.repeat(5 - rating)
        await sendEmail(
          adminEmails,
          `⭐ New Customer Satisfaction Survey - ${rating}/5 Stars`,
          `
            <h2>New Customer Satisfaction Survey</h2>
            <p><strong>Client:</strong> ${clientName}</p>
            ${clientEmail ? `<p><strong>Email:</strong> ${clientEmail}</p>` : ''}
            ${clientPhone ? `<p><strong>Phone:</strong> ${clientPhone}</p>` : ''}
            <p><strong>Rating:</strong> ${ratingStars} (${rating}/5)</p>
            ${npsScore !== undefined ? `<p><strong>NPS Score:</strong> ${npsScore}/10</p>` : ''}
            ${comment ? `<p><strong>Comment:</strong><br>${comment.replace(/\n/g, '<br>')}</p>` : ''}
            ${location ? `<p><strong>Location:</strong> ${location}</p>` : ''}
            ${serviceType ? `<p><strong>Service Type:</strong> ${serviceType}</p>` : ''}
            <p><em>Submitted: ${new Date().toLocaleString()}</em></p>
          `
        )
      }
    } catch (emailErr) {
      console.error('Error sending satisfaction email:', emailErr.message)
    }
    
    console.log(`✅ Customer satisfaction survey created: ${clientName} - ${rating}/5`)
    res.status(201).json(survey)
  } catch (err) {
    console.error('Create customer satisfaction error:', err.message)
    res.status(500).json({ message: 'Error creating survey' })
  }
})

// Estadísticas de satisfacción
app.get('/api/customer-satisfaction/stats', authenticateToken, async (req, res) => {
  try {
    if (!mongoConnected) {
      return res.json({
        total: 0,
        averageRating: 0,
        ratings: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
        nps: 0,
        wouldRecommend: 0,
        recent: []
      })
    }
    
    const surveys = await CustomerSatisfaction.find()
    const total = surveys.length
    
    if (total === 0) {
      return res.json({
        total: 0,
        averageRating: 0,
        ratings: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
        nps: 0,
        wouldRecommend: 0,
        recent: []
      })
    }
    
    const averageRating = surveys.reduce((sum, s) => sum + (s.rating || 0), 0) / total
    const ratings = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }
    surveys.forEach(s => {
      if (s.rating >= 1 && s.rating <= 5) ratings[s.rating]++
    })
    
    // Calcular NPS (Net Promoter Score)
    const promoters = surveys.filter(s => s.npsScore !== undefined && s.npsScore >= 9).length
    const detractors = surveys.filter(s => s.npsScore !== undefined && s.npsScore <= 6).length
    const nps = total > 0 ? ((promoters - detractors) / total) * 100 : 0
    
    const wouldRecommend = surveys.filter(s => s.wouldRecommend === true).length
    
    const recent = surveys
      .sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt))
      .slice(0, 10)
      .map(s => ({
        _id: s._id,
        clientName: s.clientName,
        rating: s.rating,
        comment: s.comment?.substring(0, 100),
        submittedAt: s.submittedAt
      }))
    
    res.json({
      total,
      averageRating: Math.round(averageRating * 10) / 10,
      ratings,
      nps: Math.round(nps * 10) / 10,
      wouldRecommend,
      recent
    })
  } catch (err) {
    console.error('Get satisfaction stats error:', err.message)
    res.status(500).json({ message: 'Error loading stats' })
  }
})

// Exportar PDF (se implementará en el frontend con jsPDF)
// Enviar por email
app.post('/api/customer-satisfaction/send-email', authenticateToken, async (req, res) => {
  try {
    const { surveyId, recipientEmail } = req.body
    
    if (!surveyId || !recipientEmail) {
      return res.status(400).json({ message: 'Survey ID and recipient email required' })
    }
    
    if (!mongoConnected) {
      return res.status(503).json({ message: 'Database not available' })
    }
    
    const survey = await CustomerSatisfaction.findById(surveyId)
    if (!survey) {
      return res.status(404).json({ message: 'Survey not found' })
    }
    
    const ratingStars = '⭐'.repeat(survey.rating) + '☆'.repeat(5 - survey.rating)
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f5f5f5;">
        <div style="background: white; border-radius: 8px; padding: 30px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <h1 style="color: #333; margin-top: 0;">Customer Satisfaction Survey</h1>
          <div style="border-top: 2px solid #e0e0e0; padding-top: 20px; margin-top: 20px;">
            <p><strong>Client:</strong> ${survey.clientName}</p>
            ${survey.clientEmail ? `<p><strong>Email:</strong> ${survey.clientEmail}</p>` : ''}
            ${survey.clientPhone ? `<p><strong>Phone:</strong> ${survey.clientPhone}</p>` : ''}
            <p><strong>Overall Rating:</strong> ${ratingStars} (${survey.rating}/5)</p>
            ${survey.npsScore !== undefined ? `<p><strong>NPS Score:</strong> ${survey.npsScore}/10</p>` : ''}
            ${survey.comment ? `<p><strong>Feedback:</strong><br>${survey.comment.replace(/\n/g, '<br>')}</p>` : ''}
            ${survey.location ? `<p><strong>Location:</strong> ${survey.location}</p>` : ''}
            ${survey.serviceType ? `<p><strong>Service Type:</strong> ${survey.serviceType}</p>` : ''}
            <p style="color: #666; font-size: 12px; margin-top: 20px;"><em>Submitted: ${new Date(survey.submittedAt).toLocaleString()}</em></p>
          </div>
        </div>
      </div>
    `
    
    const result = await sendEmail(
      recipientEmail,
      `Customer Satisfaction Survey - ${survey.clientName} - ${survey.rating}/5 Stars`,
      html
    )
    
    if (result.success) {
      res.json({ message: 'Email sent successfully' })
    } else {
      res.status(500).json({ message: result.message || 'Error sending email' })
    }
  } catch (err) {
    console.error('Send satisfaction email error:', err.message)
    res.status(500).json({ message: 'Error sending email' })
  }
})

// ═══════════════════════════════════════════════════════════════
// 📧 EMAIL ENDPOINTS
// ═══════════════════════════════════════════════════════════════

// POST /api/emails/section-completion - Send email when a section is completed
app.post('/api/emails/section-completion', authenticateToken, async (req, res) => {
  console.log(`[Section Completion Email] ========== ENDPOINT CALLED ==========`)
  console.log(`[Section Completion Email] User:`, req.user?.username || 'unknown', req.user?.userId || 'no-id')
  console.log(`[Section Completion Email] User role:`, req.user?.role || 'unknown')
  console.log(`[Section Completion Email] User from token:`, JSON.stringify({
    userId: req.user?.userId,
    username: req.user?.username,
    role: req.user?.role,
    isLocalFallback: req.user?.isLocalFallback
  }))
  console.log(`[Section Completion Email] Body:`, JSON.stringify({
    sectionId: req.body.sectionId,
    sectionTitle: req.body.sectionTitle?.substring(0, 50),
    day: req.body.day,
    week: req.body.week,
    userId: req.body.userId,
    userName: req.body.userName?.substring(0, 30)
  }, null, 2))
  
  try {
    // Verificar autenticación
    if (!req.user || !req.user.userId) {
      console.error(`[Section Completion Email] ❌ Unauthorized: No user in request`)
      return res.status(401).json({ message: 'Unauthorized' })
    }
    
    if (!emailConfigured) {
      console.error(`[Section Completion Email] ❌ Email service not configured!`)
      return res.status(503).json({ message: 'Email service not configured' })
    }
    console.log(`[Section Completion Email] ✅ Email service is configured`)

    const { sectionId, sectionTitle, day, week, userId, userName, room, roomKey } = req.body

    if (!sectionId || !sectionTitle || !day || !week || !userId) {
      return res.status(400).json({ message: 'Missing required fields: sectionId, sectionTitle, day, week, and userId are required' })
    }

    // Get tasks for this section, day, week, and room
    if (!mongoConnected) {
      return res.status(503).json({ message: 'Database not available' })
    }

    // Convert userId to ObjectId if it's a valid ObjectId string
    let userIdObjectId = userId
    try {
      if (typeof userId === 'string' && userId.length === 24 && /^[0-9a-fA-F]{24}$/.test(userId)) {
        userIdObjectId = new mongoose.Types.ObjectId(userId)
      } else if (typeof userId === 'string' && userId.startsWith('jwt_')) {
        // Handle legacy token format - extract actual userId
        const parts = userId.split('_')
        if (parts.length >= 2 && parts[1] && parts[1].length === 24) {
          userIdObjectId = new mongoose.Types.ObjectId(parts[1])
        } else {
          return res.status(400).json({ message: 'Invalid userId format' })
        }
      } else if (!(userId instanceof mongoose.Types.ObjectId)) {
        return res.status(400).json({ message: 'Invalid userId format' })
      }
    } catch (err) {
      console.error(`[Section Completion Email] Error converting userId to ObjectId:`, err.message)
      return res.status(400).json({ message: 'Invalid userId format' })
    }

    const query = { userId: userIdObjectId, week, day }
    if (roomKey) {
      query.roomKey = roomKey.toLowerCase().trim()
    } else if (room) {
      query.$or = [
        { room: room.trim() },
        { roomKey: room.toLowerCase().trim().replace(/\s+/g, '-') }
      ]
    }

    const dayTasks = await Task.find(query)
    
    // Get section tasks from config
    // Use mongoose.models to get TaskConfig - this always works even if variable is not in scope
    let TaskConfigModel
    try {
      // Try to get from mongoose.models first (most reliable)
      TaskConfigModel = mongoose.models.TaskConfig
      if (!TaskConfigModel) {
        // Fallback: try to get the model by name
        TaskConfigModel = mongoose.model('TaskConfig')
      }
      if (!TaskConfigModel) {
        throw new Error('TaskConfig model not found')
      }
      console.log('[Section Completion Email] ✅ TaskConfig model found')
    } catch (modelError) {
      console.error('[Section Completion Email] ❌ Error getting TaskConfig model:', modelError.message)
      console.error('[Section Completion Email] Available models:', Object.keys(mongoose.models || {}))
      return res.status(500).json({ 
        message: 'TaskConfig model not available',
        error: modelError.message,
        availableModels: Object.keys(mongoose.models || {})
      })
    }
    const userConfig = await TaskConfigModel.findOne({ userId: userIdObjectId })
    console.log(`[Section Completion Email] UserConfig found:`, !!userConfig)
    console.log(`[Section Completion Email] UserConfig sections count:`, userConfig?.sections?.length || 0)
    console.log(`[Section Completion Email] Looking for sectionId:`, sectionId)
    console.log(`[Section Completion Email] Available section IDs:`, userConfig?.sections?.map(s => s.id) || [])
    
    let section = null
    let sectionTasks = []
    
    if (userConfig && userConfig.sections && Array.isArray(userConfig.sections)) {
      section = userConfig.sections.find((s) => s.id === sectionId)
      console.log(`[Section Completion Email] Section found in config:`, !!section)
      console.log(`[Section Completion Email] Section has tasks:`, !!section?.tasks)
      console.log(`[Section Completion Email] Section tasks count:`, section?.tasks?.length || 0)
      
      if (section && section.tasks && Array.isArray(section.tasks)) {
        // Filter tasks by section from config
        sectionTasks = dayTasks.filter((task) => 
          section.tasks.includes(task.taskName)
        )
      }
    }
    
    // Si no encontramos la sección en TaskConfig, usar todas las tareas del día como fallback
    if (!section || !section.tasks || !Array.isArray(section.tasks) || sectionTasks.length === 0) {
      console.warn(`[Section Completion Email] ⚠️ Section "${sectionId}" not found in TaskConfig, using all day tasks as fallback`)
      console.warn(`[Section Completion Email] Using sectionTitle from request: "${sectionTitle}"`)
      sectionTasks = dayTasks // Usar todas las tareas del día
    }

    // FIXED: Calculate stats for ALL sections, not just the completed one
    // More robust completion check
    const isTaskCompleted = (completedValue) => {
      if (typeof completedValue === 'boolean') return completedValue
      if (typeof completedValue === 'string') return completedValue.toLowerCase() === 'true' || completedValue === '1'
      if (typeof completedValue === 'number') return completedValue === 1
      return false
    }
    
    // Calculate stats for the completed section
    const completedTasks = sectionTasks.filter((task) => isTaskCompleted(task.completed))
    const completedCount = completedTasks.length
    const totalCount = section?.tasks?.length || sectionTasks.length
    const completionRate = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0
    
    // Calculate stats for ALL sections in the day
    let allSectionsStats = []
    let totalDayCompleted = 0
    let totalDayTasks = 0
    
    if (userConfig && userConfig.sections && Array.isArray(userConfig.sections)) {
      allSectionsStats = userConfig.sections.map((sec) => {
        const secTasks = dayTasks.filter((task) => 
          sec.tasks && Array.isArray(sec.tasks) && sec.tasks.includes(task.taskName)
        )
        const secCompleted = secTasks.filter((task) => isTaskCompleted(task.completed)).length
        const secTotal = sec.tasks?.length || 0
        totalDayCompleted += secCompleted
        totalDayTasks += secTotal
        return {
          id: sec.id,
          title: sec.title,
          completed: secCompleted,
          total: secTotal,
          percentage: secTotal > 0 ? Math.round((secCompleted / secTotal) * 100) : 0,
          isCompleted: sec.id === sectionId
        }
      })
    } else {
      // Fallback: if no config, use all day tasks as one section
      const allCompleted = dayTasks.filter((task) => isTaskCompleted(task.completed)).length
      totalDayCompleted = allCompleted
      totalDayTasks = dayTasks.length
      allSectionsStats = [{
        id: sectionId,
        title: sectionTitle,
        completed: allCompleted,
        total: dayTasks.length,
        percentage: dayTasks.length > 0 ? Math.round((allCompleted / dayTasks.length) * 100) : 0,
        isCompleted: true
      }]
    }
    
    const overallDayCompletion = totalDayTasks > 0 ? Math.round((totalDayCompleted / totalDayTasks) * 100) : 0
    
    console.log(`[Section Completion Email] Section stats - Completed: ${completedCount}, Total: ${totalCount}, Rate: ${completionRate}%`)
    console.log(`[Section Completion Email] Day stats - Completed: ${totalDayCompleted}, Total: ${totalDayTasks}, Rate: ${overallDayCompletion}%`)
    console.log(`[Section Completion Email] All sections stats:`, allSectionsStats)

    // Day name
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    const dayName = dayNames[day - 1] || `Day ${day}`

    // Get admin emails para section completion
    console.log(`[Section Completion Email] Getting admin emails...`)
    const recipients = await getAdminEmails('sectionCompletion')
    console.log(`[Section Completion Email] Recipients: ${recipients.length}`, recipients)
    if (recipients.length === 0) {
      console.warn(`[Section Completion Email] No recipients found!`)
      console.warn(`[Section Completion Email] This might mean email notifications are disabled or no admins are selected.`)
      // Still return success but log the issue
      return res.status(200).json({ 
        success: false,
        message: 'No admin emails configured for section completion notifications',
        recipients: 0,
        total: 0
      })
    }

    // Build email HTML matching the example format
    const completedTasksHTML = completedTasks.map((task) => `
      <div style="background:#f0fdf4;border:2px solid #86efac;border-radius:8px;padding:12px;margin-bottom:8px;display:flex;align-items:center;gap:10px;">
        <span style="color:#10b981;font-size:20px;">✅</span>
        <span style="color:#1f2937;font-weight:600;font-size:14px;">${task.taskName}</span>
      </div>
    `).join('')

    // Usar tasks de la sección si existe, sino usar todas las tareas del día
    const tasksToShow = section?.tasks || sectionTasks.map(t => t.taskName)
    const allTasksHTML = tasksToShow.map((taskName) => {
      const task = sectionTasks.find((t) => t.taskName === taskName)
      const isCompleted = task?.completed || false
      return `
        <div style="padding:8px 0;border-bottom:1px solid #e5e7eb;">
          <span style="color:#1f2937;font-size:14px;">${taskName}</span>
          <span style="color:#10b981;font-weight:600;margin-left:8px;font-size:12px;">${isCompleted ? 'COMPLETED' : 'PENDING'}</span>
        </div>
      `
    }).join('')

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Section completion alert</title>
</head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;background:#f3f4f6;">
  <div style="max-width:650px;margin:20px auto;background:#ffffff;box-shadow:0 4px 6px rgba(0,0,0,0.1);">
    <div style="background:linear-gradient(135deg,#1e40af 0%,#3b82f6 100%);color:white;padding:30px;text-align:center;">
      <h1 style="margin:0 0 10px 0;font-size:28px;font-weight:700;">BRIGHT WORKS PROFESSIONAL</h1>
      <p style="margin:0;font-size:16px;opacity:0.9;">Section completion alert.</p>
    </div>
    <div style="padding:30px;">
      <h2 style="color:#1e40af;font-size:24px;margin:0 0 20px 0;font-weight:700;text-align:center;">SECTION COMPLETED</h2>
      <h3 style="color:#1f2937;font-size:18px;margin:0 0 30px 0;text-align:center;font-weight:600;">${sectionTitle} - Week ${week} - ${dayName}</h3>
      
      <div style="display:flex;gap:10px;margin-bottom:30px;flex-wrap:wrap;">
        <div style="flex:1;min-width:140px;background:#f9fafb;border:2px solid #e5e7eb;border-radius:8px;padding:15px;text-align:center;">
          <div style="color:#64748b;font-size:12px;font-weight:600;text-transform:uppercase;margin-bottom:5px;">SECTION</div>
          <div style="color:#1f2937;font-size:20px;font-weight:700;">${completedCount}/${totalCount}</div>
        </div>
        <div style="flex:1;min-width:140px;background:#f9fafb;border:2px solid #e5e7eb;border-radius:8px;padding:15px;text-align:center;">
          <div style="color:#64748b;font-size:12px;font-weight:600;text-transform:uppercase;margin-bottom:5px;">DAY TOTAL</div>
          <div style="color:#1f2937;font-size:20px;font-weight:700;">${totalDayCompleted}/${totalDayTasks}</div>
        </div>
        <div style="flex:1;min-width:140px;background:#f9fafb;border:2px solid #e5e7eb;border-radius:8px;padding:15px;text-align:center;">
          <div style="color:#64748b;font-size:12px;font-weight:600;text-transform:uppercase;margin-bottom:5px;">DAY RATE</div>
          <div style="color:#1f2937;font-size:20px;font-weight:700;">${overallDayCompletion}%</div>
        </div>
        <div style="flex:1;min-width:140px;background:#f9fafb;border:2px solid #e5e7eb;border-radius:8px;padding:15px;text-align:center;">
          <div style="color:#64748b;font-size:12px;font-weight:600;text-transform:uppercase;margin-bottom:5px;">COMPLETED BY</div>
          <div style="color:#1f2937;font-size:14px;font-weight:600;">${userName || 'Employee'}</div>
        </div>
        <div style="flex:1;min-width:140px;background:#f9fafb;border:2px solid #e5e7eb;border-radius:8px;padding:15px;text-align:center;">
          <div style="color:#64748b;font-size:12px;font-weight:600;text-transform:uppercase;margin-bottom:5px;">AREA / ROOM</div>
          <div style="color:#1f2937;font-size:14px;font-weight:600;">${room || 'General'}</div>
        </div>
      </div>

      <div style="margin-bottom:30px;">
        <h4 style="color:#1e40af;font-size:16px;font-weight:600;margin:0 0 15px 0;">ALL SECTIONS STATUS</h4>
        <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:15px;">
          ${allSectionsStats.map((sec) => `
            <div style="padding:12px;margin-bottom:8px;border-radius:6px;${sec.isCompleted ? 'background:#f0fdf4;border:2px solid #86efac;' : 'background:#fff7ed;border:2px solid #fed7aa;'}">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px;">
                <span style="color:#1f2937;font-size:14px;font-weight:600;">${sec.title}${sec.isCompleted ? ' ✓' : ''}</span>
                <span style="color:${sec.percentage === 100 ? '#10b981' : sec.percentage >= 50 ? '#f59e0b' : '#ef4444'};font-weight:700;font-size:14px;">${sec.completed}/${sec.total} (${sec.percentage}%)</span>
              </div>
              <div style="height:6px;background:#e5e7eb;border-radius:3px;overflow:hidden;margin-top:8px;">
                <div style="height:100%;background:${sec.percentage === 100 ? '#10b981' : sec.percentage >= 50 ? '#f59e0b' : '#ef4444'};width:${sec.percentage}%;transition:width 0.3s;"></div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>

      <div style="margin-bottom:30px;">
        <h4 style="color:#1e40af;font-size:16px;font-weight:600;margin:0 0 15px 0;">COMPLETED TASKS</h4>
        ${completedTasksHTML || '<p style="color:#64748b;font-size:14px;">No completed tasks</p>'}
      </div>

      <div style="margin-bottom:30px;">
        <h4 style="color:#1e40af;font-size:16px;font-weight:600;margin:0 0 15px 0;">SECTION TASKS</h4>
        <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:15px;">
          ${allTasksHTML}
        </div>
      </div>
    </div>
    <div style="background:#f9fafb;border-top:2px solid #e5e7eb;padding:20px;text-align:center;">
      <p style="color:#64748b;font-size:12px;margin:0 0 10px 0;">AUTOMATED NOTIFICATION</p>
      <p style="margin:0;">
        <a href="https://brightworks.app" style="color:#3b82f6;text-decoration:none;font-weight:600;">BRIGHTWORKS.APP</a>
      </p>
      <p style="color:#9ca3af;font-size:11px;margin:10px 0 0 0;">© 2025 BRIGHT WORKS PROFESSIONAL. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
    `

    // Send email to all admins
    console.log(`[Section Completion Email] 📧 About to send emails to ${recipients.length} recipients`)
    console.log(`[Section Completion Email] Recipients list:`, recipients)
    console.log(`[Section Completion Email] Email configured: ${emailConfigured}`)
    console.log(`[Section Completion Email] Email from: ${emailFrom}`)
    
    const results = await Promise.allSettled(
      recipients.map((email, idx) => {
        console.log(`[Section Completion Email] Sending email ${idx + 1}/${recipients.length} to: ${email}`)
        return sendEmail(email, `Section completion alert - ${sectionTitle}`, html)
      })
    )

    // Check both fulfilled and rejected promises, and also check the result.success
    const successCount = results.filter((r) => {
      if (r.status === 'fulfilled') {
        return r.value && r.value.success === true
      }
      return false
    }).length
    
    const failedResults = results.filter((r) => {
      if (r.status === 'rejected') return true
      if (r.status === 'fulfilled' && r.value && r.value.success === false) return true
      return false
    })
    
    console.log(`[Section Completion Email] Results: ${successCount} successful, ${failedResults.length} failed out of ${recipients.length} total`)
    
    if (failedResults.length > 0) {
      console.error(`❌ Section completion email failures (${failedResults.length}):`)
      failedResults.forEach((r, idx) => {
        if (r.status === 'rejected') {
          console.error(`   ${idx + 1}. Rejected:`, r.reason?.message || r.reason)
          console.error(`   ${idx + 1}. Rejected stack:`, r.reason?.stack)
        } else if (r.value) {
          console.error(`   ${idx + 1}. Failed:`, r.value.message || 'Unknown error')
          console.error(`   ${idx + 1}. Failed error:`, r.value.error?.message || r.value.error)
        }
      })
    }
    
    if (successCount > 0) {
      console.log(`✅ Section completion email sent: ${sectionTitle} - Week ${week} - ${dayName} - Room ${room || 'General'} - ${successCount}/${recipients.length} recipients`)
    } else {
      console.warn(`⚠️ Section completion email: No emails were sent successfully (${successCount}/${recipients.length})`)
    }

    res.json({ 
      success: true, 
      message: 'Section completion email sent',
      recipients: successCount,
      total: recipients.length
    })
  } catch (err) {
    console.error('❌ Section completion email error:', err.message)
    console.error('❌ Error stack:', err.stack)
    console.error('❌ Error details:', {
      name: err.name,
      message: err.message,
      code: err.code,
      userId: req.body?.userId,
      userIdType: typeof req.body?.userId,
      sectionId: req.body?.sectionId,
      user: req.user?.username || 'unknown',
      userFromToken: req.user?.userId || 'no-user-id',
      bodyKeys: Object.keys(req.body || {})
    })
    res.status(500).json({ 
      message: 'Error sending section completion email',
      error: err.message,
      details: process.env.NODE_ENV === 'development' ? {
        stack: err.stack,
        name: err.name,
        code: err.code
      } : undefined
    })
  }
})

// POST /api/emails/day-completion - Send email when day is signed (daily report)
app.post('/api/emails/day-completion', authenticateToken, async (req, res) => {
  console.log(`[Day Completion Email] ========== ENDPOINT CALLED ==========`)
  console.log(`[Day Completion Email] User:`, req.user?.username || 'unknown', req.user?.userId || 'no-id')
  console.log(`[Day Completion Email] Body:`, JSON.stringify({
    day: req.body.day,
    week: req.body.week,
    userId: req.body.userId,
    userName: req.body.userName?.substring(0, 30),
    room: req.body.room?.substring(0, 30)
  }, null, 2))
  
  try {
    if (!emailConfigured) {
      console.error(`[Day Completion Email] ❌ Email service not configured!`)
      return res.status(503).json({ message: 'Email service not configured' })
    }
    console.log(`[Day Completion Email] ✅ Email service is configured`)

    const { day, week, userId, userName, signature, room, roomKey } = req.body

    if (!day || !week || !userId) {
      return res.status(400).json({ message: 'Day, week, and userId are required' })
    }

    if (!mongoConnected) {
      return res.status(503).json({ message: 'Database not available' })
    }

    // Get tasks for this day, week, and room
    const query = { userId, week, day }
    if (roomKey) {
      query.roomKey = roomKey.toLowerCase().trim()
    } else if (room) {
      query.$or = [
        { room: room.trim() },
        { roomKey: room.toLowerCase().trim().replace(/\s+/g, '-') }
      ]
    }

    const dayTasks = await Task.find(query)
    
    // Get time record
    const timeRecordQuery = { userId, week, day }
    if (roomKey) {
      timeRecordQuery.roomKey = roomKey.toLowerCase().trim()
    } else if (room) {
      timeRecordQuery.$or = [
        { room: room.trim() },
        { roomKey: room.toLowerCase().trim().replace(/\s+/g, '-') }
      ]
    }
    
    const timeRecord = await TimeRecord.findOne(timeRecordQuery)
    
    // Get user config for sections
    // Use mongoose.models to get TaskConfig - this always works even if variable is not in scope
    let TaskConfigModel
    try {
      // Try to get from mongoose.models first (most reliable)
      TaskConfigModel = mongoose.models.TaskConfig
      if (!TaskConfigModel) {
        // Fallback: try to get the model by name
        TaskConfigModel = mongoose.model('TaskConfig')
      }
      if (!TaskConfigModel) {
        throw new Error('TaskConfig model not found')
      }
      console.log('[Day Completion Email] ✅ TaskConfig model found')
    } catch (modelError) {
      console.error('[Day Completion Email] ❌ Error getting TaskConfig model:', modelError.message)
      console.error('[Day Completion Email] Available models:', Object.keys(mongoose.models || {}))
      return res.status(500).json({ 
        message: 'TaskConfig model not available',
        error: modelError.message,
        availableModels: Object.keys(mongoose.models || {})
      })
    }
    const userConfig = await TaskConfigModel.findOne({ userId })
    const sections = userConfig?.sections || []
    
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    const dayName = dayNames[day - 1] || `Day ${day}`
    
    // Get admin emails para day completion
    console.log(`[Day Completion Email] Getting admin emails...`)
    const recipients = await getAdminEmails('dayCompletion')
    console.log(`[Day Completion Email] Recipients: ${recipients.length}`, recipients)
    if (recipients.length === 0) {
      console.warn(`[Day Completion Email] No recipients found!`)
      console.warn(`[Day Completion Email] This might mean email notifications are disabled or no admins are selected.`)
      // Still return success but log the issue
      return res.status(200).json({ 
        success: false,
        message: 'No admin emails configured for day completion notifications',
        recipients: 0,
        total: 0
      })
    }

    // Build sections HTML
    const sectionsHTML = sections.map((section) => {
      if (!section || !section.tasks || !Array.isArray(section.tasks)) return ''
      
      const sectionTasks = dayTasks.filter((task) => 
        section.tasks.includes(task.taskName)
      )
      const completed = sectionTasks.filter((t) => t.completed).length
      const total = section.tasks.length
      const percentage = total > 0 ? Math.round((completed / total) * 100) : 0
      
      const completedTasksHTML = sectionTasks
        .filter((t) => t.completed)
        .map((t) => `<li style="color:#10b981;margin:5px 0;">✅ ${t.taskName}</li>`)
        .join('')
      
      const pendingTasksHTML = section.tasks
        .filter((taskName) => !sectionTasks.find((t) => t.taskName === taskName && t.completed))
        .map((taskName) => `<li style="color:#dc2626;margin:5px 0;">⏳ ${taskName}</li>`)
        .join('')
      
      return `
        <div style="background:${percentage === 100 ? '#f0fdf4' : '#fef2f2'};padding:15px;border-radius:8px;border:2px solid ${percentage === 100 ? '#86efac' : '#fecaca'};margin-bottom:15px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
            <h4 style="color:#1e40af;font-size:16px;margin:0;font-weight:600;">${section.title}</h4>
            <span style="background:${percentage === 100 ? '#10b981' : '#ef4444'};color:white;padding:4px 12px;border-radius:12px;font-size:12px;font-weight:600;">
              ${percentage}% (${completed}/${total})
            </span>
          </div>
          ${completedTasksHTML ? `<ul style="margin:5px 0 0 20px;padding:0;list-style:none;">${completedTasksHTML}</ul>` : ''}
          ${pendingTasksHTML ? `<ul style="margin:5px 0 0 20px;padding:0;list-style:none;">${pendingTasksHTML}</ul>` : ''}
        </div>
      `
    }).join('')

    const totalCompleted = dayTasks.filter((t) => t.completed).length
    const totalTasks = dayTasks.length
    const overallPercentage = totalTasks > 0 ? Math.round((totalCompleted / totalTasks) * 100) : 0

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Daily Report - ${dayName}</title>
</head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;background:#f3f4f6;">
  <div style="max-width:650px;margin:20px auto;background:#ffffff;box-shadow:0 4px 6px rgba(0,0,0,0.1);">
    <div style="background:linear-gradient(135deg,#1e40af 0%,#3b82f6 100%);color:white;padding:30px;text-align:center;">
      <h1 style="margin:0 0 10px 0;font-size:28px;font-weight:700;">BRIGHT WORKS PROFESSIONAL</h1>
      <p style="margin:0;font-size:16px;opacity:0.9;">Daily Report - ${dayName} - Week ${week}</p>
    </div>
    <div style="padding:30px;">
      <div style="display:flex;gap:10px;margin-bottom:30px;flex-wrap:wrap;">
        <div style="flex:1;min-width:140px;background:#f9fafb;border:2px solid #e5e7eb;border-radius:8px;padding:15px;text-align:center;">
          <div style="color:#64748b;font-size:12px;font-weight:600;text-transform:uppercase;margin-bottom:5px;">EMPLOYEE</div>
          <div style="color:#1f2937;font-size:14px;font-weight:600;">${userName || 'Employee'}</div>
        </div>
        <div style="flex:1;min-width:140px;background:#f9fafb;border:2px solid #e5e7eb;border-radius:8px;padding:15px;text-align:center;">
          <div style="color:#64748b;font-size:12px;font-weight:600;text-transform:uppercase;margin-bottom:5px;">AREA / ROOM</div>
          <div style="color:#1f2937;font-size:14px;font-weight:600;">${room || 'General'}</div>
        </div>
        <div style="flex:1;min-width:140px;background:#f9fafb;border:2px solid #e5e7eb;border-radius:8px;padding:15px;text-align:center;">
          <div style="color:#64748b;font-size:12px;font-weight:600;text-transform:uppercase;margin-bottom:5px;">COMPLETION</div>
          <div style="color:#1f2937;font-size:20px;font-weight:700;">${totalCompleted}/${totalTasks}</div>
        </div>
        <div style="flex:1;min-width:140px;background:#f9fafb;border:2px solid #e5e7eb;border-radius:8px;padding:15px;text-align:center;">
          <div style="color:#64748b;font-size:12px;font-weight:600;text-transform:uppercase;margin-bottom:5px;">RATE</div>
          <div style="color:#1f2937;font-size:20px;font-weight:700;">${overallPercentage}%</div>
        </div>
      </div>
      
      ${timeRecord?.checkIn || timeRecord?.checkOut ? `
      <div style="background:#f9fafb;border:2px solid #e5e7eb;border-radius:8px;padding:15px;margin-bottom:30px;">
        <h4 style="color:#1e40af;font-size:16px;font-weight:600;margin:0 0 10px 0;">TIME RECORD</h4>
        <div style="display:flex;gap:15px;">
          ${timeRecord.checkIn ? `<div><strong>Check In:</strong> ${new Date(timeRecord.checkIn).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</div>` : ''}
          ${timeRecord.checkOut ? `<div><strong>Check Out:</strong> ${new Date(timeRecord.checkOut).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</div>` : ''}
        </div>
      </div>
      ` : ''}
      
      ${signature ? `
      <div style="background:#f0fdf4;border:2px solid #86efac;border-radius:8px;padding:15px;margin-bottom:30px;text-align:center;">
        <p style="color:#10b981;font-weight:600;margin:0;">✅ Digital Signature Received</p>
      </div>
      ` : ''}
      
      <h4 style="color:#1e40af;font-size:18px;font-weight:600;margin:0 0 15px 0;">SECTIONS</h4>
      ${sectionsHTML || '<p style="color:#64748b;">No sections configured</p>'}
    </div>
    <div style="background:#f9fafb;border-top:2px solid #e5e7eb;padding:20px;text-align:center;">
      <p style="color:#64748b;font-size:12px;margin:0 0 10px 0;">AUTOMATED NOTIFICATION</p>
      <p style="margin:0;">
        <a href="https://brightworks.app" style="color:#3b82f6;text-decoration:none;font-weight:600;">BRIGHTWORKS.APP</a>
      </p>
      <p style="color:#9ca3af;font-size:11px;margin:10px 0 0 0;">© 2025 BRIGHT WORKS PROFESSIONAL. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
    `

    // Send email to all configured admins
    console.log(`[Day Completion Email] Sending to ${recipients.length} recipients:`, recipients)
    const results = await Promise.allSettled(
      recipients.map((email) => {
        console.log(`[Day Completion Email] Sending email to: ${email}`)
        return sendEmail(email, `Daily Report - ${dayName} - Week ${week} - ${room || 'General'}`, html)
      })
    )

    // Check both fulfilled and rejected promises, and also check the result.success
    const successCount = results.filter((r) => {
      if (r.status === 'fulfilled') {
        return r.value && r.value.success === true
      }
      return false
    }).length
    
    const failedResults = results.filter((r) => {
      if (r.status === 'rejected') return true
      if (r.status === 'fulfilled' && r.value && r.value.success === false) return true
      return false
    })
    
    if (failedResults.length > 0) {
      console.error(`❌ Day completion email failures (${failedResults.length}):`)
      failedResults.forEach((r, idx) => {
        if (r.status === 'rejected') {
          console.error(`   ${idx + 1}. Rejected:`, r.reason)
        } else if (r.value) {
          console.error(`   ${idx + 1}. Failed:`, r.value.message || 'Unknown error', r.value.error)
        }
      })
    }
    
    console.log(`✅ Day completion email sent: ${dayName} - Week ${week} - Room ${room || 'General'} - ${successCount}/${recipients.length} recipients`)

    res.json({ 
      success: true, 
      message: 'Day completion email sent',
      recipients: successCount,
      total: recipients.length
    })
  } catch (err) {
    console.error('Day completion email error:', err.message)
    res.status(500).json({ message: 'Error sending day completion email' })
  }
})

// GET /api/email-notifications - Get email notification configuration (Super Admin only)
app.get('/api/email-notifications', authenticateToken, async (req, res) => {
  try {
    if (!mongoConnected) {
      return res.status(503).json({ message: 'Database not available' })
    }
    
    // Verificar que es superadmin
    let dbUser = null
    try {
      if (req.user && req.user.userId) {
        dbUser = await User.findById(req.user.userId)
      }
    } catch (err) {
      console.warn('Could not fetch user from DB:', err.message)
    }
    
    const isSuperAdmin = dbUser?.role === 'superadmin' || req.user?.role === 'superadmin'
    
    if (!isSuperAdmin) {
      return res.status(403).json({ message: 'Only Super Admin can view email notification configuration' })
    }
    
    let config = await EmailNotificationConfig.findOne()
    
    // Si no existe, crear una por defecto
    if (!config) {
      const allAdmins = await User.find({ 
        $or: [{ role: 'admin' }, { role: 'superadmin' }],
        isActive: true 
      }).select('_id')
      
      config = await EmailNotificationConfig.create({
        sectionCompletion: {
          enabledAdmins: allAdmins.map(a => a._id),
          enabled: true
        },
        dayCompletion: {
          enabledAdmins: allAdmins.map(a => a._id),
          enabled: true
        },
        updatedBy: dbUser?._id || allAdmins[0]?._id
      })
    }
    
    // Populate admin details
    const sectionAdmins = await User.find({ _id: { $in: config.sectionCompletion.enabledAdmins } })
      .select('_id username fullName email role')
    const dayAdmins = await User.find({ _id: { $in: config.dayCompletion.enabledAdmins } })
      .select('_id username fullName email role')
    
    // Get all available admins
    const allAdmins = await User.find({ 
      $or: [{ role: 'admin' }, { role: 'superadmin' }],
      isActive: true 
    }).select('_id username fullName email role')
    
    res.json({
      allAdmins: allAdmins, // Top-level for easier access
      sectionCompletion: {
        enabled: config.sectionCompletion.enabled,
        enabledAdmins: sectionAdmins,
        allAdmins: allAdmins
      },
      dayCompletion: {
        enabled: config.dayCompletion.enabled,
        enabledAdmins: dayAdmins,
        allAdmins: allAdmins
      }
    })
  } catch (err) {
    console.error('Get email notifications error:', err.message)
    res.status(500).json({ message: 'Error loading email notification configuration' })
  }
})

// PUT /api/email-notifications - Update email notification configuration (Super Admin only)
app.put('/api/email-notifications', authenticateToken, async (req, res) => {
  try {
    if (!mongoConnected) {
      return res.status(503).json({ message: 'Database not available' })
    }
    
    // Verificar que es superadmin
    let dbUser = null
    try {
      if (req.user && req.user.userId) {
        dbUser = await User.findById(req.user.userId)
      }
    } catch (err) {
      console.warn('Could not fetch user from DB:', err.message)
    }
    
    const isSuperAdmin = dbUser?.role === 'superadmin' || req.user?.role === 'superadmin'
    
    if (!isSuperAdmin) {
      return res.status(403).json({ message: 'Only Super Admin can update email notification configuration' })
    }
    
    const { sectionCompletion, dayCompletion } = req.body
    
    let config = await EmailNotificationConfig.findOne()
    
    if (!config) {
      const allAdmins = await User.find({ 
        $or: [{ role: 'admin' }, { role: 'superadmin' }],
        isActive: true 
      }).select('_id')
      
      config = await EmailNotificationConfig.create({
        sectionCompletion: {
          enabledAdmins: allAdmins.map(a => a._id),
          enabled: true
        },
        dayCompletion: {
          enabledAdmins: allAdmins.map(a => a._id),
          enabled: true
        },
        updatedBy: dbUser?._id
      })
    }
    
    // Update section completion config
    if (sectionCompletion !== undefined) {
      if (sectionCompletion.enabled !== undefined) {
        config.sectionCompletion.enabled = sectionCompletion.enabled
      }
      if (sectionCompletion.enabledAdmins && Array.isArray(sectionCompletion.enabledAdmins)) {
        config.sectionCompletion.enabledAdmins = sectionCompletion.enabledAdmins
      }
    }
    
    // Update day completion config
    if (dayCompletion !== undefined) {
      if (dayCompletion.enabled !== undefined) {
        config.dayCompletion.enabled = dayCompletion.enabled
      }
      if (dayCompletion.enabledAdmins && Array.isArray(dayCompletion.enabledAdmins)) {
        config.dayCompletion.enabledAdmins = dayCompletion.enabledAdmins
      }
    }
    
    config.updatedBy = dbUser?._id || req.user?.userId
    config.updatedAt = new Date()
    await config.save()
    
    console.log(`✅ Email notification config updated by ${dbUser?.username || req.user?.username || 'unknown'}`)
    
    res.json({ message: 'Email notification configuration updated', config })
  } catch (err) {
    console.error('Update email notifications error:', err.message)
    res.status(500).json({ message: 'Error updating email notification configuration' })
  }
})

// ═══════════════════════════════════════════════════════════════
// 🔧 EMAIL DIAGNOSTIC ENDPOINTS
// ═══════════════════════════════════════════════════════════════

// GET /api/emails/debug - Diagnostic endpoint for email system (Super Admin only)
app.get('/api/emails/debug', authenticateToken, async (req, res) => {
  try {
    // Solo permitir a superadmin
    let dbUser = null
    try {
      if (req.user && req.user.userId) {
        dbUser = await User.findById(req.user.userId)
      }
    } catch (err) {
      console.warn('Could not fetch user from DB:', err.message)
    }
    
    const isSuperAdmin = dbUser?.role === 'superadmin' || req.user?.role === 'superadmin'
    
    if (!isSuperAdmin) {
      return res.status(403).json({ error: 'Solo superadmin puede ver esto' })
    }

    const diagnostics = {
      timestamp: new Date().toISOString(),
      
      // 1. Configuración de SendGrid
      sendgrid: {
        apiKeyConfigured: !!process.env.SENDGRID_API_KEY,
        apiKeyLength: process.env.SENDGRID_API_KEY?.length || 0,
        apiKeyPrefix: process.env.SENDGRID_API_KEY ? `${process.env.SENDGRID_API_KEY.substring(0, 5)}...` : 'N/A',
        emailFrom: process.env.SENDGRID_FROM_EMAIL || process.env.EMAIL_FROM || 'NO CONFIGURADO',
        emailConfiguredVar: emailConfigured,
        sgMailDefined: typeof sgMail !== 'undefined'
      },
      
      // 2. Estado de MongoDB
      mongodb: {
        connected: mongoConnected,
        readyState: mongoose.connection.readyState,
        // 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
        readyStateText: ['disconnected', 'connected', 'connecting', 'disconnecting'][mongoose.connection.readyState] || 'unknown',
        dbName: mongoose.connection.name
      },
      
      // 3. Configuración de notificaciones
      emailNotificationConfig: null,
      
      // 4. Admins disponibles
      admins: [],
      
      // 5. Emails que recibirían notificaciones
      emailRecipients: {
        sectionCompletion: [],
        dayCompletion: []
      }
    }

    try {
      // Obtener configuración de notificaciones
      const config = await EmailNotificationConfig.findOne()
      if (config) {
        diagnostics.emailNotificationConfig = {
          exists: true,
          sectionCompletion: {
            enabled: config.sectionCompletion?.enabled,
            adminCount: config.sectionCompletion?.enabledAdmins?.length || 0
          },
          dayCompletion: {
            enabled: config.dayCompletion?.enabled,
            adminCount: config.dayCompletion?.enabledAdmins?.length || 0
          },
          updatedAt: config.updatedAt
        }
      } else {
        diagnostics.emailNotificationConfig = { exists: false, message: 'No config found - will use defaults' }
      }

      // Obtener admins activos
      const admins = await User.find({
        $or: [{ role: 'admin' }, { role: 'superadmin' }],
        isActive: true
      }).select('email username fullName role isActive')

      diagnostics.admins = admins.map(a => ({
        username: a.username,
        email: a.email ? `${a.email.substring(0, 3)}...@${a.email.split('@')[1]}` : 'NO EMAIL',
        hasValidEmail: !!(a.email && a.email.includes('@')),
        role: a.role,
        isActive: a.isActive
      }))

      // Probar getAdminEmails
      const sectionEmails = await getAdminEmails('sectionCompletion')
      const dayEmails = await getAdminEmails('dayCompletion')
      
      diagnostics.emailRecipients = {
        sectionCompletion: {
          count: sectionEmails.length,
          emails: sectionEmails.map(e => `${e.substring(0, 3)}...@${e.split('@')[1]}`)
        },
        dayCompletion: {
          count: dayEmails.length,
          emails: dayEmails.map(e => `${e.substring(0, 3)}...@${e.split('@')[1]}`)
        }
      }

    } catch (err) {
      diagnostics.error = err.message
      diagnostics.errorStack = err.stack
    }

    res.json(diagnostics)
  } catch (err) {
    console.error('Email debug endpoint error:', err)
    res.status(500).json({ error: err.message, stack: err.stack })
  }
})

// POST /api/emails/test - Test email sending (Super Admin only)
app.post('/api/emails/test', authenticateToken, async (req, res) => {
  try {
    // Solo permitir a superadmin
    let dbUser = null
    try {
      if (req.user && req.user.userId) {
        dbUser = await User.findById(req.user.userId)
      }
    } catch (err) {
      console.warn('Could not fetch user from DB:', err.message)
    }
    
    const isSuperAdmin = dbUser?.role === 'superadmin' || req.user?.role === 'superadmin'
    
    if (!isSuperAdmin) {
      return res.status(403).json({ error: 'Solo superadmin puede probar emails' })
    }

    const testEmail = req.body.email || dbUser?.email || req.user?.email
    
    console.log('========== TEST EMAIL ==========')
    console.log('To:', testEmail)
    console.log('emailConfigured:', emailConfigured)
    console.log('emailFrom:', emailFrom)
    console.log('SENDGRID_API_KEY exists:', !!process.env.SENDGRID_API_KEY)
    console.log('SENDGRID_API_KEY length:', process.env.SENDGRID_API_KEY?.length || 0)
    console.log('SENDGRID_FROM_EMAIL:', process.env.SENDGRID_FROM_EMAIL)
    
    if (!testEmail) {
      return res.status(400).json({ 
        success: false, 
        error: 'No email address provided. Provide email in request body or ensure user has email.' 
      })
    }
    
    try {
      const result = await sendEmail(
        testEmail,
        '🧪 Test Email - Bright Works',
        `
          <div style="font-family: Arial, sans-serif; padding: 20px; background: #f5f5f5;">
            <div style="background: white; border-radius: 8px; padding: 30px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
              <h1 style="color: #1e40af; margin-top: 0;">✅ Email Test Successful!</h1>
              <p>Este es un email de prueba enviado el <strong>${new Date().toLocaleString()}</strong></p>
              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
              <p><strong>Server:</strong> ${process.env.RENDER_SERVICE_NAME || 'local'}</p>
              <p><strong>Node:</strong> ${process.version}</p>
              <p><strong>From:</strong> ${emailFrom}</p>
              <p><strong>SendGrid Configured:</strong> ${emailConfigured ? '✅ Yes' : '❌ No'}</p>
              <p style="color: #666; font-size: 12px; margin-top: 20px;">
                Si recibiste este email, el sistema de envío está funcionando correctamente.
              </p>
            </div>
          </div>
        `
      )
      
      console.log('Test email result:', JSON.stringify({
        success: result.success,
        message: result.message,
        recipients: result.recipients
      }, null, 2))
      
      res.json({ 
        success: result.success, 
        message: result.message,
        recipients: result.recipients,
        details: {
          to: testEmail,
          from: emailFrom,
          emailConfigured: emailConfigured,
          sendgridApiKeyExists: !!process.env.SENDGRID_API_KEY
        }
      })
    } catch (err) {
      console.error('Test email error:', err)
      console.error('Test email error stack:', err.stack)
      res.status(500).json({ 
        success: false, 
        error: err.message,
        stack: err.stack,
        details: {
          to: testEmail,
          from: emailFrom,
          emailConfigured: emailConfigured
        }
      })
    }
  } catch (err) {
    console.error('Test email endpoint error:', err)
    res.status(500).json({ 
      success: false,
      error: err.message,
      stack: err.stack
    })
  }
})

// Rate limiting para API
app.use('/api', generalLimiter)

// ═══════════════════════════════════════════════════════════════
// 📁 ARCHIVOS ESTÁTICOS
// ═══════════════════════════════════════════════════════════════

const distPath = path.join(__dirname, 'dist')
app.use(express.static(distPath, {
  maxAge: '1y',
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache')
    }
  }
}))

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// SPA fallback
app.get('*', (_req, res) => {
  res.sendFile(path.join(distPath, 'index.html'))
})

// ═══════════════════════════════════════════════════════════════
// 🚀 INICIO
// ═══════════════════════════════════════════════════════════════

const server = app.listen(PORT, () => {
  console.log(`✅ Servidor en http://localhost:${PORT}`)
  console.log(`🗄️ MongoDB: ${mongoConnected ? 'Connected' : 'Disconnected'}`)
  console.log(`🛡️ Rate limiting activo`)
})

process.on('SIGTERM', () => {
  server.close(() => process.exit(0))
})

process.on('SIGTERM', () => {
  server.close(() => process.exit(0))
})
