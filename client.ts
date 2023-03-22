import { RequiresLoginEvent } from "./auth.ts";
import {
  edit_song_library_status,
  subscribe_artists,
  unsubscribe_artists,
} from "./mixins/library.ts";
import { auth, get_home, init } from "./mod.ts";
import { FetchClient, RequestInit } from "./request.ts";
import { DenoFileStore } from "./store.ts";
import { debug } from "./util.ts";

const encoder = new TextEncoder();

async function hash(string: string) {
  // use the subtle crypto API to generate a 512 bit hash
  // return the hash as a hex string
  const data = encoder.encode(string);
  const hash = await crypto.subtle
    .digest("SHA-256", data);

  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

class CustomFetch extends FetchClient {
  async request(path: string, options: RequestInit) {
    // caching
    const cache_path = `store/cache/${await hash(
      JSON.stringify(options || {}),
    )}.json`;

    const cache = !path.startsWith("like/");

    const cached = await Deno.readTextFile(cache_path)
      .then(JSON.parse).catch(() => null);

    if (cache && cached) return new Response(JSON.stringify(cached));
    // end caching

    debug(options.method, path);

    const hasData = options.data != null;

    const url = new URL(path);

    (new URLSearchParams(options.params)).forEach((value, key) => {
      url.searchParams.set(key, value);
    });

    const headers = new Headers(options.headers);

    if (this.auth_header) headers.set("Authorization", this.auth_header);

    debug(`Requesting ${options.method} with ${JSON.stringify(options)}`);

    const response = await fetch(url.toString(), {
      method: options.method,
      headers,
      body: hasData ? JSON.stringify(options.data) : undefined,
    });

    // store into cache
    if (cache) {
      try {
        await Deno.mkdir("store/cache", { recursive: true });
        await Deno.writeTextFile(
          cache_path,
          JSON.stringify(await response.clone().json(), null, 2),
        );
      } catch {
        // not json probably: ignore
      }
    }

    debug("DONE", options.method, path);

    // if (!response.ok) {
    //   const text = await response.text();
    //   throw new Error(text);
    // }

    return response;
  }
}

init({
  store: new DenoFileStore("store/muse-store.json"),
  client: new CustomFetch(),
});

const css = {
  normal: "font-weight: normal",
  bold: "font-weight: bold",
  underline: "text-decoration: underline",
};

const auth_flow = async () => {
  if (auth.has_token()) return;
  console.log("Getting login code...");

  const loginCode = await auth.get_login_code();

  console.log(
    `Go to %c${loginCode.verification_url}%c and enter the code %c${loginCode.user_code}`,
    css.underline,
    css.normal,
    css.bold,
  );

  confirm("Press enter when you have logged in");

  console.log("Loading token...");

  await auth.load_token_with_code(
    loginCode.device_code,
    loginCode.interval,
  );

  console.log("Logged in!", auth._token);
};

auth.addEventListener("requires-login", (event) => {
  const resolve = (event as RequiresLoginEvent).detail;

  resolve(auth_flow);
});

// request("browse", {
//   data: {
//     browseId: "UC_x4LxqOApIT5QAi-m-oXJw",
//   },
// })
//   .then(async (data) => {
//     console.log(await data.text());
//   });

get_home("ggMeSgQIBxADSgQICRABSgQIBBABSgQIAxABSgQIBhAB", 6)
  // get_playlist("PLCwfwQhurMOukOqbFmYRidZ81ng_2iSUE")
  // .then((data) => {
  //   return get_queue(null, data.playlistId, { autoplay: true });
  // })
  .then((data) => {
    return Deno.writeTextFile(
      "store/rickroll.json",
      JSON.stringify(data, null, 2),
    );
    // return data;
  });
