/**
 * Enhanced custom hook for creating Hedera topics with improved UI/UX
 * @module useCreateTopic
 */

import { useState, useCallback } from "react";
import { TopicCreateTransaction, PublicKey, Signer } from "@hashgraph/sdk";
import { toast } from "react-toastify";
import {
  useWallet,
  useAccountId,
  useWatchTransactionReceipt,
} from "@buidlerlabs/hashgraph-react-wallets";

import {
  executeTransaction,
  type WatchFunction,
} from "../utils/execute-transaction";
import { getToastTypeForError } from "../utils/transaction-errors";

/**
 * Interface for topic creation response
 */
interface CreateTopicResponse {
  transactionId: string;
  receipt: unknown;
  topicId: string;
  timestamp: number;
}

/**
 * Interface for topic creation progress
 */
interface CreationProgress {
  step:
    | "idle"
    | "validating"
    | "fetching-account"
    | "creating-transaction"
    | "signing"
    | "executing"
    | "confirming"
    | "completed"
    | "error";
  message: string;
  progress: number;
}

/**
 * Enhanced custom hook that manages the creation of Hedera Consensus Service (HCS) topics
 * with improved UI/UX, loading states, and error handling
 * @returns {Object} Object containing the create function, states, and utilities
 */
const useCreateTopic = () => {
  const wallet = useWallet();
  const signer = wallet.signer as Signer;
  const { data: accountId } = useAccountId();
  const { watch } = useWatchTransactionReceipt();

  // Enhanced state management
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [createTopicResponse, setCreateTopicResponse] =
    useState<CreateTopicResponse | null>(null);
  const [progress, setProgress] = useState<CreationProgress>({
    step: "idle",
    message: "Ready to create topic",
    progress: 0,
  });

  /**
   * Updates the creation progress with enhanced UI feedback
   */
  const updateProgress = useCallback(
    (step: CreationProgress["step"], message: string, progress: number) => {
      setProgress({ step, message, progress });
    },
    []
  );

  /**
   * Shows enhanced toast notifications with cyberpunk styling
   */
  const showToast = useCallback(
    (
      type: "success" | "error" | "info" | "warning",
      message: string,
      options?: Record<string, unknown>
    ) => {
      const baseStyle = {
        position: "top-right" as const,
        autoClose: 5000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        className: "font-mono text-sm",
        bodyClassName: "text-cyan-100",
        progressClassName: "bg-gradient-to-r from-cyan-400 to-purple-400",
        style: {
          background:
            "linear-gradient(135deg, rgba(15, 23, 42, 0.95) 0%, rgba(88, 28, 135, 0.95) 100%)",
          backdropFilter: "blur(16px)",
          border: "1px solid rgba(6, 182, 212, 0.3)",
          borderRadius: "12px",
          boxShadow: "0 8px 32px rgba(6, 182, 212, 0.2)",
        },
        ...options,
      };

      switch (type) {
        case "success":
          toast.success(`✨ ${message}`, {
            ...baseStyle,
            style: {
              ...baseStyle.style,
              border: "1px solid rgba(34, 197, 94, 0.4)",
              boxShadow: "0 8px 32px rgba(34, 197, 94, 0.2)",
            },
          });
          break;
        case "error":
          toast.error(`⚠️ ${message}`, {
            ...baseStyle,
            style: {
              ...baseStyle.style,
              border: "1px solid rgba(239, 68, 68, 0.4)",
              boxShadow: "0 8px 32px rgba(239, 68, 68, 0.2)",
            },
          });
          break;
        case "info":
          toast.info(`ℹ️ ${message}`, {
            ...baseStyle,
            style: {
              ...baseStyle.style,
              border: "1px solid rgba(59, 130, 246, 0.4)",
              boxShadow: "0 8px 32px rgba(59, 130, 246, 0.2)",
            },
          });
          break;
        case "warning":
          toast.warn(`⚡ ${message}`, {
            ...baseStyle,
            style: {
              ...baseStyle.style,
              border: "1px solid rgba(245, 158, 11, 0.4)",
              boxShadow: "0 8px 32px rgba(245, 158, 11, 0.2)",
            },
          });
          break;
      }
    },
    []
  );

  /**
   * Validates input parameters with enhanced feedback
   */
  const validateInputs = useCallback(
    (topicMemo: string, memo: string): boolean => {
      if (!accountId) {
        showToast("warning", "Please connect your wallet to continue");
        return false;
      }

      if (!topicMemo?.trim() && !memo?.trim()) {
        showToast(
          "warning",
          "Please provide either a topic memo or transaction memo"
        );
        return false;
      }

      if (topicMemo && topicMemo.length > 100) {
        showToast("error", "Topic memo must be 100 characters or less");
        return false;
      }

      if (memo && memo.length > 100) {
        showToast("error", "Transaction memo must be 100 characters or less");
        return false;
      }

      return true;
    },
    [accountId, showToast]
  );

  /**
   * Resets the hook state to initial values
   */
  const reset = useCallback(() => {
    setError(null);
    setIsCreating(false);
    setCreateTopicResponse(null);
    setProgress({
      step: "idle",
      message: "Ready to create topic",
      progress: 0,
    });
  }, []);

  /**
   * Creates a new Hedera topic with enhanced UX and progress tracking
   * @param {string} topicMemo - Memo to be associated with the topic
   * @param {string} memo - Transaction memo
   * @param {boolean} [submitKey=false] - Whether to set a submit key for the topic
   * @returns {Promise<string|undefined>} The created topic ID if successful
   */
  const create = useCallback(
    async (
      topicMemo: string,
      memo: string,
      submitKey: boolean = false
    ): Promise<string | undefined> => {
      // Reset previous state
      setError(null);
      setCreateTopicResponse(null);

      // Validate inputs
      updateProgress("validating", "Validating inputs...", 10);
      if (!validateInputs(topicMemo, memo)) {
        updateProgress("error", "Validation failed", 0);
        return;
      }

      setIsCreating(true);

      try {
        // Step 1: Fetch account information
        updateProgress(
          "fetching-account",
          "Fetching account information...",
          20
        );
        showToast("info", "Fetching account details from Hedera network...");

        const mirrorNodeBaseUrl =
          process.env.NEXT_PUBLIC_NETWORK === "mainnet"
            ? "https://mainnet.mirrornode.hedera.com"
            : "https://testnet.mirrornode.hedera.com";

        const accountInfoResponse = await fetch(
          `${mirrorNodeBaseUrl}/api/v1/accounts/${accountId}`
        );

        if (!accountInfoResponse.ok) {
          throw new Error(
            `Failed to fetch account info: ${accountInfoResponse.statusText}`
          );
        }

        const accountInfo = await accountInfoResponse.json();
        const key = PublicKey.fromString(accountInfo.key.key);

        // Step 2: Create transaction
        updateProgress(
          "creating-transaction",
          "Building topic creation transaction...",
          40
        );

        const transaction = new TopicCreateTransaction()
          .setAdminKey(key)
          .setAutoRenewAccountId(accountId);

        // Add memos with proper handling
        if (memo && memo.trim() !== "") {
          transaction.setTransactionMemo(memo.trim());
        }

        if (topicMemo && topicMemo.trim() !== "") {
          transaction.setTopicMemo(topicMemo.trim());
        }

        // Set submit key if requested
        if (submitKey) {
          transaction.setSubmitKey(key);
          showToast("info", "Submit key enabled for topic control");
        }

        // Step 3: Execute transaction using centralized executor
        updateProgress("signing", "Please approve the transaction in your wallet...", 60);
        showToast("info", "Please approve the transaction in your wallet...");

        const result = await executeTransaction({
          transaction,
          signer,
          watch: watch as WatchFunction,
          timeoutMs: 90_000, // 90 seconds for topic creation (includes mirror node propagation)
        });

        // Step 4: Handle result
        if (result.success) {
          const receipt = result.receipt as {
            entity_id?: { toString: () => string };
          };
          const topicId = receipt?.entity_id?.toString() || "";

          if (!topicId) {
            throw new Error("Topic created but no topic ID returned");
          }

          const responseData: CreateTopicResponse = {
            transactionId: result.transactionId!,
            receipt: result.receipt,
            topicId,
            timestamp: Date.now(),
          };

          setCreateTopicResponse(responseData);
          updateProgress(
            "completed",
            `Topic created successfully: ${topicId}`,
            100
          );

          showToast("success", `Topic created successfully! ID: ${topicId}`, {
            autoClose: 8000,
          });

          return topicId;
        } else {
          // Transaction failed
          const errorMessage = result.error?.message || "Topic creation failed";
          const errorType = result.error?.type || "UNKNOWN";

          setError(errorMessage);
          updateProgress("error", errorMessage, 0);

          // Show appropriate toast based on error type
          const toastType = getToastTypeForError(errorType);
          switch (toastType) {
            case "warn":
              showToast("warning", "Transaction cancelled by user");
              break;
            case "info":
              showToast("info", errorMessage);
              break;
            default:
              showToast("error", errorMessage);
          }

          return undefined;
        }
      } catch (error: unknown) {
        // Fallback error handling for non-transaction errors (e.g., network fetch failures)
        console.error("Topic creation error:", error);

        const errorMessage =
          error instanceof Error
            ? error.message
            : "An unknown error occurred during topic creation";

        setError(errorMessage);
        updateProgress("error", errorMessage, 0);
        showToast("error", errorMessage);

        return undefined;
      } finally {
        setIsCreating(false);
      }
    },
    [signer, watch, accountId, validateInputs, updateProgress, showToast]
  );

  /**
   * Gets a user-friendly status message based on current progress
   */
  const getStatusMessage = useCallback((): string => {
    switch (progress.step) {
      case "idle":
        return "Ready to create a new topic";
      case "validating":
        return "Validating your inputs...";
      case "fetching-account":
        return "Connecting to Hedera network...";
      case "creating-transaction":
        return "Preparing your topic...";
      case "signing":
        return "Waiting for wallet approval...";
      case "executing":
        return "Broadcasting to network...";
      case "confirming":
        return "Confirming transaction...";
      case "completed":
        return "Topic created successfully!";
      case "error":
        return "Something went wrong";
      default:
        return progress.message;
    }
  }, [progress]);

  /**
   * Gets the appropriate color class for the current status
   */
  const getStatusColor = useCallback((): string => {
    switch (progress.step) {
      case "idle":
        return "text-cyan-400";
      case "validating":
      case "fetching-account":
      case "creating-transaction":
      case "signing":
      case "executing":
      case "confirming":
        return "text-purple-400";
      case "completed":
        return "text-green-400";
      case "error":
        return "text-red-400";
      default:
        return "text-cyan-400";
    }
  }, [progress.step]);

  return {
    // Core functionality
    create,
    reset,

    // State
    createTopicResponse,
    error,
    isCreating,
    progress,

    // UI helpers
    getStatusMessage,
    getStatusColor,

    // Utilities
    showToast,
  };
};

export default useCreateTopic;
