export function getQueueCookie(req) {
  let rawCookie = req.headers.get("Cookie");

  if (!rawCookie) return null;

  let res = rawCookie
    .split(";")
    .map((c) => c.split("="))
    .filter(([k, _]) => k === "queue");

  if (res.length > 1) return null;

  return res[0][1];
}

export function setQueueCookie(res, queueCookie, maxAge) {
  res.headers.set(
    "Set-Cookie",
    `queue=${queueCookie}; path=/; Secure; HttpOnly; Max-Age=${maxAge}; SameSite=None`
  );
  return res;
}

export function clearQueueCookie(res) {
  res.headers.set(
    "Set-Cookie",
    "queue=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/;"
  );
  return res;
}
