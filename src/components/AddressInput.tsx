"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
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
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const inputWrapperRef = useRef<HTMLDivElement>(null);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  // 计算下拉列表位置（使用 fixed 定位避免被 overflow 裁剪）
  const updateDropdownPosition = useCallback(() => {
    if (!inputWrapperRef.current) return;
    const rect = inputWrapperRef.current.getBoundingClientRect();
    const viewport = window.visualViewport;
    const viewportHeight = viewport?.height ?? window.innerHeight;
    const viewportOffsetTop = viewport?.offsetTop ?? 0;
    const viewportOffsetLeft = viewport?.offsetLeft ?? 0;
    const isMobile = window.innerWidth < 768;
    
    if (isMobile) {
      // 移动端：向上弹出
      setDropdownStyle({
        position: 'fixed',
        bottom: viewportHeight + viewportOffsetTop - rect.top + 8,
        left: rect.left + viewportOffsetLeft,
        width: rect.width,
        maxHeight: '40vh',
      });
    } else {
      // 桌面端：向下弹出
      setDropdownStyle({
        position: 'fixed',
        top: rect.bottom + 8 + viewportOffsetTop,
        left: rect.left + viewportOffsetLeft,
        width: rect.width,
        maxHeight: 240,
      });
    }
  }, []);

  // 防抖搜索
  const debouncedSearch = useCallback((keywords: string) => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    if (!keywords || keywords.trim().length < 2) {
      setTips([]);
      setIsOpen(false);
      setIsLoading(false); // 确保清空输入时重置 loading 状态
      return;
    }

    setIsLoading(true);

    debounceTimer.current = setTimeout(async () => {
      try {
        // 传入 preferredCity 以优先推荐同区域地址
        const results = await fetchAddressTips(keywords, preferredCity);
        setTips(results);
        setIsOpen(results.length > 0);
      } catch (error) {
        console.error("地址搜索失败:", error);
        setTips([]);
        setIsOpen(false);
      } finally {
        // 确保无论成功还是失败都会重置 loading 状态
        setIsLoading(false);
        setHighlightIndex(-1);
      }
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

  // 点击/触摸外部关闭（移动端兼容）
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      // 在 setTimeout 之前捕获 target，避免事件对象被回收后引用失效
      const target = e.target as Node;
      // 使用 requestAnimationFrame 确保在 DOM 更新后检查
      requestAnimationFrame(() => {
        if (containerRef.current && !containerRef.current.contains(target)) {
          setIsOpen(false);
        }
      });
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside, { passive: true });
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, []);

  // 清理定时器
  useEffect(() => {
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, []);

  // 更新下拉列表位置
  useEffect(() => {
    if (isOpen && tips.length > 0) {
      updateDropdownPosition();
      // 监听滚动和窗口变化以更新位置
      const handleUpdate = () => updateDropdownPosition();
      window.addEventListener('scroll', handleUpdate, true);
      window.addEventListener('resize', handleUpdate);
      window.visualViewport?.addEventListener('resize', handleUpdate);
      window.visualViewport?.addEventListener('scroll', handleUpdate);
      return () => {
        window.removeEventListener('scroll', handleUpdate, true);
        window.removeEventListener('resize', handleUpdate);
        window.visualViewport?.removeEventListener('resize', handleUpdate);
        window.visualViewport?.removeEventListener('scroll', handleUpdate);
      };
    }
  }, [isOpen, tips.length, updateDropdownPosition]);

  return (
    <div ref={containerRef} className="relative w-full">
      <div ref={inputWrapperRef} className="flex items-center gap-2 md:gap-4 bg-white p-2 md:p-4 neo-pill neo-border neo-shadow transition-transform focus-within:-translate-y-1">
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

      {/* 下拉推荐列表 - 使用 Portal 渲染到 body 避免被 overflow 裁剪 */}
      {isOpen && tips.length > 0 && typeof document !== 'undefined' && createPortal(
        <div 
          className="bg-white neo-border neo-shadow z-[9999] overflow-y-auto"
          style={dropdownStyle}
        >
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
        </div>,
        document.body
      )}
    </div>
  );
}

