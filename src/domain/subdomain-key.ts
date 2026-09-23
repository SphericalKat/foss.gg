export const isSubdomainLabel = (value: string): boolean =>
  value.length <= 63 && /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/u.test(value);

export interface SubdomainKeyParts {
  label: string;
  path: string | null;
}

export const splitSubdomainKey = (value: string): SubdomainKeyParts => {
  const slashIndex = value.indexOf("/");
  if (slashIndex === -1) {
    return { label: value.toLowerCase(), path: null };
  }
  const rawPath = value.slice(slashIndex);
  return {
    label: value.slice(0, slashIndex).toLowerCase(),
    path: rawPath === "/" ? null : rawPath,
  };
};
