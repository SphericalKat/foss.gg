import type { FC } from "hono/jsx";

import { isSubdomainChildPath, isSubdomainParent } from "../../domain/link";
import type { Link } from "../../domain/link";
import { splitSubdomainKey } from "../../domain/subdomain-key";
import { LinkRow } from "./link-row";
import type { ErrorContext, LinkDraft } from "./types";

interface LinkGroup {
  domain: string;
  links: Link[];
}

const groupLinks = (links: Link[]): LinkGroup[] => {
  const groups = new Map<string, LinkGroup>();
  for (const link of links) {
    const domain =
      link.kind === "path"
        ? "foss.gg"
        : `${splitSubdomainKey(link.key).label}.foss.gg`;
    const group = groups.get(domain);
    if (group) {
      group.links.push(link);
    } else {
      groups.set(domain, { domain, links: [link] });
    }
  }
  return [...groups.values()];
};

const groupOwner = (group: LinkGroup, username: string): string | undefined => {
  const owners = new Set(group.links.map((link) => link.owner_username));
  if (owners.size === 1 && !owners.has(username)) {
    return [...owners][0];
  }
  return undefined;
};

const groupSummary = (group: LinkGroup): string => {
  const hasDefault = group.links.some(isSubdomainParent);
  const pathCount = group.links.filter(
    (link) => !isSubdomainParent(link)
  ).length;
  const paths = `${pathCount} ${pathCount === 1 ? "path" : "paths"}`;
  if (!hasDefault) {
    return paths;
  }
  return pathCount > 0 ? `Default + ${paths}` : "Default";
};

export const LinksSection: FC<{
  links: Link[];
  username: string;
  error?: string;
  errorContext?: ErrorContext;
  draft?: LinkDraft;
}> = ({ links, username, error, errorContext, draft }) => (
  <section aria-labelledby="links-heading">
    <div class="section-head">
      <h2 id="links-heading">
        Links{" "}
        <span class="count" id="link-count">
          {links.length}
        </span>
      </h2>
      <div class="tabs" id="link-tools" hidden>
        <button type="button" data-scope="all" aria-pressed="true">
          All
        </button>
        <button type="button" data-scope="mine" aria-pressed="false">
          Mine
        </button>
        <label class="sr-only" htmlFor="link-search">
          Search links
        </label>
        <input
          class="field"
          id="link-search"
          type="search"
          placeholder="Search"
          autocomplete="off"
        />
      </div>
    </div>
    <ul class="list" id="links" data-me={username}>
      {groupLinks(links).map((group) => (
        <li class="group-item" key={group.domain}>
          <details class="domain-group" open data-domain={group.domain}>
            <summary>
              <span class="group-heading">{group.domain}</span>
              <span class="count" data-group-count>
                {groupSummary(group)}
              </span>
              {groupOwner(group, username) && (
                <span class="group-owner">
                  Owned by {groupOwner(group, username)}
                </span>
              )}
            </summary>
            <ul class="group-links">
              {group.links.filter(isSubdomainParent).map((link) => (
                <LinkRow
                  key={link.id}
                  link={link}
                  links={links}
                  username={username}
                  error={error}
                  errorContext={errorContext}
                  draft={draft}
                />
              ))}
              {group.links.some(isSubdomainParent) &&
                group.links.some(isSubdomainChildPath) && (
                  <li class="paths-heading">
                    <h3>Paths on this subdomain</h3>
                  </li>
                )}
              {group.links
                .filter((link) => !isSubdomainParent(link))
                .map((link) => (
                  <LinkRow
                    key={link.id}
                    link={link}
                    links={links}
                    username={username}
                    error={error}
                    errorContext={errorContext}
                    draft={draft}
                  />
                ))}
            </ul>
          </details>
        </li>
      ))}
      <li class="empty" id="no-match" hidden>
        No links match.
      </li>
      {links.length === 0 && (
        <li class="empty">No links yet. Add one above.</li>
      )}
    </ul>
  </section>
);
