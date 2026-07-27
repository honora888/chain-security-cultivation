import { NextResponse } from "next/server";

import type {
  ChainStatusErrorCode,
  ChainStatusFailure,
} from "@/features/quest-1/chain-status-types";
import {
  ChainStatusQueryError,
  isValidEvmAddress,
  publicMessageForCode,
  queryQuestOneChainStatus,
} from "@/lib/quest-1-chain-status";

export const dynamic = "force-dynamic";

const STATUS_BY_ERROR: Record<ChainStatusErrorCode, number> = {
  INVALID_ADDRESS: 400,
  CHAIN_NOT_CONFIGURED: 503,
  RPC_UNAVAILABLE: 502,
  CHAIN_ID_MISMATCH: 502,
  CONTRACT_CALL_FAILED: 502,
  INTERNAL_ERROR: 500,
};

function failure(code: ChainStatusErrorCode) {
  const body: ChainStatusFailure = {
    ok: false,
    error: {
      code,
      message: publicMessageForCode(code),
    },
  };

  return NextResponse.json(body, {
    status: STATUS_BY_ERROR[code],
    headers: { "Cache-Control": "no-store" },
  });
}

export async function GET(request: Request) {
  const address = new URL(request.url).searchParams.get("address");

  if (!isValidEvmAddress(address)) {
    return failure("INVALID_ADDRESS");
  }

  try {
    return NextResponse.json(
      await queryQuestOneChainStatus(address),
      {
        status: 200,
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch (error) {
    if (error instanceof ChainStatusQueryError) {
      return failure(error.code);
    }
    return failure("INTERNAL_ERROR");
  }
}
