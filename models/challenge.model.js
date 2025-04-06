// challenge.model.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const ChallengeSchema = new Schema({
  // User reference - connects challenges to specific users
  userId: { 
    type: Schema.Types.ObjectId, 
    ref: 'User', 
    required: true,
    index: true // For query performance
  },
  
  // Basic challenge information
  title: { 
    type: String, 
    required: true,
    trim: true 
  },
  description: { 
    type: String,
    trim: true,
    default: '' 
  },
  
  // Challenge metrics
  points: { 
    type: Number, 
    required: true,
    min: 0 
  },
  percentComplete: { 
    type: Number, 
    default: 0,
    min: 0,
    max: 100 
  },
  
  // Challenge status
  status: { 
    type: String, 
    enum: ['Not Started', 'Active', 'Paused', 'Completed', 'Failed'],
    default: 'Active' 
  },
  
  // Visual customization
  color: { 
    type: String, 
    default: 'bg-blue-500' 
  },
  icon: {
    type: String,
    default: 'trophy' // Default icon name
  },
  
  // Challenge date tracking
  startDate: { 
    type: Date, 
    default: Date.now 
  },
  endDate: { 
    type: Date,
    default: null 
  },
  completedDate: {
    type: Date,
    default: null
  },
  
  // Challenge category
  category: {
    type: String,
    enum: ['Saving', 'Budgeting', 'Investing', 'Debt Reduction', 'Income Growth', 'Other'],
    default: 'Other'
  },
  
  // Challenge target (numerical goal)
  targetAmount: {
    type: Number,
    default: null
  },
  currentAmount: {
    type: Number,
    default: 0
  },
  currency: {
    type: String,
    default: 'USD'
  },
  
  // Advanced tracking options
  isRecurring: {
    type: Boolean,
    default: false
  },
  recurrencePattern: {
    type: String,
    enum: ['Daily', 'Weekly', 'Monthly', 'Yearly', null],
    default: null
  },
  
  // Challenge milestones/subtasks
  milestones: [{
    title: { type: String, required: true },
    isCompleted: { type: Boolean, default: false },
    completedDate: { type: Date, default: null }
  }],
  
  // Challenge progress history (for tracking changes over time)
  progressHistory: [{
    date: { type: Date, default: Date.now },
    percentComplete: { type: Number },
    amount: { type: Number, default: null },
    note: { type: String, default: '' }
  }],
  
  // Privacy settings
  isPrivate: {
    type: Boolean,
    default: false
  },
  
  // Social features
  likes: {
    type: Number,
    default: 0
  },
  sharedWith: [{
    userId: { type: Schema.Types.ObjectId, ref: 'User' },
    permissionLevel: { 
      type: String, 
      enum: ['View', 'Edit'],
      default: 'View'
    }
  }],
  
  // Challenge accomplishment
  reward: {
    type: String,
    default: ''
  },
  
  // Timestamps for creation and updates
  createdAt: { 
    type: Date, 
    default: Date.now,
    immutable: true 
  },
  updatedAt: { 
    type: Date, 
    default: Date.now 
  }
}, {
  timestamps: { createdAt: false, updatedAt: true } // Auto-update the updatedAt field
});

// Virtual field for time remaining
ChallengeSchema.virtual('timeRemaining').get(function() {
  if (!this.endDate) return null;
  
  const now = new Date();
  const end = new Date(this.endDate);
  
  // Return in milliseconds
  return end - now;
});

// Virtual field for days remaining
ChallengeSchema.virtual('daysRemaining').get(function() {
  if (!this.endDate) return null;
  
  const now = new Date();
  const end = new Date(this.endDate);
  
  // Return in days
  const diffTime = Math.abs(end - now);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

// Method to update progress
ChallengeSchema.methods.updateProgress = async function(newPercentage, amount = null, note = '') {
  // Add to progress history
  this.progressHistory.push({
    date: new Date(),
    percentComplete: newPercentage,
    amount: amount,
    note: note
  });
  
  // Update current progress
  this.percentComplete = newPercentage;
  if (amount !== null) {
    this.currentAmount = amount;
  }
  
  // Update status if completed
  if (newPercentage >= 100) {
    this.status = 'Completed';
    this.completedDate = new Date();
  }
  
  // Save the updated document
  return this.save();
};

// Pre-save middleware to update percentComplete based on amounts if target exists
ChallengeSchema.pre('save', function(next) {
  if (this.targetAmount && this.targetAmount > 0) {
    this.percentComplete = Math.min(100, (this.currentAmount / this.targetAmount) * 100);
  }
  next();
});

// Index for efficient queries
ChallengeSchema.index({ userId: 1, status: 1 });
ChallengeSchema.index({ category: 1 });
ChallengeSchema.index({ endDate: 1 }); // For finding soon-to-expire challenges

module.exports = mongoose.model('Challenge', ChallengeSchema);