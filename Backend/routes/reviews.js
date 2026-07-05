import express from 'express';
import verifyToken from '../middleware/verifyToken.js';
import Review from '../models/Review.js';

const router = express.Router();

// GET /api/reviews — get all reviews for current user
router.get('/', verifyToken, async (req, res) => {
  try {
    const reviews = await Review.find({ userId: req.userId })
      .sort({ createdAt: -1 })
      .limit(20)
      .select('-trace -analysis'); // exclude heavy fields for list view

    res.json({ reviews });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch reviews' });
  }
});

// GET /api/reviews/:id — get single review with full trace
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const review = await Review.findOne({
      _id: req.params.id,
      userId: req.userId,
    });

    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }

    res.json({ review });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch review' });
  }
});

// GET /api/reviews/repo/:repoId — get reviews for a specific repo
router.get('/repo/:repoId', verifyToken, async (req, res) => {
  try {
    const reviews = await Review.find({
      userId: req.userId,
      repoId: req.params.repoId,
    })
      .sort({ createdAt: -1 })
      .limit(10);

    res.json({ reviews });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch reviews' });
  }
});

export default router;