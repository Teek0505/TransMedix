const Session = require('../models/session');
const Patient = require('../models/patient');
const Joi = require('joi');

// Validation schemas
const sessionValidationSchema = Joi.object({
  patientId: Joi.string().optional().allow(''),
  doctorName: Joi.string().required().trim().min(2).max(100),
  doctorId: Joi.string().optional().trim().allow(''),
  sessionType: Joi.string().valid('consultation', 'follow-up', 'emergency', 'routine-checkup', 'specialist'),
  department: Joi.string().optional().trim().max(50).allow(''),
  priority: Joi.string().valid('low', 'normal', 'high', 'urgent'),
  notes: Joi.string().optional().trim().max(1000).allow('')
});

const sessionController = {
  // Create new session
  async createSession(req, res) {
    try {
      const { error, value } = sessionValidationSchema.validate(req.body);
      
      if (error) {
        return res.status(400).json({
          error: 'Validation error',
          message: error.details[0].message
        });
      }

      const {
        patientId,
        doctorName,
        doctorId,
        sessionType = 'consultation',
        department,
        priority = 'normal',
        notes
      } = value;

      // If patientId is provided, verify patient exists
      let patient = null;
      if (patientId) {
        patient = await Patient.findById(patientId);
        if (!patient) {
          return res.status(404).json({
            error: 'Patient not found',
            message: 'The specified patient does not exist'
          });
        }
      }

      // Create new session
      const session = new Session({
        patient: patient ? patient._id : null,
        doctorName,
        doctorId,
        sessionType,
        department,
        priority,
        notes,
        startTime: new Date(),
        status: 'active'
      });

      await session.save();

      // Populate patient data for response
      await session.populate('patient');

      console.log(`New session created: ${session.sessionId} by ${doctorName}`);

      res.status(201).json({
        message: 'Session created successfully',
        session
      });

    } catch (error) {
      console.error('Error in createSession:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to create session'
      });
    }
  },

  // Get session by ID
  async getSession(req, res) {
    try {
      const { sessionId } = req.params;

      const session = await Session.findById(sessionId)
        .populate('patient')
        .populate('transcriptions')
        .populate('summary')
        .populate('symptoms');

      if (!session) {
        return res.status(404).json({
          error: 'Session not found',
          message: 'The specified session does not exist'
        });
      }

      res.json(session);

    } catch (error) {
      console.error('Error in getSession:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to retrieve session'
      });
    }
  },

  // Get all sessions with filtering and pagination
  async getAllSessions(req, res) {
    try {
      const {
        page = 1,
        limit = 20,
        status,
        doctorId,
        sessionType,
        priority,
        startDate,
        endDate,
        search
      } = req.query;

      // Build query
      const query = {};
      
      if (status) query.status = status;
      if (doctorId) query.doctorId = doctorId;
      if (sessionType) query.sessionType = sessionType;
      if (priority) query.priority = priority;
      
      // Date range filter
      if (startDate || endDate) {
        query.startTime = {};
        if (startDate) query.startTime.$gte = new Date(startDate);
        if (endDate) query.startTime.$lte = new Date(endDate);
      }

      // Search filter (doctor name or notes)
      if (search) {
        query.$or = [
          { doctorName: { $regex: search, $options: 'i' } },
          { notes: { $regex: search, $options: 'i' } }
        ];
      }

      const sessions = await Session.find(query)
        .populate('patient', 'firstName lastName patientId')
        .populate('summary', 'summaryId status')
        .sort({ startTime: -1 })
        .limit(parseInt(limit))
        .skip((parseInt(page) - 1) * parseInt(limit));

      const total = await Session.countDocuments(query);

      res.json({
        sessions,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      });

    } catch (error) {
      console.error('Error in getAllSessions:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to retrieve sessions'
      });
    }
  },

  // Update session
  async updateSession(req, res) {
    try {
      const { sessionId } = req.params;
      const updates = req.body;

      // Remove fields that shouldn't be updated directly
      delete updates.sessionId;
      delete updates.startTime;
      delete updates.transcriptions;
      delete updates.summary;

      const session = await Session.findByIdAndUpdate(
        sessionId,
        updates,
        { new: true, runValidators: true }
      ).populate('patient');

      if (!session) {
        return res.status(404).json({
          error: 'Session not found',
          message: 'The specified session does not exist'
        });
      }

      res.json({
        message: 'Session updated successfully',
        session
      });

    } catch (error) {
      console.error('Error in updateSession:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to update session'
      });
    }
  },

  // End session
  async endSession(req, res) {
    try {
      const { sessionId } = req.params;
      const { notes } = req.body;

      const session = await Session.findById(sessionId);

      if (!session) {
        return res.status(404).json({
          error: 'Session not found',
          message: 'The specified session does not exist'
        });
      }

      if (session.status === 'completed') {
        return res.status(400).json({
          error: 'Session already completed',
          message: 'This session has already been ended'
        });
      }

      // End the session
      await session.endSession();
      
      if (notes) {
        session.notes = notes;
        await session.save();
      }

      console.log(`Session ended: ${session.sessionId}`);

      res.json({
        message: 'Session ended successfully',
        session: {
          sessionId: session.sessionId,
          endTime: session.endTime,
          duration: session.duration,
          status: session.status
        }
      });

    } catch (error) {
      console.error('Error in endSession:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to end session'
      });
    }
  },

  // Delete session
  async deleteSession(req, res) {
    try {
      const { sessionId } = req.params;

      const session = await Session.findById(sessionId);

      if (!session) {
        return res.status(404).json({
          error: 'Session not found',
          message: 'The specified session does not exist'
        });
      }

      // TODO: Also delete associated transcriptions, summaries, etc.
      // This should be handled carefully to maintain data integrity

      await Session.findByIdAndDelete(sessionId);

      console.log(`Session deleted: ${session.sessionId}`);

      res.json({
        message: 'Session deleted successfully'
      });

    } catch (error) {
      console.error('Error in deleteSession:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to delete session'
      });
    }
  },

  // Get session statistics
  async getSessionStats(req, res) {
    try {
      const { sessionId } = req.params;

      const session = await Session.findById(sessionId)
        .populate('transcriptions')
        .populate('summary');

      if (!session) {
        return res.status(404).json({
          error: 'Session not found',
          message: 'The specified session does not exist'
        });
      }

      const stats = {
        sessionInfo: {
          sessionId: session.sessionId,
          duration: session.duration,
          status: session.status,
          startTime: session.startTime,
          endTime: session.endTime
        },
        transcriptions: {
          total: session.transcriptions.length,
          completed: session.transcriptions.filter(t => t.status === 'completed').length,
          processing: session.transcriptions.filter(t => t.status === 'processing').length,
          failed: session.transcriptions.filter(t => t.status === 'failed').length
        },
        summary: {
          exists: !!session.summary,
          status: session.summary ? session.summary.status : null,
          wordCount: session.summary ? session.summary.wordCount : 0
        }
      };

      res.json(stats);

    } catch (error) {
      console.error('Error in getSessionStats:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to retrieve session statistics'
      });
    }
  }
};

module.exports = sessionController;