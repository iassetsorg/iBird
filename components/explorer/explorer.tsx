/**
 * Explorer is a component that implements infinite scrolling to display messages.
 * Features:
 * - Infinite scroll loading
 * - Message type handling (Post, Thread, Poll)
 * - Loading states with spinner
 * - Animated message transitions
 */

import React, { useEffect, useRef, useCallback, useState } from "react";
import useGetData from "../hooks/use_get_data";
import Spinner from "../common/Spinner";
import ReadThread from "../read message/read_thread";
import ReadPost from "../read message/read_post";
import ReadPoll from "../read message/read_poll";
import ReadRepost from "../read message/read_repost";
import eventService from "../services/event_service";
import { useRefreshTrigger } from "../hooks/use_refresh_trigger";
import SEOHead from "../common/SEOHead";
import { generateSEOConfig } from "../common/seo.config";
import { NewMessage } from "../send message/new_message";

// Import Message type from useGetData
type Message = ReturnType<typeof useGetData>["messages"][0];

/**
 * Explorer component fetches and displays messages with infinite scroll functionality.
 * Uses Intersection Observer API to detect when to load more content.
 */
function Explorer() {
  // Get topic ID from environment variables
  const explorerTopicID = process.env.NEXT_PUBLIC_EXPLORER_ID || "0.0.6914553";
  const { refreshTrigger, triggerRefresh } = useRefreshTrigger();

  // Custom hook for fetching message data
  const { messages, loading, fetchMessages, nextLink } = useGetData(
    explorerTopicID,
    null,
    true
  );

  // State management
  const [allMessages, setAllMessages] = useState<typeof messages>([]); // Accumulated messages
  const [isLoading, setIsLoading] = useState(false); // Loading state for next page

  // Reference for intersection observer
  const observerRef = useRef<HTMLDivElement | null>(null);

  // Add new state for tracking scroll position
  const [scrollTop, setScrollTop] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Note: isRefreshing state removed as it was unused

  // Modify the scroll handler
  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const element = e.currentTarget;
      setScrollTop(element.scrollTop);

      // Trigger refresh when scrolling up at the top
      if (element.scrollTop === 0 && scrollTop > 0) {
        triggerRefresh();
      }
    },
    [scrollTop, triggerRefresh]
  );

  // Initial data fetch
  useEffect(() => {
    setAllMessages([]); // Clear existing messages on refresh
    if (explorerTopicID) {
      fetchMessages(explorerTopicID);
    }
  }, [explorerTopicID, fetchMessages, refreshTrigger]); // Add refreshTrigger as a dependency

  /**
   * Intersection Observer callback
   * Triggers when the observer element becomes visible
   * Used to implement infinite scrolling
   */
  const handleObserver = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const target = entries[0];
      if (target.isIntersecting && nextLink && !isLoading) {
        setIsLoading(true);
        fetchMessages(nextLink);
      }
    },
    [nextLink, fetchMessages, isLoading]
  );

  /**
   * Sets up the Intersection Observer
   * Monitors when user scrolls near the bottom of the content
   */
  useEffect(() => {
    const option = {
      root: null,
      rootMargin: "100px",
      threshold: 0.5,
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
      setAllMessages((prevMessages: Message[]) => {
        const newMessages = messages.filter(
          (message: Message) =>
            !prevMessages.some(
              (prevMessage: Message) =>
                prevMessage.message_id === message.message_id
            )
        );
        return [...prevMessages, ...newMessages];
      });
      setIsLoading(false);
    }
  }, [messages]);

  // Subscribe to refresh events
  useEffect(() => {
    const unsubscribe = eventService.subscribe("refreshExplorer", () => {
      triggerRefresh(); // This will trigger a global refresh
    });

    return () => unsubscribe();
  }, [triggerRefresh]);

  // Generate SEO configuration for explore page
  const exploreSEO = generateSEOConfig("explore");

  return (
    <>
      <SEOHead seoConfig={exploreSEO} />
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="relative w-full h-[calc(100vh-4rem)] bg-background pt-4 px-0 sm:px-6 text-text
         overflow-y-scroll"
      >
        {/* Pull to refresh indicator - commented out as isRefreshing is unused */}
        {/* {isRefreshing && (
          <div className="sticky top-0 z-10 -mt-6 pt-2 pb-2 bg-background">
            <Spinner />
          </div>
        )} */}

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
                  Fetching content from the network...
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Empty state - show immediately if not loading and no messages */}
        {!loading && allMessages.length === 0 && (
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
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
            <h3 className="text-xl font-mono font-bold text-white/90 mb-3">
              No Messages Found
            </h3>
            <p className="text-white/60 text-sm font-mono text-center mb-8 max-w-md leading-relaxed">
              There are no messages to display at the moment. Check back later
              for new content from the network.
            </p>
          </div>
        )}

        {/* Message list */}
        <div className="space-y-4 sm:space-y-6">
          {allMessages
            .filter((message: Message) => {
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
            .map((message: Message) => {
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
        {isLoading && nextLink && (
          <div className="flex items-center justify-center py-4">
            <Spinner />
          </div>
        )}
      </div>
      <NewMessage />
    </>
  );
}

export default Explorer;
