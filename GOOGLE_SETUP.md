# Google Gemini & Cloud Speech Setup Guide

## Overview
Your medical transcription system now uses Google's AI services instead of OpenAI:
- **Google Cloud Speech-to-Text**: For audio transcription with speaker diarization
- **Google Gemini**: For summary generation and reflexive question generation

## Step 1: Get Google Gemini API Key

1. Go to [Google AI Studio](https://ai.google.dev/)
2. Sign in with your Google account
3. Click "Get API Key"
4. Create a new API key
5. Copy the API key (starts with `AIza...`)

## Step 2: Setup Google Cloud Speech-to-Text

### Option A: Using Application Default Credentials (Recommended)
1. Install Google Cloud SDK: `brew install google-cloud-sdk` (macOS) or [download here](https://cloud.google.com/sdk/docs/install)
2. Run: `gcloud auth application-default login`
3. Set your project: `gcloud config set project YOUR_PROJECT_ID`

### Option B: Using Service Account Key (Alternative)
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable the Speech-to-Text API
4. Go to "IAM & Admin" > "Service Accounts"
5. Create a new service account
6. Download the JSON key file
7. Place it in your backend directory

## Step 3: Update Environment Variables

Update your `backend/.env` file:

```env
# Google AI Configuration
GEMINI_API_KEY=AIza_your_actual_gemini_api_key_here

# Google Cloud Configuration
GOOGLE_CLOUD_PROJECT_ID=your-google-cloud-project-id

# Option A: Using Application Default Credentials (leave this blank)
GOOGLE_CLOUD_KEY_FILE=

# Option B: Using Service Account Key
GOOGLE_CLOUD_KEY_FILE=./path/to/your-service-account.json
```

## Step 4: Test the Integration

1. Start your backend: `npm start`
2. Check logs for successful initialization:
   - `Google Cloud Speech client initialized successfully`
   - `Google Gemini client initialized successfully`

## Features Available

### 🎤 **Enhanced Transcription**
- Real-time speech-to-text with Google Cloud Speech
- Automatic speaker diarization (identifies different speakers)
- Higher accuracy with medical terminology
- Supports multiple audio formats

### 📄 **AI-Powered Summaries**
- Medical consultation summaries using Gemini
- Structured output: Chief Complaint, History, Assessment, Plan
- Key points extraction
- Medical data extraction (symptoms, diagnoses, medications)

### ❓ **Reflexive Questions**
- **Clinical Questions**: Missing symptoms, medical history gaps
- **Follow-up Questions**: Treatment monitoring, medication adherence
- **Differential Questions**: Rule out conditions, diagnostic clarity
- **Patient Education**: Understanding and compliance questions

## Audio Format Requirements

Google Cloud Speech-to-Text supports:
- **WEBM_OPUS**: Default for web recordings
- **WAV**: Uncompressed audio
- **FLAC**: Lossless compression
- **MP3**: Common compressed format

Sample rates: 8kHz, 16kHz, 32kHz, 44.1kHz, 48kHz

## Cost Estimates

### Google Cloud Speech-to-Text
- First 60 minutes/month: FREE
- Additional usage: ~$0.024/minute

### Google Gemini API
- Gemini 1.5 Flash: FREE up to 15 requests/minute
- Higher limits available with paid plans

## Troubleshooting

### Common Issues:

1. **"Google Cloud Speech client not configured"**
   - Check `GOOGLE_CLOUD_PROJECT_ID` in .env
   - Verify authentication (run `gcloud auth list`)

2. **"GEMINI_API_KEY not found"**
   - Verify API key in .env file
   - Check for typos in key

3. **"Invalid audio file format"**
   - Ensure audio is in supported format
   - Check sample rate settings

4. **API Quota Exceeded**
   - Check Google Cloud Console for quota limits
   - Enable billing if needed

## Support

For issues:
1. Check backend logs for specific error messages
2. Verify API keys and project settings
3. Test with `curl http://localhost:5000/health`

Your medical transcription system is now powered by Google's cutting-edge AI! 🚀
