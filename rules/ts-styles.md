# typescript 编码风格

## 格式化

| 配置项 | 值     |
|-----|-------|
| 缩进  | 2 空格  |
| 引号  | 单引号   |
| 分号  | 必须    |
| 行宽  | 80 字符 |
| 尾逗号 | 必须    |
| EOL | LF    |

## 命名规范

| 类型         | 规范                         | 示例                                                        |
|------------|----------------------------|-----------------------------------------------------------|
| 接口         | `I` + PascalCase           | `IModalInfo`, `IUserInfo`                                 |
| 组件Props 接口 | `I` + PascalCase + `Props` | `IButtonProps`                                            |
| type类型     | `I` + PascalCase           | `type IPrimaryKey = 'id'`                                 |                                 |
| 泛型         | `T` 开头单字母                  | `<T>`, `<T, U>`                                           |
| 枚举值        | PascalCase                 | `OutUrl`, `EventType`                                     |
| 常量         | UPPER_SNAKE_CASE           | `API_BASE_URL`                                            |
| 变量/函数      | camelCase                  | `currentGame`, `getUserInfo`                              |
| 事件处理       | `handle` 开头                | `handleCloseModal`                                        |
| 组件文件       | PascalCase                 | `LeftMenu.tsx`                                            |
| 组件         | PascalCase                 | `LeftMenu`, `ModalWrap`                                   |
| 工具文件       | camelCase                  | `utils.ts`、`utils.tsx`、`utils/index.ts`、`utils/index.tsx` |
| 入口文件       | 小写                         | `index.tsx`                                               |
| 模块目录       | 小写                         | `dashboard/`                                              |
| 配置目录       | 下划线前缀                      | `_config/`, `_locales/`                                   |
| CSS 类名     | kebab-case                 | `{系统前缀}-left-menu`                                        |
| CSS 修饰符    | 双中横线                       | `{系统前缀}-left-menu--primary`                               |

## 编码风格

### 判空方法

优先使用 `isEmpty`，从 `@intelligence/v3/utils/common` 导入：

```typescript
import {isEmpty} from '@intelligence/v3/utils/common';

// ✅ 建议
if (isEmpty(list)) {
  return [];
}

// ❌ 不建议
if (!Array.isArray(list) || list.length === 0) {
}
```

### 判非空方法

优先使用 `isNotEmpty`，从 `@intelligence/v3/utils/common` 导入：

```typescript
import {isNotEmpty} from '@intelligence/v3/utils/common';

// ✅ 建议
if (isNotEmpty(list)) {
  processData(list);
}

// ❌ 不建议
if (Array.isArray(list) && list.length > 0) {
}
```

### return 语句

```typescript
// ✅ 正确
if (isEmpty(list)) {
  return [];
}

// ❌ 错误
if (isEmpty(list)) return [];
```