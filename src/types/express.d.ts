import { Survey } from '@prisma/client';

declare global {
  namespace Express {
    interface Request {
      user?: { auth0Id: string, id: string };
      survey?: Survey & {
        settings: any;
        _count: { responses: number };
      };
      clientInfo?: {
        ipAddress: string;
        userAgent: string;
      };
      auth?:{
        payload: {
          sub: string;
          email: string;
          [payload: string]: any;
        }
      }
    }
  }
} 

export {};
