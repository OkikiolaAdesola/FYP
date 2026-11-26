const form = document.getElementById("add-site-form");
const input = document.getElementById("site-input");
const searchInput = document.getElementById("search-input");
const blockedList = document.getElementById("blocked-list");

let cachedSites = [];

// Returns a normalized target string:
// - Whole site/subdomain: "x.com" or "news.bbc.co.uk"
// - Single page/path: "www.bbc.co.uk/bitesize" (keeps specific path, strips trailing slash unless root)
function normalizeTarget(rawInput) {
  let trimmed = rawInput.trim().toLowerCase();
  if (!trimmed) return "";

  const withScheme = /^https?:\/\//.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    const parsed = new URL(withScheme);
    const host = parsed.hostname.replace(/^www\./, "");
    const cleanPath = parsed.pathname.replace(/\/+$/, ""); // e.g. "/bitesize" -> "/bitesize", "/" -> ""

    if (!host) return "";
    return cleanPath ? `${host}${cleanPath}` : host;
  } catch {
    // Fallback if URL parsing fails
    let fallback = trimmed.replace(/^https?:\/\//, "").replace(/^www\./, "");
    fallback = fallback.split("?")[0].split("#")[0].replace(/\/+$/, "");
    return fallback;
  }
}

// Builds a declarativeNetRequest rule:
// - If target has a path (e.g. "bbc.co.uk/bitesize"), filters "||bbc.co.uk/bitesize"
// - If target is just a host (e.g. "x.com"), filters "||x.com"
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

function renderList(sitesToDisplay, hasSearchQuery) {
  blockedList.textContent = "";

  if (!sitesToDisplay || sitesToDisplay.length === 0) {
    const emptyItem = document.createElement("li");
    emptyItem.className = "blocked-item";
    emptyItem.textContent = hasSearchQuery
      ? "No matching blocked websites."
      : "No websites added yet.";
    blockedList.appendChild(emptyItem);
    return;
  }

  sitesToDisplay.forEach((target) => {
    const li = document.createElement("li");
    li.className = "blocked-item";

    const targetSpan = document.createElement("span");
    targetSpan.textContent = target;

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "remove-btn";
    removeBtn.textContent = "Remove";
    removeBtn.addEventListener("click", () => removeSite(target));

    li.appendChild(targetSpan);
    li.appendChild(removeBtn);
    blockedList.appendChild(li);
  });
}

function applySearchAndRender() {
  const query = searchInput ? searchInput.value.trim().toLowerCase() : "";
  const filteredSites = query
    ? cachedSites.filter((target) => target.toLowerCase().includes(query))
    : cachedSites;

  renderList(filteredSites, Boolean(query));
}

function loadSites() {
  chrome.storage.local.get({ blockedSites: [] }, (result) => {
    cachedSites = Array.isArray(result.blockedSites) ? result.blockedSites : [];
    applySearchAndRender();
  });
}

function addSite(event) {
  event.preventDefault();
  const target = normalizeTarget(input.value);
  if (!target) return;

  chrome.storage.local.get({ blockedSites: [] }, async (result) => {
    const updatedSites = Array.isArray(result.blockedSites)
      ? [...result.blockedSites]
      : [];

    if (!updatedSites.includes(target)) {
      updatedSites.push(target);
      await syncDynamicRules(updatedSites);
      chrome.storage.local.set({ blockedSites: updatedSites }, () => {
        cachedSites = updatedSites;
        applySearchAndRender();
        input.value = "";
        input.focus();
      });
    } else {
      input.value = "";
    }
  });
}

function removeSite(targetToRemove) {
  chrome.storage.local.get({ blockedSites: [] }, async (result) => {
    const currentSites = Array.isArray(result.blockedSites)
      ? result.blockedSites
      : [];
    const updatedSites = currentSites.filter((site) => site !== targetToRemove);

    await syncDynamicRules(updatedSites);
    chrome.storage.local.set({ blockedSites: updatedSites }, () => {
      cachedSites = updatedSites;
      applySearchAndRender();
    });
  });
}

form.addEventListener("submit", addSite);
if (searchInput) {
  searchInput.addEventListener("input", applySearchAndRender);
}
document.addEventListener("DOMContentLoaded", loadSites);