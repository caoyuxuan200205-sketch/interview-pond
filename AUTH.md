# 独立后端与真实账号

本文下方主要记录原 SQLite 模式。当前 `DATA_PROVIDER=supabase` 使用 Supabase Auth 和云数据库，详见 [SUPABASE.md](SUPABASE.md)，不会使用本地账号密码或自动迁移旧记录。

后端入口为 `server/index.mjs`，使用 Node HTTP 和内置 SQLite，不依赖 Vite 中间件。开发时 Vite 代理 `/api`；生产时后端直接提供 `dist` 和 API。

## 本地运行

```powershell
npm install
npm run dev
```

访问 `http://127.0.0.1:5173`。生产运行先 `npm run build`，再 `npm start`，访问 `http://127.0.0.1:3001`。这两个启动方式使用同一份数据库，不要同时启动两个占用 3001 的进程。`npm run dev` 会复用已运行且健康的本项目后端。

配置读取根目录 `.env.local`，模板为 `.env.example`。ModelScope 密钥仅由后端读取。`DATABASE_PATH` 默认 `data/pond.sqlite`，相对路径以项目根目录解析。

## 数据与会话

- `users`：账号 ID、规范化邮箱、昵称、密码派生值、创建时间。
- `sessions`：随机会话令牌的 SHA-256 摘要、所属账号、创建/访问/过期时间。原始令牌仅在 Cookie 中。
- `pond_state`：按账号与数据类型保存 JSON 和版本号，含新鱼、收藏、草稿、偏好、通知已读、投票、评论和声音设置。

密码要求 12–128 位，使用随机盐与 scrypt（N=32768、r=8、p=3）。会话有效期最多 7 天，24 小时未访问失效，每账号最多 5 个会话。退出立即撤销当前会话。HttpOnly Cookie 使用 SameSite=Lax；HTTPS 配置下使用 Secure 和 `__Host-` 前缀。

写入请求验证 Origin、自定义请求头和当前账号 ID。数据库写入采用版本检查，另一窗口修改导致冲突时提示刷新，不静默覆盖。账号数据不会写入游客 localStorage；旧游客数据不会自动迁移到账号。跨标签页切换账号会重新加载对应数据。

## 接口

| 方法 | 路径 | 用途 |
| --- | --- | --- |
| GET | `/api/health` | 服务健康检查 |
| POST | `/api/auth/register` | `{name,email,password}` 注册并建立会话 |
| POST | `/api/auth/login` | `{email,password}` 登录 |
| GET | `/api/auth/session` | 获取当前用户或 null |
| POST | `/api/auth/logout` | 撤销当前会话 |
| GET | `/api/pond/state` | 获取当前账号的数据及版本 |
| PUT | `/api/pond/state/:key` | `{value,revision}` 保存允许的数据类型 |
| POST | `/api/ai/interview` | 登录后调用魔搭生成 |

非 GET 请求需带 `Content-Type: application/json`、`X-Pond-Request: 1` 和正确 Origin；数据写入额外需要 `X-Pond-User` 与登录账号一致。错误返回 `{error}`，可能为 400/401/403/409/413/422/429。

## 部署边界

当前仅在本机运行，没有公网地址。真实多用户访问需要持续运行的服务器、持久磁盘、HTTPS 反向代理及备份。配置 `APP_ORIGIN=https://你的实际域名`，代理需保留原始 Host 并转发到本地 3001；默认后端只监听 127.0.0.1。开发 Origin 不再随生产配置一起放行。数据库和 `.env.local` 不放入静态目录或代码仓库。

当前限流基于直连地址与账号；在反向代理后所有请求可能共用代理 IP 配额。正式开放前需结合选定平台配置可信代理和边缘限流，不能直接信任任意 X-Forwarded-For。当前为单进程 SQLite 版本，适合初期小规模运行；横向扩容需共享数据库和集中限流。

邮箱目前只是登录标识，尚未验证所有权。邮件验证、找回/修改密码、管理员账号管理、账号删除入口尚未实现；界面不会假装发送邮件。社会事件、角色聊天与日报仍为示例内容。

## 备份与验证

备份数据库前停止后端，完整复制 `data` 目录（包括可能存在的 WAL/SHM 文件），再启动。恢复时也需先停止服务。保留受限权限，不将账号数据库作为源码分发。当前无自动备份任务。

`npm test` 在系统临时目录创建隔离数据库，完成后清理测试目录，不触碰实际账号库。集成测试验证注册、重复邮箱、错误密码、会话重启持久化、会话轮换与撤销、过期、两账号隔离、跨账号写入防护、版本冲突、Origin 校验和限流。

参考：[Node SQLite](https://nodejs.org/download/release/latest-v24.x/docs/api/sqlite.html)、[OWASP 密码存储](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)、[OWASP 会话管理](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)、[Vite 代理](https://vite.dev/config/server-options.html#server-proxy)。
