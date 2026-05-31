const MAX_HISTORY = 10;
const HISTORY_STORAGE_KEY = "tabHistory";
const DEBUG = false;
const KEEPALIVE_ALARM = "tab-back-keepalive";
const KEEPALIVE_PERIOD_MINUTES = 0.5;

let tabHistory = [];
let suppressActivatedTabId = null;

function log(...args) {
  if (!DEBUG) {
    return;
  }
  console.log("[tab-back]", ...args);
}

function snapshotHistory() {
  return tabHistory.map((entry) => `${entry.windowId}/${entry.tabId}`).join(" -> ");
}

const stateReady = loadState();

async function loadState() {
  const data = await chrome.storage.session.get(HISTORY_STORAGE_KEY);
  tabHistory = Array.isArray(data[HISTORY_STORAGE_KEY]) ? data[HISTORY_STORAGE_KEY] : [];
  log("loadState: restored history size =", tabHistory.length, "history =", snapshotHistory());

  await rememberCurrentlyActiveTabs();
  log("loadState: after rememberCurrentlyActiveTabs =", snapshotHistory());
}

async function saveHistory() {
  await chrome.storage.session.set({ [HISTORY_STORAGE_KEY]: tabHistory });
}

function sameEntry(left, right) {
  return left && right && left.tabId === right.tabId && left.windowId === right.windowId;
}

function removeEntry(entry) {
  tabHistory = tabHistory.filter((item) => !sameEntry(item, entry));
}

function rememberTabInMemory(entry) {
  removeEntry(entry);
  tabHistory.push(entry);

  if (tabHistory.length > MAX_HISTORY) {
    tabHistory = tabHistory.slice(tabHistory.length - MAX_HISTORY);
  }
}

async function rememberTab(entry) {
  await stateReady;
  rememberTabInMemory(entry);
  await saveHistory();
}

async function rememberCurrentlyActiveTabs() {
  const windows = await chrome.windows.getAll({
    populate: true,
    windowTypes: ["normal"]
  });

  for (const window of windows) {
    const activeTab = window.tabs?.find((tab) => tab.active);

    if (activeTab?.id) {
      rememberTabInMemory({
        tabId: activeTab.id,
        windowId: activeTab.windowId
      });
    }
  }

  await saveHistory();
}

async function getActiveTabEntry(windowId) {
  const tabs = await chrome.tabs.query({ active: true, windowId });
  const tab = tabs[0];

  if (!tab?.id) {
    return null;
  }

  return {
    tabId: tab.id,
    windowId: tab.windowId
  };
}

async function tabExists(entry) {
  try {
    const tab = await chrome.tabs.get(entry.tabId);
    return tab.windowId === entry.windowId;
  } catch {
    return false;
  }
}

async function findPreviousEntry(currentEntry) {
  await stateReady;

  while (tabHistory.length > 0 && sameEntry(tabHistory[tabHistory.length - 1], currentEntry)) {
    tabHistory.pop();
  }

  while (tabHistory.length > 0) {
    const candidate = tabHistory[tabHistory.length - 1];

    if (await tabExists(candidate)) {
      await saveHistory();
      return candidate;
    }

    tabHistory.pop();
  }

  await saveHistory();

  return null;
}

async function findRecentEntry(currentEntry) {
  await stateReady;

  let removedStaleEntry = false;

  for (let index = tabHistory.length - 1; index >= 0; index -= 1) {
    const candidate = tabHistory[index];

    if (sameEntry(candidate, currentEntry)) {
      continue;
    }

    if (await tabExists(candidate)) {
      if (removedStaleEntry) {
        await saveHistory();
      }

      return candidate;
    }

    tabHistory.splice(index, 1);
    removedStaleEntry = true;
  }

  if (removedStaleEntry) {
    await saveHistory();
  }

  return null;
}

async function switchToEntry(entry, { consumeHistory }) {
  log("switchToEntry: target =", `${entry.windowId}/${entry.tabId}`, "consumeHistory =", consumeHistory);
  if (consumeHistory) {
    suppressActivatedTabId = entry.tabId;
  }

  await chrome.windows.update(entry.windowId, { focused: true });
  await chrome.tabs.update(entry.tabId, { active: true });
}

async function togglePreviousTab() {
  const currentWindow = await chrome.windows.getLastFocused({ windowTypes: ["normal"] });
  const currentEntry = await getActiveTabEntry(currentWindow.id);
  log("togglePreviousTab: currentWindow =", currentWindow?.id, "currentEntry =", currentEntry, "history =", snapshotHistory());

  if (!currentEntry) {
    log("togglePreviousTab: no current entry, abort");
    return;
  }

  const previousEntry = await findRecentEntry(currentEntry);

  if (!previousEntry) {
    log("togglePreviousTab: no previous candidate, abort");
    return;
  }

  await switchToEntry(previousEntry, { consumeHistory: false });
}

async function goBackInTabHistory() {
  const currentWindow = await chrome.windows.getLastFocused({ windowTypes: ["normal"] });
  const currentEntry = await getActiveTabEntry(currentWindow.id);
  log("goBackInTabHistory: currentWindow =", currentWindow?.id, "currentEntry =", currentEntry, "history =", snapshotHistory());

  if (!currentEntry) {
    log("goBackInTabHistory: no current entry, abort");
    return;
  }

  const previousEntry = await findPreviousEntry(currentEntry);

  if (!previousEntry) {
    log("goBackInTabHistory: no previous candidate, abort");
    return;
  }

  await switchToEntry(previousEntry, { consumeHistory: true });
}

async function copyTextToClipboard(text, targetTab) {
  let tab = targetTab;

  if (!tab?.id) {
    const currentWindow = await chrome.windows.getLastFocused({ windowTypes: ["normal"] });
    const activeTabs = await chrome.tabs.query({ active: true, windowId: currentWindow.id });
    tab = activeTabs[0];
  }

  if (!tab?.id) {
    log("copyTextToClipboard: no active tab");
    return false;
  }

  log("copyTextToClipboard: injecting into tab", tab.id, "url =", tab.url);

  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: async (clipText) => {
        let writeTextError = null;

        try {
          await navigator.clipboard.writeText(clipText);
          return { ok: true, method: "writeText" };
        } catch (error) {
          writeTextError = String(error);
        }

        try {
          const textarea = document.createElement("textarea");
          textarea.value = clipText;
          textarea.style.position = "fixed";
          textarea.style.opacity = "0";
          textarea.style.pointerEvents = "none";
          document.body.append(textarea);
          textarea.focus();
          textarea.select();
          const ok = document.execCommand("copy");
          textarea.remove();
          return { ok, method: "execCommand", writeTextError };
        } catch (error) {
          return {
            ok: false,
            method: "both-failed",
            writeTextError,
            execCommandError: String(error)
          };
        }
      },
      args: [text]
    });

    const result = results?.[0]?.result;
    log("copyTextToClipboard: result =", JSON.stringify(result));
    return Boolean(result?.ok);
  } catch (error) {
    log("copyTextToClipboard: executeScript error =", String(error));
    return false;
  }
}

async function flashBadge(text, color = "#2d8cf0", durationMs = 1500) {
  try {
    await chrome.action.setBadgeBackgroundColor({ color });
    await chrome.action.setBadgeText({ text });

    setTimeout(() => {
      chrome.action.setBadgeText({ text: "" });
    }, durationMs);
  } catch (error) {
    log("flashBadge failed:", error);
  }
}

async function copySelectedTabUrls(invocationTab) {
  try {
    const windowId = invocationTab?.windowId
      ?? (await chrome.windows.getLastFocused({ windowTypes: ["normal"] })).id;

    const tabs = await chrome.tabs.query({ highlighted: true, windowId });
    tabs.sort((left, right) => left.index - right.index);

    const urls = tabs.map((tab) => tab.url).filter((url) => typeof url === "string" && url.length > 0);
    log("copySelectedTabUrls: highlighted count =", tabs.length, "url count =", urls.length, "invocationTab =", invocationTab?.id);

    if (urls.length === 0) {
      await flashBadge("0", "#888");
      return;
    }

    const text = urls.join("\n");
    const ok = await copyTextToClipboard(text, invocationTab);
    log("copySelectedTabUrls: copy ok =", ok);

    if (ok) {
      await flashBadge(String(urls.length), "#2d8cf0");
    } else {
      await flashBadge("!", "#d23f3f");
    }
  } catch (error) {
    log("copySelectedTabUrls: ERROR", String(error), error?.stack);
    try {
      await flashBadge("!", "#d23f3f");
    } catch {}
  }
}

async function focusPinnedTab(oneBasedIndex) {
  const currentWindow = await chrome.windows.getLastFocused({ windowTypes: ["normal"] });
  const pinnedTabs = await chrome.tabs.query({ windowId: currentWindow.id, pinned: true });
  pinnedTabs.sort((left, right) => left.index - right.index);

  const target = pinnedTabs[oneBasedIndex - 1];

  if (!target?.id) {
    return;
  }

  await switchToEntry(
    {
      tabId: target.id,
      windowId: target.windowId
    },
    { consumeHistory: false }
  );
}

chrome.tabs.onActivated.addListener(async ({ tabId, windowId }) => {
  if (suppressActivatedTabId === tabId) {
    log("onActivated: suppressed", `${windowId}/${tabId}`);
    suppressActivatedTabId = null;
    return;
  }

  await rememberTab({ tabId, windowId });
  log("onActivated: remembered", `${windowId}/${tabId}`, "history =", snapshotHistory());
});

chrome.tabs.onRemoved.addListener(async (tabId) => {
  await stateReady;
  tabHistory = tabHistory.filter((entry) => entry.tabId !== tabId);
  await saveHistory();
});

chrome.action.onClicked.addListener(togglePreviousTab);

chrome.commands.onCommand.addListener(async (command, tab) => {
  log("onCommand received:", command, "tab =", tab?.id, "at", new Date().toISOString());

  if (command === "01-toggle-previous-tab") {
    await togglePreviousTab();
    return;
  }

  if (command === "00-go-back-tab-history") {
    await goBackInTabHistory();
    return;
  }

  if (command === "02-copy-selected-tab-urls") {
    await copySelectedTabUrls(tab);
    return;
  }

  const pinnedMatch = /^focus-pinned-(\d+)$/.exec(command);

  if (pinnedMatch) {
    const index = parseInt(pinnedMatch[1], 10);

    if (index >= 1 && index <= 8) {
      await focusPinnedTab(index);
    }
  }
});

async function ensureKeepaliveAlarm() {
  const existing = await chrome.alarms.get(KEEPALIVE_ALARM);

  if (!existing) {
    await chrome.alarms.create(KEEPALIVE_ALARM, { periodInMinutes: KEEPALIVE_PERIOD_MINUTES });
    log("keepalive alarm created");
  }
}

chrome.runtime.onInstalled.addListener(() => {
  ensureKeepaliveAlarm();
});

chrome.runtime.onStartup.addListener(() => {
  ensureKeepaliveAlarm();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === KEEPALIVE_ALARM) {
    log("keepalive ping");
  }
});

ensureKeepaliveAlarm();
