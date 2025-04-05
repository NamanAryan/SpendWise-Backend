import Streak from '../models/streak.model.js';

const STREAK_TARGET = 7; // 7-day streak for a voucher
const STREAKS_FOR_FREE_IMPULSE = 3; // 3 completed streaks for a free impulse purchase

// Check if two dates are consecutive days
const isConsecutiveDay = (date1, date2) => {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  
  // Reset hours to compare just the dates
  d1.setHours(0, 0, 0, 0);
  d2.setHours(0, 0, 0, 0);
  
  // Calculate the difference in days
  const diffTime = Math.abs(d2 - d1);
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays === 1;
};

// Update streak based on a new non-impulse purchase
export const updateStreak = async (userId, transactionDate) => {
  try {
    let streak = await Streak.findOne({ User_ID: userId });
    
    if (!streak) {
      // Create a new streak record if one doesn't exist
      streak = new Streak({
        User_ID: userId,
        currentStreak: 1,
        longestStreak: 1,
        lastNonImpulseDate: transactionDate
      });
      await streak.save();
      return { streak, rewardEarned: null };
    }
    
    const now = new Date(transactionDate);
    let { currentStreak, longestStreak, lastNonImpulseDate, completedStreaks } = streak;
    let rewardEarned = null;
    
    // If this is the first purchase or the streak was reset
    if (!lastNonImpulseDate) {
      currentStreak = 1;
      lastNonImpulseDate = now;
    } 
    // If this purchase is on a consecutive day, increment the streak
    else if (isConsecutiveDay(lastNonImpulseDate, now)) {
      currentStreak += 1;
      lastNonImpulseDate = now;
      
      // Update longest streak if current is now longer
      if (currentStreak > longestStreak) {
        longestStreak = currentStreak;
      }
      
      // Check if user completed a 7-day streak
      if (currentStreak === STREAK_TARGET) {
        // Create a voucher that expires in 30 days
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 30);
        
        // Add voucher to the user's earned vouchers
        streak.vouchersEarned.push({
          voucherType: 'weekly',
          earnedAt: now,
          used: false,
          expiresAt
        });
        
        completedStreaks += 1;
        rewardEarned = 'weekly';
        
        // Reset the streak counter after reaching the target
        currentStreak = 0;
        
        // Check if user has completed 3 streaks to earn a free impulse purchase
        if (completedStreaks % STREAKS_FOR_FREE_IMPULSE === 0) {
          streak.freeImpulsePurchases += 1;
          rewardEarned = 'freeImpulsePurchase';
        }
      }
    } 
    // If the purchase is on the same day as the last one, just update the date
    else if (new Date(lastNonImpulseDate).toDateString() === now.toDateString()) {
      lastNonImpulseDate = now;
    } 
    // If the streak is broken (not a consecutive day and not the same day)
    else {
      currentStreak = 1;
      lastNonImpulseDate = now;
    }
    
    // Update the streak object
    streak.currentStreak = currentStreak;
    streak.longestStreak = longestStreak;
    streak.lastNonImpulseDate = lastNonImpulseDate;
    streak.completedStreaks = completedStreaks;
    streak.updated_at = now;
    
    await streak.save();
    
    return { streak, rewardEarned };
  } catch (error) {
    console.error('Error updating streak:', error);
    throw error;
  }
};

// Reset streak or handle streak breaks
export const handleImpulsePurchase = async (userId, transactionDate, useFreeImpulse = false) => {
  try {
    let streak = await Streak.findOne({ User_ID: userId });
    
    if (!streak) {
      streak = new Streak({
        User_ID: userId,
        currentStreak: 0,
        longestStreak: 0,
        lastNonImpulseDate: null
      });
      await streak.save();
      return { streak, usedFreeImpulse: false };
    }
    
    // If the user wants to use a free impulse purchase
    if (useFreeImpulse && streak.freeImpulsePurchases > 0) {
      streak.freeImpulsePurchases -= 1;
      await streak.save();
      return { streak, usedFreeImpulse: true };
    }
    
    // Otherwise, reset the streak
    streak.currentStreak = 0;
    streak.lastNonImpulseDate = null;
    streak.streakResetDate = transactionDate;
    streak.updated_at = new Date();
    
    await streak.save();
    
    return { streak, usedFreeImpulse: false };
  } catch (error) {
    console.error('Error handling impulse purchase:', error);
    throw error;
  }
};

// Get all stats for a user
export const getStreakStats = async (userId) => {
  try {
    const streak = await Streak.findOne({ User_ID: userId });
    
    if (!streak) {
      return {
        currentStreak: 0,
        longestStreak: 0,
        completedStreaks: 0,
        freeImpulsePurchases: 0,
        activeVouchers: [],
        usedVouchers: []
      };
    }
    
    // Get active (unused and not expired) vouchers
    const now = new Date();
    const activeVouchers = streak.vouchersEarned.filter(
      v => !v.used && v.expiresAt > now
    );
    
    // Get used vouchers
    const usedVouchers = streak.vouchersEarned.filter(v => v.used);
    
    return {
      currentStreak: streak.currentStreak,
      longestStreak: streak.longestStreak,
      completedStreaks: streak.completedStreaks,
      freeImpulsePurchases: streak.freeImpulsePurchases,
      activeVouchers,
      usedVouchers
    };
  } catch (error) {
    console.error('Error getting streak stats:', error);
    throw error;
  }
};

export default {
  updateStreak,
  handleImpulsePurchase,
  getStreakStats
};