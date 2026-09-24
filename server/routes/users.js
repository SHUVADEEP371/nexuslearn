const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const auth = require('../middleware/auth');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'profile-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'));
    }
  }
});

// Admin: Get all users (for skill moderation)
router.get('/all', auth, requireAdmin, async (req, res) => {
  try {
    const users = await User.find({})
      .select('-password')
      .sort({ createdAt: -1 });

    res.json(users);
  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all public users (for browsing)
router.get('/browse', async (req, res) => {
  try {
    const { skill, location, availability } = req.query;
    let query = { isPublic: true };

    // Filter by skill
    if (skill) {
      query.$or = [
        { 'skillsOffered.name': { $regex: skill, $options: 'i' } },
        { 'skillsWanted.name': { $regex: skill, $options: 'i' } }
      ];
    }

    // Filter by location
    if (location) {
      query.location = { $regex: location, $options: 'i' };
    }

    // Filter by availability
    if (availability) {
      const availabilityFilters = availability.split(',');
      const availabilityQuery = {};
      availabilityFilters.forEach(avail => {
        availabilityQuery[`availability.${avail}`] = true;
      });
      query = { ...query, ...availabilityQuery };
    }

    const users = await User.find(query)
      .select('-password -email')
      .sort({ createdAt: -1 })
      .populate('ratings.reviewer', 'name profilePhoto');

    // Map users to include ratingAverage, ratingCount, and recentReviews
    const usersWithRatings = users.map(user => {
      const recentReviews = (user.ratings || [])
        .slice(-3)
        .reverse()
        .map(r => ({
          reviewer: r.reviewer ? { _id: r.reviewer._id, name: r.reviewer.name, profilePhoto: r.reviewer.profilePhoto } : null,
          rating: r.rating,
          comment: r.comment,
          date: r.date
        }));
      return {
        ...user.toObject(),
        ratingAverage: user.ratingAverage,
        ratingCount: user.ratingCount,
        swapsCompleted: user.swapsCompleted,
        recentReviews
      };
    });

    res.json(usersWithRatings);
  } catch (error) {
    console.error('Browse users error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Search users by skill
router.get('/search', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) {
      return res.status(400).json({ message: 'Search query is required' });
    }
    const users = await User.find({
      isPublic: true,
      $or: [
        { 'skillsOffered.name': { $regex: q, $options: 'i' } },
        { 'skillsWanted.name': { $regex: q, $options: 'i' } },
        { name: { $regex: q, $options: 'i' } }
      ]
    })
      .select('-password -email')
      .sort({ createdAt: -1 });
    res.json(users);
  } catch (error) {
    console.error('Search users error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get user profile by ID (with ObjectId validation)
router.get('/:id', async (req, res) => {
  try {
    const id = req.params.id;
    // Validate ObjectId
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ message: 'Invalid user ID' });
    }
    const user = await User.findById(id).select('-password -email').populate('ratings.reviewer', 'name profilePhoto');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    if (!user.isPublic) {
      return res.status(403).json({ message: 'Profile is private' });
    }
    // Add ratingAverage, ratingCount, and recentReviews
    const recentReviews = (user.ratings || [])
      .slice(-3)
      .reverse()
      .map(r => ({
        reviewer: r.reviewer ? { _id: r.reviewer._id, name: r.reviewer.name, profilePhoto: r.reviewer.profilePhoto } : null,
        rating: r.rating,
        comment: r.comment,
        date: r.date
      }));
    res.json({
      ...user.toObject(),
      ratingAverage: user.ratingAverage,
      ratingCount: user.ratingCount,
      swapsCompleted: user.swapsCompleted,
      recentReviews
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all reviews for a user
router.get('/:id/reviews', async (req, res) => {
  try {
    const id = req.params.id;
    const { page = 1, limit = 10, sort = 'date' } = req.query;
    
    // Validate ObjectId
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ message: 'Invalid user ID' });
    }
    
    const user = await User.findById(id).select('ratings').populate('ratings.reviewer', 'name profilePhoto');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Sort reviews
    let sortedReviews = [...(user.ratings || [])];
    if (sort === 'date') {
      sortedReviews.sort((a, b) => new Date(b.date) - new Date(a.date));
    } else if (sort === 'rating') {
      sortedReviews.sort((a, b) => b.rating - a.rating);
    }
    
    // Paginate
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const startIndex = (pageNum - 1) * limitNum;
    const endIndex = pageNum * limitNum;
    const paginatedReviews = sortedReviews.slice(startIndex, endIndex);
    
    // Map reviews to include reviewer info
    const reviewsWithReviewer = paginatedReviews.map(r => ({
      reviewer: r.reviewer ? { _id: r.reviewer._id, name: r.reviewer.name, profilePhoto: r.reviewer.profilePhoto } : null,
      rating: r.rating,
      comment: r.comment,
      date: r.date
    }));
    
    res.json({
      reviews: reviewsWithReviewer,
      pagination: {
        currentPage: pageNum,
        totalPages: Math.ceil(sortedReviews.length / limitNum),
        totalReviews: sortedReviews.length,
        hasNextPage: endIndex < sortedReviews.length,
        hasPrevPage: pageNum > 1
      }
    });
  } catch (error) {
    console.error('Get user reviews error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update user profile
router.put('/profile', auth, [
  body('name').optional().trim().isLength({ min: 2 }),
  body('location').optional().trim(),
  body('bio').optional().trim().isLength({ max: 500 }),
  body('isPublic').optional().isBoolean()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, location, bio, isPublic, availability } = req.body;
    const updateData = {};

    if (name) updateData.name = name;
    if (location !== undefined) updateData.location = location;
    if (bio !== undefined) updateData.bio = bio;
    if (isPublic !== undefined) updateData.isPublic = isPublic;
    if (availability) updateData.availability = availability;

    const user = await User.findByIdAndUpdate(
      req.user._id,
      updateData,
      { new: true, runValidators: true }
    ).select('-password');

    res.json(user);
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Upload profile photo
router.post('/profile-photo', auth, upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const photoUrl = `/uploads/${req.file.filename}`;
    
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { profilePhoto: photoUrl },
      { new: true }
    ).select('-password');

    res.json({ user, photoUrl });
  } catch (error) {
    console.error('Upload photo error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Add skill offered
router.post('/skills-offered', auth, [
  body('name').trim().notEmpty().withMessage('Skill name is required'),
  body('description').optional().trim(),
  body('proficiency').optional().isIn(['Beginner', 'Intermediate', 'Advanced', 'Expert'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, description, proficiency } = req.body;
    const user = await User.findById(req.user._id);
    const skillExists = user.skillsOffered.some(skill => 
      skill.name.trim().toLowerCase() === name.trim().toLowerCase()
    );
    if (skillExists) {
      return res.status(400).json({ message: 'Skill already exists' });
    }
    user.skillsOffered.push({ name, description, proficiency });
    await user.save();
    res.json(user.skillsOffered);
  } catch (error) {
    console.error('Add skill offered error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Add skill wanted
router.post('/skills-wanted', auth, [
  body('name').trim().notEmpty().withMessage('Skill name is required'),
  body('description').optional().trim(),
  body('priority').optional().isIn(['Low', 'Medium', 'High'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, description, priority } = req.body;
    const user = await User.findById(req.user._id);
    const skillExists = user.skillsWanted.some(skill => 
      skill.name.trim().toLowerCase() === name.trim().toLowerCase()
    );
    if (skillExists) {
      return res.status(400).json({ message: 'Skill already exists' });
    }
    user.skillsWanted.push({ name, description, priority });
    await user.save();
    res.json(user.skillsWanted);
  } catch (error) {
    console.error('Add skill wanted error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Remove skill offered
router.delete('/skills-offered/:skillId', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    user.skillsOffered = user.skillsOffered.filter(
      skill => skill._id.toString() !== req.params.skillId
    );
    await user.save();

    res.json(user.skillsOffered);
  } catch (error) {
    console.error('Remove skill offered error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Remove skill wanted
router.delete('/skills-wanted/:skillId', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    user.skillsWanted = user.skillsWanted.filter(
      skill => skill._id.toString() !== req.params.skillId
    );
    await user.save();

    res.json(user.skillsWanted);
  } catch (error) {
    console.error('Remove skill wanted error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Admin: Get flagged reviews
router.get('/admin/flagged-reviews', auth, requireAdmin, async (req, res) => {
  try {
    const users = await User.find({ 'ratings.flagged': true })
      .select('name ratings')
      .populate('ratings.reviewer', 'name email')
      .populate('ratings.flaggedBy', 'name');

    const flaggedReviews = [];
    users.forEach(user => {
      user.ratings.forEach(review => {
        if (review.flagged) {
          flaggedReviews.push({
            id: review._id,
            userId: user._id,
            userName: user.name,
            reviewer: review.reviewer,
            rating: review.rating,
            comment: review.comment,
            date: review.date,
            flaggedBy: review.flaggedBy,
            flaggedReason: review.flaggedReason,
            flaggedDate: review.flaggedDate
          });
        }
      });
    });

    res.json(flaggedReviews);
  } catch (error) {
    console.error('Get flagged reviews error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Flag a review as inappropriate
router.post('/:userId/reviews/:reviewId/flag', auth, [
  body('reason').trim().notEmpty().withMessage('Flag reason is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { userId, reviewId } = req.params;
    const { reason } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const review = user.ratings.id(reviewId);
    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }

    // Check if already flagged
    if (review.flagged) {
      return res.status(400).json({ message: 'Review already flagged' });
    }

    // Flag the review
    review.flagged = true;
    review.flaggedBy = req.user._id;
    review.flaggedReason = reason;
    review.flaggedDate = new Date();

    await user.save();
    res.json({ message: 'Review flagged successfully' });
  } catch (error) {
    console.error('Flag review error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Admin: Delete a flagged review
router.delete('/:userId/reviews/:reviewId', auth, requireAdmin, async (req, res) => {
  try {
    const { userId, reviewId } = req.params;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const reviewIndex = user.ratings.findIndex(r => r._id.toString() === reviewId);
    if (reviewIndex === -1) {
      return res.status(404).json({ message: 'Review not found' });
    }

    // Remove the review
    user.ratings.splice(reviewIndex, 1);
    await user.save();

    res.json({ message: 'Review deleted successfully' });
  } catch (error) {
    console.error('Delete review error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Admin: Unflag a review
router.put('/:userId/reviews/:reviewId/unflag', auth, requireAdmin, async (req, res) => {
  try {
    const { userId, reviewId } = req.params;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const review = user.ratings.id(reviewId);
    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }

    // Unflag the review
    review.flagged = false;
    review.flaggedBy = undefined;
    review.flaggedReason = undefined;
    review.flaggedDate = undefined;

    await user.save();
    res.json({ message: 'Review unflagged successfully' });
  } catch (error) {
    console.error('Unflag review error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get rating analytics for a user
router.get('/:id/rating-analytics', async (req, res) => {
  try {
    const id = req.params.id;
    
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ message: 'Invalid user ID' });
    }
    
    const user = await User.findById(id).select('ratings');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const ratings = user.ratings || [];
    
    // Rating distribution
    const distribution = {
      1: 0, 2: 0, 3: 0, 4: 0, 5: 0
    };
    
    // Monthly trends (last 12 months)
    const monthlyTrends = {};
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthKey = date.toISOString().slice(0, 7); // YYYY-MM
      monthlyTrends[monthKey] = { count: 0, average: 0, total: 0 };
    }

    ratings.forEach(review => {
      // Distribution
      distribution[review.rating]++;
      
      // Monthly trends
      const reviewDate = new Date(review.date);
      const monthKey = reviewDate.toISOString().slice(0, 7);
      if (monthlyTrends[monthKey]) {
        monthlyTrends[monthKey].count++;
        monthlyTrends[monthKey].total += review.rating;
        monthlyTrends[monthKey].average = monthlyTrends[monthKey].total / monthlyTrends[monthKey].count;
      }
    });

    // Calculate percentages for distribution
    const totalRatings = ratings.length;
    const distributionPercentages = {};
    Object.keys(distribution).forEach(rating => {
      distributionPercentages[rating] = totalRatings > 0 ? (distribution[rating] / totalRatings) * 100 : 0;
    });

    res.json({
      totalRatings,
      averageRating: user.ratingAverage,
      distribution,
      distributionPercentages,
      monthlyTrends: Object.values(monthlyTrends),
      recentActivity: ratings.slice(-10).map(r => ({
        rating: r.rating,
        date: r.date,
        hasComment: !!r.comment
      }))
    });
  } catch (error) {
    console.error('Get rating analytics error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Admin: Get platform-wide rating analytics
router.get('/admin/rating-analytics', auth, requireAdmin, async (req, res) => {
  try {
    const users = await User.find({ 'ratings.0': { $exists: true } }).select('ratings');
    
    let totalRatings = 0;
    let totalRatingSum = 0;
    const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    const monthlyTrends = {};
    const now = new Date();
    
    // Initialize monthly trends
    for (let i = 11; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthKey = date.toISOString().slice(0, 7);
      monthlyTrends[monthKey] = { count: 0, average: 0, total: 0 };
    }

    users.forEach(user => {
      user.ratings.forEach(review => {
        totalRatings++;
        totalRatingSum += review.rating;
        distribution[review.rating]++;
        
        const reviewDate = new Date(review.date);
        const monthKey = reviewDate.toISOString().slice(0, 7);
        if (monthlyTrends[monthKey]) {
          monthlyTrends[monthKey].count++;
          monthlyTrends[monthKey].total += review.rating;
          monthlyTrends[monthKey].average = monthlyTrends[monthKey].total / monthlyTrends[monthKey].count;
        }
      });
    });

    const averageRating = totalRatings > 0 ? totalRatingSum / totalRatings : 0;
    const distributionPercentages = {};
    Object.keys(distribution).forEach(rating => {
      distributionPercentages[rating] = totalRatings > 0 ? (distribution[rating] / totalRatings) * 100 : 0;
    });

    res.json({
      totalRatings,
      averageRating,
      totalUsers: users.length,
      distribution,
      distributionPercentages,
      monthlyTrends: Object.values(monthlyTrends),
      topRatedUsers: await User.find({})
        .select('name ratingAverage ratingCount')
        .sort({ ratingAverage: -1, ratingCount: -1 })
        .limit(10)
    });
  } catch (error) {
    console.error('Get platform analytics error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Vote on review helpfulness
router.post('/:userId/reviews/:reviewId/vote', auth, [
  body('isHelpful').isBoolean().withMessage('isHelpful must be a boolean')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { userId, reviewId } = req.params;
    const { isHelpful } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const review = user.ratings.id(reviewId);
    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }

    // Check if user already voted
    const existingVoteIndex = review.helpfulVotes.findIndex(
      vote => vote.voter.toString() === req.user._id.toString()
    );

    if (existingVoteIndex !== -1) {
      // Update existing vote
      const existingVote = review.helpfulVotes[existingVoteIndex];
      if (existingVote.isHelpful !== isHelpful) {
        // Change vote
        if (existingVote.isHelpful) {
          review.helpfulCount--;
          review.notHelpfulCount++;
        } else {
          review.notHelpfulCount--;
          review.helpfulCount++;
        }
        existingVote.isHelpful = isHelpful;
        existingVote.date = new Date();
      }
    } else {
      // Add new vote
      review.helpfulVotes.push({
        voter: req.user._id,
        isHelpful,
        date: new Date()
      });
      
      if (isHelpful) {
        review.helpfulCount++;
      } else {
        review.notHelpfulCount++;
      }
    }

    await user.save();
    res.json({
      message: 'Vote recorded successfully',
      helpfulCount: review.helpfulCount,
      notHelpfulCount: review.notHelpfulCount
    });
  } catch (error) {
    console.error('Vote on review error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get review helpfulness stats
router.get('/:userId/reviews/:reviewId/helpfulness', async (req, res) => {
  try {
    const { userId, reviewId } = req.params;

    const user = await User.findById(userId).select('ratings');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const review = user.ratings.id(reviewId);
    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }

    res.json({
      helpfulCount: review.helpfulCount || 0,
      notHelpfulCount: review.notHelpfulCount || 0,
      totalVotes: (review.helpfulCount || 0) + (review.notHelpfulCount || 0)
    });
  } catch (error) {
    console.error('Get review helpfulness error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Respond to a review (only the reviewed user can respond)
router.post('/:userId/reviews/:reviewId/respond', auth, [
  body('text').trim().notEmpty().withMessage('Response text is required').isLength({ max: 1000 }).withMessage('Response too long')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { userId, reviewId } = req.params;
    const { text } = req.body;

    // Check if user is responding to their own review
    if (userId !== req.user._id.toString()) {
      return res.status(403).json({ message: 'You can only respond to reviews about yourself' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const review = user.ratings.id(reviewId);
    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }

    // Check if already responded
    if (review.response && review.response.text) {
      return res.status(400).json({ message: 'You have already responded to this review' });
    }

    // Add response
    review.response = {
      text,
      date: new Date()
    };

    await user.save();
    res.json({
      message: 'Response added successfully',
      response: review.response
    });
  } catch (error) {
    console.error('Respond to review error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update review response
router.put('/:userId/reviews/:reviewId/respond', auth, [
  body('text').trim().notEmpty().withMessage('Response text is required').isLength({ max: 1000 }).withMessage('Response too long')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { userId, reviewId } = req.params;
    const { text } = req.body;

    // Check if user is updating their own response
    if (userId !== req.user._id.toString()) {
      return res.status(403).json({ message: 'You can only update your own responses' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const review = user.ratings.id(reviewId);
    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }

    // Check if response exists
    if (!review.response || !review.response.text) {
      return res.status(400).json({ message: 'No response to update' });
    }

    // Update response
    review.response.text = text;
    review.response.date = new Date();

    await user.save();
    res.json({
      message: 'Response updated successfully',
      response: review.response
    });
  } catch (error) {
    console.error('Update review response error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Admin: Delete review response
router.delete('/:userId/reviews/:reviewId/respond', auth, requireAdmin, async (req, res) => {
  try {
    const { userId, reviewId } = req.params;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const review = user.ratings.id(reviewId);
    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }

    // Remove response
    review.response = undefined;

    await user.save();
    res.json({ message: 'Response deleted successfully' });
  } catch (error) {
    console.error('Delete review response error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Admin: Verify a review
router.put('/:userId/reviews/:reviewId/verify', auth, requireAdmin, async (req, res) => {
  try {
    const { userId, reviewId } = req.params;
    const { swapId } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const review = user.ratings.id(reviewId);
    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }

    // Verify the review
    review.verified = true;
    review.verifiedSwapId = swapId;
    review.verifiedBy = req.user._id;
    review.verifiedDate = new Date();

    await user.save();
    res.json({
      message: 'Review verified successfully',
      verified: review.verified,
      verifiedDate: review.verifiedDate
    });
  } catch (error) {
    console.error('Verify review error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Admin: Unverify a review
router.put('/:userId/reviews/:reviewId/unverify', auth, requireAdmin, async (req, res) => {
  try {
    const { userId, reviewId } = req.params;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const review = user.ratings.id(reviewId);
    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }

    // Unverify the review
    review.verified = false;
    review.verifiedSwapId = undefined;
    review.verifiedBy = undefined;
    review.verifiedDate = undefined;

    await user.save();
    res.json({ message: 'Review unverified successfully' });
  } catch (error) {
    console.error('Unverify review error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Export user reviews (CSV format)
router.get('/:id/reviews/export', auth, async (req, res) => {
  try {
    const id = req.params.id;
    
    // Only allow users to export their own reviews or admins
    if (id !== req.user._id.toString() && !req.user.isAdmin) {
      return res.status(403).json({ message: 'Not authorized to export these reviews' });
    }
    
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ message: 'Invalid user ID' });
    }
    
    const user = await User.findById(id).select('name ratings').populate('ratings.reviewer', 'name email');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Create CSV content
    const csvHeaders = [
      'Reviewer Name',
      'Reviewer Email',
      'Rating',
      'Comment',
      'Date',
      'Helpful Votes',
      'Not Helpful Votes',
      'Verified',
      'Response',
      'Response Date'
    ];

    const csvRows = user.ratings.map(review => [
      review.reviewer ? review.reviewer.name : 'Unknown',
      review.reviewer ? review.reviewer.email : '',
      review.rating,
      review.comment || '',
      new Date(review.date).toISOString(),
      review.helpfulCount || 0,
      review.notHelpfulCount || 0,
      review.verified ? 'Yes' : 'No',
      review.response ? review.response.text : '',
      review.response ? new Date(review.response.date).toISOString() : ''
    ]);

    const csvContent = [csvHeaders, ...csvRows]
      .map(row => row.map(field => `"${field}"`).join(','))
      .join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${user.name}-reviews-${new Date().toISOString().split('T')[0]}.csv"`);
    res.send(csvContent);
  } catch (error) {
    console.error('Export reviews error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get verified reviews for a user
router.get('/:id/reviews/verified', async (req, res) => {
  try {
    const id = req.params.id;
    
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ message: 'Invalid user ID' });
    }
    
    const user = await User.findById(id).select('ratings').populate('ratings.reviewer', 'name profilePhoto');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const verifiedReviews = user.ratings
      .filter(review => review.verified)
      .map(review => ({
        reviewer: review.reviewer ? { _id: review.reviewer._id, name: review.reviewer.name, profilePhoto: review.reviewer.profilePhoto } : null,
        rating: review.rating,
        comment: review.comment,
        date: review.date,
        verifiedDate: review.verifiedDate,
        helpfulCount: review.helpfulCount || 0,
        notHelpfulCount: review.notHelpfulCount || 0
      }));

    res.json({
      verifiedReviews,
      totalVerified: verifiedReviews.length
    });
  } catch (error) {
    console.error('Get verified reviews error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router; 