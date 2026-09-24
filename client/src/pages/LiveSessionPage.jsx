import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../config/api';
import { useAuth } from '../contexts/AuthContext';
import LoadingSpinner from '../components/LoadingSpinner';
import LiveSessionRoom from '../components/LiveSessionRoom';
import PaymentCheckout from '../components/PaymentCheckout';

export default function LiveSessionPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const reloadSession = () => api.get(`/sessions/${id}`).then((response) => setSession(response.data));

  useEffect(() => {
    let active = true;
    api.get(`/sessions/${id}`).then((response) => { if (active) setSession(response.data); })
      .catch(() => { if (active) toast.error('Could not load this session'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id]);

  if (loading) return <LoadingSpinner size="lg" className="py-20" />;
  if (!session || !user?._id) return <div className="py-20 text-center text-slate-500">This session is unavailable.</div>;
  if (session.mode === 'PAID' && session.paymentStatus !== 'COMPLETED') return <main className="mx-auto max-w-3xl px-4 py-16">{session.learnerId === user._id ? <PaymentCheckout sessionId={session._id} onPaid={() => { void reloadSession(); }} /> : <div className="rounded-2xl border border-amber-200 bg-amber-50 p-8 text-center"><h1 className="text-xl font-bold text-slate-900">Waiting for payment</h1><p className="mt-2 text-slate-600">The learner must complete checkout before the session room opens.</p></div>}</main>;
  return <div className="-mx-4 -my-8 min-h-[calc(100vh-4rem)] bg-slate-950"><LiveSessionRoom session={session} viewerId={user._id} /></div>;
}
