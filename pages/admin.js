(function () {
  "use strict";

  var API_BASE = "/ddns-plus";
  var state = {
    settings: {},
    records: [],
    groups: [],
    statuses: {},
    sync: { running: false, total: 0, completed: 0, changed: 0, skipped: 0, errors: 0 },
    csrf: "",
    nodes: [],
    selectedGroups: new Set(),
    expandedGroups: new Set(),
    composerNodes: new Set(),
    mode: "dual",
    authMode: "token",
    activePanel: "records",
    composerOpen: false,
    editingGroupId: null,
    toastTimer: null,
  };

  var ICONS = {
    plus: '<path d="M12 5v14M5 12h14"/>',
    refresh: '<path d="M20 11a8.1 8.1 0 0 0-15.5-2M4 5v4h4"/><path d="M4 13a8.1 8.1 0 0 0 15.5 2M20 19v-4h-4"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13"/><path d="M3 6h.01M3 12h.01M3 18h.01"/>',
    settings: '<path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21a2 2 0 1 1-4 0v-.09A1.7 1.7 0 0 0 8.5 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.6 8.5a1.7 1.7 0 0 0-.34-1.88l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V3a2 2 0 1 1 4 0v.09A1.7 1.7 0 0 0 15.5 4.6a1.7 1.7 0 0 0 1.88-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9c.1.36.32.7.6 1 .3.28.68.42 1.1.42H21a2 2 0 1 1 0 4h-.09A1.7 1.7 0 0 0 19.4 15Z"/>',
    scroll: '<path d="M8 3h9a2 2 0 0 1 2 2v14a2 2 0 0 0 2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"/><path d="M9 7h6M9 11h6M9 15h4"/>',
    x: '<path d="m18 6-12 12M6 6l12 12"/>',
    play: '<path d="m8 5 11 7-11 7V5Z"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    power: '<path d="M12 2v10"/><path d="M18.4 5.6a9 9 0 1 1-12.8 0"/>',
    pause: '<path d="M8 5v14M16 5v14"/>',
    trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 15H6L5 6M10 11v6M14 11v6"/>',
    plug: '<path d="M12 22v-5M9 7V2M15 7V2M6 7h12v4a6 6 0 0 1-12 0V7Z"/>',
    check: '<path d="m20 6-11 11-5-5"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
    cloud: '<path d="M17.5 19H7a5 5 0 1 1 1.6-9.8A7 7 0 0 1 22 12a4 4 0 0 1-4.5 7Z"/>',
    edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
    chevron: '<path d="m9 18 6-6-6-6"/>',
    alert: '<circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/>',
  };

  function iconSvg(name) {
    return '<svg viewBox="0 0 24 24" aria-hidden="true">' + (ICONS[name] || ICONS.alert) + "</svg>";
  }

  function hydrateIcons(root) {
    (root || document).querySelectorAll("[data-icon]").forEach(function (node) {
      node.innerHTML = iconSvg(node.getAttribute("data-icon"));
    });
  }

  function setButtonIcon(button, name) {
    var holder = button.querySelector("[data-icon]");
    if (holder) holder.innerHTML = iconSvg(name);
  }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  }

  function byId(id) {
    return document.getElementById(id);
  }

  function parentThemeContext() {
    try {
      if (window.parent && window.parent !== window && window.parent.document) {
        return {
          doc: window.parent.document,
          win: window.parent,
        };
      }
    } catch (_) {
      // Fall back to this document when the parent is cross-origin.
    }
    return { doc: document, win: window };
  }

  function resolveDarkMode(context) {
    var forced = new URLSearchParams(location.search).get("theme");
    if (forced === "dark") return true;
    if (forced === "light") return false;
    var root = context.doc.documentElement;
    if (root && root.classList.contains("dark")) return true;
    try {
      var appearance = context.win.localStorage.getItem("appearance");
      if (appearance === "dark") return true;
      if (appearance === "light") return false;
    } catch (_) {
      // Ignore storage restrictions and use the media query.
    }
    return Boolean(context.win.matchMedia && context.win.matchMedia("(prefers-color-scheme: dark)").matches);
  }

  function syncThemeFromParent() {
    var context = parentThemeContext();
    var dark = resolveDarkMode(context);
    document.documentElement.classList.toggle("dark", dark);
    try {
      var source = context.doc.querySelector(".theme-root") || context.doc.documentElement;
      var styles = context.win.getComputedStyle(source);
      var variables = {
        "--accent": "--accent-9",
        "--accent-dark": "--accent-10",
        "--accent-soft": "--accent-3",
        "--accent-contrast": "--accent-contrast",
        "--accent-text": "--accent-11",
      };
      Object.keys(variables).forEach(function (target) {
        var value = styles.getPropertyValue(variables[target]).trim();
        if (value) document.documentElement.style.setProperty(target, value);
      });
    } catch (_) {
      // The local defaults remain usable if the parent variables are unavailable.
    }
  }

  function watchTheme() {
    syncThemeFromParent();
    var context = parentThemeContext();
    try {
      new MutationObserver(syncThemeFromParent).observe(context.doc.documentElement, {
        attributes: true,
        attributeFilter: ["class", "style"],
      });
    } catch (_) {
      // MutationObserver is optional for older embedded browsers.
    }
    window.addEventListener("storage", syncThemeFromParent);
    if (context.win.matchMedia) {
      var media = context.win.matchMedia("(prefers-color-scheme: dark)");
      if (media.addEventListener) media.addEventListener("change", syncThemeFromParent);
      else if (media.addListener) media.addListener(syncThemeFromParent);
    }
    setInterval(syncThemeFromParent, 2000);
  }

  function showToast(message, kind) {
    var toast = byId("toast");
    toast.textContent = message || "";
    toast.className = "toast visible " + (kind || "");
    clearTimeout(state.toastTimer);
    state.toastTimer = setTimeout(function () {
      toast.className = "toast";
    }, 3800);
  }

  function formatTime(value) {
    if (!value) return "—";
    var date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  }

  function ttlLabel(value) {
    var labels = {
      1: "自动",
      60: "1 分钟",
      120: "2 分钟",
      300: "5 分钟",
      600: "10 分钟",
      900: "15 分钟",
      1800: "30 分钟",
      3600: "1 小时",
      7200: "2 小时",
      18000: "5 小时",
      43200: "12 小时",
      86400: "1 天",
    };
    return labels[Number(value)] || value + " 秒";
  }

  function modeLabel(mode) {
    return mode === "v4" ? "IPv4" : mode === "v6" ? "IPv6" : "IPv4 + IPv6";
  }

  function updateProxyIcon() {
    var holder = byId("proxy-cloud-icon");
    if (!holder) return;
    var on = byId("proxied").checked;
    holder.className = "proxy-cloud " + (on ? "on" : "off");
    holder.innerHTML = iconSvg("cloud");
    byId("proxy-label").className = "proxy-label " + (on ? "on" : "off");
  }

  function proxyState(on) {
    var node = el("span", "proxy-state " + (on ? "on" : "off"));
    node.innerHTML = iconSvg("cloud") + "<span>" + (on ? "已代理" : "未代理") + "</span>";
    return node;
  }

  function nodeName(uuid) {
    var node = state.nodes.find(function (item) {
      return item.uuid === uuid;
    });
    return node ? node.name : uuid.slice(0, 8);
  }

  function hasCredentials(settings) {
    if (!settings) return false;
    return settings.authMode === "token" ? Boolean(settings.hasToken) : Boolean(settings.email && settings.hasApiKey);
  }

  function parseDomainText(value) {
    var seen = new Set();
    var result = [];
    String(value || "")
      .split(/[\s,;]+/)
      .map(function (item) {
        return item.trim().toLowerCase().replace(/\.$/, "");
      })
      .filter(Boolean)
      .forEach(function (item) {
        if (!seen.has(item)) {
          seen.add(item);
          result.push(item);
        }
      });
    return result;
  }

  function selectedTypeCount() {
    return state.mode === "dual" ? 2 : 1;
  }

  function groupRecords(group) {
    if (group && Array.isArray(group.recordIds)) {
      var ids = new Set(group.recordIds);
      return state.records.filter(function (record) {
        return ids.has(record.id);
      });
    }
    return state.records.filter(function (record) {
      return group && record.groupId === group.id;
    });
  }

  function recordStatus(record) {
    var status = state.statuses[record.id] || {};
    var value = !record.enabled ? "disabled" : status.state || "pending";
    var labels = {
      success: "正常",
      error: "失败",
      skipped: "已跳过",
      disabled: "已停用",
      pending: "待同步",
      running: "同步中",
    };
    return {
      state: value,
      label: labels[value] || "待同步",
      error: status.lastError || "",
      lastCheckedAt: status.lastCheckedAt || "",
      currentIp: status.currentIp || "",
    };
  }

  function groupStatus(group) {
    var records = groupRecords(group);
    if (!group.enabled) return { state: "disabled", label: "已停用", total: records.length };
    if (state.sync.running) return { state: "running", label: "同步中", total: records.length };
    var counts = { success: 0, error: 0, skipped: 0, pending: 0 };
    records.forEach(function (record) {
      var value = recordStatus(record).state;
      if (counts[value] !== undefined) counts[value] += 1;
    });
    if (counts.error) {
      return { state: "error", label: "失败 " + counts.error + "/" + records.length, total: records.length, counts: counts };
    }
    if (counts.skipped) {
      return { state: "skipped", label: "跳过 " + counts.skipped + "/" + records.length, total: records.length, counts: counts };
    }
    if (counts.success === records.length && records.length) {
      return { state: "success", label: "正常 " + counts.success + "/" + records.length, total: records.length, counts: counts };
    }
    return { state: "pending", label: "待同步", total: records.length, counts: counts };
  }

  function groupLastSync(group) {
    var latest = "";
    groupRecords(group).forEach(function (record) {
      var value = (state.statuses[record.id] || {}).lastCheckedAt || "";
      if (value && value > latest) latest = value;
    });
    return latest;
  }

  function deriveGroups(records) {
    var map = {};
    records.forEach(function (record) {
      var id = record.groupId || record.id;
      if (!map[id]) map[id] = [];
      map[id].push(record);
    });
    return Object.keys(map).map(function (id) {
      var items = map[id];
      var domains = [];
      var seen = new Set();
      var types = new Set();
      items.forEach(function (item) {
        if (!seen.has(item.domain)) {
          seen.add(item.domain);
          domains.push(item.domain);
        }
        types.add(item.type);
      });
      var first = items[0];
      return {
        id: id,
        nodeUuid: first.nodeUuid,
        domains: domains,
        mode: types.has("A") && types.has("AAAA") ? "dual" : types.has("AAAA") ? "v6" : "v4",
        ttl: first.ttl,
        proxied: first.proxied,
        enabled: first.enabled,
        intervalMinutes: first.intervalMinutes,
        adoptExisting: first.adoptExisting,
        recordIds: items.map(function (item) { return item.id; }),
        createdAt: first.createdAt || "",
        updatedAt: first.updatedAt || "",
      };
    });
  }

  function api(path, options) {
    options = options || {};
    var method = options.method || "GET";
    var headers = Object.assign({}, options.headers || {});
    if (method !== "GET") headers["X-Komari-DDNS-Plus-CSRF"] = state.csrf;
    if (options.body !== undefined) headers["Content-Type"] = "application/json";
    return fetch(API_BASE + path, {
      method: method,
      credentials: "same-origin",
      cache: "no-store",
      headers: headers,
      body: options.body,
    }).then(function (response) {
      return response
        .json()
        .catch(function () {
          return {};
        })
        .then(function (data) {
          if (!response.ok) throw new Error(data.error || "请求失败（HTTP " + response.status + "）");
          return data;
        });
    });
  }

  function applyState(data) {
    state.settings = data.settings || {};
    state.records = Array.isArray(data.records) ? data.records : [];
    state.groups = Array.isArray(data.groups) ? data.groups : deriveGroups(state.records);
    state.statuses = data.statuses || {};
    state.sync = data.sync || state.sync;
    state.csrf = data.csrf || state.csrf;
    var groupIds = new Set(state.groups.map(function (group) { return group.id; }));
    Array.from(state.selectedGroups).forEach(function (id) {
      if (!groupIds.has(id)) state.selectedGroups.delete(id);
    });
    Array.from(state.expandedGroups).forEach(function (id) {
      if (!groupIds.has(id)) state.expandedGroups.delete(id);
    });
  }

  function renderHeader() {
    var pill = byId("sync-state");
    var job = state.sync || {};
    if (state.settings.paused && !job.running) {
      pill.className = "status-pill status-paused";
      pill.textContent = "计划同步已暂停";
    } else if (job.running) {
      pill.className = "status-pill status-running";
      pill.textContent = "同步中 " + Number(job.completed || 0) + "/" + Number(job.total || 0);
    } else if (job.errors > 0) {
      pill.className = "status-pill status-error";
      pill.textContent = "上次同步有失败";
    } else if (job.finishedAt) {
      pill.className = "status-pill status-success";
      pill.textContent = "同步完成";
    } else {
      pill.className = "status-pill status-idle";
      pill.textContent = "待命";
    }
    var pauseButton = byId("btn-toggle-pause");
    byId("pause-label").textContent = state.settings.paused ? "恢复同步" : "暂停同步";
    setButtonIcon(pauseButton, state.settings.paused ? "play" : "pause");
    var progress = byId("sync-progress");
    if (job.running) {
      progress.hidden = false;
      progress.textContent =
        "正在同步 " + Number(job.completed || 0) + "/" + Number(job.total || 0) +
        "，已变更 " + Number(job.changed || 0) + " 条";
    } else if (state.settings.paused) {
      progress.hidden = false;
      progress.textContent = "计划同步已暂停，手动同步仍然可用。";
    } else if (job.message) {
      progress.hidden = false;
      progress.textContent = job.message;
    } else {
      progress.hidden = true;
      progress.textContent = "";
    }
    var busy = Boolean(job.running);
    byId("btn-sync-all").disabled = busy;
    byId("btn-add").disabled = busy;
    byId("btn-create-batch").disabled = busy || byId("btn-create-batch").disabled;
    byId("btn-test").disabled = busy;
    byId("btn-save-settings").disabled = busy;
    byId("btn-bulk-sync").disabled = busy;
    if (!busy) updatePreview();
  }

  function renderNodes() {
    var list = byId("node-list");
    var search = String(byId("node-search").value || "").trim().toLowerCase();
    list.replaceChildren();
    var visible = state.nodes.filter(function (node) {
      return !search || (node.name + " " + node.uuid).toLowerCase().indexOf(search) >= 0;
    });
    if (!visible.length) list.appendChild(el("div", "empty-inline", "没有匹配的节点"));
    visible.forEach(function (node) {
      var label = el("label", "node-option");
      var input = el("input");
      input.type = "checkbox";
      input.checked = state.composerNodes.has(node.uuid);
      input.disabled = Boolean(state.editingGroupId);
      input.addEventListener("change", function () {
        if (input.checked) state.composerNodes.add(node.uuid);
        else state.composerNodes.delete(node.uuid);
        updatePreview();
      });
      var copy = el("span", "node-copy");
      var name = el("b");
      name.appendChild(el("span", "online-dot" + (node.online ? "" : " offline")));
      name.appendChild(document.createTextNode(node.name || node.uuid));
      copy.appendChild(name);
      copy.appendChild(el("small", "", [node.ipv4 || "无 IPv4", node.ipv6 || "无 IPv6"].join(" · ")));
      var ruleCount = state.groups.filter(function (group) {
        return group.nodeUuid === node.uuid;
      }).length;
      copy.appendChild(
        el(
          "span",
          "node-rule-count" + (ruleCount ? " has-rules" : ""),
          ruleCount ? "已有 " + ruleCount + " 条规则" : "暂无规则",
        ),
      );
      label.appendChild(input);
      label.appendChild(copy);
      list.appendChild(label);
    });
    byId("node-count").textContent = "已选 " + state.composerNodes.size + " 台";
  }

  function visibleGroups() {
    var search = String(byId("filter-search").value || "").trim().toLowerCase();
    var filter = byId("filter-status").value;
    return state.groups
      .filter(function (group) {
        if (filter && groupStatus(group).state !== filter) return false;
        if (!search) return true;
        return (
          (nodeName(group.nodeUuid) + " " + group.domains.join(" ") + " " + modeLabel(group.mode))
            .toLowerCase()
            .indexOf(search) >= 0
        );
      })
      .sort(function (left, right) {
        return (
          nodeName(left.nodeUuid).localeCompare(nodeName(right.nodeUuid), "zh-CN") ||
          left.createdAt.localeCompare(right.createdAt)
        );
      });
  }

  function renderGroups() {
    var body = byId("groups-body");
    body.replaceChildren();
    var groups = visibleGroups();
    groups.forEach(function (group) {
      var status = groupStatus(group);
      var node = state.nodes.find(function (item) { return item.uuid === group.nodeUuid; });
      var expanded = state.expandedGroups.has(group.id);
      var tr = el("tr", "group-row" + (expanded ? " expanded" : ""));

      var checkCell = el("td", "check-cell");
      var check = el("input");
      check.type = "checkbox";
      check.checked = state.selectedGroups.has(group.id);
      check.setAttribute("aria-label", "选择 " + nodeName(group.nodeUuid) + " 规则组");
      check.addEventListener("click", function (event) { event.stopPropagation(); });
      check.addEventListener("change", function () {
        if (check.checked) state.selectedGroups.add(group.id);
        else state.selectedGroups.delete(group.id);
        renderBulkBar();
        renderGroups();
      });
      checkCell.appendChild(check);
      tr.appendChild(checkCell);

      var nodeCell = el("td", "node-cell");
      var nodeInner = el("div", "node-cell-inner");
      var expand = el("button", "expand-button" + (expanded ? " expanded" : ""));
      expand.type = "button";
      expand.title = expanded ? "收起详情" : "展开详情";
      expand.setAttribute("aria-label", expand.title);
      expand.innerHTML = iconSvg("chevron");
      expand.addEventListener("click", function (event) {
        event.stopPropagation();
        toggleGroup(group.id);
      });
      nodeInner.appendChild(expand);
      nodeInner.appendChild(el("span", "online-dot" + (node && node.online ? "" : " offline")));
      nodeInner.appendChild(el("span", "node-cell-name", nodeName(group.nodeUuid)));
      nodeCell.appendChild(nodeInner);
      tr.appendChild(nodeCell);

      var modeCell = el("td");
      modeCell.appendChild(el("span", "mode-badge", modeLabel(group.mode)));
      tr.appendChild(modeCell);

      var domainsCell = el("td");
      var domainText = el("div", "group-domain-list");
      var domainTitle = group.domains.join("\n");
      domainText.title = domainTitle;
      domainText.setAttribute("aria-label", domainTitle);
      domainsCell.title = domainTitle;
      domainText.appendChild(document.createTextNode(group.domains[0] || "—"));
      if (group.domains.length > 1) domainText.appendChild(el("small", "", "  +" + (group.domains.length - 1)));
      domainsCell.appendChild(domainText);
      tr.appendChild(domainsCell);

      tr.appendChild(el("td", "", ttlLabel(group.ttl)));
      var proxyCell = el("td");
      proxyCell.appendChild(proxyState(group.proxied));
      tr.appendChild(proxyCell);

      var statusCell = el("td");
      statusCell.appendChild(el("span", "badge " + status.state, status.label));
      tr.appendChild(statusCell);
      tr.appendChild(el("td", "", formatTime(groupLastSync(group))));

      var actionsCell = el("td", "action-cell");
      var actions = el("div", "row-actions");
      actions.appendChild(rowAction("play", "立即同步", function (event) {
        event.stopPropagation();
        syncGroup(group.id);
      }));
      actions.appendChild(rowAction(group.enabled ? "pause" : "power", group.enabled ? "停用" : "启用", function (event) {
        event.stopPropagation();
        runBulk(group.enabled ? "disable" : "enable", [group.id]);
      }));
      actions.appendChild(rowAction("edit", "编辑规则", function (event) {
        event.stopPropagation();
        openEditComposer(group.id);
      }));
      actions.appendChild(rowAction("trash", "删除规则组", function (event) {
        event.stopPropagation();
        runBulk("delete", [group.id]);
      }, true));
      actionsCell.appendChild(actions);
      tr.appendChild(actionsCell);
      tr.addEventListener("click", function (event) {
        if (event.target.closest("button, input, label")) return;
        toggleGroup(group.id);
      });
      body.appendChild(tr);

      if (expanded) body.appendChild(renderGroupDetail(group, node));
    });

    var empty = byId("empty-records");
    empty.hidden = groups.length > 0;
    if (!groups.length) {
      empty.querySelector("h3").textContent = state.groups.length ? "没有匹配的节点规则" : "还没有节点规则";
      empty.querySelector("p").textContent = state.groups.length
        ? "调整筛选条件后重试。"
        : "先配置 Cloudflare 凭据，然后为节点创建规则组。";
    }
    var visibleIds = groups.map(function (group) { return group.id; });
    byId("select-all").checked =
      visibleIds.length > 0 &&
      visibleIds.every(function (id) { return state.selectedGroups.has(id); });
    renderBulkBar();
  }

  function renderGroupDetail(group, node) {
    var tr = el("tr", "detail-row");
    var cell = el("td");
    cell.colSpan = 9;
    var detail = el("div", "group-detail");
    var heading = el("div", "detail-heading");
    var title = el("div");
    title.appendChild(el("strong", "", (node ? node.name : nodeName(group.nodeUuid)) + " · " + modeLabel(group.mode)));
    title.appendChild(el("span", "", "  " + group.domains.length + " 个域名，每 " + group.intervalMinutes + " 分钟检查"));
    heading.appendChild(title);
    detail.appendChild(heading);

    var table = el("table", "target-table");
    var thead = el("thead");
    var headRow = el("tr");
    ["域名", "类型", "当前 IP", "状态", "上次同步"].forEach(function (label) {
      headRow.appendChild(el("th", "", label));
    });
    thead.appendChild(headRow);
    table.appendChild(thead);
    var tbody = el("tbody");
    var records = groupRecords(group);
    records.forEach(function (record) {
      var status = recordStatus(record);
      var row = el("tr");
      row.appendChild(el("td", "target-domain", record.domain));
      var typeCell = el("td");
      typeCell.appendChild(el("span", "type-badge", record.type));
      row.appendChild(typeCell);
      row.appendChild(el("td", "mono", status.currentIp || "—"));
      var stateCell = el("td");
      stateCell.appendChild(el("span", "badge " + status.state, status.label));
      if (status.error) {
        var error = el("div", "target-error", status.error);
        error.title = status.error;
        stateCell.appendChild(error);
      }
      row.appendChild(stateCell);
      row.appendChild(el("td", "", formatTime(status.lastCheckedAt)));
      tbody.appendChild(row);
    });
    table.appendChild(tbody);
    detail.appendChild(table);

    var actions = el("div", "detail-actions");
    actions.appendChild(textButton("edit", "编辑规则", function () { openEditComposer(group.id); }));
    actions.appendChild(textButton("play", "立即同步", function () { syncGroup(group.id); }));
    actions.appendChild(textButton(group.enabled ? "pause" : "power", group.enabled ? "停用" : "启用", function () {
      runBulk(group.enabled ? "disable" : "enable", [group.id]);
    }));
    actions.appendChild(textButton("trash", "删除规则组", function () { runBulk("delete", [group.id]); }, true));
    detail.appendChild(actions);
    cell.appendChild(detail);
    tr.appendChild(cell);
    return tr;
  }

  function textButton(icon, label, handler, danger) {
    var button = el("button", "button " + (danger ? "danger" : "secondary"));
    button.type = "button";
    button.innerHTML = iconSvg(icon) + "<span>" + label + "</span>";
    button.addEventListener("click", handler);
    return button;
  }

  function rowAction(icon, label, handler, danger) {
    var button = el("button", "row-action" + (danger ? " danger" : ""));
    button.type = "button";
    button.title = label;
    button.setAttribute("aria-label", label);
    button.innerHTML = iconSvg(icon);
    button.addEventListener("click", handler);
    return button;
  }

  function renderBulkBar() {
    var count = state.selectedGroups.size;
    byId("bulk-bar").hidden = count === 0;
    byId("bulk-count").textContent = "已选 " + count + " 个节点规则组";
  }

  function renderSettings() {
    var settings = state.settings || {};
    document.querySelectorAll("#auth-mode-control button").forEach(function (button) {
      button.classList.toggle("active", button.getAttribute("data-auth") === state.authMode);
    });
    byId("group-token").hidden = state.authMode !== "token";
    byId("group-key").hidden = state.authMode !== "key";
    byId("email").value = settings.email || "";
    byId("settings-interval").value = String(settings.intervalMinutes || 1);
    byId("notify").checked = Boolean(settings.notify);
    byId("compare-mode").value = settings.compareMode || "local";
    updateCompareModeHelp();
    byId("token").value = "";
    byId("api-key").value = "";
    byId("token-hint").textContent = settings.hasToken
      ? "已保存 API Token；留空保存会保留当前 Token。"
      : "支持用户 API Token 和 Account API Token。需要 Zone > Zone > Read 与 Zone > DNS > Edit。";
    byId("key-hint").textContent = settings.hasApiKey
      ? "已保存 Global API Key；留空保存会保留当前 Key。"
      : "这不是 API Token，也不是 Origin CA Key。";
  }

  function renderMode() {
    document.querySelectorAll("#mode-control button").forEach(function (button) {
      button.classList.toggle("active", button.getAttribute("data-mode") === state.mode);
    });
    updatePreview();
  }

  function updateCompareModeHelp() {
    var mode = byId("compare-mode").value;
    byId("compare-mode-help").textContent =
      mode === "cloudflare"
        ? "每次检查都读取 Cloudflare DNS 记录并对比，能发现 Cloudflare 端被外部修改的 IP。"
        : "先对比节点 IP 与上次成功推送 IP；未变化时不访问 Cloudflare DNS 接口，手动同步仍会强制检查。";
  }

  function updatePreview() {
    var domains = parseDomainText(byId("domains").value);
    var count = domains.length * state.composerNodes.size * selectedTypeCount();
    byId("domain-count").textContent = domains.length + " 个域名";
    var text = byId("batch-preview");
    if (!domains.length || !state.composerNodes.size) {
      text.textContent = "等待选择节点和域名";
      text.className = "preview-text";
      byId("btn-create-batch").disabled = true;
      return;
    }
    var verb = state.editingGroupId ? "更新" : "创建";
    text.textContent =
      verb + " " + domains.length + " 个域名 × " + state.composerNodes.size +
      " 台节点 × " + selectedTypeCount() + " 种地址 = " + count + " 条 DNS 目标";
    text.className = "preview-text" + (count > 1000 ? " preview-over" : "");
    byId("btn-create-batch").disabled = count > 1000 || Boolean(state.sync.running);
  }

  function setComposer(open) {
    state.composerOpen = open;
    byId("composer").hidden = !open;
    if (open) {
      renderNodes();
      updatePreview();
      byId("domains").focus();
    }
  }

  function resetComposer() {
    state.editingGroupId = null;
    state.composerNodes.clear();
    byId("composer").classList.remove("editing");
    byId("node-field").hidden = false;
    byId("edit-node-lock").hidden = true;
    byId("composer-title").textContent = "新建节点规则";
    byId("composer-subtitle").textContent = "每台节点生成一个独立规则组，可重复创建 IPv4 和 IPv6 规则。";
    byId("btn-create-batch-label").textContent = "创建规则";
    byId("domains").value = "";
    byId("node-search").value = "";
    byId("ttl").value = "1";
    byId("interval").value = String((state.settings && state.settings.intervalMinutes) || 1);
    byId("proxied").checked = false;
    byId("adopt-existing").checked = false;
    byId("ttl").disabled = false;
    state.mode = "dual";
    renderNodes();
    renderMode();
    updateProxyIcon();
  }

  function openAddComposer() {
    resetComposer();
    setComposer(true);
  }

  function openEditComposer(groupId) {
    var group = state.groups.find(function (item) { return item.id === groupId; });
    if (!group) return;
    state.editingGroupId = groupId;
    state.composerNodes = new Set([group.nodeUuid]);
    state.mode = group.mode;
    byId("composer").classList.add("editing");
    byId("node-field").hidden = true;
    byId("edit-node-lock").hidden = false;
    byId("edit-node-lock").textContent = "当前节点：" + nodeName(group.nodeUuid) + "。编辑时节点不可更改。";
    byId("composer-title").textContent = "编辑节点规则";
    byId("composer-subtitle").textContent = "修改域名、模式、TTL、代理和同步间隔；节点保持不变。";
    byId("btn-create-batch-label").textContent = "保存修改";
    byId("domains").value = group.domains.join("\n");
    byId("ttl").value = String(group.ttl);
    byId("interval").value = String(group.intervalMinutes);
    byId("proxied").checked = Boolean(group.proxied);
    byId("adopt-existing").checked = Boolean(group.adoptExisting);
    byId("ttl").disabled = Boolean(group.proxied);
    renderNodes();
    renderMode();
    updateProxyIcon();
    setComposer(true);
  }

  function toggleGroup(groupId) {
    if (state.expandedGroups.has(groupId)) state.expandedGroups.delete(groupId);
    else state.expandedGroups.add(groupId);
    renderGroups();
  }

  function switchPanel(name) {
    state.activePanel = name;
    ["records", "settings", "logs"].forEach(function (panel) {
      byId("panel-" + panel).hidden = panel !== name;
      byId("tab-" + panel).classList.toggle("active", panel === name);
    });
    if (name === "logs") refreshLogs();
  }

  function renderAll() {
    renderHeader();
    renderNodes();
    renderGroups();
    renderSettings();
    renderMode();
    updateProxyIcon();
  }

  function loadAll() {
    return Promise.all([api("/state"), api("/nodes")]).then(function (values) {
      applyState(values[0]);
      state.authMode = state.settings.authMode || "token";
      state.nodes = Array.isArray(values[1]) ? values[1] : [];
      renderAll();
      var requested = new URLSearchParams(location.search).get("panel");
      if (requested === "records" || requested === "settings" || requested === "logs") {
        switchPanel(requested);
      } else if (!hasCredentials(state.settings)) {
        switchPanel("settings");
      }
    });
  }

  function refreshState() {
    return api("/state").then(function (data) {
      applyState(data);
      renderHeader();
      renderNodes();
      renderGroups();
    });
  }

  function logLevelLabel(value) {
    return { success: "成功", error: "错误", warning: "警告", info: "信息" }[value] || value || "—";
  }

  function logActionLabel(value) {
    return {
      update: "更新",
      create: "创建",
      sync: "同步",
      "batch-add": "批量添加",
      "group-update": "编辑规则组",
      "bulk-enable": "批量启用",
      "bulk-disable": "批量停用",
      "bulk-delete": "批量删除",
      pause: "暂停",
      resume: "恢复",
      settings: "设置",
      schedule: "调度",
      notify: "通知",
    }[value] || value || "—";
  }

  function refreshLogs() {
    var level = byId("log-filter").value;
    return api("/logs?limit=500" + (level ? "&level=" + encodeURIComponent(level) : ""))
      .then(function (data) {
        var body = byId("logs-body");
        body.replaceChildren();
        var logs = data.logs || [];
        logs.forEach(function (log) {
          var tr = el("tr");
          tr.appendChild(el("td", "", formatTime(log.at)));
          var levelCell = el("td");
          var levelClass = log.level === "success" ? "success" : log.level === "error" ? "error" : log.level === "warning" ? "skipped" : "pending";
          levelCell.appendChild(el("span", "badge " + levelClass, logLevelLabel(log.level)));
          tr.appendChild(levelCell);
          tr.appendChild(el("td", "", logActionLabel(log.action)));
          tr.appendChild(el("td", "mono", log.domain || "—"));
          tr.appendChild(el("td", "", log.message || ""));
          body.appendChild(tr);
        });
        byId("empty-logs").hidden = logs.length > 0;
      })
      .catch(function (error) {
        showToast(error.message, "error");
      });
  }

  function saveSettings() {
    var payload = {
      authMode: state.authMode,
      email: byId("email").value,
      token: byId("token").value,
      apiKey: byId("api-key").value,
      intervalMinutes: Number(byId("settings-interval").value),
      notify: byId("notify").checked,
      compareMode: byId("compare-mode").value,
    };
    api("/settings", { method: "POST", body: JSON.stringify(payload) })
      .then(function (data) {
        state.settings = data.settings;
        renderSettings();
        renderHeader();
        showToast("设置已保存。", "success");
        if (hasCredentials(state.settings) && state.activePanel === "settings") switchPanel("records");
      })
      .catch(function (error) {
        showToast(error.message, "error");
      });
  }

  function testConnection() {
    var result = byId("test-result");
    result.textContent = "测试中…";
    result.className = "test-result";
    api("/settings/test", {
      method: "POST",
      body: JSON.stringify({
        authMode: state.authMode,
        email: byId("email").value,
        token: byId("token").value,
        apiKey: byId("api-key").value,
      }),
    })
      .then(function (data) {
        result.textContent = data.message;
        result.className = "test-result ok";
        showToast(data.message, "success");
      })
      .catch(function (error) {
        result.textContent = error.message;
        result.className = "test-result bad";
        showToast(error.message, "error");
      });
  }

  function createBatch() {
    var payload = {
      domains: byId("domains").value,
      mode: state.mode,
      ttl: Number(byId("ttl").value),
      proxied: byId("proxied").checked,
      intervalMinutes: Number(byId("interval").value),
      enabled: true,
      adoptExisting: byId("adopt-existing").checked,
    };
    if (state.editingGroupId) {
      var group = state.groups.find(function (item) { return item.id === state.editingGroupId; });
      if (group) payload.enabled = group.enabled;
      payload.groupId = state.editingGroupId;
      api("/groups/update", { method: "POST", body: JSON.stringify(payload) })
        .then(function () {
          showToast("节点规则组已更新；被移除的目标不会自动删除 Cloudflare 记录。", "success");
          resetComposer();
          setComposer(false);
          refreshState();
        })
        .catch(function (error) { showToast(error.message, "error"); });
      return;
    }
    payload.nodeUuids = Array.from(state.composerNodes);
    api("/records/batch", { method: "POST", body: JSON.stringify(payload) })
      .then(function (data) {
        showToast("已创建 " + data.groupsAdded + " 个节点规则组，共 " + data.recordsAdded + " 条 DNS 目标。", "success");
        resetComposer();
        setComposer(false);
        refreshState();
      })
      .catch(function (error) { showToast(error.message, "error"); });
  }

  function runBulk(action, ids) {
    ids = ids || Array.from(state.selectedGroups);
    if (!ids.length) return;
    if (action === "delete" && !confirm("删除选中的节点规则组？Cloudflare DNS 记录会保留。")) return;
    api("/records/bulk", { method: "POST", body: JSON.stringify({ action: action, ids: ids }) })
      .then(function () {
        if (action === "delete" || action === "enable" || action === "disable") {
          state.selectedGroups.clear();
          showToast("批量操作已完成。", "success");
        } else {
          showToast("同步任务已启动。", "success");
        }
        refreshState();
      })
      .catch(function (error) { showToast(error.message, "error"); });
  }

  function syncAll() {
    api("/sync", { method: "POST", body: JSON.stringify({ force: true }) })
      .then(function (data) {
        state.sync = data.job || state.sync;
        renderHeader();
        showToast(data.job && data.job.message ? data.job.message : "同步任务已启动。", "success");
      })
      .catch(function (error) { showToast(error.message, "error"); });
  }

  function syncGroup(groupId) {
    api("/sync", { method: "POST", body: JSON.stringify({ groupIds: [groupId], force: true }) })
      .then(function () {
        showToast("同步任务已启动。", "success");
        refreshState();
      })
      .catch(function (error) { showToast(error.message, "error"); });
  }

  function togglePause() {
    var paused = !state.settings.paused;
    api("/pause", { method: "POST", body: JSON.stringify({ paused: paused }) })
      .then(function () {
        state.settings.paused = paused;
        renderHeader();
        showToast(paused ? "计划同步已暂停。" : "计划同步已恢复。", "success");
      })
      .catch(function (error) { showToast(error.message, "error"); });
  }

  function bind() {
    document.querySelectorAll(".tab").forEach(function (tab) {
      tab.addEventListener("click", function () { switchPanel(tab.getAttribute("data-panel")); });
    });
    byId("btn-refresh").addEventListener("click", function () {
      loadAll().then(function () { showToast("已刷新。", "success"); }).catch(function (error) { showToast(error.message, "error"); });
    });
    byId("btn-toggle-pause").addEventListener("click", togglePause);
    byId("btn-add").addEventListener("click", openAddComposer);
    byId("btn-empty-add").addEventListener("click", openAddComposer);
    byId("btn-cancel-add").addEventListener("click", function () { setComposer(false); });
    byId("btn-cancel-add-2").addEventListener("click", function () { setComposer(false); });
    byId("btn-create-batch").addEventListener("click", createBatch);
    byId("btn-sync-all").addEventListener("click", syncAll);
    byId("btn-test").addEventListener("click", testConnection);
    byId("btn-save-settings").addEventListener("click", saveSettings);
    byId("node-search").addEventListener("input", renderNodes);
    byId("domains").addEventListener("input", updatePreview);
    byId("mode-control").addEventListener("click", function (event) {
      var button = event.target.closest("button[data-mode]");
      if (!button) return;
      state.mode = button.getAttribute("data-mode");
      renderMode();
    });
    byId("auth-mode-control").addEventListener("click", function (event) {
      var button = event.target.closest("button[data-auth]");
      if (!button) return;
      state.authMode = button.getAttribute("data-auth");
      byId("group-token").hidden = state.authMode !== "token";
      byId("group-key").hidden = state.authMode !== "key";
      document.querySelectorAll("#auth-mode-control button").forEach(function (item) {
        item.classList.toggle("active", item === button);
      });
    });
    byId("proxied").addEventListener("change", function () {
      byId("ttl").disabled = byId("proxied").checked;
      if (byId("proxied").checked) byId("ttl").value = "1";
      updateProxyIcon();
    });
    byId("compare-mode").addEventListener("change", updateCompareModeHelp);
    byId("filter-search").addEventListener("input", renderGroups);
    byId("filter-status").addEventListener("change", renderGroups);
    byId("btn-clear-filters").addEventListener("click", function () {
      byId("filter-search").value = "";
      byId("filter-status").value = "";
      renderGroups();
    });
    byId("select-all").addEventListener("change", function () {
      var checked = byId("select-all").checked;
      visibleGroups().forEach(function (group) {
        if (checked) state.selectedGroups.add(group.id);
        else state.selectedGroups.delete(group.id);
      });
      renderGroups();
    });
    byId("btn-select-all-nodes").addEventListener("click", function () {
      if (state.editingGroupId) return;
      state.nodes.forEach(function (node) { state.composerNodes.add(node.uuid); });
      renderNodes();
      updatePreview();
    });
    byId("btn-clear-nodes").addEventListener("click", function () {
      if (state.editingGroupId) return;
      state.composerNodes.clear();
      renderNodes();
      updatePreview();
    });
    byId("btn-bulk-enable").addEventListener("click", function () { runBulk("enable"); });
    byId("btn-bulk-disable").addEventListener("click", function () { runBulk("disable"); });
    byId("btn-bulk-sync").addEventListener("click", function () { runBulk("sync"); });
    byId("btn-bulk-delete").addEventListener("click", function () { runBulk("delete"); });
    byId("btn-refresh-logs").addEventListener("click", refreshLogs);
    byId("log-filter").addEventListener("change", refreshLogs);
    byId("btn-clear-logs").addEventListener("click", function () {
      if (!confirm("清空全部运行日志？")) return;
      api("/logs", { method: "DELETE" })
        .then(function () { refreshLogs(); showToast("日志已清空。", "success"); })
        .catch(function (error) { showToast(error.message, "error"); });
    });
  }

  function poll() {
    if (document.hidden) return;
    refreshState().catch(function (error) { showToast(error.message, "error"); });
  }

  watchTheme();
  hydrateIcons();
  bind();
  loadAll()
    .then(function () { setInterval(poll, 4000); })
    .catch(function (error) { showToast(error.message, "error"); });
})();
