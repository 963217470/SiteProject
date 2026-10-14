# 几何背景与轻交互更新

日期：2026-10-14

- 首页改为浅色几何背景，保留 RD STUDIO 红色主色、真实栏目与所有业务功能。
- 背景只在右侧使用稀疏线框和浅色平面，取消像素场景及全站重复装饰纹理。
- 两层几何线框缓慢浮动；桌面鼠标视差幅度限制在水平 6px、垂直 4px，正文不移动。
- 新增红白几何箭头、手形光标。左下角按钮可切换为系统光标，偏好本地保存；输入框、禁用控件仍保留原生光标语义。
- 内容卡片进入视野时播放短促淡入，封面轻微放大；兼容无 IntersectionObserver 的环境，内容不会被隐藏。
- 手机减少装饰，触摸设备不启用自定义光标；系统减少动态效果时停止浮动、视差及新增动画。
- 组件卸载时取消帧、监听和观察器；背景装饰不捕获鼠标事件，不修改服务器数据或权限。

## 资产

背景：`docs/public/images/studio-geometric.webp`，1672 × 941，18,616 字节。
光标：`docs/public/images/cursors/studio-arrow.svg`、`studio-hand.svg`。

背景通过内置 image_gen 工具生成，原始 PNG 保留在 Codex generated_images 目录，项目内转换为 WebP。生成提示如下：

> Create an extremely restrained minimalist geometric bitmap background for a youthful game-development studio website hero. Wide 16:9 landscape. Almost-white #fafbf9 background covering 90 percent, clean flat print-like design, no texture or grain. Only near far right edge and bottom right corner: three very thin outlined overlapping angular quadrilateral frames and one small solid pale mint square, one small lavender rectangular plane, a restrained tiny muted brick-red square accent. Sparse, precise, asymmetrical Swiss graphic design, elegant technical graph-paper feeling without actual grid. Left 75 percent must be empty nearly white negative space for a large red heading and dark text. Extremely light low contrast; shapes are secondary, not an illustration of a scene. No pixel art, landscapes, buildings, vegetation, objects, characters, letters, logos, watermark, gradients, circles, spheres, glowing orbs, bokeh or shadows. No busy decorative pattern. The final result is a real raster design asset, crisp flat geometric art, calm white background with subtle mint/lavender accents and red very sparingly.

## 验证

- 前端 55 项单元与交互测试通过，包括光标偏好、触摸设备和减少动态效果。
- Playwright 检查 320 / 390 / 768 / 1440px、暗色模式、资产加载和非空像素、鼠标视差、偏好持久化、手机及各主要栏目无横向溢出。
- 继续复用现有前端原子发布与自动备份脚本；本次不改后端或数据库。
- 原有全站 UI 回归通过：登录文字对比度、栏目、账号菜单、任务和作品详情。
- 已上线并在公网重复验证：`https://rd-studio.club/`。
- 前端版本：`/www/wwwroot/rd-studio.club/releases/rd-ui-20261014T075426Z`。
- 回档备份：`/var/backups/rd-studio/frontend-ui-20261014T075426Z`；旧版本 `rd-ui-20261014T073634Z`。
