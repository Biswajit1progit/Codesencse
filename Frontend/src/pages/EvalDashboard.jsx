import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import apiClient from '../api/apiClient';

const MetricCard = ({ label, value, unit = '', color = 'blue', delay = 0 }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay }}
    className="bg-white/[0.03] backdrop-blur-sm border border-white/[0.07] rounded-2xl p-5"
  >
    <p className="text-xs text-slate-500 mb-2">{label}</p>
    <p className={`text-3xl font-bold ${
      color === 'green' ? 'text-green-400' :
      color === 'blue' ? 'text-blue-400' :
      color === 'violet' ? 'text-violet-400' :
      color === 'orange' ? 'text-orange-400' :
      'text-white'
    }`}>
      {typeof value === 'number' ? value.toFixed(1) : value}{unit}
    </p>
  </motion.div>
);

const BarChart = ({ data, valueKey, labelKey, color = '#3b82f6', max = 1 }) => {
  if (!data || data.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      {data.map((item, i) => (
        <div key={i} className="flex items-center gap-3">
          <span className="text-[10px] text-slate-400 w-24 shrink-0 truncate">
            {item[labelKey]}
          </span>
          <div className="flex-1 bg-white/5 rounded-full h-2 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${(item[valueKey] / max) * 100}%` }}
              transition={{ delay: i * 0.05, duration: 0.5 }}
              className="h-full rounded-full"
              style={{ background: color }}
            />
          </div>
          <span className="text-[10px] text-slate-400 w-10 text-right shrink-0">
            {(item[valueKey] * 100).toFixed(0)}%
          </span>
        </div>
      ))}
    </div>
  );
};

const RubricBar = ({ label, value, delay = 0 }) => (
  <motion.div
    initial={{ opacity: 0, x: -10 }}
    animate={{ opacity: 1, x: 0 }}
    transition={{ delay }}
    className="flex items-center gap-3"
  >
    <span className="text-xs text-slate-400 w-36 shrink-0">{label}</span>
    <div className="flex-1 bg-white/5 rounded-full h-2 overflow-hidden">
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${(value / 10) * 100}%` }}
        transition={{ delay: delay + 0.1, duration: 0.5 }}
        className="h-full rounded-full bg-violet-400"
      />
    </div>
    <span className="text-xs text-slate-300 w-10 text-right shrink-0 font-medium">
      {value.toFixed(1)}/10
    </span>
  </motion.div>
);

const EvalDashboard = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [summary, setSummary] = useState(null);
  const [cases, setCases] = useState([]);
  const [loadingData, setLoadingData] = useState(true);
  const [activeTab, setActiveTab] = useState('retrieval');

  // Run evals state
  const [evalRunning, setEvalRunning] = useState(false);
  const [evalStep, setEvalStep] = useState('');
  const [evalProgress, setEvalProgress] = useState({ progress: 0, total: 0 });

  useEffect(() => {
    if (!loading && !user) navigate('/');
  }, [user, loading]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [summaryRes, casesRes] = await Promise.all([
          apiClient.get('/evals/summary'),
          apiClient.get('/evals/cases'),
        ]);
        setSummary(summaryRes.data);
        setCases(casesRes.data.cases);
      } catch (err) {
        console.error('Failed to fetch eval data:', err.message);
      } finally {
        setLoadingData(false);
      }
    };
    if (user) fetchData();
  }, [user]);

  const handleRunEvals = async () => {
    try {
      setEvalRunning(true);
      setEvalStep('Starting...');
      await apiClient.post('/evals/run');

      // Poll for progress every 3 seconds
      const poll = setInterval(async () => {
        try {
          const { data } = await apiClient.get('/evals/status');
          setEvalStep(data.step);
          setEvalProgress({ progress: data.progress, total: data.total });

          if (!data.running) {
            clearInterval(poll);
            setEvalRunning(false);
            setEvalStep('');
            setEvalProgress({ progress: 0, total: 0 });

            // Refresh data after eval completes
            const [summaryRes, casesRes] = await Promise.all([
              apiClient.get('/evals/summary'),
              apiClient.get('/evals/cases'),
            ]);
            setSummary(summaryRes.data);
            setCases(casesRes.data.cases);
          }
        } catch {
          clearInterval(poll);
          setEvalRunning(false);
          setEvalStep('');
        }
      }, 3000);
    } catch (err) {
      console.error('Failed to start eval:', err.message);
      setEvalRunning(false);
      setEvalStep('');
    }
  };

  const refreshData = async () => {
    try {
      const [summaryRes, casesRes] = await Promise.all([
        apiClient.get('/evals/summary'),
        apiClient.get('/evals/cases'),
      ]);
      setSummary(summaryRes.data);
      setCases(casesRes.data.cases);
    } catch (err) {
      console.error('Failed to refresh:', err.message);
    }
  };

  if (loading || loadingData) return (
    <div className="min-h-screen bg-[#020817] flex items-center justify-center">
      <motion.div
        animate={{ opacity: [0.4, 1, 0.4] }}
        transition={{ duration: 1.5, repeat: Infinity }}
        className="text-slate-400"
      >
        Loading eval data...
      </motion.div>
    </div>
  );

  const retrievalCases = cases.filter(c => c.type === 'retrieval');
  const reviewCases = cases.filter(c => c.type === 'review');

  return (
    <div className="min-h-screen bg-[#020817] text-white overflow-x-hidden">

      <div className="absolute top-[-100px] right-[-100px] w-[400px] h-[400px] bg-violet-600/8 rounded-full blur-3xl pointer-events-none" />

      {/* Navbar */}
      <motion.nav
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="flex items-center justify-between px-4 md:px-8 py-4 border-b border-white/5 backdrop-blur-sm"
      >
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/dashboard')}
            className="text-slate-400 hover:text-white text-sm transition-all cursor-pointer"
          >
            ← Dashboard
          </button>
          <div className="flex items-center gap-2">
            <span className="text-xl">📊</span>
            <span className="text-lg font-bold tracking-tight">Eval Dashboard</span>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2">
          <img src={user?.avatarUrl} alt="" className="w-6 h-6 rounded-full" />
          <span className="text-xs text-slate-300 hidden sm:inline">{user?.username}</span>
        </div>
      </motion.nav>

      <div className="max-w-6xl mx-auto px-4 md:px-6 py-8">

        {/* Header with Run Evals button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 flex items-start justify-between gap-4"
        >
          <div>
            <h1 className="text-2xl font-bold mb-1">Eval Harness</h1>
            <p className="text-slate-400 text-sm">
              {cases.length} labeled eval cases · measuring retrieval precision/recall and review quality
            </p>
            {evalRunning && (
              <motion.p
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="text-xs text-blue-400 mt-2"
              >
                🔄 {evalStep}
                {evalProgress.total > 0 && ` (${evalProgress.progress}/${evalProgress.total})`}
              </motion.p>
            )}
          </div>

          <motion.button
            whileHover={{ scale: evalRunning ? 1 : 1.03 }}
            whileTap={{ scale: evalRunning ? 1 : 0.97 }}
            onClick={handleRunEvals}
            disabled={evalRunning}
            className={`shrink-0 text-sm px-5 py-2.5 rounded-xl border font-medium transition-all cursor-pointer ${
              evalRunning
                ? 'bg-white/[0.03] border-white/[0.07] text-slate-500 cursor-not-allowed'
                : 'bg-blue-500/10 hover:bg-blue-500/20 border-blue-500/20 text-blue-400'
            }`}
          >
            {evalRunning ? '⏳ Running...' : '▶ Run Evals'}
          </motion.button>
        </motion.div>

        {/* Top metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          <MetricCard
            label="Avg Precision@8"
            value={(summary?.retrieval?.avgPrecision || 0) * 100}
            unit="%"
            color="blue"
            delay={0.1}
          />
          <MetricCard
            label="Avg Recall@8"
            value={(summary?.retrieval?.avgRecall || 0) * 100}
            unit="%"
            color="green"
            delay={0.15}
          />
          <MetricCard
            label="Review Quality"
            value={summary?.review?.avgOverallScore || 0}
            unit="/10"
            color="violet"
            delay={0.2}
          />
          <MetricCard
            label="Verdict Accuracy"
            value={summary?.review?.rubricAvgs?.verdictCorrect || 0}
            unit="/10"
            color="orange"
            delay={0.25}
          />
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          {['retrieval', 'review', 'cases'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`text-xs px-4 py-2 rounded-lg border transition-all cursor-pointer capitalize ${
                activeTab === tab
                  ? 'bg-blue-500/20 border-blue-500/30 text-blue-300'
                  : 'bg-white/[0.03] border-white/[0.07] text-slate-400 hover:text-white'
              }`}
            >
              {tab === 'retrieval' ? '🔍 Retrieval' :
               tab === 'review' ? '🤖 Review Quality' :
               '📋 All Cases'}
            </button>
          ))}
        </div>

        {/* Retrieval tab */}
        {activeTab === 'retrieval' && (
          <div className="flex flex-col gap-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-6"
            >
              <h2 className="text-sm font-semibold text-white mb-1">Precision by Tag</h2>
              <p className="text-xs text-slate-500 mb-5">
                Of the top-8 chunks returned, what % are actually relevant
              </p>
              <BarChart
                data={summary?.retrieval?.tagBreakdown || []}
                valueKey="precision"
                labelKey="tag"
                color="#3b82f6"
                max={1}
              />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-6"
            >
              <h2 className="text-sm font-semibold text-white mb-1">Recall by Tag</h2>
              <p className="text-xs text-slate-500 mb-5">
                Of all relevant chunks, what % appeared in the top-8 results
              </p>
              <BarChart
                data={summary?.retrieval?.tagBreakdown || []}
                valueKey="recall"
                labelKey="tag"
                color="#22c55e"
                max={1}
              />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-6"
            >
              <h2 className="text-sm font-semibold text-white mb-4">Retrieval Cases</h2>
              <div className="flex flex-col gap-2">
                {retrievalCases.map((c) => (
                  <div key={c.id} className="flex items-center justify-between bg-white/[0.02] border border-white/[0.05] rounded-xl px-4 py-3">
                    <div className="flex-1 min-w-0 mr-4">
                      <p className="text-xs text-white truncate">{c.query}</p>
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {c.tags.map(tag => (
                          <span key={tag} className="text-[9px] bg-slate-700/50 text-slate-400 px-1.5 py-0.5 rounded">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-4 shrink-0 text-xs">
                      <div className="text-center">
                        <p className="text-[10px] text-slate-500">Precision</p>
                        <p className="text-blue-400 font-medium">
                          {c.latestPrecision != null ? `${(c.latestPrecision * 100).toFixed(0)}%` : '—'}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-[10px] text-slate-500">Recall</p>
                        <p className="text-green-400 font-medium">
                          {c.latestRecall != null ? `${(c.latestRecall * 100).toFixed(0)}%` : '—'}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-[10px] text-slate-500">Runs</p>
                        <p className="text-slate-300 font-medium">{c.runCount}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        )}

        {/* Review quality tab */}
        {activeTab === 'review' && (
          <div className="flex flex-col gap-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-6"
            >
              <h2 className="text-sm font-semibold text-white mb-1">Rubric Scores</h2>
              <p className="text-xs text-slate-500 mb-6">
                Average across {summary?.review?.totalCases} review eval cases
              </p>
              <div className="flex flex-col gap-4">
                <RubricBar label="Caught Real Issues" value={summary?.review?.rubricAvgs?.caughtRealIssues || 0} delay={0.05} />
                <RubricBar label="Low False Positives" value={summary?.review?.rubricAvgs?.falsePositives || 0} delay={0.1} />
                <RubricBar label="Specificity" value={summary?.review?.rubricAvgs?.specificity || 0} delay={0.15} />
                <RubricBar label="Actionability" value={summary?.review?.rubricAvgs?.actionability || 0} delay={0.2} />
                <RubricBar label="Verdict Accuracy" value={summary?.review?.rubricAvgs?.verdictCorrect || 0} delay={0.25} />
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-6"
            >
              <h2 className="text-sm font-semibold text-white mb-4">Review Cases</h2>
              <div className="flex flex-col gap-2">
                {reviewCases.map((c) => (
                  <div key={c.id} className="flex items-center justify-between bg-white/[0.02] border border-white/[0.05] rounded-xl px-4 py-3">
                    <div className="flex-1 min-w-0 mr-4">
                      <p className="text-xs text-white truncate">{c.query}</p>
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {c.tags.map(tag => (
                          <span key={tag} className="text-[9px] bg-slate-700/50 text-slate-400 px-1.5 py-0.5 rounded">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-4 shrink-0 text-xs">
                      <div className="text-center">
                        <p className="text-[10px] text-slate-500">Score</p>
                        <p className={`font-medium ${
                          (c.latestScore || 0) >= 8 ? 'text-green-400' :
                          (c.latestScore || 0) >= 6 ? 'text-yellow-400' :
                          'text-red-400'
                        }`}>
                          {c.latestScore != null ? `${c.latestScore.toFixed(1)}/10` : '—'}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-[10px] text-slate-500">Runs</p>
                        <p className="text-slate-300 font-medium">{c.runCount}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        )}

        {/* All cases tab */}
        {activeTab === 'cases' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-6"
          >
            <h2 className="text-sm font-semibold text-white mb-4">
              All Eval Cases ({cases.length})
            </h2>
            <div className="flex flex-col gap-2">
              {cases.map((c) => (
                <div key={c.id} className="flex items-center justify-between bg-white/[0.02] border border-white/[0.05] rounded-xl px-4 py-3">
                  <div className="flex items-center gap-3 flex-1 min-w-0 mr-4">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full border shrink-0 ${
                      c.type === 'retrieval'
                        ? 'bg-blue-500/10 border-blue-500/20 text-blue-400'
                        : 'bg-violet-500/10 border-violet-500/20 text-violet-400'
                    }`}>
                      {c.type}
                    </span>
                    <p className="text-xs text-white truncate">{c.query}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 text-xs">
                    {c.type === 'retrieval' ? (
                      <>
                        <span className="text-blue-400">
                          P: {c.latestPrecision != null ? `${(c.latestPrecision * 100).toFixed(0)}%` : '—'}
                        </span>
                        <span className="text-green-400">
                          R: {c.latestRecall != null ? `${(c.latestRecall * 100).toFixed(0)}%` : '—'}
                        </span>
                      </>
                    ) : (
                      <span className={`font-medium ${
                        (c.latestScore || 0) >= 8 ? 'text-green-400' :
                        (c.latestScore || 0) >= 6 ? 'text-yellow-400' :
                        'text-red-400'
                      }`}>
                        {c.latestScore != null ? `${c.latestScore.toFixed(1)}/10` : '—'}
                      </span>
                    )}
                    <span className="text-slate-600 text-[10px]">{c.runCount} runs</span>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

      </div>
    </div>
  );
};

export default EvalDashboard;