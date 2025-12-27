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

// 定义可选的地点类型
const PREFERENCE_OPTIONS = ["咖啡厅", "公园", "图书馆", "自定义"];

export default function Home() {
  const [inputs, setInputs] = useState<string[]>(["", ""]);
  const [result, setResult] = useState<SearchResponse | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  // ✨ 新增状态：记录用户选择的类型 (默认咖啡厅)
  const [selectedType, setSelectedType] = useState("咖啡厅");
  // ✨ 新增状态：记录自定义输入的内容
  const [customType, setCustomType] = useState("");

  const getLabel = (index: number) => {
    if (index === 0) return "好朋友碰面主理人";
    return `好朋友${toChineseNum(index)}号`;
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
      alert("聚会至少需要两个人哦！不能再删了。");
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

  const handleSearch = async () => {
    const validLocations = inputs.filter((i) => i.trim() !== "");
    if (validLocations.length < 2) {
      alert("请至少输入两个有效地址才能开始查找！");
      return;
    }

    // ✨ 核心逻辑：确定最终要传给后端的 preference_type
    let finalPreference = selectedType;
    
    // 如果选的是“自定义”，则使用用户填写的自定义内容
    if (selectedType === "自定义") {
      if (!customType.trim()) {
        alert("请填写您想去的具体场所类型（如：KTV、火锅店）");
        return;
      }
      finalPreference = customType.trim();
    }

    setIsSearching(true);
    setResult(null);

    try {
      console.log("开始查找，偏好类型:", finalPreference);
      
      const data = await fetchMeetingPoint({
        user_locations: validLocations,
        // ✨ 将用户选择的类型传给后端
        preference_type: finalPreference, 
      });

      if (data && data.length > 0) {
        setResult(data[0]);
      }
    } catch (error) {
      console.error("查找失败:", error);
      alert("查找失败，请稍后重试");
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <main className="flex flex-col md:flex-row h-screen">
      <div className="w-full md:w-1/3 p-8 flex flex-col gap-5 shadow-2xl z-10 bg-white/80 backdrop-blur-md border-r border-gray-200 overflow-y-auto">
        <h1 className="text-3xl font-extrabold text-blue-600 flex items-center gap-3">
          <span>🍔</span> 聚会地点查找器
        </h1>

        {/* --- 输入框列表 --- */}
        <div className="flex flex-col gap-3">
          {inputs.map((addr, index) => {
            const label = getLabel(index);
            const isOrganizer = index === 0;

            return (
              <div key={index} className="flex gap-2 group">
                <div className="relative flex-1">
                  <input
                    className="w-full border p-4 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white/50 text-gray-700 placeholder-gray-400 shadow-sm transition-all pr-10"
                    placeholder={`${label}的位置`}
                    value={addr}
                    onChange={(e) => handleInputChange(index, e.target.value)}
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-medium select-none pointer-events-none">
                    {isOrganizer ? "主理人" : `${index}号`}
                  </div>
                </div>

                {isOrganizer ? (
                  <button
                    onClick={handleLocate}
                    disabled={isLocating}
                    className="bg-gray-100 hover:bg-gray-200 text-gray-600 p-4 rounded-xl flex items-center justify-center disabled:opacity-50 shadow-sm transition-all active:scale-95 aspect-square shrink-0"
                    title="定位我的位置"
                  >
                    {isLocating ? (
                      <div className="animate-spin h-5 w-5 border-2 border-gray-500 border-t-transparent rounded-full"></div>
                    ) : (
                      <span className="text-xl">🧭</span>
                    )}
                  </button>
                ) : (
                  <button
                    onClick={() => handleRemoveUser(index)}
                    className="bg-red-50 hover:bg-red-100 text-red-500 p-4 rounded-xl flex items-center justify-center shadow-sm transition-all active:scale-95 aspect-square shrink-0 group-hover:opacity-100 opacity-60"
                    title="移除这位好友"
                  >
                    <span className="text-lg font-bold">✕</span>
                  </button>
                )}
              </div>
            );
          })}

          <button
            onClick={handleAddUser}
            className="mt-2 py-3 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 hover:border-blue-400 hover:text-blue-500 font-medium transition-all flex items-center justify-center gap-2 active:scale-95 bg-white/30"
          >
            <span>➕</span> 添加一位好友
          </button>
        </div>

        {/* --- ✨ 新增：聚会类型选择区域 --- */}
        <div className="mt-2">
          <p className="text-sm font-bold text-gray-500 mb-2 uppercase tracking-wider">想去哪里聚会？</p>
          <div className="flex gap-2 flex-wrap">
            {PREFERENCE_OPTIONS.map((option) => {
              const isActive = selectedType === option;
              return (
                <button
                  key={option}
                  onClick={() => setSelectedType(option)}
                  className={`px-4 py-2 rounded-lg text-sm font-bold transition-all shadow-sm border
                    ${
                      isActive
                        ? "bg-blue-600 text-white border-blue-600 ring-2 ring-blue-200"
                        : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50 hover:border-gray-300"
                    }`}
                >
                  {option}
                </button>
              );
            })}
          </div>

          {/* 如果选择了“自定义”，显示额外的输入框 */}
          {selectedType === "自定义" && (
            <div className="mt-3 animate-fade-in">
              <input
                className="w-full border p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-blue-50/50 text-gray-700 placeholder-gray-400 shadow-inner"
                placeholder="请输入具体类型 (例如: 奶茶店、网吧、KTV...)"
                value={customType}
                onChange={(e) => setCustomType(e.target.value)}
                autoFocus
              />
            </div>
          )}
        </div>

        {/* 查找按钮 */}
        <button
          onClick={handleSearch}
          disabled={isSearching}
          className="bg-gradient-to-r from-blue-500 to-blue-700 hover:from-blue-600 hover:to-blue-800 text-white p-4 rounded-xl font-bold text-lg shadow-md transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-70 mt-2"
        >
          {isSearching ? (
            <>
              <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></div>
              正在全力查找中...
            </>
          ) : (
            <>🚀 开始查找</>
          )}
        </button>

        {/* 结果展示 */}
        {result && (
          <div className="mt-2 flex flex-col gap-4">
            <div className="p-5 bg-green-50 border border-green-200 rounded-xl text-green-800 shadow-sm">
              <p className="font-bold text-lg mb-1 flex items-center gap-2">
                <span>✅</span> 已找到最佳地点：
              </p>
              <p className="text-2xl font-extrabold text-green-900">
                {result.shop_name}
              </p>
              <p className="text-sm text-green-700 mt-1 opacity-80">
                📍 {result.address}
              </p>
            </div>

            <div className="flex flex-col gap-3">
              {inputs.map((addr, index) => {
                if (!addr.trim()) return null;

                const time = result.time_info?.[addr] || "未知";
                const label = getLabel(index);

                return (
                  <div
                    key={index}
                    className="bg-[#F3E5D3] rounded-xl p-5 flex justify-between items-start shadow-sm"
                  >
                    <div className="flex flex-col gap-1">
                      <span className="font-bold text-gray-800 text-lg">
                        {label}。
                      </span>
                      <span className="text-gray-600 text-sm line-clamp-2" title={addr}>
                        {addr}
                      </span>
                    </div>
                    <div className="flex flex-col items-end shrink-0 ml-4">
                      <span className="text-gray-800 font-medium">花费时间</span>
                      <span className="text-xl font-bold text-gray-900 mt-1">
                        {time}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 relative min-h-[400px]">
        <MapView
          targetLocation={
            result
              ? { lat: result.latitude, lng: result.longitude, name: result.shop_name }
              : null
          }
        />
      </div>
    </main>
  );
}