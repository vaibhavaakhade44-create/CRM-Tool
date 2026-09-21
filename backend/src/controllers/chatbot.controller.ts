import { Response } from "express";
import { AuthRequest } from "../middleware/auth";
import { ok, badRequest, serverError } from "../utils/response";
import axios from "axios";

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

const SYSTEM_PROMPT = `You are BusinessOS Assistant, an AI-powered support agent built into the BusinessOS mobile app.
BusinessOS is a comprehensive business management platform for Indian businesses. Here is what the app can do:

FEATURES:
- Dashboard: KPI overview, recent activity, quick stats
- CRM: Add/manage parties (customers, vendors, distributors), log communications, track relationships
- Leads: Lead pipeline, kanban board, lead activities & follow-ups, lead forms
- Inventory: Products, categories, stock adjustments, low-stock alerts, barcode scanning
- Finance: Invoices (GST-compliant), payments, expenses, PDFs, financial reports
- Purchase Orders: Vendor POs, approval workflow, goods receipt
- Sales Orders: Customer orders, dispatch, fulfillment tracking
- HR: Employees, attendance, leave requests, payroll basics
- Projects: Project boards, tasks, sprints, time tracking, milestones
- Support Tickets: Customer issues, replies, status management
- GST: GSTIN validation, e-invoice, e-waybill generation
- Restaurant / Hotel / Retail: Specialized modules for these industries
- WhatsApp Integration: Send messages from within the app
- Documents: Upload and manage business documents
- Settings: Profile, organization settings, team management, roles & permissions, module visibility, privacy, data export

NAVIGATION:
- Bottom bar: Dashboard, CRM, Inventory, More
- "More" screen has access to all other modules
- Settings is accessible from the profile icon or More → Settings

HOW TO HELP:
1. Answer how-to questions about using BusinessOS features
2. Help troubleshoot common issues (login, sync, permissions)
3. Explain where to find specific screens or settings
4. Guide users step-by-step through workflows

TONE: Friendly, concise, helpful. Use numbered steps for instructions. Keep responses under 150 words unless a detailed walkthrough is needed.

If you cannot resolve an issue, say: "Please contact our support team at coe@techentrance.in or call +91 98341 34470."

Always reply in the same language the user writes in (Hindi, English, etc.).`;

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export async function chat(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { messages } = req.body as { messages: ChatMessage[] };

    if (!Array.isArray(messages) || messages.length === 0) {
      badRequest(res, "messages array is required");
      return;
    }
    if (messages.length > 30) {
      badRequest(res, "Maximum 30 messages per conversation");
      return;
    }
    for (const m of messages) {
      if (!m.role || !m.content || typeof m.content !== "string") {
        badRequest(res, "Each message must have role and content");
        return;
      }
      if (!["user", "assistant"].includes(m.role)) {
        badRequest(res, "Message role must be user or assistant");
        return;
      }
      if (m.content.length > 2000) {
        badRequest(res, "Message content too long (max 2000 chars)");
        return;
      }
    }

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      res.status(503).json({
        success: false,
        message: "AI service not configured. Please contact coe@techentrance.in.",
      });
      return;
    }

    const response = await axios.post(
      GROQ_API_URL,
      {
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          ...messages.map((m) => ({ role: m.role, content: m.content })),
        ],
        max_tokens: 512,
        temperature: 0.5,
        top_p: 0.9,
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        timeout: 20_000,
      }
    );

    const reply: string =
      response.data?.choices?.[0]?.message?.content ??
      "I couldn't generate a response right now. Please try again.";

    ok(res, { reply });
  } catch (err: any) {
    if (err?.response?.status === 429) {
      res.status(429).json({
        success: false,
        message: "AI service is busy right now. Please wait a moment and try again.",
      });
      return;
    }
    if (err.code === "ECONNABORTED" || err.code === "ETIMEDOUT") {
      res.status(504).json({
        success: false,
        message: "AI response timed out. Please try again.",
      });
      return;
    }
    serverError(res, err);
  }
}
