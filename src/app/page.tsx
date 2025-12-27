"use client";
import { useState } from "react";
import dynamic from "next/dynamic";
import { getCurrentLocation } from "../utils/amapHelper";
import { fetchMeetingPoint } from "../services/api";
import { SearchResponse } from "../types";
import LoadingOverlay from "../components/LoadingOverlay";

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

const PREFERENCE_OPTIONS = ["咖啡厅", "公园", "图书馆", "其他"];

export default function Home() {
  const [inputs, setInputs] = useState<string[]>(["", ""]);
  const [results, setResults] = useState<SearchResponse[]>([]);
  const [isLocating, setIsLocating] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedType, setSelectedType] = useState("咖啡厅");
  const [customType, setCustomType] = useState("");
  const [compareMode, setCompareMode] = useState(false);
  const [displayCompareMode, setDisplayCompareMode] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const getLabel = (index: number) => {
    if (index === 0) return "我/好朋友#1"; 
    return `好朋友#${index + 1}`;
  };

  const handleInputChange = (index: number, value: string) => {
    const newInputs = [...inputs];
    newInputs[index] = value;
    setInputs(newInputs);
  };

  const handleAddUser = () => {
    if (inputs.length >= MAX_USERS) {
      showToast(`最多只能添加${MAX_USERS}位用户哦！`, "error");
      return;
    }
    setInputs([...inputs, ""]);
  };

  const handleRemoveUser = (indexToRemove: number) => {
    if (inputs.length <= 2) {
      showToast("至少需要两个人哦！", "error");
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
    <main className="relative h-[100dvh] w-full overflow-hidden bg-gray-100 flex flex-col md:flex-row">
      {isSearching && <LoadingOverlay />}
      
      {/* Toast 提示 */}
      {toast && (
        <div className="fixed top-10 left-1/2 -translate-x-1/2 z-[200] animate-in fade-in slide-in-from-top-4 duration-300">
          <div className={`px-6 py-3 rounded-full shadow-lg text-white text-sm font-bold flex items-center gap-2 ${
            toast.type === "success" ? "bg-green-500" : "bg-red-500"
          }`}>
            <span>{toast.type === "success" ? "✅" : "⚠️"}</span>
            {toast.message}
          </div>
        </div>
      )}
      
      {/* 地图区域 */}
      <div className="absolute top-0 left-0 w-full h-[45%] z-0 md:relative md:h-full md:flex-1 md:order-2">
        <MapView locations={displayResults} />
      </div>

      {/* 操作面板 */}
      <div className="absolute bottom-0 left-0 w-full h-[60%] z-10 bg-white rounded-t-[2rem] shadow-[0_-10px_40px_rgba(0,0,0,0.1)] flex flex-col md:relative md:h-full md:w-[400px] md:max-w-md md:rounded-none md:order-1">
        <div className="w-full flex justify-center pt-3 pb-1 md:hidden">
          <div className="w-12 h-1.5 bg-gray-300 rounded-full" />
        </div>

        <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-5 pb-20 scroll-smooth">
          <h1 className="text-2xl font-extrabold text-blue-600 flex items-center gap-2">
            <span>🍔</span> 聚会地点查找器
          </h1>

          {/* 输入框组 */}
          <div className="flex flex-col gap-3">
            {inputs.map((addr, index) => (
              <div key={index} className="flex flex-col gap-1">
                <span className="text-xs text-gray-500 ml-1">{getLabel(index)}</span>
                <div className="flex gap-2 items-center">
                  <div className="relative flex-1">
                    <input
                      className="w-full border border-gray-200 bg-gray-50 p-3 rounded-xl text-base outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-gray-400"
                      placeholder={index === 0 ? "点击右侧图标进行定位" : "输入好朋友地址"}
                      value={addr}
                      onChange={(e) => handleInputChange(index, e.target.value)}
                    />
                  </div>
                  {index === 0 ? (
                    <button onClick={handleLocate} className="bg-blue-50 text-blue-600 p-3 rounded-xl aspect-square flex items-center justify-center">
                      {isLocating ? <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"/> : "📍"}
                    </button>
                  ) : (
                    <button onClick={() => handleRemoveUser(index)} className="bg-red-50 text-red-500 p-3 rounded-xl aspect-square flex items-center justify-center">✕</button>
                  )}
                </div>
              </div>
            ))}
            {inputs.length < MAX_USERS && (
              <button onClick={handleAddUser} className="text-sm text-gray-500 py-2 hover:text-blue-500">+ 添加一位好友</button>
            )}
          </div>

          {/* 偏好选择 */}
          <div className="space-y-3">
            <div className="flex gap-2 overflow-x-auto no-scrollbar">
              {PREFERENCE_OPTIONS.map((option) => (
                <button
                  key={option}
                  onClick={() => setSelectedType(option)}
                  className={`px-4 py-2 rounded-lg text-sm font-bold border transition-all shrink-0 ${
                    selectedType === option ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-200"
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
            
            {selectedType === "其他" && (
              <div className="animate-in fade-in slide-in-from-top-1 duration-200">
                <input
                  className="w-full border border-gray-200 bg-gray-50 p-3 rounded-xl text-base outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-gray-400"
                  placeholder="想去哪里？比如：火锅、电影院、密室..."
                  value={customType}
                  onChange={(e) => setCustomType(e.target.value)}
                  autoFocus
                />
              </div>
            )}
          </div>

          {/* 搜索按钮 */}
          <button onClick={handleSearch} disabled={isSearching} className="w-full bg-blue-600 text-white p-4 rounded-xl font-bold text-lg active:scale-95 transition-all">
            {isSearching ? "查找中..." : "🚀 开始查找"}
          </button>

          {/* 对比模式复选框 */}
          <label className={`flex items-center gap-2 select-none ${isSearching ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}>
            <input
              type="checkbox"
              checked={compareMode}
              onChange={(e) => setCompareMode(e.target.checked)}
              disabled={isSearching}
              className={`w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 ${isSearching ? 'cursor-not-allowed' : 'cursor-pointer'}`}
            />
            <span className="text-sm text-gray-600">查找时进入对比模式</span>
          </label>

          {/* 结果展示 */}
          {displayResults.length > 0 && (
            <div id="result-section" className="flex flex-col gap-4 pt-4">
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
                  <div key={i} className="bg-white border border-blue-100 rounded-2xl p-5 shadow-sm ring-4 ring-blue-50/30">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex-1 overflow-hidden">
                        {/* 方案标签组 */}
                        <div className="flex gap-2 mb-1 items-center flex-wrap">
                          {i === 0 && (
                            <span className="text-[10px] bg-blue-600 text-white px-2 py-0.5 rounded uppercase font-bold shrink-0">⚖️ 公平方案</span>
                          )}
                          {favorLabel && (
                            <span className="text-[10px] bg-green-600 text-white px-2 py-0.5 rounded uppercase font-bold shrink-0">{favorLabel}</span>
                          )}
                        </div>
                        <h4 className="text-xl font-bold text-gray-900 mt-1 truncate">{item.shop_name}</h4>
                        <p className="text-xs text-gray-400 mt-1 truncate">{item.address}</p>
                      </div>

                      <div className="flex gap-1 ml-2">
                        {/* 分享按钮 (高德地图) */}
                        <button
                          onClick={() => handleShare(item.address)}
                          className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg flex flex-col items-center group transition-all"
                          title="高德导航"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          <span className="text-[9px] font-bold opacity-0 group-hover:opacity-100 transition-opacity">导航</span>
                        </button>

                        {/* 复制按钮 */}
                        <button
                          onClick={() => handleCopy(item.shop_name, item.address)}
                          className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg flex flex-col items-center group transition-all"
                          title="复制地址"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
                          </svg>
                          <span className="text-[9px] font-bold opacity-0 group-hover:opacity-100 transition-opacity">复制</span>
                        </button>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      {item.time_details?.map((detail, idx) => (
                        <div key={idx} className="flex justify-between items-center text-sm border-b border-gray-50 pb-2 last:border-0">
                          <span className="text-gray-500">{getLabel(idx)}</span>
                          {/* 当tag为true且不是第一个方案时，显示"最快"火箭标记 */}
                          {detail.tag && i !== 0 ? (
                            <div className="flex items-center gap-2">
                              <span className="inline-flex items-center gap-1 bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-xs font-bold">
                                最快 🚀
                              </span>
                              <span className="font-bold text-green-600">{detail.duration}</span>
                            </div>
                          ) : (
                            <span className={`font-bold ${detail.tag ? 'text-green-600' : 'text-gray-700'}`}>{detail.duration}</span>
                          )}
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
