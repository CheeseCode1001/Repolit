import { Router, type IRouter } from "express";
import healthRouter from "./health";
import reposRouter from "./repos";
import debugRouter from "./debug";

const router: IRouter = Router();

router.use(healthRouter);
router.use(debugRouter);
router.use(reposRouter);

export default router;
