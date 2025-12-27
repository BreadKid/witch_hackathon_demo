import { SearchRequest, SearchResponse } from "../types";

export const fetchMeetingPoint = async (payload: SearchRequest): Promise<SearchResponse | null> => {
  try {
    // ✅ 1. 使用本地代理地址
    // 之前在 next.config.ts 里配好了，请求这个地址会自动转发给朋友的新域名
    const PROXY_URL = "/api/proxy/stores"; 

    console.log("正在请求后端:", PROXY_URL);

    // ✅ 2. 发起标准的 POST 请求 (完全对应朋友的接口文档)
    const res = await fetch(PROXY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        // 朋友要求：user_locations 是字符串数组
        user_locations: payload.user_locations, 
        
        // 朋友要求：preference_type 是字符串 (如 "麦当劳")
        preference_type: payload.preference_type, 
        
        // 朋友要求：num 是数字，代表推荐几个，我们要 1 个最好的
        num: 1, 
      }),
    });

    if (!res.ok) {
      throw new Error(`后端报错: ${res.status} ${res.statusText}`);
    }

    const data = await res.json();
    console.log("后端返回原始数据:", data);

    // ✅ 3. 数据清洗
    // 朋友的接口返回的是一个数组 [...]，即使只有 1 个也是数组
    if (Array.isArray(data) && data.length > 0) {
      const bestChoice = data[0]; // 取第 1 个结果
      
      return {
        // 对应文档字段: store -> 我们前端用的: shop_name
        shop_name: bestChoice.store,   
        
        // 对应文档字段: lat -> 我们前端用的: latitude
        latitude: Number(bestChoice.lat),      
        
        // 对应文档字段: long -> 我们前端用的: longitude
        longitude: Number(bestChoice.long),    
        
        // 后端暂时只返回了店名，没有详细地址，我们先用店名凑合一下
        address: bestChoice.store 
      };
    }

    return null;

  } catch (error: any) {
    console.error("API 请求失败:", error);
    // 弹窗提示，方便你直接在页面上看到错误
    alert("请求失败: " + (error.message || "未知错误"));
    return null;
  }
};