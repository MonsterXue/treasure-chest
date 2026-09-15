import type { Browser } from "wxt/browser";

export const SYNC_RULES_KEY = "cookie-sync:rules:v1";
export const SYNC_REPORT_PREFIX = "cookie-sync:report:";
export const SYNC_FLOW_PREFIX = "cookie-sync:flow:";
export const SYNC_RULE_ID_START = 80000;
export const MAX_SYNC_RULES = 50;
export const FLOW_TTL = 20 * 60 * 1000;

export interface CookieSelector {
  name: string;
  domain?: string;
  path?: string;
}

export interface CookieSyncRule {
  id: string;
  name: string;
  enabled: boolean;
  sourceUrl: string;
  targetUrl: string;
  cookies: CookieSelector[];
  cookieChanges: boolean;
  navigation: "off" | "visit" | "login";
  loginUrl: string;
  httpMode: "preserve" | "adapt";
  pathMode: "preserve" | "root";
}

export type SyncTrigger = "manual" | "change" | "visit" | "login";
export interface SyncReport {
  at: number;
  status: "success" | "error" | "skipped";
  trigger: SyncTrigger;
  copied: number;
  unchanged: number;
  message: string;
  details: string[];
}

export interface SyncOverview {
  rules: CookieSyncRule[];
  reports: Record<string, SyncReport>;
  navigationSupported: boolean;
}

export interface CookieChoice extends CookieSelector {
  domain: string;
  path: string;
  secure: boolean;
  httpOnly: boolean;
}

export interface GateResult {
  proceed: boolean;
  targetUrl: string;
  ruleName: string;
  report?: SyncReport;
}

export function httpUrl(value: unknown, label = "地址"): URL {
  if (typeof value !== "string" || value.length > 8192)
    throw new Error(`${label}格式不正确`);
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new Error(`${label}需要包含 http:// 或 https://`);
  }
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password
  ) {
    throw new Error(`${label}仅支持不含用户名和密码的 HTTP / HTTPS 地址`);
  }
  return url;
}

export function matchesPage(value: string, pattern: string): boolean {
  try {
    const url = httpUrl(value);
    const prefix = httpUrl(pattern);
    const path = prefix.pathname.replace(/\/$/, "");
    return (
      url.origin === prefix.origin &&
      (!path || url.pathname === path || url.pathname.startsWith(`${path}/`)) &&
      (!prefix.search || url.search === prefix.search) &&
      (!prefix.hash || url.hash.startsWith(prefix.hash))
    );
  } catch {
    return false;
  }
}

export function selectorKey(cookie: CookieSelector): string {
  return JSON.stringify([cookie.name, cookie.domain ?? "", cookie.path ?? ""]);
}

export function matchesCookie(
  cookie: Browser.cookies.Cookie,
  selector: CookieSelector,
): boolean {
  return (
    cookie.name === selector.name &&
    (selector.domain === undefined || cookie.domain === selector.domain) &&
    (selector.path === undefined || cookie.path === selector.path)
  );
}

export function normalizeRule(input: unknown): CookieSyncRule {
  if (!input || typeof input !== "object") throw new Error("规则格式不正确");
  const value = input as Record<string, unknown>;
  const source = httpUrl(value.sourceUrl, "来源地址");
  const target = httpUrl(value.targetUrl, "目标地址");
  if (source.hostname === target.hostname) {
    throw new Error(
      "来源和目标需要使用不同主机名；同一主机的不同端口共享 Cookie",
    );
  }
  if (target.search || target.hash)
    throw new Error(
      "目标匹配地址请填写站点或路径前缀，不要填写查询参数和 hash",
    );
  const name = typeof value.name === "string" ? value.name.trim() : "";
  if (!name || name.length > 80) throw new Error("请输入 1–80 字的规则名称");
  if (!["off", "visit", "login"].includes(String(value.navigation)))
    throw new Error("请选择访问时的同步方式");
  if (!["preserve", "adapt"].includes(String(value.httpMode)))
    throw new Error("HTTP 兼容设置不正确");
  if (!["preserve", "root"].includes(String(value.pathMode)))
    throw new Error("Cookie 路径设置不正确");
  if (
    !Array.isArray(value.cookies) ||
    !value.cookies.length ||
    value.cookies.length > 100
  ) {
    throw new Error("请选择或填写 1–100 个 Cookie");
  }
  const cookies: CookieSelector[] = value.cookies.map((item) => {
    if (
      !item ||
      typeof item.name !== "string" ||
      !item.name ||
      /[\s;=\x00-\x1f\x7f]/.test(item.name)
    ) {
      throw new Error("Cookie 名称格式不正确");
    }
    const selector: CookieSelector = { name: item.name };
    if (item.domain !== undefined) {
      if (
        typeof item.domain !== "string" ||
        !item.domain ||
        /[\s/]/.test(item.domain)
      )
        throw new Error("Cookie 域格式不正确");
      const host = item.domain.replace(/^\./, "").toLowerCase();
      if (source.hostname !== host && !source.hostname.endsWith(`.${host}`))
        throw new Error("所选 Cookie 不属于来源站点");
      selector.domain = item.domain;
    }
    if (item.path !== undefined) {
      if (typeof item.path !== "string" || !item.path.startsWith("/"))
        throw new Error("Cookie 路径需要以 / 开头");
      selector.path = item.path;
    }
    return selector;
  });
  const loginUrl =
    value.navigation === "login"
      ? httpUrl(value.loginUrl, "登录页面地址").href
      : "";
  if (loginUrl && matchesPage(loginUrl, target.href))
    throw new Error("登录页面不能位于目标匹配范围内");
  return {
    id:
      typeof value.id === "string" && /^[a-zA-Z0-9-]{1,80}$/.test(value.id)
        ? value.id
        : crypto.randomUUID(),
    name,
    sourceUrl: source.href,
    targetUrl: target.href,
    cookies: [
      ...new Map(cookies.map((item) => [selectorKey(item), item])).values(),
    ],
    enabled: value.enabled === true,
    cookieChanges: value.cookieChanges === true,
    navigation: value.navigation as CookieSyncRule["navigation"],
    loginUrl,
    httpMode: value.httpMode as CookieSyncRule["httpMode"],
    pathMode: value.pathMode as CookieSyncRule["pathMode"],
  };
}

export function validateRuleSet(rules: CookieSyncRule[]): void {
  if (rules.length > MAX_SYNC_RULES)
    throw new Error(`最多保存 ${MAX_SYNC_RULES} 条规则`);
  if (new Set(rules.map((rule) => rule.id)).size !== rules.length)
    throw new Error("规则 ID 重复");
  const enabled = rules.filter((rule) => rule.enabled);
  for (let i = 0; i < enabled.length; i++) {
    for (const other of enabled.slice(i + 1)) {
      const rule = enabled[i];
      if (
        rule.navigation !== "off" &&
        other.navigation !== "off" &&
        (matchesPage(rule.targetUrl, other.targetUrl) ||
          matchesPage(other.targetUrl, rule.targetUrl))
      ) {
        throw new Error(
          `“${rule.name}”和“${other.name}”的自动访问范围重叠，请停用其中一条或缩小路径范围`,
        );
      }
      if (
        httpUrl(rule.targetUrl).hostname ===
          httpUrl(other.targetUrl).hostname &&
        rule.cookies.some((cookie) =>
          other.cookies.some((item) => item.name === cookie.name),
        )
      ) {
        throw new Error(
          `“${rule.name}”和“${other.name}”会写入同一主机的同名 Cookie，请只启用一条`,
        );
      }
    }
  }
  // Reject automatic cycles even when cookie selectors differ: aliases/parent domains can overlap.
  const edges = new Map<string, string[]>();
  for (const rule of enabled.filter(
    (rule) => rule.cookieChanges || rule.navigation !== "off",
  )) {
    const source = httpUrl(rule.sourceUrl).hostname;
    edges.set(source, [
      ...(edges.get(source) ?? []),
      httpUrl(rule.targetUrl).hostname,
    ]);
  }
  const visit = (host: string, path: Set<string>) => {
    if (path.has(host)) throw new Error("自动同步规则形成循环，请保持单向同步");
    const nextPath = new Set(path).add(host);
    for (const target of edges.get(host) ?? []) visit(target, nextPath);
  };
  for (const host of edges.keys()) visit(host, new Set());
}

export function targetCookieDetails(
  rule: CookieSyncRule,
  cookie: Browser.cookies.Cookie,
  storeId: string,
) {
  const target = httpUrl(rule.targetUrl);
  const adapt = target.protocol === "http:" && rule.httpMode === "adapt";
  if (adapt && /^__(Secure|Host|Http)-/.test(cookie.name)) {
    throw new Error(
      `${cookie.name} 带有安全前缀，请使用 HTTPS 目标并保留安全属性`,
    );
  }
  const path = rule.pathMode === "root" ? "/" : cookie.path;
  return {
    url: `${target.origin}${path}`,
    name: cookie.name,
    value: cookie.value,
    path,
    secure: adapt ? false : cookie.secure,
    httpOnly: cookie.httpOnly,
    sameSite:
      adapt && cookie.sameSite === "no_restriction"
        ? ("lax" as const)
        : cookie.sameSite,
    ...(cookie.session ? {} : { expirationDate: cookie.expirationDate }),
    storeId,
    // Deliberately omit domain: create a host-only cookie on the selected target.
  };
}

export function cookieEquivalent(
  cookie: Browser.cookies.Cookie,
  details: ReturnType<typeof targetCookieDetails>,
): boolean {
  return (
    cookie.hostOnly &&
    cookie.name === details.name &&
    cookie.value === details.value &&
    cookie.path === details.path &&
    cookie.secure === details.secure &&
    cookie.httpOnly === details.httpOnly &&
    cookie.sameSite === details.sameSite &&
    cookie.session === (details.expirationDate === undefined) &&
    (cookie.session ||
      Math.abs((cookie.expirationDate ?? 0) - (details.expirationDate ?? 0)) <
        1)
  );
}

export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function buildNavigationRules(
  rules: CookieSyncRule[],
  extensionUrl: string,
): Browser.declarativeNetRequest.Rule[] {
  return rules
    .filter((rule) => rule.enabled && rule.navigation !== "off")
    .map((rule, index) => {
      const target = httpUrl(rule.targetUrl);
      const path = target.pathname.replace(/\/$/, "");
      const prefix = escapeRegex(`${target.origin}${path}`);
      return {
        id: SYNC_RULE_ID_START + index,
        priority: 1,
        action: {
          type: "redirect",
          redirect: {
            regexSubstitution: `${extensionUrl}cookie-sync-gate.html?rule=${rule.id}&url=\\0`,
          },
        },
        condition: {
          regexFilter: `^${prefix}(?:[/?#].*)?$`,
          resourceTypes: ["main_frame"],
          requestMethods: ["get"],
        },
      };
    });
}

export function parseGateLocation(value: string): {
  ruleId: string;
  targetUrl: string;
} {
  const url = new URL(value);
  const match = /^\?rule=([a-zA-Z0-9-]+)&url=(https?:\/\/.*)$/.exec(url.search);
  if (!match) throw new Error("同步入口地址不完整，请重新打开目标网站");
  return {
    ruleId: match[1],
    targetUrl: httpUrl(`${match[2]}${url.hash}`, "返回地址").href,
  };
}

export async function syncRequest<T>(
  action: string,
  payload: Record<string, unknown> = {},
): Promise<T> {
  const response = await browser.runtime.sendMessage({
    type: "cookie-sync",
    action,
    ...payload,
  });
  if (!response?.ok)
    throw new Error(response?.error || "插件后台未响应，请重新加载插件后重试");
  return response.data as T;
}
