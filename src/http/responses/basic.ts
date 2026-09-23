export const textResponse = (body: string, status: number): Response =>
  new Response(body, {
    headers: { "Content-Type": "text/plain; charset=UTF-8" },
    status,
  });

export const redirectResponse = (
  location: string,
  setCookie?: string
): Response => {
  const headers = new Headers({
    "Cache-Control": "no-store",
    Location: location,
  });
  if (setCookie) {
    headers.set("Set-Cookie", setCookie);
  }
  return new Response(null, { headers, status: 303 });
};
