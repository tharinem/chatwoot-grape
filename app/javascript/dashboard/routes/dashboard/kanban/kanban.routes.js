import KanbanIndex from './pages/KanbanIndex.vue';

const commonMeta = {
  permissions: ['administrator', 'agent'],
};

export const routes = [
  {
    path: 'kanban',
    name: 'kanban_index',
    component: KanbanIndex,
    meta: commonMeta,
  },
];
