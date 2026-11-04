(function () {
  "use strict";

  var API_BASE = "/ddns-plus";
  var state = {
    settings: null,
    records: [],
    statuses: {},
    sync: { running: false, total: 0, completed: 0, changed: 0, skipped: 0, errors: 0 },
    csrf: "",
    nodes: [],
    selectedRecords: new Set(),
    composerNodes: new Set(),
    mode: "dual",
    authMode: "token",
    activePanel: "records",
    composerOpen: false,
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
    alert: '<circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/>',
  };

  function iconSvg(name) {
    return (
      '<svg viewBox="0 0 24 24" aria-hidden="true">' +
      (ICONS[name] || ICONS.alert) +
      "</svg>"
    );
  }

  function hydrateIcons(root) {
    (root || document).querySelectorAll("[data-icon]").forEach(function (node) {
      node.innerHTML = iconSvg(node.getAttribute("data-icon"));
    });
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

  function showToast(message, kind) {
    var toast = byId("toast");
    toast.textContent = message || "";
    toast.className = "toast visible " + (kind || "");
    clearTimeout(state.toastTimer);
    state.toastTimer = setTimeout(function () {
      toast.className = "toast";
    }, 3600);
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

  function statusInfo(record) {
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
    };
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
      "bulk-enable": "批量启用",
      "bulk-disable": "批量停用",
      "bulk-delete": "批量删除",
      settings: "设置",
      schedule: "调度",
      notify: "通知",
    }[value] || value || "—";
  }

  function nodeName(uuid) {
    var node = state.nodes.find(function (item) {
      return item.uuid === uuid;
    });
    return node ? node.name : uuid.slice(0, 8);
  }

  function hasCredentials(settings) {
    if (!settings) return false;
    return settings.authMode === "token" ? settings.hasToken : Boolean(settings.email && settings.hasApiKey);
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
          if (!response.ok) {
            throw new Error(data.error || "请求失败（HTTP " + response.status + "）");
          }
          return data;
        });
    });
  }

  function applyState(data) {
    state.settings = data.settings || {};
    state.records = Array.isArray(data.records) ? data.records : [];
    state.statuses = data.statuses || {};
    state.sync = data.sync || state.sync;
    state.csrf = data.csrf || state.csrf;
    var existing = new Set(
      state.records.map(function (record) {
        return record.id;
      }),
    );
    Array.from(state.selectedRecords).forEach(function (id) {
      if (!existing.has(id)) state.selectedRecords.delete(id);
    });
  }

  function renderHeader() {
    var pill = byId("sync-state");
    var job = state.sync || {};
    if (job.running) {
      pill.className = "status-pill status-running";
      pill.textContent =
        "同步中 " + Number(job.completed || 0) + "/" + Number(job.total || 0);
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
    var progress = byId("sync-progress");
    if (job.running) {
      progress.hidden = false;
      progress.textContent =
        "正在同步 " +
        Number(job.completed || 0) +
        "/" +
        Number(job.total || 0) +
        "，已变更 " +
        Number(job.changed || 0) +
        " 条";
    } else if (job.message) {
      progress.hidden = false;
      progress.textContent = job.message;
    } else {
      progress.hidden = true;
      progress.textContent = "";
    }
    var busy = Boolean(job.running);
    byId("btn-sync-all").disabled = busy;
    byId("btn-create-batch").disabled = busy;
    byId("btn-test").disabled = busy;
    byId("btn-save-settings").disabled = busy;
    byId("btn-bulk-sync").disabled = busy;
  }

  function renderNodes() {
    var list = byId("node-list");
    var search = String(byId("node-search").value || "").trim().toLowerCase();
    list.replaceChildren();
    var visible = state.nodes.filter(function (node) {
      return !search || (node.name + " " + node.uuid).toLowerCase().indexOf(search) >= 0;
    });
    if (!visible.length) {
      list.appendChild(el("div", "empty-inline", "没有匹配的节点"));
    }
    visible.forEach(function (node) {
      var label = el("label", "node-option");
      var input = el("input");
      input.type = "checkbox";
      input.checked = state.composerNodes.has(node.uuid);
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
      copy.appendChild(
        el(
          "small",
          "",
          [node.ipv4 || "无 IPv4", node.ipv6 || "无 IPv6"].join(" · "),
        ),
      );
      label.appendChild(input);
      label.appendChild(copy);
      list.appendChild(label);
    });
    byId("node-count").textContent = "已选 " + state.composerNodes.size + " 台";
  }

  function visibleRecords() {
    var search = String(byId("filter-search").value || "").trim().toLowerCase();
    var filter = byId("filter-status").value;
    return state.records.filter(function (record) {
      var status = statusInfo(record).state;
      if (filter && status !== filter) return false;
      if (!search) return true;
      return (
        (record.domain + " " + nodeName(record.nodeUuid) + " " + record.type)
          .toLowerCase()
          .indexOf(search) >= 0
      );
    });
  }

  function renderRecords() {
    var body = byId("records-body");
    body.replaceChildren();
    var records = visibleRecords();
    records.forEach(function (record) {
      var status = statusInfo(record);
      var node = state.nodes.find(function (item) {
        return item.uuid === record.nodeUuid;
      });
      var tr = el("tr");

      var checkCell = el("td", "check-cell");
      var check = el("input");
      check.type = "checkbox";
      check.checked = state.selectedRecords.has(record.id);
      check.setAttribute("aria-label", "选择 " + record.domain);
      check.addEventListener("change", function () {
        if (check.checked) state.selectedRecords.add(record.id);
        else state.selectedRecords.delete(record.id);
        renderBulkBar();
        renderRecords();
      });
      checkCell.appendChild(check);
      tr.appendChild(checkCell);

      tr.appendChild(el("td", "domain-cell", record.domain));
      var typeCell = el("td");
      typeCell.appendChild(el("span", "type-badge", record.type));
      tr.appendChild(typeCell);

      var nodeCell = el("td", "node-cell");
      nodeCell.appendChild(
        el("span", "online-dot" + (node && node.online ? "" : " offline")),
      );
      nodeCell.appendChild(document.createTextNode(nodeName(record.nodeUuid)));
      tr.appendChild(nodeCell);

      var statusData = state.statuses[record.id] || {};
      tr.appendChild(el("td", "ip-cell mono", statusData.currentIp || "—"));
      tr.appendChild(el("td", "", ttlLabel(record.ttl)));
      tr.appendChild(el("td", "", record.proxied ? "已代理" : "未代理"));

      var stateCell = el("td");
      var badge = el("span", "badge " + status.state, status.label);
      if (status.error) badge.title = status.error;
      stateCell.appendChild(badge);
      if (status.error) {
        var error = el("div", "row-error", status.error);
        error.title = status.error;
        stateCell.appendChild(error);
      }
      tr.appendChild(stateCell);
      tr.appendChild(el("td", "", formatTime(statusData.lastCheckedAt)));

      var actionCell = el("td", "action-cell");
      var actions = el("div", "row-actions");
      actions.appendChild(rowAction("play", "立即同步", function () {
        runBulk("sync", [record.id]);
      }));
      actions.appendChild(
        rowAction(record.enabled ? "pause" : "power", record.enabled ? "停用" : "启用", function () {
          runBulk(record.enabled ? "disable" : "enable", [record.id]);
        }),
      );
      actions.appendChild(
        rowAction("trash", "删除规则", function () {
          runBulk("delete", [record.id]);
        }, true),
      );
      actionCell.appendChild(actions);
      tr.appendChild(actionCell);
      body.appendChild(tr);
    });

    var empty = byId("empty-records");
    empty.hidden = records.length > 0;
    if (!records.length) {
      empty.querySelector("h3").textContent = state.records.length ? "没有匹配的规则" : "还没有 DDNS 规则";
      empty.querySelector("p").textContent = state.records.length
        ? "调整筛选条件后重试。"
        : "先配置 Cloudflare 凭据，然后批量添加域名。";
    }
    var visibleIds = records.map(function (record) {
      return record.id;
    });
    var allChecked =
      visibleIds.length > 0 &&
      visibleIds.every(function (id) {
        return state.selectedRecords.has(id);
      });
    byId("select-all").checked = allChecked;
    renderBulkBar();
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
    var count = state.selectedRecords.size;
    var bar = byId("bulk-bar");
    bar.hidden = count === 0;
    byId("bulk-count").textContent = "已选 " + count + " 条";
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
    byId("token").value = "";
    byId("api-key").value = "";
    byId("token-hint").textContent = settings.hasToken
      ? "已保存 API Token；留空保存会保留当前 Token。"
      : "建议使用 Zone.Zone:Read 和 Zone.DNS:Edit 权限。";
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
    text.textContent =
      domains.length +
      " 个域名 × " +
      state.composerNodes.size +
      " 台节点 × " +
      selectedTypeCount() +
      " 种地址 = " +
      count +
      " 条记录";
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
    state.composerNodes.clear();
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
    renderRecords();
    renderSettings();
    renderMode();
    if (state.activePanel === "logs") refreshLogs();
  }

  function loadAll() {
    return Promise.all([api("/state"), api("/nodes")]).then(function (values) {
      applyState(values[0]);
      state.authMode = state.settings.authMode || "token";
      state.nodes = Array.isArray(values[1]) ? values[1] : [];
      renderAll();
      if (!hasCredentials(state.settings)) switchPanel("settings");
    });
  }

  function refreshState() {
    return api("/state").then(function (data) {
      applyState(data);
      renderHeader();
      renderNodes();
      renderRecords();
    });
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
          levelCell.appendChild(el("span", "badge " + (log.level === "success" ? "success" : log.level === "error" ? "error" : log.level === "warning" ? "skipped" : "pending"), logLevelLabel(log.level)));
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
    };
    api("/settings", { method: "POST", body: JSON.stringify(payload) })
      .then(function (data) {
        state.settings = data.settings;
        renderSettings();
        showToast("设置已保存。", "success");
        if (hasCredentials(state.settings) && state.activePanel === "settings") {
          switchPanel("records");
        }
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
      nodeUuids: Array.from(state.composerNodes),
      domains: byId("domains").value,
      mode: state.mode,
      ttl: Number(byId("ttl").value),
      proxied: byId("proxied").checked,
      intervalMinutes: Number(byId("interval").value),
      enabled: true,
      adoptExisting: byId("adopt-existing").checked,
    };
    api("/records/batch", { method: "POST", body: JSON.stringify(payload) })
      .then(function (data) {
        showToast(
          "已创建 " + data.added + " 条规则" + (data.skipped ? "，跳过 " + data.skipped + " 条重复规则。" : "。"),
          "success",
        );
        resetComposer();
        setComposer(false);
        refreshState();
      })
      .catch(function (error) {
        showToast(error.message, "error");
      });
  }

  function runBulk(action, ids) {
    ids = ids || Array.from(state.selectedRecords);
    if (!ids.length) return;
    if (action === "delete" && !confirm("确定删除选中的规则？Cloudflare DNS 记录会保留。")) return;
    api("/records/bulk", {
      method: "POST",
      body: JSON.stringify({ action: action, ids: ids }),
    })
      .then(function () {
        if (action === "delete" || action === "enable" || action === "disable") {
          state.selectedRecords.clear();
          showToast("批量操作已完成。", "success");
        } else {
          showToast("同步任务已启动。", "success");
        }
        refreshState();
      })
      .catch(function (error) {
        showToast(error.message, "error");
      });
  }

  function syncAll() {
    api("/sync", { method: "POST", body: JSON.stringify({ force: true }) })
      .then(function (data) {
        state.sync = data.job || state.sync;
        renderHeader();
        showToast(data.job && data.job.message ? data.job.message : "同步任务已启动。", "success");
      })
      .catch(function (error) {
        showToast(error.message, "error");
      });
  }

  function bind() {
    document.querySelectorAll(".tab").forEach(function (tab) {
      tab.addEventListener("click", function () {
        switchPanel(tab.getAttribute("data-panel"));
      });
    });
    byId("btn-refresh").addEventListener("click", function () {
      loadAll().then(function () {
        showToast("已刷新。", "success");
      }).catch(function (error) {
        showToast(error.message, "error");
      });
    });
    byId("btn-add").addEventListener("click", function () {
      resetComposer();
      setComposer(true);
    });
    byId("btn-empty-add").addEventListener("click", function () {
      resetComposer();
      setComposer(true);
    });
    byId("btn-cancel-add").addEventListener("click", function () {
      setComposer(false);
    });
    byId("btn-cancel-add-2").addEventListener("click", function () {
      setComposer(false);
    });
    byId("btn-create-batch").addEventListener("click", createBatch);
    byId("btn-sync-all").addEventListener("click", syncAll);
    byId("btn-test").addEventListener("click", testConnection);
    byId("btn-save-settings").addEventListener("click", saveSettings);
    byId("node-search").addEventListener("input", renderNodes);
    byId("btn-select-all-nodes").addEventListener("click", function () {
      state.nodes.forEach(function (node) {
        state.composerNodes.add(node.uuid);
      });
      renderNodes();
      updatePreview();
    });
    byId("btn-clear-nodes").addEventListener("click", function () {
      state.composerNodes.clear();
      renderNodes();
      updatePreview();
    });
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
    });
    byId("filter-search").addEventListener("input", renderRecords);
    byId("filter-status").addEventListener("change", renderRecords);
    byId("btn-clear-filters").addEventListener("click", function () {
      byId("filter-search").value = "";
      byId("filter-status").value = "";
      renderRecords();
    });
    byId("select-all").addEventListener("change", function () {
      var checked = byId("select-all").checked;
      visibleRecords().forEach(function (record) {
        if (checked) state.selectedRecords.add(record.id);
        else state.selectedRecords.delete(record.id);
      });
      renderRecords();
    });
    byId("btn-bulk-enable").addEventListener("click", function () {
      runBulk("enable");
    });
    byId("btn-bulk-disable").addEventListener("click", function () {
      runBulk("disable");
    });
    byId("btn-bulk-sync").addEventListener("click", function () {
      runBulk("sync");
    });
    byId("btn-bulk-delete").addEventListener("click", function () {
      runBulk("delete");
    });
    byId("btn-refresh-logs").addEventListener("click", refreshLogs);
    byId("log-filter").addEventListener("change", refreshLogs);
    byId("btn-clear-logs").addEventListener("click", function () {
      if (!confirm("清空全部运行日志？")) return;
      api("/logs", { method: "DELETE" })
        .then(function () {
          refreshLogs();
          showToast("日志已清空。", "success");
        })
        .catch(function (error) {
          showToast(error.message, "error");
        });
    });
  }

  function poll() {
    if (document.hidden) return;
    refreshState().catch(function (error) {
      showToast(error.message, "error");
    });
  }

  hydrateIcons();
  bind();
  loadAll()
    .then(function () {
      setInterval(poll, 4000);
    })
    .catch(function (error) {
      showToast(error.message, "error");
    });
})();
