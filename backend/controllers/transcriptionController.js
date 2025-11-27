const transcriptionService = require('../services/transcriptionService');
const Session = require('../models/session');
const Transcription = require('../models/transcription');
const fs = require('fs').promises;
const path = require('path');

const transcriptionController = {
  // Upload and transcribe audio file
  async uploadAudio(req, res) {
    try {
      const { sessionId } = req.body;
      const audioFile = req.file;

      if (!audioFile) {
        return res.status(400).json({
          error: 'No audio file provided',
          message: 'Please upload an audio file'
        });
      }

      if (!sessionId) {
        return res.status(400).json({
          error: 'Session ID required',
          message: 'Please provide a valid session ID'
        });
      }

      // Verify session exists
      const session = await Session.findById(sessionId);
      if (!session) {
        // Clean up uploaded file
        await fs.unlink(audioFile.path).catch(() => {});
        return res.status(404).json({
          error: 'Session not found',
          message: 'The specified session does not exist'
        });
      }

      // Create transcription record
      const transcription = new Transcription({
        session: sessionId,
        audioFile: {
          originalName: audioFile.originalname,
          filename: audioFile.filename,
          path: audioFile.path,
          size: audioFile.size,
          mimeType: audioFile.mimetype
        },
        transcriptionText: '', // Initialize with empty string to satisfy validation
        status: 'processing'
      });

      await transcription.save();

      // Start transcription process
      console.log(`Starting transcription for file: ${audioFile.filename}`);
      
      // Get language from request (default to English)
      const language = req.body.language || 'en';
      
      // Process transcription asynchronously
      transcriptionService.transcribeAudio(audioFile.path, transcription._id, language)
        .then(async (result) => {
          transcription.transcriptionText = result.text;
          transcription.confidence = result.confidence;
          transcription.language = result.language;
          transcription.processingMetadata = result.metadata;
          transcription.status = 'completed';
          
          await transcription.save();
          
          // Add to session
          session.transcriptions.push(transcription._id);
          await session.save();
          
          console.log(`Transcription completed for ID: ${transcription.transcriptionId}`);
          
          // Emit real-time update via Socket.IO
          if (req.app.get('io')) {
            req.app.get('io').to(sessionId).emit('transcription-completed', {
              transcriptionId: transcription.transcriptionId,
              text: result.text,
              confidence: result.confidence
            });
          }
        })
        .catch(async (error) => {
          console.error(`Transcription failed for ID: ${transcription.transcriptionId}`, error);
          transcription.status = 'failed';
          await transcription.save();
          
          if (req.app.get('io')) {
            req.app.get('io').to(sessionId).emit('transcription-failed', {
              transcriptionId: transcription.transcriptionId,
              error: error.message
            });
          }
        });

      res.status(202).json({
        message: 'Audio uploaded successfully, transcription in progress',
        transcriptionId: transcription.transcriptionId,
        status: 'processing'
      });

    } catch (error) {
      console.error('Error in uploadAudio:', error);
      
      // Clean up uploaded file if exists
      if (req.file) {
        await fs.unlink(req.file.path).catch(() => {});
      }
      
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to process audio upload'
      });
    }
  },

  // Get transcription by ID
  async getTranscription(req, res) {
    try {
      const { transcriptionId } = req.params;

      const transcription = await Transcription.findOne({ 
        transcriptionId 
      }).populate('session');

      if (!transcription) {
        return res.status(404).json({
          error: 'Transcription not found',
          message: 'The specified transcription does not exist'
        });
      }

      res.json(transcription);

    } catch (error) {
      console.error('Error in getTranscription:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to retrieve transcription'
      });
    }
  },

  // Get all transcriptions for a session
  async getSessionTranscriptions(req, res) {
    try {
      const { sessionId } = req.params;
      const { page = 1, limit = 20, status } = req.query;

      // Verify session exists
      const session = await Session.findById(sessionId);
      if (!session) {
        return res.status(404).json({
          error: 'Session not found',
          message: 'The specified session does not exist'
        });
      }

      const query = { session: sessionId };
      if (status) {
        query.status = status;
      }

      const transcriptions = await Transcription.find(query)
        .sort({ createdAt: 1 })
        .limit(parseInt(limit))
        .skip((parseInt(page) - 1) * parseInt(limit));

      const total = await Transcription.countDocuments(query);

      res.json({
        transcriptions,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      });

    } catch (error) {
      console.error('Error in getSessionTranscriptions:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to retrieve session transcriptions'
      });
    }
  },

  // Start streaming transcription
  async startStreamTranscription(req, res) {
    try {
      const { sessionId } = req.body;

      if (!sessionId) {
        return res.status(400).json({
          error: 'Session ID required',
          message: 'Please provide a valid session ID'
        });
      }

      // Verify session exists
      const session = await Session.findById(sessionId);
      if (!session) {
        return res.status(404).json({
          error: 'Session not found',
          message: 'The specified session does not exist'
        });
      }

      // This would typically set up WebSocket connection for real-time transcription
      // For now, return a placeholder response
      res.json({
        message: 'Streaming transcription started',
        sessionId,
        streamUrl: `/api/transcribe/stream/${sessionId}`,
        instructions: 'Connect to WebSocket for real-time transcription'
      });

    } catch (error) {
      console.error('Error in startStreamTranscription:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to start streaming transcription'
      });
    }
  },

  // Update transcription (manual editing)
  async updateTranscription(req, res) {
    try {
      const { transcriptionId } = req.params;
      const { transcriptionText, speaker, editedBy } = req.body;

      const transcription = await Transcription.findOne({ transcriptionId });

      if (!transcription) {
        return res.status(404).json({
          error: 'Transcription not found',
          message: 'The specified transcription does not exist'
        });
      }

      // Save edit history
      if (transcriptionText && transcriptionText !== transcription.transcriptionText) {
        transcription.editHistory.push({
          originalText: transcription.transcriptionText,
          editedText: transcriptionText,
          editedAt: new Date(),
          editedBy: editedBy || 'unknown'
        });
        
        transcription.transcriptionText = transcriptionText;
        transcription.isEdited = true;
      }

      if (speaker) {
        transcription.speaker = speaker;
      }

      await transcription.save();

      res.json({
        message: 'Transcription updated successfully',
        transcription
      });

    } catch (error) {
      console.error('Error in updateTranscription:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to update transcription'
      });
    }
  },

  // Delete transcription
  async deleteTranscription(req, res) {
    try {
      const { transcriptionId } = req.params;

      const transcription = await Transcription.findOne({ transcriptionId });

      if (!transcription) {
        return res.status(404).json({
          error: 'Transcription not found',
          message: 'The specified transcription does not exist'
        });
      }

      // Remove from session
      await Session.findByIdAndUpdate(
        transcription.session,
        { $pull: { transcriptions: transcription._id } }
      );

      // Delete audio file if exists
      if (transcription.audioFile && transcription.audioFile.path) {
        await fs.unlink(transcription.audioFile.path).catch(() => {
          console.warn(`Failed to delete audio file: ${transcription.audioFile.path}`);
        });
      }

      // Delete transcription
      await Transcription.findOneAndDelete({ transcriptionId });

      res.json({
        message: 'Transcription deleted successfully'
      });

    } catch (error) {
      console.error('Error in deleteTranscription:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to delete transcription'
      });
    }
  },

  // Real-time stream transcription
  async startStreamTranscription(req, res) {
    const multer = require('multer');
    const path = require('path');
    const fs = require('fs').promises;

    const upload = multer({
      storage: multer.diskStorage({
        destination: (req, file, cb) => {
          cb(null, path.join(__dirname, '../uploads'));
        },
        filename: (req, file, cb) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
          cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
        }
      }),
      limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit for chunks
    });

    // Handle file upload
    upload.single('audio')(req, res, async (err) => {
      if (err) {
        return res.status(400).json({
          error: 'Upload error',
          message: err.message
        });
      }

      try {
        const { sessionId, recordingId, isLive } = req.body;
        const audioFile = req.file;

        if (!sessionId || !audioFile) {
          return res.status(400).json({
            error: 'Missing required fields',
            message: 'sessionId and audio file are required'
          });
        }

        console.log(`Processing live audio chunk for session: ${sessionId}`);

        // Get language from request (default to English)
        const language = req.body.language || 'en';
        
        // Process the audio chunk for live transcription
        const result = await transcriptionService.transcribeAudio(audioFile.path, `live_${recordingId}`, language);
        
        // Emit live transcription via Socket.IO
        if (req.app.get('io') && result.text) {
          req.app.get('io').to(sessionId).emit('live-transcription', {
            transcriptionId: recordingId,
            text: result.text,
            confidence: result.metadata.confidence || 0.9,
            isLive: true
          });
          
          console.log(`Live transcription sent for session ${sessionId}: "${result.text.substring(0, 50)}..."`);
        }

        res.json({
          message: 'Live transcription processed',
          sessionId,
          recordingId,
          text: result.text
        });

      } catch (error) {
        console.error('Error in live stream transcription:', error);
        
        // Clean up uploaded file if exists
        if (req.file) {
          await fs.unlink(req.file.path).catch(() => {});
        }
        
        res.status(500).json({
          error: 'Internal server error',
          message: error.message || 'Failed to process live transcription'
        });
      }
    });
  }
};

module.exports = transcriptionController;