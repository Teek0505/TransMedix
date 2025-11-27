const { GoogleGenerativeAI } = require('@google/generative-ai');
const Session = require('../models/session');
const config = require('../config');

// Initialize Gemini client
let genAI = null;
let model = null;
try {
  if (config.geminiApiKey) {
    genAI = new GoogleGenerativeAI(config.geminiApiKey);
    model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    console.log('Google Gemini client initialized for question service');
  } else {
    console.warn('Warning: GEMINI_API_KEY not found. Question generation will not work.');
  }
} catch (error) {
  console.error('Failed to initialize Google Gemini client for questions:', error);
}

const questionService = {
  /**
   * Generate reflexive questions based on consultation transcript
   * @param {string} sessionId - Session ID
   * @param {string} transcriptionText - Consultation transcript
   * @returns {Object} Generated questions with categories
   */
  async generateReflexiveQuestions(sessionId, transcriptionText) {
    const startTime = Date.now();
    
    try {
      console.log(`Starting question generation for session: ${sessionId}`);

      if (!model) {
        throw new Error('Gemini API not configured for question generation.');
      }

      const clinicalQuestions = await this.generateClinicalQuestions(transcriptionText);
      const followUpQuestions = await this.generateFollowUpQuestions(transcriptionText);
      const differentialQuestions = await this.generateDifferentialQuestions(transcriptionText);

      const processingTime = Date.now() - startTime;
      console.log(`Question generation completed in ${processingTime}ms for session: ${sessionId}`);

      return {
        clinical: clinicalQuestions,
        followUp: followUpQuestions,
        differential: differentialQuestions,
        metadata: {
          model: 'gemini-1.5-flash',
          processingTime,
          generatedAt: new Date().toISOString()
        }
      };

    } catch (error) {
      console.error(`Question generation failed:`, error);
      throw error;
    }
  },

  /**
   * Generate clinical assessment questions
   */
  async generateClinicalQuestions(transcriptionText) {
    const prompt = `Based on this medical consultation transcript, generate important clinical questions that should be asked to better understand the patient's condition.

    Focus on:
    - Missing symptoms that should be explored
    - Important medical history not covered
    - Risk factors that need assessment
    - Physical examination findings needed

    Transcript: ${transcriptionText.substring(0, 3000)}

    Return a JSON array of objects with fields: question, category, priority (1-5), rationale.
    Categories should be: symptom_assessment, medical_history, risk_factors, physical_exam.
    
    Response (JSON array only):`;

    try {
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      const jsonText = jsonMatch ? jsonMatch[0] : '[]';
      
      return JSON.parse(jsonText);
    } catch (error) {
      console.error('Clinical questions generation failed:', error);
      return [{
        question: "What other symptoms is the patient experiencing?",
        category: "symptom_assessment",
        priority: 3,
        rationale: "Unable to generate specific questions automatically"
      }];
    }
  },

  /**
   * Generate follow-up care questions
   */
  async generateFollowUpQuestions(transcriptionText) {
    const prompt = `Based on this medical consultation, generate important follow-up questions for the patient's next visit or ongoing care.

    Focus on:
    - Treatment response monitoring
    - Medication adherence and side effects
    - Lifestyle modifications progress
    - Warning signs to watch for

    Transcript: ${transcriptionText.substring(0, 3000)}

    Return a JSON array of objects with fields: question, category, timeframe, importance.
    Categories should be: treatment_response, medication_monitoring, lifestyle_changes, warning_signs.
    Timeframe should be: immediate, short_term (1-2 weeks), medium_term (1 month), long_term (3+ months).
    Importance should be: low, medium, high, critical.
    
    Response (JSON array only):`;

    try {
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      const jsonText = jsonMatch ? jsonMatch[0] : '[]';
      
      return JSON.parse(jsonText);
    } catch (error) {
      console.error('Follow-up questions generation failed:', error);
      return [{
        question: "How is the patient responding to the current treatment plan?",
        category: "treatment_response",
        timeframe: "short_term",
        importance: "medium"
      }];
    }
  },

  /**
   * Generate differential diagnosis questions
   */
  async generateDifferentialQuestions(transcriptionText) {
    const prompt = `Based on this medical consultation, generate questions that would help differentiate between possible diagnoses or rule out serious conditions.

    Focus on:
    - Red flag symptoms to rule out serious conditions
    - Questions to distinguish between similar conditions
    - Specific tests or examinations needed
    - Alternative explanations for symptoms

    Transcript: ${transcriptionText.substring(0, 3000)}

    Return a JSON array of objects with fields: question, purpose, urgency, diagnostic_value.
    Purpose should describe what condition or concern the question addresses.
    Urgency should be: routine, urgent, immediate.
    Diagnostic_value should be: low, medium, high.
    
    Response (JSON array only):`;

    try {
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      const jsonText = jsonMatch ? jsonMatch[0] : '[]';
      
      return JSON.parse(jsonText);
    } catch (error) {
      console.error('Differential questions generation failed:', error);
      return [{
        question: "Are there any other conditions that could explain these symptoms?",
        purpose: "Consider alternative diagnoses",
        urgency: "routine",
        diagnostic_value: "medium"
      }];
    }
  },

  /**
   * Generate personalized patient education questions
   */
  async generatePatientEducationQuestions(transcriptionText) {
    const prompt = `Based on this consultation, generate questions that would help educate the patient about their condition and improve their understanding.

    Focus on:
    - Patient's understanding of their condition
    - Compliance and adherence concerns
    - Lifestyle modification opportunities
    - Prevention strategies

    Transcript: ${transcriptionText.substring(0, 3000)}

    Return a JSON array of objects with fields: question, educational_goal, patient_benefit.
    
    Response (JSON array only):`;

    try {
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      const jsonText = jsonMatch ? jsonMatch[0] : '[]';
      
      return JSON.parse(jsonText);
    } catch (error) {
      console.error('Patient education questions generation failed:', error);
      return [{
        question: "Do you have any questions about your condition or treatment?",
        educational_goal: "Ensure patient understanding",
        patient_benefit: "Improved treatment compliance"
      }];
    }
  }
};

module.exports = questionService;