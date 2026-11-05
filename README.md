# Komari DDNS Plus

Komari DDNS Plus 是一个面向 Komari 的 Cloudflare DDNS 插件。它读取 Komari 节点上报的 IPv4/IPv6 地址，批量维护 Cloudflare DNS 记录。

当前版本：`0.0.4`

## 功能

- 节点单选、多选和搜索。
- 域名批量输入，支持换行、逗号和空格分隔。
- `IPv4`、`IPv6`、`IPv4 + IPv6` 三种模式。
- 同一域名自动维护独立的 A 和 AAAA 记录。
- 每台节点显示为一个规则组，可展开查看目标明细并编辑。
- 节点选择列表显示该节点已有规则数量。
- 域名摘要支持悬停查看该规则组全部域名。
- 同一个节点可创建多个规则组，例如独立的 IPv4 组和 IPv6 组。
- 支持 Cloudflare API Token 或邮箱 + Global API Key。
- 设置页提供连接测试，不会写入 DNS；支持用户 API Token 和 Account API Token。
- TTL、Cloudflare 代理、同步间隔和通知开关。
- IP 对比方式可选：本地缓存对比或 Cloudflare 面板对比。
- 规则组状态、目标级当前 IP、上次同步时间和错误信息。
- 批量启用、停用、删除和立即同步。
- 全局暂停或恢复计划同步，手动同步不受影响。
- Cloudflare Zone 自动匹配和 5 分钟缓存。
- 429 限流识别、分块同步和状态持久化。
- 运行日志和带节点、域名、类型、IP 明细的变更通知。
- 仅 IP 变更或失败状态开始时通知，持续失败不会反复发送。
- 自动迁移 v0.0.1 的平铺记录为节点规则组。
- Cloudflare 代理使用实心灰/橙小黄云图标，文字同步变色。
- 插件自动跟随 Komari 面板的明暗主题和主题强调色。

## 环境

- Komari `>=1.4.0`
- 使用 `@komari-monitor/plugin-sdk@1.4.3`
- 已在 Komari `1.6.1` 上作为目标版本开发和校验
- Node.js 20 或更高版本用于本地开发

## 安装

1. 在 GitHub Releases 下载 `ddns-plus-0.0.4.zip`。
2. 在 Komari 后台的插件管理页面上传 ZIP。
3. 启用插件并批准系统 RPC 和 HTTP 路由权限。
4. 打开后台侧边栏的 **DDNS Plus** 页面。
5. 在“设置”标签中配置 Cloudflare 凭据并测试连接。
6. 在“节点规则”标签中选择节点和域名并创建规则组。

覆盖升级时直接上传新版 ZIP，不要先卸载，否则插件存储数据可能被清除。

## Cloudflare 认证

### 推荐：API Token

在 Cloudflare 控制台的 **My Profile > API Tokens** 创建用户 API Token，或使用 Account API Token，至少授予：

- `Zone > Zone > Read`
- `Zone > DNS > Edit`

插件使用 `Authorization: Bearer <token>`。测试连接会直接检查 Zone 和 DNS 记录读取权限，不依赖 `/user/tokens/verify`，因此 Account API Token 也可以正常测试。

### Global API Key

在 **My Profile > API Tokens > API Keys** 查看 Global API Key。插件使用：

```http
X-Auth-Email: <Cloudflare 登录邮箱>
X-Auth-Key: <Global API Key>
```

Global API Key 拥有账户级完整权限，建议仅在 API Token 不适用时使用。

## 使用说明

- 一个节点规则组对应一台节点、一组域名和一种地址模式。
- 同一个节点可以重复创建规则组，但不同组之间不能管理同一个域名和记录类型。
- 双栈规则组会为每个域名维护独立的 A 和 AAAA 目标。
- 多台节点选择后会分别生成节点规则组，每台节点一行。
- TTL `1` 在 Cloudflare 中表示“自动”，不是 1 秒。
- 开启 Cloudflare 代理时，TTL 会强制使用自动。
- 删除规则组或编辑时移除目标，默认保留 Cloudflare 上的 DNS 记录。
- 已有非插件管理的记录不会被覆盖；需要接管时勾选“接管唯一已有记录”。
- 插件最多保存 1000 条 DNS 规则。

## 存储

插件数据位于 Komari 的插件长期存储目录：

```text
settings.json   Cloudflare 凭据和全局设置
records.json    带 groupId 的 A/AAAA 目标记录
status.json     每条规则的最后同步状态
logs.json       最近的运行日志
```

`settings.json` 和 `status.json` 在支持 POSIX 权限的平台上会设置为 `0600`。密钥不会返回给浏览器，也不会写入错误日志。

## 开发

```sh
npm install
npm run typecheck
npm test
npm run check
npm run preview
npm run pack
```

生成的安装包：

```text
dist/ddns-plus-0.0.4.zip
```

管理页本地预览地址：

```text
http://127.0.0.1:18795/pages/admin.html
```

热重载需要创建被 Git 忽略的 `komari.local.json`：

```json
{
  "serverUrl": "http://127.0.0.1:25774",
  "apiKey": "your-komari-admin-api-key",
  "language": "zh-CN"
}
```

然后运行：

```sh
npm run dev
```

## v0.0.4 限制

- 删除规则组时暂不提供 Cloudflare DNS 记录清理。
- 暂不支持在规则组内单独编辑某个域名目标。
- 暂不支持一个规则组内按域名映射不同节点。
- 通知按一次同步任务汇总发送，不逐条发送；同一失败状态持续期间只通知首次。

## IP 对比方式

- **本地缓存对比（默认）**：先对比 Komari 节点 IP 与上次成功推送的 IP。IP、TTL 和代理状态都没有变化时，不访问 Cloudflare DNS 接口。适合大多数 DDNS 场景，但不会发现 Cloudflare 端被外部修改的记录；手动同步会强制检查。
- **Cloudflare 面板对比**：每次检查都读取 Cloudflare DNS 记录并对比，可以发现 Cloudflare 端被外部修改的 IP，但请求次数更多。

手动点击“立即同步”会强制读取 Cloudflare 记录，不受本地缓存跳过逻辑影响。

## License

[MIT](./LICENSE)
