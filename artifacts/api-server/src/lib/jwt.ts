import jwt from "jsonwebtoken";

// Use a secure random string in production if not provided in .env
const JWT_SECRET = process.env.JWT_SECRET || "fallback_secret_key_for_development_only";

export interface JwtPayload {
  userId: string;
  isAnon?: boolean;
}

export function generateToken(payload: JwtPayload, expiresIn: string | number = "7d"): string {
  return jwt.sign(payload, JWT_SECRET as jwt.Secret, {
    expiresIn: expiresIn as jwt.SignOptions["expiresIn"],
  });
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    return decoded;
  } catch (err) {
    return null;
  }
}
