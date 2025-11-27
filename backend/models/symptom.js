const mongoose = require('mongoose');

const symptomSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    unique: true
  },
  category: {
    type: String,
    required: true,
    enum: [
      'pain',
      'neurological',
      'respiratory',
      'cardiovascular',
      'gastrointestinal',
      'musculoskeletal',
      'dermatological',
      'psychological',
      'urological',
      'gynecological',
      'ophthalmic',
      'otolaryngological',
      'systemic',
      'other'
    ]
  },
  description: {
    type: String,
    trim: true
  },
  synonyms: [{
    type: String,
    trim: true
  }],
  severity: {
    scale: {
      type: String,
      enum: ['1-10', 'mild-moderate-severe', 'low-medium-high'],
      default: 'mild-moderate-severe'
    },
    defaultLevel: {
      type: String,
      default: 'moderate'
    }
  },
  commonCauses: [{
    condition: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Condition'
    },
    likelihood: {
      type: Number,
      min: 0,
      max: 100
    }
  }],
  associatedSymptoms: [{
    symptom: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Symptom'
    },
    correlation: {
      type: Number,
      min: 0,
      max: 100
    }
  }],
  bodyParts: [{
    type: String,
    enum: [
      'head', 'neck', 'chest', 'back', 'abdomen', 'pelvis',
      'arms', 'hands', 'legs', 'feet', 'skin', 'eyes',
      'ears', 'nose', 'throat', 'mouth', 'general'
    ]
  }],
  duration: {
    typical: {
      min: Number, // in hours
      max: Number  // in hours
    },
    chronic: {
      type: Boolean,
      default: false
    }
  },
  urgencyLevel: {
    type: String,
    enum: ['low', 'medium', 'high', 'emergency'],
    default: 'medium'
  },
  redFlags: [{
    description: String,
    action: String
  }],
  questions: [{
    question: String,
    type: {
      type: String,
      enum: ['boolean', 'scale', 'multiple-choice', 'text'],
      default: 'boolean'
    },
    options: [String], // For multiple choice
    importance: {
      type: Number,
      min: 1,
      max: 10,
      default: 5
    }
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  metadata: {
    frequency: {
      type: String,
      enum: ['very-rare', 'rare', 'uncommon', 'common', 'very-common']
    },
    ageGroups: [{
      type: String,
      enum: ['infant', 'child', 'adolescent', 'adult', 'elderly']
    }],
    genderPreference: {
      type: String,
      enum: ['male', 'female', 'both'],
      default: 'both'
    }
  }
}, {
  timestamps: true
});

// Indexes
symptomSchema.index({ name: 1 });
symptomSchema.index({ category: 1 });
symptomSchema.index({ urgencyLevel: 1 });
symptomSchema.index({ bodyParts: 1 });

// Text index for search
symptomSchema.index({
  name: 'text',
  description: 'text',
  synonyms: 'text'
});

// Static method to search symptoms
symptomSchema.statics.searchSymptoms = function(query, options = {}) {
  const searchOptions = {
    $text: { $search: query }
  };
  
  if (options.category) {
    searchOptions.category = options.category;
  }
  
  if (options.bodyPart) {
    searchOptions.bodyParts = options.bodyPart;
  }
  
  if (options.urgencyLevel) {
    searchOptions.urgencyLevel = options.urgencyLevel;
  }
  
  return this.find(searchOptions)
    .sort({ score: { $meta: 'textScore' } })
    .populate('commonCauses.condition')
    .limit(options.limit || 20);
};

// Static method to find by body part
symptomSchema.statics.findByBodyPart = function(bodyPart) {
  return this.find({ bodyParts: bodyPart });
};

// Method to check urgency
symptomSchema.methods.isUrgent = function() {
  return ['high', 'emergency'].includes(this.urgencyLevel);
};

// Method to get assessment questions
symptomSchema.methods.getAssessmentQuestions = function(importance = 5) {
  return this.questions.filter(q => q.importance >= importance);
};

module.exports = mongoose.model('Symptom', symptomSchema);