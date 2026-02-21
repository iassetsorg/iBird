"use client";

import { useEffect, useMemo, useState } from "react";
import Navbar from "../components/layout/Navbar";
import Explorer from "../components/explorer/explorer";
import Billboard from "../components/billboard/billboard";
import ChatsManager from "../components/chats/chats_manager";

type TabKey = "chats" | "explorer" | "billboard";

type TabDefinition = {
  id: TabKey;
  label: string;
};

const tabs: TabDefinition[] = [
  {
    id: "chats",
    label: "Chats",
  },
  {
    id: "explorer",
    label: "Explorer",
  },
  {
    id: "billboard",
    label: "Billboard",
  },
];

export default function AppPage() {
  const [activeTab, setActiveTab] = useState<TabKey>("explorer");
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  const particles = useMemo(
    () =>
      Array.from({ length: 18 }, (_, i) => ({
        id: i,
        left: `${Math.random() * 100}%`,
        top: `${Math.random() * 100}%`,
        delay: `${Math.random() * 20}s`,
        duration: `${15 + Math.random() * 10}s`,
      })),
    []
  );

  return (
    <>
      <Navbar />
      <main className="relative min-h-screen overflow-hidden">
        {/* Animated Background */}
        <div className="fixed inset-0 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 animate-gradient-shift bg-[length:400%_400%]" />
        <div className="fixed inset-0 bg-cyber-grid opacity-10" />

        {/* Floating Particles */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          {particles.map((particle) => (
            <div
              key={particle.id}
              className="absolute w-2 h-2 bg-gradient-to-r from-cyan-400 to-blue-500 rounded-full opacity-30 animate-particle-float"
              style={{
                left: particle.left,
                top: particle.top,
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
          style={{ animationDelay: "2.5s" }}
        />
        <div
          className="fixed top-1/2 right-1/3 w-64 h-64 bg-gradient-radial from-pink-500/10 to-transparent rounded-full blur-3xl animate-pulse"
          style={{ animationDelay: "4s" }}
        />

        <div className="relative z-10 pt-20 pb-16 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto space-y-4">
            {/* Tab Navigation */}
            <nav
              className={`transition-all duration-700 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
                }`}
              aria-label="App surfaces"
            >
              <div className="flex max-w-md mx-auto gap-2 rounded-full border border-white/10 bg-white/5 p-1 backdrop-blur-2xl">
                {tabs.map((tab) => {
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveTab(tab.id)}
                      className={`flex-1 rounded-full px-4 py-2 text-sm font-mono font-semibold tracking-wide transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/80 ${isActive
                        ? "bg-white text-slate-900 shadow-lg shadow-cyan-500/30"
                        : "text-white/70 hover:text-white"
                        }`}
                      aria-pressed={isActive}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            </nav>

            {/* Active Surface */}
            <section
              className={`relative rounded-[32px] border border-white/10 bg-slate-900/70 backdrop-blur-3xl shadow-[0_0_80px_rgba(14,165,233,0.25)] transition-all duration-700 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
                }`}
            >
              <div className="absolute inset-0 rounded-[32px] bg-gradient-to-br from-white/5 via-transparent to-transparent pointer-events-none" />
              <div className="relative">
                {activeTab === "chats" && <ChatsManager />}
                {activeTab === "explorer" && <Explorer />}
                {activeTab === "billboard" && <Billboard />}
              </div>
            </section>
          </div>
        </div>

        {/* Floating Action Elements */}
        <div className="fixed top-24 right-10 w-3 h-3 bg-cyan-400 rounded-full animate-pulse opacity-40" />
        <div
          className="fixed bottom-32 left-10 w-2 h-2 bg-purple-400 rounded-full animate-pulse opacity-40"
          style={{ animationDelay: "1s" }}
        />
        <div
          className="fixed top-1/2 right-20 w-2 h-2 bg-pink-400 rounded-full animate-pulse opacity-40"
          style={{ animationDelay: "2s" }}
        />
      </main>
    </>
  );
}
