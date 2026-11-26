// Converts a domain like "x.com" into a declarativeNetRequest block rule
function buildRuleForDomain(domain, id) {
  return {
    id,
    priority: 1,
    action: {
      type: "block"
    },
    condition: {
      urlFilter: `||${domain}`,
      resourceTypes: ["main_frame"]
    }
  };
}

// Syncs all dynamic rules with the saved blockedSites array in storage
async function syncDynamicRules(sites) {
  const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
  const removeRuleIds = existingRules.map((rule) => rule.id);

  const addRules = (sites || []).map((domain, index) =>
    buildRuleForDomain(domain, index + 1)
  );

  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds,
    addRules
  });
}

// Sync rules on install/startup
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

// Re-sync whenever blockedSites changes in chrome.storage.local
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "local" && changes.blockedSites) {
    syncDynamicRules(changes.blockedSites.newValue || []);
  }
});
