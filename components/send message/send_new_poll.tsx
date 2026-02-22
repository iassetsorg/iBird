import React, { useState, useRef, useEffect } from "react";
import { toast } from "react-toastify";
import { MdOutlinePermMedia } from "react-icons/md";

import { RiCheckLine, RiRefreshLine, RiDeleteBinLine } from "react-icons/ri";
import { BsEmojiSmile } from "react-icons/bs";
import EmojiPickerPopup from "../common/EmojiPickerPopup";

import useSendMessage from "../hooks/use_send_message";
import useCreateTopic from "../hooks/use_create_topic";
import useUploadToArweave from "../media/use_upload_to_arweave";
// import { useRefreshTrigger } from "../hooks/use_refresh_trigger";
import eventService from "../services/event_service";

// Default explorer topic (used as fallback if topicId prop is not provided)
const DEFAULT_EXPLORER_TOPIC = process.env.NEXT_PUBLIC_EXPLORER_ID || "";

/**
 * Represents the status and disabled state of a poll creation step
 * @interface StepStatus
 * @property {('idle' | 'loading' | 'success' | 'error')} status - Current status of the step
 * @property {boolean} disabled - Whether the step is currently disabled
 */
interface StepStatus {
  status: "idle" | "loading" | "success" | "error";
  disabled: boolean;
}

/**
 * Tracks the status of each step in the poll creation process
 * @interface PollStepStatuses
 */
interface PollStepStatuses {
  createTopic: StepStatus;
  publishExplore: StepStatus;
  arweave?: StepStatus; // Optional, only if file is uploaded
  sendPoll: StepStatus;
}

/**
 * Represents the structure of a poll message
 * @interface Message
 * @property {string} Message - The poll question
 * @property {string | null} [Media] - Optional Arweave media ID
 * @property {string | null} [Choice1-5] - Poll choices (1-5)
 */
interface Message {
  Message: string;
  Media?: string | null;
  Choice1?: string | null;
  Choice2?: string | null;
  Choice3?: string | null;
  Choice4?: string | null;
  Choice5?: string | null;
}

/**
 * Represents the transaction receipt structure
 * @interface TransactionReceipt
 * @property {Object} result - The result object with toString method
 */
interface TransactionReceipt {
  result: {
    toString: () => string;
  };
}

/**
 * SendNewPoll Component - Handles the creation and submission of new polls
 * @component
 * @param {Object} props - Component props
 * @param {() => void} props.onClose - Function to close the poll creation modal
 */
const SendNewPoll = ({
  onClose,
  topicId: propTopicId,
}: {
  onClose: () => void;
  topicId?: string;
}) => {
  const [question, setQuestion] = useState("");
  const [choices, setChoices] = useState<string[]>(["", ""]);
  const [file, setFile] = useState<File | null>(null);
  const [isEditing, setIsEditing] = useState(true);
  const [topicId, setTopicId] = useState(propTopicId || "");
  // const { triggerRefresh } = useRefreshTrigger();
  const maxSize = 100 * 1024 * 1024; // 100 MB

  const { send } = useSendMessage();
  const { create } = useCreateTopic();
  const { uploadToArweave } = useUploadToArweave();

  // Initialize step statuses
  const [stepStatuses, setStepStatuses] = useState<PollStepStatuses>({
    createTopic: { status: "idle", disabled: false },
    publishExplore: { status: "idle", disabled: true },
    arweave: file ? { status: "idle", disabled: true } : undefined,
    sendPoll: { status: "idle", disabled: true },
  });

  const uploadedMediaIdRef = useRef<string | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  // Auto-progression states
  const [autoProgress, setAutoProgress] = useState(false);
  const autoProgressRef = useRef(false);
  const [autoProgressDisabledByError, setAutoProgressDisabledByError] =
    useState(false);
  const [countdown, setCountdown] = useState(0);

  // Monitor step changes for auto-progression
  useEffect(() => {
    if (!autoProgressRef.current) return;

    // Check if createTopic step completed and publishExplore should start
    if (
      stepStatuses.createTopic?.status === "success" &&
      stepStatuses.publishExplore?.status === "idle" &&
      !stepStatuses.publishExplore?.disabled
    ) {
      console.log("Auto-progressing to publish explore...");
      setTimeout(() => {
        handlePublishExplore();
      }, 1000);
    }

    // Check if publishExplore step completed and next step should start
    if (stepStatuses.publishExplore?.status === "success") {
      if (
        file &&
        stepStatuses.arweave?.status === "idle" &&
        !stepStatuses.arweave?.disabled
      ) {
        console.log("Auto-progressing to arweave upload...");
        setTimeout(() => {
          handleUploadToArweave();
        }, 1000);
      } else if (
        !file &&
        stepStatuses.sendPoll?.status === "idle" &&
        !stepStatuses.sendPoll?.disabled
      ) {
        console.log("Auto-progressing to send poll...");
        setTimeout(() => {
          handleSendPoll();
        }, 1000);
      }
    }

    // Check if arweave step completed and sendPoll should start
    if (
      stepStatuses.arweave?.status === "success" &&
      stepStatuses.sendPoll?.status === "idle" &&
      !stepStatuses.sendPoll?.disabled
    ) {
      console.log("Auto-progressing to send poll...");
      setTimeout(() => {
        handleSendPoll();
      }, 1000);
    }
  }, [stepStatuses, file]);

  /**
   * Clears the uploaded file and resets related state
   */
  const clearFile = () => {
    setFile(null);
    uploadedMediaIdRef.current = null;
    setStepStatuses((prev) => {
      const newStatuses = { ...prev };
      delete newStatuses.arweave;
      if (newStatuses.sendPoll) {
        newStatuses.sendPoll = { ...newStatuses.sendPoll, disabled: false };
      }
      return newStatuses;
    });
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

    // Reset the disabled state
    setAutoProgressDisabledByError(false);

    // Enable auto-progression
    setAutoProgress(true);
    autoProgressRef.current = true;
    setCountdown(0);

    // Find the first available step to start
    const stepOrder = ["createTopic", "publishExplore", "arweave", "sendPoll"];

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
          case "createTopic":
            handleCreateTopic().catch((error) => {
              console.error("Auto-retry create topic error:", error);
              disableAutoProgression("Create topic retry error");
            });
            break;
          case "publishExplore":
            handlePublishExplore().catch((error) => {
              console.error("Auto-retry publish explore error:", error);
              disableAutoProgression("Publish explore retry error");
            });
            break;
          case "arweave":
            handleUploadToArweave().catch((error) => {
              console.error("Auto-retry upload error:", error);
              disableAutoProgression("Upload retry error");
            });
            break;
          case "sendPoll":
            handleSendPoll().catch((error) => {
              console.error("Auto-retry send poll error:", error);
              disableAutoProgression("Send poll retry error");
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
   * Validates poll inputs and initiates the poll creation process
   * Checks for:
   * - Valid question
   * - At least 2 choices
   * - File size limits
   */
  const handleStartPoll = () => {
    if (!question.trim()) {
      toast.error("Please enter a question for the poll.");
      return;
    }

    if (!choices[0].trim() || !choices[1].trim()) {
      toast.error("The first two choices are required.");
      return;
    }

    if (choices.length < 2) {
      toast.error("A minimum of two choices are required to create a poll.");
      return;
    }

    if (file && file.size > maxSize) {
      toast.error("The file exceeds 100MB.");
      return;
    }

    setIsEditing(false);

    setStepStatuses({
      createTopic: { status: "idle", disabled: false },
      publishExplore: { status: "idle", disabled: true },
      arweave: file ? { status: "idle", disabled: true } : undefined,
      sendPoll: { status: "idle", disabled: true },
    });
  };

  /**
   * Creates a new HCS topic for the poll
   * @returns {Promise<void>}
   */
  const handleCreateTopic = async () => {
    setStepStatuses((prev) => ({
      ...prev,
      createTopic: { status: "loading", disabled: true },
    }));

    try {
      const topic = await create("ibird Poll", "ibird Poll memo", false);
      if (topic) {
        setTopicId(topic);
        setStepStatuses((prev) => ({
          ...prev,
          createTopic: { status: "success", disabled: true },
          publishExplore: { status: "idle", disabled: false },
        }));
        toast.success("Poll topic created successfully.");
      } else {
        setStepStatuses((prev) => ({
          ...prev,
          createTopic: { status: "error", disabled: false },
        }));
        toast.error("Failed to create poll topic.");

        // Disable auto-progression on error
        if (autoProgressRef.current) {
          disableAutoProgression("Create topic failed");
        }
      }
    } catch {
      setStepStatuses((prev) => ({
        ...prev,
        createTopic: { status: "error", disabled: false },
      }));
      toast.error("Failed to create poll topic.");

      // Disable auto-progression on error
      if (autoProgressRef.current) {
        disableAutoProgression("Create topic error");
      }
    }
  };

  /**
   * Initiates the poll by sending the first message to the topic
   * @returns {Promise<void>}
   */

  const handlePublishExplore = async () => {
    setStepStatuses((prev) => ({
      ...prev,
      publishExplore: { status: "loading", disabled: true },
    }));

    try {
      const publishingOnExplore = {
        Type: "Poll",
        Poll: topicId,
      };

      const publishingExplore = await send(
        propTopicId || DEFAULT_EXPLORER_TOPIC,
        publishingOnExplore,
        ""
      );
      if (
        publishingExplore &&
        (
          publishingExplore.receipt as TransactionReceipt
        )?.result?.toString() === "SUCCESS"
      ) {
        setStepStatuses((prev) => ({
          ...prev,
          publishExplore: { status: "success", disabled: true },
          arweave: file ? { status: "idle", disabled: false } : undefined,
          sendPoll: !file ? { status: "idle", disabled: false } : prev.sendPoll,
        }));
        toast.success("Poll published on Explore successfully.");
      } else {
        setStepStatuses((prev) => ({
          ...prev,
          publishExplore: { status: "error", disabled: false },
        }));
        toast.error("Failed to publish on Explore.");

        // Disable auto-progression on error
        if (autoProgressRef.current) {
          disableAutoProgression("Publish explore failed");
        }
      }
    } catch {
      setStepStatuses((prev) => ({
        ...prev,
        publishExplore: { status: "error", disabled: false },
      }));
      toast.error("Failed to publish on Explore.");

      // Disable auto-progression on error
      if (autoProgressRef.current) {
        disableAutoProgression("Publish explore error");
      }
    }
  };

  const handleUploadToArweave = async () => {
    if (!file) return;

    setStepStatuses((prev) => ({
      ...prev,
      arweave: { status: "loading", disabled: true },
    }));

    try {
      const mediaId = await uploadToArweave(file);
      uploadedMediaIdRef.current = mediaId;

      if (mediaId) {
        setStepStatuses((prev) => ({
          ...prev,
          arweave: { status: "success", disabled: true },
          sendPoll: { status: "idle", disabled: false },
        }));
        toast.success("Media uploaded to Arweave successfully.");
      } else {
        setStepStatuses((prev) => ({
          ...prev,
          arweave: { status: "error", disabled: false },
        }));
        toast.error("Failed to upload media.");

        // Disable auto-progression on error
        if (autoProgressRef.current) {
          disableAutoProgression("Media upload failed");
        }
      }
    } catch {
      setStepStatuses((prev) => ({
        ...prev,
        arweave: { status: "error", disabled: false },
      }));
      toast.error("Failed to upload media.");

      // Disable auto-progression on error
      if (autoProgressRef.current) {
        disableAutoProgression("Upload error");
      }
    }
  };

  const handleSendPoll = async () => {
    setStepStatuses((prev) => ({
      ...prev,
      sendPoll: { status: "loading", disabled: true },
    }));

    try {
      const Message: Message = {
        Message: question,
        Media: uploadedMediaIdRef.current || null,
        Choice1: choices[0] || null,
        Choice2: choices[1] || null,
        Choice3: choices[2] || null,
        Choice4: choices[3] || null,
        Choice5: choices[4] || null,
      };

      // Send the poll message to the newly created poll topic, not the explorer topic
      const sendingMessage = await send(topicId, Message, "");
      if (
        sendingMessage &&
        (sendingMessage.receipt as TransactionReceipt)?.result?.toString() ===
        "SUCCESS"
      ) {
        setStepStatuses((prev) => ({
          ...prev,
          sendPoll: { status: "success", disabled: true },
        }));

        toast.success("Your poll sent to Hedera successfully!");
        onClose();
        await new Promise((resolve) => setTimeout(resolve, 2000));
        eventService.emit("refreshExplorer");
      } else {
        setStepStatuses((prev) => ({
          ...prev,
          sendPoll: { status: "error", disabled: false },
        }));
        toast.error("Failed to send poll.");

        // Disable auto-progression on error
        if (autoProgressRef.current) {
          disableAutoProgression("Send poll failed");
        }
      }
    } catch {
      setStepStatuses((prev) => ({
        ...prev,
        sendPoll: { status: "error", disabled: false },
      }));
      toast.error("Failed to send poll.");

      // Disable auto-progression on error
      if (autoProgressRef.current) {
        disableAutoProgression("Send poll error");
      }
    }
  };

  /**
   * Adds or removes poll choices
   * - Maximum 5 choices allowed
   * - Minimum 2 choices required
   * - First two choices cannot be removed
   */
  const addChoice = () => {
    if (choices.length < 5) {
      setChoices([...choices, ""]);
    }
  };

  const updateChoice = (index: number, value: string) => {
    const updatedChoices = [...choices];
    updatedChoices[index] = value;
    setChoices(updatedChoices);
  };

  const removeChoice = (index: number) => {
    if (choices.length <= 2) return;

    if (index < 2) return;

    const updatedChoices = [...choices];
    updatedChoices.splice(index, 1);
    setChoices(updatedChoices);
  };

  const onEmojiClick = (emojiData: { emoji: string }) => {
    setQuestion((prevQuestion) => prevQuestion + emojiData.emoji);
    setShowEmojiPicker(false);
  };

  /**
   * Renders the step-by-step poll creation process
   * Shows:
   * - Question preview
   * - Media preview (if any)
   * - Choices preview
   * - Processing steps with status indicators
   */
  const renderProcessingSteps = () => (
    <div className="flex flex-col h-[80vh] bg-slate-900/80 backdrop-blur-md rounded-2xl overflow-hidden">
      <div className="px-6 py-4 border-b border-cyan-400/50 flex-shrink-0">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-2xl font-mono text-cyan-400 bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
            Poll Workflow
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
                  const stepOrder = [
                    "createTopic",
                    "publishExplore",
                    "arweave",
                    "sendPoll",
                  ];

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
                        case "createTopic":
                          console.log("Auto-progression: Creating topic...");
                          handleCreateTopic().catch((error) => {
                            console.error("Auto-create topic error:", error);
                            disableAutoProgression("Create topic error");
                          });
                          break;
                        case "publishExplore":
                          console.log(
                            "Auto-progression: Publishing to explorer..."
                          );
                          handlePublishExplore().catch((error) => {
                            console.error("Auto-publish explore error:", error);
                            disableAutoProgression("Publish explore error");
                          });
                          break;
                        case "arweave":
                          console.log("Auto-progression: Uploading media...");
                          handleUploadToArweave().catch((error) => {
                            console.error("Auto-upload error:", error);
                            disableAutoProgression("Upload error");
                          });
                          break;
                        case "sendPoll":
                          console.log("Auto-progression: Sending poll...");
                          handleSendPoll().catch((error) => {
                            console.error("Auto-send poll error:", error);
                            disableAutoProgression("Send poll error");
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
          Processing your poll step by step
        </p>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="p-6">
          <div className="mb-6 p-4 bg-slate-800/80 backdrop-blur-sm rounded-xl border border-cyan-400/30 shadow-lg shadow-cyan-400/10">
            <p className="text-white break-words text-lg leading-relaxed font-light">
              {question}
            </p>
            {file && (
              <div className="mt-4 space-y-2">
                <div className="relative rounded-lg overflow-hidden">
                  <img
                    src={URL.createObjectURL(file)}
                    alt="Preview"
                    className="w-full max-h-[300px] object-contain bg-black/5"
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
                    Media upload complete. CID will be linked to this poll.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Choices Preview */}
          <div className="mb-6 p-4 bg-slate-800/80 backdrop-blur-sm rounded-xl border border-cyan-400/30 shadow-lg shadow-cyan-400/10">
            <h3 className="text-lg font-medium mb-3 text-cyan-400">Choices:</h3>
            <ul className="list-decimal list-inside space-y-1">
              {choices.map((choice, index) => (
                <li key={index} className="text-white">
                  {choice}
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-3">
            {renderStepButton(
              "createTopic",
              "Create Poll Topic",
              handleCreateTopic
            )}
            {renderStepButton(
              "publishExplore",
              "Publish to Explorer",
              handlePublishExplore
            )}
            {file &&
              renderStepButton(
                "arweave",
                "Upload Media To Arweave",
                handleUploadToArweave
              )}
            {renderStepButton("sendPoll", "Send Poll", handleSendPoll)}
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
   * Renders a single step button with appropriate status styling
   * @param {keyof PollStepStatuses} step - The step identifier
   * @param {string} label - Display label for the step
   * @param {() => void} handler - Click handler for the step
   */
  const renderStepButton = (
    step: keyof PollStepStatuses,
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
        className="flex justify-between items-center p-4 rounded-xl transition-all duration-200 border border-cyan-400/20 shadow-lg shadow-cyan-400/5 bg-slate-800/20"
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
        <div className="flex-shrink-0">
          <button
            onClick={handler}
            disabled={status.disabled || status.status === "loading"}
            className={`px-6 py-2 rounded-lg transition-all duration-200 font-medium min-w-[100px] font-mono
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
   * Renders the poll creation form
   * Features:
   * - Question input with character limit
   * - Choice management
   * - Media upload
   * - Input validation
   */
  const renderEditForm = () => (
    <div className="flex flex-col bg-slate-900/80 backdrop-blur-md rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-cyan-400/50">
        <h3 className="text-2xl font-mono text-cyan-400 bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
          Create a Poll
        </h3>
        <p className="text-sm text-white/60 mt-1 font-light">
          Ask a question and let the community vote
        </p>
      </div>

      {/* Scrollable Content Area */}
      <div className="max-h-[60vh] overflow-y-auto">
        {/* Compose Area */}
        <div className="p-6">
          {/* Question Input */}
          <div className="mb-4">
            <textarea
              className="w-full bg-transparent text-white text-lg border border-cyan-400/50
                focus:ring-1 focus:ring-cyan-400 outline-none resize-none h-auto
                placeholder:text-white/40 rounded-xl p-4"
              placeholder="What's your poll question?"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              maxLength={650}
              rows={5}
              style={{
                minHeight: "160px",
                maxHeight: "400px",
                overflow: "auto",
              }}
            />

            {/* Emoji and Media buttons - positioned below textarea */}
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
                        e.target.value = "";
                      }
                    }}
                  />
                </label>
              </div>

              {/* Character limit warning */}
              {question.length > 600 && (
                <div className="text-xs text-red-400/80 bg-red-500/10 px-2 py-1 rounded-full">
                  {650 - question.length} characters left
                </div>
              )}
            </div>

            {/* Emoji Picker Popup */}
            {showEmojiPicker && (
              <EmojiPickerPopup
                onEmojiClick={onEmojiClick}
                onClose={() => setShowEmojiPicker(false)}
              />
            )}
          </div>

          {/* Choices Input */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-white mb-2">
              Choices:
            </label>
            {choices.map((choice, index) => (
              <div key={index} className="flex flex-col mb-3">
                <div className="flex items-center">
                  <input
                    type="text"
                    className={`flex-1 px-4 py-2 rounded-lg text-base ${index < 2
                      ? "bg-slate-800/80 text-white"
                      : "bg-slate-800/80 text-white focus:outline-none focus:ring-2 focus:ring-cyan-400"
                      }`}
                    value={choice}
                    onChange={(e) => updateChoice(index, e.target.value)}
                    maxLength={50}
                    placeholder={`Choice ${index + 1}`}
                  />
                  {index >= 2 && (
                    <button
                      className="ml-2 text-red-400 hover:text-red-300 transition duration-200"
                      onClick={() => removeChoice(index)}
                      title="Remove choice"
                    >
                      <RiDeleteBinLine className="text-xl" />
                    </button>
                  )}
                </div>
                {/* Add character counter */}
                <div
                  className={`text-right text-xs mt-1 ${choice.length > 40
                    ? "text-red-400"
                    : choice.length > 30
                      ? "text-cyan-400"
                      : "text-white/50"
                    }`}
                >
                  {choice.length}/50
                </div>
              </div>
            ))}
            {choices.length < 5 && (
              <button
                className="mt-2 px-4 py-2 bg-gradient-to-r from-cyan-400 to-blue-500 text-white rounded-full hover:scale-105 transition duration-300 font-mono"
                onClick={addChoice}
              >
                Add Choice
              </button>
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
                    Media upload complete. CID will be linked to this poll.
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

      {/* Bottom Controls */}
      <div className="border-t border-cyan-400/50 bg-slate-900/95 backdrop-blur-sm">
        <div className="px-6 py-4 flex items-center justify-between">
          {/* Character Count */}
          <div
            className={`text-sm font-mono ${question.length > 600
              ? "text-red-400"
              : question.length > 500
                ? "text-cyan-400"
                : "text-white/50"
              }`}
          >
            {question.length}/650
          </div>

          {/* Create Poll Button */}
          <button
            onClick={handleStartPoll}
            disabled={
              !question.trim() ||
              !choices[0].trim() ||
              !choices[1].trim() ||
              choices.length < 2
            }
            className={`px-8 py-2.5 font-semibold rounded-full transition-all
                duration-200 hover:shadow-lg active:scale-98 font-mono ${!question.trim() ||
                !choices[0].trim() ||
                !choices[1].trim() ||
                choices.length < 2
                ? "bg-gray-600 text-gray-400 cursor-not-allowed"
                : "bg-gradient-to-r from-cyan-400 to-blue-500 hover:scale-105 text-white shadow-lg shadow-cyan-400/25"
              }`}
          >
            Create Poll
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="max-w-md mx-auto w-full">
      {isEditing ? renderEditForm() : renderProcessingSteps()}
    </div>
  );
};

export default SendNewPoll;
