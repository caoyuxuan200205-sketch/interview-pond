# 生成视觉资产

本版本使用内置 image_gen 工具。原型图只作为构图和风格参考，运行界面由独立资产与 React 组件组成。

| 文件 | 用途 |
| --- | --- |
| `public/assets/aquarium-scene.png` | 无 UI、无文字、无角色的鱼缸主场景 |
| `public/assets/fish-atlas.png` | 4 列 × 3 行的透明角色图集，供首页、图鉴、档案、关系图和事件页共同使用 |
| `public/assets/daily-parchment.png` | 透明背景的空白纸张材质，供日报页面使用 |

鱼角色位置和动画、面板、标签、筛选、关系连线、日期、正文与按钮均由代码控制。原型图片中的文本没有被绘制进这些新资产。

## 场景生成提示词

Create a production game background asset from this reference. 16:9 landscape. Preserve this gorgeous cozy stylized 3D glass aquarium on a wooden desk with warm overhead lamp, blue-purple room, left mossy cave and lantern, central pink coral, right tiny submerged office, bubble dome, pearl shells, sand and translucent water. Remove all fish, all characters, all text, all labels, all UI panels, header logo, user icons, stats and bottom navigation. Seamlessly reconstruct all removed areas. Leave spacious clear blue water for separately composited fish. Absolutely no letters, symbols, avatars or interface. Warm amber cinematic lighting, highly detailed glass reflections, premium sculpted 3D game art. This is a clean reusable environment plate, not a screenshot.

## 角色图集生成提示词

Create a production character sprite atlas with TRUE TRANSPARENT alpha background. Use the reference only for the twelve character identities and premium cute 3D art style. Output a 4:3 landscape atlas, exactly 4 columns and 3 rows of EQUAL SQUARE CELLS, ideally 2048x1536. No visible grid. Every character centered in its own cell with at least 12 percent transparent padding around whole body and accessories. Consistent visual scale and warm amber key light, violet blue rim light. No text, card, pedestal, scenery, UI or watermark. Row1: pearl white lavender spotted fish with round gold glasses and bowtie; cobalt blue fish with black square glasses and brown tie; orange fish with dark over-ear headphones, expressive; deep purple thoughtful fish holding open brown book. Row2: gold yellow and blue striped fish with brown briefcase; pastel pink fish with round glasses and clipboard; slate blue fish with dark sunglasses and burgundy tie; cream golden round pufferfish. Row3: mint green fish with flowing yellow fins; violet indigo fish with golden star pattern; small pale pink fish with translucent flowing fins; friendly teal sea turtle with brown shell. All are polished stylized 3D characters matching the source. Complete silhouettes, no crop, no overlaps. Genuine transparent background, do not draw a checkerboard.

## 日报材质生成提示词

Production UI art asset, transparent background PNG. Extract and beautifully re-render ONLY the large warm ivory-peach parchment newspaper sheet from the reference as a blank ornate paper material. Wide landscape aspect ratio 2:1. One large horizontal parchment, almost fills frame with only 3 percent transparent padding. Delicate curled rolled corners, thick layered paper edges, warm golden rim light, realistic tiny paper fibers, soft peach-cream center, beautiful sculpted cozy 3D materials. The full central surface must be blank and smooth for real HTML text to be placed over it. Remove ALL text, lettering, titles, images, fish, characters, icons, statistics, cards, UI panels, columns and borders, pencil, books, desk and background. No objects except ONE blank sheet of parchment. The long sides gently wave, bottom edge slightly curls. Warm lamp illumination from upper right. Genuine transparent alpha outside parchment, no checkerboard.


## 追加皮肤资产（内置 image_gen）

12 张 4×4 透明图集，每张 1254×1254，共 192 款；1 张 4×3 互联网配色透明图集，1448×1086，共 12 款。每类 17 款，共 204 款。所有最终文件位于 `public/assets/skins/`。

完整生成提示词、参考角色、布局、文件名逐项记录在 `SKIN-PROMPTS.json`。没有使用 CLI 或外部图像 API。阿蓝图集额外用内置工具去除了白色底雾，保持 16 个角色的位置和外观，最终验证 alpha 范围 0–255。其余全部透明通道同样验证通过。

美术采用双彩与撞色搭配，保留眼镜、耳机、书本、条纹、尾鳍、星纹等鱼型特征，添加花纹和材质变化。互联网系列只参考配色，不含企业 Logo。应用按规则随机选取已有生成资产，不在每次投鱼时现场生成位图。

## 动态气泡背景清理

资产：`public/assets/aquarium-water-clear.png`。通过内置 image_gen 对原 `aquarium-scene.png` 进行 precise-object-edit，移除水中静止的小气泡，填补蓝色水体，保留原有鱼缸、水线、珊瑚、洞窟、办公桌、大玻璃罩、珍珠、台阶及暖色灯光，不增加鱼或文字。原图保留。画面中真正移动的小气泡由 `AquariumBubbles.tsx` 和 CSS 绘制，不使用图片中的气泡作为动画占位。
