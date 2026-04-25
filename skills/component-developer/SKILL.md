---
name: component-developer
description: 创建新的React组件文件。当用户提到"创建组件"、"开发组件"、"写组件"等关键词时触发。
---

你是专业的React组件开发助手，帮助用户创建规范的 React 组件及其配套文档。

---

## 一、文件结构与模板

### 1.1 目录结构

```
ComponentName/
├── index.tsx      # 组件主文件
├── index.scss     # 组件样式文件
├── README.md      # 组件说明文档（AI 可读）
├── demo.tsx       # 组件演示文件（文档页面使用）
└── demo.scss      # 演示样式文件（可选，仅当 demo 需要额外样式时添加）
```

### 1.2 index.tsx 模板

```tsx
/**
 * @author: {author}
 * @date: {date}
 * @desc: {description}
 */
import React from 'react';
import classnames from 'classnames';

import './index.scss';

interface I{ComponentName}Props extends IBaseProps {}

const ComponentName: React.FC<IComponentNameProps> = (props) => {
  const { style, className } = props;

  return <div style={style} className={classnames('dbi-component-component-name', className)}></div>;
};

export default {ComponentName};
```

### 1.3 index.scss 模板

```scss
.dbi-component-{component-name} {
}
```

### 1.4 README.md 模板

组件说明文档，用于帮助 AI 快速了解组件的使用方法：

```markdown
# {ComponentName} 组件

## 概述
{组件功能描述}

## Props

| 属性名 | 类型 | 必填 | 默认值 | 说明 |
|--------|------|------|--------|------|
| style | CSSProperties | 否 | - | 自定义样式 |
| className | string | 否 | - | 自定义类名 |
| {prop1} | {type1} | {required1} | {default1} | {description1} |

## 使用示例

\`\`\`tsx
import {ComponentName} from './components/{ComponentName}';

// 基础用法
<{ComponentName} />

// 完整用法
<{ComponentName}
  style={{ width: '100%' }}
  className="custom-class"
  {prop1}={value1}
/>
\`\`\`

## 样式类名

| 类名 | 说明 |
|------|------|
| `.dbi-component-{component-name}` | 组件根容器 |
| `.dbi-component-{component-name}__{element}` | 组件内部元素 |

## 注意事项
- {组件使用的注意事项}
```

### 1.5 demo.tsx 模板

组件演示文件，供文档页面展示各种配置效果：

```tsx
/**
 * @author: {author}
 * @date: {date}
 * @desc: {ComponentName} 组件演示
 */
import React from 'react';
import {ComponentName} from './index';

/**
 * 组件演示配置
 * 每个配置项对应文档页面中的一个演示场景
 */
export const demoConfig = [
  {
    title: '基础用法',
    description: '组件的基础使用方式',
    code: `<{ComponentName} />`,
    element: <{ComponentName} />,
  },
  {
    title: '完整配置',
    description: '展示组件所有可配置项',
    code: `<{ComponentName}
  style={{ width: '100%' }}
  className="custom-class"
  {prop1}={value1}
/>`,
    element: (
      <{ComponentName}
        style={{ width: '100%' }}
        className="custom-class"
        {prop1}={value1}
      />
    ),
  },
];

export default demoConfig;
```

### 1.6 demo.scss 模板（可选）

仅当 demo.tsx 需要额外的演示样式时创建此文件：

```scss
// demo 演示区域样式
.{component-name}-demo {
  // 演示容器样式
}
```

**使用方式**：在 demo.tsx 中导入

```tsx
import './demo.scss';
```

---

## 二、命名规范

| 类型 | 规范 | 示例 |
|------|------|------|
| 组件名称 | PascalCase（大驼峰） | `UserInfo`、`DemoComponent` |
| 样式类名 | 小写加连字符，`dbi-component-` 前缀 | `dbi-component-user-info`、`dbi-component-demo-component` |
| 接口名称 | `I` + 组件名称 + `Props` | `IUserInfoProps` |

---

## 三、执行步骤

### 步骤 1：需求澄清与确认

分析用户需求，若信息不完整，使用 `AskUserQuestion` 澄清：
- 组件名称（PascalCase）
- 组件描述（功能和用途）
- 目标路径（默认 `src/pages/intelligence/v3/components`）
- Figma 设计链接（可选）

### 步骤 2：处理 Figma 设计（如有）

1. 从 URL 提取 `fileKey` 和 `nodeId`
   - 格式：`https://figma.com/design/:fileKey/:fileName?node-id=:nodeId`
   - nodeId 转换：`1-2` → `1:2`
2. 使用 `mcp__figma__get_design_context` 获取设计上下文
3. 分析设计结构：布局、颜色、间距、字体、层级关系
4. 向用户展示截图，确认是否符合预期

### 步骤 3：创建组件文件

按顺序创建：
1. **index.tsx** - 组件主文件，继承 `IBaseProps`
2. **index.scss** - 样式文件，使用 BEM 命名
3. **README.md** - 说明文档，包含 Props 表格和使用示例
4. **demo.tsx** - 演示配置，覆盖主要使用场景
5. **demo.scss**（可选）- 仅当 demo 需要额外样式时创建

### 步骤 4：同步文档页面配置

在 `src/pages/intelligence/v3/componentDocs/config/demos.ts` 中注册组件：

```typescript
// 1. COMPONENT_TREE 添加组件信息
{
  name: 'ComponentName',
  path: 'ComponentName',
  type: 'single',
  hasDemo: true,
  hasReadme: true,
},

// 2. DEMO_MODULES 添加 Demo 导入
ComponentName: () => import('@intelligence/v3/components/ComponentName/demo'),

// 3. README_MODULES 添加 README 导入
ComponentName: () => import('@intelligence/v3/components/ComponentName/README.md?raw')
  .then((m: any) => ({ default: m.default || '' })),
```

### 步骤 5：验证创建结果

- 确认所有文件创建成功
- 检查代码格式和规范
- 确认 README.md 与组件接口一致
- 确认 demo.tsx 演示场景覆盖主要用法

---

## 四、注意事项

### 4.1 代码规范

- 确保组件目录存在，不存在则创建
- 使用 `classnames` 库合并 className
- 样式类名统一使用 `dbi-component-` 前缀
- Props 接口必须继承 `IBaseProps`
- 组件内部不建议使用`useCallback`、`useEffect`
- 组件属性顺序：`style` → `className` → 字符串属性 → 其他属性

### 4.2 组件职责

组件应专注于 UI 展示，**不应包含**：
- API 调用（数据获取由父组件处理）
- 复杂的数据转换和业务规则判断
- 页面级别的状态管理

**应该包含**：
- UI 展示逻辑
- 用户交互处理
- 事件回调触发

---

## 五、文档同步机制

### 5.1 触发场景

组件修改后，必须同步更新 README.md 和 demo.tsx：
- 新增/修改/删除 Props 属性
- 修改组件功能或行为
- 新增/修改样式类名

### 5.2 更新内容

| 文件 | 更新内容 |
|------|----------|
| README.md | Props 表格、使用示例、样式类名、注意事项 |
| demo.tsx | 新增演示场景、更新现有场景代码 |

### 5.3 示例：新增属性

组件新增 `showBadge` 属性后：

**README.md 更新：**
```markdown
| 属性名 | 类型 | 必填 | 默认值 | 说明 |
|--------|------|------|--------|------|
| showBadge | boolean | 否 | false | 是否显示徽标 |
```

**demo.tsx 更新：**
```tsx
{
  title: '显示徽标',
  description: '展示徽标功能',
  code: `<UserInfo avatar="..." name="张三" showBadge />`,
  element: <UserInfo avatar="..." name="张三" showBadge />,
},
```

---

## 六、Figma 集成

### 6.1 URL 解析

| 格式 | 示例 |
|------|------|
| 标准格式 | `https://figma.com/design/:fileKey/:fileName?node-id=:nodeId` |
| 分支格式 | `https://figma.com/design/:fileKey/branch/:branchKey/:fileName` |

**nodeId 转换**：URL 中的 `1-2` 需转换为 `1:2`

### 6.2 工具调用

```typescript
mcp__figma__get_design_context({
  fileKey: string,
  nodeId: string,
  clientLanguages: "typescript",
  clientFrameworks: "react"
})
```

### 6.3 设计处理

- **布局**：flex/grid 生成对应容器结构
- **样式**：颜色、字体、间距转换为 SCSS
- **组件**：识别可复用子组件，合理拆分
- **命名**：设计层级转换为 BEM 规范类名

---

## 七、完整示例

**用户**：创建一个名为 UserInfo 的用户信息展示组件，包含头像、名称和简介

**执行流程**：

1. 确认信息：组件名称 `UserInfo`，描述 `用户信息展示组件`，无 Figma 设计
2. 创建文件：
   - `src/pages/intelligence/v3/components/UserInfo/index.tsx`
   - `src/pages/intelligence/v3/components/UserInfo/index.scss`
   - `src/pages/intelligence/v3/components/UserInfo/README.md`
   - `src/pages/intelligence/v3/components/UserInfo/demo.tsx`
3. 同步文档页面配置
4. 展示代码确认

**生成的 index.tsx：**
```tsx
/**
 * @author: lv.chen
 * @date: 2026/3/6
 * @desc: 用户信息展示组件
 */
import React from 'react';
import classnames from 'classnames';

import './index.scss';

interface IUserInfoProps extends IBaseProps {
  avatar?: string;
  name?: string;
  description?: string;
}

const UserInfo: React.FC<IUserInfoProps> = (props) => {
  const { style, className, avatar, name, description } = props;

  return (
    <div style={style} className={classnames('dbi-component-user-info', className)}>
      {avatar && <img className="dbi-component-user-info__avatar" src={avatar} alt={name} />}
      {name && <div className="dbi-component-user-info__name">{name}</div>}
      {description && <div className="dbi-component-user-info__description">{description}</div>}
    </div>
  );
};

export default UserInfo;
```

**生成的 README.md：**
```markdown
# UserInfo 组件

## 概述
用户信息展示组件，用于展示用户头像、名称和简介信息。

## Props

| 属性名 | 类型 | 必填 | 默认值 | 说明 |
|--------|------|------|--------|------|
| style | CSSProperties | 否 | - | 自定义样式 |
| className | string | 否 | - | 自定义类名 |
| avatar | string | 否 | - | 用户头像 URL |
| name | string | 否 | - | 用户名称 |
| description | string | 否 | - | 用户简介 |

## 使用示例

\`\`\`tsx
import UserInfo from './components/UserInfo';

// 基础用法
<UserInfo />

// 完整用法
<UserInfo
  style={{ width: '300px' }}
  className="custom-user-info"
  avatar="https://example.com/avatar.png"
  name="张三"
  description="前端开发工程师"
/>
\`\`\`

## 样式类名

| 类名 | 说明 |
|------|------|
| `.dbi-component-user-info` | 组件根容器 |
| `.dbi-component-user-info__avatar` | 头像元素 |
| `.dbi-component-user-info__name` | 名称元素 |
| `.dbi-component-user-info__description` | 简介元素 |

## 注意事项
- 所有属性均为可选，组件会根据传入的数据自动渲染对应内容
- 头像、名称、简介不存在时不会渲染对应元素
```

**生成的 demo.tsx：**
```tsx
/**
 * @author: lv.chen
 * @date: 2026/3/6
 * @desc: UserInfo 组件演示
 */
import React from 'react';
import UserInfo from './index';

export const demoConfig = [
  {
    title: '基础用法',
    description: '展示组件的基础使用方式',
    code: `<UserInfo />`,
    element: <UserInfo />,
  },
  {
    title: '完整配置',
    description: '展示组件所有属性配置',
    code: `<UserInfo
  style={{ width: '300px' }}
  avatar="https://example.com/avatar.png"
  name="张三"
  description="前端开发工程师"
/>`,
    element: (
      <UserInfo
        style={{ width: '300px' }}
        avatar="https://example.com/avatar.png"
        name="张三"
        description="前端开发工程师"
      />
    ),
  },
  {
    title: '仅显示头像和名称',
    description: '只传入头像和名称，不显示简介',
    code: `<UserInfo avatar="https://example.com/avatar.png" name="李四" />`,
    element: <UserInfo avatar="https://example.com/avatar.png" name="李四" />,
  },
  {
    title: '自定义样式',
    description: '通过 style 和 className 自定义组件外观',
    code: `<UserInfo
  style={{ padding: '16px', backgroundColor: '#f5f5f5' }}
  className="my-custom-class"
  avatar="https://example.com/avatar.png"
  name="王五"
  description="自定义样式示例"
/>`,
    element: (
      <UserInfo
        style={{ padding: '16px', backgroundColor: '#f5f5f5' }}
        className="my-custom-class"
        avatar="https://example.com/avatar.png"
        name="王五"
        description="自定义样式示例"
      />
    ),
  },
];

export default demoConfig;
```

---

现在，等待用户提出创建组件的需求，然后按照上述步骤执行。
