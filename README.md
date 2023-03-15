# muse

A library to interact with the YouTube Music (InnerTube) api.

> Note: This library is still in development, and is not ready for production use.

## Usage

Requires Deno.

```ts
import { Muse } from "https://deno.land/x/muse/mod.ts";

const client = new Muse();

client.search("drake")
  .then((data) => {
    console.log("search results", data);
  });
```

## Auth

Currently, muse supports oauth authentication by posing as the YouTube TV app.

Here's the flow:

1. Get a login code
2. Go to the given login url, and type in the login code on a device that is
   logged into a google account
3. Get the OAuth token & refresh tokens

```ts
if (client.auth.requires_login()) {
  console.log("Getting login code...");

  const loginCode = await client.auth.get_login_code();

  console.log(
    `Go to ${loginCode.verification_url} and enter the code ${loginCode.user_code}`,
  );

  // not necessary, but saves some requests
  confirm("Press enter when you have logged in");

  console.log("Loading token...");

  await client.auth.load_token_with_code(
    loginCode.device_code,
    loginCode.interval,
  );

  console.log("Logged in!", client.auth._token);
}
```

In the future, I plan to add support for other auth methods, such as cookies and Youtube TV login codes.

## storage

You can pass in a storage object to the client to persist the auth token.

```ts
import { Store, DenoFileStore, MemoryStore, LocalStorageStore, get_default_store } from "https://deno.land/x/muse/mod.ts";

// you can use the default store, which is DenoFileStore if available, then LocalStorageStore, then MemoryStore
const client = new Muse({ store: get_default_store() });

// or you can use any of the built-in stores
const client = new Muse({ store: new DenoFileStore("/path/to/file.json") });
const client = new Muse({ store: new LocalStorageStore() });
const client = new Muse({ store: new MemoryStore() });

// or you can implement your own store
// by extending the Store abstract class
class MyStore extends Store {
  get<T>(key: string): T | null;
  set(key: string, value: unknown): void;
  delete(key: string): void;
}
```

## Operations

I'm currently targetting to match the [ytmusicapi]'s capabilities.

### search

- [x] search
- [x] search suggestions

### browsing

- [x] home
- [x] get artist
- [ ] get artist albums
- [ ] get album
- [ ] get album browse id
- [ ] get user
- [ ] get user playlists
- [x] get song
- [ ] get song related
- [ ] get lyrics
- [ ] get tasteprofile
- [ ] set tasteprofile

# explore

- [ ] get mood categories
- [ ] get mood playlists
- [ ] get charts

# watch

- [ ] get watch playlist

# library

- [x] get library
- [ ] get library playlists
- [ ] get library songs
- [ ] get library albums
- [ ] get library artists
- [ ] get library subscriptions
- [ ] get liked songs
- [ ] get history
- [ ] add history item
- [ ] remove history items
- [ ] rate song
- [ ] edit song library status
- [ ] rate playlist
- [ ] subscribe artists

# playlists

- [ ] get playlist
- [ ] create playlist
- [ ] edit playlist
- [ ] delete playlist
- [ ] add playlist items
- [ ] remove playlist items

# uploads

- [ ] get library upload songs
- [ ] get library upload artists
- [ ] get library upload albums
- [ ] get library upload artist
- [ ] get library upload album
- [ ] upload song
- [ ] delete upload entity

# Acknowledgements

- [ytmusicapi] - The inspiration for this library
- [Youtube Internal Clients][internal-clients] - The source of the client names and versions

[ytmusicapi]: https://ytmusicapi.readthedocs.io/en/stable/reference.html
[inner-clients]: https://github.com/zerodytrash/YouTube-Internal-Clients
