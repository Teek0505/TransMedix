const questionService = require('../services/questionService');
const Session = require('../models/session');

const questionController = {
  /**
   * Generate reflexive questions for a session
   */
  async generateQuestions(req, res) {
    try {
      const { sessionId } = req.params;
      console.log(`Generating questions for session: ${sessionId}`);

      // Verify session exists
      const session = await Session.findById(sessionId)
        .populate('transcriptions');

      if (!session) {
        return res.status(404).json({
          error: 'Session not found',
          message: 'The specified session does not exist'
        });
      }

      // Check if session has transcriptions
      if (!session.transcriptions || session.transcriptions.length === 0) {
        return res.status(400).json({
          error: 'No transcriptions found',
          message: 'Session must have completed transcriptions to generate questions'
        });
      }

      // Combine all transcription text
      const transcriptionText = session.transcriptions
        .filter(t => t.status === 'completed')
        .map(t => t.transcriptionText)
        .join('\n\n');

      if (!transcriptionText.trim()) {
        return res.status(400).json({
          error: 'No completed transcriptions',
          message: 'No completed transcriptions found for this session'
        });
      }

      // Generate questions using the question service
      const questions = await questionService.generateReflexiveQuestions(
        sessionId, 
        transcriptionText
      );

      res.json({
        message: 'Questions generated successfully',
        sessionId,
        questions,
        generatedAt: new Date().toISOString()
      });

    } catch (error) {
      console.error('Error in generateQuestions:', error);
      
      if (error.message.includes('not configured')) {
        return res.status(503).json({
          error: 'Service unavailable',
          message: 'Question generation service is not properly configured'
        });
      }

      res.status(500).json({
        error: 'Internal server error',
        message: error.message || 'Failed to generate questions'
      });
    }
  },

  /**
   * Generate specific type of questions
   */
  async generateSpecificQuestions(req, res) {
    try {
      const { sessionId, type } = req.params;
      console.log(`Generating ${type} questions for session: ${sessionId}`);

      // Validate question type
      const validTypes = ['clinical', 'followup', 'differential', 'education'];
      if (!validTypes.includes(type)) {
        return res.status(400).json({
          error: 'Invalid question type',
          message: `Question type must be one of: ${validTypes.join(', ')}`
        });
      }

      // Verify session exists
      const session = await Session.findById(sessionId)
        .populate('transcriptions');

      if (!session) {
        return res.status(404).json({
          error: 'Session not found',
          message: 'The specified session does not exist'
        });
      }

      // Combine transcription text
      const transcriptionText = session.transcriptions
        .filter(t => t.status === 'completed')
        .map(t => t.transcriptionText)
        .join('\n\n');

      if (!transcriptionText.trim()) {
        return res.status(400).json({
          error: 'No transcription data',
          message: 'No completed transcriptions found for question generation'
        });
      }

      let questions = [];
      
      // Generate specific type of questions
      switch (type) {
        case 'clinical':
          questions = await questionService.generateClinicalQuestions(transcriptionText);
          break;
        case 'followup':
          questions = await questionService.generateFollowUpQuestions(transcriptionText);
          break;
        case 'differential':
          questions = await questionService.generateDifferentialQuestions(transcriptionText);
          break;
        case 'education':
          questions = await questionService.generatePatientEducationQuestions(transcriptionText);
          break;
      }

      res.json({
        message: `${type} questions generated successfully`,
        sessionId,
        type,
        questions,
        count: questions.length,
        generatedAt: new Date().toISOString()
      });

    } catch (error) {
      console.error(`Error generating ${req.params.type} questions:`, error);
      
      res.status(500).json({
        error: 'Internal server error',
        message: error.message || `Failed to generate ${req.params.type} questions`
      });
    }
  },

  /**
   * Get available question categories
   */
  async getQuestionCategories(req, res) {
    try {
      const categories = {
        clinical: {
          name: 'Clinical Assessment',
          description: 'Questions to better understand patient condition and missing symptoms',
          fields: ['question', 'category', 'priority', 'rationale']
        },
        followup: {
          name: 'Follow-up Care',
          description: 'Questions for monitoring treatment response and ongoing care',
          fields: ['question', 'category', 'timeframe', 'importance']
        },
        differential: {
          name: 'Differential Diagnosis',
          description: 'Questions to distinguish between conditions and rule out serious issues',
          fields: ['question', 'purpose', 'urgency', 'diagnostic_value']
        },
        education: {
          name: 'Patient Education',
          description: 'Questions to improve patient understanding and compliance',
          fields: ['question', 'educational_goal', 'patient_benefit']
        }
      };

      res.json({
        message: 'Available question categories',
        categories
      });

    } catch (error) {
      console.error('Error getting question categories:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to retrieve question categories'
      });
    }
  }
};

module.exports = questionController;
