import mongoose from 'mongoose';

const repoSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    githubRepoId: {
      type: Number, // GitHub's own numeric ID
      required: true,
    },
    fullName: {
      type: String, // e.g. "camizo/safarsetu"
      required: true,
    },
    defaultBranch: {
      type: String,
      default: 'main',
    },
    ingestionStatus: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed'],
      default: 'pending',
    },
    lastIngestedAt: {
      type: Date,
    },
    chunkCount: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

// One user cannot add the same repo twice
repoSchema.index({ userId: 1, githubRepoId: 1 }, { unique: true });

export default mongoose.model('Repo', repoSchema);