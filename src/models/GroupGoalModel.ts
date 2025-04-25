import MG from 'mongoose';
import { CollectionEnum } from '../db';

const GroupGoalSchema = new MG.Schema({
    activity: {
        type: String,
        required: true,
    },
    metric: {
        type: String,
        required: true,
    },
    progress: {
        type: Map,
        of: Number,
        required: true,
    },
    target: {
        type: Number,
        required: true,
    },
    title: {
        type: String,
        required: true,
    },
});

const GroupGoalModel = MG.model(CollectionEnum.GroupGoal, GroupGoalSchema);
export default GroupGoalModel;
