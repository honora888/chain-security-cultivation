"use client";

import { getAddress } from "viem";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { AUTH_CHAIN_ID, AUTH_CHAIN_NAME } from "@/auth/constants";

type Eip1193Provider = {
  request(args: { method: string; params?: readonly unknown[] }): Promise<unknown>;
  on?(event: "accountsChanged" | "chainChanged", listener: (...args: unknown[]) => void): void;
  removeListener?(event: "accountsChanged" | "chainChanged", listener: (...args: unknown[]) => void): void;
};

declare global {
  interface Window {
    ethereum?: Eip1193Provider;
  }
}

type AuthSessionResponse = {
  ok: boolean;
  authenticated?: boolean;
  walletAddress?: string;
};

export type WalletAuthState = {
  providerAvailable: boolean;
  walletAddress: string | null;
  chainId: number | null;
  authenticated: boolean;
  loading: boolean;
  error: string | null;
  connect: () => Promise<void>;
  switchNetwork: () => Promise<void>;
  signIn: () => Promise<void>;
  refreshSession: () => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
};

const WalletAuthContext = createContext<WalletAuthState | null>(null);
const MONAD_CHAIN_HEX = "0x279f" as const;

function provider(): Eip1193Provider | null {
  return typeof window === "undefined" ? null : window.ethereum ?? null;
}

function normalizeAddress(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    return getAddress(value);
  } catch {
    return null;
  }
}

function parseChainId(value: unknown): number | null {
  if (typeof value !== "string" || !/^0x[0-9a-f]+$/iu.test(value)) return null;
  const parsed = Number.parseInt(value, 16);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function matchesAddress(first: string | null, second: string | undefined): boolean {
  return Boolean(first && second && first.toLowerCase() === second.toLowerCase());
}

async function readJson(response: Response): Promise<Record<string, unknown>> {
  const value: unknown = await response.json().catch(() => null);
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function publicError(body: Record<string, unknown>, fallback: string): string {
  const error = body.error;
  if (typeof error === "object" && error !== null && "message" in error && typeof error.message === "string") {
    return error.message;
  }
  return fallback;
}

export function WalletAuthProvider({ children }: { children: ReactNode }) {
  const [providerAvailable, setProviderAvailable] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const walletRef = useRef<string | null>(null);

  const updateWallet = useCallback((address: string | null, nextChainId: number | null) => {
    walletRef.current = address;
    setWalletAddress(address);
    setChainId(nextChainId);
  }, []);

  const refreshSession = useCallback(async () => {
    try {
      const response = await fetch("/api/auth/session", {
        credentials: "include",
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      const body = await readJson(response) as AuthSessionResponse;
      if (!response.ok || body.ok !== true) {
        setAuthenticated(false);
        return;
      }
      setAuthenticated(body.authenticated === true && matchesAddress(walletRef.current, body.walletAddress));
    } catch {
      setAuthenticated(false);
    }
  }, []);

  const readWallet = useCallback(async (requestAccounts: boolean) => {
    const currentProvider = provider();
    if (!currentProvider) {
      updateWallet(null, null);
      setAuthenticated(false);
      return null;
    }
    const [accountsValue, chainValue] = await Promise.all([
      currentProvider.request({ method: requestAccounts ? "eth_requestAccounts" : "eth_accounts" }),
      currentProvider.request({ method: "eth_chainId" }),
    ]);
    const accounts = Array.isArray(accountsValue) ? accountsValue : [];
    const address = normalizeAddress(accounts[0]);
    updateWallet(address, parseChainId(chainValue));
    return address;
  }, [updateWallet]);

  const connect = useCallback(async () => {
    if (!provider()) {
      setError("未检测到浏览器钱包，请安装或启用兼容 EIP-1193 的钱包扩展。");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await readWallet(true);
      await refreshSession();
    } catch {
      setError("钱包连接未完成，请在钱包中确认账户访问后重试。");
    } finally {
      setLoading(false);
    }
  }, [readWallet, refreshSession]);

  const switchNetwork = useCallback(async () => {
    const currentProvider = provider();
    if (!currentProvider) {
      setError("未检测到浏览器钱包，无法切换网络。");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await currentProvider.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: MONAD_CHAIN_HEX }],
      });
      await readWallet(false);
    } catch (requestError) {
      const code = typeof requestError === "object" && requestError !== null && "code" in requestError
        ? requestError.code
        : undefined;
      setError(code === 4902
        ? `钱包尚未配置 ${AUTH_CHAIN_NAME}；请在钱包中手动添加后重试。`
        : "网络切换未完成，请在钱包中确认后重试。");
    } finally {
      setLoading(false);
    }
  }, [readWallet]);

  const signIn = useCallback(async () => {
    const currentProvider = provider();
    if (!currentProvider || !walletRef.current) {
      setError("请先连接钱包。");
      return;
    }
    if (chainId !== AUTH_CHAIN_ID) {
      setError(`请先切换到 ${AUTH_CHAIN_NAME}。`);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const nonceResponse = await fetch("/api/auth/nonce", {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress: walletRef.current }),
      });
      const nonce = await readJson(nonceResponse);
      if (!nonceResponse.ok || typeof nonce.message !== "string" || typeof nonce.nonceId !== "string" || typeof nonce.nonce !== "string") {
        throw new Error(publicError(nonce, "无法获取本次签名请求。"));
      }
      const signature = await currentProvider.request({
        method: "personal_sign",
        params: [nonce.message, walletRef.current],
      });
      if (typeof signature !== "string") throw new Error("钱包未返回有效签名。");
      const verifyResponse = await fetch("/api/auth/verify", {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({
          walletAddress: walletRef.current,
          nonceId: nonce.nonceId,
          nonce: nonce.nonce,
          signature,
        }),
      });
      const verified = await readJson(verifyResponse) as AuthSessionResponse;
      if (!verifyResponse.ok || verified.authenticated !== true) {
        throw new Error(publicError(verified, "签名认证未完成。"));
      }
      await refreshSession();
    } catch (signInError) {
      setAuthenticated(false);
      setError(signInError instanceof Error ? signInError.message : "签名认证未完成，请重试。");
    } finally {
      setLoading(false);
    }
  }, [chainId, refreshSession]);

  const logout = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
    } catch {
      setError("退出登录未完成，请稍后重试。");
    } finally {
      setAuthenticated(false);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const currentProvider = provider();
    void Promise.resolve().then(async () => {
      setProviderAvailable(Boolean(currentProvider));
      try {
        await readWallet(false);
        await refreshSession();
      } catch {
        setAuthenticated(false);
      }
    });
    if (!currentProvider?.on) return;
    const handleAccountsChanged = () => {
      updateWallet(null, null);
      setAuthenticated(false);
      setError(null);
      void readWallet(false).then(() => refreshSession());
    };
    const handleChainChanged = () => {
      setChainId(null);
      setAuthenticated(false);
      setError(null);
      void readWallet(false).then(() => refreshSession());
    };
    currentProvider.on("accountsChanged", handleAccountsChanged);
    currentProvider.on("chainChanged", handleChainChanged);
    return () => {
      currentProvider.removeListener?.("accountsChanged", handleAccountsChanged);
      currentProvider.removeListener?.("chainChanged", handleChainChanged);
    };
  }, [readWallet, refreshSession, updateWallet]);

  const value = useMemo<WalletAuthState>(() => ({
    providerAvailable,
    walletAddress,
    chainId,
    authenticated,
    loading,
    error,
    connect,
    switchNetwork,
    signIn,
    refreshSession,
    logout,
    clearError: () => setError(null),
  }), [authenticated, chainId, connect, error, loading, logout, providerAvailable, refreshSession, signIn, switchNetwork, walletAddress]);

  return <WalletAuthContext.Provider value={value}>{children}</WalletAuthContext.Provider>;
}

export function useWalletAuth(): WalletAuthState {
  const value = useContext(WalletAuthContext);
  if (!value) throw new Error("useWalletAuth must be used within WalletAuthProvider");
  return value;
}

export { AUTH_CHAIN_ID, AUTH_CHAIN_NAME };
