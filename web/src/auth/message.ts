import { getAddress } from "viem";

import { AUTH_CHAIN_ID, AUTH_CHAIN_NAME } from "@/auth/constants";

export type AuthMessageFields = {
  origin: string;
  walletAddress: string;
  nonceId: string;
  nonce: string;
  chainId: number;
  issuedAt: string | Date;
  expiresAt: string | Date;
};

export function normalizeOrigin(origin: string): string {
  const parsed = new URL(origin);
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Unsupported origin protocol");
  }
  return parsed.origin;
}

function isoTimestamp(value: string | Date): string {
  const timestamp = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(timestamp.getTime())) {
    throw new Error("Invalid authentication timestamp");
  }
  return timestamp.toISOString();
}

export function buildAuthenticationMessage(fields: AuthMessageFields): string {
  if (fields.chainId !== AUTH_CHAIN_ID) {
    throw new Error("Unsupported authentication chain");
  }

  return [
    "Chain Security Cultivation Authentication",
    "",
    "Sign this message to authenticate with Chain Security Cultivation.",
    "This request does not submit a blockchain transaction or spend funds.",
    "",
    `Origin: ${normalizeOrigin(fields.origin)}`,
    `Wallet: ${getAddress(fields.walletAddress)}`,
    `Chain: ${AUTH_CHAIN_NAME}`,
    `Chain ID: ${fields.chainId}`,
    `Nonce ID: ${fields.nonceId}`,
    `Nonce: ${fields.nonce}`,
    `Issued At: ${isoTimestamp(fields.issuedAt)}`,
    `Expires At: ${isoTimestamp(fields.expiresAt)}`,
  ].join("\n");
}
