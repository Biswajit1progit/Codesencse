import express from 'express';
import { Octokit } from '@octokit/rest';
import path from 'path';
import { fileURLToPath } from 'url';
import verifyToken from '../middleware/verifyToken.js';
import User from '../models/User.js';
import Repo from '../models/Repo.js';
import { decrypt } from '../utils/encrypt.js';
import { extractChunks, splitLargeChunk } from '../utils/astParser.js';
import { embedBatch, buildEmbeddingText } from '../utils/embeddings.js';
import { storeChunks, deleteChunks } from '../utils/vectorStore.js';
const router = express.Router();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Helper — get Octokit instance for this user
const getOctokit = async (userId) => {
  const user = await User.findById(userId);
  const githubToken = decrypt(user.githubAccessTokenEncrypted);
  return { octokit: new Octokit({ auth: githubToken }), githubToken };
};

// Valid extensions to parse
const VALID_EXTENSIONS = ['.js', '.jsx', '.ts', '.tsx', '.mjs'];

// Recursively fetch file tree from GitHub API
const fetchFileTree = async (octokit, owner, repo, treeSha) => {
  const { data } = await octokit.git.getTree({
    owner,
    repo,
    tree_sha: treeSha,
    recursive: 'true', // get entire tree in one call
  });

  // Filter to only valid JS/TS files, skip node_modules etc
  const skipDirs = ['node_modules', 'dist', 'build', '.next', 'coverage', '.cache', 'out'];

  return data.tree.filter((item) => {
    if (item.type !== 'blob') return false;
    const ext = path.extname(item.path);
    if (!VALID_EXTENSIONS.includes(ext)) return false;

    // Skip if path contains any skip directory
    const parts = item.path.split('/');
    return !parts.some((part) => skipDirs.includes(part));
  });
};

// Fetch single file content from GitHub API
const fetchFileContent = async (octokit, owner, repo, filePath) => {
  try {
    const { data } = await octokit.repos.getContent({
      owner,
      repo,
      path: filePath,
    });

    // GitHub returns base64 encoded content
    if (data.encoding === 'base64') {
      return Buffer.from(data.content, 'base64').toString('utf8');
    }
    return data.content;
  } catch (err) {
    console.log(`Skipping ${filePath}: ${err.message}`);
    return null;
  }
};

// GET /api/repos/list
router.get('/list', verifyToken, async (req, res) => {
  try {
    const { octokit } = await getOctokit(req.userId);

    const { data } = await octokit.repos.listForAuthenticatedUser({
      sort: 'updated',
      per_page: 50,
      type: 'all',
    });

    const repos = data.map((repo) => ({
      githubRepoId: repo.id,
      fullName: repo.full_name,
      description: repo.description,
      language: repo.language,
      isPrivate: repo.private,
      defaultBranch: repo.default_branch,
      updatedAt: repo.updated_at,
      stars: repo.stargazers_count,
    }));

    res.json({ repos });
  } catch (err) {
    console.error('List repos error:', err.message);
    res.status(500).json({ message: 'Failed to fetch repositories' });
  }
});

// POST /api/repos/connect
router.post('/connect', verifyToken, async (req, res) => {
  const { githubRepoId, fullName, defaultBranch } = req.body;

  if (!githubRepoId || !fullName) {
    return res.status(400).json({ message: 'Missing required fields' });
  }

  try {
    const existing = await Repo.findOne({ userId: req.userId, githubRepoId });
    if (existing) {
      return res.status(409).json({ message: 'Repo already connected' });
    }

    const repo = await Repo.create({
      userId: req.userId,
      githubRepoId,
      fullName,
      defaultBranch: defaultBranch || 'main',
      ingestionStatus: 'pending',
    });

    res.status(201).json({ repo });
  } catch (err) {
    console.error('Connect repo error:', err.message);
    res.status(500).json({ message: 'Failed to connect repository' });
  }
});

// GET /api/repos/connected
router.get('/connected', verifyToken, async (req, res) => {
  try {
    const repos = await Repo.find({ userId: req.userId }).sort({ createdAt: -1 });
    res.json({ repos });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch connected repos' });
  }
});

// POST /api/repos/ingest/:repoId — GitHub API based, no git clone
router.post('/ingest/:repoId', verifyToken, async (req, res) => {
  const { repoId } = req.params;

  try {
    const repo = await Repo.findOne({ _id: repoId, userId: req.userId });
    if (!repo) {
      return res.status(404).json({ message: 'Repo not found' });
    }

    repo.ingestionStatus = 'processing';
    await repo.save();

    const { octokit } = await getOctokit(req.userId);
    const [owner, repoName] = repo.fullName.split('/');

    console.log(`Fetching file tree for ${repo.fullName}...`);

    const { data: branchData } = await octokit.repos.getBranch({
      owner,
      repo: repoName,
      branch: repo.defaultBranch,
    });

    const treeSha = branchData.commit.commit.tree.sha;
    const files = await fetchFileTree(octokit, owner, repoName, treeSha);
    console.log(`Found ${files.length} JS/TS files`);

    // Fetch content + AST parse
    const allChunks = [];
    let processed = 0;

    for (const file of files) {
      if (file.size > 500000) {
        console.log(`Skipping large file: ${file.path}`);
        continue;
      }

      const content = await fetchFileContent(octokit, owner, repoName, file.path);
      if (!content) continue;

      const chunks = extractChunks(content, file.path);
      const finalChunks = chunks.flatMap((chunk) => splitLargeChunk(chunk));
      allChunks.push(...finalChunks);

      processed++;
      if (processed % 10 === 0) {
        console.log(`Parsed ${processed}/${files.length} files...`);
        await new Promise((r) => setTimeout(r, 500));
      }
    }

    console.log(`Extracted ${allChunks.length} AST chunks — starting embedding...`);

    // Build embedding texts
    const embeddingTexts = allChunks.map(buildEmbeddingText);

    // Embed all chunks
    const embeddings = await embedBatch(embeddingTexts);
    console.log(`Generated ${embeddings.length} embeddings`);

    // Store in pgvector
    await storeChunks(allChunks, embeddings, repoId, req.userId);

    // Update repo status
    repo.ingestionStatus = 'completed';
    repo.lastIngestedAt = new Date();
    repo.chunkCount = allChunks.length;
    await repo.save();

    res.json({
      message: 'Ingestion complete',
      filesFound: files.length,
      chunksExtracted: allChunks.length,
      embeddingsGenerated: embeddings.length,
      preview: allChunks.slice(0, 5).map((c) => ({
        type: c.type,
        name: c.name,
        file: c.filePath,
        lines: `${c.startLine}-${c.endLine}`,
      })),
    });

  } catch (err) {
    console.error('Ingestion error:', err.message);
    await Repo.findByIdAndUpdate(repoId, { ingestionStatus: 'failed' });
    res.status(500).json({ message: 'Ingestion failed', error: err.message });
  }
});

export default router;