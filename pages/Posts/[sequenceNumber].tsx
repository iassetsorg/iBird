/**
 * Shared Post Page
 * Allows users to view a post via shareable URL: /Posts/[sequenceNumber]
 * This page renders the ReadSharedPost component which displays the post in a modal
 */

import ReadSharedPost from "../../components/read shared message/read_shared_post";

export default function SharedPostPage() {
    return <ReadSharedPost />;
}
