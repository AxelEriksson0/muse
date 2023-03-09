export enum ERROR_CODE {
  GENERIC,

  /* Auth */
  AUTH_GENERIC,
  AUTH_CANT_GET_LOGIN_CODE,
  AUTH_INVALID_TOKEN,
  AUTH_INVALID_REFRESH_TOKEN,
  AUTH_NO_TOKEN,
}

export class MuseError extends Error {
  name = "MuseError";
  code: ERROR_CODE;
  constructor(code: ERROR_CODE, message: string, options?: ErrorOptions) {
    super(message, options);
    this.code = code;
  }
}
