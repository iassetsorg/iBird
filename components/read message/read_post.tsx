/**
 * ReadPost Component
 * Displays a single post with user information, message content, media, and interaction buttons.
 * Supports tipping, sharing, and blockchain transaction viewing functionality.
 */

import React, { useState } from "react";
import { FiShare2, FiHash } from "react-icons/fi";
import { toast } from "react-toastify";
import { BsCurrencyDollar } from "react-icons/bs";
// import Repost from "../replay/repost"; // Deactivated

import Modal from "../common/modal";
import Tip from "../tip/tip";
import ReadMediaFile from "../media/read_media_file";
import UserProfile from "../profile/user_profile";
import LinkAndHashtagReader from "../common/link_and_hashtag_reader";
import ConnectModal from "../wallet/ConnectModal";
import { useWalletContext } from "../wallet/WalletContext";
import { useAccountId } from "@buidlerlabs/hashgraph-react-wallets";
import { formatTimestamp } from "../common/formatTimestamp";
import type { Message } from "../hooks/use_get_data";

/**
 * Interface for ReadPost component props
 */
interface ReadPostProps {
  /** Message object containing post data */
  message: Message;
}

/**
 * ReadPost component displays a single post with all its associated content and interactions
 */
function ReadPost({ message }: ReadPostProps) {
  const { isConnected } = useWalletContext();
  const { data: accountId } = useAccountId();

  const postData = message; // Use the message directly
  const loading = false; // No loading needed since data is already provided
  const error = !postData;

  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);
  const [isTipModalOpen, setIsTipModalOpen] = useState(false);
  const [selectedAuthor, setSelectedAuthor] = useState("");
  const [selectedTopicId, setSelectedTopicId] = useState("");

  // Return loading state
  if (loading) {
    return (
      <div className="max-w-4xl mx-auto bg-background text-text px-0 sm:px-6">
        <div className="bg-gradient-to-br from-slate-900 via-cyan-900/20 to-slate-900 backdrop-blur-xl rounded-2xl overflow-hidden border border-cyan-400/30 shadow-2xl shadow-cyan-400/20 animate-pulse">
          <div className="h-32 bg-gradient-to-r from-cyan-400/10 to-blue-400/10 rounded-t-2xl"></div>
          <div className="p-6 space-y-4">
            <div className="h-4 bg-cyan-400/20 rounded-full w-3/4"></div>
            <div className="h-4 bg-cyan-400/20 rounded-full w-1/2"></div>
            <div className="h-20 bg-slate-700/30 rounded-xl"></div>
          </div>
        </div>
      </div>
    );
  }

  // Return error state
  if (error || !postData) {
    return (
      <div className="max-w-4xl mx-auto bg-background text-text px-0 sm:px-6">
        <div className="bg-gradient-to-br from-slate-900 via-red-900/20 to-slate-900 backdrop-blur-xl rounded-2xl overflow-hidden border border-red-400/30 shadow-2xl shadow-red-400/20 p-6">
          <div className="flex items-center gap-3 text-red-400">
            <div className="w-8 h-8 rounded-full bg-red-400/20 flex items-center justify-center">
              <svg
                className="w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <span className="font-mono font-medium">Failed to load post</span>
          </div>
        </div>
      </div>
    );
  }

  /**
   * Opens the wallet connection modal
   */
  const openConnectModal = () => {
    setIsConnectModalOpen(true);
  };
  const closeConnectModal = () => {
    setIsConnectModalOpen(false);
  };

  /**
   * Generates a shareable link for the post
   * @param sequence_number - Unique identifier for the post
   * @returns Full URL to the post
   */
  const generateShareLink = (sequence_number: string) => {
    // Use current origin (works for localhost and production)
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://ibird.io';
    const shareLink = `${baseUrl}/Posts/${sequence_number}`;
    return shareLink;
  };

  /**
   * Copies the post's share link to clipboard and shows a notification
   * @param sequence_number - Unique identifier for the post
   */
  const copyShareLink = (sequence_number: string) => {
    const link = generateShareLink(sequence_number);
    navigator.clipboard.writeText(link).then(() => {
      toast("Link copied to clipboard!");
    });
  };

  const openTipModal = () => {
    setIsTipModalOpen(true);
  };
  const closeTipModal = () => {
    setIsTipModalOpen(false);
  };

  /**
   * Handles the tipping action for a post
   * @param author - Account ID of the post author
   * @param topicId - Topic ID associated with the post
   */
  const handleTip = (author: string, topicId: string) => {
    if (!isConnected) {
      openConnectModal();
      return;
    }
    if (accountId === author) {
      toast("You cannot tip yourself");
      return;
    }
    setSelectedAuthor(author);
    setSelectedTopicId(topicId);
    openTipModal();
  };

  /**
   * Formats a Unix timestamp into a human-readable date and time
   * @param timestamp - Unix timestamp in seconds
   * @returns Formatted date string
   */

  return (
    <div className="max-w-4xl mx-auto bg-background text-text px-0 sm:px-6">
      <div className="bg-gradient-to-br from-slate-900 via-cyan-900/20 to-slate-900 backdrop-blur-xl sm:rounded-2xl overflow-hidden border-y sm:border border-cyan-400/30 shadow-2xl shadow-cyan-400/20">
        {/* Header with enhanced styling - Mobile optimized */}
        <div className="px-4 py-3 sm:px-6 sm:py-4 border-b border-cyan-400/30 bg-gradient-to-r from-cyan-400/5 to-blue-400/5">
          <div className="flex items-center justify-between transition-all duration-300 hover:opacity-90">
            <UserProfile userAccountId={postData?.sender || ""} />
            <span className="text-xs sm:text-sm text-cyan-400/80 font-mono bg-cyan-400/10 px-2 py-1 sm:px-3 rounded-full border border-cyan-400/20">
              {formatTimestamp(postData?.consensus_timestamp?.toString() || "")}
            </span>
          </div>
        </div>

        {/* Content area with enhanced styling - Mobile optimized */}
        <div className="p-4 sm:p-6 bg-gradient-to-b from-transparent to-slate-800/20">
          <div className="mb-4 sm:mb-6">
            <p className="mb-4 text-white whitespace-pre-line text-base sm:text-lg leading-relaxed hover:text-cyan-300 transition-all duration-300 font-light bg-gradient-to-r from-white/90 to-white/70 bg-clip-text">
              <LinkAndHashtagReader message={postData?.Message || ""} />
            </p>

            {postData?.Media && (
              <div className="mt-6 rounded-xl overflow-hidden border border-cyan-400/30 shadow-xl shadow-cyan-400/20 bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-sm">
                <div className="w-full max-w-md mx-auto">
                  <ReadMediaFile cid={postData?.Media} />
                </div>
              </div>
            )}
          </div>

          {/* Enhanced action buttons with improved styling - Mobile optimized */}
          <div className="flex flex-wrap items-center pt-4 border-t border-cyan-400/30 bg-gradient-to-r from-cyan-400/5 to-transparent">
            <div className="flex items-center gap-2 sm:gap-3 w-full">
              {/* Repost Button - Enhanced with gradient styling - Mobile optimized */}
              {/* Repost deactivated
              <div className="flex-shrink-0">
                <Repost
                  contentType={"Post"}
                  source={message.sequence_number.toString()}
                />
              </div>
              */}

              {/* Tip Button - Enhanced with gradient and hover effects - Mobile optimized */}
              <button
                className="group flex items-center justify-center gap-1.5 sm:gap-2 px-3 py-2 sm:px-4 sm:py-2.5 rounded-full bg-gradient-to-r from-cyan-400/20 to-blue-400/20 hover:from-cyan-400/30 hover:to-blue-400/30 text-cyan-400 hover:text-cyan-300 transition-all duration-300 border border-cyan-400/30 hover:border-cyan-400/50 shadow-lg shadow-cyan-400/15 hover:shadow-xl hover:shadow-cyan-400/25 hover:scale-[1.05] active:scale-[0.95] backdrop-blur-sm"
                onClick={() =>
                  handleTip(
                    postData?.sender?.toString() || "",
                    message.sequence_number.toString()
                  )
                }
                title="Tip the author"
              >
                <BsCurrencyDollar className="w-3.5 h-3.5 sm:w-4 sm:h-4 group-hover:animate-pulse" />
                <span className="hidden sm:inline text-xs sm:text-sm font-mono font-medium">
                  Tip
                </span>
              </button>

              {/* Share Button - Enhanced with gradient and hover effects - Mobile optimized */}
              <button
                className="group flex items-center justify-center gap-1.5 sm:gap-2 px-3 py-2 sm:px-4 sm:py-2.5 rounded-full bg-gradient-to-r from-cyan-400/20 to-blue-400/20 hover:from-cyan-400/30 hover:to-blue-400/30 text-cyan-400 hover:text-cyan-300 transition-all duration-300 border border-cyan-400/30 hover:border-cyan-400/50 shadow-lg shadow-cyan-400/15 hover:shadow-xl hover:shadow-cyan-400/25 hover:scale-[1.05] active:scale-[0.95] backdrop-blur-sm"
                onClick={() =>
                  copyShareLink(message.sequence_number.toString())
                }
                title="Share this post"
              >
                <FiShare2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 group-hover:animate-pulse" />
                <span className="hidden sm:inline text-xs sm:text-sm font-mono font-medium">
                  Share
                </span>
              </button>

              {/* HashScan Button - Enhanced with gradient and hover effects - Mobile optimized */}
              <a
                href={`https://hashscan.io/${process.env.NEXT_PUBLIC_NETWORK || "mainnet"
                  }/transaction/${postData?.message_id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center justify-center gap-1.5 sm:gap-2 px-3 py-2 sm:px-4 sm:py-2.5 rounded-full bg-gradient-to-r from-cyan-400/20 to-blue-400/20 hover:from-cyan-400/30 hover:to-blue-400/30 text-cyan-400 hover:text-cyan-300 transition-all duration-300 border border-cyan-400/30 hover:border-cyan-400/50 shadow-lg shadow-cyan-400/15 hover:shadow-xl hover:shadow-cyan-400/25 hover:scale-[1.05] active:scale-[0.95] backdrop-blur-sm"
                title="View on HashScan"
              >
                <FiHash className="w-3.5 h-3.5 sm:w-4 sm:h-4 group-hover:animate-pulse" />
                <span className="hidden sm:inline text-xs sm:text-sm font-mono font-medium">
                  HashScan
                </span>
              </a>
            </div>
          </div>
        </div>
      </div>

      {isConnectModalOpen && (
        <ConnectModal isOpen={isConnectModalOpen} onClose={closeConnectModal} />
      )}

      {isTipModalOpen && (
        <Modal isOpen={isTipModalOpen} onClose={closeTipModal}>
          <Tip
            onClose={closeTipModal}
            author={selectedAuthor}
            topicId={selectedTopicId}
          />
        </Modal>
      )}
    </div>
  );
}

export default ReadPost;
