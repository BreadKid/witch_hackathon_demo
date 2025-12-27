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