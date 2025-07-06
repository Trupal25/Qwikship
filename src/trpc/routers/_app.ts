import { createTRPCRouter } from '../init';
import { projectsRouter } from '@/modules/messages/server/procedures';

export const appRouter = createTRPCRouter({
  projects:projectsRouter
});
// export type definition of API
export type AppRouter = typeof appRouter;