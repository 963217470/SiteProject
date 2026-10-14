# Markdown 格式核对

[TOC]

## 1. 文字与链接

**粗体**、*斜体*、~~删除线~~、==高亮文字==、x^2^、H~2~O、:smile:

<span style="color: #b8302e; font-size: 24px;">彩色文字</span>

[网站](https://rd-studio.club/) 与 [[知识库总览/程序]]。

## 2. 代码围栏

````markdown
## 代码中的标题，不应进入目录
```js
const value = '$x^2$';
```
==代码不应高亮== %%代码不应被隐藏%%
````

## 3. 代码之后的标题

这一段仍然有 **粗体**。

- 一级列表
  - 二级列表
- [x] 已完成
- [ ] 未完成

## 4. 数学公式

行内公式 $E = mc^2$ 和 \(x+y=z\)。

前向引用 \eqref{eq:energy}。

$$
E=mc^2 \label{eq:energy}
$$

\[
\int_a^b f(x)\,\mathrm{d}x \label{eq:integral}
\]

引用 \eqref{eq:energy}、\eqref{eq:integral}，行内引用 $\eqref{eq:energy}$。

$$
x^2+y^2=z^2 \tag{3.1} \label{eq:manual}
$$

手动编号引用 \eqref{eq:manual}。

## 5. 提示与脚注

> [!NOTE]
> 提示内容可以包含 **粗体**。

> [!TIP]
> 技巧内容。

普通脚注[^simple]，多段脚注[^long]。

[^simple]: 简短说明。

[^long]: 第一段说明。

    第二段说明，含有 `code`。

术语
: 对应的定义。

## 6. 表格与图片

| 名称 | 内容 |
| --- | --- |
| 表格 | **粗体** |

![RD STUDIO](https://rd-studio.club/images/rd-studio-logo.png)

%%这段注释不应显示%%

%%
## 隐藏的注释标题
这段多行注释不应显示。
%%

## 7. 保留原文的扩展

文献标识 @demo2026 没有配套文献数据库，应保留原文。

```mermaid
graph LR
  A[输入] --> B[输出]
```
