function buildRuleForTarget(target, id) {
  return {
    id,
    priority: 1,
    action: {
      type: "block"
    },
    condition: {
      urlFilter: `||${target}`,
      resourceTypes: ["main_frame"]
    }
  };
}

async function syncDynamicRules(sites) {
  const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
  const removeRuleIds = existingRules.map((rule) => rule.id);

  const addRules = (sites || []).map((target, index) =>
    buildRuleForTarget(target, index + 1)
  );

  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds,
    addRules
  });
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get({ blockedSites: [] }, (result) => {
    syncDynamicRules(result.blockedSites);
  });
});

chrome.runtime.onStartup.addListener(() => {
  chrome.storage.local.get({ blockedSites: [] }, (result) => {
    syncDynamicRules(result.blockedSites);
  });
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "local" && changes.blockedSites) {
    syncDynamicRules(changes.blockedSites.newValue || []);
  }
});