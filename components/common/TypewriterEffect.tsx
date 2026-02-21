import React, { useEffect, useRef } from "react";
import Typed from "typed.js";

interface TypewriterEffectProps {
  strings: string[];
  typeSpeed?: number;
  backSpeed?: number;
  backDelay?: number;
  startDelay?: number;
  loop?: boolean;
  className?: string;
  style?: React.CSSProperties;
  cursorColor?: string;
}

export default function TypewriterEffect({
  strings,
  typeSpeed = 40,
  backSpeed = 30,
  backDelay = 1000,
  startDelay = 300,
  loop = true,
  className = "",
  style,
  cursorColor = "currentColor",
}: TypewriterEffectProps) {
  const el = useRef<HTMLSpanElement>(null);
  const typed = useRef<Typed | null>(null);

  useEffect(() => {
    if (!el.current) return;

    // Add cursor style
    const styleSheet = document.createElement("style");
    styleSheet.textContent = `
      .typed-cursor {
        display: inline;
        position: relative;
        font-size: 1em;
        opacity: 1;
        color: ${cursorColor};
        margin-left: 0.05em;
        white-space: nowrap;
        animation: blink 0.7s infinite;
      }
      @keyframes blink {
        0% { opacity: 1; }
        50% { opacity: 0; }
        100% { opacity: 1; }
      }
    `;
    document.head.appendChild(styleSheet);

    typed.current = new Typed(el.current, {
      strings: strings,
      typeSpeed,
      backSpeed,
      backDelay,
      startDelay,
      loop,
      fadeOut: false,
      smartBackspace: true,
      shuffle: false,
      autoInsertCss: false, // We'll handle the CSS ourselves
      showCursor: true,
      cursorChar: "│",
    });

    return () => {
      typed.current?.destroy();
      styleSheet.remove();
    };
  }, [strings, typeSpeed, backSpeed, backDelay, startDelay, loop, cursorColor]);

  return <span ref={el} className={className} style={style} />;
}
