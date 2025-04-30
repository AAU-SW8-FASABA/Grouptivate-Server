import MG from "mongoose";
import { CollectionEnum } from "../dbCollections";

const UserSchema = new MG.Schema({
	name: {
		type: String,
		required: true,
	},
	groupIds: {
		type: [String],
		required: true,
	},
	password: {
		type: String,
		required: true,
	},
	lastSync: {
		type: [String],
		required: true,
		description: "TODO",
	},
});

const UserModel = MG.model(CollectionEnum.User, UserSchema);
export default UserModel;
