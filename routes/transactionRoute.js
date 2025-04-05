import express from 'express';
import Expense from '../models/transaction.model.js';
const router = express.Router();

// GET all expenses
router.get('/', async (req, res) => {
  try {
    console.log("GET request received for /api/expenses");
    const expenses = await Expense.find().sort({ Date: -1 });
    console.log("Found expenses:", expenses.length);
    res.json(expenses);
  } catch (err) {
    console.error("Error in GET /api/expenses:", err);
    res.status(500).json({ message: err.message });
  }
});

// POST a new expense
router.post('/', async (req, res) => {
  try {
    console.log("POST request received for /api/expenses");
    console.log("Request body:", req.body);
    
    // Ensure Date is a proper Date object
    if (req.body.Date && typeof req.body.Date === 'string') {
      req.body.Date = new Date(req.body.Date);
    }
    
    const expense = new Expense(req.body);
    console.log("Expense object created:", expense);
    
    const newExpense = await expense.save();
    console.log("Expense saved successfully:", newExpense._id);
    
    res.status(201).json(newExpense);
  } catch (err) {
    console.error("Error in POST /api/expenses:", err);
    res.status(400).json({ message: err.message });
  }
});

// GET a specific expense
router.get('/:id', async (req, res) => {
  try {
    console.log(`GET request received for /api/expenses/${req.params.id}`);
    const expense = await Expense.findById(req.params.id);
    if (!expense) {
      console.log("Expense not found");
      return res.status(404).json({ message: 'Expense not found' });
    }
    res.json(expense);
  } catch (err) {
    console.error("Error in GET /api/expenses/:id:", err);
    res.status(500).json({ message: err.message });
  }
});

export default router;