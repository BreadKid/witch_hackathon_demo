"use client";
import { useState } from "react";
import dynamic from "next/dynamic"; // 1. 引入 dynamic
import { getCurrentLocation } from "../utils/amapHelper";
import { fetchMeetingPoint } from "../services/api";

// 2. 动态加载地图组件，强制关闭 SSR
const MapView = dynamic(
    () => import("../components/MapView").then((mod) => mod.default), // 👈 加上这句！
    {
      ssr: false,
      loading: () => <p>地图加载中...</p>,
    }
  );

export default function Home() {
  const [inputs, setInputs] = useState(["", "", ""]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ lat: number; lng: number; name: string } | null>(null);

  const handleInputChange = (index: number, value: string) => {
    const newInputs = [...inputs];
    newInputs[index] = value;
    setInputs(newInputs);
  };

  const handleLocateMe = async () => {
    try {
      handleInputChange(0, "正在定位...");
      const loc = await getCurrentLocation();
      handleInputChange(0, loc.address);
    } catch (err: any) {
      alert(err);
      handleInputChange(0, "");
    }
  };

  const handleSearch = async () => {
    if (inputs.some((addr) => !addr.trim())) {
      alert("请把三个地址都填上哦！");
      return;
    }
    setLoading(true);
    
    const data = await fetchMeetingPoint({
      user_locations: inputs,
      preference_type: "麦当劳"
    });

    if (data) {
      setResult({
        lat: data.latitude,
        lng: data.longitude,
        name: data.shop_name
      });
    }
    setLoading(false);
  };

  return (
    <main className="flex h-screen flex-col md:flex-row bg-gray-50">
      <div className="w-full md:w-1/3 p-6 flex flex-col gap-4 shadow-lg z-10 bg-white">
        <h1 className="text-2xl font-bold text-blue-600">🍔 聚会地点查找器</h1>
        
        <div className="flex gap-2">
          <input
            className="border p-3 rounded flex-1 focus:outline-blue-500"
            placeholder="朋友A (点击定位)"
            value={inputs[0]|| ""}
            onChange={(e) => handleInputChange(0, e.target.value)}
          />
          <button onClick={handleLocateMe} className="bg-gray-100 px-3 rounded text-xl">🧭</button>
        </div>

        <input
          className="border p-3 rounded focus:outline-blue-500"
          placeholder="朋友B的位置"
          value={inputs[1]|| ""}
          onChange={(e) => handleInputChange(1, e.target.value)}
        />
        
        <input
          className="border p-3 rounded focus:outline-blue-500"
          placeholder="朋友C的位置"
          value={inputs[2]|| ""}
          onChange={(e) => handleInputChange(2, e.target.value)}
        />

        <button
          onClick={handleSearch}
          disabled={loading}
          className={`p-4 rounded text-white font-bold transition-all ${
            loading ? "bg-gray-400" : "bg-blue-600 hover:bg-blue-700"
          }`}
        >
          {loading ? "AI 计算中..." : "🚀 开始查找"}
        </button>

        {result && (
          <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded text-green-800">
            <p className="font-bold">✅ 已找到：</p>
            <p className="text-lg">{result.name}</p>
          </div>
        )}
      </div>

      <div className="flex-1 relative">
        <MapView targetLocation={result} />
      </div>
    </main>
  );
}