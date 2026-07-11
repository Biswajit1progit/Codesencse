import express from 'express';
import crypto from 'crypto';
import { getInstallationOctokit, fetchPRDiff, fetchPRDetails } from '../utils/githubApp.js';
import { runReviewAgent } from '../agent/graph.js';
import Repo from '../models/Repo.js';

const router = express.Router();

const verifyWebhookSignature = (payload, signature) => {
  if (!signature) return false;
  const hmac = crypto.createHmac('sha256', process.env.GITHUB_WEBHOOK_SECRET);
  const digest = 'sha256=' + hmac.update(payload).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signature));
  } catch {
    return false;
  }
};

router.post('/github', express.raw({ type: 'application/json' }), async (req, res) => {
  const signature = req.headers['x-hub-signature-256'];
  const event = req.headers['x-github-event'];
  const deliveryId = req.headers['x-github-delivery'];

  if (!verifyWebhookSignature(req.body, signature)) {
    console.log('❌ Invalid webhook signature');
    return res.status(401).json({ message: 'Invalid signature' });
  }

  // Respond immediately — GitHub needs 200 within 10s
  res.status(200).json({ message: 'Webhook received' });

  let payload;
  try {
    payload = JSON.parse(req.body.toString());
  } catch (err) {
    console.error('Failed to parse webhook payload:', err.message);
    return;
  }

  console.log(`\n📦 GitHub event: ${event} | action: ${payload.action} | delivery: ${deliveryId}`);

  // Handle app installation on new repos
  if (event === 'installation_repositories' && payload.action === 'added') {
    const addedRepos = payload.repositories_added || [];
    console.log(`\n📦 App installed on ${addedRepos.length} new repo(s):`);
    addedRepos.forEach(r => console.log(`  - ${r.full_name}`));
    return;
  }

  // Handle new installation created
  if (event === 'installation' && payload.action === 'created') {
    const repos = payload.repositories || [];
    console.log(`\n📦 New installation on ${repos.length} repo(s):`);
    repos.forEach(r => console.log(`  - ${r.full_name}`));
    return;
  }

  if (event !== 'pull_request') return;
  if (!['opened', 'synchronize'].includes(payload.action)) return;

  const { pull_request: pr, repository, installation } = payload;
  if (!installation) return;

  const owner = repository.owner.login;
  const repo = repository.name;
  const pullNumber = pr.number;
  const installationId = installation.id;

  console.log(`\n🔍 Processing PR #${pullNumber}: "${pr.title}" in ${owner}/${repo}`);

  try {
    const octokit = await getInstallationOctokit(installationId);

    const prDetails = await fetchPRDetails(octokit, owner, repo, pullNumber);
    const diff = await fetchPRDiff(octokit, owner, repo, pullNumber);

    console.log(`PR: ${prDetails.title} | +${prDetails.additions} -${prDetails.deletions} | ${prDetails.changedFiles} files`);

    const connectedRepo = await Repo.findOne({
      fullName: `${owner}/${repo}`,
      ingestionStatus: 'completed',
    });

    if (!connectedRepo) {
      console.log(`⚠️ Repo ${owner}/${repo} not ingested — skipping`);
      return;
    }

    await runReviewAgent({
      owner,
      repo,
      pullNumber,
      repoId: connectedRepo._id.toString(),
      userId: connectedRepo.userId,
      installationId,
      prDetails,
      diff,
    });

  } catch (err) {
    console.error('Webhook processing error:', err.message);
  }
});

export default router;