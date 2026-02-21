import React, { FC, useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/router";
import { FaPen, FaCommentDots, FaComments, FaPoll } from "react-icons/fa";
import CreateThread from "./send_new_thread";
import ConnectModal from "../wallet/ConnectModal";
import SendMessageToPlanetModal from "./send_new_post";
import SendNewPoll from "./send_new_poll";
import SimpleModal from "../common/SimpleModal";
import InsufficientBalanceModal from "../common/InsufficientBalanceModal";
import { toast } from "react-toastify";
import { useWalletContext } from "../wallet/WalletContext";
import { useAccountId } from "@buidlerlabs/hashgraph-react-wallets";
import useGetProfile from "../hooks/use_get_profile";
import useAssetBalance, { POSTING_FEES } from "../hooks/use_asset_balance";

/**
 * NewMessage Component
 * A fixed-position component that provides functionality to create different types of messages
 * (posts, threads, and polls) on the platform.
 */

/**
 * Props interface for the NewMessage component
 * @property {boolean} requireBalanceCheck - Whether to check ASSET balance before posting (default: true)
 * @property {string} targetTopicId - Target topic ID for posting messages (default: explorer topic from env)
 */
interface NewMessageProps {
  requireBalanceCheck?: boolean;
  targetTopicId?: string;
  portalToBody?: boolean;
}

// Default explorer topic from environment
const DEFAULT_EXPLORER_TOPIC = process.env.NEXT_PUBLIC_EXPLORER_ID || "";

/**
 * Main component for creating new messages
 * Handles different modal states and message type selections
 * @param requireBalanceCheck - Set to false to disable ASSET balance checking (default: true)
 * @param targetTopicId - Target topic ID for posting (defaults to explorer topic, can be channel/group topic)
 */
export const NewMessage: FC<NewMessageProps> = ({
  requireBalanceCheck = true,
  targetTopicId = DEFAULT_EXPLORER_TOPIC,
  portalToBody = true,
}) => {
  // Router for navigation
  const router = useRouter();

  const { isConnected } = useWalletContext();
  const { data: accountId } = useAccountId();
  const [activeModal, setActiveModal] = useState<
    "none" | "connect" | "postSelection" | "post" | "thread" | "poll" | "insufficientBalance"
  >("none");
  const [isMounted, setIsMounted] = useState(false);

  const { profileData, isLoading: isProfileLoading } = useGetProfile(accountId);
  const userProfileTopicId = profileData?.ProfileTopic || "";

  // ASSET balance checking (only fetch if balance check is required)
  const {
    displayBalance,
    hasEnoughForExplorer,
    isLoading: isBalanceLoading,
    getSaucerSwapUrl,
  } = useAssetBalance();

  /**
   * Handle modal transitions
   */
  const handleModalChange = (newModal: typeof activeModal) => {
    setActiveModal(newModal);
  };

  /**
   * Opens a modal if user meets requirements
   * @param modalType - Type of modal to open
   * Redirects to profile page if user attempts to post without a profile
   * Shows insufficient balance modal if user doesn't have enough ASSET (when requireBalanceCheck is true)
   */
  const openModal = (modalType: typeof activeModal) => {
    if (!userProfileTopicId && modalType !== "connect" && modalType !== "insufficientBalance" && !isProfileLoading) {
      toast.info("Please create a profile before sending messages");
      router.push("/profile");
      return;
    }

    // Check ASSET balance before allowing post selection (only if requireBalanceCheck is enabled)
    if (requireBalanceCheck && modalType === "postSelection" && !isBalanceLoading && !hasEnoughForExplorer) {
      setActiveModal("insufficientBalance");
      return;
    }

    setActiveModal(modalType);
  };

  /**
   * Handles selection of post type and opens appropriate modal
   * @param postType - Type of post to create ("post", "thread", or "poll")
   */
  const handlePostTypeSelection = (postType: string) => {
    if (postType === "post") {
      setActiveModal("post");
    } else if (postType === "thread") {
      setActiveModal("thread");
    } else if (postType === "poll") {
      setActiveModal("poll");
    }
  };

  /**
   * Effect hook to close connect modal when user becomes connected
   */
  useEffect(() => {
    if (isConnected && activeModal === "connect") {
      setActiveModal("none");
    }
  }, [isConnected, activeModal]);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const content = (
    <div className="fixed bottom-24 left-6 z-50">
      {/* Enhanced floating action button with better visual feedback */}
      <div className="relative">
        {/* Pulse animation ring for attention */}
        <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-purple-400 to-pink-500 opacity-20 animate-ping" />

        <button
          onClick={() => {
            if (!isConnected) {
              openModal("connect");
            } else {
              openModal("postSelection");
            }
          }}
          className="
            relative
            inline-flex items-center justify-center
            px-6 py-3
            text-base font-mono font-semibold text-white
            rounded-2xl
            transition-all duration-300
            hover:scale-[1.05]
            active:scale-[0.95]
            focus:outline-none
            focus:ring-4 focus:ring-purple-400/30
            overflow-hidden
            group
            bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900
            backdrop-blur-xl
            border border-purple-400/40
            shadow-2xl shadow-purple-400/25
            hover:border-purple-400/70
            hover:shadow-purple-400/40
            hover:shadow-2xl
            before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-white/5 before:to-transparent before:translate-x-[-100%] hover:before:translate-x-[100%] before:transition-transform before:duration-700
          "
          aria-label="Create New Message"
        >
          {/* Enhanced gradient overlay on hover */}
          <div className="absolute inset-0 opacity-0 group-hover:opacity-30 transition-opacity duration-300 bg-gradient-to-r from-purple-500 via-pink-500 to-purple-600" />

          {/* Button content with improved spacing */}
          <div className="relative flex items-center gap-3">
            <span className="hidden sm:inline font-mono font-semibold text-white group-hover:text-purple-100 transition-colors duration-300">
              New Message
            </span>
            <div className="w-6 h-6 flex items-center justify-center">
              <FaPen className="text-purple-400 group-hover:text-purple-200 transition-colors duration-300 drop-shadow-sm" />
            </div>
          </div>

          {/* Connection status indicator */}
          <div
            className={`absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-slate-900 ${isConnected ? "bg-green-400" : "bg-red-400"
              }`}
          />
        </button>
      </div>

      {activeModal === "connect" && (
        <ConnectModal
          isOpen={activeModal === "connect"}
          onClose={() => handleModalChange("none")}
        />
      )}

      {activeModal === "postSelection" && (
        <SimpleModal
          isOpen={activeModal === "postSelection"}
          onClose={() => handleModalChange("none")}
        >
          <div className="flex flex-col items-center p-8 w-full max-w-lg mx-auto rounded-2xl relative bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 backdrop-blur-xl border border-purple-400/30 shadow-2xl shadow-purple-400/20">
            {/* Simple Logo */}
            <div className="flex justify-center items-center mb-4">
              <div className="w-14 h-14 rounded-xl flex items-center justify-center bg-gradient-to-br from-slate-700 to-slate-800 border border-cyan-400/20 shadow-lg">
                <span className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
                  ℏ
                </span>
              </div>
            </div>

            {/* Clean Title */}
            <h2 className="text-2xl font-mono font-bold mb-2 bg-gradient-to-r from-purple-400 via-purple-500 to-purple-600 bg-clip-text text-transparent">
              Create Content
            </h2>
            <p className="text-sm mb-6 text-purple-100/70 font-mono text-center max-w-xs leading-relaxed">
              Choose the type of content you want to create on Hedera
            </p>

            {/* Content Type Options */}
            <div className="w-full space-y-3">
              {/* Post Option */}
              <button
                onClick={() => handlePostTypeSelection("post")}
                className="
                  w-full
                  p-4
                  rounded-xl
                  transition-all duration-300
                  hover:scale-[1.02]
                  active:scale-[0.98]
                  flex items-center
                  group
                  relative
                  overflow-hidden
                  bg-gradient-to-r from-slate-800 to-slate-900
                  border border-purple-400/30
                  hover:border-purple-400/60
                  shadow-lg shadow-purple-400/10
                  hover:shadow-xl hover:shadow-purple-400/20
                  backdrop-blur-sm
                "
              >
                <div className="absolute inset-0 opacity-0 group-hover:opacity-20 transition-opacity duration-300 bg-gradient-to-r from-purple-500 to-purple-700" />

                <div className="relative flex items-center w-full gap-3">
                  <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-xl flex items-center justify-center shrink-0 bg-gradient-to-br from-slate-700 to-slate-800 border border-cyan-400/20">
                    <FaCommentDots className="text-cyan-400 text-lg sm:text-2xl" />
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <span className="font-mono font-semibold text-base sm:text-lg text-white block">
                      Post
                    </span>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs sm:text-sm text-purple-100/60 font-mono">
                        Quick share
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded-full font-mono font-medium bg-gradient-to-r from-cyan-400 to-blue-500 text-white shadow-md">
                        Simple
                      </span>
                    </div>
                    <span className="text-xs text-cyan-400 font-mono mt-1 block">
                      $0.0001 fee
                    </span>
                  </div>
                  <svg
                    className="w-5 h-5 shrink-0 transform group-hover:translate-x-1 transition-transform text-purple-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </div>
              </button>

              {/* Thread Option */}
              <button
                onClick={() => handlePostTypeSelection("thread")}
                className="
                  w-full
                  p-4
                  rounded-xl
                  transition-all duration-300
                  hover:scale-[1.02]
                  active:scale-[0.98]
                  flex items-center
                  group
                  relative
                  overflow-hidden
                  bg-gradient-to-r from-slate-800 to-slate-900
                  border border-purple-400/30
                  hover:border-purple-400/60
                  shadow-lg shadow-purple-400/10
                  hover:shadow-xl hover:shadow-purple-400/20
                  backdrop-blur-sm
                "
              >
                <div className="absolute inset-0 opacity-0 group-hover:opacity-20 transition-opacity duration-300 bg-gradient-to-r from-purple-600 to-purple-800" />

                <div className="relative flex items-center w-full gap-3">
                  <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-xl flex items-center justify-center shrink-0 bg-gradient-to-br from-slate-700 to-slate-800 border border-green-400/20">
                    <FaComments className="text-green-400 text-lg sm:text-2xl" />
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <span className="font-mono font-semibold text-base sm:text-lg text-white block">
                      Thread
                    </span>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs sm:text-sm text-purple-100/60 font-mono">
                        Start discussions
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded-full font-mono font-medium bg-gradient-to-r from-cyan-400 to-blue-500 text-white shadow-md">
                        Social
                      </span>
                    </div>
                    <span className="text-xs text-green-400 font-mono mt-1 block">
                      $0.0104 fee
                    </span>
                  </div>
                  <svg
                    className="w-5 h-5 shrink-0 transform group-hover:translate-x-1 transition-transform text-purple-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </div>
              </button>

              {/* Poll Option */}
              <button
                onClick={() => handlePostTypeSelection("poll")}
                className="
                  w-full
                  p-4
                  rounded-xl
                  transition-all duration-300
                  hover:scale-[1.02]
                  active:scale-[0.98]
                  flex items-center
                  group
                  relative
                  overflow-hidden
                  bg-gradient-to-r from-slate-800 to-slate-900
                  border border-purple-400/30
                  hover:border-purple-400/60
                  shadow-lg shadow-purple-400/10
                  hover:shadow-xl hover:shadow-purple-400/20
                  backdrop-blur-sm
                "
              >
                <div className="absolute inset-0 opacity-0 group-hover:opacity-20 transition-opacity duration-300 bg-gradient-to-r from-purple-700 to-purple-900" />

                <div className="relative flex items-center w-full gap-3">
                  <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-xl flex items-center justify-center shrink-0 bg-gradient-to-br from-slate-700 to-slate-800 border border-orange-400/20">
                    <FaPoll className="text-orange-400 text-lg sm:text-2xl" />
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <span className="font-mono font-semibold text-base sm:text-lg text-white block">
                      Poll
                    </span>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs sm:text-sm text-purple-100/60 font-mono">
                        Get opinions
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded-full font-mono font-medium bg-gradient-to-r from-cyan-400 to-blue-500 text-white shadow-md">
                        Interactive
                      </span>
                    </div>
                    <span className="text-xs text-orange-400 font-mono mt-1 block">
                      $0.0104 fee
                    </span>
                  </div>
                  <svg
                    className="w-5 h-5 shrink-0 transform group-hover:translate-x-1 transition-transform text-purple-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </div>
              </button>
            </div>

            {/* Footer text */}
            <p className="text-sm mt-8 text-center text-purple-100/60 font-mono">
              All content is published on the Hedera network
            </p>
          </div>
        </SimpleModal>
      )}

      {activeModal === "thread" && (
        <SimpleModal
          isOpen={activeModal === "thread"}
          onClose={() => handleModalChange("none")}
        >
          <CreateThread onClose={() => handleModalChange("none")} topicId={targetTopicId} />
        </SimpleModal>
      )}

      {activeModal === "post" && (
        <SimpleModal
          isOpen={activeModal === "post"}
          onClose={() => handleModalChange("none")}
        >
          <SendMessageToPlanetModal onClose={() => handleModalChange("none")} topicId={targetTopicId} />
        </SimpleModal>
      )}

      {activeModal === "poll" && (
        <SimpleModal
          isOpen={activeModal === "poll"}
          onClose={() => handleModalChange("none")}
        >
          <SendNewPoll onClose={() => handleModalChange("none")} topicId={targetTopicId} />
        </SimpleModal>
      )}

      {/* Insufficient Balance Modal for Explorer */}
      <InsufficientBalanceModal
        isOpen={activeModal === "insufficientBalance"}
        onClose={() => handleModalChange("none")}
        requiredAmount={POSTING_FEES.explorer}
        currentBalance={displayBalance}
        saucerSwapUrl={getSaucerSwapUrl()}
        type="explorer"
      />
    </div>
  );

  if (portalToBody && isMounted && typeof document !== "undefined") {
    return createPortal(content, document.body);
  }

  return content;
};
