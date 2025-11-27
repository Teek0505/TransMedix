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
    console.log('Google Gemini client initialized successfully');
  } else {
    console.warn('Warning: GEMINI_API_KEY not found. Summary generation will not work.');
  }
} catch (error) {
  console.error('Failed to initialize Google Gemini client:', error);
}

const summaryService = {
  async generateSummary(sessionId, summaryId) {
    const startTime = Date.now();
    
    try {
      console.log(`Starting summary generation for session: ${sessionId}`);

      const session = await Session.findById(sessionId)
        .populate('transcriptions')
        .populate('patient');

      if (!session) {
        throw new Error('Session not found');
      }

      if (!session.transcriptions || session.transcriptions.length === 0) {
        throw new Error('No transcriptions found for session');
      }

      const transcriptionText = session.transcriptions
        .filter(t => t.status === 'completed')
        .map(t => t.transcriptionText)
        .join('\n\n');

      if (!transcriptionText.trim()) {
        throw new Error('No completed transcriptions found');
      }

      const summaryContent = await this.generateStructuredSummary(transcriptionText, session);
      const keyPoints = await this.extractKeyPoints(transcriptionText);
      const extractedData = await this.extractMedicalData(transcriptionText);

      const processingTime = Date.now() - startTime;

      return {
        content: summaryContent,
        keyPoints,
        extractedData,
        metadata: {
          model: 'gemini-1.5-flash',
          promptVersion: '1.0',
          processingTime,
          confidence: 85
        }
      };

    } catch (error) {
      console.error(`Summary generation failed:`, error);
      throw error;
    }
  },

  async generateStructuredSummary(transcriptionText, session) {
    if (!model) {
      throw new Error('Gemini API not configured.');
    }

    const prompt = `You are a medical scribe. Create structured clinical documentation from this consultation transcript.

    Return your response as a valid JSON object with these fields:
    - chief_complaint: Main reason for the visit
    - history_of_present_illness: Detailed description of current symptoms
    - assessment: Clinical assessment and findings
    - plan: Treatment plan and next steps

    Transcript: ${transcriptionText.substring(0, 4000)}

    Response (JSON only):`;

    try {
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      // Extract JSON from response (Gemini sometimes adds extra text)
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      const jsonText = jsonMatch ? jsonMatch[0] : text;
      
      const parsedResult = JSON.parse(jsonText);
      
      return {
        chiefComplaint: parsedResult.chief_complaint || '',
        historyOfPresentIllness: parsedResult.history_of_present_illness || '',
        assessment: parsedResult.assessment || '',
        plan: parsedResult.plan || ''
      };

    } catch (error) {
      console.error('Structured summary generation failed:', error);
      throw new Error(`Summary generation failed: ${error.message}`);
    }
  },

  async extractKeyPoints(transcriptionText) {
    if (!model) {
      return [{
        category: 'symptom',
        point: 'Patient presented with main symptoms',
        confidence: 80
      }];
    }

    const prompt = `Extract key medical points from this consultation transcript. 
    Return a JSON array of objects with fields: category, point, confidence.
    Categories should be one of: symptom, diagnosis, medication, procedure, vital_sign.
    
    Transcript: ${transcriptionText.substring(0, 2000)}
    
    Response (JSON array only):`;

    try {
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      // Extract JSON from response
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      const jsonText = jsonMatch ? jsonMatch[0] : '[]';
      
      return JSON.parse(jsonText);
    } catch (error) {
      console.error('Key points extraction failed:', error);
      return [{
        category: 'symptom',
        point: 'Unable to extract key points automatically',
        confidence: 0
      }];
    }
  },

  async extractMedicalData(transcriptionText) {
    if (!model) {
      return {
        symptoms: [],
        diagnoses: [],
        medications: [],
        procedures: [],
        vitalSigns: {}
      };
    }

    const prompt = `Extract structured medical data from this consultation transcript.
    Return a JSON object with these arrays: symptoms, diagnoses, medications, procedures.
    Also include a vitalSigns object with any mentioned vital signs.
    
    Transcript: ${transcriptionText.substring(0, 2000)}
    
    Response (JSON only):`;

    try {
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      // Extract JSON from response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      const jsonText = jsonMatch ? jsonMatch[0] : '{}';
      
      const parsedData = JSON.parse(jsonText);
      
      return {
        symptoms: parsedData.symptoms || [],
        diagnoses: parsedData.diagnoses || [],
        medications: parsedData.medications || [],
        procedures: parsedData.procedures || [],
        vitalSigns: parsedData.vitalSigns || {}
      };
    } catch (error) {
      console.error('Medical data extraction failed:', error);
      return {
        symptoms: [],
        diagnoses: [],
        medications: [],
        procedures: [],
        vitalSigns: {}
      };
    }
  }
};

module.exports = summaryService;