// In services/transcriptionService.js

const speech = require('@google-cloud/speech');
const fs = require('fs'); // Use the non-promise version for createReadStream
const fsp = require('fs').promises; // Use promise version for stat and unlink
const config = require('../config');

// Initialize Google Cloud Speech client
let speechClient = null;
try {
  if (config.googleCloudKeyFile) {
    speechClient = new speech.SpeechClient({
      keyFilename: config.googleCloudKeyFile,
      projectId: config.googleCloudProjectId
    });
    console.log('Google Cloud Speech client initialized successfully');
  } else {
    console.warn('Warning: GOOGLE_CLOUD_KEY_FILE not found. Transcription will not work.');
  }
} catch (error) {
  console.error('Failed to initialize Google Cloud Speech client:', error);
}

const transcriptionService = {
  async transcribeAudio(audioFilePath, transcriptionId, language = 'en') {
    const startTime = Date.now();
    
    try {
      console.log(`Starting transcription for file: ${audioFilePath} in language: ${language}`);

      if (!speechClient) {
        throw new Error('Google Cloud Speech client not configured.');
      }

      await fsp.stat(audioFilePath); // Check if file exists using promises

      // Read the audio file
      const audioBytes = await fsp.readFile(audioFilePath);

      // Configure the speech recognition request
      const request = {
        audio: {
          content: audioBytes.toString('base64'),
        },
        config: {
          encoding: 'WEBM_OPUS', // Adjust based on your audio format
          sampleRateHertz: 48000, // Adjust based on your audio format
          languageCode: this.getLanguageCode(language),
          alternativeLanguageCodes: this.getAlternativeLanguages(language),
          enableAutomaticPunctuation: true,
          enableWordTimeOffsets: true,
          enableSpeakerDiarization: true,
          diarizationSpeakerCount: 2, // Adjust based on expected speakers
          model: 'latest_long', // Use latest model for better accuracy
          useEnhanced: true,
        },
      };

      // Perform the transcription
      const [response] = await speechClient.recognize(request);
      
      if (!response.results || response.results.length === 0) {
        throw new Error('No transcription results returned');
      }

      const processingTime = Date.now() - startTime;
      console.log(`Transcription completed in ${processingTime}ms for ID: ${transcriptionId}`);

      // Extract transcription text and metadata
      const transcriptionText = response.results
        .map(result => result.alternatives[0].transcript)
        .join(' ');

      // Extract speaker-labeled segments
      const segments = this.extractSpeakerSegments(response.results);

      return {
        text: transcriptionText,
        language: response.results[0]?.languageCode || this.getLanguageCode(language),
        segments: segments,
        metadata: {
          model: 'google-speech-to-text',
          processingTime,
          confidence: response.results[0]?.alternatives[0]?.confidence || 0.9,
          speakerCount: segments.length > 0 ? Math.max(...segments.map(s => s.speaker || 0)) + 1 : 1,
          detectedLanguage: response.results[0]?.languageCode,
          requestedLanguage: language
        }
      };

    } catch (error) {
      const processingTime = Date.now() - startTime;
      console.error(`Transcription failed after ${processingTime}ms:`, error);
      
      // Handle Google Cloud Speech API errors
      if (error.code) {
        switch (error.code) {
          case 3: // INVALID_ARGUMENT
            throw new Error('Invalid audio file format or configuration.');
          case 7: // PERMISSION_DENIED
            throw new Error('Invalid Google Cloud credentials.');
          case 8: // RESOURCE_EXHAUSTED
            throw new Error('Google Cloud API quota exceeded.');
          case 13: // INTERNAL
            throw new Error('Google Cloud internal error.');
          default:
            throw new Error(`Google Cloud Speech API Error (Code ${error.code}): ${error.message}`);
        }
      }
      
      throw new Error(`Transcription failed: ${error.message}`);
    } finally {
      // Clean up the uploaded file after processing
      await this.cleanupAudioFile(audioFilePath);
    }
  },

  // Extract speaker-labeled segments from Google Speech response
  extractSpeakerSegments(results) {
    const segments = [];
    
    results.forEach(result => {
      if (result.alternatives && result.alternatives[0]) {
        const alternative = result.alternatives[0];
        
        // If word-level info is available, group by speaker
        if (alternative.words) {
          let currentSpeaker = null;
          let currentSegment = {
            text: '',
            startTime: 0,
            endTime: 0,
            speaker: 0
          };
          
          alternative.words.forEach((word, index) => {
            const speakerTag = word.speakerTag || 0;
            
            if (currentSpeaker !== speakerTag) {
              // Save previous segment if it exists
              if (currentSegment.text.trim()) {
                segments.push({ ...currentSegment });
              }
              
              // Start new segment
              currentSpeaker = speakerTag;
              currentSegment = {
                text: word.word,
                startTime: parseFloat(word.startTime?.seconds || 0) + parseFloat(word.startTime?.nanos || 0) / 1e9,
                endTime: parseFloat(word.endTime?.seconds || 0) + parseFloat(word.endTime?.nanos || 0) / 1e9,
                speaker: speakerTag
              };
            } else {
              // Continue current segment
              currentSegment.text += ' ' + word.word;
              currentSegment.endTime = parseFloat(word.endTime?.seconds || 0) + parseFloat(word.endTime?.nanos || 0) / 1e9;
            }
          });
          
          // Add final segment
          if (currentSegment.text.trim()) {
            segments.push(currentSegment);
          }
        } else {
          // Fallback: single segment without speaker info
          segments.push({
            text: alternative.transcript,
            startTime: 0,
            endTime: 0,
            speaker: 0
          });
        }
      }
    });
    
    return segments;
  },

  // Get Google Cloud Speech language code
  getLanguageCode(language) {
    const languageMap = {
      'en': 'en-US',
      'hi': 'hi-IN',
      'bn': 'bn-IN', // Bengali (India)
      'te': 'te-IN', // Telugu
      'mr': 'mr-IN', // Marathi
      'ta': 'ta-IN', // Tamil
      'gu': 'gu-IN', // Gujarati
      'kn': 'kn-IN'  // Kannada
    };
    return languageMap[language] || 'en-US';
  },

  // Get alternative language codes for better recognition
  getAlternativeLanguages(language) {
    const alternativeMap = {
      'en': ['en-US', 'en-GB'],
      'hi': ['hi-IN', 'hi'],
      'bn': ['bn-IN', 'bn-BD'],
      'te': ['te-IN'],
      'mr': ['mr-IN'],
      'ta': ['ta-IN', 'ta-LK'],
      'gu': ['gu-IN'],
      'kn': ['kn-IN']
    };
    return alternativeMap[language] || ['en-US'];
  },

  async cleanupAudioFile(filePath) {
    try {
      await fsp.unlink(filePath);
      console.log(`Cleaned up audio file: ${filePath}`);
    } catch (error) {
      // Ignore errors if file doesn't exist, but log others
      if (error.code !== 'ENOENT') {
        console.warn(`Failed to cleanup audio file: ${filePath}`, error);
      }
    }
  },
  
  // Other service methods can remain...
  async startStreamTranscription(audioStream, sessionId) {
    // This is a placeholder for real-time transcription
    console.log(`Starting stream transcription for session: ${sessionId}`);
    
    return {
      streamId: `stream_${sessionId}_${Date.now()}`,
      status: 'active',
    };
  },
};

module.exports = transcriptionService;