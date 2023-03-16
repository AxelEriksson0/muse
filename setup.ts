import { Authenticator, PureAuthenticatorOptions } from "./auth.ts";
import { FetchClient, RequestClient } from "./request.ts";
import { get_default_store, Store } from "./store.ts";

interface ClientOptions {
  auth?: PureAuthenticatorOptions;
  client?: RequestClient;
  store?: Store;
}

export function setup(options: ClientOptions = {}) {
  const store = options.store ?? get_default_store();
  const client = options.client ?? new FetchClient(store);
  const auth = new Authenticator({
    client: client,
    store: store,
    ...options.auth,
  });

  return { auth, client, store };
}

let { auth, client, store } = setup();

export function init(options: ClientOptions = {}) {
  const data = setup(options);

  auth = data.auth;
  client = data.client;
  store = data.store;

  return data;
}

export { auth, client, store };
