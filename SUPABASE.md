# Supabase 接入与运行

已接入项目 `eeloswjpavlgxnukabhw`（悉尼），复用原项目但不改变 `stamps` 表、现有账号或共享 Auth 配置。`supabase/migrations/` 是本应用的增量结构记录，不能对共享项目执行 reset。

## 本地配置

真实值只放 `.env.local`，不打包、不提交：

```env
DATA_PROVIDER=supabase
SUPABASE_URL=https://eeloswjpavlgxnukabhw.supabase.co
SUPABASE_PUBLISHABLE_KEY=项目的 Publishable key
SUPABASE_SECRET_KEY=项目的 Secret key
```

`npm run dev` 启动界面与独立 Node 服务。生产使用 `npm run build` 后 `npm start`，设置 `HOST=0.0.0.0`、平台提供的 `PORT` 和 `APP_ORIGIN=https://实际网站域名`。健康检查 `/api/health` 会验证云端表可读，返回 `storage: supabase`。云端模式不会打开 SQLite 或静默降级为本地保存。

## 数据和权限

- `pond_profiles`：用户资料；`pond_state`：偏好、草稿、教程、收藏、通知等。
- `pond_fish`：按用户独立的完整鱼档案，含面试经历和固定出生外观。
- `pond_worlds`：鱼塘快照和运行租约；不会逐帧写气泡/鱼鳍动画。
- `pond_events`、`pond_relationships`、`pond_memories`：真实事件、关系和记忆。
- `pond_demo_archive`：旧演示历史归档；`pond_ai_usage`：持久 AI 额度。
- 所有表启用 RLS，仅有本人读取策略。客户端不直接写鱼、关系、额度；鱼的创建经受限 RPC，社交写入只允许服务端角色。
- 出生请求以鱼 ID 幂等：并发或丢响应后重试只产生一条鱼，同 ID 不可改皮肤。前端等待持久化成功才提示入塘、跳转并清空草稿。
- AI 整理每天每账号 60 次，社交对白 30 次，以北京时间日期计数；失败请求也占额度。截图只用于本轮识别，不上传 Storage 或写入数据库。

## 账号与邮件配置边界

登录使用 Supabase Auth。后端验证身份，访问与刷新令牌仅写 HttpOnly、SameSite Cookie；HTTPS 下启用 Secure。注册等待邮件确认时，界面会明确提示；找回密码已接入 Auth 邮件与修改密码接口。

共享项目的邮件设置没有自动修改。正式邀请用户前，在 Auth → URL Configuration **追加**以下地址，保留原业务的 Site URL 和已有回调：

- `http://127.0.0.1:5173/?auth=confirm`
- `http://127.0.0.1:5173/?auth=recovery`
- 线上域名的相同两个地址。

配置并验证自己的 SMTP 发信服务。Supabase 默认邮件服务不应当作面向所有内测用户的可用发信服务。此轮测试没有向真实邮箱发送验证或找回邮件，因此邮件送达与回调白名单仍需配置验收。

同项目共用 Auth 用户池：已经在该 Supabase 项目注册的邮箱可直接登录，首次进入会得到空的个人鱼塘；修改同一邮箱的密码也作用于该项目的其他应用。注销仅退出当前会话，不删除共享 Auth 用户。禁止为了注销鱼塘而直接删除共享项目账号。

原 SQLite 账号、鱼与历史仍在桌面 `data/pond.sqlite`，没有自动导入云端，也不会把本地密码散列写进 Auth。新旧账号 ID 不同；正式迁移需按已验证邮箱建立对应关系，再迁移个人记录。当前不会把旧数据或演示记录自动挂到新账号。

## 验证

```powershell
npm test
npm run build
node scripts/verify-supabase.mjs '本地 .env.local 的绝对路径'
```

最后一条是显式的云端集成测试：创建两枚随机临时账号，不发邮件、不调用 ModelScope；验证密码登录、匿名拒绝、跨账号 RLS、直接写入拒绝、并发出生、皮肤锁定、版本冲突、社交名册和 AI 配额；在 finally 中删除本次账号。不得对已有用户运行删除清理。

## 部署与回退

Dockerfile 运行完整 Node 服务及前端，数据库由 Supabase 托管。运行时注入密钥，不把 `.env.local` 放进镜像。项目中的 `.dockerignore` 排除数据库、备份、原型和密钥。

以一台 Node 实例开始内测。数据库租约阻止多个进程同时推进同一鱼塘；当前并未配置跨实例请求路由，因此不要直接开多副本。未完成公网部署、并发容量测试、邮件投递验收和自动异地备份前，不称为正式上线。

回退时恢复代码备份，并设置 `DATA_PROVIDER=sqlite` 后重启；原本地数据库一直保留。云端新产生的记录不会自动回流 SQLite，回退前需单独保存云端数据。不要删除共享 Supabase 项目，也不要回滚原业务表。

安全检查原有一项提示：泄露密码保护未开启，见 https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection 。此轮未改变共享 Auth 的设置。上线前轮换在聊天中提供过的服务端密钥。

参考：Supabase Auth、RLS、Database Functions 官方文档；安装的 `@supabase/supabase-js` 固定为 2.119.0。
