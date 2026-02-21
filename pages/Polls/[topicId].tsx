/**
 * Shared Poll Page
 * Allows users to view a poll via shareable URL: /Polls/[topicId]
 * This page renders the ReadSharedPoll component which displays the poll in a modal
 */

import ReadSharedPoll from "../../components/read shared message/read_shared_poll";

export default function SharedPollPage() {
    return <ReadSharedPoll />;
}
