/**
 * Early initialization of WalletConnect error suppression
 * This MUST run before any WalletConnect/React initialization
 * Suppresses known WalletConnect internal errors:
 * - "session_request without any listeners" - harmless race condition
 * - "No matching key" - stale session data from expired/disconnected sessions
 */
if (typeof window !== 'undefined') {
  // Helper to check if error is a WalletConnect/Hedera SDK internal error that should be suppressed
  // These are known, harmless errors that occur during normal wallet operations
  const isWalletConnectInternalError = (str: string): boolean => {
    return (
      (str.includes('session_request') && str.includes('without any listeners')) ||
      str.includes('No matching key') ||
      str.includes('Query.fromBytes') ||
      str.includes('USER_REJECT') ||
      str.includes('DAppSigner') ||
      str.includes('Transaction timed out') ||
      str.includes('timed out')
    );
  };

  // Store original console methods
  const originalConsoleError = console.error;
  const originalConsoleWarn = console.warn;

  // Override console.error
  console.error = (...args: unknown[]) => {
    const errorString = args.map(arg => {
      if (arg instanceof Error) return arg.message + ' ' + (arg.stack || '');
      if (typeof arg === 'object') {
        try { return JSON.stringify(arg); } catch { return String(arg); }
      }
      return String(arg);
    }).join(' ');
    
    if (isWalletConnectInternalError(errorString)) return;
    originalConsoleError.apply(console, args);
  };

  // Override console.warn (WalletConnect sometimes uses this)
  console.warn = (...args: unknown[]) => {
    const warnString = args.map(arg => {
      if (arg instanceof Error) return arg.message + ' ' + (arg.stack || '');
      if (typeof arg === 'object') {
        try { return JSON.stringify(arg); } catch { return String(arg); }
      }
      return String(arg);
    }).join(' ');
    
    if (isWalletConnectInternalError(warnString)) return;
    originalConsoleWarn.apply(console, args);
  };

  // Early global error handler (capture phase)
  window.addEventListener('error', (event: ErrorEvent) => {
    const message = event.error?.message || event.message || '';
    const stack = event.error?.stack || '';
    if (isWalletConnectInternalError(message) || isWalletConnectInternalError(stack)) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);

  // Early unhandled rejection handler (capture phase)
  window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
    const reason = event.reason;
    let checkStr = '';
    if (typeof reason === 'string') {
      checkStr = reason;
    } else if (reason && typeof reason === 'object') {
      checkStr = (reason.message || '') + ' ' + (reason.stack || '');
    }
    if (isWalletConnectInternalError(checkStr)) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);
}

import "../styles/globals.css";
import type { AppProps } from "next/app";
import Head from "next/head";
import { Suspense } from "react";
import LoadingSpinner from "@/components/common/LoadingSpinner";
import ReactWalletsProvider from "../components/wallet/config";
import { WalletProvider } from "../components/wallet/WalletContext";
import { ToastContainer } from "react-toastify";

import Navbar from "@/components/layout/Navbar";

export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
      <Head>
        {/* Primary Meta Tags */}
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#000000" />
        <title>iBird - Web3 Social Media on Hedera</title>
        {/* SEO Meta Tags */}

        <meta
          name="description"
          content="iBird is the first 100% decentralized Web3 social media platform built on Hedera Hashgraph. Experience true ownership, uncensored content, and carbon-negative social networking with HBAR and ASSET tokens."
        />
        <meta
          name="keywords"
          content="iBird, Hedera, HBAR, ASSET token, iAssets, Web3 social media, decentralized social network, blockchain social platform, Hedera Hashgraph, DLT social media, crypto social network, uncensored social media, carbon negative social platform, Web3 community, DeFi social, NFT social platform, distributed ledger social media, Hedera ecosystem, HBAR ecosystem, decentralized content, blockchain messaging, Web3 communication, crypto community platform"
        />
        <meta name="author" content="iBird Team" />
        <meta
          name="robots"
          content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1"
        />
        <meta name="googlebot" content="index, follow" />

        {/* Hedera & HBAR Specific Meta Tags */}
        <meta name="hedera-network" content="mainnet" />
        <meta name="supported-tokens" content="HBAR, ASSET" />
        <meta name="blockchain-network" content="Hedera Hashgraph" />
        <meta name="web3-category" content="Social Media DApp" />

        {/* Open Graph Meta Tags */}
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="iBird" />
        <meta
          property="og:title"
          content="iBird - Decentralized Web3 Social Media on Hedera"
        />
        <meta
          property="og:description"
          content="The first 100% decentralized Web3 social platform built on Hedera. True ownership, uncensored content, and carbon-negative footprint with HBAR and ASSET tokens."
        />
        <meta property="og:image" content="/banner.png" />
        <meta
          property="og:image:alt"
          content="iBird - Decentralized Web3 Social Media Platform"
        />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:locale" content="en_US" />

        {/* Twitter Card Meta Tags */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta
          name="twitter:title"
          content="iBird - Decentralized Web3 Social Media on Hedera"
        />
        <meta
          name="twitter:description"
          content="The first 100% decentralized Web3 social platform. Built on Hedera with HBAR and ASSET tokens. True ownership, uncensored content, carbon-negative."
        />
        <meta name="twitter:image" content="/banner.png" />
        <meta
          name="twitter:image:alt"
          content="iBird - Decentralized Web3 Social Media Platform"
        />

        {/* Additional SEO Meta Tags */}
        <meta name="application-name" content="iBird" />
        <meta name="apple-mobile-web-app-title" content="iBird" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="mobile-web-app-capable" content="yes" />

        {/* Canonical URL */}
        <link rel="canonical" href="https://ibird.io" />

        {/* Favicon and Icons */}
        <link rel="icon" href="/icon.png" />
        <link rel="shortcut icon" href="/icon.png" />
        <link rel="apple-touch-icon" href="/icon.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/icon.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/icon.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/icon.png" />

        {/* Preconnect for Performance */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />

        {/* Structured Data for Web3 Social Platform */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": ["SoftwareApplication", "WebApplication"],
              name: "iBird",
              alternateName: ["iBird Social", "iBird Web3"],
              description:
                "The first 100% decentralized Web3 social media platform built on Hedera Hashgraph with true ownership, uncensored content, and carbon-negative footprint",
              url: "https://ibird.io",
              applicationCategory: [
                "SocialNetworkingApplication",
                "BlockchainApplication",
              ],
              operatingSystem: "Web Browser",
              browserRequirements:
                "Requires JavaScript. Compatible with modern web browsers.",
              softwareVersion: "0.1.0",
              releaseNotes:
                "Initial release of decentralized social media platform",
              offers: {
                "@type": "Offer",
                price: "0",
                priceCurrency: "USD",
                availability: "https://schema.org/InStock",
              },
              creator: {
                "@type": "Organization",
                name: "iBird",
                url: "https://ibird.io",
                description:
                  "Creators of the first 100% decentralized Web3 social media platform",
              },
              keywords: [
                "Hedera",
                "HBAR",
                "ASSET token",
                "iAssets",
                "Web3 social media",
                "decentralized social network",
                "blockchain social platform",
                "Hedera Hashgraph",
                "DLT social media",
                "crypto social network",
                "uncensored social media",
                "carbon negative",
                "Web3 community",
                "DeFi social",
                "NFT social platform",
                "distributed ledger",
                "Hedera ecosystem",
                "HBAR ecosystem",
                "decentralized content",
              ],
              featureList: [
                "100% Decentralized Architecture",
                "Built on Hedera Hashgraph",
                "HBAR and ASSET Token Integration",
                "True Data Ownership",
                "Uncensored Content Sharing",
                "Carbon-Negative Footprint",
                "Lightning Fast Transactions",
                "Web3 Wallet Integration",
                "Decentralized Storage",
                "Community Governance",
              ],
              technology: [
                {
                  "@type": "Technology",
                  name: "Hedera Hashgraph",
                  description: "Enterprise-grade distributed ledger technology",
                },
                {
                  "@type": "Technology",
                  name: "HBAR",
                  description: "Native cryptocurrency of Hedera network",
                },
                {
                  "@type": "Technology",
                  name: "ASSET Token",
                  description: "Native utility token for iBird platform",
                },
              ],
              audience: {
                "@type": "Audience",
                audienceType:
                  "Web3 enthusiasts, crypto users, social media users seeking decentralization",
              },
              isAccessibleForFree: true,
              inLanguage: "en-US",
            }),
          }}
        />

        {/* Additional Structured Data for Cryptocurrency/Token */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "FinancialProduct",
              name: "ASSET Token",
              alternateName: "iAssets ASSET",
              description:
                "Native utility token for iBird decentralized social media platform built on Hedera",
              provider: {
                "@type": "Organization",
                name: "iBird",
                url: "https://ibird.io",
              },
              category: "Utility Token",
              currency: "ASSET",
              isRelatedTo: [
                {
                  "@type": "FinancialProduct",
                  name: "HBAR",
                  description: "Hedera Hashgraph native cryptocurrency",
                },
              ],
              featureList: [
                "Platform Governance",
                "Content Monetization",
                "Premium Features Access",
                "Community Rewards",
              ],
            }),
          }}
        />

        {/* Web3 and Blockchain Specific Meta Tags */}
        <meta name="web3:network" content="hedera-mainnet" />
        <meta name="web3:tokens" content="HBAR,ASSET" />
        <meta name="blockchain:platform" content="Hedera Hashgraph" />
        <meta name="dapp:category" content="Social Media" />
        <meta name="crypto:ecosystem" content="Hedera" />

        {/* Additional SEO Enhancement */}
        <meta name="format-detection" content="telephone=no" />
        <meta name="msapplication-TileColor" content="#000000" />
        <meta name="msapplication-config" content="/browserconfig.xml" />

        {/* Sitemap */}
        <link rel="sitemap" type="application/xml" href="/sitemap.xml" />
      </Head>
      <Suspense fallback={<LoadingSpinner />}>
        <ReactWalletsProvider>
          <WalletProvider>
            <Navbar />
            <Component {...pageProps} />
          </WalletProvider>
        </ReactWalletsProvider>
        <ToastContainer />
      </Suspense>
    </>
  );
}
