import { ref } from 'vue';

export interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error';
}

const toasts = ref<Toast[]>([]);
let nextId = 0;

function showToast(type: Toast['type'], message: string) {
  const id = nextId++;
  toasts.value.push({ id, message, type });

  setTimeout(() => {
    removeToast(id);
  }, 4000);
}

function removeToast(id: number) {
  const idx = toasts.value.findIndex((t) => t.id === id);
  if (idx !== -1) {
    toasts.value.splice(idx, 1);
  }
}

export function useToast() {
  return {
    toasts,
    showToast,
    removeToast,
  };
}
