import ReviewMetric from '../models/ReviewMetric.js';

const PRICING = {
  'openai/gpt-oss-120b': { input: 0.59, output: 0.79 },
};

function estimateCost(model, inputTokens, outputTokens) {
  const rates = PRICING[model] || { input: 0, output: 0 };
  return (inputTokens / 1_000_000) * rates.input + (outputTokens / 1_000_000) * rates.output;
}

export async function trackedGroqCall(opts) {
  const {
    context,
    userId = null, // NEW
    repoFullName = null,
    prNumber = null,
    evalCaseId = null,
    callKind = null,
    model,
    promptVersion = null,
    callFn,
  } = opts;

  const start = Date.now();
  const response = await callFn();
  const latencyMs = Date.now() - start;

  const inputTokens = response.usage?.prompt_tokens ?? 0;
  const outputTokens = response.usage?.completion_tokens ?? 0;
  const costEstimateUsd = estimateCost(model, inputTokens, outputTokens);

  try {
    await ReviewMetric.create({
      userId, context, repoFullName, prNumber, evalCaseId, callKind, // CHANGED — added userId
      model, inputTokens, outputTokens, latencyMs, costEstimateUsd, promptVersion,
    });
  } catch (err) {
    console.error('Failed to log review metric:', err.message);
  }

  return { response, metrics: { inputTokens, outputTokens, latencyMs, costEstimateUsd } };
}