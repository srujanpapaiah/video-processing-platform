import { Router } from "express";
import jobsRouter from "./jobs.route";
import filesRouter from "./files.route";
import healthRouter from "./health.route";

const apiRouter = Router();

apiRouter.use("/health", healthRouter);
apiRouter.use("/jobs", jobsRouter);
apiRouter.use("/files", filesRouter);

export default apiRouter;
