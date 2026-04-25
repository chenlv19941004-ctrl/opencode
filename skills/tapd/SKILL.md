---
name: tapd
description: 通过 TAPD API 管理需求、缺陷、任务、迭代、测试用例、Wiki、评论、工时、发布计划等研发全生命周期。用户提及 tapd、需求、缺陷、bug、迭代、任务或相关操作时触发。
---

# TAPD 研发管理

通过调用本 skill 目录下的 `scripts/tapd.js` 脚本与 TAPD API 交互，覆盖需求、缺陷、任务、迭代、Wiki、测试用例、评论、工时、发布计划等管理功能。零外部依赖，仅需 Node.js。

## 定位脚本路径

本 SKILL.md 所在目录即为 skill 根目录。脚本位于同级 `scripts/tapd.js`。

**调用时必须使用相对于本文件的路径来定位脚本**，方法如下：

1. 取本 SKILL.md 的绝对路径（读取本文件时已知）
2. 将文件名替换为 `scripts/tapd.js`

例如：若本文件路径为 `/home/user/.cursor/skills/tapd/SKILL.md`，则脚本路径为 `/home/user/.cursor/skills/tapd/scripts/tapd.js`。Windows 下同理，如 `C:\Users\xxx\.cursor\skills\tapd\SKILL.md` → `C:\Users\xxx\.cursor\skills\tapd\scripts\tapd.js`。

**禁止写死任何绝对路径**，始终从本文件位置推导。

## 前置配置

脚本通过环境变量获取凭据（二选一）：

| 环境变量 | 说明 |
|---------|------|
| `TAPD_ACCESS_TOKEN` | 个人访问令牌（推荐） |
| `TAPD_API_USER` + `TAPD_API_PASSWORD` | API 账号密码 |
| `TAPD_API_BASE_URL` | API 地址，默认 `https://apiv2.tapd.tencent.com` |
| `TAPD_BASE_URL` | 前端地址，默认 `https://tapd.tencent.com` |
| `BOT_URL` | 企业微信机器人 webhook（可选） |

## 调用方式

所有操作统一通过 Shell 工具执行：

```bash
node <SKILL目录>/scripts/tapd.js <command> [--参数名 值 ...]
```

JSON 类型参数使用引号包裹：`--options "{\"key\": \"value\"}"`

Windows PowerShell 下 JSON 参数用双引号并转义内部引号：`--options '{\"key\":\"value\"}'`

## 命令速查

### 项目与用户

| 命令 | 说明 | 必填参数 |
|------|------|---------|
| `projects` | 获取用户参与的项目列表 | `--nick` 用户昵称 |
| `workspace-info` | 获取项目信息 | `--workspace-id` |

### 需求/任务

| 命令 | 说明 | 必填参数 |
|------|------|---------|
| `get-stories` | 查询需求或任务 | `--workspace-id`，`--options '{"entity_type":"stories"}'` |
| `get-story-count` | 获取需求/任务数量 | `--workspace-id`，`--options '{"entity_type":"stories"}'` |
| `create-story` | 创建需求或任务 | `--workspace-id --name 标题`，`--options '{"entity_type":"stories"}'` |
| `update-story` | 更新需求或任务 | `--workspace-id`，`--options '{"entity_type":"stories","id":"xxx"}'` |
| `fields-label` | 获取需求字段中英文 | `--workspace-id` |
| `fields-info` | 获取需求字段及候选值 | `--workspace-id` |
| `custom-fields` | 获取自定义字段配置 | `--workspace-id`，`--options '{"entity_type":"stories"}'` |
| `workitem-types` | 获取需求类别 | `--workspace-id` |

### 缺陷

| 命令 | 说明 | 必填参数 |
|------|------|---------|
| `get-bugs` | 查询缺陷 | `--workspace-id` |
| `get-bug-count` | 获取缺陷数量 | `--workspace-id` |
| `create-bug` | 创建缺陷 | `--workspace-id --title 标题` |
| `update-bug` | 更新缺陷 | `--workspace-id`，`--options '{"id":"xxx"}'` |

### 迭代

| 命令 | 说明 | 必填参数 |
|------|------|---------|
| `get-iterations` | 查询迭代 | `--workspace-id` |
| `create-iteration` | 创建迭代 | `--workspace-id`，`--options '{"name":"","startdate":"","enddate":"","creator":""}'` |
| `update-iteration` | 更新迭代 | `--workspace-id`，`--options '{"id":"","current_user":""}'` |

### 评论

| 命令 | 说明 | 必填参数 |
|------|------|---------|
| `get-comments` | 查询评论 | `--workspace-id` |
| `create-comment` | 添加评论 | `--workspace-id`，`--options '{"entry_id":"","entry_type":"stories","author":"","description":""}'` |
| `update-comment` | 更新评论 | `--workspace-id`，`--options '{"id":"","description":"","change_creator":""}'` |

### Wiki

| 命令 | 说明 | 必填参数 |
|------|------|---------|
| `get-wiki` | 查询 Wiki | `--workspace-id` |
| `create-wiki` | 创建 Wiki | `--workspace-id`，`--options '{"name":"","creator":"","markdown_description":""}'` |
| `update-wiki` | 更新 Wiki | `--workspace-id`，`--options '{"id":"","name":""}'` |

### 测试用例

| 命令 | 说明 | 必填参数 |
|------|------|---------|
| `get-tcases` | 查询测试用例 | `--workspace-id` |
| `create-tcase` | 创建测试用例 | `--workspace-id`，`--options '{"name":""}'` |
| `create-tcases-batch` | 批量创建测试用例 | `--workspace-id`，`--options '{"tcases":[{"name":""}]}'` |

### 工时

| 命令 | 说明 | 必填参数 |
|------|------|---------|
| `get-timesheets` | 查询工时 | `--workspace-id` |
| `add-timesheet` | 填写工时 | `--workspace-id`，`--options '{"entity_type":"story","entity_id":"","timespent":"1h"}'` |
| `update-timesheet` | 更新工时 | `--workspace-id`，`--options '{"id":"","timespent":"2h"}'` |

### 工作流

| 命令 | 说明 | 必填参数 |
|------|------|---------|
| `workflow-transitions` | 获取状态流转规则 | `--workspace-id`，`--options '{"system":"story","workitem_type_id":""}'` |
| `workflow-status-map` | 获取状态中英文映射 | `--workspace-id`，`--options '{"system":"story","workitem_type_id":""}'` |
| `workflow-last-steps` | 获取结束状态 | `--workspace-id`，`--options '{"system":"story"}'` |

### 其他

| 命令 | 说明 | 必填参数 |
|------|------|---------|
| `get-todo` | 获取待办 | `--workspace-id --entity-type story/bug/task` |
| `related-bugs` | 获取需求关联缺陷 | `--workspace-id`，`--options '{"story_id":""}'` |
| `entity-relations` | 创建关联关系 | `--workspace-id`，`--options '{"source_type":"","target_type":"","source_id":"","target_id":""}'` |
| `get-image` | 获取图片下载链接 | `--workspace-id`，`--options '{"image_path":""}'` |
| `get-attachments` | 获取附件信息 | `--workspace-id`，`--options '{"entry_id":"","type":"story"}'` |
| `commit-msg` | 获取源码提交关键字 | `--workspace-id`，`--options '{"object_id":"","type":"story"}'` |
| `release-info` | 获取发布计划 | `--workspace-id` |
| `send-message` | 发送企业微信消息 | `--msg "消息内容"` |

## 使用注意事项

1. **自定义字段**：使用 `custom_field_*` 查询/创建前，必须先调用 `custom-fields` 获取字段配置
2. **状态流转**：更新需求状态前，先调用 `workflow-transitions` 查看可流转状态；任务状态固定为 open/progressing/done
3. **优先级**：需求优先级使用 `priority_label`（High/Middle/Low/Nice To Have），缺陷优先级使用 `priority_label`（urgent/high/medium/low/insignificant）
4. **分页**：默认 limit=10（需求/任务/缺陷），limit=30（评论/Wiki/测试用例），可通过 limit+page 翻页
5. **ID 处理**：短 ID（≤9位）会自动补齐为长 ID
6. **链接格式**：
   - 需求：`{TAPD_BASE_URL}/{workspace_id}/prong/stories/view/{id}`
   - 任务：`{TAPD_BASE_URL}/{workspace_id}/prong/tasks/view/{id}`
   - 缺陷：`{TAPD_BASE_URL}/{workspace_id}/bugtrace/bugs/view/{id}`
   - 迭代：`{TAPD_BASE_URL}/{workspace_id}/prong/iterations/card_view/{id}`
   - Wiki：`{TAPD_BASE_URL}/{workspace_id}/markdown_wikis/show/#{id}`
   - 测试用例：`{TAPD_BASE_URL}/{workspace_id}/sparrow/tcase/view/{id}`
7. **描述字段**：支持 Markdown，脚本会自动转换为 HTML

## 使用示例

假设脚本路径已根据本文件推导为 `TAPD_SCRIPT`：

```bash
# 查看用户参与的项目
node $TAPD_SCRIPT projects --nick zhangsan

# 查询某项目下的需求
node $TAPD_SCRIPT get-stories --workspace-id 12345678 --options '{"entity_type":"stories","owner":"zhangsan","limit":20}'

# 创建一个缺陷
node $TAPD_SCRIPT create-bug --workspace-id 12345678 --title "登录页面报错" --options '{"severity":"serious","description":"点击登录按钮后返回500错误"}'

# 获取迭代列表
node $TAPD_SCRIPT get-iterations --workspace-id 12345678 --options '{"status":"open"}'

# 获取待办需求
node $TAPD_SCRIPT get-todo --workspace-id 12345678 --entity-type story
```
