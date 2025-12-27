"use client";
import { useState, useEffect } from "react";

const LOADING_TEXTS = [
  "又要见到好朋友啦",
  "在哪里见面好呢",
  "要不要善待一下经期的朋友",
  "她穿了高跟鞋，善待一下她吧",
  "正在计算最公平的距离...",
  "正在寻找环境优雅的场所...",
  "快好啦，再等我一下下...",
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
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-white/40 backdrop-blur-md transition-opacity duration-300 pointer-events-auto">
      <div className="text-center p-8 bg-white/80 rounded-3xl shadow-2xl border border-white/30 w-[85%] max-w-sm mx-auto">
        <div className="mb-8 relative w-16 h-16 mx-auto">
          <div className="absolute inset-0 border-4 border-blue-100 rounded-full"></div>
          <div className="absolute inset-0 border-4 border-blue-600 rounded-full border-t-transparent animate-spin"></div>
        </div>
        <div className="h-8 overflow-hidden relative">
          <p 
            key={textIndex} 
            className="text-lg font-bold text-gray-800 animate-text-slide"
          >
            {LOADING_TEXTS[textIndex]}
          </p>
        </div>
        <p className="mt-4 text-xs text-blue-500 font-medium tracking-widest uppercase">
          Finding the best spot
        </p>
      </div>
    </div>
  );
}

