/**
 * ChannelView is a component that displays messages from a specific channel with infinite scroll.
 * Features:
 * - Channel-specific message loading
 * - Infinite scroll pagination
 * - Multiple message type support (Post, Thread, Poll)
 * - Message sending functionality
 * - Loading states and transitions
 */

import React, { useEffect, useRef, useState, useCallback } from "react";
import useGetData from "../hooks/use_get_data";
import useFollow from "../hooks/use_follow";
import Spinner from "../common/Spinner";
import ReadThread from "../read message/read_thread";
import ReadPost from "../read message/read_post";
import ReadPoll from "../read message/read_poll";
import ReadRepost from "../read message/read_repost";
import ReadMediaFile from "../media/read_media_file";
import UpdateChannel from "./update_channel";
import { NewMessage } from "../send message/new_message";
import SimpleModal from "../common/SimpleModal";

/**
 * Props interface for ChannelView
 * @property {string} channelId - The ID of the channel to display messages from
 * @property {string} channelName - The name of the channel
 * @property {string} channelMedia - The media/image URL for the channel
 * @property {boolean} isFollowed - Whether the user is following this channel (not owner)
 * @property {() => void} onBack - Callback function to navigate back to channel list
 */
interface ChannelViewProps {
  channelId: string;
  channelName: string;
  channelMedia?: string;
  isFollowed?: boolean;
  onBack: () => void;
}

/**
 * ChannelView component fetches and displays messages from a specific channel.
 * Uses Intersection Observer API for infinite scrolling functionality.
 */
function ChannelView({
  channelId,
  channelName,
  channelMedia,
  isFollowed = false,
  onBack,
}: ChannelViewProps) {
  // Follow/Unfollow hook
  const { unfollowChannel, isLoading: isUnfollowLoading } = useFollow();

  // Custom hook for fetching message data
  const { messages, loading, fetchMessages, nextLink } = useGetData(
    channelId,
    null,
    true
  );

  // State management
  const [allMessages, setAllMessages] = useState<typeof messages>([]); // Accumulated messages
  const [isLoadingMore, setIsLoadingMore] = useState(false); // Loading state for pagination
  const [activeModal, setActiveModal] = useState<
    "none" | "editChannel"
  >("none");

  // Reference for intersection observer
  const observerRef = useRef<HTMLDivElement | null>(null);

  // Add new state for tracking scroll position
  const [scrollTop, setScrollTop] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Add new loading state for pull-to-refresh
  const [isRefreshing, setIsRefreshing] = useState(false);

  /**
   * Initial data fetch when component mounts - Fixed to prevent infinite loops
   */
  useEffect(() => {
    if (channelId && channelId.trim() !== "") {
      console.log("ChannelView: Initial fetch for channelId:", channelId);
      setAllMessages([]); // Clear existing messages
      fetchMessages(channelId, true); // true = initial load/refresh
    }
  }, [channelId, fetchMessages]);

  /**
   * Intersection Observer callback - Fixed to prevent rapid calls
   * Handles infinite scroll loading when user reaches bottom of content
   */
  const handleObserver = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const target = entries[0];
      if (target.isIntersecting && nextLink && !isLoadingMore && !loading) {
        console.log(
          "ChannelView: Loading more messages via intersection observer"
        );
        setIsLoadingMore(true);
        fetchMessages(nextLink, false); // false = pagination (don't clear messages)
      }
    },
    [fetchMessages, nextLink, isLoadingMore, loading]
  );

  /**
   * Sets up the Intersection Observer
   * Monitors scroll position to trigger loading more content
   */
  useEffect(() => {
    const option = {
      root: null,
      rootMargin: "100px", // Increased margin to trigger earlier
      threshold: 0.5, // Reduced threshold to trigger sooner
    };

    const observer = new IntersectionObserver(handleObserver, option);
    const observedElement = observerRef.current;
    if (observedElement) observer.observe(observedElement);

    return () => {
      if (observedElement) observer.unobserve(observedElement);
    };
  }, [handleObserver]);

  /**
   * Updates allMessages state when new messages are fetched
   * Filters out duplicates, ChannelIdentifier messages, and appends new messages
   */
  useEffect(() => {
    if (messages.length > 0) {
      setAllMessages((prevMessages) => {
        const newMessages = messages.filter(
          (message) =>
            // Filter out duplicates
            !prevMessages.some(
              (prevMessage) => prevMessage.message_id === message.message_id
            ) &&
            // Filter out ChannelIdentifier messages (metadata messages)
            message.Type !== "ChannelIdentifier" &&
            // Skip the first message (sequence_number 1) which is the identifier
            message.sequence_number !== 1
        );
        return [...prevMessages, ...newMessages];
      });
      setIsLoadingMore(false);
    }
  }, [messages]);

  /**
   * Handle scroll events for pull-to-refresh - Fixed to prevent excessive calls
   */
  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const element = e.currentTarget;
      setScrollTop(element.scrollTop);

      // Trigger refresh when scrolling up at the top (with debouncing)
      if (
        element.scrollTop === 0 &&
        scrollTop > 10 &&
        channelId &&
        !isRefreshing &&
        !loading
      ) {
        console.log("ChannelView: Pull-to-refresh triggered");
        setIsRefreshing(true);
        fetchMessages(channelId, true).finally(() => {
          setIsRefreshing(false);
        });
      }
    },
    [channelId, fetchMessages, scrollTop, isRefreshing, loading]
  );

  return (
    <>
    <div className="h-full flex flex-col bg-slate-900/80 backdrop-blur-md">
      {/* Enhanced Channel Header with better visual hierarchy */}
      <div className="sticky top-0 z-10 bg-gradient-to-r from-cyan-400/15 via-blue-500/15 to-cyan-400/15 backdrop-blur-md border-b border-cyan-400/30 px-6 py-4 shadow-lg shadow-cyan-400/10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="p-3 rounded-xl bg-cyan-400/10 hover:bg-cyan-400/20 text-cyan-400 transition-all duration-300 hover:scale-110 active:scale-95 shadow-md hover:shadow-cyan-400/25 focus:outline-none focus:ring-2 focus:ring-cyan-400/50"
              aria-label="Back to channels"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </button>
            <div className="flex items-center gap-3">
              <div className="relative">
                {channelMedia ? (
                  <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 ring-2 ring-cyan-400/30 group-hover:ring-cyan-400/70 transition-all duration-300 shadow-lg group-hover:shadow-cyan-400/40">
                    <ReadMediaFile cid={channelMedia} />
                  </div>
                ) : (
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 flex items-center justify-center shadow-lg shadow-cyan-400/25">
                    <svg
                      className="w-6 h-6 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z"
                      />
                    </svg>
                  </div>
                )}
                {/* Public indicator */}
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full border-2 border-slate-900" />
              </div>
              <div>
                <h1 className="text-2xl font-mono font-bold text-white bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
                  {channelName}
                </h1>
                <div className="flex items-center gap-2 mt-1">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-mono bg-cyan-400/20 text-cyan-300 border border-cyan-400/30">
                    <svg
                      className="w-3 h-3 mr-1"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                        clipRule="evenodd"
                      />
                    </svg>
                    Public Channel
                  </span>
                  <span className="text-xs text-cyan-400/70 font-mono">
                    Creator Only
                  </span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-mono bg-green-400/20 text-green-300 border border-green-400/30">
                    <div className="w-2 h-2 bg-green-400 rounded-full mr-1" />
                    Public
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Enhanced action button with better states */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full sm:w-auto justify-start sm:justify-end">
            {/* Edit Channel Button - only show if NOT followed (i.e., owner) */}
            {!isFollowed && (
              <button
                onClick={() => setActiveModal("editChannel")}
                className="px-4 py-2 font-mono text-sm rounded-xl transition-all duration-300 flex items-center gap-2 bg-cyan-400/10 hover:bg-cyan-400/20 text-cyan-400 border border-cyan-400/30 hover:border-cyan-400/50 focus:outline-none focus:ring-2 focus:ring-cyan-400/50"
                title="Edit Channel"
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
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                  />
                </svg>
                Edit
              </button>
            )}

            {/* Following badge - only show if followed */}
            {isFollowed && (
              <span className="px-3 py-2 bg-cyan-400/10 text-cyan-400/70 text-xs font-mono rounded-lg border border-cyan-400/20">
                Following
              </span>
            )}

            {/* Message count indicator */}
            <div className="hidden md:flex items-center gap-2 px-3 py-2 bg-cyan-400/10 rounded-lg border border-cyan-400/20">
              <svg
                className="w-4 h-4 text-cyan-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                />
              </svg>
              <span className="text-sm font-mono text-cyan-300">
                {allMessages.length}
              </span>
            </div>

            {/* Unfollow Button - only show if followed (subtle styling) */}
            {isFollowed && (
              <button
                onClick={async () => {
                  await unfollowChannel(channelId);
                }}
                disabled={isUnfollowLoading}
                className="px-4 py-2 font-mono text-sm rounded-xl transition-all duration-300 flex items-center gap-2 bg-slate-700/50 hover:bg-red-500/20 text-slate-400 hover:text-red-400 border border-slate-600 hover:border-red-400/50 focus:outline-none disabled:opacity-50"
                title="Unfollow Channel"
              >
                {isUnfollowLoading ? (
                  <Spinner />
                ) : (
                  <>
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
                        d="M13 7a4 4 0 11-8 0 4 4 0 018 0zM9 14a6 6 0 00-6 6v1h12v-1a6 6 0 00-6-6zM21 12h-6"
                      />
                    </svg>
                    Unfollow
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Messages Container */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto"
      >
        {/* Pull to refresh indicator */}
        {isRefreshing && (
          <div className="sticky top-0 z-10 flex flex-col items-center justify-center py-4 bg-gradient-to-b from-cyan-900/20 to-transparent backdrop-blur-sm border-b border-cyan-400/20">
            <Spinner />
            <p className="text-xs text-cyan-400 font-mono mt-2 animate-pulse">
              Refreshing messages...
            </p>
          </div>
        )}

        {/* Initial loading state */}
        {loading && allMessages.length === 0 && (
          <div className="flex h-full items-center justify-center">
            <div className="text-center space-y-4">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-cyan-400/10 to-blue-500/10 flex items-center justify-center border-2 border-cyan-400/20 shadow-lg shadow-cyan-400/10">
                <Spinner />
              </div>
              <div>
                <p className="text-white/80 font-mono font-semibold mb-1">
                  Loading Messages
                </p>
                <p className="text-white/50 text-sm font-mono">
                  Fetching channel content...
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Empty state */}
        {!loading && allMessages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full py-16">
            <div className="w-20 h-20 rounded-2xl bg-cyan-400/10 flex items-center justify-center mb-6 border border-cyan-400/20 shadow-lg shadow-cyan-400/10">
              <svg
                className="w-10 h-10 text-cyan-400/50"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                />
              </svg>
            </div>
            <h3 className="text-xl font-mono font-bold text-white/90 mb-3">
              No Messages Yet
            </h3>
            <p className="text-white/60 text-sm font-mono text-center mb-8 max-w-md leading-relaxed">
              This channel is empty. Be the first to share something and start
              the conversation!
            </p>
          </div>
        )}

        {/* Message list - match explorer layout */}
        <div className="space-y-4 sm:space-y-6 px-0 py-4 sm:px-6">
          {allMessages
            .filter((message) => {
              if (!message.Type) return false;

              switch (message.Type) {
                case "Post":
                  return !!(message.Message || message.Media);
                case "Thread":
                  return !!message.Thread;
                case "Poll":
                  return !!message.Poll;
                case "Repost":
                  return !!(message.Source && message.ContentType);
                default:
                  return false;
              }
            })
            .map((message) => {
              const commonProps = {
                key: message.message_id,
                message_id: message.message_id,
                sender: message.sender,
                sequence_number: message.sequence_number.toString(),
                consensus_timestamp:
                  message.consensus_timestamp?.toString() || "0",
              };

              return (
                <div key={message.message_id}>
                  {message.Type === "Post" && <ReadPost message={message} />}
                  {message.Type === "Thread" && (
                    <ReadThread {...commonProps} topicId={message.Thread} />
                  )}
                  {message.Type === "Poll" && (
                    <ReadPoll {...commonProps} topicId={message.Poll} />
                  )}
                  {message.Type === "Repost" && (
                    <ReadRepost
                      {...commonProps}
                      contentType={message.ContentType}
                      source={message.Source}
                      rePoster={message.sender}
                      timestamp={message.consensus_timestamp?.toString() || "0"}
                    />
                  )}
                </div>
              );
            })}
        </div>

        {/* Intersection observer target */}
        <div ref={observerRef} className="h-10" />

        {/* Loading indicator for next page */}
        {isLoadingMore && nextLink && (
          <div className="flex flex-col items-center justify-center py-6 space-y-2">
            <Spinner />
            <p className="text-xs text-cyan-400/70 font-mono">
              Loading more messages...
            </p>
          </div>
        )}
      </div>

      {/* Edit Channel Modal */}
      {activeModal === "editChannel" && (
        <SimpleModal
          isOpen={activeModal === "editChannel"}
          onClose={() => setActiveModal("none")}
        >
          <UpdateChannel
            channelId={channelId}
            onClose={() => setActiveModal("none")}
          />
        </SimpleModal>
      )}
    </div>
    
    {/* Floating New Message Button - positioned like in explorer - outside main container */}
    {!isFollowed && (
      <NewMessage
        requireBalanceCheck={false}
        targetTopicId={channelId}
        portalToBody
      />
    )}
    </>
  );
}

export default ChannelView;
