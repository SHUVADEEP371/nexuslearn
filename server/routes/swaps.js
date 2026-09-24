const express = require('express');
const { body, validationResult } = require('express-validator');
const Swap = require('../models/Swap');
const User = require('../models/User');
const auth = require('../middleware/auth');

const router = express.Router();

// Create a new swap request
router.post('/', auth, [
  body('recipientId').isMongoId().withMessage('Valid recipient ID is required'),
  body('requestedSkill.name').trim().notEmpty().withMessage('Requested skill name is required'),
  body('offeredSkill.name').trim().notEmpty().withMessage('Offered skill name is required'),
  body('message').optional().trim().isLength({ max: 1000 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { recipientId, requestedSkill, offeredSkill, message, scheduledDate } = req.body;

    // Check if recipient exists and is public
    const recipient = await User.findById(recipientId);
    if (!recipient) {
      return res.status(404).json({ message: 'Recipient not found' });
    }

    if (!recipient.isPublic) {
      return res.status(403).json({ message: 'Cannot send request to private profile' });
    }

    // Check if recipient has the requested skill
    const hasRequestedSkill = recipient.skillsOffered.some(skill => 
      skill.name.toLowerCase() === requestedSkill.name.toLowerCase()
    );

    if (!hasRequestedSkill) {
      return res.status(400).json({ message: 'Recipient does not offer this skill' });
    }

    // Check if requester has the offered skill
    const requester = await User.findById(req.user._id);
    const hasOfferedSkill = requester.skillsOffered.some(skill => 
      skill.name.toLowerCase() === offeredSkill.name.toLowerCase()
    );

    if (!hasOfferedSkill) {
      return res.status(400).json({ message: 'You do not offer this skill' });
    }

    // Check if there's already a pending swap between these users
    const existingSwap = await Swap.findOne({
      $or: [
        { requester: req.user._id, recipient: recipientId },
        { requester: recipientId, recipient: req.user._id }
      ],
      status: { $in: ['pending', 'accepted'] }
    });

    if (existingSwap) {
      return res.status(400).json({ message: 'A swap request already exists between you and this user' });
    }

    // Create the swap
    const swap = new Swap({
      requester: req.user._id,
      recipient: recipientId,
      requestedSkill,
      offeredSkill,
      message,
      scheduledDate: scheduledDate ? new Date(scheduledDate) : null
    });

    await swap.save();

    // Populate user details for response
    await swap.populate('requester', 'name profilePhoto');
    await swap.populate('recipient', 'name profilePhoto');

    res.status(201).json(swap);
  } catch (error) {
    console.error('Create swap error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get user's swaps (as requester and recipient)
router.get('/my-swaps', auth, async (req, res) => {
  try {
    const { status } = req.query;
    let query = {
      $or: [
        { requester: req.user._id },
        { recipient: req.user._id }
      ]
    };

    if (status) {
      query.status = status;
    }

    const swaps = await Swap.find(query)
      .populate('requester', 'name profilePhoto')
      .populate('recipient', 'name profilePhoto')
      .sort({ createdAt: -1 });

    res.json(swaps);
  } catch (error) {
    console.error('Get my swaps error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get swap by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const swap = await Swap.findById(req.params.id)
      .populate('requester', 'name profilePhoto email')
      .populate('recipient', 'name profilePhoto email');

    if (!swap) {
      return res.status(404).json({ message: 'Swap not found' });
    }

    // Check if user is authorized to view this swap
    if (swap.requester._id.toString() !== req.user._id.toString() && 
        swap.recipient._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to view this swap' });
    }

    res.json(swap);
  } catch (error) {
    console.error('Get swap error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Accept swap request
router.put('/:id/accept', auth, async (req, res) => {
  try {
    const swap = await Swap.findById(req.params.id);

    if (!swap) {
      return res.status(404).json({ message: 'Swap not found' });
    }

    // Check if user is the recipient
    if (swap.recipient.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Only the recipient can accept a swap' });
    }

    if (swap.status !== 'pending') {
      return res.status(400).json({ message: 'Swap is not in pending status' });
    }

    swap.status = 'accepted';
    await swap.save();

    await swap.populate('requester', 'name profilePhoto');
    await swap.populate('recipient', 'name profilePhoto');

    res.json(swap);
  } catch (error) {
    console.error('Accept swap error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Reject swap request
router.put('/:id/reject', auth, async (req, res) => {
  try {
    const swap = await Swap.findById(req.params.id);

    if (!swap) {
      return res.status(404).json({ message: 'Swap not found' });
    }

    // Check if user is the recipient
    if (swap.recipient.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Only the recipient can reject a swap' });
    }

    if (swap.status !== 'pending') {
      return res.status(400).json({ message: 'Swap is not in pending status' });
    }

    swap.status = 'rejected';
    await swap.save();

    await swap.populate('requester', 'name profilePhoto');
    await swap.populate('recipient', 'name profilePhoto');

    res.json(swap);
  } catch (error) {
    console.error('Reject swap error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Complete swap
router.put('/:id/complete', auth, async (req, res) => {
  try {
    const swap = await Swap.findById(req.params.id);

    if (!swap) {
      return res.status(404).json({ message: 'Swap not found' });
    }

    // Check if user is involved in the swap
    if (swap.requester.toString() !== req.user._id.toString() && 
        swap.recipient.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to complete this swap' });
    }

    if (swap.status !== 'accepted') {
      return res.status(400).json({ message: 'Swap must be accepted before completion' });
    }

    swap.status = 'completed';
    swap.completedDate = new Date();
    await swap.save();

    // Increment swapsCompleted for both users
    await User.findByIdAndUpdate(swap.requester, { $inc: { swapsCompleted: 1 } });
    await User.findByIdAndUpdate(swap.recipient, { $inc: { swapsCompleted: 1 } });

    await swap.populate('requester', 'name profilePhoto');
    await swap.populate('recipient', 'name profilePhoto');

    res.json(swap);
  } catch (error) {
    console.error('Complete swap error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Cancel swap (only by requester if pending)
router.put('/:id/cancel', auth, async (req, res) => {
  try {
    const swap = await Swap.findById(req.params.id);

    if (!swap) {
      return res.status(404).json({ message: 'Swap not found' });
    }

    // Check if user is the requester
    if (swap.requester.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Only the requester can cancel a swap' });
    }

    if (swap.status !== 'pending') {
      return res.status(400).json({ message: 'Can only cancel pending swaps' });
    }

    swap.status = 'cancelled';
    await swap.save();

    await swap.populate('requester', 'name profilePhoto');
    await swap.populate('recipient', 'name profilePhoto');

    res.json(swap);
  } catch (error) {
    console.error('Cancel swap error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Rate a completed swap
router.post('/:id/rate', auth, [
  body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),
  body('comment').optional().trim().isLength({ max: 500 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { rating, comment } = req.body;
    const swap = await Swap.findById(req.params.id);

    if (!swap) {
      return res.status(404).json({ message: 'Swap not found' });
    }

    // Check if user is involved in the swap
    if (swap.requester.toString() !== req.user._id.toString() && 
        swap.recipient.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to rate this swap' });
    }

    if (swap.status !== 'completed') {
      return res.status(400).json({ message: 'Can only rate completed swaps' });
    }

    // Determine if user is requester or recipient
    const isRequester = swap.requester.toString() === req.user._id.toString();
    const ratingField = isRequester ? 'requesterRating' : 'recipientRating';

    // Check if already rated
    if (swap[ratingField].rating) {
      return res.status(400).json({ message: 'You have already rated this swap' });
    }

    // Add rating to swap (for swap history)
    swap[ratingField] = {
      rating,
      comment,
      date: new Date()
    };
    await swap.save();

    // Add rating to the rated user's ratings array
    const userToUpdate = isRequester ? swap.recipient : swap.requester;
    const user = await User.findById(userToUpdate);
    // Prevent duplicate ratings for the same swap by the same reviewer
    const alreadyRated = user.ratings.some(r => r.reviewer.toString() === req.user._id.toString() && r.swap && r.swap.toString() === swap._id.toString());
    if (!alreadyRated) {
      user.ratings.push({
        reviewer: req.user._id,
        swap: swap._id,
        rating,
        comment,
        date: new Date()
      });
      await user.save();
    }

    await swap.populate('requester', 'name profilePhoto');
    await swap.populate('recipient', 'name profilePhoto');

    res.json(swap);
  } catch (error) {
    console.error('Rate swap error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router; 