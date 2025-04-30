import MG from 'mongoose';
import { CollectionEnum } from '../db';
import type { Interval } from '../../Grouptivate-API/schemas/Interval';

const GroupSchema = new MG.Schema({
    name: {
        type: String,
        required: true,
    },
    userIds: {
        type: [String],
        required: true,
    },
    interval: {
        type: String,
        enum: ['daily', 'weekly', 'monthly'],
        required: true,
    },
    goalIds: {
        type: [String],
        required: true,
    },
    streak: {
        type: Number,
        min: 0,
        required: true,
    },
});

const GroupModel = MG.model(CollectionEnum.Group, GroupSchema);
export default GroupModel;
