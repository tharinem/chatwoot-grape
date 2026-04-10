import { createRouter, createWebHistory } from 'vue-router';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'board',
      component: () => import('@/pages/BoardPage.vue'),
    },
  ],
});

export default router;
