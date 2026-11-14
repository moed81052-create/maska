import { writable, derived } from 'svelte/store';

const AUTH_KEY = 'maska-auth-user';

function createAuthStore() {
  const isBrowser = typeof window !== 'undefined';
  let initial = null;
  if (isBrowser) {
    try {
      const saved = localStorage.getItem(AUTH_KEY);
      if (saved) initial = JSON.parse(saved);
    } catch (e) {}
  }

  const { subscribe, set, update } = writable(initial);

  return {
    subscribe,
    login(userData) {
      if (isBrowser) {
        try {
          localStorage.setItem(AUTH_KEY, JSON.stringify(userData));
        } catch (e) {}
      }
      set(userData);
    },
    logout() {
      if (isBrowser) {
        try {
          localStorage.removeItem(AUTH_KEY);
        } catch (e) {}
      }
      set(null);
    }
  };
}

export const auth = createAuthStore();

export const isAuthenticated = derived(auth, $auth => !!$auth);
export const userRole = derived(auth, $auth => $auth ? $auth.role_name : null);
export const isAdmin = derived(auth, $auth => $auth && ($auth.role_name === 'admin' || $auth.roles?.includes('admin')));
export const isDriver = derived(auth, $auth => $auth && ($auth.role_name === 'driver' || $auth.roles?.includes('driver')));
export const isStaff = derived(auth, $auth => $auth && ['admin', 'florist', 'manager'].includes($auth.role_name));

