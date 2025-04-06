import express from 'express';
import Expense from '../models/transaction.model.js';
import User from '../models/user.model.js'; // Make sure this exists
import protect from '../middleware/auth.middleware.js';

const router = express.Router();

// Create new transaction (expense or income)
router.patch('/balance', protect, async (req, res) => {
  try {
    const { newBalance } = req.body;

    if (typeof newBalance !== 'number') {
      return res.status(400).json({ message: 'newBalance must be a number' });
    }

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    user.balance = newBalance;
    await user.save();

    res.status(200).json({ message: 'Balance updated successfully', balance: user.balance });
  } catch (err) {
    console.error('Error updating balance:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/', protect, async (req, res) => {
  try {
    const {
      Description,
      Amount,
      Date,
      Category,
      is_Need,
      Time_of_Day,
      Payment_Mode,
      Impulse_Tag,
      Source_App,
      type, // 👈 Add this
    } = req.body;

    if (!Amount || !Category || !Date || !type) {
      return res.status(400).json({ message: 'Required fields missing' });
    }

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (type === 'income') {
      user.balance += Amount;
    } else if (type === 'expense') {
      user.balance += Amount; 
    } else {
      return res.status(400).json({ message: 'Invalid transaction type' });
    }

    await user.save();

    const expense = new Expense({
      Description,
      Amount,
      Date,
      Category,
      is_Need,
      Time_of_Day,
      Payment_Mode,
      Impulse_Tag,
      Source_App,
      type, 
      User_ID: user.email,
      user: user._id,
    });

    const saved = await expense.save();

    res.status(201).json({ transaction: saved, newBalance: user.balance });
  } catch (err) {
    console.error('Error creating transaction:', err);
    res.status(500).json({ message: 'Server error' });
  }
});



// Get a specific transaction by ID
router.get('/:id', protect, async (req, res) => {
  try {
    const expenses = await Expense.find({ user: req.user.id }).sort({ Date: -1 });
    if (!expense || expense.user.toString() !== req.user.id) {
      return res.status(404).json({ message: 'Transaction not found' });
    }

    res.json(expense);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// GET all transactions for logged-in user
router.get('/', protect, async (req, res) => {
  try {
    const expenses = await Expense.find({ user: req.user.id }).sort({ Date: -1 });
    res.status(200).json(expenses);
  } catch (err) {
    console.error('Error fetching transactions:', err);
    res.status(500).json({ message: 'Server error' });
  }
});


export default router;
