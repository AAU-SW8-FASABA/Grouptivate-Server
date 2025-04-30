import UserModel from '../models/UserModel';
import MG from 'mongoose';

export async function getUserIdByName(
    name: string,
): Promise<string | undefined> {
    const user = await UserModel.findOne({ name });
    return user?.id;
}

export async function getNameById(id: string): Promise<string | undefined> {
    const user = await UserModel.findOne({ _id: new MG.Types.ObjectId(id) });
    return user?.name;
}

export async function getUserMap(ids: string[]): Promise<Map<string, string>> {
    const users = await UserModel.find({ _id: { $in: ids } });

    return new Map(users.map((user) => [user.id, user.name]));
}
