import { cookies } from "next/headers";
import { SESSION_COOKIE, findUserByToken, type PublicUser } from "./auth";

export async function getCurrentUser(): Promise<PublicUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return findUserByToken(token);
}
