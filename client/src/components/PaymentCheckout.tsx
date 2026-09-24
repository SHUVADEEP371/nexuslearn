import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../config/api';

interface Props { sessionId: string; onPaid: () => void }
interface RazorpayResponse { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }
interface RazorpayOptions {
  key: string; amount: number; currency: string; name: string; description: string; order_id: string;
  handler: (response: RazorpayResponse) => void;
  modal: { ondismiss: () => void };
  theme: { color: string };
}
interface RazorpayCheckout { open: () => void }
declare global { interface Window { Razorpay?: new (options: RazorpayOptions) => RazorpayCheckout } }

export default function PaymentCheckout({ sessionId, onPaid }: Props) {
  const [loading, setLoading] = useState(false);
  async function pay() {
    setLoading(true);
    try {
      const { data } = await api.post('/payments/create-order', { sessionId });
      if (!window.Razorpay) {
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://checkout.razorpay.com/v1/checkout.js';
          script.onload = () => resolve();
          script.onerror = () => reject(new Error('Payment checkout could not be loaded'));
          document.body.appendChild(script);
        });
      }
      if (!window.Razorpay) throw new Error('Payment checkout is unavailable');
      const checkout = new window.Razorpay({
        key: data.keyId, amount: data.amount, currency: data.currency, name: 'NexusLearn',
        description: 'Peer learning session', order_id: data.orderId, theme: { color: '#7B466A' },
        modal: { ondismiss: () => setLoading(false) },
        handler: async (verification) => {
          try {
            await api.post('/payments/verify', { sessionId, ...verification });
            toast.success('Payment verified');
            onPaid();
          } catch (error) { toast.error(error instanceof Error ? error.message : 'Payment verification failed'); }
          finally { setLoading(false); }
        },
      });
      checkout.open();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not start payment');
      setLoading(false);
    }
  }
  return <div className="mx-auto max-w-xl rounded-2xl border border-amber-200 bg-amber-50 p-8 text-center">
    <h1 className="text-2xl font-bold text-slate-900">Payment required</h1>
    <p className="mt-2 text-slate-600">Complete the secure UPI/card checkout before joining this paid learning session.</p>
    <button type="button" onClick={() => void pay()} disabled={loading} className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#7B466A] px-5 py-3 font-semibold text-white disabled:opacity-60">
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}{loading ? 'Opening checkout…' : 'Pay securely'}
    </button>
  </div>;
}
