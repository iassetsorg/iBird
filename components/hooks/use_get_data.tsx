import { useState } from "react";
import { toast } from "react-toastify";

/**
 * @interface Message
 * @description Defines the structure for message objects in the application
 * @property {string} Choice - User's choice selection
 * @property {string} Media - Media content associated with the message
 * @property {string} Identifier - Unique identifier for the message
 * @property {string} message_id - Consensus timestamp used as message ID
 * @property {string} sender - Account ID of the message sender
 * @property {string} Message - Main message content
 * @property {string} message - Raw decoded message content
 * @property {number} sequence_number - Message sequence number
 * @property {string} Author - Author of the message
 * @property {string} [Reply_to] - Optional reference to replied message
 * @property {string} [Like_to] - Optional reference to liked message
 * @property {string} [DisLike_to] - Optional reference to disliked message
 * @property {string} [Thread] - Optional reference to the thread
 * @property {string} [Status] - Optional status of the message
 * @property {string} [Type] - Optional type of the message
 * @property {string} [Name] - Optional name of the message author
 * @property {string} [Bio] - Optional bio of the message author
 * @property {string} [Website] - Optional website of the message author
 * @property {string} [Location] - Optional location of the message author
 * @property {string} [UserMessages] - Optional user messages of the message author
 * @property {string} [Followings] - Optional followings of the message author
 * @property {string} [Picture] - Optional picture of the message author
 * @property {string} [Banner] - Optional banner of the message author
 * @property {string} [Post] - Optional post of the message author
 * @property {string} [Poll] - Optional poll of the message author
 * @property {string} [Choice1] - Optional choice 1 of the poll
 * @property {string} [Choice2] - Optional choice 2 of the poll
 * @property {string} [Choice3] - Optional choice 3 of the poll
 * @property {string} [Choice4] - Optional choice 4 of the poll
 * @property {string} [Choice5] - Optional choice 5 of the poll
 * @property {string} [consensus_timestamp] - Optional consensus timestamp of the message
 */
interface Message {
  filter(arg0: (m: Message) => boolean): unknown;
  Choice: string;
  Media: string;
  Identifier: string;
  message_id: string;
  sender: string;
  Message: string;
  message: string;
  sequence_number: number;
  Author: string;
  Reply_to?: string;
  Like_to?: string;
  DisLike_to?: string;
  Thread?: string;
  Status?: string;
  Type?: string;
  Name?: string;
  Bio?: string;
  Website?: string;
  Location?: string;
  UserMessages?: string;
  Followings?: string;
  Picture?: string;
  Banner?: string;
  Post?: string;
  Poll?: string;
  Choice1?: string;
  Choice2?: string;
  Choice3?: string;
  Choice4?: string;
  Choice5?: string;
  consensus_timestamp?: string;
  Source?: string;
  Repost?: string;
  ContentType?: string;
  Channels?: string[];
  Groups?: string[];
  FollowingChannels?: string[];
  FollowingGroups?: string[];
  ExplorerMessages?: string;
  BillboardAds?: string;
  ProfileVersion?: number;
  // Thread multi-message support
  IsThreadPost?: boolean;  // True for thread posts, undefined/false for comments
  ThreadIndex?: number;    // Position in thread sequence (0-based)
}

/**
 * @hook useGetData
 * @description Custom React hook for fetching and managing message data from the Hedera network
 * @param {string} initialTopicId - Initial topic ID to fetch messages from
 * @param {string | null} initialNextLink - Initial pagination link for subsequent data fetching
 * @param {boolean} isNew - Flag to determine message ordering (desc/asc)
 * @returns {Object} Hook state and controls
 *    @returns {Message[]} messages - Array of fetched messages
 *    @returns {boolean} loading - Loading state indicator
 *    @returns {string | null} nextLink - Link for next page of results
 *    @returns {Function} fetchMessages - Function to trigger message fetching
 */
const useGetData = (
  initialTopicId = "",
  initialNextLink: string | null = null,
  isNew = false
) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [nextLink, setNextLink] = useState<string | null>(initialNextLink);
  const [isFetching, setIsFetching] = useState<boolean>(false);
  const [loadingCleared, setLoadingCleared] = useState<boolean>(false);
  const [minLoadingTimer, setMinLoadingTimer] = useState<NodeJS.Timeout | null>(
    null
  );

  /**
   * @function fetchMessages
   * @description Fetches messages from either a topic ID or a specific API link
   * @param {string | null} topicIdOrLink - Topic ID or API link to fetch messages from
   * @param {boolean} isRefresh - Whether this is a refresh operation (clears existing messages)
   */
  const fetchMessages = async (
    topicIdOrLink: string | null,
    isRefresh = false
  ) => {
    // Prevent multiple simultaneous fetches
    if (isFetching) {
      console.log("Fetch already in progress, skipping...");
      return;
    }

    // If no topic ID or link is provided, don't fetch and clear loading state
    if (!topicIdOrLink && !initialTopicId) {
      setLoading(false);
      setIsFetching(false);
      return;
    }

    // Clear any existing minimum loading timer
    if (minLoadingTimer) {
      clearTimeout(minLoadingTimer);
    }

    setIsFetching(true);
    setLoadingCleared(false); // Reset the flag when starting a new fetch

    // Only clear messages if it's a refresh or initial load (not pagination)
    if (isRefresh || !topicIdOrLink || !/^\/api\//.test(topicIdOrLink)) {
      setMessages([]);
      setNextLink(null);
    }
    setLoading(true);

    // Determine the MirrorNode URL based on the network environment variable
    const mirrorNodeUrl =
      process.env.NEXT_PUBLIC_NETWORK === "mainnet"
        ? "https://mainnet.mirrornode.hedera.com"
        : "https://testnet.mirrornode.hedera.com";

    const apiUrl =
      topicIdOrLink && /^\/api\//.test(topicIdOrLink)
        ? `${mirrorNodeUrl}${topicIdOrLink}`
        : `${mirrorNodeUrl}/api/v1/topics/${
            topicIdOrLink || initialTopicId
          }/messages${isNew ? "?order=desc" : ""}`;

    console.log("Fetching from URL:", apiUrl);

    try {
      const response = await fetch(apiUrl);

      if (response.ok) {
        const data = await response.json();

        /**
         * @description Transforms raw message data into structured Message objects
         * @param {any} message - Raw message data from the API
         * @returns {Message | null} Structured message object or null if parsing fails
         */
        const responseData = data.messages
          .map(
            (message: {
              consensus_timestamp: string;
              payer_account_id: string;
              sequence_number: number;
              message: string;
            }) => {
              const decodedMessage = new TextDecoder("utf-8").decode(
                Uint8Array.from(atob(message.message), (c) => c.charCodeAt(0))
              );

              try {
                const {
                  Message,
                  Media,
                  Identifier,
                  Author,
                  Like_to,
                  DisLike_to,
                  Reply_to,
                  Thread,
                  Status,
                  Type,
                  Name,
                  Bio,
                  Website,
                  Location,
                  UserMessages,
                  Followings,
                  Picture,
                  Banner,
                  Post,
                  Poll,
                  Choice,
                  Choice1,
                  Choice2,
                  Choice3,
                  Choice4,
                  Choice5,
                  Source,
                  Repost,
                  ContentType,
                  Channel,
                  Group,
                  IsThreadPost,
                  ThreadIndex,
                } = JSON.parse(decodedMessage);

                return {
                  message_id: message.consensus_timestamp,
                  sender: message.payer_account_id,
                  Message,
                  Media,
                  Identifier,
                  Author,
                  Like_to,
                  DisLike_to,
                  Reply_to,
                  Thread,
                  Status,
                  Type,
                  Name,
                  Bio,
                  Website,
                  Location,
                  UserMessages,
                  Followings,
                  Picture,
                  Banner,
                  Post,
                  Poll,
                  Choice,
                  Choice1,
                  Choice2,
                  Choice3,
                  Choice4,
                  Choice5,
                  sequence_number: message.sequence_number,
                  message: decodedMessage,
                  consensus_timestamp: message.consensus_timestamp,
                  Source,
                  Repost,
                  ContentType,
                  Channel,
                  Group,
                  IsThreadPost,
                  ThreadIndex,
                };
              } catch {
                console.warn("Invalid message format:", decodedMessage);
                return null;
              }
            }
          )
          .filter(
            (message: Message | null): message is Message => message !== null
          );

        setMessages(responseData);
        setNextLink(data.links?.next || null);

        // If there are no messages, ensure loading is set to false immediately
        if (responseData.length === 0) {
          setLoading(false);
          setIsFetching(false);
          setLoadingCleared(true); // Mark that loading has been cleared
          if (minLoadingTimer) {
            clearTimeout(minLoadingTimer);
            setMinLoadingTimer(null);
          }
        }
      } else if (response.status === 404) {
        const networkType =
          process.env.NEXT_PUBLIC_NETWORK === "mainnet" ? "mainnet" : "testnet";
        toast.error(`Topic Not Found on ${networkType}`);
        setMessages([]);
        setNextLink(null);
        // Clear loading state immediately for 404 errors
        setLoading(false);
        setIsFetching(false);
        setLoadingCleared(true); // Mark that loading has been cleared
        if (minLoadingTimer) {
          clearTimeout(minLoadingTimer);
          setMinLoadingTimer(null);
        }
      } else {
        const networkType =
          process.env.NEXT_PUBLIC_NETWORK === "mainnet" ? "mainnet" : "testnet";
        toast.error(
          `Error fetching messages from ${networkType}: ${response.statusText}`
        );
        console.error(
          `Error fetching messages from ${networkType}:`,
          response.statusText
        );
        // Clear loading state immediately for other errors
        setLoading(false);
        setIsFetching(false);
        setLoadingCleared(true); // Mark that loading has been cleared
        if (minLoadingTimer) {
          clearTimeout(minLoadingTimer);
          setMinLoadingTimer(null);
        }
      }
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to fetch messages";
      toast.error(`Network Error: ${errorMessage}`);
      console.error("Error fetching messages:", error);
      // Clear loading state immediately for network errors
      setLoading(false);
      setIsFetching(false);
      setLoadingCleared(true); // Mark that loading has been cleared
      if (minLoadingTimer) {
        clearTimeout(minLoadingTimer);
        setMinLoadingTimer(null);
      }
    } finally {
      // Only set loading state if we haven't already cleared it
      // This prevents overriding the immediate loading state set when there are no messages
      if (!loadingCleared) {
        // Ensure minimum loading time to prevent flickering
        const minTimer = setTimeout(() => {
          setLoading(false);
          setIsFetching(false);
        }, 300); // 300ms minimum loading time

        setMinLoadingTimer(minTimer);
      }
    }
  };

  return {
    messages,
    loading,
    nextLink,
    fetchMessages,
  };
};

export default useGetData;
export type { Message };
