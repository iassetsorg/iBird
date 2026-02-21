import React, { useState, useEffect, useMemo, useRef } from "react";
import { toast } from "react-toastify";
import useGetData from "../hooks/use_get_data";
import Spinner from "../common/Spinner";
import ReadMediaFile from "../media/read_media_file";
import ReplayPoll from "../replay/replay_to_poll";
import UserProfile from "../profile/user_profile";
import LinkAndHashtagReader from "../common/link_and_hashtag_reader";
import { useRefreshTrigger } from "../hooks/use_refresh_trigger";
// import Repost from "../replay/repost"; // Deactivated
import { formatTimestamp } from "../common/formatTimestamp";
import { useAccountId } from "@buidlerlabs/hashgraph-react-wallets";

// Import Message type from useGetData
type Message = ReturnType<typeof useGetData>["messages"][0];
/**
 * Interface representing a reply message structure
 * @interface Reply
 * @property {number} sequence_number - Unique identifier for the reply
 * @property {string} sender - Account ID of the message sender
 * @property {number} likes - Number of likes on the reply
 * @property {number} dislikes - Number of dislikes on the reply
 * @property {number} comments - Number of comments on the reply
 * @property {string} Message - Content of the reply
 * @property {string} [Media] - Optional media CID attached to the reply
 * @property {string} [consensus_timestamp] - Optional timestamp of consensus
 * @property {Reply[]} replies - Nested replies to this reply
 */
interface Reply {
  sequence_number: number;
  sender: string;
  likes: number;
  dislikes: number;
  comments: number;
  Message: string;
  Media?: string;
  consensus_timestamp?: string;
  replies: Reply[];
  userReaction?: "like" | "dislike" | null;
}

/**
 * ReadPoll Component - Displays a poll with voting options and handles user interactions
 * @component
 * @param {Object} props - Component props
 * @param {string} [props.topicId] - Optional topic ID to fetch poll data
 * @param {string} [props.highlightedCommentId] - Optional sequence number of comment to highlight
 * @param {string} [props.scrollToCommentId] - Optional sequence number of comment to scroll to
 * @returns {JSX.Element} Rendered poll component
 */
function ReadPoll({ topicId, highlightedCommentId, scrollToCommentId }: {
  topicId?: string;
  highlightedCommentId?: string;
  scrollToCommentId?: string;
}) {
  const [expandedComments, setExpandedComments] = useState<Set<number>>(
    new Set()
  );
  const { messages, loading, fetchMessages, nextLink } = useGetData(topicId);
  const [allMessages, setAllMessages] = useState<Message[]>([]);
  const [selectedChoice, setSelectedChoice] = useState<string>("");
  const { refreshTrigger } = useRefreshTrigger();
  const { data: accountId } = useAccountId();
  const [userHasVoted, setUserHasVoted] = useState<boolean>(false);
  const [userVotedChoice, setUserVotedChoice] = useState<string | null>(null);
  const getUserReaction = (targetSequence: string): "like" | "dislike" | null => {
    if (!accountId) return null;
    const liked = allMessages.some(
      (m) => m.Like_to === targetSequence && m.sender === accountId
    );
    if (liked) return "like";
    const disliked = allMessages.some(
      (m) => m.DisLike_to === targetSequence && m.sender === accountId
    );
    return disliked ? "dislike" : null;
  };

  useEffect(() => {
    const fetchAllMessages = async () => {
      if (topicId) {
        await fetchMessages(topicId);
      }
    };

    fetchAllMessages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topicId, refreshTrigger]);

  useEffect(() => {
    setAllMessages((prevMessages) => {
      const newMessages = messages.filter(
        (message) =>
          !prevMessages.some(
            (prevMessage) => prevMessage.message_id === message.message_id
          )
      );
      return [...prevMessages, ...newMessages];
    });

    const fetchNextMessages = async () => {
      if (nextLink) {
        await fetchMessages(nextLink);
      }
    };

    fetchNextMessages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);

  // Check if the current user has already voted
  useEffect(() => {
    if (accountId && allMessages.length > 0) {
      // Find the user's first vote (earliest by sequence number)
      const existingVote = allMessages.find(
        (m) => m.Choice && m.sender === accountId
      );
      if (existingVote) {
        setUserHasVoted(true);
        setUserVotedChoice(existingVote.Choice);
        // Auto-select the user's voted choice for display
        setSelectedChoice(existingVote.Choice);
      } else {
        setUserHasVoted(false);
        setUserVotedChoice(null);
      }
    }
  }, [allMessages, accountId]);

  /**
   * Auto-expand poll comments if highlighting a comment
   */
  useEffect(() => {
    if (highlightedCommentId || scrollToCommentId) {
      // Expand the main poll's comments
      const pollMessage = allMessages.find(m => !m.Reply_to && !m.Like_to && !m.DisLike_to && !m.Identifier && !m.Choice);
      if (pollMessage) {
        setExpandedComments(prev => new Set(prev).add(pollMessage.sequence_number));
      }
      
      toast.info("📍 Scrolling to comment...", { 
        autoClose: 2000,
        position: "top-center"
      });
    }
  }, [highlightedCommentId, scrollToCommentId, allMessages]);

  /**
   * Gets unique votes per user - only the first vote from each account counts
   * This prevents users from voting multiple times
   * @param messages - Array of all messages
   * @returns Map of sender -> choice (first vote per user)
   */
  const getUniqueVotesPerUser = useMemo(() => {
    const userVotes = new Map<string, string>();
    
    // Messages are in chronological order, so first occurrence is the valid vote
    allMessages.forEach((m) => {
      if (m.Choice && !userVotes.has(m.sender)) {
        userVotes.set(m.sender, m.Choice);
      }
    });
    
    return userVotes;
  }, [allMessages]);

  /**
   * Counts votes for a specific choice from unique users only
   * @param choice - The choice key (e.g., "Choice1", "Choice2")
   * @returns Number of unique users who voted for this choice
   */
  const getUniqueVoteCount = (choice: string): number => {
    return Array.from(getUniqueVotesPerUser.values()).filter(
      (c) => c === choice
    ).length;
  };

  /**
   * Builds a nested structure of replies for a given parent message
   * @param {string} parentSequenceNumber - Sequence number of parent message
   * @returns {any[]} Array of nested reply objects
   */
  const buildNestedReplies = (parentSequenceNumber: string): Reply[] => {
    const replies = allMessages
      .filter((message) => message.Reply_to === parentSequenceNumber)
      .map((reply) => {
        const repliesCount = allMessages.filter(
          (m) => m.Reply_to === reply.sequence_number.toString()
        ).length;
        const replySequence = reply.sequence_number.toString();
        const likeSenders = new Set(
          allMessages
            .filter((m) => m.Like_to === replySequence)
            .map((m) => m.sender)
        );
        const dislikeSenders = new Set(
          allMessages
            .filter((m) => m.DisLike_to === replySequence)
            .map((m) => m.sender)
        );
        return {
          ...reply,
          likes: likeSenders.size,
          dislikes: dislikeSenders.size,
          comments: repliesCount,
          userReaction: getUserReaction(replySequence),
          replies: buildNestedReplies(replySequence),
        };
      });
    return replies;
  };

  /**
   * Toggles the visibility of comments for a specific message
   * @param {number} sequenceNumber - Sequence number of the message
   */
  const toggleComments = (sequenceNumber: number) => {
    setExpandedComments((prevSet) => {
      const newSet = new Set(prevSet);
      if (newSet.has(sequenceNumber)) {
        newSet.delete(sequenceNumber);
      } else {
        newSet.add(sequenceNumber);
      }
      return newSet;
    });
  };

  // Calculate total votes
  const getTotalVotes = (messageDetails: {
    Choice1Votes: number;
    Choice2Votes: number;
    Choice3Votes: number;
    Choice4Votes: number;
    Choice5Votes: number;
  }) => {
    const totalVotes =
      messageDetails.Choice1Votes +
      messageDetails.Choice2Votes +
      messageDetails.Choice3Votes +
      messageDetails.Choice4Votes +
      messageDetails.Choice5Votes;
    return totalVotes;
  };

  // Get vote percentage
  const getVotePercentage = (votes: number, totalVotes: number) => {
    if (totalVotes === 0) return 0;
    return (votes / totalVotes) * 100;
  };

  // Handle choice selection - prevent if user has already voted
  const handleChoiceSelect = (choice: string) => {
    if (userHasVoted) {
      // User has already voted, don't allow changing selection
      return;
    }
    setSelectedChoice(choice);
  };

  // Add function to check if choice is a winner
  const isWinningChoice = (votes: number, mostVotedChoice: number) => {
    return votes === mostVotedChoice && mostVotedChoice > 0;
  };

  return (
    <div className="max-w-4xl mx-auto bg-background text-text px-2 sm:px-6">
      {loading && allMessages.length === 0 && (
        <div className="flex flex-col justify-center items-center min-h-[400px] space-y-4 bg-gradient-to-br from-slate-900 via-cyan-900/20 to-slate-900 backdrop-blur-xl rounded-2xl border border-cyan-400/30 shadow-2xl shadow-cyan-400/20">
          <Spinner />
          <p className="text-cyan-400/60 animate-pulse font-mono">
            Loading messages...
          </p>
        </div>
      )}

      {/* Return null when no messages - prevents empty box in explorer */}
      {!loading && allMessages.length === 0 && null}

      {!loading && (
        <div className="space-y-4 sm:space-y-8">
          {allMessages.map((message, idx) => {
            if (
              message.Reply_to ||
              message.Like_to ||
              message.DisLike_to ||
              message.Identifier ||
              message.Choice
            )
              return null;

            const messageDetails = {
              author: message.sender,
              sequence_number: message.sequence_number,
              message: message.Message,
              media: message.Media,
              likes: new Set(
                allMessages
                  .filter(
                    (m) => m.Like_to === message.sequence_number.toString()
                  )
                  .map((m) => m.sender)
              ).size,
              dislikes: new Set(
                allMessages
                  .filter(
                    (m) => m.DisLike_to === message.sequence_number.toString()
                  )
                  .map((m) => m.sender)
              ).size,
              comments: allMessages.filter(
                (m) => m.Reply_to === message.sequence_number.toString()
              ).length,
              replies: buildNestedReplies(message.sequence_number.toString()),
              userReaction: getUserReaction(
                message.sequence_number.toString()
              ),
              Choice1: message.Choice1,
              Choice2: message.Choice2,
              Choice3: message.Choice3,
              Choice4: message.Choice4,
              Choice5: message.Choice5,
              // Use unique vote counting - only first vote per user counts
              Choice1Votes: getUniqueVoteCount("Choice1"),
              Choice2Votes: getUniqueVoteCount("Choice2"),
              Choice3Votes: getUniqueVoteCount("Choice3"),
              Choice4Votes: getUniqueVoteCount("Choice4"),
              Choice5Votes: getUniqueVoteCount("Choice5"),
              consensus_timestamp: message.consensus_timestamp?.toString(),
            };

            const totalVotes = getTotalVotes(messageDetails);

            try {
              if (messageDetails.message) {
                const mostVotedChoice = Math.max(
                  messageDetails.Choice1Votes,
                  messageDetails.Choice2Votes,
                  messageDetails.Choice3Votes,
                  messageDetails.Choice4Votes,
                  messageDetails.Choice5Votes
                );

                return (
                  <div
                    key={idx}
                    className="bg-gradient-to-br from-slate-900 via-cyan-900/20 to-slate-900 backdrop-blur-xl rounded-2xl overflow-hidden border border-cyan-400/30 shadow-2xl shadow-cyan-400/20 p-3 sm:p-6"
                  >
                    <div className="flex items-center justify-between mb-3 sm:mb-4 transition-colors hover:opacity-90">
                      <UserProfile userAccountId={messageDetails.author} />
                      <span className="text-xs sm:text-sm text-cyan-400/60 font-mono">
                        {formatTimestamp(
                          messageDetails.consensus_timestamp || ""
                        )}
                      </span>
                    </div>

                    <div className="mb-3 sm:mb-4">
                      <p className="mb-4 sm:mb-6 text-white whitespace-pre-line text-base sm:text-lg leading-relaxed hover:text-cyan-300 transition-colors font-light bg-gradient-to-r from-white/90 to-white/70 bg-clip-text">
                        <LinkAndHashtagReader
                          message={messageDetails.message || ""}
                        />
                      </p>

                      {/* Enhanced Poll Container with Better Mobile Layout */}
                      <div className="space-y-4 sm:space-y-6 w-full max-w-2xl mx-auto bg-gradient-to-b from-slate-800/50 to-slate-900/50 p-4 sm:p-8 rounded-2xl sm:rounded-3xl backdrop-blur-md shadow-xl border border-cyan-400/30">
                        {/* Modernized Header with Better Mobile Balance */}
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 pb-4 sm:pb-6 border-b border-cyan-400/30">
                          <div className="flex items-start gap-3 sm:gap-4">
                            <div className="p-2 sm:p-3 rounded-xl sm:rounded-2xl bg-gradient-to-br from-cyan-400/20 to-blue-400/10 backdrop-blur-sm">
                              <svg
                                className="w-5 h-5 sm:w-6 sm:h-6 text-cyan-400"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={1.5}
                                  d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z"
                                />
                              </svg>
                            </div>
                            <div className="space-y-0.5 sm:space-y-1">
                              <h3 className="text-lg sm:text-xl font-bold text-cyan-400">
                                Community Poll
                              </h3>
                              <p className="text-xs sm:text-sm text-cyan-400/60 font-medium">
                                Share your opinion by casting a vote
                              </p>
                            </div>
                          </div>

                          {/* Enhanced Vote Counter for Mobile */}
                          <div className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl sm:rounded-2xl bg-gradient-to-r from-cyan-400/15 to-blue-400/5 backdrop-blur-sm border border-cyan-400/30">
                            <div className="p-1 sm:p-1.5 rounded-lg sm:rounded-xl bg-cyan-400/20">
                              <svg
                                className="w-4 h-4 sm:w-5 sm:h-5 text-cyan-400"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={1.5}
                                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                                />
                              </svg>
                            </div>
                            <div className="flex flex-col">
                              <span className="text-base sm:text-lg font-bold text-cyan-400 leading-none">
                                {totalVotes.toLocaleString()}
                              </span>
                              <span className="text-[10px] sm:text-xs text-cyan-400/60 font-medium">
                                total votes
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Enhanced Choice Options with Better Mobile Spacing */}
                        <div className="space-y-3 sm:space-y-4">
                          {[1, 2, 3, 4, 5].map((num) => {
                            const choiceKey =
                              `Choice${num}` as keyof typeof messageDetails;
                            const votesKey =
                              `Choice${num}Votes` as keyof typeof messageDetails;

                            if (!messageDetails[choiceKey]) return null;

                            const votes = messageDetails[votesKey] as number;
                            const percentage = getVotePercentage(
                              votes,
                              totalVotes
                            );
                            const isSelected =
                              selectedChoice === `Choice${num}`;
                            const isWinner = isWinningChoice(
                              votes,
                              mostVotedChoice
                            );

                            return (
                              <button
                                key={num}
                                className={`
                                  relative w-full flex items-center transition-all duration-300 transform
                                  ${isSelected
                                    ? "scale-[1.02] shadow-xl"
                                    : "hover:scale-[1.01]"
                                  }
                                  ${isSelected
                                    ? "ring-2 ring-cyan-400 border-cyan-400"
                                    : "ring-1 ring-cyan-400/30 border-cyan-400/30"
                                  }
                                  ${isWinner
                                    ? "bg-gradient-to-r from-green-400/20 via-green-400/10 to-transparent"
                                    : "bg-gradient-to-r from-slate-800/50 to-slate-700/50"
                                  }
                                  hover:bg-slate-700/50 rounded-xl sm:rounded-2xl overflow-hidden
                                  group cursor-pointer border backdrop-blur-sm
                                `}
                                onClick={() =>
                                  handleChoiceSelect(`Choice${num}`)
                                }
                              >
                                {/* Improved Progress Bar */}
                                <div
                                  className={`
                                    absolute left-0 top-0 h-full transition-all duration-700 ease-out
                                    ${isWinner
                                      ? "bg-gradient-to-r from-green-400/30 via-green-400/20 to-transparent"
                                      : isSelected
                                        ? "bg-gradient-to-r from-cyan-400/40 via-cyan-400/30 to-cyan-400/5"
                                        : "bg-gradient-to-r from-cyan-400/20 via-cyan-400/10 to-transparent"
                                    }
                                  `}
                                  style={{
                                    width: `${percentage}%`,
                                    transform: isSelected
                                      ? "scaleX(1.02)"
                                      : "scaleX(1)",
                                  }}
                                />

                                {/* Enhanced Option Content for Mobile */}
                                <div
                                  className={`
                                  relative flex flex-col sm:flex-row items-start sm:items-center w-full
                                  px-3 sm:px-6 py-4 sm:py-5 gap-3 sm:gap-0
                                  ${isSelected
                                      ? "bg-cyan-400/5 rounded-r-xl"
                                      : ""
                                    }
                                `}
                                >
                                  {/* Selected Option Indicator */}
                                  {isSelected && (
                                    <div className="absolute -left-0.5 top-0 bottom-0 w-1.5 bg-primary rounded-r-full animate-pulse" />
                                  )}

                                  {/* Improved Winner Badge - Adjusted position and z-index */}
                                  {isWinner && (
                                    <div className="absolute -left-2 -top-2 p-2 rounded-br-2xl bg-green-400 shadow-lg transform -rotate-12 animate-bounce-subtle z-10">
                                      <svg
                                        className="w-3 h-3 sm:w-4 sm:h-4 text-white drop-shadow-md"
                                        fill="currentColor"
                                        viewBox="0 0 20 20"
                                      >
                                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                      </svg>
                                    </div>
                                  )}

                                  <div className="flex items-start sm:items-center gap-3 sm:gap-4 min-w-0 w-full sm:w-auto">
                                    {/* Option Number Badge - Added z-index */}
                                    <div
                                      className={`
                                        flex-shrink-0 flex items-center justify-center w-7 h-7 sm:w-9 sm:h-9 rounded-full
                                        shadow-sm backdrop-blur-sm
                                        ${isWinner
                                          ? "bg-green-400/20 ring-1 ring-green-400/30"
                                          : isSelected
                                            ? "bg-cyan-400 ring-2 ring-cyan-400/30 scale-110"
                                            : "bg-cyan-400/10"
                                        }
                                        transition-all duration-300 ease-in-out relative z-20
                                        group-hover:scale-110 group-hover:shadow-md
                                      `}
                                    >
                                      {isSelected && (
                                        <div className="absolute inset-0 rounded-full bg-primary animate-ping opacity-20" />
                                      )}
                                      <span
                                        className={`
                                          text-sm sm:text-base font-semibold
                                          ${isWinner
                                            ? "text-green-400"
                                            : isSelected
                                              ? "text-white"
                                              : "text-cyan-400"
                                          }
                                          transition-colors duration-300
                                        `}
                                      >
                                        {num}
                                      </span>
                                    </div>

                                    {/* Enhanced Option Text for Mobile */}
                                    <div className="min-w-0 flex-1">
                                      <span
                                        className={`
                                          text-sm sm:text-base font-semibold break-words leading-relaxed
                                          ${isWinner
                                            ? "text-green-400"
                                            : isSelected
                                              ? "text-cyan-300"
                                              : "text-white"
                                          }
                                          group-hover:text-cyan-300 transition-all duration-300
                                        `}
                                      >
                                        {String(messageDetails[choiceKey])}
                                      </span>
                                      {isSelected && (
                                        <div className="mt-0.5 text-xs text-cyan-400/60 font-medium animate-fadeIn">
                                          Your vote
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  {/* Improved Vote Stats for Mobile */}
                                  <div className="flex items-center gap-3 sm:gap-4 ml-10 sm:ml-auto mt-1 sm:mt-0">
                                    <div
                                      className={`
                                        flex-shrink-0 px-3 sm:px-4 py-1.5 sm:py-2
                                        rounded-full text-xs sm:text-sm font-semibold
                                        shadow-sm backdrop-blur-sm
                                        ${isWinner
                                          ? "bg-green-400/20 text-green-400 ring-1 ring-green-400/30"
                                          : isSelected
                                            ? "bg-cyan-400 text-white ring-2 ring-cyan-400/30"
                                            : "bg-cyan-400/10 text-cyan-400/80"
                                        }
                                        group-hover:bg-cyan-400/20 group-hover:text-cyan-300
                                        transition-all duration-300 ease-in-out
                                        group-hover:scale-105 group-hover:shadow-md
                                        ${isSelected ? "scale-110" : ""}
                                      `}
                                    >
                                      {percentage.toFixed(1)}%
                                    </div>
                                    <span
                                      className={`
                                        flex-shrink-0 text-xs sm:text-sm font-medium
                                        min-w-[60px] sm:min-w-[80px] text-right
                                        transition-colors duration-300
                                        ${isWinner
                                          ? "text-green-400"
                                          : isSelected
                                            ? "text-cyan-300 font-semibold"
                                            : "text-cyan-400/80"
                                        }
                                      `}
                                    >
                                      {votes.toLocaleString()}
                                      <span className="text-[10px] sm:text-xs ml-1 opacity-60">
                                        votes
                                      </span>
                                    </span>
                                  </div>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {messageDetails.media && (
                        <div className="mt-4 rounded-xl overflow-hidden border border-cyan-400/30 shadow-lg shadow-cyan-400/10 bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-sm">
                          <div className="w-full max-w-xs mx-auto">
                            <ReadMediaFile cid={messageDetails.media} />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Enhanced Interaction Bar for Mobile */}
                    <div className="flex flex-wrap items-center mt-3 sm:mt-4 pt-3 theme-divider">
                      {topicId && (
                        <div className="w-full">
                          <div className="flex flex-wrap items-center gap-3 sm:gap-6">
                            <div className="flex flex-wrap items-center gap-3 sm:gap-4">
                              {/* <Repost contentType={"Poll"} source={topicId} /> */}

                              {/* Enhanced Like/Dislike/Comments Buttons for Mobile */}
                              <div className="flex items-center gap-3 sm:gap-4">
                                {/* Enhanced Comments Button */}
                                <button
                                  onClick={() =>
                                    toggleComments(
                                      messageDetails.sequence_number
                                    )
                                  }
                                  className={`
                                    group flex items-center justify-center gap-2 px-3 py-2 sm:px-4 sm:py-2 rounded-full
                                    transition-all duration-200
                                    ${messageDetails.comments > 0
                                      ? "bg-gradient-to-r from-cyan-400/20 to-blue-400/20 hover:from-cyan-400/30 hover:to-blue-400/30 text-cyan-400 hover:text-cyan-300 border border-cyan-400/30 hover:border-cyan-400/50 shadow-lg shadow-cyan-400/15 hover:shadow-xl hover:shadow-cyan-400/25 hover:scale-[1.05] active:scale-[0.95] backdrop-blur-sm"
                                      : "bg-slate-800/50 text-cyan-400/60 border border-cyan-400/20 cursor-not-allowed"
                                    }
                                    focus:outline-none focus:ring-2 focus:ring-cyan-400/20
                                  `}
                                  title={
                                    messageDetails.comments > 0
                                      ? `View ${messageDetails.comments} comments`
                                      : "No comments yet"
                                  }
                                >
                                  <svg
                                    className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${messageDetails.comments > 0
                                        ? "text-cyan-400"
                                        : "text-cyan-400/60"
                                      } transition-colors duration-200`}
                                    fill={
                                      messageDetails.comments > 0
                                        ? "currentColor"
                                        : "none"
                                    }
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                                    />
                                  </svg>
                                  <span className="hidden sm:inline text-sm font-medium">
                                    {messageDetails.comments > 0
                                      ? `${messageDetails.comments.toLocaleString()} Comments`
                                      : "No Comments"}
                                  </span>
                                </button>
                              </div>
                            </div>

                            {/* Enhanced Reply Button for Mobile */}
                            <div className="w-full sm:w-auto sm:ml-auto mt-3 sm:mt-0">
                              <ReplayPoll
                                sequenceNumber={messageDetails.sequence_number}
                                topicId={topicId}
                                author={messageDetails.author}
                                message_id={message.message_id}
                                Choice={selectedChoice}
                                likesCount={messageDetails.likes}
                                dislikesCount={messageDetails.dislikes}
                                userReaction={messageDetails.userReaction ?? null}
                                hasVoted={userHasVoted}
                                votedChoice={userVotedChoice}
                                className="w-full sm:w-auto inline-flex items-center justify-center px-3 py-2 sm:px-4 sm:py-2 rounded-lg bg-gradient-to-r from-cyan-400 to-blue-500 hover:scale-105 text-white shadow-lg shadow-cyan-400/25 transition-all duration-200 font-mono font-medium text-xs sm:text-sm"
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Enhanced Comments Section */}
                    {expandedComments.has(messageDetails.sequence_number) && (
                      <div className="mt-6 space-y-4 animate-fadeIn">
                        {messageDetails.replies.length === 0 ? (
                          <div className="text-center py-6 bg-secondary/5 rounded-lg">
                            <p className="text-primary/60">
                              No comments yet. Be the first to comment!
                            </p>
                          </div>
                        ) : (
                          messageDetails.replies.map(
                            (reply: Reply, i: number) => (
                              <CommentItem
                                key={i}
                                reply={reply}
                                topicId={topicId}
                                allMessages={allMessages}
                                formatTimestamp={formatTimestamp}
                                level={1}
                                highlightedCommentId={highlightedCommentId}
                              />
                            )
                          )
                        )}
                      </div>
                    )}
                  </div>
                );
              }
            } catch {
              toast("Error rendering poll");
              return null;
            }
          })}
        </div>
      )}

      {nextLink && (
        <div className="flex justify-center py-8">
          <div className="p-4 rounded-xl bg-gradient-to-br from-cyan-400/10 to-blue-400/10 backdrop-blur-sm">
            <Spinner />
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * CommentItem Component - Renders an individual comment with nested replies
 * @component
 * @param {Object} props - Component props
 * @param {Reply} props.reply - Reply object containing comment data
 * @param {string} [props.topicId] - Optional topic ID
 * @param {any[]} props.allMessages - Array of all messages
 * @param {Function} props.formatTimestamp - Timestamp formatting function
 * @param {number} props.level - Nesting level of the comment
 * @returns {JSX.Element} Rendered comment component
 */
function CommentItem({
  reply,
  topicId,
  allMessages,
  formatTimestamp,
  level,
  highlightedCommentId,
}: {
  reply: Reply;
  topicId?: string;
  allMessages: Message[];
  formatTimestamp: (timestamp: string) => string;
  level: number;
  highlightedCommentId?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const indentation = Math.min(level * 16, 48);
  const commentRef = useRef<HTMLDivElement>(null);
  
  // Check if this comment is highlighted
  const isHighlighted = reply.sequence_number.toString() === highlightedCommentId;
  
  // Auto-scroll to highlighted comment
  useEffect(() => {
    if (isHighlighted && commentRef.current) {
      setTimeout(() => {
        commentRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'center'
        });
      }, 500);
    }
  }, [isHighlighted]);
  
  // Auto-expand if this comment is highlighted
  useEffect(() => {
    if (isHighlighted) {
      setExpanded(true);
    }
  }, [isHighlighted]);
  
  const highlightClass = isHighlighted
    ? "ring-2 ring-cyan-400 shadow-2xl shadow-cyan-400/60 bg-cyan-900/30 border-cyan-400"
    : "";

  return (
    <div
      ref={commentRef}
      className={`bg-slate-800/60 backdrop-blur-sm rounded-xl border border-cyan-400/20 p-4 transition-all duration-300 ${highlightClass}`}
      style={{ marginLeft: `${indentation}px` }}
    >
      <div className="flex items-center justify-between mb-2">
        <UserProfile userAccountId={reply.sender} />
        <span className="text-xs text-cyan-400/60 font-mono">
          {formatTimestamp(reply.consensus_timestamp || "")}
        </span>
      </div>

      <div className="mb-4">
        <p className="whitespace-pre-line text-base mb-3 text-white/90 font-light">
          <LinkAndHashtagReader message={reply.Message || ""} />
        </p>
        {reply.Media && (
          <div className="mt-4 rounded-xl overflow-hidden border border-cyan-400/30 shadow-lg shadow-cyan-400/10 bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-sm">
            <div className="w-full max-w-xs mx-auto">
              <ReadMediaFile cid={reply.Media} />
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        {/* Reply counter button */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="group flex items-center gap-2 px-3 py-1.5 rounded-lg bg-cyan-400/10 hover:bg-cyan-400/20 text-cyan-400 hover:text-cyan-300 transition-all duration-200 border border-cyan-400/20 hover:border-cyan-400/40 font-mono text-sm"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
            />
          </svg>
          <span className="font-medium">
            {reply.comments || 0} {reply.comments === 1 ? "Reply" : "Replies"}
          </span>
        </button>

        {/* Reply button with likes/dislikes/share (isComment=true for comment-specific sharing) */}
        <ReplayPoll
          sequenceNumber={reply.sequence_number}
          topicId={topicId || ""}
          author={reply.sender}
          message_id={reply.sequence_number.toString()}
          likesCount={reply.likes}
          dislikesCount={reply.dislikes}
          userReaction={reply.userReaction ?? null}
          showVoteButton={false}
          isComment={true}
          className="inline-flex items-center gap-2 px-3 py-1.5 text-sm bg-gradient-to-r from-cyan-400/20 to-blue-400/20 hover:from-cyan-400/30 hover:to-blue-400/30 text-cyan-400 hover:text-cyan-300 border border-cyan-400/30 hover:border-cyan-400/50 rounded-lg transition-all duration-200 font-mono"
        />
      </div>

      {/* Render nested replies */}
      {expanded && reply.replies && reply.replies.length > 0 && (
        <div className="mt-4 space-y-3">
          {reply.replies.map((nestedReply: Reply, idx: number) => (
            <CommentItem
              key={idx}
              reply={nestedReply}
              topicId={topicId}
              allMessages={allMessages}
              formatTimestamp={formatTimestamp}
              level={level + 1}
              highlightedCommentId={highlightedCommentId}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default ReadPoll;
