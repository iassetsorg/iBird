/**
 * ChannelManager is a component that manages channel list and view states.
 * Features:
 * - Navigation between channel list and individual channel views
 * - Channel creation functionality
 * - Message viewing and sending in channels
 * - State management for navigation
 */

import React, { useState } from "react";
import ChannelList from "./channel_list";
import ChannelView from "./channel_view";
import CreateNewChannel from "./create_new_channel";
import Modal from "../common/modal";
import { toast } from "react-toastify";

/**
 * Channel Interface
 */
interface Channel {
  Name: string;
  Channel: string;
  Description: string;
  Media: string;
}

/**
 * ChannelManager component handles navigation between channel list and view states
 */
function ChannelManager() {
  // State management for navigation
  const [currentView, setCurrentView] = useState<"list" | "view">("list");
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [showCreateChannel, setShowCreateChannel] = useState(false);

  /**
   * Handle channel selection from list
   */
  const handleChannelClick = (channel: Channel) => {
    setSelectedChannel(channel);
    setCurrentView("view");
  };

  /**
   * Handle navigation back to channel list
   */
  const handleBackToList = () => {
    setCurrentView("list");
    setSelectedChannel(null);
  };

  /**
   * Handle successful channel creation
   */
  const handleChannelCreated = () => {
    setShowCreateChannel(false);
    toast.success("Channel created successfully!");
    // Refresh the channel list by triggering a re-render
    setCurrentView("list");
  };

  return (
    <div className="h-full w-full bg-slate-900/80 backdrop-blur-md">
      {/* Channel List View */}
      {currentView === "list" && (
        <div className="h-full p-6">
          <ChannelList
            showCreateButton={true}
            onChannelClick={handleChannelClick}
          />
        </div>
      )}

      {/* Channel View */}
      {currentView === "view" && selectedChannel && (
        <ChannelView
          channelId={selectedChannel.Channel}
          channelName={selectedChannel.Name}
          channelMedia={selectedChannel.Media}
          onBack={handleBackToList}
        />
      )}

      {/* Create Channel Modal */}
      {showCreateChannel && (
        <Modal
          isOpen={showCreateChannel}
          onClose={() => setShowCreateChannel(false)}
        >
          <CreateNewChannel onClose={handleChannelCreated} />
        </Modal>
      )}
    </div>
  );
}

export default ChannelManager;
