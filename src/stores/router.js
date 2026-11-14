import { writable } from 'svelte/store';

function parseLocation() {
  if (typeof window === 'undefined') {
    return { path: '/', params: {} };
  }

  // دعم كل من pathname والـ hash
  let pathname = window.location.pathname;
  if (window.location.hash) {
    pathname = window.location.hash.replace(/^#/, '');
  }

  // تنظيف المسار
  if (!pathname || pathname === '' || pathname === '/index.html') {
    pathname = '/';
  }

  const cleanPath = pathname.replace(/\/$/, '') || '/';

  // معالجة معلمات التتبع مثل /track/1048 أو /track?order=1048
  const trackMatch = cleanPath.match(/^\/track\/([^\/]+)$/);
  if (trackMatch) {
    return {
      path: '/track',
      params: { orderNumber: trackMatch[1] }
    };
  }

  const urlParams = new URLSearchParams(window.location.search);
  const params = Object.fromEntries(urlParams.entries());

  return {
    path: cleanPath,
    params
  };
}

function createRouter() {
  const { subscribe, set } = writable(parseLocation());

  if (typeof window !== 'undefined') {
    const handlePopState = () => {
      set(parseLocation());
    };

    window.addEventListener('popstate', handlePopState);
    window.addEventListener('hashchange', handlePopState);
  }

  return {
    subscribe,
    navigate(to, params = {}) {
      if (typeof window === 'undefined') return;

      let targetUrl = to;
      const query = new URLSearchParams(params).toString();
      if (query) {
        targetUrl += `?${query}`;
      }

      window.history.pushState(null, '', targetUrl);
      set({ path: to, params });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };
}

export const router = createRouter();

