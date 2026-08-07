export async function sha256(value: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

export async function isEditorPasswordValid(password: string) {
  const expected = process.env.EDITOR_PASSWORD_HASH;
  if (!expected) return false;
  return (await sha256(password)) === expected;
}
