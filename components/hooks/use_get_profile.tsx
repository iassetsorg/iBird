/**
 * Custom hook to fetch profile data for a Hedera account from MirrorNode.
 * Retrieves the account's profile NFTs from a specific collection to get the profile topics,
 * then fetches the latest message from each topic to build the profile data object.
 * Handles loading and error state.
 *
 * @param signingAccount - The Hedera account ID to load profile data for
 * @returns Object with profileData, isLoading, and error values
 */
import { useState, useEffect } from "react";
import eventService from "../services/event_service";
import { useRefreshTrigger } from "./use_refresh_trigger";

// Profile NFT Collection Token ID from environment or default
const profileNFTTokenId =
  process.env.NEXT_PUBLIC_PROFILE_NFT_TOKEN_ID || "0.0.6748914";

/**
 * Represents the structure of a user's profile data
 * Supports both V1 (arrays embedded in profile) and V2 (topic IDs referencing separate topics)
 *
 * @interface ProfileData
 * @property {string} ProfileTopic - Unique identifier for the profile's topic
 * @property {string} Type - Profile message type identifier
 * @property {string} Name - User's display name
 * @property {string} Bio - User's biography or description
 * @property {string} Website - User's website URL
 * @property {string[] | string} Channels - V1: Array of channel objects, V2: Topic ID string
 * @property {string[] | string} Groups - V1: Array of group objects, V2: Topic ID string
 * @property {string[] | string} FollowingChannels - V1: Array of followed channel objects, V2: Topic ID string
 * @property {string[] | string} FollowingGroups - V1: Array of followed group objects, V2: Topic ID string
 * @property {string} ExplorerMessages - Explorer messages topic ID
 * @property {string} BillboardAds - Billboard ads topic ID
 * @property {string} PrivateMessages - Private messages topic ID (V2 only)
 * @property {string} Picture - URL or hash of user's profile picture
 * @property {string} Banner - URL or hash of user's banner image
 * @property {number | string} ProfileVersion - Version number of the profile format (1 for V1, "2" for V2)
 */
export interface ProfileData {
  ProfileTopic: string;
  Type: string;
  Name: string;
  Bio: string;
  Website: string;
  // V1: arrays of channel/group objects, V2: topic ID strings
  Channels: unknown[] | string;
  Groups: unknown[] | string;
  FollowingChannels: unknown[] | string;
  FollowingGroups: unknown[] | string;
  ExplorerMessages: string;
  BillboardAds: string;
  PrivateMessages: string; // New field in V2 (empty string for V1)
  Picture: string;
  Banner: string;
  ProfileVersion: number | string;
}

/**
 * Checks if a profile is using V2 format (topic IDs instead of arrays)
 * @param profileData - The profile data to check
 * @returns true if the profile is V2 format
 */
export function isV2Profile(profileData: ProfileData | null): boolean {
  if (!profileData) return false;
  return String(profileData.ProfileVersion) === "2";
}

/**
 * Gets the topic ID from a profile field (for V2 profiles)
 * Returns empty string if the field is an array (V1) or undefined
 * @param field - The profile field (Channels, Groups, FollowingChannels, or FollowingGroups)
 * @returns The topic ID string or empty string
 */
export function getTopicId(field: unknown[] | string | undefined): string {
  if (typeof field === "string") return field;
  return "";
}

/**
 * Gets the array data from a profile field (for V1 profiles)
 * Returns empty array if the field is a string (V2) or undefined
 * @param field - The profile field (Channels, Groups, FollowingChannels, or FollowingGroups)
 * @returns The array data or empty array
 */
export function getArrayData<T = unknown>(field: T[] | string | undefined): T[] {
  if (Array.isArray(field)) return field;
  return [];
}

/**
 * Checks if a profile field is a topic ID (V2) or empty
 * @param field - The profile field
 * @returns true if the field is a non-empty topic ID string
 */
export function hasTopicId(field: unknown[] | string | undefined): boolean {
  return typeof field === "string" && field.trim() !== "";
}

/**
 * Checks if a profile field contains array data (V1)
 * @param field - The profile field
 * @returns true if the field is an array with items
 */
export function hasArrayData(field: unknown[] | string | undefined): boolean {
  return Array.isArray(field) && field.length > 0;
}

/**
 * Custom hook to fetch profile data for a Hedera account from MirrorNode.
 * Retrieves the account's NFTs to get the profile topics, then fetches the
 * latest message from each topic to build the profile data object. Handles
 * loading and error state.
 */
const useGetProfile = (signingAccount: string) => {
  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const { refreshTrigger, triggerRefresh } = useRefreshTrigger();
  /**
   * Decodes a Base64 encoded string using TextDecoder
   * @param {string} base64String - The Base64 encoded string to decode
   * @returns {string} The decoded string
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
   * Validates if a string matches the Hedera account ID format (shard.realm.number)
   * @param {string} accountId - The string to validate
   * @returns {boolean} True if the string matches the account ID format
   */
  const isValidAccountIdFormat = (accountId: string): boolean => {
    const parts = accountId.split(".");
    return parts.length === 3 && parts.every((part) => !isNaN(Number(part)));
  };

  /**
   * Fetches account's profile NFTs from the specific profile collection
   * and extracts profile topic IDs from their metadata
   * @returns {Promise<string[]>} Array of valid profile topic IDs
   * @throws {Error} If NFT data fetch fails
   */
  const getProfileTopics = async (): Promise<string[]> => {
    const profileTopics: string[] = [];
    try {
      // Fetch NFTs from the specific profile collection only
      let next = `/api/v1/accounts/${signingAccount}/nfts?token.id=${encodeURIComponent(
        profileNFTTokenId
      )}&limit=100`;
      const mirrorNodeUrl =
        process.env.NEXT_PUBLIC_NETWORK === "mainnet"
          ? "https://mainnet.mirrornode.hedera.com"
          : "https://testnet.mirrornode.hedera.com";

      // Handle pagination if there are multiple NFTs
      while (next) {
        const response = await fetch(mirrorNodeUrl + next);

        if (!response.ok) {
          const networkType =
            process.env.NEXT_PUBLIC_NETWORK === "mainnet"
              ? "mainnet"
              : "testnet";
          throw new Error(
            `Failed to fetch profile NFT data from ${networkType}: ${response.status} ${response.statusText}`
          );
        }

        const data = await response.json();
        const nfts = data.nfts || [];

        // Process each profile NFT to extract topic IDs from metadata
        nfts.forEach((nft: { deleted?: boolean; metadata: string }) => {
          // Skip deleted NFTs
          if (nft.deleted) return;

          const metadata = nft.metadata;
          const decodedMetadata = decodeBase64(metadata);

          // Validate that the decoded metadata is a valid Hedera topic ID (profile topic)
          if (isValidAccountIdFormat(decodedMetadata)) {
            profileTopics.push(decodedMetadata);
          }
        });

        // Check for next page
        next = data.links?.next || null;
      }
    } catch (error) {
      console.error("Error fetching profile NFT data:", error);
      throw error;
    }
    return profileTopics;
  };

  /**
   * Main function to fetch and process profile data from Hedera Mirror Node
   */
  const fetchProfileData = async (): Promise<void> => {
    try {
      setIsLoading(true);
      const profileTopics = await getProfileTopics();
      const data: ProfileData[] = [];

      const mirrorNodeUrl =
        process.env.NEXT_PUBLIC_NETWORK === "mainnet"
          ? "https://mainnet.mirrornode.hedera.com"
          : "https://testnet.mirrornode.hedera.com";

      for (const topic of profileTopics) {
        const response = await fetch(
          `${mirrorNodeUrl}/api/v1/topics/${topic}/messages?order=desc`
        );

        if (!response.ok) {
          const networkType =
            process.env.NEXT_PUBLIC_NETWORK === "mainnet"
              ? "mainnet"
              : "testnet";
          throw new Error(
            `Failed to fetch messages from ${networkType}: ${response.status} ${response.statusText}`
          );
        }

        const messagesData = await response.json();
        const messages = messagesData.messages;

        messages.forEach((message: { message: string }) => {
          try {
            const decodedMessage = decodeBase64(message.message);
            const parsedMessage = JSON.parse(decodedMessage);
            parsedMessage.ProfileTopic = topic;
            data.push(parsedMessage);
          } catch {
            console.warn("Invalid message format:", message);
          }
        });
      }

      const processedData = data
        .map((d) => {
          try {
            // Determine if this is a V2 profile
            const isV2 = String(d.ProfileVersion) === "2";
            
            // Helper to preserve field as-is for V2 (topic ID string) or ensure array for V1
            const preserveField = (field: unknown): unknown[] | string => {
              if (isV2) {
                // V2: expect string (topic ID) or empty string
                return typeof field === "string" ? field : "";
              } else {
                // V1: expect array or default to empty array
                return Array.isArray(field) ? field : [];
              }
            };

            return {
              ProfileTopic: d.ProfileTopic,
              Type: d.Type || "Profile",
              Name: d.Name || "",
              Bio: d.Bio || "",
              Website: d.Website || "",
              // Preserve the field format (V1: array, V2: string topic ID)
              Channels: preserveField(d.Channels),
              Groups: preserveField(d.Groups),
              FollowingChannels: preserveField(d.FollowingChannels),
              FollowingGroups: preserveField(d.FollowingGroups),
              ExplorerMessages: d.ExplorerMessages || "",
              BillboardAds: d.BillboardAds || "",
              PrivateMessages: d.PrivateMessages || "", // V2 field
              Picture: d.Picture || "",
              Banner: d.Banner || "",
              ProfileVersion: d.ProfileVersion || 1,
            };
          } catch (error) {
            console.warn("Error processing profile data:", error);
            return null;
          }
        })
        .filter((d): d is ProfileData => d !== null);

      if (processedData.length > 0) {
        setProfileData(processedData[0]);
      }
    } catch (error) {
      console.error("Error fetching profile data:", error);
      setError("Failed to load profile data.");
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Effect hook to trigger profile data fetch when signing account changes
   * Runs only when signingAccount is available and changes
   */
  // Subscribe to refresh events
  useEffect(() => {
    const unsubscribe = eventService.subscribe("refreshExplorer", () => {
      triggerRefresh(); // This will trigger a global refresh
    });

    return () => unsubscribe(); // Add cleanup function
  }, [triggerRefresh]);

  useEffect(() => {
    if (signingAccount) {
      fetchProfileData();
    }
  }, [signingAccount, refreshTrigger]);

  return { profileData, isLoading, error };
};

export default useGetProfile;
