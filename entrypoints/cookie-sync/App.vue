<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import SyncIcon from "@/assets/sync.svg?url";
import {
  selectorKey,
  syncRequest,
  SYNC_REPORT_PREFIX,
  SYNC_RULES_KEY,
  type CookieChoice,
  type CookieSyncRule,
  type SyncOverview,
  type SyncReport,
} from "@/utils/cookie-sync";

const rules = ref<CookieSyncRule[]>([]);
const reports = ref<Record<string, SyncReport>>({});
const draft = ref<CookieSyncRule>();
const choices = ref<CookieChoice[]>([]);
const tabs = ref<Array<{ title: string; url: string }>>([]);
const error = ref("");
const notice = ref("");
const busy = ref("");
const cookieName = ref("");
const search = ref("");
const canNavigate = ref(true);
const deleteId = ref("");
const fileInput = ref<HTMLInputElement>();
const visibleChoices = computed(() =>
  choices.value.filter((cookie) =>
    `${cookie.name} ${cookie.domain}`
      .toLowerCase()
      .includes(search.value.toLowerCase()),
  ),
);
const modes = {
  off: "手动同步",
  visit: "每次访问前同步",
  login: "仅登录回跳时同步",
};
const triggers = {
  manual: "手动",
  change: "Cookie 更新",
  visit: "访问目标",
  login: "登录回跳",
};

async function refresh() {
  const data = await syncRequest<SyncOverview>("list");
  rules.value = data.rules;
  reports.value = data.reports;
  canNavigate.value = data.navigationSupported;
}

async function act(key: string, task: () => Promise<void>) {
  if (busy.value) return;
  busy.value = key;
  error.value = "";
  notice.value = "";
  try {
    await task();
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : "操作失败";
  } finally {
    busy.value = "";
  }
}

function edit(rule?: CookieSyncRule) {
  draft.value = rule
    ? JSON.parse(JSON.stringify(rule))
    : {
        id: crypto.randomUUID(),
        name: "",
        enabled: true,
        sourceUrl: "",
        targetUrl: "http://localhost:5173/",
        cookies: [],
        cookieChanges: false,
        navigation: "login",
        loginUrl: "",
        httpMode: "adapt",
        pathMode: "preserve",
      };
  choices.value = [];
  cookieName.value = "";
  search.value = "";
  error.value = "";
}

function selected(cookie: CookieChoice) {
  return draft.value?.cookies.some(
    (item) => selectorKey(item) === selectorKey(cookie),
  );
}

function select(cookie: CookieChoice) {
  if (!draft.value) return;
  if (selected(cookie))
    draft.value.cookies = draft.value.cookies.filter(
      (item) => selectorKey(item) !== selectorKey(cookie),
    );
  else
    draft.value.cookies.push({
      name: cookie.name,
      domain: cookie.domain,
      path: cookie.path,
    });
}

function addCookieName() {
  const name = cookieName.value.trim();
  if (
    name &&
    draft.value &&
    !draft.value.cookies.some((item) => item.name === name)
  )
    draft.value.cookies.push({ name });
  cookieName.value = "";
}

function save() {
  void act("save", async () => {
    await syncRequest("save", {
      rule: JSON.parse(JSON.stringify(draft.value)),
    });
    draft.value = undefined;
    await refresh();
    notice.value = "规则已保存，启用的自动同步立即生效";
  });
}

function toggle(rule: CookieSyncRule) {
  void act(rule.id, async () => {
    await syncRequest("save", {
      rule: { ...JSON.parse(JSON.stringify(rule)), enabled: !rule.enabled },
    });
    await refresh();
  });
}

function run(rule: CookieSyncRule) {
  void act(rule.id, async () => {
    const result = await syncRequest<SyncReport>("run", { id: rule.id });
    await refresh();
    if (result.status !== "success")
      error.value = [result.message, ...result.details].join("；");
    else notice.value = result.message;
  });
}

function remove(rule: CookieSyncRule) {
  void act(rule.id, async () => {
    await syncRequest("delete", { id: rule.id });
    deleteId.value = "";
    if (draft.value?.id === rule.id) draft.value = undefined;
    await refresh();
  });
}

function exportRules() {
  const blob = new Blob(
    [JSON.stringify({ version: 1, rules: rules.value }, null, 2)],
    { type: "application/json" },
  );
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "cookie-sync-rules.json";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function importRules(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  void act("import", async () => {
    if (file.size > 512_000) throw new Error("配置文件不能超过 500 KB");
    const data = JSON.parse(await file.text());
    if (data.version !== 1) throw new Error("不支持此配置版本");
    const count = await syncRequest<number>("import", { rules: data.rules });
    await refresh();
    notice.value = `已导入 ${count} 条规则，确认配置后可逐条启用`;
  });
  input.value = "";
}

function onStorageChanged(changes: Record<string, unknown>, area: string) {
  if (
    area === "local" &&
    Object.keys(changes).some(
      (key) => key === SYNC_RULES_KEY || key.startsWith(SYNC_REPORT_PREFIX),
    )
  ) {
    void refresh().catch(() => {});
  }
}

onMounted(() => {
  browser.storage.onChanged.addListener(onStorageChanged);
  void act("load", async () => {
    await refresh();
    tabs.value = await syncRequest("tabs");
  });
});
onUnmounted(() => browser.storage.onChanged.removeListener(onStorageChanged));
</script>

<template>
  <main class="workspace">
    <header class="topbar">
      <div class="brand">
        <img :src="SyncIcon" alt="" />
        <div>
          <span class="eyebrow">百宝箱 / 开发工具</span>
          <h1>Cookie 同步</h1>
        </div>
      </div>
      <div class="toolbar">
        <input
          ref="fileInput"
          type="file"
          accept=".json,application/json"
          hidden
          @change="importRules"
        />
        <button :disabled="!!busy" @click="fileInput?.click()">导入配置</button>
        <button :disabled="!rules.length" @click="exportRules">导出配置</button>
        <button class="primary" :disabled="!!busy" @click="edit()">
          ＋ 新建规则
        </button>
      </div>
    </header>
    <p class="intro">配置来源和目标，让登录 Cookie 自动同步到你的开发环境。</p>
    <div v-if="error" class="feedback error" role="alert">{{ error }}</div>
    <div v-else-if="notice" class="feedback success" role="status">
      {{ notice }}
    </div>
    <div class="layout" :class="{ editing: draft }">
      <section class="rule-list" aria-label="同步规则">
        <div v-if="!rules.length" class="empty">
          <div class="empty-route">
            <span>来源网站</span><b>→</b><span>开发环境</span>
          </div>
          <h2>把重复复制交给规则</h2>
          <p>选择登录 Cookie、填写目标地址，设置你需要的同步时机。</p>
          <button class="primary" @click="edit()">创建第一条规则</button>
        </div>
        <article
          v-for="rule in rules"
          :key="rule.id"
          class="rule-card"
          :class="{ paused: !rule.enabled }"
        >
          <div class="card-title">
            <h2>{{ rule.name }}</h2>
            <button
              class="toggle"
              role="switch"
              :aria-checked="rule.enabled"
              :aria-label="`${rule.name}自动同步`"
              :disabled="!!busy"
              @click="toggle(rule)"
            >
              {{ rule.enabled ? "已启用" : "已停用" }}
            </button>
          </div>
          <div class="route">
            <div>
              <span>来源</span><code>{{ rule.sourceUrl }}</code>
            </div>
            <b>→</b>
            <div>
              <span>目标</span><code>{{ rule.targetUrl }}</code>
            </div>
          </div>
          <div class="badges">
            <span>{{ modes[rule.navigation] }}</span
            ><span v-if="rule.cookieChanges">Cookie 更新时同步</span
            ><span>{{ rule.cookies.length }} 个 Cookie</span>
          </div>
          <div
            v-if="reports[rule.id]"
            class="last-result"
            :class="reports[rule.id].status"
          >
            <p>{{ reports[rule.id].message }}</p>
            <small
              >{{ new Date(reports[rule.id].at).toLocaleString() }} ·
              {{ triggers[reports[rule.id].trigger] }}</small
            >
            <p
              v-for="detail in reports[rule.id].details"
              :key="detail"
              class="result-detail"
            >
              {{ detail }}
            </p>
          </div>
          <div v-else class="last-result">
            <p>尚未执行。可以先手动同步，检查配置。</p>
          </div>
          <footer class="card-actions">
            <button class="primary" :disabled="!!busy" @click="run(rule)">
              {{ busy === rule.id ? "处理中…" : "立即同步" }}
            </button>
            <button @click="browser.tabs.create({ url: rule.targetUrl })">
              打开目标
            </button>
            <button :disabled="!!busy" @click="edit(rule)">编辑</button>
            <template v-if="deleteId === rule.id"
              ><button class="danger" :disabled="!!busy" @click="remove(rule)">
                确认删除</button
              ><button @click="deleteId = ''">取消</button></template
            >
            <button
              v-else
              class="quiet"
              :disabled="!!busy"
              @click="deleteId = rule.id"
            >
              删除
            </button>
          </footer>
        </article>
        <p class="footnote">
          配置保存在当前浏览器。导出文件只包含规则，不包含 Cookie 值。
        </p>
      </section>

      <form v-if="draft" class="editor" @submit.prevent="save">
        <div class="editor-title">
          <h2>
            {{
              rules.some((rule) => rule.id === draft?.id)
                ? "编辑规则"
                : "新建规则"
            }}
          </h2>
          <button
            type="button"
            class="quiet"
            :disabled="!!busy"
            @click="draft = undefined"
          >
            取消
          </button>
        </div>
        <label
          >规则名称<input
            v-model="draft.name"
            required
            maxlength="80"
            placeholder="例如：管理后台本地开发"
        /></label>
        <label
          >Cookie 来源地址<input
            v-model="draft.sourceUrl"
            required
            type="url"
            list="open-tabs"
            placeholder="https://test.example.com/"
            @change="
              choices = [];
              draft.cookies = [];
            "
        /></label>
        <datalist id="open-tabs">
          <option v-for="tab in tabs" :key="tab.url" :value="tab.url">
            {{ tab.title }}
          </option>
        </datalist>
        <label
          >目标地址 / 路径前缀<input
            v-model="draft.targetUrl"
            required
            type="url"
            placeholder="http://localhost:5173/"
        /></label>
        <p class="hint">
          支持不同站点。localhost 的不同端口共享 Cookie，请避免同名覆盖。
        </p>

        <section class="form-section">
          <div class="section-title">
            <h3>同步哪些 Cookie</h3>
            <button
              type="button"
              :disabled="!!busy || !draft.sourceUrl"
              @click="
                act('cookies', async () => {
                  choices = await syncRequest('cookies', {
                    url: draft!.sourceUrl,
                  });
                  if (!choices.length)
                    notice =
                      '此地址没有 Cookie，可以先登录来源网站，或手动填写 Cookie 名称';
                })
              "
            >
              {{ busy === "cookies" ? "读取中…" : "读取来源 Cookie" }}
            </button>
          </div>
          <div v-if="draft.cookies.length" class="selected-cookies">
            <button
              v-for="(cookie, index) in draft.cookies"
              :key="selectorKey(cookie)"
              type="button"
              :title="`${cookie.domain || '匹配名称'} ${cookie.path || ''}`"
              @click="draft.cookies.splice(index, 1)"
            >
              {{ cookie.name }} <span>×</span>
            </button>
          </div>
          <template v-if="choices.length">
            <input
              v-model="search"
              aria-label="搜索 Cookie"
              placeholder="搜索 Cookie 名称或域"
            />
            <div class="cookie-options">
              <label
                v-for="cookie in visibleChoices"
                :key="selectorKey(cookie)"
                class="cookie-option"
                ><input
                  type="checkbox"
                  :checked="selected(cookie)"
                  @change="select(cookie)"
                />
                <div>
                  <strong>{{ cookie.name }}</strong
                  ><small
                    >{{ cookie.domain }} · {{ cookie.path
                    }}{{ cookie.httpOnly ? " · HttpOnly" : ""
                    }}{{ cookie.secure ? " · Secure" : "" }}</small
                  >
                </div></label
              >
            </div>
          </template>
          <div class="inline-input">
            <input
              v-model="cookieName"
              aria-label="手动填写 Cookie 名称"
              placeholder="也可手动填写名称，例如 token"
              @keydown.enter.prevent="addCookieName"
            /><button
              type="button"
              :disabled="!cookieName.trim()"
              @click="addCookieName"
            >
              添加
            </button>
          </div>
          <p class="hint">
            执行时读取最新值。手填名称会匹配来源地址下该名称的 Cookie。
          </p>
        </section>

        <section class="form-section">
          <h3>什么时候同步</h3>
          <label class="check-label"
            ><input v-model="draft.cookieChanges" type="checkbox" />来源 Cookie
            新增或更新时同步</label
          >
          <label
            >访问目标网站前<select
              v-model="draft.navigation"
              :disabled="!canNavigate"
            >
              <option value="off">关闭，仅手动或 Cookie 更新时同步</option>
              <option value="visit">每次打开或刷新目标网站</option>
              <option value="login">仅登录回跳时同步</option>
            </select></label
          >
          <label v-if="draft.navigation === 'login'"
            >登录页面地址 / 路径前缀<input
              v-model="draft.loginUrl"
              type="url"
              required
              placeholder="https://test.example.com/login"
            /><span class="hint"
              >同一标签页登录后返回目标时同步。如果登录页会自动跳过，请选「每次打开或刷新目标网站」。</span
            ></label
          >
          <p v-if="draft.navigation !== 'off'" class="hint">
            访问时会短暂显示同步页，完成后继续打开原地址。首版支持同标签页的普通
            GET 页面跳转。
          </p>
          <p v-if="!canNavigate" class="hint">
            当前浏览器不支持访问前同步，请使用 Chrome 验证。
          </p>
        </section>

        <details class="form-section advanced">
          <summary>Cookie 写入设置</summary>
          <label
            >目标为 HTTP 时<select v-model="draft.httpMode">
              <option value="adapt">
                兼容 HTTP：关闭 Secure，SameSite=None 改为 Lax
              </option>
              <option value="preserve">保留来源安全属性</option>
            </select></label
          >
          <label
            >Cookie 路径<select v-model="draft.pathMode">
              <option value="preserve">保留来源路径</option>
              <option value="root">统一写入根路径 /</option>
            </select></label
          >
          <p class="hint">
            保留 HttpOnly 和原有效期，仅写入目标主机。带 __Secure- / __Host-
            等安全前缀的 Cookie 需要 HTTPS。
          </p>
        </details>
        <div class="editor-footer">
          <label class="check-label">
            <input v-model="draft.enabled" type="checkbox" />启用规则</label
          >
          <button class="primary" :disabled="!!busy || !draft.cookies.length">
            {{ busy === "save" ? "保存中…" : "保存规则" }}
          </button>
        </div>
      </form>
    </div>
  </main>
</template>
