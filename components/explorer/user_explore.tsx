/**
 * UserExplorer is a component that displays messages from a specific user with infinite scroll.
 * Features:
 * - User-specific message loading
 * - Infinite scroll pagination
 * - Multiple message type support (Post, Thread, Poll)
 * - Loading states and transitions
 */

import React, { useEffect, useRef, useState, useCallback } from "react";
import useGetData from "../hooks/use_get_data";
import Spinner from "../common/Spinner";
import ReadThread from "../read message/read_thread";
import ReadPost from "../read message/read_post";
import ReadPoll from "../read message/read_poll";
import ReadRepost from "../read message/read_repost";
import useGetProfile from "../hooks/use_get_profile";

/**
 * Props interface for UserExplorer
 * @property {string} userAddress - The address/ID of the user whose messages to display
 */
interface UserExplorerProps {
  userAddress: string;
}

/**
 * UserExplorer component fetches and displays messages from a specific user.
 * Uses Intersection Observer API for infinite scrolling functionality.
 */
function UserExplorer({ userAddress }: UserExplorerProps) {
  // Fetch user profile data including their messages topic ID
  const { profileData } = useGetProfile(userAddress);
  const explorerTopicID = profileData?.ExplorerMessages;

  // Custom hook for fetching message data
  const { messages, loading, fetchMessages, nextLink } = useGetData(
    explorerTopicID,
    null,
    true
  );

  // State management
  const [allMessages, setAllMessages] = useState<typeof messages>([]); // Accumulated messages
  const [isLoadingMore, setIsLoadingMore] = useState(false); // Loading state for pagination

  // Reference for intersection observer
  const observerRef = useRef<HTMLDivElement | null>(null);

  // Add new state for tracking scroll position
  const [scrollTop, setScrollTop] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Add new loading state for pull-to-refresh
  const [isRefreshing, setIsRefreshing] = useState(false);

  /**
   * Initial data fetch when topic ID is available
   * Triggered when profile data is loaded
   */
  useEffect(() => {
    if (explorerTopicID) {
      fetchMessages(explorerTopicID);
    } else {
      // If no topic ID is available, don't show loading state
      // This will trigger the empty state immediately
      return;
    }
  }, [explorerTopicID, fetchMessages]);

  /**
   * Intersection Observer callback
   * Handles infinite scroll loading when user reaches bottom of content
   */
  const handleObserver = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const target = entries[0];
      if (target.isIntersecting && nextLink && !isLoadingMore) {
        setIsLoadingMore(true);
        fetchMessages(nextLink);
      }
    },
    [nextLink, fetchMessages, isLoadingMore]
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
    if (observerRef.current) observer.observe(observerRef.current);

    return () => {
      if (observerRef.current) observer.unobserve(observerRef.current);
    };
  }, [handleObserver]);

  /**
   * Updates allMessages state when new messages are fetched
   * Filters out duplicates and appends new messages
   */
  useEffect(() => {
    if (messages.length > 0) {
      setAllMessages((prevMessages) => {
        const newMessages = messages.filter(
          (message) =>
            !prevMessages.some(
              (prevMessage) => prevMessage.message_id === message.message_id
            )
        );
        return [...prevMessages, ...newMessages];
      });
      setIsLoadingMore(false);
    }
  }, [messages]);

  // Modify the scroll handler
  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const element = e.currentTarget;
      setScrollTop(element.scrollTop);

      // Trigger refresh when scrolling up at the top
      if (element.scrollTop === 0 && scrollTop > 0 && explorerTopicID) {
        setIsRefreshing(true);
        fetchMessages(explorerTopicID).finally(() => {
          setIsRefreshing(false);
        });
      }
    },
    [explorerTopicID, fetchMessages, scrollTop]
  );

  return (
    <div className="bg-background rounded-xl py-1">
      <h1 className="text-2xl mt-1 ml-8 font-semibold text-text mb-4">
        Messages
      </h1>

      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="relative w-full h-screen text-text shadow-xl
        overflow-y-scroll"
      >
        {/* Pull to refresh indicator */}
        {isRefreshing && (
          <div className="sticky top-0 z-10 -mt-6 pt-2 pb-2 bg-background">
            <Spinner />
          </div>
        )}

        {/* Initial loading state */}
        {loading && allMessages.length === 0 && (
          <div className="flex h-full items-center justify-center">
            <div className="text-center space-y-4">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-blue-400/10 to-purple-500/10 flex items-center justify-center border-2 border-blue-400/20 shadow-lg shadow-blue-400/10">
                <Spinner />
              </div>
              <div>
                <p className="text-white/80 font-mono font-semibold mb-1">
                  Loading Messages
                </p>
                <p className="text-white/50 text-sm font-mono">
                  Fetching user content...
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Empty state - show immediately if not loading and no messages or no topic ID */}
        {!loading && (allMessages.length === 0 || !explorerTopicID) && (
          <div className="flex flex-col items-center justify-center h-full py-16">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-400/10 to-purple-500/10 flex items-center justify-center mb-6 border border-blue-400/20 shadow-lg shadow-blue-400/10">
              <svg
                className="w-10 h-10 text-blue-400/50"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
            </div>
            <h3 className="text-xl font-mono font-bold text-white/90 mb-3">
              {explorerTopicID ? "No Messages Found" : "No Messages Available"}
            </h3>
            <p className="text-white/60 text-sm font-mono text-center mb-8 max-w-md leading-relaxed">
              {explorerTopicID
                ? "This user has not posted any messages yet. Check back later for their content."
                : "This user has not set up their messages yet."}
            </p>
          </div>
        )}

        {/* Message list */}
        <div className="space-y-6">
          {allMessages
            .filter((message) => {
              // Only render supported message types with valid required fields
              if (!message.Type) return false;
              
              switch (message.Type) {
                case "Post":
                  // Posts need a Message content or Media
                  return !!(message.Message || message.Media);
                case "Thread":
                  // Threads need a valid Thread topic ID
                  return !!message.Thread;
                case "Poll":
                  // Polls need a valid Poll topic ID
                  return !!message.Poll;
                case "Repost":
                  // Reposts need Source and ContentType
                  return !!(message.Source && message.ContentType);
                default:
                  return false;
              }
            })
            .map((message) => {
              // Common props shared between all message types
              const commonProps = {
                key: message.message_id,
                message_id: message.message_id,
                sender: message.sender,
                sequence_number: message.sequence_number.toString(),
                consensus_timestamp:
                  message.consensus_timestamp?.toString() || "0",
              };

              // Render different components based on message type
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

        {/* Move the observer ref higher in the DOM */}
        <div ref={observerRef} className="h-10" />

        {/* Loading indicator for next page */}
        {isLoadingMore && nextLink && (
          <div className="flex items-center justify-center py-4">
            <Spinner />
          </div>
        )}
      </div>
    </div>
  );
}

export default UserExplorer;
