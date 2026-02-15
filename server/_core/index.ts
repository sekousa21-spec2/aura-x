import "dotenv/config";
import express, { Express, Request, Response } from "express";
import { createServer } from "http";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import nodemailer from "nodemailer";
import crypto from "crypto";

// ============ TYPES ============
interface UserPayload {
  id: string;
  email: string;
  isAdmin: boolean;
  credits: number;
}

interface User {
  id: string;
  email: string;
  password: string;
  isAdmin: boolean;
  credits: number;
  deviceId: string;
  isVerified: boolean;
  createdAt: Date;
}

// ============ CONFIGURATION ============
const app: Express = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || "ultra-secret-key";
const ADMIN_EMAIL = "sekousanoh459@gmail.com";
const INITIAL_CREDITS = 1000;

// ============ MIDDLEWARE ============
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: "Trop de requêtes, réessayez plus tard",
});
app.use("/api/", limiter);

// ============ EMAIL CONFIGURATION ============
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER || "your-email@gmail.com",
    pass: process.env.GMAIL_PASSWORD || "your-app-password",
  },
});

// ============ IN-MEMORY DATABASE ============
const usersDatabase: Map<string, User> = new Map();
const emailVerificationDatabase: Map<string, { userId: string; otp: string; expiresAt: Date }> = new Map();
const imageGenerationsDatabase: Map<string, any> = new Map();
const videoGenerationsDatabase: Map<string, any> = new Map();
const voiceGenerationsDatabase: Map<string, any> = new Map();
const transactionsDatabase: Map<string, any> = new Map();
const fraudDetectionDatabase: Map<string, any> = new Map();

// ============ MIDDLEWARE FUNCTIONS ============
const verifyToken = (req: Request, res: Response, next: Function) => {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "Token manquant" });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as UserPayload;
    (req as any).user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: "Token invalide ou expiré" });
  }
};

const verifyAdmin = (req: Request, res: Response, next: Function) => {
  const user = (req as any).user;

  if (!user || !user.isAdmin) {
    return res.status(403).json({ error: "Accès réservé aux administrateurs" });
  }

  next();
};

// ============ UTILITY FUNCTIONS ============
function generateOTP(): string {
  return crypto.randomInt(100000, 999999).toString();
}

function generateDeviceId(userAgent: string, ipAddress: string): string {
  return crypto.createHash("sha256").update(`${userAgent}-${ipAddress}`).digest("hex");
}

async function detectFraud(
  email: string,
  ipAddress: string,
  userAgent: string,
  deviceId: string
): Promise<boolean> {
  const fraudIndicators = {
    multipleAccountsSameDevice: Array.from(usersDatabase.values()).some(u => u.deviceId === deviceId),
    suspiciousIP: fraudDetectionDatabase.has(ipAddress),
  };

  const fraudScore = Object.values(fraudIndicators).filter(Boolean).length;

  fraudDetectionDatabase.set(`${email}-${ipAddress}`, {
    email,
    ipAddress,
    userAgent,
    deviceId,
    fraudScore,
    flagged: fraudScore > 2,
    timestamp: new Date(),
  });

  return fraudScore > 2;
}

// ============ AUTHENTICATION ROUTES ============

app.post("/api/auth/register", async (req: Request, res: Response) => {
  try {
    const { email, password, userAgent, ipAddress } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email et mot de passe requis" });
    }

    const existingUser = Array.from(usersDatabase.values()).find(u => u.email === email);
    if (existingUser) {
      return res.status(409).json({ error: "Cet email est déjà enregistré" });
    }

    const deviceId = generateDeviceId(userAgent, ipAddress);
    const isFraud = await detectFraud(email, ipAddress, userAgent, deviceId);

    if (isFraud) {
      return res.status(403).json({ error: "Inscription bloquée: activité suspecte détectée" });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const userId = crypto.randomUUID();
    const isAdmin = email === ADMIN_EMAIL;

    usersDatabase.set(userId, {
      id: userId,
      email,
      password: hashedPassword,
      isAdmin,
      credits: INITIAL_CREDITS,
      deviceId,
      isVerified: false,
      createdAt: new Date(),
    });

    const otp = generateOTP();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

    emailVerificationDatabase.set(userId, {
      userId,
      otp,
      expiresAt: otpExpiry,
    });

    await transporter.sendMail({
      from: process.env.GMAIL_USER,
      to: email,
      subject: "Aura-X: Vérifiez votre email",
      html: `
        <h2>Bienvenue sur Aura-X!</h2>
        <p>Votre code de vérification est: <strong>${otp}</strong></p>
        <p>Ce code expire dans 10 minutes.</p>
      `,
    });

    res.status(201).json({
      message: "Inscription réussie. Vérifiez votre email pour le code OTP.",
      userId,
      requiresVerification: true,
    });
  } catch (error) {
    console.error("Erreur inscription:", error);
    res.status(500).json({ error: "Erreur lors de l'inscription" });
  }
});

app.post("/api/auth/verify-otp", async (req: Request, res: Response) => {
  try {
    const { userId, otp } = req.body;

    if (!userId || !otp) {
      return res.status(400).json({ error: "userId et otp requis" });
    }

    const verification = emailVerificationDatabase.get(userId);

    if (!verification || verification.otp !== otp || verification.expiresAt < new Date()) {
      return res.status(400).json({ error: "OTP invalide ou expiré" });
    }

    const user = usersDatabase.get(userId);
    if (user) {
      user.isVerified = true;
      usersDatabase.set(userId, user);
    }

    const token = jwt.sign(
      {
        id: user!.id,
        email: user!.email,
        isAdmin: user!.isAdmin,
        credits: user!.credits,
      } as UserPayload,
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      message: "Email vérifié avec succès",
      token,
      user: {
        id: user!.id,
        email: user!.email,
        isAdmin: user!.isAdmin,
        credits: user!.credits,
      },
    });
  } catch (error) {
    console.error("Erreur vérification OTP:", error);
    res.status(500).json({ error: "Erreur lors de la vérification" });
  }
});

app.post("/api/auth/login", async (req: Request, res: Response) => {
  try {
    const { email, password, ipAddress, userAgent } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email et mot de passe requis" });
    }

    const user = Array.from(usersDatabase.values()).find(u => u.email === email);

    if (!user) {
      return res.status(401).json({ error: "Email ou mot de passe incorrect" });
    }

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.status(401).json({ error: "Email ou mot de passe incorrect" });
    }

    if (!user.isVerified) {
      return res.status(403).json({ error: "Veuillez vérifier votre email d'abord" });
    }

    const deviceId = generateDeviceId(userAgent, ipAddress);
    const isFraud = await detectFraud(email, ipAddress, userAgent, deviceId);

    if (isFraud) {
      return res.status(403).json({ error: "Connexion bloquée: activité suspecte détectée" });
    }

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        isAdmin: user.isAdmin,
        credits: user.credits,
      } as UserPayload,
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      message: "Connexion réussie",
      token,
      user: {
        id: user.id,
        email: user.email,
        isAdmin: user.isAdmin,
        credits: user.credits,
      },
    });
  } catch (error) {
    console.error("Erreur connexion:", error);
    res.status(500).json({ error: "Erreur lors de la connexion" });
  }
});

app.get("/api/auth/profile", verifyToken, async (req: Request, res: Response) => {
  try {
    const userPayload = (req as any).user as UserPayload;
    const user = usersDatabase.get(userPayload.id);

    if (!user) {
      return res.status(404).json({ error: "Utilisateur non trouvé" });
    }

    res.json({
      id: user.id,
      email: user.email,
      isAdmin: user.isAdmin,
      credits: user.credits,
      createdAt: user.createdAt,
      isVerified: user.isVerified,
    });
  } catch (error) {
    console.error("Erreur récupération profil:", error);
    res.status(500).json({ error: "Erreur lors de la récupération du profil" });
  }
});

// ============ IMAGE GENERATION ROUTES ============

const IMAGE_STYLES = [
  "realistic", "artistic", "anime", "oil_painting", "watercolor",
  "digital_art", "photorealistic", "cinematic", "fantasy", "steampunk",
  "cyberpunk", "minimalist", "abstract", "surreal", "vintage", "sketch",
  "cartoon", "comic_book",
];

const IMAGE_FORMATS = [
  { name: "square", resolution: "1024x1024" },
  { name: "portrait", resolution: "768x1280" },
  { name: "landscape", resolution: "1280x768" },
  { name: "vertical", resolution: "768x1280" },
  { name: "horizontal", resolution: "1280x768" },
  { name: "heritage", resolution: "768x1024" },
];

app.post("/api/images/generate", verifyToken, async (req: Request, res: Response) => {
  try {
    const userPayload = (req as any).user as UserPayload;
    const { prompt, style = "realistic", format = "square", resolution } = req.body;

    if (!prompt || prompt.trim().length === 0) {
      return res.status(400).json({ error: "Le prompt est requis" });
    }

    if (prompt.length > 1000) {
      return res.status(400).json({ error: "Le prompt ne peut pas dépasser 1000 caractères" });
    }

    if (style && !IMAGE_STYLES.includes(style)) {
      return res.status(400).json({ error: `Style invalide. Styles disponibles: ${IMAGE_STYLES.join(", ")}` });
    }

    const finalResolution = resolution || IMAGE_FORMATS.find(f => f.name === format)?.resolution || "1024x1024";
    const creditsNeeded = 10;

    const user = usersDatabase.get(userPayload.id);
    if (!user || user.credits < creditsNeeded) {
      return res.status(402).json({
        error: `Crédits insuffisants. Vous avez ${user?.credits || 0} crédits, ${creditsNeeded} requis.`,
      });
    }

    const generationId = crypto.randomUUID();
    const imageUrl = `https://via.placeholder.com/${finalResolution.replace("x", "/")}?text=${encodeURIComponent(prompt)}`;

    imageGenerationsDatabase.set(generationId, {
      id: generationId,
      userId: userPayload.id,
      prompt,
      imageUrl,
      style,
      format,
      resolution: finalResolution,
      creditsUsed: creditsNeeded,
      status: "completed",
      createdAt: new Date(),
    });

    user.credits -= creditsNeeded;
    usersDatabase.set(user.id, user);

    res.status(201).json({
      id: generationId,
      imageUrl,
      prompt,
      style,
      format,
      resolution: finalResolution,
      creditsUsed: creditsNeeded,
      status: "completed",
    });
  } catch (error) {
    console.error("Erreur génération image:", error);
    res.status(500).json({ error: "Erreur lors de la génération de l'image" });
  }
});

app.get("/api/images/history", verifyToken, async (req: Request, res: Response) => {
  try {
    const userPayload = (req as any).user as UserPayload;
    const { limit = 20, offset = 0 } = req.query;

    const generations = Array.from(imageGenerationsDatabase.values())
      .filter(g => g.userId === userPayload.id)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(parseInt(offset as string), parseInt(offset as string) + parseInt(limit as string));

    res.json({
      count: generations.length,
      generations,
    });
  } catch (error) {
    console.error("Erreur récupération historique images:", error);
    res.status(500).json({ error: "Erreur lors de la récupération de l'historique" });
  }
});

app.get("/api/images/styles", verifyToken, async (req: Request, res: Response) => {
  res.json({
    styles: IMAGE_STYLES.map(style => ({
      name: style,
      displayName: style.replace(/_/g, " ").toUpperCase(),
    })),
  });
});

app.get("/api/images/formats", verifyToken, async (req: Request, res: Response) => {
  res.json({ formats: IMAGE_FORMATS });
});

// ============ VIDEO GENERATION ROUTES ============

const VIDEO_STYLES = [
  "realistic", "cinematic", "animated", "anime", "cartoon",
  "stop_motion", "documentary", "music_video", "abstract", "surreal",
  "fantasy", "sci_fi", "horror", "comedy", "drama",
];

const VIDEO_FORMATS = [
  { name: "vertical", resolution: "720x1280" },
  { name: "horizontal", resolution: "1280x720" },
  { name: "square", resolution: "1024x1024" },
];

const VIDEO_DURATIONS = [5, 10, 15, 20, 30];

app.post("/api/videos/generate", verifyToken, async (req: Request, res: Response) => {
  try {
    const userPayload = (req as any).user as UserPayload;
    const { prompt, style = "realistic", format = "vertical", duration = 10 } = req.body;

    if (!prompt || prompt.trim().length === 0) {
      return res.status(400).json({ error: "Le prompt est requis" });
    }

    if (!VIDEO_DURATIONS.includes(duration)) {
      return res.status(400).json({ error: `Durée invalide. Durées disponibles: ${VIDEO_DURATIONS.join(", ")} secondes` });
    }

    const finalResolution = VIDEO_FORMATS.find(f => f.name === format)?.resolution || "1280x720";
    const creditsNeeded = duration * 5;

    const user = usersDatabase.get(userPayload.id);
    if (!user || user.credits < creditsNeeded) {
      return res.status(402).json({
        error: `Crédits insuffisants. Vous avez ${user?.credits || 0} crédits, ${creditsNeeded} requis.`,
      });
    }

    const generationId = crypto.randomUUID();
    const videoUrl = `https://example.com/videos/${generationId}.mp4`;

    videoGenerationsDatabase.set(generationId, {
      id: generationId,
      userId: userPayload.id,
      prompt,
      videoUrl,
      duration,
      style,
      format,
      creditsUsed: creditsNeeded,
      status: "completed",
      createdAt: new Date(),
    });

    user.credits -= creditsNeeded;
    usersDatabase.set(user.id, user);

    res.status(201).json({
      id: generationId,
      videoUrl,
      prompt,
      style,
      format,
      duration,
      creditsUsed: creditsNeeded,
      status: "completed",
    });
  } catch (error) {
    console.error("Erreur génération vidéo:", error);
    res.status(500).json({ error: "Erreur lors de la génération de la vidéo" });
  }
});

app.get("/api/videos/history", verifyToken, async (req: Request, res: Response) => {
  try {
    const userPayload = (req as any).user as UserPayload;
    const { limit = 20, offset = 0 } = req.query;

    const generations = Array.from(videoGenerationsDatabase.values())
      .filter(g => g.userId === userPayload.id)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(parseInt(offset as string), parseInt(offset as string) + parseInt(limit as string));

    res.json({
      count: generations.length,
      generations,
    });
  } catch (error) {
    console.error("Erreur récupération historique vidéos:", error);
    res.status(500).json({ error: "Erreur lors de la récupération de l'historique" });
  }
});

app.get("/api/videos/styles", verifyToken, async (req: Request, res: Response) => {
  res.json({
    styles: VIDEO_STYLES.map(style => ({
      name: style,
      displayName: style.replace(/_/g, " ").toUpperCase(),
    })),
  });
});

app.get("/api/videos/formats", verifyToken, async (req: Request, res: Response) => {
  res.json({
    formats: VIDEO_FORMATS,
    durations: VIDEO_DURATIONS,
  });
});

// ============ VOICE GENERATION ROUTES ============

const SUPPORTED_LANGUAGES: Record<string, string> = {
  "en": "English", "fr": "French", "es": "Spanish", "de": "German",
  "it": "Italian", "pt": "Portuguese", "ru": "Russian", "ja": "Japanese",
  "zh": "Chinese", "ko": "Korean", "ar": "Arabic", "hi": "Hindi",
};

const VOICE_TYPES = [
  { id: "male_1", name: "Male Voice 1", gender: "male" },
  { id: "male_2", name: "Male Voice 2", gender: "male" },
  { id: "male_3", name: "Male Voice 3", gender: "male" },
  { id: "female_1", name: "Female Voice 1", gender: "female" },
  { id: "female_2", name: "Female Voice 2", gender: "female" },
  { id: "female_3", name: "Female Voice 3", gender: "female" },
  { id: "neutral_1", name: "Neutral Voice", gender: "neutral" },
];

app.post("/api/voices/generate", verifyToken, async (req: Request, res: Response) => {
  try {
    const userPayload = (req as any).user as UserPayload;
    const { text, language = "en", voiceType = "female_1", speed = 1.0 } = req.body;

    if (!text || text.trim().length === 0) {
      return res.status(400).json({ error: "Le texte est requis" });
    }

    if (text.length > 5000) {
      return res.status(400).json({ error: "Le texte ne peut pas dépasser 5000 caractères" });
    }

    if (!SUPPORTED_LANGUAGES[language]) {
      return res.status(400).json({ error: "Langue non supportée" });
    }

    const creditsNeeded = Math.ceil(text.length / 100) * 2;

    const user = usersDatabase.get(userPayload.id);
    if (!user || user.credits < creditsNeeded) {
      return res.status(402).json({
        error: `Crédits insuffisants. Vous avez ${user?.credits || 0} crédits, ${creditsNeeded} requis.`,
      });
    }

    const generationId = crypto.randomUUID();
    const audioUrl = `https://example.com/audio/${generationId}.mp3`;

    voiceGenerationsDatabase.set(generationId, {
      id: generationId,
      userId: userPayload.id,
      text,
      audioUrl,
      language,
      voiceType,
      creditsUsed: creditsNeeded,
      status: "completed",
      createdAt: new Date(),
    });

    user.credits -= creditsNeeded;
    usersDatabase.set(user.id, user);

    res.status(201).json({
      id: generationId,
      audioUrl,
      text,
      language,
      voiceType,
      creditsUsed: creditsNeeded,
      status: "completed",
    });
  } catch (error) {
    console.error("Erreur génération voix:", error);
    res.status(500).json({ error: "Erreur lors de la génération de la voix" });
  }
});

app.get("/api/voices/history", verifyToken, async (req: Request, res: Response) => {
  try {
    const userPayload = (req as any).user as UserPayload;
    const { limit = 20, offset = 0 } = req.query;

    const generations = Array.from(voiceGenerationsDatabase.values())
      .filter(g => g.userId === userPayload.id)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(parseInt(offset as string), parseInt(offset as string) + parseInt(limit as string));

    res.json({
      count: generations.length,
      generations,
    });
  } catch (error) {
    console.error("Erreur récupération historique voix:", error);
    res.status(500).json({ error: "Erreur lors de la récupération de l'historique" });
  }
});

app.get("/api/voices/languages", verifyToken, async (req: Request, res: Response) => {
  res.json({
    count: Object.keys(SUPPORTED_LANGUAGES).length,
    languages: SUPPORTED_LANGUAGES,
  });
});

app.get("/api/voices/types", verifyToken, async (req: Request, res: Response) => {
  res.json({ voices: VOICE_TYPES });
});

// ============ PAYMENT ROUTES ============

const SUPPORTED_CURRENCIES: Record<string, { name: string; rate: number }> = {
  "TRC20": { name: "TRON (USDT)", rate: 1000 },
  "ETH": { name: "Ethereum", rate: 50000 },
  "BNB": { name: "Binance Smart Chain", rate: 5000 },
  "POLYGON": { name: "Polygon", rate: 1000 },
};

app.post("/api/payments/create", verifyToken, async (req: Request, res: Response) => {
  try {
    const userPayload = (req as any).user as UserPayload;
    const { currency, amount, walletAddress } = req.body;

    if (!currency || !amount || !walletAddress) {
      return res.status(400).json({ error: "Currency, amount, et walletAddress sont requis" });
    }

    if (!SUPPORTED_CURRENCIES[currency]) {
      return res.status(400).json({
        error: `Devise non supportée. Devises disponibles: ${Object.keys(SUPPORTED_CURRENCIES).join(", ")}`,
      });
    }

    const rate = SUPPORTED_CURRENCIES[currency].rate;
    const creditsAmount = Math.floor(amount * rate);

    const transactionId = crypto.randomUUID();
    const paymentAddress = crypto.randomUUID();

    transactionsDatabase.set(transactionId, {
      id: transactionId,
      userId: userPayload.id,
      amount,
      currency,
      creditsReceived: creditsAmount,
      walletAddress,
      paymentMethod: "crypto",
      status: "pending",
      createdAt: new Date(),
    });

    res.status(201).json({
      transactionId,
      paymentAddress,
      currency,
      amount,
      creditsAmount,
      status: "pending",
      expiresIn: 3600,
    });
  } catch (error) {
    console.error("Erreur création paiement:", error);
    res.status(500).json({ error: "Erreur lors de la création du paiement" });
  }
});

app.post("/api/payments/verify", verifyToken, async (req: Request, res: Response) => {
  try {
    const userPayload = (req as any).user as UserPayload;
    const { transactionHash, currency } = req.body;

    if (!transactionHash || !currency) {
      return res.status(400).json({ error: "transactionHash et currency sont requis" });
    }

    const transaction = Array.from(transactionsDatabase.values()).find(
      t => t.userId === userPayload.id && t.status === "pending"
    );

    if (!transaction) {
      return res.status(404).json({ error: "Transaction non trouvée" });
    }

    const user = usersDatabase.get(userPayload.id);
    if (!user) {
      return res.status(404).json({ error: "Utilisateur non trouvé" });
    }

    transaction.status = "completed";
    transaction.transactionHash = transactionHash;
    transaction.completedAt = new Date();
    transactionsDatabase.set(transaction.id, transaction);

    user.credits += transaction.creditsReceived;
    usersDatabase.set(user.id, user);

    res.json({
      message: "Paiement vérifié et crédits ajoutés",
      transactionId: transaction.id,
      creditsAdded: transaction.creditsReceived,
      newBalance: user.credits,
    });
  } catch (error) {
    console.error("Erreur vérification paiement:", error);
    res.status(500).json({ error: "Erreur lors de la vérification du paiement" });
  }
});

app.get("/api/payments/history", verifyToken, async (req: Request, res: Response) => {
  try {
    const userPayload = (req as any).user as UserPayload;
    const { limit = 20, offset = 0 } = req.query;

    const userTransactions = Array.from(transactionsDatabase.values())
      .filter(t => t.userId === userPayload.id)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(parseInt(offset as string), parseInt(offset as string) + parseInt(limit as string));

    res.json({
      count: userTransactions.length,
      transactions: userTransactions,
    });
  } catch (error) {
    console.error("Erreur récupération historique transactions:", error);
    res.status(500).json({ error: "Erreur lors de la récupération de l'historique" });
  }
});

app.get("/api/payments/currencies", verifyToken, async (req: Request, res: Response) => {
  res.json({
    currencies: SUPPORTED_CURRENCIES,
  });
});

// ============ ADMIN ROUTES ============

app.get("/api/admin/users", verifyToken, verifyAdmin, async (req: Request, res: Response) => {
  try {
    const users = Array.from(usersDatabase.values()).map(u => ({
      id: u.id,
      email: u.email,
      isAdmin: u.isAdmin,
      credits: u.credits,
      isVerified: u.isVerified,
      createdAt: u.createdAt,
    }));

    res.json({ count: users.length, users });
  } catch (error) {
    console.error("Erreur récupération utilisateurs admin:", error);
    res.status(500).json({ error: "Erreur lors de la récupération des utilisateurs" });
  }
});

app.post("/api/admin/add-credits", verifyToken, verifyAdmin, async (req: Request, res: Response) => {
  try {
    const { userId, creditsAmount } = req.body;

    const user = usersDatabase.get(userId);
    if (!user) {
      return res.status(404).json({ error: "Utilisateur non trouvé" });
    }

    user.credits += creditsAmount;
    usersDatabase.set(userId, user);

    res.json({
      message: "Crédits ajoutés avec succès",
      userId,
      newBalance: user.credits,
    });
  } catch (error) {
    console.error("Erreur ajout crédits:", error);
    res.status(500).json({ error: "Erreur lors de l'ajout de crédits" });
  }
});

app.post("/api/admin/send-message", verifyToken, verifyAdmin, async (req: Request, res: Response) => {
  try {
    const { userId, subject, message } = req.body;

    const user = usersDatabase.get(userId);
    if (!user) {
      return res.status(404).json({ error: "Utilisateur non trouvé" });
    }

    await transporter.sendMail({
      from: process.env.GMAIL_USER,
      to: user.email,
      subject,
      html: message,
    });

    res.json({ message: "Message envoyé avec succès" });
  } catch (error) {
    console.error("Erreur envoi message:", error);
    res.status(500).json({ error: "Erreur lors de l'envoi du message" });
  }
});

app.get("/api/admin/transactions", verifyToken, verifyAdmin, async (req: Request, res: Response) => {
  try {
    const { limit = 50, offset = 0 } = req.query;

    const allTransactions = Array.from(transactionsDatabase.values())
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(parseInt(offset as string), parseInt(offset as string) + parseInt(limit as string));

    res.json({
      count: allTransactions.length,
      transactions: allTransactions,
    });
  } catch (error) {
    console.error("Erreur récupération transactions admin:", error);
    res.status(500).json({ error: "Erreur lors de la récupération des transactions" });
  }
});

// ============ HEALTH CHECK ============

app.get("/api/health", (req: Request, res: Response) => {
  res.json({
    status: "ok",
    timestamp: new Date(),
    uptime: process.uptime(),
  });
});

// ============ SERVER START ============

const server = createServer(app);

server.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════════════╗
║                    🚀 AURA-X API SERVER                        ║
║                      Started on port ${PORT}                        ║
╚════════════════════════════════════════════════════════════════╝

📍 API URL: http://localhost:${PORT}
📍 Health Check: http://localhost:${PORT}/api/health

Available Endpoints:
  ✓ Authentication: /api/auth/*
  ✓ Image Generation: /api/images/*
  ✓ Video Generation: /api/videos/*
  ✓ Voice Generation: /api/voices/*
  ✓ Payments: /api/payments/*
  ✓ Admin Panel: /api/admin/*

Admin Email: ${ADMIN_EMAIL}
Initial Credits: ${INITIAL_CREDITS}

Ready to serve requests! 🎉
  `);
});

export default app;
