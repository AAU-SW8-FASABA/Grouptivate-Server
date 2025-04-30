import MG from "mongoose";
import { CollectionEnum } from "../dbCollections";

const InviteSchema = new MG.Schema({
	groupId: {
		type: String,
		required: true,
	},
	inviteeId: {
		type: String,
		required: true,
	},
	inviterId: {
		type: String,
		required: true,
	},
});

const InviteModel = MG.model(CollectionEnum.Invite, InviteSchema);
export default InviteModel;
