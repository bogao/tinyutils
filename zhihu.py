#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
知乎个人回答索引爬取脚本
抓取字段：问题标题、回答链接、赞同/评论/收藏/转发/感谢数、时间
"""

import random
import requests
import json
import time
from pathlib import Path
from datetime import datetime

# ============================================================
# 配置区 —— 只需改这里
# ============================================================
URL_TOKEN    = "gaobo"              # 你的知乎个人页 url_token
SLEEP_MIN    = 1.5                  # 请求间隔最小秒数
SLEEP_MAX    = 7.5                  # 请求间隔最大秒数
OUTPUT       = "zhihu_answers.json"
START_OFFSET = 0                    # 从第几条开始，0 表示从头
END_OFFSET   = None                 # 到第几条结束，None 表示抓到底
                                    # 例：START_OFFSET=100, END_OFFSET=200 只抓第100~200条

# 从浏览器 Application → Cookies → zhihu.com 里复制
Z_C0 = "2|1:0|10:1771519838|4:z_c0|92:Mi4xaFMwQUFBQUFBQUJmVlpUTDd3YXFHeVlBQUFCZ0FsVk5vRXlCYWdDTFA4aG5tTGt2cFNQdWhlbFdVXzEzdC1GTFln|d005f2f7454f3ba1daef4f965dbd82fb015f08ee3d99a9ae035c4585f3d8ffe3"
D_C0 = "X1WUy-8GqhuPTo_PY27qC21PxS8EWBa2iBs=|1768046793"
# ============================================================

COOKIE = f'd_c0="{D_C0}"; z_c0="{Z_C0}"'

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
    "Cookie":           COOKIE,
    "Authorization":    f"Bearer {Z_C0}",
    "X-UDID":           D_C0,
    "Referer":          f"https://www.zhihu.com/people/{URL_TOKEN}",
    "x-requested-with": "fetch",
}

INCLUDE = (
    "data[*].is_normal,admin_closed_comment,is_collapsed,"
    "collapse_reason,collapsed_by,suggest_edit,comment_count,"
    "can_comment,voteup_count,reshipment_settings,comment_permission,"
    "mark_infos,created_time,updated_time,review_info,question,"
    "excerpt,is_thanked,is_nothelp"
)


def ts_to_str(ts: int) -> str:
    if not ts:
        return ""
    return datetime.fromtimestamp(ts).strftime("%Y-%m-%d %H:%M:%S")


ANSWER_INCLUDE = (
    "voteup_count,comment_count,mark_infos,created_time,updated_time,question"
)


def fetch_answer_detail(aid: str) -> dict:
    """单独请求某条回答的详情，获取 voteup_count 等完整字段"""
    url = f"https://www.zhihu.com/api/v4/answers/{aid}"
    params = {"include": ANSWER_INCLUDE}
    try:
        resp = requests.get(url, headers=HEADERS, params=params, timeout=15)
        if resp.status_code == 200:
            return resp.json()
    except requests.RequestException:
        pass
    return {}


def fetch_answers() -> list:
    results = []
    seen_aids = set()
    offset = START_OFFSET
    page = START_OFFSET // 20 + 1

    while True:
        url = f"https://www.zhihu.com/api/v4/members/{URL_TOKEN}/answers"
        params = {
            "offset":  offset,
            "limit":   20,
            "sort_by": "created",
            "include": INCLUDE,
        }

        try:
            resp = requests.get(url, headers=HEADERS, params=params, timeout=15)
        except requests.RequestException as e:
            print(f"  请求异常: {e}，中止")
            break

        if resp.status_code == 403:
            print("  ❌ 403 —— Cookie 已过期，请更新 Z_C0 和 D_C0")
            break
        if resp.status_code != 200:
            print(f"  ❌ HTTP {resp.status_code}: {resp.text[:300]}")
            break

        data = resp.json()

        if "error" in data:
            err = data["error"]
            print(f"  ❌ 知乎返回错误: [{err.get('code')}] {err.get('message')}")
            break

        items = data.get("data", [])

        for i, item in enumerate(items):
            question = item.get("question", {})
            qid = question.get("id", "")
            aid = item.get("id", "")
            stats = item.get("reaction", {}).get("statistics", {})

            # 单独请求详情获取 voteup_count 和完整问题标题
            detail = fetch_answer_detail(aid)
            voteup = detail.get("voteup_count", 0)
            # 列表 API 的标题是完整的，详情 API 反而会截断
            full_title = question.get("title", "")
            time.sleep(random.uniform(SLEEP_MIN, SLEEP_MAX))

            # 按 answer_id 去重（API 分页 bug 可能重复返回同一条）
            if aid in seen_aids:
                continue
            seen_aids.add(aid)

            results.append({
                "question_id":      qid,
                "question_title":   full_title,
                "answer_id":        aid,
                "answer_url":       f"https://www.zhihu.com/answer/{aid}",
                "voteup_count":     voteup,
                "like_count":       stats.get("like_count", 0),
                "comment_count":    item.get("comment_count", 0),
                "favorites_count":  stats.get("favorites", 0),
                "reshipment_count": item.get("reshipment_count", 0),
                "created":          ts_to_str(item.get("created_time")),
                "updated":          ts_to_str(item.get("updated_time")),
            })
            print(f"    [{len(results):>4}] voteup={voteup:>6} | {question.get('title','')[:35]}")

        paging = data.get("paging", {})
        total  = paging.get("totals", "?")
        is_end = paging.get("is_end", True)

        print(f"  第 {page:>3} 页完成 | 累计 {len(results):>4} / {total}")

        # 已达到指定结束位置则停止
        if END_OFFSET is not None and len(results) >= END_OFFSET - START_OFFSET:
            break

        if is_end or not items:
            break

        offset += 20
        page   += 1
        time.sleep(random.uniform(SLEEP_MIN, SLEEP_MAX))

    return results


def main():
    print(f"=== 开始抓取 @{URL_TOKEN} 的回答索引 ===\n")
    answers = fetch_answers()

    if not answers:
        print("\n未抓到任何数据，请检查 Z_C0 和 D_C0 是否正确。")
        return

    out = Path(OUTPUT)
    # 追加模式：如果文件已存在则读取合并，避免断点续抓覆盖之前数据
    existing = []
    if out.exists() and START_OFFSET > 0:
        try:
            existing = json.loads(out.read_text(encoding="utf-8"))
            print(f"  已读取现有 {len(existing)} 条，合并后写入")
        except Exception:
            pass
    all_answers = existing + answers
    out.write_text(json.dumps(all_answers, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\n✅ 完成！本次抓取 {len(answers)} 条，合计 {len(all_answers)} 条，已保存到 {out.resolve()}")

    total_voteup = sum(a["voteup_count"] for a in answers)
    top5 = sorted(answers, key=lambda x: x["voteup_count"], reverse=True)[:5]
    print(f"\n📊 总赞同数：{total_voteup:,}")
    print("🏆 赞同数 Top 5：")
    for i, a in enumerate(top5, 1):
        print(f"  {i}. [{a['voteup_count']:>6} 赞] {a['question_title'][:40]}")
        print(f"         {a['answer_url']}")


if __name__ == "__main__":
    main()