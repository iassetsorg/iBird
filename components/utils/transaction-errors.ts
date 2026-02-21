/**
 * Centralized transaction error classification utility.
 *
 * Handles all known error structures from:
 * - DAppSigner (complex { txError, queryError } objects)
 * - WalletConnect JSON-RPC (code 5000)
 * - Hedera SDK (code 9000)
 * - Direct string/Error patterns
 *
 * @module transaction-errors
 */

/**
 * Possible error categories for Hedera transactions
 */
export type TransactionErrorType =
  | "USER_REJECTED"
  | "NETWORK_ERROR"
  | "WALLET_DISCONNECTED"
  | "TRANSACTION_FAILED"
  | "TIMEOUT"
  | "UNKNOWN";

/**
 * Classified transaction error with type and user-friendly message
 */
export interface ClassifiedError {
  type: TransactionErrorType;
  message: string;
  originalError: unknown;
  /** Whether this error should be logged to console.error (false for user rejections) */
  shouldLog: boolean;
}

/**
 * Classifies any error from the Hedera SDK / WalletConnect / DAppSigner
 * into a structured, actionable error type.
 *
 * This replaces ~200 lines of duplicated error checking code that was
 * previously copy-pasted across use_send_message.tsx, use_create_topic.tsx,
 * create_new_profile.tsx, and tip.tsx.
 *
 * @param error - The raw error from any transaction operation
 * @returns A classified error with type, message, and metadata
 */
export function classifyTransactionError(error: unknown): ClassifiedError {
  // Default classification
  const result: ClassifiedError = {
    type: "UNKNOWN",
    message: "An unknown error occurred",
    originalError: error,
    shouldLog: true,
  };

  if (!error) {
    return result;
  }

  // Handle string errors
  if (typeof error === "string") {
    if (error.includes("USER_REJECT")) {
      return userRejected(error);
    }
    if (
      error.includes("Query.fromBytes") ||
      error.includes("DAppSigner")
    ) {
      return networkError(error, "Network connection error. Please try again.");
    }
    result.message = error;
    return result;
  }

  // Handle Error instances
  if (error instanceof Error) {
    return classifyErrorMessage(error.message, error);
  }

  // Handle complex object errors
  if (typeof error === "object") {
    // PATTERN 1: DAppSigner complex error with both txError and queryError
    // { txError: { message: "USER_REJECT" }, queryError: { message: "Query.fromBytes() not implemented" } }
    if ("txError" in error && error.txError && typeof error.txError === "object") {
      if (
        "message" in error.txError &&
        error.txError.message === "USER_REJECT"
      ) {
        return userRejected(error);
      }
    }

    // PATTERN 2: queryError only (without txError USER_REJECT)
    if (
      "queryError" in error &&
      error.queryError &&
      typeof error.queryError === "object"
    ) {
      if (
        "message" in error.queryError &&
        typeof error.queryError.message === "string"
      ) {
        if (error.queryError.message.includes("Query.fromBytes")) {
          return networkError(error, "Network synchronization error. Please try again.");
        }
      }
    }

    // PATTERN 3: WalletConnect JSON-RPC error format
    // { error: { code: 5000, message: "..." } }
    if (
      "error" in error &&
      error.error &&
      typeof error.error === "object"
    ) {
      if ("code" in error.error && error.error.code === 5000) {
        return userRejected(error);
      }
      if (
        "message" in error.error &&
        typeof error.error.message === "string"
      ) {
        return classifyErrorMessage(error.error.message, error);
      }
    }

    // PATTERN 4: Hedera SDK error code
    // { code: 9000, message: "..." }
    if ("code" in error && error.code === 9000) {
      return userRejected(error);
    }

    // PATTERN 5: Direct message property
    if ("message" in error && typeof error.message === "string") {
      return classifyErrorMessage(error.message, error);
    }
  }

  return result;
}

/**
 * Classifies an error based on its message string
 */
function classifyErrorMessage(
  message: string,
  originalError: unknown
): ClassifiedError {
  if (message.includes("USER_REJECT")) {
    return userRejected(originalError);
  }

  if (message.includes("User rejected")) {
    return userRejected(originalError);
  }

  if (
    message.includes("Query.fromBytes") ||
    message.includes("DAppSigner")
  ) {
    return networkError(originalError, "Network connection error. Please try again.");
  }

  if (
    message.includes("wallet") &&
    (message.includes("disconnect") || message.includes("not connected"))
  ) {
    return {
      type: "WALLET_DISCONNECTED",
      message: "Wallet is not connected. Please reconnect your wallet.",
      originalError,
      shouldLog: true,
    };
  }

  if (
    message.includes("timeout") ||
    message.includes("timed out")
  ) {
    return {
      type: "TIMEOUT",
      message: "Transaction timed out. It may have completed — check your wallet or HashScan.",
      originalError,
      shouldLog: true,
    };
  }

  if (message.includes("Transaction failed")) {
    return {
      type: "TRANSACTION_FAILED",
      message: message,
      originalError,
      shouldLog: true,
    };
  }

  return {
    type: "UNKNOWN",
    message: message || "An unknown error occurred",
    originalError,
    shouldLog: true,
  };
}

/**
 * Creates a USER_REJECTED classification
 */
function userRejected(originalError: unknown): ClassifiedError {
  return {
    type: "USER_REJECTED",
    message: "Transaction was cancelled by user",
    originalError,
    shouldLog: false, // Don't log user rejections — they trigger Next.js dev overlay
  };
}

/**
 * Creates a NETWORK_ERROR classification
 */
function networkError(
  originalError: unknown,
  message: string
): ClassifiedError {
  return {
    type: "NETWORK_ERROR",
    message,
    originalError,
    shouldLog: true,
  };
}

/**
 * Returns the appropriate toast type for a given error classification
 */
export function getToastTypeForError(
  errorType: TransactionErrorType
): "error" | "warn" | "info" {
  switch (errorType) {
    case "USER_REJECTED":
      return "warn";
    case "TIMEOUT":
      return "info";
    default:
      return "error";
  }
}
