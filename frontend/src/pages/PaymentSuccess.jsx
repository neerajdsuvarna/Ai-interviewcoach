import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { FiCheckCircle, FiLoader, FiXCircle } from 'react-icons/fi';
import Navbar from '../components/Navbar';

export default function PaymentSuccess() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState('processing');
  const [message, setMessage] = useState('Processing your payment...');

  useEffect(() => {
    const processPayment = async () => {
      try {
        // Get parameters from URL
        const interviewId = searchParams.get('interview_id');
        const paymentId = searchParams.get('payment_id');
        const paymentStatus = searchParams.get('status');
        
        console.log('Payment processing:', { interviewId, paymentId, paymentStatus });
        
        if (!interviewId) {
          console.error('No interview_id provided');
          navigate('/dashboard');
          return;
        }
        
        // ✅ Check payment status and redirect accordingly
        if (paymentStatus === 'succeeded' || paymentStatus === 'success' || paymentStatus === 'completed') {
          setStatus('success');
          setMessage('Payment successful! Redirecting to interview...');
          
          // Wait a moment for webhook to process, then redirect to interview
          setTimeout(() => {
            navigate(`/interview?interview_id=${interviewId}`);
          }, 2000);
          
        } else {
          // ✅ Payment failed - redirect back to questions page
          setStatus('error');
          setMessage('Payment was not successful. Redirecting back to questions...');
          
          // Extract resume_id and jd_id from the interview to redirect to questions page
          try {
            // Get interview details to redirect to questions page
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.access_token) {
              const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/interviews/${interviewId}`, {
                headers: {
                  'Authorization': `Bearer ${session.access_token}`
                }
              });
              
              if (response.ok) {
                const result = await response.json();
                const interview = result.data;
                
                // Redirect to questions page with the same parameters
                setTimeout(() => {
                  navigate(`/questions?resume_id=${interview.resume_id}&jd_id=${interview.jd_id}&question_set=${interview.question_set}`);
                }, 3000);
              } else {
                // Fallback to dashboard if we can't get interview details
                setTimeout(() => {
                  navigate('/dashboard');
                }, 3000);
              }
            } else {
              // Fallback to dashboard if no session
              setTimeout(() => {
                navigate('/dashboard');
              }, 3000);
            }
          } catch (error) {
            console.error('Error getting interview details:', error);
            // Fallback to dashboard
            setTimeout(() => {
              navigate('/dashboard');
            }, 3000);
          }
        }
        
      } catch (error) {
        console.error('Error processing payment:', error);
        setStatus('error');
        setMessage('Error processing payment. Redirecting to dashboard...');
        
        setTimeout(() => {
          navigate('/dashboard');
        }, 3000);
      }
    };
    
    processPayment();
  }, [navigate, searchParams]);

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
              Processing your payment
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
                  Payment Successful!
                </h3>
                <p className="text-[var(--color-text-secondary)] mb-4">{message}</p>
                <div className="text-sm text-[var(--color-text-secondary)]">
                  <p>Redirecting to interview...</p>
                </div>
              </>
            )}

            {status === 'error' && (
              <>
                <FiXCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-[var(--color-text-primary)] mb-2">
                  Payment Issue
                </h3>
                <p className="text-[var(--color-text-secondary)] mb-4">{message}</p>
                <div className="text-sm text-[var(--color-text-secondary)]">
                  <p>Redirecting back to questions...</p>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
