# iBird - Decentralized Social Media Platform

<div align="center">

![iBird Logo](public/icon.png)

**A fully decentralized social media platform built on Hedera Hashgraph**

[![Next.js](https://img.shields.io/badge/Next.js-15.3.5-black?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-blue?logo=react)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Hedera](https://img.shields.io/badge/Hedera-Hashgraph-purple)](https://hedera.com/)
[![License: CC BY-NC 4.0](https://img.shields.io/badge/License-CC%20BY--NC%204.0-lightgrey.svg)](https://creativecommons.org/licenses/by-nc/4.0/)

[Live Demo](https://ibird.io) · [Documentation](#table-of-contents) · [Report Bug](https://github.com/ibird/issues)

</div>

---

## Table of Contents

- [Project Overview](#project-overview)
  - [What is iBird?](#what-is-ibird)
  - [Core Value Proposition](#core-value-proposition)
  - [Problems Solved](#problems-solved)
- [Architecture Deep Dive](#architecture-deep-dive)
  - [System Architecture](#system-architecture)
  - [Component Hierarchy](#component-hierarchy)
  - [Technology Stack](#technology-stack)
  - [Design Philosophy](#design-philosophy)
- [Tokenomics](#tokenomics)
  - [HBAR Usage](#hbar-usage)
  - [ASSET Token](#asset-token)
  - [Fee Structure](#fee-structure)
- [Topic System](#topic-system)
  - [How Topics Work](#how-topics-work)
  - [Topic Types](#topic-types)
  - [Topic Naming Conventions](#topic-naming-conventions)
- [Profile Architecture (V1 vs V2)](#profile-architecture-v1-vs-v2)
  - [V1 Profile Format](#v1-profile-format)
  - [V2 Profile Format](#v2-profile-format)
  - [Profile Migration](#profile-migration)
- [Message Flow and Communication](#message-flow-and-communication)
  - [JSON Message Structures](#json-message-structures)
  - [Message Types Reference](#message-types-reference)
- [Complete Workflows](#complete-workflows)
  - [Post Workflow](#post-workflow)
  - [Thread Workflow](#thread-workflow)
  - [Poll Workflow](#poll-workflow)
  - [Channel Workflow](#channel-workflow)
  - [Group Workflow](#group-workflow)
  - [Profile Creation Workflow](#profile-creation-workflow)
  - [Tipping Workflow](#tipping-workflow)
- [Multi-Step Transaction Architecture](#multi-step-transaction-architecture)
- [Configuration and Setup](#configuration-and-setup)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Environment Variables](#environment-variables)
  - [Network Configuration](#network-configuration)
- [Key Addresses](#key-addresses)
- [Contributing](#contributing)
- [License](#license)
- [Acknowledgments](#acknowledgments)

---

## Project Overview

### What is iBird?

iBird is a **fully decentralized Web3 SocialFi platform** built on **Hedera** where all content is permanently stored on the blockchain. Unlike traditional social media platforms that store data on centralized servers, iBird leverages Hedera Consensus Service (HCS) for message storage and Arweave for permanent media storage.

Every post, comment, like, and interaction is recorded as an immutable transaction on Hedera's distributed ledger, ensuring:

- **Censorship Resistance**: No central authority can delete or modify content
- **Data Permanence**: Content lives forever on the blockchain
- **True Ownership**: Users own their profiles as NFTs
- **Transparent Operations**: All transactions are verifiable on HashScan
- **SocialFi**: Earn tips in HBAR and ASSET tokens directly from your audience

### Core Value Proposition

| Feature         | Traditional Social Media      | iBird                        |
| --------------- | ----------------------------- | ---------------------------- |
| Data Ownership  | Platform owns your data       | You own your data            |
| Censorship      | Platform can delete content   | Immutable on blockchain      |
| Account Control | Platform can suspend accounts | NFT-based profiles you own   |
| Monetization    | Platform takes revenue        | Direct tipping between users |
| Media Storage   | Centralized servers           | Decentralized via Arweave    |
| Verification    | Platform-controlled           | On-chain verification        |

### Problems Solved

1. **Centralized Control**: Traditional platforms can arbitrarily censor, modify, or delete content. iBird stores everything on-chain.

2. **Data Portability**: Users can't export or truly own their social graph. iBird profiles are NFTs you control.

3. **Platform Risk**: Accounts can be suspended without recourse. iBird accounts are blockchain assets.

4. **Opaque Algorithms**: Traditional feeds are controlled by hidden algorithms. iBird's content is transparent and verifiable.

5. **Monetization Inequality**: Creators get little from platforms. iBird enables direct HBAR/ASSET tipping with only 1% platform fee.

---

## Architecture Deep Dive

### System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              iBird Architecture                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐                │
│  │   Frontend   │────▶│   Wallets    │────▶│   Hedera     │                │
│  │   (Next.js)  │     │  (Kabila,    │     │   Network    │                │
│  │              │     │   HashPack,  │     │              │                │
│  │  App Tabs:   │     │   WalletCon) │     │  ┌────────┐  │                │
│  │  ┌────────┐  │     └──────────────┘     │  │  HCS   │  │                │
│  │  │Explorer│  │                          │  │ Topics │  │                │
│  │  │Chats   │  │     ┌──────────────┐     │  └────────┘  │                │
│  │  │Billbrd │  │────▶│   Arweave    │     │              │                │
│  │  └────────┘  │     │   Storage    │     │  ┌────────┐  │                │
│  │              │     │              │     │  │  NFT   │  │                │
│  │  Content:    │     │  ┌────────┐  │     │  │ Smart  │  │                │
│  │  Posts,Polls │     │  │ Media  │  │     │  │Contract│  │                │
│  │  Threads,Ads │     │  │ Files  │  │     │  └────────┘  │                │
│  └──────────────┘     │  └────────┘  │     │              │                │
│         │             └──────────────┘     └──────────────┘                │
│         │                                         │                         │
│         ▼                                         ▼                         │
│  ┌──────────────┐                          ┌──────────────┐                │
│  │   Mirror     │◀─────────────────────────│  Consensus   │                │
│  │    Node      │                          │   Nodes      │                │
│  │   (REST)     │                          │              │                │
│  └──────────────┘                          └──────────────┘                │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Component Hierarchy

```
src/
├── pages/                          # Next.js pages (routes)
│   ├── _app.tsx                   # App wrapper with wallet providers + SEO meta
│   ├── _document.tsx              # Document customization
│   ├── index.tsx                  # Landing page
│   ├── app.tsx                    # Main application (Explorer / Chats / Billboard tabs)
│   ├── profile.tsx                # User profile page
│   ├── lab.tsx                    # Developer lab
│   ├── how-it-works.tsx           # SEO-optimized explainer page with FAQ
│   ├── channel/[id].tsx           # Dynamic channel view
│   ├── group/[id].tsx             # Dynamic group view
│   ├── Posts/[sequenceNumber].tsx # Shareable post permalink
│   ├── Threads/[topicId].tsx      # Shareable thread permalink
│   ├── Polls/[topicId].tsx        # Shareable poll permalink
│   ├── Ads/[sequenceNumber].tsx   # Shareable billboard ad permalink
│   └── api/
│       └── sitemap.ts             # Dynamic XML sitemap
│
├── components/
│   ├── wallet/                    # Wallet integration
│   │   ├── WalletContext.tsx      # Global wallet state
│   │   ├── config.tsx             # Wallet configuration
│   │   ├── wallet.tsx             # Wallet display component
│   │   └── ConnectModal.tsx       # Wallet connection UI
│   │
│   ├── layout/
│   │   └── Navbar.tsx             # Global navigation bar
│   │
│   ├── hooks/                     # Custom React hooks
│   │   ├── use_send_message.tsx       # Send HCS messages
│   │   ├── use_create_topic.tsx       # Create HCS topics
│   │   ├── use_get_data.tsx           # Fetch topic messages
│   │   ├── use_get_post_data.tsx      # Fetch single post data
│   │   ├── use_get_profile.tsx        # Fetch user profiles (V1 + V2)
│   │   ├── use_follow.tsx             # Follow/unfollow logic
│   │   ├── use_asset_balance.tsx      # Token balance queries
│   │   ├── use_profile_lists.tsx      # Read/write V2 profile list topics
│   │   ├── use_profile_migration.tsx  # Migrate V1 → V2 profiles
│   │   └── use_refresh_trigger.tsx    # UI refresh event bus
│   │
│   ├── send message/              # Content creation
│   │   ├── new_message.tsx            # Message composer
│   │   ├── send_new_post.tsx          # Post creation (multi-step)
│   │   ├── send_new_poll.tsx          # Poll creation (multi-step)
│   │   ├── send_new_thread.tsx        # Thread creation (multi-step)
│   │   └── add_to_thread.tsx          # Add message to existing thread
│   │
│   ├── read message/              # Content display
│   │   ├── read_post.tsx              # Post renderer
│   │   ├── read_poll.tsx              # Poll renderer
│   │   ├── read_thread.tsx            # Thread renderer
│   │   └── read_repost.tsx            # Repost renderer
│   │
│   ├── read shared message/       # Shareable permalink renderers
│   │   ├── read_shared_post.tsx
│   │   ├── read_shared_thread.tsx
│   │   └── read_shared_poll.tsx
│   │
│   ├── billboard/                 # Billboard advertisement system
│   │   ├── billboard.tsx
│   │   ├── read_ad.tsx
│   │   ├── read_shared_ad.tsx
│   │   └── send_new_ad.tsx            # Ad creation (multi-step)
│   │
│   ├── explorer/                  # Explorer feed
│   │   ├── explorer.tsx               # Main public feed
│   │   └── user_explore.tsx           # User discovery / search
│   │
│   ├── chats/                     # Unified chats (channels + groups)
│   │   ├── chats_manager.tsx          # Navigation - list ↔ channel/group view
│   │   └── unified_chat_list.tsx      # Combined channels & groups list
│   │
│   ├── channels/                  # Channel management
│   │   ├── create_new_channel.tsx     # (multi-step)
│   │   ├── channel_list.tsx
│   │   ├── channel_view.tsx
│   │   ├── channel_manager.tsx
│   │   └── update_channel.tsx         # (multi-step)
│   │
│   ├── groups/                    # Group management
│   │   ├── create_new_group.tsx       # (multi-step)
│   │   ├── group_list.tsx
│   │   ├── group_view.tsx
│   │   ├── group_manager.tsx
│   │   └── update_group.tsx           # (multi-step)
│   │
│   ├── profile/                   # Profile management
│   │   ├── create_new_profile.tsx     # (multi-step, up to 6 steps)
│   │   ├── profile.tsx
│   │   ├── user_profile.tsx
│   │   ├── update_profile.tsx         # (multi-step)
│   │   └── migration_modal.tsx        # V1 → V2 migration UI
│   │
│   ├── media/                     # Media handling
│   │   ├── read_media_file.tsx
│   │   └── use_upload_to_arweave.tsx
│   │
│   ├── tip/                       # Tipping system
│   │   └── tip.tsx                    # HBAR + ASSET tipping
│   │
│   ├── replay/                    # Reply/interaction
│   │   ├── replay_to_thread.tsx       # (multi-step)
│   │   ├── replay_to_poll.tsx         # (multi-step)
│   │   └── repost.tsx
│   │
│   ├── landing/                   # Landing page components
│   │   ├── Hero.tsx
│   │   └── Lab.tsx
│   │
│   ├── utils/                     # Shared utilities
│   │   ├── execute-transaction.ts     # Centralized transaction executor
│   │   ├── transaction-errors.ts      # Error classification
│   │   ├── cropImage.ts               # Image crop helper
│   │   └── nextjs-dev-error-suppression.ts
│   │
│   ├── services/
│   │   └── event_service.ts           # Global pub/sub event bus
│   │
│   └── common/                    # Shared UI components
│       ├── modal.tsx
│       ├── SimpleModal.tsx
│       ├── Spinner.tsx
│       ├── EnhancedSpinner.tsx
│       ├── LoadingSpinner.tsx
│       ├── EmojiPickerPopup.tsx
│       ├── ImageCropModal.tsx
│       ├── InsufficientBalanceModal.tsx
│       ├── MessageCard.tsx
│       ├── ResponsiveLayout.tsx
│       ├── TypewriterEffect.tsx
│       ├── SEOHead.tsx
│       ├── StructuredData.tsx
│       ├── seo.config.ts
│       ├── link_and_hashtag_reader.tsx
│       └── formatTimestamp.ts
```

### Technology Stack

| Layer               | Technology                        | Purpose                       |
| ------------------- | --------------------------------- | ----------------------------- |
| **Frontend**        | Next.js 15.3.5, React 19          | UI framework and SSR          |
| **Styling**         | Tailwind CSS v4                   | Utility-first CSS             |
| **Language**        | TypeScript 5                      | Type-safe development         |
| **Blockchain**      | Hedera Hashgraph                  | Consensus and storage         |
| **Wallets**         | HashPack, Kabila, WalletConnect   | User authentication           |
| **Media Storage**   | Arweave (via ArDrive Turbo)       | Permanent file storage        |
| **Smart Contracts** | Solidity                          | NFT profile minting           |
| **Icons**           | React Icons, Lucide React         | UI iconography                |
| **Notifications**   | React Toastify                    | User feedback                 |
| **Image Handling**  | react-easy-crop, react-image-crop | Profile/banner image cropping |
| **Media Playback**  | react-player                      | In-feed video rendering       |
| **Animations**      | react-type-animation, typed.js    | Landing page effects          |
| **Theming**         | next-themes                       | Light/dark mode support       |
| **HTTP**            | axios                             | API requests                  |
| **Arweave Upload**  | arbundles                         | Arweave bundle signing        |

### Design Philosophy

iBird follows these core principles:

1. **Decentralization First**: Every piece of data that can be stored on-chain, is stored on-chain.

2. **SocialFi**: Social interactions are tied to real economic value through tipping and the ASSET token burn mechanism.

3. **Multi-Step Transactions**: Complex operations are broken into clear, resumable steps with a consistent UI pattern. See [`architecture/multi-step-transaction-architecture.md`](architecture/multi-step-transaction-architecture.md).

4. **Auto-Progression**: Users can enable automatic transaction progression for faster workflows.

5. **Error Resilience**: All transactions have retry mechanisms and clear error states.

6. **Profile Versioning**: Profiles support V1 (array-embedded) and V2 (topic ID-referenced) formats, with seamless in-app migration.

---

## Tokenomics

iBird uses a dual-token economy combining HBAR (Hedera's native token) with ASSET (iBird's utility token).

### HBAR Usage

HBAR is used for all network operations:

| Action                           | Cost              |
| -------------------------------- | ----------------- |
| Network transaction fees         | ~$0.0001 (varies) |
| Profile NFT minting              | 1 HBAR            |
| Topic creation (channels/groups) | ~0.01 HBAR        |
| Tipping                          | Variable          |

### ASSET Token

**Token ID:** `0.0.1991880` (HTS Token)

ASSET is the platform utility token with a **deflationary burn mechanism**:

| Action                  | Cost (ASSET) | Destination                   |
| ----------------------- | ------------ | ----------------------------- |
| Post to Explorer        | 1,000 ASSET  | 🔥 Burned                     |
| Billboard Advertisement | 10,000 ASSET | 🔥 Burned                     |
| Tipping                 | Variable     | Creator (99%) + Treasury (1%) |

**🔥 Burn Mechanism:** ASSET tokens used for posting fees are sent to the burn address (`0.0.8215507`), permanently reducing total supply. The more iBird is used, the scarcer ASSET becomes.

**Trade ASSET:** [SaucerSwap](https://www.saucerswap.finance/trade/HBAR/0.0.1991880)

### Fee Structure

```
┌─────────────────────────────────────────────────────────────────┐
│                         FEE BREAKDOWN                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  TIPPING (HBAR or ASSET):                                        │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  99% → Content Creator                                      │ │
│  │   1% → Platform Treasury (0.0.2278621)                      │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  POSTING FEES (ASSET):                                           │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  100% → Burn Address (0.0.8215507)                          │ │
│  │  (Permanently removed from circulation)                     │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Topic System

### How Topics Work

Hedera Consensus Service (HCS) **Topics** are the backbone of iBird's data storage. A Topic is essentially a stream of messages that anyone can write to and read from.

```
┌─────────────────────────────────────────────────────────────────┐
│                        HCS Topic: 0.0.10214045                   │
├─────────────────────────────────────────────────────────────────┤
│  Seq 1: {"Type":"Post","Message":"Hello World","Media":null}    │
│  Seq 2: {"Type":"Poll","Poll":"0.0.10214050"}                   │
│  Seq 3: {"Type":"Post","Message":"GM everyone!","Media":"ar://."}│
│  Seq 4: {"Reply_to":"1","Message":"Great post!"}                │
│  Seq 5: {"Like_to":"1"}                                         │
│  ...                                                             │
└─────────────────────────────────────────────────────────────────┘
```

Each message in a topic has:

- **Sequence Number**: Unique identifier within the topic
- **Consensus Timestamp**: When consensus was reached
- **Sender**: The Hedera account that submitted the message
- **Message**: JSON payload (base64 encoded)

### Topic Types

| Topic Type        | Purpose                       | Submit Key                         | Example             |
| ----------------- | ----------------------------- | ---------------------------------- | ------------------- |
| **Explorer**      | Global public feed            | None (anyone can post)             | `0.0.10214045`      |
| **Billboard**     | Advertisements                | None                               | `0.0.10214048`      |
| **Profile**       | User's profile data           | User's key                         | Per-user topic      |
| **Channels List** | V2: list of user's channels   | User's key                         | Per-user topic      |
| **Groups List**   | V2: list of user's groups     | User's key                         | Per-user topic      |
| **Following Ch.** | V2: list of followed channels | User's key                         | Per-user topic      |
| **Following Gr.** | V2: list of followed groups   | User's key                         | Per-user topic      |
| **Thread**        | Long-form discussion          | None                               | Created per thread  |
| **Poll**          | Voting/survey                 | None                               | Created per poll    |
| **Channel**       | Creator announcements         | Creator's key (only creator posts) | Created per channel |
| **Group**         | Community discussions         | None (anyone in group posts)       | Created per group   |

### Topic Naming Conventions

Topics are identified by their Hedera Topic ID in the format: `0.0.XXXXXXX`

- **First segment**: Always `0` (shard)
- **Second segment**: Always `0` (realm)
- **Third segment**: Entity number (unique identifier)

When creating topics, iBird uses meaningful memos:

- Profile topics: `"ibird profile"`
- Channel topics: `"Channel: {name}"`
- Group topics: `"Group: {name}"`
- V2 list topics: `"iBird Channels List"`, `"iBird Groups List"`, `"iBird Following Channels List"`, `"iBird Following Groups List"`

---

## Profile Architecture (V1 vs V2)

Profiles have two versions. All new profiles are created as V2.

### V1 Profile Format

In V1, channels, groups, and following lists are stored directly as arrays embedded in the profile JSON message:

```json
{
  "Type": "Profile",
  "Name": "CryptoEnthusiast",
  "Bio": "Web3 builder",
  "Channels": [{ "Name": "My Channel", "Channel": "0.0...." }],
  "Groups": [{ "Name": "Hedera Devs", "Group": "0.0...." }],
  "FollowingChannels": ["0.0.10220001"],
  "FollowingGroups": ["0.0.10221001"],
  "ProfileVersion": 1
}
```

**Problem:** HCS messages have a size limit (~1,024 bytes after encoding). Large channel/group lists exceed this.

### V2 Profile Format

In V2, each list is stored in its own dedicated HCS topic. The profile JSON only contains the topic IDs:

```json
{
  "Type": "Profile",
  "Name": "CryptoEnthusiast",
  "Bio": "Web3 builder",
  "Channels": "0.0.10230010",
  "Groups": "0.0.10230011",
  "FollowingChannels": "0.0.10230012",
  "FollowingGroups": "0.0.10230013",
  "ExplorerMessages": "",
  "BillboardAds": "",
  "PrivateMessages": "",
  "Picture": "ar://profilePicCID",
  "Banner": "ar://bannerCID",
  "ProfileVersion": "2"
}
```

Each list topic stores the current array as its most recent message (the latest message is the source of truth).

**Lazy Topic Creation:** V2 list topics are created on demand — if a user has no channels, the `Channels` topic is only created when they create their first channel.

### Profile Migration

Existing V1 users must migrate before performing write actions. The migration:

1. Creates separate HCS topics for each non-empty list
2. Sends the existing array data to each new topic
3. Updates the profile JSON with the new topic IDs and `ProfileVersion: "2"`

The in-app migration UI (`migration_modal.tsx`) guides users through each step with the standard multi-step transaction pattern. The `use_profile_migration.tsx` hook handles all migration logic.

---

## Message Flow and Communication

### JSON Message Structures

All messages in iBird are JSON objects submitted to HCS topics. The structure varies by message type.

#### Understanding the Two-Layer System

For complex content (Threads, Polls), iBird uses a **two-layer architecture**:

1. **Reference Message** → Sent to Explorer topic (lightweight pointer)
2. **Content Messages** → Sent to dedicated topic (full content)

```
Explorer Topic (0.0.10214045)          Thread Topic (0.0.10215000)
┌────────────────────────────┐         ┌────────────────────────────┐
│ {"Type":"Thread",          │         │ {"Type":"Thread",          │
│  "Thread":"0.0.10215000"}  │ ──────▶ │  "Message":"Full content..",│
│                            │         │  "Media":"ar://xyz123"}    │
└────────────────────────────┘         └────────────────────────────┘
```

### Message Types Reference

#### 1. Post Message (Simple Content)

Sent directly to the Explorer topic (or a group/channel topic).

```json
{
  "Type": "Post",
  "Message": "Hello iBird! This is my first post 🚀",
  "Media": "ar://abc123xyz"
}
```

| Field     | Type   | Required | Description                      |
| --------- | ------ | -------- | -------------------------------- |
| `Type`    | string | Yes      | Always `"Post"`                  |
| `Message` | string | Yes      | Post content (max ~850 chars)    |
| `Media`   | string | No       | Arweave URI (`ar://...`) or null |

#### 2. Thread Messages

**Step 1: Reference to Explorer**

```json
{
  "Type": "Thread",
  "Thread": "0.0.10215000"
}
```

**Step 2: Content to Thread Topic**

```json
{
  "Type": "Thread",
  "Message": "This is a long-form thread post with detailed content...",
  "Media": "ar://abc123xyz"
}
```

#### 3. Poll Messages

**Step 1: Reference to Explorer**

```json
{
  "Type": "Poll",
  "Poll": "0.0.10216000"
}
```

**Step 2: Poll Content to Poll Topic**

```json
{
  "Message": "What's your favorite blockchain?",
  "Media": null,
  "Choice1": "Hedera",
  "Choice2": "Ethereum",
  "Choice3": "Solana",
  "Choice4": "Bitcoin",
  "Choice5": null
}
```

**Step 3: Vote Submission (to Poll Topic)**

```json
{
  "Choice": "Choice1"
}
```

#### 4. Reply Message

```json
{
  "Author": "0.0.123456",
  "Reply_to": "5",
  "Message": "Great point! I completely agree.",
  "Media": "ar://xyz789"
}
```

#### 5. Like Message

```json
{
  "Author": "0.0.123456",
  "Like_to": "5"
}
```

#### 6. Dislike Message

```json
{
  "Author": "0.0.123456",
  "DisLike_to": "5"
}
```

#### 7. Profile Message (V2)

Sent to user's personal profile topic.

```json
{
  "Type": "Profile",
  "Name": "CryptoEnthusiast",
  "Bio": "Web3 builder | Hedera advocate | Building the future 🌐",
  "Website": "https://example.com",
  "Picture": "ar://profilePicCID",
  "Banner": "ar://bannerCID",
  "Channels": "0.0.10230010",
  "Groups": "0.0.10230011",
  "FollowingChannels": "0.0.10230012",
  "FollowingGroups": "0.0.10230013",
  "ExplorerMessages": "",
  "BillboardAds": "",
  "PrivateMessages": "",
  "ProfileVersion": "2"
}
```

#### 8. Channel Identifier Message

Sent as the first message in a new channel topic.

```json
{
  "Type": "ChannelIdentifier",
  "Name": "Official Announcements",
  "Description": "All official updates and news",
  "Media": "ar://channelLogoCID"
}
```

#### 9. Group Identifier Message

Sent as the first message in a new group topic.

```json
{
  "Type": "GroupIdentifier",
  "Name": "Hedera Builders",
  "Description": "Community for Hedera developers",
  "Media": "ar://groupLogoCID"
}
```

#### 10. Billboard Advertisement

```json
{
  "Type": "Ad",
  "Title": "Check out our new DApp!",
  "Message": "Revolutionary decentralized application...",
  "Link": "https://example.com",
  "Media": "ar://adImageCID"
}
```

---

## Complete Workflows

### Post Workflow

Creating a simple post is the most straightforward workflow.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           POST CREATION WORKFLOW                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────┐   ┌──────────────┐   ┌────────────────┐   ┌──────────────┐   │
│  │  User    │──▶│  Compose     │──▶│  Upload Media  │──▶│  Submit to   │   │
│  │  Types   │   │  Message     │   │  to Arweave    │   │  Explorer    │   │
│  │  Post    │   │  + Media?    │   │  (if media)    │   │  Topic       │   │
│  └──────────┘   └──────────────┘   └────────────────┘   └──────────────┘   │
│                                             │                    │          │
│                                             ▼                    ▼          │
│                                    ┌────────────────┐   ┌──────────────┐   │
│                                    │  ar://abc123   │   │  SUCCESS!    │   │
│                                    │  (Media CID)   │   │  Post Live   │   │
│                                    └────────────────┘   └──────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Steps:**

1. **Compose** - User writes post content and optionally attaches media
2. **Upload** (if media) - Media file is uploaded to Arweave via ArDrive Turbo
3. **Submit** - JSON message sent to Explorer topic via HCS

**Code Flow:**

```typescript
// From send_new_post.tsx
const handleSendPost = async () => {
  // Step 1: Upload media if exists
  if (file) {
    const mediaCID = await uploadToArweave(file);
  }

  // Step 2: Create message
  const message = {
    Type: "Post",
    Message: postContent,
    Media: mediaCID || null,
  };

  // Step 3: Send to Explorer topic
  await send(explorerTopicId, message);
};
```

### Thread Workflow

Threads require creating a dedicated topic first.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          THREAD CREATION WORKFLOW                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Step 1: Create Topic                                                        │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │  TopicCreateTransaction → Topic ID: 0.0.10215000                     │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                      │                                       │
│                                      ▼                                       │
│  Step 2: Publish Reference to Explorer                                       │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │  Explorer Topic ← {"Type":"Thread","Thread":"0.0.10215000"}          │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                      │                                       │
│                                      ▼                                       │
│  Step 3+: Send Thread Messages (one per message entry, each with optional   │
│           Arweave upload + HCS send)                                         │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │  Thread Topic ← {"Type":"Thread","Message":"...","Media":"ar://..."}│   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Poll Workflow

Similar to threads but with voting functionality.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           POLL CREATION WORKFLOW                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Step 1: Create Poll Topic                                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  TopicCreateTransaction → Topic ID: 0.0.10216000                    │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                      │                                       │
│                                      ▼                                       │
│  Step 2: Publish to Explorer                                                 │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  {"Type":"Poll","Poll":"0.0.10216000"} → Explorer Topic             │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                      │                                       │
│                                      ▼                                       │
│  Step 3: Send Poll Content                                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  {"Message":"Question?","Choice1":"A","Choice2":"B",...}            │    │
│  │  → Poll Topic                                                        │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                      │                                       │
│                                      ▼                                       │
│  Step 4: Users Vote                                                          │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  {"Choice":"Choice1"} → Poll Topic (each vote is a message)         │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Channel Workflow

Channels are creator-controlled broadcasting streams.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         CHANNEL CREATION WORKFLOW                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Step 1: Create Channel Topic (with Submit Key)                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  TopicCreateTransaction                                              │    │
│  │    .setSubmitKey(userKey)  ← Only creator can post!                 │    │
│  │  → Topic ID: 0.0.10220000                                           │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                      │                                       │
│                                      ▼                                       │
│  Step 2: Upload Channel Image (Optional)                                     │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  Channel Logo → Arweave → ar://channelLogo123                       │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                      │                                       │
│                                      ▼                                       │
│  Step 3: Send Channel Identifier                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  {"Type":"ChannelIdentifier","Name":"...","Description":"...",...}  │    │
│  │  → Channel Topic (first message)                                    │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                      │                                       │
│                                      ▼                                       │
│  Step 4: Update User Profile (V2: append to Channels list topic)             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  Append channel to Channels list topic (lazy-creates topic if new)  │    │
│  │  + Updates profile if new list topic was created                    │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Group Workflow

Groups are community spaces where anyone can post.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           GROUP CREATION WORKFLOW                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Step 1: Create Group Topic (NO Submit Key)                                  │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  TopicCreateTransaction                                              │    │
│  │    ← No submit key = anyone can post                                │    │
│  │  → Topic ID: 0.0.10221000                                           │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                      │                                       │
│                                      ▼                                       │
│  Step 2: Upload Group Image (Optional)                                       │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  Group Logo → Arweave → ar://groupLogo456                           │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                      │                                       │
│                                      ▼                                       │
│  Step 3: Send Group Identifier                                               │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  {"Type":"GroupIdentifier","Name":"...","Description":"...",...}    │    │
│  │  → Group Topic (first message)                                       │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                      │                                       │
│                                      ▼                                       │
│  Step 4: Update User Profile (V2: append to Groups list topic)               │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  Append group to Groups list topic (lazy-creates topic if new)      │    │
│  │  + Updates profile if new list topic was created                    │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Profile Creation Workflow

The most complex workflow - creates an NFT-backed user profile using V2 format.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       PROFILE CREATION WORKFLOW (V2)                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Step 1: Upload Profile Picture (Optional)                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  Profile Photo → Arweave → ar://profilePic789                       │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                      │                                       │
│                                      ▼                                       │
│  Step 2: Upload Banner (Optional)                                            │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  Banner Image → Arweave → ar://banner012                            │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                      │                                       │
│                                      ▼                                       │
│  Step 3: Create Profile Topic                                                │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  TopicCreateTransaction                                              │    │
│  │    .setMemo("ibird profile")                                        │    │
│  │    .setSubmitKey(userKey)                                           │    │
│  │  → Topic ID: 0.0.10230000                                           │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                      │                                       │
│                                      ▼                                       │
│  Step 4: Initialize V2 Profile                                               │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  Send V2 profile JSON → Profile Topic                               │    │
│  │  {Type,Name,Bio,Picture,Banner,Channels:"",Groups:"",              │    │
│  │   FollowingChannels:"",FollowingGroups:"",ProfileVersion:"2"}      │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                      │                                       │
│                                      ▼                                       │
│  Step 5: Associate NFT Token                                                 │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  TokenAssociateTransaction                                          │    │
│  │    .setTokenIds([profileNFTTokenId])                                │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                      │                                       │
│                                      ▼                                       │
│  Step 6: Mint Profile NFT                                                    │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  ContractExecuteTransaction                                         │    │
│  │    .setFunction("mintTransferAndFreeze")                            │    │
│  │    .setPayableAmount(1 HBAR)  ← Mint fee                            │    │
│  │  → NFT Serial # minted to user's account                            │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  RESULT: User owns NFT pointing to their V2 profile topic                    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Tipping Workflow

Direct value transfer between users.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            TIPPING WORKFLOW                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Supported Tokens:                                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  • HBAR (native) - Direct transfer                                   │    │
│  │  • ASSET Token (0.0.1991880) - HTS Token transfer                   │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  Fee Structure:                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  • 1% Platform Fee → 0.0.2278621 (iBird treasury)                   │    │
│  │  • 99% → Content Creator                                             │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  Transaction Flow:                                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  TransferTransaction                                                 │    │
│  │    .addHbarTransfer(sender, -amount)                                │    │
│  │    .addHbarTransfer(receiver, amount * 0.99)                        │    │
│  │    .addHbarTransfer(treasury, amount * 0.01)                        │    │
│  │    .setMemo("iBird Tip | sender >> receiver | Amount | For: topic")│    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Multi-Step Transaction Architecture

All complex operations (post creation, profile creation, channel/group creation, following, etc.) follow a consistent multi-step pattern documented in [`architecture/multi-step-transaction-architecture.md`](architecture/multi-step-transaction-architecture.md).

Key features of this architecture:

- **Two-mode UI**: Edit form → Processing steps view
- **Step status tracking**: `idle` | `loading` | `success` | `error`
- **Auto-progression toggle**: Automatically proceeds to next step on success
- **Error resilience**: Any step can be retried independently
- **Consistent UI**: All multi-step flows use the same visual design

| Component      | Steps   | Pattern                |
| -------------- | ------- | ---------------------- |
| Create Profile | Up to 6 | Conditional Sequential |
| Update Profile | Up to 3 | Conditional Sequential |
| Create Channel | Up to 4 | Conditional Sequential |
| Update Channel | Up to 2 | Linear Sequential      |
| Create Group   | Up to 4 | Conditional Sequential |
| Update Group   | Up to 2 | Linear Sequential      |
| Send Post      | 2       | Linear Sequential      |
| Send Thread    | 2 + N×2 | Dynamic Step Count     |
| Send Poll      | Up to 4 | Conditional Sequential |
| Add to Thread  | Up to 2 | Conditional Sequential |
| Send Ad        | Up to 3 | Conditional Sequential |

---

## Configuration and Setup

### Prerequisites

Before setting up iBird, ensure you have:

- **Node.js** 18.17 or later
- **npm** or **yarn** package manager
- **Hedera wallet** (Kabila, HashPack, or WalletConnect-compatible)
- **HBAR** for transaction fees
- **(Optional)** ASSET tokens for platform features

### Installation

```bash
# Clone the repository
git clone https://github.com/ibird/ibird.git
cd ibird

# Install dependencies
npm install

# Copy environment variables
cp .env.local.example .env.local

# Configure your environment (see below)

# Run development server (uses Turbopack)
npm run dev

# Build for production
npm run build
npm start
```

### Environment Variables

Create a `.env.local` file with the following configuration:

```bash
# =============================================================================
# HEDERA NETWORK CONFIGURATION
# =============================================================================

# Network selection: "mainnet" or "testnet"
NEXT_PUBLIC_NETWORK=mainnet

# Base URL for the application
NEXT_PUBLIC_BASE_URL=https://ibird.io

# =============================================================================
# TOPIC IDS
# =============================================================================

# Main Explorer Topic - Global public feed
NEXT_PUBLIC_EXPLORER_ID=0.0.10214045

# Billboard Topic - Advertisements
NEXT_PUBLIC_BILLBOARD_ID=0.0.10214048

# =============================================================================
# TOKEN CONFIGURATION
# =============================================================================

# ASSET Token ID - Platform utility token
NEXT_PUBLIC_TOKEN_ID=0.0.1991880

# Burn Address - Where ASSET tokens are burned
NEXT_PUBLIC_BURN_ADDRESS_ID=0.0.8215507

# =============================================================================
# ASSET TOKEN POSTING FEES (in ASSET tokens)
# =============================================================================

# Fee to post to Explorer (burned)
NEXT_PUBLIC_EXPLORER_FEE=1000

# Fee for Billboard advertisements (burned)
NEXT_PUBLIC_BILLBOARD_FEE=10000

# =============================================================================
# NFT PROFILE SYSTEM
# =============================================================================

# Profile NFT Smart Contract
NEXT_PUBLIC_CONTRACT_ID=0.0.10213999

# Profile NFT Token Collection
NEXT_PUBLIC_PROFILE_NFT_TOKEN_ID=0.0.10214004

# Mint fee in HBAR
NEXT_PUBLIC_MINT_FEE_HBAR=1

# Profile Topic Memo
NEXT_PUBLIC_PROFILE_TOPIC_MEMO=ibird profile

# =============================================================================
# ARWEAVE CONFIGURATION
# =============================================================================

# Arweave wallet JWK (JSON Web Key) for signing uploads
# Replace with your wallet key for local use
ARWEAVE_WALLET_KEY={"kty":"RSA",...}

# ArDrive Turbo API endpoint
NEXT_PUBLIC_ARWEAVE_UPLOAD_URL=https://upload.ardrive.io/v1/tx
```

### Network Configuration

iBird supports both Hedera **mainnet** and **testnet**:

| Setting               | Mainnet                         | Testnet                         |
| --------------------- | ------------------------------- | ------------------------------- |
| `NEXT_PUBLIC_NETWORK` | `mainnet`                       | `testnet`                       |
| Mirror Node           | `mainnet.mirrornode.hedera.com` | `testnet.mirrornode.hedera.com` |
| HashScan              | `hashscan.io/mainnet`           | `hashscan.io/testnet`           |
| Transaction Fees      | Real HBAR                       | Test HBAR (free)                |

**For Development:**

```bash
NEXT_PUBLIC_NETWORK=testnet
```

**For Production:**

```bash
NEXT_PUBLIC_NETWORK=mainnet
```

---

## Key Addresses

All official iBird contract and token addresses on Hedera mainnet:

| Item                     | Address        | Purpose                     |
| ------------------------ | -------------- | --------------------------- |
| **ASSET Token**          | `0.0.1991880`  | Platform utility token      |
| **Explorer Topic**       | `0.0.10214045` | Public social feed          |
| **Billboard Topic**      | `0.0.10214048` | Advertisement feed          |
| **Profile NFT Contract** | `0.0.10213999` | Smart contract for minting  |
| **Profile NFT Token**    | `0.0.10214004` | NFT collection for profiles |
| **Platform Treasury**    | `0.0.2278621`  | Receives 1% tip fees        |
| **Burn Address**         | `0.0.8215507`  | ASSET token burns           |

**Verify on HashScan:** All addresses can be verified at [hashscan.io/mainnet](https://hashscan.io/mainnet)

---

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Workflow

```bash
# Install dependencies
npm install

# Run development server with hot reload (Turbopack)
npm run dev

# Run linting
npm run lint

# Build for production
npm run build

# Run production build locally
npm start
```

### Project Structure for Contributors

- **pages/**: Next.js routes — add new pages here
- **components/hooks/**: Custom React hooks — Hedera interactions
- **components/wallet/**: Wallet integration logic
- **components/send message/**: Content creation components (multi-step pattern)
- **components/read message/**: Content display components
- **components/read shared message/**: Shareable permalink renderers
- **components/billboard/**: Billboard advertisement system
- **components/explorer/**: Public feed and user discovery
- **components/chats/**: Unified channels + groups interface
- **components/utils/**: Shared utility functions + centralized transaction executor
- **architecture/**: Developer reference documentation

### Multi-Step Transaction Pattern

All new components that require multiple blockchain transactions **must** follow the multi-step transaction pattern described in [`architecture/multi-step-transaction-architecture.md`](architecture/multi-step-transaction-architecture.md). This ensures a consistent UX across the entire app.

---

## License

This project is licensed under the **Creative Commons Attribution-NonCommercial 4.0 International License (CC BY-NC 4.0)**.

### You are free to:

- **Share** — copy and redistribute the material in any medium or format
- **Adapt** — remix, transform, and build upon the material

### Under the following terms:

- **Attribution** — You must give appropriate credit, provide a link to the license, and indicate if changes were made. You may do so in any reasonable manner, but not in any way that suggests the licensor endorses you or your use.
- **NonCommercial** — You may not use the material for commercial purposes.

For more details, see the [full license text](https://creativecommons.org/licenses/by-nc/4.0/legalcode).

---

## Acknowledgments

- **Hedera Hashgraph** - For the blazing fast, fair, and secure DLT
- **ArDrive** - For the Turbo upload service
- **HashPack & Kabila** - For excellent wallet integrations
- **The iBird Community** - For feedback and support

---

<div align="center">

**Built with ❤️ on Hedera**

[Website](https://ibird.io) · [Twitter / X](https://x.com/iAssetsOrg) · [Discord](https://discord.gg/xM7SkkTEAG) · [How It Works](https://ibird.io/how-it-works)

</div>
