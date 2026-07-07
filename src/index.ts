import express, { NextFunction, Request, Response } from "express";

const app = express();
const PORT = 3000;

// log after response finishes so we can include status and mark non-OK

function handlerReadiness(_req: Request, res: Response) {
  res.set("Content-Type", "text/plain; charset=utf-8");
  res.send("OK");
}

function middlewareLogResponses(req: Request, res: Response, next: NextFunction): void {
  res.on("finish", () => {
    const entry = `${req.method} ${req.url} - Status: ${res.statusCode}`;
    if (res.statusCode >= 200 && res.statusCode < 300) {
      console.log(entry);
    } else {
      console.log(`[NON-OK] ${entry}`);
    }
  });
  next();
}

// register logger globally so it captures all routes (including 404s)
app.use(middlewareLogResponses);

app.get("/healthz", handlerReadiness);

app.use("/app", express.static("./src/app"));

app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});