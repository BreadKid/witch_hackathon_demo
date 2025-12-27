"use client";
import { useEffect, useRef } from "react";
import AMapLoader from "@amap/amap-jsapi-loader";

interface MapViewProps {
  targetLocation: { lat: number; lng: number; name: string } | null;
}

export default function MapView({ targetLocation }: MapViewProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const markerInstance = useRef<any>(null);

  useEffect(() => {
    // ⚠️ 安全密钥 (必须在加载前设置)
    (window as any)._AMapSecurityConfig = {
      securityJsCode: "71edc06ee1ffec6400bb7d170353a584", // ⚠️记得替换这里
    };

    AMapLoader.load({
      key: "f0f8997e05bfa2dd95e546383cc44b90", // ⚠️记得替换这里
      version: "2.0",
      plugins: ["AMap.Scale", "AMap.ToolBar"],
    })
      .then((AMap) => {
        if (!mapContainerRef.current) return;
        
        const map = new AMap.Map(mapContainerRef.current, {
          zoom: 11,
          center: [116.397428, 39.90923],
          viewMode: "3D",
        });
        
        map.addControl(new AMap.Scale());
        map.addControl(new AMap.ToolBar());
        mapInstance.current = map;
      })
      .catch((e) => console.error(e));

    return () => {
      mapInstance.current?.destroy();
    };
  }, []);

  // 监听坐标变化
  useEffect(() => {
    if (targetLocation && mapInstance.current) {
      const AMap = (window as any).AMap;

      if (markerInstance.current) {
        mapInstance.current.remove(markerInstance.current);
      }

      const marker = new AMap.Marker({
        position: [targetLocation.lng, targetLocation.lat],
        title: targetLocation.name,
        animation: "AMAP_ANIMATION_DROP",
      });

      mapInstance.current.add(marker);
      mapInstance.current.setFitView([marker]);
      markerInstance.current = marker;

      const infoWindow = new AMap.InfoWindow({
        content: `<div style="padding:5px"><b>推荐地点：</b><br>${targetLocation.name}</div>`,
        offset: new AMap.Pixel(0, -30),
      });
      infoWindow.open(mapInstance.current, marker.getPosition());
    }
  }, [targetLocation]);

  return <div ref={mapContainerRef} style={{ width: "100%", height: "100%", borderRadius: "12px" }} />;
}