import { App } from '@octokit/app';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// In production: use env variable. In dev: use .pem file
const getPrivateKey = () => {
  if (process.env.GITHUB_APP_PRIVATE_KEY) {
    // Replace literal \n with actual newlines (Render stores it this way)
    return process.env.GITHUB_APP_PRIVATE_KEY.replace(/\\n/g, '\n');
  }
  const pemPath = path.join(__dirname, '..', process.env.GITHUB_APP_PRIVATE_KEY_PATH);
  return fs.readFileSync(pemPath, 'utf8');
};

export const githubApp = new App({
  appId: Number(process.env.GITHUB_APP_ID),
  privateKey: getPrivateKey(),
  webhooks: {
    secret: process.env.GITHUB_WEBHOOK_SECRET,
  },
});

export const getInstallationOctokit = async (installationId) => {
  return await githubApp.getInstallationOctokit(installationId);
};

export const fetchPRDiff = async (octokit, owner, repo, pullNumber) => {
  const response = await octokit.request('GET /repos/{owner}/{repo}/pulls/{pull_number}/files', {
    owner,
    repo,
    pull_number: pullNumber,
    per_page: 100,
  });
  return response.data.map((file) => ({
    filename: file.filename,
    status: file.status,
    additions: file.additions,
    deletions: file.deletions,
    changes: file.changes,
    patch: file.patch || '',
  }));
};

export const fetchPRDetails = async (octokit, owner, repo, pullNumber) => {
  const response = await octokit.request('GET /repos/{owner}/{repo}/pulls/{pull_number}', {
    owner,
    repo,
    pull_number: pullNumber,
  });
  const pr = response.data;
  return {
    title: pr.title,
    body: pr.body,
    author: pr.user.login,
    baseBranch: pr.base.ref,
    headBranch: pr.head.ref,
    state: pr.state,
    additions: pr.additions,
    deletions: pr.deletions,
    changedFiles: pr.changed_files,
  };
};
// ...all existing code stays exactly as-is...

// NEW — posts inline diff-level comments as a single review, instead of postPRComment's single summary comment
export const postInlineReview = async (octokit, owner, repo, pullNumber, { body, comments, event = 'COMMENT' }) => {
  // comments: [{ path, line, side, body }]
  // path = file path exactly as it appears in the diff (e.g. "Backend/routes/booking.js")
  // line = line number in the file's NEW version (for additions/context) — GitHub resolves this against the diff itself
  // side = 'RIGHT' (new version) or 'LEFT' (old version, for comments on deleted lines) — default to RIGHT for additions
  // body = the comment text for that specific line
  // event = 'COMMENT' | 'REQUEST_CHANGES' | 'APPROVE' — maps to your existing verdict

  const { data: prHead } = await octokit.request('GET /repos/{owner}/{repo}/pulls/{pull_number}', {
    owner, repo, pull_number: pullNumber,
  });
  const commitId = prHead.head.sha;

  return await octokit.request('POST /repos/{owner}/{repo}/pulls/{pull_number}/reviews', {
    owner,
    repo,
    pull_number: pullNumber,
    commit_id: commitId,
    body, // overall summary text, shown at the top of the review
    event,
    comments: comments.map(c => ({
      path: c.path,
      line: c.line,
      side: c.side || 'RIGHT',
      body: c.body,
    })),
  });
};
export const postPRComment = async (octokit, owner, repo, pullNumber, body) => {
  await octokit.request('POST /repos/{owner}/{repo}/issues/{issue_number}/comments', {
    owner,
    repo,
    issue_number: pullNumber,
    body,
  });
};