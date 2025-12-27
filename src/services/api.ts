// src/services/api.ts
import { SearchRequest, SearchResponse, TimeDetail } from "../types";

export const fetchMeetingPoint = async (payload: SearchRequest): Promise<SearchResponse[]> => {
  try {
    // ⚠️ 记得确保这里 next.config.ts 里的代理配置是针对新后端的
    const PROXY_URL = "/api/proxy/stores"; 

    const res = await fetch(PROXY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_locations: payload.user_locations, 
        preference_type: payload.preference_type, 
        num: 2, // 哪怕你要2个，后端不一定给够，做好兼容
      }),
    });

    if (!res.ok) {
      throw new Error(`后端报错: ${res.status}`);
    }

    const data = await res.json();

    // 核心修改：适配新版接口结构
    if (Array.isArray(data) && data.length > 0) {
      return data.map((item: any) => ({
        shop_name: item.store,   
        latitude: Number(item.lat),      
        longitude: Number(item.long),    
        address: item.store, // 后端暂时没单独返回 address，用店名代替
        // ✨ 直接把后端的 time 数组赋值给 time_details
        time_details: item.time as TimeDetail[] 
      }));
    }

    return [];

  } catch (error: any) {
    console.error("API 请求失败:", error);
    alert("请求失败: " + (error.message || "未知错误"));
    return [];
  }
};