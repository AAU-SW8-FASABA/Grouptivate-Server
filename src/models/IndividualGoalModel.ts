import MG from 'mongoose';
import { CollectionEnum } from '../db';

const IndividualGoalSchema = new MG.Schema({
    activity: {
        type: String,
        required: true,
    },
    metric: {
        type: String,
        required: true,
    },
    progress: {
        type: Number,
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
    userId: {
        type: String,
        required: true,
    },
});

const IndividualGoalModel = MG.model(
    CollectionEnum.IndividualGoal,
    IndividualGoalSchema,
);

export default IndividualGoalModel;
