import { setAuthTokenGetter, setBaseUrl } from "@workspace/api-client-react";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

if (BASE_URL) {
  setBaseUrl(BASE_URL);
}

setAuthTokenGetter(() => localStorage.getItem("pos_token"));
