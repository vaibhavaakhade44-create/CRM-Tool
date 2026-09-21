import { Request, Response, NextFunction } from "express";

export function requestTimeout(ms: number) {
  return (_req: Request, res: Response, next: NextFunction): void => {
    const timer = setTimeout(() => {
      if (!res.headersSent) {
        res.status(503).json({
          success: false,
          message: "Request timed out — server is under load, please retry.",
          retryAfter: Math.ceil(ms / 1000),
        });
      }
    }, ms);

    res.once("finish", () => clearTimeout(timer));
    res.once("close",  () => clearTimeout(timer));
    next();
  };
}
