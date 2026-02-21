"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import Head from "next/head";
import Navbar from "../components/layout/Navbar";
import SEOHead from "../components/common/SEOHead";

/**
 * How It Works Page
 * SEO-optimized page explaining how iBird works
 * Emphasizes: Hedera blockchain, Web3 decentralized social media, SocialFi
 */

// FAQ data for SEO
const faqs = [
    {
        question: "What is iBird?",
        answer:
            "iBird is a Web3 decentralized social media platform built on Hedera blockchain. It's a SocialFi platform where users truly own their content, can monetize their posts, and engage in censorship-resistant communication.",
    },
    {
        question: "What is Hedera?",
        answer:
            "Hedera is a public distributed ledger technology (DLT) that offers fast, secure, and carbon-negative transactions. iBird uses Hedera Consensus Service (HCS) to store all messages permanently on the blockchain.",
    },
    {
        question: "How is my content stored?",
        answer:
            "All posts, threads, and polls are stored on Hedera Consensus Service topics. Media files (images, videos) are stored on Arweave for permanent, decentralized storage. This means your content exists forever, even if iBird shuts down.",
    },
    {
        question: "What is SocialFi?",
        answer:
            "SocialFi combines social media with decentralized finance (DeFi). On iBird, you can earn through tips in HBAR and other tokens, monetize your content, and participate in a token-powered social ecosystem with the ASSET token.",
    },
    {
        question: "What wallets can I use?",
        answer:
            "iBird supports HashPack, Kabila, and WalletConnect. These are Hedera-compatible wallets that let you sign transactions and manage your on-chain identity.",
    },
    {
        question: "How do I create a profile?",
        answer:
            "Connect your wallet, go to Profile, and mint your Profile NFT for 1 HBAR. This creates your unique on-chain identity that's permanently linked to your Hedera account.",
    },
    {
        question: "What tokens can I use on iBird?",
        answer:
            "iBird supports HBAR (native Hedera token), ASSET (iBird's utility token), and 10+ other HTS tokens for tipping including USDC, SAUCE, GRELF, DOVU, JAM, HSUITE, and more.",
    },
    {
        question: "Is my content censorship-resistant?",
        answer:
            "Yes! Once your content is submitted to Hedera, it cannot be deleted or modified. The data is permanently stored on the blockchain and accessible through any Hedera Mirror Node.",
    },
];

// Feature cards data
const features = [
    {
        icon: "📝",
        title: "Posts",
        description:
            "Share quick thoughts stored permanently on Hedera. Each post costs ~$0.0001 in network fees.",
        color: "cyan",
    },
    {
        icon: "🧵",
        title: "Threads",
        description:
            "Create long-form discussions with their own dedicated topic. Enable conversations and replies.",
        color: "green",
    },
    {
        icon: "📊",
        title: "Polls",
        description:
            "Run transparent on-chain voting. Every vote is recorded on Hedera for verifiable results.",
        color: "orange",
    },
    {
        icon: "📢",
        title: "Channels",
        description:
            "Broadcast content to followers. Only channel creators can post, perfect for announcements.",
        color: "blue",
    },
    {
        icon: "👥",
        title: "Groups",
        description:
            "Create community spaces where all members can participate and discuss together.",
        color: "purple",
    },
    {
        icon: "💰",
        title: "Tipping",
        description:
            "Send HBAR, ASSET, or 10+ tokens directly to creators. 99% goes to the creator.",
        color: "yellow",
    },
];

// Technology stack data
const techStack = [
    {
        name: "Hedera Hashgraph",
        description:
            "Enterprise-grade public DLT with 10,000+ TPS, $0.0001 transactions, and carbon-negative operations.",
        icon: "ℏ",
    },
    {
        name: "Hedera Consensus Service",
        description:
            "All messages are stored as HCS topic messages, creating an immutable record of all content.",
        icon: "📡",
    },
    {
        name: "Arweave",
        description:
            "Permanent decentralized storage for media files. Images and videos live forever.",
        icon: "💾",
    },
    {
        name: "NFT Profiles",
        description:
            "Unique on-chain identities minted as Hedera Token Service (HTS) NFTs.",
        icon: "🎨",
    },
];

export default function HowItWorks() {
    const [isVisible, setIsVisible] = useState(false);
    const [openFaq, setOpenFaq] = useState<number | null>(null);

    useEffect(() => {
        setIsVisible(true);
    }, []);

    // Generate SEO config
    const seoConfig = {
        title: "How iBird Works | Web3 Decentralized Social Media on Hedera",
        description:
            "Learn how iBird works - the Web3 SocialFi platform built on Hedera blockchain. Discover decentralized posts, on-chain messaging, NFT profiles, and token-powered social interactions.",
        keywords:
            "how ibird works, hedera social media, web3 social, decentralized social media, socialfi, hedera consensus service, blockchain social network, crypto social media, censorship-resistant social, on-chain messaging",
        ogUrl: "https://ibird.io/how-it-works",
        canonicalUrl: "https://ibird.io/how-it-works",
        contentType: "website" as const,
    };

    // Generate particles for background
    const particles = Array.from({ length: 15 }, (_, i) => ({
        id: i,
        left: `${Math.random() * 100}%`,
        delay: `${Math.random() * 20}s`,
        duration: `${15 + Math.random() * 10}s`,
    }));

    return (
        <>
            <SEOHead seoConfig={seoConfig} />
            <Head>
                {/* FAQ Schema for rich snippets */}
                <script
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{
                        __html: JSON.stringify({
                            "@context": "https://schema.org",
                            "@type": "FAQPage",
                            mainEntity: faqs.map((faq) => ({
                                "@type": "Question",
                                name: faq.question,
                                acceptedAnswer: {
                                    "@type": "Answer",
                                    text: faq.answer,
                                },
                            })),
                        }),
                    }}
                />
                {/* Article Schema */}
                <script
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{
                        __html: JSON.stringify({
                            "@context": "https://schema.org",
                            "@type": "Article",
                            headline: "How iBird Works - Web3 Decentralized Social Media on Hedera",
                            description:
                                "Complete guide to iBird, the SocialFi platform built on Hedera blockchain.",
                            author: {
                                "@type": "Organization",
                                name: "iBird",
                                url: "https://ibird.io",
                            },
                            publisher: {
                                "@type": "Organization",
                                name: "iBird",
                                logo: {
                                    "@type": "ImageObject",
                                    url: "https://ibird.io/icon.png",
                                },
                            },
                            mainEntityOfPage: "https://ibird.io/how-it-works",
                        }),
                    }}
                />
            </Head>

            <Navbar />

            <main className="relative min-h-screen overflow-hidden">
                {/* Animated Background */}
                <div className="fixed inset-0 bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 animate-gradient-shift bg-[length:400%_400%]" />
                <div className="fixed inset-0 bg-cyber-grid opacity-10" />

                {/* Floating Particles */}
                <div className="fixed inset-0 overflow-hidden pointer-events-none">
                    {particles.map((particle) => (
                        <div
                            key={particle.id}
                            className="absolute w-2 h-2 bg-gradient-to-r from-cyan-400 to-blue-500 rounded-full opacity-30 animate-particle-float"
                            style={{
                                left: particle.left,
                                animationDelay: particle.delay,
                                animationDuration: particle.duration,
                            }}
                        />
                    ))}
                </div>

                {/* Holographic Glow Effects */}
                <div className="fixed top-1/4 left-1/4 w-96 h-96 bg-gradient-radial from-cyan-500/15 to-transparent rounded-full blur-3xl animate-pulse" />
                <div
                    className="fixed bottom-1/4 right-1/4 w-96 h-96 bg-gradient-radial from-purple-500/15 to-transparent rounded-full blur-3xl animate-pulse"
                    style={{ animationDelay: "2s" }}
                />

                {/* Content */}
                <div className="relative z-10 pt-24 pb-16 px-4 sm:px-6 lg:px-8">
                    <div className="max-w-6xl mx-auto">
                        {/* Hero Section */}
                        <section
                            className={`text-center mb-20 transition-all duration-1000 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
                                }`}
                        >
                            <div className="inline-flex items-center px-4 py-2 rounded-full bg-cyan-400/10 border border-cyan-400/30 mb-6">
                                <span className="text-cyan-400 font-mono text-sm">
                                    🌐 Built on Hedera Hashgraph
                                </span>
                            </div>

                            <h1 className="text-4xl md:text-6xl font-mono font-bold mb-6">
                                <span className="bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                                    How iBird Works
                                </span>
                            </h1>

                            <p className="text-xl md:text-2xl text-cyan-100/80 font-mono max-w-3xl mx-auto mb-8 leading-relaxed">
                                The <strong className="text-cyan-400">Web3 Decentralized Social Media</strong> platform
                                where you <strong className="text-purple-400">truly own</strong> your content,
                                <strong className="text-pink-400"> earn from engagement</strong>, and communicate
                                without censorship.
                            </p>

                            <div className="flex flex-wrap justify-center gap-4">
                                <span className="px-4 py-2 bg-gradient-to-r from-cyan-400/20 to-blue-400/20 border border-cyan-400/30 rounded-xl text-cyan-300 font-mono text-sm">
                                    ℏ Hedera Blockchain
                                </span>
                                <span className="px-4 py-2 bg-gradient-to-r from-purple-400/20 to-pink-400/20 border border-purple-400/30 rounded-xl text-purple-300 font-mono text-sm">
                                    💎 SocialFi
                                </span>
                                <span className="px-4 py-2 bg-gradient-to-r from-green-400/20 to-cyan-400/20 border border-green-400/30 rounded-xl text-green-300 font-mono text-sm">
                                    🔓 Censorship-Resistant
                                </span>
                            </div>
                        </section>

                        {/* What Makes iBird Different */}
                        <section
                            className={`mb-20 transition-all duration-1000 delay-200 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
                                }`}
                        >
                            <div className="bg-gradient-to-br from-slate-900/80 via-purple-900/30 to-slate-900/80 backdrop-blur-xl rounded-3xl border border-cyan-400/20 p-8 md:p-12">
                                <h2 className="text-3xl font-mono font-bold text-white mb-8 text-center">
                                    <span className="bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
                                        What Makes iBird Different?
                                    </span>
                                </h2>

                                <div className="grid md:grid-cols-3 gap-8">
                                    <div className="text-center p-6 bg-slate-800/50 rounded-2xl border border-cyan-400/20">
                                        <div className="text-4xl mb-4">🏛️</div>
                                        <h3 className="text-xl font-mono font-bold text-cyan-400 mb-3">
                                            100% Decentralized
                                        </h3>
                                        <p className="text-cyan-100/70 font-mono text-sm">
                                            No central server. All data lives on Hedera blockchain. Your content survives
                                            forever, even if iBird disappears.
                                        </p>
                                    </div>

                                    <div className="text-center p-6 bg-slate-800/50 rounded-2xl border border-purple-400/20">
                                        <div className="text-4xl mb-4">💰</div>
                                        <h3 className="text-xl font-mono font-bold text-purple-400 mb-3">
                                            SocialFi Economics
                                        </h3>
                                        <p className="text-cyan-100/70 font-mono text-sm">
                                            Earn tips in HBAR, ASSET, and 10+ tokens. Monetize your content directly
                                            without middlemen taking 30%+ cuts.
                                        </p>
                                    </div>

                                    <div className="text-center p-6 bg-slate-800/50 rounded-2xl border border-pink-400/20">
                                        <div className="text-4xl mb-4">🔐</div>
                                        <h3 className="text-xl font-mono font-bold text-pink-400 mb-3">
                                            You Own Your Data
                                        </h3>
                                        <p className="text-cyan-100/70 font-mono text-sm">
                                            Your posts aren&apos;t stored in a company database. They&apos;re on-chain, signed by
                                            your wallet, and belong to YOU.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* Technology Stack */}
                        <section
                            className={`mb-20 transition-all duration-1000 delay-300 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
                                }`}
                        >
                            <h2 className="text-3xl font-mono font-bold text-center mb-12">
                                <span className="bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
                                    Powered by Hedera Technology
                                </span>
                            </h2>

                            <div className="grid md:grid-cols-2 gap-6">
                                {techStack.map((tech, index) => (
                                    <div
                                        key={index}
                                        className="group bg-gradient-to-br from-slate-800/60 to-slate-900/60 backdrop-blur-sm rounded-2xl p-6 border border-cyan-400/20 hover:border-cyan-400/40 transition-all duration-300 hover:scale-[1.02]"
                                    >
                                        <div className="flex items-start gap-3 sm:gap-4">
                                            <div className="w-10 h-10 md:w-14 md:h-14 rounded-xl bg-gradient-to-br from-cyan-400/20 to-purple-400/20 flex items-center justify-center text-xl md:text-2xl border border-cyan-400/30 flex-shrink-0">
                                                {tech.icon}
                                            </div>
                                            <div className="min-w-0">
                                                <h3 className="text-xl font-mono font-bold text-white mb-2">
                                                    {tech.name}
                                                </h3>
                                                <p className="text-cyan-100/70 font-mono text-sm leading-relaxed">
                                                    {tech.description}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>

                        {/* How Data Flows */}
                        <section
                            className={`mb-20 transition-all duration-1000 delay-400 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
                                }`}
                        >
                            <div className="bg-gradient-to-br from-slate-900/80 via-cyan-900/20 to-slate-900/80 backdrop-blur-xl rounded-3xl border border-cyan-400/20 p-8 md:p-12">
                                <h2 className="text-3xl font-mono font-bold text-center mb-12">
                                    <span className="bg-gradient-to-r from-cyan-400 to-green-400 bg-clip-text text-transparent">
                                        How Your Content Gets On-Chain
                                    </span>
                                </h2>

                                <div className="flex flex-col md:flex-row items-center justify-center gap-4 md:gap-8">
                                    {[
                                        { step: "1", title: "Write Post", icon: "✏️" },
                                        { step: "2", title: "Sign with Wallet", icon: "🔐" },
                                        { step: "3", title: "Submit to Hedera", icon: "📤" },
                                        { step: "4", title: "Stored on HCS Topic", icon: "⛓️" },
                                        { step: "5", title: "Indexed by Mirror Node", icon: "🔍" },
                                        { step: "6", title: "Displayed on iBird", icon: "🐦" },
                                    ].map((item, index) => (
                                        <React.Fragment key={index}>
                                            <div className="flex flex-col items-center text-center">
                                                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-cyan-400/20 to-purple-400/20 flex items-center justify-center text-2xl border-2 border-cyan-400/30 mb-3">
                                                    {item.icon}
                                                </div>
                                                <div className="text-xs font-mono text-cyan-400 mb-1">
                                                    Step {item.step}
                                                </div>
                                                <div className="text-sm font-mono text-white font-medium">
                                                    {item.title}
                                                </div>
                                            </div>
                                            {index < 5 && (
                                                <div className="hidden md:block text-cyan-400/50 text-2xl">→</div>
                                            )}
                                        </React.Fragment>
                                    ))}
                                </div>

                                <p className="text-center text-cyan-100/60 font-mono text-sm mt-8 max-w-2xl mx-auto">
                                    Once on Hedera, your content is <strong className="text-cyan-400">permanent</strong> and
                                    <strong className="text-cyan-400"> verifiable</strong>. Anyone can read it directly from
                                    the Hedera Mirror Node, even without iBird.
                                </p>
                            </div>
                        </section>

                        {/* Features */}
                        <section
                            className={`mb-20 transition-all duration-1000 delay-500 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
                                }`}
                        >
                            <h2 className="text-3xl font-mono font-bold text-center mb-12">
                                <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                                    Features & Content Types
                                </span>
                            </h2>

                            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {features.map((feature, index) => (
                                    <div
                                        key={index}
                                        className={`group bg-gradient-to-br from-slate-800/60 to-slate-900/60 backdrop-blur-sm rounded-2xl p-6 border border-${feature.color}-400/20 hover:border-${feature.color}-400/40 transition-all duration-300 hover:scale-[1.02] hover:shadow-lg hover:shadow-${feature.color}-400/10`}
                                    >
                                        <div className="text-4xl mb-4">{feature.icon}</div>
                                        <h3 className={`text-xl font-mono font-bold text-${feature.color}-400 mb-3`}>
                                            {feature.title}
                                        </h3>
                                        <p className="text-cyan-100/70 font-mono text-sm leading-relaxed">
                                            {feature.description}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </section>

                        {/* Token Economics */}
                        <section
                            className={`mb-20 transition-all duration-1000 delay-600 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
                                }`}
                        >
                            <div className="bg-gradient-to-br from-purple-900/40 via-slate-900/80 to-purple-900/40 backdrop-blur-xl rounded-3xl border border-purple-400/20 p-8 md:p-12">
                                <h2 className="text-3xl font-mono font-bold text-center mb-8">
                                    <span className="bg-gradient-to-r from-yellow-400 to-orange-400 bg-clip-text text-transparent">
                                        Token Economics (SocialFi)
                                    </span>
                                </h2>

                                <div className="grid md:grid-cols-2 gap-8">
                                    <div className="p-6 bg-slate-800/50 rounded-2xl border border-cyan-400/20">
                                        <div className="flex items-center gap-3 mb-4">
                                            <span className="text-3xl">ℏ</span>
                                            <h3 className="text-xl font-mono font-bold text-white">HBAR</h3>
                                        </div>
                                        <ul className="space-y-2 text-cyan-100/70 font-mono text-sm">
                                            <li>• Network transaction fees (~$0.0001)</li>
                                            <li>• Profile NFT minting (1 HBAR)</li>
                                            <li>• Channels & Groups (network fees only)</li>
                                            <li>• Tipping content creators</li>
                                            <li>• Native Hedera currency</li>
                                        </ul>
                                    </div>

                                    <div className="p-6 bg-slate-800/50 rounded-2xl border border-purple-400/20">
                                        <div className="flex items-center gap-3 mb-4">
                                            <span className="text-3xl">💎</span>
                                            <h3 className="text-xl font-mono font-bold text-white">ASSET Token</h3>
                                        </div>
                                        <ul className="space-y-2 text-cyan-100/70 font-mono text-sm">
                                            <li>• Explorer posting fee (1,000 ASSET)</li>
                                            <li>• Billboard ad fee (10,000 ASSET)</li>
                                            <li>• Tipping with burn mechanism</li>
                                            <li>• iBird utility token</li>
                                        </ul>
                                    </div>
                                </div>

                                <div className="mt-8 text-center">
                                    <a
                                        href="https://www.saucerswap.finance/trade/HBAR/0.0.1991880"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-400 to-pink-500 text-white font-mono font-semibold rounded-xl hover:scale-105 transition-all duration-300 shadow-lg hover:shadow-purple-400/30"
                                    >
                                        Trade ASSET on SaucerSwap
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                        </svg>
                                    </a>
                                </div>
                            </div>
                        </section>

                        {/* Getting Started */}
                        <section
                            className={`mb-20 transition-all duration-1000 delay-700 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
                                }`}
                        >
                            <h2 className="text-3xl font-mono font-bold text-center mb-12">
                                <span className="bg-gradient-to-r from-green-400 to-cyan-400 bg-clip-text text-transparent">
                                    Getting Started in 5 Steps
                                </span>
                            </h2>

                            <div className="space-y-6">
                                {[
                                    {
                                        step: "1",
                                        title: "Get a Hedera Wallet",
                                        description: "Download HashPack, Kabila, or use WalletConnect",
                                        icon: "👛",
                                    },
                                    {
                                        step: "2",
                                        title: "Connect to iBird",
                                        description: "Click 'Launch App' and connect your wallet",
                                        icon: "🔗",
                                    },
                                    {
                                        step: "3",
                                        title: "Create Your Profile NFT",
                                        description: "Mint your unique on-chain identity for 1 HBAR",
                                        icon: "🎨",
                                    },
                                    {
                                        step: "4",
                                        title: "Start Posting",
                                        description: "Share posts, create threads, or run polls",
                                        icon: "✍️",
                                    },
                                    {
                                        step: "5",
                                        title: "Engage & Earn",
                                        description: "Tip creators, receive tips, and grow your community",
                                        icon: "💰",
                                    },
                                ].map((item) => (
                                    <div
                                        key={item.step}
                                        className="flex items-center gap-6 bg-gradient-to-r from-slate-800/60 to-slate-900/60 backdrop-blur-sm rounded-2xl p-6 border border-cyan-400/20 hover:border-cyan-400/40 transition-all duration-300"
                                    >
                                        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center text-2xl font-mono font-bold text-white shadow-lg shadow-cyan-400/25 flex-shrink-0">
                                            {item.step}
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex items-center gap-3 mb-1">
                                                <span className="text-2xl">{item.icon}</span>
                                                <h3 className="text-xl font-mono font-bold text-white">{item.title}</h3>
                                            </div>
                                            <p className="text-cyan-100/70 font-mono text-sm">{item.description}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>

                        {/* FAQ Section */}
                        <section
                            className={`mb-20 transition-all duration-1000 delay-800 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
                                }`}
                        >
                            <h2 className="text-3xl font-mono font-bold text-center mb-12">
                                <span className="bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
                                    Frequently Asked Questions
                                </span>
                            </h2>

                            <div className="space-y-4 max-w-4xl mx-auto">
                                {faqs.map((faq, index) => (
                                    <div
                                        key={index}
                                        className="bg-gradient-to-br from-slate-800/60 to-slate-900/60 backdrop-blur-sm rounded-2xl border border-cyan-400/20 overflow-hidden"
                                    >
                                        <button
                                            onClick={() => setOpenFaq(openFaq === index ? null : index)}
                                            className="w-full p-6 text-left flex items-center justify-between hover:bg-cyan-400/5 transition-colors"
                                        >
                                            <h3 className="text-lg font-mono font-semibold text-white pr-4">
                                                {faq.question}
                                            </h3>
                                            <svg
                                                className={`w-6 h-6 text-cyan-400 transition-transform duration-300 flex-shrink-0 ${openFaq === index ? "rotate-180" : ""
                                                    }`}
                                                fill="none"
                                                stroke="currentColor"
                                                viewBox="0 0 24 24"
                                            >
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                            </svg>
                                        </button>
                                        {openFaq === index && (
                                            <div className="px-6 pb-6">
                                                <p className="text-cyan-100/80 font-mono text-sm leading-relaxed">
                                                    {faq.answer}
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </section>

                        {/* CTA Section */}
                        <section
                            className={`text-center transition-all duration-1000 delay-900 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
                                }`}
                        >
                            <div className="bg-gradient-to-br from-cyan-900/40 via-purple-900/40 to-pink-900/40 backdrop-blur-xl rounded-3xl border border-cyan-400/20 p-12">
                                <h2 className="text-3xl md:text-4xl font-mono font-bold mb-6">
                                    <span className="bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                                        Ready to Join Web3 Social?
                                    </span>
                                </h2>
                                <p className="text-cyan-100/80 font-mono text-lg mb-8 max-w-2xl mx-auto">
                                    Experience true ownership, censorship-resistant communication, and SocialFi
                                    on the Hedera blockchain.
                                </p>
                                <Link
                                    href="/app"
                                    className="inline-flex items-center gap-3 px-10 py-4 bg-gradient-to-r from-cyan-400 to-blue-500 text-white font-mono font-bold text-xl rounded-2xl hover:scale-105 transition-all duration-300 shadow-2xl shadow-cyan-400/25 hover:shadow-cyan-400/40"
                                >
                                    Launch App 🚀
                                </Link>
                            </div>
                        </section>
                    </div>
                </div>
            </main>
        </>
    );
}
