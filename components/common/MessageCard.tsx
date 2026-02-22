/**
 * MessageCard - A unified component for displaying messages with enhanced UI/UX
 * Features:
 * - Type-specific styling and indicators
 * - Interactive hover states and animations
 * - Message metadata and actions
 * - Responsive design and accessibility
 * - Consistent visual hierarchy
 */

import React from "react";
import {
  RiMessage3Line,
  RiBarChartLine,
  RiRepeatLine,
} from "react-icons/ri";

interface MessageCardProps {
  children: React.ReactNode;
  messageType?: "Post" | "Thread" | "Poll" | "Repost";
  sender: string;
  sequenceNumber: string;
  timestamp: string;
  onReply?: () => void;
  onShare?: () => void;
  onLike?: () => void;
  className?: string;
}

const MessageCard: React.FC<MessageCardProps> = ({
  children,
  messageType = "Post",
  sender,
  sequenceNumber,
  timestamp,
  onReply,
  onShare,
  onLike,
  className = "",
}) => {
  // Type-specific configurations
  const typeConfig = {
    Post: {
      color: "purple",
      icon: RiMessage3Line,
      label: "Post",
      borderColor: "border-purple-400/15 hover:border-purple-400/30",
      bgColor: "bg-purple-400/20",
      textColor: "text-purple-300",
      shadowColor: "hover:shadow-purple-400/10",
    },
    Thread: {
      color: "green",
      icon: RiMessage3Line,
      label: "Thread",
      borderColor: "border-green-400/15 hover:border-green-400/30",
      bgColor: "bg-green-400/20",
      textColor: "text-green-300",
      shadowColor: "hover:shadow-green-400/10",
    },
    Poll: {
      color: "orange",
      icon: RiBarChartLine,
      label: "Poll",
      borderColor: "border-orange-400/15 hover:border-orange-400/30",
      bgColor: "bg-orange-400/20",
      textColor: "text-orange-300",
      shadowColor: "hover:shadow-orange-400/10",
    },
    Repost: {
      color: "blue",
      icon: RiRepeatLine,
      label: "Repost",
      borderColor: "border-blue-400/15 hover:border-blue-400/30",
      bgColor: "bg-blue-400/20",
      textColor: "text-blue-300",
      shadowColor: "hover:shadow-blue-400/10",
    },
  };

  const config = typeConfig[messageType];
  const IconComponent = config.icon;

  // Format timestamp - Twitter-style
  const formatTimestamp = (ts: string) => {
    try {
      const date = new Date(parseInt(ts) / 1000000);
      const now = new Date();
      const currentYear = now.getFullYear();
      const messageYear = date.getFullYear();

      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);

      // Less than 1 minute: show time
      if (diffMins < 1) {
        return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
      }

      // Less than 1 hour: show minutes ago (e.g., "30m")
      if (diffMins < 60) {
        return `${diffMins}m`;
      }

      // Less than 24 hours: show hours ago (e.g., "4h")
      if (diffHours < 24) {
        return `${diffHours}h`;
      }

      // Same year: show "Month Day" (e.g., "Feb 21")
      if (messageYear === currentYear) {
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      }

      // Previous years: show "Month Day, Year" (e.g., "Mar 3, 2025")
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return "Unknown";
    }
  };

  return (
    <div className={`relative group ${className}`}>
      {/* Enhanced message container */}
      <div
        className={`relative bg-gradient-to-br from-slate-800/60 to-slate-900/60 backdrop-blur-sm sm:rounded-2xl p-5 border-y sm:border ${config.borderColor} transition-all duration-300 hover:shadow-lg ${config.shadowColor} hover:scale-[1.01] active:scale-[0.99]`}
      >
        {/* Message type indicator with icon */}
        <div
          className={`absolute top-4 right-4 flex items-center gap-1.5 px-2.5 py-1 ${config.bgColor} ${config.textColor} text-xs font-mono rounded-full border border-${config.color}-400/30`}
        >
          <IconComponent className="w-3 h-3" />
          <span>{config.label}</span>
        </div>

        {/* Message content with proper spacing */}
        <div className="pr-20 mb-4">{children}</div>

        {/* Enhanced metadata footer */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-700/50">
          {/* Left side - Message info */}
          <div className="flex items-center gap-3 text-xs text-slate-400 font-mono">
            <span className="flex items-center gap-1">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
              #{sequenceNumber}
            </span>
            <span>•</span>
            <span
              title={new Date(parseInt(timestamp) / 1000000).toLocaleString()}
            >
              {formatTimestamp(timestamp)}
            </span>
            <span>•</span>
            <span className="truncate max-w-24" title={sender}>
              {sender.slice(0, 8)}...
            </span>
          </div>

          {/* Right side - Action buttons */}
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            {onLike && (
              <button
                onClick={onLike}
                className={`p-1.5 rounded-lg bg-${config.color}-400/10 hover:bg-${config.color}-400/20 ${config.textColor} transition-all duration-200 hover:scale-110 active:scale-95`}
                title="Like"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                  />
                </svg>
              </button>
            )}

            {onReply && (
              <button
                onClick={onReply}
                className={`p-1.5 rounded-lg bg-${config.color}-400/10 hover:bg-${config.color}-400/20 ${config.textColor} transition-all duration-200 hover:scale-110 active:scale-95`}
                title="Reply"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"
                  />
                </svg>
              </button>
            )}

            {onShare && (
              <button
                onClick={onShare}
                className={`p-1.5 rounded-lg bg-${config.color}-400/10 hover:bg-${config.color}-400/20 ${config.textColor} transition-all duration-200 hover:scale-110 active:scale-95`}
                title="Share"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z"
                  />
                </svg>
              </button>
            )}

            {/* More actions menu */}
            <button
              className={`p-1.5 rounded-lg bg-slate-700/50 hover:bg-slate-600/50 text-slate-400 hover:text-slate-300 transition-all duration-200 hover:scale-110 active:scale-95`}
              title="More actions"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Hover glow effect */}
        <div
          className={`absolute inset-0 rounded-2xl bg-${config.color}-400/10 opacity-0 group-hover:opacity-50 transition-opacity duration-300 pointer-events-none`}
        />
      </div>
    </div>
  );
};

export default MessageCard;
