# 前端调试（chrome-debug-collector 协作规范）

当需要调试前端页面问题时（如页面白屏、按钮无反应、接口异常、样式错乱等），使用 `chrome-debug-collector` 子 Agent 进行浏览器操控和信息收集。

## 调用方式

通过 `task` 工具调用子 Agent：

```
tool: task
agent_type: chrome-debug-collector
mode: sync
prompt: "<按下方模板填写调试任务>"
```

## 自动调试循环流程

遵循以下循环，直到 bug 修复并验证通过：

```
第 1 轮：初始复现（INIT）
  1. 分析用户报告的 bug 信息，确定目标 URL、登录信息、操作步骤
  2. 调用子 Agent，task_type=INIT，提供完整的登录和操作信息
  3. 读取子 Agent 返回的调试报告

分析阶段（主 Agent 自身执行）：
  4. 根据报告中的控制台错误、网络请求、截图，定位代码问题
  5. 阅读相关源代码，制定修复方案
  6. 修改代码

第 2~N 轮：验证修复（VERIFY）
  7. 调用子 Agent，task_type=VERIFY，提供相同操作步骤
  8. 读取调试报告，检查验证结论：
     - ✅ PASS → 进入结束阶段
     - ⚠️ PARTIAL → 继续修复，回到步骤 4
     - ❌ FAIL → 继续修复，回到步骤 4

结束阶段：
  9. 调用子 Agent，task_type=SESSION_END，关闭浏览器
  10. 向用户汇报修复结果
```

## Prompt 模板

**INIT 任务模板（首次复现）：**

```
task_type: INIT
target_url: {目标页面URL}

login:
  login_url: {登录页URL}
  steps:
    - action: fill
      selector_hint: "{用户名输入框描述}"
      value: "{用户名}"
    - action: fill
      selector_hint: "{密码输入框描述}"
      value: "{密码}"
    - action: click
      selector_hint: "{登录按钮描述}"
  success_indicator: "{登录成功后页面应出现的文本}"

operations:
  - action: {click|fill|hover|...}
    selector_hint: "{元素描述}"
    value: "{值，如需要}"
    description: "{操作说明}"

bug_context: "{bug 的简要描述}"
```

**VERIFY 任务模板（验证修复）：**

```
task_type: VERIFY
target_url: {目标页面URL}

operations:
  - action: navigate
    value: "{目标URL}"
  {与 INIT 相同的操作步骤}

bug_context: "{验证修复的描述：之前的问题是XXX，已修改了XXX，请验证}"
```

**SESSION_END 任务模板：**

```
task_type: SESSION_END
```

## 重要规则

1. **每次调用子 Agent 必须提供完整上下文**——子 Agent 是无状态的，不记得上一次调用的内容
2. **VERIFY 时必须重新提供操作步骤**——不能说"重复上次操作"
3. **登录信息只在 INIT 时提供**——VERIFY 时浏览器会话通常仍有效，无需重复登录；如果子 Agent 报告 SESSION_LOST，则需要重新
   INIT
4. **最大循环次数 5 轮**——如果 5 轮 VERIFY 仍未通过，停止循环，向用户汇报当前状态并请求人工介入
5. **一定要发 SESSION_END**——无论成功还是失败，最后必须调用 SESSION_END 清理浏览器资源
