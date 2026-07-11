import mongoose from 'mongoose';

const evalCaseSchema = new mongoose.Schema(
  {
    // What type of eval this is
    type: {
      type: String,
      enum: ['retrieval', 'review'],
      required: true,
    },

    // For retrieval evals
    retrieval: {
      query: String,           // the question asked
      repoId: String,          // which repo was searched
      repoFullName: String,
      relevantFiles: [String], // ground truth — which files SHOULD appear
      relevantFunctions: [String], // ground truth — which functions SHOULD appear
    },

    // For review evals
    review: {
      repoFullName: String,
      prNumber: Number,
      prTitle: String,
      prDescription: String,   // what the PR actually does
      diff: String,            // the actual diff (truncated)
      groundTruth: {
        shouldCatch: [String], // issues the review SHOULD catch
        shouldNotFlag: [String], // things that are fine, agent should not flag
        expectedVerdict: String, // APPROVE / REQUEST_CHANGES / COMMENT
      },
    },

    // Scores from running the eval
    results: [{
      runAt: Date,
      // Retrieval scores
      precision: Number,       // % of returned chunks that are relevant
      recall: Number,          // % of relevant chunks that were returned
      // Review scores
      rubricScores: {
        caughtRealIssues: Number,    // 0-10: did it catch ground truth issues
        falsePositives: Number,       // 0-10: 10 = no false positives
        specificity: Number,          // 0-10: references real functions/files
        actionability: Number,        // 0-10: feedback is actionable
        verdictCorrect: Number,       // 0 or 10: correct verdict
      },
      overallScore: Number,    // weighted average
      notes: String,           // manual notes on this run
    }],

    // Who created this eval case
    createdBy: String,
    tags: [String],            // e.g. ['auth', 'security', 'performance']
  },
  { timestamps: true }
);

export default mongoose.model('EvalCase', evalCaseSchema);