const Summary = require('../models/summary');
const Session = require('../models/session');
const summaryService = require('../services/summaryService');
const Joi = require('joi');

const summaryController = {
  // Generate summary for session
  async generateSummary(req, res) {
    try {
      const { sessionId } = req.params;
      const { regenerate = false } = req.body;

      // Verify session exists
      const session = await Session.findById(sessionId)
        .populate('transcriptions')
        .populate('summary');

      if (!session) {
        return res.status(404).json({
          error: 'Session not found',
          message: 'The specified session does not exist'
        });
      }

      // Check if transcriptions exist
      if (!session.transcriptions || session.transcriptions.length === 0) {
        return res.status(400).json({
          error: 'No transcriptions found',
          message: 'Cannot generate summary without transcriptions'
        });
      }

      // Check if summary already exists and regenerate is false
      if (session.summary && !regenerate) {
        return res.status(400).json({
          error: 'Summary already exists',
          message: 'Summary already exists for this session. Use regenerate=true to create a new version',
          summaryId: session.summary.summaryId
        });
      }

      let summary;

      if (session.summary && regenerate) {
        // Update existing summary
        summary = session.summary;
        summary.status = 'generating';
        await summary.save();
      } else {
        // Create new summary
        summary = new Summary({
          session: sessionId,
          status: 'generating'
        });
        await summary.save();

        // Link to session
        session.summary = summary._id;
        await session.save();
      }

      // Generate summary asynchronously
      summaryService.generateSummary(sessionId, summary._id)
        .then(async (result) => {
          if (regenerate && session.summary) {
            // Create new version
            await summary.createNewVersion(result.content, 'ai-generated');
          } else {
            // Update current summary
            summary.content = result.content;
            summary.keyPoints = result.keyPoints;
            summary.extractedData = result.extractedData;
            summary.generationMetadata = result.metadata;
            summary.status = 'completed';
            await summary.save();
          }

          console.log(`Summary generated for session: ${sessionId}`);

          // Emit real-time update via Socket.IO
          if (req.app.get('io')) {
            req.app.get('io').to(sessionId).emit('summary-completed', {
              summaryId: summary.summaryId,
              sessionId: sessionId
            });
          }
        })
        .catch(async (error) => {
          console.error(`Summary generation failed for session: ${sessionId}`, error);
          summary.status = 'failed';
          await summary.save();

          if (req.app.get('io')) {
            req.app.get('io').to(sessionId).emit('summary-failed', {
              summaryId: summary.summaryId,
              error: error.message
            });
          }
        });

      res.status(202).json({
        message: 'Summary generation started',
        summaryId: summary.summaryId,
        status: 'generating'
      });

    } catch (error) {
      console.error('Error in generateSummary:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to start summary generation'
      });
    }
  },

  // Get summary by ID
  async getSummary(req, res) {
    try {
      const { summaryId } = req.params;
      const { includeHistory = false } = req.query;

      const summary = await Summary.findOne({ summaryId })
        .populate('session', 'sessionId doctorName startTime endTime duration');

      if (!summary) {
        return res.status(404).json({
          error: 'Summary not found',
          message: 'The specified summary does not exist'
        });
      }

      // Remove previous versions from response unless requested
      if (!includeHistory) {
        summary.previousVersions = undefined;
      }

      res.json(summary);

    } catch (error) {
      console.error('Error in getSummary:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to retrieve summary'
      });
    }
  },

  // Get summary by session ID
  async getSessionSummary(req, res) {
    try {
      const { sessionId } = req.params;

      const session = await Session.findById(sessionId).populate('summary');

      if (!session) {
        return res.status(404).json({
          error: 'Session not found',
          message: 'The specified session does not exist'
        });
      }

      if (!session.summary) {
        return res.status(404).json({
          error: 'Summary not found',
          message: 'No summary exists for this session'
        });
      }

      res.json(session.summary);

    } catch (error) {
      console.error('Error in getSessionSummary:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to retrieve session summary'
      });
    }
  },

  // Update summary
  async updateSummary(req, res) {
    try {
      const { summaryId } = req.params;
      const { content, reviewNotes, reviewedBy } = req.body;

      const summary = await Summary.findOne({ summaryId });

      if (!summary) {
        return res.status(404).json({
          error: 'Summary not found',
          message: 'The specified summary does not exist'
        });
      }

      // Update content if provided
      if (content) {
        // Save current version to history before updating
        summary.previousVersions.push({
          version: summary.version,
          content: summary.content,
          generatedAt: summary.updatedAt,
          generatedBy: 'manual-edit'
        });

        summary.content = { ...summary.content, ...content };
        summary.version += 1;
        summary.isApproved = false; // Reset approval status
      }

      // Update review information
      if (reviewNotes) {
        summary.reviewNotes = reviewNotes;
      }

      if (reviewedBy) {
        summary.reviewedBy = reviewedBy;
        summary.reviewedAt = new Date();
      }

      await summary.save();

      res.json({
        message: 'Summary updated successfully',
        summary
      });

    } catch (error) {
      console.error('Error in updateSummary:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to update summary'
      });
    }
  },

  // Delete summary
  async deleteSummary(req, res) {
    try {
      const { summaryId } = req.params;

      const summary = await Summary.findOne({ summaryId });

      if (!summary) {
        return res.status(404).json({
          error: 'Summary not found',
          message: 'The specified summary does not exist'
        });
      }

      // Remove reference from session
      await Session.findByIdAndUpdate(
        summary.session,
        { $unset: { summary: 1 } }
      );

      // Delete summary
      await Summary.findOneAndDelete({ summaryId });

      console.log(`Summary deleted: ${summaryId}`);

      res.json({
        message: 'Summary deleted successfully'
      });

    } catch (error) {
      console.error('Error in deleteSummary:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to delete summary'
      });
    }
  },

  // Approve summary
  async approveSummary(req, res) {
    try {
      const { summaryId } = req.params;
      const { reviewedBy, reviewNotes } = req.body;

      if (!reviewedBy) {
        return res.status(400).json({
          error: 'Reviewer required',
          message: 'Please provide reviewer information'
        });
      }

      const summary = await Summary.findOne({ summaryId });

      if (!summary) {
        return res.status(404).json({
          error: 'Summary not found',
          message: 'The specified summary does not exist'
        });
      }

      await summary.approve(reviewedBy, reviewNotes);

      res.json({
        message: 'Summary approved successfully',
        summary: {
          summaryId: summary.summaryId,
          isApproved: summary.isApproved,
          reviewedBy: summary.reviewedBy,
          reviewedAt: summary.reviewedAt
        }
      });

    } catch (error) {
      console.error('Error in approveSummary:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to approve summary'
      });
    }
  },

  // Export summary
  async exportSummary(req, res) {
    try {
      const { summaryId, format } = req.params;

      if (!['pdf', 'word', 'json'].includes(format)) {
        return res.status(400).json({
          error: 'Invalid format',
          message: 'Supported formats: pdf, word, json'
        });
      }

      const summary = await Summary.findOne({ summaryId })
        .populate('session');

      if (!summary) {
        return res.status(404).json({
          error: 'Summary not found',
          message: 'The specified summary does not exist'
        });
      }

      // For now, return JSON format
      // TODO: Implement actual PDF/Word generation
      if (format === 'json') {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="summary-${summaryId}.json"`);
        res.json(summary);
      } else {
        res.status(501).json({
          error: 'Format not implemented',
          message: `${format.toUpperCase()} export is not yet implemented`
        });
      }

    } catch (error) {
      console.error('Error in exportSummary:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to export summary'
      });
    }
  }
};

module.exports = summaryController;