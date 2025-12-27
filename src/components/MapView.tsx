"use client";
import { useEffect, useRef } from "react";

// 高德地图安全密钥配置（必须在加载 AMap 之前设置）
const AMAP_KEY = "f0f8997e05bfa2dd95e546383cc44b90";
const AMAP_SECURITY_CODE = "71edc06ee1ffec6400bb7d170353a584";

interface MapViewProps {
  locations?: {
    latitude?: number;
    longitude?: number;
    lat?: number;
    lng?: number;
    shop_name?: string;
    address?: string;
  }[] | null;
}

export default function MapView({ locations }: MapViewProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null); // 地图实例
  const markersRef = useRef<any[]>([]);      // 所有的标记点实例

  // 1. 初始化地图
  useEffect(() => {
    const initMap = async () => {
      // ✨ 必须在加载高德地图之前配置安全密钥
      if (typeof window !== "undefined") {
        (window as any)._AMapSecurityConfig = {
          securityJsCode: AMAP_SECURITY_CODE,
        };
      }

      // 动态加载高德地图
      const loaderModule = await import("@amap/amap-jsapi-loader");
      const AMapLoader = loaderModule.default || loaderModule;

      try {
        const AMap = await AMapLoader.load({
          key: AMAP_KEY,
          version: "2.0",
          plugins: ["AMap.Scale", "AMap.ToolBar", "AMap.Marker"],
        });

        if (!mapContainerRef.current) return;

        // 创建地图
        const map = new AMap.Map(mapContainerRef.current, {
          zoom: 11,
          center: [121.4737, 31.2304], // 默认中心点
          viewMode: "2D",
        });

        map.addControl(new AMap.Scale());
        map.addControl(new AMap.ToolBar({ position: "RT" })); // 工具条放在右上角，避免被手机面板遮挡

        mapInstanceRef.current = map;
      } catch (e) {
        console.error("地图加载失败", e);
      }
    };

    if (!mapInstanceRef.current) {
      initMap();
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.destroy();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // 2. 监听数据变化，更新标记点并调整视野
  useEffect(() => {
    // 如果地图还没加载好，或者没有数据，就不做任何事
    if (!mapInstanceRef.current || !locations || locations.length === 0) return;

    const AMap = (window as any).AMap;
    if (!AMap) return;

    const map = mapInstanceRef.current;

    // --- A. 清除旧标记 ---
    map.remove(markersRef.current);
    markersRef.current = [];

    // --- B. 创建新标记 ---
    const newMarkers: any[] = [];

    locations.forEach((loc, index) => {
      // 兼容 lat/lng 和 latitude/longitude 写法
      const lat = loc.latitude ?? loc.lat;
      const lng = loc.longitude ?? loc.lng;

      // 安全检查：坐标必须是有效数字
      if (typeof lat !== 'number' || typeof lng !== 'number' || isNaN(lat) || isNaN(lng)) {
        return;
      }

      const marker = new AMap.Marker({
        position: [lng, lat],
        // 自定义标记内容：蓝色背景的数字序号
        content: `
          <div style="
            background-color: #2563eb; 
            color: white; 
            font-size: 14px; 
            font-weight: bold;
            width: 28px; 
            height: 28px; 
            border-radius: 50%; 
            display: flex; 
            align-items: center; 
            justify-content: center;
            border: 2px solid white;
            box-shadow: 0 2px 4px rgba(0,0,0,0.3);
          ">
            ${index + 1}
          </div>
        `,
        offset: new AMap.Pixel(-14, -14), // 居中偏移
        title: loc.shop_name || loc.address,
        extData: { index: index } // 绑定数据方便后续点击交互
      });

      newMarkers.push(marker);
    });

    // --- C. 添加标记到地图 ---
    if (newMarkers.length > 0) {
      map.add(newMarkers);
      markersRef.current = newMarkers;

      // --- D. 核心修复：自动调整视野 (SetFitView) ---
      // setFitView(overlays, immediately, [top, right, bottom, left])
      // 这里的 padding 很重要，防止点被手机的刘海或底部面板挡住
      map.setFitView(newMarkers, false, [60, 60, 60, 60]);
    }

  }, [locations]); // 只要 locations 变了，就会触发这段逻辑

  return (
    <div 
      ref={mapContainerRef} 
      className="w-full h-full min-h-[400px] bg-gray-50 rounded-xl overflow-hidden"
    />
  );
}