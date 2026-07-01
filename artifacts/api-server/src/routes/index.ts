import { Router, type IRouter } from "express";
import authRouter from "./auth";
import healthRouter from "./health";
import reposRouter from "./repos";
import debugRouter from "./debug";
import profileRouter from "./profile";
import sharingRouter from "./sharing";
import githubRouter from "./github";

const router: IRouter = Router();

router.use(authRouter);
router.use(healthRouter);
router.use(debugRouter);
router.use(profileRouter);
router.use(sharingRouter);
router.use(githubRouter);
router.use(reposRouter);

export default router;
