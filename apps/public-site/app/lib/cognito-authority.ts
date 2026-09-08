/** Decoding only limits the accepted authority. GetUser must still authenticate the same token. */
export async function authenticateCognitoAuthority<T>(
  accessToken: string,
  expected: { userPoolId?: string; clientId?: string },
  getUser: (unchangedToken: string) => Promise<T>,
): Promise<T> {
  const pool=expected.userPoolId?.trim();
  const client=expected.clientId?.trim();
  if (!pool || !/^[a-z]{2}-[a-z]+-\d_[a-zA-Z0-9]+$/.test(pool) || !client) throw new Error("Identity authority is not configured.");
  if(accessToken.length > 16384) throw new Error("Invalid authenticated session.");
  const parts=accessToken.split(".");
  if(parts.length !== 3 || parts.some(part=>!part || !/^[A-Za-z0-9_-]+$/.test(part))) throw new Error("Invalid authenticated session.");
  let claims: Record<string, unknown>;
  try { claims=JSON.parse(Buffer.from(parts[1],"base64url").toString("utf8")); }
  catch { throw new Error("Invalid authenticated session."); }
  const issuer=`https://cognito-idp.${pool.split("_")[0]}.amazonaws.com/${pool}`;
  if(!claims || typeof claims !== "object" || claims.iss !== issuer || claims.client_id !== client || claims.token_use !== "access"
    || typeof claims.exp !== "number" || !Number.isFinite(claims.exp) || claims.exp <= Date.now()/1000) {
    throw new Error("Invalid authenticated session.");
  }
  return getUser(accessToken);
}
