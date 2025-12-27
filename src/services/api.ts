// src/services/api.ts
import { SearchRequest, SearchResponse, TimeDetail } from "../types";

export const fetchMeetingPoint = async (payload: SearchRequest): Promise<SearchResponse[]> => {
  try {
    // 通过 Next.js API Route 代理请求，避免 CORS 问题
    const PROXY_URL = "/api/proxy/stores"; 

    const res = await fetch(PROXY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_locations: payload.user_locations, 
        preference_type: payload.preference_type, 
        num: payload.num, 
      }),
    });

    if (!res.ok) {
      throw new Error(`后端报错: ${res.status}`);
    }

    const data = await res.json();

    if (Array.isArray(data) && data.length > 0) {
      return data.map((item: any) => ({
        shop_name: item.store,   
        latitude: Number(item.lat),      
        longitude: Number(item.long),    
        address: item.address,
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