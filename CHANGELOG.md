# Changelog

## 0.0.5

- Add a configurable periodic reconcile (default 1 hour, in hours, 0 disables) so records deleted or edited outside the panel are repaired even when the node IP never changes; each record reconciles on its own jittered window.
- Stop the sync round at the first Cloudflare 429 instead of continuing through every remaining record.
- Report rate limiting as a failure with HTTP 429 instead of a success message, in both the API and the panel.
- Keep a backup of a corrupt records/settings/status file instead of silently overwriting it, and surface the problem in the logs.
- Fix the silent abort when a sync round throws: the error is now logged and pending statuses are persisted.
- Enforce the 1000 record limit when updating a rule group.
- Treat an unknown node status as offline instead of online, so a failed status RPC can no longer push stale IPs to DNS.
- Allow adopting a single existing record that already carries a comment.
- Reuse the Cloudflare zone list across sync rounds and keep paused zones instead of reporting a missing zone.
- Only log an offline node when it transitions to offline instead of on every round.
- Flush logs once per batch instead of rewriting the whole log file for every entry, and fsync data files before rename.
- Fix the log API reporting the page size as the total count.
- Refresh the node list while the panel is open, and add request timeouts to the panel API calls.
- Ignore scheduled-sync 409 conflicts instead of writing an error log on every tick.
- Redact secrets from API error responses and use a constant-time CSRF comparison.

## 0.0.4

- Show the existing rule count on each node in the node picker.
- Add a hover title with all domains for grouped rule rows.
- Use solid Cloudflare proxy cloud icons and color the adjacent status text.

## 0.0.3

- Add selectable local-IP or Cloudflare-panel comparison modes.
- Skip Cloudflare DNS reads when local IP and sync settings are unchanged.
- Add grey/orange Cloudflare proxy cloud icons.
- Follow the Komari admin light/dark theme and accent color.
- Force Cloudflare comparison for manual sync actions.

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
