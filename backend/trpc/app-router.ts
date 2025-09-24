import { createTRPCRouter } from "./create-context";
import hiRoute from "./routes/example/hi/route";
import saveViolationRoute from "./routes/violations/save/route";
import getViolationHistoryRoute from "./routes/violations/history/route";
import getViolationStatsRoute from "./routes/violations/stats/route";

export const appRouter = createTRPCRouter({
  example: createTRPCRouter({
    hi: hiRoute,
  }),
  violations: createTRPCRouter({
    save: saveViolationRoute,
    history: getViolationHistoryRoute,
    stats: getViolationStatsRoute,
  }),
});

export type AppRouter = typeof appRouter;