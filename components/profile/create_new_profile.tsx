"use client";

// ============================================================================
// IMPORTS SECTION
// ============================================================================

// React Core Imports
import React, { useState, useRef, useEffect, Component } from "react";

// Hedera SDK Imports
import {
  Hbar,
  Signer,
  ContractExecuteTransaction,
  ContractFunctionParameters,
  TokenAssociateTransaction,
} from "@hashgraph/sdk";

// Third-party Library Imports
import { toast } from "react-toastify";
import { Buffer } from "buffer";
import { EmojiClickData } from "emoji-picker-react";

// Icon Imports
import { MdOutlinePermMedia } from "react-icons/md";
import { RiDeleteBinLine, RiCheckLine, RiRefreshLine } from "react-icons/ri";

// Custom Hook Imports
import useSendMessage from "../hooks/use_send_message";
import useCreateTopic from "../hooks/use_create_topic";
import useUploadToArweave from "../media/use_upload_to_arweave";
import { useRefreshTrigger } from "../hooks/use_refresh_trigger";

// Wallet Integration Imports
import {
  useWallet,
  useAccountId,
  useWatchTransactionReceipt,
} from "@buidlerlabs/hashgraph-react-wallets";

// Component Imports
import EmojiPickerPopup from "../common/EmojiPickerPopup";
import ImageCropModal from "../common/ImageCropModal";

// Next.js 15 Dev Mode Error Suppression
import {
  initializeErrorSuppression,
  safeConsoleError,
} from "../utils/nextjs-dev-error-suppression";

// Centralized transaction utilities
import {
  executeTransaction,
  type WatchFunction,
} from "../utils/execute-transaction";
import { getToastTypeForError } from "../utils/transaction-errors";

// ============================================================================
// ENVIRONMENT CONFIGURATION
// ============================================================================

const contractId = process.env.NEXT_PUBLIC_CONTRACT_ID || "0.0.6748913";
const mintFeeHBAR = parseInt(process.env.NEXT_PUBLIC_MINT_FEE_HBAR || "1");
const profileNFTTokenId =
  process.env.NEXT_PUBLIC_PROFILE_NFT_TOKEN_ID || "0.0.6748914";
const profileTopicMemo =
  process.env.NEXT_PUBLIC_PROFILE_TOPIC_MEMO || "ibird profile";

// ============================================================================
// TYPE DEFINITIONS & INTERFACES
// ============================================================================

/**
 * StepStatus Interface
 * Tracks the state of each step in the profile creation process
 * @property {string} status - Current status of the step (idle/loading/success/error)
 * @property {boolean} disabled - Whether the step is currently disabled
 */
interface StepStatus {
  status: "idle" | "loading" | "success" | "error";
  disabled: boolean;
}

/**
 * ProfileStepStatuses Interface
 * Manages the status of all steps in the profile creation process
 * Each step represents a distinct operation in creating the user profile
 */
interface ProfileStepStatuses {
  uploadPicture?: StepStatus; // Status of uploading profile picture (optional)
  uploadBanner?: StepStatus; // Status of uploading banner (optional)
  createUserProfileTopic: StepStatus; // Status of creating profile topic
  initiateUserProfileTopic: StepStatus; // Status of initializing user profile
  associateNFTProfileToken: StepStatus; // Status of associating with profile token
  mintTransferFreezeNFT: StepStatus; // Status of minting, transferring, and freezing profile NFT
}

// ============================================================================
// ERROR BOUNDARY COMPONENT
// ============================================================================

/**
 * Enhanced Error Boundary for Profile Creation
 * Catches React component errors and provides graceful fallback
 * Following Next.js patterns - must be Client Component
 */
class ProfileCreationErrorBoundary extends Component<
  { children: React.ReactNode; onError?: (error: Error) => void },
  { hasError: boolean; errorMessage: string }
> {
  constructor(props: {
    children: React.ReactNode;
    onError?: (error: Error) => void;
  }) {
    super(props);
    this.state = { hasError: false, errorMessage: "" };
  }

  static getDerivedStateFromError(error: Error) {
    // Update state to show fallback UI - Next.js pattern
    console.error("Error Boundary caught error:", error);
    return {
      hasError: true,
      errorMessage: error.message.includes("USER_REJECT")
        ? "Transaction was cancelled by user"
        : "An unexpected error occurred",
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Error Boundary details:", { error, errorInfo });

    // Check if this is a profile creation related error
    const isProfileError =
      error.message.includes("USER_REJECT") ||
      error.message.includes("Query.fromBytes") ||
      error.message.includes("DAppSigner") ||
      error.stack?.includes("handleAssociateToken") ||
      error.stack?.includes("create_new_profile");

    if (isProfileError && this.props.onError) {
      this.props.onError(error);
    }
  }

  // Next.js style reset function
  reset = () => {
    this.setState({ hasError: false, errorMessage: "" });
  };

  render() {
    if (this.state.hasError) {
      // Next.js error boundary pattern with reset functionality
      return (
        <div className="p-6 text-center">
          <div className="text-red-400 text-lg font-mono mb-4">
            Profile Creation Error
          </div>
          <div className="text-white/80 mb-4">{this.state.errorMessage}</div>
          <div className="flex gap-3 justify-center">
            <button
              onClick={this.reset}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors duration-200 font-mono"
            >
              Try Again
            </button>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-red-500 hover:bg-red-400 text-white rounded-lg transition-colors duration-200 font-mono"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// ============================================================================
// CUSTOM HOOKS
// ============================================================================

/**
 * Next.js specific error handler hook
 * Handles event handler errors that Error Boundaries can't catch
 */
const useNextjsErrorHandler = () => {
  const [error, setError] = useState<string | null>(null);

  const handleError = (error: unknown, context: string) => {
    console.error(`Next.js Error Handler - ${context}:`, error);

    let errorMessage = "An unexpected error occurred";

    // Enhanced error detection for Next.js context
    if (error instanceof Error) {
      if (error.message.includes("USER_REJECT")) {
        errorMessage = "Transaction was cancelled by user";
      } else if (error.message.includes("Query.fromBytes")) {
        errorMessage = "Network connection error";
      } else {
        errorMessage = error.message;
      }
    } else if (error && typeof error === "object") {
      // Handle complex error objects from SDKs
      if ("message" in error && typeof error.message === "string") {
        errorMessage = error.message;
      } else if (
        "error" in error &&
        error.error &&
        typeof error.error === "object" &&
        "message" in error.error
      ) {
        errorMessage = String(error.error.message);
      }
    }

    setError(errorMessage);
    return errorMessage;
  };

  const clearError = () => setError(null);

  return { error, handleError, clearError };
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

/**
 * CreateNewProfile Component
 * Main component for creating user profiles with NFT minting
 * @param {Object} props - Component props
 * @param {Function} props.onClose - Handler for closing the profile creation modal
 */
const CreateNewProfile = ({ onClose }: { onClose: () => void }) => {
  // ========================================================================
  // HOOKS & EXTERNAL DEPENDENCIES
  // ========================================================================

  // Next.js specific error handling
  const { error: componentError, clearError } = useNextjsErrorHandler();

  // Wallet and account management
  const wallet = useWallet();
  const signer = wallet.signer as Signer;
  const { data: accountId } = useAccountId();
  const { watch } = useWatchTransactionReceipt();

  // Hedera network interactions
  const { send } = useSendMessage();
  const { create } = useCreateTopic();
  const signingAccount = accountId;

  // Media upload handling
  const { uploadToArweave } = useUploadToArweave();
  const { triggerRefresh } = useRefreshTrigger();

  // ========================================================================
  // COMPONENT STATE MANAGEMENT
  // ========================================================================

  // Error boundary state
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Form input states
  const [name, setName] = useState(""); // User's name
  const [bio, setBio] = useState(""); // User's bio
  const [website, setWebsite] = useState(""); // User's website

  // Media handling states
  const [picture, setPicture] = useState<File | null>(null); // Profile picture file
  const [banner, setBanner] = useState<File | null>(null); // Banner image file
  const [picturePreview, setPicturePreview] = useState<string | null>(null); // Picture preview URL
  const [bannerPreview, setBannerPreview] = useState<string | null>(null); // Banner preview URL
  const [pictureHash, setPictureHash] = useState<string | null>(null);
  const [bannerHash, setBannerHash] = useState<string | null>(null);

  // UI control states
  const [isEditing, setIsEditing] = useState(true); // Edit mode flag
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  // Auto-progression states
  const [autoProgress, setAutoProgress] = useState(false); // Auto-progression flag
  const autoProgressRef = useRef(false); // Reliable reference for auto-progress state
  const [countdown, setCountdown] = useState(0); // Countdown timer for auto-progress delays
  const [autoProgressDisabledByError, setAutoProgressDisabledByError] =
    useState(false); // Track if disabled due to error

  // Limits
  const nameMaxLength = 50;
  const bioMaxLength = 200;

  // Process tracking states
  const [stepStatuses, setStepStatuses] = useState<ProfileStepStatuses>({
    uploadPicture: picture ? { status: "idle", disabled: true } : undefined,
    uploadBanner: banner ? { status: "idle", disabled: true } : undefined,
    createUserProfileTopic: { status: "idle", disabled: true },
    initiateUserProfileTopic: { status: "idle", disabled: true },
    associateNFTProfileToken: { status: "idle", disabled: true },
    mintTransferFreezeNFT: { status: "idle", disabled: true },
  });

  // Profile creation states
  const [userProfileTopicId, setProfileTopicId] = useState("");

  // ========================================================================
  // AUTO-PROGRESSION STATE SYNCHRONIZATION
  // ========================================================================

  // Monitor topic ID changes for auto-progression (only for initiate profile step)
  useEffect(() => {
    if (
      autoProgressRef.current &&
      userProfileTopicId &&
      userProfileTopicId.trim() !== ""
    ) {
      // Check if we should auto-progress to initiate profile step
      const initiateStep = stepStatuses.initiateUserProfileTopic;
      if (
        initiateStep &&
        initiateStep.status === "idle" &&
        !initiateStep.disabled
      ) {
        console.log(
          "Topic ID is now available, auto-progressing to initiate profile..."
        );
        setTimeout(() => {
          handleInitiateUserProfile();
        }, 1000); // Small delay to ensure state is fully propagated
      }
    }
  }, [
    userProfileTopicId,
    stepStatuses.initiateUserProfileTopic,
    autoProgressRef.current,
  ]);

  // NOTE: Removed the upload monitoring useEffect as auto-progression 
  // is now handled directly in upload completion handlers

  // Image cropping states
  const [showCropper, setShowCropper] = useState(false);
  const [tempImage, setTempImage] = useState<string | null>(null);
  const [showBannerCropper, setShowBannerCropper] = useState(false);
  const [tempBannerImage, setTempBannerImage] = useState<string | null>(null);

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  // ========================================================================
  // GLOBAL ERROR HANDLING SETUP
  // ========================================================================

  // Reset error state when component mounts or props change
  useEffect(() => {
    setHasError(false);
    setErrorMessage("");

    // Initialize Next.js 15 dev mode error suppression
    const cleanupErrorSuppression = initializeErrorSuppression();

    // NEXT.JS PATTERN: Enhanced global error handlers to prevent page crashes
    // Based on Context7 research - async errors in event handlers need manual handling
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const error = event.reason;
      console.error("Unhandled promise rejection:", error);

      // Enhanced error detection based on Context7 WalletConnect and Hedera patterns
      const isProfileError =
        error &&
        // WalletConnect JSON-RPC error patterns (code 5000)
        ((typeof error === "object" &&
          "error" in error &&
          error.error &&
          typeof error.error === "object" &&
          "code" in error.error &&
          error.error.code === 5000) ||
          // Hedera SDK error patterns (code 9000)
          (typeof error === "object" &&
            "code" in error &&
            error.code === 9000) ||
          // Direct USER_REJECT messages
          (typeof error === "object" &&
            "message" in error &&
            typeof error.message === "string" &&
            error.message.includes("USER_REJECT")) ||
          // Query.fromBytes errors from Hedera SDK (including "not implemented" variant)
          (typeof error === "object" &&
            "message" in error &&
            typeof error.message === "string" &&
            (error.message.includes("Query.fromBytes") ||
              error.message.includes("Query.fromBytes() not implemented"))) ||
          // DAppSigner related errors
          (typeof error === "object" &&
            "message" in error &&
            typeof error.message === "string" &&
            error.message.includes("DAppSigner")) ||
          // CRITICAL: Complex error structure with both txError and queryError
          (typeof error === "object" &&
            "txError" in error &&
            error.txError &&
            typeof error.txError === "object" &&
            "queryError" in error &&
            error.queryError &&
            typeof error.queryError === "object") ||
          // Nested txError structures
          (typeof error === "object" &&
            "txError" in error &&
            error.txError &&
            typeof error.txError === "object" &&
            "message" in error.txError &&
            error.txError.message === "USER_REJECT") ||
          // String error patterns
          (typeof error === "string" &&
            (error.includes("USER_REJECT") ||
              error.includes("Query.fromBytes") ||
              error.includes("DAppSigner"))) ||
          // Stack trace checks for our component
          (typeof error === "object" &&
            "stack" in error &&
            typeof error.stack === "string" &&
            (error.stack.includes("handleAssociateToken") ||
              error.stack.includes("create_new_profile") ||
              error.stack.includes("useCreateTopic") ||
              error.stack.includes("handleCreateUserProfileTopic"))));

      if (isProfileError) {
        // CRITICAL: Prevent the error from propagating and crashing the page
        event.preventDefault();
        event.stopImmediatePropagation();

        // Handle the error gracefully without crashing
        console.log(
          "NEXT.JS PATTERN: Preventing page crash from profile creation error"
        );

        // NEXT.JS PATTERN: Use setState to handle async errors manually
        // Since Error Boundaries don't catch async errors in event handlers
        try {
          setAutoProgress(false);
          autoProgressRef.current = false;
          setCountdown(0);
          setAutoProgressDisabledByError(true);

          // Determine if this is a user rejection
          const isUserRejection =
            (typeof error === "object" &&
              "txError" in error &&
              error.txError &&
              typeof error.txError === "object" &&
              "message" in error.txError &&
              error.txError.message === "USER_REJECT") ||
            (typeof error === "object" &&
              "message" in error &&
              typeof error.message === "string" &&
              error.message.includes("USER_REJECT"));

          if (isUserRejection) {
            toast.error(
              "Transaction rejected by user. You can retry manually."
            );
          } else {
            toast.error("Transaction failed. Auto-progression disabled.");
          }
        } catch (fallbackError) {
          console.error("Even fallback error handling failed:", fallbackError);
          // Don't throw - just log to prevent infinite error loops
        }
      }
    };

    const handleGlobalError = (event: ErrorEvent) => {
      const error = event.error;
      console.error("Global error:", error);

      // Enhanced error detection for profile-related errors using Context7 patterns
      const isProfileError =
        error &&
        // WalletConnect error patterns
        ((error.message && error.message.includes("USER_REJECT")) ||
          error.code === 5000 || // WalletConnect rejection code
          error.code === 9000 || // Hedera SDK error code
          // Hedera SDK specific errors (including "not implemented" variant)
          (error.message &&
            (error.message.includes("Query.fromBytes") ||
              error.message.includes("Query.fromBytes() not implemented"))) ||
          (error.message && error.message.includes("DAppSigner")) ||
          // Component-specific stack traces
          (error.stack &&
            (error.stack.includes("handleAssociateToken") ||
              error.stack.includes("create_new_profile") ||
              error.stack.includes("useCreateTopic") ||
              error.stack.includes("handleCreateUserProfileTopic"))) ||
          // Transaction-related errors
          (error.message && error.message.includes("executeWithSigner")) ||
          (error.message && error.message.includes("freezeWithSigner")));

      if (isProfileError) {
        // CRITICAL: Prevent the error from bubbling up and crashing the page
        event.preventDefault();
        event.stopImmediatePropagation();

        // Handle the error gracefully
        console.log(
          "NEXT.JS PATTERN: Preventing page crash from global profile error"
        );

        try {
          setAutoProgress(false);
          autoProgressRef.current = false;
          setCountdown(0);
          setAutoProgressDisabledByError(true);
          toast.error("An error occurred. Auto-progression disabled.");
        } catch (fallbackError) {
          console.error("Fallback error handling failed:", fallbackError);
          // Don't throw - just log to prevent cascading failures
        }
      }
    };

    // Add event listeners with passive option for better performance
    window.addEventListener("unhandledrejection", handleUnhandledRejection, {
      passive: false,
    });
    window.addEventListener("error", handleGlobalError, { passive: false });

    // Additional safety: add a catch-all window error handler
    const handleWindowError = (
      message: string | Event,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      _source?: string,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      _lineno?: number,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      _colno?: number,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      _error?: Error
    ) => {
      if (
        typeof message === "string" &&
        (message.includes("USER_REJECT") ||
          message.includes("Query.fromBytes") ||
          message.includes("DAppSigner") ||
          message.includes("handleAssociateToken") ||
          message.includes("useCreateTopic") ||
          message.includes("handleCreateUserProfileTopic") ||
          message.includes("Query.fromBytes() not implemented"))
      ) {
        console.log(
          "NEXT.JS 15 DEV MODE: Suppressing known Hedera SDK development error:",
          message
        );
        try {
          setAutoProgress(false);
          autoProgressRef.current = false;
          setCountdown(0);
          setAutoProgressDisabledByError(true);
        } catch (fallbackError) {
          console.error("Window error fallback failed:", fallbackError);
        }
        return true; // Prevent default browser error handling
      }
      return false;
    };

    window.onerror = handleWindowError;

    // Cleanup on unmount
    return () => {
      window.removeEventListener(
        "unhandledrejection",
        handleUnhandledRejection
      );
      window.removeEventListener("error", handleGlobalError);
      window.onerror = null;

      // Cleanup error suppression
      cleanupErrorSuppression();
    };
  }, []);

  // ========================================================================
  // UTILITY FUNCTIONS
  // ========================================================================

  /**
   * Enhanced wallet reconnection helper
   * Based on Context7 research for handling DAppSigner connection issues
   */
  const reconnectWallet = async (): Promise<boolean> => {
    try {
      console.log("Attempting wallet reconnection...");

      // Check if wallet instance exists and has reconnect capability
      if (wallet && typeof wallet.connect === "function") {
        await wallet.connect();

        // Validate connection after reconnect
        await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait for connection to stabilize
        const isValid = await validateWalletState();

        if (isValid) {
          toast.success("Wallet reconnected successfully");
          return true;
        }
      }

      toast.warning("Please manually reconnect your wallet");
      return false;
    } catch (error) {
      console.error("Wallet reconnection failed:", error);
      toast.error("Failed to reconnect wallet. Please refresh the page.");
      return false;
    }
  };

  /**
   * Utility function to safely disable auto-progression
   */
  const disableAutoProgression = (reason: string) => {
    console.log(`Disabling auto-progression: ${reason}`);
    setAutoProgress(false);
    autoProgressRef.current = false;
    setCountdown(0);
    setAutoProgressDisabledByError(true);
  };

  /**
   * Utility function to reset auto-progression after errors
   */
  const resetAutoProgression = () => {
    console.log(
      "Resetting auto-progression and automatically starting next step"
    );

    // First check if wallet is connected
    if (!wallet || !signer || !accountId) {
      console.log("Cannot reset auto-progression: wallet not connected");
      toast.warning(
        "Please connect your wallet before resetting auto-progression"
      );
      return;
    }

    // Reset the disabled state
    setAutoProgressDisabledByError(false);

    // Enable auto-progression
    setAutoProgress(true);
    autoProgressRef.current = true;

    // Find the first available step to start
    const stepOrder = [
      "uploadPicture",
      "uploadBanner", 
      "createUserProfileTopic",
      "initiateUserProfileTopic",
      "associateNFTProfileToken",
      "mintTransferFreezeNFT",
    ];

    const nextStep = stepOrder.find((stepName) => {
      const status = stepStatuses[stepName as keyof ProfileStepStatuses];
      return status && status.status === "error" && !status.disabled;
    });

    console.log("Found failed step to retry:", nextStep);

    if (nextStep) {
      toast.info(`Auto-progression reset. Retrying ${nextStep}...`);

      // Start the failed step after a short delay
      setTimeout(() => {
        switch (nextStep) {
          case "uploadPicture":
            handleUploadPicture().catch((error) => {
              console.error("Auto-retry upload error:", error);
              disableAutoProgression("Upload retry error");
            });
            break;
          case "uploadBanner":
            handleUploadBanner().catch((error) => {
              console.error("Auto-retry banner upload error:", error);
              disableAutoProgression("Banner upload retry error");
            });
            break;
          case "createUserProfileTopic":
            handleCreateUserProfileTopic().catch((error) => {
              console.error("Auto-retry topic creation error:", error);
              disableAutoProgression("Topic creation retry error");
            });
            break;
          case "initiateUserProfileTopic":
            handleInitiateUserProfile().catch((error) => {
              console.error("Auto-retry profile initiation error:", error);
              disableAutoProgression("Profile initiation retry error");
            });
            break;
          case "associateNFTProfileToken":
            handleAssociateToken().catch((error) => {
              console.error("Auto-retry token association error:", error);
              disableAutoProgression("Token association retry error");
            });
            break;
          case "mintTransferFreezeNFT":
            handleMintTransferFreezeNFT().catch((error) => {
              console.error("Auto-retry NFT minting error:", error);
              disableAutoProgression("NFT minting retry error");
            });
            break;
          default:
            console.warn("Unknown step for auto-retry:", nextStep);
        }
      }, 1000); // 1 second delay before starting
    } else {
      // No failed steps found, just enable auto-progression for future steps
      toast.success("Auto-progression reset and enabled.");
    }
  };

  /**
   * Enhanced transaction wrapper with pre-execution validation
   * Based on Context7 research: prevents DAppSigner Query.fromBytes issues
   * Validates wallet state before any SDK operations
   */
  const validateWalletState = async (): Promise<boolean> => {
    try {
      // Check basic wallet connectivity
      if (!wallet || !signer || !accountId) {
        throw new Error("Wallet not properly connected");
      }

      // Test signer responsiveness with a simple call
      // This helps detect if wallet is in a problematic state
      const testAccountId = String(accountId);
      if (!testAccountId || testAccountId === "undefined") {
        throw new Error("Account ID not available");
      }

      return true;
    } catch (error) {
      console.warn("Wallet state validation failed:", error);
      return false;
    }
  };

  /**
   * Next.js safe wrapper for async operations with enhanced pre-validation
   * Based on Context7 WalletConnect patterns - prevents DAppSigner crashes
   */
  const safeAsyncWrapper = async (
    operation: () => Promise<unknown>,
    context: string,
    onError?: (error: string) => void
  ): Promise<unknown> => {
    try {
      // Pre-execution validation to prevent DAppSigner issues
      const walletIsValid = await validateWalletState();
      if (!walletIsValid) {
        throw new Error(
          "Wallet connection is not stable. Please reconnect your wallet."
        );
      }

      // Execute operation with timeout to prevent hanging
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          reject(
            new Error(
              "Operation timed out. This might indicate a wallet connectivity issue."
            )
          );
        }, 30000); // 30 second timeout
      });

      const result = await Promise.race([operation(), timeoutPromise]);

      return result;
    } catch (error) {
      console.error(`Safe wrapper caught error in ${context}:`, error);

      // Enhanced error classification based on Context7 patterns
      let errorMessage = "An unexpected error occurred";
      let isUserRejection = false;
      let isWalletIssue = false;
      let shouldRetry = false;

      // Analyze error structure following WalletConnect patterns
      if (error && typeof error === "object") {
        // ENHANCED: Check for complex error structure with both txError and queryError
        // This is the specific pattern that causes the crash
        if (
          "txError" in error &&
          error.txError &&
          typeof error.txError === "object" &&
          "queryError" in error &&
          error.queryError &&
          typeof error.queryError === "object"
        ) {
          // Check txError for USER_REJECT
          if (
            "message" in error.txError &&
            error.txError.message === "USER_REJECT"
          ) {
            isUserRejection = true;
            errorMessage = "Transaction rejected by user";
            console.log("Detected USER_REJECT in complex error structure");
          }

          // Check queryError for Query.fromBytes (but don't override user rejection)
          if (
            !isUserRejection &&
            "message" in error.queryError &&
            typeof error.queryError.message === "string" &&
            error.queryError.message.includes("Query.fromBytes")
          ) {
            isWalletIssue = true;
            errorMessage = "Network synchronization issue";
          }
        }
        // Check for DAppSigner complex error structure (original pattern)
        else if (
          "txError" in error &&
          error.txError &&
          typeof error.txError === "object"
        ) {
          if ("message" in error.txError) {
            if (error.txError.message === "USER_REJECT") {
              isUserRejection = true;
              errorMessage = "Transaction rejected by user";
            }
          }
        }
        // Check for queryError containing Query.fromBytes
        else if (
          "queryError" in error &&
          error.queryError &&
          typeof error.queryError === "object"
        ) {
          if (
            "message" in error.queryError &&
            typeof error.queryError.message === "string"
          ) {
            if (error.queryError.message.includes("Query.fromBytes")) {
              isWalletIssue = true;
              shouldRetry = true;
              errorMessage =
                "Wallet connectivity issue detected. This will be retried automatically.";
            }
          }
        }
        // Check for direct USER_REJECT patterns
        else if ("message" in error && typeof error.message === "string") {
          if (error.message.includes("USER_REJECT")) {
            isUserRejection = true;
            errorMessage = "Transaction rejected by user";
          } else if (error.message.includes("Query.fromBytes")) {
            isWalletIssue = true;
            shouldRetry = true;
            errorMessage =
              "Network synchronization issue detected. Retrying...";
          } else if (
            error.message.includes("timeout") ||
            error.message.includes("timed out")
          ) {
            isWalletIssue = true;
            shouldRetry = true;
            errorMessage =
              "Operation timed out. Please check your wallet connection.";
          } else {
            errorMessage = error.message;
          }
        }
        // Check for WalletConnect JSON-RPC error format
        else if (
          "error" in error &&
          error.error &&
          typeof error.error === "object"
        ) {
          if ("code" in error.error && error.error.code === 5000) {
            isUserRejection = true;
            errorMessage = "Transaction rejected by user";
          }
          if (
            "message" in error.error &&
            typeof error.error.message === "string"
          ) {
            if (!isUserRejection) {
              errorMessage = error.error.message;
            }
          }
        }
        // Check for Hedera SDK error codes
        else if ("code" in error && error.code === 9000) {
          isUserRejection = true;
          errorMessage = "Transaction rejected by user";
        }
      } else if (error instanceof Error) {
        if (error.message.includes("USER_REJECT")) {
          isUserRejection = true;
          errorMessage = "Transaction rejected by user";
        } else if (error.message.includes("Query.fromBytes")) {
          isWalletIssue = true;
          shouldRetry = true;
          errorMessage = "Wallet synchronization issue. Retrying...";
        } else {
          errorMessage = error.message;
        }
      }

      // Handle different error types appropriately
      if (
        shouldRetry &&
        autoProgressRef.current &&
        context !== "retry-operation"
      ) {
        console.log(`Auto-retry scheduled for ${context} due to wallet issue`);
        // Schedule a retry after a delay
        setTimeout(async () => {
          console.log(`Retrying ${context}...`);
          await safeAsyncWrapper(operation, `retry-${context}`, onError);
        }, 3000);

        toast.warning(
          "Wallet connectivity issue detected. Retrying automatically..."
        );
        return null;
      }

      // Call custom error handler if provided
      if (onError) {
        onError(errorMessage);
      }

      // Auto-progression management - Enhanced for user rejections
      if (isUserRejection) {
        disableAutoProgression(`User cancelled: ${errorMessage}`);
        toast.error("Transaction rejected. You can retry manually.");
        console.log("User rejected transaction, auto-progression disabled");
      } else if (isWalletIssue && !shouldRetry) {
        disableAutoProgression(`Wallet issue: ${errorMessage}`);
        toast.error("Wallet connectivity issue. Please reconnect your wallet.");
      } else if (!shouldRetry) {
        disableAutoProgression(`Error: ${errorMessage}`);
        toast.error(errorMessage);
      }

      return null;
    }
  };

  /**
   * Error handling wrapper (legacy - kept for compatibility)
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleError = (error: unknown, context: string) => {
    console.error(`Error in ${context}:`, error);
    setHasError(true);

    let message = `An error occurred in ${context}.`;
    if (error instanceof Error) {
      if (error.message.includes("Query.fromBytes")) {
        message =
          "Network connection error. Please refresh the page and try again.";
      } else {
        message = error.message;
      }
    }

    setErrorMessage(message);
    toast.error(message);
  };

  // ========================================================================
  // IMAGE HANDLING FUNCTIONS
  // ========================================================================

  /**
   * Clears the selected profile picture
   * Resets related states and input
   */
  const clearPicture = () => {
    setPicture(null);
    setPicturePreview(null);
    setTempImage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    setStepStatuses((prev) => ({
      ...prev,
      uploadPicture: undefined,
    }));
  };

  /**
   * Clears the selected banner image
   * Resets related states and input
   */
  const clearBanner = () => {
    setBanner(null);
    setBannerPreview(null);
    setTempBannerImage(null);
    if (bannerInputRef.current) {
      bannerInputRef.current.value = "";
    }
    setStepStatuses((prev) => ({
      ...prev,
      uploadBanner: undefined,
    }));
  };

  /**
   * Handles the change of profile picture
   * Updates preview and related states
   */
  const handlePictureChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files ? event.target.files[0] : null;
    if (!file) {
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      return;
    }

    const maxSize = 100 * 1024 * 1024; // 100MB
    if (file.size > maxSize) {
      toast.error("The file exceeds 100MB.");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setTempImage(reader.result as string);
      setShowCropper(true);
    };
    reader.readAsDataURL(file);
  };

  /**
   * Handles the change of banner image
   * Updates preview and related states
   */
  const handleBannerChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files ? event.target.files[0] : null;
    if (!file) {
      if (bannerInputRef.current) {
        bannerInputRef.current.value = "";
      }
      return;
    }

    const maxSize = 100 * 1024 * 1024; // 100MB
    if (file.size > maxSize) {
      toast.error("The file exceeds 100MB.");
      if (bannerInputRef.current) {
        bannerInputRef.current.value = "";
      }
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setTempBannerImage(reader.result as string);
      setShowBannerCropper(true);
    };
    reader.readAsDataURL(file);
  };

  /**
   * Handles completion of image cropping using the ImageCropModal
   * Processes the cropped image and updates state
   */
  const handleImageCropComplete = (croppedFile: File) => {
    setPicture(croppedFile);
    setPicturePreview(URL.createObjectURL(croppedFile));
    setShowCropper(false);
    setTempImage(null);
  };

  /**
   * Handles completion of banner cropping using the ImageCropModal
   * Processes the cropped banner and updates state
   */
  const handleBannerCropComplete = (croppedFile: File) => {
    setBanner(croppedFile);
    setBannerPreview(URL.createObjectURL(croppedFile));
    setShowBannerCropper(false);
    setTempBannerImage(null);
  };

  // ========================================================================
  // EMOJI HANDLING FUNCTIONS
  // ========================================================================

  /**
   * Handles emoji selection from the emoji picker
   * Adds the selected emoji to the bio text
   */
  const onEmojiClick = (emojiData: EmojiClickData) => {
    setBio((prevBio) => prevBio + emojiData.emoji);
    setShowEmojiPicker(false);
  };

  // ========================================================================
  // PROFILE CREATION WORKFLOW FUNCTIONS
  // ========================================================================

  /**
   * Handles the start of profile creation process
   * Validates required fields and wallet connection before initializing
   */
  const handleStartProfileCreation = () => {
    if (!name.trim()) {
      toast.error("Please enter your name");
      return;
    }

    if (name.trim().length > nameMaxLength) {
      toast.error(`Name must be ${nameMaxLength} characters or fewer`);
      return;
    }

    if (bio.trim().length > bioMaxLength) {
      toast.error(`Bio must be ${bioMaxLength} characters or fewer`);
      return;
    }

    // Check wallet connection before starting
    if (!wallet || !signer || !accountId) {
      toast.error("Please connect your wallet before creating a profile");
      return;
    }

    setIsEditing(false);

    // Initialize step statuses with proper sequential flow
    const initialStepStatuses: ProfileStepStatuses = {
      createUserProfileTopic: { status: "idle", disabled: true }, // Will be enabled after image upload or immediately if no image
      initiateUserProfileTopic: { status: "idle", disabled: true },
      associateNFTProfileToken: { status: "idle", disabled: true },
      mintTransferFreezeNFT: { status: "idle", disabled: true },
    };

    // If picture or banner exists, they become upload steps with proper sequencing
    if (picture) {
      initialStepStatuses.uploadPicture = { status: "idle", disabled: false };
    }
    if (banner) {
      // Banner upload should wait for picture upload to complete
      initialStepStatuses.uploadBanner = { 
        status: "idle", 
        disabled: picture ? true : false  // Disabled if picture exists and needs to be uploaded first
      };
    }

    // Topic creation can start only after ALL required uploads complete
    // If no images to upload, topic creation can start immediately
    if (!picture && !banner) {
      initialStepStatuses.createUserProfileTopic = {
        status: "idle",
        disabled: false,
      };
    }
    // If only picture or only banner, topic creation waits for that upload
    // If both exist, topic creation waits for BOTH uploads to complete

    setStepStatuses(initialStepStatuses);
  };

  /**
   * Handles profile picture upload to Arweave (Next.js Safe Version)
   * Updates status and provides user feedback
   */
  const handleUploadPicture = async () => {
    clearError();

    setStepStatuses((prev) => ({
      ...prev,
      uploadPicture: { status: "loading", disabled: true },
    }));

    const result = await safeAsyncWrapper(
      async () => {
        if (!picture) {
          throw new Error("No picture file found");
        }

        const uploadedHash = await uploadToArweave(picture);
        return uploadedHash;
      },
      "Picture Upload",
      () => {
        setStepStatuses((prev) => ({
          ...prev,
          uploadPicture: { status: "error", disabled: false },
        }));
      }
    );

    if (result) {
      setPictureHash(result as string);
      
      // After picture upload completes, enable banner upload if banner exists
      // Check if we can enable topic creation (when banner is not needed or already uploaded)
      const shouldEnableTopicCreation = !banner || bannerHash;
      
      setStepStatuses((prev) => ({
        ...prev,
        uploadPicture: { status: "success", disabled: true },
        // Enable banner upload if banner exists
        ...(banner && {
          uploadBanner: { status: "idle", disabled: false }
        }),
        // Only enable topic creation if banner is not needed or already uploaded
        createUserProfileTopic: shouldEnableTopicCreation 
          ? { status: "idle", disabled: false }
          : { status: "idle", disabled: true },
      }));
      toast.success("Profile picture uploaded successfully.");

      // Auto-progression: start banner upload if needed
      if (autoProgressRef.current && banner && !bannerHash) {
        console.log("Auto-progressing to banner upload...");
        setTimeout(() => {
          handleUploadBanner();
        }, 1000);
      }
      // Auto-progression: start topic creation if no banner needed
      else if (autoProgressRef.current && shouldEnableTopicCreation) {
        console.log("Auto-progressing to topic creation after picture upload (no banner needed)...");
        setTimeout(() => {
          handleCreateUserProfileTopic();
        }, 1000);
      }
    }
  };

  /**
   * Handles banner upload to Arweave (Next.js Safe Version)
   * Updates status and provides user feedback
   */
  const handleUploadBanner = async () => {
    clearError();

    setStepStatuses((prev) => ({
      ...prev,
      uploadBanner: { status: "loading", disabled: true },
    }));

    const result = await safeAsyncWrapper(
      async () => {
        if (!banner) {
          throw new Error("No banner file found");
        }

        const uploadedHash = await uploadToArweave(banner);
        return uploadedHash;
      },
      "Banner Upload",
      () => {
        setStepStatuses((prev) => ({
          ...prev,
          uploadBanner: { status: "error", disabled: false },
        }));
      }
    );

    if (result) {
      setBannerHash(result as string);
      
      console.log("Banner upload result received:", {
        bannerHash: result,
        pictureExists: !!picture,
        pictureHash: pictureHash,
        autoProgress: autoProgressRef.current
      });
      
      // After banner upload completes, ALWAYS enable topic creation
      // because if we reached banner upload, picture must be done or not needed
      setStepStatuses((prev) => ({
        ...prev,
        uploadBanner: { status: "success", disabled: true },
        // Always enable topic creation after banner upload
        createUserProfileTopic: { status: "idle", disabled: false },
      }));
      toast.success("Banner uploaded successfully.");
      
      console.log(
        "Banner upload complete, topic creation is now enabled and will auto-start"
      );
      
      // Auto-progress to topic creation if auto-progress is enabled
      if (autoProgressRef.current) {
        console.log("Auto-progressing to topic creation after banner upload...");
        setTimeout(() => {
          handleCreateUserProfileTopic();
        }, 1000);
      }
    }
  };

  /**
   * Creates user profile topic (Enhanced Next.js Pattern)
   * Sets up a dedicated topic for the user's profile
   * Implements Next.js error handling patterns from Context7 research
   */
  const handleCreateUserProfileTopic = async () => {
    // NEXT.JS PATTERN: Manual error handling for async event handlers
    // Error Boundaries don't catch async errors in event handlers
    try {
      clearError();

      setStepStatuses((prev) => ({
        ...prev,
        createUserProfileTopic: { status: "loading", disabled: true },
      }));

      // Pre-validate wallet state to prevent DAppSigner issues
      console.log("Pre-validating wallet state for topic creation...");

      // NEXT.JS PATTERN: Validate before async operation
      if (!wallet || !signer || !accountId) {
        throw new Error("Wallet not connected");
      }

      const createdProfileTopicId = await create(profileTopicMemo, "", true);
      if (!createdProfileTopicId) {
        // Topic creation failed or was cancelled - update step status
        console.warn("Topic creation failed or was cancelled by user");
        setStepStatuses((prev) => ({
          ...prev,
          createUserProfileTopic: { status: "error", disabled: false },
        }));

        // Disable auto-progression since user likely rejected
        setAutoProgress(false);
        autoProgressRef.current = false;
        setCountdown(0);
        setAutoProgressDisabledByError(true);

        toast.warn("Topic creation cancelled. You can retry manually.");
        return; // Exit gracefully
      }

      // Success path
      setProfileTopicId(createdProfileTopicId);
      setStepStatuses((prev) => ({
        ...prev,
        createUserProfileTopic: { status: "success", disabled: true },
        initiateUserProfileTopic: { status: "idle", disabled: false },
      }));
      toast.success("User Profile Topic created successfully.");

      console.log(
        "Topic creation complete, auto-progression will be handled by useEffect"
      );
    } catch (error) {
      // NEXT.JS PATTERN: Manual error handling with useState
      safeConsoleError("handleCreateUserProfileTopic error:", error);

      // Disable auto-progression on any error
      setAutoProgress(false);
      autoProgressRef.current = false;
      setCountdown(0);
      setAutoProgressDisabledByError(true);

      // Set step status to error
      setStepStatuses((prev) => ({
        ...prev,
        createUserProfileTopic: { status: "error", disabled: false },
      }));

      // Enhanced error classification
      let errorMessage = "Failed to create topic";
      let isUserRejection = false;

      if (error && typeof error === "object") {
        // Check for complex error structure with both txError and queryError
        if (
          "txError" in error &&
          error.txError &&
          typeof error.txError === "object" &&
          "queryError" in error &&
          error.queryError &&
          typeof error.queryError === "object"
        ) {
          // Check txError for USER_REJECT
          if (
            "message" in error.txError &&
            error.txError.message === "USER_REJECT"
          ) {
            isUserRejection = true;
            errorMessage = "Transaction rejected by user";
          }
        }
        // Check for direct USER_REJECT patterns
        else if ("message" in error && typeof error.message === "string") {
          if (error.message.includes("USER_REJECT")) {
            isUserRejection = true;
            errorMessage = "Transaction rejected by user";
          } else if (error.message.includes("Query.fromBytes")) {
            errorMessage = "Network connection issue";
          } else {
            errorMessage = error.message;
          }
        }
      } else if (error instanceof Error) {
        if (error.message.includes("USER_REJECT")) {
          isUserRejection = true;
          errorMessage = "Transaction rejected by user";
        } else if (error.message.includes("Query.fromBytes")) {
          errorMessage = "Network connection issue";
        } else {
          errorMessage = error.message;
        }
      }

      // Show appropriate error message
      if (isUserRejection) {
        toast.error("Transaction rejected by user. You can retry manually.");
      } else {
        toast.error(errorMessage);
      }

      // Enhanced error recovery
      if (
        errorMessage.includes("Query.fromBytes") ||
        errorMessage.includes("Network connection issue")
      ) {
        setTimeout(async () => {
          try {
            const reconnected = await reconnectWallet();
            if (reconnected) {
              toast.info(
                "Wallet reconnected. Please try creating the topic again."
              );
              setStepStatuses((prev) => ({
                ...prev,
                createUserProfileTopic: { status: "idle", disabled: false },
              }));
            }
          } catch (reconnectError) {
            console.error("Reconnection failed:", reconnectError);
          }
        }, 1000);
      }
    }
  };

  /**
   * Initializes user profile (Enhanced with Topic ID Validation)
   * Sends initial profile data to the profile topic
   */
  const handleInitiateUserProfile = async () => {
    clearError();

    // Critical validation: Ensure we have a valid topic ID before proceeding
    if (!userProfileTopicId || userProfileTopicId.trim() === "") {
      console.error(
        "Cannot initiate profile: userProfileTopicId is missing or empty"
      );
      toast.error(
        "Topic ID is missing. Please wait for topic creation to complete."
      );
      setStepStatuses((prev) => ({
        ...prev,
        initiateUserProfileTopic: { status: "error", disabled: false },
      }));
      return;
    }

    // Additional validation: Check if topic ID has valid format (0.0.xxxxx)
    const topicIdPattern = /^0\.0\.\d+$/;
    if (!topicIdPattern.test(userProfileTopicId)) {
      console.error("Invalid topic ID format:", userProfileTopicId);
      toast.error("Invalid topic ID format. Please retry topic creation.");
      setStepStatuses((prev) => ({
        ...prev,
        initiateUserProfileTopic: { status: "error", disabled: false },
        createUserProfileTopic: { status: "idle", disabled: false }, // Allow topic recreation
      }));
      return;
    }

    console.log("Initiating profile with topic ID:", userProfileTopicId);

    setStepStatuses((prev) => ({
      ...prev,
      initiateUserProfileTopic: { status: "loading", disabled: true },
    }));

    const result = await safeAsyncWrapper(
      async () => {
        // V2 Profile format - uses empty strings instead of arrays
        // Arrays are created lazily as separate topics when first needed
        const InitiatingUserProfileMessage = {
          Type: "Profile",
          Name: name,
          Bio: bio,
          Website: website,
          Channels: "",           // V2: Will become topic ID when first channel is created
          Groups: "",             // V2: Will become topic ID when first group is created
          FollowingChannels: "",  // V2: Will become topic ID when first channel is followed
          FollowingGroups: "",    // V2: Will become topic ID when first group is followed
          ExplorerMessages: "",
          BillboardAds: "",
          PrivateMessages: "",    // V2: New field for private messages topic
          Picture: pictureHash,
          Banner: bannerHash,
          ProfileVersion: "2",    // V2: String "2" identifies V2 profiles
        };

        console.log("Sending profile message to topic:", userProfileTopicId);
        console.log("Profile message:", InitiatingUserProfileMessage);

        const initiatingUserProfile = await send(
          userProfileTopicId,
          InitiatingUserProfileMessage,
          ""
        );

        // Check if send returned undefined (user rejection or cancellation)
        if (!initiatingUserProfile) {
          // This indicates user rejection or cancellation, not a technical failure
          console.warn("Profile initiation was cancelled or rejected by user");
          return null; // Return null to indicate cancellation, don't throw error
        }

        // Check the transaction result
        if (
          !(
            initiatingUserProfile as {
              receipt?: { result?: { toString: () => string } };
            }
          )?.receipt?.result?.toString ||
          (
            initiatingUserProfile as {
              receipt: { result: { toString: () => string } };
            }
          ).receipt.result.toString() !== "SUCCESS"
        ) {
          throw new Error(
            "Failed to initiate User Profile - transaction failed"
          );
        }

        return initiatingUserProfile;
      },
      "Profile Initialization",
      (errorMessage) => {
        setStepStatuses((prev) => ({
          ...prev,
          initiateUserProfileTopic: { status: "error", disabled: false },
        }));

        // Enhanced error handling for topic ID issues
        if (errorMessage.includes("failed to parse entity id")) {
          console.error(
            "Topic ID parsing error - invalid topic ID:",
            userProfileTopicId
          );
          toast.error(
            "Invalid topic ID detected. Please retry topic creation."
          );
          // Reset topic creation step to allow retry
          setStepStatuses((prev) => ({
            ...prev,
            createUserProfileTopic: { status: "idle", disabled: false },
            initiateUserProfileTopic: { status: "idle", disabled: true },
          }));
          // Clear the invalid topic ID
          setProfileTopicId("");
          return;
        }

        // Handle network timing issues with auto-retry
        if (
          errorMessage.includes("Query.fromBytes") &&
          autoProgressRef.current
        ) {
          console.log("Auto-retry in 5 seconds due to network timing issue...");
          setTimeout(() => {
            console.log("Retrying initiate profile...");
            handleInitiateUserProfile();
          }, 5000);
          return; // Don't show error toast, we're retrying
        }
      }
    );

    if (result) {
      setStepStatuses((prev) => ({
        ...prev,
        initiateUserProfileTopic: { status: "success", disabled: true },
        associateNFTProfileToken: { status: "idle", disabled: false },
      }));
      toast.success("User Profile initiated successfully.");

      // Auto-progress to next step if enabled
      console.log("Profile initiated, autoProgress:", autoProgressRef.current);
      if (autoProgressRef.current) {
        console.log("Auto-progressing to associate token...");

        // Show countdown
        let timeLeft = 2;
        setCountdown(timeLeft);
        const countdownTimer = setInterval(() => {
          timeLeft -= 1;
          setCountdown(timeLeft);
          if (timeLeft <= 0) {
            clearInterval(countdownTimer);
            setCountdown(0);
          }
        }, 1000);

        setTimeout(() => {
          handleAssociateToken();
        }, 2000); // 2 second delay between steps
      }
    } else if (result === null) {
      // User cancelled/rejected the transaction
      console.log("User cancelled profile initiation");
      setStepStatuses((prev) => ({
        ...prev,
        initiateUserProfileTopic: { status: "error", disabled: false },
      }));

      // Disable auto-progression since user rejected
      setAutoProgress(false);
      autoProgressRef.current = false;
      setCountdown(0);
      setAutoProgressDisabledByError(true);

      toast.warn("Profile initiation cancelled. You can retry manually.");
      return; // Exit early
    }
  };

  /**
   * Associates account with the collection token (Enhanced Context7 Version)
   * Required before minting NFTs from the collection
   * Implements Context7 patterns to prevent DAppSigner Query.fromBytes crashes
   */
  const handleAssociateToken = async () => {
    // Clear any previous component errors
    clearError();

    setStepStatuses((prev) => ({
      ...prev,
      associateNFTProfileToken: { status: "loading", disabled: true },
    }));

    const result = await safeAsyncWrapper(
      async () => {
        if (!signingAccount) {
          throw new Error("Account not connected");
        }
        if (!wallet || !signer) {
          throw new Error("Wallet not connected");
        }

        // Enhanced pre-transaction validation
        console.log("Validating wallet state before token association...");

        // Check if account is already associated (prevent unnecessary transactions)
        try {
          const mirrorNodeBaseUrl =
            process.env.NEXT_PUBLIC_NETWORK === "mainnet"
              ? "https://mainnet.mirrornode.hedera.com"
              : "https://testnet.mirrornode.hedera.com";

          const balanceResponse = await fetch(
            `${mirrorNodeBaseUrl}/api/v1/accounts/${signingAccount}/tokens?token.id=${profileNFTTokenId}`,
            {
              method: "GET",
              headers: {
                Accept: "application/json",
              },
            }
          );

          if (balanceResponse.ok) {
            const balanceData = await balanceResponse.json();
            if (balanceData.tokens && balanceData.tokens.length > 0) {
              console.log("Token already associated, skipping transaction");
              return {
                result: {
                  toString: () => "TOKEN_ALREADY_ASSOCIATED_TO_ACCOUNT",
                },
              };
            }
          }
        } catch (checkError) {
          console.log(
            "Association check failed, proceeding with transaction:",
            checkError
          );
          // Continue with association if check fails
        }

        // Create association transaction with enhanced error handling
        const associateTransaction = new TokenAssociateTransaction()
          .setAccountId(signingAccount)
          .setTokenIds([profileNFTTokenId]);

        // Execute using centralized transaction executor
        console.log("Executing association transaction via centralized executor...");
        const txResult = await executeTransaction({
          transaction: associateTransaction,
          signer,
          watch: watch as WatchFunction,
        });

        if (txResult.success) {
          return txResult.receipt;
        } else if (txResult.error) {
          // Show appropriate toast based on error type
          const toastType = getToastTypeForError(txResult.error.type);
          if (toastType === "warn") {
            throw new Error("USER_REJECT");
          }
          throw new Error(txResult.error.message);
        }
        throw new Error("Token association failed: Unknown result");
      },
      "Token Association",
      (errorMessage) => {
        // Custom error handling for this specific operation
        setStepStatuses((prev) => ({
          ...prev,
          associateNFTProfileToken: { status: "error", disabled: false },
        }));

        // Handle special cases
        if (errorMessage.includes("TOKEN_ALREADY_ASSOCIATED_TO_ACCOUNT")) {
          // Treat as success
          setTimeout(() => {
            setStepStatuses((prev) => ({
              ...prev,
              associateNFTProfileToken: { status: "success", disabled: true },
              mintTransferFreezeNFT: { status: "idle", disabled: false },
            }));
            if (autoProgressRef.current) {
              setTimeout(() => {
                handleMintTransferFreezeNFT();
              }, 2000);
            }
          }, 500);
          toast.success("Token already associated. Continuing...");
        } else if (errorMessage.includes("wallet may be disconnected")) {
          // Offer to reconnect wallet
          toast.error(
            "Wallet connection issue detected. Attempting to reconnect..."
          );
          setTimeout(async () => {
            const reconnected = await reconnectWallet();
            if (reconnected) {
              toast.info(
                "Wallet reconnected. Please try the token association again."
              );
              setStepStatuses((prev) => ({
                ...prev,
                associateNFTProfileToken: { status: "idle", disabled: false },
              }));
            }
          }, 1000);
        }
      }
    );

    // Handle successful result
    if (result) {
      setStepStatuses((prev) => ({
        ...prev,
        associateNFTProfileToken: { status: "success", disabled: true },
        mintTransferFreezeNFT: { status: "idle", disabled: false },
      }));
      toast.success("Token association completed successfully.");

      // Auto-progress to next step if enabled
      if (autoProgressRef.current) {
        console.log("Auto-progressing to mint NFT...");
        setTimeout(() => {
          handleMintTransferFreezeNFT();
        }, 2000);
      }
    }
  };

  /**
   * Mints, transfers, and freezes profile NFT in a single operation (Enhanced Context7 Version)
   * Final step in profile creation process using contract function
   * Implements Context7 error prevention patterns
   */
  const handleMintTransferFreezeNFT = async () => {
    clearError();

    setStepStatuses((prev) => ({
      ...prev,
      mintTransferFreezeNFT: { status: "loading", disabled: true },
    }));

    const result = await safeAsyncWrapper(
      async () => {
        // Enhanced pre-validation
        if (!wallet || !signer) {
          throw new Error("Wallet not connected");
        }
        if (!signingAccount) {
          throw new Error("Account not connected");
        }
        if (!contractId) {
          throw new Error("Contract ID not set");
        }
        if (!userProfileTopicId) {
          throw new Error("Profile topic not created yet");
        }

        console.log("Pre-validating wallet state for NFT minting...");

        // Prepare metadata with profile topic ID
        const metadata = userProfileTopicId;

        // Create contract execution transaction for mintTransferAndFreeze
        const mintTransferFreezeTransaction = new ContractExecuteTransaction()
          .setContractId(contractId)
          .setGas(10000000)
          .setMaxTransactionFee(new Hbar(2))
          .setPayableAmount(mintFeeHBAR) // Pay the mint fee
          .setFunction(
            "mintTransferAndFreeze",
            new ContractFunctionParameters().addBytesArray([
              Buffer.from(metadata),
            ])
          );

        // Execute using centralized transaction executor
        console.log("Executing mint transaction via centralized executor...");
        const txResult = await executeTransaction({
          transaction: mintTransferFreezeTransaction,
          signer,
          watch: watch as WatchFunction,
          timeoutMs: 90_000, // 90 seconds for contract execution
        });

        if (txResult.success) {
          return txResult.receipt;
        } else if (txResult.error) {
          const toastType = getToastTypeForError(txResult.error.type);
          if (toastType === "warn") {
            throw new Error("USER_REJECT");
          }
          throw new Error(txResult.error.message);
        }
        throw new Error("NFT minting failed: Unknown result");
      },
      "NFT Minting",
      (errorMessage) => {
        setStepStatuses((prev) => ({
          ...prev,
          mintTransferFreezeNFT: { status: "error", disabled: false },
        }));

        // Context7 enhanced error recovery for minting
        if (
          errorMessage.includes("wallet connection issue") ||
          errorMessage.includes("Query.fromBytes")
        ) {
          toast.error(
            "Wallet connection issue during minting. Attempting to reconnect..."
          );
          setTimeout(async () => {
            const reconnected = await reconnectWallet();
            if (reconnected) {
              toast.info("Wallet reconnected. Please try minting again.");
              setStepStatuses((prev) => ({
                ...prev,
                mintTransferFreezeNFT: { status: "idle", disabled: false },
              }));
            }
          }, 1000);
        }
      }
    );

    if (result) {
      // Get the serial number from the contract function result if available
      let serialNumber = "N/A";
      try {
        const contractResult = result as {
          contractFunctionResult?: {
            getInt64: (index: number) => { toString: () => string };
          };
        };
        if (contractResult.contractFunctionResult) {
          serialNumber = contractResult.contractFunctionResult
            .getInt64(0)
            .toString();
        }
      } catch {
        console.log("Could not extract serial number from result");
      }

      setStepStatuses((prev) => ({
        ...prev,
        mintTransferFreezeNFT: { status: "success", disabled: true },
      }));

      toast.success(
        `Profile NFT minted successfully! You are USER: ${serialNumber}`
      );
      onClose();
      await new Promise((resolve) => setTimeout(resolve, 2000));
      triggerRefresh();
    }
  };

  // ========================================================================
  // UI RENDERING HELPER FUNCTIONS
  // ========================================================================

  /**
   * Renders a step with status indicators and action button
   * Used in the processing steps view
   */
  const renderStepButton = (
    step: keyof ProfileStepStatuses,
    label: string,
    handler: () => void
  ) => {
    const status = stepStatuses[step];
    if (!status) return null;

    return (
      <div
        className="flex justify-between items-center p-4 rounded-lg transition-all duration-200 border border-cyan-400/20 shadow-lg shadow-cyan-400/5 bg-slate-800/20"
        key={step}
      >
        {/* Left side - Step information (NOT a button) */}
        <div className="flex-1 pr-4">
          <div className="flex items-center gap-2 mb-1">
            {/* Status icon */}
            <div
              className={`w-2 h-2 rounded-full ${
                status.status === "success"
                  ? "bg-green-400"
                  : status.status === "error"
                  ? "bg-red-400"
                  : status.status === "loading"
                  ? "bg-cyan-400 animate-pulse"
                  : status.disabled
                  ? "bg-gray-500"
                  : "bg-cyan-400"
              }`}
            />

            {/* Step label - Plain text, not a button */}
            <h3
              className={`text-base font-medium font-mono ${
                status.status === "success"
                  ? "text-green-400"
                  : status.status === "error"
                  ? "text-red-400"
                  : status.disabled
                  ? "text-gray-500"
                  : "text-white"
              }`}
            >
              {label}
            </h3>
          </div>

          {/* Status messages */}
          {status.status === "error" && (
            <p className="text-sm text-red-400/80 font-light">
              Failed. Please try again.
            </p>
          )}
          {status.status === "loading" && (
            <p className="text-sm text-cyan-400/80 font-light animate-pulse">
              {autoProgressRef.current &&
              step === "initiateUserProfileTopic" &&
              stepStatuses.createUserProfileTopic?.status === "success"
                ? "Waiting for network propagation..."
                : "Processing..."}
            </p>
          )}
          {status.status === "success" &&
            autoProgressRef.current &&
            countdown > 0 && (
              <p className="text-sm text-green-400/80 font-light">
                Next step in {countdown}s...
              </p>
            )}
          {status.status === "success" && countdown === 0 && (
            <p className="text-sm text-green-400/80 font-light">
              Completed successfully
            </p>
          )}
        </div>

        {/* Right side - Action button */}
        <div className="flex-shrink-0">
          <button
            onClick={handler}
            disabled={status.disabled || status.status === "loading"}
            className={`px-6 py-2 rounded-lg transition-all duration-200 font-medium min-w-[100px] font-mono
                      flex items-center justify-center shadow-lg ${
                        status.status === "success"
                          ? "bg-green-500 text-white shadow-green-500/25 cursor-default"
                          : status.status === "loading"
                          ? "bg-slate-700 text-white animate-pulse cursor-not-allowed"
                          : status.status === "error"
                          ? "bg-red-500 hover:bg-red-400 text-white shadow-red-500/25"
                          : status.disabled
                          ? "bg-gray-600 text-gray-400 cursor-not-allowed"
                          : "bg-gradient-to-r from-cyan-400 to-blue-500 hover:scale-105 text-white shadow-cyan-400/25"
                      }`}
          >
            {status.status === "loading" ? (
              <span className="text-sm">Processing...</span>
            ) : status.status === "success" ? (
              <>
                <RiCheckLine className="mr-1.5" />
                <span className="text-sm">Done</span>
              </>
            ) : status.status === "error" ? (
              <>
                <RiRefreshLine className="mr-1.5" />
                <span className="text-sm">Retry</span>
              </>
            ) : autoProgressRef.current && !status.disabled ? (
              <>
                <div className="w-2 h-2 bg-white rounded-full animate-pulse mr-1.5" />
                <span className="text-sm">Auto</span>
              </>
            ) : (
              <span className="text-sm">Start</span>
            )}
          </button>
        </div>
      </div>
    );
  };

  /**
   * Renders the processing steps view
   * Shows progress of profile creation steps
   */
  const renderProcessingSteps = () => (
    <div className="p-4 h-[80vh] flex flex-col">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-2xl font-mono text-cyan-400">
            Creating Your Profile
          </h1>
        </div>

        {/* Auto-progress toggle - Moved below title */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-white/60 font-mono">Auto-progress</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const newAutoProgress = !autoProgress;
                console.log(
                  "Toggling auto-progress from",
                  autoProgress,
                  "to",
                  newAutoProgress
                );
                setAutoProgress(newAutoProgress);
                autoProgressRef.current = newAutoProgress; // Keep ref in sync

                // If enabling auto-progress, check if there's a pending step to start
                if (newAutoProgress) {
                  // First check if wallet is connected before allowing auto-progress
                  if (!wallet || !signer || !accountId) {
                    console.log("Auto-progress disabled: wallet not connected");
                    setAutoProgress(false);
                    autoProgressRef.current = false;
                    toast.warning(
                      "Please connect your wallet before enabling auto-progress"
                    );
                    return;
                  }

                  console.log(
                    "Auto-progress enabled, checking for pending steps..."
                  );
                  console.log("Current step statuses:", stepStatuses);

                  // Find the first available step in proper order
                  const stepOrder = [
                    "uploadPicture",
                    "uploadBanner",
                    "createUserProfileTopic",
                    "initiateUserProfileTopic",
                    "associateNFTProfileToken",
                    "mintTransferFreezeNFT",
                  ];

                  const nextStep = stepOrder.find((stepName) => {
                    const status =
                      stepStatuses[stepName as keyof ProfileStepStatuses];
                    return (
                      status && status.status === "idle" && !status.disabled
                    );
                  });

                  console.log(
                    "Found next step for auto-progression:",
                    nextStep
                  );
                  if (nextStep) {
                    console.log("Auto-starting step:", nextStep);
                    setTimeout(() => {
                      switch (nextStep) {
                        case "uploadPicture":
                          console.log(
                            "Auto-progression: Starting image upload..."
                          );
                          handleUploadPicture().catch((error) => {
                            console.error("Auto-upload error:", error);
                            disableAutoProgression("Upload error");
                          });
                          break;
                        case "uploadBanner":
                          console.log(
                            "Auto-progression: Starting banner upload..."
                          );
                          handleUploadBanner().catch((error) => {
                            console.error("Auto-banner upload error:", error);
                            disableAutoProgression("Banner upload error");
                          });
                          break;
                        case "createUserProfileTopic":
                          console.log("Auto-progression: Creating topic...");
                          // Ensure all required uploads are complete
                          const pictureReady = !picture || (pictureHash && pictureHash.trim() !== "");
                          const bannerReady = !banner || (bannerHash && bannerHash.trim() !== "");
                          
                          if (!pictureReady) {
                            console.log(
                              "Waiting for picture upload to complete..."
                            );
                            toast.info(
                              "Waiting for image upload to complete..."
                            );
                            return;
                          }
                          
                          if (!bannerReady) {
                            console.log(
                              "Waiting for banner upload to complete..."
                            );
                            toast.info(
                              "Waiting for banner upload to complete..."
                            );
                            return;
                          }
                          
                          handleCreateUserProfileTopic().catch((error) => {
                            console.error("Auto-create topic error:", error);
                            disableAutoProgression("Topic creation error");
                          });
                          break;
                        case "initiateUserProfileTopic":
                          console.log(
                            "Auto-progression: Initiating profile..."
                          );
                          // Ensure we have topic ID from previous step
                          if (!userProfileTopicId) {
                            console.log(
                              "Waiting for topic creation to complete..."
                            );
                            toast.info(
                              "Waiting for topic creation to complete..."
                            );
                            return;
                          }
                          handleInitiateUserProfile().catch((error) => {
                            console.error(
                              "Auto-initiate profile error:",
                              error
                            );
                            disableAutoProgression("Profile initiation error");
                          });
                          break;
                        case "associateNFTProfileToken":
                          console.log("Auto-progression: Associating token...");
                          handleAssociateToken().catch((error) => {
                            console.error("Auto-associate token error:", error);
                            disableAutoProgression("Token association error");
                          });
                          break;
                        case "mintTransferFreezeNFT":
                          console.log("Auto-progression: Minting NFT...");
                          // Ensure we have topic ID for metadata
                          if (!userProfileTopicId) {
                            console.log(
                              "Waiting for profile setup to complete..."
                            );
                            toast.info(
                              "Waiting for profile setup to complete..."
                            );
                            return;
                          }
                          handleMintTransferFreezeNFT().catch((error) => {
                            console.error("Auto-mint NFT error:", error);
                            disableAutoProgression("NFT minting error");
                          });
                          break;
                        default:
                          console.warn(
                            "Unknown step for auto-progression:",
                            nextStep
                          );
                      }
                    }, 500);
                  } else {
                    console.log("No available steps for auto-progression");
                  }
                }
              }}
              disabled={autoProgressDisabledByError}
              className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${
                autoProgress ? "bg-cyan-500" : "bg-slate-600"
              } ${
                autoProgressDisabledByError
                  ? "opacity-50 cursor-not-allowed"
                  : ""
              }`}
            >
              <div
                className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${
                  autoProgress ? "translate-x-5" : "translate-x-0.5"
                }`}
              />
            </button>
            {/* Status indicator */}
            <span
              className={`text-xs font-mono px-2 py-1 rounded ${
                autoProgress
                  ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30"
                  : "bg-slate-600/20 text-slate-400 border border-slate-600/30"
              }`}
            >
              {autoProgress ? "ON" : "OFF"}
            </span>
            {/* Reset button when auto-progression is disabled by error */}
            {autoProgressDisabledByError && (
              <button
                onClick={resetAutoProgression}
                className="text-xs font-mono px-2 py-1 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30 hover:bg-amber-500/30 transition-colors duration-200"
                title="Reset and automatically retry the failed step"
              >
                Retry
              </button>
            )}
          </div>
        </div>
        {/* Show explanation when auto-progression is disabled */}
        {autoProgressDisabledByError && (
          <div className="text-xs text-amber-400/80 font-mono mt-1">
            Auto-progression disabled due to error/rejection. Click
            &quot;Retry&quot; to restart.
          </div>
        )}
      </div>

      {/* Profile Information Preview - Compact */}
      <div className="mb-4 p-3 bg-slate-800/80 backdrop-blur-md rounded-xl border border-cyan-400/30 shadow-lg shadow-cyan-400/10 flex-shrink-0">
        <div className="flex items-center gap-3 mb-2">
          {picturePreview && (
            <div className="w-12 h-12 rounded-full overflow-hidden flex-shrink-0 ring-2 ring-cyan-400/30">
              <img
                src={picturePreview}
                alt="Profile"
                className="w-full h-full object-cover"
              />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-mono font-bold text-white truncate bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
              {name}
            </h2>
          </div>
        </div>
        {bio && (
          <p className="text-white/80 break-words text-sm leading-relaxed font-light line-clamp-2">
            {bio}
          </p>
        )}
        {website && (
          <a
            href={website.startsWith("http") ? website : `https://${website}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-cyan-400 hover:text-cyan-300 text-xs mt-1 block transition-colors duration-200 font-light truncate"
          >
            {website}
          </a>
        )}
      </div>

      {/* Processing Steps - Scrollable */}
      <div className="flex-1 space-y-3 overflow-y-auto">
        {picture &&
          renderStepButton(
            "uploadPicture",
            "Upload Profile Picture",
            handleUploadPicture
          )}

        {banner &&
          renderStepButton(
            "uploadBanner",
            "Upload Banner Image",
            handleUploadBanner
          )}

        {renderStepButton(
          "createUserProfileTopic",
          "Create User Profile Topic",
          handleCreateUserProfileTopic
        )}
        {renderStepButton(
          "initiateUserProfileTopic",
          "Initiate User Profile",
          handleInitiateUserProfile
        )}
        {renderStepButton(
          "associateNFTProfileToken",
          "Associate NFT Profile Token",
          handleAssociateToken
        )}
        {renderStepButton(
          "mintTransferFreezeNFT",
          "Mint Profile NFT",
          handleMintTransferFreezeNFT
        )}
        <button
          onClick={onClose}
          className="w-full bg-slate-800 hover:bg-red-500/20 text-white py-2 mt-3 px-4 rounded-full border border-cyan-400/50 hover:border-red-400/50 transition-all duration-200 font-mono"
        >
          Cancel
        </button>
      </div>
    </div>
  );

  /**
   * Renders the edit form view
   * Initial form for collecting user information
   */
  const renderEditForm = () => (
    <div className="flex flex-col h-[80vh] bg-slate-900/80 backdrop-blur-md rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-cyan-400/50 flex-shrink-0">
        <h3 className="text-2xl font-mono text-cyan-400 bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
          Create Profile
        </h3>
        <p className="text-sm text-white/60 mt-1 font-light">
          Fill in your profile details to get started
        </p>
      </div>

      {/* Scrollable Content Area */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 space-y-6">
          {/* Banner Section */}
          <div className="space-y-4">
            <label className="block text-sm font-medium text-white/80 mb-1.5 font-mono">
              Banner Image
            </label>
            <div className="flex flex-col items-center">
              {bannerPreview ? (
                <>
                  {/* Banner Preview */}
                  <div className="w-full max-w-md h-32 rounded-xl overflow-hidden bg-slate-800/50 mb-3 ring-2 ring-cyan-400/30">
                    <img
                      src={bannerPreview}
                      alt="Banner Preview"
                      className="w-full h-full object-cover"
                    />
                  </div>

                  {/* Banner Controls */}
                  <div className="flex gap-2 justify-center">
                    <label
                      htmlFor="bannerUpload"
                      className="w-8 h-8 flex items-center justify-center rounded-full
                        bg-gradient-to-r from-cyan-400 to-blue-500 hover:scale-110 text-white cursor-pointer
                        transition-all duration-200 shadow-lg shadow-cyan-400/25"
                      title="Change Banner"
                    >
                      <MdOutlinePermMedia className="text-sm" />
                    </label>
                    <button
                      onClick={clearBanner}
                      className="w-8 h-8 flex items-center justify-center rounded-full
                        bg-red-500/20 hover:bg-red-500 text-red-400 hover:text-white
                        transition-all duration-200"
                      title="Remove Banner"
                    >
                      <RiDeleteBinLine className="text-sm" />
                    </button>
                  </div>
                </>
              ) : (
                // Upload new banner button
                <label
                  htmlFor="bannerUpload"
                  className="flex flex-col items-center gap-2 p-4 cursor-pointer rounded-xl
                    border-2 border-dashed border-cyan-400/50 hover:border-cyan-400
                    transition-all duration-200 w-full hover:bg-cyan-400/5"
                >
                  <div className="w-12 h-12 rounded-full bg-cyan-400/10 flex items-center justify-center">
                    <MdOutlinePermMedia className="text-2xl text-cyan-400" />
                  </div>
                  <div className="text-center">
                    <p className="font-medium text-white text-sm">
                      Add Banner Image
                    </p>
                    <p className="text-xs text-white/50">
                      16:9 ratio recommended, up to 100MB
                    </p>
                  </div>
                </label>
              )}
            </div>

            {/* Hidden banner input */}
            <input
              type="file"
              id="bannerUpload"
              ref={bannerInputRef}
              className="hidden"
              accept="image/*"
              onChange={handleBannerChange}
            />
          </div>

          {/* Profile Picture Section */}
          <div className="space-y-4">
            <div className="flex flex-col items-center">
              {picturePreview ? (
                <>
                  {/* Image Preview - Smaller and more compact */}
                  <div className="w-20 h-20 rounded-full overflow-hidden bg-secondary mb-3 ring-2 ring-cyan-400/30">
                    <img
                      src={picturePreview}
                      alt="Profile Preview"
                      className="w-full h-full object-cover"
                    />
                  </div>

                  {/* Controls - More compact */}
                  <div className="flex gap-2 justify-center">
                    <label
                      htmlFor="pictureUpload"
                      className="w-8 h-8 flex items-center justify-center rounded-full
                        bg-gradient-to-r from-cyan-400 to-blue-500 hover:scale-110 text-white cursor-pointer
                        transition-all duration-200 shadow-lg shadow-cyan-400/25"
                      title="Change Picture"
                    >
                      <MdOutlinePermMedia className="text-sm" />
                    </label>
                    <button
                      onClick={clearPicture}
                      className="w-8 h-8 flex items-center justify-center rounded-full
                        bg-red-500/20 hover:bg-red-500 text-red-400 hover:text-white
                        transition-all duration-200"
                      title="Remove Picture"
                    >
                      <RiDeleteBinLine className="text-sm" />
                    </button>
                  </div>
                </>
              ) : (
                // Upload new picture button - More compact
                <label
                  htmlFor="pictureUpload"
                  className="flex flex-col items-center gap-2 p-4 cursor-pointer rounded-xl
                    border-2 border-dashed border-cyan-400/50 hover:border-cyan-400
                    transition-all duration-200 w-full max-w-[240px] hover:bg-cyan-400/5"
                >
                  <div className="w-12 h-12 rounded-full bg-cyan-400/10 flex items-center justify-center">
                    <MdOutlinePermMedia className="text-2xl text-cyan-400" />
                  </div>
                  <div className="text-center">
                    <p className="font-medium text-white text-sm">
                      Add Profile Picture
                    </p>
                    <p className="text-xs text-white/50">Up to 100MB</p>
                  </div>
                </label>
              )}
            </div>

            {/* Hidden file input */}
            <input
              type="file"
              id="pictureUpload"
              ref={fileInputRef}
              className="hidden"
              accept="image/*"
              onChange={handlePictureChange}
            />
          </div>

          {/* Form Fields */}
          <div className="space-y-4">
            {/* Name Input */}
            <div>
              <label className="block text-sm font-medium text-white/80 mb-1.5 font-mono">
                Name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={`w-full px-4 py-2.5 rounded-lg bg-slate-800/80 backdrop-blur-sm text-white font-light
                  border-2 transition-all duration-200 outline-none ${
                    name.trim()
                      ? "border-green-400/50 focus:border-green-400 shadow-lg shadow-green-400/10"
                      : "border-cyan-400/50 focus:border-cyan-400 shadow-lg shadow-cyan-400/10"
                  }`}
                placeholder="Your display name"
                maxLength={nameMaxLength}
              />
              <div className="mt-1 flex items-center justify-between">
                <span className="text-xs text-white/50 font-light">
                  Max {nameMaxLength} characters
                </span>
                <span className="text-xs text-white/50 font-mono">
                  {name.length}/{nameMaxLength}
                </span>
              </div>
              {name.trim() && (
                <p className="text-xs text-green-400 mt-1 flex items-center gap-1 font-light">
                  <RiCheckLine className="text-sm" />
                  Name looks good!
                </p>
              )}
            </div>

            {/* Bio Input - Updated with emoji picker */}
            <div>
              <label className="block text-sm font-medium text-white/80 mb-1.5 font-mono">
                Bio
              </label>
              <div className="relative">
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg bg-slate-800/80 backdrop-blur-sm text-white font-light
                    border-2 border-cyan-400/50 focus:border-cyan-400 transition-all
                    duration-200 outline-none resize-none min-h-[100px] shadow-lg shadow-cyan-400/10"
                  placeholder="About yourself"
                  rows={4}
                  maxLength={bioMaxLength}
                />
                <button
                  onClick={() => setShowEmojiPicker(true)}
                  className="absolute right-2 bottom-2 p-2 rounded-full
                    hover:bg-cyan-400/10 text-white/60 hover:text-cyan-400
                    transition-colors duration-200"
                >
                  😊
                </button>
              </div>
              <div className="mt-1 flex items-center justify-between">
                <span className="text-xs text-white/50 font-light">
                  Max {bioMaxLength} characters
                </span>
                <span className="text-xs text-white/50 font-mono">
                  {bio.length}/{bioMaxLength}
                </span>
              </div>
            </div>

            {/* Website Input */}
            <div>
              <label className="block text-sm font-medium text-white/80 mb-1.5 font-mono">
                Website
              </label>
              <input
                type="text"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg bg-slate-800/80 backdrop-blur-sm text-white font-light
                  border-2 border-cyan-400/50 focus:border-cyan-400 transition-all
                  duration-200 outline-none shadow-lg shadow-cyan-400/10"
                placeholder="Your website URL"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Image Cropper Modal using common Modal component */}
      <ImageCropModal
        isOpen={showCropper}
        onClose={() => {
          setShowCropper(false);
          setTempImage(null);
          if (fileInputRef.current) {
            fileInputRef.current.value = "";
          }
        }}
        tempImage={tempImage || ""}
        onCropComplete={handleImageCropComplete}
      />

      {/* Banner Cropper Modal */}
      <ImageCropModal
        isOpen={showBannerCropper}
        onClose={() => {
          setShowBannerCropper(false);
          setTempBannerImage(null);
          if (bannerInputRef.current) {
            bannerInputRef.current.value = "";
          }
        }}
        tempImage={tempBannerImage || ""}
        onCropComplete={handleBannerCropComplete}
        aspectRatio={3}
        cropShape="rect"
        title="Crop Banner Image"
        description="Drag to move • Scroll to zoom • Twitter-like 3:1 ratio for optimal banner display"
      />

      {/* Wallet Connection Status */}
      {(!wallet || !signer || !accountId) && (
        <div className="px-6 py-3 bg-amber-500/10 border-t border-amber-500/30">
          <div className="flex items-center gap-2 text-amber-400">
            <div className="w-2 h-2 bg-amber-400 rounded-full animate-pulse" />
            <span className="text-sm font-mono">
              Please connect your wallet to create a profile
            </span>
          </div>
        </div>
      )}

      {/* Bottom Controls */}
      <div className="border-t border-cyan-400/50 bg-slate-900/95 backdrop-blur-sm">
        <div className="px-6 py-4">
          <button
            onClick={() => handleStartProfileCreation()}
            disabled={!name.trim() || !wallet || !signer || !accountId}
            className={`w-full px-8 py-2.5 font-semibold rounded-full transition-all
              duration-200 hover:shadow-lg active:scale-98 flex items-center justify-center gap-2 font-mono ${
                !name.trim() || !wallet || !signer || !accountId
                  ? "bg-gray-600 text-gray-400 cursor-not-allowed"
                  : "bg-gradient-to-r from-cyan-400 to-blue-500 hover:scale-105 text-white shadow-lg shadow-cyan-400/25"
              }`}
          >
            {name.trim() && wallet && signer && accountId && (
              <RiCheckLine className="text-lg" />
            )}
            {!wallet || !signer || !accountId ? "Connect Wallet" : "Create"}
          </button>
        </div>
      </div>

      {/* Add EmojiPickerPopup */}
      {showEmojiPicker && (
        <EmojiPickerPopup
          onEmojiClick={onEmojiClick}
          onClose={() => setShowEmojiPicker(false)}
        />
      )}
    </div>
  );

  // ========================================================================
  // MAIN COMPONENT RENDER
  // ========================================================================

  // If there's an unhandled error or component error, show error state
  if (hasError || componentError) {
    const displayError = componentError || errorMessage;
    return (
      <div className="max-w-md w-full mx-auto bg-slate-900/80 backdrop-blur-md rounded-2xl border border-red-400/50 text-white p-6">
        <div className="text-center">
          <h3 className="text-xl font-mono text-red-400 mb-4">
            Profile Creation Error
          </h3>
          <p className="text-white/80 mb-6 font-light">{displayError}</p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => {
                setHasError(false);
                setErrorMessage("");
                clearError();
              }}
              className="px-6 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white transition-colors duration-200 font-mono"
            >
              Try Again
            </button>
            <button
              onClick={onClose}
              className="px-6 py-2 rounded-lg bg-red-500 hover:bg-red-400 text-white transition-colors duration-200 font-mono"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Main component render
  return (
    <ProfileCreationErrorBoundary
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      onError={(_error) => {
        console.log("Error boundary triggered, disabling auto-progression");
        setAutoProgress(false);
        autoProgressRef.current = false;
        setCountdown(0);
        setAutoProgressDisabledByError(true);
      }}
    >
      <div className="max-w-md w-full mx-auto bg-slate-900/80 backdrop-blur-md rounded-2xl border border-cyan-400/50 text-white">
        {isEditing ? renderEditForm() : renderProcessingSteps()}
      </div>
    </ProfileCreationErrorBoundary>
  );
};

// ============================================================================
// EXPORT
// ============================================================================

export default CreateNewProfile;
