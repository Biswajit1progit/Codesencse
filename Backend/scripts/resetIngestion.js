import 'dotenv/config';
import mongoose from 'mongoose';
import Repo from '../models/Repo.js';

const resetIngestion = async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('MongoDB connected');
const result = await Repo.updateMany(
  { ingestionStatus: { $in: ['processing', 'completed'] } },  // ← add completed
  { $set: { ingestionStatus: 'pending', fileHashes: {}, lastIngestedAt: null } }  // ← clear hashes too
);

  console.log(`Reset ${result.modifiedCount} repos from processing → pending`);

  // Show all repos and their current status
  const repos = await Repo.find({}).select('fullName ingestionStatus chunkCount lastIngestedAt');
  console.log('\nCurrent repo statuses:');
  repos.forEach(r => {
    console.log(`  ${r.fullName} → ${r.ingestionStatus} (${r.chunkCount} chunks)`);
  });

  await mongoose.disconnect();
};

resetIngestion().catch(console.error);