import express, { NextFunction, Request, Response } from "express";
import postgres from "postgres";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { drizzle } from "drizzle-orm/postgres-js";
import { config } from "./config.js";

try {
  if (config.db.url) {
    const migrationClient = postgres(config.db.url, { max: 1 });
    await migrate(drizzle(migrationClient), config.db.migrationConfig);
  } else {
    console.warn("DB_URL not set; skipping migrations");
  }
} catch (err) {
  console.warn(
    "Database unavailable — skipping migrations:",
    (err as any)?.message ?? String(err)
  );
}

const app = express();
const PORT = 8080;

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
  _next: NextFunction
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
  config.api.fileserverHits += 1;
  next();
}

function handlerMetrics(_req: Request, res: Response) {
  res.set("Content-Type", "text/html; charset=utf-8");
  res.send(`<html>
  <body>
    <h1>Welcome, Chirpy Admin</h1>
    <p>Chirpy has been visited ${config.api.fileserverHits} times!</p>
  </body>
</html>`);
}

async function handlerReset(_req: Request, res: Response, next: NextFunction) {
  try {
    if (config.api.platform !== "dev") {
      throw new ForbiddenError("Reset is only allowed in the dev environment.");
    }

    const { deleteAllUsers } = await import("./db/queries/users.js");
    await deleteAllUsers();
    config.api.fileserverHits = 0;

    res.set("Content-Type", "text/plain; charset=utf-8");
    res.send("Reset successful: all users deleted and hits set to 0");
  } catch (err) {
    next(err);
  }
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

async function handlerCreateChirp(
  req: Request,
  res: Response,
  next: NextFunction
) {
  let body = "";

  req.on("data", chunk => {
    body += chunk;
  });

  req.on("end", async () => {
    try {
      const parsedBody = JSON.parse(body);

      if (
        !parsedBody ||
        typeof parsedBody !== "object" ||
        typeof parsedBody.body !== "string" ||
        parsedBody.body.length > 140
      ) {
        throw new BadRequestError("Chirp is too long. Max length is 140");
      }

      if (!parsedBody.userId || typeof parsedBody.userId !== "string") {
        throw new BadRequestError(
          "Missing or invalid 'userId' in request body."
        );
      }

      const editedChirp = editOutProfaneWords(parsedBody.body);

      const { createChirp } = await import("./db/queries/chirps.js");
      const saved = await createChirp({
        body: editedChirp,
        userId: parsedBody.userId
      });

      res.set("Content-Type", "application/json; charset=utf-8");
      res.status(201).json(saved);
    } catch (err) {
      next(err);
    }
  });
}

async function handlerGetChirps(
  _req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { getAllChirps } = await import("./db/queries/chirps.js");
    const chirps = await getAllChirps();
    res.status(200).json(chirps);
  } catch (err) {
    next(err);
  }
}

async function handlerCreateUser(
  req: Request,
  res: Response,
  next: NextFunction
) {
  let body = "";

  req.on("data", chunk => {
    body += chunk;
  });

  req.on("end", async () => {
    try {
      const parsedBody = JSON.parse(body);

      if (
        parsedBody &&
        typeof parsedBody === "object" &&
        typeof parsedBody.email === "string"
      ) {
        const { createUser } = await import("./db/queries/users.js");
        const newUser = await createUser({ email: parsedBody.email });
        res.set("Content-Type", "application/json; charset=utf-8");
        res.status(201).json(newUser);
        return;
      }

      throw new BadRequestError(
        "Invalid request body. Expected an object with an 'email' property."
      );
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
app.post("/api/users", handlerCreateUser);
app.post("/api/chirps", handlerCreateChirp);
app.get("/api/chirps", handlerGetChirps);

app.use("/app", middlewareMetricsInc, express.static("./src/app"));

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
