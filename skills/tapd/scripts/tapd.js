#!/usr/bin/env node
"use strict";

const https = require("https");
const http = require("http");
const { URL } = require("url");

// ────────── Markdown → HTML 简易转换 ──────────

function mdToHtml(text) {
  if (!text) return text;
  let html = text
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/^\- (.+)$/gm, "<li>$1</li>")
    .replace(/^\d+\. (.+)$/gm, "<li>$1</li>");
  if (/<li>/.test(html)) {
    html = html.replace(/((?:<li>.*<\/li>\n?)+)/g, "<ul>$1</ul>");
  }
  html = html
    .split(/\n{2,}/)
    .map((block) => {
      block = block.trim();
      if (!block) return "";
      if (/^<[huo]/.test(block)) return block;
      return `<p>${block}</p>`;
    })
    .filter(Boolean)
    .join("\n");
  if (/<p>|<h|<ul>|<ol>/.test(html)) return html;
  return text;
}

// ────────── HTTP 请求 ──────────

function httpRequest(method, urlStr, headers, body) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlStr);
    const mod = u.protocol === "https:" ? https : http;
    const opts = {
      hostname: u.hostname,
      port: u.port || (u.protocol === "https:" ? 443 : 80),
      path: u.pathname + u.search,
      method,
      headers,
      timeout: 30000,
    };
    const req = mod.request(opts, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => {
        const raw = Buffer.concat(chunks).toString();
        if (res.statusCode >= 400) {
          reject(
            new Error(
              `HTTP ${res.statusCode}: ${raw.substring(0, 500)}`
            )
          );
          return;
        }
        try {
          resolve(JSON.parse(raw));
        } catch {
          resolve(raw);
        }
      });
    });
    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Request timed out"));
    });
    if (body !== undefined) req.write(JSON.stringify(body));
    req.end();
  });
}

// ────────── TAPDClient ──────────

class TAPDClient {
  constructor() {
    this.accessToken = process.env.TAPD_ACCESS_TOKEN || "";
    this.apiUser = process.env.TAPD_API_USER || "";
    this.apiPassword = process.env.TAPD_API_PASSWORD || "";
    this.baseUrl = process.env.TAPD_API_BASE_URL || "https://apiv2.tapd.tencent.com";
    this.tapdBaseUrl = process.env.TAPD_BASE_URL || "https://tapd.tencent.com";
    this.botUrl = process.env.BOT_URL || "";
    this.nick = null;

    if (this.accessToken) {
      this.headers = {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
        Via: "mcp",
      };
    } else if (this.apiUser && this.apiPassword) {
      const b64 = Buffer.from(`${this.apiUser}:${this.apiPassword}`).toString("base64");
      this.headers = {
        Authorization: `Basic ${b64}`,
        "Content-Type": "application/json",
        Via: "mcp",
      };
    } else {
      process.stderr.write("错误: 请设置 TAPD_ACCESS_TOKEN 或 TAPD_API_USER+TAPD_API_PASSWORD 环境变量\n");
      process.exit(1);
    }
  }

  async init() {
    if (this.accessToken) {
      try {
        const resp = await this._request("GET", "users/info");
        this.nick = resp?.data?.nick || null;
      } catch {
        this.nick = null;
      }
    }
  }

  async _request(method, endpoint, params, body) {
    let url = `${this.baseUrl}/${endpoint}`;
    const sep = url.includes("?") ? "&" : "?";
    url = `${url}${sep}s=mcp`;
    if (params && Object.keys(params).length > 0) {
      const qs = Object.entries(params)
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
        .join("&");
      url += `&${qs}`;
    }
    return httpRequest(method, url, this.headers, body);
  }

  isCloudEnv() {
    return this.baseUrl.includes("api.tapd.cn");
  }

  toLongId(shortId, workspaceId) {
    shortId = shortId.trim();
    if (/^\d+$/.test(shortId) && shortId.length <= 9) {
      const pre = this.isCloudEnv() ? "11" : "10";
      return `${pre}${workspaceId}${shortId.padStart(9, "0")}`;
    }
    return shortId;
  }

  expandIds(params, idKey, wsKey = "workspace_id") {
    if (params[idKey] && params[wsKey]) {
      const val = String(params[idKey]);
      const ws = String(params[wsKey]);
      if (val.includes(",")) {
        params[idKey] = val.split(",").map((i) => this.toLongId(i.trim(), ws)).join(",");
      } else {
        params[idKey] = this.toLongId(val, ws);
      }
    }
    return params;
  }

  filterFields(dataList, fieldsParam) {
    if (!dataList || !Array.isArray(dataList)) return dataList;
    const fields = fieldsParam ? fieldsParam.split(",").map((f) => f.trim()).filter(Boolean) : [];
    return dataList.map((item) => {
      if (typeof item !== "object" || item === null) return item;
      let wrapperKey = null;
      for (const k of ["Story", "Bug", "Task", "Iteration"]) {
        if (item[k] && typeof item[k] === "object") { wrapperKey = k; break; }
      }
      const obj = wrapperKey ? item[wrapperKey] : item;
      const newObj = {};
      for (const [k, v] of Object.entries(obj)) {
        if (k.startsWith("custom_field_") && (v === null || v === "") && !fields.includes(k)) continue;
        if (k === "description" && wrapperKey !== "Iteration" && !fields.includes("description")) continue;
        if (k.startsWith("custom_plan_field_") && v === "0") continue;
        newObj[k] = v;
      }
      return wrapperKey ? { [wrapperKey]: newObj } : newObj;
    });
  }

  async checkMiniProject(workspaceId) {
    const ret = await this._request("GET", `workspaces/get_workspace_info?workspace_id=${workspaceId}`);
    return ret?.data?.Workspace?.category === "mini_project";
  }

  async storyUrlTemplate(workspaceId, entityType) {
    if (entityType === "tasks") return `${this.tapdBaseUrl}/${workspaceId}/prong/tasks/view/{id}`;
    if (await this.checkMiniProject(workspaceId)) return `${this.tapdBaseUrl}/tapd_fe/t/index/${workspaceId}?workitemId={id}`;
    return `${this.tapdBaseUrl}/${workspaceId}/prong/stories/view/{id}`;
  }

  // ────────── 项目/用户 ──────────

  async getProjects(nick) { return this._request("GET", "workspaces/user_participant_projects", { nick }); }
  async getWorkspaceInfo(wsId) { return this._request("GET", `workspaces/get_workspace_info?workspace_id=${wsId}`); }

  // ────────── 需求/任务 ──────────

  async getStories(wsId, opts) {
    const entityType = opts.entity_type || "stories"; delete opts.entity_type;
    const params = { workspace_id: wsId, page: 1, limit: 10, ...opts };
    this.expandIds(params, "id");
    const data = await this._request("GET", entityType, params);
    const count = await this._request("GET", `${entityType}/count`, params);
    if (data?.data && Array.isArray(data.data)) data.data = this.filterFields(data.data, opts.fields);
    const urlTpl = await this.storyUrlTemplate(wsId, entityType);
    return { url_template: urlTpl, data: data?.data ?? data, count };
  }

  async getStoryCount(wsId, opts) {
    const entityType = opts.entity_type || "stories"; delete opts.entity_type;
    return this._request("GET", `${entityType}/count`, { workspace_id: wsId, ...opts });
  }

  async createStory(wsId, name, opts) {
    const entityType = opts.entity_type || "stories"; delete opts.entity_type;
    const body = { workspace_id: wsId, name, ...opts };
    if (this.nick && !body.creator) body.creator = this.nick;
    if (body.description) body.description = mdToHtml(body.description);
    const result = await this._request("POST", entityType, undefined, body);
    const eid = entityType === "tasks" ? result?.data?.Task?.id : result?.data?.Story?.id;
    const urlTpl = await this.storyUrlTemplate(wsId, entityType);
    return { url_template: urlTpl, url: urlTpl.replace("{id}", String(eid || "")), data: result };
  }

  async updateStory(wsId, opts) {
    const entityType = opts.entity_type || "stories"; delete opts.entity_type;
    const body = { workspace_id: wsId, ...opts };
    this.expandIds(body, "id");
    if (this.nick) body.current_user = this.nick;
    if (body.description) body.description = mdToHtml(body.description);
    const result = await this._request("POST", entityType, undefined, body);
    const urlTpl = await this.storyUrlTemplate(wsId, entityType);
    return { url_template: urlTpl, data: result };
  }

  async getFieldsLabel(wsId) { return this._request("GET", `stories/get_fields_lable?workspace_id=${wsId}`); }
  async getFieldsInfo(wsId) { return this._request("GET", `stories/get_fields_info?workspace_id=${wsId}`); }
  async getCustomFields(wsId, opts) { const et = opts.entity_type || "stories"; return this._request("GET", `${et}/custom_fields_settings?workspace_id=${wsId}`); }
  async getWorkitemTypes(wsId, opts) { return this._request("GET", `workitem_types?workspace_id=${wsId}`, { workspace_id: wsId, ...opts }); }

  // ────────── 缺陷 ──────────

  async getBugs(wsId, opts) {
    const params = { workspace_id: wsId, page: 1, limit: 10, ...opts };
    this.expandIds(params, "id");
    const data = await this._request("GET", "bugs", params);
    const count = await this._request("GET", "bugs/count", params);
    if (data?.data && Array.isArray(data.data)) data.data = this.filterFields(data.data, opts.fields);
    return { base_url: this.tapdBaseUrl, data: data?.data ?? data, count };
  }

  async getBugCount(wsId, opts) { return this._request("GET", "bugs/count", { workspace_id: wsId, ...opts }); }

  async createBug(wsId, title, opts) {
    const body = { workspace_id: wsId, title, ...opts };
    if (this.nick && !body.reporter) body.reporter = this.nick;
    if (body.description) body.description = mdToHtml(body.description);
    const result = await this._request("POST", "bugs", undefined, body);
    const bugId = result?.data?.Bug?.id || "";
    return { url: `${this.tapdBaseUrl}/${wsId}/bugtrace/bugs/view/${bugId}`, data: result };
  }

  async updateBug(wsId, opts) {
    const body = { workspace_id: wsId, ...opts };
    this.expandIds(body, "id");
    if (this.nick) { body.current_user = this.nick; if (!body.lastmodify) body.lastmodify = this.nick; }
    if (body.description) body.description = mdToHtml(body.description);
    const result = await this._request("POST", "bugs", undefined, body);
    return { base_url: this.tapdBaseUrl, data: result };
  }

  // ────────── 迭代 ──────────

  async getIterations(wsId, opts) {
    const params = { workspace_id: wsId, ...opts };
    const result = await this._request("GET", `iterations?workspace_id=${wsId}`, params);
    if (result?.data && Array.isArray(result.data)) result.data = this.filterFields(result.data, opts.fields);
    return result;
  }

  async createIteration(wsId, opts) {
    const body = { workspace_id: wsId, ...opts };
    if (this.nick && !body.creator) body.creator = this.nick;
    const result = await this._request("POST", "iterations", undefined, body);
    const iterId = result?.data?.Iteration?.id || "";
    return { url: `${this.tapdBaseUrl}/${wsId}/prong/iterations/card_view/${iterId}`, data: result };
  }

  async updateIteration(wsId, opts) {
    const body = { workspace_id: wsId, ...opts };
    if (this.nick && !body.current_user) body.current_user = this.nick;
    return this._request("POST", "iterations", undefined, body);
  }

  // ────────── 评论 ──────────

  async getComments(wsId, opts) { return this._request("GET", "comments", { workspace_id: wsId, page: 1, limit: 10, ...opts }); }

  async createComment(wsId, opts) {
    const body = { workspace_id: wsId, ...opts };
    this.expandIds(body, "entry_id");
    if (this.nick && !body.author) body.author = this.nick;
    if (body.description) body.description = mdToHtml(body.description);
    return this._request("POST", "comments", undefined, body);
  }

  async updateComment(wsId, opts) {
    const body = { workspace_id: wsId, ...opts };
    if (this.nick && !body.change_creator) body.change_creator = this.nick;
    if (body.description) body.description = mdToHtml(body.description);
    return this._request("POST", "comments", undefined, body);
  }

  // ────────── 工作流 ──────────

  async getWorkflowTransitions(wsId, opts) {
    let url = `workflows/all_transitions?workspace_id=${wsId}&system=${opts.system || "story"}`;
    if (opts.workitem_type_id) url += `&workitem_type_id=${opts.workitem_type_id}`;
    return this._request("GET", url);
  }

  async getWorkflowStatusMap(wsId, opts) {
    let url = `workflows/status_map?workspace_id=${wsId}&system=${opts.system || "story"}`;
    if (opts.workitem_type_id) url += `&workitem_type_id=${opts.workitem_type_id}`;
    return this._request("GET", url);
  }

  async getWorkflowLastSteps(wsId, opts) {
    let url = `workflows/last_steps?workspace_id=${wsId}&system=${opts.system || "story"}`;
    if (opts.workitem_type_id) url += `&workitem_type_id=${opts.workitem_type_id}`;
    if (opts.type) url += `&type=${opts.type}`;
    return this._request("GET", url);
  }

  // ────────── Wiki ──────────

  async getWiki(wsId, opts) {
    const params = { workspace_id: wsId, page: 1, limit: 30, ...opts };
    const data = await this._request("GET", "tapd_wikis", params);
    const count = await this._request("GET", "tapd_wikis/count", params);
    return { base_url: this.tapdBaseUrl, data, count };
  }

  async createWiki(wsId, opts) {
    const body = { workspace_id: wsId, ...opts };
    if (this.nick && !body.creator) body.creator = this.nick;
    return { base_url: this.tapdBaseUrl, data: await this._request("POST", "tapd_wikis", undefined, body) };
  }

  async updateWiki(wsId, opts) {
    const body = { workspace_id: wsId, ...opts };
    if (this.nick && !body.modifier) body.modifier = this.nick;
    return { base_url: this.tapdBaseUrl, data: await this._request("POST", "tapd_wikis", undefined, body) };
  }

  // ────────── 测试用例 ──────────

  async getTcases(wsId, opts) {
    const params = { workspace_id: wsId, page: 1, limit: 30, ...opts };
    const data = await this._request("GET", "tcases", params);
    const count = await this._request("GET", "tcases/count", params);
    return { base_url: this.tapdBaseUrl, data, count };
  }

  async createTcase(wsId, opts) {
    const body = { workspace_id: wsId, ...opts };
    if (this.nick && !body.creator) body.creator = this.nick;
    for (const f of ["precondition", "steps", "expectation"]) { if (body[f]) body[f] = mdToHtml(body[f]); }
    return this._request("POST", "tcases", undefined, body);
  }

  async createTcasesBatch(wsId, opts) {
    const tcases = opts.tcases || [];
    if (!tcases.length) return { status: 0, info: "tcases list is empty" };
    if (tcases.length > 200) return { status: 0, info: "每次新增最大为两百" };
    for (const tc of tcases) {
      if (!tc.workspace_id) tc.workspace_id = wsId;
      if (this.nick && !tc.creator) tc.creator = this.nick;
      for (const f of ["precondition", "steps", "expectation"]) { if (tc[f]) tc[f] = mdToHtml(tc[f]); }
    }
    return this._request("POST", "tcases/batch_save", undefined, tcases);
  }

  // ────────── 待办 ──────────

  async getTodo(wsId, entityType, limit = 10, page = 1) {
    const map = {
      story: ["user_oauth/get_user_todo_story", "id,name,workspace_id,creator,status,priority"],
      bug: ["user_oauth/get_user_todo_bug", "id,title,project_id,reporter,status,priority"],
      task: ["user_oauth/get_user_todo_task", "id,name,workspace_id,creator,status,priority"],
    };
    if (!map[entityType]) return { status: 0, info: `不支持的 entity_type: ${entityType}` };
    const [ep, fields] = map[entityType];
    return this._request("GET", ep, { workspace_id: wsId, limit, page, fields });
  }

  // ────────── 关联关系 ──────────

  async getRelatedBugs(wsId, opts) { return this._request("GET", "stories/get_related_bugs", { workspace_id: wsId, ...opts }); }
  async addEntityRelations(wsId, opts) { return this._request("POST", "relations", undefined, { workspace_id: wsId, ...opts }); }

  // ────────── 图片/附件 ──────────

  async getImage(wsId, opts) { return this._request("GET", "files/get_image", { workspace_id: wsId, ...opts }); }

  async getAttachments(wsId, opts) {
    const result = await this._request("GET", "attachments", { workspace_id: wsId, ...opts });
    if (result?.status === 1 && Array.isArray(result.data)) {
      for (const item of result.data) {
        const att = item?.Attachment;
        if (att?.id) {
          try {
            const dl = await this._request("GET", "attachments/down", { id: att.id, workspace_id: wsId });
            const dlData = dl?.data || {};
            att.download_url = (dlData.Attachment || dlData).download_url || null;
          } catch { att.download_url = null; }
        }
      }
    }
    return result;
  }

  // ────────── 工时 ──────────

  async getTimesheets(wsId, opts) { return this._request("GET", "timesheets", { workspace_id: wsId, ...opts }); }

  async addTimesheet(wsId, opts) {
    const body = { workspace_id: wsId, ...opts };
    if (this.nick && !body.owner) body.owner = this.nick;
    return this._request("POST", "timesheets", undefined, body);
  }

  async updateTimesheet(wsId, opts) { return this._request("POST", "timesheets", undefined, { workspace_id: wsId, ...opts }); }

  // ────────── 源码提交关键字 ──────────

  async getCommitMsg(wsId, opts) {
    const params = { workspace_id: wsId, ...opts };
    this.expandIds(params, "object_id");
    return this._request("GET", "svn_commits/get_scm_copy_keywords", params);
  }

  // ────────── 发布计划 ──────────

  async getReleaseInfo(wsId, opts) { return this._request("GET", "releases", { workspace_id: wsId, ...opts }); }

  // ────────── 企业微信消息 ──────────

  async sendMessage(msg) {
    if (!this.botUrl) return JSON.stringify({ status: 0, info: "未配置 BOT_URL 环境变量" });
    const payload = msg.includes("@")
      ? { msgtype: "markdown", markdown: { content: msg } }
      : { msgtype: "markdown_v2", markdown_v2: { content: msg } };
    const u = new URL(this.botUrl);
    const mod = u.protocol === "https:" ? https : http;
    return new Promise((resolve, reject) => {
      const req = mod.request(
        { hostname: u.hostname, port: u.port, path: u.pathname + u.search, method: "POST", headers: { "Content-Type": "application/json" }, timeout: 500000 },
        (res) => { const chunks = []; res.on("data", (c) => chunks.push(c)); res.on("end", () => resolve(Buffer.concat(chunks).toString())); }
      );
      req.on("error", reject);
      req.write(JSON.stringify(payload));
      req.end();
    });
  }
}

// ────────── CLI 解析 ──────────

function parseArgs(argv) {
  const args = {};
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith("--")) {
      const key = argv[i].slice(2);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith("--")) {
        args[key] = next;
        i++;
      } else {
        args[key] = true;
      }
    } else {
      positional.push(argv[i]);
    }
  }
  return { command: positional[0], args };
}

function die(msg) {
  process.stderr.write(msg + "\n");
  process.exit(1);
}

function output(data) {
  process.stdout.write(JSON.stringify(data, null, 2) + "\n");
}

const USAGE = `TAPD CLI - Node.js

用法: node tapd.js <command> [--参数名 值 ...]

命令:
  projects, workspace-info,
  get-stories, get-story-count, create-story, update-story,
  fields-label, fields-info, custom-fields, workitem-types,
  get-bugs, get-bug-count, create-bug, update-bug,
  get-iterations, create-iteration, update-iteration,
  get-comments, create-comment, update-comment,
  workflow-transitions, workflow-status-map, workflow-last-steps,
  get-wiki, create-wiki, update-wiki,
  get-tcases, create-tcase, create-tcases-batch,
  get-todo, related-bugs, entity-relations,
  get-image, get-attachments,
  get-timesheets, add-timesheet, update-timesheet,
  commit-msg, release-info, send-message`;

async function main() {
  const { command, args } = parseArgs(process.argv.slice(2));

  if (!command || args.help || args.h) {
    console.log(USAGE);
    process.exit(command ? 0 : 1);
  }

  const client = new TAPDClient();
  await client.init();

  const wsId = args["workspace-id"] ? parseInt(args["workspace-id"], 10) : null;
  const opts = args.options ? JSON.parse(args.options) : {};

  const needWs = (cmd) => { if (!wsId) die(`命令 ${cmd} 需要 --workspace-id 参数`); };

  try {
    switch (command) {
      case "projects":
        output(await client.getProjects(args.nick || client.nick || ""));
        break;
      case "workspace-info":
        needWs(command); output(await client.getWorkspaceInfo(wsId));
        break;
      case "get-stories":
        needWs(command); output(await client.getStories(wsId, opts));
        break;
      case "get-story-count":
        needWs(command); output(await client.getStoryCount(wsId, opts));
        break;
      case "create-story":
        needWs(command); if (!args.name) die("create-story 需要 --name 参数");
        output(await client.createStory(wsId, args.name, opts));
        break;
      case "update-story":
        needWs(command); output(await client.updateStory(wsId, opts));
        break;
      case "fields-label":
        needWs(command); output(await client.getFieldsLabel(wsId));
        break;
      case "fields-info":
        needWs(command); output(await client.getFieldsInfo(wsId));
        break;
      case "custom-fields":
        needWs(command); output(await client.getCustomFields(wsId, opts.entity_type ? opts : { entity_type: "stories" }));
        break;
      case "workitem-types":
        needWs(command); output(await client.getWorkitemTypes(wsId, opts));
        break;
      case "get-bugs":
        needWs(command); output(await client.getBugs(wsId, opts));
        break;
      case "get-bug-count":
        needWs(command); output(await client.getBugCount(wsId, opts));
        break;
      case "create-bug":
        needWs(command); if (!args.title) die("create-bug 需要 --title 参数");
        output(await client.createBug(wsId, args.title, opts));
        break;
      case "update-bug":
        needWs(command); output(await client.updateBug(wsId, opts));
        break;
      case "get-iterations":
        needWs(command); output(await client.getIterations(wsId, opts));
        break;
      case "create-iteration":
        needWs(command); output(await client.createIteration(wsId, opts));
        break;
      case "update-iteration":
        needWs(command); output(await client.updateIteration(wsId, opts));
        break;
      case "get-comments":
        needWs(command); output(await client.getComments(wsId, opts));
        break;
      case "create-comment":
        needWs(command); output(await client.createComment(wsId, opts));
        break;
      case "update-comment":
        needWs(command); output(await client.updateComment(wsId, opts));
        break;
      case "workflow-transitions":
        needWs(command); output(await client.getWorkflowTransitions(wsId, opts));
        break;
      case "workflow-status-map":
        needWs(command); output(await client.getWorkflowStatusMap(wsId, opts));
        break;
      case "workflow-last-steps":
        needWs(command); output(await client.getWorkflowLastSteps(wsId, opts));
        break;
      case "get-wiki":
        needWs(command); output(await client.getWiki(wsId, opts));
        break;
      case "create-wiki":
        needWs(command); output(await client.createWiki(wsId, opts));
        break;
      case "update-wiki":
        needWs(command); output(await client.updateWiki(wsId, opts));
        break;
      case "get-tcases":
        needWs(command); output(await client.getTcases(wsId, opts));
        break;
      case "create-tcase":
        needWs(command); output(await client.createTcase(wsId, opts));
        break;
      case "create-tcases-batch":
        needWs(command); output(await client.createTcasesBatch(wsId, opts));
        break;
      case "get-todo":
        needWs(command); if (!args["entity-type"]) die("get-todo 需要 --entity-type 参数");
        output(await client.getTodo(wsId, args["entity-type"], parseInt(args.limit || "10", 10), parseInt(args.page || "1", 10)));
        break;
      case "related-bugs":
        needWs(command); output(await client.getRelatedBugs(wsId, opts));
        break;
      case "entity-relations":
        needWs(command); output(await client.addEntityRelations(wsId, opts));
        break;
      case "get-image":
        needWs(command); output(await client.getImage(wsId, opts));
        break;
      case "get-attachments":
        needWs(command); output(await client.getAttachments(wsId, opts));
        break;
      case "get-timesheets":
        needWs(command); output(await client.getTimesheets(wsId, opts));
        break;
      case "add-timesheet":
        needWs(command); output(await client.addTimesheet(wsId, opts));
        break;
      case "update-timesheet":
        needWs(command); output(await client.updateTimesheet(wsId, opts));
        break;
      case "commit-msg":
        needWs(command); output(await client.getCommitMsg(wsId, opts));
        break;
      case "release-info":
        needWs(command); output(await client.getReleaseInfo(wsId, opts));
        break;
      case "send-message":
        if (!args.msg) die("send-message 需要 --msg 参数");
        console.log(await client.sendMessage(args.msg));
        break;
      default:
        console.log(USAGE);
        die(`未知命令: ${command}`);
    }
  } catch (e) {
    output({ status: 0, error: e.message });
    process.exit(1);
  }
}

main();
