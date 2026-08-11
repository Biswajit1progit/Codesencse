# CodeSense — Agentic AI Code Reviewer & Codebase Q&A

> AI-powered code reviewer that understands your entire codebase — not just the diff.

CodeSense connects to your GitHub repos, parses code at AST/function level using Babel, embeds chunks into pgvector, and runs a multi-step LangGraph agent that autonomously plans retrieval queries, fetches relevant context, analyzes PR diffs against the codebase, and posts structured review comments — all triggered automatically when a PR is opened.

---

## Demo

**Codebase Q&A** — ask anything about a connected repo:
```
Q: "where is the refresh token logic handled?"
A: The refresh token logic is handled in apiClient.js (lines 45-67)
   via an Axios interceptor that silently calls /auth/refresh on 401...
Sources: function setupInterceptors in apiClient.js · lines 45-67 · 84%
```

**Automated PR Review** — posted automatically when PR is opened, now as inline diff-level comments:
```
## 🤖 CodeSense Review

The PR "Add booking status validation" by @Biswajit1progit introduces
validation for booking state transitions. While the intention is good,
there are issues that need to be addressed.

🐛 Issues Found
The validateStatus function does not handle the 'cancelled' state...

🔒 Security
No ownership check before status update — IDOR vulnerability possible...

✅ Looks Good
Error handling follows existing patterns in bookingController.js

Verdict: REQUEST_CHANGES
```

---

## Features

### Week 1 — RAG Pipeline
- **GitHub OAuth** with httpOnly refresh cookies, in-memory access tokens, silent refresh interceptor
- **AES-256-GCM encrypted** GitHub token storage — raw token never touches the DB
- **SHA-256 hashed** refresh tokens in DB — actual revocation on logout, not just cookie clearing
- **AST-level code parsing** via `@babel/parser` — extracts function/class/method boundaries, not naive line splits
- **GitHub API-based ingestion** — no git clone (avoids SSL issues, no disk writes for private repo code)
- **Gemini embeddings** (gemini-embedding-001, 768d) stored in Supabase pgvector
- **Cosine similarity search** — semantic Q&A over any connected repo
- **Source citations** — every answer shows which file, function, and lines were used

### Week 2 — Agentic PR Reviewer
- **GitHub App + Webhooks** — fires automatically on PR open/synchronize
- **HMAC-SHA256 signature verification** on every webhook payload
- **LangGraph agent state machine** — explicit nodes, not a free-form loop:
  - `PLAN` — LLM generates 2-3 retrieval queries from the PR diff
  - `RETRIEVE` — pgvector cosine search per query, deduplicated
  - `ANALYZE` — LLM scores diff against retrieved codebase context
  - `REVIEW` — structured markdown review with verdict
  - `POST` — comment posted to GitHub PR via Octokit
  - `SAVE` — review + full reasoning trace stored in MongoDB
- **Review history dashboard** — every review stored with verdict, diff stats, chunks used
- **Agent reasoning trace viewer** — click any review to see PLAN → RETRIEVE → ANALYZE → REVIEW → POST → SAVE with timestamps and color coding

### Week 3 — Eval Harness, Cost Tracking & Public Release
- **50-case eval harness** — expanded from the initial 20-30 case plan; hand-labeled PRs scored against ground truth to catch regressions in review quality before they ship
- **`trackedGroqCall` utility** — wraps every LLM call with cost and latency tracking, giving per-review visibility into token spend and response time (foundation for eval-driven prompt tuning)
- **Inline diff-level PR comments** — reviews now post via GitHub's Reviews API directly on the changed lines, replacing the single summary-comment format
- **Versioned prompt changelog** — tracks edits to the PLAN/ANALYZE/REVIEW node prompts over time, so eval score changes can be correlated with specific prompt versions
- **Public GitHub App with self-serve setup** — other users can now install the app and connect their own repos without manual onboarding
- **Multi-language support (in progress)** — Python parsing via tree-sitter is scoped but not yet shipped; JS/TS parsing remains on Babel

---

## Stack

| Layer | Tech | Why |
|-------|------|-----|
| Frontend | React + Vite + Tailwind + Framer Motion | Familiar stack, fast iteration |
| Backend | Node.js + Express | Same language as frontend, no context switch |
| Auth DB | MongoDB + Mongoose | Flexible schema for users/repos/reviews |
| Vector DB | Supabase pgvector | Postgres + vector in one, free tier |
| LLM | Groq (llama-3.3-70b-versatile) | Fast inference, cheap, good tool-calling |
| Embeddings | Gemini (gemini-embedding-001) | 768d, works within Supabase free tier limits |
| Agent | LangGraph.js | Explicit state machine, debuggable, visualizable |
| GitHub | GitHub App + Webhooks + Octokit | Scoped permissions, webhook-driven |
| Code parsing | @babel/parser + @babel/traverse (JS/TS); tree-sitter (Python, in progress) | Pure JS parsing with no native bindings for JS/TS; tree-sitter being scoped to extend parsing to Python |

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    INGESTION PIPELINE                    │
│                                                         │
│  GitHub Repo                                            │
│      │                                                  │
│      ▼                                                  │
│  Octokit (GitHub API)                                   │
│      │ fetch file tree (recursive)                      │
│      │ fetch file contents                              │
│      ▼                                                  │
│  @babel/parser                                          │
│      │ extract function/class/method nodes              │
│      │ splitLargeChunk (max 80 lines)                   │
│      ▼                                                  │
│  Gemini embeddings (768d)                                │
│      │ 1.5s delay between calls (rate limit)             │
│      │ retry with exponential backoff on 429             │
│      ▼                                                  │
│  Supabase pgvector                                       │
│      │ hnsw index for cosine similarity                  │
│      │ indexed by repo_id + user_id                      │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│                    AGENTIC PR REVIEW                     │
│                                                         │
│  GitHub PR opened/synchronized                           │
│      │                                                  │
│      ▼                                                  │
│  smee.io (dev) → /api/webhooks/github                    │
│      │ HMAC-SHA256 signature verified                    │
│      │ respond 200 immediately                           │
│      ▼                                                  │
│  fetchPRDetails + fetchPRDiff (Octokit)                  │
│      │                                                  │
│      ▼                                                  │
│  LangGraph Agent                                         │
│      │                                                  │
│      ├── PLAN                                            │
│      │    LLM generates retrieval queries from diff      │
│      │    extractChangedFunctions from patch             │
│      │    trackedGroqCall logs cost/latency               │
│      │                                                  │
│      ├── RETRIEVE                                         │
│      │    embedText(query) → pgvector cosine search       │
│      │    deduplicate across queries                      │
│      │                                                  │
│      ├── ANALYZE                                          │
│      │    LLM: diff + retrieved context →                 │
│      │    {bugs, security, performance, style}            │
│      │    trackedGroqCall logs cost/latency                │
│      │                                                  │
│      ├── REVIEW                                            │
│      │    LLM: analysis → structured markdown              │
│      │    verdict: APPROVE/REQUEST_CHANGES/COMMENT          │
│      │                                                  │
│      ├── POST                                               │
│      │    Octokit → inline diff-level PR comments             │
│      │    (GitHub Reviews API)                                │
│      │                                                  │
│      └── SAVE                                                 │
│           MongoDB → Review document                            │
│           full trace + analysis + cost/latency stored          │
└─────────────────────────────────────────────────────────┘
```

---

## Key Technical Decisions & Interview Talking Points

**1. GitHub API over git clone for ingestion**
Git clone on Windows with OpenSSL 3.x causes `SSL_read: decryption failed` on large repos due to TLS record MAC errors. GitHub API via Octokit bypasses this entirely — HTTPS through Node's built-in fetch, no disk writes, stateless operation. Trade-off: 5000 requests/hour rate limit per authenticated user vs git's single bulk transfer.

**2. Babel parser over tree-sitter for JS/TS**
Tree-sitter requires native C++ compilation via node-gyp, which fails on Windows without Visual Studio Build Tools. `@babel/parser` is pure JavaScript, zero native dependencies, cross-platform. Both produce equivalent AST for JS/TS — the parsing quality is the same. Tree-sitter is now being introduced specifically for Python support, where no equivalent pure-JS parser exists.

**3. MongoDB + Supabase split**
MongoDB handles relational data (users, sessions, repos, reviews) where flexible schema and TTL indexes (auto-expire refresh tokens) are valuable. Supabase pgvector handles vector similarity search — native cosine distance via `<=>` operator, hnsw index. Forcing everything into one DB would mean either paying for MongoDB Atlas Vector Search or giving up native Postgres vector operations.

**4. In-memory access token + httpOnly refresh cookie**
Access token lives only in a JavaScript variable (never localStorage, never sessionStorage). On page refresh, `AuthContext` calls `/auth/refresh` using the httpOnly cookie to get a new access token — the cookie is invisible to JavaScript so XSS cannot steal it. The refresh token is stored as SHA-256 hash in MongoDB, not raw — this means a stolen DB does not expose valid tokens.

**5. AES-256-GCM for GitHub token storage**
GitHub tokens are stored encrypted at rest using AES-256-GCM with a random IV per encryption. Format: `iv:authTag:encryptedData` — all three components required for decryption. The encryption key is in the backend `.env`, never in the DB. This means even if the DB is compromised, the GitHub tokens cannot be decrypted without the key.

**6. LangGraph explicit state machine over free-form agent loop**
Free-form loops (ReAct pattern) are harder to debug and can spiral. LangGraph forces explicit nodes and edges — each step reads from state and returns updated state. The reasoning trace is a natural byproduct of this structure, which is why we can display it in the UI without extra instrumentation.

**7. Respond 200 to webhook immediately, process async**
GitHub requires a webhook response within 10 seconds or it marks the delivery as failed and retries. The agent takes 15-30 seconds (LLM calls + embedding calls). Solution: respond 200 immediately, then process the PR review asynchronously in the same request handler after the response is sent. This is a common pattern in webhook-driven systems.

**8. Inline diff-level comments over a single summary comment**
Posting one large markdown comment forced reviewers to manually map feedback back to specific lines. Switching to GitHub's Reviews API lets CodeSense attach each finding directly to the relevant line in the diff, matching how human reviewers actually comment on PRs — and making individual pieces of feedback resolvable/threadable.

**9. Eval harness as a first-class part of the agent loop**
Without a scored eval set, prompt changes were graded by vibes. The 50-case labeled harness plus `trackedGroqCall` cost/latency logging means prompt or model changes can be evaluated on both review quality and cost/latency trade-offs before shipping — and the versioned prompt changelog ties score changes back to a specific prompt revision.

---

## Project Structure

```
codesense/
├── backend/
│   ├── agent/
│   │   ├── graph.js          # runReviewAgent — orchestrates all nodes
│   │   ├── nodes.js          # planNode, retrieveNode, analyzeNode, reviewNode
│   │   ├── state.js          # createInitialState — agent state shape
│   │   └── tools.js          # retrieveContext, extractChangedFunctions, summarizeDiff
│   ├── eval/
│   │   ├── cases/            # 50 hand-labeled PR test cases
│   │   ├── runEval.js        # scores agent output against ground truth
│   │   └── promptChangelog.js # versioned prompt history + eval score correlation
│   ├── middleware/
│   │   └── verifyToken.js    # JWT access token verification
│   ├── models/
│   │   ├── User.js           # githubId, username, encrypted GitHub token
│   │   ├── RefreshToken.js   # hashed token, TTL index for auto-expire
│   │   ├── Repo.js           # connected repos, ingestion status, chunk count
│   │   └── Review.js         # PR reviews, verdict, analysis, trace, cost/latency
│   ├── routes/
│   │   ├── auth.js           # GitHub OAuth, refresh, logout
│   │   ├── repos.js          # list, connect, ingest
│   │   ├── qa.js              # Q&A endpoint
│   │   ├── reviews.js        # review history API
│   │   └── webhooks.js       # GitHub App webhook listener
│   ├── utils/
│   │   ├── astParser.js      # Babel AST parsing, chunk extraction (JS/TS)
│   │   ├── pyParser.js       # tree-sitter Python parsing (in progress)
│   │   ├── embeddings.js     # Gemini embeddings with retry
│   │   ├── encrypt.js        # AES-256-GCM encrypt/decrypt
│   │   ├── githubApp.js      # GitHub App, fetchPRDiff, postInlineReviewComments
│   │   ├── supabase.js       # pg Pool connection
│   │   ├── tokenUtils.js     # JWT generation, cookie helpers, hash
│   │   ├── trackedGroqCall.js # wraps Groq calls with cost/latency tracking
│   │   └── vectorStore.js    # storeChunks, searchChunks, deleteChunks
│   ├── .env.example
│   └── server.js
└── frontend/
    └── src/
        ├── api/
        │   └── apiClient.js      # Axios + silent refresh interceptor
        ├── context/
        │   └── AuthContext.jsx   # session restore, logout
        ├── pages/
        │   ├── Home.jsx          # landing page
        │   ├── Dashboard.jsx     # main app — repos, Q&A, reviews
        │   └── AuthCallback.jsx  # post-OAuth token extraction
        └── App.jsx               # PublicRoute + ProtectedRoute wrappers
```

---

## Known Limitations & Planned Improvements

### Retrieval quality
**Current**: top-k cosine similarity, k=8, no re-ranking
**Problem**: relevant chunks sometimes rank below k — the `lastBookingAttempt` write-conflict fix in SafarSetu didn't surface because it was embedded inside a larger function chunk
**Planned**:
- Sliding window overlap when chunking large functions (capture surrounding context)
- Re-ranking pass: retrieve top-20, re-rank with cross-encoder, return top-5
- Query expansion: generate 3 variants of the user question, search all 3

### Agent review quality
**Status**: Largely addressed — the 50-case eval harness with precision/recall-style scoring against hand-labeled ground truth is now in place, and `trackedGroqCall` gives visibility into cost/latency trade-offs of prompt changes
**Remaining**:
- Reflection node: agent critiques its own review and revises if confidence is low (not yet implemented)

### Rate limiting
**Current**: 1.5s delay between embedding calls, 500ms delay between GitHub API file fetches
**Problem**: large repos (200+ JS files) take 5+ minutes to ingest
**Planned**:
- Incremental ingestion — only re-embed changed files on re-ingest (compare file hashes)
- Batch embedding API when available
- Background job queue (Bull/BullMQ) so ingestion does not block the request

### Multi-user & multi-repo installs
**Status**: Partially addressed — the GitHub App is now public with a self-serve setup flow, so multiple users can install it independently
**Remaining**:
- Confirm `installationId` is stored per repo on the `installation.created` webhook and correctly mapped if two users connect the same repo
- Map `installation.created` webhook to the correct user via the GitHub API where ambiguous

### Multi-language support
**Current**: JS/TS only, via Babel
**In progress**: Python support via tree-sitter — parser integration scoped, not yet shipped
**Planned**: extend chunk extraction and eval cases to cover Python once parsing lands

### Deployment
**Current**: local only (smee.io for webhook proxying)
**Planned**:
- Backend on Render (free tier)
- Frontend on Netlify
- Swap smee.io for actual webhook URL
- Move secrets to Render environment variables
- MongoDB Atlas for production DB

### Security hardening
**Current**: webhook verified, tokens encrypted, IDOR-safe queries
**Missing**:
- Rate limiting on auth routes (express-rate-limit)
- Request size limits on webhook endpoint
- Refresh token rotation (issue new refresh token on each use, invalidate old)
- CORS whitelist tightened to production domain only in production

---

## Local Setup

```bash
# Prerequisites: Node.js 20+, MongoDB running locally, Supabase account, Groq API key, Gemini API key

git clone https://github.com/Biswajit1progit/codesense.git
cd codesense

# Backend
cd backend
cp .env.example .env
# Fill all values in .env
npm install
npm run dev

# Frontend (new terminal)
cd frontend
npm install
npm run dev

# Webhook proxy (new terminal, dev only)
npm install -g smee-client
smee -u YOUR_SMEE_CHANNEL_URL -t http://localhost:5000/api/webhooks/github
```

**Required env variables:**
```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/codesense
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GITHUB_CALLBACK_URL=http://localhost:5000/api/auth/github/callback
JWT_ACCESS_SECRET=
JWT_REFRESH_SECRET=
ENCRYPTION_KEY=
FRONTEND_URL=http://localhost:5173
SUPABASE_DATABASE_URL=
GEMINI_API_KEY=
GROQ_API_KEY=
GITHUB_APP_ID=
GITHUB_APP_PRIVATE_KEY_PATH=./your-app.pem
GITHUB_WEBHOOK_SECRET=
```

---

## Supabase SQL Setup

```sql
create extension if not exists vector;

create table code_chunks (
  id uuid primary key default gen_random_uuid(),
  repo_id text not null,
  user_id text not null,
  file_path text not null,
  chunk_name text not null,
  chunk_type text not null,
  content text not null,
  start_line integer not null,
  end_line integer not null,
  embedding vector(768) not null,
  created_at timestamptz default now()
);

create index on code_chunks using hnsw (embedding vector_cosine_ops);
create index on code_chunks (repo_id);
create index on code_chunks (user_id);
```

---


