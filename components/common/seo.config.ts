interface SEOConfig {
  title: string;
  description: string;
  keywords?: string;
  ogImage?: string;
  ogUrl?: string;
  canonicalUrl?: string;
  noIndex?: boolean;
  author?: string;
  publishedTime?: string;
  modifiedTime?: string;
  contentType?: "website" | "article" | "profile";
}

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://ibird.io";

/**
 * Generates SEO configuration for static pages
 */
const generateSEOConfig = (page: string): SEOConfig => {
  const configs: Record<string, SEOConfig> = {
    explore: {
      title: "Explore - iBird | Decentralized Social Platform",
      description:
        "Discover and explore messages, posts, threads, and polls on iBird - the decentralized social platform built on Hedera blockchain. Join the Web3 social revolution.",
      keywords:
        "explore, messages, posts, threads, polls, hedera, blockchain, web3, decentralized social, crypto social media",
      ogImage: `${baseUrl}/banner.png`,
      ogUrl: `${baseUrl}/app`,
      canonicalUrl: `${baseUrl}/app`,
      contentType: "website",
    },
    home: {
      title: "iBird - Decentralized Social Platform on Hedera Blockchain",
      description:
        "iBird is a decentralized social media platform built on Hedera. Share posts, create threads, run polls, and engage with content stored permanently on blockchain. Own your social experience.",
      keywords:
        "ibird, decentralized social media, hedera, blockchain social, web3-social, crypto social platform, censorship-resistant, on-chain messaging",
      ogImage: `${baseUrl}/banner.png`,
      ogUrl: baseUrl,
      canonicalUrl: baseUrl,
      contentType: "website",
    },
    profile: {
      title: "Profile - iBird | Your Web3 Identity",
      description:
        "Manage your decentralized profile on iBird. Create your on-chain identity with NFT profiles and connect with the Web3 community on Hedera.",
      keywords:
        "profile, web3 identity, nft profile, hedera, blockchain identity, decentralized identity",
      ogImage: `${baseUrl}/banner.png`,
      ogUrl: `${baseUrl}/profile`,
      canonicalUrl: `${baseUrl}/profile`,
      contentType: "profile",
    },
    lab: {
      title: "Lab - iBird | Experimental Features",
      description:
        "Test and explore experimental iBird features in our development lab. Be the first to try new Web3 social features.",
      keywords: "lab, test, development, hedera, blockchain, experimental features",
      ogImage: `${baseUrl}/banner.png`,
      ogUrl: `${baseUrl}/lab`,
      canonicalUrl: `${baseUrl}/lab`,
      contentType: "website",
    },
    chats: {
      title: "Chats - iBird | Channels & Groups",
      description:
        "Manage your channels and groups on iBird. Create communities, broadcast announcements, and engage in group discussions on the decentralized social platform.",
      keywords:
        "chats, channels, groups, community, hedera, blockchain, messaging, decentralized chat",
      ogImage: `${baseUrl}/banner.png`,
      ogUrl: `${baseUrl}/app`,
      canonicalUrl: `${baseUrl}/app`,
      contentType: "website",
    },
    channel: {
      title: "Channel - iBird | Decentralized Broadcasting",
      description:
        "View channel content on iBird. Decentralized broadcasting powered by Hedera blockchain.",
      keywords: "channel, broadcast, hedera, blockchain, decentralized channel",
      ogImage: `${baseUrl}/banner.png`,
      contentType: "website",
    },
    group: {
      title: "Group - iBird | Community Discussions",
      description:
        "Join group discussions on iBird. Decentralized community conversations powered by Hedera blockchain.",
      keywords: "group, community, discussions, hedera, blockchain, decentralized group",
      ogImage: `${baseUrl}/banner.png`,
      contentType: "website",
    },
    "how-it-works": {
      title: "How iBird Works | Web3 Decentralized Social Media on Hedera",
      description:
        "Learn how iBird works - the Web3 SocialFi platform built on Hedera blockchain. Discover decentralized posts, on-chain messaging, NFT profiles, and token-powered social interactions.",
      keywords:
        "how ibird works, hedera social media, web3 social, decentralized social media, socialfi, hedera consensus service, blockchain social network, crypto social media, censorship-resistant social, on-chain messaging, web3 socialfi",
      ogImage: `${baseUrl}/banner.png`,
      ogUrl: `${baseUrl}/how-it-works`,
      canonicalUrl: `${baseUrl}/how-it-works`,
      contentType: "website",
    },
  };

  return configs[page] || configs.home;
};

/**
 * Generates SEO configuration for dynamic content (posts, threads, polls)
 */
const generateDynamicSEOConfig = (
  type: "post" | "thread" | "poll",
  content: string,
  authorId: string,
  timestamp: string,
  id: string,
  mediaUrl?: string
): SEOConfig => {
  const truncatedContent =
    content.length > 155 ? content.substring(0, 155) + "..." : content;
  const date = new Date(parseFloat(timestamp) * 1000).toISOString();

  const typeLabels = {
    post: "Post",
    thread: "Thread",
    poll: "Poll",
  };

  return {
    title: `${truncatedContent} | iBird ${typeLabels[type]}`,
    description: `${truncatedContent} - A ${type} by ${authorId} on iBird, the decentralized social platform built on Hedera blockchain.`,
    keywords: `ibird, ${type}, hedera, blockchain, decentralized social, web3`,
    ogImage: mediaUrl || `${baseUrl}/banner.png`,
    ogUrl: `${baseUrl}/${type}/${id}`,
    canonicalUrl: `${baseUrl}/${type}/${id}`,
    author: authorId,
    publishedTime: date,
    modifiedTime: date,
    contentType: "article",
  };
};

/**
 * Generates SEO configuration for user profiles
 */
const generateProfileSEOConfig = (
  accountId: string,
  name?: string,
  bio?: string
): SEOConfig => {
  const displayName = name || accountId;
  const description =
    bio ||
    `View ${displayName}'s profile on iBird - the decentralized social platform on Hedera blockchain.`;

  return {
    title: `${displayName} | iBird Profile`,
    description: description.length > 155 ? description.substring(0, 155) + "..." : description,
    keywords: `${displayName}, profile, ibird, hedera, blockchain, web3 identity`,
    ogImage: `${baseUrl}/banner.png`,
    ogUrl: `${baseUrl}/profile?id=${accountId}`,
    canonicalUrl: `${baseUrl}/profile?id=${accountId}`,
    contentType: "profile",
  };
};

/**
 * Generates SEO configuration for channels
 */
const generateChannelSEOConfig = (
  channelId: string,
  name?: string,
  description?: string,
  mediaUrl?: string
): SEOConfig => {
  const displayName = name || `Channel ${channelId}`;
  const desc =
    description ||
    `${displayName} on iBird - Decentralized channel on Hedera blockchain.`;

  return {
    title: `${displayName} | iBird Channel`,
    description: desc.length > 155 ? desc.substring(0, 155) + "..." : desc,
    keywords: `${displayName}, channel, ibird, hedera, blockchain, decentralized broadcasting`,
    ogImage: mediaUrl || `${baseUrl}/banner.png`,
    ogUrl: `${baseUrl}/channel/${channelId}`,
    canonicalUrl: `${baseUrl}/channel/${channelId}`,
    contentType: "website",
  };
};

/**
 * Generates SEO configuration for groups
 */
const generateGroupSEOConfig = (
  groupId: string,
  name?: string,
  description?: string,
  mediaUrl?: string
): SEOConfig => {
  const displayName = name || `Group ${groupId}`;
  const desc =
    description ||
    `${displayName} on iBird - Decentralized group discussions on Hedera blockchain.`;

  return {
    title: `${displayName} | iBird Group`,
    description: desc.length > 155 ? desc.substring(0, 155) + "..." : desc,
    keywords: `${displayName}, group, ibird, hedera, blockchain, community, decentralized chat`,
    ogImage: mediaUrl || `${baseUrl}/banner.png`,
    ogUrl: `${baseUrl}/group/${groupId}`,
    canonicalUrl: `${baseUrl}/group/${groupId}`,
    contentType: "website",
  };
};

export {
  generateSEOConfig,
  generateDynamicSEOConfig,
  generateProfileSEOConfig,
  generateChannelSEOConfig,
  generateGroupSEOConfig,
};
export type { SEOConfig };

