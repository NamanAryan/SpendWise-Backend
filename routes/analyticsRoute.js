import express from 'express';
import protect from '../middleware/auth.middleware.js';
import Expense from '../models/transaction.model.js';
import Streak from '../models/streak.model.js';
import analyticsService from '../services/analyticsService.js';

const router = express.Router();

// Get comprehensive spending analysis
router.get('/spending-insights', protect, async (req, res) => {
  try {
    const userId = req.user._id.toString();
    
    const insights = await analyticsService.getSpendingInsights(userId);
    
    res.json({
      success: true,
      ...insights
    });
  } catch (err) {
    console.error('Analytics error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to generate spending insights',
      error: err.message
    });
  }
});

// Get personalized recommendations
router.get('/recommendations', protect, async (req, res) => {
  try {
    const userId = req.user._id.toString();
    
    const recommendations = await analyticsService.getPersonalizedRecommendations(userId);
    
    res.json({
      success: true,
      recommendations
    });
  } catch (err) {
    console.error('Recommendations error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to generate recommendations',
      error: err.message
    });
  }
});

// Get streak calendar data for visualization
router.get('/streak-calendar', protect, async (req, res) => {
  try {
    const userId = req.user._id.toString();
    
    // Get all expenses
    const expenses = await Expense.find({ 
      User_ID: userId 
    }).sort({ Date: 1 });
    
    if (expenses.length === 0) {
      return res.json({
        success: true,
        calendarData: []
      });
    }
    
    // Group expenses by date
    const expensesByDate = {};
    
    expenses.forEach(expense => {
      const dateStr = new Date(expense.Date).toISOString().split('T')[0];
      
      if (!expensesByDate[dateStr]) {
        expensesByDate[dateStr] = {
          date: dateStr,
          impulseCount: 0,
          nonImpulseCount: 0,
          totalAmount: 0,
          hasImpulse: false
        };
      }
      
      if (expense.Impulse_Tag) {
        expensesByDate[dateStr].impulseCount += 1;
        expensesByDate[dateStr].hasImpulse = true;
      } else {
        expensesByDate[dateStr].nonImpulseCount += 1;
      }
      
      expensesByDate[dateStr].totalAmount += expense.Amount;
    });
    
    // Convert to array format
    const datesArray = Object.values(expensesByDate);
    
    // Calculate streak status for each date
    const streak = await Streak.findOne({ User_ID: userId });
    
    if (streak && datesArray.length > 0) {
      // Sort dates to ensure chronological order
      datesArray.sort((a, b) => new Date(a.date) - new Date(b.date));
      
      let currentStreak = 0;
      
      // Process each date to calculate streak
      for (let i = 0; i < datesArray.length; i++) {
        const current = datesArray[i];
        const prev = i > 0 ? datesArray[i - 1] : null;
        
        // Reset streak on impulse purchase
        if (current.hasImpulse) {
          currentStreak = 0;
          current.streakDay = 0;
          continue;
        }
        
        // If this is first day or previous day broke streak
        if (!prev || prev.streakDay === 0) {
          currentStreak = 1;
        }
        // If this is a consecutive day (check date difference)
        else if (isConsecutiveDay(prev.date, current.date)) {
          currentStreak += 1;
        }
        // If more than one day gap, reset streak
        else {
          currentStreak = 1; // Start a new streak
        }
        
        current.streakDay = currentStreak;
        
        // Add streak milestone information
        if (currentStreak % 7 === 0) {
          current.milestone = true;
          current.milestoneType = 'weekly';
        }
        
        // Check if this was when a free impulse purchase was earned
        if (currentStreak === 21) { // After 3 consecutive 7-day streaks
          current.milestone = true;
          current.milestoneType = 'freeImpulse';
        }
      }
    }
    
    res.json({
      success: true,
      calendarData: datesArray
    });
  } catch (err) {
    console.error('Streak calendar error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to generate streak calendar data',
      error: err.message
    });
  }
});

// Get comparison of spending habits during streak vs. non-streak periods
router.get('/streak-impact', protect, async (req, res) => {
  try {
    const userId = req.user._id.toString();
    
    // Get all expenses
    const expenses = await Expense.find({ User_ID: userId });
    
    if (expenses.length === 0) {
      return res.json({
        success: true,
        impact: {
          streakDays: 0,
          nonStreakDays: 0,
          avgDailyStreakSpending: 0,
          avgDailyNonStreakSpending: 0,
          savingsPercentage: 0,
          projectedAnnualSavings: 0
        }
      });
    }
    
    // Group expenses by date
    const expensesByDate = {};
    
    expenses.forEach(expense => {
      const dateStr = new Date(expense.Date).toISOString().split('T')[0];
      
      if (!expensesByDate[dateStr]) {
        expensesByDate[dateStr] = {
          date: dateStr,
          hasImpulse: false,
          totalAmount: 0
        };
      }
      
      if (expense.Impulse_Tag) {
        expensesByDate[dateStr].hasImpulse = true;
      }
      
      expensesByDate[dateStr].totalAmount += expense.Amount;
    });
    
    // Convert to array and sort chronologically
    const datesArray = Object.values(expensesByDate)
      .sort((a, b) => new Date(a.date) - new Date(b.date));
    
    // Calculate streak status for each date
    let streakDays = 0;
    let nonStreakDays = 0;
    let streakSpending = 0;
    let nonStreakSpending = 0;
    
    if (datesArray.length > 0) {
      let currentStreak = 0;
      
      // Process each date to calculate streak and accumulate spending
      for (let i = 0; i < datesArray.length; i++) {
        const current = datesArray[i];
        const prev = i > 0 ? datesArray[i - 1] : null;
        
        // Reset streak on impulse purchase
        if (current.hasImpulse) {
          currentStreak = 0;
          nonStreakDays += 1;
          nonStreakSpending += current.totalAmount;
          continue;
        }
        
        // Handle streak calculation
        if (!prev || prev.hasImpulse) {
          currentStreak = 1;
        } else if (isConsecutiveDay(prev.date, current.date)) {
          currentStreak += 1;
        } else {
          currentStreak = 1;
        }
        
        // Consider 3+ days as a significant streak
        if (currentStreak >= 3) {
          streakDays += 1;
          streakSpending += current.totalAmount;
        } else {
          nonStreakDays += 1;
          nonStreakSpending += current.totalAmount;
        }
      }
    }
    
    // Calculate averages and impact
    const avgDailyStreakSpending = streakDays > 0 ? streakSpending / streakDays : 0;
    const avgDailyNonStreakSpending = nonStreakDays > 0 ? nonStreakSpending / nonStreakDays : 0;
    
    let savingsPercentage = 0;
    if (avgDailyNonStreakSpending > 0 && avgDailyStreakSpending > 0) {
      savingsPercentage = ((avgDailyNonStreakSpending - avgDailyStreakSpending) / avgDailyNonStreakSpending * 100).toFixed(1);
    }
    
    // Project annual savings if all days were streak days
    const dailySavings = avgDailyNonStreakSpending - avgDailyStreakSpending;
    const projectedAnnualSavings = dailySavings > 0 ? dailySavings * 365 : 0;
    
    res.json({
      success: true,
      impact: {
        streakDays,
        nonStreakDays,
        avgDailyStreakSpending: avgDailyStreakSpending.toFixed(2),
        avgDailyNonStreakSpending: avgDailyNonStreakSpending.toFixed(2),
        savingsPercentage,
        projectedAnnualSavings: projectedAnnualSavings.toFixed(2)
      }
    });
  } catch (err) {
    console.error('Streak impact error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to calculate streak impact',
      error: err.message
    });
  }
});

// Get reward statistics
router.get('/rewards-stats', protect, async (req, res) => {
  try {
    const userId = req.user._id.toString();
    
    const streak = await Streak.findOne({ User_ID: userId });
    
    if (!streak) {
      return res.json({
        success: true,
        stats: {
          totalVouchersEarned: 0,
          totalVouchersUsed: 0,
          totalFreeImpulsesEarned: 0,
          totalFreeImpulsesUsed: 0,
          currentFreeImpulses: 0,
          currentVouchers: 0,
          voucherUsageRate: 0
        }
      });
    }
    
    // Count free impulse purchases used
    const freeImpulsesUsed = await Expense.countDocuments({
      User_ID: userId,
      free_impulse_purchase: true
    });
    
    // Calculate voucher statistics
    const totalVouchersEarned = streak.vouchersEarned.length;
    const totalVouchersUsed = streak.vouchersEarned.filter(v => v.used).length;
    const currentVouchers = streak.vouchersEarned.filter(v => !v.used && new Date() <= new Date(v.expiresAt)).length;
    
    // Calculate free impulse statistics
    const totalFreeImpulsesEarned = Math.floor(streak.completedStreaks / 3);
    
    // Calculate usage rates
    const voucherUsageRate = totalVouchersEarned > 0 
      ? (totalVouchersUsed / totalVouchersEarned * 100).toFixed(1) 
      : 0;
    
    const freeImpulseUsageRate = totalFreeImpulsesEarned > 0 
      ? (freeImpulsesUsed / totalFreeImpulsesEarned * 100).toFixed(1) 
      : 0;
    
    res.json({
      success: true,
      stats: {
        totalVouchersEarned,
        totalVouchersUsed,
        unusedVouchers: totalVouchersEarned - totalVouchersUsed,
        totalFreeImpulsesEarned,
        totalFreeImpulsesUsed: freeImpulsesUsed,
        currentFreeImpulses: streak.freeImpulsePurchases,
        voucherUsageRate,
        freeImpulseUsageRate
      }
    });
  } catch (err) {
    console.error('Rewards stats error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to get reward statistics',
      error: err.message
    });
  }
});

// Helper function to check if two dates are consecutive
function isConsecutiveDay(date1, date2) {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  
  // Reset hours to compare just the dates
  d1.setHours(0, 0, 0, 0);
  d2.setHours(0, 0, 0, 0);
  
  // Calculate the difference in days
  const diffTime = Math.abs(d2 - d1);
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays === 1;
}

export default router;