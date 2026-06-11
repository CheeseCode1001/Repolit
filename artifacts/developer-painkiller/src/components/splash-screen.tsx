import { useEffect, useState } from "react";

interface SplashScreenProps {
  onDone: () => void;
}

export function SplashScreen({ onDone }: SplashScreenProps) {
  const [visible, setVisible] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    const showTimer = setTimeout(() => setVisible(true), 60);
    const fadeTimer = setTimeout(() => setFadeOut(true), 2600);
    const doneTimer = setTimeout(() => onDone(), 2900);
    return () => {
      clearTimeout(showTimer);
      clearTimeout(fadeTimer);
      clearTimeout(doneTimer);
    };
  }, [onDone]);

  return (
    <div
      className={`fixed inset-0 z-[9999] bg-background flex flex-col items-center justify-center transition-opacity duration-300 ${
        fadeOut ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
    >
      {/* Logo centered */}
      <img
        src="/logo-icon.png"
        alt="Repolit"
        className={`w-24 h-24 object-contain transition-all duration-700 ease-out ${
          visible ? "scale-100 opacity-100" : "scale-75 opacity-0"
        }`}
        style={{ borderRadius: "22%" }}
      />
      {/* Brand name at bottom */}
      <div
        className={`absolute bottom-14 transition-all duration-700 delay-200 ease-out ${
          visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
        }`}
      >
        <span
          className="font-sans font-bold text-[2.5rem] tracking-tight text-primary select-none"
          style={{ letterSpacing: "-0.01em" }}
        >
          repolit
        </span>
      </div>
    </div>
  );
}
