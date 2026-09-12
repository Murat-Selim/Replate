import { Request, Response, Router } from "express";

const router = Router();
const soon = (_req: Request, res: Response) => res.status(501).json({
  success: false,
  status: "soon",
  message: "Signals are coming soon / Yakında.",
  errorCode: "SIGNALS_NOT_LIVE",
});

router.get("/product/:canonicalProductId", soon);
router.get("/category/:category", soon);
router.get("/merchant/:merchantId", soon);

export default router;
