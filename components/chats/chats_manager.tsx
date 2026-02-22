/**
 * ChatsManager is a component that manages the unified chats section.
 * Features:
 * - Navigation between unified chat list and individual channel/group views
 * - Channel and group creation functionality
 * - Unified interface for all messaging features
 */

import React, { useState } from "react";
import UnifiedChatList from "./unified_chat_list";
import ChannelView from "../channels/channel_view";
import GroupView from "../groups/group_view";
import SEOHead from "../common/SEOHead";
import { generateSEOConfig } from "../common/seo.config";

/**
 * Channel Interface
 */
interface Channel {
    Name: string;
    Channel: string;
    Description: string;
    Media: string;
    isFollowed?: boolean;
}

/**
 * Group Interface
 */
interface Group {
    Name: string;
    Group: string;
    Description: string;
    Media: string;
    isFollowed?: boolean;
}

type ViewState =
    | { type: "list" }
    | { type: "channel"; channel: Channel }
    | { type: "group"; group: Group };

/**
 * ChatsManager component handles navigation between unified chat list and individual views
 */
function ChatsManager() {
    // State management for navigation
    const [currentView, setCurrentView] = useState<ViewState>({ type: "list" });

    /**
     * Handle channel selection from unified list
     */
    const handleChannelClick = (channel: Channel) => {
        setCurrentView({ type: "channel", channel });
    };

    /**
     * Handle group selection from unified list
     */
    const handleGroupClick = (group: Group) => {
        setCurrentView({ type: "group", group });
    };

    /**
     * Handle navigation back to unified list
     */
    const handleBackToList = () => {
        setCurrentView({ type: "list" });
    };

    // Generate SEO configuration for chats page
    const chatsSEO = generateSEOConfig("chats");

    return (
        <>
            <SEOHead seoConfig={chatsSEO} />
            <div className="h-full w-full bg-slate-900/80 backdrop-blur-md">
                {/* Unified Chat List View */}
                {currentView.type === "list" && (
                    <div className="h-[calc(100vh-12rem)] overflow-y-auto px-0 py-4 sm:p-6">
                        <UnifiedChatList
                            onChannelClick={handleChannelClick}
                            onGroupClick={handleGroupClick}
                        />
                    </div>
                )}

                {/* Channel View */}
                {currentView.type === "channel" && (
                    <ChannelView
                        channelId={currentView.channel.Channel}
                        channelName={currentView.channel.Name}
                        channelMedia={currentView.channel.Media}
                        isFollowed={currentView.channel.isFollowed}
                        onBack={handleBackToList}
                    />
                )}

                {/* Group View */}
                {currentView.type === "group" && (
                    <GroupView
                        groupId={currentView.group.Group}
                        groupName={currentView.group.Name}
                        groupMedia={currentView.group.Media}
                        isFollowed={currentView.group.isFollowed}
                        onBack={handleBackToList}
                    />
                )}
            </div>
        </>
    );
}

export default ChatsManager;
