---
name: "databrain-token-refresh"
description: "刷新情报系统（DataBrain）的认证 Token。当用户需要刷新 test、pre 或 prod 环境的 token 时触发此 skill。支持从用户输入中读取环境参数，通过登录接口获取最新 token，并返回给用户。"
---

# DataBrain Token 刷新 Skill

## 功能说明

此 skill 用于刷新 DataBrain 情报系统的认证 token，支持 test、pre、prod 三个环境。通过调用登录接口，使用本地环境变量中存储的用户名和密码进行登录，从响应头的 `authorization` 字段获取 token。

## 支持的环境

| 环境 | 登录接口地址 |
|------|-------------|
| test | http://ogdb-test.intlgame.com/api/v1/auth/login |
| pre | https://ogdb-pre.intlgame.com/api/v1/auth/login |
| prod | https://ogdb.intlgame.com/api/v1/auth/login |

## 登录接口

- **请求方法**: POST
- **Content-Type**: application/json
- **请求参数**:

| 参数名 | 类型 | 说明 |
|--------|------|------|
| login_type | string | 固定值 "Basic" |
| user_name | string | 用户名 |
| password | string | 密码 |

- **Token 获取方式**: 从响应头的 `authorization` 字段获取

## 环境变量配置

每个环境通过本地环境变量读取登录凭据：

| 环境 | 用户名变量 | 密码变量 |
|------|-----------|---------|
| test | DATABRAIN_TEST_USERNAME | DATABRAIN_TEST_PASSWORD |
| pre | DATABRAIN_PRE_USERNAME | DATABRAIN_PRE_PASSWORD |
| prod | DATABRAIN_PROD_USERNAME | DATABRAIN_PROD_PASSWORD |

## 工作流程

### 1. 解析环境参数

从用户输入中识别目标环境，支持以下环境标识：
- `test`、`测试`、`t`
- `pre`、`预发`、`p`
- `prod`、`生产`、`online`

### 2. 读取环境变量

根据识别的环境，从本地环境变量中读取对应的用户名和密码：
- 用户名: `DATABRAIN_{ENV}_USERNAME`
- 密码: `DATABRAIN_{ENV}_PASSWORD`

如果环境变量未设置，提示用户先配置对应的环境变量。

### 3. 调用登录接口

使用读取到的用户名和密码，发起 POST 请求到对应环境的登录接口：

```json
{
  "login_type": "Basic",
  "user_name": "<用户名>",
  "password": "<密码>"
}
```

### 4. 提取 Token

从响应头的 `authorization` 字段获取 token 并输出给用户。

## 实现代码

```python
import requests
import os
import sys
import platform

# 环境配置：登录接口地址
ENVIRONMENTS = {
    "test": "http://ogdb-test.intlgame.com/api/v1/auth/login",
    "pre": "https://ogdb-pre.intlgame.com/api/v1/auth/login",
    "prod": "https://ogdb.intlgame.com/api/v1/auth/login"
}

# 环境变量名映射
ENV_CREDENTIALS = {
    "test": {
        "username": "DATABRAIN_TEST_USERNAME",
        "password": "DATABRAIN_TEST_PASSWORD"
    },
    "pre": {
        "username": "DATABRAIN_PRE_USERNAME",
        "password": "DATABRAIN_PRE_PASSWORD"
    },
    "prod": {
        "username": "DATABRAIN_PROD_USERNAME",
        "password": "DATABRAIN_PROD_PASSWORD"
    }
}

def get_env_var(name: str) -> str:
    """
    读取环境变量，兼容 Windows 系统级/用户级和进程级环境变量
    """
    value = os.environ.get(name)
    if value:
        return value

    if platform.system() == "Windows":
        try:
            import winreg
            try:
                key = winreg.OpenKey(winreg.HKEY_CURRENT_USER, r"Environment")
                value, _ = winreg.QueryValueEx(key, name)
                winreg.CloseKey(key)
                if value:
                    return value
            except (FileNotFoundError, OSError):
                pass
            try:
                key = winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE, r"SYSTEM\CurrentControlSet\Control\Session Manager\Environment")
                value, _ = winreg.QueryValueEx(key, name)
                winreg.CloseKey(key)
                if value:
                    return value
            except (FileNotFoundError, OSError):
                pass
        except ImportError:
            pass

    return None

def login_and_get_token(env: str) -> str:
    """
    通过登录接口获取 DataBrain token

    Args:
        env: 环境标识 (test/pre/prod)

    Returns:
        最新的 token 字符串

    Raises:
        ValueError: 无效的环境参数或缺少环境变量
        requests.RequestException: API 请求失败
    """
    if env not in ENVIRONMENTS:
        raise ValueError(f"不支持的环境: {env}，可选值: {list(ENVIRONMENTS.keys())}")

    # 读取环境变量中的凭据（兼容系统级/用户级/进程级）
    cred_keys = ENV_CREDENTIALS[env]
    username = get_env_var(cred_keys["username"])
    password = get_env_var(cred_keys["password"])

    if not username or not password:
        missing = []
        if not username:
            missing.append(cred_keys["username"])
        if not password:
            missing.append(cred_keys["password"])
        raise ValueError(f"缺少环境变量: {', '.join(missing)}，请先配置对应环境的登录凭据")

    url = ENVIRONMENTS[env]
    payload = {
        "login_type": "Basic",
        "user_name": username,
        "password": password
    }

    print(f"正在登录 {env} 环境获取 token...")
    print(f"请求地址: {url}")

    response = requests.post(url, json=payload, timeout=30)
    response.raise_for_status()

    # 从响应头获取 authorization token
    token = response.headers.get("authorization") or response.headers.get("Authorization")

    if not token:
        raise ValueError(f"响应头中未找到 authorization 字段，响应头: {dict(response.headers)}")

    return token

def main():
    if len(sys.argv) < 2:
        print("用法: python refresh_token.py <env>")
        print("环境可选值: test, pre, prod")
        sys.exit(1)

    env = sys.argv[1].lower()

    # 支持别名
    env_aliases = {
        "t": "test",
        "测试": "test",
        "p": "pre",
        "预发": "pre",
        "online": "prod",
        "生产": "prod"
    }

    env = env_aliases.get(env, env)

    try:
        token = login_and_get_token(env)
        print(f"✅ Token 获取成功")
        print(f"环境: {env}")
        print(f"Token: {token}")
    except ValueError as e:
        print(f"❌ 参数错误: {e}")
        sys.exit(1)
    except requests.RequestException as e:
        print(f"❌ 请求失败: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
```

## 使用示例

**用户输入**:
```
刷新 test 环境的 token
```

**Skill 执行**:
1. 识别环境为 `test`
2. 读取环境变量 `DATABRAIN_TEST_USERNAME` 和 `DATABRAIN_TEST_PASSWORD`
3. 调用 `http://ogdb-test.intlgame.com/api/v1/auth/login`，传入登录参数
4. 从响应头的 `authorization` 字段提取 token
5. 输出 token

**输出示例**:
```
✅ Token 获取成功
环境: test
Token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## 前置条件

使用此 skill 前需确保已配置对应环境的环境变量：

```bash
# test 环境
export DATABRAIN_TEST_USERNAME="your_username"
export DATABRAIN_TEST_PASSWORD="your_password"

# pre 环境
export DATABRAIN_PRE_USERNAME="your_username"
export DATABRAIN_PRE_PASSWORD="your_password"

# prod 环境
export DATABRAIN_PROD_USERNAME="your_username"
export DATABRAIN_PROD_PASSWORD="your_password"
```

Windows 系统可通过以下方式设置：
```powershell
[System.Environment]::SetEnvironmentVariable("DATABRAIN_TEST_USERNAME", "your_username", "User")
[System.Environment]::SetEnvironmentVariable("DATABRAIN_TEST_PASSWORD", "your_password", "User")
```
