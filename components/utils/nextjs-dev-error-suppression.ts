/**
 * Next.js 15 Development Mode Error Suppression Utility
 * 
 * This utility helps suppress known, harmless errors that occur in Next.js 15 
 * development mode when using Hedera SDK and WalletConnect, preventing the
 * error overlay from appearing for user-initiated actions like transaction rejections.
 * 
 * These errors are development-only and don't affect production builds.
 */

/**
 * Patterns of errors that should be suppressed in development mode
 */
const SUPPRESSED_ERROR_PATTERNS = [
  'USER_REJECT',
  'Query.fromBytes() not implemented',
  'Query.fromBytes',
  'DAppSigner',
  'Transaction was cancelled by user',
  'handleCreateUserProfileTopic',
  'useCreateTopic',
  'handleAssociateToken',
  // WalletConnect v2 timing issues - harmless race conditions
  'emitting session_request',
  'without any listeners',
  'session_request',
  // WalletConnect stale session errors - happens when relay receives messages for expired sessions
  'No matching key',
  'No matching key. history',
  // Transaction timeout errors - expected behavior, handled in UI
  'Transaction timed out',
  'timed out',
];

/**
 * Check if an error should be suppressed in development mode
 */
export function shouldSuppressDevError(error: unknown): boolean {
  if (typeof error === 'string') {
    return SUPPRESSED_ERROR_PATTERNS.some(pattern => error.includes(pattern));
  }

  if (error && typeof error === 'object') {
    // Check error message
    if ('message' in error && typeof error.message === 'string') {
      const message = error.message as string;
      if (SUPPRESSED_ERROR_PATTERNS.some(pattern => message.includes(pattern))) {
        return true;
      }
    }

    // Check for complex WalletConnect/Hedera error structure
    if ('txError' in error && error.txError && typeof error.txError === 'object') {
      const txError = error.txError as { message?: unknown };
      if ('message' in txError && txError.message === 'USER_REJECT') {
        return true;
      }
    }

    // Check for queryError with Query.fromBytes issues
    if ('queryError' in error && error.queryError && typeof error.queryError === 'object') {
      const queryError = error.queryError as { message?: unknown };
      if ('message' in queryError && typeof queryError.message === 'string') {
        if (queryError.message.includes('Query.fromBytes')) {
          return true;
        }
      }
    }

    // Check error stack
    if ('stack' in error && typeof error.stack === 'string') {
      const stack = error.stack as string;
      if (SUPPRESSED_ERROR_PATTERNS.some(pattern => stack.includes(pattern))) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Check if error is specifically a WalletConnect internal error that should be silently suppressed.
 * These include:
 * - "session_request without any listeners" - harmless race condition in WalletConnect v2
 * - "No matching key" - stale session data from expired/disconnected sessions
 */
function isWalletConnectInternalError(error: unknown): boolean {
  const checkStr = (str: string) =>
    (str.includes('session_request') && str.includes('without any listeners')) ||
    str.includes('No matching key');
  
  if (typeof error === 'string') return checkStr(error);
  
  if (error && typeof error === 'object') {
    if ('message' in error && typeof error.message === 'string') {
      if (checkStr(error.message)) return true;
    }
    if ('stack' in error && typeof error.stack === 'string') {
      if (checkStr(error.stack)) return true;
    }
  }
  
  return false;
}

/**
 * Safe console.error that doesn't trigger Next.js dev error overlay for known patterns
 * For WalletConnect session_request errors, completely suppresses the output
 */
export function safeConsoleError(message: string, error?: unknown): void {
  // Completely suppress WalletConnect session_request errors
  if (isWalletConnectInternalError(error) || isWalletConnectInternalError(message)) {
    return; // Silent suppression
  }
  
  if (shouldSuppressDevError(error) || shouldSuppressDevError(message)) {
    // Use console.warn instead of console.error to avoid triggering error overlay
    console.warn(`[DEV_SUPPRESSED] ${message}`, error);
  } else {
    console.error(message, error);
  }
}

/**
 * Initialize error suppression for the current component/page
 * Call this in useEffect to set up global error handlers
 * Enhanced version with capture phase listeners and silent suppression for WalletConnect
 */
export function initializeErrorSuppression(): () => void {
  // Only in development mode
  if (process.env.NODE_ENV !== 'development') {
    return () => { };
  }

  const originalConsoleError = console.error;
  const originalConsoleWarn = console.warn;

  // Override console.error to suppress known patterns
  console.error = (...args: unknown[]) => {
    // Completely silent for WalletConnect session_request errors
    if (args.some(arg => isWalletConnectInternalError(arg))) {
      return;
    }

    const errorString = args.map(arg => {
      if (arg instanceof Error) return arg.message + ' ' + (arg.stack || '');
      if (typeof arg === 'object') {
        try { return JSON.stringify(arg); } catch { return String(arg); }
      }
      return String(arg);
    }).join(' ');

    if (isWalletConnectInternalError(errorString)) {
      return; // Silent suppression
    }

    if (shouldSuppressDevError(errorString) || args.some(arg => shouldSuppressDevError(arg))) {
      console.warn('[DEV_SUPPRESSED]', ...args);
      return;
    }

    originalConsoleError.apply(console, args);
  };

  // Also filter console.warn for session_request errors
  console.warn = (...args: unknown[]) => {
    if (args.some(arg => isWalletConnectInternalError(arg))) {
      return;
    }
    originalConsoleWarn.apply(console, args);
  };

  // Global error handler (capture phase)
  const handleError = (event: ErrorEvent) => {
    if (isWalletConnectInternalError(event.error) ||
        isWalletConnectInternalError(event.message)) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  };

  // Global unhandled rejection handler (capture phase)
  const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
    if (isWalletConnectInternalError(event.reason)) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  };

  // Use capture phase for early interception
  window.addEventListener('error', handleError, true);
  window.addEventListener('unhandledrejection', handleUnhandledRejection, true);

  // Cleanup function to restore original console and remove handlers
  return () => {
    console.error = originalConsoleError;
    console.warn = originalConsoleWarn;
    window.removeEventListener('error', handleError, true);
    window.removeEventListener('unhandledrejection', handleUnhandledRejection, true);
  };
}