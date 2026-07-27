export type ChainStatusErrorCode =
  | "INVALID_ADDRESS"
  | "CHAIN_NOT_CONFIGURED"
  | "RPC_UNAVAILABLE"
  | "CHAIN_ID_MISMATCH"
  | "CONTRACT_CALL_FAILED"
  | "INTERNAL_ERROR";

export interface ChainStatusSuccess {
  ok: true;
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
