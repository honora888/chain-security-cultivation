import type { Metadata } from "next";
import "./globals.css";

import { WalletAuthProvider } from "@/features/wallet-auth/wallet-auth-provider";

export const metadata: Metadata = {
  title: {
    default: "链安修仙录",
    template: "%s｜链安修仙录",
  },
  description:
    "以修仙 Boss 战、代码解谜和攻击回放学习智能合约安全。当前开放 Quest 1：噬灵回环兽。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body><WalletAuthProvider>{children}</WalletAuthProvider></body>
    </html>
  );
}
