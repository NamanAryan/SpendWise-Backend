// server/routes/challenges.js
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Challenge = require('../models/Challenge');
const UserChallenge = require('../models/UserChallenge');

// Get all challenges for the current user
router.get('/api/challenges', auth, async (req, res) => {
  try {
    // Find user's active challenges
    const userChallenges = await UserChallenge.find({ 
      userId: req.user.id,
      isActive: true
    }).populate('challengeId');

    // Format response
    const challenges = userChallenges.map(uc => {
      const challenge = uc.challengeId;
      return {
        id: challenge._id,
        title: challenge.title,
        description: challenge.description,
        points: challenge.points,
        progress: uc.progress,
        status: uc.progress === 100 ? 'completed' : 'active',
        startDate: uc.startDate,
        endDate: uc.endDate || challenge.endDate
      };
    });

    res.json(challenges);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// Join a challenge
router.post('/api/challenges/:id/join', auth, async (req, res) => {
  try {
    const challenge = await Challenge.findById(req.params.id);
    
    if (!challenge) {
      return res.status(404).json({ msg: 'Challenge not found' });
    }
    
    // Check if user already joined this challenge
    const existingUserChallenge = await UserChallenge.findOne({
      userId: req.user.id,
      challengeId: challenge._id
    });
    
    if (existingUserChallenge) {
      return res.status(400).json({ msg: 'Already joined this challenge' });
    }
    
    // Create new user-challenge relationship
    const userChallenge = new UserChallenge({
      userId: req.user.id,
      challengeId: challenge._id,
      progress: 0,
      isActive: true,
      startDate: new Date()
    });
    
    await userChallenge.save();
    
    res.json({ 
      msg: 'Successfully joined challenge',
      challenge: {
        id: challenge._id,
        title: challenge.title,
        points: challenge.points,
        progress: 0,
        status: 'active'
      }
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// Update challenge progress
router.put('/api/challenges/:id/progress', auth, async (req, res) => {
  try {
    const { progress } = req.body;
    
    if (progress < 0 || progress > 100) {
      return res.status(400).json({ msg: 'Progress must be between 0 and 100' });
    }
    
    const userChallenge = await UserChallenge.findOne({
      userId: req.user.id,
      challengeId: req.params.id,
      isActive: true
    }).populate('challengeId');
    
    if (!userChallenge) {
      return res.status(404).json({ msg: 'Challenge not found or not active' });
    }
    
    userChallenge.progress = progress;
    
    // Check if challenge is completed
    if (progress === 100) {
      userChallenge.completedDate = new Date();
      
      // Add points to user's account
      const user = await User.findById(req.user.id);
      user.points += userChallenge.challengeId.points;
      await user.save();
    }
    
    await userChallenge.save();
    
    res.json({
      id: userChallenge.challengeId._id,
      title: userChallenge.challengeId.title,
      points: userChallenge.challengeId.points,
      progress: userChallenge.progress,
      status: userChallenge.progress === 100 ? 'completed' : 'active'
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

module.exports = router;