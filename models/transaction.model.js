import mongoose from "mongoose";
import { predictImpulse } from './impulsePrediction.js';
const Schema = mongoose.Schema;

const expenseSchema = new Schema({
  Date: {
    type: Date,
    required: true
  },
  Description: {
    type: String,
    required: true,
    trim: true
  },
  Amount: {
    type: Number,
    required: true
  },
  Category: {
    type: String,
    required: true,
    trim: true
  },
  is_Need: {
    type: String,
    enum: ['Need', 'Want'],
    required: true
  },
  Time_of_Day: {
    type: String,
    enum: ['Morning', 'Afternoon', 'Evening', 'Night'],
    required: true
  },
  Payment_Mode: {
    type: String,
    required: true,
    trim: true
  },
  Impulse_Tag: {
    type: Boolean,
    default: false
  },
  free_impulse_purchase: {
    type: Boolean,
    default: false
  },
  User_ID: {
    type: String,
    required: true,
    index: true
  },
  Source_App: {
    type: String,
    trim: true
  },
  created_at: {
    type: Date,
    default: Date.now
  },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
});

expenseSchema.pre('save', async function(next) {
  if (this.isModified('Impulse_Tag') && this.isNew === false) {
    return next();
  }
  
  try {
    // Get transaction data for prediction
    const transaction = {
      Category: this.Category,
      Amount: this.Amount,
      Time_of_Day: this.Time_of_Day,
      is_Need: this.is_Need
    };
    
    // Call prediction function
    const prediction = await predictImpulse(transaction);
    
    // Set the Impulse_Tag based on prediction
    this.Impulse_Tag = prediction.isImpulse;
    
    next();
  } catch (error) {
    console.error('Error predicting impulse purchase:', error);
    next();
  }
});

expenseSchema.index({ User_ID: 1, Date: -1 });
expenseSchema.index({ Category: 1 });

const Expense = mongoose.model('Expense', expenseSchema);

export default Expense;