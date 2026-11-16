import { writable } from 'svelte/store';

export const isGlobalChatOpen = writable(false);

export function openGlobalChat() {
  isGlobalChatOpen.set(true);
}

export function closeGlobalChat() {
  isGlobalChatOpen.set(false);
}

export function toggleGlobalChat() {
  isGlobalChatOpen.update(v => !v);
}
