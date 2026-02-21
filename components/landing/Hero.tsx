"use client";

import React, { useEffect, useState, Component, ErrorInfo } from "react";
import Link from "next/link";
import TypewriterEffect from "../common/TypewriterEffect";

// Error boundary for typewriter effects
class TypewriterErrorBoundary extends Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Typewriter effect error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return <span className="text-white">Web3 Social Media</span>;
    }
    return this.props.children;
  }
}

// Dynamic words that will rotate for the main headline
const dynamicWords = [
  "Web3",
  "Decentralized",
  "Uncensored",
  "Community-Driven",
  "Tokenized",
  "Immutable",
  "Transparent",
  "Trustless",
  "On-Chain",
  "Secure",
  "Fair",
  "Open",
  "Sovereign",
  "Permissionless",
  "Verifiable",
  "Unstoppable",
  "Creator-First",
];
const dynamicPhrases = [
  "Own it. Always.",
  "Monetize without middlemen.",
  "Speak. No censors.",
  "True digital ownership.",
  "Your story, on-chain.",
  "Engage. Earn. Instantly.",
  "Unstoppable communities.",
  "Post. Prove. Profit.",
  "Creators, not products.",
  "Freedom, tokenized.",
  "Power back to people.",
  "Your content, your rules.",
  "From posts to profits.",
  "Built on Hedera.",
  "Decentralized. Forever.",
  "Identity you own.",
  "Social without limits.",
  "Trustless. Transparent.",
  "No ads, just ownership.",
  "Create. Connect. Collect.",
];

export default function Hero() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  // Generate floating particles
  const particles = Array.from({ length: 15 }, (_, i) => (
    <div
      key={i}
      className={`absolute w-2 h-2 bg-gradient-to-r from-cyan-400 to-blue-500 rounded-full opacity-30 animate-particle-float`}
      style={{
        left: `${Math.random() * 100}%`,
        animationDelay: `${Math.random() * 20}s`,
        animationDuration: `${15 + Math.random() * 10}s`,
      }}
    />
  ));

  return (
    <header
      id="hero-section"
      className="relative text-center  overflow-hidden min-h-screen flex flex-col justify-center mt-8"
      role="banner"
    >
      {/* Animated Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 animate-gradient-shift bg-[length:400%_400%]" />

      {/* Cyber Grid Overlay */}
      <div className="absolute inset-0 bg-cyber-grid bg-cyber-grid opacity-20" />

      {/* Floating Particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {particles}
      </div>

      {/* Holographic Glow Effects */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-gradient-radial from-cyan-500/20 to-transparent rounded-full blur-3xl animate-pulse" />
      <div
        className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-gradient-radial from-purple-500/20 to-transparent rounded-full blur-3xl animate-pulse"
        style={{ animationDelay: "2s" }}
      />

      {/* Main Content */}
      <div className="relative z-10 space-y-16 mt-24">
        {/* Main Headline with staggered animations */}
        <div className="space-y-8">
          <h1 className="text-4xl md:text-6xl font-mono tracking-tight leading-tight text-white">
            {/* Dynamic rotating word with typewriter effect */}
            <TypewriterErrorBoundary>
              <TypewriterEffect
                strings={dynamicWords}
                className={`inline-block bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent animate-holographic transition-all duration-1000 ${isVisible
                  ? "animate-slide-up-delayed"
                  : "opacity-0 translate-y-8"
                  }`}
                typeSpeed={70}
                backSpeed={40}
                cursorColor="#38bdf8"
              />
            </TypewriterErrorBoundary>
            {/* Stable "Social Media" text */}
            <span
              className={`block text-white transition-all duration-1000 ${isVisible
                ? "animate-slide-up-delayed-2"
                : "opacity-0 translate-y-8"
                }`}
              itemProp="category"
            >
              Social Media
            </span>
            {/* Stable "Built on Hedera!" text */}
            <span
              className={`block bg-gradient-to-r from-yellow-400 to-orange-400 bg-clip-text text-transparent transition-all duration-1000 ${isVisible
                ? "animate-slide-up-delayed-3"
                : "opacity-0 translate-y-8"
                }`}
              itemProp="category"
              style={{
                animationDelay: "1.2s",
              }}
            >
              Built on Hedera!
            </span>
          </h1>

          {/* Typewriter Effect Tagline */}
          <div className="relative max-w-3xl mx-auto">
            <TypewriterErrorBoundary>
              <TypewriterEffect
                strings={dynamicPhrases}
                className={`text-lg md:text-2xl font-mono text-cyan-100/80 leading-relaxed font-light transition-all duration-1000 ${isVisible ? "opacity-100" : "opacity-0"
                  }`}
                typeSpeed={40}
                backSpeed={20}
                backDelay={3000}
                startDelay={1500}
                cursorColor="rgb(103, 232, 249)"
              />
            </TypewriterErrorBoundary>
          </div>
        </div>

        {/* Enhanced Technology Badges */}
        <div
          className={`flex flex-wrap justify-center items-center   gap-6 transition-all duration-1000 ${isVisible ? "animate-slide-up-delayed-3" : "opacity-0 translate-y-8"
            }`}
          role="group"
          aria-label="Platform technologies and tokens"
        >
          {/* Hedera Technology Badge with 3D effect */}
          <div
            className="group relative inline-flex items-center px-8 py-4 rounded-2xl bg-gradient-to-r from-black via-gray-900 to-black border border-cyan-400/50 backdrop-blur-sm font-semibold text-white shadow-2xl shadow-cyan-400/25"
            itemScope
            itemType="https://schema.org/TechArticle"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-cyan-400/20 to-purple-400/20 rounded-2xl blur-xl" />
            <span itemProp="about" className="relative z-10 text-lg">
              Powered by Hedera
            </span>
            <span
              className="text-2xl ml-3 relative z-10"
              aria-hidden="true"
              role="img"
              aria-label="Hedera network icon"
            >
              ℏ
            </span>
          </div>

          {/* ASSET Token Badge with holographic effect */}
          <div
            className="group relative inline-flex items-center px-8 py-4 rounded-2xl border border-purple-400/50 bg-gradient-to-r from-purple-900/30 via-pink-900/30 to-purple-900/30 backdrop-blur-sm shadow-2xl shadow-purple-400/25"
            itemScope
            itemType="https://schema.org/FinancialProduct"
          >
            <div className="absolute inset-0 bg-holographic opacity-30 rounded-2xl" />
            <span
              className="text-md font-medium text-white/90 mr-4 relative z-10"
              itemProp="name"
            >
              Token: ASSET
            </span>
            <a
              href="https://www.saucerswap.finance/trade/HBAR/0.0.1991880"
              target="_blank"
              rel="noopener noreferrer"
              className="relative z-10 text-sm text-white px-6 py-2 rounded-xl font-medium transition-all duration-300 ease-in-out bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 backdrop-blur-xl border border-purple-400/30 shadow-2xl shadow-purple-400/20 hover:scale-105"
              aria-label="Trade ASSET token on SaucerSwap"
              itemProp="url"
            >
              Trade Now
            </a>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row justify-center items-center gap-4 mt-8 px-4">
          <Link
            href="/app"
            className="group relative px-10 py-4 rounded-2xl inline-block w-full sm:w-auto
          bg-gradient-to-r from-cyan-500/20 via-purple-600/20 to-pink-600/20
          border-2 border-cyan-400/50
          backdrop-blur-md
          shadow-2xl shadow-cyan-400/25
          transition-all duration-500 ease-in-out
          hover:scale-105 hover:shadow-3xl hover:shadow-purple-400/40
          hover:border-purple-400/70
          cursor-pointer overflow-hidden"
          >
            {/* Animated Glow aura */}
            <div
              className="absolute inset-0 rounded-2xl bg-gradient-to-r
            from-cyan-400/40 via-purple-500/40 to-pink-500/40 blur-xl opacity-70
            group-hover:opacity-100 group-hover:blur-2xl transition-all duration-500"
            />

            {/* Pulsing inner glow */}
            <div
              className="absolute inset-1 rounded-xl bg-gradient-to-r
            from-cyan-300/20 to-purple-300/20 animate-pulse"
            />

            {/* Button Text with gradient */}
            <span className="relative z-10 bg-gradient-to-r from-cyan-200 via-purple-200 to-pink-200 bg-clip-text text-transparent font-mono text-xl md:text-2xl tracking-wide uppercase font-bold">
              Launch App 🚀
            </span>
          </Link>

          <Link
            href="/how-it-works"
            className="group relative px-8 py-4 rounded-2xl inline-block w-full sm:w-auto
          bg-transparent
          border-2 border-purple-400/40
          backdrop-blur-md
          transition-all duration-500 ease-in-out
          hover:scale-105 hover:border-purple-400/70
          hover:bg-purple-400/10
          cursor-pointer"
          >
            <span className="relative z-10 text-purple-300 font-mono text-lg md:text-xl tracking-wide font-medium">
              How It Works ❓
            </span>
          </Link>

          {/* GitHub Link */}
          <a
            href="https://github.com/iassetsorg/iBird"
            target="_blank"
            rel="noopener noreferrer"
            className="group relative px-8 py-4 rounded-2xl inline-block w-full sm:w-auto
          bg-transparent
          border-2 border-white/30
          backdrop-blur-md
          transition-all duration-500 ease-in-out
          hover:scale-105 hover:border-white/60
          hover:bg-white/10
          cursor-pointer"
            aria-label="View source code on GitHub"
          >
            <span className="relative z-10 text-white/80 font-mono text-lg md:text-xl tracking-wide font-medium flex items-center justify-center gap-2">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
              </svg>
              Source Code
            </span>
          </a>
        </div>

        {/* Floating Action Elements */}
        <div className="absolute top-20 right-10 w-4 h-4 bg-cyan-400 rounded-full animate-pulse opacity-60" />
        <div
          className="absolute bottom-20 left-10 w-3 h-3 bg-purple-400 rounded-full animate-pulse opacity-60"
          style={{ animationDelay: "1s" }}
        />
        <div
          className="absolute top-1/2 right-20 w-2 h-2 bg-pink-400 rounded-full animate-pulse opacity-60"
          style={{ animationDelay: "2s" }}
        />
      </div>

      {/* Structured Data for SEO */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "SoftwareApplication",
            name: "iBird",
            description:
              "The first 100% decentralized Web3 social platform with true ownership, uncensored content, and carbon-negative footprint",
            applicationCategory: "SocialNetworkingApplication",
            operatingSystem: "Web",
            offers: {
              "@type": "Offer",
              price: "0",
              priceCurrency: "USD",
            },
            creator: {
              "@type": "Organization",
              name: "iBird",
              url: "https://ibird.io",
            },
            keywords:
              "decentralized social media, Web3, blockchain, Hedera, uncensored, carbon-negative, ASSET token",
            applicationSubCategory: "Decentralized Social Network",
            featureList: [
              "100% Decentralized",
              "Lightning Fast",
              "Eco-Friendly",
              "Uncensored Content",
              "True Data Ownership",
            ],
          }),
        }}
      />
    </header>
  );
}
