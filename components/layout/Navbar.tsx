"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/router";
import Wallet from "../wallet/wallet";

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // Check for reduced motion preference
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mediaQuery.matches);

    const handleChange = () => setPrefersReducedMotion(mediaQuery.matches);
    mediaQuery.addEventListener("change", handleChange);

    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (prefersReducedMotion) return;

      setMousePosition({
        x: (e.clientX - window.innerWidth / 2) * 0.02,
        y: (e.clientY - 50) * 0.02,
      });
    };

    window.addEventListener("scroll", handleScroll);
    document.addEventListener("mousemove", handleMouseMove);

    return () => {
      window.removeEventListener("scroll", handleScroll);
      document.removeEventListener("mousemove", handleMouseMove);
      mediaQuery.removeEventListener("change", handleChange);
    };
  }, [prefersReducedMotion]);

  const navLinks: { href: string; label: string }[] = [];

  return (
    <>
      <nav
        className={`
          fixed top-0 left-0 right-0 z-50
          transition-all duration-500 ease-out
          ${scrolled
            ? "bg-black/90 backdrop-blur-xl shadow-2xl shadow-cyan-500/10 border-b border-cyan-400/20"
            : "bg-gradient-to-r from-black/20 via-purple-900/30 to-black/20 backdrop-blur-md"
          }
        `}
      >
        {/* Animated background effects */}
        <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/5 via-purple-500/5 to-pink-500/5 animate-gradient-shift bg-[length:200%_200%]" />

        {/* Holographic glow line */}
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-400/50 to-transparent animate-holographic" />

        <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="flex justify-between items-center h-16">
            {/* Enhanced Logo/Brand */}
            <div className="flex items-center h-full">
              <Link
                href="/"
                className="flex items-center space-x-3 group h-full"
              >
                <div
                  className="relative transform transition-all duration-300 group-hover:scale-110"
                  style={{
                    transform: `translate(${mousePosition.x * 0.5}px, ${mousePosition.y * 0.5
                      }px) scale(${scrolled ? 0.9 : 1})`,
                  }}
                >
                  {/* Glowing ring around logo */}
                  <div className="absolute inset-0 bg-gradient-to-r from-cyan-400 to-purple-400 rounded-lg blur-md opacity-30 group-hover:opacity-60 transition-opacity duration-300 animate-pulse" />
                  <Image
                    src="/icon.png"
                    alt="iBird Logo"
                    width={52}
                    height={52}
                    className="rounded-lg relative z-10 shadow-lg"
                  />
                </div>
                <span
                  className="text-xl font-bold bg-gradient-to-r from-white via-cyan-100 to-white bg-clip-text text-transparent group-hover:from-cyan-400 group-hover:via-white group-hover:to-purple-400 transition-all duration-300"
                  style={{
                    transform: `translate(${mousePosition.x * 0.3}px, ${mousePosition.y * 0.3
                      }px)`,
                  }}
                >
                  iBird
                </span>
                <span className="ml-2 px-2 py-0.5 text-[10px] font-semibold tracking-wider bg-gradient-to-r from-cyan-500/20 to-purple-500/20 text-cyan-300 border border-cyan-400/30 rounded-full shadow-[0_0_8px_rgba(34,211,238,0.3)]">
                  β v1
                </span>
              </Link>
            </div>

            {/* Desktop Navigation - Right side */}
            <div className="hidden md:flex items-center space-x-6 h-full">
              {/* Navigation Links */}
              <div className="flex items-center space-x-4 h-full">
                {navLinks.map((link, index) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`
                      px-4 py-2 text-sm font-medium rounded-lg transition-all duration-300 relative group
                      ${router.pathname === link.href
                        ? "bg-gradient-to-r from-cyan-500 to-purple-500 text-white shadow-lg shadow-cyan-500/25"
                        : "text-white/70 hover:text-white hover:bg-white/10 backdrop-blur-sm"
                      }
                    `}
                    style={{
                      transform: `translate(${mousePosition.x * (0.2 + index * 0.1)
                        }px, ${mousePosition.y * (0.2 + index * 0.1)}px)`,
                    }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-cyan-400/20 to-purple-400/20 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-sm" />
                    <span className="relative z-10">{link.label}</span>
                  </Link>
                ))}
              </div>

              {/* Enhanced Social Links - Only show on home and how-it-works pages */}
              {(router.pathname === "/" || router.pathname === "/how-it-works") && (
                <div className="flex items-center space-x-3 h-full">
                  <a
                    href="https://x.com/iAssetsOrg"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group relative p-3 text-white/60 hover:text-white rounded-lg transition-all duration-300 hover:bg-gradient-to-r hover:from-cyan-500/20 hover:to-purple-500/20 backdrop-blur-sm"
                    aria-label="Follow us on X (Twitter)"
                    style={{
                      transform: `translate(${mousePosition.x * 0.4}px, ${mousePosition.y * 0.4
                        }px)`,
                    }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-cyan-400/20 to-blue-400/20 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-sm" />
                    <svg
                      className="w-5 h-5 relative z-10 group-hover:scale-110 transition-transform duration-300"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                    </svg>
                  </a>

                  <a
                    href="http://discord.gg/xM7SkkTEAG"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group relative p-3 text-white/60 hover:text-white rounded-lg transition-all duration-300 hover:bg-gradient-to-r hover:from-purple-500/20 hover:to-pink-500/20 backdrop-blur-sm"
                    aria-label="Join our Discord"
                    style={{
                      transform: `translate(${mousePosition.x * -0.3}px, ${mousePosition.y * -0.3
                        }px)`,
                    }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-purple-400/20 to-pink-400/20 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-sm" />
                    <svg
                      className="w-5 h-5 relative z-10 group-hover:scale-110 transition-transform duration-300"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3731-.4447.8648-.6083 1.2495-1.8447-.2763-3.68-.2763-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9923 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2527-.1923.3604-.3002a.0743.0743 0 01.0786-.0135c3.9281 1.5293 8.6735 1.5195 12.5915 0a.0777.0777 0 01.079.0135c.1075.1077.2337.2057.3604.3002a.078.078 0 01-.0065.1276c-.5982.3444-1.2208.6469-1.8724.8923a.0752.0752 0 00-.0407.1067c.3604.6984.771.8648 1.2254 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5229 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6733-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z" />
                    </svg>
                  </a>
                </div>
              )}

              {(router.pathname !== "/" && router.pathname !== "/how-it-works") && <Wallet />}
            </div>

            {/* Enhanced Mobile Social Links and Connect Button */}
            <div className="md:hidden flex items-center space-x-3 h-full">
              {(router.pathname === "/" || router.pathname === "/how-it-works") && (
                <>
                  <a
                    href="https://x.com/iAssetsOrg"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group relative p-2 text-white/60 hover:text-white rounded-lg transition-all duration-300 hover:bg-gradient-to-r hover:from-cyan-500/20 hover:to-purple-500/20 backdrop-blur-sm"
                    aria-label="Follow us on X (Twitter)"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-cyan-400/20 to-blue-400/20 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-sm" />
                    <svg
                      className="w-4 h-4 relative z-10 group-hover:scale-110 transition-transform duration-300"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                    </svg>
                  </a>

                  <a
                    href="http://discord.gg/xM7SkkTEAG"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group relative p-2 text-white/60 hover:text-white rounded-lg transition-all duration-300 hover:bg-gradient-to-r hover:from-purple-500/20 hover:to-pink-500/20 backdrop-blur-sm"
                    aria-label="Join our Discord"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-purple-400/20 to-pink-400/20 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-sm" />
                    <svg
                      className="w-4 h-4 relative z-10 group-hover:scale-110 transition-transform duration-300"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3731-.4447.8648-.6083 1.2495-1.8447-.2763-3.68-.2763-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9923 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2527-.1923.3604-.3002a.0743.0743 0 01.0786-.0135c3.9281 1.5293 8.6735 1.5195 12.5915 0a.0777.0777 0 01.079.0135c.1075.1077.2337.2057.3604.3002a.078.078 0 01-.0065.1276c-.5982.3444-1.2208.6469-1.8724.8923a.0752.0752 0 00-.0407.1067c.3604.6984.771.8648 1.2254 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5229 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6733-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z" />
                    </svg>
                  </a>
                </>
              )}

              {(router.pathname !== "/" && router.pathname !== "/how-it-works") && <Wallet />}
            </div>
          </div>
        </div>

        {/* Floating particles for navbar */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {Array.from({ length: 3 }, (_, i) => (
            <div
              key={i}
              className="absolute w-1 h-1 bg-cyan-400 rounded-full opacity-20 animate-particle-float"
              style={{
                left: `${20 + i * 30}%`,
                animationDelay: `${i * 5}s`,
                animationDuration: `${10 + i * 2}s`,
              }}
            />
          ))}
        </div>
      </nav>
    </>
  );
}
