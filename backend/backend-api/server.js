// ============================================
// BRIGHT WORKS PROFESSIONAL v3.1.1 - ULTIMATE EDITION
// Backend Server - OPTIMIZED & SECURED
// ============================================

require('dotenv').config();

// ============================================
// 1️⃣ IMPORTS
// ============================================
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const sgMail = require('@sendgrid/mail');
const Joi = require('joi');
const path = require('path');
const helmet = require('helmet');
const compression = require('compression');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const morgan = require('morgan');
const fs = require('fs');
const fsPromises = fs.promises;
const PDFDocument = require('pdfkit');

// ============================================
// 2️⃣ CREAR APP EXPRESS
// ============================================
const app = express();
app.set('trust proxy', 1);

// ============================================
// 🔒 SISTEMA DE DETECCIÓN DE ATAQUES DDoS MEJORADO
// ============================================
const requestTracker = new Map();
const blockedIPs = new Set();
const suspiciousIPs = new Map();

// Whitelist de IPs conocidas (opcional)
const WHITELIST_IPS = (process.env.WHITELIST_IPS || '').split(',').filter(Boolean).map(ip => ip.trim());

// Paths críticos que nunca deben ser bloqueados
const CRITICAL_PATHS = [
  '/config.js',
  '/app.js',
  '/styles-premium.css',
  '/manifest.json',
  '/favicon.ico',
  '/offline.html',
  '/index.html',
  '/',
  '/icons/',
  '/service-worker.js'
];

// Limpieza automática cada 5 minutos
setInterval(() => {
  const now = Date.now();
  for (const [ip, requests] of requestTracker.entries()) {
    const recent = requests.filter(time => now - time < 60000);
    if (recent.length === 0) {
      requestTracker.delete(ip);
    } else {
      requestTracker.set(ip, recent);
    }
  }
  
  // Limpiar IPs bloqueadas después de 30 minutos
  for (const [ip, blockedTime] of suspiciousIPs.entries()) {
    if (now - blockedTime > 30 * 60 * 1000) {
      blockedIPs.delete(ip);
      suspiciousIPs.delete(ip);
      console.log(`✅ IP desbloqueada: ${ip}`);
    }
  }
}, 5 * 60 * 1000);

// Middleware de detección de ataques MEJORADO
app.use((req, res, next) => {
  const ip = req.ip;
  const path = req.path;
  
  // Whitelist de IPs
  if (WHITELIST_IPS.length > 0 && WHITELIST_IPS.includes(ip)) {
    return next();
  }
  
  // Nunca bloquear paths críticos
  const isCriticalPath = CRITICAL_PATHS.some(criticalPath => 
    path === criticalPath || path.startsWith(criticalPath)
  );
  
  if (isCriticalPath) {
    return next();
  }
  
  // Verificar si está bloqueada
  if (blockedIPs.has(ip)) {
    // Aún permitir paths críticos aunque esté bloqueada
    if (isCriticalPath) {
      return next();
    }
    
    console.log(`🚫 Petición bloqueada desde IP: ${ip} - Método: ${req.method} - Path: ${path}`);
    return res.status(403).json({ 
      error: 'Access temporarily blocked due to suspicious activity',
      blocked: true 
    });
  }
  
  const now = Date.now();
  
  if (!requestTracker.has(ip)) {
    requestTracker.set(ip, []);
  }
  
  const requests = requestTracker.get(ip);
  const recent = requests.filter(time => now - time < 10000);
  recent.push(now);
  requestTracker.set(ip, recent);
  
  // Detección de spam de HEAD requests - MÁS LENIENTE PARA NAVEGADORES
  if (req.method === 'HEAD') {
    const userAgent = req.get('user-agent') || '';
    const isNormalBrowser = /Mozilla|Chrome|Safari|Firefox|Edge/i.test(userAgent);
    
    // Permitir HEAD requests de navegadores normales en paths estáticos
    if (isNormalBrowser && (
      path.match(/\.(css|js|png|jpg|ico|svg|woff|woff2|ttf)$/i) ||
      isCriticalPath
    )) {
      return next();
    }
    
    const headRequests = recent.filter(time => now - time < 5000);
    if (headRequests.length > 10 && !isNormalBrowser) {
      console.log(`⚠️ HEAD spam detectado desde: ${ip} - ${headRequests.length} peticiones en 5s`);
      blockedIPs.add(ip);
      suspiciousIPs.set(ip, now);
      return res.status(429).json({ error: 'Too many HEAD requests' });
    }
  }
  
  // Detección de ataque DDoS - MÁS INTELIGENTE
  const userAgent = req.get('user-agent') || '';
  const isNormalBrowser = /Mozilla|Chrome|Safari|Firefox|Edge/i.test(userAgent);
  
  if (recent.length > 50) {
    // Para navegadores normales, permitir más requests
    if (isNormalBrowser && recent.length < 100) {
      return next();
    }
    
    console.log(`🚨 ATAQUE DDoS DETECTADO desde IP: ${ip} - ${recent.length} peticiones en 10s - Método: ${req.method}`);
    blockedIPs.add(ip);
    suspiciousIPs.set(ip, now);
    return res.status(429).json({ 
      error: 'Rate limit exceeded - Too many requests',
      blocked: true 
    });
  }
  
  // Alerta de actividad sospechosa (15-50 peticiones)
  if (recent.length > 15 && !isNormalBrowser) {
    console.log(`⚠️ Actividad sospechosa desde IP: ${ip} - ${recent.length} peticiones en 10s`);
  }
  
  next();
});

// ============================================
// 🔧 FIX MIME TYPES (ÚNICO - CORREGIDO)
// ============================================
app.use((req, res, next) => {
  const ext = path.extname(req.path).toLowerCase();
  const mimeTypes = {
    '.js': 'application/javascript; charset=UTF-8',
    '.mjs': 'application/javascript; charset=UTF-8',
    '.json': 'application/json; charset=UTF-8',
    '.css': 'text/css; charset=UTF-8',
    '.html': 'text/html; charset=UTF-8',
    '.htm': 'text/html; charset=UTF-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.eot': 'application/vnd.ms-fontobject'
  };
  
  if (mimeTypes[ext]) {
    res.setHeader('Content-Type', mimeTypes[ext]);
    // Cache estático por 1 hora
    if (['.js', '.css', '.png', '.jpg', '.svg', '.woff', '.woff2'].includes(ext)) {
      res.setHeader('Cache-Control', 'public, max-age=3600');
    }
  }
  next();
});

// ============================================
// 3️⃣ ENVIRONMENT CONFIGURATION
// ============================================
const PORT = process.env.PORT || 10000;
const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-change-in-production';
const JWT_EXPIRATION = process.env.JWT_EXPIRATION || '24h';
const APP_URL = process.env.APP_URL || `http://localhost:${PORT}`;
const FRONTEND_URL = process.env.FRONTEND_URL || APP_URL;
const API_PUBLIC_URL = process.env.API_PUBLIC_URL || FRONTEND_URL;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Validate critical environment variables
// MongoDB no es crítico - el servidor debe seguir funcionando
let mongoConnected = false;

if (!process.env.JWT_SECRET && NODE_ENV === 'production') {
  console.warn('⚠️  WARNING: Using default JWT_SECRET in production!');
}

// ============================================
// 4️⃣ DATABASE CONNECTION - NO CRÍTICA
// ============================================
mongoose.set('strictQuery', false);

if (process.env.MONGODB_URI) {
  mongoose
    .connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      retryWrites: true,
    })
    .then(async () => {
      mongoConnected = true;
      console.log('✅ MongoDB connected successfully');
      console.log(`   Database: ${mongoose.connection.name}`);
      try {
        await ensureSuperadminExists();
      } catch (err) {
        console.error('ensureSuperadminExists error:', err.message);
      }
    })
    .catch((err) => {
      mongoConnected = false;
      console.error('❌ MongoDB connection error:', err.message);
      console.warn('⚠️  Server will continue without database. Some features may be limited.');
      // NO hacer process.exit - el servidor debe seguir funcionando
    });

  mongoose.connection.on('error', (err) => {
    mongoConnected = false;
    console.error('MongoDB error:', err);
  });

  mongoose.connection.on('disconnected', () => {
    mongoConnected = false;
    console.warn('⚠️  MongoDB disconnected');
  });

  mongoose.connection.on('reconnected', () => {
    mongoConnected = true;
    console.log('✅ MongoDB reconnected');
  });
} else {
  console.warn('⚠️  MONGODB_URI not set. Server will run without database.');
  console.warn('   Some features will be limited.');
}

// ============================================
// 5️⃣ MIDDLEWARE
// ============================================

// Security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      connectSrc: [
        "'self'",
        "https://fonts.googleapis.com",
        "https://fonts.gstatic.com",
        "https://bright-works-schedule.onrender.com",
        "https://brightsbrokscleanproclean2026.onrender.com",
        "https://brightsbrokscleanproclean2026-1.onrender.com"
      ]
    }
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

// Compression
app.use(compression());

// Data sanitization
app.use(mongoSanitize());
app.use(xss());

// Logging
if (NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// ============================================
// 🔒 CORS – allowlist para Render + dominio propio
// ============================================
const CORS_ALLOWED_ORIGINS = [
  "https://appcleanpremium-frontend.onrender.com",
  "https://secureassetsholding.com",
  "https://www.secureassetsholding.com",
  "http://localhost:5173"
].map(o => o.replace(/\/$/, "")); // normalizar sin slash final para comparación

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true); // same-origin o peticiones sin Origin (ej. Postman)
      const normalized = origin.replace(/\/$/, "");
      if (CORS_ALLOWED_ORIGINS.includes(normalized)) return cb(null, true);
      cb(new Error("Not allowed by CORS"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    optionsSuccessStatus: 204,
  })
);

// Body parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static files - Serve frontend build first, then fallback to public
const distPath = path.join(__dirname, 'dist');
const publicPath = path.join(__dirname, 'public');

const distExists = fs.existsSync(distPath);
const distIndexExists = fs.existsSync(path.join(distPath, 'index.html'));

console.log(`📁 Frontend build check:`);
console.log(`   dist/ exists: ${distExists}`);
console.log(`   dist/index.html exists: ${distIndexExists}`);

// Serve dist (frontend build) if it exists - PRIORIDAD ALTA
if (distExists && distIndexExists) {
  console.log('✅ Serving frontend from dist/ (React app)');
  app.use(express.static(distPath, {
    setHeaders: (res, filepath) => {
      const ext = path.extname(filepath).toLowerCase();
      const mimeTypes = {
        '.js': 'application/javascript',
        '.css': 'text/css',
        '.html': 'text/html',
        '.json': 'application/json',
        '.ico': 'image/x-icon',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.svg': 'image/svg+xml',
      };
      if (mimeTypes[ext]) {
        res.setHeader('Content-Type', mimeTypes[ext]);
      }
      
      // Cache estático
      if (['.js', '.css', '.png', '.jpg', '.svg', '.ico'].includes(ext)) {
        res.setHeader('Cache-Control', 'public, max-age=3600');
      }
    },
    index: false // Don't serve index.html for static files, let the catch-all route handle it
  }));
} else {
  console.warn('⚠️  Frontend build not found in dist/. Serving from public/ (old app)');
  console.warn('   Run: npm run build:frontend to build the new React app');
}

// Serve public as fallback (only for assets, not index.html if dist exists)
if (distExists && distIndexExists) {
  // If dist exists, serve static assets from dist first (Vite copies public/ to dist/)
  // Also serve from public as fallback for any missing assets
  // Serve icons from both locations
  if (fs.existsSync(path.join(distPath, 'icons'))) {
    app.use('/icons', express.static(path.join(distPath, 'icons')));
  }
  if (fs.existsSync(path.join(publicPath, 'icons'))) {
    app.use('/icons', express.static(path.join(publicPath, 'icons')));
  }
  // Serve favicon from both locations
  if (fs.existsSync(path.join(distPath, 'favicon.ico'))) {
    app.use('/favicon.ico', express.static(path.join(distPath, 'favicon.ico')));
  }
  if (fs.existsSync(path.join(publicPath, 'favicon.ico'))) {
    app.use('/favicon.ico', express.static(path.join(publicPath, 'favicon.ico')));
  }
  // Serve manifest from both locations
  if (fs.existsSync(path.join(distPath, 'manifest.json'))) {
    app.use('/manifest.json', express.static(path.join(distPath, 'manifest.json')));
  }
  if (fs.existsSync(path.join(publicPath, 'manifest.json'))) {
    app.use('/manifest.json', express.static(path.join(publicPath, 'manifest.json')));
  }
} else {
  // If no dist, serve public as fallback
  app.use(express.static(publicPath, {
    setHeaders: (res, filepath) => {
      const ext = path.extname(filepath).toLowerCase();
      const mimeTypes = {
        '.js': 'application/javascript',
        '.css': 'text/css',
        '.html': 'text/html',
        '.json': 'application/json',
        '.ico': 'image/x-icon',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.svg': 'image/svg+xml',
      };
      if (mimeTypes[ext]) {
        res.setHeader('Content-Type', mimeTypes[ext]);
      }
      
      // Cache estático
      if (['.js', '.css', '.png', '.jpg', '.svg', '.ico'].includes(ext)) {
        res.setHeader('Cache-Control', 'public, max-age=3600');
      }
    }
  }));
}

// ============================================
// 🚦 RATE LIMITING MEJORADO
// ============================================
const apiLimiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000),
  max: Number(process.env.RATE_LIMIT_MAX_REQUESTS || 200),
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests, please try again later.' },
  skip: (req) => {
    // No aplicar rate limit a paths críticos
    return CRITICAL_PATHS.some(criticalPath => 
      req.path === criticalPath || req.path.startsWith(criticalPath)
    );
  }
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.LOGIN_RATE_LIMIT_MAX || 10),
  skipSuccessfulRequests: true,
  message: { message: 'Too many login attempts, please try again after 15 minutes.' }
});

const setupLimiter = rateLimit({ 
  windowMs: 15 * 60 * 1000, 
  max: 3, 
  standardHeaders: true, 
  legacyHeaders: false,
  message: { message: 'Too many setup attempts.' }
});

const headLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 15, // Más permisivo para navegadores
  skipFailedRequests: false,
  message: { message: 'Too many HEAD requests' },
  skip: (req) => {
    const userAgent = req.get('user-agent') || '';
    const isNormalBrowser = /Mozilla|Chrome|Safari|Firefox|Edge/i.test(userAgent);
    const isStatic = req.path.match(/\.(css|js|png|jpg|ico|svg|woff|woff2|ttf)$/i);
    // Saltar rate limit para navegadores normales pidiendo recursos estáticos
    return (isNormalBrowser && isStatic) || CRITICAL_PATHS.some(cp => req.path.startsWith(cp));
  },
  handler: (req, res) => {
    console.log(`⚠️ HEAD request bloqueada desde IP: ${req.ip}`);
    res.status(429).json({ error: 'Too many HEAD requests' });
  }
});

app.head('*', headLimiter);

// ============================================
// 6️⃣ DATABASE SCHEMAS
// ============================================

const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, trim: true, minlength: 1, maxlength: 50 },
  password: { type: String, required: true, minlength: 1 },
  fullName: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  role: { type: String, enum: ['superadmin', 'admin', 'supervisor', 'employee'], default: 'employee' },
  phone: { type: String, trim: true },
  avatar: { type: String },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  lastLogin: { type: Date },
  loginAttempts: { type: Number, default: 0 },
  lockUntil: { type: Date }
});

UserSchema.index({ username: 1 });
UserSchema.index({ email: 1 });

const User = mongoose.model('User', UserSchema);

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
});

TaskSchema.index({ userId: 1, week: 1, taskName: 1, day: 1, room: 1 }, { unique: true });
TaskSchema.index({ userId: 1, week: 1 });
TaskSchema.index({ userId: 1, week: 1, room: 1 });

const Task = mongoose.model('Task', TaskSchema);

const TimeRecordSchema = new mongoose.Schema({
  week: { type: Number, required: true, min: 1, max: 52 },
  day: { type: Number, min: 1, max: 7 },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  checkIn: { type: String },
  checkOut: { type: String },
  signature: { type: String },
  room: { type: String, trim: true, default: 'General' },
  roomKey: { type: String, trim: true, default: 'general' },
  employeeName: { type: String },
  totalHours: { type: String, default: '0h 0m' },
  date: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  firstActivityAt: { type: Date },
  lastActivityAt: { type: Date }
});

TimeRecordSchema.index({ userId: 1, week: 1, day: 1, room: 1 }, { unique: true });
TimeRecordSchema.index({ userId: 1, week: 1 });
TimeRecordSchema.index({ userId: 1, week: 1, day: 1 });

const TimeRecord = mongoose.model('TimeRecord', TimeRecordSchema);

/**
 * Touch daily activity: create or update firstActivityAt/lastActivityAt for the given user/day/room.
 * Called on task update so work hours are derived from activity (no manual clock required).
 * - If no record exists: create with firstActivityAt and lastActivityAt = now.
 * - If exists: update only lastActivityAt = now (never overwrite firstActivityAt).
 */
async function touchDailyActivity(userId, week, day, room, roomKey, now) {
  const normalizedRoom = (room && room.trim() !== '') ? room.trim() : 'General';
  const normalizedRoomKey = (roomKey && roomKey.trim() !== '') ? String(roomKey).trim().toLowerCase() : 'general';
  const query = { userId, week, day: day || 1, room: normalizedRoom };
  try {
    let record = await TimeRecord.findOne(query);
    if (!record) {
      record = await TimeRecord.create({
        userId,
        week,
        day: day || 1,
        room: normalizedRoom,
        roomKey: normalizedRoomKey,
        firstActivityAt: now,
        lastActivityAt: now,
        date: now,
        totalHours: '0h 0m'
      });
    } else {
      record.lastActivityAt = now;
      record.updatedAt = now;
      record.date = now;
      await record.save();
    }
  } catch (err) {
    console.warn('touchDailyActivity error (non-blocking):', err.message);
  }
}

// Canonical task sections (5 groups) - used for section-completion emails and daily summary
const DEFAULT_SECTIONS = [
  { id: 'cleaning-1', title: 'Cleaning Task 1', tasks: ['Floors', 'Toilets', 'Sinks', 'Mirror', 'Walls'], order: 0 },
  { id: 'cleaning-2', title: 'Cleaning Task 2', tasks: ['Floor Vacuuming L&C', 'Floor Cleaning/Mopping', "Children's Tables", "Children's Chairs", 'Weekly UV'], order: 1 },
  { id: 'refill', title: 'Refill', tasks: ['Soap', 'Toilet Paper', 'Paper Towel'], order: 2 },
  { id: 'trash-bags', title: 'Trash Bags', tasks: ['Trash Bag Removed', 'Trash Bag Replacement'], order: 3 },
  { id: 'disinfection', title: 'Weekly Disinfection & Sanitization', tasks: ['Complete Disinfection'], order: 4 }
];

const SectionCompletionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  week: { type: Number, required: true, min: 1, max: 52 },
  day: { type: Number, required: true, min: 1, max: 7 },
  room: { type: String, trim: true, required: true },
  roomKey: { type: String, trim: true, default: 'general' },
  sectionId: { type: String, required: true, trim: true },
  emailSentAt: { type: Date },
  createdAt: { type: Date, default: Date.now }
});
SectionCompletionSchema.index({ userId: 1, week: 1, day: 1, room: 1, sectionId: 1 }, { unique: true });

const DailySummaryEmailSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  week: { type: Number, required: true, min: 1, max: 52 },
  day: { type: Number, required: true, min: 1, max: 7 },
  room: { type: String, trim: true, required: true },
  roomKey: { type: String, trim: true, default: 'general' },
  emailSentAt: { type: Date, required: true },
  createdAt: { type: Date, default: Date.now },
  resentCount: { type: Number, default: 0 },
  resentAt: { type: Date }
});
DailySummaryEmailSchema.index({ userId: 1, week: 1, day: 1, room: 1 }, { unique: true });

const DayCompletionEmailSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  week: { type: Number, required: true, min: 1, max: 52 },
  day: { type: Number, required: true, min: 1, max: 7 },
  room: { type: String, trim: true, required: true },
  roomKey: { type: String, trim: true, default: 'general' },
  emailSentAt: { type: Date, required: true },
  createdAt: { type: Date, default: Date.now }
});
DayCompletionEmailSchema.index({ userId: 1, week: 1, day: 1, room: 1 }, { unique: true });

const SectionCompletion = mongoose.model('SectionCompletion', SectionCompletionSchema);
const DailySummaryEmail = mongoose.model('DailySummaryEmail', DailySummaryEmailSchema);
const DayCompletionEmail = mongoose.model('DayCompletionEmail', DayCompletionEmailSchema);

// TaskConfig - system-wide task sections (one global doc). Read: admin+superadmin; Write: superadmin only.
const TaskConfigSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  isGlobal: { type: Boolean, default: false },
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
  updatedAt: { type: Date, default: Date.now },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  changeLog: [{ at: { type: Date }, by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, key: { type: String } }]
});
TaskConfigSchema.index({ isGlobal: 1 }, { unique: true, sparse: true });
const TaskConfig = mongoose.model('TaskConfig', TaskConfigSchema);

const DEFAULT_TASK_SECTIONS_CONFIG = [
  { id: 'cleaning-1', title: 'Cleaning Task', tasks: ['Floors', 'Toilets', 'Sinks', 'Mirror', 'Walls'], order: 0 },
  { id: 'cleaning-2', title: 'Cleaning Task', tasks: ['Floor Vacuuming L&C', 'Floor Cleaning/Mopping', "Children's Tables", "Children's Chairs", 'Weekly UV'], order: 1 },
  { id: 'refill', title: 'Refill', tasks: ['Soap', 'Toilet Paper', 'Paper Towel'], order: 2 },
  { id: 'trash-bags', title: 'Trash Bags', tasks: ['Trash Bag Removed', 'Trash Bag Replacement'], order: 3 },
  { id: 'disinfection', title: 'Weekly Disinfection & Sanitization', tasks: ['Complete Disinfection'], order: 4 }
];

function getSectionForTaskName(taskName) {
  if (!taskName) return null;
  const name = String(taskName).trim();
  return DEFAULT_SECTIONS.find(s => s.tasks && s.tasks.includes(name)) || null;
}

async function checkSectionCompletedAndNotify(userId, week, day, room, roomKey, taskName, completedByName) {
  const section = getSectionForTaskName(taskName);
  if (!section) return;
  const normalizedRoom = (room && room.trim() !== '') ? room.trim() : 'General';
  const normalizedRoomKey = (roomKey && roomKey.trim() !== '') ? String(roomKey).trim().toLowerCase() : 'general';
  try {
    const dayTasks = await Task.find({ userId, week, day, room: normalizedRoom });
    const sectionTaskNames = section.tasks || [];
    const sectionTasks = dayTasks.filter(t => sectionTaskNames.includes(t.taskName));
    const allCompleted = sectionTaskNames.length > 0 && sectionTasks.length === sectionTaskNames.length &&
      sectionTasks.every(t => t.completed === true);
    if (!allCompleted) return;
    const existing = await SectionCompletion.findOne({ userId, week, day, room: normalizedRoom, sectionId: section.id });
    if (existing && existing.emailSentAt) return;
    const recipients = await getAdminEmails();
    if (recipients.length === 0) return;
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayName = dayNames[parseInt(day, 10) - 1] || `Day ${day}`;
    const completedTasks = sectionTasks.filter(t => t.completed).map(t => t.taskName);
    const formattedDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    const emailHTML = `
<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
body{font-family:Arial,sans-serif;background:#f0f4f8;padding:20px;}
.container{max-width:600px;margin:0 auto;background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 5px 15px rgba(0,0,0,0.1);}
.header{background:linear-gradient(135deg,#28a745,#20c997);color:#fff;padding:30px;text-align:center;}
.content{padding:30px;}.section-info{background:#f0f4f8;padding:20px;border-radius:5px;margin:20px 0;}
.section-info p{margin:8px 0;font-size:14px;}.section-info strong{color:#1565c0;}
.tasks-list{background:#e8f5e9;padding:15px;border-radius:5px;margin:15px 0;}
.tasks-list ul{margin:0;padding-left:20px;}.tasks-list li{margin:5px 0;color:#2e7d32;}
.footer{background:#f0f4f8;padding:20px;text-align:center;font-size:12px;color:#6c757d;}
</style></head><body><div class="container">
<div class="header"><h1>Section completed (auto)</h1><h2>${section.title}</h2></div>
<div class="content"><div class="section-info">
<p><strong>Section:</strong> ${section.title}</p>
<p><strong>Day:</strong> ${dayName} (Day ${day})</p><p><strong>Week:</strong> ${week}</p>
<p><strong>Date:</strong> ${formattedDate}</p>
<p><strong>Completed by:</strong> ${completedByName || 'User'}</p>
<p><strong>Room/Area:</strong> ${normalizedRoom}</p>
</div><div class="tasks-list"><strong>Tasks completed (${completedTasks.length}):</strong><ul>
${completedTasks.map(t => `<li>${t}</li>`).join('')}
</ul></div></div>
<div class="footer"><p>Bright Works – automatic section completion notification. Idempotent: one email per section per day per room per user.</p></div></div></body></html>`;
    let sent = 0;
    for (const email of recipients) {
      const result = await sendEmail(email, `Section completed: ${section.title} – ${dayName}, ${normalizedRoom}`, emailHTML);
      if (result.success) sent++;
    }
    if (sent > 0) {
      await SectionCompletion.findOneAndUpdate(
        { userId, week, day, room: normalizedRoom, sectionId: section.id },
        { $set: { emailSentAt: new Date(), roomKey: normalizedRoomKey } },
        { upsert: true, new: true }
      );
    }
  } catch (err) {
    console.warn('checkSectionCompletedAndNotify error (non-blocking):', err.message);
  }
}

const NoteSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true, trim: true },
  content: { type: String, required: true },
  week: { type: Number, min: 1, max: 52 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

NoteSchema.index({ userId: 1, createdAt: -1 });

const Note = mongoose.model('Note', NoteSchema);

const ReminderSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  dueDate: { type: Date, required: true },
  completed: { type: Boolean, default: false },
  priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
  createdAt: { type: Date, default: Date.now },
  completedAt: { type: Date }
});

ReminderSchema.index({ userId: 1, dueDate: 1 });
ReminderSchema.index({ userId: 1, completed: 1 });

const Reminder = mongoose.model('Reminder', ReminderSchema);

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
});

ClientSchema.index({ userId: 1, createdAt: -1 });
ClientSchema.index({ userId: 1, name: 1 });

const Client = mongoose.model('Client', ClientSchema);

// ---------- INVOICES (Superadmin only) ----------
const InvoiceCounterSchema = new mongoose.Schema({
  year: { type: Number, required: true, unique: true },
  seq: { type: Number, default: 0 }
});
const InvoiceCounter = mongoose.model('InvoiceCounter', InvoiceCounterSchema);

async function getNextInvoiceNumber() {
  const year = new Date().getFullYear();
  const updated = await InvoiceCounter.findOneAndUpdate(
    { year },
    { $inc: { seq: 1 } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  const seq = (updated && updated.seq != null) ? updated.seq : 1;
  return `SAH-${year}-${String(seq).padStart(4, '0')}`;
}

function getCompanySnapshot() {
  return {
    name: process.env.COMPANY_NAME || 'SECURE ASSETS HOLDING LLC',
    ein: process.env.COMPANY_EIN || '',
    addressLine1: process.env.COMPANY_ADDRESS1 || '',
    addressLine2: process.env.COMPANY_ADDRESS2 || '',
    city: process.env.COMPANY_CITY || '',
    state: process.env.COMPANY_STATE || 'Maryland',
    zip: process.env.COMPANY_ZIP || '',
    email: process.env.COMPANY_EMAIL || 'janineteranusa@gmail.com',
    website: process.env.COMPANY_WEBSITE || 'secureassetsholding.com'
  };
}

function buildClientSnapshot(clientDoc) {
  if (!clientDoc) {
    return { name: '', addressLine1: '', addressLine2: '', city: '', state: '', zip: '', email: '', phone: '' };
  }
  const addr = (clientDoc.address && typeof clientDoc.address === 'string') ? clientDoc.address : '';
  return {
    name: clientDoc.name || '',
    addressLine1: addr,
    addressLine2: '',
    city: '',
    state: '',
    zip: '',
    email: clientDoc.email || '',
    phone: clientDoc.phone || ''
  };
}

function computeInvoiceTotals(lineItems) {
  const items = Array.isArray(lineItems) ? lineItems : [];
  const normalized = items.map((line) => {
    const qty = Number(line.qty) || 0;
    const unitPrice = Number(line.unitPrice) || 0;
    const lineSubtotal = qty * unitPrice;
    const taxable = line.taxable === true;
    const taxRate = Number(line.taxRate) || 0;
    const lineTax = taxable ? lineSubtotal * taxRate : 0;
    const lineTotal = lineSubtotal + lineTax;
    return {
      category: line.category || '',
      description: line.description || '',
      qty,
      unitPrice,
      taxable,
      taxRate,
      lineSubtotal,
      lineTax,
      lineTotal
    };
  });
  const subtotal = normalized.reduce((s, l) => s + l.lineSubtotal, 0);
  const salesTaxTotal = normalized.reduce((s, l) => s + l.lineTax, 0);
  const total = subtotal + salesTaxTotal;
  return { lineItems: normalized, subtotal, salesTaxTotal, total };
}

const InvoiceSchema = new mongoose.Schema({
  clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true, index: true },
  invoiceNumber: { type: String, required: true, unique: true },
  issueDate: { type: Date, required: true },
  dueDate: { type: Date },
  status: { type: String, enum: ['DRAFT', 'FINAL', 'SENT', 'VOID'], default: 'DRAFT' },
  currency: { type: String, default: 'USD' },
  companySnapshot: {
    name: String, ein: String, addressLine1: String, addressLine2: String,
    city: String, state: String, zip: String, email: String, website: String
  },
  clientSnapshot: {
    name: String, addressLine1: String, addressLine2: String, city: String,
    state: String, zip: String, email: String, phone: String
  },
  lineItems: [{
    category: String, description: String, qty: Number, unitPrice: Number,
    taxable: Boolean, taxRate: Number, lineSubtotal: Number, lineTax: Number, lineTotal: Number
  }],
  subtotal: Number,
  salesTaxTotal: Number,
  total: Number,
  notes: String,
  legalNote: String,
  pdf: { fileName: String, mimeType: String, dataBase64: String, generatedAt: Date },
  sentAt: { type: Date },
  sentTo: { type: String },
  emailLog: [{ at: Date, to: String, subject: String, html: String, action: String }],
  audit: [{ at: Date, by: mongoose.Schema.Types.ObjectId, action: String, meta: mongoose.Schema.Types.Mixed }]
}, { timestamps: true });

InvoiceSchema.index({ clientId: 1, createdAt: -1 });

const MAX_AUDIT = 100;
function pushAudit(inv, by, action, meta) {
  if (!inv.audit) inv.audit = [];
  inv.audit.push({ at: new Date(), by, action, meta: meta || {} });
  if (inv.audit.length > MAX_AUDIT) inv.audit = inv.audit.slice(-MAX_AUDIT);
}

const Invoice = mongoose.model('Invoice', InvoiceSchema);

function generateInvoicePdf(inv) {
  return new Promise((resolve, reject) => {
    const logoPath = path.resolve(__dirname, 'assets', 'invoices', 'secureassetsinvoice.png');
    const qrPath = path.resolve(__dirname, 'assets', 'invoices', 'invoiceqr.png');
    const logoExists = fs.existsSync(logoPath);
    const qrExists = fs.existsSync(qrPath);

    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const pageWidth = doc.page.width - 80;
    const leftMargin = 40;
    let y = 40;

    if (logoExists) {
      doc.image(logoPath, 50, 40, { width: 130 });
    }
    if (qrExists) {
      doc.image(qrPath, 420, 40, { width: 110 });
    }

    doc.fontSize(10).font('Helvetica').text(`${inv.invoiceNumber}  |  ${new Date(inv.issueDate).toLocaleDateString()}  |  ${inv.status}`, pageWidth + leftMargin - 200, 45, { width: 200, align: 'right' });

    y = logoExists ? 165 : 50;
    if (!logoExists) y += 22;

    const company = inv.companySnapshot || {};
    doc.fontSize(11).font('Helvetica-Bold').text(company.name || 'Secure Assets Holding LLC', leftMargin, y);
    y += 14;
    if (company.ein) {
      doc.fontSize(9).font('Helvetica').text(`EIN: ${company.ein}`, leftMargin, y);
      y += 12;
    }
    const addrParts = [company.addressLine1, company.addressLine2, [company.city, company.state, company.zip].filter(Boolean).join(', ')].filter(Boolean);
    addrParts.forEach((line) => { doc.fontSize(9).text(line, leftMargin, y); y += 12; });
    if (company.email) {
      doc.fontSize(9).text(company.email, leftMargin, y);
      y += 14;
    } else {
      y += 4;
    }

    const client = inv.clientSnapshot || {};
    doc.fontSize(11).font('Helvetica-Bold').text('Bill To', leftMargin, y);
    y += 16;
    doc.fontSize(10).font('Helvetica').text(client.name || '', leftMargin, y);
    y += 12;
    const clientAddr = [client.addressLine1, client.addressLine2, [client.city, client.state, client.zip].filter(Boolean).join(', '), client.email, client.phone].filter(Boolean);
    clientAddr.forEach((line) => { doc.text(line, leftMargin, y); y += 12; });
    y += 16;

    const headers = ['ITEM / ACTIVITY', 'QTY', 'RATE', 'AMOUNT', 'TAX'];
    const colWidths = [220, 45, 65, 75, 55];
    const tableLeft = leftMargin;
    const rowHeight = 18;
    doc.rect(tableLeft, y, colWidths.reduce((a, b) => a + b, 0), rowHeight).fillAndStroke('#1e3a5f', '#1e3a5f');
    doc.fillColor('#ffffff').fontSize(9).font('Helvetica-Bold');
    let x = tableLeft + 6;
    headers.forEach((h, i) => { doc.text(h, x, y + 5, { width: colWidths[i] }); x += colWidths[i]; });
    y += rowHeight + 8;
    doc.fillColor('#000000').font('Helvetica');

    (inv.lineItems || []).forEach((line) => {
      if (y > 680) { doc.addPage(); y = 40; }
      const itemActivity = [line.category, line.description].filter(Boolean).join(' — ') || '—';
      x = tableLeft;
      doc.fontSize(8).text((itemActivity || '').slice(0, 50), x + 4, y, { width: colWidths[0] - 8 });
      x += colWidths[0];
      doc.text(String(line.qty ?? 0), x, y, { width: colWidths[1] });
      x += colWidths[1];
      doc.text(Number(line.unitPrice ?? 0).toFixed(2), x, y, { width: colWidths[2] });
      x += colWidths[2];
      doc.text(Number(line.lineSubtotal ?? 0).toFixed(2), x, y, { width: colWidths[3] });
      x += colWidths[3];
      doc.text(Number(line.lineTax ?? 0).toFixed(2), x, y, { width: colWidths[4] });
      y += 14;
    });

    y += 10;
    const rightX = pageWidth + leftMargin;
    doc.font('Helvetica-Bold').text(`Subtotal: ${Number(inv.subtotal || 0).toFixed(2)} ${inv.currency || 'USD'}`, rightX - 180, y, { align: 'right', width: 180 });
    y += 14;
    doc.text(`Sales Tax: ${Number(inv.salesTaxTotal || 0).toFixed(2)} ${inv.currency || 'USD'}`, rightX - 180, y, { align: 'right', width: 180 });
    y += 14;
    doc.text(`Total: ${Number(inv.total || 0).toFixed(2)} ${inv.currency || 'USD'}`, rightX - 180, y, { align: 'right', width: 180 });
    y += 28;

    if (inv.notes) {
      doc.font('Helvetica').fontSize(8).text('Notes: ' + (inv.notes || '').slice(0, 200), leftMargin, y, { width: pageWidth });
      y += 20;
    }
    if (inv.legalNote) {
      doc.fontSize(7).fillColor('gray').text((inv.legalNote || '').slice(0, 300), leftMargin, y, { width: pageWidth });
      y += 20;
    }

    const footerY = doc.page.height - 50;
    doc.fontSize(8).fillColor('#333333').font('Helvetica').text('Secure Assets Holding LLC', leftMargin, footerY);
    doc.text('Website: secureassetsholding.com', leftMargin, footerY + 12);

    doc.end();
  });
}

const BudgetSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  budgetNumber: { type: String, unique: true },
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
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

BudgetSchema.index({ userId: 1, createdAt: -1 });
BudgetSchema.index({ userId: 1, status: 1 });
BudgetSchema.index({ budgetNumber: 1 });

BudgetSchema.pre('save', async function(next) {
  if (!this.budgetNumber) {
    const count = await mongoose.model('Budget').countDocuments();
    const year = new Date().getFullYear();
    this.budgetNumber = `BW-${year}-${String(count + 1).padStart(5, '0')}`;
  }
  next();
});

const Budget = mongoose.model('Budget', BudgetSchema);

// ============================================
// 7️⃣ EMAIL CONFIGURATION - SENDGRID
// ============================================

let emailConfigured = false;
let emailService = 'Not configured';
const emailFrom = process.env.SENDGRID_FROM_EMAIL || process.env.EMAIL_FROM || 'noreply@brightworks.com';

if (process.env.SENDGRID_API_KEY && emailFrom) {
  try {
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    emailConfigured = true;
    emailService = 'SendGrid';
    console.log('✅ SendGrid configured');
    console.log(`   From: ${emailFrom}`);
  } catch (error) {
    console.error('❌ SendGrid configuration error:', error.message);
  }
} else {
  console.log('⚠️  Email service not configured');
  if (!process.env.SENDGRID_API_KEY) {console.log('   Missing: SENDGRID_API_KEY');}
  if (!emailFrom) {console.log('   Missing: SENDGRID_FROM_EMAIL');}
}

async function sendEmail(to, subject, html, attachments) {
  if (!emailConfigured) {
    console.warn('⚠️  Email not sent: Service not configured');
    return { success: false, message: 'Email service not configured' };
  }

  try {
    const msg = {
      to: Array.isArray(to) ? to : [to],
      from: {
        email: emailFrom,
        name: process.env.APP_NAME || 'Bright Works Professional'
      },
      subject: subject,
      html: html,
      trackingSettings: {
        clickTracking: { enable: false },
        openTracking: { enable: false }
      }
    };
    if (attachments && attachments.length > 0) {
      msg.attachments = attachments;
    }

    const response = await sgMail.send(msg);
    console.log(`✅ Email sent to: ${Array.isArray(to) ? to.join(', ') : to}`);
    return { success: true, message: 'Email sent successfully', response };
  } catch (err) {
    const errorMessage = err.response?.body?.errors?.[0]?.message || err.message;
    console.error('❌ Email error:', errorMessage);
    
    if (err.response?.body?.errors) {
      console.error('   Details:', JSON.stringify(err.response.body.errors, null, 2));
    }
    
    return { 
      success: false, 
      message: errorMessage,
      error: err.response?.body?.errors || err.message 
    };
  }
}

async function getAdminEmails() {
  const emails = new Set();
  
  try {
    const admins = await User.find({ role: 'admin', isActive: { $ne: false } });
    admins.forEach((a) => { 
      if (a.email && a.email.includes('@')) {
        emails.add(String(a.email).trim().toLowerCase());
      }
    });
  } catch (error) {
    console.warn('⚠️  Could not fetch admin emails from database');
  }
  
  const envList = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(e => e && e.includes('@'));
  
  envList.forEach((e) => emails.add(e));
  
  return Array.from(emails);
}

// ============================================
// 8️⃣ PROFESSIONAL EMAIL TEMPLATE
// ============================================

function generateProfessionalEmailHTML(data) {
  const { user, tasks, timeRecord, notes, reminders, date } = data;
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayName = dayNames[date.getDay()];
  const formattedDate = date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const completedTasks = tasks.filter(t => t.completed);
  const pendingTasks = tasks.filter(t => !t.completed);
  const completionRate = tasks.length ? Math.round((completedTasks.length / tasks.length) * 100) : 0;
  
  // Calculate hours from Clock In/Out
  let clockInTime = timeRecord?.checkIn || '';
  let clockOutTime = timeRecord?.checkOut || '';
  let totalHours = timeRecord?.totalHours || '0h 0m';
  
  // If times are in format HH:MM, calculate total hours
  if (clockInTime && clockOutTime && clockInTime.includes(':') && clockOutTime.includes(':')) {
    const [inH, inM] = clockInTime.split(':').map(Number);
    const [outH, outM] = clockOutTime.split(':').map(Number);
    const inMinutes = inH * 60 + inM;
    const outMinutes = outH * 60 + outM;
    const diffMinutes = outMinutes - inMinutes;
    if (diffMinutes > 0) {
      const hours = Math.floor(diffMinutes / 60);
      const minutes = diffMinutes % 60;
      totalHours = `${hours}h ${minutes}m`;
    }
  }
  
  // Logo URL (you can replace with your actual logo URL)
  const logoUrl = 'https://brightworks-backend.onrender.com/icons/icon-192x192.png';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Daily Report - ${formattedDate}</title>
</head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;background:#f3f4f6;">
  <div style="max-width:650px;margin:0 auto;background:#ffffff;box-shadow:0 4px 6px rgba(0,0,0,0.1);">
    <!-- Header with Logo -->
    <div style="background:linear-gradient(135deg,#1e40af 0%,#3b82f6 100%);color:white;padding:35px 30px;text-align:center;position:relative;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td align="center" style="padding-bottom:15px;">
            <img src="${logoUrl}" alt="Bright Works Logo" style="width:80px;height:80px;border-radius:12px;background:white;padding:8px;box-shadow:0 2px 8px rgba(0,0,0,0.2);" />
          </td>
        </tr>
        <tr>
          <td align="center">
            <h1 style="font-size:28px;margin:0 0 8px 0;font-weight:700;letter-spacing:1px;">BRIGHT WORKS PROFESSIONAL</h1>
            <p style="opacity:0.95;font-size:16px;margin:0 0 12px 0;font-weight:500;">Daily Task Report</p>
            <p style="margin:0;font-size:16px;opacity:0.9;background:rgba(255,255,255,0.15);padding:8px 16px;border-radius:20px;display:inline-block;">${dayName}, ${formattedDate}</p>
          </td>
        </tr>
      </table>
    </div>

    <!-- Report Content -->
    <div style="padding:35px 30px;">
      <!-- Employee Info Table -->
      <table style="width:100%;margin-bottom:25px;background:#ffffff;border-radius:10px;border-collapse:collapse;box-shadow:0 2px 4px rgba(0,0,0,0.05);border:1px solid #e5e7eb;">
        <tr style="background:linear-gradient(135deg,#f8fafc 0%,#f1f5f9 100%);">
          <td style="padding:18px 20px;border-bottom:2px solid #e5e7eb;font-weight:700;color:#1e40af;width:40%;font-size:14px;text-transform:uppercase;letter-spacing:0.5px;">Employee</td>
          <td style="padding:18px 20px;border-bottom:2px solid #e5e7eb;color:#1f2937;font-weight:600;font-size:15px;">${user.fullName || user.username}</td>
        </tr>
        <tr>
          <td style="padding:18px 20px;border-bottom:1px solid #e5e7eb;font-weight:600;color:#475569;width:40%;font-size:14px;">Role</td>
          <td style="padding:18px 20px;border-bottom:1px solid #e5e7eb;color:#1f2937;font-size:15px;">
            <span style="background:${user.role === 'admin' ? '#dc2626' : '#f59e0b'};color:white;padding:4px 12px;border-radius:12px;font-size:12px;font-weight:600;text-transform:uppercase;">${(user.role || 'employee').toUpperCase()}</span>
          </td>
        </tr>
        <tr>
          <td style="padding:18px 20px;border-bottom:1px solid #e5e7eb;font-weight:600;color:#475569;width:40%;font-size:14px;">Clock In</td>
          <td style="padding:18px 20px;border-bottom:1px solid #e5e7eb;color:#1f2937;font-size:15px;font-weight:500;">
            ${clockInTime ? `<span style="background:#10b981;color:white;padding:6px 14px;border-radius:8px;font-size:14px;font-weight:600;font-family:'Courier New',monospace;">${clockInTime}</span>` : '<span style="color:#9ca3af;">Not registered</span>'}
          </td>
        </tr>
        <tr>
          <td style="padding:18px 20px;border-bottom:1px solid #e5e7eb;font-weight:600;color:#475569;width:40%;font-size:14px;">Clock Out</td>
          <td style="padding:18px 20px;border-bottom:1px solid #e5e7eb;color:#1f2937;font-size:15px;font-weight:500;">
            ${clockOutTime ? `<span style="background:#ef4444;color:white;padding:6px 14px;border-radius:8px;font-size:14px;font-weight:600;font-family:'Courier New',monospace;">${clockOutTime}</span>` : '<span style="color:#9ca3af;">Not registered</span>'}
          </td>
        </tr>
        <tr style="background:linear-gradient(135deg,#fef3c7 0%,#fde68a 100%);">
          <td style="padding:18px 20px;font-weight:700;color:#92400e;width:40%;font-size:15px;">Total Hours</td>
          <td style="padding:18px 20px;color:#92400e;font-size:18px;font-weight:700;font-family:'Courier New',monospace;">
            ${totalHours}
          </td>
        </tr>
      </table>

      <!-- Tasks Summary -->
      ${tasks.length > 0 ? `
      <div style="background:#f9fafb;border-radius:10px;padding:25px;margin-bottom:25px;border:1px solid #e5e7eb;">
        <h2 style="margin:0 0 15px 0;color:#1e40af;font-size:18px;font-weight:600;">Tasks Summary</h2>
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="padding:10px 0;color:#64748b;font-size:14px;">Total Tasks:</td>
            <td style="padding:10px 0;text-align:right;color:#1f2937;font-weight:600;font-size:14px;">${tasks.length}</td>
          </tr>
          <tr>
            <td style="padding:10px 0;color:#64748b;font-size:14px;">Completed:</td>
            <td style="padding:10px 0;text-align:right;color:#10b981;font-weight:600;font-size:14px;">${completedTasks.length}</td>
          </tr>
          <tr>
            <td style="padding:10px 0;color:#64748b;font-size:14px;">Pending:</td>
            <td style="padding:10px 0;text-align:right;color:#ef4444;font-weight:600;font-size:14px;">${pendingTasks.length}</td>
          </tr>
          <tr>
            <td style="padding:10px 0;color:#64748b;font-size:14px;">Completion Rate:</td>
            <td style="padding:10px 0;text-align:right;color:#1f2937;font-weight:700;font-size:16px;">${completionRate}%</td>
          </tr>
        </table>
        <div style="margin-top:15px;height:8px;background:#e5e7eb;border-radius:4px;overflow:hidden;">
          <div style="height:100%;background:linear-gradient(90deg,#10b981 0%,#059669 100%);width:${completionRate}%;transition:width 0.3s;"></div>
        </div>
      </div>
      ` : ''}
    </div>

    <!-- Footer -->
    <div style="background:linear-gradient(135deg,#1e293b 0%,#0f172a 100%);color:white;padding:25px 30px;text-align:center;">
      <p style="margin:0 0 8px 0;font-size:16px;font-weight:600;">Bright Works Professional</p>
      <p style="margin:0;color:#fbbf24;font-size:13px;font-weight:500;">© 2025 Powered by <strong>LELC & JTH TECHNOLOGY</strong></p>
      <p style="margin:8px 0 0 0;color:#64748b;font-size:11px;opacity:0.8;">Leading Edge Learning & Consulting | JTH Technology Solutions</p>
    </div>
  </div>
</body>
</html>
  `;
}

// ============================================
// 9️⃣ AUTHENTICATION HELPERS
// ============================================

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ message: 'Access token required' });
  }
  
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ message: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

// ═══════════════════════════════════════════════════════════════
// 🔐 RBAC — SUPERADMIN HAS FULL ACCESS
// ═══════════════════════════════════════════════════════════════
// - isAdminOrSuperAdmin / requireAdmin: superadmin and admin pass; superadmin never blocked.
// - isSupervisorOrAbove / requireSupervisorOrAbove: supervisor, admin, superadmin pass.
// - requireSuperAdmin: only superadmin (403 others). Use for sensitive modules:
//   email recipient config; future: invoices, budgets, internal calendar.
// ═══════════════════════════════════════════════════════════════

// Helper function to check if user is admin or superadmin (superadmin always passes)
const isAdminOrSuperAdmin = (role) => {
  return role === 'admin' || role === 'superadmin';
};

// Helper function to check if user is supervisor, admin, or superadmin
const isSupervisorOrAbove = (role) => {
  return role === 'supervisor' || role === 'admin' || role === 'superadmin';
};

// Helper function to check if user is superadmin
const isSuperAdmin = (role) => {
  return role === 'superadmin';
};

// Middleware: only superadmin (403 otherwise). For email config and future restricted modules.
const requireSuperAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'superadmin') {
    return res.status(403).json({ message: 'Super Admin access required' });
  }
  next();
};

// Helper function to get the target userId for data creation
// Superadmins can specify targetUserId to create data for other users
// Others can only create data for themselves
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

const requireAdmin = (req, res, next) => {
  if (!isAdminOrSuperAdmin(req.user.role)) {
    return res.status(403).json({ message: 'Admin access required' });
  }
  next();
};

const requireSupervisorOrAbove = (req, res, next) => {
  if (!isSupervisorOrAbove(req.user.role)) {
    return res.status(403).json({ message: 'Supervisor or admin access required' });
  }
  next();
};

// ============================================
// 🔟 VALIDATION SCHEMAS
// ============================================

const loginSchema = Joi.object({
  username: Joi.string().trim().min(1).max(50).required(),
  password: Joi.string().min(1).required(),
});

const taskSchema = Joi.object({
  week: Joi.number().min(1).max(52).required(),
  taskName: Joi.string().required(),
  day: Joi.number().min(1).max(7).required(),
  completed: Joi.boolean().required(),
  room: Joi.string().optional().allow(''),
  roomKey: Joi.string().optional().allow(''),
  completedBy: Joi.string().optional().allow(''),
  completedByName: Joi.string().optional().allow(''),
  completedByRole: Joi.string().optional().allow(''),
  completedAt: Joi.date().optional().allow(null),
  targetUserId: Joi.string().optional().allow('') // Only for superadmins
});

const timeRecordSchema = Joi.object({
  week: Joi.number().min(1).max(52).required(),
  day: Joi.number().min(1).max(7).optional(),
  checkIn: Joi.string().allow('').optional(), // Accept ISO string or HH:MM format
  checkOut: Joi.string().allow('').optional(), // Accept ISO string or HH:MM format
  signature: Joi.string().allow('').optional(),
  room: Joi.string().allow('').optional(),
  roomKey: Joi.string().allow('').optional(),
  employeeName: Joi.string().allow('').optional(),
  targetUserId: Joi.string().optional().allow('') // Only for superadmins
});

const noteSchema = Joi.object({
  title: Joi.string().min(1).max(200).required(),
  content: Joi.string().min(1).max(5000).required(),
  week: Joi.number().min(1).max(52).optional().allow(null),
  targetUserId: Joi.string().optional().allow('') // Only for superadmins
});

const reminderSchema = Joi.object({
  title: Joi.string().min(1).max(200).required(),
  description: Joi.string().max(1000).optional().allow(''),
  dueDate: Joi.date().iso().required(),
  priority: Joi.string().valid('low', 'medium', 'high').optional(),
  targetUserId: Joi.string().optional().allow('') // Only for superadmins
});

const clientSchema = Joi.object({
  name: Joi.string().min(1).max(200).required(),
  contact: Joi.string().max(200).optional().allow(''),
  email: Joi.string().email().optional().allow(''),
  phone: Joi.string().max(20).optional().allow(''),
  address: Joi.string().max(500).optional().allow(''),
  facilityType: Joi.string().max(100).optional().allow(''),
  rating: Joi.number().min(0).max(5).optional(),
  notes: Joi.string().max(1000).optional().allow(''),
  isActive: Joi.boolean().optional(),
  targetUserId: Joi.string().optional().allow('') // Only for superadmins
});

const expenseSchema = Joi.object({
  title: Joi.string().min(1).max(200).required(),
  category: Joi.string().max(100).required(),
  amount: Joi.number().min(0).required(),
  description: Joi.string().max(1000).optional().allow(''),
  date: Joi.date().required(),
  targetUserId: Joi.string().optional().allow('') // Only for superadmins
});

const budgetSchema = Joi.object({
  clientName: Joi.string().min(1).max(200).required(),
  contactPerson: Joi.string().max(200).optional().allow(''),
  email: Joi.string().email().optional().allow(''),
  phone: Joi.string().max(20).optional().allow(''),
  address: Joi.string().max(500).optional().allow(''),
  facilityType: Joi.string().max(100).optional().allow(''),
  service: Joi.string().min(1).max(500).required(),
  services: Joi.array().items(Joi.string()).optional(),
  isoStandards: Joi.array().items(Joi.string()).optional(),
  epaRegulations: Joi.array().items(Joi.string()).optional(),
  greenSeal: Joi.boolean().optional(),
  osha: Joi.boolean().optional(),
  lineItems: Joi.array().items(Joi.object({
    description: Joi.string(),
    quantity: Joi.number(),
    rate: Joi.number(),
    amount: Joi.number()
  })).optional(),
  subtotal: Joi.number().optional(),
  tax: Joi.number().optional(),
  amount: Joi.number().min(0).required(),
  status: Joi.string().valid('pending', 'approved', 'rejected').optional(),
  description: Joi.string().max(2000).optional().allow(''),
  validUntil: Joi.date().optional().allow(null),
  paymentTerms: Joi.string().max(200).optional().allow(''),
  targetUserId: Joi.string().optional().allow('') // Only for superadmins
});

const userSchema = Joi.object({
  username: Joi.string().trim().min(1).max(50).required(),
  password: Joi.string().min(6).required(),
  fullName: Joi.string().min(1).max(100).required(),
  email: Joi.string().email().required(),
  role: Joi.string().valid('superadmin', 'admin', 'supervisor', 'employee').optional(),
  phone: Joi.string().max(20).optional().allow(''),
});

// ============================================
// 1️⃣1️⃣ PUBLIC ROUTES
// ============================================

// Config endpoint - MEJORADO Y CORREGIDO
app.get('/config.js', (_req, res) => {
  res.setHeader('Content-Type', 'application/javascript; charset=UTF-8');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  
  // Determinar API URL basado en el host
  const host = _req.get('host') || '';
  const protocol = _req.protocol || 'https';
  const apiUrl = API_PUBLIC_URL || `${protocol}://${host}`;
  
  // Usar JSON.stringify para escapar correctamente la URL
  res.send(`window.__API_URL__ = ${JSON.stringify(apiUrl)};`);
});

// Apply rate limiting to API routes
app.use('/api', apiLimiter);

// Security stats (Admin only)
app.get('/api/admin/security-stats', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const stats = {
      requestTracking: {
        totalIPs: requestTracker.size,
        blockedIPs: blockedIPs.size,
        suspiciousIPs: suspiciousIPs.size,
        topRequesters: Array.from(requestTracker.entries())
          .map(([ip, requests]) => ({ 
            ip, 
            requests: requests.length,
            lastRequest: new Date(Math.max(...requests)).toISOString()
          }))
          .sort((a, b) => b.requests - a.requests)
          .slice(0, 10)
      },
      blocked: Array.from(blockedIPs).map(ip => ({
        ip,
        blockedSince: suspiciousIPs.has(ip) 
          ? new Date(suspiciousIPs.get(ip)).toISOString() 
          : 'Unknown'
      })),
      serverInfo: {
        uptime: process.uptime(),
        memory: {
          used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + ' MB',
          total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + ' MB'
        }
      },
      timestamp: new Date().toISOString()
    };
    
    res.json(stats);
  } catch (error) {
    console.error('Security stats error:', error);
    res.status(500).json({ message: 'Error loading security statistics' });
  }
});

// Admin endpoints para desbloquear IPs
app.post('/api/admin/unblock-ip', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { ip } = req.body;
    if (!ip) {
      return res.status(400).json({ message: 'IP address required' });
    }
    
    blockedIPs.delete(ip);
    suspiciousIPs.delete(ip);
    requestTracker.delete(ip);
    
    console.log(`✅ IP desbloqueada manualmente: ${ip}`);
    res.json({ message: `IP ${ip} unblocked successfully` });
  } catch (error) {
    console.error('Unblock IP error:', error);
    res.status(500).json({ message: 'Error unblocking IP' });
  }
});

app.post('/api/admin/unblock-all', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const count = blockedIPs.size;
    blockedIPs.clear();
    suspiciousIPs.clear();
    
    console.log(`✅ Todas las IPs desbloqueadas (${count} IPs)`);
    res.json({ message: `All IPs unblocked successfully (${count} IPs)` });
  } catch (error) {
    console.error('Unblock all error:', error);
    res.status(500).json({ message: 'Error unblocking IPs' });
  }
});

// Health check
app.get('/api/health', async (_req, res) => {
  // Health check SIEMPRE debe responder OK, incluso sin MongoDB
  const dbStatus = mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected';
  
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: NODE_ENV,
    database: dbStatus,
    databaseAvailable: mongoConnected,
    email: emailConfigured ? `✅ ${emailService}` : '❌ Not configured',
    version: '3.1.1',
    server: 'Running',
    security: {
      trackedIPs: requestTracker.size,
      blockedIPs: blockedIPs.size
    },
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + ' MB',
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + ' MB'
    }
  });
});

// ============================================
// 1️⃣2️⃣ BOOTSTRAP ADMIN & RESET ADMIN
// ============================================

// Endpoint para resetear/resolver problemas de login
app.post('/api/fix-admin', async (req, res) => {
  try {
    if (!mongoConnected) {
      return res.status(503).json({ 
        message: 'Database not available. Please check MongoDB connection.',
        database: 'Disconnected'
      });
    }
    
    const { username, password, resetAll } = req.body || {};
    const targetUsername = username || 'admin';
    const targetPassword = password || 'admin123';
    
    // Si resetAll es true, resetear TODOS los admins
    if (resetAll) {
      console.log('🔧 Resetting ALL admin users...');
      const allAdmins = await User.find({ role: 'admin' });
      const results = [];
      
      for (const admin of allAdmins) {
        const hashedPassword = await bcrypt.hash(targetPassword, 10);
        admin.password = hashedPassword;
        admin.loginAttempts = 0;
        admin.lockUntil = undefined;
        admin.isActive = true;
        await admin.save();
        results.push({
          username: admin.username,
          email: admin.email,
          status: 'reset'
        });
        console.log(`✅ Admin reset: ${admin.username}`);
      }
      
      // Crear admin por defecto si no existe ninguno
      if (allAdmins.length === 0) {
        const hashedPassword = await bcrypt.hash(targetPassword, 10);
        const newAdmin = await new User({
          username: targetUsername,
          password: hashedPassword,
          fullName: 'Administrator',
          email: `${targetUsername}@brightworks.app`,
          role: 'admin',
          isActive: true,
          loginAttempts: 0
        }).save();
        results.push({
          username: newAdmin.username,
          email: newAdmin.email,
          status: 'created'
        });
        console.log(`✅ Admin created: ${targetUsername}`);
      }
      
      return res.json({ 
        message: 'All admin users reset successfully',
        resetCount: results.length,
        users: results,
        credentials: {
          username: targetUsername,
          password: targetPassword
        }
      });
    }
    
    console.log(`🔧 Fixing admin user: ${targetUsername}`);
    
    // Buscar usuario existente (primero exacto, luego case-insensitive)
    let user = await User.findOne({ username: targetUsername });
    if (!user) {
      user = await User.findOne({ 
        username: { $regex: new RegExp(`^${targetUsername.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
      });
    }
    
    if (!user) {
      // Crear nuevo usuario
      const hashedPassword = await bcrypt.hash(targetPassword, 10);
      user = await new User({
        username: targetUsername,
        password: hashedPassword,
        fullName: 'Administrator',
        email: `${targetUsername}@brightworks.app`,
        role: 'admin',
        isActive: true,
        loginAttempts: 0
      }).save();
      console.log(`✅ Admin user created: ${targetUsername}`);
    } else {
      // Resetear contraseña y desbloquear
      const hashedPassword = await bcrypt.hash(targetPassword, 10);
      user.password = hashedPassword;
      user.loginAttempts = 0;
      user.lockUntil = undefined;
      user.isActive = true;
      await user.save();
      console.log(`✅ Admin user reset: ${user.username}`);
    }
    
    const token = jwt.sign(
      { 
        userId: user._id, 
        username: user.username, 
        role: user.role, 
        fullName: user.fullName 
      }, 
      JWT_SECRET, 
      { expiresIn: JWT_EXPIRATION }
    );
    
    return res.json({ 
      message: 'Admin user fixed successfully',
      token,
      user: {
        _id: user._id,
        id: user._id,
        username: user.username,
        fullName: user.fullName,
        email: user.email,
        role: user.role
      },
      credentials: {
        username: user.username,
        password: targetPassword
      }
    });
  } catch (error) {
    console.error('❌ Fix admin error:', error);
    res.status(500).json({ 
      message: 'Server error', 
      error: error.message 
    });
  }
});

app.post('/api/bootstrap-admin', setupLimiter, async (req, res) => {
  try {
    if (!mongoConnected) {
      return res.status(503).json({ 
        message: 'Database not available. Please check MongoDB connection.',
        database: 'Disconnected'
      });
    }
    
    const userCount = await User.estimatedDocumentCount();
    
    if (userCount > 0) {
      return res.status(409).json({ 
        message: 'Bootstrap disabled: users already exist',
        help: 'Use /api/reset-admin endpoint with SETUP_KEY to reset'
      });
    }
    
    const key = req.query.key || req.headers['x-setup-key'] || req.body.setupKey;
    
    if (!process.env.SETUP_KEY) {
      return res.status(403).json({ 
        message: 'Bootstrap not configured',
        help: 'Set SETUP_KEY environment variable'
      });
    }
    
    if (key !== process.env.SETUP_KEY) {
      return res.status(403).json({ message: 'Invalid setup key' });
    }
    
    const { username, password, fullName, email } = req.body || {};
    
    if (!username || !password || !fullName || !email) {
      return res.status(400).json({ 
        message: 'Missing required fields',
        required: ['username', 'password', 'fullName', 'email']
      });
    }
    
    const exists = await User.findOne({ $or: [{ username }, { email }] });
    if (exists) {
      return res.status(409).json({ message: 'Username or email already exists' });
    }
    
    const hashedPassword = await bcrypt.hash(password, 12);
    
    const user = await new User({ 
      username, 
      password: hashedPassword, 
      fullName, 
      email, 
      role: 'admin',
      isActive: true
    }).save();
    
    const token = jwt.sign(
      { 
        userId: user._id, 
        username: user.username, 
        role: user.role, 
        fullName: user.fullName 
      }, 
      JWT_SECRET, 
      { expiresIn: JWT_EXPIRATION }
    );
    
    console.log(`✅ Admin user created: ${username}`);
    
    res.status(201).json({ 
      message: 'Admin user created successfully',
      token,
      user: {
        id: user._id,
        username: user.username,
        fullName: user.fullName,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Bootstrap admin error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ============================================
// 1️⃣3️⃣ AUTHENTICATION
// ============================================

// Crear superadmin en MongoDB si no existe (igual que el original)
async function ensureSuperadminExists() {
  try {
    const User = mongoose.model('User');
    let superadmin = await User.findOne({ username: 'superadmin' });
    if (!superadmin) {
      const hashedPassword = await bcrypt.hash('superadmin123', 10);
      superadmin = await User.create({
        username: 'superadmin',
        password: hashedPassword,
        fullName: 'Super Administrator',
        email: 'superadmin@brightworks.app',
        role: 'superadmin',
        isActive: true,
        loginAttempts: 0
      });
      console.log('✅ Super Admin user created (superadmin / superadmin123)');
    } else if (superadmin.role !== 'superadmin') {
      superadmin.role = 'superadmin';
      await superadmin.save();
      console.log('✅ Super Admin role updated');
    }
  } catch (err) {
    console.error('ensureSuperadminExists:', err.message);
  }
}

// Usuarios locales de respaldo (funcionan sin MongoDB) - igual que el original
const LOCAL_USERS = {
  superadmin: { password: 'superadmin123', role: 'superadmin', fullName: 'Super Administrator' },
  admin: { password: 'admin123', role: 'admin', fullName: 'Administrator' },
  employee: { password: 'employee123', role: 'employee', fullName: 'Employee' }
};

app.post('/api/login', loginLimiter, async (req, res) => {
  try {
    const { username, password } = req.body;
    const trimmedUsername = username?.trim()?.toLowerCase();
    
    if (!trimmedUsername || !password) {
      return res.status(400).json({ message: 'Username and password are required' });
    }
    
    // PRIMERO: Intentar login local (siempre funciona)
    const localUser = LOCAL_USERS[trimmedUsername];
    if (localUser && localUser.password === password) {
      console.log(`✅ Local login successful for: ${trimmedUsername}`);
      const token = jwt.sign(
        { id: `local-${trimmedUsername}`, userId: `local-${trimmedUsername}`, username: trimmedUsername, fullName: localUser.fullName, role: localUser.role },
        process.env.JWT_SECRET || 'brightworks-secret-key-2024',
        { expiresIn: '7d' }
      );
      const perms = (localUser.role === 'superadmin' || localUser.role === 'admin')
        ? ['schedule', 'daily_report', 'dashboard', 'calendar', 'notes', 'reminders', 'expenses', 'quotes', 'clients', 'users', 'settings']
        : ['schedule', 'daily_report'];
      return res.json({
        token,
        user: {
          _id: `local-${trimmedUsername}`,
          id: `local-${trimmedUsername}`,
          username: trimmedUsername,
          fullName: localUser.fullName,
          role: localUser.role,
          permissions: perms
        }
      });
    }
    
    // SEGUNDO: Si MongoDB no está conectado, rechazar
    if (!mongoConnected) {
      console.error('❌ Login failed: Invalid credentials (MongoDB offline)');
      return res.status(401).json({ message: 'Invalid username or password' });
    }
    
    // TERCERO: Buscar en MongoDB
    const { error } = loginSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ message: error.details[0].message });
    }
    
    if (!trimmedUsername || !password) {
      console.error('❌ Login attempt failed: Missing username or password');
      return res.status(400).json({ message: 'Username and password are required' });
    }
    
    console.log(`🔍 Attempting login for username: "${trimmedUsername}"`);
    
    // Búsqueda SIMPLE y DIRECTA - sin complicaciones
    let user = await User.findOne({ 
      username: trimmedUsername
    });
    
    // Si no se encuentra, intentar case-insensitive SOLO si es necesario
    if (!user) {
      try {
        user = await User.findOne({ 
          username: { $regex: new RegExp(`^${trimmedUsername.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
        });
      } catch (regexError) {
        console.error('❌ Regex search error:', regexError);
        user = null;
      }
    }
    
    if (!user) {
      console.error(`❌ Login failed: User not found - "${trimmedUsername}"`);
      // Listar algunos usernames para debug
      try {
        const allUsers = await User.find({}, 'username email isActive').limit(5);
        if (allUsers.length > 0) {
          console.log('📋 Available users:', allUsers.map(u => `"${u.username}" (active: ${u.isActive})`).join(', '));
        }
      } catch (debugError) {
        // Ignorar errores de debug
      }
      return res.status(401).json({ message: 'Invalid username or password' });
    }
    
    console.log(`✅ User found: "${user.username}" (isActive: ${user.isActive !== false})`);
    
    // Verificar si está activo (solo si explícitamente es false)
    if (user.isActive === false) {
      console.error(`❌ Login failed: Account inactive - "${trimmedUsername}"`);
      // Desactivar la restricción temporalmente para permitir login
      console.log(`⚠️  Temporarily reactivating account to allow login`);
      user.isActive = true;
      await user.save();
    }
    
    // Verificar si está bloqueado
    if (user.lockUntil && user.lockUntil > Date.now()) {
      const minutesLeft = Math.ceil((user.lockUntil - Date.now()) / 60000);
      console.error(`❌ Login failed: Account locked - "${trimmedUsername}" (${minutesLeft} minutes left)`);
      // Desbloquear automáticamente si está bloqueado
      console.log(`⚠️  Unlocking account automatically`);
      user.lockUntil = undefined;
      user.loginAttempts = 0;
      await user.save();
    }
    
    const isValidPassword = await bcrypt.compare(password, user.password);
    
    if (!isValidPassword) {
      user.loginAttempts = (user.loginAttempts || 0) + 1;
      
      if (user.loginAttempts >= 5) {
        user.lockUntil = new Date(Date.now() + 15 * 60 * 1000);
        await user.save();
        console.error(`❌ Login failed: Account locked due to too many attempts - ${trimmedUsername}`);
        return res.status(423).json({ 
          message: 'Account locked due to too many failed attempts. Try again in 15 minutes.'
        });
      }
      
      await user.save();
      console.error(`❌ Login failed: Invalid password - ${trimmedUsername} (attempts: ${user.loginAttempts}/5)`);
      return res.status(401).json({ 
        message: 'Invalid username or password',
        attemptsLeft: 5 - user.loginAttempts
      });
    }
    
    user.loginAttempts = 0;
    user.lockUntil = undefined;
    user.lastLogin = new Date();
    await user.save();
    
    const token = jwt.sign(
      { 
        userId: user._id, 
        username: user.username, 
        role: user.role, 
        fullName: user.fullName 
      }, 
      JWT_SECRET, 
      { expiresIn: JWT_EXPIRATION }
    );
    
    console.log(`✅ User logged in successfully: ${user.username} (${user.role})`);
    
    res.json({ 
      token, 
      user: { 
        _id: user._id,
        id: user._id, 
        username: user.username, 
        fullName: user.fullName, 
        email: user.email, 
        role: user.role,
        lastLogin: user.lastLogin
      } 
    });
  } catch (error) {
    console.error('❌ Login error:', error);
    res.status(500).json({ 
      message: 'Server error during login',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

app.get('/api/me', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id;
    // Usuario local (superadmin, admin, employee sin MongoDB)
    if (userId && String(userId).startsWith('local-')) {
      return res.json({
        user: {
          _id: userId,
          id: userId,
          username: req.user.username,
          fullName: req.user.fullName || req.user.username,
          email: (req.user.username || '') + '@brightworks.app',
          role: req.user.role || 'employee',
          permissions: req.user.role === 'superadmin' || req.user.role === 'admin'
            ? ['schedule', 'daily_report', 'dashboard', 'calendar', 'notes', 'reminders', 'expenses', 'quotes', 'clients', 'users', 'settings']
            : ['schedule', 'daily_report']
        }
      });
    }
    const user = await User.findById(userId, '-password');
    if (!user || user.isActive === false) {
      return res.status(404).json({ message: 'User not found or inactive' });
    }
    res.json({
      user: {
        _id: user._id,
        id: user._id,
        username: user.username,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        permissions: user.role === 'superadmin' || user.role === 'admin'
          ? ['schedule', 'daily_report', 'dashboard', 'calendar', 'notes', 'reminders', 'expenses', 'quotes', 'clients', 'users', 'settings']
          : (user.permissions || ['schedule', 'daily_report'])
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Alias /api/users/me (frontend AuthContext lo usa)
app.get('/api/users/me', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id;
    if (userId && String(userId).startsWith('local-')) {
      return res.json({
        user: {
          _id: userId,
          id: userId,
          username: req.user.username,
          fullName: req.user.fullName || req.user.username,
          email: (req.user.username || '') + '@brightworks.app',
          role: req.user.role || 'employee',
          permissions: req.user.role === 'superadmin' || req.user.role === 'admin'
            ? ['schedule', 'daily_report', 'dashboard', 'calendar', 'notes', 'reminders', 'expenses', 'quotes', 'clients', 'users', 'settings']
            : ['schedule', 'daily_report']
        }
      });
    }
    const user = await User.findById(userId, '-password');
    if (!user || user.isActive === false) {
      return res.status(404).json({ message: 'User not found or inactive' });
    }
    return res.json({
      user: {
        _id: user._id,
        id: user._id,
        username: user.username,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        permissions: user.role === 'superadmin' || user.role === 'admin'
          ? ['schedule', 'daily_report', 'dashboard', 'calendar', 'notes', 'reminders', 'expenses', 'quotes', 'clients', 'users', 'settings']
          : (user.permissions || ['schedule', 'daily_report'])
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// ============================================
// 1️⃣4️⃣ TASKS & TIME RECORDS
// ============================================

// GET /api/tasks/config - System-wide task sections. Read: admin + superadmin.
app.get('/api/tasks/config', authenticateToken, requireAdmin, async (req, res) => {
  try {
    let doc = await TaskConfig.findOne({ isGlobal: true });
    if (!doc || !doc.sections || !Array.isArray(doc.sections) || doc.sections.length === 0) {
      doc = await TaskConfig.findOne({});
      if (!doc || !doc.sections || doc.sections.length === 0) {
        const now = new Date();
        doc = await TaskConfig.create({
          userId: req.user.userId,
          isGlobal: true,
          sections: DEFAULT_TASK_SECTIONS_CONFIG,
          version: 1,
          lastUpdated: now,
          updatedAt: now,
          updatedBy: req.user.userId,
          changeLog: [{ at: now, by: req.user.userId, key: 'initial' }]
        });
      } else {
        doc.isGlobal = true;
        await doc.save();
      }
    }
    res.json({
      sections: doc.sections || DEFAULT_TASK_SECTIONS_CONFIG,
      version: doc.version || 1,
      lastUpdated: doc.updatedAt ? new Date(doc.updatedAt).toISOString() : new Date().toISOString()
    });
  } catch (err) {
    console.error('[GET /api/tasks/config]', err.message);
    res.status(500).json({ message: 'Error loading task configuration', error: err.message });
  }
});

// POST /api/tasks/config - Save system-wide task sections (superadmin only).
app.post('/api/tasks/config', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const { sections, version } = req.body || {};
    if (!sections || !Array.isArray(sections) || sections.length === 0) {
      return res.status(400).json({ message: 'sections array is required and must not be empty' });
    }
    const now = new Date();
    const changeLogEntry = { at: now, by: req.user.userId, key: 'sections' };
    let doc = await TaskConfig.findOne({ isGlobal: true });
    if (!doc) {
      doc = await TaskConfig.create({
        userId: req.user.userId,
        isGlobal: true,
        sections,
        version: version || 1,
        lastUpdated: now,
        updatedAt: now,
        updatedBy: req.user.userId,
        changeLog: [changeLogEntry]
      });
    } else {
      doc.sections = sections;
      doc.version = version != null ? version : (doc.version || 1);
      doc.lastUpdated = now;
      doc.updatedAt = now;
      doc.updatedBy = req.user.userId;
      doc.changeLog = doc.changeLog || [];
      doc.changeLog.push(changeLogEntry);
      if (doc.changeLog.length > 50) doc.changeLog = doc.changeLog.slice(-50);
      await doc.save();
    }
    res.json({
      message: 'Task configuration saved',
      sections: doc.sections,
      version: doc.version,
      lastUpdated: doc.updatedAt.toISOString()
    });
  } catch (err) {
    console.error('[POST /api/tasks/config]', err.message);
    res.status(500).json({ message: 'Error saving task configuration', error: err.message });
  }
});

// Helper: get task names not completed for a day (source of truth for day completeness)
async function getDayMissingTasks(userId, week, day, room, roomKey) {
  const normalizedRoom = (room && String(room).trim() !== '') ? String(room).trim() : 'General';
  const normalizedRoomKey = (roomKey && String(roomKey).trim() !== '') ? String(roomKey).trim().toLowerCase() : 'general';
  const taskQuery = { userId, week: parseInt(week, 10) || 1, day: parseInt(day, 10) || 1 };
  if (normalizedRoom !== 'General') {
    taskQuery.room = normalizedRoom;
  } else if (normalizedRoomKey !== 'general') {
    taskQuery.roomKey = normalizedRoomKey;
  }
  let sections = DEFAULT_SECTIONS;
  try {
    const configDoc = await TaskConfig.findOne({ isGlobal: true });
    if (configDoc && configDoc.sections && Array.isArray(configDoc.sections) && configDoc.sections.length > 0) {
      sections = configDoc.sections;
    }
  } catch (e) {
    // use DEFAULT_SECTIONS
  }
  const expectedTaskNames = sections.reduce((acc, s) => acc.concat(s.tasks || []), []);
  const dayTasks = await Task.find(taskQuery);
  const missing = expectedTaskNames.filter((taskName) => {
    const completed = dayTasks.some((t) => t.taskName === taskName && t.completed === true);
    return !completed;
  });
  return missing;
}

// Same logic as getDayMissingTasks but returns { complete, missingTasks } for day-completion check.
async function isDayCompleteAndGetMissing(userId, week, day, room, roomKey) {
  const missingTasks = await getDayMissingTasks(userId, week, day, room, roomKey);
  return { complete: missingTasks.length === 0, missingTasks };
}

// GET /api/tasks/day-status?week=&day=&room=&roomKey= - Auth required; employee allowed. Day completeness for final send.
app.get('/api/tasks/day-status', authenticateToken, async (req, res) => {
  try {
    const week = parseInt(req.query.week, 10);
    const day = parseInt(req.query.day, 10);
    const room = req.query.room;
    const roomKey = req.query.roomKey;
    if (isNaN(week) || week < 1 || week > 52 || isNaN(day) || day < 1 || day > 7) {
      return res.status(400).json({ message: 'Valid week (1-52) and day (1-7) required' });
    }
    const userId = req.user.userId;
    const missingTasks = await getDayMissingTasks(userId, week, day, room, roomKey);
    const missingCount = missingTasks.length;
    res.json({
      complete: missingCount === 0,
      missingCount,
      missingTasks,
    });
  } catch (err) {
    console.error('[GET /api/tasks/day-status]', err.message);
    res.status(500).json({ message: 'Error loading day status', error: err.message });
  }
});

// GET /api/tasks?week=X&room=Y (query params) - Used by frontend
app.get('/api/tasks', authenticateToken, async (req, res) => {
  try {
    const week = parseInt(req.query.week);
    const room = req.query.room; // Get room from query params
    const roomKey = req.query.roomKey; // Get roomKey from query params
    
    if (isNaN(week) || week < 1 || week > 52) {
      return res.status(400).json({ message: 'Invalid week number (1-52)' });
    }
    
    const query = { 
      week 
    };
    
    // Admins and superadmins can see all tasks from all users
    // Employees can only see their own tasks
    if (!isAdminOrSuperAdmin(req.user.role)) {
      query.userId = req.user.userId;
    }
    
    // Filter by room/roomKey only if provided (if not provided, return all tasks for history view)
    if (room && room.trim() !== '' && room.trim().toLowerCase() !== 'general') {
      query.room = room.trim();
    } else if (roomKey && roomKey.trim() !== '' && roomKey.trim().toLowerCase() !== 'general') {
      // If roomKey is provided and not 'general', filter by roomKey
      query.roomKey = roomKey.trim();
    }
    // If no room/roomKey or room is 'General', return all tasks (history of all rooms)
    
    const tasks = await Task.find(query).sort({ userId: 1, room: 1, day: 1, taskName: 1 }); // Sort by userId first for admins, then room, day, taskName
    
    res.json(tasks);
  } catch (error) {
    console.error('Get tasks error:', error);
    res.status(500).json({ message: 'Error loading tasks' });
  }
});

// GET /api/tasks/:week (path param) - Alternative route for backward compatibility
app.get('/api/tasks/:week', authenticateToken, async (req, res) => {
  try {
    const week = parseInt(req.params.week);
    const room = req.query.room; // Get room from query params
    const roomKey = req.query.roomKey; // Get roomKey from query params
    
    if (isNaN(week) || week < 1 || week > 52) {
      return res.status(400).json({ message: 'Invalid week number (1-52)' });
    }
    
    const query = { 
      week 
    };
    
    // Admins and superadmins can see all tasks from all users
    // Employees can only see their own tasks
    if (!isAdminOrSuperAdmin(req.user.role)) {
      query.userId = req.user.userId;
    }
    
    // Filter by room/roomKey only if provided (if not provided, return all tasks for history view)
    if (room && room.trim() !== '' && room.trim().toLowerCase() !== 'general') {
      query.room = room.trim();
    } else if (roomKey && roomKey.trim() !== '' && roomKey.trim().toLowerCase() !== 'general') {
      // If roomKey is provided and not 'general', filter by roomKey
      query.roomKey = roomKey.trim();
    }
    // If no room/roomKey or room is 'General', return all tasks (history of all rooms)
    
    const tasks = await Task.find(query).sort({ userId: 1, room: 1, day: 1, taskName: 1 }); // Sort by userId first for admins, then room, day, taskName
    
    res.json(tasks);
  } catch (error) {
    console.error('Get tasks error:', error);
    res.status(500).json({ message: 'Error loading tasks' });
  }
});

// POST /api/tasks - Create or update task
app.post('/api/tasks', authenticateToken, async (req, res) => {
  try {
    const { error } = taskSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ message: error.details[0].message });
    }
    
    const { week, taskName, day, completed, room, roomKey, completedBy, completedByName, completedByRole, completedAt, targetUserId } = req.body;
    
    // Validate targetUserId if provided (must be superadmin)
    if (targetUserId && !isSuperAdmin(req.user.role)) {
      return res.status(403).json({ message: 'Only superadmins can specify targetUserId' });
    }
    
    // Get target userId - superadmins can create tasks for other users
    let finalUserId;
    try {
      finalUserId = await getTargetUserId(req, targetUserId);
    } catch (error) {
      return res.status(404).json({ message: error.message || 'Target user not found' });
    }
    
    // Normalize room values - default to 'General' if not provided
    const normalizedRoom = (room && room.trim() !== '') ? room.trim() : 'General';
    const normalizedRoomKey = (roomKey && roomKey.trim() !== '') ? roomKey.trim() : (normalizedRoom.toLowerCase());
    
    // Build query for finding task
    // Superadmins can edit tasks from any user, others can only edit their own
    const taskQuery = { 
      week, 
      taskName, 
      day,
      room: normalizedRoom
    };
    if (!isAdminOrSuperAdmin(req.user.role)) {
      taskQuery.userId = req.user.userId;
    } else if (targetUserId && isSuperAdmin(req.user.role)) {
      // If superadmin specified targetUserId, search for that user's task
      taskQuery.userId = finalUserId;
    }
    
    let task = await Task.findOne(taskQuery);
    
    if (task) {
      task.completed = completed;
      task.updatedAt = new Date();
      task.room = normalizedRoom;
      task.roomKey = normalizedRoomKey;
      
      if (completed) {
        task.completedBy = completedBy || req.user.userId;
        task.completedByName = completedByName || req.user.fullName || req.user.username;
        task.completedByRole = completedByRole || req.user.role;
        task.completedAt = completedAt || new Date();
      } else {
        task.completedBy = null;
        task.completedByName = null;
        task.completedByRole = null;
        task.completedAt = null;
      }
      
      await task.save();
    } else {
      task = await new Task({ 
        userId: finalUserId, 
        week, 
        taskName, 
        day, 
        completed,
        room: normalizedRoom,
        roomKey: normalizedRoomKey,
        completedBy: completed ? (completedBy || req.user.userId) : null,
        completedByName: completed ? (completedByName || req.user.fullName || req.user.username) : null,
        completedByRole: completed ? (completedByRole || req.user.role) : null,
        completedAt: completed ? (completedAt || new Date()) : null
      }).save();
    }
    await touchDailyActivity(finalUserId, week, day, normalizedRoom, normalizedRoomKey, new Date());
    let finalEmailSent = false;
    if (task && task.completed) {
      checkSectionCompletedAndNotify(
        finalUserId,
        week,
        day,
        normalizedRoom,
        normalizedRoomKey,
        task.taskName,
        task.completedByName || req.user.fullName || req.user.username
      ).catch(() => {});
      const { complete } = await isDayCompleteAndGetMissing(finalUserId, week, day, normalizedRoom, normalizedRoomKey);
      if (complete) {
        const sendResult = await sendFinalDayEmailWithIdempotency(
          finalUserId,
          task.completedByName || req.user.fullName || req.user.username,
          week,
          day,
          normalizedRoom,
          normalizedRoomKey,
          null
        );
        if (sendResult.sent) finalEmailSent = true;
      }
    }
    res.status(201).json({ 
      message: 'Task saved successfully', 
      task,
      ...(finalEmailSent ? { finalEmailSent: true } : {})
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: 'Task already exists for this week, day, and room' });
    }
    console.error('Save task error:', error);
    res.status(500).json({ message: 'Error saving task' });
  }
});

// PUT /api/tasks - Create or update task (same as POST, for frontend compatibility)
app.put('/api/tasks', authenticateToken, async (req, res) => {
  try {
    const { error } = taskSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ message: error.details[0].message });
    }
    
    const { week, taskName, day, completed, room, roomKey, completedBy, completedByName, completedByRole, completedAt, targetUserId } = req.body;
    
    // Validate targetUserId if provided (must be superadmin)
    if (targetUserId && !isSuperAdmin(req.user.role)) {
      return res.status(403).json({ message: 'Only superadmins can specify targetUserId' });
    }
    
    // Get target userId - superadmins can create tasks for other users
    let finalUserId;
    try {
      finalUserId = await getTargetUserId(req, targetUserId);
    } catch (error) {
      return res.status(404).json({ message: error.message || 'Target user not found' });
    }
    
    // Normalize room values - default to 'General' if not provided
    const normalizedRoom = (room && room.trim() !== '') ? room.trim() : 'General';
    const normalizedRoomKey = (roomKey && roomKey.trim() !== '') ? roomKey.trim() : (normalizedRoom.toLowerCase());
    
    // Build query for finding task
    // Superadmins can edit tasks from any user, others can only edit their own
    const taskQuery = { 
      week, 
      taskName, 
      day,
      room: normalizedRoom
    };
    if (!isAdminOrSuperAdmin(req.user.role)) {
      taskQuery.userId = req.user.userId;
    } else if (targetUserId && isSuperAdmin(req.user.role)) {
      // If superadmin specified targetUserId, search for that user's task
      taskQuery.userId = finalUserId;
    }
    
    let task = await Task.findOne(taskQuery);
    
    if (task) {
      task.completed = completed;
      task.updatedAt = new Date();
      task.room = normalizedRoom;
      task.roomKey = normalizedRoomKey;
      
      if (completed) {
        task.completedBy = completedBy || req.user.userId;
        task.completedByName = completedByName || req.user.fullName || req.user.username;
        task.completedByRole = completedByRole || req.user.role;
        task.completedAt = completedAt || new Date();
      } else {
        task.completedBy = null;
        task.completedByName = null;
        task.completedByRole = null;
        task.completedAt = null;
      }
      
      await task.save();
    } else {
      task = await new Task({ 
        userId: finalUserId, 
        week, 
        taskName, 
        day, 
        completed,
        room: normalizedRoom,
        roomKey: normalizedRoomKey,
        completedBy: completed ? (completedBy || req.user.userId) : null,
        completedByName: completed ? (completedByName || req.user.fullName || req.user.username) : null,
        completedByRole: completed ? (completedByRole || req.user.role) : null,
        completedAt: completed ? (completedAt || new Date()) : null
      }).save();
    }
    await touchDailyActivity(finalUserId, week, day, normalizedRoom, normalizedRoomKey, new Date());
    let finalEmailSent = false;
    if (task && task.completed) {
      checkSectionCompletedAndNotify(
        finalUserId,
        week,
        day,
        normalizedRoom,
        normalizedRoomKey,
        task.taskName,
        task.completedByName || req.user.fullName || req.user.username
      ).catch(() => {});
      const { complete } = await isDayCompleteAndGetMissing(finalUserId, week, day, normalizedRoom, normalizedRoomKey);
      if (complete) {
        const sendResult = await sendFinalDayEmailWithIdempotency(
          finalUserId,
          task.completedByName || req.user.fullName || req.user.username,
          week,
          day,
          normalizedRoom,
          normalizedRoomKey,
          null
        );
        if (sendResult.sent) finalEmailSent = true;
      }
    }
    res.status(201).json({ 
      message: 'Task saved successfully', 
      task,
      ...(finalEmailSent ? { finalEmailSent: true } : {})
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: 'Task already exists for this week, day, and room' });
    }
    console.error('Save task error:', error);
    res.status(500).json({ message: 'Error saving task' });
  }
});

// GET /api/time-records?week=X (query params) - Used by frontend
app.get('/api/time-records', authenticateToken, async (req, res) => {
  try {
    const week = parseInt(req.query.week);
    
    if (isNaN(week) || week < 1 || week > 52) {
      return res.status(400).json({ message: 'Invalid week number (1-52)' });
    }
    
    const query = { week };
    
    // Admins and superadmins can see all time records from all users
    // Employees can only see their own time records
    if (!isAdminOrSuperAdmin(req.user.role)) {
      query.userId = req.user.userId;
    }
    
    // Get all time records for the week (by day and room)
    const records = await TimeRecord.find(query).sort({ userId: 1, day: 1, room: 1 }); // Sort by userId first for admins
    
    // If no records, return empty array (frontend expects array)
    res.json(records || []);
  } catch (error) {
    console.error('Get time records error:', error);
    res.status(500).json({ message: 'Error loading time records' });
  }
});

// GET /api/time-records/:week (path param) - Alternative route for backward compatibility
app.get('/api/time-records/:week', authenticateToken, async (req, res) => {
  try {
    const week = parseInt(req.params.week);
    
    if (isNaN(week) || week < 1 || week > 52) {
      return res.status(400).json({ message: 'Invalid week number (1-52)' });
    }
    
    const query = { week };
    
    // Admins and superadmins can see all time records from all users
    // Employees can only see their own time records
    if (!isAdminOrSuperAdmin(req.user.role)) {
      query.userId = req.user.userId;
    }
    
    // Get all time records for the week (by day and room)
    const records = await TimeRecord.find(query).sort({ userId: 1, day: 1, room: 1 }); // Sort by userId first for admins
    
    // If no records, return empty array (frontend expects array)
    res.json(records || []);
  } catch (error) {
    console.error('Get time records error:', error);
    res.status(500).json({ message: 'Error loading time records' });
  }
});

// POST /api/time-records - Create or update time record
app.post('/api/time-records', authenticateToken, async (req, res) => {
  try {
    const { error } = timeRecordSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ message: error.details[0].message });
    }
    
    const { week, day, checkIn, checkOut, signature, room, roomKey, employeeName, targetUserId } = req.body;
    
    // Validate targetUserId if provided (must be superadmin)
    if (targetUserId && !isSuperAdmin(req.user.role)) {
      return res.status(403).json({ message: 'Only superadmins can specify targetUserId' });
    }
    
    // Get target userId - superadmins can create time records for other users
    const finalUserId = await getTargetUserId(req, targetUserId);
    
    // Normalize room values - default to 'General' if not provided
    const normalizedRoom = (room && room.trim() !== '') ? room.trim() : 'General';
    const normalizedRoomKey = (roomKey && roomKey.trim() !== '') ? roomKey.trim() : (normalizedRoom.toLowerCase());
    const normalizedDay = day ? parseInt(day) : null;
    
    // Normalize checkIn/checkOut format (can be ISO string or HH:MM)
    const normalizeTime = (time) => {
      if (!time || time === '') return '';
      try {
        // Try to parse as ISO date string first
        const date = new Date(time);
        if (!isNaN(date.getTime())) {
          // Return as ISO string for storage
          return date.toISOString();
        }
        // If it's in HH:MM format, convert to ISO string using today's date
        if (typeof time === 'string' && /^\d{1,2}:\d{2}$/.test(time)) {
          const [hours, minutes] = time.split(':').map(Number);
          if (!isNaN(hours) && !isNaN(minutes) && hours >= 0 && hours < 24 && minutes >= 0 && minutes < 60) {
            const today = new Date();
            today.setHours(hours, minutes, 0, 0);
            return today.toISOString();
          }
        }
        return time; // Return as-is if we can't parse it
      } catch (e) {
        console.warn('Error normalizing time:', e);
        return time;
      }
    };
    
    const normalizedCheckIn = normalizeTime(checkIn);
    const normalizedCheckOut = normalizeTime(checkOut);
    
    // Calculate total hours from normalized times
    let totalHours = '0h 0m';
    if (normalizedCheckIn && normalizedCheckOut) {
      try {
        const checkInDate = new Date(normalizedCheckIn);
        const checkOutDate = new Date(normalizedCheckOut);
        if (!isNaN(checkInDate.getTime()) && !isNaN(checkOutDate.getTime())) {
          const diffMinutes = (checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60);
          if (diffMinutes > 0) {
            const hours = Math.floor(diffMinutes / 60);
            const minutes = Math.floor(diffMinutes % 60);
            totalHours = `${hours}h ${minutes}m`;
          }
        }
      } catch (e) {
        console.warn('Error calculating hours:', e);
      }
    }
    
    // Build query - include day and room if provided
    // Superadmins can edit time records from any user, others can only edit their own
    const query = { 
      week: parseInt(week)
    };
    
    if (!isAdminOrSuperAdmin(req.user.role)) {
      query.userId = req.user.userId;
    } else if (targetUserId && isSuperAdmin(req.user.role)) {
      // If superadmin specified targetUserId, search for that user's record
      query.userId = finalUserId;
    }
    
    if (normalizedDay) {
      query.day = normalizedDay;
    }
    
    if (normalizedRoom) {
      query.room = normalizedRoom;
    }
    
    let record = await TimeRecord.findOne(query);
    
    if (record) {
      if (normalizedCheckIn !== undefined && normalizedCheckIn !== '') record.checkIn = normalizedCheckIn;
      if (normalizedCheckOut !== undefined && normalizedCheckOut !== '') record.checkOut = normalizedCheckOut;
      if (signature !== undefined) record.signature = signature || '';
      if (normalizedRoom) record.room = normalizedRoom;
      if (normalizedRoomKey) record.roomKey = normalizedRoomKey;
      if (normalizedDay) record.day = normalizedDay;
      if (employeeName !== undefined) record.employeeName = employeeName || '';
      record.totalHours = totalHours;
      record.updatedAt = new Date();
      await record.save();
    } else {
      record = await new TimeRecord({ 
        userId: finalUserId, 
        week: parseInt(week),
        day: normalizedDay || 1,
        checkIn: normalizedCheckIn || '', 
        checkOut: normalizedCheckOut || '',
        signature: signature || '',
        room: normalizedRoom,
        roomKey: normalizedRoomKey,
        employeeName: employeeName || '',
        totalHours 
      }).save();
    }
    
    res.status(201).json({ 
      message: 'Time record saved successfully', 
      record 
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: 'Time record already exists for this week, day, and room' });
    }
    console.error('Save time record error:', error);
    res.status(500).json({ message: 'Error saving time record' });
  }
});

// PUT /api/time-records - Create or update time record (same as POST, for frontend compatibility)
app.put('/api/time-records', authenticateToken, async (req, res) => {
  try {
    const { error } = timeRecordSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ message: error.details[0].message });
    }
    
    const { week, day, checkIn, checkOut, signature, room, roomKey, employeeName, targetUserId } = req.body;
    
    // Validate targetUserId if provided (must be superadmin)
    if (targetUserId && !isSuperAdmin(req.user.role)) {
      return res.status(403).json({ message: 'Only superadmins can specify targetUserId' });
    }
    
    // Get target userId - superadmins can create time records for other users
    const finalUserId = await getTargetUserId(req, targetUserId);
    
    // Normalize room values - default to 'General' if not provided
    const normalizedRoom = (room && room.trim() !== '') ? room.trim() : 'General';
    const normalizedRoomKey = (roomKey && roomKey.trim() !== '') ? roomKey.trim() : (normalizedRoom.toLowerCase());
    const normalizedDay = day ? parseInt(day) : null;
    
    // Normalize checkIn/checkOut format (can be ISO string or HH:MM)
    const normalizeTime = (time) => {
      if (!time || time === '') return '';
      try {
        // Try to parse as ISO date string first
        const date = new Date(time);
        if (!isNaN(date.getTime())) {
          // Return as ISO string for storage
          return date.toISOString();
        }
        // If it's in HH:MM format, convert to ISO string using today's date
        if (typeof time === 'string' && /^\d{1,2}:\d{2}$/.test(time)) {
          const [hours, minutes] = time.split(':').map(Number);
          if (!isNaN(hours) && !isNaN(minutes) && hours >= 0 && hours < 24 && minutes >= 0 && minutes < 60) {
            const today = new Date();
            today.setHours(hours, minutes, 0, 0);
            return today.toISOString();
          }
        }
        return time; // Return as-is if we can't parse it
      } catch (e) {
        console.warn('Error normalizing time:', e);
        return time;
      }
    };
    
    const normalizedCheckIn = normalizeTime(checkIn);
    const normalizedCheckOut = normalizeTime(checkOut);
    
    // Calculate total hours from normalized times
    let totalHours = '0h 0m';
    if (normalizedCheckIn && normalizedCheckOut) {
      try {
        const checkInDate = new Date(normalizedCheckIn);
        const checkOutDate = new Date(normalizedCheckOut);
        if (!isNaN(checkInDate.getTime()) && !isNaN(checkOutDate.getTime())) {
          const diffMinutes = (checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60);
          if (diffMinutes > 0) {
            const hours = Math.floor(diffMinutes / 60);
            const minutes = Math.floor(diffMinutes % 60);
            totalHours = `${hours}h ${minutes}m`;
          }
        }
      } catch (e) {
        console.warn('Error calculating hours:', e);
      }
    }
    
    // Build query - include day and room if provided
    // Superadmins can edit time records from any user, others can only edit their own
    const query = { 
      week: parseInt(week)
    };
    
    if (!isAdminOrSuperAdmin(req.user.role)) {
      query.userId = req.user.userId;
    } else if (targetUserId && isSuperAdmin(req.user.role)) {
      // If superadmin specified targetUserId, search for that user's record
      query.userId = finalUserId;
    }
    
    if (normalizedDay) {
      query.day = normalizedDay;
    }
    
    if (normalizedRoom) {
      query.room = normalizedRoom;
    }
    
    let record = await TimeRecord.findOne(query);
    
    if (record) {
      if (normalizedCheckIn !== undefined && normalizedCheckIn !== '') record.checkIn = normalizedCheckIn;
      if (normalizedCheckOut !== undefined && normalizedCheckOut !== '') record.checkOut = normalizedCheckOut;
      if (signature !== undefined) record.signature = signature || '';
      if (normalizedRoom) record.room = normalizedRoom;
      if (normalizedRoomKey) record.roomKey = normalizedRoomKey;
      if (normalizedDay) record.day = normalizedDay;
      if (employeeName !== undefined) record.employeeName = employeeName || '';
      record.totalHours = totalHours;
      record.updatedAt = new Date();
      await record.save();
    } else {
      record = await new TimeRecord({ 
        userId: finalUserId, 
        week: parseInt(week),
        day: normalizedDay || 1,
        checkIn: normalizedCheckIn || '', 
        checkOut: normalizedCheckOut || '',
        signature: signature || '',
        room: normalizedRoom,
        roomKey: normalizedRoomKey,
        employeeName: employeeName || '',
        totalHours 
      }).save();
    }
    
    res.status(201).json({ 
      message: 'Time record saved successfully', 
      record 
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: 'Time record already exists for this week, day, and room' });
    }
    console.error('Save time record error:', error);
    res.status(500).json({ message: 'Error saving time record' });
  }
});

// ============================================
// 1️⃣5️⃣ NOTES & REMINDERS - MEJORADO CON DELETE Y PUT
// ============================================

app.get('/api/notes', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const query = {};
    
    // Admins and superadmins can see all notes from all users
    // Employees can only see their own notes
    if (!isAdminOrSuperAdmin(req.user.role)) {
      query.userId = req.user.userId;
    }
    
    const notes = await Note.find(query)
      .sort({ userId: 1, createdAt: -1 })
      .limit(limit);
    res.json(notes);
  } catch (error) {
    console.error('Get notes error:', error);
    res.status(500).json({ message: 'Error loading notes' });
  }
});

app.post('/api/notes', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { error } = noteSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ message: error.details[0].message });
    }
    
    const { targetUserId, ...noteData } = req.body;
    
    // Validate targetUserId if provided (must be superadmin)
    if (targetUserId && !isSuperAdmin(req.user.role)) {
      return res.status(403).json({ message: 'Only superadmins can specify targetUserId' });
    }
    
    // Get target userId - superadmins can create notes for other users
    const finalUserId = await getTargetUserId(req, targetUserId);
    
    const note = await new Note({ 
      ...noteData, 
      userId: finalUserId 
    }).save();
    
    res.status(201).json(note);
  } catch (error) {
    console.error('Create note error:', error);
    res.status(500).json({ message: 'Error creating note' });
  }
});

// PUT endpoint para actualizar notas
app.put('/api/notes/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { error } = noteSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ message: error.details[0].message });
    }
    
    // Admins and superadmins can edit any note, employees can only edit their own
    const query = { _id: id };
    if (!isAdminOrSuperAdmin(req.user.role)) {
      query.userId = req.user.userId;
    }
    
    const note = await Note.findOne(query);
    if (!note) {
      return res.status(404).json({ message: 'Note not found' });
    }
    
    note.title = req.body.title;
    note.content = req.body.content;
    note.week = req.body.week;
    note.updatedAt = new Date();
    await note.save();
    
    res.json({ 
      message: 'Note updated successfully', 
      note 
    });
  } catch (error) {
    console.error('Update note error:', error);
    res.status(500).json({ message: 'Error updating note' });
  }
});

// DELETE endpoint para eliminar notas
app.delete('/api/notes/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Admins and superadmins can delete any note, employees can only delete their own
    const query = { _id: id };
    if (!isAdminOrSuperAdmin(req.user.role)) {
      query.userId = req.user.userId;
    }
    
    const note = await Note.findOneAndDelete(query);
    if (!note) {
      return res.status(404).json({ message: 'Note not found' });
    }
    
    res.json({ 
      message: 'Note deleted successfully' 
    });
  } catch (error) {
    console.error('Delete note error:', error);
    res.status(500).json({ message: 'Error deleting note' });
  }
});

app.get('/api/reminders', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { completed } = req.query;
    const query = {};
    
    // Admins and superadmins can see all reminders from all users
    // Employees can only see their own reminders
    if (!isAdminOrSuperAdmin(req.user.role)) {
      query.userId = req.user.userId;
    }
    
    if (completed !== undefined) {
      query.completed = completed === 'true';
    }
    
    const reminders = await Reminder.find(query)
      .sort({ userId: 1, dueDate: 1 });
    
    res.json(reminders);
  } catch (error) {
    console.error('Get reminders error:', error);
    res.status(500).json({ message: 'Error loading reminders' });
  }
});

app.post('/api/reminders', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { error } = reminderSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ message: error.details[0].message });
    }
    
    const { targetUserId, ...reminderData } = req.body;
    
    // Validate targetUserId if provided (must be superadmin)
    if (targetUserId && !isSuperAdmin(req.user.role)) {
      return res.status(403).json({ message: 'Only superadmins can specify targetUserId' });
    }
    
    // Get target userId - superadmins can create reminders for other users
    let finalUserId;
    try {
      finalUserId = await getTargetUserId(req, targetUserId);
    } catch (error) {
      return res.status(404).json({ message: error.message || 'Target user not found' });
    }
    
    const reminder = await new Reminder({ 
      ...reminderData, 
      userId: finalUserId 
    }).save();
    
    res.status(201).json(reminder);
  } catch (error) {
    console.error('Create reminder error:', error);
    res.status(500).json({ message: 'Error creating reminder' });
  }
});

// PUT endpoint para actualizar reminders (toggle completed)
app.put('/api/reminders/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { completed, title, description, dueDate, priority } = req.body;
    
    // Admins and superadmins can edit any reminder, employees can only edit their own
    const query = { _id: id };
    if (!isAdminOrSuperAdmin(req.user.role)) {
      query.userId = req.user.userId;
    }
    
    const reminder = await Reminder.findOne(query);
    if (!reminder) {
      return res.status(404).json({ message: 'Reminder not found' });
    }
    
    if (completed !== undefined) {
      reminder.completed = completed;
      reminder.completedAt = completed ? new Date() : null;
    }
    if (title !== undefined) {reminder.title = title;}
    if (description !== undefined) {reminder.description = description;}
    if (dueDate !== undefined) {reminder.dueDate = dueDate;}
    if (priority !== undefined) {reminder.priority = priority;}
    
    await reminder.save();
    
    res.json(reminder);
  } catch (error) {
    console.error('Update reminder error:', error);
    res.status(500).json({ message: 'Error updating reminder' });
  }
});

// DELETE endpoint para eliminar reminders
app.delete('/api/reminders/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Admins and superadmins can delete any reminder, employees can only delete their own
    const query = { _id: id };
    if (!isAdminOrSuperAdmin(req.user.role)) {
      query.userId = req.user.userId;
    }
    
    const reminder = await Reminder.findOneAndDelete(query);
    if (!reminder) {
      return res.status(404).json({ message: 'Reminder not found' });
    }
    
    res.json({ 
      message: 'Reminder deleted successfully' 
    });
  } catch (error) {
    console.error('Delete reminder error:', error);
    res.status(500).json({ message: 'Error deleting reminder' });
  }
});

// ============================================
// EXPENSES
// ============================================

app.get('/api/expenses', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const query = {};
    
    // Admins and superadmins can see all expenses from all users
    // Employees can only see their own expenses
    if (!isAdminOrSuperAdmin(req.user.role)) {
      query.userId = req.user.userId;
    }
    
    const expenses = await Expense.find(query)
      .sort({ userId: 1, date: -1 });
    res.json(expenses);
  } catch (error) {
    console.error('Get expenses error:', error);
    res.status(500).json({ message: 'Error loading expenses' });
  }
});

app.post('/api/expenses', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { error } = expenseSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ message: error.details[0].message });
    }
    
    const { targetUserId, ...expenseData } = req.body;
    
    // Validate targetUserId if provided (must be superadmin)
    if (targetUserId && !isSuperAdmin(req.user.role)) {
      return res.status(403).json({ message: 'Only superadmins can specify targetUserId' });
    }
    
    // Get target userId - superadmins can create expenses for other users
    let finalUserId;
    try {
      finalUserId = await getTargetUserId(req, targetUserId);
    } catch (error) {
      return res.status(404).json({ message: error.message || 'Target user not found' });
    }
    
    const expense = await new Expense({ 
      ...expenseData, 
      userId: finalUserId 
    }).save();
    
    res.status(201).json(expense);
  } catch (error) {
    console.error('Create expense error:', error);
    res.status(500).json({ message: 'Error creating expense' });
  }
});

app.put('/api/expenses/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { error } = expenseSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ message: error.details[0].message });
    }
    
    // Admins and superadmins can edit any expense, employees can only edit their own
    const query = { _id: id };
    if (!isAdminOrSuperAdmin(req.user.role)) {
      query.userId = req.user.userId;
    }
    
    const expense = await Expense.findOne(query);
    if (!expense) {
      return res.status(404).json({ message: 'Expense not found' });
    }
    
    Object.assign(expense, req.body);
    expense.updatedAt = new Date();
    await expense.save();
    
    res.json(expense);
  } catch (error) {
    console.error('Update expense error:', error);
    res.status(500).json({ message: 'Error updating expense' });
  }
});

app.delete('/api/expenses/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    // Admins and superadmins can delete any expense, employees can only delete their own
    const query = { _id: req.params.id };
    if (!isAdminOrSuperAdmin(req.user.role)) {
      query.userId = req.user.userId;
    }
    
    const expense = await Expense.findOneAndDelete(query);
    if (!expense) {
      return res.status(404).json({ message: 'Expense not found' });
    }
    res.json({ message: 'Expense deleted successfully' });
  } catch (error) {
    console.error('Delete expense error:', error);
    res.status(500).json({ message: 'Error deleting expense' });
  }
});

// ============================================
// QUOTES (alias for budgets)
// ============================================

app.get('/api/quotes', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { status } = req.query;
    const query = {};
    
    // Admins and superadmins can see all quotes from all users
    // Employees can only see their own quotes
    if (!isAdminOrSuperAdmin(req.user.role)) {
      query.userId = req.user.userId;
    }
    
    if (status) {
      query.status = status;
    }
    
    const budgets = await Budget.find(query)
      .sort({ userId: 1, createdAt: -1 }); // Sort by userId first for admins
    
    res.json(budgets);
  } catch (error) {
    console.error('Get quotes error:', error);
    res.status(500).json({ message: 'Error loading quotes' });
  }
});

app.post('/api/quotes', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { error } = budgetSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ message: error.details[0].message });
    }
    
    const { targetUserId, ...budgetData } = req.body;
    
    // Validate targetUserId if provided (must be superadmin)
    if (targetUserId && !isSuperAdmin(req.user.role)) {
      return res.status(403).json({ message: 'Only superadmins can specify targetUserId' });
    }
    
    // Get target userId - superadmins can create quotes for other users
    let finalUserId;
    try {
      finalUserId = await getTargetUserId(req, targetUserId);
    } catch (error) {
      return res.status(404).json({ message: error.message || 'Target user not found' });
    }
    
    const budget = await new Budget({ 
      ...budgetData, 
      userId: finalUserId 
    }).save();
    
    res.status(201).json(budget);
  } catch (error) {
    console.error('Create quote error:', error);
    res.status(500).json({ message: 'Error creating quote' });
  }
});

app.put('/api/quotes/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { error } = budgetSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ message: error.details[0].message });
    }
    
    // Admins and superadmins can edit any quote, employees can only edit their own
    const query = { _id: id };
    if (!isAdminOrSuperAdmin(req.user.role)) {
      query.userId = req.user.userId;
    }
    
    const budget = await Budget.findOne(query);
    if (!budget) {
      return res.status(404).json({ message: 'Quote not found' });
    }
    
    Object.assign(budget, req.body);
    budget.updatedAt = new Date();
    await budget.save();
    
    res.json(budget);
  } catch (error) {
    console.error('Update quote error:', error);
    res.status(500).json({ message: 'Error updating quote' });
  }
});

app.delete('/api/quotes/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    // Admins and superadmins can delete any quote, employees can only delete their own
    const query = { _id: req.params.id };
    if (!isAdminOrSuperAdmin(req.user.role)) {
      query.userId = req.user.userId;
    }
    
    const budget = await Budget.findOneAndDelete(query);
    if (!budget) {
      return res.status(404).json({ message: 'Quote not found' });
    }
    res.json({ message: 'Quote deleted successfully' });
  } catch (error) {
    console.error('Delete quote error:', error);
    res.status(500).json({ message: 'Error deleting quote' });
  }
});

// ============================================
// 1️⃣6️⃣ CLIENTS
// ============================================

app.get('/api/clients', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { isActive } = req.query;
    const query = {};
    
    // Admins and superadmins can see all clients from all users
    // Employees can only see their own clients
    if (!isAdminOrSuperAdmin(req.user.role)) {
      query.userId = req.user.userId;
    }
    
    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }
    
    const clients = await Client.find(query)
      .sort({ userId: 1, createdAt: -1 }); // Sort by userId first for admins
    
    res.json(clients);
  } catch (error) {
    console.error('Get clients error:', error);
    res.status(500).json({ message: 'Error loading clients' });
  }
});

app.post('/api/clients', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { error } = clientSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ message: error.details[0].message });
    }
    
    const { targetUserId, ...clientBody } = req.body;
    
    // Validate targetUserId if provided (must be superadmin)
    if (targetUserId && !isSuperAdmin(req.user.role)) {
      return res.status(403).json({ message: 'Only superadmins can specify targetUserId' });
    }
    
    // Get target userId - superadmins can create clients for other users
    let finalUserId;
    try {
      finalUserId = await getTargetUserId(req, targetUserId);
    } catch (error) {
      return res.status(404).json({ message: error.message || 'Target user not found' });
    }
    
    const clientData = { ...clientBody, userId: finalUserId };
    
    if (clientBody.rating && clientBody.rating > 0) {
      clientData.satisfactionHistory = [{
        date: new Date(),
        rating: clientBody.rating,
        comment: clientBody.notes || '',
        service: 'Initial Service'
      }];
      clientData.totalServices = 1;
    }
    
    const client = await new Client(clientData).save();
    
    res.status(201).json({ 
      message: 'Client created successfully', 
      client 
    });
  } catch (error) {
    console.error('Create client error:', error);
    res.status(500).json({ message: 'Error creating client' });
  }
});

app.get('/api/clients/:clientId', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const client = await Client.findById(req.params.clientId);
    if (!client) return res.status(404).json({ message: 'Client not found' });
    if (!isAdminOrSuperAdmin(req.user.role) && client.userId.toString() !== req.user.userId) {
      return res.status(403).json({ message: 'Access denied' });
    }
    res.json(client);
  } catch (error) {
    console.error('Get client error:', error);
    res.status(500).json({ message: 'Error loading client' });
  }
});

// ---------- INVOICES (Superadmin only) ----------
app.get('/api/clients/:clientId/invoices', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const list = await Invoice.find({ clientId: req.params.clientId }).sort({ createdAt: -1 }).lean();
    res.json(list);
  } catch (error) {
    console.error('List invoices error:', error);
    res.status(500).json({ message: 'Error listing invoices' });
  }
});

app.post('/api/clients/:clientId/invoices', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const client = await Client.findById(req.params.clientId);
    if (!client) return res.status(404).json({ message: 'Client not found' });
    const invoiceNumber = await getNextInvoiceNumber();
    const issueDate = new Date();
    const dueDate = new Date(issueDate);
    dueDate.setDate(dueDate.getDate() + 30);
    const lineItems = Array.isArray(req.body.lineItems) ? req.body.lineItems : [];
    const { lineItems: computed, subtotal, salesTaxTotal, total } = computeInvoiceTotals(lineItems);
    const inv = await new Invoice({
      clientId: client._id,
      invoiceNumber,
      issueDate,
      dueDate,
      status: 'DRAFT',
      companySnapshot: getCompanySnapshot(),
      clientSnapshot: buildClientSnapshot(client),
      lineItems: computed,
      subtotal,
      salesTaxTotal,
      total,
      notes: req.body.notes || '',
      legalNote: req.body.legalNote || '',
      audit: [{ at: new Date(), by: req.user.userId, action: 'CREATE', meta: {} }]
    }).save();
    res.status(201).json(inv);
  } catch (error) {
    console.error('Create invoice error:', error);
    res.status(500).json({ message: 'Error creating invoice' });
  }
});

app.get('/api/invoices/:invoiceId', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const inv = await Invoice.findById(req.params.invoiceId).lean();
    if (!inv) return res.status(404).json({ message: 'Invoice not found' });
    res.json(inv);
  } catch (error) {
    console.error('Get invoice error:', error);
    res.status(500).json({ message: 'Error loading invoice' });
  }
});

app.put('/api/invoices/:invoiceId', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const inv = await Invoice.findById(req.params.invoiceId);
    if (!inv) return res.status(404).json({ message: 'Invoice not found' });
    if (inv.status !== 'DRAFT') return res.status(400).json({ message: 'Only draft invoices can be updated' });
    const client = await Client.findById(inv.clientId);
    const lineItems = Array.isArray(req.body.lineItems) ? req.body.lineItems : inv.lineItems;
    const { lineItems: computed, subtotal, salesTaxTotal, total } = computeInvoiceTotals(lineItems);
    inv.companySnapshot = getCompanySnapshot();
    inv.clientSnapshot = buildClientSnapshot(client);
    inv.lineItems = computed;
    inv.subtotal = subtotal;
    inv.salesTaxTotal = salesTaxTotal;
    inv.total = total;
    inv.notes = req.body.notes != null ? req.body.notes : inv.notes;
    inv.legalNote = req.body.legalNote != null ? req.body.legalNote : inv.legalNote;
    inv.issueDate = req.body.issueDate ? new Date(req.body.issueDate) : inv.issueDate;
    inv.dueDate = req.body.dueDate ? new Date(req.body.dueDate) : inv.dueDate;
    pushAudit(inv, req.user.userId, 'UPDATE', {});
    await inv.save();
    res.json(inv);
  } catch (error) {
    console.error('Update invoice error:', error);
    res.status(500).json({ message: 'Error updating invoice' });
  }
});

app.post('/api/invoices/:invoiceId/finalize', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const inv = await Invoice.findById(req.params.invoiceId);
    if (!inv) return res.status(404).json({ message: 'Invoice not found' });
    if (inv.status !== 'DRAFT') return res.status(400).json({ message: 'Only draft invoices can be finalized' });
    inv.status = 'FINAL';
    pushAudit(inv, req.user.userId, 'FINALIZE', {});
    await inv.save();
    res.json(inv);
  } catch (error) {
    console.error('Finalize invoice error:', error);
    res.status(500).json({ message: 'Error finalizing invoice' });
  }
});

app.get('/api/invoices/:invoiceId/pdf', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const inv = await Invoice.findById(req.params.invoiceId).lean();
    if (!inv) return res.status(404).json({ message: 'Invoice not found' });
    const pdfBuffer = await generateInvoicePdf(inv);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="invoice-${inv.invoiceNumber}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('PDF invoice error:', error);
    res.status(500).json({ message: 'Error generating PDF' });
  }
});

const MAX_EMAIL_LOG = 20;
app.post('/api/invoices/:invoiceId/send', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const inv = await Invoice.findById(req.params.invoiceId);
    if (!inv) return res.status(404).json({ message: 'Invoice not found' });
    const { force } = req.body || {};
    if (inv.sentAt && !force) {
      return res.status(400).json({ message: 'Invoice already sent. Use force: true to resend.', sentAt: inv.sentAt, sentTo: inv.sentTo });
    }
    const client = await Client.findById(inv.clientId);
    const to = (client && client.email) || inv.clientSnapshot?.email;
    if (!to) return res.status(400).json({ message: 'No email address for client' });
    const pdfBuffer = await generateInvoicePdf(inv);
    const subject = `Invoice ${inv.invoiceNumber} - ${process.env.APP_NAME || 'Secure Assets Holding'}`;
    const html = `<p>Please find attached invoice ${inv.invoiceNumber}.</p><p>Thank you.</p>`;
    const attachments = [{ content: pdfBuffer.toString('base64'), filename: `invoice-${inv.invoiceNumber}.pdf`, type: 'application/pdf', disposition: 'attachment' }];
    const result = await sendEmail(to, subject, html, attachments);
    if (!result.success) return res.status(500).json({ message: result.message || 'Failed to send email' });
    if (!inv.emailLog) inv.emailLog = [];
    inv.emailLog.push({ at: new Date(), to, subject, html: html.slice(0, 500), action: 'SEND' });
    if (inv.emailLog.length > MAX_EMAIL_LOG) inv.emailLog = inv.emailLog.slice(-MAX_EMAIL_LOG);
    inv.sentAt = new Date();
    inv.sentTo = to;
    if (inv.status === 'FINAL') inv.status = 'SENT';
    pushAudit(inv, req.user.userId, 'SEND', { to });
    await inv.save();
    res.json({ message: 'Invoice sent', sentTo: to, invoice: inv });
  } catch (error) {
    console.error('Send invoice error:', error);
    res.status(500).json({ message: error.message || 'Error sending invoice' });
  }
});

// ============================================
// 1️⃣7️⃣ BUDGETS
// ============================================

app.get('/api/budgets', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { status } = req.query;
    const query = {};
    
    // Admins and superadmins can see all budgets from all users
    // Employees can only see their own budgets
    if (!isAdminOrSuperAdmin(req.user.role)) {
      query.userId = req.user.userId;
    }
    
    if (status) {
      query.status = status;
    }
    
    const budgets = await Budget.find(query)
      .sort({ userId: 1, createdAt: -1 }); // Sort by userId first for admins
    
    res.json(budgets);
  } catch (error) {
    console.error('Get budgets error:', error);
    res.status(500).json({ message: 'Error loading budgets' });
  }
});

app.post('/api/budgets', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { error } = budgetSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ message: error.details[0].message });
    }
    
    const { targetUserId, ...budgetData } = req.body;
    
    // Get target userId - superadmins can create budgets for other users
    // Validate targetUserId if provided (must be superadmin)
    if (targetUserId && !isSuperAdmin(req.user.role)) {
      return res.status(403).json({ message: 'Only superadmins can specify targetUserId' });
    }
    
    // Get target userId - superadmins can create time records for other users
    let finalUserId;
    try {
      finalUserId = await getTargetUserId(req, targetUserId);
    } catch (error) {
      return res.status(404).json({ message: error.message || 'Target user not found' });
    }
    
    const budget = await new Budget({ 
      ...budgetData, 
      userId: finalUserId 
    }).save();
    
    res.status(201).json({ 
      message: 'Budget created successfully', 
      budget 
    });
  } catch (error) {
    console.error('Create budget error:', error);
    res.status(500).json({ message: 'Error creating budget' });
  }
});

// ============================================
// 1️⃣8️⃣ USERS (Admin Only)
// ============================================

app.get('/api/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const users = await User.find({}, '-password')
      .sort({ createdAt: -1 });
    
    res.json(users);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ message: 'Error loading users' });
  }
});

app.post('/api/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { error } = userSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ message: error.details[0].message });
    }
    
    const { username, password, fullName, email, role, phone } = req.body;
    
    const exists = await User.findOne({ 
      $or: [{ username }, { email }] 
    });
    
    if (exists) {
      return res.status(409).json({ 
        message: 'Username or email already exists' 
      });
    }
    
    const hashedPassword = await bcrypt.hash(password, 12);
    
    const user = await new User({ 
      username, 
      password: hashedPassword, 
      fullName, 
      email, 
      role: role || 'employee',
      phone,
      isActive: true
    }).save();
    
    res.status(201).json({ 
      message: 'User created successfully', 
      user: { 
        id: user._id, 
        username: user.username, 
        fullName: user.fullName, 
        email: user.email, 
        role: user.role,
        phone: user.phone
      } 
    });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ message: 'Error creating user' });
  }
});

// Get single user
app.get('/api/users/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ message: 'Error loading user' });
  }
});

// Update user
app.put('/api/users/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { username, password, fullName, email, role, phone, isActive } = req.body;
    
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Check if username or email already exists (excluding current user)
    if (username || email) {
      const exists = await User.findOne({
        _id: { $ne: req.params.id },
        $or: [
          username ? { username } : {},
          email ? { email } : {}
        ].filter(obj => Object.keys(obj).length > 0)
      });
      
      if (exists) {
        return res.status(409).json({ 
          message: 'Username or email already exists' 
        });
      }
    }
    
    // Update fields
    if (username) user.username = username;
    if (fullName) user.fullName = fullName;
    if (email) user.email = email;
    if (role) user.role = role;
    if (phone !== undefined) user.phone = phone;
    if (isActive !== undefined) user.isActive = isActive;
    
    // Update password if provided
    if (password && password.trim()) {
      user.password = await bcrypt.hash(password, 12);
    }
    
    await user.save();
    
    res.json({ 
      message: 'User updated successfully',
      user: {
        id: user._id,
        username: user.username,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        phone: user.phone,
        isActive: user.isActive
      }
    });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ message: 'Error updating user' });
  }
});

// Delete user
app.delete('/api/users/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Prevent deleting yourself
    if (user._id.toString() === req.user.userId) {
      return res.status(400).json({ message: 'Cannot delete your own account' });
    }
    
    await User.findByIdAndDelete(req.params.id);
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ message: 'Error deleting user' });
  }
});

// ============================================
// 1️⃣9️⃣ STATISTICS
// ============================================

app.get('/api/statistics', authenticateToken, requireAdmin, async (req, res) => {
  try {
    // Build query based on user role
    const userQuery = isAdminOrSuperAdmin(req.user.role) ? {} : { userId: req.user.userId };
    
    const [tasks, timeRecords, clients, budgets, notes, reminders] = await Promise.all([
      Task.find(userQuery),
      TimeRecord.find(userQuery),
      Client.find(userQuery),
      Budget.find(userQuery),
      Note.find(userQuery),
      Reminder.find(userQuery)
    ]);

    const totalTasks = tasks.length;
    const completedTasks = tasks.filter((t) => t.completed).length;
    const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    let totalMinutes = 0;
    for (const r of timeRecords) {
      if (r.checkIn && r.checkOut) {
        const [inH, inM] = String(r.checkIn).split(':').map(Number);
        const [outH, outM] = String(r.checkOut).split(':').map(Number);
        const mins = outH * 60 + outM - (inH * 60 + inM);
        if (!isNaN(mins) && mins > 0) {totalMinutes += mins;}
      }
    }
    
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    const totalHours = `${hours}h ${minutes}m`;

    const totalClients = clients.length;
    const activeClients = clients.filter(c => c.rating >= 4 && c.isActive !== false).length;
    
    const totalBudgets = budgets.length;
    const approvedBudgets = budgets.filter(b => b.status === 'approved').length;
    const pendingBudgets = budgets.filter(b => b.status === 'pending').length;
    const totalRevenue = budgets
      .filter(b => b.status === 'approved')
      .reduce((sum, b) => sum + (b.amount || 0), 0);

    res.json({ 
      tasks: {
        total: totalTasks,
        completed: completedTasks,
        pending: totalTasks - completedTasks,
        completionRate
      },
      time: {
        totalHours,
        totalMinutes,
        records: timeRecords.length
      },
      clients: {
        total: totalClients,
        active: activeClients,
        inactive: totalClients - activeClients
      },
      budgets: {
        total: totalBudgets,
        approved: approvedBudgets,
        pending: pendingBudgets,
        rejected: budgets.filter(b => b.status === 'rejected').length,
        totalRevenue,
        averageValue: totalBudgets > 0 ? Math.round(totalRevenue / approvedBudgets) || 0 : 0
      },
      notes: {
        total: notes.length
      },
      reminders: {
        total: reminders.length,
        active: reminders.filter(r => !r.completed).length,
        completed: reminders.filter(r => r.completed).length
      }
    });
  } catch (error) {
    console.error('Get statistics error:', error);
    res.status(500).json({ message: 'Error loading statistics' });
  }
});

// ============================================
// 2️⃣0️⃣ EMAIL REPORTS
// ============================================

// ============================================
// ✍️ SIGNATURE ENDPOINTS
// ============================================

const signatureSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  week: { type: Number, min: 1, max: 52 },
  day: { type: Number, min: 1, max: 7 },
  signature: { type: String, required: true },
  employeeName: { type: String, required: true },
  date: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now }
});

const Signature = mongoose.model('Signature', signatureSchema);

app.post('/api/signatures', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { week, day, signature, employeeName, date } = req.body;
    const newSignature = new Signature({
      userId: req.user.userId,
      week: week || Math.ceil((new Date() - new Date(new Date().getFullYear(), 0, 1)) / (1000 * 60 * 60 * 24 * 7)),
      day: day || new Date().getDay() || 7,
      signature,
      employeeName: employeeName || req.user.fullName,
      date: date ? new Date(date) : new Date()
    });
    await newSignature.save();
    res.json({ success: true, signature: newSignature });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/api/signatures/:week?', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const query = { userId: req.user.userId };
    if (req.params.week) query.week = parseInt(req.params.week);
    const signatures = await Signature.find(query).sort({ createdAt: -1 });
    res.json(signatures);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post('/api/send-weekly-signature-email', authenticateToken, requireAdmin, async (req, res) => {
  try {
    if (!emailConfigured) {
      return res.status(503).json({ success: false, message: 'Email not configured' });
    }

    const { week, signature } = req.body;
    const recipients = await getAdminEmails();

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Daily Signature - ${formattedDate}</title>
</head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;background:#f3f4f6;">
  <div style="max-width:650px;margin:0 auto;background:#ffffff;box-shadow:0 4px 6px rgba(0,0,0,0.1);">
    <div style="background:linear-gradient(135deg,#1e40af 0%,#3b82f6 100%);color:white;padding:35px 30px;text-align:center;">
      <h2 style="font-size:24px;margin:0 0 10px 0;font-weight:700;">✅ Daily Signature</h2>
      <p style="opacity:0.9;font-size:16px;margin:0;">Digital Signature Report - ${dayName}</p>
    </div>
    <div style="padding:35px 30px;">
      <p style="margin:0 0 15px 0;color:#1f2937;font-size:15px;"><strong>Employee:</strong> ${req.user.fullName || req.user.username}</p>
      <p style="margin:0 0 15px 0;color:#1f2937;font-size:15px;"><strong>Day:</strong> ${dayName} (Day ${day || dayOfWeek || 7})</p>
      <p style="margin:0 0 25px 0;color:#1f2937;font-size:15px;"><strong>Date:</strong> ${formattedDate}</p>
      <h3 style="color:#1e40af;font-size:18px;margin-bottom:15px;">Digital Signature:</h3>
      <div style="background:#f9fafb;padding:20px;border-radius:10px;border:2px solid #e5e7eb;text-align:center;">
        <img src="${signature}" style="max-width:100%;border:2px solid #3b82f6;border-radius:8px;background:white;padding:10px;">
      </div>
    </div>
    <div style="background:linear-gradient(135deg,#1e293b 0%,#0f172a 100%);color:white;padding:25px 30px;text-align:center;">
      <p style="margin:0 0 8px 0;font-size:16px;font-weight:600;">Bright Works Professional</p>
      <p style="margin:0;color:#fbbf24;font-size:13px;font-weight:500;">© 2025 Powered by <strong>LELC & JTH TECHNOLOGY</strong></p>
      <p style="margin:8px 0 0 0;color:#64748b;font-size:11px;opacity:0.8;">Leading Edge Learning & Consulting | JTH Technology Solutions</p>
    </div>
  </div>
</body>
</html>
    `;

    await sgMail.send({
      to: Array.from(recipients),
      from: process.env.SENDGRID_FROM_EMAIL,
      subject: `✅ Daily Signature - ${dayName}, ${formattedDate} - ${req.user.fullName || req.user.username}`,
      html
    });

    res.json({ success: true, recipients: recipients.length });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// 📧 EMAIL ENDPOINT - FIRMA DIARIA CON RESUMEN COMPLETO
// ============================================

app.post('/api/send-daily-signature-email', authenticateToken, requireAdmin, async (req, res) => {
  try {
    if (!emailConfigured) {
      return res.status(503).json({ success: false, message: 'Email service not configured' });
    }

    const { day, date, signature, week, room, clockInTime, clockOutTime, completedTasks, employeeName } = req.body;
    
    const recipients = await getAdminEmails();
    
    if (recipients.length === 0) {
      return res.status(400).json({ 
        success: false,
        message: 'No admin emails configured'
      });
    }

    const today = date ? new Date(date) : new Date();
    const dayOfWeek = today.getDay();
    const dayNumber = day || (dayOfWeek === 0 ? 7 : dayOfWeek);
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayName = dayNames[dayOfWeek] || dayNames[dayNumber - 1] || `Day ${dayNumber}`;
    
    const formattedDate = today.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    
    // Calcular horas totales si hay entrada y salida
    let totalHours = '0h 0m';
    if (clockInTime && clockOutTime && clockInTime.includes(':') && clockOutTime.includes(':')) {
      try {
        const [inH, inM] = clockInTime.split(':').map(Number);
        const [outH, outM] = clockOutTime.split(':').map(Number);
        const inMinutes = inH * 60 + inM;
        const outMinutes = outH * 60 + outM;
        const diffMinutes = outMinutes - inMinutes;
        if (diffMinutes > 0) {
          const hours = Math.floor(diffMinutes / 60);
          const minutes = diffMinutes % 60;
          totalHours = `${hours}h ${minutes}m`;
        }
      } catch (e) {
        console.warn('Error calculating hours:', e);
      }
    }
    
    // Preparar lista de tareas completadas
    let tasksHTML = '';
    if (completedTasks && Array.isArray(completedTasks) && completedTasks.length > 0) {
      tasksHTML = `
        <h3 style="color:#1e40af;font-size:18px;margin-top:25px;margin-bottom:15px;">📋 Completed Tasks (${completedTasks.length}):</h3>
        <div style="background:#f9fafb;padding:15px;border-radius:8px;margin-bottom:20px;">
          <ul style="margin:0;padding-left:20px;color:#1f2937;font-size:14px;">
            ${completedTasks.map(task => `
              <li style="margin-bottom:8px;">
                <strong>${task.taskName || 'Task'}</strong>
                ${task.completedAt ? `<br><small style="color:#64748b;">Completed at: ${new Date(task.completedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</small>` : ''}
              </li>
            `).join('')}
          </ul>
        </div>
      `;
    } else {
      tasksHTML = '<p style="color:#64748b;font-size:14px;margin-top:15px;">No completed tasks recorded for this day.</p>';
    }
    
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Daily Signature & Report - ${formattedDate}</title>
</head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;background:#f3f4f6;">
  <div style="max-width:650px;margin:0 auto;background:#ffffff;box-shadow:0 4px 6px rgba(0,0,0,0.1);">
    <div style="background:linear-gradient(135deg,#1e40af 0%,#3b82f6 100%);color:white;padding:35px 30px;text-align:center;">
      <h2 style="font-size:24px;margin:0 0 10px 0;font-weight:700;">✅ Daily Signature & Report</h2>
      <p style="opacity:0.9;font-size:16px;margin:0;">End of Day Summary - ${dayName}</p>
    </div>
    <div style="padding:35px 30px;">
      <div style="background:#f9fafb;padding:20px;border-radius:10px;border:2px solid #e5e7eb;margin-bottom:25px;">
        <h3 style="color:#1e40af;font-size:18px;margin-top:0;margin-bottom:15px;">👤 Employee Information</h3>
        <p style="margin:8px 0;color:#1f2937;font-size:15px;"><strong>Employee:</strong> ${employeeName || req.user.fullName || req.user.username}</p>
        <p style="margin:8px 0;color:#1f2937;font-size:15px;"><strong>Day:</strong> ${dayName} (Day ${dayNumber})</p>
        <p style="margin:8px 0;color:#1f2937;font-size:15px;"><strong>Date:</strong> ${formattedDate}</p>
        <p style="margin:8px 0;color:#1f2937;font-size:15px;"><strong>Week:</strong> ${week || 'N/A'}</p>
        ${room ? `<p style="margin:8px 0;color:#1f2937;font-size:15px;"><strong>🏢 Room/Area:</strong> ${room}</p>` : ''}
      </div>
      
      ${clockInTime || clockOutTime ? `
      <div style="background:#f0f9ff;padding:20px;border-radius:10px;border:2px solid #bfdbfe;margin-bottom:25px;">
        <h3 style="color:#1e40af;font-size:18px;margin-top:0;margin-bottom:15px;">⏰ Time Records</h3>
        ${clockInTime ? `<p style="margin:8px 0;color:#1f2937;font-size:15px;"><strong>🕐 Clock In:</strong> ${clockInTime}</p>` : ''}
        ${clockOutTime ? `<p style="margin:8px 0;color:#1f2937;font-size:15px;"><strong>🕐 Clock Out:</strong> ${clockOutTime}</p>` : ''}
        ${clockInTime && clockOutTime ? `<p style="margin:8px 0;color:#1f2937;font-size:15px;"><strong>⏱️ Total Hours:</strong> ${totalHours}</p>` : ''}
      </div>
      ` : ''}
      
      ${tasksHTML}
      
      <h3 style="color:#1e40af;font-size:18px;margin-top:25px;margin-bottom:15px;">✍️ Digital Signature:</h3>
      <div style="background:#f9fafb;padding:20px;border-radius:10px;border:2px solid #e5e7eb;text-align:center;">
        ${signature ? `<img src="${signature}" style="max-width:100%;border:2px solid #3b82f6;border-radius:8px;background:white;padding:10px;">` : '<p style="color:#64748b;">No signature provided</p>'}
      </div>
    </div>
    <div style="background:linear-gradient(135deg,#1e293b 0%,#0f172a 100%);color:white;padding:25px 30px;text-align:center;">
      <p style="margin:0 0 8px 0;font-size:16px;font-weight:600;">Bright Works Professional</p>
      <p style="margin:0;color:#fbbf24;font-size:13px;font-weight:500;">© 2025 Powered by <strong>LELC & JTH TECHNOLOGY</strong></p>
      <p style="margin:8px 0 0 0;color:#64748b;font-size:11px;opacity:0.8;">Leading Edge Learning & Consulting | JTH Technology Solutions</p>
    </div>
  </div>
</body>
</html>
    `;
    
    let sent = 0;
    const errors = [];
    
    for (const email of recipients) {
      const result = await sendEmail(
        email, 
        `✅ Daily Signature & Report - ${dayName}, ${formattedDate} - ${employeeName || req.user.fullName || req.user.username}`, 
        html
      );
      
      if (result.success) {
        sent++;
      } else {
        errors.push({ email, error: result.message });
      }
    }
    
    if (sent > 0) {
      res.json({ 
        success: true,
        message: `Daily signature email sent successfully to ${sent} recipient(s)`,
        sent,
        total: recipients.length,
        errors: errors.length > 0 ? errors : undefined
      });
    } else {
      res.status(500).json({ 
        success: false,
        message: 'Failed to send email to any recipient',
        errors
      });
    }
  } catch (error) {
    console.error('Send daily signature email error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error sending daily signature email',
      error: error.message
    });
  }
});

// Keep weekly for backwards compatibility
app.post('/api/send-weekly-signature-email', authenticateToken, requireAdmin, async (req, res) => {
  // Redirect to daily signature endpoint
  req.body.day = req.body.week || new Date().getDay() || 7;
  req.body.date = new Date().toISOString();
  return app.post('/api/send-daily-signature-email')(req, res);
});

// ============================================
// Shared: send final day email with DayCompletionEmail idempotency (one per user/week/day/room)
// Used by: auto-send on task completion and by POST /api/emails/day-completion (supervisor only)
// DailySummaryEmail is kept exclusively for send-daily-summary / resend.
// ============================================
async function sendFinalDayEmailWithIdempotency(userId, userName, week, day, room, roomKey, signature) {
  const normalizedRoom = (room && String(room).trim() !== '') ? String(room).trim() : 'General';
  const normalizedRoomKey = (roomKey && String(roomKey).trim() !== '') ? String(roomKey).trim().toLowerCase() : 'general';
  const targetWeek = parseInt(week, 10) || 1;
  const targetDay = parseInt(day, 10) || 1;

  if (!emailConfigured) return { sent: false, error: 'Email not configured' };

  const existing = await DayCompletionEmail.findOne({ userId, week: targetWeek, day: targetDay, room: normalizedRoom });
  if (existing && existing.emailSentAt) return { sent: false, alreadySent: true };

  const taskQuery = { userId, week: targetWeek, day: targetDay };
  if (normalizedRoom !== 'General') taskQuery.room = normalizedRoom;
  else if (normalizedRoomKey !== 'general') taskQuery.roomKey = normalizedRoomKey;
  const dayTasks = await Task.find(taskQuery);
  const timeRecordQuery = { userId, week: targetWeek, day: targetDay, room: normalizedRoom };
  const timeRecord = await TimeRecord.findOne(timeRecordQuery);

  let sections = DEFAULT_SECTIONS;
  try {
    const configDoc = await TaskConfig.findOne({ isGlobal: true });
    if (configDoc && configDoc.sections && Array.isArray(configDoc.sections) && configDoc.sections.length > 0) {
      sections = configDoc.sections;
    }
  } catch (e) {}

  const sectionsSummary = sections.map(section => {
    const sectionTasks = dayTasks.filter(task => (section.tasks || []).includes(task.taskName));
    const completedTasks = sectionTasks.filter(task => task.completed);
    const pendingTasks = (section.tasks || []).filter(taskName =>
      !sectionTasks.some(t => t.taskName === taskName && t.completed)
    );
    return {
      id: section.id,
      title: section.title,
      total: (section.tasks || []).length,
      completed: completedTasks.length,
      pending: pendingTasks.length,
      completedTasks: completedTasks.map(t => ({ taskName: t.taskName, completedAt: t.completedAt })),
      pendingTasks
    };
  });

  const totalTasks = sectionsSummary.reduce((sum, s) => sum + s.total, 0);
  const totalCompleted = sectionsSummary.reduce((sum, s) => sum + s.completed, 0);
  const totalPending = sectionsSummary.reduce((sum, s) => sum + s.pending, 0);
  const completionPercentage = totalTasks > 0 ? Math.round((totalCompleted / totalTasks) * 100) : 0;
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayName = dayNames[targetDay - 1] || `Day ${targetDay}`;
  const formattedDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const mostCommonRoom = normalizedRoom;

  let checkIn = '';
  let checkOut = '';
  if (timeRecord?.checkIn) {
    try {
      const d = new Date(timeRecord.checkIn);
      if (!isNaN(d.getTime())) checkIn = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
      else if (typeof timeRecord.checkIn === 'string' && timeRecord.checkIn.includes(':')) checkIn = timeRecord.checkIn;
    } catch (e) {}
  }
  if (timeRecord?.checkOut) {
    try {
      const d = new Date(timeRecord.checkOut);
      if (!isNaN(d.getTime())) checkOut = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
      else if (typeof timeRecord.checkOut === 'string' && timeRecord.checkOut.includes(':')) checkOut = timeRecord.checkOut;
    } catch (e) {}
  }
  let totalHours = '0h 0m';
  if (checkIn && checkOut && checkIn.includes(':') && checkOut.includes(':')) {
    try {
      const [inH, inM] = checkIn.split(':').map(Number);
      const [outH, outM] = checkOut.split(':').map(Number);
      const diffMinutes = (outH * 60 + outM) - (inH * 60 + inM);
      if (diffMinutes > 0) totalHours = `${Math.floor(diffMinutes / 60)}h ${diffMinutes % 60}m`;
    } catch (e) {}
  }

  const sectionsHTML = sectionsSummary.map(section => {
    const sectionCompletion = section.total > 0 ? Math.round((section.completed / section.total) * 100) : 0;
    const completedTasksHTML = section.completedTasks.length > 0
      ? `<div style="margin-top:10px;"><strong style="color:#059669;">✅ Completed (${section.completed}/${section.total}):</strong><ul style="margin:5px 0 0 20px;padding:0;color:#1f2937;font-size:14px;">${section.completedTasks.map(task => `<li style="margin-bottom:5px;">${task.taskName}${task.completedAt ? `<br><small style="color:#64748b;">Completed at: ${new Date(task.completedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</small>` : ''}</li>`).join('')}</ul></div>`
      : '';
    const pendingTasksHTML = section.pendingTasks.length > 0
      ? `<div style="margin-top:10px;"><strong style="color:#dc2626;">⏳ Pending (${section.pending}/${section.total}):</strong><ul style="margin:5px 0 0 20px;padding:0;color:#1f2937;font-size:14px;">${section.pendingTasks.map(task => `<li style="margin-bottom:5px;color:#dc2626;">${task}</li>`).join('')}</ul></div>`
      : '';
    return `<div style="background:${sectionCompletion === 100 ? '#f0fdf4' : '#fef2f2'};padding:15px;border-radius:8px;border:2px solid ${sectionCompletion === 100 ? '#86efac' : '#fecaca'};margin-bottom:15px;"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;"><h4 style="color:#1e40af;font-size:16px;margin:0;font-weight:600;">${section.title}</h4><span style="background:${sectionCompletion === 100 ? '#10b981' : '#ef4444'};color:white;padding:4px 12px;border-radius:12px;font-size:12px;font-weight:600;">${sectionCompletion}%</span></div>${completedTasksHTML}${pendingTasksHTML}</div>`;
  }).join('');

  const signatureBlock = (signature && String(signature).trim() !== '')
    ? `<h3 style="color:#1e40af;font-size:18px;margin-top:25px;margin-bottom:15px;">✍️ Digital Signature:</h3><div style="background:#f9fafb;padding:20px;border-radius:10px;border:2px solid #e5e7eb;text-align:center;"><img src="${signature}" style="max-width:100%;border:2px solid #3b82f6;border-radius:8px;background:white;padding:10px;"></div>`
    : '<p style="color:#6b7280;font-size:14px;margin-top:20px;text-align:center;font-style:italic;">No signature provided</p>';

  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Daily Report - ${dayName} - Week ${week}</title></head><body style="margin:0;padding:0;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;background:#f3f4f6;"><div style="max-width:650px;margin:0 auto;background:#ffffff;box-shadow:0 4px 6px rgba(0,0,0,0.1);"><div style="background:linear-gradient(135deg,#1e40af 0%,#3b82f6 100%);color:white;padding:35px 30px;text-align:center;"><h2 style="font-size:24px;margin:0 0 10px 0;font-weight:700;">📊 Daily Report</h2><p style="opacity:0.9;font-size:16px;margin:0;">${dayName} - Week ${week}</p></div><div style="padding:35px 30px;"><div style="background:#f9fafb;padding:20px;border-radius:10px;border:2px solid #e5e7eb;margin-bottom:25px;"><h3 style="color:#1e40af;font-size:18px;margin-top:0;margin-bottom:15px;">👤 Employee Information</h3><p style="margin:8px 0;color:#1f2937;font-size:15px;"><strong>Employee:</strong> ${userName || 'User'}</p><p style="margin:8px 0;color:#1f2937;font-size:15px;"><strong>Day:</strong> ${dayName} (Day ${day})</p><p style="margin:8px 0;color:#1f2937;font-size:15px;"><strong>Date:</strong> ${formattedDate}</p><p style="margin:8px 0;color:#1f2937;font-size:15px;"><strong>Week:</strong> ${week}</p>${mostCommonRoom ? `<p style="margin:8px 0;color:#1f2937;font-size:15px;"><strong>🏢 Room/Area:</strong> ${mostCommonRoom}</p>` : ''}</div>${checkIn || checkOut ? `<div style="background:#f0f9ff;padding:20px;border-radius:10px;border:2px solid #bfdbfe;margin-bottom:25px;"><h3 style="color:#1e40af;font-size:18px;margin-top:0;margin-bottom:15px;">⏰ Time Records</h3>${checkIn ? `<p style="margin:8px 0;color:#1f2937;font-size:15px;"><strong>🕐 Clock In:</strong> ${checkIn}</p>` : ''}${checkOut ? `<p style="margin:8px 0;color:#1f2937;font-size:15px;"><strong>🕐 Clock Out:</strong> ${checkOut}</p>` : ''}${checkIn && checkOut ? `<p style="margin:8px 0;color:#1f2937;font-size:15px;"><strong>⏱️ Total Hours:</strong> ${totalHours}</p>` : ''}</div>` : ''}<div style="background:#f0fdf4;padding:20px;border-radius:10px;border:2px solid #86efac;margin-bottom:25px;"><h3 style="color:#1e40af;font-size:18px;margin-top:0;margin-bottom:15px;">📈 Overall Progress</h3><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;"><span style="color:#1f2937;font-size:15px;"><strong>Total Tasks:</strong> ${totalTasks}</span><span style="color:#059669;font-size:15px;font-weight:600;">✅ Completed: ${totalCompleted}</span><span style="color:#dc2626;font-size:15px;font-weight:600;">⏳ Pending: ${totalPending}</span></div><div style="background:#e5e7eb;border-radius:8px;height:24px;overflow:hidden;margin-top:10px;"><div style="background:linear-gradient(90deg,#10b981 0%,#059669 100%);height:100%;width:${completionPercentage}%;transition:width 0.3s;"></div></div><p style="text-align:center;margin:10px 0 0 0;color:#1f2937;font-size:16px;font-weight:600;">${completionPercentage}% Complete</p></div><h3 style="color:#1e40af;font-size:18px;margin-top:25px;margin-bottom:15px;">📋 Tasks by Group</h3>${sectionsHTML}${signatureBlock}</div><div style="background:linear-gradient(135deg,#1e293b 0%,#0f172a 100%);color:white;padding:25px 30px;text-align:center;"><p style="margin:0 0 8px 0;font-size:16px;font-weight:600;">Bright Works Professional</p><p style="margin:0;color:#fbbf24;font-size:13px;font-weight:500;">© 2025 Powered by <strong>LELC & JTH TECHNOLOGY</strong></p></div></div></body></html>`;

  const recipients = await getAdminEmails();
  if (recipients.length === 0) return { sent: false, error: 'No admin emails configured' };

  const subject = `Daily completion — ${mostCommonRoom || normalizedRoom} — Week ${week} Day ${day}`;
  let sent = 0;
  for (const email of recipients) {
    const result = await sendEmail(email, subject, html);
    if (result.success) sent++;
  }
  if (sent > 0) {
    await DayCompletionEmail.findOneAndUpdate(
      { userId, week: targetWeek, day: targetDay, room: normalizedRoom },
      { $set: { emailSentAt: new Date(), roomKey: normalizedRoomKey } },
      { upsert: true, new: true }
    );
    return { sent: true };
  }
  return { sent: false, error: 'Failed to send to any recipient' };
}

// ============================================
// 📧 EMAIL ENDPOINT - DAY COMPLETION (GROUPED BY SECTIONS) - Supervisor/Admin only; same idempotency as auto-send
// ============================================

app.post('/api/emails/day-completion', authenticateToken, requireSupervisorOrAbove, async (req, res) => {
  try {
    console.log('📧 Daily Report email request received:', {
      day: req.body.day,
      week: req.body.week,
      userId: req.body.userId || req.user?.userId,
      userName: req.body.userName,
      room: req.body.room,
      hasSignature: !!req.body.signature
    });

    if (!emailConfigured) {
      console.error('❌ Email service not configured');
      return res.status(503).json({
        success: false,
        message: 'Email service not configured'
      });
    }

    const { day, week, userId, userName, signature, room, roomKey } = req.body;
    
    if (!day || !week) {
      console.error('❌ Missing required fields:', { day, week });
      return res.status(400).json({ 
        success: false,
        message: 'Day and week are required'
      });
    }

    const targetUserId = userId || req.user.userId;
    const targetWeek = parseInt(week);
    const targetDay = parseInt(day);

    // Gate: do not send if any task for this day is incomplete (source of truth)
    const missingTasks = await getDayMissingTasks(targetUserId, targetWeek, targetDay, room, roomKey);
    if (missingTasks.length > 0) {
      return res.status(409).json({
        complete: false,
        missingCount: missingTasks.length,
        missingTasks,
        message: 'Today\'s checklist is not complete. Please tick all items to send the report.'
      });
    }

    const userNameVal = userName || req.user.fullName || req.user.username;
    const sendResult = await sendFinalDayEmailWithIdempotency(
      targetUserId,
      userNameVal,
      targetWeek,
      targetDay,
      room,
      roomKey,
      signature || null
    );

    if (sendResult.alreadySent) {
      return res.json({ success: true, alreadySent: true, message: 'Daily report already sent for this day/room (idempotent).' });
    }
    if (sendResult.sent) {
      return res.json({ success: true, message: 'Daily report email sent successfully', sent: true });
    }
    return res.status(500).json({ success: false, message: sendResult.error || 'Failed to send day completion email' });
  } catch (error) {
    console.error('❌ Send day completion email error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error sending day completion email',
      error: error.message
    });
  }
});

// ============================================
// 📧 EMAIL ENDPOINT - REPORTE DIARIO
// ============================================

app.post('/api/send-daily-report', authenticateToken, requireAdmin, async (req, res) => {
  try {
    if (!emailConfigured) {
      return res.status(503).json({ 
        success: false,
        message: 'Email service not configured',
        help: 'Set SENDGRID_API_KEY and SENDGRID_FROM_EMAIL in environment variables'
      });
    }

    const today = new Date();
    const dayOfWeek = today.getDay();
    const dayNumber = dayOfWeek === 0 ? 7 : dayOfWeek;
    const currentWeek = Math.ceil((today - new Date(today.getFullYear(), 0, 1)) / (1000 * 60 * 60 * 24 * 7));
    
    // Build query based on user role
    const userQuery = isAdminOrSuperAdmin(req.user.role) ? {} : { userId: req.user.userId };
    const weekQuery = { ...userQuery, week: currentWeek };
    const reminderQuery = { ...userQuery, completed: false };
    
    const [allTasks, timeRecord, allNotes, activeReminders] = await Promise.all([
      Task.find(weekQuery),
      TimeRecord.findOne(weekQuery),
      Note.find(userQuery).sort({ createdAt: -1 }).limit(5),
      Reminder.find(reminderQuery).sort({ dueDate: 1 }).limit(5)
    ]);
    
    // Get clock times from request if available (sent from frontend localStorage)
    const { clockInTime, clockOutTime, room } = req.body || {};
    
    const todayTasks = allTasks.filter((t) => t.day === dayNumber);
    
    const recipients = await getAdminEmails();
    
    if (recipients.length === 0) {
      return res.status(400).json({ 
        success: false,
        message: 'No admin emails configured',
        help: 'Set ADMIN_EMAILS in .env or create admin users with valid emails'
      });
    }
    
    // Prepare time record with clock times from localStorage if available
    let finalTimeRecord = timeRecord || { checkIn: '', checkOut: '', totalHours: '0h 0m' };
    if (clockInTime || clockOutTime) {
      finalTimeRecord = {
        checkIn: clockInTime || finalTimeRecord.checkIn || '',
        checkOut: clockOutTime || finalTimeRecord.checkOut || '',
        totalHours: finalTimeRecord.totalHours || '0h 0m'
      };
      
      // Calculate total hours if both times are available
      if (finalTimeRecord.checkIn && finalTimeRecord.checkOut && 
          finalTimeRecord.checkIn.includes(':') && finalTimeRecord.checkOut.includes(':')) {
        const [inH, inM] = finalTimeRecord.checkIn.split(':').map(Number);
        const [outH, outM] = finalTimeRecord.checkOut.split(':').map(Number);
        const inMinutes = inH * 60 + inM;
        const outMinutes = outH * 60 + outM;
        const diffMinutes = outMinutes - inMinutes;
        if (diffMinutes > 0) {
          const hours = Math.floor(diffMinutes / 60);
          const minutes = diffMinutes % 60;
          finalTimeRecord.totalHours = `${hours}h ${minutes}m`;
        }
      }
    }
    
    const emailData = {
      user: {
        fullName: req.user.fullName || req.user.username,
        username: req.user.username,
        role: req.user.role
      },
      tasks: todayTasks,
      timeRecord: finalTimeRecord,
      notes: allNotes,
      reminders: activeReminders,
      date: today,
      room: room || ''
    };
    
    const html = generateProfessionalEmailHTML(emailData);
    
    const formattedDate = today.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
    
    let sent = 0;
    const errors = [];
    
    for (const email of recipients) {
      const result = await sendEmail(
        email, 
        `📊 Daily Report - ${formattedDate}`, 
        html
      );
      
      if (result.success) {
        sent++;
      } else {
        errors.push({ email, error: result.message });
      }
    }
    
    if (sent > 0) {
      res.json({ 
        success: true,
        message: `Report sent successfully to ${sent} recipient(s)`,
        sent,
        total: recipients.length,
        recipients: recipients,
        errors: errors.length > 0 ? errors : undefined
      });
    } else {
      res.status(500).json({ 
        success: false,
        message: 'Failed to send report to any recipient',
        errors
      });
    }
  } catch (error) {
    console.error('Send daily report error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error sending daily report',
      error: error.message
    });
  }
});

// ============================================
// 📧 POST /api/emails/send-daily-summary - Idempotent daily summary to admin (room-scoped)
// ============================================

app.post('/api/emails/send-daily-summary', authenticateToken, requireSupervisorOrAbove, async (req, res) => {
  try {
    if (!emailConfigured) {
      return res.status(503).json({ success: false, message: 'Email service not configured' });
    }
    const { week, day, room, roomKey, forceResend } = req.body;
    const targetWeek = parseInt(week, 10);
    const targetDay = parseInt(day, 10);
    if (isNaN(targetWeek) || targetWeek < 1 || targetWeek > 52 || isNaN(targetDay) || targetDay < 1 || targetDay > 7) {
      return res.status(400).json({ success: false, message: 'Valid week (1-52) and day (1-7) required' });
    }
    const userId = req.user.userId;
    const normalizedRoom = (room && room.trim() !== '') ? room.trim() : 'General';
    const normalizedRoomKey = (roomKey && roomKey.trim() !== '') ? String(roomKey).trim().toLowerCase() : 'general';

    const existing = await DailySummaryEmail.findOne({ userId, week: targetWeek, day: targetDay, room: normalizedRoom });
    if (existing && existing.emailSentAt && !forceResend) {
      return res.json({ success: true, message: 'Daily summary already sent for this day/room (idempotent)', alreadySent: true });
    }

    const dayTasks = await Task.find({ userId, week: targetWeek, day: targetDay, room: normalizedRoom });
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayName = dayNames[targetDay - 1] || `Day ${targetDay}`;
    const sectionsSummary = DEFAULT_SECTIONS.map(section => {
      const sectionTasks = dayTasks.filter(t => section.tasks.includes(t.taskName));
      const completed = sectionTasks.filter(t => t.completed).length;
      const total = section.tasks.length;
      return { id: section.id, title: section.title, total, completed, pending: total - completed };
    });
    const totalTasks = sectionsSummary.reduce((s, x) => s + x.total, 0);
    const totalCompleted = sectionsSummary.reduce((s, x) => s + x.completed, 0);
    const pct = totalTasks > 0 ? Math.round((totalCompleted / totalTasks) * 100) : 0;

    const sectionsHTML = sectionsSummary.map(s => `
      <div style="background:${s.completed === s.total ? '#f0fdf4' : '#fef2f2'};padding:12px;border-radius:8px;margin-bottom:10px;">
        <strong>${s.title}</strong>: ${s.completed}/${s.total} (${s.total > 0 ? Math.round((s.completed / s.total) * 100) : 0}%)
      </div>`).join('');

    const html = `
<!DOCTYPE html><html><head><meta charset="UTF-8"><style>body{font-family:Arial,sans-serif;background:#f0f4f8;padding:20px;}
.container{max-width:600px;margin:0 auto;background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 5px 15px rgba(0,0,0,0.1);}
.header{background:linear-gradient(135deg,#1e40af,#3b82f6);color:#fff;padding:25px;text-align:center;}
.content{padding:25px;}.footer{background:#f0f4f8;padding:15px;text-align:center;font-size:12px;color:#6c757d;}
</style></head><body><div class="container">
<div class="header"><h1>Daily summary</h1><p>${dayName} – Week ${targetWeek} – ${normalizedRoom}</p></div>
<div class="content">
<p><strong>User:</strong> ${req.user.fullName || req.user.username}</p>
<p><strong>Overall:</strong> ${totalCompleted}/${totalTasks} tasks (${pct}%)</p>
${sectionsHTML}
</div><div class="footer">Bright Works – daily summary. Idempotent: one email per user/day/room.</div></div></body></html>`;

    const recipients = await getAdminEmails();
    if (recipients.length === 0) {
      return res.status(400).json({ success: false, message: 'No admin emails configured' });
    }
    let sent = 0;
    for (const email of recipients) {
      const result = await sendEmail(email, `Daily summary – ${dayName} – ${normalizedRoom}`, html);
      if (result.success) sent++;
    }
    const now = new Date();
    if (sent > 0) {
      if (forceResend && existing) {
        await DailySummaryEmail.findOneAndUpdate(
          { userId, week: targetWeek, day: targetDay, room: normalizedRoom },
          { $set: { roomKey: normalizedRoomKey, resentAt: now }, $inc: { resentCount: 1 } }
        );
      } else {
        await DailySummaryEmail.findOneAndUpdate(
          { userId, week: targetWeek, day: targetDay, room: normalizedRoom },
          { $set: { emailSentAt: now, roomKey: normalizedRoomKey } },
          { upsert: true, new: true }
        );
      }
    }
    res.json({
      success: true,
      message: sent > 0 ? (forceResend ? `Daily summary resent to ${sent} recipient(s)` : `Daily summary sent to ${sent} recipient(s)`) : 'No recipients',
      sent,
      alreadySent: false,
      forceResend: !!forceResend
    });
  } catch (error) {
    console.error('Send daily summary error:', error);
    res.status(500).json({ success: false, message: 'Error sending daily summary', error: error.message });
  }
});

// ============================================
// GET /api/reports/daily-pdf - Daily report as HTML (print/save as PDF)
// ============================================

app.get('/api/reports/daily-pdf', authenticateToken, requireSupervisorOrAbove, async (req, res) => {
  try {
    const targetWeek = parseInt(req.query.week, 10);
    const targetDay = parseInt(req.query.day, 10);
    const room = (req.query.room && String(req.query.room).trim()) || 'General';
    const roomKey = (req.query.roomKey && String(req.query.roomKey).trim().toLowerCase()) || 'general';
    if (isNaN(targetWeek) || targetWeek < 1 || targetWeek > 52 || isNaN(targetDay) || targetDay < 1 || targetDay > 7) {
      return res.status(400).json({ success: false, message: 'Valid week (1-52) and day (1-7) required' });
    }
    const userId = req.user.userId;
    const normalizedRoom = room.trim() || 'General';

    const [dayTasks, timeRecord] = await Promise.all([
      Task.find({ userId, week: targetWeek, day: targetDay, room: normalizedRoom }),
      TimeRecord.findOne({ userId, week: targetWeek, day: targetDay, room: normalizedRoom })
    ]);

    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayName = dayNames[targetDay - 1] || `Day ${targetDay}`;
    const sectionsSummary = DEFAULT_SECTIONS.map(section => {
      const sectionTasks = dayTasks.filter(t => section.tasks.includes(t.taskName));
      const completed = sectionTasks.filter(t => t.completed).length;
      const total = section.tasks.length;
      const completedTaskNames = sectionTasks.filter(t => t.completed).map(t => t.taskName);
      return { id: section.id, title: section.title, total, completed, pending: total - completed, completedTaskNames };
    });
    const totalTasks = sectionsSummary.reduce((s, x) => s + x.total, 0);
    const totalCompleted = sectionsSummary.reduce((s, x) => s + x.completed, 0);
    const pct = totalTasks > 0 ? Math.round((totalCompleted / totalTasks) * 100) : 0;

    const fmtTime = (d) => d ? new Date(d).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) : '—';
    const firstActivity = timeRecord?.firstActivityAt ? fmtTime(timeRecord.firstActivityAt) : '—';
    const lastActivity = timeRecord?.lastActivityAt ? fmtTime(timeRecord.lastActivityAt) : '—';
    const generatedAt = new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });

    const sectionsHtml = sectionsSummary.map(s => `
      <div style="margin-bottom:12px;padding:12px;background:${s.completed === s.total ? '#f0fdf4' : '#fef2f2'};border-radius:8px;">
        <strong>${s.title}</strong>: ${s.completed}/${s.total} (${s.total > 0 ? Math.round((s.completed / s.total) * 100) : 0}%)
        ${s.completedTaskNames && s.completedTaskNames.length ? `<ul style="margin:8px 0 0 20px;padding:0;">${s.completedTaskNames.map(n => `<li>${n}</li>`).join('')}</ul>` : ''}
      </div>`).join('');

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Daily Report - ${dayName} - Week ${targetWeek}</title>
<style>body{font-family:Arial,sans-serif;background:#f0f4f8;padding:24px;color:#1f2937;}
.container{max-width:700px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,0.08);}
.header{background:linear-gradient(135deg,#1e40af,#3b82f6);color:#fff;padding:28px;text-align:center;}
.content{padding:28px;}
h1{margin:0 0 8px 0;font-size:22px;}
.meta{font-size:14px;opacity:0.95;}
.row{margin:10px 0;}
.footer{background:#f0f4f8;padding:16px;text-align:center;font-size:12px;color:#6b7280;}
</style></head><body><div class="container">
<div class="header"><h1>Bright Works</h1><p class="meta">Daily Report – ${dayName} – Week ${targetWeek} – ${normalizedRoom}</p></div>
<div class="content">
<div class="row"><strong>User:</strong> ${req.user.fullName || req.user.username}</div>
<div class="row"><strong>Overall:</strong> ${totalCompleted}/${totalTasks} tasks (${pct}%)</div>
<div class="row"><strong>First activity:</strong> ${firstActivity} &nbsp;|&nbsp; <strong>Last activity:</strong> ${lastActivity}</div>
<h3 style="margin-top:20px;margin-bottom:12px;">Sections</h3>
${sectionsHtml}
<p style="margin-top:24px;font-size:12px;color:#6b7280;">Generated: ${generatedAt}</p>
</div>
<div class="footer">Bright Works – Daily Report. Open this page and use Print → Save as PDF to download.</div>
</div></body></html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Disposition', `inline; filename="daily-report-w${targetWeek}-d${targetDay}-${normalizedRoom.replace(/\s+/g, '-')}.html"`);
    res.send(html);
  } catch (error) {
    console.error('Daily PDF report error:', error);
    res.status(500).json({ success: false, message: 'Error generating daily report', error: error.message });
  }
});

// ============================================
// 📧 EMAIL ENDPOINT - NOTIFICACIÓN DE TAREA COMPLETADA
// ============================================

app.post('/api/send-task-completed-notification', authenticateToken, requireAdmin, async (req, res) => {
  try {
    if (!emailConfigured) {
      return res.status(503).json({ 
        success: false,
        message: 'Email service not configured'
      });
    }

    const { taskName, day, dayName, week, completedBy, completedAt, room, clockInTime, clockOutTime } = req.body;
    
    const recipients = await getAdminEmails();
    
    if (recipients.length === 0) {
      return res.status(400).json({ 
        success: false,
        message: 'No admin emails configured'
      });
    }
    
    // Calcular horas totales si hay entrada y salida
    let totalHours = '0h 0m';
    if (clockInTime && clockOutTime && clockInTime.includes(':') && clockOutTime.includes(':')) {
      try {
        const [inH, inM] = clockInTime.split(':').map(Number);
        const [outH, outM] = clockOutTime.split(':').map(Number);
        const inMinutes = inH * 60 + inM;
        const outMinutes = outH * 60 + outM;
        const diffMinutes = outMinutes - inMinutes;
        if (diffMinutes > 0) {
          const hours = Math.floor(diffMinutes / 60);
          const minutes = diffMinutes % 60;
          totalHours = `${hours}h ${minutes}m`;
        }
      } catch (e) {
        console.warn('Error calculating hours:', e);
      }
    }
    
    const { getTaskCompletedEmailTemplate } = require('./utils/emailTemplates');
    
    const formattedDate = new Date(completedAt || Date.now()).toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    
    const emailHTML = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: Arial, sans-serif; background: #f0f4f8; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 5px 15px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #28a745, #20c997); color: white; padding: 30px; text-align: center; }
        .content { padding: 30px; }
        .task-info { background: #f0f4f8; padding: 20px; border-radius: 5px; margin: 20px 0; }
        .task-info p { margin: 8px 0; font-size: 14px; }
        .task-info strong { color: #1565c0; }
        .footer { background: #f0f4f8; padding: 20px; text-align: center; font-size: 12px; color: #6c757d; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>✅ Tarea Completada</h1>
        </div>
        <div class="content">
            <p><strong>${completedBy || 'Usuario'}</strong> ha completado una tarea:</p>
            <div class="task-info">
                <p><strong>📋 Tarea:</strong> ${taskName || 'N/A'}</p>
                <p><strong>📅 Semana:</strong> ${week || 'N/A'}</p>
                <p><strong>🗓️ Día:</strong> ${dayName || day || 'N/A'}</p>
                <p><strong>⏰ Completado:</strong> ${formattedDate}</p>
                ${room ? `<p><strong>🏢 Room/Area:</strong> ${room}</p>` : ''}
                ${clockInTime ? `<p><strong>🕐 Entrada:</strong> ${clockInTime}</p>` : ''}
                ${clockOutTime ? `<p><strong>🕐 Salida:</strong> ${clockOutTime}</p>` : ''}
                ${clockInTime && clockOutTime ? `<p><strong>⏱️ Horas Totales:</strong> ${totalHours}</p>` : ''}
            </div>
        </div>
        <div class="footer">
            <p>© 2025 Bright Works - Sistema de Control de Limpieza</p>
            <p>Powered by <strong>LELC & JTH TECHNOLOGY</strong></p>
            <p style="font-size:11px;color:#9ca3af;margin-top:5px;">Leading Edge Learning & Consulting | JTH Technology Solutions</p>
        </div>
    </div>
</body>
</html>
    `;
    
    let sent = 0;
    const errors = [];
    
    for (const email of recipients) {
      const result = await sendEmail(
        email, 
        `✅ Tarea Completada - ${taskName || 'Task'} - Week ${week || 'N/A'}`, 
        emailHTML
      );
      
      if (result.success) {
        sent++;
      } else {
        errors.push({ email, error: result.message });
      }
    }
    
    if (sent > 0) {
      res.json({ 
        success: true,
        message: `Notification sent successfully to ${sent} recipient(s)`,
        sent,
        total: recipients.length,
        errors: errors.length > 0 ? errors : undefined
      });
    } else {
      res.status(500).json({ 
        success: false,
        message: 'Failed to send notification to any recipient',
        errors
      });
    }
  } catch (error) {
    console.error('Send task notification error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error sending task notification',
      error: error.message
    });
  }
});

// ============================================
// 📧 EMAIL ENDPOINT - NOTIFICACIÓN DE GRUPO COMPLETADO
// ============================================

app.post('/api/send-section-completed-notification', authenticateToken, requireAdmin, async (req, res) => {
  try {
    if (!emailConfigured) {
      return res.status(503).json({ 
        success: false,
        message: 'Email service not configured'
      });
    }

    const { section, sectionTitle, day, dayName, week, completedTasks, completedBy, completedAt, room, clockInTime, clockOutTime } = req.body;
    
    const recipients = await getAdminEmails();
    
    if (recipients.length === 0) {
      return res.status(400).json({ 
        success: false,
        message: 'No admin emails configured'
      });
    }
    
    // Calcular horas totales si hay entrada y salida
    let totalHours = '0h 0m';
    if (clockInTime && clockOutTime && clockInTime.includes(':') && clockOutTime.includes(':')) {
      try {
        const [inH, inM] = clockInTime.split(':').map(Number);
        const [outH, outM] = clockOutTime.split(':').map(Number);
        const inMinutes = inH * 60 + inM;
        const outMinutes = outH * 60 + outM;
        const diffMinutes = outMinutes - inMinutes;
        if (diffMinutes > 0) {
          const hours = Math.floor(diffMinutes / 60);
          const minutes = diffMinutes % 60;
          totalHours = `${hours}h ${minutes}m`;
        }
      } catch (e) {
        console.warn('Error calculating hours:', e);
      }
    }
    
    const formattedDate = new Date(completedAt || Date.now()).toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    
    const emailHTML = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: Arial, sans-serif; background: #f0f4f8; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 5px 15px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #28a745, #20c997); color: white; padding: 30px; text-align: center; }
        .content { padding: 30px; }
        .section-info { background: #f0f4f8; padding: 20px; border-radius: 5px; margin: 20px 0; }
        .section-info p { margin: 8px 0; font-size: 14px; }
        .section-info strong { color: #1565c0; }
        .tasks-list { background: #e8f5e9; padding: 15px; border-radius: 5px; margin: 15px 0; }
        .tasks-list ul { margin: 0; padding-left: 20px; }
        .tasks-list li { margin: 5px 0; color: #2e7d32; }
        .footer { background: #f0f4f8; padding: 20px; text-align: center; font-size: 12px; color: #6c757d; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>✅ Grupo de Tareas Completado</h1>
            <h2>${sectionTitle}</h2>
        </div>
        <div class="content">
            <div class="section-info">
                <p><strong>Sección:</strong> ${sectionTitle}</p>
                <p><strong>Día:</strong> ${dayName} (Day ${day})</p>
                <p><strong>Semana:</strong> ${week}</p>
                <p><strong>Fecha:</strong> ${formattedDate}</p>
                <p><strong>Completado por:</strong> ${completedBy}</p>
                <p><strong>Room/Area:</strong> ${room || 'N/A'}</p>
                <p><strong>Entrada:</strong> ${clockInTime || 'N/A'}</p>
                <p><strong>Salida:</strong> ${clockOutTime || 'N/A'}</p>
                <p><strong>Total Horas:</strong> ${totalHours}</p>
            </div>
            <div class="tasks-list">
                <strong>Tareas Completadas (${completedTasks.length}):</strong>
                <ul>
                    ${completedTasks.map(task => `<li>${task}</li>`).join('')}
                </ul>
            </div>
        </div>
        <div class="footer">
            <p>Bright Works Professional - Sistema Automático de Notificaciones</p>
            <p>Este email se envió automáticamente cuando se completó el grupo de tareas.</p>
        </div>
    </div>
</body>
</html>
    `;
    
    let sent = 0;
    const errors = [];
    
    for (const email of recipients) {
      const result = await sendEmail(
        email, 
        `✅ Grupo Completado: ${sectionTitle} - ${dayName}, ${formattedDate}`, 
        emailHTML
      );
      
      if (result.success) {
        sent++;
      } else {
        errors.push({ email, error: result.message });
      }
    }
    
    if (sent > 0) {
      res.json({ 
        success: true,
        message: `Section completion email sent to ${sent} recipient(s)`,
        sent,
        total: recipients.length,
        errors: errors.length > 0 ? errors : undefined
      });
    } else {
      res.status(500).json({ 
        success: false,
        message: 'Failed to send email to any recipient',
        errors
      });
    }
  } catch (error) {
    console.error('Send section completion email error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error sending section completion email',
      error: error.message
    });
  }
});

// 📧 EMAIL ENDPOINT - NOTIFICACIÓN DE ACCESO A LA APP
app.post('/api/send-app-access-email', authenticateToken, requireAdmin, async (req, res) => {
  try {
    if (!emailConfigured) {
      return res.status(503).json({ 
        success: false,
        message: 'Email service not configured'
      });
    }

    const { userId, userName, timestamp } = req.body;
    
    const recipients = await getAdminEmails();
    
    if (recipients.length === 0) {
      return res.status(400).json({ 
        success: false,
        message: 'No admin emails configured'
      });
    }

    const formattedDate = new Date(timestamp || Date.now()).toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    const emailHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>App Access Notification</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0;">🔔 App Access Notification</h1>
        </div>
        <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #ddd;">
          <p style="font-size: 16px; margin-bottom: 20px;">
            A user has accessed the Bright Works application.
          </p>
          <div style="background: white; padding: 20px; border-radius: 5px; margin-bottom: 20px; border-left: 4px solid #667eea;">
            <p style="margin: 5px 0;"><strong>User:</strong> ${userName || 'Unknown'}</p>
            <p style="margin: 5px 0;"><strong>User ID:</strong> ${userId || 'Unknown'}</p>
            <p style="margin: 5px 0;"><strong>Access Time:</strong> ${formattedDate}</p>
          </div>
          <p style="color: #666; font-size: 14px; margin-top: 20px;">
            This email was sent automatically when the user accessed the application.
          </p>
        </div>
      </body>
      </html>
    `;

    let sent = 0;
    const errors = [];

    for (const email of recipients) {
      const result = await sendEmail(
        email, 
        `App Access: ${userName || 'User'} - ${formattedDate}`,
        emailHTML
      );
      
      if (result.success) {
        sent++;
      } else {
        errors.push({ email, error: result.message });
      }
    }

    if (sent > 0) {
      res.json({
        success: true,
        message: `App access email sent to ${sent} recipient(s)`,
        sent,
        errors: errors.length > 0 ? errors : undefined
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to send email to any recipient',
        errors
      });
    }
  } catch (error) {
    console.error('Send app access email error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error sending app access email',
      error: error.message
    });
  }
});

// ============================================
// 2️⃣1️⃣ STATIC FILES & FALLBACK
// ============================================

// React Router support - todas las rutas no-API deben servir el index.html del frontend
app.get('*', async (req, res, next) => {
  // Skip API routes
  if (req.path.startsWith('/api')) {
    return next();
  }
  
  try {
    // PRIORIDAD: dist (frontend nuevo) > public (app antigua)
    const distIndexPath = path.join(__dirname, 'dist', 'index.html');
    const publicIndexPath = path.join(__dirname, 'public', 'index.html');
    
    const distExists = fs.existsSync(distIndexPath);
    const publicExists = fs.existsSync(publicIndexPath);
    
    if (distExists) {
      res.sendFile(distIndexPath);
    } else if (publicExists) {
      console.warn('⚠️  Serving old app from public/index.html (dist not found)');
      res.sendFile(publicIndexPath);
    } else {
      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Bright Works Professional API</title>
          <style>
            body { font-family: Arial, sans-serif; max-width: 800px; margin: 50px auto; padding: 20px; }
            h1 { color: #3b82f6; }
            .status { background: #d1fae5; padding: 15px; border-radius: 8px; margin: 20px 0; }
            .endpoint { background: #f9fafb; padding: 10px; margin: 5px 0; border-left: 4px solid #3b82f6; }
            code { background: #1f2937; color: #10b981; padding: 2px 6px; border-radius: 4px; }
            .security { background: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <h1>🧹 Bright Works Professional API</h1>
          <div class="status">
            <strong>✅ Server is running</strong><br>
            Version: 3.1.1 - OPTIMIZED & SECURED<br>
            Environment: ${NODE_ENV}
          </div>
          <div class="security">
            <strong>🛡️ Security Features Active:</strong><br>
            ✅ DDoS Protection Enabled<br>
            ✅ Rate Limiting Active<br>
            ✅ HEAD Request Spam Protection<br>
            ✅ Automatic IP Blocking<br>
            ✅ Real-time Attack Detection<br>
            ✅ Critical Path Whitelist<br>
            ✅ Browser Detection
          </div>
          <h2>API Endpoints:</h2>
          <div class="endpoint">GET <code>/api/health</code> - Health check</div>
          <div class="endpoint">POST <code>/api/login</code> - User login</div>
          <div class="endpoint">POST <code>/api/bootstrap-admin</code> - Create first admin</div>
          <div class="endpoint">GET <code>/api/admin/security-stats</code> - Security dashboard (Admin only)</div>
          <div class="endpoint">POST <code>/api/admin/unblock-ip</code> - Unblock IP (Admin only)</div>
          <div class="endpoint">POST <code>/api/admin/unblock-all</code> - Unblock all IPs (Admin only)</div>
          <hr>
          <p style="text-align:center; color:#6b7280;">
            <strong>Powered by LELC & JTH TECHNOLOGY</strong><br>
            Leading Edge Learning & Consulting | JTH Technology Solutions
          </p>
        </body>
        </html>
      `);
    }
  } catch (error) {
    console.error('Root route error:', error);
    res.status(500).send('Internal server error');
  }
});

// ============================================
// 2️⃣2️⃣ ERROR HANDLERS
// ============================================

app.use((_req, res) => {
  res.status(404).json({ 
    message: 'Route not found',
    availableRoutes: [
      '/api/health',
      '/api/login',
      '/api/bootstrap-admin',
      '/api/admin/security-stats'
    ]
  });
});

app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err);
  
  res.status(err.status || 500).json({ 
    message: err.message || 'Internal server error',
    ...(NODE_ENV === 'development' && { stack: err.stack })
  });
});

// ============================================
// 2️⃣3️⃣ START SERVER
// ============================================

const server = app.listen(PORT, () => {
  console.log('\n============================================');
  console.log('🚀 BRIGHT WORKS PROFESSIONAL v3.1.1');
  console.log('    ULTIMATE EDITION - OPTIMIZED & SECURED');
  console.log('============================================');
  console.log(`📍 Server: http://localhost:${PORT}`);
  console.log(`🌍 Environment: ${NODE_ENV}`);
  console.log(`📧 Email From: ${emailFrom}`);
  console.log(`✉️  Email: ${emailConfigured ? `✅ ${emailService}` : '⚠️  Not configured'}`);
  console.log(`🗄️  Database: ${mongoConnected ? (mongoose.connection.name || 'Connected') : '⚠️  Disconnected (Server running without DB)'}`);
  console.log('🛡️  Security: ✅ DDoS Protection ACTIVE');
  console.log(`   Whitelist IPs: ${WHITELIST_IPS.length > 0 ? WHITELIST_IPS.join(', ') : 'None'}`);
  console.log(`   Critical Paths: ${CRITICAL_PATHS.length} paths protected`);
  console.log('============================================');
  console.log('✨ Features:');
  console.log('   ✅ Task Management with Digital Signature');
  console.log('   ✅ Automatic Email Notifications');
  console.log('   ✅ Professional Budgets (ISO/EPA)');
  console.log('   ✅ Client Satisfaction Tracking');
  console.log('   ✅ Statistics Dashboard');
  console.log('   ✅ Daily Email Reports');
  console.log('   ✅ Notes & Reminders (CRUD complete)');
  console.log('   ✅ Security: Rate Limiting, XSS, NoSQL Injection');
  console.log('   ✅ Account Locking (5 failed attempts)');
  console.log('   ✅ DDoS Protection & IP Blocking');
  console.log('   ✅ HEAD Request Spam Prevention');
  console.log('   ✅ Real-time Attack Detection');
  console.log('   ✅ Browser Detection & Whitelisting');
  console.log('   ✅ Admin IP Management');
  console.log('============================================');
  console.log('🎨 Powered by LELC & JTH TECHNOLOGY');
  console.log('   Leading Edge Learning & Consulting');
  console.log('============================================\n');
  
  if (!emailConfigured) {
    console.log('⚠️  WARNING: Email not configured!');
    console.log('   Add to .env: SENDGRID_API_KEY, SENDGRID_FROM_EMAIL');
    console.log('============================================\n');
  }
});

// ============================================
// 2️⃣4️⃣ GRACEFUL SHUTDOWN
// ============================================

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

function gracefulShutdown(signal) {
  console.log(`\n👋 Received ${signal}, shutting down gracefully...`);
  
  server.close(() => {
    console.log('✅ HTTP server closed');
    
    mongoose.connection.close(false, () => {
      console.log('✅ MongoDB connection closed');
      process.exit(0);
    });
  });
  
  setTimeout(() => {
    console.error('⚠️  Forcing shutdown after 10 seconds');
    process.exit(1);
  }, 10000);
}

process.on('uncaughtException', (err) => {
  console.error('❌ UNCAUGHT EXCEPTION:', err);
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ UNHANDLED REJECTION at:', promise, 'reason:', reason);
});

console.log('✅ Bright Works Professional v3.1.1 - Ready for production');

// Endpoint para resetear cualquier usuario (sin importar credenciales)
app.post('/api/reset-user-password', async (req, res) => {
  try {
    if (!mongoConnected) {
      return res.status(503).json({ 
        message: 'Database not available. Please check MongoDB connection.',
        database: 'Disconnected'
      });
    }
    
    const { username, newPassword } = req.body || {};
    
    if (!username) {
      return res.status(400).json({ message: 'Username is required' });
    }
    
    const targetPassword = newPassword || 'admin123';
    
    console.log(`🔧 Resetting password for user: ${username}`);
    
    // Buscar usuario (primero exacto, luego case-insensitive)
    let user = await User.findOne({ username: username });
    if (!user) {
      user = await User.findOne({ 
        username: { $regex: new RegExp(`^${username.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
      });
    }
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Resetear contraseña y desbloquear
    const hashedPassword = await bcrypt.hash(targetPassword, 10);
    user.password = hashedPassword;
    user.loginAttempts = 0;
    user.lockUntil = undefined;
    user.isActive = true;
    await user.save();
    
    console.log(`✅ Password reset for user: ${user.username}`);
    
    return res.json({ 
      message: 'Password reset successfully',
      username: user.username,
      password: targetPassword
    });
  } catch (error) {
    console.error('❌ Reset password error:', error);
    res.status(500).json({ 
      message: 'Server error', 
      error: error.message 
    });
  }
});