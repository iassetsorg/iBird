"use client";

/**
 * @fileoverview Provides wallet connection context and management for the application.
 * Supports multiple wallet types including Kabila, HashPack, and HWC (Hedera Wallet Connect).
 */

import React, { createContext, useContext, useState, useEffect, useRef } from "react";
import { toast } from "react-toastify";
import {
  KabilaConnector,
  HashpackConnector,
  HWCConnector,
} from "@buidlerlabs/hashgraph-react-wallets/connectors";
import { useWallet } from "@buidlerlabs/hashgraph-react-wallets";

/**
 * Check if an error is a WalletConnect session_request listener error
 * These errors are non-critical and can be safely suppressed
 */
const isWalletConnectListenerError = (error: unknown): boolean => {
  if (!error || typeof error !== "object") return false;
  const errorMessage = "message" in error ? String(error.message) : "";
  return (
    errorMessage.includes("session_request") &&
    errorMessage.includes("without any listeners")
  );
};

/**
 * Check if an error is a WalletConnect "No matching key" error
 * This occurs when there's stale session data after wallet disconnect
 */
const isNoMatchingKeyError = (error: unknown): boolean => {
  if (!error || typeof error !== "object") return false;
  const errorMessage = "message" in error ? String(error.message) : "";
  return errorMessage.includes("No matching key");
};

/**
 * Clears WalletConnect storage from IndexedDB and localStorage
 * This helps resolve "No matching key" errors caused by stale session data
 */
const clearWalletConnectStorage = async (): Promise<void> => {
  // Clear localStorage entries
  if (typeof window !== "undefined" && window.localStorage) {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith("wc@2") || key.startsWith("walletconnect"))) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((key) => localStorage.removeItem(key));
  }

  // Clear IndexedDB entries
  if (typeof window !== "undefined" && window.indexedDB) {
    try {
      const databases = await window.indexedDB.databases();
      for (const db of databases) {
        if (db.name && (db.name.startsWith("wc@2") || db.name.includes("walletconnect"))) {
          window.indexedDB.deleteDatabase(db.name);
        }
      }
    } catch (e) {
      // indexedDB.databases() may not be supported in all browsers
      console.warn("Could not enumerate IndexedDB databases:", e);
    }
  }
};

/**
 * Enhanced filter function to detect WalletConnect session_request errors
 * Checks both message content and stack traces for comprehensive detection
 */
const filterWalletConnectError = (args: unknown[]): boolean => {
  const errorString = args
    .map((arg) => {
      if (typeof arg === 'object' && arg !== null) {
        try {
          if (arg instanceof Error) {
            return arg.message + ' ' + (arg.stack || '');
          }
          return JSON.stringify(arg);
        } catch {
          return String(arg);
        }
      }
      return String(arg);
    })
    .join(' ');

  return (
    (errorString.includes('session_request') &&
    errorString.includes('without any listeners')) ||
    errorString.includes('No matching key')
  );
};

/**
 * Setup global error handlers to suppress non-critical WalletConnect errors
 * The "session_request without any listeners" error is a known issue in WalletConnect v2
 * that occurs during normal operation and can be safely ignored
 *
 * This enhanced version uses capture phase listeners for earlier interception
 * and more aggressive error detection including stack trace checking
 */
const setupWalletConnectErrorHandlers = (): (() => void) => {
  if (typeof window === "undefined") return () => {};

  // Store original console methods
  const originalConsoleError = console.error;
  const originalConsoleWarn = console.warn;

  // Override console.error to filter out WalletConnect listener errors
  console.error = (...args: unknown[]) => {
    if (filterWalletConnectError(args)) {
      // Silently suppress - no need to log even as debug since error is non-critical
      return;
    }
    originalConsoleError.apply(console, args);
  };

  // Also filter from console.warn as WalletConnect sometimes logs there
  console.warn = (...args: unknown[]) => {
    if (filterWalletConnectError(args)) {
      return;
    }
    originalConsoleWarn.apply(console, args);
  };

  /**
   * Check if an error is a WalletConnect internal error that should be silently suppressed.
   * Includes: session_request listener errors, "No matching key" stale session errors.
   */
  const isWCInternalError = (str: string): boolean =>
    (str.includes('session_request') && str.includes('without any listeners')) ||
    str.includes('No matching key');

  // Enhanced unhandled rejection handler with capture phase
  const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
    const reason = event.reason;
    if (reason && typeof reason === 'object') {
      const message = 'message' in reason ? String(reason.message) : '';
      const stack = 'stack' in reason ? String(reason.stack) : '';
      if (isWCInternalError(message) || isWCInternalError(stack)) {
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }
    }
    // Also check if reason is a string
    if (typeof reason === 'string' && isWCInternalError(reason)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
  };

  // Enhanced global error handler with capture phase
  const handleError = (event: ErrorEvent) => {
    // Check error object
    if (event.error && typeof event.error === 'object') {
      const message = 'message' in event.error ? String(event.error.message) : '';
      const stack = 'stack' in event.error ? String(event.error.stack) : '';
      if (isWCInternalError(message) || isWCInternalError(stack)) {
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }
    }
    // Check event message directly
    if (event.message && isWCInternalError(event.message)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
  };

  // Use capture phase (true) to intercept errors before they propagate
  window.addEventListener('unhandledrejection', handleUnhandledRejection, true);
  window.addEventListener('error', handleError, true);

  // Return cleanup function
  return () => {
    console.error = originalConsoleError;
    console.warn = originalConsoleWarn;
    window.removeEventListener('unhandledrejection', handleUnhandledRejection, true);
    window.removeEventListener('error', handleError, true);
  };
};

/**
 * @interface WalletContextType
 * @description Defines the shape of the wallet context data and methods
 * @property {boolean} isConnected - Indicates if any wallet is currently connected
 * @property {boolean} isLoading - Indicates if a wallet connection is in progress
 * @property {function} connect - Initiates a wallet connection
 * @property {function} disconnect - Disconnects the currently connected wallet
 * @property {function} cancelConnection - Cancels an ongoing connection attempt
 */
const WalletContext = createContext<{
  isConnected: boolean;
  isLoading: boolean;
  connect: (connectorType: string) => Promise<boolean>;
  disconnect: () => Promise<void>;
  cancelConnection: () => void;
}>({
  isConnected: false,
  isLoading: false,
  connect: async () => false,
  disconnect: async () => { },
  cancelConnection: () => { },
});

/**
 * @function useWalletContext
 * @description Custom hook to access the wallet context
 * @returns {WalletContextType} The wallet context object
 */
export const useWalletContext = () => useContext(WalletContext);

/**
 * @component WalletProvider
 * @description Provider component that manages wallet connections and state
 * @param {Object} props - Component props
 * @param {React.ReactNode} props.children - Child components to be wrapped
 */
export const WalletProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  // State management for wallet connection status
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [connectionCancelled, setConnectionCancelled] = useState(false);

  // Initialize wallet connectors
  const kabilaWallet = useWallet(KabilaConnector);
  const hashpackWallet = useWallet(HashpackConnector);
  const hwcWallet = useWallet(HWCConnector);

  // Track if error handlers have been set up
  const errorHandlersCleanupRef = useRef<(() => void) | null>(null);

  /**
   * @effect
   * @description Sets up global error handlers to suppress WalletConnect session_request errors
   * These errors occur when WalletConnect emits events without registered listeners,
   * which is a known issue in WalletConnect v2 and can be safely suppressed
   */
  useEffect(() => {
    // Setup error handlers on mount
    errorHandlersCleanupRef.current = setupWalletConnectErrorHandlers();

    // Cleanup on unmount
    return () => {
      if (errorHandlersCleanupRef.current) {
        errorHandlersCleanupRef.current();
        errorHandlersCleanupRef.current = null;
      }
    };
  }, []);

  /**
   * @effect
   * @description Updates the connected state whenever any wallet's connection status changes
   */
  useEffect(() => {
    setIsConnected(
      kabilaWallet.isConnected ||
      hashpackWallet.isConnected ||
      hwcWallet.isConnected
    );
  }, [
    kabilaWallet.isConnected,
    hashpackWallet.isConnected,
    hwcWallet.isConnected,
  ]);

  /**
   * @async
   * @function connect
   * @description Initiates a connection to the specified wallet type
   * @param {string} connectorType - The type of wallet to connect ("Kabila", "HashPack", or "WalletConnect")
   * @returns {Promise<boolean>} Success status of the connection attempt
   */
  const connect = async (connectorType: string) => {
    setIsLoading(true);
    setConnectionCancelled(false);
    try {
      if (connectionCancelled) {
        return false;
      }

      // Add delay to ensure WalletConnect provider is properly initialized
      if (connectorType === "WalletConnect") {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      switch (connectorType) {
        case "Kabila":
          try {
            await kabilaWallet.connect();
          } catch (kabilaError: unknown) {
            // Handle "No matching key" error - Kabila also uses WalletConnect internally
            if (isNoMatchingKeyError(kabilaError)) {
              console.warn("Kabila stale session detected, clearing storage...");
              await clearWalletConnectStorage();
              toast.info("Session cleared. Please try connecting again.");
              return false;
            }
            throw kabilaError;
          }
          break;
        case "HashPack":
          try {
            await hashpackWallet.connect();
          } catch (hashpackError: unknown) {
            // Handle "No matching key" error - HashPack uses WalletConnect internally
            if (isNoMatchingKeyError(hashpackError)) {
              console.warn("HashPack stale session detected, clearing storage...");
              await clearWalletConnectStorage();
              toast.info("Session cleared. Please try connecting again.");
              return false;
            }
            throw hashpackError;
          }
          break;
        case "WalletConnect":
          try {
            await hwcWallet.connect();
          } catch (wcError: unknown) {
            // Handle WalletConnect specific errors
            if (wcError && typeof wcError === "object" && "message" in wcError) {
              const errorMessage = wcError.message as string;

              // Handle "No matching key" error - clear stale WalletConnect storage
              if (errorMessage?.includes("No matching key")) {
                console.warn("WalletConnect stale session detected, clearing storage...");
                await clearWalletConnectStorage();
                toast.info("Session cleared. Please try connecting again.");
                return false;
              }

              if (
                errorMessage?.includes("session_request") ||
                errorMessage?.includes("without any listeners")
              ) {
                console.warn("WalletConnect session request error, retrying...");
                // Retry connection after a brief delay
                await new Promise((resolve) => setTimeout(resolve, 500));
                await hwcWallet.connect();
              } else {
                throw wcError;
              }
            } else {
              throw wcError;
            }
          }
          break;
      }
      return !connectionCancelled;
    } catch (error: unknown) {
      // Check if this is a non-critical session_request listener error
      if (isWalletConnectListenerError(error)) {
        // This error is non-critical and the connection may have succeeded
        // Check if we're actually connected after a brief delay
        await new Promise((resolve) => setTimeout(resolve, 500));
        if (hwcWallet.isConnected) {
          console.warn("[WalletConnect] Connection succeeded despite session_request error");
          return true;
        }
        // If not connected, log and return without showing error toast
        console.warn("[WalletConnect] Session request listener error (non-critical):", error);
        return false;
      }

      console.error("Connection error:", error);

      // Provide more specific error messages for WalletConnect
      if (connectorType === "WalletConnect") {
        if (error && typeof error === "object" && "message" in error) {
          const errorMessage = error.message as string;
          if (
            errorMessage?.includes("session_request") &&
            errorMessage?.includes("without any listeners")
          ) {
            // Suppress this specific error - it's handled above
            return false;
          } else if (errorMessage?.includes("User rejected")) {
            toast.error("Connection rejected by user.");
          } else if (errorMessage?.includes("No matching key")) {
            await clearWalletConnectStorage();
            toast.error("Session expired. Please try connecting again.");
          } else {
            toast.error("WalletConnect error. Please check your wallet app.");
          }
        } else {
          toast.error("WalletConnect connection failed. Please try again.");
        }
      }

      return false;
    } finally {
      setIsLoading(false);
      setConnectionCancelled(false);
    }
  };

  /**
   * @async
   * @function disconnect
   * @description Disconnects all currently connected wallets and clears WalletConnect storage
   * to prevent stale session errors when reconnecting with a different account
   */
  const disconnect = async () => {
    // Clear WalletConnect storage first to prevent stale session issues when reconnecting
    await clearWalletConnectStorage();
    
    // Disconnect all connected wallets
    if (kabilaWallet.isConnected) kabilaWallet.disconnect();
    if (hashpackWallet.isConnected) hashpackWallet.disconnect();
    if (hwcWallet.isConnected) hwcWallet.disconnect();
  };

  /**
   * @function cancelConnection
   * @description Cancels an ongoing wallet connection attempt
   */
  const cancelConnection = () => {
    setConnectionCancelled(true);
    setIsLoading(false);
  };

  return (
    <WalletContext.Provider
      value={{
        isConnected,
        isLoading,
        connect,
        disconnect,
        cancelConnection,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
};
