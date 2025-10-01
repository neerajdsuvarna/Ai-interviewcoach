import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import Navbar from '../components/Navbar';
import UploadBox from '../components/upload/UploadBox';
import { FiTrash2, FiLoader, FiFileText, FiCheck, FiSettings } from 'react-icons/fi';
import { useTheme } from '../hooks/useTheme';
import { motion, AnimatePresence } from 'framer-motion';
import { uploadFile } from '../api';
import SuccessModal from '../components/SuccessModal';
import { trackEvents } from '../services/mixpanel';

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
  const [successModal, setSuccessModal] = useState({ isOpen: false, title: '', message: '', details: null });
  const [lastCreatedIds, setLastCreatedIds] = useState({ resumeId: null, jdId: null, questionSet: null });

  // New state for question generation settings
  const [easyQuestions, setEasyQuestions] = useState(1); // ✅ Changed from 2 to 1
  const [mediumQuestions, setMediumQuestions] = useState(1); // ✅ Changed from 2 to 1
  const [hardQuestions, setHardQuestions] = useState(1); // ✅ Changed from 2 to 1
  const [splitMode, setSplitMode] = useState(false);
  const [blendMode, setBlendMode] = useState(false);
  const [splitResumePercentage, setSplitResumePercentage] = useState(50);
  const [blendResumePercentage, setBlendResumePercentage] = useState(50);
  const [questionValidationError, setQuestionValidationError] = useState('');

  useEffect(() => {
    console.log('Question counts:', { easyQuestions, mediumQuestions, hardQuestions });
    console.log('Can generate questions:', canGenerateQuestions());
  }, [easyQuestions, mediumQuestions, hardQuestions, resume, jobTitle, jobDescription, jobDescParsed, loading, parsingJobDesc, splitMode, blendMode]);

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
    
    // ✅ ADD DEBUGGING
    console.log('=== DEBUGGING QUESTION GENERATION ===');
    console.log('easyQuestions:', easyQuestions);
    console.log('mediumQuestions:', mediumQuestions);
    console.log('hardQuestions:', hardQuestions);
    console.log('splitMode:', splitMode);
    console.log('blendMode:', blendMode);
    console.log('totalQuestions:', easyQuestions + mediumQuestions + hardQuestions);
    console.log('=====================================');
    
    if (!resume || !jobTitle.trim() || !jobDescription.trim()) {
      alert('Please upload a resume and ensure job title and description are filled.');
      return;
    }

    // Validate question counts based on mode
    const totalQuestions = easyQuestions + mediumQuestions + hardQuestions;

    // Only validate when both split AND blend modes are enabled
    if (splitMode && blendMode) {
      // Both modes on - need at least 6 total questions
      if (totalQuestions < 6) {
        setQuestionValidationError('When both Split and Blend modes are enabled, you need at least 6 total questions.');
        return;
      }
    }

    // Clear any previous validation errors
    setQuestionValidationError('');

    setLoading(true);

    try {
      console.log('[DEBUG] Starting complete workflow...');

      // Step 1: Upload resume file to Supabase Storage
      console.log('[DEBUG] Step 1: Uploading resume to storage...');
      const resumeUrl = await uploadFileToStorage(resume, 'resumes', 'user_files');

      // Track resume upload
      trackEvents.resumeUploaded({
        file_name: resume.name,
        file_size: resume.size,
        file_type: resume.type,
        upload_timestamp: new Date().toISOString()
      });

      // Step 2: Save resume and job description to database
      console.log('[DEBUG] Step 2: Saving to database...');
      const { resumeId, jdId } = await saveToDatabase(resumeUrl, resumeUrl);

      // Track job description save
      trackEvents.jobDescriptionSaved({
        job_title: jobTitle,
        job_description_length: jobDescription.length,
        resume_id: resumeId,
        jd_id: jdId,
        save_timestamp: new Date().toISOString()
      });

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

      // Get the question set number from the saved questions
      const savedQuestionSet = questionsSaveResult.data[0]?.question_set || 'unknown';

      // Track questions generated
      const uniqueQuestions = questionsSaveResult.data.reduce((acc, item) => {
        if (!acc.has(item.question_text)) {
          acc.add(item.question_text);
        }
        return acc;
      }, new Set());

      trackEvents.questionsGenerated({
        resume_id: resumeId,
        jd_id: jdId,
        question_set: savedQuestionSet,
        total_questions: uniqueQuestions.size,
        job_title: jobTitle,
        generation_timestamp: new Date().toISOString()
      });

      // Step 5: Show success message and redirect
      console.log('[DEBUG] Step 5: Process completed successfully!');
      console.log('[DEBUG] Resume ID:', resumeId);
      console.log('[DEBUG] Job Description ID:', jdId);
      console.log('[DEBUG] Questions saved:', questionsSaveResult.data.length);
      
      // Store the created IDs for navigation
      setLastCreatedIds({
        resumeId: resumeId,
        jdId: jdId,
        questionSet: savedQuestionSet
      });
      
      // Show success modal instead of alert
      setSuccessModal({
        isOpen: true,
        title: 'Upload & Generation Complete!',
        message: `Resume, job description, and questions generated successfully! Question Set ${savedQuestionSet} has been created with ${uniqueQuestions.size} questions.`,
        details: [
          `Question Set: ${savedQuestionSet}`,
          `Total Questions: ${uniqueQuestions.size}`,
          `Resume: ${resume.name}`,
          `Job Title: ${jobTitle}`,
          `Status: Ready for interview preparation`
        ]
      });

    } catch (error) {
      console.error('Error in complete workflow:', error);
      alert(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Updated function to call backend API for question generation with new parameters
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
          job_description: jobDescription,
          // New parameters for question generation
          question_counts: {
            beginner: easyQuestions,
            medium: mediumQuestions,
            hard: hardQuestions
          },
          split: splitMode,
          resume_pct: splitResumePercentage,
          jd_pct: 100 - splitResumePercentage,
          blend: blendMode,
          blend_pct_resume: blendResumePercentage,
          blend_pct_jd: 100 - blendResumePercentage
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
  const canGenerateQuestions = () => {
    const totalQuestions = easyQuestions + mediumQuestions + hardQuestions;
    
    // Basic requirements
    if (!resume || !jobTitle.trim() || !jobDescription.trim() || !jobDescParsed || loading || parsingJobDesc) {
      return false;
    }
    
    // Only validate when both split AND blend modes are enabled
    if (splitMode && blendMode) {
      // Both modes on - need at least 6 total questions
      return totalQuestions >= 6;
    }
    
    // In all other cases, button is enabled (no additional validation)
    return true;
  };

  // Handle navigation to questions page (used by both buttons)
  const handleNavigateToQuestions = () => {
    setSuccessModal({ isOpen: false, title: '', message: '', details: null });
    
    if (lastCreatedIds.resumeId && lastCreatedIds.jdId && lastCreatedIds.questionSet) {
      navigate(`/questions?resume_id=${lastCreatedIds.resumeId}&jd_id=${lastCreatedIds.jdId}&question_set=${lastCreatedIds.questionSet}`);
    } else {
      // Fallback to dashboard if IDs are not available
      navigate('/dashboard');
    }
  };

  // Check if there's unsaved work that should trigger navigation warnings
  const hasUnsavedWork = resume || jobDesc || jobTitle.trim() || jobDescription.trim() || loading || parsingJobDesc;

  // Check if any critical operations are in progress
  const isCriticalOperationInProgress = loading || parsingJobDesc;

  // Handle beforeunload event (page refresh/close) - only block during critical operations
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (isCriticalOperationInProgress) {
        // Only block navigation during critical operations (parsing or generating)
        e.preventDefault();
        e.returnValue = 'You have a critical operation in progress. Are you sure you want to leave?';
        return e.returnValue;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isCriticalOperationInProgress]);

  // Helper function to get mode description
  const getModeDescription = () => {
    if (splitMode && blendMode) {
      return "Hybrid Mode: Mix of split and blended questions";
    } else if (splitMode) {
      return "Split Mode: Separate questions from resume vs job description";
    } else if (blendMode) {
      return "Blend Mode: Questions that blend resume and job description content";
    } else {
      return "Standard Mode: Balanced questions from both sources";
    }
  };

  return (
    <>
      <Navbar disableNavigation={isCriticalOperationInProgress} />
      <div className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text-primary)] px-4 py-8 sm:py-12 md:py-16 flex justify-center">
        <div className="w-full max-w-4xl bg-[var(--color-card)] border border-[var(--color-border)] rounded-2xl sm:rounded-3xl shadow-xl sm:shadow-2xl p-6 sm:p-8 md:p-10">
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
              disabled={loading}
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
                disabled={loading}
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
                        disabled={loading}
                        className={`w-full px-4 py-3 border border-[var(--color-border)] rounded-xl transition resize-none ${
                          loading
                            ? 'bg-[var(--color-text-secondary)]/20 text-[var(--color-text-secondary)] cursor-not-allowed opacity-60'
                            : 'bg-[var(--color-input-bg)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]'
                        }`}
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
                        disabled={loading}
                        className={`w-full px-4 py-3 border border-[var(--color-border)] rounded-xl transition resize-none ${
                          loading
                            ? 'bg-[var(--color-text-secondary)]/20 text-[var(--color-text-secondary)] cursor-not-allowed opacity-60'
                            : 'bg-[var(--color-input-bg)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]'
                        }`}
                        required
                      />
                    </div>

                    {/* Question Generation Settings */}
                    <div className="bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl p-6">
                      <div className="flex items-center gap-2 mb-4">
                        <FiSettings className="w-5 h-5 text-[var(--color-primary)]" />
                        <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">
                          Question Generation Settings
                        </h3>
                      </div>

                      {/* Mode Description */}
                      <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                        <p className="text-sm text-blue-800 dark:text-blue-200 font-medium">
                          {getModeDescription()}
                        </p>
                      </div>

                      {/* Question Counts */}
                      <div className="space-y-4 mb-6">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-medium text-[var(--color-text-primary)]">
                            Question Difficulty Distribution
                          </h4>
                          <div className="text-xs text-[var(--color-text-secondary)]">
                            Total: {easyQuestions + mediumQuestions + hardQuestions} questions
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="bg-green-50/50 dark:bg-green-900/10 border border-green-200/50 dark:border-green-800/30 rounded-lg p-4">
                            <div className="flex items-center justify-between mb-2">
                              <label className="text-sm font-medium text-green-700 dark:text-green-300">
                                Easy Questions
                              </label>
                              <span className="text-xs text-green-600 dark:text-green-400 bg-green-100/70 dark:bg-green-800/30 px-2 py-1 rounded-full">
                                {easyQuestions}
                              </span>
                            </div>
                            <input
                              type="range"
                              min="1"
                              max="5"
                              value={easyQuestions}
                              onChange={(e) => setEasyQuestions(parseInt(e.target.value))}
                              disabled={loading}
                              className="w-full h-2 bg-green-200/50 dark:bg-green-700/30 rounded-lg appearance-none cursor-pointer slider-green"
                            />
                            <div className="flex justify-between text-xs text-green-600/70 dark:text-green-400/70 mt-1">
                              <span>1</span>
                              <span>5</span>
                            </div>
                          </div>

                          <div className="bg-yellow-50/50 dark:bg-yellow-900/10 border border-yellow-200/50 dark:border-yellow-800/30 rounded-lg p-4">
                            <div className="flex items-center justify-between mb-2">
                              <label className="text-sm font-medium text-yellow-700 dark:text-yellow-300">
                                Medium Questions
                              </label>
                              <span className="text-xs text-yellow-600 dark:text-yellow-400 bg-yellow-100/70 dark:bg-yellow-800/30 px-2 py-1 rounded-full">
                                {mediumQuestions}
                              </span>
                            </div>
                            <input
                              type="range"
                              min="1"
                              max="5"
                              value={mediumQuestions}
                              onChange={(e) => setMediumQuestions(parseInt(e.target.value))}
                              disabled={loading}
                              className="w-full h-2 bg-yellow-200/50 dark:bg-yellow-700/30 rounded-lg appearance-none cursor-pointer slider-yellow"
                            />
                            <div className="flex justify-between text-xs text-yellow-600/70 dark:text-yellow-400/70 mt-1">
                              <span>1</span>
                              <span>5</span>
                            </div>
                          </div>

                          <div className="bg-red-50/50 dark:bg-red-900/10 border border-red-200/50 dark:border-red-800/30 rounded-lg p-4">
                            <div className="flex items-center justify-between mb-2">
                              <label className="text-sm font-medium text-red-700 dark:text-red-300">
                                Hard Questions
                              </label>
                              <span className="text-xs text-red-600 dark:text-red-400 bg-red-100/70 dark:bg-red-800/30 px-2 py-1 rounded-full">
                                {hardQuestions}
                              </span>
                            </div>
                            <input
                              type="range"
                              min="1"
                              max="5"
                              value={hardQuestions}
                              onChange={(e) => setHardQuestions(parseInt(e.target.value))}
                              disabled={loading}
                              className="w-full h-2 bg-red-200/50 dark:bg-red-700/30 rounded-lg appearance-none cursor-pointer slider-red"
                            />
                            <div className="flex justify-between text-xs text-red-600/70 dark:text-red-400/70 mt-1">
                              <span>1</span>
                              <span>5</span>
                            </div>
                          </div>
                        </div>

                        {/* Validation Error Message */}
                        {!canGenerateQuestions() && splitMode && blendMode && (
                          <div className="p-3 bg-red-50/50 dark:bg-red-900/10 border border-red-200/50 dark:border-red-800/30 rounded-lg">
                            <p className="text-sm text-red-700 dark:text-red-300">
                              When both Split and Blend modes are enabled, you need at least 6 total questions.
                            </p>
                          </div>
                        )}

                        {/* Mode-specific validation hints */}
                        {splitMode && blendMode && (
                          <div className="p-3 bg-blue-50/50 dark:bg-blue-900/10 border border-blue-200/50 dark:border-blue-800/30 rounded-lg">
                            <p className="text-sm text-blue-700 dark:text-blue-300">
                              💡 <strong>Hybrid Mode:</strong> With both modes enabled, you need at least 6 total questions to ensure a good mix of split and blended questions.
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Mode Toggles */}
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <label className="text-sm font-medium text-[var(--color-text-primary)]">
                              Split Mode
                            </label>
                            <p className="text-xs text-[var(--color-text-secondary)]">
                              Generate separate questions from resume vs job description
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setSplitMode(!splitMode)}
                            disabled={loading}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                              splitMode ? 'bg-[var(--color-primary)]' : 'bg-gray-200 dark:bg-gray-700'
                            } ${loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                          >
                            <span
                              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                splitMode ? 'translate-x-6' : 'translate-x-1'
                              }`}
                            />
                          </button>
                        </div>

                        <div className="flex items-center justify-between">
                          <div>
                            <label className="text-sm font-medium text-[var(--color-text-primary)]">
                              Blend Mode
                            </label>
                            <p className="text-xs text-[var(--color-text-secondary)]">
                              Generate questions that blend resume and job description content
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setBlendMode(!blendMode)}
                            disabled={loading}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                              blendMode ? 'bg-[var(--color-primary)]' : 'bg-gray-200 dark:bg-gray-700'
                            } ${loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                          >
                            <span
                              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                blendMode ? 'translate-x-6' : 'translate-x-1'
                              }`}
                            />
                          </button>
                        </div>
                      </div>

                      {/* Split Mode Slider */}
                      <AnimatePresence>
                        {splitMode && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.3 }}
                            className="mt-4"
                          >
                            <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                              <h4 className="text-sm font-medium text-yellow-800 dark:text-yellow-200 mb-3">
                                Split Mode Settings
                              </h4>
                              <div className="space-y-3">
                                <div className="flex items-center justify-between text-xs text-[var(--color-text-secondary)]">
                                  <span>Resume</span>
                                  <span>Job Description</span>
                                </div>
                                <input
                                  type="range"
                                  min="0"
                                  max="100"
                                  value={splitResumePercentage}
                                  onChange={(e) => setSplitResumePercentage(parseInt(e.target.value))}
                                  disabled={loading}
                                  className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
                                />
                                <div className="flex justify-between text-sm font-medium text-[var(--color-text-primary)]">
                                  <span>{splitResumePercentage}%</span>
                                  <span>{100 - splitResumePercentage}%</span>
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {/* Blend Mode Slider */}
                      <AnimatePresence>
                        {blendMode && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.3 }}
                            className="mt-4"
                          >
                            <div className="p-4 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg">
                              <h4 className="text-sm font-medium text-purple-800 dark:text-purple-200 mb-3">
                                Blend Mode Settings
                              </h4>
                              <div className="space-y-3">
                                <div className="flex items-center justify-between text-xs text-[var(--color-text-secondary)]">
                                  <span>Resume Weight</span>
                                  <span>Job Description Weight</span>
                                </div>
                                <input
                                  type="range"
                                  min="0"
                                  max="100"
                                  value={blendResumePercentage}
                                  onChange={(e) => setBlendResumePercentage(parseInt(e.target.value))}
                                  disabled={loading}
                                  className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
                                />
                                <div className="flex justify-between text-sm font-medium text-[var(--color-text-primary)]">
                                  <span>{blendResumePercentage}%</span>
                                  <span>{100 - blendResumePercentage}%</span>
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>

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
                {parsingJobDesc ? 'Parsing...' : loading ? 'Generation in Progress...' : 'Clear All Files'}
                </button>
              </div>
            )}
              
                <button
                type="submit"
                disabled={!canGenerateQuestions()}
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

      {/* Success Modal */}
      <SuccessModal
        isOpen={successModal.isOpen}
        onClose={handleNavigateToQuestions}
        title={successModal.title}
        message={successModal.message}
        details={successModal.details}
        customAction={{
          label: 'View Questions',
          onClick: handleNavigateToQuestions
        }}
      />
    </>
  );
}

export default UploadPage;
