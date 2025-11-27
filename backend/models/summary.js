const mongoose = require('mongoose');

const summarySchema = new mongoose.Schema({
  summaryId: {
    type: String,
    required: true,
    unique: true,
    default: function() {
      return 'sum_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }
  },
  session: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Session',
    required: true
  },
  content: {
    chiefComplaint: {
      type: String,
      required: true,
      trim: true
    },
    historyOfPresentIllness: {
      type: String,
      trim: true
    },
    pastMedicalHistory: {
      type: String,
      trim: true
    },
    medications: {
      type: String,
      trim: true
    },
    allergies: {
      type: String,
      trim: true
    },
    socialHistory: {
      type: String,
      trim: true
    },
    familyHistory: {
      type: String,
      trim: true
    },
    reviewOfSystems: {
      type: String,
      trim: true
    },
    physicalExamination: {
      type: String,
      trim: true
    },
    assessment: {
      type: String,
      required: true,
      trim: true
    },
    plan: {
      type: String,
      required: true,
      trim: true
    },
    followUp: {
      type: String,
      trim: true
    }
  },
  keyPoints: [{
    category: {
      type: String,
      enum: ['symptom', 'diagnosis', 'treatment', 'followup', 'medication', 'other']
    },
    point: String,
    confidence: {
      type: Number,
      min: 0,
      max: 100,
      default: 80
    }
  }],
  extractedData: {
    symptoms: [{
      name: String,
      severity: {
        type: String,
        enum: ['mild', 'moderate', 'severe']
      },
      duration: String,
      onset: String
    }],
    diagnoses: [{
      condition: String,
      icd10Code: String,
      confidence: {
        type: Number,
        min: 0,
        max: 100
      }
    }],
    medications: [{
      name: String,
      dosage: String,
      frequency: String,
      duration: String,
      route: String
    }],
    procedures: [{
      name: String,
      cptCode: String,
      description: String
    }],
    vitalSigns: {
      bloodPressure: String,
      heartRate: String,
      temperature: String,
      respiratoryRate: String,
      oxygenSaturation: String,
      weight: String,
      height: String
    }
  },
  generationMetadata: {
    model: {
      type: String,
      default: 'gpt-4'
    },
    promptVersion: {
      type: String,
      default: '1.0'
    },
    processingTime: Number, // in milliseconds
    tokenUsage: {
      prompt: Number,
      completion: Number,
      total: Number
    },
    confidence: {
      type: Number,
      min: 0,
      max: 100,
      default: 85
    }
  },
  status: {
    type: String,
    enum: ['generating', 'completed', 'failed', 'reviewing'],
    default: 'generating'
  },
  version: {
    type: Number,
    default: 1
  },
  previousVersions: [{
    version: Number,
    content: mongoose.Schema.Types.Mixed,
    generatedAt: Date,
    generatedBy: String
  }],
  reviewedBy: {
    type: String,
    trim: true
  },
  reviewedAt: {
    type: Date
  },
  reviewNotes: {
    type: String,
    trim: true
  },
  isApproved: {
    type: Boolean,
    default: false
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Indexes
summarySchema.index({ summaryId: 1 });
summarySchema.index({ session: 1 });
summarySchema.index({ status: 1 });
summarySchema.index({ createdAt: -1 });

// Virtual for word count
summarySchema.virtual('wordCount').get(function() {
  let totalWords = 0;
  if (this.content) {
    Object.values(this.content).forEach(section => {
      if (typeof section === 'string') {
        totalWords += section.split(/\s+/).filter(word => word.length > 0).length;
      }
    });
  }
  return totalWords;
});

// Method to create new version
summarySchema.methods.createNewVersion = function(newContent, generatedBy) {
  // Save current version to history
  this.previousVersions.push({
    version: this.version,
    content: this.content,
    generatedAt: this.updatedAt,
    generatedBy: generatedBy || 'system'
  });
  
  // Update to new version
  this.version += 1;
  this.content = newContent;
  this.status = 'completed';
  this.isApproved = false; // Reset approval status
  
  return this.save();
};

// Method to approve summary
summarySchema.methods.approve = function(reviewedBy, reviewNotes) {
  this.isApproved = true;
  this.reviewedBy = reviewedBy;
  this.reviewedAt = new Date();
  this.reviewNotes = reviewNotes;
  
  return this.save();
};

// Static method to find pending summaries
summarySchema.statics.findPendingSummaries = function() {
  return this.find({ 
    status: 'completed',
    isApproved: false 
  }).populate('session');
};

// Ensure virtual fields are serialized
summarySchema.set('toJSON', {
  virtuals: true
});

module.exports = mongoose.model('Summary', summarySchema);