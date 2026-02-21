import React, { useState, useRef, useEffect } from "react";
import { toast } from "react-toastify";
import { MdOutlinePermMedia } from "react-icons/md";
import { RiDeleteBinLine, RiCheckLine, RiRefreshLine } from "react-icons/ri";
import { BsEmojiSmile } from "react-icons/bs";
import useSendMessage from "../hooks/use_send_message";
import useUploadToArweave from "../media/use_upload_to_arweave";
import eventService from "../services/event_service";
import EmojiPickerPopup from "../common/EmojiPickerPopup";
import { useRefreshTrigger } from "../hooks/use_refresh_trigger";

/**
 * Represents the status and disabled state of a single step in the add-to-thread process
 * @interface StepStatus
 */
interface StepStatus {
  status: "idle" | "loading" | "success" | "error";
  disabled: boolean;
}

/**
 * Tracks the status of all steps in the add-to-thread workflow
 * @interface AddToThreadStepStatuses
 */
interface AddToThreadStepStatuses {
  arweave?: StepStatus;
  message: StepStatus;
}

/**
 * Structure for the message payload sent to Hedera
 * @interface MessagePayload
 */
interface MessagePayload {
  Type: string;
  Message: string;
  Media?: string | null;
  IsThreadPost: boolean;
  ThreadIndex: number;
}

/**
 * Props for the AddToThread component
 * @interface AddToThreadProps
 */
interface AddToThreadProps {
  topicId: string;
  currentThreadIndex: number;
  onClose: () => void;
  onSuccess?: () => void;
}

/**
 * AddToThread Component
 * Handles adding a new post to an existing thread.
 * Implements a multi-step process:
 * 1. Upload Media (if any)
 * 2. Send Message to Thread Topic
 *
 * @component
 * @param {AddToThreadProps} props - Component props
 */
const AddToThread: React.FC<AddToThreadProps> = ({
  topicId,
  currentThreadIndex,
  onClose,
  onSuccess,
}) => {
  const [content, setContent] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);
  const [mediaId, setMediaId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(true);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const maxSize = 100 * 1024 * 1024; // 100 MB

  const { send } = useSendMessage();
  const { uploadToArweave } = useUploadToArweave();
  const { triggerRefresh } = useRefreshTrigger();

  // State to manage each step's status
  const [stepStatuses, setStepStatuses] = useState<AddToThreadStepStatuses>({
    arweave: undefined,
    message: { status: "idle", disabled: false },
  });

  // Auto-progression states
  const [autoProgress, setAutoProgress] = useState(false);
  const autoProgressRef = useRef(false);
  const [autoProgressDisabledByError, setAutoProgressDisabledByError] = useState(false);

  // Monitor step changes for auto-progression
  useEffect(() => {
    if (!autoProgressRef.current) return;

    // Check if arweave step completed and message should start
    if (
      stepStatuses.arweave?.status === "success" &&
      stepStatuses.message?.status === "idle" &&
      !stepStatuses.message?.disabled
    ) {
      console.log("Auto-progressing to send message...");
      setTimeout(() => {
        handleSendMessage();
      }, 1000);
    }
  }, [stepStatuses]);

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
    console.log("Resetting auto-progression");
    setAutoProgressDisabledByError(false);
    setAutoProgress(true);
    autoProgressRef.current = true;
    toast.info("Auto-progression re-enabled. Retrying...");

    // Find and retry the failed step
    setTimeout(() => {
      if (stepStatuses.arweave?.status === "error") {
        console.log("Retrying arweave upload...");
        handleArweaveUpload();
        return;
      }

      if (stepStatuses.message?.status === "error") {
        console.log("Retrying send message...");
        handleSendMessage();
        return;
      }

      // If no errors found, find the first idle step
      if (file && stepStatuses.arweave?.status === "idle" && !stepStatuses.arweave?.disabled) {
        handleArweaveUpload();
        return;
      }

      if (stepStatuses.message?.status === "idle" && !stepStatuses.message?.disabled) {
        handleSendMessage();
        return;
      }
    }, 500);
  };

  /**
   * Validates the message content
   */
  const validateContent = (): boolean => {
    if (!content.trim() && !file) {
      toast.error("Please enter a message or add media");
      return false;
    }

    if (file && file.size > maxSize) {
      toast.error("File exceeds 100MB limit");
      return false;
    }

    return true;
  };

  /**
   * Initiates the add-to-thread process after validation
   */
  const handleStartAddToThread = () => {
    if (!validateContent()) return;

    setIsEditing(false);

    if (file) {
      setStepStatuses({
        arweave: { status: "idle", disabled: false },
        message: { status: "idle", disabled: true },
      });
    } else {
      setStepStatuses({
        arweave: undefined,
        message: { status: "idle", disabled: false },
      });
    }
  };

  /**
   * Handles media upload to Arweave
   */
  const handleArweaveUpload = async () => {
    if (!file) return;

    setStepStatuses((prev) => ({
      ...prev,
      arweave: { status: "loading", disabled: true },
    }));

    try {
      const uploadedMediaId = await uploadToArweave(file);

      if (uploadedMediaId) {
        setMediaId(uploadedMediaId);
        setStepStatuses((prev) => ({
          ...prev,
          arweave: { status: "success", disabled: true },
          message: { status: "idle", disabled: false },
        }));
        toast.success("Media uploaded successfully.");
      } else {
        if (autoProgressRef.current) {
          disableAutoProgression("Media upload failed");
        }
        throw new Error("Failed to upload media.");
      }
    } catch {
      setStepStatuses((prev) => ({
        ...prev,
        arweave: { status: "error", disabled: false },
      }));
      toast.error("Failed to upload media.");
      if (autoProgressRef.current) {
        disableAutoProgression("Upload error");
      }
    }
  };

  /**
   * Sends the message to the thread topic
   */
  const handleSendMessage = async () => {
    setStepStatuses((prev) => ({
      ...prev,
      message: { status: "loading", disabled: true },
    }));

    try {
      const messagePayload: MessagePayload = {
        Type: "Thread",
        Message: content,
        Media: mediaId,
        IsThreadPost: true,
        ThreadIndex: currentThreadIndex + 1,
      };

      const sendingMessage = await send(topicId, messagePayload, "");

      if (
        sendingMessage?.receipt &&
        typeof sendingMessage.receipt === "object" &&
        "result" in sendingMessage.receipt &&
        (sendingMessage.receipt as { result: { toString: () => string } }).result.toString() === "SUCCESS"
      ) {
        setStepStatuses((prev) => ({
          ...prev,
          message: { status: "success", disabled: true },
        }));
        toast.success("Post added to thread successfully!");
        
        // Trigger refresh and close
        await new Promise((resolve) => setTimeout(resolve, 1000));
        triggerRefresh();
        eventService.emit("refreshExplorer");
        
        if (onSuccess) {
          onSuccess();
        } else {
          onClose();
        }
      } else {
        setStepStatuses((prev) => ({
          ...prev,
          message: { status: "error", disabled: false },
        }));
        toast.error("Failed to add post to thread.");
        if (autoProgressRef.current) {
          disableAutoProgression("Message send failed");
        }
      }
    } catch {
      setStepStatuses((prev) => ({
        ...prev,
        message: { status: "error", disabled: false },
      }));
      toast.error("Failed to add post to thread.");
      if (autoProgressRef.current) {
        disableAutoProgression("Message send error");
      }
    }
  };

  const onEmojiClick = (emojiData: { emoji: string }) => {
    setContent((prev) => prev + emojiData.emoji);
    setShowEmojiPicker(false);
  };

  /**
   * Renders a single step button with appropriate status indicators
   */
  const renderStepButton = (
    step: string,
    label: string,
    handler: () => void,
    status: StepStatus | undefined
  ) => {
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
        className="flex justify-between items-center p-3 rounded-xl transition-all duration-200 border border-cyan-400/20 shadow-lg shadow-cyan-400/5 bg-slate-800/20"
        key={step}
      >
        <div className="flex-1 pr-4">
          <div className="flex items-center gap-2 mb-1">
            <div className={`w-2 h-2 rounded-full ${statusDotClass}`} />
            <h3 className={`text-sm font-medium font-mono ${titleClass}`}>
              {label}
            </h3>
          </div>
          {status.status === "error" && (
            <p className="text-xs text-red-400/80 font-light">
              Request failed. Please try again.
            </p>
          )}
          {status.status === "loading" && (
            <p className="text-xs text-cyan-400/80 font-light animate-pulse">
              Processing...
            </p>
          )}
          {status.status === "success" && (
            <p className="text-xs text-green-400/80 font-light">
              Completed successfully
            </p>
          )}
        </div>
        <div className="flex-shrink-0">
          <button
            onClick={handler}
            disabled={status.disabled || status.status === "loading"}
            className={`px-4 py-1.5 rounded-lg transition-all duration-200 font-medium min-w-[80px] font-mono text-sm
                  flex items-center justify-center shadow-lg ${status.status === "success"
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
              <span>...</span>
            ) : status.status === "success" ? (
              <RiCheckLine className="text-lg" />
            ) : status.status === "error" ? (
              <RiRefreshLine className="text-lg" />
            ) : (
              <span>Start</span>
            )}
          </button>
        </div>
      </div>
    );
  };

  /**
   * Renders the processing steps view showing all steps and their current status
   */
  const renderProcessingSteps = () => (
    <div className="flex flex-col h-[70vh] bg-slate-900/80 backdrop-blur-md rounded-2xl overflow-hidden">
      <div className="px-6 py-4 border-b border-cyan-400/50 flex-shrink-0">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-xl font-mono text-cyan-400 bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
            Adding to Thread
          </h1>
        </div>

        {/* Auto-progress toggle */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-white/60 font-mono">Auto-progress</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const newAutoProgress = !autoProgress;
                setAutoProgress(newAutoProgress);
                autoProgressRef.current = newAutoProgress;
                if (newAutoProgress && !autoProgressDisabledByError) {
                  toast.info("Auto-progression enabled");

                  // Auto-start the first available step
                  setTimeout(() => {
                    if (file && stepStatuses.arweave?.status === "idle" && !stepStatuses.arweave?.disabled) {
                      console.log("Auto-starting arweave upload...");
                      handleArweaveUpload();
                    } else if (stepStatuses.message?.status === "idle" && !stepStatuses.message?.disabled) {
                      console.log("Auto-starting send message...");
                      handleSendMessage();
                    }
                  }, 500);
                }
              }}
              disabled={autoProgressDisabledByError}
              className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${autoProgress ? "bg-cyan-500" : "bg-slate-600"
                } ${autoProgressDisabledByError ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              <div
                className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${autoProgress ? "translate-x-5" : "translate-x-0.5"
                  }`}
              />
            </button>
            <span
              className={`text-xs font-mono px-2 py-1 rounded ${autoProgress
                ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30"
                : "bg-slate-600/20 text-slate-400 border border-slate-600/30"
                }`}
            >
              {autoProgress ? "ON" : "OFF"}
            </span>
            {autoProgressDisabledByError && (
              <button
                onClick={resetAutoProgression}
                className="text-xs font-mono px-2 py-1 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30 hover:bg-amber-500/30 transition-colors duration-200"
                title="Reset and retry"
              >
                Retry
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="p-4 space-y-3">
          {/* Message Preview */}
          <div className="p-3 bg-slate-800/50 rounded-xl border border-cyan-400/20 mb-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-mono bg-cyan-400/20 text-cyan-400 px-2 py-0.5 rounded-full">
                Post #{currentThreadIndex + 2}
              </span>
              {file && (
                <span className="text-xs font-mono bg-purple-400/20 text-purple-400 px-2 py-0.5 rounded-full">
                  + Media
                </span>
              )}
            </div>
            <p className="text-white/80 text-sm line-clamp-3">{content || "(Empty message)"}</p>
          </div>

          {/* Step buttons */}
          {file && renderStepButton(
            "arweave",
            "Upload Media",
            handleArweaveUpload,
            stepStatuses.arweave
          )}
          {renderStepButton(
            "message",
            "Add to Thread",
            handleSendMessage,
            stepStatuses.message
          )}

          <button
            onClick={onClose}
            className="w-full bg-slate-800 hover:bg-red-500/20 text-white py-2 mt-4 px-4 rounded-full border border-cyan-400/50 hover:border-red-400/50 transition-all duration-200 font-mono"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );

  /**
   * Renders the message composition form
   */
  const renderEditForm = () => (
    <div className="flex flex-col bg-slate-900/80 backdrop-blur-md rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-cyan-400/50">
        <h3 className="text-2xl font-mono text-cyan-400 bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
          Add to Thread
        </h3>
        <p className="text-sm text-white/60 mt-1 font-light">
          Continue your thread with a new post
        </p>
      </div>

      {/* Content Area */}
      <div className="p-6">
        {/* Post number indicator */}
        <div className="flex items-center gap-2 mb-4">
          <span className="text-sm font-mono bg-cyan-400/20 text-cyan-400 px-3 py-1 rounded-full">
            Post #{currentThreadIndex + 2}
          </span>
        </div>

        {/* Textarea */}
        <textarea
          className="w-full bg-transparent text-white text-lg border border-cyan-400/30
            focus:ring-1 focus:ring-cyan-400 outline-none resize-none
            placeholder:text-white/40 rounded-xl p-4"
          placeholder="Continue your thread..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          maxLength={850}
          rows={5}
          style={{ minHeight: "140px" }}
        />

        {/* Emoji and Media buttons */}
        <div className="flex items-center justify-between mt-2 px-1">
          <div className="flex gap-2">
            {/* Emoji Button */}
            <button
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className="p-2 hover:bg-cyan-400/10 rounded-full transition-colors group"
            >
              <BsEmojiSmile className="text-xl text-cyan-400 group-hover:text-blue-400" />
            </button>

            {/* Media Upload */}
            <label
              htmlFor="fileUploadAddThread"
              className="p-2 hover:bg-cyan-400/10 rounded-full transition-colors group cursor-pointer"
            >
              <MdOutlinePermMedia className="text-xl text-cyan-400 group-hover:text-blue-400" />
              <input
                type="file"
                id="fileUploadAddThread"
                className="hidden"
                accept="image/*"
                onChange={(e) => {
                  if (e.target.files?.[0]) {
                    setFile(e.target.files[0]);
                    e.target.value = "";
                  }
                }}
              />
            </label>
          </div>

          {/* Character count */}
          <div className={`text-xs font-mono ${content.length > 800 ? "text-red-400" : "text-white/50"}`}>
            {content.length}/850
          </div>
        </div>

        {/* Emoji Picker */}
        {showEmojiPicker && (
          <EmojiPickerPopup
            onEmojiClick={onEmojiClick}
            onClose={() => setShowEmojiPicker(false)}
          />
        )}

        {/* Media Preview */}
        {file && (
          <div className="mt-3 rounded-xl overflow-hidden border border-cyan-400/30">
            <div className="relative">
              <img
                src={URL.createObjectURL(file)}
                alt="Preview"
                className="w-full max-h-[200px] object-contain bg-black/20"
              />
            </div>
            <div className="p-2 border-t border-cyan-400/30 flex items-center justify-between">
              <p className="text-xs text-white/60 truncate">{file.name}</p>
              <button
                onClick={() => setFile(null)}
                className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1"
              >
                <RiDeleteBinLine />
                Remove
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Controls */}
      <div className="border-t border-cyan-400/50 bg-slate-900/95 backdrop-blur-sm">
        <div className="px-6 py-4 flex items-center justify-between">
          {/* Cancel button */}
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-mono text-white/60 hover:text-white transition-colors"
          >
            Cancel
          </button>

          {/* Add to Thread Button */}
          <button
            onClick={handleStartAddToThread}
            disabled={!content.trim() && !file}
            className={`px-8 py-2.5 font-semibold rounded-full transition-all
                duration-200 hover:shadow-lg active:scale-98 font-mono ${!content.trim() && !file
                ? "bg-gray-600 text-gray-400 cursor-not-allowed"
                : "bg-gradient-to-r from-cyan-400 to-blue-500 hover:scale-105 text-white shadow-lg shadow-cyan-400/25"
              }`}
          >
            Add to Thread
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="max-w-lg mx-auto bg-background rounded-lg shadow-xl p-3 text-text">
      {isEditing ? renderEditForm() : renderProcessingSteps()}
    </div>
  );
};

export default AddToThread;
