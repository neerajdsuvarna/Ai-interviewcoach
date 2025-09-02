import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import Navbar from '../components/Navbar';
import UploadBox from '../components/upload/UploadBox';
import { FiTrash2, FiLoader, FiFileText, FiCheck } from 'react-icons/fi';
import { useTheme } from '../hooks/useTheme';
import { motion, AnimatePresence } from 'framer-motion';
import { uploadFile } from '../api';

function UploadPage() {
  const { theme } = useTheme();
  const navigate = useNavigate();

  const [resume, setResume] = useState(null);
  const [jobDesc, setJobDesc] = useState(null);
  const [resumeError, setResumeError] = useState('');
  const [jobDescError, setJobDescError] = useState('');
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [jobTitle, setJobTitle] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [parsingJobDesc, setParsingJobDesc] = useState(false);
  const [jobDescParsed, setJobDescParsed] = useState(false);
  const [clearCounter, setClearCounter] = useState(0);

  const handleClearAll = () => {
    setResume(null);
    setJobDesc(null);
    setResumeError('');
    setJobDescError('');
    setJobTitle('');
    setJobDescription('');
    setJobDescParsed(false);
    setClearCounter(prev => prev + 1); // Increment counter to force re-render
  };

  const handleJobDescUpload = async (file) => {
    setJobDesc(file);
    setJobDescError('');
    setJobDescParsed(false);
    
    // Automatically parse the job description file
    await parseJobDescriptionFile(file);
  };

  const parseJobDescriptionFile = async (file) => {
    setParsingJobDesc(true);
    
    try {
      console.log('[DEBUG] Starting job description parsing...');
      console.log('[DEBUG] File:', file.name, file.size, file.type);
      
      // Create FormData for file upload
      const formData = new FormData();
      formData.append('file', file);

      console.log('[DEBUG] Making API call to parse job description...');

      // Use the uploadFile helper function with correct endpoint
      const result = await uploadFile('/api/parse-job-description', formData);

      console.log('[DEBUG] Response result:', result);

      if (!result.success) {
        throw new Error(result.message || 'Failed to parse job description');
      }

      // Populate the fields with parsed data
      setJobTitle(result.data.job_title || '');
      setJobDescription(result.data.job_description || '');
      setJobDescParsed(true);
      
      console.log('[DEBUG] Fields populated successfully');

    } catch (error) {
      console.error('Error parsing job description:', error);
      setJobDescError(`Failed to parse job description: ${error.message}`);
      setJobDescParsed(false);
    } finally {
      setParsingJobDesc(false);
    }
  };

  const uploadFileToStorage = async (file, bucket, folder) => {
    try {
      // Use the Supabase edge function URL directly
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'http://127.0.0.1:54321';
      const edgeFunctionUrl = `${supabaseUrl}/functions/v1/upload-file`;
      
      // Get current user session
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('No active session');
      }
      
      // Create FormData for file upload
      const formData = new FormData();
      formData.append('file', file);
      formData.append('bucket', bucket);
      formData.append('folder', folder);
      
      console.log('[DEBUG] Uploading to edge function:', edgeFunctionUrl);
      console.log('[DEBUG] Bucket:', bucket, 'Folder:', folder);
      
      const response = await fetch(edgeFunctionUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          // Don't set Content-Type for FormData - browser will set it automatically
        },
        body: formData
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || errorData.message || `Upload failed: ${response.status}`);
      }
      
      const result = await response.json();
      console.log('[DEBUG] Upload result:', result);
      
      if (!result.success) {
        throw new Error(result.error || 'Upload failed');
      }
      
      return result.data.public_url;
    } catch (error) {
      console.error('Upload error:', error);
      throw error;
    }
  };

  const saveToDatabase = async (resumeUrl, jobDescUrl) => {
    try {
      console.log('[DEBUG] Saving to database...');
      
      // Get current user session
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('No active session');
      }

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      
      // 1. Save resume to database
      console.log('[DEBUG] Saving resume...');
      const resumeResponse = await fetch(`${supabaseUrl}/functions/v1/resumes`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          file_url: resumeUrl,
          file_name: resume.name
        })
      });

      if (!resumeResponse.ok) {
        const errorData = await resumeResponse.json();
        throw new Error(`Failed to save resume: ${errorData.message || 'Unknown error'}`);
      }

      const resumeData = await resumeResponse.json();
      console.log('[DEBUG] Resume saved:', resumeData.data.id);

      // 2. Save job description to database
      console.log('[DEBUG] Saving job description...');
      const jdResponse = await fetch(`${supabaseUrl}/functions/v1/job-descriptions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: jobTitle,
          description: jobDescription,
          file_url: jobDescUrl
        })
      });

      if (!jdResponse.ok) {
        const errorData = await jdResponse.json();
        throw new Error(`Failed to save job description: ${errorData.message || 'Unknown error'}`);
      }

      const jdData = await jdResponse.json();
      console.log('[DEBUG] Job description saved:', jdData.data.id);

      return {
        resumeId: resumeData.data.id,
        jdId: jdData.data.id
      };

    } catch (error) {
      console.error('Error saving to database:', error);
      throw error;
    }
  };

  const handleGenerateQuestions = async (e) => {
    e.preventDefault();
    
    if (!resume || !jobTitle.trim() || !jobDescription.trim()) {
      alert('Please upload a resume and ensure job title and description are filled.');
      return;
    }

    setLoading(true);

    try {
      console.log('[DEBUG] Starting complete workflow...');

      // Step 1: Upload resume file to Supabase Storage
      console.log('[DEBUG] Step 1: Uploading resume to storage...');
      const resumeUrl = await uploadFileToStorage(resume, 'resumes', 'user_files');

      // Step 2: Save resume and job description to database
      console.log('[DEBUG] Step 2: Saving to database...');
      const { resumeId, jdId } = await saveToDatabase(resumeUrl, resumeUrl);

      // Step 3: Generate questions using backend API
      console.log('[DEBUG] Step 3: Generating questions...');
      const questionsResult = await generateQuestionsFromBackend(resumeUrl, jobTitle, jobDescription);
      
      if (!questionsResult.success) {
        throw new Error(`Failed to generate questions: ${questionsResult.message}`);
      }

      // Step 4: Save questions to database via edge function
      console.log('[DEBUG] Step 4: Saving questions to database...');
      const questionsSaveResult = await saveQuestionsToDatabase(
        resumeId, 
        jdId, 
        questionsResult.data.questions
      );

      if (!questionsSaveResult.success) {
        throw new Error(`Failed to save questions: ${questionsSaveResult.message}`);
      }

      // Step 5: Show success message and redirect
      console.log('[DEBUG] Step 5: Process completed successfully!');
      console.log('[DEBUG] Resume ID:', resumeId);
      console.log('[DEBUG] Job Description ID:', jdId);
      console.log('[DEBUG] Questions saved:', questionsSaveResult.data.length);
      
      // Get the question set number from the saved questions
      const savedQuestionSet = questionsSaveResult.data[0]?.question_set || 'unknown';
      
      // Count unique questions by grouping by question_text
      const uniqueQuestions = questionsSaveResult.data.reduce((acc, item) => {
        if (!acc.has(item.question_text)) {
          acc.add(item.question_text);
        }
        return acc;
      }, new Set());
      
      alert(`Resume, job description, and questions generated successfully!\n\nQuestion Set ${savedQuestionSet} has been created with ${uniqueQuestions.size} questions.`);
      navigate(`/questions?resume_id=${resumeId}&jd_id=${jdId}&question_set=${savedQuestionSet}`);

    } catch (error) {
      console.error('Error in complete workflow:', error);
      alert(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // New function to call backend API for question generation
  const generateQuestionsFromBackend = async (resumeUrl, jobTitle, jobDescription) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('No active session');
      }

      const backendUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';
      
      const response = await fetch(`${backendUrl}/api/generate-questions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          resume_url: resumeUrl,
          job_title: jobTitle,
          job_description: jobDescription
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Backend API error: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error calling backend API:', error);
      throw error;
    }
  };

  // New function to save questions to database via edge function
  const saveQuestionsToDatabase = async (resumeId, jdId, questions) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('No active session');
      }

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      
      // First, get the current highest question set number for this specific resume_id + jd_id combination
      const getCurrentQuestionSetsResponse = await fetch(`${supabaseUrl}/functions/v1/questions?resume_id=${resumeId}&jd_id=${jdId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!getCurrentQuestionSetsResponse.ok) {
        const errorData = await getCurrentQuestionSetsResponse.json();
        throw new Error(errorData.message || `Failed to get current question sets: ${getCurrentQuestionSetsResponse.status}`);
      }

      const currentQuestionSetsResult = await getCurrentQuestionSetsResponse.json();
      const questionsForThisCombination = currentQuestionSetsResult.data || [];
      
      // Find the highest question set number for this specific resume_id + jd_id combination
      const existingQuestionSets = questionsForThisCombination.map(q => q.question_set).filter(set => set !== null && set !== undefined);
      
      if (existingQuestionSets.length === 0) {
        console.log('[DEBUG] No existing question sets found for this resume_id + jd_id combination, starting with set 1');
        var nextQuestionSet = 1;
      } else {
        const maxSet = Math.max(...existingQuestionSets);
        nextQuestionSet = maxSet + 1;
        console.log('[DEBUG] Found existing sets for this combination, max is', maxSet, 'next will be', nextQuestionSet);
      }
      
      console.log('[DEBUG] Current question sets for resume_id', resumeId, 'and jd_id', jdId, ':', existingQuestionSets);
      console.log('[DEBUG] Next question set will be:', nextQuestionSet);
      console.log('[DEBUG] Total questions found for this combination:', questionsForThisCombination.length);
      console.log('[DEBUG] Questions by set for this combination:', existingQuestionSets.reduce((acc, set) => {
        acc[set] = (acc[set] || 0) + 1;
        return acc;
      }, {}));
      
      // Now save the new questions with the incremented question set number
      const response = await fetch(`${supabaseUrl}/functions/v1/questions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          resume_id: resumeId,
          jd_id: jdId,
          questions: questions,
          question_set: nextQuestionSet
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Failed to save questions: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error saving questions:', error);
      throw error;
    }
  };

  // Check if generate questions button should be enabled
  const canGenerateQuestions = resume && jobTitle.trim() && jobDescription.trim() && jobDescParsed && !loading && !parsingJobDesc;

  // Check if there's unsaved work that should trigger navigation warnings
  const hasUnsavedWork = resume || jobDesc || jobTitle.trim() || jobDescription.trim() || loading || parsingJobDesc;

  // Handle beforeunload event (page refresh/close)
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (hasUnsavedWork) {
        // Standard way to show browser's default "Leave Site?" dialog
        e.preventDefault();
        e.returnValue = '';
        return '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [hasUnsavedWork]);

  // Note: Back/forward navigation protection removed to use only standard browser dialog
  // The beforeunload event below handles page refresh/close with standard browser dialog



  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text-primary)] px-4 py-8 sm:py-12 md:py-16 flex justify-center">
        <div className="w-full max-w-3xl bg-[var(--color-card)] border border-[var(--color-border)] rounded-2xl sm:rounded-3xl shadow-xl sm:shadow-2xl p-6 sm:p-8 md:p-10">
          <div className="text-center mb-10">
            <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-[var(--color-primary)] mb-4">
            Prepare With Confidence
            </h1>
            <p className="text-base sm:text-lg text-[var(--color-text-secondary)] max-w-2xl mx-auto leading-relaxed">
            Upload your resume and job description to receive tailor-made interview questions.  
            We help you walk into interviews fully prepared and confident.
            </p>
          </div>
          
            <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            >
            <form onSubmit={handleGenerateQuestions} className="space-y-8">
            <UploadBox
              key={`resume-${clearCounter}`}
              label="Resume"
              accept=".pdf,.doc,.docx"
              file={resume}
              setFile={setResume}
              error={resumeError}
              setError={setResumeError}
              dragging={dragging}
              setDragging={setDragging}
              type="resume"
              otherFileExists={!!jobDesc}
            />

            <UploadBox
                key={`jobdesc-${clearCounter}`}
                label="Job Description File"
                accept=".pdf,.txt,.doc,.docx"
              file={jobDesc}
                setFile={handleJobDescUpload}
              error={jobDescError}
              setError={setJobDescError}
              dragging={dragging}
              setDragging={setDragging}
              type="job"
              otherFileExists={!!resume}
              multiple={false}
                parsing={parsingJobDesc}
              />

              {/* Job Title and Description Fields - Only show after parsing */}
              <AnimatePresence>
                {jobDescParsed && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3 }}
                    className="space-y-6"
                  >
                    {/* Success Message */}
                    <div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl">
                      <FiCheck className="w-5 h-5 text-green-600 dark:text-green-400" />
                      <span className="text-green-800 dark:text-green-200 font-medium">
                        Job description parsed successfully!
                      </span>
                    </div>

                    {/* Job Title Input */}
                    <div>
                      <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-2">
                        Job Title
                      </label>
                      <input
                        type="text"
                        value={jobTitle}
                        onChange={(e) => setJobTitle(e.target.value)}
                        placeholder="e.g., Senior Software Engineer"
                        className="w-full px-4 py-3 border border-[var(--color-border)] rounded-xl bg-[var(--color-input-bg)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition"
                        required
                      />
                    </div>

                    {/* Job Description Input */}
                    <div>
                      <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-2">
                        Job Description
                      </label>
                      <textarea
                        value={jobDescription}
                        onChange={(e) => setJobDescription(e.target.value)}
                        placeholder="Paste the job description here or upload a file to parse the job description..."
                        rows={6}
                        className="w-full px-4 py-3 border border-[var(--color-border)] rounded-xl bg-[var(--color-input-bg)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition resize-none"
                        required
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

            {(resume || jobDesc) && (
              <div className="flex justify-end">
                <button
                type="button"
                onClick={handleClearAll}
                disabled={parsingJobDesc || loading}
                className={`flex items-center gap-2 py-2 px-4 text-base border rounded-xl transition ${
                  parsingJobDesc || loading
                    ? 'text-gray-400 border-gray-300 dark:text-gray-500 dark:border-gray-600 cursor-not-allowed opacity-50'
                    : 'text-[var(--color-error)] border-[var(--color-error)] hover:bg-[var(--color-error-bg)]'
                }`}
                >
                <FiTrash2 className="w-5 h-5" />
                {parsingJobDesc ? 'Parsing...' : 'Clear All Files'}
                </button>
              </div>
            )}
              
                <button
                type="submit"
                disabled={!canGenerateQuestions}
                className="w-full py-3 text-base sm:text-lg font-semibold bg-[var(--color-primary)] text-white rounded-xl transition hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <FiLoader className="w-5 h-5 animate-spin" />
                    Generating Questions...
                  </>
                ) : (
                  'Generate Interview Questions'
                )}
                </button>
          </form>
          </motion.div>
        </div>
      </div>
    </>
  );
}

export default UploadPage;
