import UserModel from '../models/UserModel';
import MG from 'mongoose';

export async function getUsernameFromId(
    id: string,
): Promise<string | undefined> {
    const user = await UserModel.findOne({ _id: new MG.Types.ObjectId(id) });
    return user?.name;
}

export async function getUsernamesFromIds(
    ids: string[],
): Promise<string[] | undefined> {
    const userNames = await Promise.all(ids.map((id) => getUsernameFromId(id)));

    // Filter out any undefined usernames
    if (userNames.some((name) => name === undefined)) {
        return undefined;
    }

    // If all usernames are undefined, return undefined; otherwise, return the filtered array
    return userNames as string[];
}
