import { RequestHandler } from 'express';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { Types } from 'mongoose';
import { z } from 'zod';
import { SessionModel } from '../models/session.model';
import { TransactionLedgerModel } from '../models/transactionLedger.model';

const idInput = z.object({ sessionId: z.string().regex(/^[a-f\d]{24}$/i) }).strict();
const verifyInput = z.object({
  sessionId: z.string().regex(/^[a-f\d]{24}$/i),
  razorpay_order_id: z.string().min(1).max(100),
  razorpay_payment_id: z.string().min(1).max(100),
  razorpay_signature: z.string().regex(/^[a-f\d]{64}$/i),
}).strict();

// Supports both string and Mongoose ObjectId types, checking _id and id
const authenticatedUserId = (user: unknown): string => {
  if (!user || typeof user !== 'object') return '';
  const candidate = (user as { _id?: unknown; id?: unknown })._id ?? (user as { id?: unknown }).id;
  if (!candidate) return '';
  const rawId = typeof candidate === 'string' ? candidate : String(candidate);
  return Types.ObjectId.isValid(rawId) ? rawId : '';
};

export const createOrder: RequestHandler = async (req, res, next) => {
  try {
    const parsed = idInput.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: 'Invalid payment order request' });
      return;
    }

    const userId = authenticatedUserId(req.user);
    if (!userId) {
      res.status(401).json({ message: 'Authentication required' });
      return;
    }

    const session = await SessionModel.findOne({
      _id: parsed.data.sessionId,
      learnerId: userId,
      participants: userId,
      mode: 'PAID',
      status: 'SCHEDULED',
      paymentStatus: 'PENDING'
    });

    if (!session) {
      res.status(404).json({ message: 'Pending paid session not found' });
      return;
    }

    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keyId || !keySecret) {
      res.status(503).json({ message: 'Payment provider is not configured' });
      return;
    }

    if (session.paymentRef) {
      res.json({ orderId: session.paymentRef, amount: Math.round(session.priceInInr * 100), currency: 'INR', keyId });
      return;
    }

    const amount = Math.round(session.priceInInr * 100);
    if (!Number.isSafeInteger(amount) || amount < 100) {
      res.status(400).json({ message: 'Session price is invalid' });
      return;
    }

    const response = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ amount, currency: 'INR', receipt: `nl-${session.id}`, notes: { sessionId: session.id } }),
      signal: AbortSignal.timeout(12_000),
    });

    if (!response.ok) {
      console.error('Razorpay order creation failed with HTTP status', response.status);
      res.status(502).json({ message: 'Could not create a payment order' });
      return;
    }

    const order = await response.json() as { id?: string; amount?: number; currency?: string };
    if (!order.id || order.amount !== amount || order.currency !== 'INR') {
      res.status(502).json({ message: 'Payment provider returned an invalid order' });
      return;
    }

    const stored = await SessionModel.updateOne(
      { _id: session._id, mode: 'PAID', paymentStatus: 'PENDING', paymentRef: { $exists: false } },
      { $set: { paymentRef: order.id } },
      { runValidators: true }
    );

    if (stored.modifiedCount !== 1) {
      res.status(409).json({ message: 'A payment order was created concurrently; reload the session' });
      return;
    }

    res.status(201).json({ orderId: order.id, amount, currency: 'INR', keyId });
  } catch (error) {
    console.error('Payment order handler failed:', error instanceof Error ? error.name : 'UnknownError');
    next(error);
  }
};

export const verifyPayment: RequestHandler = async (req, res, next) => {
  try {
    const parsed = verifyInput.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: 'Invalid payment verification request' });
      return;
    }

    const userId = authenticatedUserId(req.user);
    if (!userId) {
      res.status(401).json({ message: 'Authentication required' });
      return;
    }

    const secret = process.env.RAZORPAY_KEY_SECRET;
    const keyId = process.env.RAZORPAY_KEY_ID;
    if (!secret || !keyId) {
      res.status(503).json({ message: 'Payment provider is not configured' });
      return;
    }

    const { sessionId, razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature } = parsed.data;
    const expected = createHmac('sha256', secret).update(`${orderId}|${paymentId}`).digest();
    const actual = Buffer.from(signature, 'hex');
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
      res.status(400).json({ message: 'Payment signature is invalid' });
      return;
    }

    const pendingSession = await SessionModel.findOne({
      _id: sessionId,
      learnerId: userId,
      participants: userId,
      mode: 'PAID',
      paymentStatus: 'PENDING',
      paymentRef: orderId
    }).lean();

    if (!pendingSession) {
      const completedSession = await SessionModel.findOne({
        _id: sessionId,
        learnerId: userId,
        paymentStatus: 'COMPLETED',
        paymentRef: orderId
      }).lean();

      const previousLedger = completedSession && await TransactionLedgerModel.exists({
        sessionId,
        type: 'DIRECT_UPI_PAYMENT',
        externalReference: paymentId
      });

      if (previousLedger) {
        res.json({ status: 'COMPLETED', sessionId });
        return;
      }
      res.status(409).json({ message: 'Payment does not match a pending order for this session' });
      return;
    }

    const paymentResponse = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}`, {
      headers: { Authorization: `Basic ${Buffer.from(`${keyId}:${secret}`).toString('base64')}` },
      signal: AbortSignal.timeout(12_000),
    });

    if (!paymentResponse.ok) {
      res.status(502).json({ message: 'Could not verify payment with provider' });
      return;
    }

    const providerPayment = await paymentResponse.json() as {
      id?: string;
      order_id?: string;
      amount?: number;
      currency?: string;
      status?: string
    };

    if (
      providerPayment.id !== paymentId ||
      providerPayment.order_id !== orderId ||
      providerPayment.amount !== Math.round(pendingSession.priceInInr * 100) ||
      providerPayment.currency !== 'INR' ||
      providerPayment.status !== 'captured'
    ) {
      res.status(409).json({ message: 'Provider reports that this payment is not captured for the expected amount' });
      return;
    }

    const transaction = await SessionModel.startSession();
    try {
      let succeeded = false;
      await transaction.withTransaction(async () => {
        const session = await SessionModel.findOne({
          _id: sessionId,
          learnerId: userId,
          participants: userId,
          mode: 'PAID',
          status: 'SCHEDULED',
          paymentStatus: 'PENDING',
          paymentRef: orderId
        }).session(transaction);

        if (!session) return;

        const updated = await SessionModel.updateOne(
          { _id: session._id, paymentStatus: 'PENDING', paymentRef: orderId },
          { $set: { paymentStatus: 'COMPLETED' } },
          { session: transaction, runValidators: true }
        );

        if (updated.modifiedCount !== 1) return;

        await TransactionLedgerModel.create([{
          fromUserId: session.learnerId,
          toUserId: session.mentorId,
          sessionId: session._id,
          amount: Math.round(session.priceInInr * 100),
          currency: 'INR',
          type: 'DIRECT_UPI_PAYMENT',
          status: 'COMMITTED',
          externalReference: paymentId,
          metadata: { gateway: 'razorpay', orderId, amountUnit: 'paise' },
        }], { session: transaction });

        succeeded = true;
      });

      if (!succeeded) {
        res.status(409).json({ message: 'Payment does not match a pending order for this session' });
        return;
      }
      res.json({ status: 'COMPLETED', sessionId });
    } finally {
      await transaction.endSession();
    }
  } catch (error) {
    if ((error as { code?: number }).code === 11000) {
      try {
        const { sessionId, razorpay_order_id: orderId, razorpay_payment_id: paymentId } = req.body as z.infer<typeof verifyInput>;
        const completed = await SessionModel.exists({
          _id: sessionId,
          learnerId: authenticatedUserId(req.user),
          paymentStatus: 'COMPLETED',
          paymentRef: orderId
        });
        const matchingLedger = completed && await TransactionLedgerModel.exists({
          sessionId,
          type: 'DIRECT_UPI_PAYMENT',
          externalReference: paymentId
        });
        if (matchingLedger) {
          res.json({ status: 'COMPLETED', sessionId });
          return;
        }
        res.status(409).json({ message: 'A different payment has already been recorded for this session' });
      } catch (lookupError) {
        next(lookupError);
      }
      return;
    }
    next(error);
  }
};
