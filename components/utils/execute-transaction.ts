/**
 * Centralized transaction execution utility.
 *
 * Wraps the entire Hedera transaction lifecycle:
 *   freeze → sign → execute → watch receipt
 *
 * Provides:
 * - Configurable timeout to prevent UI from hanging indefinitely
 * - Proper retryInterval/retryMaxAttempts for mirror node polling
 * - Centralized error classification
 * - Typed result for consistent handling across all components
 *
 * @module execute-transaction
 */

import { Signer, Transaction } from "@hashgraph/sdk";
import {
  classifyTransactionError,
  type ClassifiedError,
  type TransactionErrorType,
} from "./transaction-errors";

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * The watch function signature from useWatchTransactionReceipt
 */
export type WatchFunction = (
  transactionIdOrHash: string,
  callbacks: {
    onSuccess: (transaction: unknown) => unknown;
    onError: (error: unknown) => unknown;
  }
) => Promise<{
  result: { toString: () => string };
  entity_id?: { toString: () => string };
  [key: string]: unknown;
}>;

/**
 * Result of a transaction execution
 */
export interface TransactionResult {
  /** Whether the transaction succeeded */
  success: boolean;
  /** The transaction ID (available even if watch fails) */
  transactionId: string | null;
  /** The receipt from the mirror node (null if watch failed/timed out) */
  receipt: unknown;
  /** Error details if the transaction failed */
  error: ClassifiedError | null;
}

/**
 * Options for executing a transaction
 */
export interface ExecuteTransactionOptions {
  /** The Hedera transaction to execute (must not be frozen yet) */
  transaction: Transaction;
  /** The wallet signer */
  signer: Signer;
  /** The watch function from useWatchTransactionReceipt */
  watch: WatchFunction;
  /** Total timeout in ms for the entire operation (default: 60000) */
  timeoutMs?: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/** Default total timeout for the entire transaction lifecycle */
const DEFAULT_TIMEOUT_MS = 60_000; // 60 seconds

// ============================================================================
// MAIN FUNCTION
// ============================================================================

/**
 * Executes a Hedera transaction with proper timeout, error handling, and receipt watching.
 *
 * This is the single entry point for all transaction execution in the app.
 * It replaces the duplicated freeze→sign→execute→watch pattern found in
 * use_send_message.tsx, use_create_topic.tsx, tip.tsx, and create_new_profile.tsx.
 *
 * @param options - Transaction execution options
 * @returns A typed result with success status, transaction ID, receipt, and error details
 *
 * @example
 * ```tsx
 * const result = await executeTransaction({
 *   transaction: new TopicMessageSubmitTransaction().setMessage("hello").setTopicId("0.0.123"),
 *   signer,
 *   watch,
 * });
 *
 * if (result.success) {
 *   console.log("Transaction ID:", result.transactionId);
 * } else if (result.error?.type === "USER_REJECTED") {
 *   toast.warn("Transaction cancelled");
 * } else {
 *   toast.error(result.error?.message);
 * }
 * ```
 */
export async function executeTransaction(
  options: ExecuteTransactionOptions
): Promise<TransactionResult> {
  const {
    transaction,
    signer,
    watch,
    timeoutMs = DEFAULT_TIMEOUT_MS,
  } = options;

  // Wrap the entire operation in a timeout
  const timeoutPromise = new Promise<TransactionResult>((_, reject) => {
    setTimeout(() => {
      reject(
        new Error(
          `Transaction timed out after ${timeoutMs / 1000} seconds. ` +
            "It may have completed on the network — check your wallet or HashScan."
        )
      );
    }, timeoutMs);
  });

  const executionPromise = executeTransactionInternal(
    transaction,
    signer,
    watch
  );

  try {
    return await Promise.race([executionPromise, timeoutPromise]);
  } catch (error) {
    const classified = classifyTransactionError(error);

    // Log non-user-rejection errors
    if (classified.shouldLog) {
      console.error("Transaction execution error:", error);
    } else {
      // Use console.warn for user rejections to avoid Next.js dev overlay
      console.warn("Transaction cancelled by user");
    }

    return {
      success: false,
      transactionId: null,
      receipt: null,
      error: classified,
    };
  }
}

// ============================================================================
// INTERNAL IMPLEMENTATION
// ============================================================================

/**
 * Internal implementation of the transaction execution flow.
 * Separated from the timeout wrapper for clarity.
 */
async function executeTransactionInternal(
  transaction: Transaction,
  signer: Signer,
  watch: WatchFunction
): Promise<TransactionResult> {
  // Step 1: Freeze the transaction with the signer
  const signedTx = await transaction.freezeWithSigner(signer);

  if (!signedTx) {
    return {
      success: false,
      transactionId: null,
      receipt: null,
      error: {
        type: "WALLET_DISCONNECTED" as TransactionErrorType,
        message:
          "Failed to freeze transaction — wallet may be disconnected",
        originalError: null,
        shouldLog: true,
      },
    };
  }

  // Step 2: Execute the signed transaction
  const txResponse = await signedTx.executeWithSigner(signer);

  if (!txResponse) {
    return {
      success: false,
      transactionId: null,
      receipt: null,
      error: {
        type: "WALLET_DISCONNECTED" as TransactionErrorType,
        message:
          "Failed to execute transaction — it may have been cancelled",
        originalError: null,
        shouldLog: true,
      },
    };
  }

  const transactionId = txResponse.transactionId.toString();

  // Step 3: Watch for the receipt via mirror node polling
  try {
    const receipt = await watch(transactionId, {
      onSuccess: (transaction) => transaction,
      onError: (error) => error,
    });

    // Step 4: Check the result
    if (receipt && receipt.result) {
      const resultString = receipt.result.toString();

      if (
        resultString === "SUCCESS" ||
        resultString === "TOKEN_ALREADY_ASSOCIATED_TO_ACCOUNT"
      ) {
        return {
          success: true,
          transactionId,
          receipt,
          error: null,
        };
      }

      // Transaction executed but failed on-chain
      return {
        success: false,
        transactionId,
        receipt,
        error: {
          type: "TRANSACTION_FAILED",
          message: `Transaction failed: ${resultString}`,
          originalError: receipt,
          shouldLog: true,
        },
      };
    }

    // Receipt came back but no result — treat as potential success
    // (the transaction was submitted, mirror node may not have full data yet)
    return {
      success: false,
      transactionId,
      receipt,
      error: {
        type: "NETWORK_ERROR",
        message:
          "Could not confirm transaction status. Check HashScan for transaction: " +
          transactionId,
        originalError: receipt,
        shouldLog: true,
      },
    };
  } catch (watchError) {
    // Watch failed — but the transaction may have succeeded on-chain
    // This is the "stuck in processing" scenario
    const classified = classifyTransactionError(watchError);

    // If it's a user rejection during watch (unlikely but possible), propagate it
    if (classified.type === "USER_REJECTED") {
      return {
        success: false,
        transactionId,
        receipt: null,
        error: classified,
      };
    }

    // For network errors during watch, the transaction likely succeeded
    // but we couldn't confirm it
    return {
      success: false,
      transactionId,
      receipt: null,
      error: {
        type: "NETWORK_ERROR",
        message:
          "Transaction was submitted but receipt confirmation failed. " +
          "It may have completed — check HashScan for transaction: " +
          transactionId,
        originalError: watchError,
        shouldLog: true,
      },
    };
  }
}
