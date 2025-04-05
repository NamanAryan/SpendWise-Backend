import mongoose from "mongoose";
const Schema = mongoose.Schema;

const streakSchema = new Schema({
  User_ID: {
    type: String,
    required: true,
    index: true
  },
  currentStreak: {
    type: Number,
    default: 0
  },
  longestStreak: {
    type: Number,
    default: 0
  },
  lastNonImpulseDate: {
    type: Date,
    default: null
  },
  completedStreaks: {
    type: Number,
    default: 0
  },
  freeImpulsePurchases: {
    type: Number,
    default: 0
  },
  streakResetDate: {
    type: Date,
    default: null
  },
  vouchersEarned: [{
    voucherType: {
      type: String,
      enum: ['weekly', 'monthly']
    },
    earnedAt: {
      type: Date,
      default: Date.now
    },
    used: {
      type: Boolean,
      default: false
    },
    expiresAt: {
      type: Date
    }
  }],
  created_at: {
    type: Date,
    default: Date.now
  },
  updated_at: {
    type: Date,
    default: Date.now
  }
});

// Index for faster queries
streakSchema.index({ User_ID: 1 });

const Streak = mongoose.model('Streak', streakSchema);

export default Streak;