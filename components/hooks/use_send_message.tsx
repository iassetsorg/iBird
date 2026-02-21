/**
 * Custom hook for sending messages to Hedera topics using HashConnect.
 *
 * @module useSendMessage
 * @returns {Object} An object containing the send function
 * @property {Function} send - Function to submit messages to a Hedera topic
 */

import { useCallback } from "react";
import { TopicMessageSubmitTransaction, Signer } from "@hashgraph/sdk";
import { toast } from "react-toastify";

import {
  useWallet,
  useWatchTransactionReceipt,
} from "@buidlerlabs/hashgraph-react-wallets";

import {
  executeTransaction,
  type WatchFunction,
} from "../utils/execute-transaction";
import { getToastTypeForError } from "../utils/transaction-errors";

/**
 * Hook that provides functionality to send messages to Hedera topics.
 * Handles wallet connection, transaction signing, and execution.
 */
const useSendMessage = () => {
  // Get wallet instance and signer from HashConnect context
  const wallet = useWallet();
  const signer = wallet.signer as Signer;
  const { watch } = useWatchTransactionReceipt();

  /**
   * Sends a message to a specified Hedera topic.
   *
   * @param {string} topicId - The ID of the Hedera topic to send the message to
   * @param {unknown} message - The message object to be sent (will be stringified)
   * @param {string} [memo] - Optional transaction memo
   * @returns {Promise<{transactionId: string, receipt: unknown} | undefined>} Transaction details on success
   *
   * @throws Will show a toast error if:
   * - Wallet is not connected
   * - Transaction fails
   * - Any other error occurs during execution
   */
  const send = useCallback(
    async (
      topicId: string,
      message: unknown,
      memo?: string
    ): Promise<{ transactionId: string; receipt: unknown } | undefined> => {
      // Verify wallet connection
      if (!signer) {
        toast.error("Please connect your wallet.");
        return;
      }

      // Create and configure the transaction
      const transaction = new TopicMessageSubmitTransaction()
        .setMessage(JSON.stringify(message))
        .setTopicId(topicId);

      // Add memo if provided and not empty
      if (memo && memo.trim() !== "") {
        transaction.setTransactionMemo(memo);
      }

      // Execute using centralized transaction executor
      const result = await executeTransaction({
        transaction,
        signer,
        watch: watch as WatchFunction,
      });

      if (result.success) {
        return {
          transactionId: result.transactionId!,
          receipt: result.receipt,
        };
      }

      // Handle errors with appropriate toast
      if (result.error) {
        const toastType = getToastTypeForError(result.error.type);
        switch (toastType) {
          case "warn":
            toast.warn(result.error.message);
            break;
          case "info":
            toast.info(result.error.message);
            break;
          default:
            toast.error(`Error: ${result.error.message}`);
        }
      }

      return undefined;
    },
    [signer, watch]
  );

  return { send };
};

export default useSendMessage;
