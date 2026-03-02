const AUTH_CHANGED_EVENT = "finguide:auth-changed";

export const emitAuthChanged = () => {
  window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
};

export const onAuthChanged = (handler: () => void) => {
  window.addEventListener(AUTH_CHANGED_EVENT, handler);
  return () => window.removeEventListener(AUTH_CHANGED_EVENT, handler);
};

