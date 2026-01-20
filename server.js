import express from "express";
import multer from "multer";
import rateLimit from "express-rate-limit";
import OpenAI from "openai";

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

app.use("/api/", rateLimit({ windowMs: 60_000, max: 8 }));

function requireToken(req, res, next) {
  const token = req.get("X-Transform-Token");
  if (!process.env.TRANSFORMAPP_TOKEN) return res.status(500).send("Missing TRANSFORMAPP_TOKEN");
  if (token !== process.env.TRANSFORMAPP_TOKEN) return res.status(401).send("Unauthorized");
  next();
}

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.use(express.static("."));

app.post("/api/generate-image", requireToken, upload.single("image"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).send("Missing image");
    const prompt = req.body.prompt || "Stylize the image tastefully.";

    const result = await client.images.edit({
      model: "gpt-image-1",
      image: req.file.buffer,
      prompt,
      size: "1024x1024",
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