/**
 * Shared Thread Page
 * Allows users to view a thread via shareable URL: /Threads/[topicId]
 * This page renders the ReadSharedThread component which displays the thread in a modal
 */

import ReadSharedThread from "../../components/read shared message/read_shared_thread";

export default function SharedThreadPage() {
    return <ReadSharedThread />;
}
