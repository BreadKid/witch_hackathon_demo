import json
import os
import sys
from pathlib import Path
from typing import Any, Dict, List

import requests


LIBRARY_API_URL = "https://www.library.sh.cn/st/guest/queryShlibLibsInfo2"

# 优先使用环境变量中的 token，方便后续更新；如果没有，则退回到你录下来的值
DEFAULT_AAT_TOKEN = (
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9."
    "eyJpYXQiOjE3NzAwMTYzODAsImV4cCI6MTc3MjQzNTU4MCwiaXNzIjoiYWF0QHNobGliIiwibmJmIjoxNzcwMDE2MzUwLCJqdGkiOiJpMWJidjd5ZiIsInN1YiI6ImxpYndlYi0yOUM1QzNENiIsImFwcGtleSI6InNobGliLndlYi5oNS5tYWlucGFnZS4xIiwicmVsYXRland0aWQiOiItLS0tLSIsInN1Ym4iOiJkMTNmNWU0ODg3ZDNjMWUyZTYxY2I3NWJmZjczY2M0NSJ9."
    "wvTd-OxUIZLIH4QLrs74olR3hVYIMFLIkzVeE_DXh7Q"
)


def fetch_library_info() -> Dict[str, Any]:
    """
    调用上海图书馆接口，获取馆信息的原始 JSON 数据。

    默认会模拟浏览器的一些关键头部，并携带 aat token，避免 403。
    """
    aat_token = os.getenv("LIBRARY_AAT_TOKEN", DEFAULT_AAT_TOKEN)

    headers = {
        "Content-Type": "application/json",
        "Accept": "application/json, text/plain, */*",
        # 这些头在浏览器里通常会携带，部分站点会校验
        "Origin": "https://www.library.sh.cn",
        "Referer": "https://www.library.sh.cn/guide/libraryLocation",
        "User-Agent": (
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/144.0.0.0 Safari/537.36"
        ),
    }

    # 同时在 body 与 cookie 中携带 aat，与抓包结果更接近
    cookies = {
        "aat": aat_token,
    }

    # 请求体：恢复坐标与 aat 字段
    payload = {
        "page": 1,
        "pagesize": 9999,
        "type": 2,
        "x": 121.39514047198419,
        "y": 31.28119226220889,
        "aat": aat_token,
    }

    try:
        resp = requests.post(
            LIBRARY_API_URL,
            headers=headers,
            cookies=cookies,
            json=payload,
            timeout=10,
        )
        # 如果仍然是 4xx/5xx，这里会抛异常
        resp.raise_for_status()
    except requests.RequestException as exc:
        status = getattr(exc.response, "status_code", None) if hasattr(exc, "response") else None
        if status is not None:
            print(f"[错误] 请求图书馆接口失败，状态码 {status}: {exc}", file=sys.stderr)
            # 打印一小段响应体帮助排查
            try:
                snippet = exc.response.text[:500]
                print(f"[调试] 响应内容片段: {snippet}", file=sys.stderr)
            except Exception:
                pass
        else:
            print(f"[错误] 请求图书馆接口失败: {exc}", file=sys.stderr)

        print(
            "[提示] 如果持续出现 403，请尝试：\n"
            "  1) 从浏览器抓包更新最新的 aat token；\n"
            "  2) 将其写入环境变量 LIBRARY_AAT_TOKEN 再运行脚本。",
            file=sys.stderr,
        )
        raise

    try:
        return resp.json()
    except ValueError as exc:
        # 返回内容不是合法 JSON
        print(f"[错误] 接口返回非 JSON 数据: {exc}", file=sys.stderr)
        # 打印部分响应内容帮助排查
        snippet = resp.text[:500]
        print(f"[调试] 响应内容片段: {snippet}", file=sys.stderr)
        raise


def extract_brief_info(raw_data: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    从接口返回的原始数据中提取关键字段，生成简化后的馆信息列表。

    当前接口返回结构示例：
    {
        "code": "200",
        "data": {
            "result": [ {...单条馆信息...}, ... ]
        }
    }

    根据你的需求，library_info.json 中不需要保存以下字段：
    - opentime_se, website, tel_se, pic, id
    """
    # 1. 精确按当前接口结构取列表：raw_data["data"]["result"]
    candidates: Any = None
    if isinstance(raw_data, dict):
        data_obj = raw_data.get("data")
        if isinstance(data_obj, dict):
            result = data_obj.get("result")
            if isinstance(result, list):
                candidates = result

    # 2. 兜底：仍然保留之前的宽松逻辑，避免接口结构轻微变化时直接失败
    if candidates is None:
        if isinstance(raw_data, dict):
            for key in ("data", "rows", "result", "list"):
                value = raw_data.get(key)
                if isinstance(value, list):
                    candidates = value
                    break
        if candidates is None and isinstance(raw_data, list):
            candidates = raw_data

    if not isinstance(candidates, list):
        # 结构不符合预期，返回空列表但不中断程序
        print("[警告] 未能在返回值中找到馆信息列表字段(data.result / data/rows/...)，将输出空列表。", file=sys.stderr)
        return []

    # 3. 过滤掉不需要保留到 library_info.json 里的字段
    #    地图相关字段仅保留在 map 子对象中，不再出现在最外层
    excluded_keys = {
        "opentime_se",
        "website",
        "tel_se",
        "pic",
        "id",
        "address_se",
        "baidux",
        "baiduy",
        "tencentx",
        "tencenty",
        "gcode",
    }

    brief_list: List[Dict[str, Any]] = []
    for item in candidates:
        if not isinstance(item, dict):
            continue

        # 先过滤不需要的字段
        filtered = {k: v for k, v in item.items() if k not in excluded_keys}

        # 再增加一个 map 字段，把地图相关字段集中放进去
        map_info = {
            "baidux": item.get("baidux"),
            "baiduy": item.get("baiduy"),
            "tencentx": item.get("tencentx"),
            "tencenty": item.get("tencenty"),
            "gcode": item.get("gcode"),
        }
        filtered["map"] = map_info

        brief_list.append(filtered)

    return brief_list


def save_json(data: Any, path: Path) -> None:
    """将数据以 UTF-8 编码保存为 JSON 文件。"""
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def generate_library_files(project_root: Path | None = None) -> Dict[str, Any]:
    """
    根据指定日期拉取馆信息并生成带日期后缀的两个 JSON 文件。

    文件命名规则示例：
    - library_info.raw.yyyyMMdd.json
    - library_info.yyyyMMdd.json
    """
    if project_root is None:
        project_root = Path(__file__).resolve().parent

    try:
        raw_data = fetch_library_info()
    except Exception:
        # 错误信息已在 fetch_library_info 中输出，这里统一向上抛出
        raise

    brief_data = extract_brief_info(raw_data)

    raw_path = project_root / f"library_info.raw.json"
    brief_path = project_root / f"library_info.json"

    save_json(raw_data, raw_path)
    save_json(brief_data, brief_path)

    print(f"[完成] 已保存原始数据到 {raw_path}")
    print(f"[完成] 已保存精简数据到 {brief_path}，共 {len(brief_data)} 条记录。")

    return {
        "count": len(brief_data),
    }


def main() -> None:
    """
    保留命令行入口
    """
    try:
        generate_library_files()
    except Exception:
        # generate_library_files 已打印详细错误，这里统一非零退出
        sys.exit(1)


if __name__ == "__main__":
    main()

