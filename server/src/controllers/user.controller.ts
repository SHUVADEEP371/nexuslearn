import { RequestHandler } from 'express';
import { Model, Types } from 'mongoose';
import { z } from 'zod';

interface UserAvailabilityRecord {
  _id: Types.ObjectId;
  availableSlots: number[];
}
const User = require('../../models/User') as Model<UserAvailabilityRecord>;
const slotsInput = z.object({
  availableSlots: z.array(z.number().int().min(0).max(167)).max(168),
}).strict().transform(({ availableSlots }) => [...new Set(availableSlots)].sort((a, b) => a - b));

export const updateAvailabilityHandler: RequestHandler = async (req, res, next) => {
  try {
    const parsed = slotsInput.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ message: 'Availability must contain UTC hour indices from 0 to 167', issues: parsed.error.issues }); return; }
    const userId = String(req.user?._id || '');
    if (!Types.ObjectId.isValid(userId)) { res.status(401).json({ message: 'Authentication required' }); return; }
    const user = await User.findByIdAndUpdate(userId, { $set: { availableSlots: parsed.data } }, { new: true, runValidators: true }).select('availableSlots');
    if (!user) { res.status(404).json({ message: 'User not found' }); return; }
    res.json({ availableSlots: user.availableSlots });
  } catch (error) { next(error); }
};
