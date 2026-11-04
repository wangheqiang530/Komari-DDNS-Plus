# Changelog

## 0.0.2

- Fix API Token testing for user and account-owned tokens by checking Zone and DNS read access directly.
- Group rules by node and support expanding details and editing a node rule group.
- Allow the same node to have multiple independent rule groups, including separate IPv4 and IPv6 groups.
- Add global scheduled-sync pause and resume controls.
- Send one detailed notification for IP changes or the first failure in a failure streak.
- Improve settings, switch, toolbar and button alignment.
- Migrate v0.0.1 flat records to stable rule groups.

## 0.0.1

- Initial Komari DDNS Plus release.
- Batch node and domain selection.
- IPv4, IPv6 and dual-stack record expansion.
- Cloudflare API Token and Global API Key authentication.
- Connection testing, TTL, proxy, interval and notification settings.
- Record status, logs, bulk enable/disable/delete and manual sync.
