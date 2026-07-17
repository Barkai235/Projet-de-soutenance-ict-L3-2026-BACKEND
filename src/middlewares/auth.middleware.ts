import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt.utils';
import { sendError }         from '../utils/response.utils';

export interface AuthRequest extends Request {
  user?: {
    id:     number;
    uuid:   string;
    roleId: number;
    role:   string;
    email:  string;
  };
}

export const authenticate = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  // Support token depuis header OU query param (pour export dans onglet)
  let token: string | undefined;

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (req.query.token_inline) {
    token = req.query.token_inline as string;
  }

  if (!token) { sendError(res, 'Token manquant', 401); return; }

  try {
    const decoded = verifyAccessToken(token);
    req.user = decoded;
    next();
  } catch {
    sendError(res, 'Token invalide ou expiré', 401);
  }
};

export const authorize = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) { sendError(res, 'Non authentifié', 401); return; }
    if (!roles.includes(req.user.role)) {
      sendError(res, 'Accès refusé : rôle insuffisant', 403);
      return;
    }
    next();
  };
};