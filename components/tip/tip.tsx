import { useState, useMemo } from "react";
import Image from "next/image";

import { useAccountId } from "@buidlerlabs/hashgraph-react-wallets";
import { toast } from "react-toastify";
import {
  useWallet,
  useWatchTransactionReceipt,
} from "@buidlerlabs/hashgraph-react-wallets";

import { AccountId, TransferTransaction, Signer } from "@hashgraph/sdk";

import {
  executeTransaction,
  type WatchFunction,
} from "../utils/execute-transaction";
import { getToastTypeForError } from "../utils/transaction-errors";

const tokenData = {
  HBAR: { tokenId: null, multiplier: 1 },
  ASSET: { tokenId: "0.0.1991880", multiplier: 1_000_000 },
};

// HBAR icon - simple text character
const HbarIcon = ({ className = "w-6 h-6" }: { className?: string }) => (
  <span className={`${className} flex items-center justify-center text-lg font-bold`}>ℏ</span>
);

// ASSET icon component using the app icon
const AssetIcon = ({ className = "w-6 h-6" }: { className?: string }) => (
  <Image src="/icon.png" alt="ASSET" width={24} height={24} className={`${className} rounded-md`} />
);

const quickAmounts = [1, 5, 10, 25, 50, 100];

const Tip = ({
  onClose,
  author,
  topicId,
}: {
  onClose: () => void;
  author: string | null | undefined;
  topicId: string;
}) => {
  const { data: signingAccount } = useAccountId();
  const senderId = AccountId.fromString(String(signingAccount));
  const receiverId = AccountId.fromString(String(author));
  const [amountToSend, setAmountToSend] = useState<string>("");
  const [selectedToken, setSelectedToken] =
    useState<keyof typeof tokenData>("ASSET");
  const [isSending, setIsSending] = useState<boolean>(false);

  const wallet = useWallet();
  const signer = wallet.signer as Signer;

  const { watch } = useWatchTransactionReceipt();

  // Calculate fee breakdown
  const feeBreakdown = useMemo(() => {
    const amount = parseFloat(amountToSend) || 0;
    const feePercentage = 0.01;
    const fee = amount * feePercentage;
    const netAmount = amount * (1 - feePercentage);
    return { amount, fee, netAmount, feePercentage };
  }, [amountToSend]);

  const send = async () => {
    const amount = parseFloat(amountToSend);

    if (isNaN(amount) || amount <= 0) {
      toast.error("Please enter a valid amount greater than zero.");
      return;
    }

    const tokenInfo = tokenData[selectedToken];
    if (!tokenInfo) {
      toast.error("Invalid token selected.");
      return;
    }

    setIsSending(true);

    try {
      let transaction;
      const feePercentage = 0.01;
      const netAmount = amount * (1 - feePercentage);
      const feeAmount = amount * feePercentage;

      if (selectedToken === "HBAR") {
        transaction = new TransferTransaction()
          .addHbarTransfer(senderId, -amount)
          .addHbarTransfer(receiverId, netAmount)
          .addHbarTransfer("0.0.2278621", feeAmount)
          .setTransactionMemo(
            `iBird Tip | ${senderId} >> ${receiverId} | Amount: ${netAmount.toFixed(
              8
            )} HBAR | For: ${topicId}`
          );
      } else {
        const { tokenId, multiplier } = tokenInfo;
        const amountInTinyUnits = amount * multiplier;
        const netAmountInTinyUnits = netAmount * multiplier;
        const feeAmountInTinyUnits = feeAmount * multiplier;

        transaction = new TransferTransaction()
          .addTokenTransfer(tokenId!, senderId, -amountInTinyUnits)
          .addTokenTransfer(tokenId!, receiverId, netAmountInTinyUnits)
          .addTokenTransfer(tokenId!, "0.0.2278621", feeAmountInTinyUnits)
          .setTransactionMemo(
            `iBird Tip | ${senderId} >> ${receiverId} | Amount: ${netAmount.toFixed(
              8
            )} ${selectedToken} | For: ${topicId}`
          );
      }

      // Execute using centralized transaction executor
      const result = await executeTransaction({
        transaction,
        signer,
        watch: watch as WatchFunction,
      });

      if (result.success) {
        toast.success("Tip sent successfully!");
        setAmountToSend("");
        onClose();
      } else if (result.error) {
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
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
      toast.error(`Error: ${errorMessage}`);
    } finally {
      setIsSending(false);
    }
  };

  const TokenOptions = Object.keys(tokenData) as Array<keyof typeof tokenData>;

  return (
    <div className="max-w-md w-full mx-auto bg-slate-900 sm:rounded-2xl shadow-2xl overflow-hidden border-y sm:border border-slate-700/50">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-800 to-slate-800/80 px-6 py-5 border-b border-slate-700/50">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center text-2xl shadow-lg shadow-cyan-500/20">
            💝
          </div>
          <div>
            <h3 className="text-xl font-bold text-white">Send a Tip</h3>
            <p className="text-sm text-slate-400 truncate max-w-[200px]">
              to <span className="text-cyan-400 font-medium">{author}</span>
            </p>
          </div>
        </div>
      </div>

      <form
        className="p-6 space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        {/* Token Selection */}
        <div>
          <label className="block text-sm font-semibold text-slate-300 mb-3">
            Select Token
          </label>
          <div className="grid grid-cols-2 gap-3">
            {TokenOptions.map((option) => (
              <button
                key={option}
                onClick={() => setSelectedToken(option)}
                type="button"
                className={`relative py-4 px-4 rounded-xl font-semibold transition-all duration-300 flex items-center justify-center gap-2 ${
                  selectedToken === option
                    ? "bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-lg shadow-cyan-500/25"
                    : "bg-slate-800 text-slate-300 border border-slate-600 hover:border-cyan-500/50 hover:text-white"
                }`}
              >
                {option === "HBAR" ? <HbarIcon className="w-6 h-6" /> : <AssetIcon className="w-6 h-6" />}
                <span>{option}</span>
                {selectedToken === option && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center shadow-md">
                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Amount Input */}
        <div>
          <label className="block text-sm font-semibold text-slate-300 mb-3">
            Amount
          </label>
          <div className="relative flex items-center">
            {/* Decrease Button */}
            <button
              type="button"
              onClick={() => {
                const current = parseFloat(amountToSend) || 0;
                if (current > 1) {
                  setAmountToSend((current - 1).toString());
                } else if (current > 0) {
                  setAmountToSend("0");
                }
              }}
              className="absolute left-2 z-10 w-10 h-10 flex items-center justify-center rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white transition-all duration-200 active:scale-95"
              aria-label="Decrease amount"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
              </svg>
            </button>
            
            <input
              type="text"
              inputMode="decimal"
              placeholder="0"
              value={amountToSend}
              onChange={(e) => {
                // Only allow numbers and decimal point
                const value = e.target.value.replace(/[^0-9.]/g, '');
                // Prevent multiple decimal points
                const parts = value.split('.');
                if (parts.length > 2) return;
                setAmountToSend(value);
              }}
              className="w-full px-14 py-4 text-2xl font-bold text-center border border-slate-600 rounded-xl bg-slate-800 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 transition-all duration-200"
              required
            />
            
            {/* Increase Button */}
            <button
              type="button"
              onClick={() => {
                const current = parseFloat(amountToSend) || 0;
                setAmountToSend((current + 1).toString());
              }}
              className="absolute right-2 z-10 w-10 h-10 flex items-center justify-center rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white transition-all duration-200 active:scale-95"
              aria-label="Increase amount"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>
          
          {/* Token indicator below input */}
          <div className="flex items-center justify-center gap-2 mt-2 text-slate-400">
            {selectedToken === "HBAR" ? <HbarIcon className="w-5 h-5" /> : <AssetIcon className="w-5 h-5" />}
            <span className="text-sm font-medium">{selectedToken}</span>
          </div>
        </div>

        {/* Quick Amount Buttons */}
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-2">
            Quick amounts
          </label>
          <div className="flex flex-wrap gap-2">
            {quickAmounts.map((amount) => (
              <button
                key={amount}
                type="button"
                onClick={() => setAmountToSend(amount.toString())}
                className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-all duration-200 ${
                  amountToSend === amount.toString()
                    ? "bg-cyan-500 text-white shadow-md shadow-cyan-500/25"
                    : "bg-slate-800 text-cyan-400 border border-slate-600 hover:border-cyan-500/50"
                }`}
              >
                {amount}
              </button>
            ))}
          </div>
        </div>

        {/* Fee Preview */}
        {feeBreakdown.amount > 0 && (
          <div className="bg-slate-800/50 rounded-xl p-4 space-y-2 border border-slate-700">
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">You send</span>
              <span className="font-semibold text-white">
                {feeBreakdown.amount.toFixed(4)} {selectedToken}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Platform fee (1%)</span>
              <span className="text-slate-300">
                -{feeBreakdown.fee.toFixed(4)} {selectedToken}
              </span>
            </div>
            <div className="h-px bg-slate-700 my-1" />
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-slate-300">Creator gets</span>
              <span className="font-bold text-lg text-cyan-400">
                {feeBreakdown.netAmount.toFixed(4)} {selectedToken}
              </span>
            </div>
          </div>
        )}

        {/* Send Button */}
        <button
          type="submit"
          disabled={isSending || !amountToSend || parseFloat(amountToSend) <= 0}
          className={`relative w-full py-4 px-6 font-bold text-lg rounded-xl transition-all duration-300 ${
            isSending || !amountToSend || parseFloat(amountToSend) <= 0
              ? "bg-slate-700 text-slate-500 cursor-not-allowed"
              : "bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 hover:from-cyan-400 hover:to-blue-400"
          }`}
        >
          {isSending ? (
            <span className="flex items-center justify-center gap-3">
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Processing...
            </span>
          ) : (
            <span className="flex items-center justify-center gap-2">
              <span>Send Tip</span>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </span>
          )}
        </button>

        {/* Footer note */}
        <p className="text-center text-xs text-slate-500">
          Tips are processed securely on the Hedera network
        </p>
      </form>
    </div>
  );
};

export default Tip;
