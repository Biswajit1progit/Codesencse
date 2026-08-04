import express from 'express';
import verifyToken from '../middleware/verifyToken.js';
import ReviewMetric from '../models/ReviewMetric.js';

const router = express.Router();

router.get('/summary', verifyToken, async (req, res) => {
  const days = parseInt(req.query.days) || 30;
  const context = req.query.context;
  const match = { createdAt: { $gte: new Date(Date.now() - days * 86400000) } };
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

export default router;