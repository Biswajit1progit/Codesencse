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

export const postPRComment = async (octokit, owner, repo, pullNumber, body) => {
  await octokit.request('POST /repos/{owner}/{repo}/issues/{issue_number}/comments', {
    owner,
    repo,
    issue_number: pullNumber,
    body,
  });
};