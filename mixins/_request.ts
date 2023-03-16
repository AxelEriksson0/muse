import CONSTANTS2 from "../constants-ng.json" assert { type: "json" };

import { auth, client } from "../setup.ts";

import { RequestInit } from "../request.ts";

export function get_auth_headers() {
  return auth.get_headers();
}

export async function request(endpoint: string, options: RequestInit) {
  const auth_headers = await get_auth_headers();

  return client.request(
    `${CONSTANTS2.API_URL}/${endpoint}`,
    {
      method: options.method || "post",
      data: {
        ...CONSTANTS2.DATA,
        ...options.data,
      },
      headers: {
        ...CONSTANTS2.HEADERS,
        ...auth_headers,
        "Content-Type": "application/json",
        "X-Goog-Request-Time": (new Date()).getTime().toString(),
        ...options.headers,
      },
      params: {
        ...options.params,
      },
    },
  );
}

export async function request_json(endpoint: string, options: RequestInit) {
  const cache = Object.keys(options.params || {}).length == 0;

  // caching
  const path = `store/cache/${
    new URLSearchParams({ ...options.data } as any || {})
      .toString()
  }.json`;

  const cached = await Deno.readTextFile(path)
    .then(JSON.parse).catch(() => null);

  if (cache && cached) return cached;

  const response = await request(endpoint, options);

  const json = await response.json();

  if (cache) {
    await Deno.mkdir("store/cache", { recursive: true });
    await Deno.writeTextFile(path, JSON.stringify(json, null, 2));
  }

  return json;
}
