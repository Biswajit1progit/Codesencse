import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect, useRef } from 'react';
import apiClient from '../api/apiClient';

const stats = [
  { label: 'Repos Connected', value: '0', icon: '📁' },
  { label: 'PRs Reviewed', value: '0', icon: '🔍' },
  { label: 'Questions Asked', value: '0', icon: '💬' },
  { label: 'Issues Caught', value: '0', icon: '🐛' },
];

const Dashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [connectedRepos, setConnectedRepos] = useState([]);
  const [showPicker, setShowPicker] = useState(false);
  const [githubRepos, setGithubRepos] = useState([]);
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [connectingId, setConnectingId] = useState(null);
  const [ingestingId, setIngestingId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Q&A state
  const [selectedRepo, setSelectedRepo] = useState(null);
  const [showChat, setShowChat] = useState(false);
  const [messages, setMessages] = useState([]);
  const [question, setQuestion] = useState('');
  const [asking, setAsking] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    fetchConnectedRepos();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchConnectedRepos = async () => {
    try {
      const { data } = await apiClient.get('/repos/connected');
      setConnectedRepos(data.repos);
    } catch (err) {
      console.error('Failed to fetch connected repos:', err.message);
    }
  };

  const handleOpenPicker = async () => {
    setShowPicker(true);
    setLoadingRepos(true);
    try {
      const { data } = await apiClient.get('/repos/list');
      setGithubRepos(data.repos);
    } catch (err) {
      console.error('Failed to fetch repos:', err.message);
    } finally {
      setLoadingRepos(false);
    }
  };

  const handleConnect = async (repo) => {
    setConnectingId(repo.githubRepoId);
    try {
      const { data } = await apiClient.post('/repos/connect', {
        githubRepoId: repo.githubRepoId,
        fullName: repo.fullName,
        defaultBranch: repo.defaultBranch,
      });
      setConnectedRepos((prev) => [data.repo, ...prev]);
      setShowPicker(false);
    } catch (err) {
      if (err.response?.status === 409) alert('Repo already connected');
    } finally {
      setConnectingId(null);
    }
  };

  const handleIngest = async (repoId) => {
    setIngestingId(repoId);
    try {
      const { data } = await apiClient.post(`/repos/ingest/${repoId}`);
      await fetchConnectedRepos();
      alert(`✅ Ingestion complete! ${data.chunksExtracted} chunks extracted.`);
    } catch (err) {
      alert('Ingestion failed — check backend logs');
    } finally {
      setIngestingId(null);
    }
  };

  const handleOpenChat = (repo) => {
    setSelectedRepo(repo);
    setMessages([
      {
        role: 'assistant',
        content: `I've loaded **${repo.fullName}** (${repo.chunkCount} code chunks indexed). Ask me anything about this codebase!`,
        sources: [],
      },
    ]);
    setShowChat(true);
  };

  const handleAsk = async () => {
    if (!question.trim() || asking) return;

    const userMessage = { role: 'user', content: question };
    setMessages((prev) => [...prev, userMessage]);
    setQuestion('');
    setAsking(true);

    try {
      const { data } = await apiClient.post('/qa/ask', {
        question: userMessage.content,
        repoId: selectedRepo._id,
      });

      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: data.answer,
          sources: data.sources || [],
        },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'Sorry, something went wrong. Please try again.',
          sources: [],
        },
      ]);
    } finally {
      setAsking(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const filteredRepos = githubRepos.filter((r) =>
    r.fullName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const updatedStats = stats.map((s) =>
    s.label === 'Repos Connected' ? { ...s, value: String(connectedRepos.length) } : s
  );

  return (
    <div className="min-h-screen bg-[#020817] text-white relative overflow-x-hidden">

      <div className="absolute top-[-100px] right-[-100px] w-[300px] h-[300px] md:w-[500px] md:h-[500px] bg-blue-600/8 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-100px] left-[-100px] w-[300px] h-[300px] md:w-[500px] md:h-[500px] bg-violet-600/8 rounded-full blur-3xl pointer-events-none" />

      {/* Navbar */}
      <motion.nav
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="flex items-center justify-between px-4 md:px-8 py-4 md:py-5 border-b border-white/5 backdrop-blur-sm"
      >
        <div className="flex items-center gap-2">
          <span className="text-xl md:text-2xl">⚡</span>
          <span className="text-lg md:text-xl font-bold tracking-tight">CodeSense</span>
        </div>
        <div className="flex items-center gap-2 md:gap-4">
          <div className="flex items-center gap-2 md:gap-3 bg-white/[0.04] border border-white/[0.08] rounded-xl px-2 md:px-4 py-2">
            <img src={user.avatarUrl} alt={user.username} className="w-6 h-6 md:w-7 md:h-7 rounded-full ring-2 ring-white/10" />
            <span className="text-xs md:text-sm font-medium text-slate-300 hidden sm:inline">{user.username}</span>
          </div>
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={handleLogout}
            className="text-xs md:text-sm text-slate-400 hover:text-white bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.07] px-3 md:px-4 py-2 rounded-xl transition-all cursor-pointer"
          >
            Logout
          </motion.button>
        </div>
      </motion.nav>

      <div className="max-w-6xl mx-auto px-4 md:px-6 py-6 md:py-10">

        {/* Welcome */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="mb-6 md:mb-10">
          <h1 className="text-2xl md:text-3xl font-bold mb-1">
            Welcome back,{' '}
            <span className="bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent">{user.username}</span>{' '}👋
          </h1>
          <p className="text-slate-400 text-xs md:text-sm">Here's your CodeSense overview</p>
        </motion.div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-6 md:mb-10">
          {updatedStats.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 + i * 0.08 }}
              className="bg-white/[0.03] backdrop-blur-sm border border-white/[0.07] rounded-2xl p-4 md:p-5 hover:bg-white/[0.05] transition-all"
            >
              <div className="text-xl md:text-2xl mb-2 md:mb-3">{stat.icon}</div>
              <div className="text-xl md:text-2xl font-bold text-white mb-0.5">{stat.value}</div>
              <div className="text-[10px] md:text-xs text-slate-500">{stat.label}</div>
            </motion.div>
          ))}
        </div>

        {/* Connected repos */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="bg-white/[0.03] backdrop-blur-sm border border-white/[0.07] rounded-2xl p-5 md:p-8">
          <div className="flex items-center justify-between mb-5 md:mb-6">
            <h2 className="text-sm md:text-base font-semibold text-white">Connected Repositories</h2>
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={handleOpenPicker}
              className="text-[10px] md:text-xs bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 text-blue-400 px-3 md:px-4 py-1.5 md:py-2 rounded-lg transition-all cursor-pointer"
            >
              + Connect Repo
            </motion.button>
          </div>

          {connectedRepos.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 md:py-14 text-center">
              <div className="text-4xl md:text-5xl mb-3 md:mb-4">📁</div>
              <p className="text-slate-300 font-medium text-sm md:text-base mb-1">No repositories connected yet</p>
              <p className="text-slate-500 text-xs md:text-sm max-w-xs">Connect a GitHub repo and CodeSense will parse it at the AST level.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {connectedRepos.map((repo) => (
                <div key={repo._id} className="flex items-center justify-between bg-white/[0.02] border border-white/[0.06] rounded-xl px-4 py-3">
                  <div className="flex-1 min-w-0 mr-3">
                    <p className="text-sm font-medium text-white truncate">{repo.fullName}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      <span className={
                        repo.ingestionStatus === 'completed' ? 'text-green-400' :
                        repo.ingestionStatus === 'processing' ? 'text-yellow-400' :
                        repo.ingestionStatus === 'failed' ? 'text-red-400' :
                        'text-slate-400'
                      }>
                        {repo.ingestionStatus}
                      </span>
                      {repo.chunkCount > 0 && ` · ${repo.chunkCount} chunks`}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {/* Ask button — only for completed repos */}
                    {repo.ingestionStatus === 'completed' && (
                      <motion.button
                        whileHover={{ scale: 1.03 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => handleOpenChat(repo)}
                        className="text-xs bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 text-blue-400 px-3 py-1.5 rounded-lg transition-all cursor-pointer"
                      >
                        💬 Ask
                      </motion.button>
                    )}

                    {/* Ingest button */}
                    {repo.ingestionStatus !== 'completed' && (
                      <motion.button
                        whileHover={{ scale: 1.03 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => handleIngest(repo._id)}
                        disabled={ingestingId === repo._id}
                        className="text-xs bg-violet-500/10 hover:bg-violet-500/20 border border-violet-500/20 text-violet-400 px-3 py-1.5 rounded-lg transition-all cursor-pointer disabled:opacity-50"
                      >
                        {ingestingId === repo._id ? 'Ingesting...' : 'Ingest'}
                      </motion.button>
                    )}

                    {/* Re-ingest button for completed repos */}
                    {repo.ingestionStatus === 'completed' && (
                      <motion.button
                        whileHover={{ scale: 1.03 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => handleIngest(repo._id)}
                        disabled={ingestingId === repo._id}
                        className="text-xs bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.07] text-slate-400 px-3 py-1.5 rounded-lg transition-all cursor-pointer disabled:opacity-50"
                      >
                        {ingestingId === repo._id ? 'Ingesting...' : '↺'}
                      </motion.button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </div>

      {/* Repo Picker Modal */}
      <AnimatePresence>
        {showPicker && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowPicker(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[#0f172a] border border-white/10 rounded-2xl w-full max-w-lg max-h-[80vh] flex flex-col overflow-hidden"
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
                <h3 className="text-base font-semibold text-white">Select a Repository</h3>
                <button onClick={() => setShowPicker(false)} className="text-slate-400 hover:text-white text-xl cursor-pointer">×</button>
              </div>
              <div className="px-5 py-3 border-b border-white/5">
                <input
                  type="text"
                  placeholder="Search repositories..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-blue-500/50 transition-all"
                />
              </div>
              <div className="overflow-y-auto flex-1 px-3 py-3">
                {loadingRepos ? (
                  <div className="flex items-center justify-center py-12">
                    <motion.div animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.5, repeat: Infinity }} className="text-slate-400 text-sm">
                      Loading repositories...
                    </motion.div>
                  </div>
                ) : filteredRepos.length === 0 ? (
                  <p className="text-center text-slate-500 text-sm py-8">No repositories found</p>
                ) : (
                  filteredRepos.map((repo) => {
                    const alreadyConnected = connectedRepos.some((r) => r.githubRepoId === repo.githubRepoId);
                    return (
                      <div key={repo.githubRepoId} className="flex items-center justify-between px-3 py-3 rounded-xl hover:bg-white/[0.04] transition-all">
                        <div className="flex-1 min-w-0 mr-3">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-white truncate">{repo.fullName}</p>
                            {repo.isPrivate && <span className="text-[9px] bg-slate-700 text-slate-400 px-1.5 py-0.5 rounded-full shrink-0">private</span>}
                          </div>
                          {repo.description && <p className="text-xs text-slate-500 mt-0.5 truncate">{repo.description}</p>}
                          <div className="flex items-center gap-2 mt-1">
                            {repo.language && <span className="text-[10px] text-slate-500">{repo.language}</span>}
                            <span className="text-[10px] text-slate-600">⭐ {repo.stars}</span>
                          </div>
                        </div>
                        <motion.button
                          whileHover={{ scale: alreadyConnected ? 1 : 1.03 }}
                          whileTap={{ scale: alreadyConnected ? 1 : 0.97 }}
                          onClick={() => !alreadyConnected && handleConnect(repo)}
                          disabled={alreadyConnected || connectingId === repo.githubRepoId}
                          className={`text-xs px-3 py-1.5 rounded-lg border transition-all cursor-pointer shrink-0 ${
                            alreadyConnected
                              ? 'bg-green-500/10 border-green-500/20 text-green-400 cursor-default'
                              : 'bg-blue-500/10 hover:bg-blue-500/20 border-blue-500/20 text-blue-400'
                          }`}
                        >
                          {alreadyConnected ? 'Connected' : connectingId === repo.githubRepoId ? 'Connecting...' : 'Connect'}
                        </motion.button>
                      </div>
                    );
                  })
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Q&A Chat Modal */}
      <AnimatePresence>
        {showChat && selectedRepo && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#0f172a] border border-white/10 rounded-2xl w-full max-w-2xl h-[80vh] flex flex-col overflow-hidden"
            >
              {/* Chat header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
                <div>
                  <h3 className="text-base font-semibold text-white">💬 Ask CodeSense</h3>
                  <p className="text-xs text-slate-400 mt-0.5">{selectedRepo.fullName} · {selectedRepo.chunkCount} chunks indexed</p>
                </div>
                <button onClick={() => setShowChat(false)} className="text-slate-400 hover:text-white text-xl cursor-pointer">×</button>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4">
                {messages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] ${msg.role === 'user' ? 'order-2' : 'order-1'}`}>
                      <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                        msg.role === 'user'
                          ? 'bg-blue-500/20 border border-blue-500/20 text-white'
                          : 'bg-white/[0.04] border border-white/[0.07] text-slate-200'
                      }`}>
                        {msg.content}
                      </div>

                      {/* Sources */}
                      {msg.sources && msg.sources.length > 0 && (
                        <div className="mt-2 flex flex-col gap-1">
                          <p className="text-[10px] text-slate-500 px-1">Sources:</p>
                          {msg.sources.map((src, j) => (
                            <div key={j} className="bg-white/[0.02] border border-white/[0.05] rounded-lg px-3 py-1.5 text-[10px] text-slate-400">
                              <span className="text-violet-400">{src.type}</span>
                              {' '}<span className="text-white font-medium">{src.name}</span>
                              {' '}in <span className="text-blue-400">{src.file}</span>
                              {' '}· lines {src.lines}
                              {' '}· <span className="text-green-400">{src.similarity}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {/* Thinking indicator */}
                {asking && (
                  <div className="flex justify-start">
                    <div className="bg-white/[0.04] border border-white/[0.07] rounded-2xl px-4 py-3">
                      <motion.div
                        animate={{ opacity: [0.4, 1, 0.4] }}
                        transition={{ duration: 1.2, repeat: Infinity }}
                        className="text-slate-400 text-sm"
                      >
                        Thinking...
                      </motion.div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="px-5 py-4 border-t border-white/5">
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleAsk()}
                    placeholder="Ask about this codebase..."
                    disabled={asking}
                    className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 outline-none focus:border-blue-500/50 transition-all disabled:opacity-50"
                  />
                  <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={handleAsk}
                    disabled={asking || !question.trim()}
                    className="bg-blue-500 hover:bg-blue-600 text-white px-5 py-3 rounded-xl text-sm font-medium transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Send
                  </motion.button>
                </div>
                <p className="text-[10px] text-slate-600 mt-2">Press Enter to send</p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Dashboard;