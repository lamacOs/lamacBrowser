const $ = id => document.getElementById(id);

let state = {
  tabs: [],
  activeId: null,
  bookmarks: [],
  canGoBack: false,
  canGoForward: false,
  url: ""
};

function element(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}

function renderTabs() {
  const container = $("tabs");
  container.replaceChildren();

  for (const tab of state.tabs) {
    const item = element(
      "div",
      "tab" + (tab.active ? " active" : "")
    );

    item.title = tab.url;
    item.setAttribute("role", "button");
    item.tabIndex = 0;

    const name = element("span", "tab-title", tab.title);
    const close = element("button", "tab-close", "×");
    close.title = "Tab schließen";

    item.append(name, close);

    item.addEventListener("click", () => {
      window.browser.activateTab(tab.id);
    });

    item.addEventListener("keydown", event => {
      if (event.key === "Enter") {
        window.browser.activateTab(tab.id);
      }
    });

    close.addEventListener("click", event => {
      event.stopPropagation();
      window.browser.closeTab(tab.id);
    });

    container.append(item);
  }
}

function renderBookmarks() {
  const container = $("bookmark-list");
  container.replaceChildren();

  for (const bookmark of state.bookmarks) {
    const button = element("button", "bookmark-item",
      bookmark.title || bookmark.url);

    button.title = bookmark.url;
    button.addEventListener("click", () => {
      window.browser.openBookmark(bookmark.url);
    });

    container.append(button);
  }

  const active = state.tabs.find(tab => tab.id === state.activeId);
  const saved = state.bookmarks.some(item => item.url === active?.url);

  $("bookmark").textContent = saved ? "★" : "☆";
  $("bookmark").title = saved
    ? "Lesezeichen entfernen"
    : "Lesezeichen hinzufügen";
}

function render() {
  renderTabs();
  renderBookmarks();

  const active = state.tabs.find(tab => tab.id === state.activeId);

  if (active) {
    $("address").value = active.url;
    $("status").textContent = active.title || "Website geöffnet";
  } else {
    $("address").value = "";
    $("status").textContent = "Bereit";
  }

  $("back").disabled = !state.canGoBack;
  $("forward").disabled = !state.canGoForward;
}

function navigate() {
  window.browser.navigate($("address").value);
}

$("address-form").addEventListener("submit", event => {
  event.preventDefault();
  navigate();
});

$("go").addEventListener("click", navigate);

$("new-tab").addEventListener("click", () => {
  window.browser.newTab();
});

$("back").addEventListener("click", () => {
  window.browser.back();
});

$("forward").addEventListener("click", () => {
  window.browser.forward();
});

$("reload").addEventListener("click", () => {
  window.browser.reload();
});

$("bookmark").addEventListener("click", () => {
  window.browser.toggleBookmark();
});

$("start-search").addEventListener("click", () => {
  window.browser.newTab("https://www.google.com");
});

document.addEventListener("keydown", event => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "l") {
    event.preventDefault();
    $("address").focus();
    $("address").select();
  }

  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "t") {
    event.preventDefault();
    window.browser.newTab();
  }

  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "w") {
    event.preventDefault();
    if (state.activeId !== null) {
      window.browser.closeTab(state.activeId);
    }
  }
});

window.browser.onState(nextState => {
  state = nextState;
  render();
});
