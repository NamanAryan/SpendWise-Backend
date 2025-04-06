// impulsePrediction.js
import * as tf from '@tensorflow/tfjs';

// Trained model parameters
const MODEL_URL = 'path/to/tfjs_model/model.json';
let model;

async function loadModel() {
  model = await tf.loadLayersModel(MODEL_URL);
}

// Process transaction data for prediction
function processTransaction(transaction) {
  const timeMap = {
    'Morning': 9,
    'Afternoon': 14,
    'Evening': 18,
    'Night': 21
  };
  
  const categoryImportance = {
    'Health': 1.0,
    'Groceries': 0.9,
    'Utilities': 0.8,
    'Travel': 0.6,
    'Entertainment': 0.4,
    'Shopping': 0.3,
    'Dining': 0.2
  };
  
  // Determine if weekend
  const date = new Date(transaction.Date);
  const isWeekend = (date.getDay() === 0 || date.getDay() === 6) ? 1 : 0;
  
  // Get hour from Time_of_Day
  const hour = timeMap[transaction.Time_of_Day] || 12;
  
  // Get category importance
  const catImportance = categoryImportance[transaction.Category] || 0.5;
  
  // Create tensor with features in same order as training
  return tf.tensor2d([[
    transaction.Amount,
    hour,
    isWeekend,
    catImportance,
    transaction.Prev_Impulse || 0
  ]]);
}

// Predict if a transaction is impulsive
async function predictImpulse(transaction) {
  if (!model) {
    await loadModel();
  }
  
  const features = processTransaction(transaction);
  const prediction = model.predict(features);
  const probability = prediction.dataSync()[0];
  
  return {
    isImpulse: probability > 0.5,
    probability: probability
  };
}

// Export the functions you want to use in other files
export { predictImpulse, loadModel };