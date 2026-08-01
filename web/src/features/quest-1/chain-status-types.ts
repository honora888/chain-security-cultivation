export type ChainStatusErrorCode =
  | "INVALID_ADDRESS"
  | "INVALID_QUERY"
  | "CHAIN_NOT_CONFIGURED"
  | "RPC_TIMEOUT"
  | "RPC_UNAVAILABLE"
  | "RPC_HTTP_ERROR"
  | "RPC_CONTENT_TYPE_ERROR"
  | "RPC_JSON_PARSE_ERROR"
  | "RPC_PROTOCOL_ERROR"
  | "RPC_REMOTE_ERROR"
  | "CHAIN_ID_MISMATCH"
  | "CONTRACT_NOT_DEPLOYED"
  | "MALFORMED_RESULT"
  | "ABI_DECODE_ERROR"
  | "CONTRACT_CALL_FAILED"
  | "INTERNAL_ERROR";

export interface ChainStatusSuccess {
  ok: true;
  schemaVersion: "quest-1-chain-status-v1";
  dataSource: "monad-testnet-rpc";
  queriedAt: string;
  network: {
    name: "Monad Testnet";
    chainId: 10143;
  };
  contract: {
    address: string;
  };
  query: {
    address: string;
    questId: 1;
  };
  status: {
    completed: boolean;
    reportHash: string;
    badgeBalance: string;
  };
  blockNumber: string;
}

export interface ChainStatusFailure {
  ok: false;
  error: {
    code: ChainStatusErrorCode;
    message: string;
  };
}

export type ChainStatusResponse =
  | ChainStatusSuccess
  | ChainStatusFailure;
