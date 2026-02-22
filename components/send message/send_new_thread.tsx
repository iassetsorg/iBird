import React, { useState, useRef, useEffect } from "react";
import { toast } from "react-toastify";
import { MdOutlinePermMedia } from "react-icons/md";
import { RiDeleteBinLine, RiCheckLine, RiRefreshLine } from "react-icons/ri";
import { FiPlus, FiChevronUp, FiChevronDown } from "react-icons/fi";
import useSendMessage from "../hooks/use_send_message";
import useCreateTopic from "../hooks/use_create_topic";
import useUploadToArweave from "../media/use_upload_to_arweave";
import eventService from "../services/event_service";
import { BsEmojiSmile } from "react-icons/bs";
import EmojiPickerPopup from "../common/EmojiPickerPopup";

// Default explorer topic (used as fallback if topicId prop is not provided)
const DEFAULT_EXPLORER_TOPIC = process.env.NEXT_PUBLIC_EXPLORER_ID || "";

/**
 * Represents the status and disabled state of a single step in the thread creation process
 * @interface StepStatus
 */
interface StepStatus {
  status: "idle" | "loading" | "success" | "error";
  disabled: boolean;
}

/**
 * Represents a single message in the thread with its content and media
 * @interface ThreadMessage
 */
interface ThreadMessage {
  id: string;
  content: string;
  file: File | null;
  mediaId: string | null;
}

/**
 * Step statuses for each message in the thread
 * @interface MessageStepStatuses
 */
interface MessageStepStatuses {
  arweave?: StepStatus;
  send: StepStatus;
}

/**
 * Tracks the status of all steps in the thread creation workflow
 * @interface ThreadStepStatuses
 */
interface ThreadStepStatuses {
  createTopic: StepStatus;
  explorer: StepStatus;
  messages: {
    [messageId: string]: MessageStepStatuses;
  };
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
 * Generate a unique ID for messages
 */
const generateId = () => Math.random().toString(36).substr(2, 9);

/**
 * SendNewThread Component
 * Handles the creation and posting of new threads with multiple messages and optional media attachments.
 * Implements a multi-step process similar to Twitter threads:
 * 1. Create Topic
 * 2. Publish to Explorer
 * 3. For each message: Upload Media (if any) -> Send Message
 *
 * @component
 * @param {Object} props
 * @param {Function} props.onClose - Callback function to close the thread creation modal
 * @param {string} props.topicId - Optional topic ID to publish to (defaults to explorer topic)
 */
const SendNewThread = ({
  onClose,
  topicId,
}: {
  onClose: () => void;
  topicId?: string;
}) => {
  // Initial message state with one empty message
  const [threadMessages, setThreadMessages] = useState<ThreadMessage[]>([
    { id: generateId(), content: "", file: null, mediaId: null }
  ]);
  
  const [isEditing, setIsEditing] = useState(true);
  const [currentEmojiPickerIndex, setCurrentEmojiPickerIndex] = useState<number | null>(null);
  const maxSize = 100 * 1024 * 1024; // 100 MB

  const { send } = useSendMessage();
  const { create } = useCreateTopic();
  const { uploadToArweave } = useUploadToArweave();

  const [topic, setTopic] = useState("");

  // State to manage each step's status
  const [stepStatuses, setStepStatuses] = useState<ThreadStepStatuses>({
    createTopic: { status: "idle", disabled: false },
    explorer: { status: "idle", disabled: true },
    messages: {},
  });

  // Auto-progression states
  const [autoProgress, setAutoProgress] = useState(false);
  const autoProgressRef = useRef(false);
  const [autoProgressDisabledByError, setAutoProgressDisabledByError] = useState(false);

  // Monitor step changes for auto-progression
  useEffect(() => {
    if (!autoProgressRef.current) return;

    // Check if createTopic step completed and explorer should start
    if (
      stepStatuses.createTopic?.status === "success" &&
      stepStatuses.explorer?.status === "idle" &&
      !stepStatuses.explorer?.disabled
    ) {
      console.log("Auto-progressing to explorer post...");
      setTimeout(() => {
        handleExplorerPost();
      }, 1000);
    }

    // Check if explorer step completed and first message should start
    if (
      stepStatuses.explorer?.status === "success" &&
      threadMessages.length > 0
    ) {
      const firstMsg = threadMessages[0];
      const firstMsgStatus = stepStatuses.messages[firstMsg.id];
      
      if (firstMsgStatus) {
        // If has media and arweave is ready
        if (firstMsg.file && firstMsgStatus.arweave?.status === "idle" && !firstMsgStatus.arweave?.disabled) {
          console.log("Auto-progressing to first message arweave upload...");
          setTimeout(() => {
            handleArweaveUpload(firstMsg.id);
          }, 1000);
        }
        // If no media and send is ready
        else if (!firstMsg.file && firstMsgStatus.send?.status === "idle" && !firstMsgStatus.send?.disabled) {
          console.log("Auto-progressing to first message send...");
          setTimeout(() => {
            handleSendMessage(firstMsg.id, 0);
          }, 1000);
        }
      }
    }

    // Check for completed arweave uploads that should trigger sends
    threadMessages.forEach((msg, index) => {
      const msgStatus = stepStatuses.messages[msg.id];
      if (msgStatus?.arweave?.status === "success" && msgStatus?.send?.status === "idle" && !msgStatus?.send?.disabled) {
        console.log(`Auto-progressing to message ${index + 1} send...`);
        setTimeout(() => {
          handleSendMessage(msg.id, index);
        }, 1000);
      }
    });

    // Check for completed sends that should trigger next message
    threadMessages.forEach((msg, index) => {
      const msgStatus = stepStatuses.messages[msg.id];
      if (msgStatus?.send?.status === "success" && index < threadMessages.length - 1) {
        const nextMsg = threadMessages[index + 1];
        const nextMsgStatus = stepStatuses.messages[nextMsg.id];
        
        if (nextMsgStatus) {
          if (nextMsg.file && nextMsgStatus.arweave?.status === "idle" && !nextMsgStatus.arweave?.disabled) {
            console.log(`Auto-progressing to message ${index + 2} arweave upload...`);
            setTimeout(() => {
              handleArweaveUpload(nextMsg.id);
            }, 1000);
          } else if (!nextMsg.file && nextMsgStatus.send?.status === "idle" && !nextMsgStatus.send?.disabled) {
            console.log(`Auto-progressing to message ${index + 2} send...`);
            setTimeout(() => {
              handleSendMessage(nextMsg.id, index + 1);
            }, 1000);
          }
        }
      }
    });
  }, [stepStatuses, threadMessages]);

  /**
   * Adds a new message to the thread
   */
  const addMessage = () => {
    setThreadMessages([
      ...threadMessages,
      { id: generateId(), content: "", file: null, mediaId: null }
    ]);
  };

  /**
   * Updates a specific message in the thread
   */
  const updateMessage = (id: string, updates: Partial<ThreadMessage>) => {
    setThreadMessages(threadMessages.map(msg => 
      msg.id === id ? { ...msg, ...updates } : msg
    ));
  };

  /**
   * Removes a message from the thread
   */
  const removeMessage = (id: string) => {
    if (threadMessages.length > 1) {
      setThreadMessages(threadMessages.filter(msg => msg.id !== id));
    } else {
      toast.error("Thread must have at least one message");
    }
  };

  /**
   * Moves a message up in the thread order
   */
  const moveMessageUp = (index: number) => {
    if (index > 0) {
      const newMessages = [...threadMessages];
      [newMessages[index - 1], newMessages[index]] = [newMessages[index], newMessages[index - 1]];
      setThreadMessages(newMessages);
    }
  };

  /**
   * Moves a message down in the thread order
   */
  const moveMessageDown = (index: number) => {
    if (index < threadMessages.length - 1) {
      const newMessages = [...threadMessages];
      [newMessages[index], newMessages[index + 1]] = [newMessages[index + 1], newMessages[index]];
      setThreadMessages(newMessages);
    }
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
    console.log("Resetting auto-progression");
    setAutoProgressDisabledByError(false);
    setAutoProgress(true);
    autoProgressRef.current = true;
    toast.info("Auto-progression re-enabled. Retrying...");
    
    // Find and retry the failed step
    setTimeout(() => {
      // Check createTopic
      if (stepStatuses.createTopic?.status === "error") {
        console.log("Retrying createTopic...");
        handleCreateTopic();
        return;
      }
      
      // Check explorer
      if (stepStatuses.explorer?.status === "error") {
        console.log("Retrying explorer post...");
        handleExplorerPost();
        return;
      }
      
      // Check message steps
      for (let i = 0; i < threadMessages.length; i++) {
        const msg = threadMessages[i];
        const msgStatus = stepStatuses.messages[msg.id];
        
        if (msgStatus?.arweave?.status === "error") {
          console.log(`Retrying message ${i + 1} arweave upload...`);
          handleArweaveUpload(msg.id);
          return;
        }
        
        if (msgStatus?.send?.status === "error") {
          console.log(`Retrying message ${i + 1} send...`);
          handleSendMessage(msg.id, i);
          return;
        }
      }
      
      // If no errors found, find the first idle step that's not disabled
      if (stepStatuses.createTopic?.status === "idle" && !stepStatuses.createTopic?.disabled) {
        handleCreateTopic();
        return;
      }
      
      if (stepStatuses.explorer?.status === "idle" && !stepStatuses.explorer?.disabled) {
        handleExplorerPost();
        return;
      }
      
      for (let i = 0; i < threadMessages.length; i++) {
        const msg = threadMessages[i];
        const msgStatus = stepStatuses.messages[msg.id];
        
        if (msg.file && msgStatus?.arweave?.status === "idle" && !msgStatus?.arweave?.disabled) {
          handleArweaveUpload(msg.id);
          return;
        }
        
        if (msgStatus?.send?.status === "idle" && !msgStatus?.send?.disabled) {
          handleSendMessage(msg.id, i);
          return;
        }
      }
    }, 500);
  };

  /**
   * Validates all messages in the thread
   */
  const validateThread = (): boolean => {
    // Check if at least one message has content
    const hasContent = threadMessages.some(msg => msg.content.trim());
    if (!hasContent) {
      toast.error("Please enter at least one message");
      return false;
    }

    // Check file sizes
    for (const msg of threadMessages) {
      if (msg.file && msg.file.size > maxSize) {
        toast.error(`File in message exceeds 100MB limit`);
        return false;
      }
    }

    return true;
  };

  /**
   * Initiates the thread creation process after validation
   */
  const handleStartThread = () => {
    if (!validateThread()) return;

    setIsEditing(false);

    // Initialize step statuses for all messages
    const messageStatuses: { [key: string]: MessageStepStatuses } = {};
    threadMessages.forEach((msg, index) => {
      messageStatuses[msg.id] = {
        arweave: msg.file ? { status: "idle", disabled: index > 0 || !msg.file } : undefined,
        send: { status: "idle", disabled: true },
      };
    });

    setStepStatuses({
      createTopic: { status: "idle", disabled: false },
      explorer: { status: "idle", disabled: true },
      messages: messageStatuses,
    });
  };

  /**
   * Creates a new topic on Hedera for the thread
   */
  const handleCreateTopic = async () => {
    setStepStatuses((prev) => ({
      ...prev,
      createTopic: { status: "loading", disabled: true },
    }));

    try {
      const topicIdResult = await create("ibird Thread", "ibird Thread", false);

      if (topicIdResult) {
        setTopic(topicIdResult);
        setStepStatuses((prev) => ({
          ...prev,
          createTopic: { status: "success", disabled: true },
          explorer: { status: "idle", disabled: false },
        }));
        toast.success("Thread topic created successfully.");
      } else {
        setStepStatuses((prev) => ({
          ...prev,
          createTopic: { status: "error", disabled: false },
        }));
        toast.error("Failed to create thread topic.");
        if (autoProgressRef.current) {
          disableAutoProgression("Create topic failed");
        }
      }
    } catch {
      setStepStatuses((prev) => ({
        ...prev,
        createTopic: { status: "error", disabled: false },
      }));
      toast.error("Failed to create thread topic.");
      if (autoProgressRef.current) {
        disableAutoProgression("Create topic error");
      }
    }
  };

  /**
   * Publishes thread reference to explorer topic
   */
  const handleExplorerPost = async () => {
    setStepStatuses((prev) => ({
      ...prev,
      explorer: { status: "loading", disabled: true },
    }));

    try {
      const publishingOnExplorer = {
        Type: "Thread",
        Thread: topic,
      };

      const publishingExplorer = await send(
        topicId || DEFAULT_EXPLORER_TOPIC,
        publishingOnExplorer,
        ""
      );

      if (
        publishingExplorer?.receipt &&
        typeof publishingExplorer.receipt === "object" &&
        "result" in publishingExplorer.receipt &&
        (publishingExplorer.receipt as { result: { toString: () => string } }).result.toString() === "SUCCESS"
      ) {
        // Enable first message's arweave or send step
        const firstMsg = threadMessages[0];
        setStepStatuses((prev) => ({
          ...prev,
          explorer: { status: "success", disabled: true },
          messages: {
            ...prev.messages,
            [firstMsg.id]: {
              ...prev.messages[firstMsg.id],
              arweave: firstMsg.file ? { status: "idle", disabled: false } : undefined,
              send: { status: "idle", disabled: !!firstMsg.file },
            },
          },
        }));
        toast.success("Published to explorer successfully.");
      } else {
        setStepStatuses((prev) => ({
          ...prev,
          explorer: { status: "error", disabled: false },
        }));
        toast.error("Failed to publish to explorer.");
        if (autoProgressRef.current) {
          disableAutoProgression("Explorer post failed");
        }
      }
    } catch {
      setStepStatuses((prev) => ({
        ...prev,
        explorer: { status: "error", disabled: false },
      }));
      toast.error("Failed to publish to explorer.");
      if (autoProgressRef.current) {
        disableAutoProgression("Explorer post error");
      }
    }
  };

  /**
   * Uploads media to Arweave for a specific message
   */
  const handleArweaveUpload = async (messageId: string) => {
    const msg = threadMessages.find(m => m.id === messageId);
    if (!msg?.file) return;

    setStepStatuses((prev) => ({
      ...prev,
      messages: {
        ...prev.messages,
        [messageId]: {
          ...prev.messages[messageId],
          arweave: { status: "loading", disabled: true },
        },
      },
    }));

    try {
      const mediaId = await uploadToArweave(msg.file);
      
      // Update message with mediaId
      updateMessage(messageId, { mediaId });

      if (mediaId) {
        setStepStatuses((prev) => ({
          ...prev,
          messages: {
            ...prev.messages,
            [messageId]: {
              ...prev.messages[messageId],
              arweave: { status: "success", disabled: true },
              send: { status: "idle", disabled: false },
            },
          },
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
        messages: {
          ...prev.messages,
          [messageId]: {
            ...prev.messages[messageId],
            arweave: { status: "error", disabled: false },
          },
        },
      }));
      toast.error("Failed to upload media.");
      if (autoProgressRef.current) {
        disableAutoProgression("Upload error");
      }
    }
  };

  /**
   * Sends a message to the thread topic
   */
  const handleSendMessage = async (messageId: string, index: number) => {
    const msg = threadMessages.find(m => m.id === messageId);
    if (!msg) return;

    setStepStatuses((prev) => ({
      ...prev,
      messages: {
        ...prev.messages,
        [messageId]: {
          ...prev.messages[messageId],
          send: { status: "loading", disabled: true },
        },
      },
    }));

    try {
      const messagePayload: MessagePayload = {
        Type: "Thread",
        Message: msg.content,
        Media: msg.mediaId,
        IsThreadPost: true,
        ThreadIndex: index,
      };

      const sendingMessage = await send(topic, messagePayload, "");

      if (
        sendingMessage?.receipt &&
        typeof sendingMessage.receipt === "object" &&
        "result" in sendingMessage.receipt &&
        (sendingMessage.receipt as { result: { toString: () => string } }).result.toString() === "SUCCESS"
      ) {
        // Enable next message's step if exists
        const isLastMessage = index === threadMessages.length - 1;
        
        if (isLastMessage) {
          // All messages sent successfully
          setStepStatuses((prev) => ({
            ...prev,
            messages: {
              ...prev.messages,
              [messageId]: {
                ...prev.messages[messageId],
                send: { status: "success", disabled: true },
              },
            },
          }));
          toast.success("Thread published successfully!");
          onClose();
          await new Promise((resolve) => setTimeout(resolve, 2000));
          eventService.emit("refreshExplorer");
        } else {
          // Enable next message
          const nextMsg = threadMessages[index + 1];
          setStepStatuses((prev) => ({
            ...prev,
            messages: {
              ...prev.messages,
              [messageId]: {
                ...prev.messages[messageId],
                send: { status: "success", disabled: true },
              },
              [nextMsg.id]: {
                ...prev.messages[nextMsg.id],
                arweave: nextMsg.file ? { status: "idle", disabled: false } : undefined,
                send: { status: "idle", disabled: !!nextMsg.file },
              },
            },
          }));
          toast.success(`Message ${index + 1} sent successfully.`);
        }
      } else {
        setStepStatuses((prev) => ({
          ...prev,
          messages: {
            ...prev.messages,
            [messageId]: {
              ...prev.messages[messageId],
              send: { status: "error", disabled: false },
            },
          },
        }));
        toast.error("Failed to send message.");
        if (autoProgressRef.current) {
          disableAutoProgression("Message send failed");
        }
      }
    } catch {
      setStepStatuses((prev) => ({
        ...prev,
        messages: {
          ...prev.messages,
          [messageId]: {
            ...prev.messages[messageId],
            send: { status: "error", disabled: false },
          },
        },
      }));
      toast.error("Failed to send message.");
      if (autoProgressRef.current) {
        disableAutoProgression("Message send error");
      }
    }
  };

  const onEmojiClick = (emojiData: { emoji: string }, messageId: string) => {
    updateMessage(messageId, {
      content: threadMessages.find(m => m.id === messageId)?.content + emojiData.emoji || emojiData.emoji
    });
    setCurrentEmojiPickerIndex(null);
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
    <div className="flex flex-col h-[80vh] bg-slate-900/80 backdrop-blur-md rounded-2xl overflow-hidden">
      <div className="px-6 py-4 border-b border-cyan-400/50 flex-shrink-0">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-xl font-mono text-cyan-400 bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
            Publishing Thread ({threadMessages.length} messages)
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
                    // Check if createTopic is ready
                    if (stepStatuses.createTopic?.status === "idle" && !stepStatuses.createTopic?.disabled) {
                      console.log("Auto-starting createTopic...");
                      handleCreateTopic();
                    }
                    // Check if explorer is ready
                    else if (stepStatuses.explorer?.status === "idle" && !stepStatuses.explorer?.disabled) {
                      console.log("Auto-starting explorer post...");
                      handleExplorerPost();
                    }
                    // Check for first message step
                    else if (stepStatuses.explorer?.status === "success" && threadMessages.length > 0) {
                      const firstMsg = threadMessages[0];
                      const firstMsgStatus = stepStatuses.messages[firstMsg.id];
                      if (firstMsgStatus) {
                        if (firstMsg.file && firstMsgStatus.arweave?.status === "idle" && !firstMsgStatus.arweave?.disabled) {
                          console.log("Auto-starting first message arweave...");
                          handleArweaveUpload(firstMsg.id);
                        } else if (!firstMsg.file && firstMsgStatus.send?.status === "idle" && !firstMsgStatus.send?.disabled) {
                          console.log("Auto-starting first message send...");
                          handleSendMessage(firstMsg.id, 0);
                        }
                      }
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
          {/* Initial steps */}
          {renderStepButton("createTopic", "Create Thread Topic", handleCreateTopic, stepStatuses.createTopic)}
          {renderStepButton("explorer", "Publish to Explorer", handleExplorerPost, stepStatuses.explorer)}

          {/* Message steps */}
          <div className="mt-4">
            <h4 className="text-sm font-mono text-cyan-400/80 mb-2">Messages</h4>
            {threadMessages.map((msg, index) => (
              <div key={msg.id} className="mb-4 relative">
                {/* Vertical connector line */}
                {index > 0 && (
                  <div className="absolute left-4 -top-4 w-0.5 h-4 bg-cyan-400/30" />
                )}
                
                {/* Message preview card */}
                <div className="p-3 bg-slate-800/50 rounded-xl border border-cyan-400/20 mb-2">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-mono bg-cyan-400/20 text-cyan-400 px-2 py-0.5 rounded-full">
                      {index + 1}/{threadMessages.length}
                    </span>
                    {msg.file && (
                      <span className="text-xs font-mono bg-purple-400/20 text-purple-400 px-2 py-0.5 rounded-full">
                        + Media
                      </span>
                    )}
                  </div>
                  <p className="text-white/80 text-sm line-clamp-2">{msg.content || "(Empty message)"}</p>
                </div>

                {/* Message step buttons */}
                <div className="space-y-2 pl-4 border-l-2 border-cyan-400/30">
                  {msg.file && renderStepButton(
                    `arweave-${msg.id}`,
                    "Upload Media",
                    () => handleArweaveUpload(msg.id),
                    stepStatuses.messages[msg.id]?.arweave
                  )}
                  {renderStepButton(
                    `send-${msg.id}`,
                    "Send Message",
                    () => handleSendMessage(msg.id, index),
                    stepStatuses.messages[msg.id]?.send
                  )}
                </div>
              </div>
            ))}
          </div>

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
   * Renders the message composer for a single message in the thread
   */
  const renderMessageComposer = (msg: ThreadMessage, index: number) => (
    <div key={msg.id} className="relative">
      {/* Vertical connector line */}
      {index > 0 && (
        <div className="absolute left-6 -top-3 w-0.5 h-6 bg-gradient-to-b from-cyan-400/50 to-cyan-400/20" />
      )}

      <div className={`bg-slate-800/50 backdrop-blur-sm rounded-xl border border-cyan-400/30 p-4 ${index > 0 ? 'mt-3' : ''}`}>
        {/* Message header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-mono bg-cyan-400/20 text-cyan-400 px-3 py-1 rounded-full">
              {index + 1}
            </span>
            {index === 0 && (
              <span className="text-xs text-cyan-400/60 font-light">First message in thread</span>
            )}
          </div>
          
          {/* Move and delete buttons */}
          <div className="flex items-center gap-1">
            {index > 0 && (
              <button
                onClick={() => moveMessageUp(index)}
                className="p-1.5 hover:bg-cyan-400/10 rounded-lg transition-colors text-cyan-400/60 hover:text-cyan-400"
                title="Move up"
              >
                <FiChevronUp className="text-lg" />
              </button>
            )}
            {index < threadMessages.length - 1 && (
              <button
                onClick={() => moveMessageDown(index)}
                className="p-1.5 hover:bg-cyan-400/10 rounded-lg transition-colors text-cyan-400/60 hover:text-cyan-400"
                title="Move down"
              >
                <FiChevronDown className="text-lg" />
              </button>
            )}
            {threadMessages.length > 1 && (
              <button
                onClick={() => removeMessage(msg.id)}
                className="p-1.5 hover:bg-red-500/10 rounded-lg transition-colors text-red-400/60 hover:text-red-400"
                title="Remove message"
              >
                <RiDeleteBinLine className="text-lg" />
              </button>
            )}
          </div>
        </div>

        {/* Textarea */}
        <textarea
          className="w-full bg-transparent text-white text-lg border border-cyan-400/30
            focus:ring-1 focus:ring-cyan-400 outline-none resize-none
            placeholder:text-white/40 rounded-xl p-4"
          placeholder={index === 0 ? "Start your thread..." : "Continue your thread..."}
          value={msg.content}
          onChange={(e) => updateMessage(msg.id, { content: e.target.value })}
          maxLength={850}
          rows={5}
          style={{ minHeight: "140px" }}
        />

        {/* Emoji and Media buttons */}
        <div className="flex items-center justify-between mt-2 px-1">
          <div className="flex gap-2">
            {/* Emoji Button */}
            <button
              onClick={() => setCurrentEmojiPickerIndex(currentEmojiPickerIndex === index ? null : index)}
              className="p-2 hover:bg-cyan-400/10 rounded-full transition-colors group"
            >
              <BsEmojiSmile className="text-xl text-cyan-400 group-hover:text-blue-400" />
            </button>

            {/* Media Upload */}
            <label
              htmlFor={`fileUpload-${msg.id}`}
              className="p-2 hover:bg-cyan-400/10 rounded-full transition-colors group cursor-pointer"
            >
              <MdOutlinePermMedia className="text-xl text-cyan-400 group-hover:text-blue-400" />
              <input
                type="file"
                id={`fileUpload-${msg.id}`}
                className="hidden"
                accept="image/*"
                onChange={(e) => {
                  if (e.target.files?.[0]) {
                    updateMessage(msg.id, { file: e.target.files[0] });
                    e.target.value = "";
                  }
                }}
              />
            </label>
          </div>

          {/* Character count */}
          <div className={`text-xs font-mono ${msg.content.length > 800 ? "text-red-400" : "text-white/50"}`}>
            {msg.content.length}/850
          </div>
        </div>

        {/* Emoji Picker */}
        {currentEmojiPickerIndex === index && (
          <EmojiPickerPopup
            onEmojiClick={(emojiData) => onEmojiClick(emojiData, msg.id)}
            onClose={() => setCurrentEmojiPickerIndex(null)}
          />
        )}

        {/* Media Preview */}
        {msg.file && (
          <div className="mt-3 rounded-xl overflow-hidden border border-cyan-400/30">
            <div className="relative">
              <img
                src={URL.createObjectURL(msg.file)}
                alt="Preview"
                className="w-full max-h-[200px] object-contain bg-black/20"
              />
            </div>
            <div className="p-2 border-t border-cyan-400/30 flex items-center justify-between">
              <p className="text-xs text-white/60 truncate">{msg.file.name}</p>
              <button
                onClick={() => updateMessage(msg.id, { file: null })}
                className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1"
              >
                <RiDeleteBinLine />
                Remove
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  /**
   * Renders the initial message composition form with multi-message support
   */
  const renderEditForm = () => (
    <div className="flex flex-col bg-slate-900/80 backdrop-blur-md rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-cyan-400/50">
        <h3 className="text-2xl font-mono text-cyan-400 bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
          Create a Thread
        </h3>
        <p className="text-sm text-white/60 mt-1 font-light">
          Add multiple messages to create a connected thread
        </p>
      </div>

      {/* Scrollable Content Area */}
      <div className="max-h-[60vh] overflow-y-auto p-6">
        {/* Message composers */}
        {threadMessages.map((msg, index) => renderMessageComposer(msg, index))}

        {/* Add message button */}
        <button
          onClick={addMessage}
          className="w-full mt-4 py-3 px-4 border-2 border-dashed border-cyan-400/30 rounded-xl
            text-cyan-400 hover:border-cyan-400/50 hover:bg-cyan-400/5 transition-all duration-200
            flex items-center justify-center gap-2 font-mono"
        >
          <FiPlus className="text-xl" />
          Add to thread
        </button>
      </div>

      {/* Bottom Controls */}
      <div className="border-t border-cyan-400/50 bg-slate-900/95 backdrop-blur-sm">
        <div className="px-6 py-4 flex items-center justify-between">
          {/* Thread info */}
          <div className="text-sm font-mono text-white/50">
            {threadMessages.length} message{threadMessages.length > 1 ? 's' : ''} in thread
          </div>

          {/* Create Thread Button */}
          <button
            onClick={handleStartThread}
            disabled={!threadMessages.some(m => m.content.trim())}
            className={`px-8 py-2.5 font-semibold rounded-full transition-all
                duration-200 hover:shadow-lg active:scale-98 font-mono ${!threadMessages.some(m => m.content.trim())
                ? "bg-gray-600 text-gray-400 cursor-not-allowed"
                : "bg-gradient-to-r from-cyan-400 to-blue-500 hover:scale-105 text-white shadow-lg shadow-cyan-400/25"
              }`}
          >
            Publish Thread
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="max-w-lg mx-auto w-full">
      {isEditing ? renderEditForm() : renderProcessingSteps()}
    </div>
  );
};

export default SendNewThread;
