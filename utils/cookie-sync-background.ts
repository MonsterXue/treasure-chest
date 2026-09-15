import { browser, type Browser } from "wxt/browser";
import {
  SYNC_RULES_KEY,
  SYNC_REPORT_PREFIX,
  SYNC_FLOW_PREFIX,
  SYNC_RULE_ID_START,
  MAX_SYNC_RULES,
  FLOW_TTL,
  buildNavigationRules,
  cookieEquivalent,
  httpUrl,
  matchesCookie,
  matchesPage,
  normalizeRule,
  parseGateLocation,
  targetCookieDetails,
  escapeRegex,
  validateRuleSet,
  type CookieSyncRule,
  type GateResult,
  type SyncOverview,
  type SyncReport,
  type SyncTrigger,
} from "./cookie-sync";

interface Flow {
  targetUrl: string;
  seenAt: number;
  armedAt?: number;
  attempts: number[];
}
type TabFlows = Record<string, Flow>;

/** Each key has one writer; a failed job must not poison the next job. */
export function createQueue() {
  const queues = new Map<string, Promise<unknown>>();
  return <T>(key: string, task: () => Promise<T>): Promise<T> => {
    const previous = queues.get(key) ?? Promise.resolve();
    const next = previous.catch(() => {}).then(task);
    queues.set(key, next);
    void next
      .finally(() => {
        if (queues.get(key) === next) queues.delete(key);
      })
      .catch(() => {});
    return next;
  };
}

export function registerCookieSync() {
  const configQueue = createQueue();
  const targetQueue = createQueue();
  const tabQueue = createQueue();
  const baseUrl = browser.runtime.getURL("/");
  const managerUrl = browser.runtime.getURL("/cookie-sync.html");
  const gateUrl = browser.runtime.getURL("/cookie-sync-gate.html");
  const canNavigate = Boolean(
    browser.declarativeNetRequest?.updateDynamicRules,
  );
  const resumes = new Map<number, string>();
  const withoutHash = (url: string) => url.split("#")[0];
  const clearResume = async (tabId: number) => {
    if (!resumes.has(tabId)) return;
    await browser.declarativeNetRequest.updateSessionRules({
      removeRuleIds: [tabId + 1],
    });
    resumes.delete(tabId);
  };
  const allowResume = async (tabId: number, targetUrl: string) => {
    const url = withoutHash(targetUrl);
    await browser.declarativeNetRequest.updateSessionRules({
      removeRuleIds: [tabId + 1],
      addRules: [
        {
          id: tabId + 1,
          priority: 100,
          action: { type: "allow" },
          condition: {
            tabIds: [tabId],
            regexFilter: `^${escapeRegex(url)}(?:#.*)?$`,
            initiatorDomains: [browser.runtime.id],
            resourceTypes: ["main_frame"],
            requestMethods: ["get"],
          },
        },
      ],
    });
    resumes.set(tabId, url);
  };

  const readRules = async (): Promise<CookieSyncRule[]> => {
    const stored = (await browser.storage.local.get(SYNC_RULES_KEY))[
      SYNC_RULES_KEY
    ];
    return Array.isArray(stored) ? stored.map(normalizeRule) : [];
  };

  const installNavigation = async (rules: CookieSyncRule[]) => {
    if (!canNavigate) {
      if (rules.some((rule) => rule.enabled && rule.navigation !== "off"))
        throw new Error(
          "当前浏览器不支持访问前同步，请使用 Chrome 或关闭此模式",
        );
      return;
    }
    const newRules = buildNavigationRules(rules, baseUrl);
    for (const rule of newRules) {
      const result = await browser.declarativeNetRequest.isRegexSupported({
        regex: rule.condition.regexFilter!,
        requireCapturing: true,
      });
      if (!result.isSupported)
        throw new Error("目标地址过于复杂，无法创建访问规则，请缩短路径前缀");
    }
    const existing = await browser.declarativeNetRequest.getDynamicRules();
    await browser.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: existing
        .filter(
          (rule) =>
            rule.id >= SYNC_RULE_ID_START &&
            rule.id < SYNC_RULE_ID_START + MAX_SYNC_RULES,
        )
        .map((rule) => rule.id),
      addRules: newRules,
    });
  };

  const replaceRules = async (next: CookieSyncRule[]) => {
    validateRuleSet(next);
    const previous = await readRules();
    await installNavigation(next);
    try {
      await browser.storage.local.set({ [SYNC_RULES_KEY]: next });
    } catch (error) {
      await installNavigation(previous);
      throw error;
    }
  };

  const ready = readRules()
    .then(installNavigation)
    .then(async () => {
      if (!canNavigate) return;
      // Drop unfinished one-navigation passes when this worker is restarted.
      const stale = (
        await browser.declarativeNetRequest.getSessionRules()
      ).filter(
        (rule) =>
          rule.priority === 100 &&
          rule.action.type === "allow" &&
          rule.condition.initiatorDomains?.includes(browser.runtime.id),
      );
      if (stale.length)
        await browser.declarativeNetRequest.updateSessionRules({
          removeRuleIds: stale.map((rule) => rule.id),
        });
    });
  // Keep a rejected initialization observable by requests, without an unhandled rejection.
  void ready.catch(() => {});

  const report = async (id: string, result: SyncReport) => {
    await browser.storage.local.set({ [`${SYNC_REPORT_PREFIX}${id}`]: result });
    return result;
  };

  const cookieStoreForTab = async (tabId?: number): Promise<string> => {
    const stores = await browser.cookies.getAllCookieStores();
    const store =
      tabId === undefined
        ? stores[0]
        : stores.find((item) => item.tabIds.includes(tabId));
    if (!store)
      throw new Error("无法确定当前窗口的 Cookie 存储，请重新打开工具页面");
    return store.id;
  };

  const runSync = async (
    ruleId: string,
    trigger: SyncTrigger,
    storeId: string,
  ): Promise<SyncReport> => {
    const initial = (await readRules()).find((rule) => rule.id === ruleId);
    if (!initial) throw new Error("同步规则已删除");
    return targetQueue(
      `${storeId}:${httpUrl(initial.targetUrl).hostname}`,
      async () => {
        const rule = (await readRules()).find((item) => item.id === ruleId);
        if (!rule || (trigger !== "manual" && !rule.enabled))
          throw new Error("同步规则已停用或删除");
        const result: SyncReport = {
          at: Date.now(),
          status: "success",
          trigger,
          copied: 0,
          unchanged: 0,
          message: "",
          details: [],
        };
        try {
          const source = await browser.cookies.getAll({
            url: rule.sourceUrl,
            storeId,
          });
          const missing = rule.cookies.filter(
            (selector) =>
              !source.some((cookie) => matchesCookie(cookie, selector)),
          );
          if (missing.length) {
            result.status =
              missing.length === rule.cookies.length ? "skipped" : "error";
            result.message =
              missing.length === rule.cookies.length
                ? "来源站点尚无所选 Cookie，请先登录来源网站"
                : "来源 Cookie 不完整，本次未写入";
            result.details = missing.map((item) => `未找到：${item.name}`);
            return await report(rule.id, result);
          }
          const cookies = source.filter((cookie) =>
            rule.cookies.some((selector) => matchesCookie(cookie, selector)),
          );
          if (cookies.some((cookie) => cookie.partitionKey))
            throw new Error("第一版仅支持未分区 Cookie，请重新选择来源 Cookie");
          const writes = cookies.map((cookie) =>
            targetCookieDetails(rule, cookie, storeId),
          );
          const identities = writes.map((item) =>
            JSON.stringify([item.name, item.path]),
          );
          if (new Set(identities).size !== identities.length)
            throw new Error(
              "多个来源 Cookie 会覆盖同一个目标 Cookie，请按域和路径精确选择",
            );
          const completed: Array<{
            details: (typeof writes)[number];
            previous?: Browser.cookies.Cookie;
          }> = [];
          try {
            for (const details of writes) {
              const existing = await browser.cookies.getAll({
                url: details.url,
                name: details.name,
                storeId,
              });
              const previous = existing.find(
                (cookie) =>
                  cookie.domain === httpUrl(rule.targetUrl).hostname &&
                  cookie.hostOnly &&
                  cookie.path === details.path,
              );
              if (previous && cookieEquivalent(previous, details)) {
                result.unchanged++;
                continue;
              }
              try {
                const saved = await browser.cookies.set(details);
                completed.push({ details, previous });
                if (!saved || !cookieEquivalent(saved, details))
                  throw new Error("verify");
                const confirmed = await browser.cookies.getAll({
                  url: details.url,
                  name: details.name,
                  storeId,
                });
                if (
                  !confirmed.some(
                    (cookie) =>
                      cookieEquivalent(cookie, details) &&
                      cookie.domain === httpUrl(rule.targetUrl).hostname,
                  )
                )
                  throw new Error("verify");
                result.copied++;
              } catch {
                throw new Error(
                  `${details.name} 写入或校验失败，请检查目标协议、Cookie 安全属性及站点权限`,
                );
              }
            }
          } catch (error) {
            let rollbackFailed = false;
            for (const { details, previous } of completed.reverse()) {
              try {
                if (previous) {
                  await browser.cookies.set({
                    url: details.url,
                    name: previous.name,
                    value: previous.value,
                    path: previous.path,
                    httpOnly: previous.httpOnly,
                    secure: previous.secure,
                    sameSite: previous.sameSite,
                    ...(previous.session
                      ? {}
                      : { expirationDate: previous.expirationDate }),
                    storeId,
                  });
                } else {
                  await browser.cookies.remove({
                    url: details.url,
                    name: details.name,
                    storeId,
                  });
                }
              } catch {
                rollbackFailed = true;
              }
            }
            result.copied = 0;
            if (rollbackFailed)
              result.details.push(
                "部分 Cookie 未能恢复，请用 Cookie 工具检查目标站点",
              );
            throw error;
          }
          result.message = result.copied
            ? `已同步 ${result.copied} 个 Cookie${result.unchanged ? `，${result.unchanged} 个无需更新` : ""}`
            : `${result.unchanged} 个 Cookie 已是最新`;
        } catch (error) {
          result.status = "error";
          result.message =
            error instanceof Error ? error.message : "同步失败，请检查规则配置";
        }
        return report(rule.id, result);
      },
    );
  };

  const readFlows = async (tabId: number): Promise<TabFlows> => {
    return (
      ((await browser.storage.session.get(`${SYNC_FLOW_PREFIX}${tabId}`))[
        `${SYNC_FLOW_PREFIX}${tabId}`
      ] as TabFlows) ?? {}
    );
  };
  const writeFlows = (tabId: number, flows: TabFlows) =>
    browser.storage.session.set({ [`${SYNC_FLOW_PREFIX}${tabId}`]: flows });

  // Register synchronously so MV3 can wake the worker for each navigation.
  const trackNavigation = (
    details: { frameId: number; tabId: number; url: string },
    observeTarget = true,
    committed = false,
  ) => {
    if (details.frameId !== 0 || !/^https?:/.test(details.url)) return;
    void tabQueue(String(details.tabId), async () => {
      await ready;
      if (
        resumes.has(details.tabId) &&
        (committed || resumes.get(details.tabId) !== withoutHash(details.url))
      )
        await clearResume(details.tabId);
      const rules = (await readRules()).filter(
        (rule) => rule.enabled && rule.navigation !== "off",
      );
      if (
        !rules.some(
          (rule) =>
            (observeTarget && matchesPage(details.url, rule.targetUrl)) ||
            (rule.navigation === "login" &&
              matchesPage(details.url, rule.loginUrl)),
        )
      )
        return;
      const flows = await readFlows(details.tabId);
      const now = Date.now();
      for (const rule of rules) {
        const flow = flows[rule.id];
        if (observeTarget && matchesPage(details.url, rule.targetUrl)) {
          flows[rule.id] = {
            targetUrl: details.url,
            seenAt: now,
            armedAt:
              flow?.armedAt && now - flow.armedAt < FLOW_TTL
                ? flow.armedAt
                : undefined,
            attempts: flow?.attempts.filter((at) => now - at < 30_000) ?? [],
          };
        } else if (
          rule.navigation === "login" &&
          matchesPage(details.url, rule.loginUrl) &&
          flow &&
          now - flow.seenAt < FLOW_TTL
        ) {
          flow.armedAt = now;
        }
      }
      for (const [id, flow] of Object.entries(flows)) {
        if (
          now - flow.seenAt > FLOW_TTL ||
          !rules.some((rule) => rule.id === id)
        )
          delete flows[id];
      }
      await writeFlows(details.tabId, flows);
    }).catch(() => {});
  };
  browser.webNavigation.onBeforeNavigate.addListener((details) =>
    trackNavigation(details),
  );
  browser.webNavigation.onCommitted.addListener((details) =>
    trackNavigation(details, true, true),
  );
  browser.webNavigation.onHistoryStateUpdated.addListener((details) =>
    trackNavigation(details),
  );
  browser.webNavigation.onReferenceFragmentUpdated.addListener((details) =>
    trackNavigation(details),
  );
  // A 302 chain can pass through the configured login URL without committing a document.
  browser.webRequest.onBeforeRequest.addListener(
    (details) => {
      trackNavigation(details, false);
      return undefined;
    },
    {
      urls: ["http://*/*", "https://*/*"],
      types: ["main_frame"],
    },
  );

  browser.tabs.onRemoved.addListener((tabId) => {
    void tabQueue(String(tabId), async () => {
      await clearResume(tabId);
      await browser.storage.session.remove(`${SYNC_FLOW_PREFIX}${tabId}`);
    }).catch(() => {});
  });
  browser.webNavigation.onErrorOccurred.addListener((details) => {
    if (details.frameId === 0)
      void tabQueue(String(details.tabId), () =>
        clearResume(details.tabId),
      ).catch(() => {});
  });

  const changePending = new Map<string, boolean>();
  browser.cookies.onChanged.addListener((change) => {
    // An overwrite emits a removal followed by an insertion. Deletion mirroring is not enabled.
    if (change.removed) return;
    void (async () => {
      await ready;
      const rules = (await readRules()).filter(
        (rule) =>
          rule.enabled &&
          rule.cookieChanges &&
          rule.cookies.some((selector) =>
            matchesCookie(change.cookie, selector),
          ),
      );
      for (const rule of rules) {
        const host = httpUrl(rule.sourceUrl).hostname;
        const domain = change.cookie.domain.replace(/^\./, "");
        if (
          change.cookie.hostOnly
            ? host !== domain
            : host !== domain && !host.endsWith(`.${domain}`)
        )
          continue;
        const key = `${rule.id}:${change.cookie.storeId}`;
        if (changePending.has(key)) {
          changePending.set(key, true);
          continue;
        }
        try {
          do {
            changePending.set(key, false);
            await runSync(rule.id, "change", change.cookie.storeId);
          } while (changePending.get(key));
        } finally {
          changePending.delete(key);
        }
      }
    })().catch(() => {});
  });

  const handleGate = async (
    sender: Browser.runtime.MessageSender,
    skip: boolean,
  ): Promise<GateResult> => {
    if (sender.tab?.id === undefined || !sender.url?.startsWith(`${gateUrl}?`))
      throw new Error("无效的同步入口");
    const tabId = sender.tab.id;
    const parsed = parseGateLocation(sender.url);
    return tabQueue(String(tabId), async () => {
      const rule = (await readRules()).find(
        (item) => item.id === parsed.ruleId,
      );
      if (!rule) throw new Error("规则已删除，请关闭此页后重新打开目标地址");
      if (!matchesPage(parsed.targetUrl, rule.targetUrl))
        throw new Error("返回地址不属于此规则的目标网站");
      const flows = await readFlows(tabId);
      const previous = flows[rule.id];
      // Navigation events retain the full fragment even on browsers whose DNR matching excludes it.
      let targetUrl = parsed.targetUrl;
      if (previous?.targetUrl && Date.now() - previous.seenAt < 10_000) {
        const observed = httpUrl(previous.targetUrl);
        const current = httpUrl(targetUrl);
        if (
          observed.origin + observed.pathname + observed.search ===
          current.origin + current.pathname + current.search
        )
          targetUrl = observed.href;
      }
      const now = Date.now();
      const flow: Flow = previous ?? { targetUrl, seenAt: now, attempts: [] };
      const armed = Boolean(flow.armedAt && now - flow.armedAt < FLOW_TTL);
      flow.targetUrl = targetUrl;
      flow.seenAt = now;
      flows[rule.id] = flow;
      if (
        skip ||
        !rule.enabled ||
        rule.navigation === "off" ||
        (rule.navigation === "login" && !armed)
      ) {
        flow.armedAt = undefined;
        await writeFlows(tabId, flows);
        await allowResume(tabId, targetUrl);
        return { proceed: true, targetUrl, ruleName: rule.name };
      }
      flow.attempts = flow.attempts.filter((at) => now - at < 30_000);
      if (rule.navigation === "login" && flow.attempts.length >= 3) {
        return {
          proceed: false,
          targetUrl,
          ruleName: rule.name,
          report: await report(rule.id, {
            at: now,
            trigger: rule.navigation,
            status: "error",
            copied: 0,
            unchanged: 0,
            message: "短时间内重复回跳，已停止自动同步",
            details: ["请检查目标应用是否接受这份 Cookie，或等待 30 秒后重试"],
          }),
        };
      }
      flow.attempts.push(now);
      await writeFlows(tabId, flows);
      const result = await runSync(
        rule.id,
        rule.navigation,
        await cookieStoreForTab(tabId),
      );
      const proceed =
        result.status === "success" ||
        (rule.navigation === "visit" && result.status === "skipped");
      if (proceed) flow.armedAt = undefined;
      await writeFlows(tabId, flows);
      if (proceed) await allowResume(tabId, targetUrl);
      return { proceed, targetUrl, ruleName: rule.name, report: result };
    });
  };

  const handleRequest = async (
    message: Record<string, unknown>,
    sender: Browser.runtime.MessageSender,
  ) => {
    await ready;
    if (sender.id !== browser.runtime.id) throw new Error("请求来源不正确");
    if (message.action === "gate" || message.action === "gate-skip")
      return handleGate(sender, message.action === "gate-skip");
    if (sender.url?.split(/[?#]/)[0] !== managerUrl)
      throw new Error("请从 Cookie 同步工具中执行此操作");
    if (message.action === "list") {
      const rules = await readRules();
      const stored = await browser.storage.local.get(
        rules.map((rule) => `${SYNC_REPORT_PREFIX}${rule.id}`),
      );
      return {
        rules,
        navigationSupported: canNavigate,
        reports: Object.fromEntries(
          rules
            .filter((rule) => stored[`${SYNC_REPORT_PREFIX}${rule.id}`])
            .map((rule) => [
              rule.id,
              stored[`${SYNC_REPORT_PREFIX}${rule.id}`] as SyncReport,
            ]),
        ),
      } satisfies SyncOverview;
    }
    if (message.action === "tabs") {
      return (await browser.tabs.query({ currentWindow: true }))
        .filter((tab) => tab.url && /^https?:/.test(tab.url))
        .map((tab) => ({ id: tab.id, title: tab.title, url: tab.url }));
    }
    if (message.action === "cookies") {
      const url = httpUrl(message.url, "来源地址");
      const cookies = await browser.cookies.getAll({
        url: url.href,
        storeId: await cookieStoreForTab(sender.tab?.id),
      });
      return cookies
        .filter((cookie) => !cookie.partitionKey)
        .map(({ name, domain, path, secure, httpOnly }) => ({
          name,
          domain,
          path,
          secure,
          httpOnly,
        }));
    }
    if (message.action === "save")
      return configQueue("config", async () => {
        const rule = normalizeRule(message.rule);
        const rules = await readRules();
        const index = rules.findIndex((item) => item.id === rule.id);
        if (index < 0) rules.push(rule);
        else rules[index] = rule;
        await replaceRules(rules);
        return rule;
      });
    if (message.action === "delete")
      return configQueue("config", async () => {
        await replaceRules(
          (await readRules()).filter((rule) => rule.id !== message.id),
        );
        await browser.storage.local.remove(
          `${SYNC_REPORT_PREFIX}${message.id}`,
        );
        return true;
      });
    if (message.action === "import")
      return configQueue("config", async () => {
        const input = message.rules;
        if (
          !Array.isArray(input) ||
          !input.length ||
          input.length > MAX_SYNC_RULES
        )
          throw new Error("导入文件中没有有效规则，或规则数量超过限制");
        const imported = input.map((item) =>
          normalizeRule({ ...item, id: crypto.randomUUID(), enabled: false }),
        );
        await replaceRules([...(await readRules()), ...imported]);
        return imported.length;
      });
    if (message.action === "run") {
      if (typeof message.id !== "string") throw new Error("请选择同步规则");
      return runSync(
        message.id,
        "manual",
        await cookieStoreForTab(sender.tab?.id),
      );
    }
    throw new Error("不支持的同步操作");
  };

  browser.runtime.onMessage.addListener((message: unknown, sender) => {
    if (
      !message ||
      typeof message !== "object" ||
      (message as { type?: unknown }).type !== "cookie-sync"
    )
      return;
    return handleRequest(message as Record<string, unknown>, sender)
      .then((data) => ({ ok: true, data }))
      .catch((error) => ({
        ok: false,
        error: error instanceof Error ? error.message : "操作失败",
      }));
  });
}
