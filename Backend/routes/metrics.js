import express from 'express';
import verifyToken from '../middleware/verifyToken.js';
import ReviewMetric from '../models/ReviewMetric.js';

const router = express.Router();

router.get('/summary', verifyToken, async (req, res) => {
  const days = parseInt(req.query.days) || 30;
  const context = req.query.context;
  const match = {userId: req.userId, createdAt: { $gte: new Date(Date.now() - days * 86400000) } };
  if (context) match.context = context;

  try {
    const [summary] = await ReviewMetric.aggregate([
      { $match: match },
      { $group: {
          _id: null,
          totalCalls: { $sum: 1 },
          avgLatencyMs: { $avg: '$latencyMs' },
          totalCostUsd: { $sum: '$costEstimateUsd' },
          totalInputTokens: { $sum: '$inputTokens' },
          totalOutputTokens: { $sum: '$outputTokens' },
      }},
    ]);
    res.json(summary || { totalCalls: 0 });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch metrics summary' });
  }
});
// NEW — this was missing, causing the 404 you just saw
router.get('/trend', verifyToken, async (req, res) => {
  const days = parseInt(req.query.days) || 30;

  try {
    const trend = await ReviewMetric.aggregate([
      { $match: { userId: req.userId, createdAt: { $gte: new Date(Date.now() - days * 86400000) } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          reviews: { $sum: 1 },
          avgLatencyMs: { $avg: '$latencyMs' },
          dailyCostUsd: { $sum: '$costEstimateUsd' },
        },
      },
      { $sort: { _id: 1 } },
    ]);
    res.json(trend);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch metrics trend' });
  }
});
export default router;