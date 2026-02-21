import React, { useEffect, useState, useRef } from "react";
import Modal from "../common/modal";
import { useAccountId } from "@buidlerlabs/hashgraph-react-wallets";
import { useWalletContext } from "../wallet/WalletContext";
import useSendMessage from "../hooks/use_send_message";
import { FiShare2 } from "react-icons/fi";
import Tip from "../tip/tip";
import { BsCurrencyDollar, BsEmojiSmile } from "react-icons/bs";
import ConnectModal from "../wallet/ConnectModal";
import {
  AiOutlineLike,
  AiOutlineDislike,
  AiOutlineMessage,
} from "react-icons/ai";
import { FiHash } from "react-icons/fi";
import { toast } from "react-toastify";
import { RiCheckLine, RiRefreshLine, RiDeleteBinLine } from "react-icons/ri";
import { MdOutlinePermMedia } from "react-icons/md";
import useUploadToArweave from "../media/use_upload_to_arweave";
import { useRefreshTrigger } from "../hooks/use_refresh_trigger";
import EmojiPickerPopup from "../common/EmojiPickerPopup";

/**
 * Formats a number to a more readable format (e.g., 1000 -> 1K, 1500 -> 1.5K, 1000000 -> 1M)
 * @param {number} num - The number to format
 * @returns {string} The formatted number as a string
 */
const formatNumber = (num: number): string => {
  if (num === 0) return "0";

  if (num >= 1000000) {
    return (num / 1000000).toFixed(num % 1000000 < 100000 ? 0 : 1) + "M";
  } else if (num >= 1000) {
    return (num / 1000).toFixed(num % 1000 < 100 ? 0 : 1) + "K";
  }

  return num.toString();
};

/**
 * Interface for the core properties required by the Replay component
 * @interface ReplayProps
 * @property {number} sequenceNumber - The sequence number of the message being replied to
 * @property {string} topicId - The unique identifier for the topic/thread
 * @property {string | null | undefined} author - The author of the original message
 * @property {string} message_id - Unique identifier for the message
 * @property {string} [className] - Optional CSS class name for styling
 */
interface ReplayProps {
  sequenceNumber: number;
  topicId: string;
  author?: string | null | undefined;
  message_id: string;
  className?: string;
  likesCount?: number;
  dislikesCount?: number;
  isComment?: boolean; // NEW: Indicates if this is for a comment
  userReaction?: "like" | "dislike" | null;
}

/**
 * Interface for transaction receipt
 */
interface TransactionReceipt {
  result: {
    toString(): string;
  };
}

/**
 * Interface defining the status of a processing step
 * @interface StepStatus
 * @property {('idle' | 'loading' | 'success' | 'error')} status - Current state of the step
 * @property {boolean} disabled - Whether the step is currently disabled
 */
interface StepStatus {
  status: "idle" | "loading" | "success" | "error";
  disabled: boolean;
}

/**
 * Interface tracking the status of reply-related steps
 * @interface ReplyStepStatuses
 * @property {StepStatus} [arweave] - Status of Arweave media upload (optional)
 * @property {StepStatus} reply - Status of the reply submission
 */
interface ReplyStepStatuses {
  arweave?: StepStatus;
  reply: StepStatus;
}

/**
 * Replay Component - Handles user interactions for replying to messages
 * Provides functionality for:
 * - Liking/Unliking messages
 * - Replying with text and media
 * - Tipping authors
 * - Sharing messages
 *
 * @component
 * @param {ReplayProps} props - Component properties
 */
const Replay: React.FC<ReplayProps> = ({
  sequenceNumber,
  topicId,
  author,
  message_id,
  likesCount,
  dislikesCount,
  isComment = false, // NEW: Default to false (thread/post)
  userReaction = null,
}) => {
  const { send } = useSendMessage();
  const { isConnected } = useWalletContext();
  const { data: accountId } = useAccountId();

  const normalizedReaction = userReaction ?? null;
  const hasReacted =
    normalizedReaction === "like" || normalizedReaction === "dislike";
  const hasLiked = normalizedReaction === "like";
  const hasDisliked = normalizedReaction === "dislike";
  const reactionTarget = isComment ? "this comment" : "this message";
  const reactionToast = hasLiked
    ? `You already liked ${reactionTarget}.`
    : `You already disliked ${reactionTarget}.`;
  const likedButtonClass = hasLiked
    ? "bg-green-500/20 from-green-500/20 to-green-500/20 text-green-400 border-green-400/50 shadow-green-500/20"
    : "";
  const dislikedButtonClass = hasDisliked
    ? "bg-red-500/20 from-red-500/20 to-red-500/20 text-red-400 border-red-400/50 shadow-red-500/20"
    : "";
  const likeTitle = hasReacted
    ? hasLiked
      ? `You already liked ${reactionTarget}`
      : `You already disliked ${reactionTarget}`
    : `Like ${reactionTarget}`;
  const dislikeTitle = hasReacted
    ? hasLiked
      ? `You already liked ${reactionTarget}`
      : `You already disliked ${reactionTarget}`
    : `Dislike ${reactionTarget}`;

  const [replyContent, setReplyContent] = useState<string>("");
  const [showReplyModal, setShowReplyModal] = useState<boolean>(false);

  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);

  const [isTipModalOpen, setIsTipModalOpen] = useState(false);

  const [file, setFile] = useState<File | null>(null);
  const { uploadToArweave } = useUploadToArweave();
  const [uploadedMediaId, setUploadedMediaId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(true);
  const { triggerRefresh } = useRefreshTrigger();
  // State for step statuses
  const [stepStatuses, setStepStatuses] = useState<ReplyStepStatuses>({
    arweave: file ? { status: "idle", disabled: false } : undefined,
    reply: { status: "idle", disabled: file ? true : false },
  });

  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  // Auto-progression states
  const [autoProgress, setAutoProgress] = useState(false);
  const autoProgressRef = useRef(false);
  const [autoProgressDisabledByError, setAutoProgressDisabledByError] =
    useState(false);

  useEffect(() => {
    if (isConnected) {
      setIsConnectModalOpen(false);
    }
  }, [isConnected]);

  // Monitor step changes for auto-progression
  useEffect(() => {
    if (!autoProgressRef.current) return;

    // Check if arweave step completed and reply should start
    if (
      stepStatuses.arweave?.status === "success" &&
      stepStatuses.reply?.status === "idle" &&
      !stepStatuses.reply?.disabled
    ) {
      console.log("Auto-progressing to reply...");
      setTimeout(() => {
        handleReply();
      }, 1000);
    }
  }, [stepStatuses, file]);

  const openConnectModal = () => {
    setIsConnectModalOpen(true);
  };

  const closeConnectModal = () => {
    setIsConnectModalOpen(false);
  };

  const openTipModal = () => {
    setIsTipModalOpen(true);
  };
  const closeTipModal = () => {
    setIsTipModalOpen(false);
  };

  /**
   * Utility function to safely disable auto-progression
   */
  const disableAutoProgression = (reason: string) => {
    console.log(`Disabling auto-progression: ${reason}`);
    setAutoProgress(false);
    autoProgressRef.current = false;
    setAutoProgressDisabledByError(true);
  };

  /**
   * Utility function to reset auto-progression after errors
   */
  const resetAutoProgression = () => {
    console.log(
      "Resetting auto-progression and automatically starting next step"
    );

    // Reset the disabled state
    setAutoProgressDisabledByError(false);

    // Enable auto-progression
    setAutoProgress(true);
    autoProgressRef.current = true;

    // Find the first available step to start
    const stepOrder = file ? ["arweave", "reply"] : ["reply"];

    const nextStep = stepOrder.find((stepName) => {
      const status = stepStatuses[stepName as keyof typeof stepStatuses];
      return status && status.status === "error" && !status.disabled;
    });

    console.log("Found failed step to retry:", nextStep);

    if (nextStep) {
      toast.info(`Auto-progression reset. Retrying ${nextStep}...`);

      // Start the failed step after a short delay
      setTimeout(() => {
        switch (nextStep) {
          case "arweave":
            handleArweaveUpload().catch((error) => {
              console.error("Auto-retry upload error:", error);
              disableAutoProgression("Upload error");
            });
            break;
          case "reply":
            handleReply().catch((error) => {
              console.error("Auto-retry reply error:", error);
              disableAutoProgression("Reply error");
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
   * Handles the like action for a message
   * - Validates user connection status
   * - Updates step status during processing
   * - Sends like transaction to the blockchain
   * - Handles success/error states with toast notifications
   */
  const handleLike = async () => {
    if (!isConnected) {
      openConnectModal();
      return;
    }

    if (hasReacted) {
      toast.info(reactionToast);
      return;
    }

    // Initialize step status for like
    setStepStatuses((prev) => ({
      ...prev,
      like: { status: "loading", disabled: true },
    }));

    const likeMessage = {
      Author: accountId,
      Like_to: sequenceNumber.toString(),
    };

    try {
      const result = await send(topicId, likeMessage, "");
      if (
        (result?.receipt as TransactionReceipt)?.result?.toString() ===
        "SUCCESS"
      ) {
        setStepStatuses((prev) => ({
          ...prev,
          like: { status: "success", disabled: true },
        }));
        toast.success("Like sent successfully.");
        await new Promise((resolve) => setTimeout(resolve, 2000));
        triggerRefresh();
      } else {
        throw new Error("Failed to send like.");
      }
    } catch {
      setStepStatuses((prev) => ({
        ...prev,
        like: { status: "error", disabled: false },
      }));
      toast.error("Failed to send like.");
    }
  };

  const handleUnlike = async () => {
    if (!isConnected) {
      openConnectModal();
      return;
    }

    if (hasReacted) {
      toast.info(reactionToast);
      return;
    }

    // Initialize step status for unlike
    setStepStatuses((prev) => ({
      ...prev,
      unlike: { status: "loading", disabled: true },
    }));

    const unlikeMessage = {
      Author: accountId,
      DisLike_to: sequenceNumber.toString(),
    };

    try {
      const result = await send(topicId, unlikeMessage, "");
      if (
        (result?.receipt as TransactionReceipt)?.result?.toString() ===
        "SUCCESS"
      ) {
        setStepStatuses((prev) => ({
          ...prev,
          unlike: { status: "success", disabled: true },
        }));
        toast.success("Unlike sent successfully.");
        await new Promise((resolve) => setTimeout(resolve, 2000));
        triggerRefresh();
      } else {
        throw new Error("Failed to send unlike.");
      }
    } catch {
      setStepStatuses((prev) => ({
        ...prev,
        unlike: { status: "error", disabled: false },
      }));
      toast.error("Failed to send unlike.");
    }
  };

  /**
   * Initiates the reply process
   * - Validates reply content and media
   * - Sets up processing steps based on content type
   * - Transitions the UI to processing mode
   */
  const handleStartReply = () => {
    if (!replyContent.trim() && !file) {
      toast.error("Please enter a comment or add media.");
      return;
    }

    if (file && file.size > 100 * 1024 * 1024) {
      toast.error("The file exceeds 100MB.");
      return;
    }

    if (file) {
      setStepStatuses({
        arweave: { status: "idle", disabled: false },
        reply: { status: "idle", disabled: true },
      });
    } else {
      setStepStatuses({
        reply: { status: "idle", disabled: false },
      });
    }

    setIsEditing(false);

    // Auto-start the first step if auto-progression is enabled
    if (autoProgressRef.current) {
      const stepOrder = file ? ["arweave", "reply"] : ["reply"];
      const firstStep = stepOrder[0];

      setTimeout(() => {
        console.log(`Auto-progression: Starting ${firstStep}...`);
        switch (firstStep) {
          case "arweave":
            handleArweaveUpload().catch((error) => {
              console.error("Auto-start upload error:", error);
              disableAutoProgression("Upload error");
            });
            break;
          case "reply":
            handleReply().catch((error) => {
              console.error("Auto-start reply error:", error);
              disableAutoProgression("Reply error");
            });
            break;
          default:
            console.warn("Unknown step for auto-start:", firstStep);
        }
      }, 500);
    }
  };

  /**
   * Handles media upload to Arweave
   * - Updates step status during upload
   * - Manages success/error states
   * - Enables reply step upon successful upload
   */
  const handleArweaveUpload = async () => {
    if (!file) return;

    setStepStatuses((prev) => ({
      ...prev,
      arweave: { status: "loading", disabled: true },
    }));

    try {
      toast.info("Uploading your media to Arweave...");
      const mediaId = await uploadToArweave(file);
      setUploadedMediaId(mediaId);
      toast.success("Media uploaded to Arweave successfully.");

      setStepStatuses((prev) => ({
        ...prev,
        arweave: { status: "success", disabled: true },
        reply: { status: "idle", disabled: false },
      }));
    } catch {
      toast.error("Media upload failed.");
      setStepStatuses((prev) => ({
        ...prev,
        arweave: { status: "error", disabled: false },
      }));

      // Disable auto-progression on error
      if (autoProgressRef.current) {
        disableAutoProgression("Media upload failed");
      }
    }
  };

  const handleReply = async () => {
    setStepStatuses((prev) => ({
      ...prev,
      reply: { status: "loading", disabled: true },
    }));

    try {
      const payload = {
        Author: accountId || "",
        Reply_to: sequenceNumber.toString(),
        Message: replyContent,
        Media: uploadedMediaId,
      };

      await send(topicId, payload);

      setStepStatuses((prev) => ({
        ...prev,
        reply: { status: "success", disabled: true },
      }));
      toast.success("Your comment has been sent successfully.");
      setShowReplyModal(false);
      await new Promise((resolve) => setTimeout(resolve, 2000));
      triggerRefresh();
    } catch {
      toast.error("Failed to send comment.");
      setStepStatuses((prev) => ({
        ...prev,
        reply: { status: "error", disabled: false },
      }));

      // Disable auto-progression on error
      if (autoProgressRef.current) {
        disableAutoProgression("Reply failed");
      }
    }
  };

  const handleTip = () => {
    if (accountId === author) {
      toast("You cannot tip yourself");
      return;
    }
    if (!isConnected) {
      openConnectModal();
      return;
    }
    openTipModal();
  };

  const generateShareLink = () => {
    // Use current origin (works for localhost and production)
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://ibird.io';
    
    // If this is a comment, generate comment-specific link
    if (isComment) {
      return `${baseUrl}/Threads/${topicId}?comment=${sequenceNumber}`;
    }
    // Otherwise, generate thread link
    return `${baseUrl}/Threads/${topicId}`;
  };
  
  const copyShareLink = () => {
    const link = generateShareLink();
    navigator.clipboard.writeText(link).then(() => {
      const message = isComment
        ? "💬 Comment link copied to clipboard!"
        : "Link copied to clipboard!";
      toast(message);
    });
  };

  const onEmojiClick = (emojiData: { emoji: string }) => {
    setReplyContent((prevContent) => prevContent + emojiData.emoji);
    setShowEmojiPicker(false);
  };

  /**
   * Renders a step button with appropriate status indicators
   * @param {keyof ReplyStepStatuses} step - The step identifier
   * @param {string} label - Display label for the step
   * @param {() => void} handler - Click handler for the step
   */
  const renderStepButton = (
    step: keyof ReplyStepStatuses,
    label: string,
    handler: () => void
  ) => {
    const status = stepStatuses[step];
    if (!status) return null;

    const statusDotClass =
      status.status === "success"
        ? "bg-green-400"
        : status.status === "error"
        ? "bg-red-400"
        : status.status === "loading"
        ? "bg-cyan-400 animate-pulse"
        : "bg-cyan-400";

    const titleClass =
      status.status === "success"
        ? "text-green-400"
        : status.status === "error"
        ? "text-red-400"
        : status.disabled
        ? "text-gray-500"
        : "text-white";

    return (
      <div
        className="flex justify-between items-center p-4 rounded-xl transition-all duration-200 border border-cyan-400/20 shadow-lg shadow-cyan-400/5 bg-slate-800/20 hover:bg-slate-800/30"
        key={step}
      >
        <div className="flex-1 pr-4">
          <div className="flex items-center gap-2 mb-1">
            <div className={`w-2 h-2 rounded-full ${statusDotClass}`} />
            <h3 className={`text-base font-medium font-mono ${titleClass}`}>
              {label}
            </h3>
          </div>
          {status.status === "error" && (
            <p className="text-sm text-red-400/80 font-light">
              Request failed. Please try again.
            </p>
          )}
          {status.status === "loading" && (
            <p className="text-sm text-cyan-400/80 font-light animate-pulse">
              Processing...
            </p>
          )}
          {status.status === "success" && (
            <p className="text-sm text-green-400/80 font-light">
              Completed successfully
            </p>
          )}
        </div>
        <button
          onClick={handler}
          disabled={status.disabled || status.status === "loading"}
          className={`px-6 py-2 rounded-full transition-all duration-200 font-medium min-w-[100px]
                flex items-center justify-center shadow-lg ${
                  status.status === "success"
                    ? "bg-green-500 text-white shadow-green-500/25 cursor-default"
                    : status.status === "loading"
                    ? "bg-slate-700 text-white animate-pulse cursor-not-allowed"
                    : status.status === "error"
                    ? "bg-red-500 hover:bg-red-400 text-white shadow-red-500/25"
                    : status.disabled
                    ? "bg-slate-700/60 text-slate-400 cursor-not-allowed"
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
          ) : (
            <span className="text-sm">Start</span>
          )}
        </button>
      </div>
    );
  };

  const renderProcessingSteps = () => (
    <div className="flex flex-col h-[80vh] max-w-lg w-full bg-gradient-to-br from-slate-900 via-cyan-900/20 to-slate-900 backdrop-blur-md rounded-2xl overflow-hidden">
      <div className="px-6 py-4 border-b border-cyan-400/50 flex-shrink-0">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-2xl font-mono text-cyan-400 bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
            Send Comment
          </h1>
        </div>

        {/* Auto-progress toggle */}
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
                  console.log(
                    "Auto-progress enabled, checking for pending steps..."
                  );
                  console.log("Current step statuses:", stepStatuses);

                  // Find first available step in proper order
                  const stepOrder = file ? ["arweave", "reply"] : ["reply"];

                  const nextStep = stepOrder.find((stepName) => {
                    const status =
                      stepStatuses[stepName as keyof typeof stepStatuses];
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
                        case "arweave":
                          console.log("Auto-progression: Uploading media...");
                          handleArweaveUpload().catch((error) => {
                            console.error("Auto-upload error:", error);
                            disableAutoProgression("Upload error");
                          });
                          break;
                        case "reply":
                          console.log("Auto-progression: Sending comment...");
                          handleReply().catch((error) => {
                            console.error("Auto-reply error:", error);
                            disableAutoProgression("Reply error");
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
        <p className="text-sm text-white/60 mt-1 font-light">
          Processing your comment step by step
        </p>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="p-6">
          {/* Comment and Media Preview */}
          <div className="mb-6 p-5 bg-slate-800/80 backdrop-blur-sm rounded-xl border border-cyan-400/30 shadow-lg shadow-cyan-400/10">
            <p className="text-white break-words text-lg leading-relaxed font-light">
              {replyContent}
            </p>
            {file && (
              <div className="mt-4">
                <div className="relative rounded-lg overflow-hidden w-full max-w-xs mx-auto">
                  <img
                    src={URL.createObjectURL(file)}
                    alt="Preview"
                    className="w-full h-auto max-h-[250px] object-contain bg-black/5"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Processing Steps */}
          <div className="space-y-3">
            {file &&
              renderStepButton(
                "arweave",
                "Upload Media to Arweave",
                handleArweaveUpload
              )}
            {renderStepButton("reply", "Send Comment", handleReply)}
            <button
              onClick={() => {
                setIsEditing(true);
              }}
              className="w-full bg-slate-800 hover:bg-red-500/20 text-white py-2 mt-3 px-4 rounded-full border border-cyan-400/50 hover:border-red-400/50 transition-all duration-200 font-mono"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderReplyForm = () => (
    <Modal isOpen={showReplyModal} onClose={() => setShowReplyModal(false)}>
      <div className="flex flex-col max-h-[80vh] max-w-lg w-full bg-gradient-to-br from-slate-900 via-cyan-900/20 to-slate-900 backdrop-blur-md rounded-2xl overflow-hidden border border-cyan-400/30 shadow-2xl shadow-cyan-400/20">
        {/* Header */}
        <div className="px-6 py-4 border-b border-cyan-400/30 bg-gradient-to-r from-cyan-400/5 to-blue-400/5">
          <h3 className="text-2xl font-mono text-cyan-400 bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
            Write a Comment
          </h3>
          <p className="text-sm text-white/60 mt-1 font-light">
            Share your thoughts with the community
          </p>
        </div>

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto">
          {isEditing ? (
            <>
              {/* Compose Area */}
              <div className="p-6">
                <div className="mb-4">
                  <div className="relative">
                    <textarea
                      className="w-full bg-transparent text-white text-lg border border-cyan-400/50
                        focus:ring-1 focus:ring-cyan-400 outline-none resize-none h-auto
                        placeholder:text-white/40 rounded-xl p-4 backdrop-blur-sm"
                      placeholder="What's on your mind?"
                      value={replyContent}
                      onChange={(e) => setReplyContent(e.target.value)}
                      maxLength={850}
                      rows={5}
                      style={{
                        minHeight: "160px",
                        maxHeight: "400px",
                        overflow: "auto",
                      }}
                    />

                    {/* Character limit warning */}
                    {replyContent.length > 800 && (
                      <div
                        className="absolute bottom-2 right-2 text-xs text-red-400/80
                          bg-red-500/10 px-2 py-1 rounded-full border border-red-400/30"
                      >
                        {850 - replyContent.length} characters left
                      </div>
                    )}
                  </div>

                  {/* Emoji and Media buttons - positioned below textarea */}
                  <div className="flex gap-2 mt-2 px-1">
                    {/* Emoji Button */}
                    <button
                      onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                      className="p-2 hover:bg-cyan-400/10 rounded-full transition-colors group"
                    >
                      <BsEmojiSmile className="text-xl text-cyan-400 group-hover:text-blue-400" />
                    </button>

                    {/* Media Upload */}
                    <label
                      htmlFor="fileUploadThread"
                      className="p-2 hover:bg-cyan-400/10 rounded-full transition-colors group cursor-pointer"
                    >
                      <MdOutlinePermMedia className="text-xl text-cyan-400 group-hover:text-blue-400" />
                      <input
                        type="file"
                        id="fileUploadThread"
                        className="hidden"
                        accept="image/*"
                        onChange={(e) => {
                          if (e.target.files?.[0]) {
                            setFile(e.target.files[0]);
                            e.target.value = "";
                            setStepStatuses((prev) => ({
                              ...prev,
                              arweave: { status: "idle", disabled: false },
                              reply: { status: "idle", disabled: true },
                            }));
                          }
                        }}
                      />
                    </label>
                  </div>

                  {/* Emoji Picker Popup */}
                  {showEmojiPicker && (
                    <EmojiPickerPopup
                      onEmojiClick={onEmojiClick}
                      onClose={() => setShowEmojiPicker(false)}
                    />
                  )}
                </div>

                {/* Media Preview */}
                {file && (
                  <div className="rounded-xl overflow-hidden border border-cyan-400/30 shadow-lg shadow-cyan-400/10 bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-sm">
                    {/* Image Preview */}
                    <div className="relative w-full max-w-xs mx-auto">
                      <img
                        src={URL.createObjectURL(file)}
                        alt="Preview"
                        className="w-full h-auto max-h-[250px] object-contain bg-black/5"
                      />
                    </div>

                    {/* File Info and Remove Button */}
                    <div className="p-3 border-t border-cyan-400/30">
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0 mr-4">
                          <p
                            className="text-sm text-white truncate"
                            title={file.name}
                          >
                            {file.name}
                          </p>
                          <p className="text-xs text-white/50 mt-0.5">
                            {(file.size / (1024 * 1024)).toFixed(1)} MB
                          </p>
                        </div>
                        <button
                          onClick={() => {
                            setFile(null);
                            setStepStatuses((prev) => {
                              const newStatuses = { ...prev };
                              delete newStatuses.arweave;
                              return {
                                ...newStatuses,
                                reply: { status: "idle", disabled: false },
                              };
                            });
                          }}
                          className="flex items-center px-3 py-1.5 rounded-lg
                            bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300
                            transition-all duration-200 border border-red-400/20"
                          title="Remove media"
                        >
                          <RiDeleteBinLine className="text-lg mr-1.5" />
                          <span className="text-sm font-medium">Remove</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Bottom Controls */}
              <div className="border-t border-cyan-400/30 bg-slate-900/95 backdrop-blur-sm">
                <div className="px-6 py-4 flex items-center justify-between">
                  {/* Character Count */}
                  <div
                    className={`text-sm font-mono font-medium ${
                      replyContent.length > 800
                        ? "text-red-400"
                        : replyContent.length > 700
                        ? "text-cyan-400"
                        : "text-white/50"
                    }`}
                  >
                    {replyContent.length}/850
                  </div>

                  {/* Start Reply Button */}
                  <button
                    onClick={handleStartReply}
                    disabled={!replyContent.trim() && !file}
                    className={`px-8 py-2.5 font-semibold rounded-full transition-all
                      duration-200 hover:shadow-lg active:scale-98 font-mono ${
                        !replyContent.trim() && !file
                          ? "bg-slate-700/60 text-slate-400 cursor-not-allowed"
                          : "bg-gradient-to-r from-cyan-400 to-blue-500 hover:scale-105 text-white shadow-lg shadow-cyan-400/25"
                      }`}
                  >
                    Reply
                  </button>
                </div>
              </div>
            </>
          ) : (
            renderProcessingSteps()
          )}
        </div>
      </div>
    </Modal>
  );

  return (
    <>
      {/* Mobile-optimized button layout */}
      <div className="flex flex-wrap gap-1.5 sm:gap-2 sm:flex-nowrap">
        {/* Primary actions - always visible */}
        <div className="flex gap-1.5 sm:gap-2 flex-shrink-0">
          <button
            className={`group flex items-center justify-center gap-1 px-2 py-1.5 sm:px-3 sm:py-2 sm:gap-2 rounded-full bg-gradient-to-r from-cyan-400/20 to-blue-400/20 hover:from-cyan-400/30 hover:to-blue-400/30 text-cyan-400 hover:text-cyan-300 transition-all duration-300 border border-cyan-400/30 hover:border-cyan-400/50 shadow-lg shadow-cyan-400/15 hover:shadow-xl hover:shadow-cyan-400/25 hover:scale-[1.05] active:scale-[0.95] backdrop-blur-sm min-w-[44px] sm:min-w-[60px] disabled:opacity-60 disabled:cursor-not-allowed ${likedButtonClass}`}
            onClick={() => {
              // Initialize step status for like
              setStepStatuses((prev) => ({
                ...prev,
                like: { status: "idle", disabled: false },
              }));
              handleLike();
            }}
            title={likeTitle}
            disabled={hasReacted}
          >
            <AiOutlineLike className="w-4 h-4 sm:w-4 sm:h-4 group-hover:animate-pulse" />
            <span className="text-xs font-mono font-medium hidden sm:inline">
              {formatNumber(likesCount || 0)}
            </span>
          </button>

          <button
            className={`group flex items-center justify-center gap-1 px-2 py-1.5 sm:px-3 sm:py-2 sm:gap-2 rounded-full bg-gradient-to-r from-cyan-400/20 to-blue-400/20 hover:from-cyan-400/30 hover:to-blue-400/30 text-cyan-400 hover:text-cyan-300 transition-all duration-300 border border-cyan-400/30 hover:border-cyan-400/50 shadow-lg shadow-cyan-400/15 hover:shadow-xl hover:shadow-cyan-400/25 hover:scale-[1.05] active:scale-[0.95] backdrop-blur-sm min-w-[44px] sm:min-w-[60px] disabled:opacity-60 disabled:cursor-not-allowed ${dislikedButtonClass}`}
            onClick={() => {
              // Initialize step status for unlike
              setStepStatuses((prev) => ({
                ...prev,
                unlike: { status: "idle", disabled: false },
              }));
              handleUnlike();
            }}
            title={dislikeTitle}
            disabled={hasReacted}
          >
            <AiOutlineDislike className="w-4 h-4 sm:w-4 sm:h-4 group-hover:animate-pulse" />
            <span className="text-xs font-mono font-medium hidden sm:inline">
              {formatNumber(dislikesCount || 0)}
            </span>
          </button>

          <button
            className="group flex items-center justify-center gap-1 px-2 py-1.5 sm:px-3 sm:py-2 sm:gap-2 rounded-full bg-gradient-to-r from-cyan-400/20 to-blue-400/20 hover:from-cyan-400/30 hover:to-blue-400/30 text-cyan-400 hover:text-cyan-300 transition-all duration-300 border border-cyan-400/30 hover:border-cyan-400/50 shadow-lg shadow-cyan-400/15 hover:shadow-xl hover:shadow-cyan-400/25 hover:scale-[1.05] active:scale-[0.95] backdrop-blur-sm min-w-[44px] sm:min-w-[60px]"
            onClick={() => {
              if (!isConnected) {
                openConnectModal();
                return;
              }
              setShowReplyModal(true);
            }}
            title="Reply to this message"
          >
            <AiOutlineMessage className="w-4 h-4 sm:w-4 sm:h-4 group-hover:animate-pulse" />
            <span className="text-xs font-mono font-medium hidden sm:inline">
              Reply
            </span>
          </button>
        </div>

        {/* Secondary actions - wrap on mobile */}
        <div className="flex gap-1.5 sm:gap-2 flex-wrap sm:flex-nowrap">
          <a
            href={`https://hashscan.io/mainnet/transaction/${message_id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center justify-center gap-1 px-2 py-1.5 sm:px-3 sm:py-2 sm:gap-2 rounded-full bg-gradient-to-r from-cyan-400/20 to-blue-400/20 hover:from-cyan-400/30 hover:to-blue-400/30 text-cyan-400 hover:text-cyan-300 transition-all duration-300 border border-cyan-400/30 hover:border-cyan-400/50 shadow-lg shadow-cyan-400/15 hover:shadow-xl hover:shadow-cyan-400/25 hover:scale-[1.05] active:scale-[0.95] backdrop-blur-sm min-w-[44px] sm:min-w-[60px]"
            title="View on HashScan"
          >
            <FiHash className="w-4 h-4 sm:w-4 sm:h-4 group-hover:animate-pulse" />
            <span className="text-xs font-mono font-medium hidden sm:inline">
              HashScan
            </span>
          </a>

          <button
            className="group flex items-center justify-center gap-1 px-2 py-1.5 sm:px-3 sm:py-2 sm:gap-2 rounded-full bg-gradient-to-r from-cyan-400/20 to-blue-400/20 hover:from-cyan-400/30 hover:to-blue-400/30 text-cyan-400 hover:text-cyan-300 transition-all duration-300 border border-cyan-400/30 hover:border-cyan-400/50 shadow-lg shadow-cyan-400/15 hover:shadow-xl hover:shadow-cyan-400/25 hover:scale-[1.05] active:scale-[0.95] backdrop-blur-sm min-w-[44px] sm:min-w-[60px]"
            onClick={() => {
              handleTip();
            }}
            title="Tip the author"
          >
            <BsCurrencyDollar className="w-4 h-4 sm:w-4 sm:h-4 group-hover:animate-pulse" />
            <span className="text-xs font-mono font-medium hidden sm:inline">
              Tip
            </span>
          </button>

          <button
            className="group flex items-center justify-center gap-1 px-2 py-1.5 sm:px-3 sm:py-2 sm:gap-2 rounded-full bg-gradient-to-r from-cyan-400/20 to-blue-400/20 hover:from-cyan-400/30 hover:to-blue-400/30 text-cyan-400 hover:text-cyan-300 transition-all duration-300 border border-cyan-400/30 hover:border-cyan-400/50 shadow-lg shadow-cyan-400/15 hover:shadow-xl hover:shadow-cyan-400/25 hover:scale-[1.05] active:scale-[0.95] backdrop-blur-sm min-w-[44px] sm:min-w-[60px]"
            onClick={() => {
              copyShareLink();
            }}
            title="Share this message"
          >
            <FiShare2 className="w-4 h-4 sm:w-4 sm:h-4 group-hover:animate-pulse" />
            <span className="text-xs font-mono font-medium hidden sm:inline">
              Share
            </span>
          </button>
        </div>
      </div>

      {/* Process Modals */}
      {showReplyModal && renderReplyForm()}

      {isConnectModalOpen && (
        <ConnectModal isOpen={isConnectModalOpen} onClose={closeConnectModal} />
      )}

      {isTipModalOpen && (
        <Modal isOpen={isTipModalOpen} onClose={closeTipModal}>
          <div className="bg-gradient-to-br from-slate-900 via-cyan-900/20 to-slate-900 backdrop-blur-md p-4 sm:p-6 rounded-2xl border border-cyan-400/30 shadow-2xl shadow-cyan-400/20">
            <Tip onClose={closeTipModal} author={author} topicId={topicId} />
          </div>
        </Modal>
      )}
    </>
  );
};

export default Replay;
