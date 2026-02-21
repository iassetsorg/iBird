import React, { useState, useRef } from "react";
import { toast } from "react-toastify";
import { MdOutlinePermMedia } from "react-icons/md";
import useSendMessage from "../hooks/use_send_message";
import useUploadToArweave from "../media/use_upload_to_arweave";
import { RiDeleteBinLine, RiCheckLine, RiRefreshLine } from "react-icons/ri";
import { BsEmojiSmile } from "react-icons/bs";
import EmojiPickerPopup from "../common/EmojiPickerPopup";
import { useRefreshTrigger } from "../hooks/use_refresh_trigger";

// Default explorer topic (used as fallback if topicId prop is not provided)
const DEFAULT_EXPLORER_TOPIC = process.env.NEXT_PUBLIC_EXPLORER_ID || "";

/**
 * Type definition for transaction receipt
 */
interface TransactionReceipt {
  result: {
    toString: () => string;
  };
}

/**
 * SendNewPost Component
 * A complex form component that handles creating and sending new posts with media attachments.
 * The component manages a multi-step posting process:
 * 1. Edit Mode: Compose message and attach media
 * 2. Processing Mode: Handle media upload and message posting to different destinations
 *
 * @component
 * @param {Object} props
 * @param {Function} props.onClose - Callback function to close the post form
 */

/**
 * Maximum allowed file size for media uploads (100MB)
 */
const maxSize = 100 * 1024 * 1024;

/**
 * Step status type definition for tracking the state of each posting step
 * @typedef {Object} StepStatus
 * @property {string} status - Current status ('idle' | 'loading' | 'success' | 'error')
 * @property {boolean} disabled - Whether the step is currently disabled
 */

const SendNewPost = ({
  onClose,
  topicId,
}: {
  onClose: () => void;
  topicId?: string;
}) => {
  // Determine if this is an explorer post (no topicId, or topicId equals the default explorer topic)
  const isExplorerPost = !topicId || topicId === DEFAULT_EXPLORER_TOPIC;
  const [message, setMessage] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const { uploadToArweave } = useUploadToArweave();
  const { send } = useSendMessage();
  const [memo] = useState("");
  const [isEditing, setIsEditing] = useState(true);
  const { triggerRefresh } = useRefreshTrigger();

  // New state for step statuses
  const [stepStatuses, setStepStatuses] = useState({
    arweave: { status: "idle", disabled: false },
    explorer: { status: "idle", disabled: true },
  });

  const uploadedMediaIdRef = useRef<string | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  // Auto-progression states
  const [autoProgress, setAutoProgress] = useState(false);
  const autoProgressRef = useRef(false);
  const [autoProgressDisabledByError, setAutoProgressDisabledByError] =
    useState(false);

  // Add emoji handler
  const onEmojiClick = (emojiData: { emoji: string }) => {
    setMessage((prevMessage) => prevMessage + emojiData.emoji);
    setShowEmojiPicker(false);
  };

  const clearFile = () => {
    setFile(null);
    uploadedMediaIdRef.current = null;
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
    const stepOrder = ["arweave", "explorer"];

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
              disableAutoProgression("Upload retry error");
            });
            break;
          case "explorer":
            handleExplorerPost().catch((error) => {
              console.error("Auto-retry explorer post error:", error);
              disableAutoProgression("Explorer post retry error");
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
   * Initiates the posting process by validating inputs and transitioning to processing mode
   * Performs checks for:
   * - Message content presence
   * - File size limits
   * - Sets appropriate initial step statuses
   */
  const handleStartPosting = () => {
    if (!message) {
      toast.error("Please enter a message");
      return;
    }

    if (file && file.size > maxSize) {
      toast.error("The file exceeds 100MB.");
      return;
    }

    // Set initial step statuses based on whether media needs to be uploaded
    if (file) {
      // If there's a file, start with Arweave upload enabled
      setStepStatuses({
        arweave: { status: "idle", disabled: false },
        explorer: { status: "idle", disabled: true },
      });
    } else {
      // If no file, skip Arweave upload and go straight to explorer
      setStepStatuses({
        arweave: { status: "idle", disabled: true },
        explorer: { status: "idle", disabled: false },
      });
    }

    setIsEditing(false);
  };

  /**
   * Handles the media upload process to Arweave
   * - Updates step status during upload
   * - Manages success/error states
   * - Enables the next step (Explorer) on success
   */
  const handleArweaveUpload = async () => {
    if (!file) return;

    setStepStatuses((prev) => ({
      ...prev,
      arweave: { status: "loading", disabled: true },
    }));

    try {
      toast.info(
        `Uploading your media to Arweave for ${isExplorerPost ? "explorer" : "group/channel"
        } post...`
      );
      const mediaId = await uploadToArweave(file);
      uploadedMediaIdRef.current = mediaId;
      toast.success(
        `Media uploaded to Arweave successfully for ${isExplorerPost ? "explorer" : "group/channel"
        } post.`
      );

      setStepStatuses((prev) => ({
        ...prev,
        arweave: { status: "success", disabled: true },
        explorer: { status: "idle", disabled: false },
      }));

      // Auto-progress to next step if enabled
      if (autoProgressRef.current) {
        console.log("Auto-progressing to explorer post...");
        setTimeout(() => {
          handleExplorerPost();
        }, 1000);
      }
    } catch {
      toast.error(
        `Media upload failed for ${isExplorerPost ? "explorer" : "group/channel"
        } post.`
      );
      setStepStatuses((prev) => ({
        ...prev,
        arweave: { status: "error", disabled: false },
      }));
    }
  };

  /**
   * Handles posting the message to the Explorer topic
   * - Updates step status during posting
   * - Manages success/error states
   * - Completes the posting process on success
   */
  const handleExplorerPost = async () => {
    const mediaCid = uploadedMediaIdRef.current;

    if (file && !mediaCid) {
      toast.info(
        `Waiting for media upload to finish before posting to ${isExplorerPost ? "explorer" : "group/channel"
        }.`
      );
      if (autoProgressRef.current) {
        setTimeout(() => {
          handleExplorerPost();
        }, 1000);
      }
      return;
    }

    setStepStatuses((prev) => ({
      ...prev,
      explorer: { status: "loading", disabled: true },
    }));

    try {
      const postPayload = {
        Type: "Post",
        Message: message,
        Media: mediaCid,
      };

      const postExplorer = await send(
        topicId || DEFAULT_EXPLORER_TOPIC,
        postPayload,
        memo
      );

      if (
        postExplorer &&
        (postExplorer.receipt as TransactionReceipt)?.result?.toString() ===
        "SUCCESS"
      ) {
        toast.success(
          `Your post sent to ${isExplorerPost ? "explorer" : "group/channel"
          } successfully.`
        );
        setStepStatuses((prev) => ({
          ...prev,
          explorer: { status: "success", disabled: true },
        }));

        toast.success(
          `Your post sent to Hedera ${isExplorerPost ? "explorer" : "group/channel"
          } successfully!`
        );
        onClose();
        await new Promise((resolve) => setTimeout(resolve, 2000));
        triggerRefresh();
      } else {
        throw new Error("Explorer post failed");
      }
    } catch {
      toast.error(
        `Failed to send post to ${isExplorerPost ? "explorer" : "group/channel"}.`
      );
      setStepStatuses((prev) => ({
        ...prev,
        explorer: { status: "error", disabled: false },
      }));
    }
  };

  /**
   * Renders the processing steps interface
   * Shows:
   * - Message preview
   * - Media preview (if present)
   * - Step-by-step progress indicators
   * - Action buttons for each step
   */
  const renderProcessingSteps = () => (
    <div className="flex flex-col h-[80vh] bg-slate-900/80 backdrop-blur-md rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-cyan-400/50 flex-shrink-0">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-2xl font-mono text-cyan-400 bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
            Posting Your Content
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
                  console.log(
                    "Auto-progress enabled, checking for pending steps..."
                  );
                  console.log("Current step statuses:", stepStatuses);

                  // Find the first available step in proper order
                  const stepOrder = ["arweave", "explorer"];

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
                          console.log(
                            "Auto-progression: Starting media upload..."
                          );
                          handleArweaveUpload().catch((error) => {
                            console.error("Auto-upload error:", error);
                            disableAutoProgression("Upload error");
                          });
                          break;
                        case "explorer":
                          console.log(
                            "Auto-progression: Sending to explorer..."
                          );
                          handleExplorerPost().catch((error) => {
                            console.error("Auto-explorer post error:", error);
                            disableAutoProgression("Explorer post error");
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
              className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${autoProgress ? "bg-cyan-500" : "bg-slate-600"
                } ${autoProgressDisabledByError
                  ? "opacity-50 cursor-not-allowed"
                  : ""
                }`}
            >
              <div
                className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${autoProgress ? "translate-x-5" : "translate-x-0.5"
                  }`}
              />
            </button>
            {/* Status indicator */}
            <span
              className={`text-xs font-mono px-2 py-1 rounded ${autoProgress
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
        <p className="text-sm text-white/60 mt-1 font-light">
          Processing your post step by step
        </p>
      </div>

      {/* Scrollable Content Area */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-6">
          {/* Message and Media Preview */}
          <div className="mb-6 p-4 bg-slate-800/80 backdrop-blur-sm rounded-xl border border-cyan-400/30 shadow-lg shadow-cyan-400/10">
            <p className="text-white break-words text-lg leading-relaxed font-light">
              {message}
            </p>
            {file && (
              <div className="mt-4 space-y-2">
                <div className="relative rounded-lg overflow-hidden">
                  <img
                    src={URL.createObjectURL(file)}
                    alt="Preview"
                    className="w-full max-h-[200px] object-contain bg-black/5"
                  />
                  <div className="absolute bottom-0 left-0 right-0 px-3 py-2 bg-gradient-to-t from-black/50 to-transparent">
                    <div className="flex items-center text-white/90">
                      <MdOutlinePermMedia className="text-lg mr-2" />
                      <span className="text-sm font-mono">
                        {(file.size / (1024 * 1024)).toFixed(1)} MB
                      </span>
                    </div>
                  </div>
                </div>
                {uploadedMediaIdRef.current && (
                  <p className="text-sm font-mono text-green-300">
                    Media upload complete. CID will be included in your post.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Processing Steps */}
          <div className="space-y-3">
            {file && (
              <div className="flex justify-between items-center p-4 rounded-xl transition-all duration-200 border border-cyan-400/20 shadow-lg shadow-cyan-400/5 bg-slate-800/20">
                <div className="flex-1 pr-4">
                  <div className="flex items-center gap-2 mb-1">
                    <div
                      className={`w-2 h-2 rounded-full ${stepStatuses.arweave.status === "success"
                        ? "bg-green-400"
                        : stepStatuses.arweave.status === "error"
                          ? "bg-red-400"
                          : stepStatuses.arweave.status === "loading"
                            ? "bg-cyan-400 animate-pulse"
                            : "bg-cyan-400"
                        }`}
                    />
                    <h3
                      className={`text-base font-medium font-mono ${stepStatuses.arweave.status === "success"
                        ? "text-green-400"
                        : stepStatuses.arweave.status === "error"
                          ? "text-red-400"
                          : stepStatuses.arweave.disabled
                            ? "text-gray-500"
                            : "text-white"
                        }`}
                    >
                      Upload Media To Arweave
                    </h3>
                  </div>
                  {stepStatuses.arweave.status === "error" && (
                    <p className="text-sm text-red-400/80 font-light">
                      Failed to upload. Please try again.
                    </p>
                  )}
                  {stepStatuses.arweave.status === "loading" && (
                    <p className="text-sm text-cyan-400/80 font-light animate-pulse">
                      Processing...
                    </p>
                  )}
                </div>
                <div className="flex-shrink-0">
                  <button
                    onClick={handleArweaveUpload}
                    disabled={
                      stepStatuses.arweave.disabled ||
                      stepStatuses.arweave.status === "loading"
                    }
                    className={`px-6 py-2 rounded-lg transition-all duration-200 font-medium min-w-[100px] font-mono
                        flex items-center justify-center shadow-lg ${stepStatuses.arweave.status === "success"
                        ? "bg-green-500 text-white shadow-green-500/25 cursor-default"
                        : stepStatuses.arweave.status === "loading"
                          ? "bg-slate-700 text-white animate-pulse cursor-not-allowed"
                          : stepStatuses.arweave.status === "error"
                            ? "bg-red-500 hover:bg-red-400 text-white shadow-red-500/25"
                            : "bg-gradient-to-r from-cyan-400 to-blue-500 hover:scale-105 text-white shadow-cyan-400/25"
                      }`}
                  >
                    {stepStatuses.arweave.status === "loading" ? (
                      <span className="text-sm">Processing...</span>
                    ) : stepStatuses.arweave.status === "success" ? (
                      <>
                        <RiCheckLine className="mr-1.5" />
                        <span className="text-sm">Done</span>
                      </>
                    ) : stepStatuses.arweave.status === "error" ? (
                      <>
                        <RiRefreshLine className="mr-1.5" />
                        <span className="text-sm">Retry</span>
                      </>
                    ) : (
                      <span className="text-sm">Start</span>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Explorer Step */}
            <div className="flex justify-between items-center p-4 rounded-xl transition-all duration-200 border border-cyan-400/20 shadow-lg shadow-cyan-400/5 bg-slate-800/20">
              <div className="flex-1 pr-4">
                <div className="flex items-center gap-2 mb-1">
                  <div
                    className={`w-2 h-2 rounded-full ${stepStatuses.explorer.status === "success"
                      ? "bg-green-400"
                      : stepStatuses.explorer.status === "error"
                        ? "bg-red-400"
                        : stepStatuses.explorer.status === "loading"
                          ? "bg-cyan-400 animate-pulse"
                          : "bg-cyan-400"
                      }`}
                  />
                  <h3
                    className={`text-base font-medium font-mono ${stepStatuses.explorer.status === "success"
                      ? "text-green-400"
                      : stepStatuses.explorer.status === "error"
                        ? "text-red-400"
                        : stepStatuses.explorer.disabled
                          ? "text-gray-500"
                          : "text-white"
                      }`}
                  >
                    Send To {isExplorerPost ? "Explorer" : "Group/Channel"}
                  </h3>
                </div>
                {stepStatuses.explorer.status === "error" && (
                  <p className="text-sm text-red-400/80 font-light">
                    Transaction failed. Please try again.
                  </p>
                )}
                {stepStatuses.explorer.status === "loading" && (
                  <p className="text-sm text-cyan-400/80 font-light animate-pulse">
                    Processing...
                  </p>
                )}
              </div>
              <div className="flex-shrink-0">
                <button
                  onClick={handleExplorerPost}
                  disabled={
                    stepStatuses.explorer.disabled ||
                    stepStatuses.explorer.status === "loading"
                  }
                  className={`px-6 py-2 rounded-lg transition-all duration-200 font-medium min-w-[100px] font-mono
                      flex items-center justify-center shadow-lg ${stepStatuses.explorer.status === "success"
                      ? "bg-green-500 text-white shadow-green-500/25 cursor-default"
                      : stepStatuses.explorer.status === "loading"
                        ? "bg-slate-700 text-white animate-pulse cursor-not-allowed"
                        : stepStatuses.explorer.status === "error"
                          ? "bg-red-500 hover:bg-red-400 text-white shadow-red-500/25"
                          : "bg-gradient-to-r from-cyan-400 to-blue-500 hover:scale-105 text-white shadow-cyan-400/25"
                    }`}
                >
                  {stepStatuses.explorer.status === "loading" ? (
                    <span className="text-sm">Processing...</span>
                  ) : stepStatuses.explorer.status === "success" ? (
                    <>
                      <RiCheckLine className="mr-1.5" />
                      <span className="text-sm">Done</span>
                    </>
                  ) : stepStatuses.explorer.status === "error" ? (
                    <>
                      <RiRefreshLine className="mr-1.5" />
                      <span className="text-sm">Retry</span>
                    </>
                  ) : (
                    <span className="text-sm">Start</span>
                  )}
                </button>
              </div>
            </div>

            {/* Cancel Button */}
            <button
              onClick={onClose}
              className="w-full bg-slate-800 hover:bg-red-500/20 text-white py-2 mt-4 px-4 rounded-full border border-cyan-400/50 hover:border-red-400/50 transition-all duration-200 font-mono"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  /**
   * Renders the message composition form
   * Features:
   * - Message input with character limit
   * - Media upload/preview
   * - File size validation
   * - Post button with validation
   */
  const renderEditForm = () => (
    <div className="flex flex-col bg-slate-900/80 backdrop-blur-md rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-cyan-400/50">
        <h3 className="text-2xl font-mono text-cyan-400 bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
          Create Post
        </h3>
        <p className="text-sm text-white/60 mt-1 font-light">
          Share your thoughts with the community
        </p>
      </div>

      {/* Scrollable Content Area */}
      <div className="max-h-[60vh] overflow-y-auto">
        <div className="p-6 space-y-6">
          {/* Message Input */}
          <div>
            <label className="block text-sm font-medium text-white/80 mb-1.5 font-mono">
              Message <span className="text-red-400">*</span>
            </label>
            <div>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg bg-slate-800/80 backdrop-blur-sm text-white font-light
                  border-2 border-cyan-400/50 focus:border-cyan-400 transition-all
                  duration-200 outline-none resize-none min-h-[120px] shadow-lg shadow-cyan-400/10"
                placeholder="What's on your mind?"
                rows={4}
                maxLength={850}
              />

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
                  htmlFor="fileUpload"
                  className="p-2 hover:bg-cyan-400/10 rounded-full transition-colors group cursor-pointer"
                >
                  <MdOutlinePermMedia className="text-xl text-cyan-400 group-hover:text-blue-400" />
                  <input
                    type="file"
                    id="fileUpload"
                    className="hidden"
                    accept="image/*"
                    onChange={(e) => {
                      if (e.target.files?.[0]) {
                        setFile(e.target.files[0]);
                        uploadedMediaIdRef.current = null;
                        e.target.value = "";
                      }
                    }}
                  />
                </label>
              </div>
            </div>
            {message.trim() && (
              <p className="text-xs text-green-400 mt-1 flex items-center gap-1 font-light">
                <RiCheckLine className="text-sm" />
                Message looks good!
              </p>
            )}
          </div>

          {/* Media Section - Only show when file is selected */}
          {file && (
            <div className="space-y-4">
              {/* Media Preview */}
              <div className="rounded-xl overflow-hidden border border-cyan-400/50 space-y-2">
                {/* Image Preview */}
                <div className="relative">
                  <img
                    src={URL.createObjectURL(file)}
                    alt="Preview"
                    className="w-full max-h-[300px] object-contain bg-black/5"
                  />
                </div>

                {uploadedMediaIdRef.current && (
                  <p className="px-3 text-sm font-mono text-green-400">
                    Media upload complete. CID will be included in your post.
                  </p>
                )}

                {/* File Info and Remove Button */}
                <div className="p-3 border-t border-cyan-400/50">
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
                      onClick={clearFile}
                      className="flex items-center px-3 py-1.5 rounded-lg
                        bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300
                        transition-all duration-200"
                      title="Remove media"
                    >
                      <RiDeleteBinLine className="text-lg mr-1.5" />
                      <span className="text-sm font-medium">Remove</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Emoji Picker */}
      {showEmojiPicker && (
        <EmojiPickerPopup
          onEmojiClick={onEmojiClick}
          onClose={() => setShowEmojiPicker(false)}
        />
      )}

      {/* Bottom Controls */}
      <div className="border-t border-cyan-400/50 bg-slate-900/95 backdrop-blur-sm">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Character Count */}
            <div
              className={`text-sm font-mono ${message.length > 800
                ? "text-red-400"
                : message.length > 700
                  ? "text-cyan-400"
                  : "text-white/50"
                }`}
            >
              {message.length}/850
            </div>

            {/* Post Button */}
            <button
              onClick={handleStartPosting}
              disabled={!message.trim() && !file}
              className={`px-8 py-2.5 font-semibold rounded-full transition-all
                duration-200 hover:shadow-lg active:scale-98 flex items-center justify-center gap-2 font-mono ${!message.trim() && !file
                  ? "bg-gray-600 text-gray-400 cursor-not-allowed"
                  : "bg-gradient-to-r from-cyan-400 to-blue-500 hover:scale-105 text-white shadow-lg shadow-cyan-400/25"
                }`}
            >
              {message.trim() || file ? (
                <>
                  <RiCheckLine className="text-lg" />
                  Post
                </>
              ) : (
                "Post"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="max-w-md mx-auto bg-background rounded-lg shadow-xl p-3 text-text">
      {isEditing ? renderEditForm() : renderProcessingSteps()}
    </div>
  );
};

export default SendNewPost;
