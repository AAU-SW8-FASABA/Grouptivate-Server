import MG from "mongoose";
import { CollectionEnum } from "../dbEnums";

const SessionSchema = new MG.Schema({
	token: {
		type: String,
		required: true,
	},
	userId: {
		type: String,
		required: true,
	},
});

const SessionModel = MG.model(CollectionEnum.Session, SessionSchema);
export default SessionModel;
