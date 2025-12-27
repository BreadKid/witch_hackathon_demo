// 你的高德 Key (前端 Key)
const AMAP_KEY = "f0f8997e05bfa2dd95e546383cc44b90";
// 你的安全密钥 (对应上面的 Key)
const AMAP_SECURITY_CODE = "71edc06ee1ffec6400bb7d170353a584";

export const getCurrentLocation = async (): Promise<{
  latitude: number;
  longitude: number;
  address: string;
}> => {
  // 动态导入，避免 SSR 时报 window is not defined
  const { load } = await import("@amap/amap-jsapi-loader");

  // 配置安全密钥
  if (typeof window !== "undefined") {
    (window as any)._AMapSecurityConfig = {
      securityJsCode: AMAP_SECURITY_CODE,
    };
  }

  try {
    const AMap = await load({
      key: AMAP_KEY,
      version: "2.0",
      // 👇 核心修改：必须加载 Geocoder 插件，它负责把坐标翻译成文字
      plugins: ["AMap.Geolocation", "AMap.Geocoder"], 
    });

    return new Promise((resolve, reject) => {
      const geolocation = new AMap.Geolocation({
        enableHighAccuracy: true, // 是否使用高精度定位，默认:true
        timeout: 10000,           // 超过10秒后停止定位
        zoomToAccuracy: true,     // 定位成功后调整地图视野范围
        needAddress: true,        // 👇 这一行很重要！告诉高德直接尝试返回地址
      });

      geolocation.getCurrentPosition((status: string, result: any) => {
        if (status === "complete") {
          // 定位成功
          const lat = result.position.lat;
          const lng = result.position.lng;
          
          // 调试日志：查看高德返回了什么
          console.log("📍 定位结果:", {
            position: result.position,
            formattedAddress: result.formattedAddress,
            addressComponent: result.addressComponent,
            fullResult: result
          });
          
          // 优先使用高德直接返回的 formattedAddress
          let directAddress = result.formattedAddress;

          // ⚠️ 关键：H5 定位时 formattedAddress 经常为空，必须使用 Geocoder 逆地理编码
          // 无论如何都调用 Geocoder，确保能获取到地址
          const geocoder = new AMap.Geocoder({
            radius: 1000,        // 搜索半径
            extensions: "base",  // 返回基本信息
          });
          
          geocoder.getAddress([lng, lat], (geoStatus: string, geoResult: any) => {
            console.log("🗺️ 逆地理编码结果:", { geoStatus, geoResult });
            
            let finalAddress = "";
            
            if (geoStatus === 'complete' && geoResult.regeocode) {
              // Geocoder 成功返回地址
              finalAddress = geoResult.regeocode.formattedAddress;
              console.log("✅ 逆地理编码成功:", finalAddress);
            } else if (directAddress && directAddress.trim() !== "") {
              // Geocoder 失败但定位时有返回地址
              finalAddress = directAddress;
              console.log("⚠️ 使用定位直接返回的地址:", finalAddress);
            } else {
              // 都失败了，使用经纬度作为 fallback
              finalAddress = `定位成功 (${lat.toFixed(6)}, ${lng.toFixed(6)})`;
              console.warn("❌ 逆地理编码失败，使用坐标:", geoStatus, geoResult);
            }
            
            resolve({
              latitude: lat,
              longitude: lng,
              address: finalAddress,
            });
          });

        } else {
          // 定位失败
          console.error("❌ 定位失败详情:", result);
          reject(new Error("无法获取位置，请检查手机定位权限或网络"));
        }
      });
    });
  } catch (error) {
    console.error("高德地图加载失败:", error);
    throw error;
  }
};