import express from 'express';
import Expense from '../models/transaction.model.js';
import Streak from '../models/streak.model.js';
import protect from '../middleware/auth.middleware.js';
import streakService from '../services/streakService.js';

const router = express.Router();

// Get dashboard data with financial stats, streak info, and rewards
router.get('/', protect, async (req, res) => {
  try {
    const userId = req.user._id.toString();
    
    // Get streak information
    const streakStats = await streakService.getStreakStats(userId);
    
    // Calculate financial statistics
    // 1. Get total number of transactions (impulse and non-impulse)
    const totalExpenses = await Expense.countDocuments({ User_ID: userId });
    const impulseExpenses = await Expense.countDocuments({ 
      User_ID: userId, 
      Impulse_Tag: true 
    });
    
    // 2. Calculate spending totals
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
    
    // 3. Get recent transactions
    const recentTransactions = await Expense.find({ User_ID: userId })
      .sort({ Date: -1 })
      .limit(5);
    
    // 4. Get category-wise expense breakdown
    const categoryBreakdown = await Expense.aggregate([
      { $match: { User_ID: userId } },
      { $group: { 
          _id: "$Category", 
          total: { $sum: "$Amount" },
          count: { $sum: 1 }
        } 
      },
      { $sort: { total: -1 } }
    ]);
    
    // 5. Calculate monthly spending trend
    const now = new Date();
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(now.getMonth() - 6);
    
    const monthlySpending = await Expense.aggregate([
      { 
        $match: { 
          User_ID: userId,
          Date: { $gte: sixMonthsAgo } 
        } 
      },
      {
        $group: {
          _id: { 
            year: { $year: "$Date" },
            month: { $month: "$Date" }
          },
          totalSpent: { $sum: "$Amount" },
          impulseSpent: { 
            $sum: { 
              $cond: [{ $eq: ["$Impulse_Tag", true] }, "$Amount", 0] 
            } 
          },
          nonImpulseSpent: { 
            $sum: { 
              $cond: [{ $eq: ["$Impulse_Tag", false] }, "$Amount", 0] 
            } 
          }
        }
      },
      { 
        $sort: { 
          "_id.year": 1, 
          "_id.month": 1 
        } 
      }
    ]);
    
    // Format monthly data for easier consumption by frontend
    const monthlyTrends = monthlySpending.map(item => {
      const monthDate = new Date(item._id.year, item._id.month - 1, 1);
      return {
        month: monthDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        totalSpent: item.totalSpent,
        impulseSpent: item.impulseSpent,
        nonImpulseSpent: item.nonImpulseSpent,
        impulsePct: (item.impulseSpent / item.totalSpent * 100).toFixed(1)
      };
    });
    
    // Calculate streak achievement metrics
    const streakAchievements = {
      currentStreakEmoji: getStreakEmoji(streakStats.currentStreak),
      streakProgress: `${streakStats.currentStreak}/7`,
      streakProgressPercent: Math.min((streakStats.currentStreak / 7) * 100, 100),
      nextMilestone: 7 - (streakStats.currentStreak % 7),
      completedStreaks: streakStats.completedStreaks,
      freeImpulsePurchases: streakStats.freeImpulsePurchases,
      activeVouchers: streakStats.activeVouchers.length,
      // Show progress toward next free impulse purchase
      freeImpulseProgress: `${streakStats.completedStreaks % 3}/3`,
      freeImpulseProgressPercent: ((streakStats.completedStreaks % 3) / 3) * 100
    };
    
    res.json({
      success: true,
      financialStats: {
        totalExpenses,
        impulseExpenses,
        nonImpulseExpenses: totalExpenses - impulseExpenses,
        totalAmount,
        impulseAmount,
        nonImpulseAmount: totalAmount - impulseAmount,
        impulsePercentage: totalExpenses > 0 
          ? (impulseExpenses / totalExpenses * 100).toFixed(1)
          : 0,
        savedAmount: totalAmount > 0
          ? (impulseAmount / totalAmount * 100).toFixed(1)
          : 0,
        categoryBreakdown
      },
      streakInfo: {
        ...streakAchievements,
        longestStreak: streakStats.longestStreak
      },
      recentTransactions,
      monthlyTrends,
      rewards: {
        activeVouchers: streakStats.activeVouchers,
        freeImpulsePurchases: streakStats.freeImpulsePurchases
      }
    });
  } catch (err) {
    console.error('Dashboard error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to load dashboard data',
      error: err.message
    });
  }
});

// Get detailed streak analytics
router.get('/streak-analytics', protect, async (req, res) => {
  try {
    const userId = req.user._id.toString();
    
    // Get streak information
    const streak = await Streak.findOne({ User_ID: userId });
    
    if (!streak) {
      return res.json({
        success: true,
        analytics: {
          streakHistory: [],
          voucherHistory: [],
          totalCompletedStreaks: 0,
          totalVouchersEarned: 0,
          totalVouchersUsed: 0,
          totalFreeImpulsePurchasesEarned: 0,
          totalFreeImpulsePurchasesUsed: 0
        }
      });
    }
    
    // Get history of transactions to analyze streak patterns
    const expenses = await Expense.find({ 
      User_ID: userId 
    }).sort({ Date: 1 });
    
    // Calculate days with non-impulse purchases
    const nonImpulseDays = expenses
      .filter(expense => !expense.Impulse_Tag)
      .map(expense => new Date(expense.Date).toISOString().split('T')[0]);
    
    // Get unique days (remove duplicates)
    const uniqueNonImpulseDays = [...new Set(nonImpulseDays)];
    
    // Calculate impulse purchase days
    const impulseDays = expenses
      .filter(expense => expense.Impulse_Tag)
      .map(expense => new Date(expense.Date).toISOString().split('T')[0]);
    
    // Get unique impulse days
    const uniqueImpulseDays = [...new Set(impulseDays)];
    
    // Count free impulse purchases used
    const freeImpulsesUsed = await Expense.countDocuments({
      User_ID: userId,
      free_impulse_purchase: true
    });
    
    // Calculate total vouchers used vs earned
    const totalVouchersEarned = streak.vouchersEarned.length;
    const totalVouchersUsed = streak.vouchersEarned.filter(v => v.used).length;
    
    res.json({
      success: true,
      analytics: {
        streakSummary: {
          currentStreak: streak.currentStreak,
          longestStreak: streak.longestStreak,
          completedStreaks: streak.completedStreaks,
          totalNonImpulseDays: uniqueNonImpulseDays.length,
          totalImpulseDays: uniqueImpulseDays.length,
          nonImpulsePercentage: expenses.length > 0 
            ? (uniqueNonImpulseDays.length / (uniqueNonImpulseDays.length + uniqueImpulseDays.length) * 100).toFixed(1)
            : 0
        },
        rewardsSummary: {
          totalVouchersEarned,
          totalVouchersUsed,
          unusedVouchers: totalVouchersEarned - totalVouchersUsed,
          totalFreeImpulsePurchasesEarned: Math.floor(streak.completedStreaks / 3),
          totalFreeImpulsePurchasesUsed: freeImpulsesUsed,
          currentFreeImpulsePurchases: streak.freeImpulsePurchases
        },
        voucherHistory: streak.vouchersEarned.map(v => ({
          id: v._id,
          type: v.voucherType,
          earnedAt: v.earnedAt,
          expiresAt: v.expiresAt,
          used: v.used,
          status: v.used 
            ? 'Used' 
            : new Date() > v.expiresAt 
              ? 'Expired' 
              : 'Active'
        }))
      }
    });
  } catch (err) {
    console.error('Streak analytics error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to load streak analytics',
      error: err.message
    });
  }
});

// Helper function to get emoji based on streak length
function getStreakEmoji(streakCount) {
  if (streakCount === 0) return '😶';
  if (streakCount < 3) return '🙂';
  if (streakCount < 5) return '😊';
  if (streakCount < 7) return '🔥';
  return '🏆';
}

export default router;