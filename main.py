import os
import asyncio
import statistics
from typing import Annotated, TypedDict, List, Dict
from pydantic import BaseModel, Field
from dotenv import load_dotenv
import httpx

# Google & LangGraph 核心库
from google import genai
from google.genai import types
from langgraph.graph import StateGraph, END

load_dotenv()

# --- 1. 定义数据结构 (Pydantic) ---

class TimeItem(BaseModel):
    origin: str = Field(description="起点地址名称")
    duration: int = Field(description="耗时(秒)")

class StoreInfo(BaseModel):
    store: str = Field(description="推荐地点的名称")
    lat: float = Field(description="纬度，小数点后6位")
    long: float = Field(description="经度，小数点后6位")
    address: str = Field(description="精确地址")
    time: List[TimeItem] = Field(description="起点到该点的驾车耗时列表")

class FinalResponse(BaseModel):
    stores: List[StoreInfo]

# --- 2. 高德地图工具集 (Amap Tools) ---

class AmapService:
    def __init__(self):
        self.key = os.getenv("AMAP_API_KEY")
        self.base_url = "https://restapi.amap.com/v3"

    async def get_coords(self, address: str) -> dict:
        """地理编码：地址转坐标"""
        async with httpx.AsyncClient() as client:
            resp = await client.get(f"{self.base_url}/geocode/geo", params={
                "key": self.key, "address": address
            })
            data = resp.json()
            if data['status'] == '1' and data['geocodes']:
                loc = data['geocodes'][0]['location'].split(',')
                return {"address": address, "lon": float(loc[0]), "lat": float(loc[1])}
        return None

    async def search_nearby(self, lon: float, lat: float, poi_type: str, count: int = 10):
        """周边搜索"""
        async with httpx.AsyncClient() as client:
            resp = await client.get(f"{self.base_url}/place/around", params={
                "key": self.key,
                "location": f"{lon},{lat}",
                "keywords": poi_type,
                "radius": 5000,
                "offset": count,
                "page": 1
            })
            return resp.json().get('pois', [])

    async def get_distance_matrix(self, origins: List[str], destinations: List[str]):
        """距离矩阵：多对多计算驾驶时间"""
        all_results = []
        async with httpx.AsyncClient() as client:
            for dest in destinations:
                await asyncio.sleep(0.3) # 加大延迟，进一步缓解 QPS 限制
                resp = await client.get(f"{self.base_url}/distance", params={
                    "key": self.key,
                    "origins": "|".join(origins),
                    "destination": dest,
                    "type": 1 # 驾车
                })
                data = resp.json()
                if data['status'] == '1':
                    all_results.extend(data.get('results', []))
                else:
                    # 如果某次请求失败，填充空数据以保持索引对齐
                    print(f"      [警告] 距离计算请求失败: {data.get('info')}")
                    all_results.extend([{'duration': '999999'}] * len(origins))
        return all_results

# --- 3. Agent 状态管理 ---

class AgentState(TypedDict):
    user_request: str
    poi_type: str
    num_needed: int
    origin_addresses: List[str]
    origin_coords: List[dict]
    candidates: List[dict]
    analysis_results: List[StoreInfo]
    final_json: dict

# --- 4. Agent 节点逻辑 ---

amap = AmapService()
# 修复：从 .env 中读取正确的环境变量 GEMINI_API_KEY
client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

async def geocode_node(state: AgentState):
    """节点1：解析地址并获取坐标"""
    print(f"\n[1/4] 正在解析地址坐标...")
    tasks = [amap.get_coords(addr) for addr in state['origin_addresses']]
    coords = await asyncio.gather(*tasks)
    results = [c for c in coords if c]
    for r in results:
        print(f"  - {r['address']}: ({r['lon']}, {r['lat']})")
    return {"origin_coords": results}

async def calculate_center_and_search_node(state: AgentState):
    """节点2：计算几何中心并搜索候选点"""
    lons = [c['lon'] for c in state['origin_coords']]
    lats = [c['lat'] for c in state['origin_coords']]
    avg_lon = sum(lons) / len(lons)
    avg_lat = sum(lats) / len(lats)
    print(f"\n[2/4] 计算几何中心点: ({avg_lon:.6f}, {avg_lat:.6f})")
    
    print(f"      正在搜索周边的 {state['poi_type']}...")
    pois = await amap.search_nearby(avg_lon, avg_lat, state['poi_type'])
    print(f"      发现 {len(pois)} 个候选地点")
    return {"candidates": pois}

async def evaluate_compromise_node(state: AgentState):
    """节点3：计算真实路况耗时并进行“折中”评估"""
    print(f"\n[3/4] 评估候选地点中 (综合耗时与标准差)...")
    origins_str = [f"{c['lon']},{c['lat']}" for c in state['origin_coords']]
    dest_str = [f"{p['location']}" for p in state['candidates']]
    
    # 获取距离矩阵数据
    dist_data = await amap.get_distance_matrix(origins_str, dest_str)
    
    # 重组数据进行评分
    scored_candidates = []
    num_origins = len(state['origin_coords'])
    
    for i, poi in enumerate(state['candidates']):
        # 提取各起点到该候选点的耗时
        times = []
        time_list = []
        for j in range(num_origins):
            # 高德返回的 results 索引逻辑：i*num_origins + j
            idx = i * num_origins + j
            duration = int(dist_data[idx]['duration'])
            times.append(duration)
            time_list.append(TimeItem(origin=state['origin_coords'][j]['address'], duration=duration))
            
        # 计算折中指标：平均值 + 标准差（标准差越小越折中）
        avg_t = statistics.mean(times)
        std_t = statistics.stdev(times) if len(times) > 1 else 0
        score = avg_t + (std_t * 1.5) # 权重可调
        
        loc = poi['location'].split(',')
        scored_candidates.append({
            "score": score,
            "info": StoreInfo(
                store=poi['name'],
                lat=float(loc[1]),
                long=float(loc[0]),
                address=poi['address'] if isinstance(poi['address'], str) else "未知地址",
                time=time_list
            )
        })
    
    # 按得分排序，选出最均衡的 N 个
    scored_candidates.sort(key=lambda x: x['score'])
    final_selection = [x['info'] for x in scored_candidates[:state['num_needed']]]
    
    # 打印前 3 个评分最高的（作为日志）
    for i, item in enumerate(scored_candidates[:3]):
        tag = "[胜出]" if i == 0 else "[备选]"
        avg_wait = statistics.mean([t.duration for t in item['info'].time])
        print(f"  {tag} {item['info'].store}: 得分 {item['score']:.1f}, 平均耗时 {avg_wait/60:.1f}min")

    return {"analysis_results": final_selection}

async def format_output_node(state: AgentState):
    """节点4:直接格式化为 JSON 输出"""
    print(f"\n[4/4] 格式化为 JSON...")
    
    import json
    # 将模型转为字典并手动处理 duration 格式
    stores_data = []
    for store in state['analysis_results']:
        s_dict = store.model_dump()
        for t in s_dict['time']:
            d = t['duration']
            # 将秒转换为 mm.ss 字符串格式
            t['duration'] = f"{d // 60}.{d % 60:02d}"
        stores_data.append(s_dict)
        
    # 生成最终 JSON 字符串
    json_output = json.dumps({"stores": stores_data}, indent=2, ensure_ascii=False)
    print("      JSON 格式化完成")
    return {"final_json": json_output}

# --- 5. 构建图 (LangGraph) ---

workflow = StateGraph(AgentState)

workflow.add_node("geocode", geocode_node)
workflow.add_node("search", calculate_center_and_search_node)
workflow.add_node("evaluate", evaluate_compromise_node)
workflow.add_node("format", format_output_node)

workflow.set_entry_point("geocode")
workflow.add_edge("geocode", "search")
workflow.add_edge("search", "evaluate")
workflow.add_edge("evaluate", "format")
workflow.add_edge("format", END)

app = workflow.compile()

# --- 6. 执行入口 ---

async def main():
    inputs = {
        "user_request": "寻找驾驶时间最折中的地点",
        "poi_type": "麦当劳",
        "num_needed": 3,
        "origin_addresses": ["虹桥火车站", "复旦大学杨浦校区", "上海市徐汇区虹梅路街道钦江路102号"]
    }
    
    async for event in app.astream(inputs):
        pass # 日志已经在节点内部打印
    
    # 打印最终结果
    final_state = await app.ainvoke(inputs)
    print("\n" + "="*50)
    print("【 最终推荐结果 】")
    print(final_state['final_json'])
    print("="*50)

if __name__ == "__main__":
    asyncio.run(main())