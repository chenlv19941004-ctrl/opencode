#!/usr/bin/env python3
"""
情报系统菜单更新脚本
用于更新情报系统（DataBrain）的菜单配置，并刷新菜单缓存
"""

import requests
import sys
import json
import argparse

# 环境配置
ENVIRONMENTS = {
    "test": "http://databrain-test.intlgame.com",
    "pre": "https://databrain-pre.intlgame.com",
    "prod": "https://databrain.intlgame.com"
}

# 环境别名映射
ENV_ALIASES = {
    "t": "test",
    "测试": "test",
    "p": "pre",
    "预发": "pre",
    "online": "prod",
    "生产": "prod"
}


def update_menu(env: str, token: str, menu_data: str) -> dict:
    """
    更新指定环境的菜单数据

    Args:
        env: 环境标识 (test/pre/prod)
        token: 认证 token
        menu_data: 菜单数据 JSON 字符串

    Returns:
        接口响应数据

    Raises:
        ValueError: 无效的环境参数
        requests.RequestException: API 请求失败
    """
    if env not in ENVIRONMENTS:
        raise ValueError(f"不支持的环境: {env}，可选值: {list(ENVIRONMENTS.keys())}")

    base_url = ENVIRONMENTS[env]
    url = f"{base_url}/api/v1/intelligence_pc/hotfix/menu/insert"

    headers = {
        "Authorization": token,
        "Content-Type": "application/json"
    }

    # 构造请求体: menu 字段需要 JSON.stringify
    payload = {
        "hotfix": "更新菜单",
        "menu": menu_data  # menu_data 已经是 JSON 字符串
    }

    print(f"🔄 正在更新菜单...")
    print(f"环境: {env}")
    print(f"请求地址: {url}")

    response = requests.post(url, headers=headers, json=payload, timeout=30)
    response.raise_for_status()

    data = response.json()
    print(f"\n✅ 菜单更新成功")
    print(f"响应: {json.dumps(data, ensure_ascii=False, indent=2)}")

    return data


def refresh_menu_cache(env: str, token: str) -> dict:
    """
    刷新指定环境的菜单缓存

    Args:
        env: 环境标识 (test/pre/prod)
        token: 认证 token

    Returns:
        接口响应数据

    Raises:
        ValueError: 无效的环境参数
        requests.RequestException: API 请求失败
    """
    if env not in ENVIRONMENTS:
        raise ValueError(f"不支持的环境: {env}，可选值: {list(ENVIRONMENTS.keys())}")

    base_url = ENVIRONMENTS[env]
    url = f"{base_url}/api/v1/intelligence_pc/listMenuSnapshot?interfaceCache=false"

    headers = {
        "Authorization": token
    }

    print(f"\n🔄 正在刷新菜单缓存...")
    print(f"请求地址: {url}")

    response = requests.post(url, headers=headers, timeout=30)
    response.raise_for_status()

    data = response.json()
    print(f"\n✅ 菜单缓存刷新成功")
    print(f"响应: {json.dumps(data, ensure_ascii=False, indent=2)[:500]}...")

    return data


def main():
    parser = argparse.ArgumentParser(description="情报系统菜单更新工具")
    parser.add_argument("--env", required=True, help="环境标识 (test/pre/prod)")
    parser.add_argument("--token", required=True, help="认证 token")
    parser.add_argument("--menu", required=True, help="菜单数据 JSON 字符串")

    args = parser.parse_args()

    # 环境别名转换
    env = ENV_ALIASES.get(args.env.lower(), args.env.lower())

    try:
        # 第一步：更新菜单
        update_result = update_menu(env, args.token, args.menu)

        # 检查更新接口是否返回成功
        # 常见成功标识: {"code": 0} 或 {"code": 200} 或 {"success": true}
        is_success = False
        if isinstance(update_result, dict):
            code = update_result.get("code")
            if code in (0, 200, "0", "200"):
                is_success = True
            elif update_result.get("success") is True:
                is_success = True
            elif update_result.get("msg") == "success":
                is_success = True

        if not is_success:
            print(f"\n⚠️ 菜单更新接口返回异常，但仍继续刷新缓存")
            print(f"响应: {json.dumps(update_result, ensure_ascii=False, indent=2)}")

        # 第二步：刷新菜单缓存
        refresh_result = refresh_menu_cache(env, args.token)

        print(f"\n🎉 菜单更新完成！环境: {env}")

    except ValueError as e:
        print(f"❌ 参数错误: {e}")
        sys.exit(1)
    except requests.RequestException as e:
        print(f"❌ 请求失败: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"❌ 未知错误: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
