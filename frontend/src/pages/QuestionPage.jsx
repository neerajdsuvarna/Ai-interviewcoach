import { useState, useEffect } from 'react';
import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline';
import { FiSearch, FiFilter, FiCode, FiFileText, FiCopy, FiCreditCard, FiLoader } from 'react-icons/fi'; // Add FiLoader
import { useTheme } from '../hooks/useTheme';
import Navbar from '../components/Navbar';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../supabaseClient';
import { useAuth } from '../contexts/AuthContext';


const getLevelColor = (level) => {
  switch (level) {
    case 'beginner':
      return 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800';
    case 'medium':
      return 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800';
    case 'hard':
      return 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-900/20 dark:text-gray-400 dark:border-gray-800';
  }
};

const getStrengthColor = (strength) => {
  switch (strength) {
    case 'weak':
      return 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800';
    case 'medium':
      return 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800';
    case 'strong':
      return 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-900/20 dark:text-gray-400 dark:border-gray-800';
  }
};



// ... existing mock data and helper functions ...

const SyntaxHighlightedCode = ({ code }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy code:', err);
    }
  };

  return (
    <div className="bg-gray-900 dark:bg-gray-800 rounded-xl my-4 overflow-hidden border border-gray-700 dark:border-gray-600 shadow-lg">
      <div className="flex items-center justify-between px-3 sm:px-4 py-2 sm:py-3 bg-gray-800 dark:bg-gray-700 border-b border-gray-700 dark:border-gray-600">
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            <div className="w-2 h-2 sm:w-3 sm:h-3 rounded-full bg-red-500"></div>
            <div className="w-2 h-2 sm:w-3 sm:h-3 rounded-full bg-yellow-500"></div>
            <div className="w-2 h-2 sm:w-3 sm:h-3 rounded-full bg-green-500"></div>
          </div>
          <span className="text-xs text-gray-400 dark:text-gray-500 font-mono ml-1 sm:ml-2">python</span>
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-300 dark:text-gray-500 dark:hover:text-gray-400 transition-colors px-2 py-1 rounded-lg hover:bg-gray-700 dark:hover:bg-gray-600"
        >
          <FiCopy size={12} />
          <span className="hidden sm:inline">{copied ? 'Copied!' : 'Copy'}</span>
        </button>
      </div>
      <div className="overflow-x-auto">
        <div className="p-3 sm:p-4">
          <SyntaxHighlighter
            language="python"
            style={vscDarkPlus}
            customStyle={{
              margin: 0,
              padding: 0,
              fontSize: '0.75rem',
              lineHeight: '1.4',
              backgroundColor: 'transparent',
              minWidth: '100%',
            }}
            showLineNumbers={false}
            wrapLines={true}
            wrapLongLines={true}
          >
            {code}
          </SyntaxHighlighter>
        </div>
      </div>
    </div>
  );
};

// ... rest of the component remains the same ...

const AnswerContent = ({ answer }) => {
  // Split the answer into text and code blocks
  const parts = answer.split(/(```python\n[\s\S]*?```)/);
  
  return (
    <div className="space-y-4">
      {parts.map((part, index) => {
        if (part.startsWith('```python')) {
          // Extract the code from the markdown code block
          const codeMatch = part.match(/```python\n([\s\S]*?)```/);
          if (codeMatch) {
            return <SyntaxHighlightedCode key={index} code={codeMatch[1]} />;
          }
          return null;
        } else {
          return (
            <div key={index} className="text-[var(--color-text-primary)] leading-relaxed">
              {part.split('\n').map((line, lineIndex) => (
                <p key={lineIndex} className="mb-2 text-sm sm:text-base">
                  {line}
                </p>
              ))}
            </div>
          );
        }
      })}
    </div>
  );
};

export default function QuestionsPage() {
  const { theme } = useTheme();
  const [expandedQuestions, setExpandedQuestions] = useState(new Set());
  const [filterLevel, setFilterLevel] = useState('all');
  const [filterStrength, setFilterStrength] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [isPaymentLoading, setIsPaymentLoading] = useState(false);
  // NEW: Database state
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // NEW: show who's signed in
  const [sbUser, setSbUser] = useState(null);
  const [userLoading, setUserLoading] = useState(true);

  // NEW: track payment + debug
  const [paymentId, setPaymentId] = useState(null);
  const [paymentStatus, setPaymentStatus] = useState(null);
  const [paymentDebug, setPaymentDebug] = useState([]);
  const [signatureOk, setSignatureOk] = useState(null);

  // NEW: load current Supabase user once
  useEffect(() => {
    console.log('🔍 Loading Supabase user...');
    
    // Get initial user
    const getInitialUser = async () => {
      const { data: { user }, error } = await supabase.auth.getUser();
      console.log('👤 Initial user data:', user);
      console.log('❌ Error:', error);
      setSbUser(user || null);
      setUserLoading(false);
    };
    
    getInitialUser();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log(' Auth state changed:', event, session?.user?.email);
        setSbUser(session?.user || null);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

    // NEW: Fetch questions from database
    useEffect(() => {
      const fetchQuestions = async () => {
        try {
          setLoading(true);
          setError(null);
  
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) {
            throw new Error('No active session');
          }
  
          const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
          const response = await fetch(`${supabaseUrl}/functions/v1/questions`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
              'Content-Type': 'application/json'
            }
          });
  
          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || `Failed to fetch questions: ${response.status}`);
          }
  
          const result = await response.json();
          console.log('[DEBUG] Fetched questions:', result);
          setQuestions(result.data || []);
  
        } catch (error) {
          console.error('Error fetching questions:', error);
          setError(error.message);
        } finally {
          setLoading(false);
        }
      };
  
      fetchQuestions();
    }, []);

  // Group questions by question_text to show all strength levels together
  const groupedQuestions = questions.reduce((acc, item) => {
    const questionKey = item.question_text; // Use question_text as the key
    
    if (!acc[questionKey]) {
      acc[questionKey] = {
        question_id: item.id, // Use database ID
        question: item.question_text,
        level: item.difficulty_category, // Map from database field
        answers: []
      };
    }
    
    acc[questionKey].answers.push({
      strength: item.difficulty_experience, // Map from database field
      answer: item.expected_answer || 'No answer provided'
    });
    
    return acc;
  }, {});

  const filteredQuestions = Object.values(groupedQuestions).filter(q => {
    const matchesLevel = filterLevel === 'all' || q.level === filterLevel;
    const matchesSearch = q.question.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesLevel && matchesSearch;
  });

  const toggleQuestion = (questionId) => {
    const newExpanded = new Set(expandedQuestions);
    if (newExpanded.has(questionId)) {
      newExpanded.delete(questionId);
    } else {
      newExpanded.add(questionId);
    }
    setExpandedQuestions(newExpanded);
  };
  const { user } = useAuth();
  const handlePayment = async () => {
    setIsPaymentLoading(true);
    
    try {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error || !user) {
        console.error("User not logged in or fetch error:", error);
        return;
      }

      // Get access token for API calls
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        console.error("No access token available");
        return;
      }

      // Step 1: Create payment intent in our database
      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL;
      const paymentIntentResponse = await fetch(`${apiBaseUrl}/create-payment-intent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          amount: 9.99, // Set your payment amount
          interview_id: null // Optional: pass interview_id if available
        })
      });

      if (!paymentIntentResponse.ok) {
        throw new Error('Failed to create payment intent');
      }

      const paymentIntentData = await paymentIntentResponse.json();
      console.log('Payment intent created:', paymentIntentData);

      // Step 2: Redirect to Dodo checkout with our transaction ID
      const redirectUrl = encodeURIComponent(`${window.location.origin}/interview`);
      const checkoutUrl = `https://test.checkout.dodopayments.com/buy/pdt_ZysPWYwaLlqpLOyatwjHv?quantity=1&redirect_url=${redirectUrl}&metadata[user_id]=${encodeURIComponent(user.id)}&metadata[email]=${encodeURIComponent(user.email)}&metadata[transaction_id]=${encodeURIComponent(paymentIntentData.transaction_id)}`;

      // Store transaction ID for status checking
      setPaymentId(paymentIntentData.transaction_id);
      
      // Redirect to checkout
      window.location.href = checkoutUrl;

    } catch (error) {
      console.error('Payment initiation failed:', error);
      alert('Failed to initiate payment. Please try again.');
    } finally {
      setIsPaymentLoading(false);
    }
  };
  
  
  
  const pollPaymentStatus = async (transactionId, accessToken) => {
    try {
      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL;
      const res = await fetch(`${apiBaseUrl}/check-payment-status?transaction_id=${transactionId}`, {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });
      const data = await res.json();

      if (!res.ok || !data.success) return;

      setPaymentStatus(data.status || null);
      setSignatureOk(
        typeof data.signature_ok === 'boolean' ? data.signature_ok : null
      );

      if (Array.isArray(data.debug)) {
        setPaymentDebug(data.debug);
      }

      if (['succeeded', 'failed', 'cancelled'].includes(data.status)) {
        // stop polling
        return;
      }
      // continue polling
      setTimeout(() => pollPaymentStatus(transactionId, accessToken), 1500);
    } catch (err) {
      console.error('Status check error:', err);
      setTimeout(() => pollPaymentStatus(transactionId, accessToken), 2500);
    }
  };

  

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text-primary)] px-3 sm:px-4 py-6 sm:py-8 md:py-12 lg:py-16 flex justify-center">
        <div className="w-full max-w-6xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="text-center mb-8 sm:mb-10"
          >
            <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-extrabold tracking-tight text-[var(--color-primary)] mb-3 sm:mb-4">
              Interview Questions & Answers
            </h1>
            <p className="text-sm sm:text-base md:text-lg text-[var(--color-text-secondary)] max-w-2xl mx-auto leading-relaxed px-2 mb-6">
              Review generated questions and sample answers for your interview preparation
            </p>
            
            {/* Payment Button - OPTIMAL LOCATION */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.2 }}
              className="flex justify-center"
            >
              <button
                onClick={handlePayment}
                disabled={isPaymentLoading}
                className={`inline-flex items-center gap-2 px-6 py-3 sm:px-8 sm:py-4 text-sm sm:text-base font-semibold rounded-xl sm:rounded-2xl transition-all duration-200 transform hover:scale-105 ${
                  isPaymentLoading
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-gradient-to-r from-[var(--color-primary)] to-purple-600 hover:from-purple-600 hover:to-[var(--color-primary)] text-white shadow-lg hover:shadow-xl'
                }`}
              >
                <FiCreditCard className="w-4 h-4 sm:w-5 sm:h-5" />
                {isPaymentLoading ? 'Processing...' : 'Pay Now'}
              </button>

              {/* Logged in Supabase user */}
              <div className="mt-4 text-sm text-[var(--color-text-secondary)]">
                {userLoading ? (
                  <div className="text-[var(--color-text-secondary)]">Loading user...</div>
                ) : sbUser ? (
                  <div className="inline-flex flex-col items-start gap-1 rounded-lg border border-[var(--color-border)] px-3 py-2 bg-[var(--color-card)]">
                    <span>Signed in as:</span>
                    <code className="text-xs opacity-80">
                      {sbUser.email} · user_id: {sbUser.id}
                    </code>
                  </div>
                ) : (
                  <div className="text-[var(--color-text-secondary)]">Not signed in</div>
                )}
              </div>
            </motion.div>

            {/* Payment Debug Panel */}
            {(paymentId || paymentStatus || paymentDebug.length > 0) && (
              <div className="mt-6 w-full max-w-4xl mx-auto text-left bg-[var(--color-card)] border border-[var(--color-border)] rounded-2xl p-4">
                <div className="text-sm mb-2">
                  <strong>Payment ID:</strong> {paymentId || '—'}
                </div>
                <div className="text-sm mb-2">
                  <strong>Status:</strong> {paymentStatus || 'created/processing'}
                </div>
                <div className="text-sm mb-2">
                  <strong>Signature match:</strong>{' '}
                  {signatureOk === null ? 'pending' : signatureOk ? 'true' : 'false'}
                </div>
                <div className="text-sm">
                  <strong>Debug log:</strong>
                  <pre className="mt-2 text-xs whitespace-pre-wrap leading-relaxed">
                    {paymentDebug.join('\n')}
                  </pre>
                </div>
              </div>
            )}
          </motion.div>

          {/* Filters */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
            className="bg-[var(--color-card)] rounded-xl sm:rounded-2xl lg:rounded-3xl shadow-lg sm:shadow-xl lg:shadow-2xl border border-[var(--color-border)] p-4 sm:p-6 lg:p-8 mb-6 sm:mb-8"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="sm:col-span-2 lg:col-span-1">
                <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-2 flex items-center">
                  <FiSearch className="mr-2" size={16} />
                  Search Questions
                </label>
                <input
                  type="text"
                  placeholder="Search questions..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-3 sm:px-4 py-2 sm:py-3 border border-[var(--color-border)] rounded-lg sm:rounded-xl bg-[var(--color-input-bg)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition-colors text-sm sm:text-base"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-2 flex items-center">
                  <FiFilter className="mr-2" size={16} />
                  Difficulty Level
                </label>
                <select
                  value={filterLevel}
                  onChange={(e) => setFilterLevel(e.target.value)}
                  className="w-full px-3 sm:px-4 py-2 sm:py-3 border border-[var(--color-border)] rounded-lg sm:rounded-xl bg-[var(--color-input-bg)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition-colors text-sm sm:text-base"
                >
                  <option value="all">All Levels</option>
                  <option value="beginner">Beginner</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-2 flex items-center">
                  <FiFilter className="mr-2" size={16} />
                  Answer Strength
                </label>
                <select
                  value={filterStrength}
                  onChange={(e) => setFilterStrength(e.target.value)}
                  className="w-full px-3 sm:px-4 py-2 sm:py-3 border border-[var(--color-border)] rounded-lg sm:rounded-xl bg-[var(--color-input-bg)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition-colors text-sm sm:text-base"
                >
                  <option value="all">All Strengths</option>
                  <option value="weak">Weak</option>
                  <option value="medium">Medium</option>
                  <option value="strong">Strong</option>
                </select>
              </div>
            </div>
          </motion.div>

          {/* Questions List */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.2 }}
            className="space-y-4 sm:space-y-6"
          >
            {loading ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="text-center py-12 sm:py-16"
              >
                <FiLoader className="w-12 h-12 sm:w-16 sm:h-16 text-[var(--color-text-secondary)] mx-auto mb-4 sm:mb-6 animate-spin" />
                <p className="text-[var(--color-text-secondary)] text-base sm:text-lg mb-2">Loading questions...</p>
              </motion.div>
            ) : error ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="text-center py-12 sm:py-16"
              >
                <FiFileText className="w-12 h-12 sm:w-16 sm:h-16 text-[var(--color-text-secondary)] mx-auto mb-4 sm:mb-6" />
                <p className="text-[var(--color-text-secondary)] text-base sm:text-lg mb-2">Error loading questions</p>
                <p className="text-[var(--color-text-secondary)] text-sm">{error}</p>
              </motion.div>
            ) : (
              <AnimatePresence>
                // Replace this section in the questions mapping:
                {filteredQuestions.map((questionGroup, index) => (
                  <motion.div
                    key={questionGroup.question_id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.3, delay: index * 0.1 }}
                    className="bg-[var(--color-card)] rounded-xl sm:rounded-2xl lg:rounded-3xl shadow-lg sm:shadow-xl lg:shadow-2xl border border-[var(--color-border)] overflow-hidden"
                  >
                    <div 
                      className="p-4 sm:p-6 lg:p-8 cursor-pointer hover:bg-[var(--color-input-bg)] transition-colors"
                      onClick={() => toggleQuestion(questionGroup.question_id)}
                    >
                      <div className="flex items-start sm:items-center justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
                            <span className="text-xs sm:text-sm font-medium text-[var(--color-text-secondary)] bg-[var(--color-input-bg)] px-2 sm:px-4 py-1 sm:py-2 rounded-lg sm:rounded-xl">
                              Q{index + 1}
                            </span>
                            <span className={`px-2 sm:px-4 py-1 sm:py-2 text-xs sm:text-sm font-medium rounded-lg sm:rounded-xl border ${getLevelColor(questionGroup.level)}`}>
                              {questionGroup.level}
                            </span>
                          </div>
                          <h3 className="text-base sm:text-lg lg:text-xl font-semibold text-[var(--color-text-primary)] leading-relaxed">
                            {questionGroup.question}
                          </h3>
                        </div>
                        <div className="flex-shrink-0">
                          {expandedQuestions.has(questionGroup.question_id) ? (
                            <ChevronUpIcon className="h-5 w-5 sm:h-6 sm:w-6 text-[var(--color-text-secondary)]" />
                          ) : (
                            <ChevronDownIcon className="h-5 w-5 sm:h-6 sm:w-6 text-[var(--color-text-secondary)]" />
                          )}
                        </div>
                      </div>
                    </div>
   
                    
                    <AnimatePresence>
                      {expandedQuestions.has(questionGroup.question_id) && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.3 }}
                          className="px-4 sm:px-6 lg:px-8 pb-4 sm:pb-6 lg:pb-8 border-t border-[var(--color-border)]"
                        >
                          <div className="mt-4 sm:mt-6 space-y-4 sm:space-y-6">
                            {questionGroup.answers
                              .filter(answer => filterStrength === 'all' || answer.strength === filterStrength)
                              .map((answer, answerIndex) => (
                                <motion.div
                                  key={answerIndex}
                                  initial={{ opacity: 0, y: 20 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  transition={{ duration: 0.3, delay: answerIndex * 0.1 }}
                                  className="bg-[var(--color-input-bg)] rounded-lg sm:rounded-xl p-4 sm:p-6 border border-[var(--color-border)]"
                                >
                                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0 mb-3 sm:mb-4">
                                    <h4 className="text-sm font-medium text-[var(--color-text-primary)] flex items-center">
                                      <FiCode className="mr-2" size={16} />
                                      Answer ({answer.strength})
                                    </h4>
                                    <span className={`px-3 sm:px-4 py-1 sm:py-2 text-xs sm:text-sm font-medium rounded-lg sm:rounded-xl border ${getStrengthColor(answer.strength)}`}>
                                      {answer.strength}
                                    </span>
                                  </div>
                                  <div className="bg-[var(--color-card)] rounded-lg sm:rounded-xl p-3 sm:p-6 border border-[var(--color-border)]">
                                    <AnswerContent answer={answer.answer} />
                                  </div>
                                </motion.div>
                              ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                ))}
              </AnimatePresence>
            )}

            {!loading && !error && filteredQuestions.length === 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="text-center py-12 sm:py-16"
              >
                <FiFileText className="w-12 h-12 sm:w-16 sm:h-16 text-[var(--color-text-secondary)] mx-auto mb-4 sm:mb-6" />
                <p className="text-[var(--color-text-secondary)] text-base sm:text-lg mb-2">No questions found matching your criteria.</p>
                <p className="text-[var(--color-text-secondary)] text-sm">Try adjusting your filters or search terms.</p>
              </motion.div>
            )}
          </motion.div>
        </div>
      </div>
    </>
  );
}