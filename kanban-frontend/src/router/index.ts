import { createRouter, createWebHistory } from 'vue-router';
import { JWT_STORAGE_KEY } from '@/api/client';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'board',
      component: () => import('@/views/BoardView.vue'),
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/LoginView.vue'),
    },
  ],
});

// Navigation guard: redirect to login if no JWT
router.beforeEach((to) => {
  const token = localStorage.getItem(JWT_STORAGE_KEY);

  if (to.name !== 'login' && !token) {
    return { name: 'login' };
  }

  if (to.name === 'login' && token) {
    return { name: 'board' };
  }

  return true;
});

export default router;
