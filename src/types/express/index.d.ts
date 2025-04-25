declare global {
   namespace Express {
     interface Request {
       sessionToken: string;
     }
   }
 }

export {}
