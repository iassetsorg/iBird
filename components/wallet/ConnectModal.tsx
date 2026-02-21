"use client";

import React, { useState } from "react";
import Image from "next/image";
import Modal from "../common/modal";
import { useWalletContext } from "./WalletContext";

/**
 * Props interface for the ConnectModal component
 * @property {boolean} isOpen - Controls the visibility of the modal
 * @property {() => void} onClose - Callback function when modal is closed
 */
interface ConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * ConnectModal component displays available wallet options for connection
 * @component
 * @param {ConnectModalProps} props - The props for the ConnectModal component
 * @returns {JSX.Element} A modal with wallet connection options
 */
const ConnectModal: React.FC<ConnectModalProps> = ({ isOpen, onClose }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [selectedWallet, setSelectedWallet] = useState<string | null>(null);
  const { connect } = useWalletContext();

  /**
   * Handles the wallet connection process
   * @param {string} connectorType - The type of wallet to connect (HashPack/Kabila/WalletConnect)
   * @returns {Promise<void>}
   */
  const handleConnect = async (connectorType: string) => {
    setIsLoading(true);
    setSelectedWallet(connectorType);
    try {
      const success = await connect(connectorType);
      if (success) {
        onClose();
      } else {
        setSelectedWallet(null);
      }
    } catch (error) {
      console.error("Connection failed:", error);
      setSelectedWallet(null);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Handles the cancellation of an ongoing wallet connection attempt
   */
  const handleCancel = () => {
    setIsLoading(false);
    setSelectedWallet(null);
  };

  /**
   * Configuration array for supported wallets
   * Each wallet object contains a name, logo path, and title
   */
  const wallets = [
    {
      name: "HashPack",
      title: "Desktop",
      logo: "/HashPack.png",
      gradient: "from-purple-500 to-purple-700",
      bgColor: "from-slate-800 to-slate-900",
    },
    {
      name: "Kabila",
      title: "Desktop",
      logo: "/Kabila.png",
      gradient: "from-purple-600 to-purple-800",
      bgColor: "from-slate-800 to-slate-900",
    },
    {
      name: "WalletConnect",
      title: "Mobile",
      logo: "/WalletConnect.png",
      gradient: "from-purple-700 to-purple-900",
      bgColor: "from-slate-800 to-slate-900",
    },
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      hideCloseButton={false}
      removeZIndex={false}
    >
      <div className="flex flex-col items-center p-8 w-full max-w-md mx-auto rounded-2xl relative bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 backdrop-blur-xl border border-purple-400/30 shadow-2xl shadow-purple-400/20">
        {isLoading && (
          <div className="absolute inset-0 backdrop-blur-sm flex items-center justify-center z-20 rounded-2xl bg-black/60">
            <div className="flex flex-col items-center p-8 rounded-2xl bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 backdrop-blur-xl border border-purple-400/30 shadow-2xl shadow-purple-400/20">
              <div className="relative w-16 h-16 mb-6">
                <div className="absolute inset-0 rounded-full animate-spin bg-gradient-to-r from-purple-500 via-purple-600 to-purple-700" />
                <div className="absolute inset-2 rounded-full bg-slate-900" />
              </div>
              <p className="font-mono font-medium mb-6 text-lg text-white">
                Connecting to {selectedWallet}...
              </p>
              <button
                onClick={handleCancel}
                className="
                  group flex items-center gap-2
                  px-6 py-2.5
                  rounded-xl
                  transition-all duration-200
                  hover:scale-105
                  font-mono font-medium
                  bg-red-500/20 text-red-400 border border-red-400/30
                  hover:bg-red-500/30 hover:border-red-400/50
                  shadow-lg shadow-red-400/10
                  
                "
                aria-label="Cancel wallet connection"
              >
                <svg
                  className="w-5 h-5 group-hover:animate-pulse "
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
                Cancel Connection
              </button>
            </div>
          </div>
        )}

        <h2 className="text-3xl font-mono font-bold mb-3 bg-gradient-to-r from-purple-400 via-purple-500 to-purple-600 bg-clip-text text-transparent">
          Connect Wallet
        </h2>
        <p className="text-base mb-8 text-purple-100/80 font-mono text-center max-w-sm">
          Choose your preferred Hedera wallet to get started
        </p>

        <div className="w-full space-y-3">
          {wallets.map((wallet) => (
            <button
              key={wallet.name}
              className={`
                w-full
                p-4
                rounded-xl
                transition-all duration-300
                hover:scale-[1.02]
                active:scale-[0.98]
                flex items-center
                disabled:opacity-50
                disabled:cursor-not-allowed
                group
                relative
                overflow-hidden
                bg-gradient-to-r ${wallet.bgColor}
                border border-purple-400/30
                hover:border-purple-400/60
                shadow-lg shadow-purple-400/10
                hover:shadow-xl hover:shadow-purple-400/20
                backdrop-blur-sm
              `}
              onClick={() => handleConnect(wallet.name)}
              disabled={isLoading}
              aria-label={`Connect with ${wallet.name} wallet`}
            >
              {/* Gradient overlay on hover */}
              <div
                className={`absolute inset-0 opacity-0 group-hover:opacity-20 transition-opacity duration-300 bg-gradient-to-r ${wallet.gradient}`}
              />

              <div className="relative flex items-center w-full">
                <div className="w-14 h-14 rounded-xl flex items-center justify-center mr-4 bg-gradient-to-br from-slate-700 to-slate-800 border border-purple-400/20">
                  <Image
                    src={wallet.logo}
                    alt={`${wallet.name} logo`}
                    width={
                      wallet.name === "WalletConnect" ||
                      wallet.name === "HashPack"
                        ? 44
                        : 40
                    }
                    height={
                      wallet.name === "WalletConnect" ||
                      wallet.name === "HashPack"
                        ? 44
                        : 40
                    }
                    className="object-contain rounded-lg"
                    style={{
                      objectFit: "contain",
                      maxWidth: "100%",
                      maxHeight: "100%",
                    }}
                  />
                </div>
                <span className="flex-1 text-left font-mono font-semibold text-lg text-white">
                  {wallet.name}
                </span>
                <span
                  className={`text-sm px-3 py-1 rounded-full font-mono font-medium bg-gradient-to-r ${wallet.gradient} text-white shadow-md`}
                >
                  {wallet.title}
                </span>

                {/* Arrow icon */}
                <svg
                  className="w-5 h-5 ml-3 transform group-hover:translate-x-1 transition-transform text-purple-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </div>
            </button>
          ))}
        </div>

        <p className="text-sm mt-8 text-center text-purple-100/60 font-mono">
          By connecting a wallet, you agree to iAssets&apos;s{" "}
          <a
            href="https://ibird.io/terms"
            className="text-purple-400 hover:text-purple-300 hover:underline transition-colors font-semibold"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Read Terms of Service"
          >
            Terms of Service
          </a>
          .
        </p>
      </div>
    </Modal>
  );
};

export default ConnectModal;
