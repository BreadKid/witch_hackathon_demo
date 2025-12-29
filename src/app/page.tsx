"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import dynamic from "next/dynamic";
import { getCurrentLocation } from "../utils/amapHelper";
import { fetchMeetingPoint, fetchAddressTips } from "../services/api";
import { SearchResponse, AddressTip } from "../types";
import LoadingOverlay from "../components/LoadingOverlay";
import AddressInput from "../components/AddressInput";

const MapView = dynamic(
  () => import("../components/MapView").then((mod) => mod.default),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full flex items-center justify-center bg-gray-100 text-gray-500">
        <p>地图加载中...</p>
      </div>
    ),
  }
);

const MAX_USERS = 5;

const PREFERENCE_OPTIONS = [
  { label: "公园", icon: "🌳" },
  { label: "图书馆", icon: "📚" },
  { label: "其他", icon: "➕" },
];

export default function Home() {
  const [inputs, setInputs] = useState<string[]>(["", ""]);
  const [results, setResults] = useState<SearchResponse[]>([]);
  const [isLocating, setIsLocating] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedType, setSelectedType] = useState("公园");
  const [customType, setCustomType] = useState("");
  const [compareMode, setCompareMode] = useState(false);
  const [displayCompareMode, setDisplayCompareMode] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  // 存储"朋友1/我"的城市信息，用于其他输入框的地址推荐优先级
  const [primaryCity, setPrimaryCity] = useState<string>("");
  
  // 第一个输入框的地址建议状态
  const [primaryTips, setPrimaryTips] = useState<AddressTip[]>([]);
  const [primaryTipsOpen, setPrimaryTipsOpen] = useState(false);
  const [primarySearching, setPrimarySearching] = useState(false);
  const [primaryDropdownStyle, setPrimaryDropdownStyle] = useState<React.CSSProperties>({});
  const primaryDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const primaryInputContainerRef = useRef<HTMLDivElement>(null);
  const primaryInputWrapperRef = useRef<HTMLDivElement>(null);

  // 计算第一个输入框下拉列表位置
  const updatePrimaryDropdownPosition = useCallback(() => {
    if (!primaryInputWrapperRef.current) return;
    const rect = primaryInputWrapperRef.current.getBoundingClientRect();
    const viewport = window.visualViewport;
    const viewportHeight = viewport?.height ?? window.innerHeight;
    const viewportOffsetTop = viewport?.offsetTop ?? 0;
    const viewportOffsetLeft = viewport?.offsetLeft ?? 0;
    const isMobileView = window.innerWidth < 768;
    
    if (isMobileView) {
      // 移动端：向上弹出
      setPrimaryDropdownStyle({
        position: 'fixed',
        bottom: viewportHeight + viewportOffsetTop - rect.top + 8,
        left: rect.left + viewportOffsetLeft,
        width: rect.width,
        maxHeight: '40vh',
      });
    } else {
      // 桌面端：向下弹出
      setPrimaryDropdownStyle({
        position: 'fixed',
        top: rect.bottom + 8 + viewportOffsetTop,
        left: rect.left + viewportOffsetLeft,
        width: rect.width,
        maxHeight: 240,
      });
    }
  }, []);

  // Mobile Bottom Sheet Dragging State
  const [panelHeight, setPanelHeight] = useState(60);
  const [isDragging, setIsDragging] = useState(false);
  const startY = useRef(0);
  const startHeight = useRef(60);

  const handleTouchStart = (e: React.TouchEvent) => {
    startY.current = e.touches[0].clientY;
    startHeight.current = panelHeight;
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    const currentY = e.touches[0].clientY;
    const deltaY = startY.current - currentY;
    // Calculate new height in vh (viewport height)
    const deltaHeight = (deltaY / window.innerHeight) * 100;
    let newHeight = startHeight.current + deltaHeight;
    
    // Constraints
    if (newHeight < 15) newHeight = 15;
    if (newHeight > 70) newHeight = 70;
    
    setPanelHeight(newHeight);
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    // Snap points: 70, 60, 15
    if (panelHeight > 65) {
      setPanelHeight(70);
    } else if (panelHeight < 40) {
      setPanelHeight(15);
    } else {
      setPanelHeight(60);
    }
  };

  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const getLabel = (index: number) => {
    if (index === 0) return "我/好朋友#1"; 
    return `好朋友#${index + 1}`;
  };

  const handleInputChange = (index: number, value: string, city?: string) => {
    const newInputs = [...inputs];
    newInputs[index] = value;
    setInputs(newInputs);
    
    // 如果是第一个输入框且有城市信息，更新 primaryCity
    if (index === 0 && city) {
      setPrimaryCity(city);
    }
  };

  // 第一个输入框的地址搜索（防抖）
  const handlePrimaryInputSearch = useCallback((keywords: string) => {
    if (primaryDebounceRef.current) {
      clearTimeout(primaryDebounceRef.current);
    }

    if (!keywords || keywords.trim().length < 2) {
      setPrimaryTips([]);
      setPrimaryTipsOpen(false);
      setPrimarySearching(false); // 确保清空输入时重置 loading 状态
      return;
    }

    setPrimarySearching(true);

    primaryDebounceRef.current = setTimeout(async () => {
      try {
        const results = await fetchAddressTips(keywords);
        setPrimaryTips(results);
        setPrimaryTipsOpen(results.length > 0);
      } catch (error) {
        console.error("地址搜索失败:", error);
        setPrimaryTips([]);
        setPrimaryTipsOpen(false);
      } finally {
        // 确保无论成功还是失败都会重置 loading 状态
        setPrimarySearching(false);
      }
    }, 300);
  }, []);

  // 选择第一个输入框的地址建议
  const handleSelectPrimaryTip = (tip: AddressTip) => {
    const fullAddress = tip.address 
      ? `${tip.district}${tip.name}` 
      : tip.name;
    handleInputChange(0, fullAddress);
    // 同时更新城市信息
    if (tip.city) {
      setPrimaryCity(tip.city);
    }
    setPrimaryTipsOpen(false);
    setPrimaryTips([]);
  };

  // 第一个输入框输入变化
  const handlePrimaryInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    handleInputChange(0, newValue);
    handlePrimaryInputSearch(newValue);
  };

  // 点击/触摸外部关闭第一个输入框的建议列表（移动端兼容）
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      // 在 requestAnimationFrame 之前捕获 target，避免事件对象被回收后引用失效
      const target = e.target as Node;
      // 使用 requestAnimationFrame 确保在 DOM 更新后检查
      requestAnimationFrame(() => {
        if (primaryInputContainerRef.current && !primaryInputContainerRef.current.contains(target)) {
          setPrimaryTipsOpen(false);
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

  // 清理防抖定时器
  useEffect(() => {
    return () => {
      if (primaryDebounceRef.current) {
        clearTimeout(primaryDebounceRef.current);
      }
    };
  }, []);

  // 更新第一个输入框下拉列表位置
  useEffect(() => {
    if (primaryTipsOpen && primaryTips.length > 0) {
      updatePrimaryDropdownPosition();
      const handleUpdate = () => updatePrimaryDropdownPosition();
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
  }, [primaryTipsOpen, primaryTips.length, updatePrimaryDropdownPosition]);

  const handleAddUser = () => {
    if (inputs.length >= MAX_USERS) {
      showToast(`最多只能添加${MAX_USERS}位用户哦！`, "error");
      return;
    }
    setInputs([...inputs, ""]);
  };

  const handleRemoveUser = (indexToRemove: number) => {
    if (inputs.length <= 2) {
      showToast("谁也不见的话咱碰谁的头！", "error");
      return;
    }
    const newInputs = inputs.filter((_, index) => index !== indexToRemove);
    setInputs(newInputs);
  };

  const handleLocate = async () => {
    setIsLocating(true);
    try {
      const location = await getCurrentLocation();
      handleInputChange(0, location.address);
      // 更新城市信息，用于其他输入框的地址推荐
      if (location.city) {
        setPrimaryCity(location.city);
      }
      showToast("定位成功");
    } catch (error: any) {
      showToast(error.message || error, "error");
    } finally {
      setIsLocating(false);
    }
  };

  const handleCopy = (shopName: string, address: string) => {
    const clipboardText = [shopName.trim(), address.trim()].filter(Boolean).join(" ");
    if (!clipboardText) return;
    navigator.clipboard.writeText(clipboardText).then(() => {
      showToast("地址已复制，快去发给好友吧～");
    }).catch(() => {
      showToast("复制失败，请尝试手动长按复制", "error");
    });
  };

  /**
   * 分享/导航功能逻辑：
   * 尝试唤起高德 App，若失败则跳转网页版
   * 使用 address 作为跳转依据
   */
  const handleShare = (address: string) => {
    const encodeAddr = encodeURIComponent(address);
    
    // 高德 App 协议 URL (尝试唤起 App 并搜索/导航)
    const appUrl = `amapuri://route/plan/?dname=${encodeAddr}&dev=0&m=0&t=0`;
    // 高德 网页版 URL (回退方案)
    const webUrl = `https://uri.amap.com/marker?p=,,${encodeAddr}&addr=${encodeAddr}&callnative=1`;

    const startTime = Date.now();
    
    // 尝试打开 App
    window.location.href = appUrl;

    // 定时器判断：如果在 2.5 秒内页面没有由于打开 App 而进入后台/隐藏，则认为打开失败，跳转网页版
    setTimeout(() => {
      const endTime = Date.now();
      // 如果时间间隔过长，说明浏览器可能弹出了"是否打开 App"的确认框，用户可能正在点击，所以稍作宽限
      if (endTime - startTime < 3000) {
        window.open(webUrl, '_blank');
      }
    }, 2500);
  };

  const handleSearch = async () => {
    const validLocations = inputs.filter((i) => i.trim() !== "");
    if (validLocations.length < 2) {
      showToast("请至少输入两个地址！", "error");
      return;
    }

    let finalPreference = selectedType;
    if (selectedType === "其他") {
      if (!customType.trim()) {
        showToast("请输入场所类型", "error");
        return;
      }
      finalPreference = customType.trim();
    }

    setIsSearching(true);
    setResults([]);
    const currentCompareMode = compareMode;
    setDisplayCompareMode(currentCompareMode);

    try {
      const data = await fetchMeetingPoint({
        user_locations: validLocations,
        preference_type: finalPreference,
        num: currentCompareMode ? 0 : 1, 
      });

      if (data && data.length > 0) {
        setResults(data);
        setTimeout(() => {
          document.getElementById('result-section')?.scrollIntoView({ behavior: 'smooth' });
        }, 300);
      } else {
        showToast("未找到合适地点", "error");
      }
    } catch (error) {
      showToast("查找失败，请稍后重试", "error");
    } finally {
      setIsSearching(false);
    }
  };

  const displayResults = displayCompareMode ? results : results.slice(0, 1);

  return (
    <main className="relative h-[100dvh] w-full overflow-hidden bg-[#FCE682] flex flex-col md:flex-row">
      {isSearching && <LoadingOverlay />}
      
      {/* Toast 提示 */}
      {toast && (
        <div className="fixed top-10 left-1/2 -translate-x-1/2 z-[200] animate-in fade-in slide-in-from-top-4 duration-300">
          <div className={`px-6 py-3 neo-border neo-shadow text-black text-sm font-black flex items-center gap-2 whitespace-nowrap ${
            toast.type === "success" ? "bg-green-400" : "bg-red-400"
          }`}>
            <span>{toast.type === "success" ? "✅" : "⚠️"}</span>
            {toast.message}
          </div>
        </div>
      )}
      
      {/* 地图区域 */}
      <div className="absolute top-0 left-0 w-full h-full z-0 md:relative md:flex-1 md:order-2">
        <MapView locations={displayResults} />
      </div>

      {/* 操作面板 */}
      <div 
        className={`absolute bottom-0 left-0 w-full z-10 bg-[#FCE682] rounded-t-[3rem] md:relative md:h-full md:w-[500px] md:max-w-xl md:rounded-none md:order-1 flex flex-col shadow-[10px_0_30px_rgba(0,0,0,0.1)] transition-all ${isDragging ? 'duration-0' : 'duration-300 ease-out'}`}
        style={isMobile ? { height: `${panelHeight}vh` } : {}}
      >
        {/* 背景装饰 */}
        <div className="absolute top-10 right-10 opacity-20 pointer-events-none">
          <svg width="120" height="120" viewBox="0 0 24 24" fill="currentColor" className="text-orange-400 rotate-12">
            <path d="M12 2l2.4 7.2h7.6l-6.1 4.4 2.3 7.4-6.2-4.5-6.2 4.5 2.3-7.4-6.1-4.4h7.6z" />
          </svg>
        </div>
        <div className="absolute bottom-40 -left-10 opacity-20 pointer-events-none">
          <div className="w-40 h-40 bg-green-300 rounded-full blur-3xl"></div>
        </div>

        <div 
          className="w-full flex justify-center pt-4 pb-2 md:hidden cursor-grab active:cursor-grabbing touch-none"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div className="w-16 h-2 bg-black/10 rounded-full" />
        </div>

        <div className="flex-1 overflow-y-auto p-5 md:p-12 space-y-6 md:space-y-10 pb-4 md:pb-32 scroll-smooth z-10 no-scrollbar">
          {/* 标题区域 */}
          <div className="space-y-3 md:space-y-6">
            <h1 className="text-4xl md:text-7xl font-black text-black italic tracking-tighter leading-none">
              碰头！
            </h1>
            <div className="relative inline-block">
              <div className="absolute inset-0 bg-[#FACC15] -rotate-2 neo-border"></div>
              <p className="relative text-xl md:text-4xl font-black text-black italic px-3 py-1.5 md:px-6 md:py-3 -rotate-2">
                别多想了 见面重要
              </p>
            </div>
          </div>

          {/* 输入框组 */}
          <div className="flex flex-col gap-4 md:gap-8">
            {inputs.map((addr, index) => (
              <div key={index} className="relative group flex flex-col gap-1 md:gap-2">
                <span className="text-xs md:text-base font-black text-black italic ml-6 uppercase tracking-wider">
                  {getLabel(index)}
                </span>
                {index === 0 ? (
                  <>
                    <div ref={primaryInputContainerRef} className="relative w-full">
                      <div ref={primaryInputWrapperRef} className="flex items-center gap-2 md:gap-4 bg-white p-2 md:p-4 neo-pill neo-border neo-shadow transition-transform group-focus-within:-translate-y-1">
                        <input
                          className="flex-1 bg-transparent py-1 md:py-2 px-2 md:px-4 text-base md:text-xl font-bold placeholder:text-gray-400 outline-none"
                          placeholder="输入地址或点击定位"
                          value={addr}
                          onChange={handlePrimaryInputChange}
                          onFocus={() => {
                            if (primaryTips.length > 0) setPrimaryTipsOpen(true);
                          }}
                          autoComplete="off"
                        />
                        {primarySearching ? (
                          <div className="w-9 h-9 md:w-12 md:h-12 flex items-center justify-center">
                            <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin"/>
                          </div>
                        ) : (
                          <button 
                            onClick={handleLocate} 
                            className="w-9 h-9 md:w-12 md:h-12 bg-gray-100 rounded-full neo-border flex items-center justify-center active:scale-90 transition-transform"
                          >
                            {isLocating ? (
                              <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin"/>
                            ) : (
                              <svg viewBox="0 0 24 24" className="w-5 h-5 md:w-7 md:h-7" fill="none" stroke="currentColor" strokeWidth="3">
                                <circle cx="12" cy="12" r="10" />
                                <path d="M12 2v4M12 18v4M2 12h4M18 12h4M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z" />
                              </svg>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                    {/* 第一个输入框的地址建议下拉列表 - 使用 Portal 渲染到 body 避免被 overflow 裁剪 */}
                    {primaryTipsOpen && primaryTips.length > 0 && typeof document !== 'undefined' && createPortal(
                      <div 
                        className="bg-white neo-border neo-shadow z-[9999] overflow-y-auto"
                        style={primaryDropdownStyle}
                      >
                        {primaryTips.map((tip, tipIndex) => (
                          <button
                            key={`primary-tip-${tipIndex}-${tip.id || tip.name}`}
                            onClick={() => handleSelectPrimaryTip(tip)}
                            className="w-full text-left px-4 py-3 border-b-2 border-black last:border-b-0 transition-colors hover:bg-gray-100"
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
                  </>
                ) : (
                  <AddressInput
                    value={addr}
                    onChange={(value, city) => handleInputChange(index, value, city)}
                    onRemove={() => handleRemoveUser(index)}
                    placeholder="输入好友地址"
                    preferredCity={primaryCity}
                  />
                )}
              </div>
            ))}

            {inputs.length < MAX_USERS && (
              <button 
                onClick={handleAddUser} 
                className="flex items-center gap-2 md:gap-4 px-3 md:px-6 py-1 group"
              >
                <div className="w-7 h-7 md:w-10 md:h-10 bg-black text-white rounded-full flex items-center justify-center font-black text-lg md:text-2xl neo-border group-hover:scale-110 transition-transform">+</div>
                <span className="text-base md:text-xl font-black text-black">添加一位好友</span>
              </button>
            )}
          </div>

          {/* 偏好选择 */}
          <div className="space-y-4 md:space-y-6">
            <div className="flex gap-4 md:gap-6 overflow-x-auto py-3 md:py-4 no-scrollbar">
              {PREFERENCE_OPTIONS.map((opt) => (
                <div key={opt.label} className="flex flex-col items-center gap-2 md:gap-4 shrink-0">
                  <button
                    onClick={() => setSelectedType(opt.label)}
                    className={`w-14 h-14 md:w-20 md:h-20 rounded-full flex items-center justify-center text-2xl md:text-4xl neo-border transition-all ${
                      selectedType === opt.label ? "bg-[#B2E4FF] -translate-y-1 md:-translate-y-2 neo-shadow" : "bg-white"
                    }`}
                  >
                    {opt.icon}
                  </button>
                  <span className="text-[10px] md:text-sm font-black bg-black text-white px-2 py-1 md:px-4 md:py-1.5 rounded-full">
                    {opt.label}
                  </span>
                </div>
              ))}
            </div>
            
            {selectedType === "其他" && (
              <div className="animate-in fade-in slide-in-from-top-1 duration-200">
                <input
                  className="w-full bg-white p-3 md:p-5 neo-border neo-shadow rounded-xl md:rounded-2xl text-base md:text-xl font-bold outline-none placeholder:text-gray-400"
                  placeholder="想去哪里？比如：火锅、电影院..."
                  value={customType}
                  onChange={(e) => setCustomType(e.target.value)}
                  autoFocus
                />
              </div>
            )}
          </div>

          {/* 搜索按钮 */}
          <div className="pt-2 md:pt-6 flex justify-center">
            <button 
              onClick={handleSearch} 
              disabled={isSearching} 
              className="px-10 md:px-16 py-4 md:py-6 bg-black text-white rounded-full font-black text-xl md:text-4xl neo-border neo-shadow active:translate-y-1 active:shadow-none transition-all uppercase italic whitespace-nowrap"
            >
              {isSearching ? "查找中..." : "寻找碰头地点！🚗"}
            </button>
          </div>

          {/* 对比模式复选框 */}
          <label className={`flex items-center justify-center gap-3 md:gap-4 select-none ${isSearching ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}>
            <div className="relative">
              <input
                type="checkbox"
                checked={compareMode}
                onChange={(e) => setCompareMode(e.target.checked)}
                disabled={isSearching}
                className="peer sr-only"
              />
              <div className="w-5 h-5 md:w-8 md:h-8 bg-white neo-border neo-shadow peer-checked:bg-blue-400 transition-colors"></div>
              {compareMode && <div className="absolute inset-0 flex items-center justify-center text-black font-black text-base md:text-xl">✓</div>}
            </div>
            <span className="text-base md:text-xl font-black text-black italic">查找时进入对比模式</span>
          </label>

          {/* 结果展示 */}
          {displayResults.length > 0 && (
            <div id="result-section" className="flex flex-col gap-6 pt-10 pb-20">
              {displayResults.map((item, i) => {
                const favoredFriends = item.time_details
                  ?.map((detail, idx) => (detail.tag ? getLabel(idx) : null))
                  .filter(Boolean) as string[];

                const favorLabel = favoredFriends.length === 1 
                  ? `✨ 善待${favoredFriends[0]}` 
                  : favoredFriends.length > 1 
                    ? "🌈 善待多人" 
                    : null;

                return (
                  <div key={i} className="bg-white neo-border neo-shadow p-6 space-y-4">
                    <div className="flex justify-between items-start">
                      <div className="flex-1 space-y-2">
                        {/* 方案标签组 */}
                        <div className="flex gap-2 flex-wrap items-center">
                          {i === 0 && (
                            <span className="text-xs bg-black text-white px-3 py-1 font-black italic uppercase">⚖️ 公平方案</span>
                          )}
                          {favorLabel && (
                            <span className="text-xs bg-green-600 text-white px-3 py-1 font-black">{favorLabel}</span>
                          )}
                        </div>
                        <h4 className="text-2xl font-black text-black leading-tight">{item.shop_name}</h4>
                        <p className="text-sm font-bold text-gray-500">{item.address}</p>
                      </div>

                      <div className="flex gap-2 shrink-0">
                        {/* 导航按钮 */}
                        <button
                          onClick={() => handleShare(item.address)}
                          className="w-12 h-12 bg-white neo-border neo-shadow flex items-center justify-center hover:bg-green-100 transition-colors"
                        >
                          <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                            <path d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                        </button>

                        {/* 复制按钮 */}
                        <button
                          onClick={() => handleCopy(item.shop_name, item.address)}
                          className="w-12 h-12 bg-white neo-border neo-shadow flex items-center justify-center hover:bg-blue-100 transition-colors"
                        >
                          <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                            <path d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
                          </svg>
                        </button>
                      </div>
                    </div>
                    
                    <div className="space-y-3 bg-gray-50 p-4 neo-border">
                      {item.time_details?.map((detail, idx) => (
                        <div key={idx} className="flex justify-between items-center text-base">
                          <span className="font-black text-black italic">{getLabel(idx)}</span>
                          <span className={`font-black text-lg ${detail.tag ? 'text-green-600' : 'text-black'}`}>{detail.duration}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
