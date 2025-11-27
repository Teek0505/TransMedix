const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const mongoose = require('mongoose');
const { createServer } = require('http');
const { Server } = require('socket.io');
const config = require('./config');
const apiRoutes = require('./routes/api');
const winston = require('winston');
const path = require('path');
const redisService = require('./services/redisService');

// Configure logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'acko-mer-ai' },
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

const app = express();
const server = createServer(app);

// Socket.IO setup
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

// Socket.IO event handlers
io.on('connection', (socket) => {
  logger.info(`Client connected: ${socket.id}`);
  
  // Handle joining session rooms
  socket.on('join-session', (sessionId) => {
    socket.join(sessionId);
    logger.info(`Client ${socket.id} joined session room: ${sessionId}`);
    
    // Confirm the join
    socket.emit('joined-session', { sessionId });
  });
  
  // Handle leaving session rooms
  socket.on('leave-session', (sessionId) => {
    socket.leave(sessionId);
    logger.info(`Client ${socket.id} left session room: ${sessionId}`);
  });
  
  // Handle disconnection
  socket.on('disconnect', () => {
    logger.info(`Client disconnected: ${socket.id}`);
  });
});

// Make io available to routes
app.set('io', io);

// Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

app.use(compression());

app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  credentials: true
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Create uploads directory if it doesn't exist
const uploadDir = path.join(__dirname, 'uploads');
require('fs').mkdirSync(uploadDir, { recursive: true });

// Static files
app.use('/uploads', express.static(uploadDir));

// Request logging middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path} - ${req.ip}`);
  next();
});

// MongoDB connection
mongoose.connect(config.mongoUri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => {
  logger.info('Connected to MongoDB');
})
.catch((error) => {
  logger.error('MongoDB connection error:', error);
  process.exit(1);
});

// Redis connection
redisService.connect()
  .then(() => {
    logger.info('Connected to Redis');
  })
  .catch((error) => {
    logger.warn('Redis connection failed:', error);
    logger.warn('Continuing without Redis (caching disabled)');
  });

// Routes
app.use('/api', apiRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  logger.info(`User connected: ${socket.id}`);

  socket.on('join-session', (sessionId) => {
    socket.join(sessionId);
    logger.info(`User ${socket.id} joined session ${sessionId}`);
  });

  socket.on('leave-session', (sessionId) => {
    socket.leave(sessionId);
    logger.info(`User ${socket.id} left session ${sessionId}`);
  });

  socket.on('transcription-update', (data) => {
    socket.to(data.sessionId).emit('transcription-update', data);
  });

  socket.on('disconnect', () => {
    logger.info(`User disconnected: ${socket.id}`);
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  
  if (err.type === 'entity.too.large') {
    return res.status(413).json({
      error: 'File too large',
      message: 'The uploaded file exceeds the maximum allowed size'
    });
  }

  res.status(err.status || 500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: 'The requested resource was not found'
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received. Shutting down gracefully...');
  server.close(async () => {
    try {
      await redisService.disconnect();
      logger.info('Redis disconnected');
    } catch (error) {
      logger.warn('Redis disconnect error:', error);
    }
    
    mongoose.connection.close(false, () => {
      logger.info('Process terminated');
      process.exit(0);
    });
  });
});

module.exports = { app, server, io, logger };