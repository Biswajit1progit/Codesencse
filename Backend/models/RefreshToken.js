 import mongoose from 'mongoose';

const refreshTokenSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    tokenHash: {
      type: String,
      required: true, // sha256 hash of raw token — never store raw
    },
    expiresAt: {
      type: Date,
      required: true,
    },
  },
  { timestamps: true }
);

// Auto-delete expired documents at MongoDB level
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Fast lookup by userId for logout (delete all sessions)
refreshTokenSchema.index({ userId: 1 });

export default mongoose.model('RefreshToken', refreshTokenSchema);