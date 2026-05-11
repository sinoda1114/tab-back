const MAX_HISTORY = 10;
const HISTORY_STORAGE_KEY = "tabHistory";

let tabHistory = [];
let suppressActivatedTabId = null;

const stateReady = loadState();

async function loadState() {
  const data = await chrome.storage.session.get(HISTORY_STORAGE_KEY);
  tabHistory = Array.isArray(data[HISTORY_STORAGE_KEY]) ? data[HISTORY_STORAGE_KEY] : [];

  await rememberCurrentlyActiveTabs();
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
  if (consumeHistory) {
    suppressActivatedTabId = entry.tabId;
  }

  await chrome.windows.update(entry.windowId, { focused: true });
  await chrome.tabs.update(entry.tabId, { active: true });
}

async function togglePreviousTab() {
  const currentWindow = await chrome.windows.getLastFocused({ windowTypes: ["normal"] });
  const currentEntry = await getActiveTabEntry(currentWindow.id);

  if (!currentEntry) {
    return;
  }

  const previousEntry = await findRecentEntry(currentEntry);

  if (!previousEntry) {
    return;
  }

  await switchToEntry(previousEntry, { consumeHistory: false });
}

async function goBackInTabHistory() {
  const currentWindow = await chrome.windows.getLastFocused({ windowTypes: ["normal"] });
  const currentEntry = await getActiveTabEntry(currentWindow.id);

  if (!currentEntry) {
    return;
  }

  const previousEntry = await findPreviousEntry(currentEntry);

  if (!previousEntry) {
    return;
  }

  await switchToEntry(previousEntry, { consumeHistory: true });
}

chrome.tabs.onActivated.addListener(async ({ tabId, windowId }) => {
  if (suppressActivatedTabId === tabId) {
    suppressActivatedTabId = null;
    return;
  }

  await rememberTab({ tabId, windowId });
});

chrome.tabs.onRemoved.addListener(async (tabId) => {
  await stateReady;
  tabHistory = tabHistory.filter((entry) => entry.tabId !== tabId);
  await saveHistory();
});

chrome.action.onClicked.addListener(togglePreviousTab);

chrome.commands.onCommand.addListener(async (command) => {
  if (command === "toggle-previous-tab") {
    await togglePreviousTab();
    return;
  }

  if (command === "go-back-tab-history") {
    await goBackInTabHistory();
  }
});
