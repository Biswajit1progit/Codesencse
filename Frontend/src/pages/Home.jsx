import { motion } from 'framer-motion';

const features = [
  {
    icon: '🌳',
    title: 'AST-Level Parsing',
    desc: 'Understands your code at function and class boundaries — not naive line splits.',
  },
  {
    icon: '🤖',
    title: 'Agentic Reviews',
    desc: 'Multi-step agent that fetches context, runs linting, then posts structured PR comments.',
  },
  {
    icon: '💬',
    title: 'Codebase Q&A',
    desc: 'Ask anything about your repo. Get answers grounded in your actual source code.',
  },
  {
    icon: '📊',
    title: 'Eval Harness',
    desc: 'Every review is scored against a rubric. You can see how the agent improves over time.',
  },
];

const Home = () => {
  const handleGithubLogin = () => {
    window.location.href = 'http://localhost:5000/api/auth/github';
  };

  return (
    <div className="min-h-screen bg-[#020817] text-white overflow-x-hidden relative">

      {/* Background blobs — smaller on mobile */}
      <div className="absolute top-[-100px] left-[-100px] w-[300px] h-[300px] md:w-[600px] md:h-[600px] bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-100px] right-[-100px] w-[300px] h-[300px] md:w-[600px] md:h-[600px] bg-violet-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Navbar */}
      <motion.nav
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="flex items-center justify-between px-4 md:px-8 py-4 md:py-5 border-b border-white/5 backdrop-blur-sm"
      >
        <div className="flex items-center gap-2">
          <span className="text-xl md:text-2xl">⚡</span>
          <span className="text-lg md:text-xl font-bold tracking-tight">CodeSense</span>
        </div>
        <motion.button
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={handleGithubLogin}
          className="flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white px-3 md:px-4 py-2 rounded-lg text-xs md:text-sm font-medium transition-all cursor-pointer"
        >
          <GithubIcon />
          <span className="hidden sm:inline">Sign in with GitHub</span>
          <span className="sm:hidden">Sign in</span>
        </motion.button>
      </motion.nav>

      {/* Hero */}
      <div className="flex flex-col items-center justify-center text-center px-4 md:px-6 pt-14 md:pt-24 pb-12 md:pb-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.6 }}
          className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 text-blue-400 px-3 md:px-4 py-1.5 rounded-full text-[10px] md:text-xs font-semibold tracking-widest uppercase mb-5 md:mb-6"
        >
          <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse" />
          AI-Powered Code Intelligence
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.6 }}
          className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight leading-tight mb-4 md:mb-6 max-w-3xl"
        >
          Code reviews that{' '}
          <span className="bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent">
            actually understand
          </span>{' '}
          your codebase
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.6 }}
          className="text-slate-400 text-sm md:text-lg max-w-xs md:max-w-xl leading-relaxed mb-8 md:mb-10"
        >
          CodeSense connects to your GitHub repos, parses code at the AST level,
          and runs a multi-step agent to review PRs and answer questions about your codebase.
        </motion.p>

        <motion.button
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.6 }}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={handleGithubLogin}
          className="flex items-center gap-3 bg-white text-gray-900 hover:bg-gray-100 px-6 md:px-8 py-3 md:py-4 rounded-xl text-sm md:text-base font-bold shadow-lg shadow-white/10 transition-all cursor-pointer w-full sm:w-auto justify-center"
        >
          <GithubIcon color="black" />
          Get Started Free with GitHub
        </motion.button>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="text-slate-600 text-xs mt-3 md:mt-4"
        >
          No credit card required · Free for open source repos
        </motion.p>
      </div>

      {/* Features grid */}
      <div className="max-w-5xl mx-auto px-4 md:px-6 pb-16 md:pb-24 grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
        {features.map((f, i) => (
          <motion.div
            key={f.title}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 + i * 0.1, duration: 0.5 }}
            className="bg-white/[0.03] backdrop-blur-sm border border-white/[0.07] rounded-2xl p-5 md:p-6 hover:bg-white/[0.06] hover:border-white/10 transition-all"
          >
            <div className="text-2xl md:text-3xl mb-2 md:mb-3">{f.icon}</div>
            <h3 className="text-white font-semibold text-sm md:text-base mb-1">{f.title}</h3>
            <p className="text-slate-400 text-xs md:text-sm leading-relaxed">{f.desc}</p>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

const GithubIcon = ({ color = 'white' }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill={color}>
    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
  </svg>
);

export default Home;