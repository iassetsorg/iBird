"use client";

/**
 * @fileoverview Wallet component that handles wallet connection and display
 * Provides a button to connect/disconnect wallet and displays the account ID when connected
 */

import React, { useState, useRef, useEffect } from "react";
import { useRouter } from "next/router";
import ConnectModal from "./ConnectModal";
import { useWalletContext } from "./WalletContext";
import { useAccountId } from "@buidlerlabs/hashgraph-react-wallets";

/**
 * Wallet component for handling Hedera wallet connections
 * @component
 * @returns {JSX.Element} A button that toggles wallet connection and displays account info
 */
const Wallet = () => {
  // State to control the visibility of the connection modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  // State to control the visibility of the dropdown menu
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // Ref for the dropdown container to detect outside clicks
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Router for navigation
  const router = useRouter();

  // Get wallet connection status and disconnect function from context
  const { isConnected, disconnect } = useWalletContext();

  // Get the connected account ID from the Hashgraph wallet
  const { data: accountId } = useAccountId();

  /**
   * Handle clicks outside of dropdown to close it
   */
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    if (isDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isDropdownOpen]);

  /**
   * Opens the wallet connection modal
   * @function
   */
  const openConnectModal = () => setIsModalOpen(true);

  /**
   * Closes the wallet connection modal
   * @function
   */
  const closeConnectModal = () => setIsModalOpen(false);

  /**
   * Toggle dropdown visibility
   * @function
   */
  const toggleDropdown = () => setIsDropdownOpen(!isDropdownOpen);

  /**
   * Handle profile navigation
   * @function
   */
  const handleProfile = () => {
    setIsDropdownOpen(false);
    router.push("/profile");
  };

  /**
   * Handle disconnect - async to properly await storage cleanup
   * @function
   */
  const handleDisconnect = async () => {
    setIsDropdownOpen(false);
    await disconnect();
  };

  /**
   * Format account ID for display
   * @param {string} id - The account ID to format
   * @returns {string} Formatted account ID
   */
  const formatAccountId = (id: string) => {
    if (!id) return "Connected";
    if (id.length > 20) {
      return `${id.slice(0, 8)}...${id.slice(-8)}`;
    }
    return id;
  };

  return (
    <>
      <div className="relative" ref={dropdownRef}>
        {/* Connection button that changes text and function based on connection status */}
        <button
          className="
            relative
            inline-flex items-center justify-center
            px-6 py-3
            text-base font-mono font-semibold text-white
            rounded-xl
            transition-all duration-300
            hover:scale-105
            active:scale-95
            focus:outline-none
            overflow-hidden
            group
            bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900
            backdrop-blur-xl
            border border-purple-400/30
            shadow-2xl shadow-purple-400/20
          "
          onClick={isConnected ? toggleDropdown : openConnectModal}
        >
          {/* Animated background */}
          <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />

          {/* Button content */}
          <div className="relative flex items-center gap-2">
            {isConnected ? (
              <>
                <div className="relative">
                  <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                  <div className="absolute inset-0 w-2 h-2 bg-white rounded-full animate-ping" />
                </div>
                <span>{formatAccountId(accountId || "")}</span>
                {/* Dropdown arrow */}
                <svg
                  className={`w-4 h-4 transition-transform duration-200 ${isDropdownOpen ? "rotate-180" : ""}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </>
            ) : (
              <span>CONNECT</span>
            )}
          </div>
        </button>

        {/* Dropdown Menu */}
        {isConnected && isDropdownOpen && (
          <div className="absolute right-0 mt-2 w-48 rounded-xl overflow-hidden bg-gradient-to-br from-slate-900 via-purple-900/90 to-slate-900 backdrop-blur-xl border border-purple-400/30 shadow-2xl shadow-purple-400/20 z-50">
            <button
              onClick={handleProfile}
              className="w-full px-4 py-3 text-left text-white hover:bg-white/10 transition-colors duration-200 flex items-center gap-3"
            >
              <svg className="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <span className="font-medium">Profile</span>
            </button>
            <div className="border-t border-purple-400/20" />
            <button
              onClick={handleDisconnect}
              className="w-full px-4 py-3 text-left text-white hover:bg-white/10 transition-colors duration-200 flex items-center gap-3"
            >
              <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              <span className="font-medium">Disconnect</span>
            </button>
          </div>
        )}
      </div>

      {/* Render the connection modal only when isModalOpen is true */}
      {isModalOpen && (
        <ConnectModal isOpen={isModalOpen} onClose={closeConnectModal} />
      )}
    </>
  );
};

export default Wallet;
