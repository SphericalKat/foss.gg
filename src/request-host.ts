export const APEX_HOST = "foss.gg";

const normalizeHostname = (hostname: string): string =>
  hostname.toLowerCase().replace(/\.$/u, "");

export const getRequestHostname = (request: Request): string =>
  normalizeHostname(new URL(request.url).hostname);

export const isApexRequest = (request: Request): boolean =>
  getRequestHostname(request) === APEX_HOST;
