import express, { NextFunction, Request, Response } from "express";
import { config } from "./config.js";
const app = express();
const PORT = 3000;

// log after response finishes so we can include status and mark non-OK

function handlerReadiness(_req: Request, res: Response) {
  res.set("Content-Type", "text/plain; charset=utf-8");
  res.send("OK");
}

class BadRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BadRequestError";
  }
}

class UnauthorizedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnauthorizedError";
  }
}

class ForbiddenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ForbiddenError";
  }
}

class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}

function middlewareLogResponses(
  req: Request,
  res: Response,
  next: NextFunction
): void {
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

function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  if (err instanceof BadRequestError) {
    res.status(400).json({ error: err.message });
  } else if (err instanceof UnauthorizedError) {
    res.status(401).json({ error: err.message });
  } else if (err instanceof ForbiddenError) {
    res.status(403).json({ error: err.message });
  } else if (err instanceof NotFoundError) {
    res.status(404).json({ error: err.message });
  } else {
    console.log(err);
    res.status(500).json({ error: "Something went wrong on our end" });
  }
}


function middlewareMetricsInc(
  _req: Request,
  _res: Response,
  next: NextFunction
): void {
  config.fileserverHits += 1;
  next();
}

function handlerMetrics(_req: Request, res: Response) {
  res.set("Content-Type", "text/html; charset=utf-8");
  res.send(`<html>
  <body>
    <h1>Welcome, Chirpy Admin</h1>
    <p>Chirpy has been visited ${config.fileserverHits} times!</p>
  </body>
</html>`);
}

function handlerReset(_req: Request, res: Response) {
  config.fileserverHits = 0;
  res.set("Content-Type", "text/plain; charset=utf-8");
  res.send(`Hits: ${config.fileserverHits}`);
}

function editOutProfaneWords(chirp: string): string {
  const profaneWords = ["kerfuffle", "sharbert", "fornax"];
  let editedChirp = chirp;

  for (const word of profaneWords) {
    const regex = new RegExp(`\\b${word}\\b`, "gi");
    editedChirp = editedChirp.replace(regex, "****");
  }

  return editedChirp;
}

async function handlerValidateChirp(req: Request, res: Response, next: NextFunction) {
  let body = "";

  req.on("data", (chunk) => {
    body += chunk;
  });

  req.on("end", () => {
    try {
      const parsedBody = JSON.parse(body);

      if (
        parsedBody &&
        typeof parsedBody === "object" &&
        typeof parsedBody.body === "string" &&
        parsedBody.body.length <= 140
      ) {
        const editedChirp = editOutProfaneWords(parsedBody.body);
        res.set("Content-Type", "application/json; charset=utf-8");
        res.status(200).json({ cleanedBody: editedChirp });
        return;
      }

      throw new BadRequestError("Chirp is too long. Max length is 140");
    } catch (err) {
      next(err);
    }
  });
}

// register logger globally so it captures all routes (including 404s)
app.use(middlewareLogResponses);

app.get("/api/healthz", handlerReadiness);
app.get("/admin/metrics", handlerMetrics);
app.post("/admin/reset", handlerReset);
app.post("/api/validate_chirp", handlerValidateChirp);

app.use("/app", middlewareMetricsInc, express.static("./src/app"));

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
