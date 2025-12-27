// src/utils/amapHelper.ts

interface LocationResult {
  address: string;
  lat: number;
  lng: number;
}

export const getCurrentLocation = async (): Promise<LocationResult> => {
  const loaderModule = await import("@amap/amap-jsapi-loader");
  const AMapLoader = loaderModule.default || loaderModule;

  // 1. 再次确保安全密钥存在 (务必检查这里是否填对)
  (window as any)._AMapSecurityConfig = {
    securityJsCode: "71edc06ee1ffec6400bb7d170353a584", // ⚠️⚠️⚠️ 再次检查这里！
  };

  return new Promise((resolve, reject) => {
    AMapLoader.load({
      key: "f0f8997e05bfa2dd95e546383cc44b90", // ⚠️⚠️⚠️ 再次检查这里！
      version: "2.0",
      plugins: ["AMap.Geolocation", "AMap.Geocoder"],
    })
      .then((AMap: any) => {
        // --- 调试点 1 ---
        console.log("Helper: 地图库加载成功，开始初始化 Geolocation...");

        const geolocation = new AMap.Geolocation({
          enableHighAccuracy: true,
          timeout: 10000,
          needAddress: true,
        });

        geolocation.getCurrentPosition((status: string, result: any) => {
          // --- 调试点 2 ---
          console.log("Helper: 定位回调:", status, result);

          if (status === "complete") {
            const lat = result.position.lat;
            const lng = result.position.lng;
            
            const geocoder = new AMap.Geocoder();
            geocoder.getAddress([lng, lat], (geoStatus: string, geoResult: any) => {
              if (geoStatus === 'complete' && geoResult.regeocode) {
                resolve({
                  address: geoResult.regeocode.formattedAddress, 
                  lat: lat,
                  lng: lng,
                });
              } else {
                resolve({
                  address: `未知地点 (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
                  lat: lat,
                  lng: lng,
                });
              }
            });
          } else {
            // 🔥 这里会把定位失败的具体原因弹出来
            alert("定位操作失败: " + result.message); 
            reject("定位操作失败: " + result.message);
          }
        });
      })
      .catch((e: any) => {
        // --- 调试点 3 (Catch Block) ---
        console.error("Helper: 致命错误", e);
        
        // 🔥 这里是重点：把具体的错误对象弹出来看！
        // 如果 e 是对象，尝试打印它的 message，否则打印它自己
        const errorMsg = e.message || JSON.stringify(e) || e.toString();
        alert("高德加载/执行异常: " + errorMsg);
        
        reject("高德加载失败: " + errorMsg);
      });
  });
};