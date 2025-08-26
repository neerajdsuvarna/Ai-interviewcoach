import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { FiCheckCircle, FiXCircle, FiLoader, FiClock } from 'react-icons/fi';

export default function PaymentStatus() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('processing');
  const [message, setMessage] = useState('Processing payment...');
  const [paymentDetails, setPaymentDetails] = useState(null);

  // Extract URL parameters at component level so they're accessible in JSX
  const resumeId = searchParams.get('resume_id');
  const jdId = searchParams.get('jd_id');

  useEffect(() => {
    const processPayment = async () => {
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
                  
                  // ✅ Call interview setup function
                  try {
                    console.log('🚀 Setting up interview...');
                    
                    console.log(' Debug values being sent:', {
                      payment_id: result.data.transaction_id,
                      resume_id: resumeId,
                      jd_id: jdId,
                      original_paymentId: paymentId,
                      payment_record_id: result.data.id
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
                        jd_id: jdId
                      })
                    });

                    const interviewResult = await interviewSetupResponse.json();
                    
                    console.log('📋 Interview setup result:', interviewResult);

                    if (interviewSetupResponse.ok && interviewResult.success) {
                      console.log('✅ Interview setup successful, redirecting...');
                      
                      // ✅ DEBUG: Add 30-second delay for debugging
                      console.log('🕐 DEBUG: Adding 2-second delay before redirect...');
                      console.log('🕐 You can now check the database to see the created records');
                      console.log('🕐 Interview ID:', interviewResult.data.interview_id);
                      console.log('🕐 Payment ID:', result.data.transaction_id);
                      console.log('🕐 Resume ID:', resumeId);
                      console.log('🕐 JD ID:', jdId);
                      console.log(' Check these tables:');
                      console.log('   - interviews (id = ' + interviewResult.data.interview_id + ')');
                      console.log('🕐   - payments (transaction_id = ' + result.data.transaction_id + ')');
                      console.log('   - questions (resume_id = ' + resumeId + ', jd_id = ' + jdId + ')');
                      
                      setTimeout(() => {
                        console.log('🚀 DEBUG: 2 seconds completed, now redirecting to interview...');
                        navigate(`/interview?interview_id=${interviewResult.data.interview_id}`);
                      }, 2000); // 30 seconds = 30000 milliseconds
                    } else {
                      console.error('❌ Interview setup failed:', interviewResult);
                      setStatus('error');
                      setMessage('Interview setup failed. Please contact support.');
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
    <div className="min-h-screen bg-[var(--color-bg)] flex items-center justify-center px-4">
      <div className="bg-[var(--color-card)] rounded-2xl p-8 max-w-md w-full text-center border border-[var(--color-border)]">
        {status === 'processing' && (
          <>
            <FiLoader className="w-16 h-16 text-[var(--color-primary)] mx-auto mb-4 animate-spin" />
            <h2 className="text-xl font-semibold text-[var(--color-text-primary)] mb-2">
              Processing Payment
            </h2>
            <p className="text-[var(--color-text-secondary)]">{message}</p>
          </>
        )}

        {status === 'success' && (
          <>
            <FiCheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-[var(--color-text-primary)] mb-2">
              Payment Successful!
            </h2>
            <p className="text-[var(--color-text-secondary)]">{message}</p>
            {paymentDetails && (
              <div className="mt-4 text-sm text-[var(--color-text-secondary)]">
                <p>Amount: ₹{(paymentDetails.amount / 100).toFixed(2)}</p>
                <p>Payment ID: {paymentDetails.transaction_id}</p>
              </div>
            )}
          </>
        )}

        {status === 'pending' && (
          <>
            <FiClock className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-[var(--color-text-primary)] mb-2">
              Payment Pending
            </h2>
            <p className="text-[var(--color-text-secondary)]">{message}</p>
            {paymentDetails && (
              <div className="mt-4 text-sm text-[var(--color-text-secondary)]">
                <p>Amount: ₹{(paymentDetails.amount / 100).toFixed(2)}</p>
                <p>Payment ID: {paymentDetails.transaction_id}</p>
              </div>
            )}
            <button
              onClick={() => navigate(`/questions?resume_id=${resumeId}&jd_id=${jdId}`)}
              className="mt-4 bg-[var(--color-primary)] text-white px-6 py-2 rounded-lg hover:bg-opacity-90 transition-colors"
            >
              Back to Questions
            </button>
          </>
        )}

        {status === 'error' && (
          <>
            <FiXCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-[var(--color-text-primary)] mb-2">
              Payment Failed
            </h2>
            <p className="text-[var(--color-text-secondary)] mb-4">{message}</p>
            {paymentDetails && (
              <div className="mb-4 text-sm text-[var(--color-text-secondary)]">
                <p>Amount: ₹{(paymentDetails.amount / 100).toFixed(2)}</p>
                <p>Payment ID: {paymentDetails.transaction_id}</p>
                <p>Status: {paymentDetails.payment_status}</p>
              </div>
            )}
            <button
              onClick={() => navigate(`/questions?resume_id=${resumeId}&jd_id=${jdId}`)}
              className="bg-[var(--color-primary)] text-white px-6 py-2 rounded-lg hover:bg-opacity-90 transition-colors"
            >
              Back to Questions
            </button>
          </>
        )}
      </div>
    </div>
  );
}

