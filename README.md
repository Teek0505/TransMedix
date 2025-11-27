# Acko MER AI - Medical Transcription & Summary System

A comprehensive medical transcription and AI-powered summary generation system designed for healthcare professionals. This system allows doctors to record patient consultations, automatically transcribe them using OpenAI Whisper, and generate structured medical summaries using GPT-4.

## 🚀 Features

### Core Functionality
- **Real-time Audio Recording**: Record doctor-patient consultations directly in the browser
- **Automatic Transcription**: Convert audio to text using OpenAI Whisper API
- **AI-Powered Summaries**: Generate structured medical summaries using GPT-4
- **Session Management**: Organize consultations by sessions with metadata
- **Real-time Updates**: Live transcription updates via WebSocket connections

### Medical-Specific Features
- **Structured Medical Documentation**: Follow standard medical documentation practices
- **ICD-10 & CPT Code Integration**: Automatic coding suggestions
- **Patient Management**: Link consultations to patient records
- **Symptom & Diagnosis Tracking**: Extract and categorize medical information
- **Multi-format Export**: Export summaries as PDF, Word, or JSON

### Technical Features
- **Scalable Architecture**: Microservices-based design with Docker
- **Redis Caching**: Improve performance with session and data caching
- **Rate Limiting**: Protect APIs from abuse
- **Comprehensive Logging**: Track all system activities
- **Modern UI**: Material-UI based responsive interface

## 🛠️ Tech Stack

### Backend
- **Node.js** with Express.js framework
- **MongoDB** for data persistence
- **Redis** for caching and session management
- **OpenAI API** (Whisper + GPT-4)
- **Socket.IO** for real-time communication
- **Winston** for logging
- **Joi** for validation

### Frontend
- **React 18** with Material-UI
- **React Router** for navigation
- **Axios** for API communication
- **Socket.IO Client** for real-time updates
- **React-Toastify** for notifications

### DevOps
- **Docker** & Docker Compose
- **Nginx** for reverse proxy
- **Environment-based configuration**

## 📋 Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v16 or higher)
- **Docker** and **Docker Compose**
- **Git**

### Required API Keys
1. **OpenAI API Key**: Get from [OpenAI Platform](https://platform.openai.com/api-keys)
2. **Optional**: MongoDB Atlas connection string (if not using local MongoDB)

## 🚀 Quick Start

### 1. Clone the Repository
```bash
git clone <repository-url>
cd acko-mer-ai
```

### 2. Environment Setup

Copy the environment template and configure your API keys:

```bash
cp backend/env.example backend/.env
```

Edit `backend/.env` with your configuration:

```env
# Required - Get from OpenAI
OPENAI_API_KEY=your_openai_api_key_here
WHISPER_API_KEY=your_openai_api_key_here

# Database (using Docker defaults)
MONGO_URI=mongodb://admin:password123@localhost:27017/acko-mer-ai?authSource=admin
REDIS_URL=redis://:redispassword123@localhost:6379

# Security
JWT_SECRET=your-super-secret-jwt-key

# Server Configuration
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
```

### 3. Using Docker (Recommended)

Start all services with Docker Compose:

```bash
# Start all services in the background
docker-compose up -d

# View logs
docker-compose logs -f

# Stop all services
docker-compose down
```

This will start:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:5000
- **MongoDB**: localhost:27017
- **Redis**: localhost:6379

### 4. Manual Installation (Alternative)

If you prefer to run services manually:

#### Backend Setup
```bash
cd backend
npm install
npm run dev
```

#### Frontend Setup
```bash
cd frontend
npm install
npm start
```

#### Database Setup
Make sure MongoDB and Redis are running locally or configure cloud instances.

## 📖 Usage Guide

### Starting a Session

1. **Access the Application**: Open http://localhost:3000
2. **Create Session**: 
   - Enter doctor name (required)
   - Select session type (consultation, follow-up, etc.)
   - Choose priority level
   - Add any initial notes
   - Click "Start Session"

### Recording & Transcription

1. **Audio Recording**:
   - Click "Start Recording" to begin real-time recording
   - The system will automatically transcribe speech
   - Click "Stop Recording" when finished

2. **File Upload**:
   - Use "Upload Audio" for pre-recorded files
   - Supported formats: MP3, WAV, M4A, WebM, OGG
   - Maximum file size: 50MB

3. **Edit Transcriptions**:
   - Click the edit icon next to any transcription
   - Make corrections as needed
   - Save changes to maintain accuracy

### Generating Summaries

1. **Auto-Generation**: 
   - Click "Generate Summary" after transcriptions are complete
   - The AI will create a structured medical summary
   - Review and edit as needed

2. **Summary Sections**:
   - Chief Complaint
   - History of Present Illness
   - Assessment & Plan
   - Follow-up Instructions

### Session Management

- **View All Sessions**: Navigate to Sessions tab
- **End Session**: Click "End Session" when consultation is complete
- **Export Data**: Download summaries in various formats

## 🔧 API Reference

### Session Endpoints
```
POST   /api/sessions              Create new session
GET    /api/sessions              Get all sessions
GET    /api/sessions/:id          Get specific session
PUT    /api/sessions/:id          Update session
PATCH  /api/sessions/:id/end      End session
DELETE /api/sessions/:id          Delete session
```

### Transcription Endpoints
```
POST   /api/transcribe/upload              Upload audio for transcription
GET    /api/transcribe/:id                 Get transcription
GET    /api/sessions/:id/transcriptions    Get session transcriptions
PUT    /api/transcribe/:id                 Update transcription
DELETE /api/transcribe/:id                 Delete transcription
```

### Summary Endpoints
```
POST   /api/sessions/:id/summary    Generate summary
GET    /api/summaries/:id           Get summary
PUT    /api/summaries/:id           Update summary
GET    /api/summaries/:id/export/:format   Export summary
```

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   React App     │    │   Express API   │    │   OpenAI API    │
│   (Frontend)    │◄──►│   (Backend)     │◄──►│   (AI Services) │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                               │
                ┌──────────────┼──────────────┐
                │              │              │
        ┌───────▼────┐  ┌──────▼──────┐  ┌───▼────┐
        │  MongoDB   │  │    Redis    │  │ Socket │
        │ (Database) │  │  (Cache)    │  │   IO   │
        └────────────┘  └─────────────┘  └────────┘
```

## 🔒 Security Features

- **Rate Limiting**: Prevent API abuse
- **Input Validation**: Joi schema validation
- **CORS Protection**: Configured for frontend domain
- **Helmet.js**: Security headers
- **Environment Variables**: Secure API key management

## 🧪 Testing

### Backend Tests
```bash
cd backend
npm test
```

### Frontend Tests
```bash
cd frontend
npm test
```

### API Testing
Use the included Postman collection or test manually:
```bash
# Health check
curl http://localhost:5000/api/health

# Create session
curl -X POST http://localhost:5000/api/sessions \
  -H "Content-Type: application/json" \
  -d '{"doctorName": "Dr. Smith", "sessionType": "consultation"}'
```

## 📊 Monitoring

### Logs
- **Backend Logs**: `backend/logs/`
- **Error Logs**: `backend/logs/error.log`
- **Combined Logs**: `backend/logs/combined.log`

### Health Checks
- **Backend**: http://localhost:5000/health
- **API**: http://localhost:5000/api/health

## 🚀 Deployment

### Production Deployment

1. **Environment Configuration**:
   ```bash
   # Set production environment variables
   NODE_ENV=production
   MONGO_URI=your_production_mongodb_uri
   REDIS_URL=your_production_redis_uri
   ```

2. **Docker Production**:
   ```bash
   docker-compose -f docker-compose.prod.yml up -d
   ```

3. **SSL Configuration**:
   - Configure SSL certificates in `nginx/ssl/`
   - Update `nginx/nginx.conf` for HTTPS

### Cloud Deployment Options

- **AWS**: Use ECS with RDS (MongoDB Atlas) and ElastiCache (Redis)
- **Google Cloud**: Use Cloud Run with Cloud MongoDB and Memorystore
- **Azure**: Use Container Instances with Cosmos DB and Redis Cache

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/new-feature`
3. Commit changes: `git commit -am 'Add new feature'`
4. Push to branch: `git push origin feature/new-feature`
5. Submit a Pull Request

## 📜 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Troubleshooting

### Common Issues

1. **OpenAI API Errors**:
   - Verify API key is correct
   - Check API usage limits
   - Ensure sufficient credits

2. **Audio Recording Issues**:
   - Grant microphone permissions
   - Use HTTPS for production (required for mic access)
   - Check browser compatibility

3. **Database Connection**:
   - Verify MongoDB is running
   - Check connection string format
   - Ensure network connectivity

4. **File Upload Problems**:
   - Check file size (max 50MB)
   - Verify supported audio formats
   - Ensure sufficient disk space

### Support

For issues and questions:
- Check the [Issues](../../issues) section
- Review logs for error details
- Contact the development team

## 🔄 Changelog

### Version 1.0.0
- Initial release
- Basic transcription functionality
- AI-powered summary generation
- Session management
- Docker containerization

---

**Built with ❤️ for healthcare professionals**