import mongoose from 'mongoose';

const reviewMetricSchema = new mongoose.Schema(
  {
    context: { type: String, enum: ['pr_review', 'eval_run'], required: true },
    repoFullName: String,
    prNumber: Number,
    evalCaseId: mongoose.Schema.Types.ObjectId,
    callKind: { type: String, enum: ['generate', 'score'] }, // NEW — distinguishes the two Groq calls in eval_run
    model: { type: String, required: true },
    inputTokens: { type: Number, required: true },
    outputTokens: { type: Number, required: true },
    latencyMs: { type: Number, required: true },
    costEstimateUsd: { type: Number, required: true },
    promptVersion: String,
  },
  { timestamps: true }
);

reviewMetricSchema.index({ createdAt: -1 });
reviewMetricSchema.index({ repoFullName: 1 });

export default mongoose.model('ReviewMetric', reviewMetricSchema);