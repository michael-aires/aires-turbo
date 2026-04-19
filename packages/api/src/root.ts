import { activityRouter } from "./router/activity.js";
import { agentRouter } from "./router/agent.js";
import { auditRouter } from "./router/audit.js";
import { authRouter } from "./router/auth.js";
import { contactRouter } from "./router/contact.js";
import { postRouter } from "./router/post.js";
import { subscriptionRouter } from "./router/subscription.js";
import { taskRouter } from "./router/task.js";
import { toolRouter } from "./router/tool.js";
import { createTRPCRouter } from "./trpc.js";

export const appRouter = createTRPCRouter({
  auth: authRouter,
  post: postRouter,
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
