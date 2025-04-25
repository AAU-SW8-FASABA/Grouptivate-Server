import MG from 'mongoose';
import { CollectionEnum } from '../db';

const GoalSchema = new MG.Schema({
    type: {
        type: String,
        enum: ['group', 'individual'],
        required: true,
    },
    title: {
        type: String,
        required: true,
    },
    activity: {
        type: String,
        required: true,
    },
    metric: {
        type: String,
        required: true,
    },
    target: {
        type: Number,
        required: true,
    },
    progress: {
        type: Map,
        of: Number,
        required: true,
    },
});

const GoalModel = MG.model(CollectionEnum.GroupGoal, GoalSchema);
export default GoalModel;
