import { error } from 'console';
import { MongoClient, ObjectId, type WithId } from 'mongodb';

export enum collectionEnum {
    Goal = 'Goal',
    Group = 'Group',
    User = 'User',
    Invite = 'Invite',
}

const connectionString = process.env.ATLAS_URI || '';

if (connectionString == '') throw error('ATLAS_URI is not set');
const client = new MongoClient(connectionString);

let conn = client;
try {
    conn = await client.connect();
} catch (e) {
    console.error(e);
}

let db = conn.db('Grouptivate');

// export default db;

export async function get(_collection: collectionEnum, id: string) {
    try {
        const uuid = new ObjectId(id);
        const collection = db.collection(_collection);
        switch (_collection) {
            case collectionEnum.Goal:
                console.log('Not implemented');

                return;
            case collectionEnum.Group:
            case collectionEnum.User:
                const query = { _id: uuid };
                const res = await collection.findOne(query);
                return res;
            case collectionEnum.Invite:
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
export async function getFilter(
    _collection: collectionEnum,
    filter: object,
    project?: object,
) {
    const collection = db.collection(_collection);
    if (project) return collection.find(filter).project(project);
    return collection.find(filter);
}

export async function findOneFilter(
    _collection: collectionEnum,
    filter: object,
) {
    const collection = db.collection(_collection);
    return collection.findOne(filter);
}

export async function existFilter(_collection: collectionEnum, filter: object) {
    if ('_id' in filter && typeof filter['_id'] == 'string') {
        filter['_id'] = new ObjectId(filter['_id']);
    }
    const collection = db.collection(_collection);

    return collection.countDocuments(filter);
}

export async function update(
    _collection: collectionEnum,
    id: string,
    data: object,
) {
    const uuid = new ObjectId(id);
    const collection = db.collection(_collection);
    if ('uuid' in data) delete data['uuid'];
    collection.updateOne({ _id: uuid }, data);
}
export async function updateFilter(
    _collection: collectionEnum,
    filter: Record<string, Record<string, any> | string>,
    data: object,
) {
    if ('_id' in filter) {
        if (typeof filter['_id'] == 'string')
            filter['_id'] = new ObjectId(filter['_id']);
        else if ('$in' in filter._id) {
            for (const index in filter._id.$in) {
                filter._id.$in[index] = new ObjectId(filter._id.$in[index]);
            }
        }
    }
    const collection = db.collection(_collection);
    if ('uuid' in data) delete data['uuid'];
    collection.updateOne(filter, data);
}

export async function insert(_collection: collectionEnum, data: object) {
    const collection = db.collection(_collection);
    if ('uuid' in data) delete data['uuid'];
    const result = await collection.insertOne(data);
    return result.insertedId;
}

export async function remove(_collection: collectionEnum, filter: object) {
    //TODO: check om fejler?

    if ('_id' in filter && typeof filter['_id'] == 'string') {
        filter['_id'] = new ObjectId(filter['_id']);
    }
    const collection = db.collection(_collection);
    collection.deleteMany(filter);
}
