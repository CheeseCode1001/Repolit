import { useEffect, useState } from "react";
import logoIcon from "@assets/logo2_nobg.png";

interface SplashScreenProps {
  onDone: () => void;
}

export function SplashScreen({ onDone }: SplashScreenProps) {
  const [visible, setVisible] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    const showTimer = setTimeout(() => setVisible(true), 60);
    const fadeTimer = setTimeout(() => setFadeOut(true), 1700);
    const doneTimer = setTimeout(() => onDone(), 2050);
    return () => {
      clearTimeout(showTimer);
      clearTimeout(fadeTimer);
      clearTimeout(doneTimer);
    };
  }, [onDone]);

  return (
    <div
      className={`fixed inset-0 z-[9999] bg-[hsl(240,5.9%,5%)] flex flex-col items-center justify-center gap-5 transition-opacity duration-300 ${
        fadeOut ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
    >
      {/* Subtle scanline texture */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden>
        {Array.from({ length: 40 }).map((_, i) => (
          <div
            key={i}
            className="absolute w-full h-px bg-primary/5"
            style={{ top: `${i * 2.5}%` }}
          />
        ))}
      </div>

      {/* Corner accents */}
      <div className="absolute top-6 left-6 w-6 h-6 border-t-2 border-l-2 border-primary/40" />
      <div className="absolute top-6 right-6 w-6 h-6 border-t-2 border-r-2 border-primary/40" />
      <div className="absolute bottom-6 left-6 w-6 h-6 border-b-2 border-l-2 border-primary/40" />
      <div className="absolute bottom-6 right-6 w-6 h-6 border-b-2 border-r-2 border-primary/40" />

      {/* Logo */}
      <img
        src={logoIcon}
        alt="Repograph"
        className={`w-32 h-32 object-contain transition-all duration-700 ease-out ${
          visible ? "scale-100 opacity-100" : "scale-75 opacity-0"
        }`}
      />

      {/* Text block */}
      <div
        className={`flex flex-col items-center gap-1.5 transition-all duration-700 delay-150 ease-out ${
          visible ? "translate-y-0 opacity-100" : "translate-y-5 opacity-0"
        }`}
      >
        <span className="font-mono font-bold tracking-[0.35em] text-xl text-primary uppercase">
          repograph
        </span>
        <span className="font-mono text-[10px] text-muted-foreground tracking-[0.25em] uppercase">
          AI-powered repo analysis
        </span>
      </div>

      {/* Loading bar */}
      <div
        className={`w-32 h-px bg-border overflow-hidden transition-all duration-700 delay-300 ease-out ${
          visible ? "opacity-100" : "opacity-0"
        }`}
      >
        <div
          className="h-full bg-primary transition-all duration-[1400ms] ease-out delay-200"
          style={{ width: visible ? "100%" : "0%" }}
        />
      </div>
    </div>
  );
}
