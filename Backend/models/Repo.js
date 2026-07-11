import mongoose from 'mongoose';

const repoSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    githubRepoId: {
      type: Number,
      required: true,
    },
    fullName: {
      type: String,
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
    // NEW — store file SHA hashes for incremental ingestion
    fileHashes: {
      type: Object, // { "path/to/file.js": "sha1hash" }
      default: {},
    },
    // NEW — track ingestion stats
    ingestionStats: {
      totalFiles: { type: Number, default: 0 },
      changedFiles: { type: Number, default: 0 },
      skippedFiles: { type: Number, default: 0 },
      lastFullIngest: { type: Date },
    },
  },
  { timestamps: true }
);

repoSchema.index({ userId: 1, githubRepoId: 1 }, { unique: true });

export default mongoose.model('Repo', repoSchema);