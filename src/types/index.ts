// src/types/index.ts

export interface SearchRequest {
  user_locations: string[];
  preference_type: string;
  // 1 = 没勾选(只给1个公平的), 0 = 勾选了(给全部)
  num: number; 
}

export interface TimeDetail {
  location: string; 
  duration: string; 
  tag: boolean;     
}

export interface SearchResponse {
  shop_name: string;
  latitude: number;
  longitude: number;
  address: string;
  time_details: TimeDetail[]; 
}

export interface AddressTip {
  id: string;
  name: string;      // POI名称
  district: string;  // 所属区域（用于显示）
  address: string;   // 详细地址
  city?: string;     // 城市名（用于高德 inputtips API 的 city 参数）
}