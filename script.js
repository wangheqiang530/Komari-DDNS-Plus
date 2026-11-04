"use strict";
(() => {
  var __create = Object.create;
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __getProtoOf = Object.getPrototypeOf;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
    get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
  }) : x)(function(x) {
    if (typeof require !== "undefined") return require.apply(this, arguments);
    throw Error('Dynamic require of "' + x + '" is not supported');
  });
  var __commonJS = (cb, mod) => function __require2() {
    try {
      return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
    } catch (e) {
      throw mod = 0, e;
    }
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
    // If the importer is in node compatibility mode or this is not an ESM
    // file that has been converted to a CommonJS file using a Babel-
    // compatible transform (i.e. "__esModule" has not been set), then set
    // "default" to the CommonJS "module.exports" for node compatibility.
    isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
    mod
  ));

  // node_modules/@komari-monitor/plugin-sdk/src/manifest.js
  var require_manifest = __commonJS({
    "node_modules/@komari-monitor/plugin-sdk/src/manifest.js"(exports, module) {
      "use strict";
      function isObject(value) {
        return value !== null && typeof value === "object" && !Array.isArray(value);
      }
      function hasText(value) {
        if (typeof value === "string") return value.trim().length > 0;
        if (!isObject(value)) return false;
        return Object.values(value).some((item) => typeof item === "string" && item.trim());
      }
      function isLocalPath(value) {
        if (typeof value !== "string" || !value) return false;
        const normalized = value.replaceAll("\\", "/");
        if (normalized.startsWith("/") || /^[A-Za-z]:\//.test(normalized)) return false;
        return !normalized.split("/").some((part) => part === "..") && normalized !== ".";
      }
      function validateManifest(manifest) {
        const errors = [];
        if (!isObject(manifest)) return ["manifest must be an object"];
        if (!hasText(manifest.name)) errors.push("name is required");
        if (typeof manifest.short !== "string" || !/^[A-Za-z0-9_-]+$/.test(manifest.short) || manifest.short === "default") {
          errors.push("short must contain only letters, digits, '_' and '-', and cannot be 'default'");
        }
        if (manifest.entry !== void 0 && !isLocalPath(manifest.entry)) {
          errors.push("entry must be a relative path inside the plugin directory");
        }
        if (manifest.icon !== void 0 && manifest.icon !== "" && !isLocalPath(manifest.icon)) {
          errors.push("icon must be a relative path inside the plugin directory");
        }
        if (manifest.version !== void 0 && typeof manifest.version !== "string") {
          errors.push("version must be a string");
        }
        if (manifest.komari !== void 0 && typeof manifest.komari !== "string") {
          errors.push("komari must be a string");
        }
        if (manifest.configuration !== void 0) {
          if (!isObject(manifest.configuration) || manifest.configuration.type !== "managed" || !Array.isArray(manifest.configuration.data)) {
            errors.push("configuration must be a managed configuration with a data array");
          } else {
            const itemTypes = /* @__PURE__ */ new Set(["string", "number", "select", "switch", "title", "textbox", "richtext", "nodes", "pingtasks"]);
            manifest.configuration.data.forEach((item, index) => {
              if (!isObject(item)) {
                errors.push(`configuration.data[${index}] must be an object`);
                return;
              }
              if (item.type !== "title" && item.type !== "textbox" && (typeof item.key !== "string" || !item.key.trim())) errors.push(`configuration.data[${index}].key is required`);
              if (!hasText(item.name)) errors.push(`configuration.data[${index}].name is required`);
              if (!itemTypes.has(item.type)) errors.push(`configuration.data[${index}].type is invalid`);
            });
          }
        }
        if (manifest.permissions !== void 0) {
          if (!isObject(manifest.permissions)) {
            errors.push("permissions must be an object");
          } else {
            const booleanKeys = [
              "node",
              "allowSystemRPC",
              "allowRoutes",
              "allowHooks",
              "allowHTMLInject",
              "allowExec",
              "allowListen",
              "allowAllFileAccess"
            ];
            for (const key of booleanKeys) {
              if (manifest.permissions[key] !== void 0 && typeof manifest.permissions[key] !== "boolean") {
                errors.push(`permissions.${key} must be a boolean`);
              }
            }
            for (const key of ["maxHTTPBodyBytes", "maxChildOutputBytes", "timeout"]) {
              if (manifest.permissions[key] !== void 0 && (!Number.isInteger(manifest.permissions[key]) || manifest.permissions[key] < 0)) {
                errors.push(`permissions.${key} must be a non-negative integer`);
              }
            }
          }
        }
        if (manifest.pages !== void 0) {
          if (!Array.isArray(manifest.pages)) {
            errors.push("pages must be an array");
          } else {
            manifest.pages.forEach((page, index) => {
              const prefix = `pages[${index}]`;
              if (!isObject(page)) {
                errors.push(`${prefix} must be an object`);
                return;
              }
              if (!hasText(page.title)) errors.push(`${prefix}.title is required`);
              const type = page.type || "iframe";
              const visibility = page.visibility || "admin";
              if (type !== "iframe" && type !== "redirect") errors.push(`${prefix}.type must be iframe or redirect`);
              if (visibility !== "admin" && visibility !== "public") errors.push(`${prefix}.visibility must be admin or public`);
              if (page.icon && !isLocalPath(page.icon)) errors.push(`${prefix}.icon must be a relative path`);
              if (type === "iframe" && !isLocalPath(page.file)) errors.push(`${prefix}.file must be a relative path`);
              if (type === "redirect" && !isSafeInternalPath(page.url)) errors.push(`${prefix}.url must be a safe internal path`);
            });
          }
        }
        return errors;
      }
      function isSafeInternalPath(value) {
        if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) return false;
        if (value.includes("\\") || /^[A-Za-z][A-Za-z0-9+.-]*:/.test(value)) return false;
        return !value.split("/").includes("..");
      }
      function assertValidManifest(manifest) {
        const errors = validateManifest(manifest);
        if (errors.length > 0) throw new Error(errors.join("; "));
        return manifest;
      }
      module.exports = { assertValidManifest, validateManifest };
    }
  });

  // node_modules/@komari-monitor/plugin-sdk/src/rpc.js
  var require_rpc = __commonJS({
    "node_modules/@komari-monitor/plugin-sdk/src/rpc.js"(exports, module) {
      "use strict";
      function createRpcClient(getServer) {
        const methods = (includeInternal = false) => getServer().call("rpc.methods", { internal: includeInternal });
        return {
          call(method, ...params) {
            return getServer().call(method, ...params);
          },
          methods,
          has(method) {
            return methods(true).then((registered) => registered.includes(method));
          },
          help(method) {
            return getServer().call("rpc.help", { method });
          }
        };
      }
      module.exports = { createRpcClient };
    }
  });

  // node_modules/@komari-monitor/plugin-sdk/schema/komari-plugin.schema.json
  var require_komari_plugin_schema = __commonJS({
    "node_modules/@komari-monitor/plugin-sdk/schema/komari-plugin.schema.json"(exports, module) {
      module.exports = {
        $schema: "https://json-schema.org/draft/2020-12/schema",
        $id: "https://komari-monitor.github.io/plugin-sdk/komari-plugin.schema.json",
        title: "Komari Plugin Manifest",
        description: "Komari plugin manifest.",
        type: "object",
        required: ["name", "short"],
        properties: {
          $schema: { type: "string", description: "Schema URL used for editor validation." },
          name: { $ref: "#/$defs/localizedText", description: "Display name shown in Komari." },
          short: { type: "string", pattern: "^(?!default$)[A-Za-z0-9_-]+$", description: "Stable plugin identifier used in routes and RPC names." },
          description: { $ref: "#/$defs/localizedText", description: "Human-readable plugin description." },
          author: { $ref: "#/$defs/localizedText", description: "Plugin author or organization." },
          version: { type: "string", description: "Plugin version." },
          url: { type: "string", format: "uri", description: "Project or documentation URL." },
          icon: { type: "string", description: "Icon URL or plugin-relative icon path." },
          komari: { type: "string", description: "Compatible Komari version constraint, such as `>=1.4.0`." },
          entry: { type: "string", default: "script.js", description: "Compiled plugin entry file, relative to the package root." },
          permissions: { $ref: "#/$defs/permissions", description: "Runtime permissions requested by the plugin." },
          configuration: {
            type: "object",
            required: ["type", "data"],
            properties: {
              type: { const: "managed", description: "Use Komari-managed configuration storage." },
              data: { type: "array", items: { $ref: "#/$defs/configurationItem" }, description: "Configuration items shown in the admin UI." }
            },
            additionalProperties: false,
            description: "Optional configuration schema rendered by Komari."
          },
          pages: { type: "array", items: { $ref: "#/$defs/page" }, description: "Admin or public pages contributed by the plugin." }
        },
        additionalProperties: false,
        $defs: {
          localizedText: {
            description: "A string or a language-to-string map.",
            oneOf: [
              { type: "string", minLength: 1 },
              { type: "object", minProperties: 1, additionalProperties: { type: "string" } }
            ]
          },
          permissions: {
            description: "Capabilities that must be approved before enabling the plugin.",
            type: "object",
            properties: {
              node: { type: "boolean", description: "Enable Node.js-compatible modules." },
              allowSystemRPC: { type: "boolean", description: "Allow calls to system RPC methods." },
              allowRoutes: { type: "boolean", description: "Allow HTTP routes and static files." },
              allowHooks: { type: "boolean", description: "Allow request and response hooks." },
              allowHTMLInject: { type: "boolean", description: "Allow HTML head/body injection." },
              allowExec: { type: "boolean", description: "Allow child process execution." },
              allowListen: { type: "boolean", description: "Allow the plugin to listen on a local port." },
              allowAllFileAccess: { type: "boolean", description: "Allow file access outside the plugin directory." },
              maxHTTPBodyBytes: { type: "integer", minimum: 0, description: "Maximum request body size in bytes." },
              maxChildOutputBytes: { type: "integer", minimum: 0, description: "Maximum captured child process output in bytes." },
              timeout: { type: "integer", minimum: 0, description: "Plugin execution timeout in seconds." }
            },
            additionalProperties: false
          },
          page: {
            description: "A page exposed by the plugin.",
            type: "object",
            required: ["title"],
            properties: {
              file: { type: "string", description: "Page file relative to the plugin package." },
              title: { $ref: "#/$defs/localizedText", description: "Page title shown in navigation." },
              icon: { type: "string", description: "Page icon name or URL." },
              type: { enum: ["iframe", "redirect"], description: "Page presentation mode." },
              url: { type: "string", description: "Target URL for redirect pages." },
              visibility: { enum: ["admin", "public"], description: "Whether the page is visible to admins or the public." }
            },
            additionalProperties: false
          },
          configurationItem: {
            description: "One managed configuration field.",
            type: "object",
            required: ["name", "type"],
            properties: {
              key: { type: "string", minLength: 1, description: "Stable configuration key." },
              name: { $ref: "#/$defs/localizedText", description: "Label shown in the configuration UI." },
              type: { enum: ["string", "number", "select", "switch", "title", "textbox", "richtext", "nodes", "pingtasks"], description: "Editor control type." },
              options: { type: "string", description: "Options for select controls." },
              default: { description: "Default value." },
              required: { type: "boolean", description: "Whether a value is required." },
              help: { $ref: "#/$defs/localizedText", description: "Help text shown below the field." }
            },
            allOf: [
              {
                if: { properties: { type: { enum: ["title", "textbox"] } } },
                then: {},
                else: { required: ["key"] }
              }
            ],
            additionalProperties: false
          }
        }
      };
    }
  });

  // node_modules/@komari-monitor/plugin-sdk/src/rpc-catalog.json
  var require_rpc_catalog = __commonJS({
    "node_modules/@komari-monitor/plugin-sdk/src/rpc-catalog.json"(exports, module) {
      module.exports = {
        komari: "1.4.x",
        "rpc.methods": { params: "{ internal?: boolean }", returns: "string[]" },
        "rpc.version": { params: "none", returns: "string" },
        "rpc.ping": { params: "none", returns: "string ('pong')" },
        "rpc.help": { params: "{ method?: string }", returns: "MethodMeta | MethodMeta[]" },
        "common:getNodes": { params: "{ uuid?: string }", returns: "Client | Record<string, Client>" },
        "common:getNodesLatestStatus": { params: "{ uuid?: string, uuids?: string[] }", returns: "Record<string, unknown>" },
        "common:getMe": { params: "none", returns: "CurrentUser" },
        "common:getPublicInfo": { params: "none", returns: "PublicInfo" },
        "common:getVersion": { params: "none", returns: "{ version: string, hash: string }" },
        "common:getNodeRecentStatus": { params: "{ uuid: string }", returns: "{ count: number, records: unknown[] }" },
        "common:getRecords": { params: "RecordQuery", returns: "RecordQueryResponse" },
        "public:getMe": { params: "none", returns: "CurrentUser" },
        "public:getNodesInformation": { params: "none", returns: "Client[]" },
        "public:getPublicSettings": { params: "none", returns: "PublicInfo" },
        "public:getVersion": { params: "none", returns: "{ version: string, hash: string }" },
        "public:getClientRecentRecords": { params: "{ uuid: string }", returns: "unknown" },
        "public:getRecordsByUUID": { params: "{ uuid: string, load_type?: string, hours?: string }", returns: "{ records: unknown[], count: number }" },
        "public:getPingRecords": { params: "{ uuid?: string, task_id?: string | number }", returns: "{ records: unknown[], count: number }" },
        "public:getPublicPingTasks": { params: "none", returns: "PingTask[]" },
        "public:recordVisitorEvent": { params: "{ event: string, action?: string, path?: string, route?: string, target?: string, detail?: object }", returns: "{ status: string }" },
        "public:listMetricDefinitions": { params: "none", returns: "MetricDefinition[]" },
        "public:queryMetrics": { params: "MetricQuery", returns: "MetricSeriesResponse" },
        "public:getPingMetricStats": { params: "PingMetricStatsQuery", returns: "PingMetricStatsResponse" },
        "admin:addClient": { params: "{ name?: string }", returns: "{ uuid: string, token: string }" },
        "admin:editClient": { params: "{ uuid: string, ...fields }", returns: "null" },
        "admin:removeClient": { params: "{ uuid: string }", returns: "null" },
        "admin:getClient": { params: "{ uuid: string }", returns: "Client" },
        "admin:listClients": { params: "none", returns: "Client[]" },
        "admin:getClientToken": { params: "{ uuid: string }", returns: "{ token: string }" },
        "admin:clearRecords": { params: "none", returns: "null" },
        "admin:getTasks": { params: "none", returns: "ExecTask[]" },
        "admin:getTaskById": { params: "{ task_id: string }", returns: "ExecTask" },
        "admin:getTasksByClientId": { params: "{ uuid: string }", returns: "ExecTask[]" },
        "admin:getSpecificTaskResult": { params: "{ task_id: string, uuid: string }", returns: "TaskResult" },
        "admin:getTaskResultsByTaskId": { params: "{ task_id: string }", returns: "TaskResult[]" },
        "admin:exec": { params: "{ command: string, clients: string[] }", returns: "{ task_id: string, clients: string[], queued_clients: string[] }" },
        "admin:addPingTask": { params: "AddPingTaskParams", returns: "{ task_id: number }" },
        "admin:deletePingTask": { params: "{ id: number[] }", returns: "null" },
        "admin:editPingTask": { params: "{ tasks: PingTask[] }", returns: "null" },
        "admin:getAllPingTasks": { params: "none", returns: "PingTask[]" },
        "admin:orderPingTask": { params: "Record<string, number>", returns: "null" },
        "admin:addLoadNotification": { params: "AddLoadNotificationParams", returns: "{ task_id: number }" },
        "admin:deleteLoadNotification": { params: "{ id: number[] }", returns: "null" },
        "admin:editLoadNotification": { params: "{ notifications: LoadNotification[] }", returns: "null" },
        "admin:getAllLoadNotifications": { params: "none", returns: "LoadNotification[]" },
        "admin:listOfflineNotifications": { params: "none", returns: "OfflineNotification[]" },
        "admin:editOfflineNotification": { params: "OfflineNotification[]", returns: "null" },
        "admin:enableOfflineNotification": { params: "string[]", returns: "null" },
        "admin:disableOfflineNotification": { params: "string[]", returns: "null" },
        "admin:listTrafficReportNotifications": { params: "none", returns: "TrafficReportNotification[]" },
        "admin:editTrafficReportNotifications": { params: "TrafficReportNotification[]", returns: "null" },
        "admin:enableTrafficReportNotifications": { params: "string[]", returns: "null" },
        "admin:disableTrafficReportNotifications": { params: "string[]", returns: "null" },
        "admin:sendNotification": { params: "{ event: { event?: any, message?: any, emoji?: any, time?: string, clients?: { uuid: string }[] } }", returns: "null" },
        "admin:getSessions": { params: "none", returns: "{ current: string, data: Session[] }" },
        "admin:deleteSession": { params: "{ session: string }", returns: "null" },
        "admin:deleteAllSessions": { params: "none", returns: "null" },
        "admin:getSettings": { params: "none", returns: "object" },
        "admin:editSettings": { params: "Record<string, unknown>", returns: "null | { restart_required: true, guide_path: string }" },
        "admin:clearAllRecords": { params: "none", returns: "null" },
        "admin:orderClients": { params: "Record<string, number>", returns: "null" },
        "admin:getLogs": { params: "{ limit?: string, page?: string, msg_type?: string }", returns: "{ logs: Log[], total: number }" },
        "admin:testSendMessage": { params: "none", returns: "null" },
        "admin:testGeoip": { params: "{ ip?: string }", returns: "GeoInfo" },
        "admin:listPlugins": { params: "none", returns: "PluginStatus[]" },
        "admin:setPluginEnabled": { params: "{ short: string, enabled: boolean, approved?: boolean }", returns: "null | { requires_approval: true }" },
        "admin:getPluginLogs": { params: "{ short: string }", returns: "{ logs: string }" },
        "admin:deletePlugin": { params: "{ short: string }", returns: "null" },
        "admin:getPluginConfiguration": { params: "{ short: string }", returns: "{ configuration: object, data: object }" },
        "admin:setPluginConfiguration": { params: "{ short: string, data: object }", returns: "null" },
        "admin:getXtermjsSettings": { params: "none", returns: "XtermJSSettings" },
        "admin:setXtermjsSettings": { params: "XtermJSSettings", returns: "XtermJSSettings" },
        "admin:getMessageSenderProvider": { params: "{ provider?: string }", returns: "MessageSenderProvider | MessageSenderProvider[]" },
        "admin:setMessageSenderProvider": { params: "MessageSenderProvider", returns: "{ message: string }" },
        "admin:getOidcProvider": { params: "{ provider?: string }", returns: "OidcProvider | OidcProvider[]" },
        "admin:setOidcProvider": { params: "OidcProvider", returns: "{ message: string }" },
        "admin:getClipboard": { params: "{ id: string }", returns: "Clipboard" },
        "admin:listClipboard": { params: "none", returns: "Clipboard[]" },
        "admin:createClipboard": { params: "Clipboard", returns: "Clipboard" },
        "admin:updateClipboard": { params: "Clipboard", returns: "Clipboard" },
        "admin:deleteClipboard": { params: "{ id: string }", returns: "null" },
        "admin:batchDeleteClipboard": { params: "{ ids: string[] }", returns: "null" },
        "admin:getDatabaseSize": { params: "none", returns: "DatabaseStatus" },
        "admin:vacuumDatabase": { params: "none", returns: "DatabaseMaintenanceResponse" },
        "admin:dbQuery": { params: '{ database?: "main" | "metrics", sql: string, args?: any[], limit?: number }', returns: "DatabaseQueryResult" },
        "admin:dbExec": { params: '{ database?: "main" | "metrics", sql: string, args?: any[] }', returns: "DatabaseExecResult" },
        "admin:dbTables": { params: '{ database?: "main" | "metrics" }', returns: "DatabaseTablesResult" },
        "admin:listMetricDefinitions": { params: "none", returns: "MetricDefinition[]" },
        "admin:updateMetricDefinition": { params: "{ name: string, retention_days: number }", returns: "MetricDefinition" },
        "admin:getMetricMigrationStatus": { params: "none", returns: "MetricMigrationStatus" },
        "admin:startMetricMigration": { params: "{ source_driver?: string, source_dsn?: string }", returns: "{ status: string, message: string }" },
        "admin:cancelMetricMigration": { params: "none", returns: "{ status: string, message: string }" },
        "client:getPingTasks": { params: "none", returns: "PingTask[]" },
        "client:uploadPingResult": { params: "UploadPingResultParams", returns: "{ status: string }" },
        "client:taskResult": { params: "TaskResultParams", returns: "{ status: string, message: string }" }
      };
    }
  });

  // node_modules/@komari-monitor/plugin-sdk/src/index.js
  var require_src = __commonJS({
    "node_modules/@komari-monitor/plugin-sdk/src/index.js"(exports, module) {
      "use strict";
      var { assertValidManifest, validateManifest } = require_manifest();
      var { createRpcClient } = require_rpc();
      var manifestSchema = require_komari_plugin_schema();
      var rpcCatalog = require_rpc_catalog();
      var cachedServer;
      function getServer() {
        if (!cachedServer) {
          cachedServer = __require("server");
        }
        return cachedServer;
      }
      function definePlugin2(definition) {
        if (!definition || typeof definition !== "object") {
          throw new TypeError("definePlugin requires a plugin definition object");
        }
        const load = typeof definition.load === "function" ? definition.load : () => {
        };
        const unload = typeof definition.unload === "function" ? definition.unload : () => {
        };
        globalThis.load = load;
        globalThis.unload = unload;
        return definition;
      }
      function jsonResponse2(res, value, statusCode = 200) {
        res.statusCode = statusCode;
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.end(JSON.stringify(value));
        return res;
      }
      function textResponse(res, value, statusCode = 200, contentType = "text/plain; charset=utf-8") {
        res.statusCode = statusCode;
        res.setHeader("Content-Type", contentType);
        res.end(String(value));
        return res;
      }
      var exportsObject = {
        assertValidManifest,
        definePlugin: definePlugin2,
        jsonResponse: jsonResponse2,
        manifestSchema,
        rpc: createRpcClient(getServer),
        rpcCatalog,
        textResponse,
        validateManifest
      };
      Object.defineProperty(exportsObject, "server", {
        enumerable: true,
        get: getServer
      });
      module.exports = exportsObject;
    }
  });

  // src/plugin.ts
  var import_plugin_sdk2 = __toESM(require_src());

  // src/ddns.ts
  var net = __toESM(__require("node:net"));

  // src/util.ts
  var import_node_crypto = __toESM(__require("node:crypto"));

  // src/types.ts
  var INTERVAL_VALUES = [1, 5, 10, 15, 30, 60];
  var TTL_VALUES = [
    1,
    60,
    120,
    300,
    600,
    900,
    1800,
    3600,
    7200,
    18e3,
    43200,
    86400
  ];
  var MAX_RECORDS = 1e3;
  var MAX_DOMAINS_PER_BATCH = 100;
  var MAX_NODES_PER_BATCH = 50;
  var MAX_LOGS = 1e3;

  // src/util.ts
  var PluginError = class extends Error {
    constructor(message, status = 400, code) {
      super(message);
      this.name = "PluginError";
      this.status = status;
      this.code = code;
    }
  };
  function nowIso() {
    return (/* @__PURE__ */ new Date()).toISOString();
  }
  function makeId(bytes = 12) {
    return import_node_crypto.default.randomBytes(bytes).toString("hex");
  }
  function stableId(value) {
    return import_node_crypto.default.createHash("sha256").update(value).digest("hex").slice(0, 24);
  }
  function normalizeDomain(value) {
    const raw = typeof value === "string" ? value.trim().toLowerCase() : "";
    const name = raw.replace(/\.$/, "");
    const labels = name.split(".");
    const valid = name.length > 0 && name.length <= 253 && labels.length >= 2 && labels.every(
      (label, index) => index === 0 && label === "*" || /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label)
    );
    if (!valid) {
      throw new PluginError("\u8BF7\u8F93\u5165\u5B8C\u6574\u57DF\u540D\uFF0C\u4F8B\u5982 home.example.com\uFF1B\u4E2D\u6587\u57DF\u540D\u8BF7\u4F7F\u7528 Punycode\u3002");
    }
    return name;
  }
  function parseDomains(value) {
    const text = Array.isArray(value) ? value.map((item) => String(item)).join("\n") : typeof value === "string" ? value : "";
    const parts = text.split(/[\s,;]+/).map((item) => item.trim()).filter(Boolean);
    const seen = /* @__PURE__ */ new Set();
    const domains = [];
    for (const part of parts) {
      const domain = normalizeDomain(part);
      if (!seen.has(domain)) {
        seen.add(domain);
        domains.push(domain);
      }
    }
    if (domains.length === 0) throw new PluginError("\u8BF7\u81F3\u5C11\u8F93\u5165\u4E00\u4E2A\u57DF\u540D\u3002");
    if (domains.length > MAX_DOMAINS_PER_BATCH) {
      throw new PluginError(`\u5355\u6B21\u6700\u591A\u6DFB\u52A0 ${MAX_DOMAINS_PER_BATCH} \u4E2A\u57DF\u540D\u3002`);
    }
    return domains;
  }
  function normalizeAuthMode(value, fallback = "token") {
    return value === "key" || value === "token" ? value : fallback;
  }
  function normalizeSecret(value, label, required) {
    const secret = typeof value === "string" ? value.trim() : "";
    if (!secret) {
      if (required) throw new PluginError(`\u8BF7\u586B\u5199${label}\u3002`);
      return "";
    }
    if (!/^[A-Za-z0-9_-]{20,300}$/.test(secret)) {
      throw new PluginError(`${label}\u683C\u5F0F\u4E0D\u6B63\u786E\uFF0C\u8BF7\u786E\u8BA4\u6CA1\u6709\u7A7A\u683C\u6216\u6362\u884C\u3002`);
    }
    return secret;
  }
  function normalizeEmail(value, required) {
    const email = typeof value === "string" ? value.trim() : "";
    if (!email && !required) return "";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
      throw new PluginError("\u8BF7\u8F93\u5165\u6709\u6548\u7684 Cloudflare \u767B\u5F55\u90AE\u7BB1\u3002");
    }
    return email;
  }
  function normalizeSettings(input, previous) {
    if (!input || typeof input !== "object") throw new PluginError("\u8BBE\u7F6E\u683C\u5F0F\u65E0\u6548\u3002");
    const raw = input;
    const authMode = normalizeAuthMode(raw.authMode, previous?.authMode || "token");
    const tokenInput = typeof raw.token === "string" ? raw.token.trim() : "";
    const keyInput = typeof raw.apiKey === "string" ? raw.apiKey.trim() : "";
    const emailInput = typeof raw.email === "string" ? raw.email.trim() : "";
    const token = authMode === "token" ? normalizeSecret(tokenInput || (previous?.authMode === "token" ? previous.token : ""), "API Token", true) : "";
    const email = authMode === "key" ? normalizeEmail(emailInput, true) : "";
    if (previous?.authMode === "key" && authMode === "key" && previous.email && previous.email !== email && !keyInput) {
      throw new PluginError("\u66F4\u6362\u90AE\u7BB1\u65F6\u5FC5\u987B\u540C\u65F6\u586B\u5199\u5BF9\u5E94\u7684 Global API Key\u3002");
    }
    const apiKey = authMode === "key" ? normalizeSecret(
      keyInput || (previous?.authMode === "key" && previous.email === email ? previous.apiKey : ""),
      "Global API Key",
      true
    ) : "";
    const intervalMinutes = Number(raw.intervalMinutes ?? previous?.intervalMinutes ?? 1);
    if (!INTERVAL_VALUES.includes(intervalMinutes)) {
      throw new PluginError("\u540C\u6B65\u95F4\u9694\u5FC5\u987B\u662F 1\u30015\u300110\u300115\u300130 \u6216 60 \u5206\u949F\u3002");
    }
    if (raw.notify !== void 0 && typeof raw.notify !== "boolean") {
      throw new PluginError("\u901A\u77E5\u5F00\u5173\u683C\u5F0F\u65E0\u6548\u3002");
    }
    if (raw.paused !== void 0 && typeof raw.paused !== "boolean") {
      throw new PluginError("\u6682\u505C\u5F00\u5173\u683C\u5F0F\u65E0\u6548\u3002");
    }
    return {
      version: 1,
      authMode,
      token,
      email,
      apiKey,
      notify: raw.notify === void 0 ? Boolean(previous?.notify) : Boolean(raw.notify),
      paused: raw.paused === void 0 ? Boolean(previous?.paused) : Boolean(raw.paused),
      intervalMinutes,
      updatedAt: nowIso()
    };
  }
  function resolveCredentials(input, saved) {
    if (!input || typeof input !== "object") throw new PluginError("\u8BA4\u8BC1\u4FE1\u606F\u683C\u5F0F\u65E0\u6548\u3002");
    const raw = input;
    const authMode = normalizeAuthMode(raw.authMode, saved.authMode);
    const tokenInput = typeof raw.token === "string" ? raw.token.trim() : "";
    const keyInput = typeof raw.apiKey === "string" ? raw.apiKey.trim() : "";
    const emailInput = typeof raw.email === "string" ? raw.email.trim() : "";
    const token = authMode === "token" ? normalizeSecret(tokenInput || (saved.authMode === "token" ? saved.token : ""), "API Token", true) : "";
    const email = authMode === "key" ? normalizeEmail(emailInput || (saved.authMode === "key" ? saved.email : ""), true) : "";
    const apiKey = authMode === "key" ? normalizeSecret(
      keyInput || (saved.authMode === "key" && saved.email === email ? saved.apiKey : ""),
      "Global API Key",
      true
    ) : "";
    return { authMode, token, email, apiKey };
  }
  function publicSettings(settings) {
    return {
      authMode: settings.authMode,
      email: settings.email,
      hasToken: Boolean(settings.token),
      hasApiKey: Boolean(settings.apiKey),
      notify: settings.notify,
      paused: settings.paused,
      intervalMinutes: settings.intervalMinutes,
      updatedAt: settings.updatedAt
    };
  }
  function normalizeTtl(value, proxied) {
    const ttl = Number(value);
    if (proxied) return 1;
    if (!TTL_VALUES.includes(ttl)) {
      throw new PluginError("TTL \u503C\u65E0\u6548\u3002");
    }
    return ttl;
  }
  function normalizeInterval(value) {
    const interval = Number(value);
    if (!INTERVAL_VALUES.includes(interval)) {
      throw new PluginError("\u540C\u6B65\u95F4\u9694\u5FC5\u987B\u662F 1\u30015\u300110\u300115\u300130 \u6216 60 \u5206\u949F\u3002");
    }
    return interval;
  }
  function normalizeRecord(input, previous) {
    if (!input || typeof input !== "object") throw new PluginError("\u89C4\u5219\u683C\u5F0F\u65E0\u6548\u3002");
    const raw = input;
    const type = raw.type === "AAAA" ? "AAAA" : raw.type === "A" ? "A" : null;
    if (!type) throw new PluginError("\u8BB0\u5F55\u7C7B\u578B\u53EA\u80FD\u662F A \u6216 AAAA\u3002");
    if (raw.proxied !== void 0 && typeof raw.proxied !== "boolean") {
      throw new PluginError("\u4EE3\u7406\u5F00\u5173\u683C\u5F0F\u65E0\u6548\u3002");
    }
    if (raw.enabled !== void 0 && typeof raw.enabled !== "boolean") {
      throw new PluginError("\u542F\u7528\u5F00\u5173\u683C\u5F0F\u65E0\u6548\u3002");
    }
    if (raw.adoptExisting !== void 0 && typeof raw.adoptExisting !== "boolean") {
      throw new PluginError("\u63A5\u7BA1\u5DF2\u6709\u8BB0\u5F55\u5F00\u5173\u683C\u5F0F\u65E0\u6548\u3002");
    }
    const proxied = Boolean(raw.proxied);
    const nodeUuid = typeof raw.nodeUuid === "string" ? raw.nodeUuid.trim() : "";
    if (!/^[a-zA-Z0-9-]{1,64}$/.test(nodeUuid)) throw new PluginError("\u8282\u70B9 UUID \u65E0\u6548\u3002");
    const id = typeof raw.id === "string" && raw.id ? raw.id : previous?.id || makeId();
    if (!/^[a-zA-Z0-9-]{8,64}$/.test(id)) throw new PluginError("\u89C4\u5219 ID \u65E0\u6548\u3002");
    const groupId = typeof raw.groupId === "string" && raw.groupId ? raw.groupId : previous?.groupId || makeId();
    if (!/^[a-zA-Z0-9-]{8,64}$/.test(groupId)) throw new PluginError("\u89C4\u5219\u7EC4 ID \u65E0\u6548\u3002");
    return {
      id,
      groupId,
      domain: normalizeDomain(raw.domain),
      type,
      nodeUuid,
      ttl: normalizeTtl(raw.ttl, proxied),
      proxied,
      enabled: raw.enabled === void 0 ? previous?.enabled ?? true : Boolean(raw.enabled),
      intervalMinutes: normalizeInterval(raw.intervalMinutes ?? previous?.intervalMinutes ?? 1),
      adoptExisting: raw.adoptExisting === void 0 ? previous?.adoptExisting ?? false : Boolean(raw.adoptExisting),
      createdAt: previous?.createdAt || nowIso(),
      updatedAt: nowIso()
    };
  }
  function recordKey(domain, type, nodeUuid) {
    return `${domain}|${type}|${nodeUuid}`;
  }
  function recordMarker(recordId) {
    return `komari-ddns-plus:${recordId}`;
  }
  function parseJsonBody(body) {
    if (!body || !body.trim()) return {};
    try {
      return JSON.parse(body);
    } catch {
      throw new PluginError("\u8BF7\u6C42\u4F53\u4E0D\u662F\u5408\u6CD5 JSON\u3002");
    }
  }
  function assertRecordLimit(count) {
    if (count > MAX_RECORDS) throw new PluginError(`\u6700\u591A\u652F\u6301 ${MAX_RECORDS} \u6761 DNS \u89C4\u5219\u3002`);
  }
  function normalizeNodeIds(value) {
    if (!Array.isArray(value)) throw new PluginError("\u8BF7\u9009\u62E9\u81F3\u5C11\u4E00\u53F0\u670D\u52A1\u5668\u3002");
    const ids = Array.from(
      new Set(
        value.map((item) => String(item || "").trim()).filter((item) => /^[a-zA-Z0-9-]{1,64}$/.test(item))
      )
    );
    if (ids.length === 0) throw new PluginError("\u8BF7\u9009\u62E9\u81F3\u5C11\u4E00\u53F0\u670D\u52A1\u5668\u3002");
    if (ids.length > MAX_NODES_PER_BATCH) {
      throw new PluginError(`\u5355\u6B21\u6700\u591A\u9009\u62E9 ${MAX_NODES_PER_BATCH} \u53F0\u670D\u52A1\u5668\u3002`);
    }
    return ids;
  }
  function redact(value, settings) {
    let text = value instanceof Error ? value.message : String(value ?? "");
    for (const secret of [settings.token, settings.apiKey]) {
      if (secret) text = text.split(secret).join("[REDACTED]");
    }
    return text;
  }
  function errorMessage(error) {
    if (error instanceof Error) return error.message;
    return String(error || "\u672A\u77E5\u9519\u8BEF");
  }

  // src/cloudflare.ts
  var CF_API = "https://api.cloudflare.com/client/v4";
  var ZONE_CACHE_MS = 5 * 60 * 1e3;
  var CloudflareError = class extends PluginError {
    constructor(message, status = 502, code, retryAfterMs) {
      super(message, status, code);
      this.name = "CloudflareError";
      this.retryAfterMs = retryAfterMs;
    }
  };
  function authHeaders(auth) {
    if (auth.authMode === "token") {
      if (!auth.token) throw new PluginError("\u5C1A\u672A\u914D\u7F6E Cloudflare API Token\u3002");
      return { Authorization: `Bearer ${auth.token}` };
    }
    if (!auth.email || !auth.apiKey) {
      throw new PluginError("\u5C1A\u672A\u914D\u7F6E Cloudflare \u90AE\u7BB1\u6216 Global API Key\u3002");
    }
    return {
      "X-Auth-Email": auth.email,
      "X-Auth-Key": auth.apiKey
    };
  }
  function flattenCloudflareErrors(errors) {
    const result = [];
    for (const error of errors || []) {
      result.push(error);
      if (Array.isArray(error.error_chain)) result.push(...error.error_chain);
    }
    return result;
  }
  function cloudflareFailure(status, errors, retryAfterMs) {
    const flattened = flattenCloudflareErrors(errors);
    const codes = flattened.map((item) => Number(item.code)).filter((item) => Number.isFinite(item));
    const messages = flattened.map((item) => String(item.message || "").trim()).filter(Boolean);
    const code = codes[0];
    if (status === 429) {
      return new CloudflareError(
        "Cloudflare API \u8BF7\u6C42\u53D7\u9650\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5\u3002",
        429,
        code,
        retryAfterMs
      );
    }
    if (status === 401 || status === 403) {
      return new CloudflareError(
        "Cloudflare \u8BA4\u8BC1\u6216\u6743\u9650\u5931\u8D25\uFF0C\u8BF7\u68C0\u67E5\u8BA4\u8BC1\u65B9\u5F0F\u3001Token \u6743\u9650\u6216 API Key\u3002",
        status,
        code
      );
    }
    if (codes.includes(6003) || codes.includes(6102) || codes.includes(6103) || codes.includes(6111)) {
      return new CloudflareError(
        "Cloudflare \u8BA4\u8BC1\u8BF7\u6C42\u5934\u65E0\u6548\u3002API Token \u5FC5\u987B\u4F7F\u7528 Bearer \u8BA4\u8BC1\uFF1BGlobal API Key \u5FC5\u987B\u4F7F\u7528\u90AE\u7BB1\u548C X-Auth-Key\u3002",
        400,
        code
      );
    }
    if (status === 400) {
      return new CloudflareError(
        `Cloudflare \u62D2\u7EDD\u4E86\u8BF7\u6C42${messages.length ? `\uFF1A${messages.join("\uFF1B")}` : "\u3002"}`,
        400,
        code
      );
    }
    return new CloudflareError(
      `Cloudflare \u8BF7\u6C42\u5931\u8D25\uFF08HTTP ${status}${code ? `\uFF0C\u9519\u8BEF\u7801 ${code}` : ""}\uFF09${messages.length ? `\uFF1A${messages.join("\uFF1B")}` : ""}`,
      status >= 500 ? 502 : status,
      code
    );
  }
  function parseRetryAfter(value) {
    if (!value) return void 0;
    if (/^\d+$/.test(value.trim())) return Number(value) * 1e3;
    const timestamp = Date.parse(value);
    return Number.isFinite(timestamp) ? Math.max(0, timestamp - Date.now()) : void 0;
  }
  function createCloudflareClient(auth, fetcher = fetch, now = Date.now) {
    let zoneCache = null;
    async function request(path2, init = {}) {
      const headers = {
        Accept: "application/json",
        ...authHeaders(auth)
      };
      if (init.body !== void 0) headers["Content-Type"] = "application/json";
      let response;
      try {
        response = await fetcher(`${CF_API}${path2}`, {
          ...init,
          headers: { ...headers, ...init.headers },
          redirect: "error"
        });
      } catch (error) {
        throw new CloudflareError(
          `\u65E0\u6CD5\u8FDE\u63A5 Cloudflare\uFF1A${errorMessage(error)}`,
          502
        );
      }
      let data;
      try {
        data = await response.json();
      } catch {
        throw new CloudflareError(
          `Cloudflare \u8FD4\u56DE\u4E86\u65E0\u6CD5\u89E3\u6790\u7684\u54CD\u5E94\uFF08HTTP ${response.status}\uFF09\u3002`,
          response.status === 200 ? 502 : response.status
        );
      }
      if (!response.ok || data.success !== true) {
        throw cloudflareFailure(
          response.status,
          data.errors,
          parseRetryAfter(response.headers.get("retry-after"))
        );
      }
      return data;
    }
    async function listZones() {
      if (zoneCache && now() - zoneCache.at < ZONE_CACHE_MS) return zoneCache.zones;
      const zones = [];
      for (let page = 1; page <= 100; page++) {
        const data = await request(
          `/zones?per_page=100&page=${page}`
        );
        zones.push(...data.result || []);
        const totalPages = Number(data.result_info?.total_pages || 1);
        if (page >= totalPages) break;
      }
      const active = zones.filter((zone) => zone.status === "active");
      zoneCache = { at: now(), zones: active };
      return active;
    }
    async function zoneFor(domain) {
      const normalized = normalizeDomain(domain).replace(/^\*\./, "");
      const labels = normalized.split(".");
      const zones = await listZones();
      for (let index = 0; index < labels.length - 1; index++) {
        const candidate = labels.slice(index).join(".");
        const zone = zones.find((item) => item.name.toLowerCase() === candidate);
        if (zone) return zone;
      }
      throw new PluginError(
        `\u5728 Cloudflare \u8D26\u6237\u4E2D\u627E\u4E0D\u5230 ${normalized} \u5BF9\u5E94\u7684\u6709\u6548 Zone\u3002`,
        422
      );
    }
    async function listRecords(zoneId, name, type) {
      const records = [];
      for (let page = 1; page <= 100; page++) {
        const data = await request(
          `/zones/${encodeURIComponent(zoneId)}/dns_records?name=${encodeURIComponent(
            name
          )}&type=${encodeURIComponent(type)}&per_page=100&page=${page}`
        );
        records.push(...data.result || []);
        const totalPages = Number(data.result_info?.total_pages || 1);
        if (page >= totalPages) break;
      }
      return records;
    }
    async function createRecord(zoneId, payload) {
      const data = await request(
        `/zones/${encodeURIComponent(zoneId)}/dns_records`,
        { method: "POST", body: JSON.stringify(payload) }
      );
      if (!data.result?.id) throw new CloudflareError("Cloudflare \u672A\u8FD4\u56DE DNS \u8BB0\u5F55 ID\u3002");
      return data.result;
    }
    async function updateRecord(zoneId, recordId, payload) {
      const data = await request(
        `/zones/${encodeURIComponent(zoneId)}/dns_records/${encodeURIComponent(recordId)}`,
        { method: "PATCH", body: JSON.stringify(payload) }
      );
      if (!data.result?.id) throw new CloudflareError("Cloudflare \u672A\u8FD4\u56DE\u66F4\u65B0\u540E\u7684 DNS \u8BB0\u5F55\u3002");
      return data.result;
    }
    async function deleteRecord(zoneId, recordId) {
      await request(
        `/zones/${encodeURIComponent(zoneId)}/dns_records/${encodeURIComponent(recordId)}`,
        { method: "DELETE" }
      );
    }
    async function test() {
      if (auth.authMode === "key") {
        await request("/user");
      }
      let zones;
      try {
        zones = await listZones();
      } catch (error) {
        if (auth.authMode === "token" && error instanceof CloudflareError && (error.status === 401 || error.status === 403)) {
          throw new CloudflareError(
            "API Token \u65E0\u6CD5\u8BFB\u53D6 Zone\u3002\u8BF7\u6388\u4E88 Zone > Zone > Read\uFF0C\u5E76\u6388\u6743\u76EE\u6807\u57DF\u540D\uFF1BAccount API Token \u4E5F\u53EF\u4EE5\u76F4\u63A5\u4F7F\u7528\u3002",
            error.status,
            typeof error.code === "number" ? error.code : void 0
          );
        }
        throw error;
      }
      if (zones.length > 0) {
        let dnsReadable = false;
        let dnsError;
        for (const zone of zones) {
          try {
            await request(
              `/zones/${encodeURIComponent(zone.id)}/dns_records?per_page=1`
            );
            dnsReadable = true;
            break;
          } catch (error) {
            if (error instanceof CloudflareError && (error.status === 401 || error.status === 403)) {
              dnsError = error;
              continue;
            }
            throw error;
          }
        }
        if (!dnsReadable && dnsError) {
          throw new CloudflareError(
            "API Token \u53EF\u4EE5\u8BFB\u53D6 Zone\uFF0C\u4F46\u7F3A\u5C11 DNS \u8BB0\u5F55\u8BFB\u53D6\u6743\u9650\u3002\u8BF7\u6388\u4E88 Zone > DNS > Edit\uFF0C\u5E76\u6388\u6743\u76EE\u6807\u57DF\u540D\u3002",
            dnsError.status,
            typeof dnsError.code === "number" ? dnsError.code : void 0
          );
        }
      }
      const suffix = zones.length ? `\u53EF\u8BFB\u53D6 ${zones.length} \u4E2A\u6709\u6548 Zone\uFF0C\u5E76\u5177\u5907 DNS \u8BB0\u5F55\u8BFB\u53D6\u6743\u9650\u3002` : "\u4F46\u5F53\u524D\u51ED\u636E\u672A\u6388\u6743\u4EFB\u4F55\u6709\u6548 Zone\u3002";
      return {
        message: auth.authMode === "token" ? `API Token \u9A8C\u8BC1\u6210\u529F\uFF0C${suffix}` : `Global API Key \u9A8C\u8BC1\u6210\u529F\uFF0C${suffix}`,
        zoneCount: zones.length
      };
    }
    return {
      test,
      listZones,
      zoneFor,
      listRecords,
      createRecord,
      updateRecord,
      deleteRecord
    };
  }

  // src/ddns.ts
  var SYNC_CHUNK_SIZE = 10;
  function hasCredentials(settings) {
    return settings.authMode === "token" ? Boolean(settings.token) : Boolean(settings.email && settings.apiKey);
  }
  function emptyJob() {
    return {
      running: false,
      total: 0,
      completed: 0,
      changed: 0,
      skipped: 0,
      errors: 0
    };
  }
  function isPublicIPv4(ip) {
    const parts = ip.split(".").map(Number);
    if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
      return false;
    }
    const [a, b] = parts;
    if (a === 0 || a === 10 || a === 127 || a >= 224) return false;
    if (a === 169 && b === 254) return false;
    if (a === 172 && b >= 16 && b <= 31) return false;
    if (a === 192 && b === 168) return false;
    if (a === 100 && b >= 64 && b <= 127) return false;
    if (a === 192 && b === 0) return false;
    if (a === 198 && (b === 18 || b === 19)) return false;
    if (a === 198 && b === 51 && parts[2] === 100) return false;
    if (a === 203 && b === 0 && parts[2] === 113) return false;
    return true;
  }
  function isPublicIPv6(ip) {
    const value = ip.toLowerCase();
    if (value === "::" || value === "::1") return false;
    if (value.startsWith("fc") || value.startsWith("fd")) return false;
    if (/^fe[89ab]/.test(value)) return false;
    if (value.startsWith("ff")) return false;
    if (value.startsWith("2001:db8")) return false;
    return true;
  }
  function validateAddress(ipValue, type) {
    const ip = String(ipValue || "").trim();
    const family = net.isIP(ip);
    if (family !== (type === "A" ? 4 : 6)) {
      throw new PluginError(
        `\u8282\u70B9\u5C1A\u672A\u4E0A\u62A5\u6709\u6548\u7684 ${type === "A" ? "IPv4" : "IPv6"} \u5730\u5740\u3002`,
        422
      );
    }
    if (type === "A" && !isPublicIPv4(ip)) {
      throw new PluginError("\u8282\u70B9\u4E0A\u62A5\u7684 IPv4 \u4E0D\u662F\u53EF\u7528\u7684\u516C\u7F51\u5730\u5740\u3002", 422);
    }
    if (type === "AAAA" && !isPublicIPv6(ip)) {
      throw new PluginError("\u8282\u70B9\u4E0A\u62A5\u7684 IPv6 \u4E0D\u662F\u53EF\u7528\u7684\u516C\u7F51\u5730\u5740\u3002", 422);
    }
    return ip;
  }
  function statusForRecord(record, state, extra = {}) {
    const checkedAt = nowIso();
    return {
      state,
      lastCheckedAt: checkedAt,
      nextRunAt: new Date(Date.now() + record.intervalMinutes * 6e4).toISOString(),
      ...extra
    };
  }
  var SyncEngine = class {
    constructor(deps) {
      this.job = emptyJob();
      this.blockedUntil = 0;
      this.changes = [];
      this.failures = [];
      this.deps = deps;
      this.statuses = deps.storage.loadStatuses();
    }
    snapshot() {
      return {
        job: { ...this.job },
        statuses: { ...this.statuses }
      };
    }
    removeStatuses(ids) {
      for (const id of ids) delete this.statuses[id];
      this.deps.storage.saveStatuses(this.statuses);
    }
    start(ids, force = true) {
      if (this.job.running) {
        throw new PluginError("\u5DF2\u6709\u540C\u6B65\u4EFB\u52A1\u6B63\u5728\u8FD0\u884C\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5\u3002", 409);
      }
      if (Date.now() < this.blockedUntil) {
        this.job = { ...this.job, message: "Cloudflare \u9650\u6D41\u7B49\u5F85\u4E2D\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5\u3002" };
        return { ...this.job };
      }
      const settings = this.deps.storage.loadSettings();
      if (!hasCredentials(settings)) {
        throw new PluginError("\u8BF7\u5148\u5728\u8BBE\u7F6E\u9875\u914D\u7F6E Cloudflare API Token \u6216 API Key\u3002", 422);
      }
      const records = this.deps.storage.loadRecords();
      const selectedIds = ids && ids.length ? new Set(ids) : null;
      const due = records.filter((record) => {
        if (!record.enabled) return false;
        if (selectedIds && !selectedIds.has(record.id)) return false;
        if (force || !selectedIds) {
          if (force) return true;
        }
        const next = this.statuses[record.id]?.nextRunAt;
        return !next || Date.parse(next) <= Date.now();
      });
      if (!due.length) {
        this.job = {
          ...this.job,
          running: false,
          message: selectedIds ? "\u6240\u9009\u89C4\u5219\u4E2D\u6CA1\u6709\u53EF\u540C\u6B65\u7684\u5DF2\u542F\u7528\u8BB0\u5F55\u3002" : "\u5F53\u524D\u6CA1\u6709\u5230\u671F\u7684\u540C\u6B65\u4EFB\u52A1\u3002"
        };
        return { ...this.job };
      }
      this.job = {
        running: true,
        startedAt: nowIso(),
        total: due.length,
        completed: 0,
        changed: 0,
        skipped: 0,
        errors: 0
      };
      setTimeout(() => {
        void this.run(due).catch((error) => {
          this.job.running = false;
          this.job.finishedAt = nowIso();
          this.job.message = redact(errorMessage(error), settings);
        });
      }, 0);
      return { ...this.job };
    }
    startDue() {
      const settings = this.deps.storage.loadSettings();
      if (settings.paused) {
        this.job = { ...this.job, message: "\u8BA1\u5212\u540C\u6B65\u5DF2\u6682\u505C\u3002" };
        return { ...this.job };
      }
      if (!hasCredentials(settings)) {
        this.job = { ...emptyJob(), message: "\u5C1A\u672A\u914D\u7F6E Cloudflare \u51ED\u636E\u3002" };
        return { ...this.job };
      }
      return this.start(void 0, false);
    }
    async run(records) {
      const settings = this.deps.storage.loadSettings();
      this.changes = [];
      this.failures = [];
      const client = this.deps.createClient ? this.deps.createClient(settings) : createCloudflareClient(settings);
      const nodes = await this.deps.getNodes(Array.from(new Set(records.map((record) => record.nodeUuid))));
      const nodeMap = new Map(nodes.map((node) => [node.uuid, node]));
      for (let offset = 0; offset < records.length; offset += SYNC_CHUNK_SIZE) {
        const chunk = records.slice(offset, offset + SYNC_CHUNK_SIZE);
        for (const record of chunk) {
          const previousStatus = this.statuses[record.id];
          let result;
          try {
            result = await this.syncRecord(record, client, nodeMap);
          } catch (error) {
            const message = redact(errorMessage(error), settings);
            if (error instanceof CloudflareError && error.status === 429) {
              this.blockedUntil = Date.now() + (error.retryAfterMs || 6e4);
            }
            this.statuses[record.id] = statusForRecord(record, "error", {
              action: "error",
              lastError: message
            });
            this.job.errors += 1;
            if (previousStatus?.state !== "error") {
              this.failures.push({
                record,
                nodeName: nodeMap.get(record.nodeUuid)?.name || record.nodeUuid,
                message
              });
            }
            this.deps.storage.appendLog({
              level: "error",
              action: "sync",
              message,
              domain: record.domain,
              type: record.type,
              nodeUuid: record.nodeUuid
            });
          }
          if (result?.changed && (result.action === "created" || result.action === "updated") && (result.action === "created" || result.previousIp !== result.currentIp)) {
            this.changes.push({
              record,
              nodeName: nodeMap.get(record.nodeUuid)?.name || record.nodeUuid,
              previousIp: result.previousIp,
              currentIp: result.currentIp || "",
              action: result.action
            });
          }
          this.job.completed += 1;
        }
        this.deps.storage.saveStatuses(this.statuses);
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
      this.job.running = false;
      this.job.finishedAt = nowIso();
      this.job.message = `\u540C\u6B65\u5B8C\u6210\uFF1A\u5171 ${this.job.total} \u6761\uFF0C\u53D8\u66F4 ${this.job.changed} \u6761\uFF0C\u8DF3\u8FC7 ${this.job.skipped} \u6761\uFF0C\u5931\u8D25 ${this.job.errors} \u6761\u3002`;
      this.deps.storage.appendLog({
        level: this.job.errors ? "warning" : "success",
        action: "sync",
        message: this.job.message
      });
      await this.sendNotificationSummary(settings);
    }
    async sendNotificationSummary(settings) {
      if (!settings.notify || this.changes.length === 0 && this.failures.length === 0) {
        return;
      }
      const lines = [];
      if (this.changes.length) {
        lines.push(`IP \u53D8\u66F4 ${this.changes.length} \u6761\uFF1A`);
        for (const change of this.changes.slice(0, 8)) {
          const before = change.action === "created" ? "\u65B0\u5EFA" : change.previousIp || "\u672A\u77E5";
          lines.push(
            `- ${change.nodeName} / ${change.record.domain} ${change.record.type}: ${before} -> ${change.currentIp}`
          );
        }
        if (this.changes.length > 8) {
          lines.push(`- \u53E6\u6709 ${this.changes.length - 8} \u6761\u53D8\u66F4\u672A\u5217\u51FA`);
        }
      }
      if (this.failures.length) {
        if (lines.length) lines.push("");
        lines.push(`\u540C\u6B65\u5931\u8D25 ${this.failures.length} \u6761\uFF1A`);
        for (const failure of this.failures.slice(0, 8)) {
          const detail = failure.message.length > 160 ? failure.message.slice(0, 157) + "..." : failure.message;
          lines.push(
            `- ${failure.nodeName} / ${failure.record.domain} ${failure.record.type}: ${detail}`
          );
        }
        if (this.failures.length > 8) {
          lines.push(`- \u53E6\u6709 ${this.failures.length - 8} \u6761\u5931\u8D25\u672A\u5217\u51FA`);
        }
      }
      const clients = Array.from(
        new Set(
          [...this.changes, ...this.failures].map((item) => item.record.nodeUuid)
        )
      );
      try {
        await this.deps.notify({
          message: lines.join("\n").slice(0, 3500),
          clients
        });
      } catch (error) {
        this.deps.storage.appendLog({
          level: "warning",
          action: "notify",
          message: `\u901A\u77E5\u53D1\u9001\u5931\u8D25\uFF1A${redact(errorMessage(error), settings)}`
        });
      }
    }
    async syncRecord(record, client, nodes) {
      if (!record.enabled) {
        this.statuses[record.id] = statusForRecord(record, "disabled", {
          action: "skipped"
        });
        this.job.skipped += 1;
        return { changed: false, action: "skipped" };
      }
      const node = nodes.get(record.nodeUuid);
      if (!node) {
        throw new PluginError("\u6240\u9009\u8282\u70B9\u5DF2\u5220\u9664\u6216\u65E0\u6CD5\u8BFB\u53D6\u3002", 422);
      }
      if (!node.online) {
        this.statuses[record.id] = statusForRecord(record, "skipped", {
          action: "skipped",
          lastError: "\u8282\u70B9\u79BB\u7EBF\uFF0C\u4FDD\u7559\u73B0\u6709 DNS \u8BB0\u5F55\u3002"
        });
        this.job.skipped += 1;
        this.deps.storage.appendLog({
          level: "info",
          action: "sync",
          message: "\u8282\u70B9\u79BB\u7EBF\uFF0C\u8DF3\u8FC7\u540C\u6B65\u3002",
          domain: record.domain,
          type: record.type,
          nodeUuid: record.nodeUuid
        });
        return { changed: false, action: "skipped" };
      }
      const ip = validateAddress(record.type === "A" ? node.ipv4 : node.ipv6, record.type);
      const zone = await client.zoneFor(record.domain);
      const existing = await client.listRecords(zone.id, record.domain, record.type);
      const marker = recordMarker(record.id);
      const managed = existing.filter(
        (item) => item.type === record.type && item.name === record.domain && item.comment === marker
      );
      if (managed.length > 1) {
        throw new PluginError("\u53D1\u73B0\u591A\u6761\u7531\u672C\u63D2\u4EF6\u7BA1\u7406\u7684\u91CD\u590D DNS \u8BB0\u5F55\uFF0C\u8BF7\u5148\u5230 Cloudflare \u6574\u7406\u3002", 422);
      }
      let current = managed[0];
      if (!current && this.statuses[record.id]?.recordId) {
        current = existing.find((item) => item.id === this.statuses[record.id]?.recordId);
      }
      if (!current) {
        const orphanedManaged = existing.filter(
          (item) => item.type === record.type && item.name === record.domain && String(item.comment || "").startsWith("komari-ddns-plus:")
        );
        if (orphanedManaged.length > 1) {
          throw new PluginError(
            "\u76EE\u6807\u57DF\u540D\u5B58\u5728\u591A\u6761\u672C\u63D2\u4EF6\u5386\u53F2\u8BB0\u5F55\uFF0C\u8BF7\u5148\u5230 Cloudflare \u6574\u7406\u3002",
            422
          );
        }
        if (orphanedManaged.length === 1) current = orphanedManaged[0];
      }
      if (!current) {
        const unmanaged = existing.filter((item) => !String(item.comment || "").startsWith("komari-ddns-plus:"));
        if (unmanaged.length > 0) {
          if (!record.adoptExisting || unmanaged.length !== 1 || unmanaged[0].comment) {
            throw new PluginError(
              "\u76EE\u6807\u57DF\u540D\u5DF2\u6709\u975E\u672C\u63D2\u4EF6\u7BA1\u7406\u7684\u540C\u7C7B\u578B\u8BB0\u5F55\uFF0C\u5DF2\u505C\u6B62\u8986\u76D6\u3002\u53EF\u5148\u6574\u7406\u8BB0\u5F55\uFF0C\u6216\u542F\u7528\u201C\u63A5\u7BA1\u552F\u4E00\u5DF2\u6709\u8BB0\u5F55\u201D\u3002",
              422
            );
          }
          current = unmanaged[0];
        }
      }
      const payload = {
        type: record.type,
        name: record.domain,
        content: ip,
        ttl: record.proxied ? 1 : record.ttl,
        proxied: record.proxied,
        comment: marker
      };
      if (current && current.content === ip && Number(current.ttl) === payload.ttl && Boolean(current.proxied) === payload.proxied && current.comment === marker) {
        this.statuses[record.id] = statusForRecord(record, "success", {
          action: "unchanged",
          currentIp: ip,
          recordId: current.id,
          lastSuccessAt: nowIso(),
          lastChangedAt: this.statuses[record.id]?.lastChangedAt
        });
        this.job.skipped += 1;
        return {
          changed: false,
          action: "unchanged",
          previousIp: current.content,
          currentIp: ip
        };
      }
      const updated = current ? await client.updateRecord(zone.id, current.id, payload) : await client.createRecord(zone.id, payload);
      const changedAt = nowIso();
      this.statuses[record.id] = statusForRecord(record, "success", {
        action: current ? "updated" : "created",
        currentIp: ip,
        recordId: updated.id,
        lastSuccessAt: changedAt,
        lastChangedAt: changedAt
      });
      this.job.changed += 1;
      this.deps.storage.appendLog({
        level: "success",
        action: current ? "update" : "create",
        message: `${current ? "\u66F4\u65B0" : "\u521B\u5EFA"} ${record.type} \u8BB0\u5F55\u4E3A ${ip}`,
        domain: record.domain,
        type: record.type,
        nodeUuid: record.nodeUuid
      });
      return {
        changed: true,
        action: current ? "updated" : "created",
        previousIp: current?.content,
        currentIp: ip
      };
    }
  };

  // src/routes.ts
  var import_plugin_sdk = __toESM(require_src());

  // src/batch.ts
  function expandBatch(input, settingsInterval) {
    const types = input.mode === "v4" ? ["A"] : input.mode === "v6" ? ["AAAA"] : ["A", "AAAA"];
    const records = [];
    const at = nowIso();
    for (const nodeUuid of input.nodeUuids) {
      const groupId = makeId();
      for (const domain of input.domains) {
        for (const type of types) {
          records.push(
            normalizeRecord({
              id: makeId(),
              groupId,
              domain,
              type,
              nodeUuid,
              ttl: input.ttl,
              proxied: input.proxied,
              enabled: input.enabled,
              intervalMinutes: input.intervalMinutes || settingsInterval,
              adoptExisting: input.adoptExisting,
              createdAt: at,
              updatedAt: at
            })
          );
        }
      }
    }
    return records;
  }

  // src/groups.ts
  function groupRecords(records) {
    const grouped = /* @__PURE__ */ new Map();
    for (const record of records) {
      const key = record.groupId || record.id;
      const items = grouped.get(key) || [];
      items.push(record);
      grouped.set(key, items);
    }
    const result = [];
    for (const [id, items] of grouped) {
      const first = items[0];
      if (!first) continue;
      const domains = [];
      const seenDomains = /* @__PURE__ */ new Set();
      const types = /* @__PURE__ */ new Set();
      for (const item of items) {
        if (!seenDomains.has(item.domain)) {
          seenDomains.add(item.domain);
          domains.push(item.domain);
        }
        types.add(item.type);
      }
      const mode = types.has("A") && types.has("AAAA") ? "dual" : types.has("AAAA") ? "v6" : "v4";
      const createdAt = items.reduce(
        (oldest, item) => item.createdAt && item.createdAt < oldest ? item.createdAt : oldest,
        first.createdAt || ""
      );
      const updatedAt = items.reduce(
        (newest, item) => item.updatedAt && item.updatedAt > newest ? item.updatedAt : newest,
        first.updatedAt || ""
      );
      result.push({
        id,
        nodeUuid: first.nodeUuid,
        domains,
        mode,
        ttl: first.ttl,
        proxied: first.proxied,
        enabled: first.enabled,
        intervalMinutes: first.intervalMinutes,
        adoptExisting: first.adoptExisting,
        recordIds: items.map((item) => item.id),
        createdAt,
        updatedAt
      });
    }
    return result.sort((left, right) => {
      const node = left.nodeUuid.localeCompare(right.nodeUuid);
      return node || left.createdAt.localeCompare(right.createdAt);
    });
  }
  function recordsForGroup(records, groupId) {
    return records.filter((record) => record.groupId === groupId);
  }

  // src/routes.ts
  function isAdmin(req) {
    const principal = req.context?.principal;
    return Boolean(
      principal && Array.isArray(principal.roles) && principal.roles.includes("admin")
    );
  }
  function setNoStore(res) {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
  }
  function fail(res, error) {
    const message = errorMessage(error);
    const status = error instanceof PluginError ? error.status : 500;
    setNoStore(res);
    (0, import_plugin_sdk.jsonResponse)(res, { error: message }, status);
  }
  function requireAdmin(req, res) {
    if (isAdmin(req)) return true;
    setNoStore(res);
    (0, import_plugin_sdk.jsonResponse)(res, { error: "\u8BF7\u5148\u767B\u5F55 Komari \u7BA1\u7406\u5458\u8D26\u6237\u3002" }, 401);
    return false;
  }
  function requireCsrf(req, expected) {
    const value = req.headers["x-komari-ddns-plus-csrf"];
    const token = Array.isArray(value) ? value[0] : value;
    if (!token || token !== expected) throw new PluginError("CSRF \u6821\u9A8C\u5931\u8D25\uFF0C\u8BF7\u5237\u65B0\u9875\u9762\u540E\u91CD\u8BD5\u3002", 403);
  }
  function bodyOf(req) {
    const parsed = parseJsonBody(req.body);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new PluginError("\u8BF7\u6C42\u4F53\u5FC5\u987B\u662F JSON \u5BF9\u8C61\u3002");
    }
    return parsed;
  }
  function parseMode(value) {
    if (value === "v4" || value === "v6" || value === "dual") return value;
    throw new PluginError("\u6A21\u5F0F\u53EA\u80FD\u662F IPv4\u3001IPv6 \u6216 IPv4 + IPv6\u3002");
  }
  function parseIds(value) {
    if (!Array.isArray(value)) throw new PluginError("\u8BF7\u9009\u62E9\u81F3\u5C11\u4E00\u6761\u89C4\u5219\u3002");
    const ids = Array.from(
      new Set(
        value.map((item) => String(item || "").trim()).filter((item) => /^[a-zA-Z0-9-]{8,64}$/.test(item))
      )
    );
    if (ids.length === 0) throw new PluginError("\u8BF7\u9009\u62E9\u81F3\u5C11\u4E00\u6761\u89C4\u5219\u3002");
    return ids;
  }
  function parseBoolean(value, fallback, label) {
    if (value === void 0) return fallback;
    if (typeof value !== "boolean") throw new PluginError(`${label}\u683C\u5F0F\u65E0\u6548\u3002`);
    return value;
  }
  function ensureIdle(engine2) {
    if (engine2.snapshot().job.running) {
      throw new PluginError("\u540C\u6B65\u4EFB\u52A1\u6B63\u5728\u8FD0\u884C\uFF0C\u8BF7\u5B8C\u6210\u540E\u518D\u4FEE\u6539\u89C4\u5219\u6216\u8BBE\u7F6E\u3002", 409);
    }
  }
  function registerRoutes(deps) {
    const { server: server2, storage: storage2, engine: engine2, getNodes: getNodes2, csrf: csrf2 } = deps;
    server2.route("GET", "/ddns-plus/state", (req, res) => {
      if (!requireAdmin(req, res)) return;
      const settings = storage2.loadSettings();
      const records = storage2.loadRecords();
      const snapshot = engine2.snapshot();
      setNoStore(res);
      (0, import_plugin_sdk.jsonResponse)(res, {
        settings: publicSettings(settings),
        records,
        groups: groupRecords(records),
        statuses: snapshot.statuses,
        sync: snapshot.job,
        csrf: csrf2,
        version: "0.0.2"
      });
    });
    server2.route("GET", "/ddns-plus/nodes", async (req, res) => {
      if (!requireAdmin(req, res)) return;
      try {
        setNoStore(res);
        (0, import_plugin_sdk.jsonResponse)(res, await getNodes2());
      } catch (error) {
        fail(res, error);
      }
    });
    server2.route("POST", "/ddns-plus/settings/test", async (req, res) => {
      if (!requireAdmin(req, res)) return;
      try {
        requireCsrf(req, csrf2);
        const saved = storage2.loadSettings();
        const auth = resolveCredentials(bodyOf(req), saved);
        const result = await createCloudflareClient(auth).test();
        setNoStore(res);
        (0, import_plugin_sdk.jsonResponse)(res, result);
      } catch (error) {
        fail(res, error);
      }
    });
    server2.route("POST", "/ddns-plus/settings", (req, res) => {
      if (!requireAdmin(req, res)) return;
      try {
        requireCsrf(req, csrf2);
        ensureIdle(engine2);
        const previous = storage2.loadSettings();
        const next = normalizeSettings(bodyOf(req), previous);
        storage2.saveSettings(next);
        storage2.appendLog({
          level: "info",
          action: "settings",
          message: "\u5DF2\u4FDD\u5B58 Cloudflare \u8FDE\u63A5\u8BBE\u7F6E\u3002"
        });
        setNoStore(res);
        (0, import_plugin_sdk.jsonResponse)(res, { settings: publicSettings(next) });
      } catch (error) {
        fail(res, error);
      }
    });
    server2.route("POST", "/ddns-plus/pause", (req, res) => {
      if (!requireAdmin(req, res)) return;
      try {
        requireCsrf(req, csrf2);
        const paused = parseBoolean(bodyOf(req).paused, false, "\u6682\u505C\u5F00\u5173");
        const settings = storage2.loadSettings();
        settings.paused = paused;
        settings.updatedAt = nowIso();
        storage2.saveSettings(settings);
        storage2.appendLog({
          level: "info",
          action: paused ? "pause" : "resume",
          message: paused ? "\u5DF2\u6682\u505C\u8BA1\u5212\u540C\u6B65\u3002" : "\u5DF2\u6062\u590D\u8BA1\u5212\u540C\u6B65\u3002"
        });
        setNoStore(res);
        (0, import_plugin_sdk.jsonResponse)(res, { paused });
      } catch (error) {
        fail(res, error);
      }
    });
    server2.route("POST", "/ddns-plus/records/batch", async (req, res) => {
      if (!requireAdmin(req, res)) return;
      try {
        requireCsrf(req, csrf2);
        ensureIdle(engine2);
        const body = bodyOf(req);
        const settings = storage2.loadSettings();
        const nodeUuids = normalizeNodeIds(body.nodeUuids);
        const domains = parseDomains(body.domains);
        const mode = parseMode(body.mode);
        const proxied = parseBoolean(body.proxied, false, "\u4EE3\u7406\u5F00\u5173");
        const ttl = normalizeTtl(body.ttl, proxied);
        const intervalMinutes = normalizeInterval(
          body.intervalMinutes ?? settings.intervalMinutes
        );
        const enabled = parseBoolean(body.enabled, true, "\u542F\u7528\u5F00\u5173");
        const adoptExisting = parseBoolean(body.adoptExisting, false, "\u63A5\u7BA1\u5DF2\u6709\u8BB0\u5F55\u5F00\u5173");
        const nodes = await getNodes2(nodeUuids);
        const available = new Set(nodes.map((node) => node.uuid));
        const missing = nodeUuids.filter((uuid) => !available.has(uuid));
        if (missing.length) throw new PluginError("\u89C4\u5219\u4E2D\u5305\u542B\u5DF2\u5220\u9664\u7684\u670D\u52A1\u5668\uFF0C\u8BF7\u5237\u65B0\u8282\u70B9\u5217\u8868\u3002");
        const generated = expandBatch(
          {
            nodeUuids,
            domains,
            mode,
            ttl,
            proxied,
            intervalMinutes,
            enabled,
            adoptExisting
          },
          settings.intervalMinutes
        );
        const records = storage2.loadRecords();
        const existing = new Set(
          records.map((record) => recordKey(record.domain, record.type, record.nodeUuid))
        );
        const duplicates = [];
        for (const record of generated) {
          const key = recordKey(record.domain, record.type, record.nodeUuid);
          if (existing.has(key)) duplicates.push(`${record.domain} ${record.type}`);
        }
        if (duplicates.length) {
          throw new PluginError(
            `\u4EE5\u4E0B\u76EE\u6807\u5DF2\u5B58\u5728\uFF0C\u4E0D\u80FD\u91CD\u590D\u521B\u5EFA\uFF1A${duplicates.slice(0, 5).join("\u3001")}${duplicates.length > 5 ? ` \u7B49 ${duplicates.length} \u6761` : ""}\u3002\u540C\u4E00\u4E2A\u8282\u70B9\u53EF\u4EE5\u521B\u5EFA\u4E0D\u540C\u6A21\u5F0F\u6216\u4E0D\u540C\u57DF\u540D\u7684\u89C4\u5219\u7EC4\u3002`,
            409
          );
        }
        assertRecordLimit(records.length + generated.length);
        const groupsAdded = new Set(generated.map((record) => record.groupId)).size;
        storage2.saveRecords(records.concat(generated));
        storage2.appendLog({
          level: "info",
          action: "batch-add",
          message: `\u65B0\u589E ${groupsAdded} \u4E2A\u8282\u70B9\u89C4\u5219\u7EC4\uFF0C\u5171 ${generated.length} \u6761 DNS \u76EE\u6807\u3002`
        });
        setNoStore(res);
        (0, import_plugin_sdk.jsonResponse)(res, {
          groupsAdded,
          recordsAdded: generated.length,
          totalRecords: records.length + generated.length,
          groups: groupRecords(generated),
          records: generated
        });
      } catch (error) {
        fail(res, error);
      }
    });
    server2.route("POST", "/ddns-plus/groups/update", (req, res) => {
      if (!requireAdmin(req, res)) return;
      try {
        requireCsrf(req, csrf2);
        ensureIdle(engine2);
        const body = bodyOf(req);
        const groupId = String(body.groupId || "").trim();
        if (!/^[a-zA-Z0-9-]{8,64}$/.test(groupId)) {
          throw new PluginError("\u89C4\u5219\u7EC4 ID \u65E0\u6548\u3002");
        }
        const records = storage2.loadRecords();
        const groupItems = recordsForGroup(records, groupId);
        if (!groupItems.length) throw new PluginError("\u89C4\u5219\u7EC4\u4E0D\u5B58\u5728\u3002", 404);
        const first = groupItems[0];
        const domains = parseDomains(body.domains);
        const inferredMode = groupItems.some((item) => item.type === "AAAA") ? groupItems.some((item) => item.type === "A") ? "dual" : "v6" : "v4";
        const mode = body.mode === void 0 ? inferredMode : parseMode(body.mode);
        const proxied = parseBoolean(body.proxied, first.proxied, "\u4EE3\u7406\u5F00\u5173");
        const ttl = normalizeTtl(body.ttl ?? first.ttl, proxied);
        const intervalMinutes = normalizeInterval(
          body.intervalMinutes ?? first.intervalMinutes
        );
        const enabled = parseBoolean(body.enabled, first.enabled, "\u542F\u7528\u5F00\u5173");
        const adoptExisting = parseBoolean(
          body.adoptExisting,
          first.adoptExisting,
          "\u63A5\u7BA1\u5DF2\u6709\u8BB0\u5F55\u5F00\u5173"
        );
        const types = mode === "v4" ? ["A"] : mode === "v6" ? ["AAAA"] : ["A", "AAAA"];
        const oldByKey = new Map(
          groupItems.map((record) => [recordKey(record.domain, record.type, record.nodeUuid), record])
        );
        const nextGroupRecords = [];
        for (const domain of domains) {
          for (const type of types) {
            const key = recordKey(domain, type, first.nodeUuid);
            const previous = oldByKey.get(key);
            nextGroupRecords.push(
              normalizeRecord(
                {
                  ...previous,
                  groupId,
                  domain,
                  type,
                  nodeUuid: first.nodeUuid,
                  ttl,
                  proxied,
                  enabled,
                  intervalMinutes,
                  adoptExisting
                },
                previous
              )
            );
          }
        }
        const outsideKeys = new Set(
          records.filter((record) => record.groupId !== groupId).map((record) => recordKey(record.domain, record.type, record.nodeUuid))
        );
        const overlaps = nextGroupRecords.filter(
          (record) => outsideKeys.has(recordKey(record.domain, record.type, record.nodeUuid))
        );
        if (overlaps.length) {
          throw new PluginError(
            `\u76EE\u6807\u5DF2\u88AB\u5176\u4ED6\u89C4\u5219\u7EC4\u5360\u7528\uFF1A${overlaps.slice(0, 5).map((record) => `${record.domain} ${record.type}`).join("\u3001")}`,
            409
          );
        }
        const nextIds = new Set(nextGroupRecords.map((record) => record.id));
        const removedIds = groupItems.filter((record) => !nextIds.has(record.id)).map((record) => record.id);
        const nextRecords = records.filter((record) => record.groupId !== groupId).concat(nextGroupRecords);
        storage2.saveRecords(nextRecords);
        if (removedIds.length) engine2.removeStatuses(removedIds);
        storage2.appendLog({
          level: "info",
          action: "group-update",
          message: `\u66F4\u65B0\u8282\u70B9\u89C4\u5219\u7EC4\uFF0C\u73B0\u6709 ${nextGroupRecords.length} \u6761 DNS \u76EE\u6807${removedIds.length ? `\uFF0C\u79FB\u9664 ${removedIds.length} \u6761\u76EE\u6807\u89C4\u5219` : ""}\u3002`
        });
        setNoStore(res);
        (0, import_plugin_sdk.jsonResponse)(res, {
          ok: true,
          group: groupRecords(nextGroupRecords)[0],
          removedTargets: removedIds.length
        });
      } catch (error) {
        fail(res, error);
      }
    });
    server2.route("POST", "/ddns-plus/records/bulk", (req, res) => {
      if (!requireAdmin(req, res)) return;
      try {
        requireCsrf(req, csrf2);
        const body = bodyOf(req);
        const groupIds = parseIds(body.ids);
        const action = String(body.action || "");
        const idSet = new Set(groupIds);
        const records = storage2.loadRecords();
        const selectedGroups = groupRecords(records).filter((group) => idSet.has(group.id));
        if (!selectedGroups.length) throw new PluginError("\u6240\u9009\u89C4\u5219\u7EC4\u4E0D\u5B58\u5728\u3002", 404);
        const recordIds = selectedGroups.flatMap((group) => group.recordIds);
        if (action === "enable" || action === "disable") {
          ensureIdle(engine2);
          const enabled = action === "enable";
          const updated = records.map(
            (record) => idSet.has(record.groupId) ? { ...record, enabled, updatedAt: nowIso() } : record
          );
          storage2.saveRecords(updated);
          storage2.appendLog({
            level: "info",
            action: enabled ? "bulk-enable" : "bulk-disable",
            message: `${enabled ? "\u542F\u7528" : "\u505C\u7528"} ${selectedGroups.length} \u4E2A\u8282\u70B9\u89C4\u5219\u7EC4\u3002`
          });
          setNoStore(res);
          (0, import_plugin_sdk.jsonResponse)(res, { ok: true, affectedGroups: selectedGroups.length });
          return;
        }
        if (action === "delete") {
          ensureIdle(engine2);
          const remaining = records.filter((record) => !idSet.has(record.groupId));
          storage2.saveRecords(remaining);
          engine2.removeStatuses(recordIds);
          storage2.appendLog({
            level: "warning",
            action: "bulk-delete",
            message: `\u5220\u9664 ${selectedGroups.length} \u4E2A\u8282\u70B9\u89C4\u5219\u7EC4\uFF0CCloudflare DNS \u8BB0\u5F55\u4FDD\u7559\u3002`
          });
          setNoStore(res);
          (0, import_plugin_sdk.jsonResponse)(res, { ok: true, affectedGroups: selectedGroups.length });
          return;
        }
        if (action === "sync") {
          const job = engine2.start(recordIds, true);
          setNoStore(res);
          (0, import_plugin_sdk.jsonResponse)(res, { ok: true, job });
          return;
        }
        throw new PluginError("\u4E0D\u652F\u6301\u7684\u6279\u91CF\u64CD\u4F5C\u3002");
      } catch (error) {
        fail(res, error);
      }
    });
    server2.route("POST", "/ddns-plus/sync", (req, res) => {
      if (!requireAdmin(req, res)) return;
      try {
        requireCsrf(req, csrf2);
        const body = bodyOf(req);
        const groupIds = Array.isArray(body.groupIds) ? parseIds(body.groupIds) : Array.isArray(body.ids) ? parseIds(body.ids) : void 0;
        let recordIds;
        if (groupIds) {
          const selected = new Set(groupIds);
          recordIds = groupRecords(storage2.loadRecords()).filter((group) => selected.has(group.id)).flatMap((group) => group.recordIds);
          if (!recordIds.length) throw new PluginError("\u6240\u9009\u89C4\u5219\u7EC4\u4E0D\u5B58\u5728\u3002", 404);
        }
        const job = engine2.start(recordIds, body.force === false ? false : true);
        setNoStore(res);
        (0, import_plugin_sdk.jsonResponse)(res, { ok: true, job });
      } catch (error) {
        fail(res, error);
      }
    });
    server2.route("GET", "/ddns-plus/logs", (req, res) => {
      if (!requireAdmin(req, res)) return;
      const query = req.query || {};
      const level = String(query.level || "");
      const domain = String(query.domain || "").toLowerCase();
      const limit = Math.max(1, Math.min(1e3, Number(query.limit) || 200));
      const logs = storage2.loadLogs().filter((log) => (!level || log.level === level) && (!domain || String(log.domain || "").toLowerCase().includes(domain))).slice(-limit).reverse();
      setNoStore(res);
      (0, import_plugin_sdk.jsonResponse)(res, { logs, total: logs.length });
    });
    server2.route("DELETE", "/ddns-plus/logs", (req, res) => {
      if (!requireAdmin(req, res)) return;
      try {
        requireCsrf(req, csrf2);
        storage2.clearLogs();
        setNoStore(res);
        (0, import_plugin_sdk.jsonResponse)(res, { ok: true });
      } catch (error) {
        fail(res, error);
      }
    });
  }

  // src/storage.ts
  var fs = __toESM(__require("node:fs"));
  var path = __toESM(__require("node:path"));
  var DEFAULT_SETTINGS = {
    version: 1,
    authMode: "token",
    token: "",
    email: "",
    apiKey: "",
    notify: false,
    paused: false,
    intervalMinutes: 1,
    updatedAt: ""
  };
  var Storage = class {
    constructor(baseDir) {
      this.baseDir = baseDir;
    }
    ensure() {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }
    file(name) {
      return path.join(this.baseDir, name);
    }
    readJson(name, fallback) {
      const file = this.file(name);
      if (!fs.existsSync(file)) return fallback;
      try {
        return JSON.parse(fs.readFileSync(file, "utf8"));
      } catch (error) {
        console.error(`[ddns-plus] failed to read ${name}:`, error);
        return fallback;
      }
    }
    writeJson(name, value, privateFile = false) {
      this.ensure();
      const target = this.file(name);
      const temp = `${target}.${process.pid}.${Date.now()}.tmp`;
      const serialized = JSON.stringify(value, null, 2);
      fs.writeFileSync(temp, serialized, { encoding: "utf8", mode: privateFile ? 384 : 420 });
      fs.renameSync(temp, target);
      if (privateFile) {
        try {
          fs.chmodSync(target, 384);
        } catch {
        }
      }
    }
    loadSettings() {
      const raw = this.readJson("settings.json", {});
      return {
        ...DEFAULT_SETTINGS,
        ...raw,
        version: 1,
        authMode: raw.authMode === "key" ? "key" : "token",
        token: typeof raw.token === "string" ? raw.token : "",
        email: typeof raw.email === "string" ? raw.email : "",
        apiKey: typeof raw.apiKey === "string" ? raw.apiKey : "",
        notify: Boolean(raw.notify),
        paused: Boolean(raw.paused),
        intervalMinutes: Number(raw.intervalMinutes) || 1,
        updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : ""
      };
    }
    saveSettings(settings) {
      this.writeJson("settings.json", settings, true);
    }
    loadRecords() {
      const raw = this.readJson("records.json", []);
      if (!Array.isArray(raw)) return [];
      const records = raw.filter((record) => {
        return Boolean(record) && typeof record === "object" && typeof record.id === "string" && typeof record.domain === "string" && (record.type === "A" || record.type === "AAAA") && typeof record.nodeUuid === "string";
      });
      let migrated = false;
      for (const record of records) {
        if (typeof record.groupId === "string" && /^[a-zA-Z0-9-]{8,64}$/.test(record.groupId)) {
          continue;
        }
        const legacyKey = [
          "legacy",
          record.nodeUuid,
          record.ttl,
          Boolean(record.proxied),
          Boolean(record.enabled),
          record.intervalMinutes,
          Boolean(record.adoptExisting)
        ].join("|");
        record.groupId = stableId(legacyKey);
        migrated = true;
      }
      if (migrated) this.saveRecords(records);
      return records;
    }
    saveRecords(records) {
      this.writeJson("records.json", records);
    }
    loadStatuses() {
      const raw = this.readJson("status.json", {});
      return raw && typeof raw === "object" ? raw : {};
    }
    saveStatuses(statuses) {
      this.writeJson("status.json", statuses, true);
    }
    loadLogs() {
      const raw = this.readJson("logs.json", []);
      return Array.isArray(raw) ? raw : [];
    }
    appendLog(entry) {
      const logs = this.loadLogs();
      logs.push({
        ...entry,
        id: entry.id || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        at: entry.at || nowIso()
      });
      this.writeJson("logs.json", logs.slice(-MAX_LOGS));
    }
    clearLogs() {
      this.writeJson("logs.json", []);
    }
  };

  // src/plugin.ts
  var storage = new Storage(__storageDir__);
  var engine;
  var csrf = makeId(24);
  function normalizeNodeList(value) {
    if (Array.isArray(value)) return value.filter((item) => item && typeof item === "object");
    if (value && typeof value === "object") {
      return Object.values(value).filter(
        (item) => item && typeof item === "object"
      );
    }
    return [];
  }
  function nodeOnline(status) {
    if (!status) return true;
    if (typeof status === "boolean") return status;
    if (typeof status === "object" && "online" in status) {
      return status.online !== false;
    }
    return true;
  }
  async function getNodes(uuids) {
    const raw = await import_plugin_sdk2.server.call("common:getNodes");
    const wanted = uuids && uuids.length ? new Set(uuids) : null;
    const list = normalizeNodeList(raw).filter((node) => {
      const uuid = String(node.uuid || "");
      return !wanted || wanted.has(uuid);
    });
    const selected = list.map((node) => String(node.uuid || "")).filter(Boolean);
    let statuses = {};
    try {
      const result = await import_plugin_sdk2.server.call(
        "common:getNodesLatestStatus",
        selected.length ? { uuids: selected } : {}
      );
      statuses = result && typeof result === "object" ? result : {};
    } catch (error) {
      console.warn("[ddns-plus] getNodesLatestStatus failed:", errorMessage(error));
    }
    return list.map((node) => {
      const uuid = String(node.uuid || "");
      return {
        uuid,
        name: String(node.name || uuid),
        ipv4: String(node.ipv4 || ""),
        ipv6: String(node.ipv6 || ""),
        online: nodeOnline(statuses[uuid]),
        group: String(node.group || "")
      };
    }).filter((node) => node.uuid).sort((left, right) => left.name.localeCompare(right.name));
  }
  async function notify(payload) {
    await import_plugin_sdk2.server.call("admin:sendNotification", {
      event: {
        event: "DDNS Plus",
        message: payload.message,
        time: nowIso(),
        clients: payload.clients.map((uuid) => ({ uuid }))
      }
    });
  }
  (0, import_plugin_sdk2.definePlugin)({
    load() {
      storage.ensure();
      csrf = makeId(24);
      engine = new SyncEngine({ storage, getNodes, notify });
      registerRoutes({ server: import_plugin_sdk2.server, storage, engine, getNodes, csrf });
      import_plugin_sdk2.server.cron("@every 30s", () => {
        try {
          engine.startDue();
        } catch (error) {
          const settings = storage.loadSettings();
          storage.appendLog({
            level: "error",
            action: "schedule",
            message: redact(errorMessage(error), settings)
          });
        }
      });
      console.log("[ddns-plus] loaded, storage:", __storageDir__);
    },
    unload() {
      console.log("[ddns-plus] unloaded");
    }
  });
})();
