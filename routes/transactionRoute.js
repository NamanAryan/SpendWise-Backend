import express from 'express';
import Expense from '../models/transaction.model.js';
import protect from '../middleware/auth.middleware.js';
import streakService from '../services/streakService.js';

const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const expense = new Expense(req.body);
    const newExpense = await expense.save();
    res.status(201).json(newExpense);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    console.log(`GET request received for /api/expenses/${req.params.id}`);
    const expense = await Expense.findById(req.params.id);
    if (!expense) return res.status(404).json({ message: 'Expense not found' });
    res.json(expense);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;