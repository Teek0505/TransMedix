const mongoose = require('mongoose');

const conditionSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    unique: true
  },
  icd10Code: {
    type: String,
    required: true,
    trim: true,
    unique: true
  },
  category: {
    type: String,
    required: true,
    enum: [
      'infectious-disease',
      'neoplasm',
      'blood-disorder',
      'endocrine-disorder',
      'mental-disorder',
      'nervous-system',
      'eye-disorder',
      'ear-disorder',
      'circulatory-system',
      'respiratory-system',
      'digestive-system',
      'skin-disorder',
      'musculoskeletal',
      'genitourinary',
      'pregnancy-related',
      'perinatal',
      'congenital',
      'injury-poisoning',
      'external-causes',
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
  symptoms: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Symptom'
  }],
  commonTreatments: [{
    type: String,
    trim: true
  }],
  severity: {
    type: String,
    enum: ['mild', 'moderate', 'severe', 'critical'],
    default: 'moderate'
  },
  prevalence: {
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
  },
  isActive: {
    type: Boolean,
    default: true
  },
  metadata: {
    sourceReliability: {
      type: Number,
      min: 0,
      max: 100,
      default: 90
    },
    lastUpdated: {
      type: Date,
      default: Date.now
    },
    updatedBy: String
  }
}, {
  timestamps: true
});

// Indexes
conditionSchema.index({ name: 1 });
conditionSchema.index({ icd10Code: 1 });
conditionSchema.index({ category: 1 });
conditionSchema.index({ severity: 1 });

// Text index for search
conditionSchema.index({
  name: 'text',
  description: 'text',
  synonyms: 'text'
});

// Static method to search conditions
conditionSchema.statics.searchConditions = function(query, options = {}) {
  const searchOptions = {
    $text: { $search: query }
  };
  
  if (options.category) {
    searchOptions.category = options.category;
  }
  
  if (options.severity) {
    searchOptions.severity = options.severity;
  }
  
  return this.find(searchOptions)
    .sort({ score: { $meta: 'textScore' } })
    .limit(options.limit || 20);
};

// Static method to find by ICD10 code
conditionSchema.statics.findByICD10 = function(code) {
  return this.findOne({ icd10Code: code.toUpperCase() });
};

// Method to add synonym
conditionSchema.methods.addSynonym = function(synonym) {
  if (!this.synonyms.includes(synonym.toLowerCase())) {
    this.synonyms.push(synonym.toLowerCase());
    return this.save();
  }
  return Promise.resolve(this);
};

module.exports = mongoose.model('Condition', conditionSchema);