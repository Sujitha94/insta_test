export const saveWithExpiry = (key: string, value: string, days: number) => {
  const expiry = new Date().getTime() + days * 24 * 60 * 60 * 1000;
  // Save the raw value so localStorage.getItem() still works everywhere
  localStorage.setItem(key, value);
  // Save expiry separately under a different key
  localStorage.setItem(`${key}_expiry`, String(expiry));
};

export const getWithExpiry = (key: string): string | null => {
  const value = localStorage.getItem(key);
  if (!value) return null;

  const expiry = localStorage.getItem(`${key}_expiry`);
  if (expiry && new Date().getTime() > Number(expiry)) {
    localStorage.removeItem(key);
    localStorage.removeItem(`${key}_expiry`);
    return null;
  }

  return value;
};

export const clearStorage = () => {
  ['tenentid', 'token', 'wstoken', 'isAdmin', 'blocked', 'type'].forEach((key) => {
    localStorage.removeItem(key);
    localStorage.removeItem(`${key}_expiry`);
  });
};
