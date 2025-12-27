// src/types/index.ts

export interface SearchRequest {
  user_locations: string[];
  preference_type: string;
  num?: number;
}

// ✨ 新增：对应后端文档里的 TimeDetail 对象
export interface TimeDetail {
  location: string; // 起始点
  duration: string; // 耗时
  tag: boolean;     // ✨ 是否为最短时间
}

export interface SearchResponse {
  shop_name: string;
  latitude: number;
  longitude: number;
  address: string;
  // ✨ 修改：现在这是一个详情数组，不再是简单的 key-value 对象
  time_details: TimeDetail[]; 
}