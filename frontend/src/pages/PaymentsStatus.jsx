import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { FiCheckCircle, FiXCircle, FiLoader, FiClock, FiArrowLeft } from 'react-icons/fi';
import Navbar from '../components/Navbar';
import { trackEvents } from '../services/mixpanel';

export default function PaymentStatus() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('processing');
  const [message, setMessage] = useState('Processing payment...');
  const [paymentDetails, setPaymentDetails] = useState(null);
  const hasProcessedPayment = useRef(false); // Prevent duplicate processing
  const hasTrackedPaymentCompleted = useRef(false); // Prevent duplicate payment tracking
  const hasTrackedInterviewScheduled = useRef(false); // Prevent duplicate interview tracking
  const hasTrackedPaymentFailure = useRef(false); // Prevent duplicate payment failure tracking
  const hasTrackedRescheduledInterview = useRef(false); // Prevent duplicate reschedule tracking

  // Extract URL parameters at component level so they're accessible in JSX
  const resumeId = searchParams.get('resume_id');
  const jdId = searchParams.get('jd_id');
  const questionSet = searchParams.get('question_set');
  const retakeFrom = searchParams.get('retake_from');
  
  // Check if this is a retake scenario
  const isRetake = retakeFrom && questionSet;

  useEffect(() => {
    const processPayment = async () => {
      // Prevent duplicate processing
      if (hasProcessedPayment.current) {
        console.log('🛑 Payment already processed, skipping...');
        return;
      }
      
      hasProcessedPayment.current = true;
      
      try {
        // Get URL parameters from Dodo redirect
        const paymentId = searchParams.get('payment_id');
        const paymentStatus = searchParams.get('status');
        
        // Remove these lines since we're now extracting at component level
        // const resumeId = searchParams.get('resume_id');
        // const jdId = searchParams.get('jd_id');

        console.log('🔍 Payment Status Page - URL Params:', {
          paymentId,
          paymentStatus,
          resumeId,
          jdId,
          allParams: Object.fromEntries(searchParams.entries())
        });

        // Validate that we have the required context data
        if (!resumeId || !jdId) {
          console.error('❌ Missing required context data:', {
            resumeId: !!resumeId,
            jdId: !!jdId,
            hasResumeId: !!resumeId,
            hasJdId: !!jdId
          });
          setStatus('error');
          setMessage('Missing resume or job description information');
          return;
        }

        // For retakes, validate additional parameters
        if (isRetake && (!questionSet || !retakeFrom)) {
          console.error('❌ Missing retake context data:', {
            questionSet: !!questionSet,
            retakeFrom: !!retakeFrom
          });
          setStatus('error');
          setMessage('Missing retake interview information');
          return;
        }

        console.log('✅ Context data validation passed:', {
          resumeId,
          jdId
        });

        // Get user session
        const { data: { session } } = await supabase.auth.getSession();
        console.log('Session check:', {
          hasSession: !!session,
          hasAccessToken: !!session?.access_token
        });
        
        if (!session?.access_token) {
          setStatus('error');
          setMessage('Authentication required');
          return;
        }

        const { data: { user } } = await supabase.auth.getUser();
        console.log('User check:', {
          hasUser: !!user,
          userId: user?.id,
          userEmail: user?.email
        });
        
        if (!user) {
          setStatus('error');
          setMessage('User not found');
          return;
        }

        console.log('Current user:', {
          user_id: user.id,
          email: user.email
        });

        // Log the complete context for debugging
        console.log('🎯 Complete payment context:', {
          user: {
            id: user.id,
            email: user.email
          },
          payment: {
            paymentId,
            paymentStatus
          },
          context: {
            resumeId,
            jdId
          }
        });

        if (paymentId) {
          console.log('Payment ID found, checking database for payment status...');
          
          // Add a small delay to allow webhook transaction to commit
          await new Promise(resolve => setTimeout(resolve, 200));
          
          try {
            // Use the edge function to get payment status and update with user_id
            console.log('Calling payments edge function to get/update payment...');
            
            const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/payments`, {
              method: 'PUT',
              headers: {
                'Authorization': `Bearer ${session.access_token}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                transaction_id: paymentId
              })
            });

            const result = await response.json();
            
            console.log('Payment edge function result:', {
              success: response.ok,
              status: response.status,
              data: result
            });

            if (response.ok && result.success) {
              // ✅ Payment found and updated with user_id
              setPaymentDetails(result.data);
              
              console.log('✅ Payment found in database:', {
                payment_id: result.data.id,
                transaction_id: result.data.transaction_id,
                status: result.data.payment_status,
                amount: result.data.amount
              });
              
              // Log successful payment with context
              console.log('✅ Payment successful with context:', {
                paymentData: result.data,
                context: {
                  resumeId,
                  jdId
                }
              });
              
              // Set status based on payment status from database
              switch (result.data.payment_status) {
                case 'succeeded':
                case 'success':
                  setStatus('success');
                  setMessage('Payment successful! Setting up interview...');
                  
                  // Track payment completed (only once)
                  if (!hasTrackedPaymentCompleted.current) {
                    hasTrackedPaymentCompleted.current = true;
                    trackEvents.paymentCompleted({
                      payment_id: result.data.transaction_id,
                      amount: result.data.amount,
                      resume_id: resumeId,
                      jd_id: jdId,
                      question_set: questionSet,
                      is_retake: isRetake,
                      retake_from: retakeFrom,
                      completion_timestamp: new Date().toISOString()
                    });
                  }
                  
                  // ✅ Call interview setup function
                  try {
                    console.log('🚀 Setting up interview...');
                    
                                                              // Use the same interview-setup flow for both normal and retake interviews
                     console.log('🆕 Setting up interview...');
                     console.log('Debug values being sent:', {
                       payment_id: result.data.transaction_id,
                       resume_id: resumeId,
                       jd_id: jdId,
                       question_set: questionSet ? Number(questionSet) : undefined,
                       retake_from: isRetake ? retakeFrom : undefined
                     });
                     
                     const interviewSetupResponse = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/interview-setup`, {
                       method: 'POST',
                       headers: {
                         'Authorization': `Bearer ${session.access_token}`,
                         'Content-Type': 'application/json'
                       },
                       body: JSON.stringify({
                         payment_id: result.data.transaction_id,
                         resume_id: resumeId,
                         jd_id: jdId,
                         question_set: questionSet ? Number(questionSet) : undefined,
                         retake_from: isRetake ? retakeFrom : undefined
                       })
                     });

                     const interviewResult = await interviewSetupResponse.json();
                     
                     console.log('📋 Interview setup result:', interviewResult);

                     if (interviewSetupResponse.ok && interviewResult.success) {
                       console.log('✅ Interview setup successful, redirecting...');
                       
                       // Track mock interview scheduled (only for original interviews, not retakes)
                       if (!isRetake && !hasTrackedInterviewScheduled.current) {
                         hasTrackedInterviewScheduled.current = true;
                         trackEvents.mockInterviewScheduled({
                           interview_id: interviewResult.data.interview_id,
                           payment_id: result.data.transaction_id,
                           resume_id: resumeId,
                           jd_id: jdId,
                           question_set: questionSet,
                           is_retake: false,
                           schedule_timestamp: new Date().toISOString()
                         });
                       }
                       
                       // Track rescheduled mock interview (only for retakes, only once)
                       if (isRetake && !hasTrackedRescheduledInterview.current) {
                         hasTrackedRescheduledInterview.current = true;
                         trackEvents.rescheduledMockInterview({
                           original_interview_id: retakeFrom,
                           new_interview_id: interviewResult.data.interview_id,
                           payment_id: result.data.transaction_id,
                           resume_id: resumeId,
                           jd_id: jdId,
                           question_set: questionSet,
                           reschedule_timestamp: new Date().toISOString()
                         });
                       }
                       
                       setTimeout(() => {
                         console.log('🚀 Redirecting to interview...');
                         navigate(`/interview?interview_id=${interviewResult.data.interview_id}`);
                       }, 2000);

                    }
                  } catch (error) {
                    console.error('❌ Interview setup error:', error);
                    setStatus('error');
                    setMessage('Interview setup failed. Please try again.');
                  }
                  break;
                case 'failed':
                  setStatus('error');
                  setMessage('Payment failed. Please try again.');
                  
                  // Track payment failure (only once)
                  if (!hasTrackedPaymentFailure.current) {
                    hasTrackedPaymentFailure.current = true;
                    trackEvents.paymentFailure({
                      payment_id: result.data.transaction_id,
                      amount: result.data.amount,
                      resume_id: resumeId,
                      jd_id: jdId,
                      question_set: questionSet,
                      failure_timestamp: new Date().toISOString()
                    });
                  }
                  break;
                case 'pending':
                  setStatus('pending');
                  setMessage('Payment is pending. Please wait for confirmation.');
                  break;
                default:
                  setStatus('error');
                  setMessage(`Payment status: ${result.data.payment_status}`);
                  break;
              }
            } else {
              // ❌ Payment not found in database - webhook issue
              console.error('❌ Payment not found in database. Webhook may not have been called.');
              console.error('❌ This indicates a webhook configuration issue.');
              setStatus('error');
              setMessage('Payment verification failed. Please contact support.');
            }
          } catch (error) {
            console.error('Error calling payments edge function:', error);
            setStatus('error');
            setMessage('Payment verification failed');
          }
        } else {
          console.log('No payment ID found');
          setStatus('error');
          setMessage('No payment information found');
        }

      } catch (error) {
        console.error('Payment processing error:', {
          error: error,
          message: error.message,
          stack: error.stack
        });
        setStatus('error');
        setMessage('Payment processing failed');
      }
    };

    processPayment();
  }, [searchParams, navigate]);

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-[var(--color-bg)] pt-20 flex items-center justify-center px-4 py-8 sm:px-6 lg:px-8">
        <div className="w-full max-w-sm sm:max-w-md md:max-w-lg lg:max-w-md xl:max-w-md bg-[var(--color-card)] text-[var(--color-text-primary)] p-6 sm:p-8 rounded-2xl shadow-lg border border-[var(--color-border)]">
          
          {/* Header */}
          <div className="text-center mb-6">
            <h2 className="text-2xl sm:text-3xl font-bold text-[var(--color-primary)] mb-2">
              Payment Status
            </h2>
            <p className="text-sm text-[var(--color-text-secondary)]">
              {isRetake ? 'Processing retake interview payment' : 'Processing your interview payment'}
            </p>
          </div>

          {/* Status Content */}
          <div className="text-center">
            {status === 'processing' && (
              <>
                <FiLoader className="w-16 h-16 text-[var(--color-primary)] mx-auto mb-4 animate-spin" />
                <h3 className="text-xl font-semibold text-[var(--color-text-primary)] mb-2">
                  Processing Payment
                </h3>
                <p className="text-[var(--color-text-secondary)]">{message}</p>
              </>
            )}

            {status === 'success' && (
              <>
                <FiCheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-[var(--color-text-primary)] mb-2">
                  {isRetake ? 'Retake Payment Successful!' : 'Payment Successful!'}
                </h3>
                <p className="text-[var(--color-text-secondary)] mb-4">{message}</p>
                {paymentDetails && (
                  <div className="bg-[var(--color-input-bg)] rounded-lg p-4 mb-4 text-sm text-[var(--color-text-secondary)]">
                    <p className="font-medium text-[var(--color-text-primary)] mb-2">Payment Details:</p>
                    <p>Amount: ₹{(paymentDetails.amount / 100).toFixed(2)}</p>
                    <p>Payment ID: {paymentDetails.transaction_id}</p>
                    {isRetake && (
                      <>
                        <p>Question Set: {questionSet}</p>
                        <p>Retake from: {retakeFrom}</p>
                      </>
                    )}
                  </div>
                )}
                <div className="text-sm text-[var(--color-text-secondary)]">
                  <p>Redirecting to interview...</p>
                </div>
              </>
            )}

            {status === 'pending' && (
              <>
                <FiClock className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-[var(--color-text-primary)] mb-2">
                  Payment Pending
                </h3>
                <p className="text-[var(--color-text-secondary)] mb-4">{message}</p>
                {paymentDetails && (
                  <div className="bg-[var(--color-input-bg)] rounded-lg p-4 mb-4 text-sm text-[var(--color-text-secondary)]">
                    <p className="font-medium text-[var(--color-text-primary)] mb-2">Payment Details:</p>
                    <p>Amount: ₹{(paymentDetails.amount / 100).toFixed(2)}</p>
                    <p>Payment ID: {paymentDetails.transaction_id}</p>
                  </div>
                )}
                <button
                  onClick={() => navigate(`/questions?resume_id=${resumeId}&jd_id=${jdId}`)}
                  className="w-full bg-[var(--color-primary)] text-white px-6 py-3 rounded-lg hover:opacity-90 transition-opacity font-semibold"
                >
                  <FiArrowLeft className="inline mr-2" />
                  Back to Questions
                </button>
              </>
            )}

            {status === 'error' && (
              <>
                <FiXCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-[var(--color-text-primary)] mb-2">
                  Payment Failed
                </h3>
                <p className="text-[var(--color-text-secondary)] mb-4">{message}</p>
                {paymentDetails && (
                  <div className="bg-[var(--color-input-bg)] rounded-lg p-4 mb-4 text-sm text-[var(--color-text-secondary)]">
                    <p className="font-medium text-[var(--color-text-primary)] mb-2">Payment Details:</p>
                    <p>Amount: ₹{(paymentDetails.amount / 100).toFixed(2)}</p>
                    <p>Payment ID: {paymentDetails.transaction_id}</p>
                    <p>Status: {paymentDetails.payment_status}</p>
                  </div>
                )}
                <button
                  onClick={() => navigate(`/questions?resume_id=${resumeId}&jd_id=${jdId}`)}
                  className="w-full bg-[var(--color-primary)] text-white px-6 py-3 rounded-lg hover:opacity-90 transition-opacity font-semibold"
                >
                  <FiArrowLeft className="inline mr-2" />
                  Back to Questions
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}


