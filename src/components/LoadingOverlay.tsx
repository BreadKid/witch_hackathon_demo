"use client";
import { useState, useEffect } from "react";

const LOADING_TEXTS = [
  "又要见到好朋友啦 ",
  "在哪里见面好呢 ",
  "要不要善待一下经期的朋友 ",
  "穿高跟的人脚很累了吧 ",
  "要碰头啦！ ",
];

export default function LoadingOverlay() {
  const [textIndex, setTextIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setTextIndex((prev) => (prev + 1) % LOADING_TEXTS.length);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#FCE682]/40 backdrop-blur-md transition-opacity duration-300 pointer-events-auto">
      <div className="text-center p-8 bg-white neo-border neo-shadow w-[90%] max-w-sm mx-auto flex flex-col items-center">
        <div className="mb-8 relative w-20 h-20 shrink-0">
          <div className="absolute inset-0 border-4 border-black/10 rounded-full"></div>
          <div className="absolute inset-0 border-4 border-black rounded-full border-t-transparent animate-spin"></div>
        </div>
        <div className="w-full py-4 px-2 flex items-center justify-center min-h-[4rem]">
          <p 
            key={textIndex} 
            className="text-xl font-black text-black italic animate-text-slide leading-tight break-words text-center"
          >
            {LOADING_TEXTS[textIndex]}
          </p>
        </div>
        <div className="mt-6 relative inline-block shrink-0">
          <div className="absolute inset-0 bg-black -rotate-1"></div>
          <p className="relative text-sm font-black text-white italic px-4 py-1 -rotate-1">
            别多想了 见面重要
          </p>
        </div>
      </div>
    </div>
  );
}

