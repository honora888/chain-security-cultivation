import { getAddress, verifyMessage } from "viem";
import { randomUUID } from "node:crypto";

import { DatabaseConfigurationError, getNeonSql, type NeonSql } from "@/db/client";
import {
  AUTH_CHAIN_ID,
  AUTH_NONCE_TTL_SECONDS,
  AUTH_SESSION_TTL_SECONDS,
} from "@/auth/constants";
import { hashesMatch, hashSecret, createSecretToken } from "@/auth/crypto";
import { buildAuthenticationMessage } from "@/auth/message";
import { AuthHttpError } from "@/auth/http";

type NonceRow = {
  id: string;
  wallet_address: string;
  nonce_hash: string;
  created_at: string | Date;
  expires_at: string | Date;
  used_at: string | Date | null;
};

type SessionRow = {
  wallet_address: string;
  expires_at: string | Date;
};

type AuthenticatedSession = {
  walletAddress: string;
  expiresAt: string;
};

type VerifiedSession = AuthenticatedSession & { sessionToken: string };

async function queryRows<T>(sql: NeonSql, query: string, params: unknown[]): Promise<T[]> {
  const rows = await sql.query(query, params);
  return rows as unknown as T[];
}

function mapDatabaseError(error: unknown): never {
  if (error instanceof DatabaseConfigurationError) {
    throw new AuthHttpError("DATABASE_NOT_CONFIGURED");
  }
  throw new AuthHttpError("DATABASE_UNAVAILABLE");
}

export function normalizeWalletAddress(value: string): string {
  try {
    return getAddress(value);
  } catch {
    throw new AuthHttpError("INVALID_WALLET_ADDRESS");
  }
}

export function walletAddressForDatabase(value: string): string {
  return normalizeWalletAddress(value).toLowerCase();
}

export async function issueNonce(walletAddress: string, origin: string) {
  const checksumAddress = normalizeWalletAddress(walletAddress);
  const databaseAddress = checksumAddress.toLowerCase();
  const nonceId = randomUUID();
  const nonce = createSecretToken(32);
  const nonceHash = hashSecret(nonce);
  const issuedAt = new Date();
  const expiresAt = new Date(issuedAt.getTime() + AUTH_NONCE_TTL_SECONDS * 1000);

  let rows: NonceRow[];
  try {
    const sql = getNeonSql();
    rows = await queryRows<NonceRow>(
      sql,
      `WITH invalidated AS (
         UPDATE wallet_nonces
         SET used_at = now()
         WHERE wallet_address = $1 AND used_at IS NULL
       )
       INSERT INTO wallet_nonces (id, wallet_address, nonce_hash, expires_at, created_at)
       VALUES ($2, $1, $3, $4, $5)
       RETURNING id, wallet_address, nonce_hash, created_at, expires_at, used_at`,
      [databaseAddress, nonceId, nonceHash, expiresAt.toISOString(), issuedAt.toISOString()],
    );
  } catch (error) {
    return mapDatabaseError(error);
  }

  const row = rows[0];
  if (!row) {
    throw new AuthHttpError("DATABASE_UNAVAILABLE");
  }

  const message = buildAuthenticationMessage({
    origin,
    walletAddress: checksumAddress,
    nonceId: row.id,
    nonce,
    chainId: AUTH_CHAIN_ID,
    issuedAt: row.created_at,
    expiresAt: row.expires_at,
  });

  return {
    walletAddress: checksumAddress,
    nonceId: row.id,
    nonce,
    message,
    issuedAt: new Date(row.created_at).toISOString(),
    expiresAt: new Date(row.expires_at).toISOString(),
  };
}

export async function verifyWalletSignature(input: {
  walletAddress: string;
  nonceId: string;
  nonce: string;
  signature: string;
  origin: string;
}): Promise<VerifiedSession> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.nonceId)) {
    throw new AuthHttpError("INVALID_REQUEST");
  }
  const checksumAddress = normalizeWalletAddress(input.walletAddress);
  const databaseAddress = checksumAddress.toLowerCase();
  let nonceRows: NonceRow[];

  try {
    const sql = getNeonSql();
    nonceRows = await queryRows<NonceRow>(
      sql,
      "SELECT id, wallet_address, nonce_hash, created_at, expires_at, used_at FROM wallet_nonces WHERE id = $1 LIMIT 1",
      [input.nonceId],
    );
  } catch (error) {
    return mapDatabaseError(error);
  }

  const nonceRow = nonceRows[0];
  if (!nonceRow || nonceRow.wallet_address !== databaseAddress) {
    throw new AuthHttpError("NONCE_INVALID");
  }
  if (nonceRow.used_at !== null) {
    throw new AuthHttpError("NONCE_ALREADY_USED");
  }
  if (new Date(nonceRow.expires_at).getTime() <= Date.now()) {
    throw new AuthHttpError("NONCE_EXPIRED");
  }
  if (!hashesMatch(nonceRow.nonce_hash, hashSecret(input.nonce))) {
    throw new AuthHttpError("NONCE_INVALID");
  }

  let message: string;
  try {
    message = buildAuthenticationMessage({
      origin: input.origin,
      walletAddress: checksumAddress,
      nonceId: nonceRow.id,
      nonce: input.nonce,
      chainId: AUTH_CHAIN_ID,
      issuedAt: nonceRow.created_at,
      expiresAt: nonceRow.expires_at,
    });
  } catch {
    throw new AuthHttpError("NONCE_INVALID");
  }

  let validSignature = false;
  try {
    validSignature = await verifyMessage({
      address: checksumAddress as `0x${string}`,
      message,
      signature: input.signature as `0x${string}`,
    });
  } catch {
    validSignature = false;
  }
  if (!validSignature) {
    throw new AuthHttpError("INVALID_SIGNATURE");
  }

  const sessionToken = createSecretToken(32);
  const sessionHash = hashSecret(sessionToken);
  const sessionExpiresAt = new Date(Date.now() + AUTH_SESSION_TTL_SECONDS * 1000);
  let sessionRows: SessionRow[];
  try {
    const sql = getNeonSql();
    sessionRows = await queryRows<SessionRow>(
      sql,
      `WITH consumed_nonce AS (
         UPDATE wallet_nonces
         SET used_at = now()
         WHERE id = $1
           AND wallet_address = $2
           AND nonce_hash = $3
           AND used_at IS NULL
           AND expires_at > now()
         RETURNING id
       )
       INSERT INTO wallet_sessions (wallet_address, session_hash, expires_at)
       SELECT $2, $4, $5
       FROM consumed_nonce
       RETURNING wallet_address, expires_at`,
      [nonceRow.id, databaseAddress, nonceRow.nonce_hash, sessionHash, sessionExpiresAt.toISOString()],
    );
  } catch (error) {
    return mapDatabaseError(error);
  }

  const sessionRow = sessionRows[0];
  if (!sessionRow) {
    throw new AuthHttpError("NONCE_ALREADY_USED");
  }

  return {
    walletAddress: checksumAddress,
    expiresAt: new Date(sessionRow.expires_at).toISOString(),
    sessionToken,
  };
}

export async function readSession(sessionToken: string): Promise<AuthenticatedSession | null> {
  const sessionHash = hashSecret(sessionToken);
  let rows: SessionRow[];
  try {
    rows = await queryRows<SessionRow>(
      getNeonSql(),
      "SELECT wallet_address, expires_at FROM wallet_sessions WHERE session_hash = $1 AND revoked_at IS NULL AND expires_at > now() LIMIT 1",
      [sessionHash],
    );
  } catch (error) {
    return mapDatabaseError(error);
  }

  const row = rows[0];
  return row
    ? { walletAddress: normalizeWalletAddress(row.wallet_address), expiresAt: new Date(row.expires_at).toISOString() }
    : null;
}

export async function revokeSession(sessionToken: string): Promise<void> {
  try {
    await getNeonSql().query(
      "UPDATE wallet_sessions SET revoked_at = now() WHERE session_hash = $1 AND revoked_at IS NULL",
      [hashSecret(sessionToken)],
    );
  } catch (error) {
    return mapDatabaseError(error);
  }
}
