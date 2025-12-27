import { SearchRequest, SearchResponse } from "../types";

// 修改返回类型：现在返回的是一个数组 Promise<SearchResponse[]>
export const fetchMeetingPoint = async (payload: SearchRequest): Promise<SearchResponse[]> => {
  try {
    const PROXY_URL = "/api/proxy/stores"; 

    // 如果要测试，可以把这里改为 true，查看多结果的模拟效果
    const USE_MOCK = false; 

    if (USE_MOCK) {
      await new Promise(resolve => setTimeout(resolve, 800));
      return [
        {
          shop_name: "Mock-麦当劳(南京东路店)",
          latitude: 31.2304,
          longitude: 121.4737,
          address: "南京东路888号",
          time_info: {
            [payload.user_locations[0]]: "约15分钟",
            [payload.user_locations[1]]: "约45分钟",
          }
        },
        {
          shop_name: "Mock-麦当劳(静安寺店)",
          latitude: 31.2230,
          longitude: 121.4450,
          address: "南京西路1688号",
          time_info: {
            [payload.user_locations[0]]: "约30分钟",
            [payload.user_locations[1]]: "约30分钟",
          }
        }
      ];
    }

    const res = await fetch(PROXY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_locations: payload.user_locations, 
        preference_type: payload.preference_type, 
        num: 2, // 告诉后端：我们要 2 个推荐！
      }),
    });

    if (!res.ok) {
      throw new Error(`后端报错: ${res.status}`);
    }

    const data = await res.json();

    // 核心修改：遍历后端返回的所有结果，全部清洗并返回
    if (Array.isArray(data) && data.length > 0) {
      return data.map((item: any) => ({
        shop_name: item.store,   
        latitude: Number(item.lat),      
        longitude: Number(item.long),    
        address: item.store,
        time_info: item.time || {} 
      }));
    }

    return [];

  } catch (error: any) {
    console.error("API 请求失败:", error);
    alert("请求失败: " + (error.message || "未知错误"));
    return [];
  }
};