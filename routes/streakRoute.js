import express from 'express';
import Streak from '../models/streak.model.js';
import protect from '../middleware/auth.middleware.js';

const router = express.Router();

// Get streak info for the logged-in user
router.get('/mystreak', protect, async (req, res) => {
  try {
    const userId = req.user._id;
    
    let streak = await Streak.findOne({ User_ID: userId });
    
    if (!streak) {
      // Initialize streak for new users
      streak = await Streak.create({
        User_ID: userId,
        currentStreak: 0,
        longestStreak: 0,
        completedStreaks: 0,
        freeImpulsePurchases: 0
      });
    }
    
    res.status(200).json({
      success: true,
      streak
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch streak information',
      error: err.message
    });
  }
});

// Use a voucher
router.post('/use-voucher/:voucherId', protect, async (req, res) => {
  try {
    const userId = req.user._id;
    const { voucherId } = req.params;
    
    const streak = await Streak.findOne({ User_ID: userId });
    
    if (!streak) {
      return res.status(404).json({
        success: false,
        message: 'Streak record not found'
      });
    }
    
    // Find the voucher in the user's list
    const voucherIndex = streak.vouchersEarned.findIndex(
      voucher => voucher._id.toString() === voucherId
    );
    
    if (voucherIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Voucher not found'
      });
    }
    
    if (streak.vouchersEarned[voucherIndex].used) {
      return res.status(400).json({
        success: false,
        message: 'Voucher has already been used'
      });
    }
    
    if (new Date() > streak.vouchersEarned[voucherIndex].expiresAt) {
      return res.status(400).json({
        success: false,
        message: 'Voucher has expired'
      });
    }
    
    // Mark voucher as used
    streak.vouchersEarned[voucherIndex].used = true;
    await streak.save();
    
    res.status(200).json({
      success: true,
      message: 'Voucher used successfully',
      voucher: streak.vouchersEarned[voucherIndex]
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Failed to use voucher',
      error: err.message
    });
  }
});

// Use a free impulse purchase
router.post('/use-free-impulse', protect, async (req, res) => {
  try {
    const userId = req.user._id;
    
    const streak = await Streak.findOne({ User_ID: userId });
    
    if (!streak) {
      return res.status(404).json({
        success: false,
        message: 'Streak record not found'
      });
    }
    
    if (streak.freeImpulsePurchases <= 0) {
      return res.status(400).json({
        success: false,
        message: 'No free impulse purchases available'
      });
    }
    
    // Decrement free impulse purchases count
    streak.freeImpulsePurchases -= 1;
    await streak.save();
    
    res.status(200).json({
      success: true,
      message: 'Free impulse purchase used successfully',
      freeImpulsePurchasesRemaining: streak.freeImpulsePurchases
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Failed to use free impulse purchase',
      error: err.message
    });
  }
});

export default router;