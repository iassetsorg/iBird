import React, { useState, useEffect, useMemo, useRef } from "react";
import { toast } from "react-toastify";
import useGetData from "../hooks/use_get_data";
import Replay from "../replay/replay_to_thread";
import Spinner from "../common/Spinner";
import UserProfile from "../profile/user_profile";
import ReadMediaFile from "../media/read_media_file";
import LinkAndHashtagReader from "../common/link_and_hashtag_reader";
import { useRefreshTrigger } from "../hooks/use_refresh_trigger";
import { formatTimestamp } from "../common/formatTimestamp";
import { AiOutlineMessage } from "react-icons/ai";
import { FiPlus } from "react-icons/fi";
import { useAccountId } from "@buidlerlabs/hashgraph-react-wallets";
import { useWalletContext } from "../wallet/WalletContext";
import Modal from "../common/modal";
import AddToThread from "../send message/add_to_thread";

// Import Message type from useGetData
type Message = ReturnType<typeof useGetData>["messages"][0];

/**
 * Interface representing a thread post in the connected thread sequence
 */
interface ThreadPost {
  sequence_number: number;
  sender: string;
  Message: string;
  Media?: string;
  consensus_timestamp?: string;
  ThreadIndex?: number;
  IsThreadPost?: boolean;
}

/**
 * Interface representing a reply/comment structure in the thread
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
 * ReadThread Component - Displays a thread of messages with separated thread posts and comments
 * Thread posts are displayed as connected messages (Twitter-style)
 * Comments are displayed in a separate section below
 *
 * @param {Object} props - Component props
 * @param {string} props.topicId - Optional ID of the topic to display messages for
 * @param {boolean} props.initialExpandedPosts - Optional initial state for showing all posts (default: false)
 * @param {boolean} props.initialExpandedComments - Optional initial state for showing comments (default: false)
 * @param {string} props.highlightedCommentId - Optional sequence number of comment to highlight
 * @param {string} props.scrollToCommentId - Optional sequence number of comment to scroll to
 */
function ReadThread({
  topicId,
  initialExpandedPosts = false,
  initialExpandedComments = false,
  highlightedCommentId,
  scrollToCommentId,
}: {
  topicId?: string;
  initialExpandedPosts?: boolean;
  initialExpandedComments?: boolean;
  highlightedCommentId?: string;
  scrollToCommentId?: string;
}) {
  const [showComments, setShowComments] = useState<boolean>(initialExpandedComments);
  const [showAllPosts, setShowAllPosts] = useState<boolean>(initialExpandedPosts);
  const [showAddToThread, setShowAddToThread] = useState<boolean>(false);
  const { messages, loading, fetchMessages, nextLink } = useGetData(topicId);
  const [allMessages, setAllMessages] = useState<Message[]>([]);
  const { refreshTrigger, triggerRefresh } = useRefreshTrigger();
  
  // Wallet context for author verification
  const { data: accountId } = useAccountId();
  const { isConnected } = useWalletContext();

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

  /**
   * Separates thread posts from comments and reactions
   * Thread posts have IsThreadPost=true or are messages without Reply_to/Like_to/DisLike_to
   * Comments have Reply_to field set
   */
  const { threadPosts, comments, totalLikes, totalDislikes } = useMemo(() => {
    // Check if any message has the new IsThreadPost field
    const hasNewFormat = allMessages.some(m => m.IsThreadPost !== undefined);

    let posts: ThreadPost[];
    let commentMessages: Message[];

    if (hasNewFormat) {
      // New format: filter by IsThreadPost
      posts = allMessages
        .filter(m => m.IsThreadPost === true)
        .sort((a, b) => (a.ThreadIndex || 0) - (b.ThreadIndex || 0))
        .map(m => ({
          sequence_number: m.sequence_number,
          sender: m.sender,
          Message: m.Message,
          Media: m.Media,
          consensus_timestamp: m.consensus_timestamp,
          ThreadIndex: m.ThreadIndex,
          IsThreadPost: m.IsThreadPost,
        }));

      commentMessages = allMessages.filter(m => m.Reply_to && !m.IsThreadPost);
    } else {
      // Legacy format: first message with Type="Thread" and no Reply_to/Like_to/DisLike_to
      posts = allMessages
        .filter(m => 
          m.Type === "Thread" && 
          !m.Reply_to && 
          !m.Like_to && 
          !m.DisLike_to &&
          !m.Identifier
        )
        .map(m => ({
          sequence_number: m.sequence_number,
          sender: m.sender,
          Message: m.Message,
          Media: m.Media,
          consensus_timestamp: m.consensus_timestamp,
        }));

      commentMessages = allMessages.filter(m => m.Reply_to);
    }

    // Calculate total likes and dislikes for all thread posts (unique per sender)
    const postIds = new Set(posts.map((p) => p.sequence_number.toString()));
    const likeSenders = new Set<string>();
    const dislikeSenders = new Set<string>();

    allMessages.forEach((m) => {
      if (m.Like_to && postIds.has(m.Like_to)) {
        likeSenders.add(m.sender);
      }
      if (m.DisLike_to && postIds.has(m.DisLike_to)) {
        dislikeSenders.add(m.sender);
      }
    });

    return {
      threadPosts: posts,
      comments: commentMessages,
      totalLikes: likeSenders.size,
      totalDislikes: dislikeSenders.size,
    };
  }, [allMessages]);

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

  /**
   * Builds nested reply structure for comments
   */
  const buildNestedReplies = (parentSequenceNumber: string): Reply[] => {
    return allMessages
      .filter((message) => message.Reply_to === parentSequenceNumber)
      .map((reply) => {
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
          comments: allMessages.filter(
            (m) => m.Reply_to === replySequence
          ).length,
          userReaction: getUserReaction(replySequence),
          replies: buildNestedReplies(replySequence),
        };
      });
  };

  /**
   * Gets top-level comments (replies to thread posts, not to other comments)
   */
  const topLevelComments = useMemo(() => {
    const threadPostIds = threadPosts.map(p => p.sequence_number.toString());
    return comments
      .filter(c => threadPostIds.includes(c.Reply_to || ""))
      .map((c) => {
        const commentSequence = c.sequence_number.toString();
        const likeSenders = new Set(
          allMessages
            .filter((m) => m.Like_to === commentSequence)
            .map((m) => m.sender)
        );
        const dislikeSenders = new Set(
          allMessages
            .filter((m) => m.DisLike_to === commentSequence)
            .map((m) => m.sender)
        );
        return {
          ...c,
          likes: likeSenders.size,
          dislikes: dislikeSenders.size,
          comments: allMessages.filter(
            (m) => m.Reply_to === commentSequence
          ).length,
          userReaction: getUserReaction(commentSequence),
          replies: buildNestedReplies(commentSequence),
        };
      });
  }, [comments, threadPosts, allMessages]);

  /**
   * Check if the connected user is the thread author
   */
  const isThreadAuthor = useMemo(() => {
    if (!isConnected || !accountId || threadPosts.length === 0) return false;
    return threadPosts[0].sender === accountId;
  }, [isConnected, accountId, threadPosts]);

  /**
   * Calculate the maximum ThreadIndex from existing posts
   */
  const maxThreadIndex = useMemo(() => {
    if (threadPosts.length === 0) return -1;
    return Math.max(...threadPosts.map(p => p.ThreadIndex ?? 0), threadPosts.length - 1);
  }, [threadPosts]);

  /**
   * Auto-expand comments if we're highlighting one
   */
  useEffect(() => {
    if (highlightedCommentId || scrollToCommentId) {
      setShowComments(true);
      
      toast.info("📍 Scrolling to comment...", {
        autoClose: 2000,
        position: "top-center"
      });
    }
  }, [highlightedCommentId, scrollToCommentId]);

  return (
    <div className="max-w-4xl mx-auto bg-transparent text-text pr-2 pl-3 sm:px-6">
      {loading && allMessages.length === 0 && (
        <div className="flex flex-col justify-center items-center min-h-[400px] space-y-4 bg-gradient-to-br from-slate-900 via-cyan-900/20 to-slate-900 backdrop-blur-xl rounded-2xl border border-cyan-400/30 shadow-2xl shadow-cyan-400/20">
          <div className="p-4 rounded-xl bg-cyan-400/10">
            <Spinner />
          </div>
          <p className="text-cyan-400/80 animate-pulse font-mono">
            Loading thread...
          </p>
        </div>
      )}

      {/* Return null when no messages - prevents empty box in explorer */}
      {!loading && allMessages.length === 0 && null}

      {!loading && threadPosts.length > 0 && (
        <div className="space-y-4 sm:space-y-6">
          {/* Thread Posts Section - Connected Style */}
          <div className="bg-gradient-to-br from-slate-900 via-cyan-900/20 to-slate-900 backdrop-blur-xl rounded-2xl overflow-hidden border border-cyan-400/30 shadow-2xl shadow-cyan-400/20">
            {/* Thread Author Header - Only once at top */}
            <div className="px-4 py-3 sm:px-6 sm:py-4 border-b border-cyan-400/30">
              <div className="flex items-center justify-between transition-colors hover:opacity-90">
                <div className="flex items-center gap-3">
                  <UserProfile userAccountId={threadPosts[0]?.sender} />
                  {threadPosts.length > 1 && (
                    <span className="text-xs font-mono bg-cyan-400/20 text-cyan-400 px-2 py-1 rounded-full">
                      {threadPosts.length} posts in thread
                    </span>
                  )}
                </div>
                <span className="text-xs sm:text-sm text-cyan-400/60 font-mono">
                  {formatTimestamp(threadPosts[0]?.consensus_timestamp || "")}
                </span>
              </div>
            </div>

            {/* Thread Posts - Connected with vertical line */}
            <div className="relative">
              {/* Show only first post or all posts based on showAllPosts state */}
              {(showAllPosts ? threadPosts : threadPosts.slice(0, 1)).map((post, index) => {
                const hasMorePosts = !showAllPosts && threadPosts.length > 1;
                
                return (
                  <div key={post.sequence_number} className="relative">
                    {/* Vertical connector line */}
                    {index > 0 && (
                      <div className="absolute left-8 -top-0 w-0.5 h-4 bg-gradient-to-b from-cyan-400/50 to-cyan-400/20" />
                    )}
                    {(index < threadPosts.length - 1 && showAllPosts) && (
                      <div className="absolute left-8 bottom-0 w-0.5 h-4 bg-gradient-to-b from-cyan-400/20 to-cyan-400/50" />
                    )}

                    <div className="p-4 sm:p-6">
                      <div className="flex gap-4">
                        {/* Left side - Avatar placeholder and connector */}
                        <div className="flex flex-col items-center">
                          {/* Avatar circle for visual connection */}
                          <div className="w-3 h-3 rounded-full bg-cyan-400/50 ring-2 ring-cyan-400/20" />
                          {/* Connector to next post or to "show more" */}
                          {((index < threadPosts.length - 1 && showAllPosts) || hasMorePosts) && (
                            <div className="flex-1 w-0.5 bg-gradient-to-b from-cyan-400/40 to-cyan-400/10 mt-2" />
                          )}
                        </div>

                        {/* Right side - Content */}
                        <div className="flex-1 min-w-0">
                          {/* Post number badge */}
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-xs font-mono text-cyan-400/60">
                              {index + 1}/{threadPosts.length}
                            </span>
                            {index > 0 && (
                              <span className="text-xs text-white/40">
                                {formatTimestamp(post.consensus_timestamp || "")}
                              </span>
                            )}
                          </div>

                          {/* Message content */}
                          <p className="text-white whitespace-pre-line text-base sm:text-lg leading-relaxed hover:text-cyan-400 transition-colors font-light mb-4">
                            <LinkAndHashtagReader message={post.Message} />
                          </p>

                          {/* Media */}
                          {post.Media && (
                            <div className="rounded-xl overflow-hidden border border-cyan-400/30 shadow-lg shadow-cyan-400/10">
                              <div className="w-full max-w-md">
                                <ReadMediaFile cid={post.Media} />
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              
              {/* Show More Posts Indicator */}
              {!showAllPosts && threadPosts.length > 1 && (
                <button
                  onClick={() => setShowAllPosts(true)}
                  className="w-full flex items-center gap-3 px-6 py-4 bg-gradient-to-r from-cyan-400/10 to-blue-400/10 hover:from-cyan-400/20 hover:to-blue-400/20 border-t border-cyan-400/20 transition-all duration-300 group"
                >
                  <div className="flex flex-col items-center">
                    <div className="w-0.5 h-4 bg-gradient-to-b from-cyan-400/40 to-cyan-400/10" />
                    <div className="w-3 h-3 rounded-full bg-cyan-400/30 ring-2 ring-cyan-400/20 group-hover:bg-cyan-400/50 transition-colors" />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-cyan-400 font-mono text-sm group-hover:text-cyan-300 transition-colors">
                      Show {threadPosts.length - 1} more {threadPosts.length - 1 === 1 ? 'post' : 'posts'} in thread
                    </span>
                    <svg
                      className="w-4 h-4 text-cyan-400/60 group-hover:text-cyan-300 transition-colors"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>
              )}
              
              {/* Collapse Thread Button - Show when expanded */}
              {showAllPosts && threadPosts.length > 1 && (
                <button
                  onClick={() => setShowAllPosts(false)}
                  className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-slate-800/30 hover:bg-slate-700/30 border-t border-cyan-400/20 transition-all duration-300 group"
                >
                  <span className="text-cyan-400/60 font-mono text-xs group-hover:text-cyan-400 transition-colors">
                    Collapse thread
                  </span>
                  <svg
                    className="w-3 h-3 text-cyan-400/60 group-hover:text-cyan-400 transition-colors rotate-180"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              )}

              {/* Add to Thread Button - Only visible to thread author when expanded */}
              {isThreadAuthor && showAllPosts && topicId && (
                <button
                  onClick={() => setShowAddToThread(true)}
                  className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-gradient-to-r from-cyan-400/10 to-blue-400/10 hover:from-cyan-400/20 hover:to-blue-400/20 border-t border-cyan-400/20 transition-all duration-300 group"
                >
                  <div className="flex flex-col items-center">
                    <div className="w-0.5 h-4 bg-gradient-to-b from-cyan-400/40 to-cyan-400/10" />
                    <div className="w-6 h-6 rounded-full bg-cyan-400/30 ring-2 ring-cyan-400/20 group-hover:bg-cyan-400/50 transition-colors flex items-center justify-center">
                      <FiPlus className="w-4 h-4 text-cyan-400" />
                    </div>
                  </div>
                  <span className="text-cyan-400 font-mono text-sm group-hover:text-cyan-300 transition-colors">
                    Add to thread
                  </span>
                </button>
              )}
            </div>

            {/* Thread Actions - After all posts */}
            <div className="px-4 py-3 sm:px-6 sm:py-4 border-t border-cyan-400/30 bg-slate-900/50">
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                {/* Comment count button */}
                <button
                  onClick={() => setShowComments(!showComments)}
                  className={`
                    group flex items-center justify-center gap-1 sm:gap-2 px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg
                    transition-all duration-200 font-mono
                    ${topLevelComments.length > 0
                      ? "bg-slate-800/50 hover:bg-slate-700/50 text-cyan-400 hover:text-cyan-300"
                      : "bg-slate-800/50 text-cyan-400/60"
                    }
                    focus:outline-none focus:ring-2 focus:ring-cyan-400/20
                  `}
                >
                  <AiOutlineMessage className="w-4 h-4" />
                  <span className="text-xs sm:text-sm font-medium">
                    {topLevelComments.length} Comments
                  </span>
                </button>

                {/* Replay component with like/dislike/reply/share/tip */}
                {topicId && threadPosts.length > 0 && (
                  <div className="ml-auto">
                    <Replay
                      sequenceNumber={threadPosts[0].sequence_number}
                      topicId={topicId}
                      author={threadPosts[0].sender}
                      message_id={threadPosts[0].sequence_number.toString()}
                      likesCount={totalLikes}
                      dislikesCount={totalDislikes}
                      userReaction={getUserReaction(
                        threadPosts[0].sequence_number.toString()
                      )}
                      className="flex items-center gap-1 sm:gap-2"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Comments Section - Separate from thread posts */}
          {showComments && topLevelComments.length > 0 && (
            <div className="mt-4">
              <div className="flex items-center gap-2 mb-3 px-2">
                <AiOutlineMessage className="w-5 h-5 text-cyan-400/60" />
                <h3 className="text-lg font-mono text-white/80">
                  Comments ({topLevelComments.length})
                </h3>
                {highlightedCommentId && (
                  <span className="text-xs bg-cyan-400/20 text-cyan-400 px-2 py-1 rounded-full">
                    Shared Comment
                  </span>
                )}
              </div>
              
              <div className="space-y-3">
                {topLevelComments.map((comment: Reply, i: number) => (
                  <CommentItem
                    key={i}
                    reply={comment}
                    topicId={topicId}
                    allMessages={allMessages}
                    formatTimestamp={formatTimestamp}
                    level={0}
                    highlightedCommentId={highlightedCommentId}
                  />
                ))}
              </div>
            </div>
          )}

          {/* No comments message */}
          {showComments && topLevelComments.length === 0 && (
            <div className="text-center py-6 bg-slate-800/30 rounded-xl border border-cyan-400/10">
              <p className="text-cyan-400/60 font-mono text-sm">
                No comments yet. Be the first to comment!
              </p>
            </div>
          )}
        </div>
      )}

      {nextLink && (
        <div className="flex justify-center py-8">
          <div className="p-4 rounded-xl bg-gradient-to-br from-cyan-400/10 to-blue-400/10 backdrop-blur-sm">
            <Spinner />
          </div>
        </div>
      )}

      {/* Add to Thread Modal */}
      {showAddToThread && topicId && (
        <Modal isOpen={showAddToThread} onClose={() => setShowAddToThread(false)}>
          <AddToThread
            topicId={topicId}
            currentThreadIndex={maxThreadIndex}
            onClose={() => setShowAddToThread(false)}
            onSuccess={() => {
              setShowAddToThread(false);
              // Clear cached messages to force a fresh fetch
              setAllMessages([]);
              triggerRefresh();
            }}
          />
        </Modal>
      )}
    </div>
  );
}

export default ReadThread;

/**
 * CommentItem Component - Renders an individual comment/reply with nested replies
 * Comments have a distinct style from thread posts
 * 
 * @param {Object} props - Component props
 * @param {Reply} props.reply - Reply object containing message details
 * @param {string} props.topicId - Optional topic ID
 * @param {Array} props.allMessages - Array of all messages in the thread
 * @param {Function} props.formatTimestamp - Function to format timestamps
 * @param {number} props.level - Nesting level of the comment (for indentation)
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
  const commentRef = useRef<HTMLDivElement>(null);

  // Check if this comment is highlighted
  const isHighlighted = reply.sequence_number.toString() === highlightedCommentId;

  // Auto-scroll to highlighted comment
  useEffect(() => {
    if (isHighlighted && commentRef.current) {
      setTimeout(() => {
        commentRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
          inline: 'nearest'
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

  // Comment styling - distinct from thread posts with different background
  const indentClass = level > 0 ? "ml-4 sm:ml-8" : "";
  const highlightClass = isHighlighted
    ? "ring-2 ring-cyan-400 shadow-2xl shadow-cyan-400/60 bg-cyan-900/30 border-cyan-400"
    : "";

  return (
    <div
      ref={commentRef}
      className={`bg-slate-800/40 backdrop-blur-sm rounded-xl border border-slate-600/30 p-4 transition-all duration-300 ${indentClass} ${highlightClass}`}
      style={{ marginLeft: level > 0 ? `${Math.min(level * 16, 64)}px` : "0px" }}
    >
      {/* Comment header */}
      <div className="flex items-center justify-between mb-3">
        <UserProfile userAccountId={reply.sender} />
        <span className="text-xs text-white/40 font-mono">
          {formatTimestamp(reply.consensus_timestamp || "")}
        </span>
      </div>

      {/* Comment content */}
      <div className="mb-4">
        <p className="whitespace-pre-line text-sm sm:text-base text-white/80 font-light">
          <LinkAndHashtagReader message={reply.Message} />
        </p>
        {reply.Media && (
          <div className="mt-4 rounded-xl overflow-hidden border border-slate-600/30">
            <div className="w-full max-w-sm mx-auto">
              <ReadMediaFile cid={reply.Media} />
            </div>
          </div>
        )}
      </div>

      {/* Comment actions */}
      <div className="mt-3 flex flex-wrap items-center gap-2 sm:gap-3">
        {/* Replies toggle */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="group flex items-center gap-1 sm:gap-2 px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg bg-slate-700/50 hover:bg-slate-600/50 text-white/60 hover:text-white/80 transition-all duration-200 font-mono text-xs sm:text-sm"
        >
          <svg
            className="w-3.5 h-3.5 sm:w-4 sm:h-4"
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
          <span className="font-medium hidden sm:inline">
            {reply.comments || 0} {reply.comments === 1 ? "Reply" : "Replies"}
          </span>
          <span className="font-medium sm:hidden">{reply.comments || 0}</span>
        </button>

        {/* Reply button with like/dislike/share (isComment=true for comment-specific sharing) */}
        <Replay
          sequenceNumber={reply.sequence_number}
          topicId={topicId || ""}
          author={reply.sender}
          message_id={reply.sequence_number.toString()}
          likesCount={reply.likes}
          dislikesCount={reply.dislikes}
          userReaction={reply.userReaction ?? null}
          isComment={true}
          className="flex items-center gap-1 sm:gap-2"
        />
      </div>

      {/* Nested replies */}
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

