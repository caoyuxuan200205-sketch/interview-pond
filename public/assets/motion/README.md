# 阿白转身素材 v1

- 生成方式：内置 image_gen，参考原鱼图集左上角阿白，透明背景。
- 资产：bai-turn-v1.png，1261 × 1247，3 × 3 共 9 个视角。
- 覆盖：首页阿白默认外观。其他种类及皮肤继续使用原素材，未批量替换。
- 接入：BaiTurnPortrait + turn.ts。1.9 秒转身，正面停留约 0.3 秒，减速后恢复游动；相邻帧混合，不执行水平压扁翻转。
- 首页“招呼阿白”可主动体验；关闭动态效果或系统减少动态效果时禁用。
- 每帧按透明轮廓边界校准大小与中心，原始生成图未裁改。

## 生成提示词

Use case: stylized-concept. Production game character turnaround sprite sheet, real transparent background. Reference image contains 12 fish; use ONLY the TOP LEFT fish: 阿白, pale pearly lavender cream fish with dark purple spots on its back, translucent lavender fins, thin round gold glasses, big kind eyes, small brown bow tie under chin. Preserve its exact identity, coloring, proportions and polished warm 3D illustrated style. Create ONE 3 by 3 uniform grid containing NINE consecutive turning poses of this SAME fish, read left to right then next row. Frame 1: facing screen RIGHT three-quarter side, like reference. Frame 2: right-facing shallower 55 degree yaw. Frame 3: 35 degree yaw toward viewer. Frame 4: almost front 15 degree yaw toward right. Frame 5: exactly FRONT, both eyes and glasses visible, rounded cheeks, tail hidden behind body. Frame 6: almost front 15 degree toward left. Frame 7: left 35 degree yaw. Frame 8: left 55 degree yaw. Frame 9: facing screen LEFT three-quarter side. The head leads and body gently follows; coherent anatomical rotation, fins and tail wrap around depth, not flattened or stretched. The bow tie and glasses stay attached and rotate correctly. All 9 fish at identical camera distance, body height, consistent vertical baseline and central body pivot within their equal square cells, with generous transparent gutters. Body remains ROUND and volumetric in every frame. Tail changes silhouette naturally. Fin tips never cross cell boundaries. Neutral gentle mouth expression throughout. No text, no frame numbers, no grid lines, no background, no bubbles, no shadow on ground, no other fish, no recoloring, no extra accessories. 3x3 sprite sheet on true alpha transparency.

