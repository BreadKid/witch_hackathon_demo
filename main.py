import os
import asyncio
import statistics
from typing import TypedDict, List, Dict
from pydantic import BaseModel, Field
from dotenv import load_dotenv
import httpx
import json
import time as time_module
from fastapi import FastAPI, HTTPException, Query
from langgraph.graph import StateGraph, END

from fetch_library_info_sh import generate_library_files

load_dotenv()

# --- 1. 定义数据结构 (Pydantic) ---

class TimeDetail(BaseModel):
    location: str
    duration: str
    tag: bool

class StoreResponse(BaseModel):
    store: str
    lat: float
    long: float
    address: str
    time: List[TimeDetail]

class StoreRequest(BaseModel):
    user_locations: List[str]
    preference_type: str
    num: int = Field(3, ge=0, le=10)

class TimeItem(BaseModel):
    origin: str = Field(description="起点地址名称")
    duration: int = Field(description="耗时(秒)")

class FinalResponse(BaseModel):
    stores: List[StoreResponse]

# --- 2. 高德地图工具集 (Amap Tools) ---

class AmapService:
    def __init__(self):
        self.key = os.getenv("AMAP_API_KEY")
        self.base_url = "https://restapi.amap.com/v3"

    async def get_coords(self, address: str) -> dict:
        """地理编码：地址转坐标"""
        async with httpx.AsyncClient() as client:
            resp = await client.get(f"{self.base_url}/geocode/geo", params={
                "key": self.key, "address": address,"city":"上海"
            })
            data = resp.json()
            if data['status'] == '1' and data['geocodes']:
                loc = data['geocodes'][0]['location'].split(',')
                return {"address": address, "lon": float(loc[0]), "lat": float(loc[1])}
            else:
                print(f"      [错误] 地理编码请求失败: {data.get('info')} (infocode: {data.get('infocode')})")
        return None

    async def search_nearby(self, lon: float, lat: float, poi_type: str, count: int = 10, radius: int = 5000):
        """周边搜索"""
        async with httpx.AsyncClient() as client:
            resp = await client.get(f"{self.base_url}/place/around", params={
                "key": self.key,
                "location": f"{lon},{lat}",
                "keywords": poi_type,
                "radius": radius,
                "offset": count,
                "page": 1
            })
            data = resp.json()
            if data['status'] == '1':
                return data.get('pois', [])
            else:
                print(f"      [错误] 周边搜索请求失败: {data.get('info')} (infocode: {data.get('infocode')})")
                return []

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
                    print(f"      [错误] 距离计算请求失败: {data.get('info')} (infocode: {data.get('infocode')})")
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
    analysis_results: List[dict]
    final_json: List[dict]

# --- 4. Agent 节点逻辑 ---

amap = AmapService()

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
    
    radius = 5000
    pois = []
    while radius <= 20000: # 最大尝试到 20km
        print(f"      正在搜索周边的 {state['poi_type']} (半径: {radius}m)...")
        pois = await amap.search_nearby(avg_lon, avg_lat, state['poi_type'], radius=radius)
        if pois:
            break
        print(f"      [提示] 半径 {radius}m 内未发现地点，正在成倍扩大搜索范围...")
        radius *= 2

    print(f"      发现 {len(pois)} 个候选地点")
    
    # 地点去重
    def is_duplicate(poi1, poi2):
        """判断两个地点是否重复"""
        # 1. 坐标去重：小数点后4位一致
        loc1 = poi1['location'].split(',')
        loc2 = poi2['location'].split(',')
        lon1, lat1 = round(float(loc1[0]), 4), round(float(loc1[1]), 4)
        lon2, lat2 = round(float(loc2[0]), 4), round(float(loc2[1]), 4)
        if lon1 == lon2 and lat1 == lat2:
            return True
        
        # 2. 地址相似度去重
        addr1 = poi1.get('address', '')
        addr2 = poi2.get('address', '')
        if addr1 and addr2:
            # 提取核心地址（去除建筑物名称等后缀）
            # 如果一个地址是另一个的子串，认为相似
            if addr1 in addr2 or addr2 in addr1:
                return True
        
        return False
    
    # 执行去重
    unique_pois = []
    for poi in pois:
        is_dup = False
        for existing in unique_pois:
            if is_duplicate(poi, existing):
                is_dup = True
                break
        if not is_dup:
            unique_pois.append(poi)
    
    print(f"      去重后剩余 {len(unique_pois)} 个候选地点")
    return {"candidates": unique_pois}

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
            "info": StoreResponse(
                store=poi['name'],
                lat=float(loc[1]),
                long=float(loc[0]),
                address=poi['address'] if isinstance(poi['address'], str) else "未知地址",
                time=[] # 暂存, format 节点再处理
            ),
            "raw_times": time_list # 临时保存原始数据供计算
        })
    
    # 按得分排序，选出最均衡的 N 个
    scored_candidates.sort(key=lambda x: x['score'])
    final_selection = scored_candidates[:state['num_needed']]
    
    # 打印前 3 个评分最高的（作为日志）
    for i, item in enumerate(final_selection[:3]):
        tag_log = "[胜出]" if i == 0 else "[备选]"
        avg_wait = statistics.mean([t.duration for t in item['raw_times']])
        print(f"  {tag_log} {item['info'].store}: 得分 {item['score']:.1f}, 平均耗时 {avg_wait/60:.1f}min")

    return {"analysis_results": final_selection}

async def format_output_node(state: AgentState):
    """节点4:格式化输出并计算 Tag"""
    print(f"\n[4/4] 格式化为 JSON...")
    
    # 1. 找出每个起点在所有候选店中的最小耗时 (用于打 tag)
    min_durations = {} # {address: min_seconds}
    for item in state['analysis_results']:
        for t_item in item['raw_times']:
            if t_item.origin not in min_durations or t_item.duration < min_durations[t_item.origin]:
                min_durations[t_item.origin] = t_item.duration

    # 2. 组装最终响应
    final_stores = []
    for item in state['analysis_results']:
        store_resp = item['info']
        time_details = []
        for t_item in item['raw_times']:
            # 转换格式：四舍五入到分钟
            duration_minutes = round(t_item.duration / 60)
            duration_fmt = f"{duration_minutes}"
            # 判定 tag
            is_min = (t_item.duration == min_durations[t_item.origin])
            time_details.append(TimeDetail(
                location=t_item.origin,
                duration=f"{duration_fmt}分钟",
                tag=is_min
            ))
        store_resp.time = time_details
        final_stores.append(store_resp)
        
    print("      JSON 格式化完成")
    return {"final_json": [s.model_dump() for s in final_stores]}

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

agent = workflow.compile()

# --- 6. FastAPI 接口实现 ---

app = FastAPI()

@app.post("/stores", response_model=List[StoreResponse])
async def get_stores(request: StoreRequest):
    try:
        num_needed = request.num if request.num > 0 else 3
        inputs = {
            "user_request": f"寻找驾驶时间最折中的地点",
            "poi_type": request.preference_type,
            "num_needed": num_needed,
            "origin_addresses": request.user_locations
        }
        
        # 运行 LangGraph 工作流
        final_state = await agent.ainvoke(inputs)
        return final_state['final_json']
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
async def health_check():
    return {"status": "pass", "timestamp": time_module.time()}


@app.put("/flush/library")
async def get_library(
    location: str = Query(..., description="位置标识，目前仅支持 SH"),
):
    """
    触发一次图书馆接口抓取，并生成带日期后缀的 JSON 文件。

    - 请求参数:
      - location: 必填，目前要求为 'SH'
    - 生成文件示例(以当日日期为后缀):
      - library_info.raw.yyyymmdd.json
      - library_info.yyyymmdd.json
    """
    # 校验 location
    if location.upper() != "SH":
        raise HTTPException(status_code=400, detail="暂仅支持 location=SH")

    try:
        # generate_library_files 为同步函数，这里放到线程池中执行，避免阻塞事件循环
        result = await asyncio.to_thread(generate_library_files)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"生成图书馆数据文件失败: {e}")

    return {
        "count": result["count"]
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)