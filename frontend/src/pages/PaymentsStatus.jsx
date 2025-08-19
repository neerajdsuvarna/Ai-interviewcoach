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

  useEffect(() => {
    const processPayment = async () => {
      try {
        // Get URL parameters from Dodo redirect
        const paymentId = searchParams.get('payment_id');
        const paymentStatus = searchParams.get('status');

        console.log('Payment Status Page - URL Params:', {
          paymentId,
          paymentStatus,
          allParams: Object.fromEntries(searchParams.entries())
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

        if (paymentId) {
          console.log('Payment ID found, checking database for payment status...');
          
          // Add a small delay to allow webhook transaction to commit
          await new Promise(resolve => setTimeout(resolve, 3000));
          
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
              // Payment found and updated with user_id
              setPaymentDetails(result.data);
              
              // Set status based on payment status from database
              switch (result.data.payment_status) {
                case 'succeeded':
                case 'success':
                  setStatus('success');
                  setMessage('Payment successful! Redirecting to interview...');
                  setTimeout(() => {
                    navigate('/interview');
                  }, 2000);
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
              // Payment not found in database, try to create it with current status
              console.log('Payment not found in database, attempting to create payment record...');
              
              const createResponse = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/payments`, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${session.access_token}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  interview_id: searchParams.get('interview_id') || '00000000-0000-0000-0000-000000000000', // fallback UUID
                  amount: parseInt(searchParams.get('amount') || '0'),
                  provider: 'dodo',
                  payment_status: paymentStatus || 'failed',
                  transaction_id: paymentId,
                  paid_at: new Date().toISOString()
                })
              });

              const createResult = await createResponse.json();
              
              console.log('Payment creation result:', {
                success: createResponse.ok,
                status: createResponse.status,
                data: createResult
              });

              if (createResponse.ok && createResult.success) {
                setPaymentDetails(createResult.data);
                
                // Set status based on URL parameter or created payment status
                const finalStatus = paymentStatus || createResult.data.payment_status;
                
                switch (finalStatus) {
                  case 'succeeded':
                  case 'success':
                    setStatus('success');
                    setMessage('Payment successful! Redirecting to interview...');
                    setTimeout(() => {
                      navigate('/interview');
                    }, 2000);
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
                    setMessage(`Payment status: ${finalStatus}`);
                    break;
                }
              } else {
                console.error('Failed to create payment record:', createResult);
                setStatus('error');
                setMessage('Payment verification failed');
              }
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
                <p>Transaction ID: {paymentDetails.transaction_id}</p>
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
                <p>Transaction ID: {paymentDetails.transaction_id}</p>
              </div>
            )}
            <button
              onClick={() => navigate('/questions')}
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
                <p>Transaction ID: {paymentDetails.transaction_id}</p>
                <p>Status: {paymentDetails.payment_status}</p>
              </div>
            )}
            <button
              onClick={() => navigate('/questions')}
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

