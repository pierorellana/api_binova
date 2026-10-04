import { Request } from 'express';

export interface AuthenticatedUser {
  userId: string;
  sessionId: string;
  email: string;
}

export type AuthenticatedRequest = Request & {
  user: AuthenticatedUser;
  correlationId: string;
};
