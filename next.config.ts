import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactStrictMode: true,
  transpilePackages: [
    "@buidlerlabs/hashgraph-react-wallets",
    "@hashgraph/sdk",
    "@hashgraph/hedera-wallet-connect",
    "@wisp-cms",
  ],
};

export default nextConfig;
