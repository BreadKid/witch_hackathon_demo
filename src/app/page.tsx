"use client";
import { useState } from "react";
import dynamic from "next/dynamic";
import { getCurrentLocation } from "../utils/amapHelper";
import { fetchMeetingPoint } from "../services/api";
import { SearchResponse } from "../types";

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

const toChineseNum = (num: number) => {
  const chineseNums = ["零", "一", "二", "三", "四", "五", "六", "七", "八", "九", "十"];
  return chineseNums[num] || num;
};

const PREFERENCE_OPTIONS = ["咖啡厅", "公园", "图书馆", "自定义"];

export default function Home() {
  const [inputs, setInputs] = useState<string[]>(["", ""]);
  const [results, setResults] = useState<SearchResponse[]>([]);
  const [isLocating, setIsLocating] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedType, setSelectedType] = useState("咖啡厅");
  const [customType, setCustomType] = useState("");
  const [showAllResults, setShowAllResults] = useState(false);

  const getLabel = (index: number) => {
    if (index === 0) return "碰面主理人"; 
    return `好友${toChineseNum(index)}号`;
  };

  const handleInputChange = (index: number, value: string) => {
    const newInputs = [...inputs];
    newInputs[index] = value;
    setInputs(newInputs);
  };

  const handleAddUser = () => {
    setInputs([...inputs, ""]);
  };

  const handleRemoveUser = (indexToRemove: number) => {
    if (inputs.length <= 2) {
      alert("至少需要两个人哦！");
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
    } catch (error: any) {
      alert(error.message || error);
    } finally {
      setIsLocating(false);
    }
  };

  // ✨ 新增：复制功能
  const handleCopy = (text: string) => {
    if (!text) return;
    // 使用 Clipboard API 写入剪贴板
    navigator.clipboard.writeText(text).then(() => {
      // 按照你的要求提示
      alert("已粘贴，快去分享给你的好朋友吧～");
    }).catch((err) => {
      console.error("复制失败:", err);
      // 降级处理：有些浏览器可能需要HTTPS才能使用clipboard
      alert("复制失败，请长按店名手动复制");
    });
  };

  const handleSearch = async () => {
    const validLocations = inputs.filter((i) => i.trim() !== "");
    if (validLocations.length < 2) {
      alert("请至少输入两个地址！");
      return;
    }

    let finalPreference = selectedType;
    if (selectedType === "自定义") {
      if (!customType.trim()) {
        alert("请输入场所类型");
        return;
      }
      finalPreference = customType.trim();
    }

    setIsSearching(true);
    setResults([]);

    const statusValue = showAllResults ? 0 : 1;

    try {
      const data = await fetchMeetingPoint({
        user_locations: validLocations,
        preference_type: finalPreference,
        num: statusValue, 
      });

      if (data && data.length > 0) {
        setResults(data);
        setTimeout(() => {
          document.getElementById('result-section')?.scrollIntoView({ behavior: 'smooth' });
        }, 300);
      } else {
        alert("未找到合适地点");
      }
    } catch (error) {
      console.error("查找失败:", error);
      alert("查找失败，请稍后重试");
    } finally {
      setIsSearching(false);
    }
  };

  const displayResults = showAllResults ? results : results.slice(0, 1);

  return (
    <main className="relative h-[100dvh] w-full overflow-hidden bg-gray-100 flex flex-col md:flex-row">
      
      {/* --- 地图区域 --- */}
      <div className="absolute top-0 left-0 w-full h-[45%] z-0 md:relative md:h-full md:flex-1 md:order-2">
        <MapView locations={displayResults} />
        <div className="md:hidden absolute top-0 left-0 w-full h-20 bg-gradient-to-b from-white/80 to-transparent pointer-events-none z-10" />
      </div>

      {/* --- 操作面板 --- */}
      <div className="
        absolute bottom-0 left-0 w-full h-[60%] z-10 
        bg-white rounded-t-[2rem] shadow-[0_-10px_40px_rgba(0,0,0,0.1)]
        flex flex-col
        md:relative md:h-full md:w-[400px] md:max-w-md md:rounded-none md:shadow-2xl md:z-20 md:order-1
      ">
        <div className="w-full flex justify-center pt-3 pb-1 md:hidden">
          <div className="w-12 h-1.5 bg-gray-300 rounded-full" />
        </div>

        <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-5 pb-20 md:pb-8 scroll-smooth">
          
          <h1 className="text-2xl md:text-3xl font-extrabold text-blue-600 flex items-center gap-2">
            <span>🍔</span> 聚会地点查找器
          </h1>

          <div className="flex flex-col gap-3">
            {inputs.map((addr, index) => {
              const label = getLabel(index);
              const isOrganizer = index === 0;

              return (
                <div key={index} className="flex gap-2 group items-center">
                  <div className="relative flex-1">
                    <input
                      className="w-full border border-gray-200 bg-gray-50 p-3 pl-4 rounded-xl text-sm md:text-base focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all outline-none"
                      placeholder={`${label}位置`}
                      value={addr}
                      onChange={(e) => handleInputChange(index, e.target.value)}
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-medium pointer-events-none">
                      {isOrganizer ? "我" : `#${index}`}
                    </div>
                  </div>

                  {isOrganizer ? (
                    <button
                      onClick={handleLocate}
                      disabled={isLocating}
                      className="bg-blue-50 text-blue-600 p-3 rounded-xl aspect-square flex items-center justify-center active:scale-95 transition-transform"
                    >
                      {isLocating ? <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"/> : "🧭"}
                    </button>
                  ) : (
                    <button 
                      onClick={() => handleRemoveUser(index)} 
                      className="bg-red-50 text-red-500 p-3 rounded-xl aspect-square flex items-center justify-center active:scale-95 transition-transform"
                    >
                      ✕
                    </button>
                  )}
                </div>
              );
            })}
            
            <button 
              onClick={handleAddUser} 
              className="text-sm text-gray-500 font-medium flex items-center justify-center gap-1 py-2 hover:text-blue-500 transition-colors"
            >
              <span>+</span> 添加一位好友
            </button>
          </div>

          <div>
            <p className="text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">聚会类型</p>
            <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
              {PREFERENCE_OPTIONS.map((option) => (
                <button
                  key={option}
                  onClick={() => setSelectedType(option)}
                  className={`whitespace-nowrap px-4 py-2 rounded-lg text-sm font-bold border transition-all ${
                    selectedType === option 
                      ? "bg-blue-600 text-white border-blue-600 shadow-md transform scale-105" 
                      : "bg-white text-gray-600 border-gray-200"
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
            {selectedType === "自定义" && (
              <input 
                className="mt-3 w-full border border-blue-200 bg-blue-50/50 p-3 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" 
                placeholder="例如：火锅、KTV" 
                value={customType} 
                onChange={(e) => setCustomType(e.target.value)} 
              />
            )}
          </div>

          <div>
            <button 
              onClick={handleSearch} 
              disabled={isSearching} 
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-4 rounded-xl font-bold text-lg shadow-lg shadow-blue-200 active:scale-95 transition-all flex justify-center items-center"
            >
              {isSearching ? "正在计算最佳地点..." : "🚀 开始查找"}
            </button>

            <div className="mt-3 flex items-center justify-center gap-2">
              <input 
                type="checkbox" 
                id="showAllResults" 
                checked={showAllResults}
                onChange={(e) => setShowAllResults(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
              />
              <label htmlFor="showAllResults" className="text-sm text-gray-500 select-none cursor-pointer">
                显示更多备选方案（不仅仅是折中地点）
              </label>
            </div>
          </div>

          {/* --- 结果显示区域 --- */}
          {displayResults.length > 0 && (
            <div id="result-section" className="flex flex-col gap-6 pt-4">
              <div className="flex items-center gap-2">
                <span className="w-1 h-6 bg-green-500 rounded-full"/>
                <h3 className="font-bold text-gray-800 text-lg">
                   {showAllResults ? "所有方案" : "最佳折中方案"}
                </h3>
              </div>
              
              {displayResults.map((item, i) => {
                const isFairRecommendation = i === 0;
                
                return (
                  <div key={i} className={`bg-white border rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow ${isFairRecommendation ? 'border-blue-200 ring-4 ring-blue-50/50' : 'border-gray-100'}`}>
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex-1">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded mb-1 inline-block ${
                          isFairRecommendation 
                            ? "bg-blue-600 text-white" 
                            : "bg-gray-100 text-gray-500"
                        }`}>
                          {isFairRecommendation ? "⚖️ 公平推荐" : `备选方案 ${i+1}`}
                        </span>
                        
                        <h4 className="text-xl font-bold text-gray-900 mt-1">{item.shop_name}</h4>
                        <p className="text-xs text-gray-500 mt-1 truncate max-w-[200px]">{item.address}</p>
                      </div>

                      {/* ✨ 新增：右上角的粘贴(复制)按钮 */}
                      <button
                        onClick={() => handleCopy(item.shop_name)}
                        className="ml-2 p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all active:scale-95 flex flex-col items-center gap-1 group"
                        title="复制店名分享"
                      >
                         {/* 复制图标 SVG */}
                         <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                           <path strokeLinecap="round" strokeLinejoin="round" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                         </svg>
                         <span className="text-[10px] font-medium opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                           分享
                         </span>
                      </button>
                    </div>
                    
                    <div className="space-y-2">
                      {inputs.map((addr, idx) => {
                        if (!addr.trim()) return null;
                        
                        const detail = item.time_details?.find(t => t.location === addr);
                        const duration = detail ? detail.duration : "计算中...";
                        const isFastest = detail?.tag === true;

                        return (
                          <div key={idx} className="flex justify-between items-center text-sm border-b border-dashed border-gray-100 last:border-0 pb-2 last:pb-0">
                            <span className="text-gray-500">{idx === 0 ? "我" : `${idx}号`}</span>
                            
                            <div className="flex items-center gap-2">
                              {isFastest && (
                                <div className="bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded flex items-center gap-1 font-bold">
                                  最快 🚀
                                </div>
                              )}
                              <span className={`font-bold text-lg ${isFastest ? 'text-green-600' : 'text-gray-700'}`}>
                                {duration}
                              </span>
                            </div>
                          </div>
                        )
                      })}
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