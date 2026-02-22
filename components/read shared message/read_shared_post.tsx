/**
 * ReadSharedPost Component
 * A modal component that displays a shared post's content using the post's sequence number.
 * It fetches post data and renders it in a modal dialog that can be closed to return to the Explore page.
 *
 * @component
 */

import React from "react";
import Modal from "../common/modal";
import { useRouter } from "next/router";
import ReadPost from "../read message/read_post";
import SEOHead from "../common/SEOHead";
import useGetPostData from "../hooks/use_get_post_data";
import type { Message } from "../hooks/use_get_data";

/**
 * ReadSharedPost function component
 * @returns {JSX.Element} A modal containing the shared post's content
 */
function ReadSharedPost() {
  const router = useRouter();

  // Extract sequence number from URL parameters
  const sequence_Number = router.query.sequenceNumber as string | undefined;

  // Fetch post data
  const { postData, loading } = useGetPostData(sequence_Number || "");

  // Generate SEO configuration
  const seoConfig = {
    title: postData?.Message
      ? `${postData.Message.substring(0, 60)}... - iBird`
      : "Post - iBird",
    description: postData?.Message || "View this post on iBird",
    author: postData?.sender,
    image: postData?.Media,
  };

  /**
   * Handles modal close action
   * Navigates user to the main app page
   */
  const closeModal = () => {
    router.push("/app");
  };

  return (
    <>
      {!loading && postData && <SEOHead seoConfig={seoConfig} />}
      <Modal isOpen={true} onClose={closeModal}>
        <div className="bg-gradient-to-br from-slate-900 via-cyan-900/20 to-slate-900 backdrop-blur-xl p-0 sm:p-6 sm:rounded-2xl border-y sm:border border-cyan-400/30 shadow-2xl shadow-cyan-400/20 max-w-4xl max-h-[90vh] overflow-y-auto">
          {postData ? (
            <ReadPost
              message={
                {
                  sequence_number: parseInt(postData.sequence_number || "0"),
                  sender: postData.sender,
                  message_id: postData.message_id || "",
                  Message: postData.Message,
                  Media: postData.Media || "",
                  consensus_timestamp: postData.consensus_timestamp || "",
                  Type: postData.Type || "Post",
                  Identifier: postData.Identifier || "",
                  Author: postData.Author || "",
                  Choice: postData.Choice || "",
                  message: "",
                } as Message
              }
            />
          ) : sequence_Number ? (
            <ReadPost
              message={
                {
                  sequence_number: parseInt(sequence_Number),
                  sender: "",
                  message_id: "",
                  Message: "",
                  Media: "",
                  consensus_timestamp: "",
                  Type: "Post",
                  Identifier: "",
                  Author: "",
                  Choice: "",
                  message: "",
                } as Message
              }
            />
          ) : (
            <div className="text-center py-12">
              <p className="text-cyan-400/80 font-mono">Post not found</p>
            </div>
          )}
        </div>
      </Modal>
    </>
  );
}

export default ReadSharedPost;
