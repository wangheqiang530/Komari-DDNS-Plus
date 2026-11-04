# Komari DDNS Plus

Komari DDNS Plus 是一个面向 Komari 的 Cloudflare DDNS 插件。它读取 Komari 节点上报的 IPv4/IPv6 地址，批量维护 Cloudflare DNS 记录。

当前版本：`0.0.1`

## 功能

- 节点单选、多选和搜索。
- 域名批量输入，支持换行、逗号和空格分隔。
- `IPv4`、`IPv6`、`IPv4 + IPv6` 三种模式。
- 同一域名自动维护独立的 A 和 AAAA 记录。
- 支持 Cloudflare API Token 或邮箱 + Global API Key。
- 设置页提供连接测试，不会写入 DNS。
- TTL、Cloudflare 代理、同步间隔和通知开关。
- 记录级状态、当前 IP、上次同步时间和错误信息。
- 批量启用、停用、删除和立即同步。
- Cloudflare Zone 自动匹配和 5 分钟缓存。
- 429 限流识别、分块同步和状态持久化。
- 运行日志和通知汇总。

## 环境

- Komari `>=1.4.0`
- 使用 `@komari-monitor/plugin-sdk@1.4.3`
- 已在 Komari `1.6.1` 上作为目标版本开发和校验
- Node.js 20 或更高版本用于本地开发

## 安装

1. 在 GitHub Releases 下载 `ddns-plus-0.0.1.zip`。
2. 在 Komari 后台的插件管理页面上传 ZIP。
3. 启用插件并批准系统 RPC 和 HTTP 路由权限。
4. 打开后台侧边栏的 **DDNS Plus** 页面。
5. 在“设置”标签中配置 Cloudflare 凭据并测试连接。
6. 在“DDNS 规则”标签中批量选择节点和域名。

覆盖升级时直接上传新版 ZIP，不要先卸载，否则插件存储数据可能被清除。

## Cloudflare 认证

### 推荐：API Token

在 Cloudflare 控制台的 **My Profile > API Tokens** 创建用户 API Token，至少授予：

- `Zone.Zone:Read`
- `Zone.DNS:Edit`

插件使用 `Authorization: Bearer <token>`。

### Global API Key

在 **My Profile > API Tokens > API Keys** 查看 Global API Key。插件使用：

```http
X-Auth-Email: <Cloudflare 登录邮箱>
X-Auth-Key: <Global API Key>
```

Global API Key 拥有账户级完整权限，建议仅在 API Token 不适用时使用。

## 使用说明

- 一条规则对应一个域名、一个节点和一种记录类型。
- 选择多台节点和双栈模式时，会展开成多条独立记录。
- 多台节点绑定同一个域名和类型时，Cloudflare 会存在多条同名记录，这不是故障切换。
- TTL `1` 在 Cloudflare 中表示“自动”，不是 1 秒。
- 开启 Cloudflare 代理时，TTL 会强制使用自动。
- 删除插件规则默认保留 Cloudflare 上的 DNS 记录。
- 已有非插件管理的记录不会被覆盖；需要接管时勾选“接管唯一已有记录”。
- 插件最多保存 1000 条 DNS 规则。

## 存储

插件数据位于 Komari 的插件长期存储目录：

```text
settings.json   Cloudflare 凭据和全局设置
records.json    展开后的 A/AAAA 规则
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
dist/ddns-plus-0.0.1.zip
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

## v0.0.1 限制

- 删除规则时暂不提供 Cloudflare DNS 记录清理。
- 暂不支持逐条编辑已有规则。
- 暂不支持按域名映射不同节点，批量创建使用节点与域名的笛卡尔积。
- 通知按一次同步任务汇总发送，不逐条发送。

## License

[MIT](./LICENSE)
