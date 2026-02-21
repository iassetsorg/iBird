/**
 * use_profile_lists.tsx
 * Core hook for reading and writing to profile list topics (V2 architecture).
 * 
 * V2 Profile Architecture:
 * - Channels, Groups, FollowingChannels, FollowingGroups are stored as separate Hedera topics
 * - Profile JSON contains topic IDs (strings) instead of arrays
 * - This hook abstracts reading/writing to these list topics
 * - Supports lazy topic creation: creates topic on first write if it doesn't exist
 * 
 * @module useProfileLists
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "react-toastify";
import useSendMessage from "./use_send_message";
import useCreateTopic from "./use_create_topic";
import { useAccountId } from "@buidlerlabs/hashgraph-react-wallets";

// Re-export types for convenience
export interface ChannelItem {
  Name: string;
  Channel: string;
  Description: string;
  Media: string;
  [key: string]: string; // Index signature for dynamic access
}

export interface GroupItem {
  Name: string;
  Group: string;
  Description: string;
  Media: string;
  [key: string]: string; // Index signature for dynamic access
}

export interface FollowedChannel {
  Name: string;
  Channel: string;
  Description: string;
  Media: string;
  [key: string]: string; // Index signature for dynamic access
}

export interface FollowedGroup {
  Name: string;
  Group: string;
  Description: string;
  Media: string;
  [key: string]: string; // Index signature for dynamic access
}

export type ListType = "Channels" | "Groups" | "FollowingChannels" | "FollowingGroups";
export type ListItem = ChannelItem | GroupItem | FollowedChannel | FollowedGroup;

// Import ProfileData from use_get_profile to ensure type consistency
import type { ProfileData } from "./use_get_profile";

/**
 * Step callbacks for multi-step operations
 * Used to provide UI feedback during V2 follow/add operations
 */
export interface AddItemStepCallbacks {
  onCreateTopicStart?: () => void;
  onCreateTopicComplete?: (topicId: string) => void;
  onCreateTopicError?: (error: Error) => void;
  onSendToTopicStart?: () => void;
  onSendToTopicComplete?: () => void;
  onSendToTopicError?: (error: Error) => void;
  onUpdateProfileStart?: () => void;
  onUpdateProfileComplete?: () => void;
  onUpdateProfileError?: (error: Error) => void;
}

/**
 * Result from addItem with step details
 */
export interface AddItemResult {
  success: boolean;
  newTopicId?: string;
  createdTopic?: boolean;
  updatedProfile?: boolean;
}

export interface UseProfileListsReturn {
  // Data
  items: ListItem[];
  isLoading: boolean;
  error: string | null;
  topicId: string;

  // Actions
  addItem: (item: ListItem, stepCallbacks?: AddItemStepCallbacks) => Promise<AddItemResult>;
  removeItem: (id: string) => Promise<boolean>;
  updateItem: (id: string, updates: Partial<ListItem>) => Promise<boolean>;
  refresh: () => void;
  
  // For migration - direct array write
  writeArray: (items: ListItem[]) => Promise<{ success: boolean; newTopicId?: string }>;
  
  // Check if topic exists (for determining how many steps are needed)
  hasExistingTopic: () => boolean;
}

interface CacheEntry {
  items: ListItem[];
  timestamp: number;
}

// Global cache for list data (shared across hook instances)
const listCache: Map<string, CacheEntry> = new Map();
const CACHE_TTL_MS = 30000; // 30 seconds cache

/**
 * Decodes a Base64 encoded string using TextDecoder
 */
const decodeBase64 = (base64String: string): string => {
  try {
    return new TextDecoder("utf-8").decode(
      Uint8Array.from(atob(base64String), (c) => c.charCodeAt(0))
    );
  } catch (error) {
    console.error("Error decoding Base64:", error);
    return "";
  }
};

/**
 * Gets the ID field name based on list type
 */
const getItemIdField = (listType: ListType): string => {
  switch (listType) {
    case "Channels":
    case "FollowingChannels":
      return "Channel";
    case "Groups":
    case "FollowingGroups":
      return "Group";
  }
};

/**
 * Custom hook that abstracts reading and writing to profile list topics.
 * Handles lazy topic creation and caching.
 * 
 * @param topicId - Current topic ID from profile (or empty string if not created yet)
 * @param listType - Type of list ("Channels", "Groups", "FollowingChannels", "FollowingGroups")
 * @param profileTopicId - Profile topic ID for updating profile with new topic ID
 * @param profileData - Current profile data for profile updates
 * @param onProfileUpdate - Callback to update profile with new topic ID after lazy creation
 */
const useProfileLists = (
  topicId: string,
  listType: ListType,
  profileTopicId: string,
  profileData: ProfileData | null,
  onProfileUpdate?: (newTopicId: string, listType: ListType) => Promise<boolean>
): UseProfileListsReturn => {
  const [items, setItems] = useState<ListItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentTopicId, setCurrentTopicId] = useState(topicId);
  
  const { send } = useSendMessage();
  const { create: createTopic } = useCreateTopic();
  const { data: accountId } = useAccountId();
  
  // Track if we're currently fetching to prevent duplicate requests
  const isFetchingRef = useRef(false);
  const lastFetchedTopicRef = useRef<string>("");

  /**
   * Fetches the latest message from a topic and parses it as an array
   */
  const fetchListFromTopic = useCallback(async (tId: string): Promise<ListItem[]> => {
    if (!tId || tId.trim() === "") {
      return [];
    }

    // Check cache first
    const cacheKey = `${tId}-${listType}`;
    const cached = listCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return cached.items;
    }

    const mirrorNodeUrl =
      process.env.NEXT_PUBLIC_NETWORK === "mainnet"
        ? "https://mainnet.mirrornode.hedera.com"
        : "https://testnet.mirrornode.hedera.com";

    try {
      const response = await fetch(
        `${mirrorNodeUrl}/api/v1/topics/${tId}/messages?order=desc&limit=1`
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch list from topic: ${response.statusText}`);
      }

      const data = await response.json();
      const messages = data.messages || [];

      if (messages.length === 0) {
        // Topic exists but has no messages - return empty array
        return [];
      }

      const latestMessage = messages[0];
      const decodedMessage = decodeBase64(latestMessage.message);
      const parsedArray = JSON.parse(decodedMessage);

      if (!Array.isArray(parsedArray)) {
        console.warn(`Expected array from topic ${tId}, got:`, typeof parsedArray);
        return [];
      }

      // Update cache
      listCache.set(cacheKey, { items: parsedArray, timestamp: Date.now() });

      return parsedArray;
    } catch (error) {
      console.error(`Error fetching list from topic ${tId}:`, error);
      throw error;
    }
  }, [listType]);

  /**
   * Loads the list data from the topic
   */
  const loadList = useCallback(async () => {
    // Skip if no topic ID or already fetching the same topic
    if (!currentTopicId || currentTopicId.trim() === "") {
      setItems([]);
      setIsLoading(false);
      return;
    }

    if (isFetchingRef.current && lastFetchedTopicRef.current === currentTopicId) {
      return;
    }

    isFetchingRef.current = true;
    lastFetchedTopicRef.current = currentTopicId;
    setIsLoading(true);
    setError(null);

    try {
      const fetchedItems = await fetchListFromTopic(currentTopicId);
      setItems(fetchedItems);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load list");
      setItems([]);
    } finally {
      setIsLoading(false);
      isFetchingRef.current = false;
    }
  }, [currentTopicId, fetchListFromTopic]);

  /**
   * Refresh the list data (clears cache and refetches)
   */
  const refresh = useCallback(() => {
    if (currentTopicId) {
      const cacheKey = `${currentTopicId}-${listType}`;
      listCache.delete(cacheKey);
    }
    loadList();
  }, [currentTopicId, listType, loadList]);

  /**
   * Updates the topic ID when the prop changes
   */
  useEffect(() => {
    setCurrentTopicId(topicId);
  }, [topicId]);

  /**
   * Auto-load list when topic ID is available
   */
  useEffect(() => {
    if (currentTopicId && currentTopicId.trim() !== "") {
      loadList();
    }
  }, [currentTopicId, loadList]);

  /**
   * Sends the updated array to the topic
   */
  const sendToTopic = useCallback(async (tId: string, arr: ListItem[]): Promise<boolean> => {
    try {
      const result = await send(tId, arr, "");
      if (result) {
        // Update cache with new data
        const cacheKey = `${tId}-${listType}`;
        listCache.set(cacheKey, { items: arr, timestamp: Date.now() });
        setItems(arr);
        return true;
      }
      return false;
    } catch (error) {
      console.error("Error sending to topic:", error);
      return false;
    }
  }, [send, listType]);

  /**
   * Creates a new list topic and sends initial array
   * Returns the new topic ID
   */
  const createListTopic = useCallback(async (initialArray: ListItem[]): Promise<string | undefined> => {
    try {
      const memo = `iBird ${listType} List`;
      const newTopicId = await createTopic(memo, memo, false);
      
      if (!newTopicId) {
        toast.error(`Failed to create ${listType} topic`);
        return undefined;
      }

      // Wait a moment for topic to propagate
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Send initial array to the new topic
      const sendResult = await send(newTopicId, initialArray, "");
      if (!sendResult) {
        toast.error(`Failed to initialize ${listType} topic`);
        return undefined;
      }

      // Update cache
      const cacheKey = `${newTopicId}-${listType}`;
      listCache.set(cacheKey, { items: initialArray, timestamp: Date.now() });
      
      return newTopicId;
    } catch (error) {
      console.error(`Error creating ${listType} topic:`, error);
      return undefined;
    }
  }, [createTopic, send, listType]);

  /**
   * Writes an array directly to the topic (or creates topic if needed).
   * Used for migration and bulk updates.
   */
  const writeArray = useCallback(async (newItems: ListItem[]): Promise<{ success: boolean; newTopicId?: string }> => {
    if (!accountId) {
      toast.error("Please connect your wallet");
      return { success: false };
    }

    try {
      // If topic exists, just send the new array
      if (currentTopicId && currentTopicId.trim() !== "") {
        const success = await sendToTopic(currentTopicId, newItems);
        return { success };
      }

      // Topic doesn't exist - need to create it
      const newTopicId = await createListTopic(newItems);
      
      if (!newTopicId) {
        return { success: false };
      }

      // Update profile with new topic ID if callback provided
      if (onProfileUpdate) {
        const profileUpdated = await onProfileUpdate(newTopicId, listType);
        if (!profileUpdated) {
          toast.warn("List created but profile update failed. You may need to retry.");
        }
      }

      setCurrentTopicId(newTopicId);
      setItems(newItems);
      
      return { success: true, newTopicId };
    } catch (error) {
      console.error(`Error writing array to ${listType}:`, error);
      return { success: false };
    }
  }, [accountId, currentTopicId, sendToTopic, createListTopic, onProfileUpdate, listType]);

  /**
   * Check if topic exists (for determining how many steps are needed)
   */
  const hasExistingTopic = useCallback((): boolean => {
    return !!(currentTopicId && currentTopicId.trim() !== "");
  }, [currentTopicId]);

  /**
   * Adds an item to the list.
   * If topic doesn't exist, creates it (lazy topic creation).
   * Supports step callbacks for UI progress tracking.
   */
  const addItem = useCallback(async (
    item: ListItem,
    stepCallbacks?: AddItemStepCallbacks
  ): Promise<AddItemResult> => {
    if (!accountId) {
      toast.error("Please connect your wallet");
      return { success: false };
    }

    try {
      const idField = getItemIdField(listType);
      const itemId = item[idField];

      // Check if item already exists
      const existingItem = items.find((i) => {
        return i[idField] === itemId;
      });

      if (existingItem) {
        toast.info(`This ${listType.replace("Following", "").slice(0, -1).toLowerCase()} is already in the list`);
        return { success: true, createdTopic: false, updatedProfile: false };
      }

      const newItems = [...items, item];

      // If topic exists, just send the updated array
      if (currentTopicId && currentTopicId.trim() !== "") {
        stepCallbacks?.onSendToTopicStart?.();
        try {
          const success = await sendToTopic(currentTopicId, newItems);
          if (success) {
            stepCallbacks?.onSendToTopicComplete?.();
          } else {
            stepCallbacks?.onSendToTopicError?.(new Error("Failed to send to topic"));
          }
          return { success, createdTopic: false, updatedProfile: false };
        } catch (err) {
          stepCallbacks?.onSendToTopicError?.(err instanceof Error ? err : new Error(String(err)));
          throw err;
        }
      }

      // Topic doesn't exist - need to create it (lazy creation)
      // Step 1: Create the topic
      stepCallbacks?.onCreateTopicStart?.();
      let newTopicId: string | undefined;
      try {
        const memo = `iBird ${listType} List`;
        newTopicId = await createTopic(memo, memo, false);
        const normalizedTopicId = newTopicId?.trim();
        
        if (!normalizedTopicId) {
          const error = new Error(`Failed to create ${listType} topic`);
          stepCallbacks?.onCreateTopicError?.(error);
          toast.error(`Failed to create ${listType} topic`);
          return { success: false };
        }

        newTopicId = normalizedTopicId;
        stepCallbacks?.onCreateTopicComplete?.(newTopicId);
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        stepCallbacks?.onCreateTopicError?.(error);
        throw err;
      }

      // Wait a moment for topic to propagate
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Step 2: Send initial array to the new topic
      stepCallbacks?.onSendToTopicStart?.();
      try {
        const sendResult = await send(newTopicId, newItems, "");
        if (!sendResult) {
          const error = new Error(`Failed to initialize ${listType} topic`);
          stepCallbacks?.onSendToTopicError?.(error);
          toast.error(`Failed to initialize ${listType} topic`);
          return { success: false, createdTopic: true, newTopicId };
        }
        
        // Update cache
        const cacheKey = `${newTopicId}-${listType}`;
        listCache.set(cacheKey, { items: newItems, timestamp: Date.now() });
        stepCallbacks?.onSendToTopicComplete?.();
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        stepCallbacks?.onSendToTopicError?.(error);
        throw err;
      }

      // Persist local state after successful topic creation + initial send
      setCurrentTopicId(newTopicId);
      setItems(newItems);

      // Give mirror node time to reflect the new topic/message before profile update
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Step 3: Update profile with new topic ID
      let profileUpdated = false;
      if (onProfileUpdate) {
        if (!newTopicId || newTopicId.trim() === "") {
          const error = new Error("Missing new topic ID for profile update");
          stepCallbacks?.onUpdateProfileError?.(error);
          toast.error("Profile update failed: missing topic ID");
          return { success: false, createdTopic: true, newTopicId, updatedProfile: false };
        }
        stepCallbacks?.onUpdateProfileStart?.();
        try {
          profileUpdated = await onProfileUpdate(newTopicId, listType);
          if (profileUpdated) {
            stepCallbacks?.onUpdateProfileComplete?.();
          } else {
            stepCallbacks?.onUpdateProfileError?.(new Error("Profile update returned false"));
            toast.warn("List created but profile update failed. You may need to retry.");
          }
        } catch (err) {
          const error = err instanceof Error ? err : new Error(String(err));
          stepCallbacks?.onUpdateProfileError?.(error);
          toast.warn("List created but profile update failed. You may need to retry.");
        }
      }

      if (onProfileUpdate && !profileUpdated) {
        return { success: false, newTopicId, createdTopic: true, updatedProfile: false };
      }
      
      return { success: true, newTopicId, createdTopic: true, updatedProfile: profileUpdated };
    } catch (error) {
      console.error(`Error adding item to ${listType}:`, error);
      return { success: false };
    }
  }, [accountId, items, currentTopicId, sendToTopic, createTopic, send, onProfileUpdate, listType]);

  /**
   * Removes an item from the list by ID.
   * Topic must exist for this operation.
   */
  const removeItem = useCallback(async (id: string): Promise<boolean> => {
    if (!accountId) {
      toast.error("Please connect your wallet");
      return false;
    }

    if (!currentTopicId || currentTopicId.trim() === "") {
      toast.error("Cannot remove item - list topic does not exist");
      return false;
    }

    try {
      const idField = getItemIdField(listType);
      const newItems = items.filter((item) => {
        return item[idField] !== id;
      });

      if (newItems.length === items.length) {
        toast.info("Item not found in list");
        return true; // Not an error, just not present
      }

      return await sendToTopic(currentTopicId, newItems);
    } catch (error) {
      console.error(`Error removing item from ${listType}:`, error);
      return false;
    }
  }, [accountId, items, currentTopicId, sendToTopic, listType]);

  /**
   * Updates an existing item in the list.
   * Topic must exist for this operation.
   */
  const updateItem = useCallback(async (id: string, updates: Partial<ListItem>): Promise<boolean> => {
    if (!accountId) {
      toast.error("Please connect your wallet");
      return false;
    }

    if (!currentTopicId || currentTopicId.trim() === "") {
      toast.error("Cannot update item - list topic does not exist");
      return false;
    }

    try {
      const idField = getItemIdField(listType);
      let found = false;

      const newItems: ListItem[] = items.map((item) => {
        if (item[idField] === id) {
          found = true;
          return { ...item, ...updates } as ListItem;
        }
        return item;
      });

      if (!found) {
        toast.error("Item not found in list");
        return false;
      }

      return await sendToTopic(currentTopicId, newItems);
    } catch (error) {
      console.error(`Error updating item in ${listType}:`, error);
      return false;
    }
  }, [accountId, items, currentTopicId, sendToTopic, listType]);

  return {
    items,
    isLoading,
    error,
    topicId: currentTopicId,
    addItem,
    removeItem,
    updateItem,
    refresh,
    writeArray,
    hasExistingTopic,
  };
};

export default useProfileLists;

/**
 * Utility function to get list data from a topic ID (for use outside the hook)
 */
export const fetchListFromTopicId = async (
  topicId: string,
  listType: ListType
): Promise<ListItem[]> => {
  if (!topicId || topicId.trim() === "") {
    return [];
  }

  // Check cache first
  const cacheKey = `${topicId}-${listType}`;
  const cached = listCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.items;
  }

  const mirrorNodeUrl =
    process.env.NEXT_PUBLIC_NETWORK === "mainnet"
      ? "https://mainnet.mirrornode.hedera.com"
      : "https://testnet.mirrornode.hedera.com";

  try {
    const response = await fetch(
      `${mirrorNodeUrl}/api/v1/topics/${topicId}/messages?order=desc&limit=1`
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch list from topic: ${response.statusText}`);
    }

    const data = await response.json();
    const messages = data.messages || [];

    if (messages.length === 0) {
      return [];
    }

    const latestMessage = messages[0];
    const decodedMessage = decodeBase64(latestMessage.message);
    const parsedArray = JSON.parse(decodedMessage);

    if (!Array.isArray(parsedArray)) {
      console.warn(`Expected array from topic ${topicId}, got:`, typeof parsedArray);
      return [];
    }

    // Update cache
    listCache.set(cacheKey, { items: parsedArray, timestamp: Date.now() });

    return parsedArray;
  } catch (error) {
    console.error(`Error fetching list from topic ${topicId}:`, error);
    return [];
  }
};

/**
 * Clears the entire list cache (useful after profile migration)
 */
export const clearListCache = () => {
  listCache.clear();
};

/**
 * Clears cache for a specific topic
 */
export const clearTopicCache = (topicId: string) => {
  const types: ListType[] = ["Channels", "Groups", "FollowingChannels", "FollowingGroups"];
  types.forEach(type => {
    listCache.delete(`${topicId}-${type}`);
  });
};
