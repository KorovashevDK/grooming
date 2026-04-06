const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
require('dotenv').config();
const winston = require('winston');

// Configure Winston logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/auth-errors.log', level: 'error' })
  ]
});

// Validate JWT_SECRET
if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'your_default_secret_key') {
  console.error('❌ ERROR: JWT_SECRET is not set or uses default value!');
  console.error('Please set a strong secret in your .env file.');
  console.error('Example: JWT_SECRET=your-random-secret-key-at-least-32-characters-long');
  process.exit(1);
}

const app = express();
app.set('trust proxy', 1);

const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const allowedOriginPatterns = [
  /^http:\/\/localhost(?::\d+)?$/i,
  /^http:\/\/127\.0\.0\.1(?::\d+)?$/i,
  /^https:\/\/[a-z0-9-]+\.trycloudflare\.com$/i,
  /^https:\/\/[a-z0-9-]+\.pages\.vk-apps\.com$/i,
  /^https:\/\/[a-z0-9-]+\.pages-ac\.vk-apps\.com$/i,
  /^https:\/\/[a-z0-9-]+\.vk-apps\.com$/i,
];

const isOriginAllowed = (origin) => {
  if (!origin) {
    return true;
  }

  if (allowedOrigins.length > 0 && allowedOrigins.includes(origin)) {
    return true;
  }

  return allowedOriginPatterns.some((pattern) => pattern.test(origin));
};

const corsOptions = {
  origin(origin, callback) {
    if (isOriginAllowed(origin)) {
      return callback(null, true);
    }

    return callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions));
app.use(express.json());

// Rate limiting for auth endpoint - 100 requests per 15 minutes per IP
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: { error: 'Too many authentication attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply rate limiter to auth endpoint
app.use('/auth', authLimiter);

app.get('/', (req, res) => {
  res.json({
    ok: true,
    service: 'grooming-backend',
    message: 'Backend is running',
  });
});

app.get('/health', (req, res) => {
  res.json({
    ok: true,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

app.use('/auth', require('./routes/auth'));
app.use('/admin', require('./routes/admin'));
app.use('/employees', require('./routes/employees'));
app.use('/clients', require('./routes/clients'));
app.use('/services', require('./routes/services'));
app.use('/owners', require('./routes/owners'));
app.use('/orders', require('./routes/orders'));
app.use('/pets', require('./routes/pets'));

// Global error handler
app.use((err, req, res, next) => {
  logger.error('Server error:', { error: err.message, stack: err.stack, path: req.path });
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`✅ Server started on port ${PORT}`);
  console.log(`✅ JWT_SECRET is configured: ${process.env.JWT_SECRET.length > 0 ? 'Yes' : 'No'}`);
  console.log(`✅ Rate limiting enabled on /auth (100 requests per 15 minutes)`);
});
