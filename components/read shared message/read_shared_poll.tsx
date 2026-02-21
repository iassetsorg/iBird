/**
 * ReadSharedPoll Component
 * A modal component that displays a shared poll and handles navigation.
 * This component is typically used when users access a poll through a shared link.
 * Supports direct linking to specific comments via query parameters.
 */

import Modal from "../common/modal";
import React, { useState } from "react";
import ReadPoll from "../read message/read_poll";
import { useRouter } from "next/router";
import SEOHead from "../common/SEOHead";

/**
 * ReadSharedPoll is a functional component that manages the display of a shared poll in a modal.
 * It handles the modal's open state and navigation after closing.
 * When a comment ID is present, the poll auto-scrolls and highlights that comment.
 * @returns {JSX.Element} A modal containing the shared poll content
 */
function ReadSharedPoll() {
  // State to control the visibility of the modal
  const [isModalOpen, setIsModalOpen] = useState(true);

  // Hook for programmatic navigation
  const router = useRouter();

  // Extract URL parameters
  const topicIdVar = (router.query.topicId as string) || "";
  const commentId = (router.query.comment as string) || undefined;

  // Dynamic SEO configuration
  const seoConfig = commentId
    ? {
        title: "Comment on Poll - iBird",
        description: "View this comment and participate in the poll on iBird",
      }
    : {
        title: "Poll - iBird",
        description: "View and participate in this poll on iBird",
      };

  /**
   * Handles the modal close action
   * Closes the modal and navigates user to the main app page
   */
  const closeModal = () => {
    setIsModalOpen(false);
    router.push("/app");
  };

  return (
    <>
      <SEOHead seoConfig={seoConfig} />
      <Modal isOpen={isModalOpen} onClose={closeModal}>
        {/* Container for the poll content with enhanced styling and mobile optimization */}
        <div className="bg-gradient-to-br from-slate-900 via-cyan-900/20 to-slate-900 backdrop-blur-xl p-4 sm:p-6 rounded-2xl border border-cyan-400/30 shadow-2xl shadow-cyan-400/20 max-w-4xl max-h-[90vh] overflow-y-auto">
          <ReadPoll
            topicId={topicIdVar}
            highlightedCommentId={commentId}
          />
        </div>
      </Modal>
    </>
  );
}

export default ReadSharedPoll;
