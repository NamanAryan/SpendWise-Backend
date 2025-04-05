import express from 'express';
import Expense from '../models/transaction.model.js';
import protect from '../middleware/auth.middleware.js';
import streakService from '../services/streakService.js';

const router = express.Router();

// Create new expense with streak integration
router.post('/', protect, async (req, res) => {
  try {
    const userId = req.user._id.toString();
    const { Impulse_Tag, useFreeImpulse, ...expenseData } = req.body;
    
    // Create new expense instance with user ID from auth
    const expense = new Expense({
      ...expenseData,
      Impulse_Tag: Impulse_Tag || false,
      User_ID: userId
    });
    
    // Save the expense first
    const newExpense = await expense.save();
    
    // Handle streak logic based on impulse tag
    let streakResult;
    
    if (Impulse_Tag) {
      // Handle impulse purchase - potentially reset streak
      streakResult = await streakService.handleImpulsePurchase(
        userId, 
        expense.Date, 
        useFreeImpulse
      );
      
      if (streakResult.usedFreeImpulse) {
        // If free impulse was used, update the expense to mark it as "free"
        await Expense.findByIdAndUpdate(newExpense._id, { 
          free_impulse_purchase: true 
        });
      }
    } else {
      // Update streak for non-impulse purchase
      streakResult = await streakService.updateStreak(userId, expense.Date);
    }
    
    // Get streak details to send back with response
    const streakStats = await streakService.getStreakStats(userId);
    
    // Create response with expense data and streak info
    const responseData = {
      expense: newExpense,
      streak: {
        currentStreak: streakStats.currentStreak,
        streakProgress: `${streakStats.currentStreak}/7`,
        freeImpulsePurchases: streakStats.freeImpulsePurchases
      }
    };
    
    // If a reward was earned, add it to the response
    if (streakResult.rewardEarned) {
      responseData.reward = {
        type: streakResult.rewardEarned,
        message: streakResult.rewardEarned === 'weekly' 
          ? 'Congratulations! You earned a weekly voucher for completing a 7-day streak!' 
          : 'Amazing! You completed 3 weekly streaks and earned a free impulse purchase!'
      };
    }
    
    // Send success response with all the data
    res.status(201).json({
      success: true,
      ...responseData
    });
  } catch (err) {
    console.error('Error creating expense:', err);
    res.status(400).json({ 
      success: false,
      message: err.message 
    });
  }
});

// Get all expenses for the logged-in user
router.get('/my-expenses', protect, async (req, res) => {
  try {
    const userId = req.user._id;
    
    // Add pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    // Get expenses with pagination
    const expenses = await Expense.find({ User_ID: userId })
      .sort({ Date: -1 })
      .skip(skip)
      .limit(limit);
    
    // Get total count for pagination
    const total = await Expense.countDocuments({ User_ID: userId });
    
    // Get streak stats
    const streakStats = await streakService.getStreakStats(userId);
    
    res.json({
      success: true,
      expenses,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit)
      },
      streak: {
        currentStreak: streakStats.currentStreak,
        streakProgress: `${streakStats.currentStreak}/7`,
        freeImpulsePurchases: streakStats.freeImpulsePurchases,
        activeVouchers: streakStats.activeVouchers.length
      }
    });
  } catch (err) {
    res.status(500).json({ 
      success: false,
      message: err.message 
    });
  }
});

// Get specific expense by ID
router.get('/:id', protect, async (req, res) => {
  try {
    const expense = await Expense.findById(req.params.id);
    
    if (!expense) {
      return res.status(404).json({ 
        success: false,
        message: 'Expense not found' 
      });
    }
    
    // Check if the expense belongs to the logged-in user
    if (expense.User_ID !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to access this expense'
      });
    }
    
    res.json({
      success: true,
      expense
    });
  } catch (err) {
    res.status(500).json({ 
      success: false,
      message: err.message 
    });
  }
});

// Update expense
router.put('/:id', protect, async (req, res) => {
  try {
    const expenseId = req.params.id;
    const userId = req.user._id.toString();
    
    // Find the expense
    const expense = await Expense.findById(expenseId);
    
    if (!expense) {
      return res.status(404).json({ 
        success: false,
        message: 'Expense not found' 
      });
    }
    
    // Check if the expense belongs to the logged-in user
    if (expense.User_ID !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to modify this expense'
      });
    }
    
    // Note the previous impulse tag status
    const wasImpulse = expense.Impulse_Tag;
    const willBeImpulse = req.body.Impulse_Tag === true;
    
    // Update the expense
    const updatedExpense = await Expense.findByIdAndUpdate(
      expenseId,
      { ...req.body },
      { new: true }
    );
    
    // Handle streak changes if impulse tag changed
    if (wasImpulse !== willBeImpulse) {
      if (willBeImpulse) {
        // Changed from non-impulse to impulse - might break streak
        await streakService.handleImpulsePurchase(userId, updatedExpense.Date);
      } else {
        // Changed from impulse to non-impulse - might continue streak
        await streakService.updateStreak(userId, updatedExpense.Date);
      }
    }
    
    // Get updated streak stats
    const streakStats = await streakService.getStreakStats(userId);
    
    res.json({
      success: true,
      expense: updatedExpense,
      streak: {
        currentStreak: streakStats.currentStreak,
        streakProgress: `${streakStats.currentStreak}/7`,
        freeImpulsePurchases: streakStats.freeImpulsePurchases
      }
    });
  } catch (err) {
    res.status(400).json({ 
      success: false,
      message: err.message 
    });
  }
});

// Delete expense
router.delete('/:id', protect, async (req, res) => {
  try {
    const expense = await Expense.findById(req.params.id);
    
    if (!expense) {
      return res.status(404).json({ 
        success: false,
        message: 'Expense not found' 
      });
    }
    
    // Check if the expense belongs to the logged-in user
    if (expense.User_ID !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this expense'
      });
    }
    
    await Expense.findByIdAndDelete(req.params.id);
    
    res.json({
      success: true,
      message: 'Expense deleted successfully'
    });
  } catch (err) {
    res.status(500).json({ 
      success: false,
      message: err.message 
    });
  }
});

// Get expense statistics with streak info
router.get('/stats/summary', protect, async (req, res) => {
  try {
    const userId = req.user._id.toString();
    
    // Get basic expense stats
    const totalExpenses = await Expense.countDocuments({ User_ID: userId });
    const impulseExpenses = await Expense.countDocuments({ 
      User_ID: userId, 
      Impulse_Tag: true 
    });
    
    // Calculate averages and totals
    const totalAmountResult = await Expense.aggregate([
      { $match: { User_ID: userId } },
      { $group: { _id: null, total: { $sum: "$Amount" } } }
    ]);
    
    const totalAmount = totalAmountResult.length > 0 
      ? totalAmountResult[0].total 
      : 0;
    
    const impulseAmountResult = await Expense.aggregate([
      { $match: { User_ID: userId, Impulse_Tag: true } },
      { $group: { _id: null, total: { $sum: "$Amount" } } }
    ]);
    
    const impulseAmount = impulseAmountResult.length > 0 
      ? impulseAmountResult[0].total 
      : 0;
    
    // Get streak stats
    const streakStats = await streakService.getStreakStats(userId);
    
    res.json({
      success: true,
      stats: {
        totalExpenses,
        impulseExpenses,
        nonImpulseExpenses: totalExpenses - impulseExpenses,
        totalAmount,
        impulseAmount,
        nonImpulseAmount: totalAmount - impulseAmount,
        impulsePercentage: totalExpenses > 0 
          ? (impulseExpenses / totalExpenses * 100).toFixed(2) 
          : 0
      },
      streak: {
        currentStreak: streakStats.currentStreak,
        longestStreak: streakStats.longestStreak,
        completedStreaks: streakStats.completedStreaks,
        freeImpulsePurchases: streakStats.freeImpulsePurchases,
        activeVouchers: streakStats.activeVouchers.length
      }
    });
  } catch (err) {
    res.status(500).json({ 
      success: false,
      message: err.message 
    });
  }
});

export default router;