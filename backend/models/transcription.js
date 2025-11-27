const mongoose = require('mongoose');

const transcriptionSchema = new mongoose.Schema({
  transcriptionId: {
    type: String,
    required: true,
    unique: true,
    default: function() {
      return 'trans_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }
  },
  session: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Session',
    required: true
  },
  audioFile: {
    originalName: String,
    filename: String,
    path: String,
    size: Number,
    mimeType: String
  },
  transcriptionText: {
    type: String,
    required: false,
    default: ''
  },
  confidence: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  language: {
    type: String,
    default: 'en'
  },
  speaker: {
    type: String,
    enum: ['doctor', 'patient', 'unknown'],
    default: 'unknown'
  },
  timestamp: {
    start: Number, // seconds from session start
    end: Number
  },
  processingMetadata: {
    model: String,
    processingTime: Number,
    tokenUsage: Number
  },
  status: {
    type: String,
    enum: ['processing', 'completed', 'failed'],
    default: 'processing'
  },
  isEdited: {
    type: Boolean,
    default: false
  },
  editHistory: [{
    originalText: String,
    editedText: String,
    editedAt: Date,
    editedBy: String
  }]
}, {
  timestamps: true
});

// Indexes
transcriptionSchema.index({ transcriptionId: 1 });
transcriptionSchema.index({ session: 1 });
transcriptionSchema.index({ status: 1 });
transcriptionSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Transcription', transcriptionSchema);