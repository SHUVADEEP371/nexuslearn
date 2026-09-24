import mongoose, { ClientSession, Types } from 'mongoose';
import { SessionModel } from '../models/session.model';
import { TransactionLedgerModel } from '../models/transactionLedger.model';
import { UserModel } from '../models/user.model';

const validAmount = (amount: number): boolean => Number.isSafeInteger(amount) && amount > 0 && amount <= 10_000;
const validObjectId = (value: string): boolean => Types.ObjectId.isValid(value);

/** Performs a single guarded wallet/session transition and its audit write atomically. */
export class EscrowService {
  async lockCreditForSession(learnerId: string, sessionId: string, creditsToLock = 1): Promise<boolean> {
    if (!validObjectId(learnerId) || !validObjectId(sessionId) || !validAmount(creditsToLock)) return false;
    return this.inTransaction((transaction) => this.lockCreditForSessionWithinTransaction(learnerId, sessionId, creditsToLock, transaction));
  }

  /** Allows booking and the initial credit hold to commit as one transaction. */
  async lockCreditForSessionWithinTransaction(learnerId: string, sessionId: string, creditsToLock: number, transaction: ClientSession): Promise<boolean> {
    if (!validObjectId(learnerId) || !validObjectId(sessionId) || !validAmount(creditsToLock)) return false;
    const session = await SessionModel.findOne({
      _id: sessionId,
      learnerId,
      mode: 'CREDIT',
      status: { $in: ['SCHEDULED', 'ACTIVE'] },
      paymentStatus: { $in: ['PENDING', 'NOT_APPLICABLE'] },
    }).session(transaction).lean();
    if (!session) return false;

    // Older accounts created before wallet fields existed receive the same
    // initial balance as new accounts, inside this transaction.
    await UserModel.updateOne(
      { _id: learnerId, 'wallet.availableCredits': { $exists: false } },
      { $set: { 'wallet.availableCredits': 2, 'wallet.lockedCredits': 0 } },
      { session: transaction },
    );

    const debit = await UserModel.updateOne(
      { _id: learnerId, 'wallet.availableCredits': { $gte: creditsToLock } },
      { $inc: { 'wallet.availableCredits': -creditsToLock, 'wallet.lockedCredits': creditsToLock } },
      { session: transaction, runValidators: true },
    );
    if (debit.modifiedCount !== 1) return false;

    const held = await SessionModel.updateOne(
      { _id: session._id, paymentStatus: { $in: ['PENDING', 'NOT_APPLICABLE'] } },
      { $set: { paymentStatus: 'HELD_IN_ESCROW' } },
      { session: transaction, runValidators: true },
    );
    if (held.modifiedCount !== 1) return false;

    await TransactionLedgerModel.create([{
      fromUserId: new Types.ObjectId(learnerId),
      sessionId: session._id,
      amount: creditsToLock,
      currency: 'SKILL_CREDIT',
      type: 'HOLD',
      status: 'COMMITTED',
      metadata: { operation: 'session-credit-hold' },
    }], { session: transaction });
    return true;
  }

  async releaseEscrowOnCompletion(sessionId: string, creditsToRelease = 1): Promise<boolean> {
    if (!validObjectId(sessionId) || !validAmount(creditsToRelease)) return false;
    return this.inTransaction(async (transaction) => {
      const session = await SessionModel.findOne({ _id: sessionId, paymentStatus: 'HELD_IN_ESCROW', mode: 'CREDIT' }).session(transaction).lean();
      if (!session) return false;

      const debit = await UserModel.updateOne(
        { _id: session.learnerId, 'wallet.lockedCredits': { $gte: creditsToRelease } },
        { $inc: { 'wallet.lockedCredits': -creditsToRelease } },
        { session: transaction, runValidators: true },
      );
      if (debit.modifiedCount !== 1) return false;

      await UserModel.updateOne(
        { _id: session.mentorId, 'wallet.availableCredits': { $exists: false } },
        { $set: { 'wallet.availableCredits': 2, 'wallet.lockedCredits': 0 } },
        { session: transaction },
      );

      const credit = await UserModel.updateOne(
        { _id: session.mentorId },
        { $inc: { 'wallet.availableCredits': creditsToRelease } },
        { session: transaction, runValidators: true },
      );
      if (credit.modifiedCount !== 1) return false;

      const completed = await SessionModel.updateOne(
        { _id: session._id, paymentStatus: 'HELD_IN_ESCROW', status: { $in: ['SCHEDULED', 'ACTIVE'] } },
        { $set: { status: 'COMPLETED', paymentStatus: 'COMPLETED', endedAt: new Date() } },
        { session: transaction, runValidators: true },
      );
      if (completed.modifiedCount !== 1) return false;

      await TransactionLedgerModel.create([{
        fromUserId: session.learnerId,
        toUserId: session.mentorId,
        sessionId: session._id,
        amount: creditsToRelease,
        currency: 'SKILL_CREDIT',
        type: 'RELEASE',
        status: 'COMMITTED',
        metadata: { operation: 'session-credit-release' },
      }], { session: transaction });
      return true;
    });
  }

  async refundEscrow(sessionId: string, creditsToRefund = 1): Promise<boolean> {
    if (!validObjectId(sessionId) || !validAmount(creditsToRefund)) return false;
    return this.inTransaction(async (transaction) => {
      const session = await SessionModel.findOne({ _id: sessionId, paymentStatus: 'HELD_IN_ESCROW', mode: 'CREDIT', status: 'SCHEDULED' }).session(transaction).lean();
      if (!session) return false;

      const refund = await UserModel.updateOne(
        { _id: session.learnerId, 'wallet.lockedCredits': { $gte: creditsToRefund } },
        { $inc: { 'wallet.lockedCredits': -creditsToRefund, 'wallet.availableCredits': creditsToRefund } },
        { session: transaction, runValidators: true },
      );
      if (refund.modifiedCount !== 1) return false;

      const cancelled = await SessionModel.updateOne(
        { _id: session._id, paymentStatus: 'HELD_IN_ESCROW', status: 'SCHEDULED' },
        { $set: { status: 'CANCELLED', paymentStatus: 'REFUNDED', endedAt: new Date() } },
        { session: transaction, runValidators: true },
      );
      if (cancelled.modifiedCount !== 1) return false;

      await TransactionLedgerModel.create([{
        toUserId: session.learnerId,
        sessionId: session._id,
        amount: creditsToRefund,
        currency: 'SKILL_CREDIT',
        type: 'REFUND',
        status: 'COMMITTED',
        metadata: { operation: 'session-credit-refund', source: 'escrow' },
      }], { session: transaction });
      return true;
    });
  }

  /** Marks an escrowed session disputed without moving its locked credit. */
  async disputeEscrow(sessionId: string, reportingUserId: string, reason: string): Promise<boolean> {
    if (!validObjectId(sessionId) || !validObjectId(reportingUserId)) return false;
    const safeReason = reason.trim().replace(/[<>]/g, '').slice(0, 1000);
    if (!safeReason) return false;
    return this.inTransaction(async (transaction) => {
      const session = await SessionModel.findOne({
        _id: sessionId,
        participants: new Types.ObjectId(reportingUserId),
        mode: 'CREDIT',
        paymentStatus: 'HELD_IN_ESCROW',
        status: 'SCHEDULED',
      }).session(transaction).lean();
      if (!session) return false;
      const updated = await SessionModel.updateOne(
        { _id: session._id, status: 'SCHEDULED', paymentStatus: 'HELD_IN_ESCROW' },
        { $set: { status: 'DISPUTED' } },
        { session: transaction, runValidators: true },
      );
      if (updated.modifiedCount !== 1) return false;
      await TransactionLedgerModel.create([{
        fromUserId: new Types.ObjectId(reportingUserId),
        sessionId: session._id,
        amount: 1,
        currency: 'SKILL_CREDIT',
        type: 'DISPUTE',
        status: 'COMMITTED',
        metadata: { operation: 'session-dispute', reason: safeReason },
      }], { session: transaction });
      return true;
    });
  }

  private async inTransaction(operation: (transaction: ClientSession) => Promise<boolean>): Promise<boolean> {
    const transaction = await mongoose.startSession();
    transaction.startTransaction({ readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' }, readPreference: 'primary' });
    try {
      const completed = await operation(transaction);
      if (!completed) {
        await transaction.abortTransaction();
        return false;
      }
      await transaction.commitTransaction();
      return true;
    } catch (error) {
      if (transaction.inTransaction()) await transaction.abortTransaction();
      throw error;
    } finally {
      await transaction.endSession();
    }
  }
}

export const escrowService = new EscrowService();
