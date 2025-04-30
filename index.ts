import express, { type Request, type Response } from 'express';
import { authMiddleware } from './src/middleware';
import MG from 'mongoose';

import { router as userRouter } from './src/routes/user';
import { router as groupRouter } from './src/routes/group';

// TODO: Make this file pretty
const connectionString = process.env.ATLAS_URI;

if (!connectionString) {
    throw new Error('ATLAS_URI is not set');
}

try {
    await MG.connect(connectionString, { dbName: 'Grouptivate' });
} catch (e) {
    console.log(`Error connecting to MongoDB: ${e}`);
}
console.log('Connected to MongoDB');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(authMiddleware);

app.get('/', (req: Request, res: Response) => {
    res.send('Hello to the one and only grouptivate');
});
app.use('/user', userRouter);
app.use('/group', groupRouter);

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

process.on('SIGINT', async () => {
    await MG.connection.close();
    process.exit(0);
});
