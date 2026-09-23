const APEX_HOST = "foss.gg";
const DELETE_CONFIRM_MS = 4000;
const COPY_RESET_MS = 1500;

const shortUrl = (kind, key) => {
  if (kind === "path") {
    return `${APEX_HOST}${key.startsWith("/") ? key : `/${key}`}`;
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

const createNameError = (name) => {
  if (!name) {
    return "Enter a subdomain name.";
  }
  if (name.includes("/")) {
    return "Enter one subdomain label without '/'. Add paths after creating the subdomain.";
  }
  return "";
};

const syncCanonicalAddress = ({
  isPath,
  isCreate,
  normalizedPath,
  selectedParent,
  typedName,
  kind,
  key,
}) => {
  if (isPath) {
    kind.value = "path";
    key.value = normalizedPath;
  } else if (isCreate) {
    kind.value = "subdomain";
    key.value = typedName;
  } else {
    kind.value = "subdomain";
    key.value = `${selectedParent}${normalizedPath}`;
  }
};

const builderAddress = ({
  isPath,
  isCreate,
  displayPath,
  typedName,
  selectedParent,
}) => {
  if (isPath) {
    return shortUrl("path", displayPath);
  }
  if (isCreate) {
    return typedName.includes("/")
      ? shortUrl("subdomain", typedName)
      : `${typedName}.${APEX_HOST}`;
  }
  return shortUrl("subdomain", `${selectedParent}${displayPath}`);
};

const updateBuilderHelper = ({
  isPath,
  isCreate,
  helper,
  reservedHelp,
  ownerHelp,
}) => {
  if (isCreate) {
    helper.textContent =
      "This destination handles the subdomain's root and any path without its own link. Create the subdomain first. Then add paths such as /tickets.";
    reservedHelp.hidden = true;
    if (ownerHelp) {
      ownerHelp.hidden = false;
    }
    return;
  }
  if (isPath) {
    helper.textContent = "Paths match exactly.";
    reservedHelp.hidden = false;
  } else {
    helper.textContent =
      "Paths without their own link use this subdomain's default destination.";
    reservedHelp.hidden = true;
  }
  if (ownerHelp) {
    ownerHelp.hidden = true;
  }
};

const setupNewLink = () => {
  const form = document.querySelector("#new-link-form");
  const kind = document.querySelector("#new-kind");
  const key = document.querySelector("#new-key");
  const domain = document.querySelector("#new-domain");
  const path = document.querySelector("#new-path");
  const subdomainFields = document.querySelector("#subdomain-fields");
  const subdomainName = document.querySelector("#new-subdomain-name");
  const destinationLabel = document.querySelector("#new-destination-label");
  const preview = document.querySelector("#preview");
  const helper = document.querySelector("#new-helper");
  const reservedHelp = document.querySelector("#new-reserved-help");
  const ownerHelp = document.querySelector("#new-owner-help");
  const addressValidationError = document.querySelector(
    "#new-client-address-error"
  );
  const submit = document.querySelector("#new-submit");
  if (
    !(
      form &&
      kind &&
      key &&
      domain &&
      path &&
      subdomainFields &&
      subdomainName &&
      destinationLabel &&
      preview &&
      helper &&
      reservedHelp &&
      addressValidationError &&
      submit
    )
  ) {
    return;
  }

  let serverAddressInvalid =
    subdomainName.getAttribute("aria-invalid") === "true";

  const setCreateNameError = (message) => {
    subdomainName.setCustomValidity(message);
    if (message) {
      subdomainName.setAttribute("aria-invalid", "true");
    } else if (!serverAddressInvalid) {
      subdomainName.removeAttribute("aria-invalid");
    }
    addressValidationError.hidden = !message;
    addressValidationError.textContent = message;
  };

  const sync = () => {
    const selected = domain.value;
    const isCreate = selected === "create";
    const isPath = selected === "path";
    const selectedParent = selected.startsWith("subdomain:")
      ? selected.slice("subdomain:".length)
      : "";
    const typedPath = path.value.trim();
    let normalizedPath = typedPath;
    if (normalizedPath && !normalizedPath.startsWith("/")) {
      normalizedPath = `/${normalizedPath}`;
    }
    const displayPath = normalizedPath || (isPath ? "/matrix" : "/tickets");
    const typedName = subdomainName.value.trim();
    const displayName = typedName || "events";

    path.closest(".builder-field").hidden = isCreate;
    subdomainFields.hidden = !isCreate;
    path.required = !isCreate;
    subdomainName.required = isCreate;
    setCreateNameError(isCreate ? createNameError(typedName) : "");
    syncCanonicalAddress({
      isCreate,
      isPath,
      key,
      kind,
      normalizedPath,
      selectedParent,
      typedName,
    });
    const address = builderAddress({
      displayPath,
      isCreate,
      isPath,
      selectedParent,
      typedName: displayName,
    });
    preview.replaceChildren("Short link: ", codeElement(address));
    destinationLabel.textContent = isCreate
      ? "Default destination URL"
      : "Destination URL";
    submit.textContent = isCreate ? "Create subdomain" : "Create link";
    updateBuilderHelper({
      helper,
      isCreate,
      isPath,
      ownerHelp,
      reservedHelp,
    });
  };

  const handleAddressInput = () => {
    serverAddressInvalid = false;
    sync();
  };
  domain.addEventListener("change", handleAddressInput);
  path.addEventListener("input", handleAddressInput);
  subdomainName.addEventListener("input", handleAddressInput);
  subdomainName.addEventListener("invalid", () => {
    setCreateNameError(createNameError(subdomainName.value.trim()));
  });
  form.addEventListener("submit", (event) => {
    sync();
    if (domain.value === "create") {
      const error = createNameError(subdomainName.value.trim());
      if (error) {
        event.preventDefault();
        setCreateNameError(error);
        subdomainName.focus();
      }
    }
  });
  sync();
};

const editDestinationHint = (kind, key) => {
  if (kind !== "subdomain") {
    return "Paths match exactly.";
  }
  if (key.includes("/")) {
    return "Only this path uses this destination. Paths without their own link use this subdomain's default destination.";
  }
  return "The root and paths without their own link use this destination.";
};

const setupEditPreviews = () => {
  for (const form of document.querySelectorAll("form.edit")) {
    const kind = form.querySelector("select[name='kind']");
    const key = form.querySelector("input[name='key']");
    const preview = form.querySelector("[data-address-preview]");
    const hint = form.querySelector("[data-destination-hint]");
    if (!(kind && key && preview)) {
      continue;
    }
    const sync = () => {
      preview.replaceChildren(
        codeElement(shortUrl(kind.value, key.value.trim()))
      );
      if (hint) {
        hint.textContent = editDestinationHint(kind.value, key.value.trim());
      }
    };
    kind.addEventListener("change", sync);
    key.addEventListener("input", sync);
    sync();
  }
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
  const groups = [...list.querySelectorAll(".domain-group")];
  const scopeButtons = [...tools.querySelectorAll("[data-scope]")];
  let scope = "all";

  const apply = () => {
    const query = search.value.trim().toLowerCase();
    let shown = 0;
    for (const group of groups) {
      const groupRows = [...group.querySelectorAll("li[data-search]")];
      let groupShown = 0;
      for (const row of groupRows) {
        const visible =
          (scope === "all" || row.dataset.owner === list.dataset.me) &&
          row.dataset.search.includes(query);
        row.hidden = !visible;
        if (visible) {
          groupShown += 1;
          shown += 1;
        }
      }
      const pathsHeading = group.querySelector(".paths-heading");
      if (pathsHeading) {
        pathsHeading.hidden = !groupRows.some(
          (row) => row.classList.contains("child-path") && !row.hidden
        );
      }
      group.closest(".group-item").hidden = groupShown === 0;
      const groupCount = group.querySelector("[data-group-count]");
      if (groupCount) {
        const defaultShown = Boolean(
          group.querySelector('li[data-default="true"]:not([hidden])')
        );
        const pathCount = groupShown - Number(defaultShown);
        const paths = `${pathCount} ${pathCount === 1 ? "path" : "paths"}`;
        if (defaultShown) {
          groupCount.textContent =
            pathCount > 0 ? `Default + ${paths}` : "Default";
        } else {
          groupCount.textContent = paths;
        }
      }
      if (groupShown > 0) {
        group.open = true;
      }
    }
    count.textContent = String(shown);
    noMatch.hidden = shown > 0 || rows.length === 0;
  };

  const selectScope = (button) => {
    ({ scope } = button.dataset);
    for (const other of scopeButtons) {
      other.setAttribute("aria-pressed", String(other === button));
    }
    apply();
  };

  for (const button of scopeButtons) {
    button.addEventListener("click", () => selectScope(button));
  }
  search.addEventListener("input", apply);
  tools.hidden = false;
  apply();
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

const armDelete = (form) => {
  const button = form.querySelector("button");
  form.dataset.armed = "true";
  button.textContent = form.dataset.confirm || "Really delete?";
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

  list.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (button?.dataset.copy) {
      copyLink(button);
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

setupNewLink();
setupEditPreviews();
setupLinks();
