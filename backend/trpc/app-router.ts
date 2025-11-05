import { createTRPCRouter } from "./create-context";
import hiRoute from "./routes/example/hi/route";
import saveViolationRoute from "./routes/violations/save/route";
import getViolationHistoryRoute from "./routes/violations/history/route";
import getViolationStatsRoute from "./routes/violations/stats/route";
import getSectorsListRoute from "./routes/sectors/list/route";
import getUserProfileRoute from "./routes/users/profile/route";
import getUserViolationsRoute from "./routes/users/violations/route";

export const appRouter = createTRPCRouter({
  example: createTRPCRouter({
    hi: hiRoute,
  }),
  violations: createTRPCRouter({
    save: saveViolationRoute,
    history: getViolationHistoryRoute,
    stats: getViolationStatsRoute,
  }),
  sectors: createTRPCRouter({
    list: getSectorsListRoute,
  }),
  users: createTRPCRouter({
    profile: getUserProfileRoute,
    violations: getUserViolationsRoute,
  }),
});

export type AppRouter = typeof appRouter;