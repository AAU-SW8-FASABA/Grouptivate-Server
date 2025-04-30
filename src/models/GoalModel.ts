import MG from "mongoose";
import { CollectionEnum } from "../dbCollections";
import { GoalType } from "../../Grouptivate-API/schemas/Goal";

const GoalSchema = new MG.Schema({
	type: {
		type: String,
		enum: GoalType,
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

const GoalModel = MG.model(CollectionEnum.Goal, GoalSchema);
export default GoalModel;
