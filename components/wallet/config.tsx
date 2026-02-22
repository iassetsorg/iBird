/**
 * @fileoverview Configuration for wallet integration using hashgraph-react-wallets
 * This file sets up the wallet connection infrastructure for the application.
 */

import React from "react";
import { HWBridgeProvider } from "@buidlerlabs/hashgraph-react-wallets";
import {
  HWCConnector,
  HashpackConnector,
  KabilaConnector,
  MetamaskConnector,
} from "@buidlerlabs/hashgraph-react-wallets/connectors";
import {
  HederaMainnet,
  HederaTestnet,
} from "@buidlerlabs/hashgraph-react-wallets/chains";
import LoadingSpinner from "../common/LoadingSpinner";

/**
 * ReactWalletsProvider component that wraps the application with wallet connection capabilities
 * @component
 * @param {Object} props - Component props
 * @param {React.ReactNode} props.children - Child components to be wrapped
 * @returns {JSX.Element} HWBridgeProvider component with configured wallet settings
 */
const ReactWalletsProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  /**
   * Application metadata configuration for wallet connections
   * @type {Object}
   * @property {string} name - The name of the application shown in wallet prompts
   * @property {string} description - Brief description of the application
   * @property {string[]} icons - Array of icon URLs for the application
   * @property {string} url - The current application URL (only available on client side)
   */
  const metadata = {
    name: "ibird",
    description: "Web3 Social Media",
    icons: ["/icon.png"], // Use the icon from public folder
    url:
      typeof window !== "undefined" ? window.location.href : "https://ibird.io",
  };

  // Determine the network from environment variable, default to mainnet
  const network = process.env.NEXT_PUBLIC_NETWORK || "mainnet";
  const selectedChain = network === "testnet" ? HederaTestnet : HederaMainnet;

  return (
    <HWBridgeProvider
      metadata={metadata}
      projectId={
        process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ||
        "4fad43d38578d645d89bdf373854e1ef"
      } // WalletConnect project ID
      connectors={[
        HWCConnector, // WalletConnect connector
        HashpackConnector, // Hashpack wallet connector
        KabilaConnector, // Kabila wallet connector
        MetamaskConnector, // Metamask wallet connector
      ]}
      chains={[selectedChain]} // Supported blockchain networks
      LoadingFallback={LoadingSpinner}
    >
      {children}
    </HWBridgeProvider>
  );
};

export default ReactWalletsProvider;
