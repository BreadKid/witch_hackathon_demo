// src/app/api/proxy/stores/route.ts
import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = "https://agrostographic-kasie-lullingly.ngrok-free.dev/stores";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log("📤 代理请求 body:", JSON.stringify(body));

    const res = await fetch(BACKEND_URL, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "ngrok-skip-browser-warning": "true",
        "User-Agent": "MiddlePoint/1.0",
      },
      body: JSON.stringify(body),
    });

    console.log("📥 后端响应状态:", res.status);
    
    // 先获取响应文本
    const responseText = await res.text();
    console.log("📥 后端响应内容:", responseText.substring(0, 500));

    if (!res.ok) {
      return NextResponse.json(
        { error: `后端报错: ${res.status}`, detail: responseText.substring(0, 200) },
        { status: res.status }
      );
    }

    // 尝试解析 JSON
    try {
      const data = JSON.parse(responseText);
      return NextResponse.json(data);
    } catch {
      console.error("❌ 响应不是有效 JSON:", responseText.substring(0, 200));
      return NextResponse.json(
        { error: "后端返回的不是有效 JSON", detail: responseText.substring(0, 200) },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error("❌ 代理请求失败:", error);
    return NextResponse.json(
      { error: error.message || "代理请求失败" },
      { status: 500 }
    );
  }
}

