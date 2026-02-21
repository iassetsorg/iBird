import Modal from "../common/modal";
import React, { useState } from "react";
import ReadThread from "../read message/read_thread";
import { useRouter } from "next/router";
import SEOHead from "../common/SEOHead";

/**
 * Component for displaying a shared thread in a modal dialog.
 * This component is typically used when accessing a thread through a shared link.
 * Supports direct linking to specific comments via query parameters.
 * @component
 */
function ReadSharedThread() {
  // State to control the visibility of the modal
  const [isModalOpen, setIsModalOpen] = useState(true);

  // Hook for programmatic navigation
  const router = useRouter();

  // Extract parameters from URL
  const topicIdVar = (router.query.topicId as string) || "";
  const commentId = (router.query.comment as string) || undefined;

  // Dynamic SEO configuration based on whether a comment is being shared
  const seoConfig = commentId
    ? {
        title: "Comment on Thread - iBird",
        description: "View this specific comment and join the conversation on iBird",
      }
    : {
        title: "Thread - iBird",
        description: "View and join this thread conversation on iBird",
      };

  /**
   * Handles the modal close action.
   * Closes the modal and navigates user to the main app page.
   */
  const closeModal = () => {
    setIsModalOpen(false);
    router.push("/app");
  };

  /**
   * Renders a modal containing the thread content.
   * Uses the Modal component for the overlay and ReadThread for the content.
   * When a comment ID is present, the thread auto-scrolls and highlights that comment.
   */
  return (
    <>
      <SEOHead seoConfig={seoConfig} />
      <Modal isOpen={isModalOpen} onClose={closeModal}>
        {/* Container for the thread content with enhanced styling and mobile optimization */}
        <div className="bg-gradient-to-br from-slate-900 via-cyan-900/20 to-slate-900 backdrop-blur-xl p-4 sm:p-6 rounded-2xl border border-cyan-400/30 shadow-2xl shadow-cyan-400/20 max-w-4xl max-h-[90vh] overflow-y-auto">
          <ReadThread
            topicId={topicIdVar}
            initialExpandedPosts={true}
            initialExpandedComments={true}
            highlightedCommentId={commentId}
            scrollToCommentId={commentId}
          />
        </div>
      </Modal>
    </>
  );
}

export default ReadSharedThread;
