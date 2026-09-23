const APEX_HOST = "foss.gg";
const DELETE_CONFIRM_MS = 4000;
const COPY_RESET_MS = 1500;

const shortUrl = (kind, key) => {
  if (kind === "path") {
    return `${APEX_HOST}/${key.replace(/^\/+/u, "")}`;
  }
  const slash = key.indexOf("/");
  return slash === -1
    ? `${key}.${APEX_HOST}`
    : `${key.slice(0, slash)}.${APEX_HOST}${key.slice(slash)}`;
};

const codeElement = (text) => {
  const element = document.createElement("code");
  element.textContent = text;
  return element;
};

const setupPreview = () => {
  const kind = document.querySelector("#new-kind");
  const key = document.querySelector("#new-key");
  const destination = document.querySelector("#new-destination");
  const preview = document.querySelector("#preview");
  const prefix = document.querySelector("#key-prefix");
  const suffix = document.querySelector("#key-suffix");
  if (!(kind && key && destination && preview && prefix && suffix)) {
    return;
  }

  const sync = () => {
    const isPath = kind.value === "path";
    const typed = key.value.trim();
    prefix.hidden = !isPath;
    suffix.hidden = isPath || typed.includes("/");
    key.placeholder = isPath ? "matrix" : "events";
    preview.replaceChildren(
      codeElement(shortUrl(kind.value, typed || key.placeholder)),
      ` → ${destination.value.trim() || "destination"}`
    );
    if (!isPath) {
      preview.append(
        " · Use events/tickets for events.foss.gg/tickets. Other paths fall back to events."
      );
    }
  };

  kind.addEventListener("change", sync);
  key.addEventListener("input", sync);
  destination.addEventListener("input", sync);
  sync();
};

const setupFilter = (list) => {
  const tools = document.querySelector("#link-tools");
  const search = document.querySelector("#link-search");
  const count = document.querySelector("#link-count");
  const noMatch = document.querySelector("#no-match");
  if (!(tools && search && count && noMatch)) {
    return;
  }
  const rows = [...list.querySelectorAll("li[data-search]")];
  const scopeButtons = [...tools.querySelectorAll("[data-scope]")];
  let scope = "all";

  const apply = () => {
    const query = search.value.trim().toLowerCase();
    let shown = 0;
    for (const row of rows) {
      const visible =
        (scope === "all" || row.dataset.owner === list.dataset.me) &&
        row.dataset.search.includes(query);
      row.hidden = !visible;
      if (visible) {
        shown += 1;
      }
    }
    count.textContent = String(shown);
    noMatch.hidden = shown > 0 || rows.length === 0;
  };

  for (const button of scopeButtons) {
    button.addEventListener("click", () => {
      scope = button.dataset.scope;
      for (const other of scopeButtons) {
        other.setAttribute("aria-pressed", String(other === button));
      }
      apply();
    });
  }
  search.addEventListener("input", apply);
  tools.hidden = false;
};

const copyLink = async (button) => {
  try {
    await navigator.clipboard.writeText(button.dataset.copy);
    button.textContent = "Copied";
  } catch {
    button.textContent = "Copy failed";
  }
  setTimeout(() => {
    button.textContent = "Copy";
  }, COPY_RESET_MS);
};

const toggleEdit = (button) => {
  const form = document.getElementById(button.getAttribute("aria-controls"));
  if (!form) {
    return;
  }
  form.hidden = !form.hidden;
  button.setAttribute("aria-expanded", String(!form.hidden));
  button.textContent = form.hidden ? "Edit" : "Cancel";
  if (!form.hidden) {
    form.querySelector("input[name='destination']")?.focus();
  }
};

const armDelete = (form) => {
  const button = form.querySelector("button");
  form.dataset.armed = "true";
  button.textContent = "Really delete?";
  setTimeout(() => {
    delete form.dataset.armed;
    button.textContent = "Delete";
  }, DELETE_CONFIRM_MS);
};

const setupLinks = () => {
  const list = document.querySelector("#links");
  if (!list) {
    return;
  }

  for (const button of list.querySelectorAll(".copy")) {
    button.hidden = false;
  }
  for (const button of list.querySelectorAll("[data-edit]")) {
    const form = document.getElementById(button.getAttribute("aria-controls"));
    if (form) {
      form.hidden = true;
      button.hidden = false;
    }
  }

  list.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (button?.dataset.copy) {
      copyLink(button);
    } else if (button?.hasAttribute("data-edit")) {
      toggleEdit(button);
    }
  });

  list.addEventListener("submit", (event) => {
    const form = event.target;
    if (form.classList.contains("delete-form") && !form.dataset.armed) {
      event.preventDefault();
      armDelete(form);
    }
  });

  setupFilter(list);
};

setupPreview();
setupLinks();
