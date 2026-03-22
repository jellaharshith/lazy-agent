import { Router, Request, Response } from "express";
import { uploadBufferToS3 } from "../services/storageService";

const router = Router();

router.get("/s3-test", async (_req: Request, res: Response) => {
  const result = await uploadBufferToS3({
    buffer: Buffer.from("SurplusLink AWS S3 test successful", "utf8"),
    key: `demo/s3-test-${Date.now()}.txt`,
    contentType: "text/plain; charset=utf-8",
  });
  return res.status(200).json(result);
});

export default router;
