import { error } from 'console';
import { MongoClient, ObjectId, type WithId } from 'mongodb';
import mg from 'mongoose';
import { optional } from 'valibot';

export enum CollectionEnum {
    Goal = 'Goal',
    Group = 'Group',
    User = 'User',
    Invite = 'Invite',
    Session = 'Session',
}

const connectionString = process.env.ATLAS_URI;

if (!connectionString) throw error('ATLAS_URI is not set');
const client = new MongoClient(connectionString);

let conn = client;
try {
    conn = await client.connect();
} catch (e) {
    console.error(e);
}

let db = conn.db('Grouptivate');

export async function get(_collection: CollectionEnum, id: string) {
    try {
        const uuid = new ObjectId(id);
        const collection = db.collection(_collection);
        switch (_collection) {
            case CollectionEnum.Goal:
                console.log('Not implemented');
                return;
            case CollectionEnum.Group:
            case CollectionEnum.User:
                const query = { _id: uuid };
                const res = await collection.findOne(query);
                return res;
            case CollectionEnum.Invite:
                //const querya = "user: uuid};
                const invites = await collection.findOne({ _id: uuid });
                return invites;
            default:
                throw error('OutOfBounds');
        }
    } catch (e) {
        console.log(e);
    }
}

export async function getSessionFromToken(token: string) {
    try {
        return await db.collection(CollectionEnum.Session).findOne({ token });
    } catch (e) {
        console.log(e);
    }
}

export async function getUserByName(name: string) {
    try {
        return await db.collection(CollectionEnum.User).findOne({ name });
    } catch (e) {
        console.log(e);
    }
}

export async function insertSessionToken(token: string) {
    try {
        return await db.collection(CollectionEnum.Session).insertOne({ token });
    } catch (e) {
        console.log(e);
    }
}

export async function getFilter(
    _collection: CollectionEnum,
    filter: object,
    project?: object,
) {
    const collection = db.collection(_collection);
    if (project) return collection.find(filter).project(project);
    return collection.find(filter);
}

export async function existFilter(_collection: CollectionEnum, filter: object) {
    if ('_id' in filter && typeof filter['_id'] == 'string') {
        filter['_id'] = new ObjectId(filter['_id']);
    }
    const collection = db.collection(_collection);

    return collection.countDocuments(filter);
}

export async function update(
    _collection: CollectionEnum,
    id: string,
    data: object,
) {
    const uuid = new ObjectId(id);
    const collection = db.collection(_collection);
    if ('uuid' in data) delete data['uuid'];
    collection.updateOne({ _id: uuid }, data);
}
export async function updateFilter(
    _collection: CollectionEnum,
    filter: object,
    data: object,
) {
    const collection = db.collection(_collection);
    if ('uuid' in data) delete data['uuid'];
    collection.updateOne(filter, data);
}

export async function insert(_collection: CollectionEnum, data: object) {
    const collection = db.collection(_collection);
    if ('uuid' in data) delete data['uuid'];
    const result = await collection.insertOne(data);
    return result.insertedId;
}

export async function remove(_collection: CollectionEnum, filter: object) {
    //TODO: check om fejler

    if ('_id' in filter && typeof filter['_id'] == 'string') {
        filter['_id'] = new ObjectId(filter['_id']);
    }
    const collection = db.collection(_collection);
    collection.deleteMany(filter);
}
