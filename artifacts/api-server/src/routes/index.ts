import { Router, type IRouter } from "express";
import healthRouter from "./health";
import reposRouter from "./repos";
import debugRouter from "./debug";
import profileRouter from "./profile";
import sharingRouter from "./sharing";

const router: IRouter = Router();

router.use(healthRouter);
router.use(debugRouter);
router.use(profileRouter);
router.use(sharingRouter);
router.use(reposRouter);

export default router;
