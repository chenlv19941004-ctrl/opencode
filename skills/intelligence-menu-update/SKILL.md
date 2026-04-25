---
name: "intelligence-menu-update"
description: "修改情报系统（DataBrain）的菜单配置。当用户需要更新、修改、配置情报系统菜单时触发此 skill。支持从用户输入中读取环境参数和菜单数据，先调用 databrain-token-refresh skill 刷新 token，再调用菜单更新接口和菜单缓存刷新接口，完成菜单配置的完整更新流程。"
---

# 情报系统菜单更新 Skill

## 功能说明

此 skill 用于更新 DataBrain 情报系统的菜单配置，支持 test、pre、prod 三个环境。执行流程为：刷新 token → 更新菜单数据 → 刷新菜单缓存。

## 支持的环境

| 环境 | 别名 | Base URL |
|------|------|----------|
| test | 测试、t | http://databrain-test.intlgame.com |
| pre | 预发、p | https://databrain-pre.intlgame.com |
| prod | 生产、online | https://databrain.intlgame.com |

## API 接口说明

### 更新菜单数据接口

- **请求方法**: POST
- **Content-Type**: application/json
- **请求头**: `Authorization: {token}`
- **请求体**: `{ "hotfix": "更新菜单", "menu": JSON.stringify(菜单数据) }`

| 环境 | 接口地址 |
|------|----------|
| test | http://databrain-test.intlgame.com/api/v1/intelligence_pc/hotfix/menu/insert |
| pre | https://databrain-pre.intlgame.com/api/v1/intelligence_pc/hotfix/menu/insert |
| prod | https://databrain.intlgame.com/api/v1/intelligence_pc/hotfix/menu/insert |

### 拉取菜单数据接口（刷新缓存）

- **请求方法**: POST
- **请求头**: `Authorization: {token}`
- **查询参数**: `interfaceCache=false`

| 环境 | 接口地址 |
|------|----------|
| test | http://databrain-test.intlgame.com/api/v1/intelligence_pc/listMenuSnapshot?interfaceCache=false |
| pre | https://databrain-pre.intlgame.com/api/v1/intelligence_pc/listMenuSnapshot?interfaceCache=false |
| prod | https://databrain.intlgame.com/api/v1/intelligence_pc/listMenuSnapshot?interfaceCache=false |

## 工作流程

### 1. 解析环境参数和菜单数据

从用户输入中识别：
- **目标环境**: 支持 test/测试/t、pre/预发/p、prod/生产/online 等别名
- **菜单数据**: 用户提供的菜单 JSON 数据（可以是直接提供的 JSON、文件路径、或从对话上下文中提取）

如果用户未提供菜单数据，主动询问用户提供菜单数据或菜单数据文件路径。

### 2. 刷新 Token

调用 `databrain-token-refresh` skill 刷新对应环境的 token：
- 使用 `use_skill` 工具加载 `databrain-token-refresh` skill
- 运行 `refresh_token.py` 脚本获取最新 token
- 提取返回的 token 值，作为后续接口请求的 `Authorization` 请求头

### 3. 更新菜单数据

运行 `scripts/update_menu.py` 脚本，传入环境参数、token 和菜单数据：

```bash
python scripts/update_menu.py --env <env> --token <token> --menu '<menu_json_string>'
```

脚本将：
1. 根据环境拼接更新菜单接口地址
2. 构造请求体 `{ "hotfix": "更新菜单", "menu": JSON.stringify(菜单数据) }`
3. 发送 POST 请求到更新菜单接口
4. 验证接口返回是否成功

### 4. 刷新菜单缓存

菜单更新成功后，脚本自动继续：
1. 根据环境拼接拉取菜单接口地址（带 `interfaceCache=false` 参数）
2. 发送 POST 请求到拉取菜单接口
3. 验证接口返回是否成功
4. 输出最终结果

## 脚本说明

### scripts/update_menu.py

核心执行脚本，接收环境、token 和菜单数据参数，完成菜单更新和缓存刷新两步操作。

**参数**:
- `--env`: 环境标识（test/pre/prod），必填
- `--token`: 认证 token，必填
- `--menu`: 菜单数据 JSON 字符串，必填

**执行逻辑**:
1. 验证参数完整性
2. 根据环境获取对应接口地址
3. 调用更新菜单接口 (POST)
4. 更新成功后调用拉取菜单接口刷新缓存 (GET)
5. 输出每一步的执行结果

## 使用示例

**用户输入**:
```
更新 test 环境的菜单，菜单数据如下：
[{"id": 1, "name": "菜单1", "path": "/menu1"}]
```

**Skill 执行**:
1. 识别环境为 `test`
2. 调用 `databrain-token-refresh` skill 刷新 test 环境的 token
3. 运行 `update_menu.py --env test --token <token> --menu '[{"id":1,"name":"菜单1","path":"/menu1"}]'`
4. 脚本自动完成：更新菜单 → 刷新缓存
5. 输出最终结果

**输出示例**:
```
🔄 正在更新菜单...
环境: test
请求地址: http://databrain-test.intlgame.com/api/v1/intelligence_pc/hotfix/menu/insert

✅ 菜单更新成功
响应: {"code": 0, "msg": "success"}

🔄 正在刷新菜单缓存...
请求地址: http://databrain-test.intlgame.com/api/v1/intelligence_pc/listMenuSnapshot?interfaceCache=false

✅ 菜单缓存刷新成功

🎉 菜单更新完成！环境: test
```
