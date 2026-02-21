"use client"; // Error boundaries must be Client Components

/**
 * Global Error Handler for Next.js App Router
 * This file catches errors that occur at the root level
 * Based on Next.js Context7 documentation patterns
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  console.error("Global Error Handler:", error);

  // Check if this is a profile creation related error
  const isProfileError =
    error.message.includes("USER_REJECT") ||
    error.message.includes("Query.fromBytes") ||
    error.message.includes("DAppSigner") ||
    error.message.includes("handleAssociateToken") ||
    error.stack?.includes("create_new_profile");

  const errorTitle = isProfileError
    ? "Profile Creation Error"
    : "Something went wrong!";

  const errorMessage = isProfileError
    ? error.message.includes("USER_REJECT")
      ? "Transaction was cancelled by user"
      : "An error occurred during profile creation"
    : "An unexpected error occurred";

  return (
    // global-error must include html and body tags
    <html>
      <body className="bg-black text-white font-mono">
        <div className="min-h-screen flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-slate-900/80 backdrop-blur-md rounded-2xl border border-red-400/50 p-6">
            <div className="text-center">
              <h2 className="text-xl text-red-400 mb-4">{errorTitle}</h2>
              <p className="text-white/80 mb-6">{errorMessage}</p>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => reset()}
                  className="px-6 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white transition-colors duration-200"
                >
                  Try Again
                </button>
                <button
                  onClick={() => (window.location.href = "/")}
                  className="px-6 py-2 rounded-lg bg-red-500 hover:bg-red-400 text-white transition-colors duration-200"
                >
                  Go Home
                </button>
              </div>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
