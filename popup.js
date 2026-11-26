const form = document.getElementById("add-site-form");
const input = document.getElementById("site-input");
const searchInput = document.getElementById("search-input");
const blockedList = document.getElementById("blocked-list");

let cachedSites = [];

function normalizeDomain(rawInput) {
  let value = rawInput.trim().toLowerCase();
  value = value.replace(/^https?:\/\//, "");
  value = value.replace(/^www\./, "");
  value = value.split("/")[0];
  value = value.split("?")[0];
  value = value.split("#")[0];
  return value;
}

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

  sitesToDisplay.forEach((domain) => {
    const li = document.createElement("li");
    li.className = "blocked-item";

    const domainSpan = document.createElement("span");
    domainSpan.textContent = domain;

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "remove-btn";
    removeBtn.textContent = "Remove";
    removeBtn.addEventListener("click", () => removeSite(domain));

    li.appendChild(domainSpan);
    li.appendChild(removeBtn);
    blockedList.appendChild(li);
  });
}

function applySearchAndRender() {
  const query = searchInput ? searchInput.value.trim().toLowerCase() : "";
  const filteredSites = query
    ? cachedSites.filter((domain) => domain.toLowerCase().includes(query))
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
  const domain = normalizeDomain(input.value);
  if (!domain) return;

  chrome.storage.local.get({ blockedSites: [] }, async (result) => {
    const updatedSites = Array.isArray(result.blockedSites)
      ? [...result.blockedSites]
      : [];

    if (!updatedSites.includes(domain)) {
      updatedSites.push(domain);
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

function removeSite(domainToRemove) {
  chrome.storage.local.get({ blockedSites: [] }, async (result) => {
    const currentSites = Array.isArray(result.blockedSites)
      ? result.blockedSites
      : [];
    const updatedSites = currentSites.filter((site) => site !== domainToRemove);

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