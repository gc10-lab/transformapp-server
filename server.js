import cors from "cors";
import express from "express";
import multer from "multer";
import rateLimit from "express-rate-limit";
import OpenAI from "openai";
import { toFile } from "openai/uploads";

const app = express();

app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "X-Transform-Token"]
}));
app.options("*", cors());

const upload = multer({ storage: multer.memoryStorage() });

app.use("/api/", rateLimit({ windowMs: 60_000, max: 8 }));

function requireToken(req, res, next) {
  const token = req.get("X-Transform-Token");
  if (!process.env.TRANSFORMAPP_TOKEN) return res.status(500).send("Missing TRANSFORMAPP_TOKEN");
  if (token !== process.env.TRANSFORMAPP_TOKEN) return res.status(401).send("Unauthorized");
  next();
}

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.post("/api/generate-image", requireToken, upload.single("image"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).send("Missing image");

    const prompt = req.body.prompt || "Stylize the image tastefully.";

    const mime = req.file.mimetype || "image/jpeg";
    const name =
      (mime === "image/png") ? "input.png" :
      (mime === "image/webp") ? "input.webp" :
      "input.jpg";

    const imageFile = await toFile(req.file.buffer, name, { type: mime });

    const result = await client.images.edit({
      model: "gpt-image-1",
      image: imageFile,
      prompt,
      size: "1024x1024"
    });

    const b64 = result.data?.[0]?.b64_json;
    if (!b64) return res.status(500).send("No image returned");

    res.json({ b64 });
  } catch (err) {
    res.status(500).send(err?.message || "Unknown error");
  }
});
app.listen(process.env.PORT || 3000, () => {
  console.log("Server running");
});