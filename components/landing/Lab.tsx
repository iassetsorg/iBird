"use client";

import React, { useState } from "react";
import useCreateTopic from "../hooks/use_create_topic";
import useSendMessage from "../hooks/use_send_message";
import EmojiPickerPopup from "../common/EmojiPickerPopup";
import CreateNewProfile from "../profile/create_new_profile";
import UserProfile from "../profile/user_profile";
import Modal from "../common/modal";
import { toast } from "react-toastify";
import { NewMessage } from "../send message/new_message";
import Explorer from "../explorer/explorer";
import CreateNewChannel from "../channels/create_new_channel";
import CreateNewGroup from "../groups/create_new_group";
import ChannelList from "../channels/channel_list";
import GroupList from "../groups/group_list";
import ChannelManager from "../channels/channel_manager";
import GroupManager from "../groups/group_manager";
import Billboard from "../billboard/billboard";

type SendResult = {
  transactionId: string;
  receipt: unknown;
};

export default function Lab() {
  const [isVisible, setIsVisible] = useState(false);
  const [topicMemo, setTopicMemo] = useState("");
  const [memo, setMemo] = useState("");
  const [submitKey, setSubmitKey] = useState(false);
  const [topicId, setTopicId] = useState("");
  const [message, setMessage] = useState("");
  const [sendMemo, setSendMemo] = useState("");
  const [createdTopicId, setCreatedTopicId] = useState<string | null>(null);
  const [sendResult, setSendResult] = useState<SendResult | null>(null);
  const [emojiInput, setEmojiInput] = useState("");
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [showCreateProfile, setShowCreateProfile] = useState(false);
  const [showUserProfile, setShowUserProfile] = useState(false);
  const [showCreateChannel, setShowCreateChannel] = useState(false);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [showChannelList, setShowChannelList] = useState(false);
  const [showGroupList, setShowGroupList] = useState(false);
  const [showChannelManager, setShowChannelManager] = useState(false);
  const [showGroupManager, setShowGroupManager] = useState(false);
  const [testAccountId, setTestAccountId] = useState("0.0.1234567");

  const { create, createTopicResponse } = useCreateTopic();
  const { send } = useSendMessage();

  React.useEffect(() => {
    setIsVisible(true);
  }, []);

  const handleCreateTopic = async () => {
    const result = await create(topicMemo, memo, submitKey);
    if (result) {
      setCreatedTopicId(result);
    }
  };

  const handleSendMessage = async () => {
    const result = await send(topicId, message, sendMemo);
    if (result) {
      setSendResult(result);
    }
  };

  // Generate floating particles (same as Hero)
  const particles = Array.from({ length: 15 }, (_, i) => (
    <div
      key={i}
      className={`absolute w-2 h-2 bg-gradient-to-r from-cyan-400 to-blue-500 rounded-full opacity-30 animate-particle-float`}
      style={{
        left: `${Math.random() * 100}%`,
        animationDelay: `${Math.random() * 20}s`,
        animationDuration: `${15 + Math.random() * 10}s`,
      }}
    />
  ));

  return (
    <header
      id="lab-section"
      className="relative text-center overflow-hidden min-h-screen flex flex-col justify-center mt-6"
      role="banner"
    >
      {/* Animated Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 animate-gradient-shift bg-[length:400%_400%]" />

      {/* Cyber Grid Overlay */}
      <div className="absolute inset-0 bg-cyber-grid bg-cyber-grid opacity-20" />

      {/* Floating Particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {particles}
      </div>

      {/* Holographic Glow Effects */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-gradient-radial from-cyan-500/20 to-transparent rounded-full blur-3xl animate-pulse" />
      <div
        className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-gradient-radial from-purple-500/20 to-transparent rounded-full blur-3xl animate-pulse"
        style={{ animationDelay: "2s" }}
      />

      {/* Main Content */}
      <div className="relative z-10 space-y-16 p-6 md:p-24">
        <div className="space-y-8">
          <h1 className="text-4xl md:text-6xl font-mono tracking-tight leading-tight text-white ">
            <span
              className={`block text-white transition-all duration-1000 ${
                isVisible
                  ? "animate-slide-up-delayed"
                  : "opacity-0 translate-y-8"
              }`}
            >
              Hooks Testing Lab
            </span>
            <span
              className={`block bg-gradient-to-r from-yellow-400 to-orange-400 bg-clip-text text-transparent transition-all duration-1000 ${
                isVisible
                  ? "animate-slide-up-delayed-2"
                  : "opacity-0 translate-y-8"
              }`}
            >
              Built on Hedera!
            </span>
          </h1>
        </div>

        {/* Testing Sections */}
        <div className="w-full max-w-4xl mx-auto space-y-8 px-0 md:px-4">
          {/* Create Topic Section */}
          <div className="bg-slate-900/80 backdrop-blur-md rounded-2xl p-8 border border-cyan-400/50">
            <h2 className="text-2xl font-mono text-cyan-400 mb-6">
              Test useCreateTopic
            </h2>
            <div className="space-y-4">
              <input
                type="text"
                placeholder="Topic Memo"
                value={topicMemo}
                onChange={(e) => setTopicMemo(e.target.value)}
                className="w-full p-3 bg-slate-800 border border-cyan-400/50 rounded-lg text-white"
              />
              <input
                type="text"
                placeholder="Transaction Memo"
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                className="w-full p-3 bg-slate-800 border border-cyan-400/50 rounded-lg text-white"
              />
              <label className="flex items-center text-white">
                <input
                  type="checkbox"
                  checked={submitKey}
                  onChange={(e) => setSubmitKey(e.target.checked)}
                  className="mr-2"
                />
                Set Submit Key
              </label>
              <button
                onClick={handleCreateTopic}
                className="w-full py-3 bg-gradient-to-r from-cyan-400 to-blue-500 text-white font-semibold rounded-lg hover:scale-105 transition-all"
              >
                Create Topic
              </button>
              {createdTopicId && (
                <div className="text-green-400">
                  Created Topic ID: {createdTopicId}
                </div>
              )}
              {createTopicResponse && (
                <div className="text-cyan-300">
                  Response: {JSON.stringify(createTopicResponse, null, 2)}
                </div>
              )}
            </div>
          </div>

          {/* Send Message Section */}
          <div className="bg-slate-900/80 backdrop-blur-md rounded-2xl p-8 border border-purple-400/50">
            <h2 className="text-2xl font-mono text-purple-400 mb-6">
              Test useSendMessage
            </h2>
            <div className="space-y-4">
              <input
                type="text"
                placeholder="Topic ID"
                value={topicId}
                onChange={(e) => setTopicId(e.target.value)}
                className="w-full p-3 bg-slate-800 border border-purple-400/50 rounded-lg text-white"
              />
              <textarea
                placeholder="Message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="w-full p-3 bg-slate-800 border border-purple-400/50 rounded-lg text-white h-24"
              />
              <input
                type="text"
                placeholder="Memo"
                value={sendMemo}
                onChange={(e) => setSendMemo(e.target.value)}
                className="w-full p-3 bg-slate-800 border border-purple-400/50 rounded-lg text-white"
              />
              <button
                onClick={handleSendMessage}
                className="w-full py-3 bg-gradient-to-r from-purple-400 to-pink-500 text-white font-semibold rounded-lg hover:scale-105 transition-all"
              >
                Send Message
              </button>
              {sendResult && (
                <div className="text-purple-300">
                  Send Result: {JSON.stringify(sendResult, null, 2)}
                </div>
              )}
            </div>
          </div>

          {/* Test EmojiPickerPopup Section */}
          <div className="bg-slate-900/80 backdrop-blur-md rounded-2xl p-8 border border-purple-400/50">
            <h2 className="text-2xl font-mono text-purple-400 mb-6">
              Test EmojiPickerPopup
            </h2>
            <div className="space-y-4">
              <input
                type="text"
                placeholder="Type something and add emojis..."
                value={emojiInput}
                onChange={(e) => setEmojiInput(e.target.value)}
                className="w-full p-3 bg-slate-800 border border-purple-400/50 rounded-lg text-white"
              />
              <button
                onClick={() => setIsPickerOpen(true)}
                className="w-full py-3 bg-gradient-to-r from-purple-400 to-pink-500 text-white font-semibold rounded-lg hover:scale-105 transition-all"
              >
                Open Emoji Picker
              </button>
              {isPickerOpen && (
                <EmojiPickerPopup
                  onEmojiClick={(emojiData) => {
                    setEmojiInput((prev) => prev + emojiData.emoji);
                    setIsPickerOpen(false);
                  }}
                  onClose={() => setIsPickerOpen(false)}
                />
              )}
            </div>
          </div>

          {/* Test NewMessage Section */}
          <div className="bg-slate-900/80 backdrop-blur-md rounded-2xl p-8 border border-green-400/50">
            <h2 className="text-2xl font-mono text-green-400 mb-6">
              Test NewMessage Component
            </h2>
            <div className="space-y-4">
              <p className="text-white/80 text-sm">
                Test the NewMessage component with all message types (Post,
                Thread, Poll). Make sure you have a wallet connected and a
                profile created first.
              </p>
              <div className="mt-4 p-4 bg-slate-800/50 rounded-lg border border-green-400/30">
                <h3 className="text-lg font-mono text-green-300 mb-3">
                  NewMessage Component:
                </h3>
                <NewMessage />
              </div>
            </div>
          </div>

          {/* Test UserProfile Section */}
          <div className="bg-slate-900/80 backdrop-blur-md rounded-2xl p-8 border border-yellow-400/50">
            <h2 className="text-2xl font-mono text-yellow-400 mb-6">
              Test UserProfile Component
            </h2>
            <div className="space-y-4">
              <input
                type="text"
                placeholder="Account ID (e.g., 0.0.1234567)"
                value={testAccountId}
                onChange={(e) => setTestAccountId(e.target.value)}
                className="w-full p-3 bg-slate-800 border border-yellow-400/50 rounded-lg text-white"
              />
              <button
                onClick={() => setShowUserProfile(true)}
                className="w-full py-3 bg-gradient-to-r from-yellow-400 to-orange-500 text-white font-semibold rounded-lg hover:scale-105 transition-all"
              >
                Test UserProfile Modal
              </button>

              {/* Inline UserProfile Component Test */}
              <div className="mt-4 p-4 bg-slate-800/50 rounded-lg border border-yellow-400/30">
                <h3 className="text-lg font-mono text-yellow-300 mb-3">
                  Inline UserProfile Preview:
                </h3>
                {testAccountId && <UserProfile userAccountId={testAccountId} />}
              </div>
            </div>
          </div>

          {/* CreateNewProfile Modal */}
          {/* Test React Toastify Section */}
          <div className="bg-slate-900/80 backdrop-blur-md rounded-2xl p-8 border border-green-400/50">
            <h2 className="text-2xl font-mono text-green-400 mb-6">
              Test React Toastify
            </h2>
            <div className="space-y-4">
              <button
                onClick={() => toast.success("Success!")}
                className="w-full py-3 bg-gradient-to-r from-green-400 to-blue-500 text-white font-semibold rounded-lg hover:scale-105 transition-all"
              >
                Show Success Toast
              </button>
              <button
                onClick={() => toast.error("Error!")}
                className="w-full py-3 bg-gradient-to-r from-red-400 to-pink-500 text-white font-semibold rounded-lg hover:scale-105 transition-all"
              >
                Show Error Toast
              </button>
            </div>
          </div>

          {/* Test Explorer Section */}
          <div className="bg-slate-900/80 backdrop-blur-md rounded-2xl p-8 border border-indigo-400/50">
            <h2 className="text-2xl font-mono text-indigo-400 mb-6">
              Test Explorer Component
            </h2>
            <div className="space-y-4">
              <p className="text-white/80 text-sm">
                Test the Explorer component with infinite scrolling and message
                display. The component will fetch and display messages with
                support for Post, Thread, Poll, and Repost types.
              </p>
              <div className="mt-4 p-4 bg-slate-800/50 rounded-lg border border-indigo-400/30">
                <h3 className="text-lg font-mono text-indigo-300 mb-3">
                  Explorer Component:
                </h3>
                <div className="h-96 overflow-hidden rounded-lg">
                  <Explorer />
                </div>
              </div>
            </div>
          </div>

          {/* Test Billboard Section */}
          <div className="bg-slate-900/80 backdrop-blur-md rounded-2xl p-8 border border-orange-400/50">
            <h2 className="text-2xl font-mono text-orange-400 mb-6">
              Test Billboard Component
            </h2>
            <div className="space-y-4">
              <p className="text-white/80 text-sm">
                Test the Billboard component with infinite scrolling and ad message
                display. The component fetches and displays ad messages with support
                for Post, Thread, Poll, and Repost types, plus specialized Ad and
                Shared Ad components.
              </p>
              <div className="mt-4 p-4 bg-slate-800/50 rounded-lg border border-orange-400/30">
                <h3 className="text-lg font-mono text-orange-300 mb-3">
                  Billboard Component:
                </h3>
                <div className="h-96 overflow-hidden rounded-lg">
                  <Billboard />
                </div>
              </div>
            </div>
          </div>

          {/* Test CreateNewChannel Section */}
          <div className="bg-slate-900/80 backdrop-blur-md rounded-2xl p-8 border border-teal-400/50">
            <h2 className="text-2xl font-mono text-teal-400 mb-6">
              Test CreateNewChannel Component
            </h2>
            <div className="space-y-4">
              <p className="text-white/80 text-sm">
                Test the CreateNewChannel component with channel name,
                description, and image upload. The component will create a new
                channel topic with submit key restricted to the creator only,
                upload the image to Arweave (if provided), and update the
                user&apos;s profile with the new channel.
              </p>
              <button
                onClick={() => setShowCreateChannel(true)}
                className="w-full py-3 bg-gradient-to-r from-teal-400 to-cyan-500 text-white font-semibold rounded-lg hover:scale-105 transition-all"
              >
                Test CreateNewChannel Modal
              </button>
            </div>
          </div>

          {/* Test CreateNewGroup Section */}
          <div className="bg-slate-900/80 backdrop-blur-md rounded-2xl p-8 border border-pink-400/50">
            <h2 className="text-2xl font-mono text-pink-400 mb-6">
              Test CreateNewGroup Component
            </h2>
            <div className="space-y-4">
              <p className="text-white/80 text-sm">
                Test the CreateNewGroup component with group name, description,
                and image upload. The component will create a new group topic
                without submit key restrictions (anyone can post), upload the
                image to Arweave (if provided), and update the user&apos;s
                profile with the new group.
              </p>
              <button
                onClick={() => setShowCreateGroup(true)}
                className="w-full py-3 bg-gradient-to-r from-pink-400 to-purple-500 text-white font-semibold rounded-lg hover:scale-105 transition-all"
              >
                Test CreateNewGroup Modal
              </button>
            </div>
          </div>

          {/* Test ChannelList Section */}
          <div className="bg-slate-900/80 backdrop-blur-md rounded-2xl p-8 border border-teal-400/50">
            <h2 className="text-2xl font-mono text-teal-400 mb-6">
              Test ChannelList Component
            </h2>
            <div className="space-y-4">
              <p className="text-white/80 text-sm">
                Test the ChannelList component that displays all channels
                created by the user. The component fetches channel data from the
                user&apos;s profile and displays them with images, names,
                descriptions, and topic IDs.
              </p>
              <button
                onClick={() => setShowChannelList(true)}
                className="w-full py-3 bg-gradient-to-r from-teal-400 to-cyan-500 text-white font-semibold rounded-lg hover:scale-105 transition-all"
              >
                Test ChannelList Modal
              </button>
            </div>
          </div>

          {/* Test GroupList Section */}
          <div className="bg-slate-900/80 backdrop-blur-md rounded-2xl p-8 border border-pink-400/50">
            <h2 className="text-2xl font-mono text-pink-400 mb-6">
              Test GroupList Component
            </h2>
            <div className="space-y-4">
              <p className="text-white/80 text-sm">
                Test the GroupList component that displays all groups created by
                the user. The component fetches group data from the user&apos;s
                profile and displays them with images, names, descriptions, and
                topic IDs.
              </p>
              <button
                onClick={() => setShowGroupList(true)}
                className="w-full py-3 bg-gradient-to-r from-pink-400 to-purple-500 text-white font-semibold rounded-lg hover:scale-105 transition-all"
              >
                Test GroupList Modal
              </button>
            </div>
          </div>

          {/* Test ChannelManager Section */}
          <div className="bg-slate-900/80 backdrop-blur-md rounded-2xl p-8 border border-teal-400/50">
            <h2 className="text-2xl font-mono text-teal-400 mb-6">
              Test ChannelManager Component
            </h2>
            <div className="space-y-4">
              <p className="text-white/80 text-sm">
                Test the ChannelManager component with navigation between list
                and view states. This component allows users to view channels,
                create new channels, and interact with channel messages.
              </p>
              <button
                onClick={() => setShowChannelManager(true)}
                className="w-full py-3 bg-gradient-to-r from-teal-400 to-cyan-500 text-white font-semibold rounded-lg hover:scale-105 transition-all"
              >
                Test ChannelManager Modal
              </button>
            </div>
          </div>

          {/* Test GroupManager Section */}
          <div className="bg-slate-900/80 backdrop-blur-md rounded-2xl p-8 border border-pink-400/50">
            <h2 className="text-2xl font-mono text-pink-400 mb-6">
              Test GroupManager Component
            </h2>
            <div className="space-y-4">
              <p className="text-white/80 text-sm">
                Test the GroupManager component with navigation between list and
                view states. This component allows users to view groups, create
                new groups, and interact with group messages.
              </p>
              <button
                onClick={() => setShowGroupManager(true)}
                className="w-full py-3 bg-gradient-to-r from-pink-400 to-purple-500 text-white font-semibold rounded-lg hover:scale-105 transition-all"
              >
                Test GroupManager Modal
              </button>
            </div>
          </div>

          <Modal
            isOpen={showCreateProfile}
            onClose={() => setShowCreateProfile(false)}
          >
            <CreateNewProfile onClose={() => setShowCreateProfile(false)} />
          </Modal>

          {/* UserProfile Modal */}
          <Modal
            isOpen={showUserProfile}
            onClose={() => setShowUserProfile(false)}
            hideCloseButton={true}
            removeZIndex={true}
          >
            <UserProfile userAccountId={testAccountId} />
          </Modal>

          {/* CreateNewChannel Modal */}
          <Modal
            isOpen={showCreateChannel}
            onClose={() => setShowCreateChannel(false)}
          >
            <CreateNewChannel onClose={() => setShowCreateChannel(false)} />
          </Modal>

          {/* CreateNewGroup Modal */}
          <Modal
            isOpen={showCreateGroup}
            onClose={() => setShowCreateGroup(false)}
          >
            <CreateNewGroup onClose={() => setShowCreateGroup(false)} />
          </Modal>

          {/* ChannelList Modal */}
          <Modal
            isOpen={showChannelList}
            onClose={() => setShowChannelList(false)}
          >
            <ChannelList />
          </Modal>

          {/* GroupList Modal */}
          <Modal isOpen={showGroupList} onClose={() => setShowGroupList(false)}>
            <GroupList />
          </Modal>

          {/* ChannelManager Modal */}
          <Modal
            isOpen={showChannelManager}
            onClose={() => setShowChannelManager(false)}
          >
            <ChannelManager />
          </Modal>

          {/* GroupManager Modal */}
          <Modal
            isOpen={showGroupManager}
            onClose={() => setShowGroupManager(false)}
          >
            <GroupManager />
          </Modal>
        </div>
      </div>
    </header>
  );
}
