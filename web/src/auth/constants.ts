export const AUTH_CHAIN_ID = 10143 as const;
export const AUTH_CHAIN_NAME = "Monad Testnet" as const;
export const AUTH_COOKIE_NAME = "csc_session" as const;
export const AUTH_NONCE_TTL_SECONDS = 600 as const;
export const AUTH_SESSION_TTL_SECONDS = 604800 as const;
export const AUTH_SCHEMA_VERSION = "wallet-auth-v1" as const;
export const AUTH_REQUEST_BODY_MAX_BYTES = 32_768 as const;

export const AUTH_COOKIE_MAX_AGE = AUTH_SESSION_TTL_SECONDS;
