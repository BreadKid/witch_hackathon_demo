"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { fetchAddressTips } from "../services/api";
import { AddressTip } from "../types";

interface AddressInputProps {
  value: string;
  onChange: (value: string, city?: string) => void;
  onRemove: () => void;
  placeholder?: string;
  preferredCity?: string; // 优先推荐的城市（用于高德 inputtips API）
}

export default function AddressInput({
  value,
  onChange,
  onRemove,
  placeholder = "输入好友地址",
  preferredCity,
}: AddressInputProps) {
  const [tips, setTips] = useState<AddressTip[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  // 防抖搜索
  const debouncedSearch = useCallback((keywords: string) => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    if (!keywords || keywords.trim().length < 2) {
      setTips([]);
      setIsOpen(false);
      return;
    }

    setIsLoading(true);

    debounceTimer.current = setTimeout(async () => {
      // 传入 preferredCity 以优先推荐同区域地址
      const results = await fetchAddressTips(keywords, preferredCity);
      setTips(results);
      setIsOpen(results.length > 0);
      setIsLoading(false);
      setHighlightIndex(-1);
    }, 300);
  }, [preferredCity]);

  // 输入变化处理
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    onChange(newValue);
    debouncedSearch(newValue);
  };

  // 选择地址
  const handleSelectTip = (tip: AddressTip) => {
    const fullAddress = tip.address 
      ? `${tip.district}${tip.name}` 
      : tip.name;
    // 同时传回 city 信息，用于其他输入框的区域优先推荐
    onChange(fullAddress, tip.city);
    setIsOpen(false);
    setTips([]);
    inputRef.current?.blur();
  };

  // 键盘导航
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || tips.length === 0) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightIndex((prev) => (prev < tips.length - 1 ? prev + 1 : 0));
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightIndex((prev) => (prev > 0 ? prev - 1 : tips.length - 1));
        break;
      case "Enter":
        e.preventDefault();
        if (highlightIndex >= 0 && highlightIndex < tips.length) {
          handleSelectTip(tips[highlightIndex]);
        }
        break;
      case "Escape":
        setIsOpen(false);
        break;
    }
  };

  // 点击外部关闭
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // 清理定时器
  useEffect(() => {
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, []);

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="flex items-center gap-2 md:gap-4 bg-white p-2 md:p-4 neo-pill neo-border neo-shadow transition-transform focus-within:-translate-y-1">
        <input
          ref={inputRef}
          className="flex-1 bg-transparent py-1 md:py-2 px-2 md:px-4 text-base md:text-xl font-bold placeholder:text-gray-400 outline-none"
          placeholder={placeholder}
          value={value}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (tips.length > 0) setIsOpen(true);
          }}
          autoComplete="off"
        />

        {isLoading ? (
          <div className="w-7 h-7 md:w-10 md:h-10 flex items-center justify-center mr-1">
            <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <button
            onClick={onRemove}
            className="w-7 h-7 md:w-10 md:h-10 bg-red-400 rounded-full neo-border flex items-center justify-center text-white font-black active:scale-90 mr-1"
          >
            ✕
          </button>
        )}
      </div>

      {/* 下拉推荐列表 */}
      {isOpen && tips.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white neo-border neo-shadow z-50 max-h-60 overflow-y-auto">
          {tips.map((tip, index) => (
            <button
              key={`tip-${index}-${tip.id || tip.name}`}
              onClick={() => handleSelectTip(tip)}
              className={`w-full text-left px-4 py-3 border-b-2 border-black last:border-b-0 transition-colors ${
                index === highlightIndex
                  ? "bg-[#B2E4FF]"
                  : "hover:bg-gray-100"
              }`}
            >
              <div className="font-bold text-black text-sm md:text-base truncate">
                {tip.name}
              </div>
              <div className="text-xs md:text-sm text-gray-500 truncate">
                {tip.district}{tip.address && tip.address !== tip.district ? ` · ${tip.address}` : ""}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

