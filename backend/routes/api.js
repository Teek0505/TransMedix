const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { RateLimiterMemory } = require('rate-limiter-flexible');

// Import controllers
const transcriptionController = require('../controllers/transcriptionController');
const sessionController = require('../controllers/sessionController');
const summaryController = require('../controllers/summaryController');
const questionController = require('../controllers/questionController');

// Rate limiting
const rateLimiter = new RateLimiterMemory({
  keyGenerator: (req) => req.ip,
  points: process.env.RATE_LIMIT_MAX_REQUESTS || 100, // Number of requests
  duration: (process.env.RATE_LIMIT_WINDOW || 15) * 60, // Per 15 minutes by default
});

const rateLimitMiddleware = async (req, res, next) => {
  try {
    await rateLimiter.consume(req.ip);
    next();
  } catch (rejRes) {
    res.status(429).json({
      error: 'Too Many Requests',
      message: 'Rate limit exceeded. Please try again later.',
      retryAfter: Math.round(rejRes.msBeforeNext / 1000) || 1,
    });
  }
};

// Multer configuration for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../uploads'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  // Accept audio files only
  const allowedMimes = [
    'audio/wav',
    'audio/mpeg',
    'audio/mp3',
    'audio/mp4',
    'audio/m4a',
    'audio/webm',
    'audio/ogg'
  ];
  
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only audio files are allowed.'), false);
  }
};

const upload = multer({ 
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  }
});

// Apply rate limiting to all routes
router.use(rateLimitMiddleware);

// Health check for API
router.get('/health', (req, res) => {
  res.json({ 
    status: 'API OK', 
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// ==================== TRANSCRIPTION ROUTES ====================

// Upload audio for transcription
router.post('/transcribe/upload', 
  upload.single('audio'), 
  transcriptionController.uploadAudio
);

// Get transcription by ID
router.get('/transcribe/:transcriptionId', 
  transcriptionController.getTranscription
);

// Get all transcriptions for a session
router.get('/sessions/:sessionId/transcriptions', 
  transcriptionController.getSessionTranscriptions
);

// Real-time transcription (streaming)
router.post('/transcribe/stream', 
  transcriptionController.startStreamTranscription
);

// Update transcription (manual editing)
router.put('/transcribe/:transcriptionId', 
  transcriptionController.updateTranscription
);

// Delete transcription
router.delete('/transcribe/:transcriptionId', 
  transcriptionController.deleteTranscription
);

// ==================== SESSION ROUTES ====================

// Create new session
router.post('/sessions', 
  sessionController.createSession
);

// Get session by ID
router.get('/sessions/:sessionId', 
  sessionController.getSession
);

// Get all sessions
router.get('/sessions', 
  sessionController.getAllSessions
);

// Update session
router.put('/sessions/:sessionId', 
  sessionController.updateSession
);

// End session
router.patch('/sessions/:sessionId/end', 
  sessionController.endSession
);

// Delete session
router.delete('/sessions/:sessionId', 
  sessionController.deleteSession
);

// Get session statistics
router.get('/sessions/:sessionId/stats', 
  sessionController.getSessionStats
);

// ==================== SUMMARY ROUTES ====================

// Generate summary for session
router.post('/sessions/:sessionId/summary', 
  summaryController.generateSummary
);

// Get summary by ID
router.get('/summaries/:summaryId', 
  summaryController.getSummary
);

// Get summary by session ID
router.get('/sessions/:sessionId/summary', 
  summaryController.getSessionSummary
);

// Update summary
router.put('/summaries/:summaryId', 
  summaryController.updateSummary
);

// Delete summary
router.delete('/summaries/:summaryId', 
  summaryController.deleteSummary
);

// Export summary as PDF/Word
router.get('/summaries/:summaryId/export/:format', 
  summaryController.exportSummary
);

// ==================== QUESTION ROUTES ====================

// Generate reflexive questions for session
router.post('/sessions/:sessionId/questions', 
  questionController.generateQuestions
);

// Generate specific type of questions
router.post('/sessions/:sessionId/questions/:type', 
  questionController.generateSpecificQuestions
);

// Get available question categories
router.get('/questions/categories', 
  questionController.getQuestionCategories
);

// ==================== PATIENT ROUTES ====================

// Get patient information (if applicable)
router.get('/patients/:patientId', 
  async (req, res) => {
    // Placeholder for patient data retrieval
    res.json({ 
      message: 'Patient routes not implemented yet',
      patientId: req.params.patientId 
    });
  }
);

// ==================== ANALYTICS ROUTES ====================

// Get transcription analytics
router.get('/analytics/transcriptions', 
  async (req, res) => {
    // Placeholder for analytics
    res.json({ 
      message: 'Analytics routes not implemented yet' 
    });
  }
);

// Get usage statistics
router.get('/analytics/usage', 
  async (req, res) => {
    // Placeholder for usage stats
    res.json({ 
      message: 'Usage analytics not implemented yet' 
    });
  }
);

// ==================== ERROR HANDLING ====================

// Handle multer errors
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        error: 'File too large',
        message: 'Audio file must be smaller than 50MB'
      });
    }
    if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        error: 'Unexpected file',
        message: 'Only one audio file is allowed'
      });
    }
  }
  
  if (error.message === 'Invalid file type. Only audio files are allowed.') {
    return res.status(400).json({
      error: 'Invalid file type',
      message: 'Only audio files (WAV, MP3, MP4, M4A, WebM, OGG) are allowed'
    });
  }
  
  next(error);
});

module.exports = router;