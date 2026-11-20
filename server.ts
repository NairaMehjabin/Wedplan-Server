import "dotenv/config";
import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import { connectDB } from "./db";
import serviceRoutes from "./routes/serviceRoutes";

const app = express();
const PORT = process.env.PORT || 5000;

app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    credentials: true,
  })
);
app.use(express.json({ limit: "10mb" }));

app.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({ success: true, message: "WedPlan API is healthy" });
});

app.use("/api/services", serviceRoutes);

app.use((_req: Request, res: Response) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error("Unhandled server error:", err);
  res.status(500).json({ success: false, message: "Internal server error" });
});

async function startServer(): Promise<void> {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`WedPlan server running on http://localhost:${PORT}`);
  });
}

startServer();