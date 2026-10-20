import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import { db } from "./db";

export const SESSION_COOKIE = "ll_session";
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  name: string;
  created_at: number;
}

export type PublicUser = Pick<UserRow, "id" | "email" | "name" | "created_at">;

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const candidate = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

export function createUser(email: string, password: string, name: string): PublicUser {
  const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
  if (existing) throw new AuthError("EMAIL_TAKEN", "该邮箱已注册");
  const user: UserRow = {
    id: randomUUID(),
    email,
    password_hash: hashPassword(password),
    name,
    created_at: Date.now(),
  };
  db.prepare(
    "INSERT INTO users (id, email, password_hash, name, created_at) VALUES (?, ?, ?, ?, ?)"
  ).run(user.id, user.email, user.password_hash, user.name, user.created_at);
  return toPublicUser(user);
}

export function verifyLogin(email: string, password: string): PublicUser {
  const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email) as UserRow | undefined;
  if (!user || !verifyPassword(password, user.password_hash)) {
    throw new AuthError("INVALID_CREDENTIALS", "邮箱或密码不正确");
  }
  return toPublicUser(user);
}

export function createSession(userId: string): { token: string; expiresAt: number } {
  const token = randomUUID();
  const expiresAt = Date.now() + SESSION_TTL_MS;
  db.prepare(
    "INSERT INTO sessions (id, user_id, token, expires_at, created_at) VALUES (?, ?, ?, ?, ?)"
  ).run(randomUUID(), userId, token, expiresAt, Date.now());
  return { token, expiresAt };
}

export function destroySession(token: string): void {
  db.prepare("DELETE FROM sessions WHERE token = ?").run(token);
}

export function findUserByToken(token: string): PublicUser | null {
  const row = db
    .prepare(
      `SELECT u.id, u.email, u.password_hash, u.name, u.created_at
       FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token = ? AND s.expires_at > ?`
    )
    .get(token, Date.now()) as UserRow | undefined;
  return row ? toPublicUser(row) : null;
}

function toPublicUser(user: UserRow): PublicUser {
  return { id: user.id, email: user.email, name: user.name, created_at: user.created_at };
}

export class AuthError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}
