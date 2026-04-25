# CSS/SCSS 规范

## 属性顺序

1. 布局: display
2. 定位: position, top/right/bottom/left
3. 外边距: margin/margin-top/margin-right/margin-bottom/margin-left
4. 内边距: padding/padding-top/padding-right/padding-bottom/padding-left
5. 盒模型: max-width/width, max-height/height, border
6. 排版: line-height, font-*, text-*
7. 视觉: color, background, box-shadow, opacity
8. 动画: transition, transform, animation

## css class 类名 采用 kebab-case 风格
```scss
// 错误示范
.dbhHeader {}

// 正确示范
.dbh-header {}
```

## css rules 编写用 BEM 风格

```scss
// 块
.{系统前缀}-left-menu {
    // 修饰符
    &--collapsed {
    }

    // 状态
    &--is-active {
    }
  
    // 元素
    &-header {
    }
}
```
