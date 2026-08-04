export type GuardianAgentErrorCode =
  | "INVALID_BODY"
  | "INVALID_ACCOUNT"
  | "INVALID_AMOUNT"
  | "CHAIN_NOT_CONFIGURED"
  | "CHAIN_ID_MISMATCH"
  | "QUEST_INACTIVE"
  | "QUEST_QUERY_MISMATCH"
  | "MOSS_CAPABILITY_INVALID"
  | "SIMULATION_FAILED"
  | "SIMULATION_EVIDENCE_INVALID"
  | "RPC_UNAVAILABLE"
  | "INTERNAL_ERROR";

export type JsonSafeValue =
  | null
  | boolean
  | number
  | string
  | readonly JsonSafeValue[]
  | { readonly [key: string]: JsonSafeValue };

export interface GuardianAgentFailure {
  ok: false;
  error: {
    code: GuardianAgentErrorCode;
    message: string;
  };
}

export interface GuardianQuestSuccess {
  ok: true;
  schemaVersion: "guardian-agent-quest-v1";
  dataSource: "moss-monad-testnet";
  queriedAt: string;
  network: {
    name: "Monad Testnet";
    chainId: 10143;
  };
  contract: {
    address: string;
  };
  quest: {
    questId: "1";
    contentHash: string;
    metadataURI: string;
    active: boolean;
    totalFunded: string;
  };
  moss: {
    protocol: "guardian";
    sourceCommit: "07b673844f8ca14e992c6dfe305c83018114a791";
    queries: readonly ["quest", "questFunding"];
    capability: "fundQuest";
  };
}

export interface GuardianPrepareRequest {
  account: string;
  amount: string;
}

export interface GuardianSimulationWarning {
  code: string;
  message: string;
}

export interface GuardianPrepareSuccess {
  ok: true;
  schemaVersion: "guardian-agent-prepare-v1";
  dataSource: "moss-monad-testnet";
  preparedAt: string;
  network: {
    name: "Monad Testnet";
    chainId: 10143;
  };
  contract: {
    address: string;
  };
  request: {
    account: string;
    questId: "1";
    amount: string;
  };
  questBefore: {
    active: boolean;
    totalFunded: string;
  };
  risk: readonly ["fundOut"];
  transaction: {
    from: string;
    to: string;
    data: string;
    value: string;
  };
  simulation: {
    halted: boolean;
    reverted: boolean;
    gas: string | null;
    warnings: readonly GuardianSimulationWarning[];
    signAllowed: boolean;
    outcome: {
      operation: "fundQuest";
      questId: "1";
      funder: string;
      amount: string;
    };
    receipt: {
      text: string;
      changes: readonly {
        kind: string;
        text: string;
        data: JsonSafeValue;
      }[];
    };
  };
  moss: {
    protocol: "guardian";
    sourceCommit: "07b673844f8ca14e992c6dfe305c83018114a791";
  };
}

export type GuardianAgentResponse =
  | GuardianQuestSuccess
  | GuardianPrepareSuccess
  | GuardianAgentFailure;
