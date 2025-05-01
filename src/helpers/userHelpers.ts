import UserModel from "../models/UserModel";
import GroupModel from "../models/GroupModel";

export async function getUserIdByName(
	name: string,
): Promise<string | undefined> {
	const user = await UserModel.findOne({ name });
	return user?.id;
}

export async function getNameById(id: string): Promise<string | undefined> {
	const user = await UserModel.findById(id);
	return user?.name;
}

export async function getGroupNameById(
	id: string,
): Promise<string | undefined> {
	const group = await GroupModel.findById(id);
	return group?.name;
}

export async function getUserMap(ids: string[]): Promise<Map<string, string>> {
	const users = await UserModel.find({ _id: { $in: ids } });

	return new Map(users.map((user) => [user.id, user.name]));
}
