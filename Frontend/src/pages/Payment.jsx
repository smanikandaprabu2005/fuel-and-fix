import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { getUserServiceRequests, payForService } from '../services/authService';
import './Payment.css';

const Payment = () => {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [request, setRequest] = useState(null);
  const [error, setError] = useState('');
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      if (!currentUser) return;
      try {
        const res = await getUserServiceRequests(currentUser._id);
        if (!mounted) return;
        const requests = res.data || [];
        // Find the most recent completed request that has a payment amount and is unpaid
        const candidate = requests.find(r => r.status === 'completed' && r.payment && (r.payment.status !== 'paid')) || null;
        setRequest(candidate);
      } catch (err) {
        console.error('Error loading requests for payment', err);
        setError('Could not load payment information');
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, [currentUser]);

  const handlePay = async () => {
    if (!request) return;
    setPaying(true);
    setError('');
    try {
      // Use sandbox/dummy payment: call backend endpoint to mark payment as paid
      const res = await payForService(request._id, { provider: 'sandbox' });
      if (res.data && res.data.request) {
        setRequest(res.data.request);
      }
      // Redirect back to dashboard shortly
      setTimeout(() => { window.location.href = '/dashboard'; }, 800);
    } catch (err) {
      console.error('Payment failed', err);
      setError('Payment failed. Please try again.');
    } finally {
      setPaying(false);
    }
  };

  if (loading) return <div>Loading payment info...</div>;

  if (!request) return <div className="payment-page"><h3>No pending payments</h3><p>There are no completed services awaiting payment.</p></div>;

  return (
    <div className="payment-page">
      <h2>Complete Payment</h2>
      {error && <div className="error">{error}</div>}
      <div className="payment-card">
        <p>Service ID: {request._id}</p>
  <p>Provider: {request.assignedTo?.name || request.assignedTo?.user?.name || (request.assignedTo && request.assignedTo._id) || '—'}</p>
  <p>User: {request.user?.name || request.user?.email || request.user || '—'}</p>
        <p>Distance: {request.distanceMeters ? `${(request.distanceMeters/1000).toFixed(2)} km` : '—'}</p>
        <p className="amount">Amount: { (typeof request.payment?.amount === 'number' && request.payment.amount > 0) ? <>₹{request.payment.amount}</> : <span>—</span> }</p>
        <div className="actions">
          <button className="btn btn-primary" onClick={handlePay} disabled={paying}>{paying ? 'Processing...' : 'Pay (Dummy)'}</button>
        </div>
      </div>
    </div>
  );
};

export default Payment;
