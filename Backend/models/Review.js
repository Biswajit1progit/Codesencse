import mongoose from 'mongoose';

const reviewSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    repoId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Repo',
      required: true,
    },
    repoFullName: {
      type: String,
      required: true,
    },
    pullNumber: {
      type: Number,
      required: true,
    },
    prTitle: {
      type: String,
      required: true,
    },
    prAuthor: {
      type: String,
      required: true,
    },
    review: {
      type: String,  // full markdown review text
      required: true,
    },
    analysis: {
      type: Object,  // raw analysis JSON from agent
      default: {},
    },
    trace: {
      type: Array,   // agent reasoning steps
      default: [],
    },
    chunksUsed: {
      type: Number,
      default: 0,
    },
    verdict: {
      type: String,
      enum: ['APPROVE', 'REQUEST_CHANGES', 'COMMENT', 'SKIP'],
      default: 'COMMENT',
    },
    diffStats: {
      additions: { type: Number, default: 0 },
      deletions: { type: Number, default: 0 },
      changedFiles: { type: Number, default: 0 },
    },
  },
  { timestamps: true }
);

// One review per PR — if PR gets new commits, update existing review
reviewSchema.index({ repoId: 1, pullNumber: 1 }, { unique: true });
reviewSchema.index({ userId: 1, createdAt: -1 });

export default mongoose.model('Review', reviewSchema);