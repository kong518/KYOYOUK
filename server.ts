/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express, { Request, Response } from "express";
import fs from "fs";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import { Certificate } from "./src/types";

// DB Path
let ORIGINAL_DB_PATH = path.join(process.cwd(), "data", "db.json");
let DB_PATH = ORIGINAL_DB_PATH;
let isMemoryOnly = false;

// Self-Diagnostic: Check write permission in active directory. Use /tmp on failure.
try {
  const primaryDir = path.dirname(ORIGINAL_DB_PATH);
  if (!fs.existsSync(primaryDir)) {
    fs.mkdirSync(primaryDir, { recursive: true });
  }
  const writeTestPath = path.join(primaryDir, ".write_test_" + Math.random().toString(36).substring(2, 7));
  fs.writeFileSync(writeTestPath, "test");
  fs.unlinkSync(writeTestPath);
  console.log("[DB] Primary data storage is writable.");
} catch (primaryErr) {
  console.warn("[DB] Original workspace data directory is read-only. Switching to safe temporary write pathway.", primaryErr.message);
  DB_PATH = path.join("/tmp", "db.json");
  try {
    const backupDir = path.dirname(DB_PATH);
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    const writeTestPath = path.join(backupDir, ".write_test_tmp");
    fs.writeFileSync(writeTestPath, "test");
    fs.unlinkSync(writeTestPath);
    console.log("[DB] Secondary temporary directory is writable:", DB_PATH);
  } catch (secondaryErr) {
    console.error("[DB] All file systems are locked under read-only mode. Activating temporary in-memory caching model.", secondaryErr.message);
    isMemoryOnly = true;
  }
}

// Read database
let certificates: Certificate[] = [];

// 1. Initial Load: Read historical state from the workspace's pre-rendered db.json
if (fs.existsSync(ORIGINAL_DB_PATH)) {
  try {
    const raw = fs.readFileSync(ORIGINAL_DB_PATH, "utf-8");
    if (raw.trim()) {
      certificates = JSON.parse(raw);
    }
    console.log(`[DB] Successfully loaded ${certificates.length} records from base template.`);
  } catch (err) {
    console.error("[DB] Failed reading original workspace data template:", err.message);
  }
}

// 2. Active Load: Replace with more recent delta updates if temporary DB_PATH holds fresher cache
if (DB_PATH !== ORIGINAL_DB_PATH && fs.existsSync(DB_PATH)) {
  try {
    const raw = fs.readFileSync(DB_PATH, "utf-8");
    if (raw.trim()) {
      const activeCerts = JSON.parse(raw);
      if (Array.isArray(activeCerts) && activeCerts.length > 0) {
        certificates = activeCerts;
        console.log(`[DB] Overrode with ${certificates.length} live records from active cache storage.`);
      }
    }
  } catch (err) {
    console.error("[DB] Failed reading from write-allowed cache storage:", err.message);
  }
} else if (!isMemoryOnly && !fs.existsSync(DB_PATH)) {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(certificates, null, 2), "utf-8");
  } catch (err) {
    console.error("[DB] Failed initializing storage base:", err.message);
  }
}

function saveDB() {
  if (isMemoryOnly) {
    console.log("[DB] Disk write bypassed. Storage modifications strictly retained inside Node environment RAM.");
    return;
  }
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(certificates, null, 2), "utf-8");
  } catch (err) {
    console.error("[DB] Database sync warning:", err.message);
  }
}

// Lazy Initialize Gemini SDK
let aiClient: GoogleGenAI | null = null;
function getGeminiClient() {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY || process.env.Gemini || process.env.gemini;
    if (!key) {
      throw new Error("GEMINI_API_KEY (또는 Gemini) 환경 변수가 설정되지 않았습니다. Vercel 환경 변수(Environment Variables)에서 Key 이름을 'GEMINI_API_KEY' (모두 대문자)로 등록해 주세요.");
    }
    aiClient = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  // Set payload limits to accommodate compressed certificate images in base64
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // ==================== API ENDPOINTS ====================

  // Check backend server and API key status
  app.get("/api/health", (req: Request, res: Response) => {
    const hasApiKey = !!(process.env.GEMINI_API_KEY || process.env.Gemini || process.env.gemini);
    res.json({
      status: "ok",
      serverTime: new Date().toISOString(),
      hasGeminiKey: hasApiKey
    });
  });

  // Get all saved certificates
  app.get("/api/certificates", (req: Request, res: Response) => {
    res.json(certificates);
  });

  // Create a new certificate
  app.post("/api/certificates", (req: Request, res: Response) => {
    try {
      const { studentName, birthDate, trainingName, completionDate, hours, issuingOrg, imageUrl, notes } = req.body;

      if (!studentName) {
        res.status(400).json({ error: "필수 정보(이름)가 누락되었습니다." });
        return;
      }

      const newCert: Certificate = {
        id: "cert_" + Math.random().toString(36).substring(2, 11),
        studentName: String(studentName).trim(),
        birthDate: String(birthDate || "").trim(),
        trainingName: trainingName ? String(trainingName).trim() : "판독 대기 중 (AI 분석 버튼을 클릭하세요)",
        completionDate: String(completionDate || "").trim(),
        hours: Number(hours) || 0,
        issuingOrg: String(issuingOrg || "").trim(),
        certificateNo: "",
        imageUrl: String(imageUrl || ""),
        submittedAt: new Date().toISOString(),
        notes: String(notes || "").trim()
      };

      certificates.unshift(newCert); // Add to the front
      saveDB();

      res.status(201).json(newCert);
    } catch (err: any) {
      console.error("Error creating certificate:", err);
      res.status(500).json({ error: "수료증을 저장하는 동안 오류가 발생했습니다: " + err.message });
    }
  });

  // Bulk create certificates (Excel upload)
  app.post("/api/certificates/bulk", (req: Request, res: Response) => {
    try {
      const { items } = req.body;
      if (!items || !Array.isArray(items)) {
        res.status(400).json({ error: "올바르지 않은 벌크 데이터 포맷입니다. 배열 수신이 요구됩니다." });
        return;
      }

      const createdItems: Certificate[] = [];
      for (const item of items) {
        const { studentName, birthDate, trainingName, completionDate, hours, issuingOrg, notes } = item;
        if (!studentName || !trainingName) {
          continue; // Skip invalid entries
        }

        const newCert: Certificate = {
          id: "cert_" + Math.random().toString(36).substring(2, 11) + "_" + Math.random().toString(36).substring(2, 5),
          studentName: String(studentName).trim(),
          birthDate: String(birthDate || "").trim(),
          trainingName: String(trainingName).trim(),
          completionDate: String(completionDate || "").trim(),
          hours: Number(hours) || 0,
          issuingOrg: String(issuingOrg || "").trim(),
          certificateNo: "",
          imageUrl: "",
          submittedAt: new Date().toISOString(),
          notes: String(notes || "").trim()
        };
        createdItems.push(newCert);
      }

      if (createdItems.length > 0) {
        certificates = [...createdItems, ...certificates];
        saveDB();
      }

      res.status(201).json({ count: createdItems.length, items: createdItems });
    } catch (err: any) {
      console.error("Error bulk creating certificates:", err);
      res.status(500).json({ error: "벌크 저장 도중 서버 에러가 발생했습니다: " + err.message });
    }
  });

  // Update a certificate
  app.put("/api/certificates/:id", (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { studentName, birthDate, trainingName, completionDate, hours, issuingOrg, notes } = req.body;

      const index = certificates.findIndex(c => c.id === id);
      if (index === -1) {
        res.status(404).json({ error: "수료증 정보를 찾을 수 없습니다." });
        return;
      }

      certificates[index] = {
        ...certificates[index],
        studentName: String(studentName !== undefined ? studentName : certificates[index].studentName).trim(),
        birthDate: String(birthDate !== undefined ? birthDate : (certificates[index].birthDate || "")).trim(),
        trainingName: String(trainingName !== undefined ? trainingName : certificates[index].trainingName).trim(),
        completionDate: String(completionDate !== undefined ? completionDate : certificates[index].completionDate).trim(),
        hours: hours !== undefined ? Number(hours) : certificates[index].hours,
        issuingOrg: String(issuingOrg !== undefined ? issuingOrg : certificates[index].issuingOrg).trim(),
        notes: String(notes !== undefined ? notes : (certificates[index].notes || "")).trim()
      };

      saveDB();
      res.json(certificates[index]);
    } catch (err: any) {
      console.error("Error updating certificate:", err);
      res.status(500).json({ error: "수료증 정보를 수정하는 중 오류가 발생했습니다: " + err.message });
    }
  });

  // Delete a certificate
  app.delete("/api/certificates/:id", (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const index = certificates.findIndex(c => c.id === id);
      if (index === -1) {
        res.status(404).json({ error: "수료증 정보를 찾을 수 없습니다." });
        return;
      }

      certificates.splice(index, 1);
      saveDB();
      res.json({ success: true, message: "수료증이 삭제되었습니다." });
    } catch (err: any) {
      console.error("Error deleting certificate:", err);
      res.status(500).json({ error: "수료증을 삭제하는 중 오류가 발생했습니다: " + err.message });
    }
  });

  // Analyze Certificate via Gemini Flash API
  app.post("/api/ai/analyze-certificate", async (req: Request, res: Response) => {
    try {
      const { imageData, mimeType } = req.body; // imageData is base64 string without full data:image/... prefix

      if (!imageData) {
        res.status(400).json({ error: "분석할 수료증 이미지 파일 데이터가 필요합니다." });
        return;
      }

      const activeMimeType = mimeType || "image/jpeg";
      const cleanBase64 = imageData.replace(/^data:[^;]+;base64,/, "");

      // Get initialized Gemini Client
      let ai;
      try {
        ai = getGeminiClient();
      } catch (e: any) {
        res.status(500).json({ error: "Gemini API 클라이언트를 초기화하지 못했습니다: " + e.message, code: "MISSING_API_KEY" });
        return;
      }

      const systemInstruction = 
        "You are an expert administrative assistant capable of reading and extracting structured information from completion certificates (수료증). " +
        "Analyze the certificate image and extract the following fields in Korean: 수강자 성명, 생년월일, 교육 과정명, 수료 일자, 수료 시간, 발급 기관. " +
        "Ensure the following formatting directives carefully:\n" +
        "1. studentName: Extract the student/trainee name. E.g., '홍길동'. Often positioned as 성명, 훈련생, 교육생, 수강생.\n" +
        "2. birthDate: Extract the birth date of the student. Often found labeled as '생년월일' or in security numbers like '950520-*******'. Format it strictly as 'YYYY.MM.DD' (E.g. '1995.05.20'). Smartly resolve 2-digit years. Return empty string if not found.\n" +
        "3. trainingName: Extract the exact text representing the training or education title. Often positioned as 교육명, 과정명, 훈련과정.\n" +
        "4. completionDate: Extract the completion or final date. Format it as 'YYYY-MM-DD' or 'YYYY.MM.DD' strictly based on what is displayed. If a duration is shown (e.g., 2026.05.10 ~ 2026.05.12), capture the end date (2026-05-12).\n" +
        "5. hours: Extract the training hours as an integer (e.g. 8). Look for '시간' or 'H'. If training hours are not mentioned, calculate if standard or default to 0. Must be a number.\n" +
        "6. issuingOrg: Extract the issuing institute, association, director of a center, or organization name which signed the certificate. E.g., '한국보건복지인재원'.\n" +
        "7. confidenceScore: A float between 0.0 and 1.0 representing your readability confidence in the image text.\n" +
        "8. summary: A short, warm 1-2 sentence Korean summary of this completion certificate.";

      const imagePart = {
        inlineData: {
          mimeType: activeMimeType,
          data: cleanBase64,
        },
      };

      const textPart = {
        text: "Please analyze thisCompletion Certificate (수료증) carefully. Extract all details precisely and return them strictly in JSON format matching the schema rules.",
      };

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: { parts: [imagePart, textPart] },
        config: {
          systemInstruction: systemInstruction,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              studentName: { type: Type.STRING, description: "교육 수강자(훈련생) 성명" },
              birthDate: { type: Type.STRING, description: "수료자의 생년월일 (YYYY.MM.DD)" },
              trainingName: { type: Type.STRING, description: "교육 과정명 / 교육명" },
              completionDate: { type: Type.STRING, description: "수료 일자 (또는 기간 정보의 종료일, YYYY-MM-DD)" },
              hours: { type: Type.INTEGER, description: "교육 수료 시간 (숫자)" },
              issuingOrg: { type: Type.STRING, description: "수료증 발급 단체 / 기관명" },
              confidenceScore: { type: Type.NUMBER, description: "분석 신뢰성 점수 (0.0 ~ 1.0)" },
              summary: { type: Type.STRING, description: "수료 정보 요약문 (한두 문장)" },
            },
            required: [
              "studentName",
              "birthDate",
              "trainingName",
              "completionDate",
              "hours",
              "issuingOrg",
              "confidenceScore",
              "summary"
            ]
          }
        }
      });

      const jsonText = response.text;
      if (!jsonText) {
        throw new Error("Gemini AI API returned an empty response.");
      }

      const cleanJsonText = jsonText.trim();
      const parsedResult = JSON.parse(cleanJsonText);

      res.json(parsedResult);
    } catch (err: any) {
      console.error("AI Certificate Analysis Error:", err);
      res.status(500).json({ error: "AI 분석 도중 오류가 발생했습니다: " + err.message });
    }
  });

  // ==================== VITE MIDDLEWARE SETUP ====================

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // Only listen to port if we are NOT on Vercel Serverless
  if (!process.env.VERCEL) {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`[Server] Multi-user Certificate Organizer running on port ${PORT}`);
    });
  }

  return app;
}

// Global handler export for serverless environments (like Vercel)
let cachedApp: any = null;
const handler = async (req: any, res: any) => {
  if (!cachedApp) {
    cachedApp = await startServer();
  }
  return cachedApp(req, res);
};

export default handler;

// For standalone running (like local or AI Studio dev platform)
if (!process.env.VERCEL) {
  startServer();
}
