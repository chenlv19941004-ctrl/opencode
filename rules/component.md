# 组件开发规范

## 组件开发原则 [强制]

- 禁止在组件内编写业务逻辑
- 通过 props 控制UI状态
- 通过回调函数暴露业务处理能力

## Hooks 规范 [建议]

- 禁止在tsx代码内使用三目运算表达式
- 谨慎使用 `useMemo`，非必要不使用
- 谨慎使用 `useCallback`，非必要不使用
- 谨慎使用 `useEffect`，非必要不使用
- 状态命名: 具描述性，如 `isLoading`, `modalInfo`
- 事件处理: 以 `handle` 开头
- 自定义 Hooks: 定义在 _hooks目录下，并且以 `use` 开头，比如 `useFetchData`
- 组件的props类型定义尽量跟组件源代码在同一个tsx文件中

## 组件代码实例

### tsx、jsx 内谨慎使用三目表达式

```tsx
// ✅ 建议
<div>
  {isLoading && <Loading />}
  {isLoading || <div>渲染内容</div>}
</div>

// ❌ 不建议
<div>
  {isLoading ? <Loading /> : <div>渲染内容</div>}
</div>

// ✅ 建议
<div>
  {showUserInfo && <UserInfo />}
</div>

// ❌ 禁止
<div>
  {showUserInfo ? <UserInfo /> : null}
</div>
```

## 组件结构

```tsx
// 1. React
import React, { useRef, useMemo, useState, useEffect, useImperativeHandle } from 'react';
// 2. 外部库
import classnames from 'classnames';
import moment from 'moment';
import { cloneDeep, merge } from 'lodash-es';
import { Popover } from 'tea-component';
// 3. Umi
import { useIntl, connect } from 'umi';
// 4. 组件
import HeaderNav from '@dashboard/components/HeaderNav';
// 5. Hooks
import useRedDot from '@dashboard/hooks/useRedDot';
// 6. Services
import { getApiData } from '@dashboard/services/common';
// 7. 工具与配置
import { isEmpty, isNotEmpty } from '@intelligence/v3/utils/common';
import { parseUrlInfo } from '@dashboard/utils/utils';
import { MENU_PERMISSION } from '@dashboard/_config/constant';

// 8. 类型
import type { IMenuItem } from '@dashboard/types';

// 9. 样式 (最后)
import './index.scss';

interface IComponentNameProps extends IBaseProps {
  title: string;
  isVisible?: boolean;
  onClose?: () => void;
}

const ComponentName: React.FC<IComponentNameProps> = (props) => {
  const { style, className, title, isVisible = false, onClose } = props;
  const [localState, setLocalState] = useState('');

  const handleLocalEvent = (): void => {
    // 事件处理
  };

  return (
    <div style={style} className={classnames('component-name', className)}>{title}</div>
  );
};

export default ComponentName;
```
