import mongoose from "mongoose";
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
  }
});

expenseSchema.index({ User_ID: 1, Date: -1 });
expenseSchema.index({ Category: 1 });

const Expense = mongoose.model('Expense', expenseSchema);

export default Expense;