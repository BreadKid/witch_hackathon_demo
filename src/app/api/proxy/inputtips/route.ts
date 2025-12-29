// src/app/api/proxy/inputtips/route.ts
import { NextRequest, NextResponse } from "next/server";

// 服务端 REST API 使用 Web 服务类型的 Key（与前端 JS API Key 不同）
const AMAP_SERVER_KEY = process.env.AMAP_SERVER_KEY || "";
const AMAP_INPUTTIPS_URL = "https://restapi.amap.com/v3/assistant/inputtips";

/**
 * 从高德返回的 district 字符串中提取城市名
 * 高德 district 格式通常为："省 市 区" 或 "市 区" 或单独城市名
 * 例如："上海市 浦东新区" -> "上海市"
 *       "广东省 深圳市 南山区" -> "深圳市"
 */
function extractCityFromDistrict(district: string): string {
  if (!district) return "";
  
  const parts = district.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  
  // 查找包含"市"的部分
  for (const part of parts) {
    if (part.includes("市")) {
      return part;
    }
  }
  
  // 如果没有"市"，返回第一个有效部分（可能是直辖市或特别行政区）
  return parts[0];
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const keywords = searchParams.get("keywords");
    const city = searchParams.get("city");

    if (!keywords || keywords.trim() === "") {
      return NextResponse.json([]);
    }

    if (!AMAP_SERVER_KEY) {
      console.error("❌ 高德地图 Web 服务 API Key 未配置 (AMAP_SERVER_KEY)");
      return NextResponse.json(
        { error: "AMAP_SERVER_KEY 未配置，请在高德开放平台创建 Web 服务类型的 Key" },
        { status: 500 }
      );
    }

    const url = new URL(AMAP_INPUTTIPS_URL);
    url.searchParams.set("key", AMAP_SERVER_KEY);
    url.searchParams.set("keywords", keywords.trim());
    url.searchParams.set("datatype", "all");
    
    // 如果提供了城市参数，优先搜索该城市的地址
    if (city && city.trim()) {
      url.searchParams.set("city", city.trim());
      // citylimit=true 表示仅返回指定城市数据
      url.searchParams.set("citylimit", "false");
    }

    const res = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "User-Agent": "MiddlePoint/1.0",
      },
    });

    if (!res.ok) {
      console.error("❌ 高德 API 请求失败:", res.status);
      return NextResponse.json(
        { error: `高德 API 请求失败: ${res.status}` },
        { status: res.status }
      );
    }

    const data = await res.json();

    if (data.status !== "1") {
      console.error("❌ 高德 API 返回错误:", data.info);
      return NextResponse.json(
        { error: data.info || "高德 API 返回错误" },
        { status: 400 }
      );
    }

    // 格式化返回数据
    const tips = (data.tips || [])
      // 高德部分返回没有 id 的区县/道路，仍需展示
      .filter((tip: any) => tip && tip.name && tip.name.trim() !== "")
      .map((tip: any, index: number) => {
        const district = tip.district || "";
        const derivedCity = extractCityFromDistrict(district);
        const fallbackId =
          tip.id ||
          tip.adcode ||
          tip.location ||
          `${tip.name}-${index}`;

        return {
          id: fallbackId,
          name: tip.name,
          district,
          address: tip.address || district || "",
          // 优先使用返回的城市字段，其次用区县推断
          city: tip.city || derivedCity,
        };
      });

    return NextResponse.json(tips);
  } catch (error: any) {
    console.error("❌ inputtips 代理请求失败:", error);
    return NextResponse.json(
      { error: error.message || "代理请求失败" },
      { status: 500 }
    );
  }
}

