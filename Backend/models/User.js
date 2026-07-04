import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    githubId: {
      type: String,
      required: true,
      unique: true,
    },
    username: {
      type: String,
      required: true,
    },
    avatarUrl: {
      type: String,
    },
    githubAccessTokenEncrypted: {
      type: String, // AES-256-GCM encrypted — never raw, never sent to frontend
      required: true,
    },
  },
  { timestamps: true }
);

export default mongoose.model('User', userSchema);