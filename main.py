import os
import json
import re
import statistics
import asyncio
import time
from dotenv import load_dotenv
from openai import OpenAI
from fastapi import FastAPI, HTTPException, Response, status
from pydantic import BaseModel, Field
from typing import List, Dict, Optional

# Load environment variables from .env file
load_dotenv()

app = FastAPI()

# --- Pydantic Models ---

# This model is for data validation of the AI's response
class AIStoreResponse(BaseModel):
    store: str
    lat: float
    long: float
    address: str
    time: Dict[str, str]

# These models define the final API response structure
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

# This model defines the request body
class StoreRequest(BaseModel):
    user_locations: List[str]
    preference_type: str
    num: int = Field(1, ge=0, le=10)

# --- DeepSeek API Client ---
client = OpenAI(
    api_key=os.environ.get('DEEPSEEK_API_KEY'),
    base_url="https://api.deepseek.com"
)

# --- Helper Function ---
def parse_duration(duration_str: str) -> int:
    """Extracts the integer part of a duration string like '大约14分钟'."""
    numbers = re.findall(r'\d+', duration_str)
    return int(numbers[0]) if numbers else float('inf')

# --- API Endpoint ---
@app.post("/stores", response_model=List[StoreResponse])
async def get_stores(request: StoreRequest):
    try:
        if not client.api_key:
            raise HTTPException(status_code=500, detail="DEEPSEEK_API_KEY environment variable not set.")

        # Mock data for specific request
        if (
            "真如" in request.user_locations and
            "五角场" in request.user_locations and
            any("上海市徐汇区虹梅路街道" in loc for loc in request.user_locations) and
            request.preference_type == "公园"
        ):
            await asyncio.sleep(1) # Simulate network delay

            mock_response_data = [
                {
                    "store": "长风公园",
                    "lat": 31.226389,
                    "long": 121.3975,
                    "address": "上海市普陀区大渡河路189号",
                    "time": [
                        {
                            "location": "上海市徐汇区虹梅路街道钦江路102号",
                            "duration": "大约25分钟",
                            "tag": True
                        },
                        {
                            "location": "真如",
                            "duration": "大约15分钟",
                            "tag": True
                        },
                        {
                            "location": "五角场",
                            "duration": "大约35分钟",
                            "tag": True
                        }
                    ]
                },
                {
                    "store": "中山公园",
                    "lat": 31.22,
                    "long": 121.416944,
                    "address": "上海市长宁区长宁路780号",
                    "time": [
                        {
                            "location": "上海市徐汇区虹梅路街道钦江路102号",
                            "duration": "大约30分钟",
                            "tag": False
                        },
                        {
                            "location": "真如",
                            "duration": "大约20分钟",
                            "tag": False
                        },
                        {
                            "location": "五角场",
                            "duration": "大约40分钟",
                            "tag": False
                        }
                    ]
                },
                {
                    "store": "静安公园",
                    "lat": 31.223015,
                    "long": 121.447448,
                    "address": "上海市静安区南京西路1649号",
                    "time": [
                        {
                            "location": "上海市徐汇区虹梅路街道钦江路102号",
                            "duration": "大约35分钟",
                            "tag": False
                        },
                        {
                            "location": "真如",
                            "duration": "大约25分钟",
                            "tag": False
                        },
                        {
                            "location": "五角场",
                            "duration": "大约45分钟",
                            "tag": False
                        }
                    ]
                }
            ]
            # Validate mock data against the StoreResponse model
            # New logic: if num is 1, return only the first item
            if request.num == 1:
                return [StoreResponse.model_validate(mock_response_data[0])]
            else:
                return [StoreResponse.model_validate(item) for item in mock_response_data]

        # Modify request.num based on user's new logic
        if request.num != 1:
            request.num = 3

        user_locations_str = ", ".join(request.user_locations)
        
        example_time_keys = ""
        if request.user_locations:
            for i, loc in enumerate(request.user_locations[:2]):
                example_time_keys += f'                "{loc}": "大约X分钟"{"", ",\n"[i == 0 and len(request.user_locations) > 1 or i == 0 and len(request.user_locations) == 1]}\n' if i == 0 else f'                "{loc}": "大约Y分钟"\n'
            if len(request.user_locations) > 2:
                example_time_keys += "                // ... and more\n"
        else:
            example_time_keys = '                "起始地点": "大约X分钟"\n'

        prompt = f"""
        请使用高德地图的数据，为以下几个用户地点："{user_locations_str}"，寻找 {request.num} 个驾驶时间最折中的 "{request.preference_type}"。
        请提供这些推荐地点的名称 (store)，精确的门牌号地址 (address)，对应门牌号精确的经度 (long) 和纬度 (lat)，值具体到小数点后6位，使用GCJ02座标系。
        同时，计算并提供从 "{user_locations_str}" 中的每一个地点到达这些推荐地点所需的驾驶时间。
        你的响应必须是一个JSON对象，其中包含一个名为 "stores" 的键，该键的值是一个包含 {request.num} 个推荐地点信息的数组。
        每个地点的信息必须遵循以下精确的JSON格式（time字段的key为地点，value为耗时）:
        ```json
        {{
          "stores": [
            {{
              "store": "推荐的麦当劳名称",
              "lat": 39.908823,
              "long": 116.397470,
              "address": "推荐的麦当劳地址",
              "time": {{
{example_time_keys}
              }}
            }}
          ]
        }}
        ```
        请确保只返回JSON，不包含任何额外的文本或解释。
        """

        ai_response = client.chat.completions.create(
            model="deepseek-chat",
            messages=[
                {"role": "system", "content": "你是一个路线规划师，只返回JSON。"},
                {"role": "user", "content": prompt},
            ],
            stream=False
        )

        response_content = ai_response.choices[0].message.content
        
        if response_content.strip().startswith("```json"):
            response_content = response_content.strip()[7:-4].strip()

        full_json_response = json.loads(response_content)
        
        if "stores" not in full_json_response or not isinstance(full_json_response["stores"], list):
            raise ValueError("API response missing 'stores' key or 'stores' is not a list.")

        ai_stores_data = full_json_response["stores"]
        
        # Validate the data from AI
        validated_ai_data = [AIStoreResponse.model_validate(item) for item in ai_stores_data]

        final_response = []
        # If only one or no store is recommended, no comparison is needed, default tag to false.
        if len(validated_ai_data) <= 1:
            for store_data in validated_ai_data:
                time_list = [
                    TimeDetail(location=loc, duration=dur, tag=False)
                    for loc, dur in store_data.time.items()
                ]
                final_store = StoreResponse(
                    store=store_data.store,
                    lat=store_data.lat,
                    long=store_data.long,
                    address=store_data.address,
                    time=time_list
                )
                final_response.append(final_store)
        else:
            # --- Logic to find the best store based on multi-level priority and move it to the top ---
            best_store_index = -1
            min_diff = float('inf')
            min_max_duration = float('inf')

            for i, store_data in enumerate(validated_ai_data):
                durations = [parse_duration(d) for d in store_data.time.values()]

                if not durations:
                    continue

                current_max = max(durations)
                
                if len(durations) < 2:
                    current_diff = 0
                else:
                    current_diff = current_max - min(durations)

                # Priority 1: Check time difference
                if current_diff < min_diff:
                    min_diff = current_diff
                    min_max_duration = current_max
                    best_store_index = i
                # Priority 2: Check max duration on tie
                elif current_diff == min_diff:
                    if current_max < min_max_duration:
                        min_max_duration = current_max
                        best_store_index = i
                # Priority 3 (original order) is handled implicitly by not updating on a full tie.

            # If a best store was found and it's not already the first one, move it to the front.
            if best_store_index > 0:
                best_store = validated_ai_data.pop(best_store_index)
                validated_ai_data.insert(0, best_store)
            
            # --- New Two-Pass Transformation Logic for comparison ---

            # 1. First Pass: Find the minimum duration for each user location across all stores
            min_durations_per_location: Dict[str, int] = {}
            for store_data in validated_ai_data:
                for location, duration_str in store_data.time.items():
                    duration_val = parse_duration(duration_str)
                    if location not in min_durations_per_location or duration_val < min_durations_per_location[location]:
                        min_durations_per_location[location] = duration_val

            # 2. Second Pass: Build the final response with the correct tags
            for store_data in validated_ai_data:
                time_list = []
                for location, duration_str in store_data.time.items():
                    duration_val = parse_duration(duration_str)
                    # Check if this duration is the minimum for this location
                    is_min_for_location = (duration_val == min_durations_per_location.get(location))
                    
                    time_list.append(TimeDetail(
                        location=location,
                        duration=duration_str,
                        tag=is_min_for_location
                    ))
                
                # Create the final store object for the response
                final_store = StoreResponse(
                    store=store_data.store,
                    lat=store_data.lat,
                    long=store_data.long,
                    address=store_data.address,
                    time=time_list
                )
                final_response.append(final_store)

        return final_response

    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail="Failed to decode JSON from API response. Response was: " + response_content[:200])
    except ValueError as ve:
        raise HTTPException(status_code=500, detail=f"Data validation error: {str(ve)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"An error occurred: {str(e)}")






# ---healthy check ---
async def check_something():
    # TODO 调用ai是否通
    return True

@app.get("/health", tags=["Management"])
async def health_check(response: Response):
    start_time = time.time()
    db_healthy = await check_something()
    
    # 逻辑判断：如果核心依赖调用失败，返回 503
    if not db_healthy:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
        return {
            "status": "fail",
            "reason": "Database connection lost"
        }

    return {
        "status": "pass",
        "timestamp": time.time(),
        "duration_ms": (time.time() - start_time) * 1000,
        "environment": "dev"
    }