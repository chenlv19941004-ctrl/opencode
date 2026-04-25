---
name: tencent-cls-query
description: 当用户需要从腾讯云cls中查询日志时触发。支持环境变量配置默认日志主题，用户可以不指定主题直接查询。
---

# Tencent CLS 日志查询 Skill

## 触发条件

当用户请求查询腾讯云CLS日志服务时使用此skill，例如：
- "查询CLS日志"
- "查询腾讯云日志"
- "搜索CLS日志"
- "从CLS获取日志"
- "查看xxx主题的日志"

## 环境变量

脚本自动从环境变量读取配置，缺失时脚本会报错提示用户。

| 环境变量 | 说明 | 必填 |
|----------|------|------|
| `TENCENTCLOUD_SECRET_ID` | 腾讯云 SecretId | 是 |
| `TENCENTCLOUD_SECRET_KEY` | 腾讯云 SecretKey | 是 |
| `CLS_DEFAULT_TOPIC_ID` | 默认日志主题ID | 否 |
| `CLS_DEFAULT_TOPIC_NAME` | 默认日志主题名称 | 否 |
| `CLS_DEFAULT_REGION` | 默认地域 | 否 |
| `CLS_DECRYPT_KEY` | AES解密密钥（32字节字符串） | 否 |
| `CLS_DECRYPT_TOPICS` | 需要解密的主题列表（逗号分隔，支持主题ID或主题名称） | 否 |

当用户未指定主题时，脚本自动使用 `CLS_DEFAULT_TOPIC_ID`/`CLS_DEFAULT_TOPIC_NAME` 和 `CLS_DEFAULT_REGION` 作为默认值。用户显式指定的参数始终优先。

### 日志解密功能

当配置了 `CLS_DECRYPT_KEY` 和 `CLS_DECRYPT_TOPICS` 时，对于指定主题的日志中的 `msg` 字段会自动进行 AES-CFB 解密：

- **解密算法**：AES-256-CFB（无填充）
- **密文格式**：URL安全Base64编码，前16字节为IV，后续为实际密文
- **密钥要求**：32字节字符串（如 `c82a5c425dae64d17a5b19f9ca37f2df`）
- **触发条件**：`msg` 字段值不包含空格（避免重复解密）
- **主题匹配**：支持主题ID或主题名称，如 `databrain-new-pc` 或 `92ae7340-98e6-41da-8442-a7ccfbb8fe8b`

配置示例：
```bash
export CLS_DECRYPT_KEY="your-32-byte-secret-key-here"
export CLS_DECRYPT_TOPICS="databrain-new-pc,mgmt-prod"
```

## 使用流程

### 1. 定位脚本路径

**关键：脚本位于本SKILL.md同级的 `scripts/query.js`，必须通过此SKILL.md文件的路径来动态定位脚本，禁止写死绝对路径。**

方法：用此SKILL.md的所在目录拼接 `scripts/query.js` 得到脚本的完整路径。例如如果SKILL.md在 `/home/user/.claude/skills/tencent-cls-query/SKILL.md`，则脚本路径为 `/home/user/.claude/skills/tencent-cls-query/scripts/query.js`。

### 2. 收集必要参数

从用户处获取以下参数（**TopicId和TopicName二选一，都不提供则使用环境变量默认值**）：

| 参数 | 说明 | 必填 |
|------|------|------|
| `TopicId` | 日志主题ID | 否，有默认值时可省略 |
| `TopicName` | 日志主题名称（会自动跨region查找） | 否，有默认值时可省略 |
| `From` | 开始时间 | 否，用户未提供时使用指数退避策略 |
| `To` | 结束时间 | 否，默认当前时间 |
| `Query` | 检索语句（CQL语法） | 是 |

可选参数：

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `Limit` | 返回条数 | 100（最大1000） |
| `Sort` | 排序方式 | desc |
| `SyntaxRule` | 0-Lucene，1-CQL | 1 |
| `Region` | 地域 | 使用TopicName时自动查找 |
| `SearchRegions` | 搜索范围（逗号分隔） | 所有region |
| `Output` | 日志转存文件路径，开启后日志写入文件，stdout仅输出摘要 | 不转存 |

时间格式支持：
- 毫秒时间戳：`1608794854000`
- RFC3339：`2024-01-01T00:00:00+08:00`
- 相对时间：`1h`（1小时前）、`30m`（30分钟前）、`2d`（2天前）

### 3. 确定查询时间范围

**当用户没有提供具体的起始时间时，使用指数退避策略自动扩大查询范围，直到找到匹配的日志。**

#### 指数退避查询策略

按以下顺序依次尝试，每次查询后检查是否返回了日志结果（`Results.length > 0` 或统计分析有数据）：

| 轮次 | 时间范围 | `--from` 参数 | 说明 |
|------|----------|---------------|------|
| 第1轮 | 近24小时 | `1d` | 默认先查最近一天 |
| 第2轮 | 近3天 | `3d` | 第1轮无结果时扩大 |
| 第3轮 | 近1个月 | `30d` | 第2轮无结果时继续扩大 |
| 第4轮 | 近3个月 | `90d` | 第3轮仍无结果时最后尝试 |

#### 退避规则

1. **每轮查询后立即检查结果**：如果返回了日志条目，停止退避，直接展示结果
2. **告知用户当前查询范围**：每次扩大范围时，简要告知用户，例如"近24小时未找到匹配日志，正在扩大到近3天..."
3. **第4轮仍无结果时**：告知用户在近3个月内未找到匹配的日志，建议用户提供更具体的时间范围或调整查询条件
4. **用户明确指定了时间时跳过退避**：如果用户说了"最近1小时"、"昨天"、"上周"等具体时间描述，直接使用对应时间，不走退避流程
5. **保持其他参数不变**：退避过程中只改变 `--from`，`--query`、`--limit` 等参数保持一致

### 4. 将用户查询条件转换为CQL语法

**这是关键步骤！** 用户描述的查询条件往往不符合CQL语法，需要你转换。

#### CQL语法速查

| 用户说法 | CQL语法 | 说明 |
|----------|---------|------|
| level等于error | `level:ERROR` | 键值检索，冒号连接 |
| level=error | `level:ERROR` | 等号要换成冒号 |
| 包含error关键词 | `ERROR` | 全文检索直接写关键词 |
| status大于400 | `status>400` | 范围操作符 |
| status大于等于400 | `status>=400` | 范围操作符 |
| 状态码400到500之间 | `status>=400 AND status<500` | 组合范围 |
| GET请求且状态码大于400 | `method:GET AND status>400` | AND连接多条件 |
| ERROR或WARNING级别 | `level:(ERROR OR WARNING)` | OR操作符+括号分组 |
| 不是INFO级别 | `NOT level:INFO` | NOT取反 |
| 路径包含/api/user | `url:"/api/user"` | 短语检索用双引号 |
| host以www.test开头 | `host:www.test*` | 通配符模糊匹配 |
| message字段存在 | `message:*` | 字段存在检查 |
| 查询所有日志 | `*` | 星号或空 |
| 来自某IP | `__SOURCE__:192.168.1.1` | 内置字段 |
| 统计错误数量 | `level:ERROR \| select count(*) as cnt` | 管道符+SQL |
| 按分钟统计 | `* \| select histogram(__TIMESTAMP__, interval 1 minute) as t, count(*) as cnt group by t` | SQL统计 |

#### 转换规则

1. **键值检索用冒号**：`key:value`，不是 `key=value`
2. **逻辑操作符**：`AND` `OR` `NOT`（不区分大小写）
3. **范围操作符**：`>` `>=` `<` `<=` `=` 直接跟在字段名后
4. **短语检索**：用双引号 `"..."` 包裹完整短语
5. **模糊匹配**：用 `*` 通配符，但不能放在词开头
6. **统计分析**：检索条件 `|` SQL语句
7. **特殊字符转义**：值包含 `:` `(` `)` `>` `=` `<` `"` `'` `*` 空格 时需用 `\\` 转义，或用双引号包裹
8. **字符串值区分**：CQL中值不需要引号（除非短语检索），`level:ERROR` 而非 `level:"ERROR"`

### 5. 执行查询

#### 使用默认主题查询（用户未指定主题时）

**当用户没有指定任何主题信息时，直接不传 `--topic-id` 和 `--topic-name`，脚本会自动使用环境变量 `CLS_DEFAULT_TOPIC_ID` 或 `CLS_DEFAULT_TOPIC_NAME` 和 `CLS_DEFAULT_REGION`。**

```bash
node "<脚本路径>" --from <From> --query "<Query>" [--limit N] [--sort asc|desc]
```

#### 按主题名查找主题（当用户只提供主题名时先执行此步骤）

```bash
node "<脚本路径>" --action DescribeTopics --topic-name "<主题名>"
```

可选添加 `--region <region>` 限制搜索范围，或 `--search-regions ap-beijing,ap-shanghai` 限制多个region。

#### 搜索日志（使用TopicId）

```bash
node "<脚本路径>" --topic-id <TopicId> --region <Region> --from <From> --to <To> --query "<Query>" [--limit N] [--sort asc|desc] [--syntax 0|1]
```

#### 搜索日志（使用TopicName，自动查找）

```bash
node "<脚本路径>" --topic-name "<TopicName>" --from <From> --to <To> --query "<Query>" [--limit N] [--sort asc|desc]
```

脚本会自动在所有region中查找该主题名，找到后自动使用对应的TopicId和Region进行查询。

#### 日志转存模式（推荐日志量大时使用）

在任何搜索命令后追加 `--output <文件路径>` 即可开启转存模式：

```bash
node "<脚本路径>" --topic-name "<TopicName>" --from 1h --query "level:ERROR" --limit 1000 --output "./cls-logs/error.log"
```

**转存模式的行为：**
- 日志内容写入指定文件，每行一条，格式为 `[时间] key=value | key=value ...`
- 文件头部包含查询参数的注释信息
- stdout 仅输出摘要（文件路径、条数、是否全部返回），**不输出日志内容**
- 节省 Agent token 消耗，适合日志量大、需要用户自行查看的场景

**何时应使用转存模式：**
- 用户要求"导出"、"保存"、"转存"日志到文件
- 用户要求查询大量日志（limit > 50）
- 用户明确说不需要在对话中展示日志内容
- 可主动建议用户使用转存模式以节省 token

转存完成后，告知用户文件路径和日志条数，用户可自行打开文件查看完整日志。

### 6. 输出结果

解析返回的日志内容，以友好的格式展示给用户。如果日志条目较多，择要展示并告知总数。

## 完整示例

**示例1**：用户说"查一下最近1小时的error日志"（未指定主题，使用默认主题）

1. 转换查询条件 → `level:ERROR`
2. 执行：`node "<脚本路径>" --from 1h --query "level:ERROR" --limit 20`
3. 脚本自动使用环境变量中的默认主题

**示例2**：用户说"查一下最近1小时production-api主题的error日志"（指定了主题名）

1. 转换查询条件 → `level:ERROR`
2. 执行：`node "<脚本路径>" --topic-name "production-api" --from 1h --query "level:ERROR" --limit 20`

**示例3**：用户说"查一下error日志"（未指定时间，触发指数退避）

1. 转换查询条件 → `level:ERROR`
2. 第1轮：`node "<脚本路径>" --from 1d --query "level:ERROR" --limit 20` → 假设返回0条
3. 告知用户"近24小时未找到匹配日志，正在扩大到近3天..."
4. 第2轮：`node "<脚本路径>" --from 3d --query "level:ERROR" --limit 20` → 假设返回5条
5. 停止退避，展示这5条日志

**示例4**：用户说"把最近一天的error日志导出到文件"

1. 转换查询条件 → `level:ERROR`
2. 执行：`node "<脚本路径>" --from 1d --query "level:ERROR" --limit 1000 --output "./cls-export/error.log"`
3. stdout 仅返回摘要，告知用户文件路径和条数

## 腾讯云CLS支持的Region

| 地域 | 取值 |
|------|------|
| 北京 | ap-beijing |
| 上海 | ap-shanghai |
| 广州 | ap-guangzhou |
| 成都 | ap-chengdu |
| 重庆 | ap-chongqing |
| 南京 | ap-nanjing |
| 香港 | ap-hongkong |
| 新加坡 | ap-singapore |
| 曼谷 | ap-bangkok |
| 雅加达 | ap-jakarta |
| 首尔 | ap-seoul |
| 东京 | ap-tokyo |
| 法兰克福 | eu-frankfurt |
| 弗吉尼亚 | na-ashburn |
| 硅谷 | na-siliconvalley |
| 圣保罗 | sa-saopaulo |

## 关键约束

- 签名使用 TC3-HMAC-SHA256（签名方法v3）
- 单个日志主题查询并发不超过15
- 单次查询最多返回1000条日志
- 返回数据包最大49MB
- 推荐使用CQL语法（SyntaxRule=1）
- 查询条件为空或 `*` 时返回所有日志
