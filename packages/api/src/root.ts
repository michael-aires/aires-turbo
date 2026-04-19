import { activityRouter } from "./router/activity";
import { agentRouter } from "./router/agent";
import { auditRouter } from "./router/audit";
import { authRouter } from "./router/auth";
import { contactRouter } from "./router/contact";
import { subscriptionRouter } from "./router/subscription";
import { taskRouter } from "./router/task";
import { toolRouter } from "./router/tool";
import { createTRPCRouter } from "./trpc";

export const appRouter = createTRPCRouter({
  auth: authRouter,
  contact: contactRouter,
  activity: activityRouter,
  task: taskRouter,
  agent: agentRouter,
  subscription: subscriptionRouter,
  tool: toolRouter,
  audit: auditRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;
