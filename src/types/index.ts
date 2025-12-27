// types/index.ts

// 发送给后端的数据格式
export interface SearchRequest {
    user_locations: string[]; // ["北京西站", "朝阳大悦城", ...]
    preference_type: string;  // "麦当劳"
  }
  
  // 后端返回的数据格式
  export interface SearchResponse {
    shop_name: string; // "麦当劳(天安门店)"
    latitude: number;  // 39.909
    longitude: number; // 116.397
    address: string;   // "长安街1号"
    time_info: Record<string, string>;
  }