import MG from "mongoose";
import { CollectionEnum } from "../dbEnums";

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
});

const UserModel = MG.model(CollectionEnum.User, UserSchema);
export default UserModel;
