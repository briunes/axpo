import { AsyncLocalStorage } from "async_hooks";

interface RequestContextState {
  refreshedAccessToken?: string;
}

const requestContextStorage = new AsyncLocalStorage<RequestContextState>();

export const withRequestContext = async <T>(
  callback: () => Promise<T>,
): Promise<T> => {
  return requestContextStorage.run({}, callback);
};

export const setRefreshedAccessToken = (token: string): void => {
  const store = requestContextStorage.getStore();
  if (!store) return;
  store.refreshedAccessToken = token;
};

export const getRefreshedAccessToken = (): string | undefined => {
  return requestContextStorage.getStore()?.refreshedAccessToken;
};
