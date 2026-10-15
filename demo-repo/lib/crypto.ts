/** Password stand-in at the end of the login chain. Not a real KDF. */

export const HASH_PREFIX = "sb1";

export function hashPassword(password: string): string {
  let hash = 2166136261;
  for (let i = 0; i < password.length; i += 1) {
    hash ^= password.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const hex = (hash >>> 0).toString(16);
  return HASH_PREFIX + ":" + hex;
}

export function verifyPassword(password: string, hashed: string): boolean {
  return hashPassword(password) === hashed;
}
