import { writable } from 'svelte/store';

const THEME_KEY = 'maska-theme';

function createThemeStore() {
  const isBrowser = typeof window !== 'undefined';
  const saved = isBrowser ? localStorage.getItem(THEME_KEY) : null;
  const initialTheme = saved || (isBrowser && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');

  const { subscribe, set } = writable(initialTheme);

  if (isBrowser) {
    if (initialTheme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  }

  function toggleWithCircularTransition(event) {
    if (!isBrowser) return;

    let current = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    let nextTheme = current === 'dark' ? 'light' : 'dark';

    // الحصول على إحداثيات زر التبديل
    let x, y;
    const btn = event && (event.currentTarget || event.target);
    if (btn && btn.getBoundingClientRect) {
      const rect = btn.getBoundingClientRect();
      x = event && typeof event.clientX === 'number' && event.clientX > 0 ? event.clientX : rect.left + rect.width / 2;
      y = event && typeof event.clientY === 'number' && event.clientY > 0 ? event.clientY : rect.top + rect.height / 2;
    } else {
      x = window.innerWidth / 2;
      y = 50;
    }

    const maxRadius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y)
    );

    if (document.startViewTransition && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      document.documentElement.classList.add('theme-transitioning');
      const transition = document.startViewTransition(() => {
        apply(nextTheme);
      });
      transition.ready.then(() => {
        document.documentElement.animate(
          {
            clipPath: [
              `circle(0px at ${x}px ${y}px)`,
              `circle(${maxRadius}px at ${x}px ${y}px)`
            ]
          },
          {
            duration: 550,
            easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
            pseudoElement: '::view-transition-new(root)'
          }
        ).finished.finally(() => {
          document.documentElement.classList.remove('theme-transitioning');
        });
      });
    } else {
      apply(nextTheme);
    }

    function apply(theme) {
      if (theme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
      } else {
        document.documentElement.removeAttribute('data-theme');
      }
      try {
        localStorage.setItem(THEME_KEY, theme);
      } catch (e) {}
      set(theme);
    }
  }

  return {
    subscribe,
    toggle: toggleWithCircularTransition
  };
}

export const theme = createThemeStore();

