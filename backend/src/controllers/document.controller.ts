import { Response } from "express";
import path from "path";
import fs from "fs";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import { v4 as uuidv4 } from "uuid";
import { prisma } from "../lib/prisma";
import { OrgRequest } from "../middleware/orgContext";
import { ok, serverError } from "../utils/response";

// ── Allowed MIME types ──────────────────────────────────────
const ALLOWED_TYPES: Record<string, string> = {
  "application/pdf": "pdf",
  "text/csv": "csv",
  "application/vnd.ms-excel": "xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "text/plain": "txt",
};

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

// Magic bytes to verify actual file content matches declared MIME type
// Prevents "image.php.jpg" attacks where a malicious file lies about its type
const MAGIC_BYTES: Record<string, (buf: Buffer) => boolean> = {
  "application/pdf":   b => b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46,  // %PDF
  "image/jpeg":        b => b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF,
  "image/png":         b => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47,  // PNG
  "image/webp":        b => b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50,  // RIFF....WEBP
  // DOCX, XLSX are ZIP files internally
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":  b => b[0] === 0x50 && b[1] === 0x4B,  // PK
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": b => b[0] === 0x50 && b[1] === 0x4B,
  // Legacy DOC/XLS: OLE2 compound document
  "application/msword":        b => b[0] === 0xD0 && b[1] === 0xCF && b[2] === 0x11 && b[3] === 0xE0,
  "application/vnd.ms-excel":  b => b[0] === 0xD0 && b[1] === 0xCF && b[2] === 0x11 && b[3] === 0xE0,
  // CSV and plain text have no magic bytes — skip check
  "text/csv":    () => true,
  "text/plain":  () => true,
};

function verifyMagicBytes(buffer: Buffer, mimeType: string): boolean {
  const checker = MAGIC_BYTES[mimeType];
  if (!checker) return false;        // unknown type — reject
  if (buffer.length < 12) return false; // too short to be a real file
  return checker(buffer);
}

const useCloudinary = !!(
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET
);

if (useCloudinary) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key:    process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

// Always use memory storage — we decide where to persist in the controller
const fileFilter: multer.Options["fileFilter"] = (_req, file, cb) => {
  if (ALLOWED_TYPES[file.mimetype]) cb(null, true);
  else cb(new Error(`File type not allowed: ${file.mimetype}`));
};

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter,
});

// ── Helper: upload buffer to Cloudinary ─────────────────────
function uploadToCloudinary(
  buffer: Buffer,
  folder: string,
  publicId: string,
  resourceType: "image" | "video" | "raw" | "auto" = "auto"
): Promise<{ secure_url: string; public_id: string }> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, public_id: publicId, resource_type: resourceType, use_filename: false },
      (error: Error | null | undefined, result: { secure_url: string; public_id: string } | null | undefined) => {
        if (error || !result) reject(error || new Error("Cloudinary upload failed"));
        else resolve({ secure_url: result.secure_url, public_id: result.public_id });
      }
    );
    stream.end(buffer);
  });
}

// ── Helper: save buffer to local disk (fallback) ────────────
function saveLocally(buffer: Buffer, orgId: string, entityType: string, originalname: string): string {
  const ext = path.extname(originalname).toLowerCase();
  const filename = `${uuidv4()}${ext}`;
  const dir = path.join(process.cwd(), "uploads", orgId, entityType.toLowerCase());
  fs.mkdirSync(dir, { recursive: true });
  const fullPath = path.join(dir, filename);
  fs.writeFileSync(fullPath, buffer);
  return path.relative(process.cwd(), fullPath).replace(/\\/g, "/");
}

// ── Upload one or more files ────────────────────────────────
export async function uploadDocuments(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;
    const { entityType, entityId, description } = req.body;
    const files = req.files as Express.Multer.File[];

    if (!entityType || !entityId) {
      res.status(400).json({ success: false, message: "entityType and entityId are required" });
      return;
    }
    if (!files || files.length === 0) {
      res.status(400).json({ success: false, message: "No files uploaded" });
      return;
    }

    const documents = await Promise.all(files.map(async (file) => {
      // Verify actual file content matches declared MIME type (prevents spoofing)
      if (!verifyMagicBytes(file.buffer, file.mimetype)) {
        throw Object.assign(new Error(`File content does not match declared type: ${file.originalname}`), { status: 400 });
      }

      let filePath: string;
      let fileName: string;

      if (useCloudinary) {
        const folder = `businessos/${orgId}/${entityType.toLowerCase()}`;
        const publicId = uuidv4();
        const { secure_url, public_id } = await uploadToCloudinary(file.buffer, folder, publicId);
        filePath = secure_url;
        fileName = public_id;
      } else {
        filePath = saveLocally(file.buffer, orgId, entityType, file.originalname);
        fileName = path.basename(filePath);
      }

      return prisma.document.create({
        data: {
          organizationId: orgId,
          fileName,
          originalName: file.originalname,
          mimeType: file.mimetype,
          fileSize: file.size,
          filePath,
          entityType: entityType.toUpperCase(),
          entityId,
          description: description || null,
          uploadedById: (req as any).userId || null,
        },
      });
    }));

    ok(res, { documents }, `${documents.length} file(s) uploaded`);
  } catch (e) { serverError(res, e); }
}

// ── List documents for an entity ───────────────────────────
export async function listDocuments(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;
    const entityType = typeof req.query.entityType === "string" ? req.query.entityType.toUpperCase() : undefined;
    const entityId   = typeof req.query.entityId   === "string" ? req.query.entityId   : undefined;
    const search     = typeof req.query.search     === "string" ? req.query.search     : undefined;

    const where: any = { organizationId: orgId };
    if (entityType) where.entityType = entityType;
    if (entityId)   where.entityId   = entityId;
    if (search) {
      where.OR = [
        { originalName: { contains: search, mode: "insensitive" } },
        { description:  { contains: search, mode: "insensitive" } },
      ];
    }

    const documents = await prisma.document.findMany({ where, orderBy: { createdAt: "desc" }, take: 200 });
    ok(res, { documents });
  } catch (e) { serverError(res, e); }
}

// ── Get document stats ─────────────────────────────────────
export async function getDocumentStats(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;
    const [total, byType, totalSize] = await Promise.all([
      prisma.document.count({ where: { organizationId: orgId } }),
      prisma.document.groupBy({ by: ["entityType"], where: { organizationId: orgId }, _count: true }),
      prisma.document.aggregate({ where: { organizationId: orgId }, _sum: { fileSize: true } }),
    ]);
    ok(res, { total, totalSize: totalSize._sum.fileSize || 0, byType });
  } catch (e) { serverError(res, e); }
}

// ── Download / serve a file ─────────────────────────────────
export async function downloadDocument(req: OrgRequest, res: Response): Promise<void> {
  try {
    const id    = req.params.id as string;
    const orgId = req.organizationId!;
    const doc   = await prisma.document.findFirst({ where: { id, organizationId: orgId } });
    if (!doc) { res.status(404).json({ success: false, message: "File not found" }); return; }

    // Only redirect to trusted Cloudinary CDN — prevents open-redirect abuse
    if (
      doc.filePath.startsWith("https://res.cloudinary.com/") ||
      doc.filePath.startsWith("https://cloudinary.com/")
    ) {
      res.redirect(doc.filePath);
      return;
    }
    if (doc.filePath.startsWith("http://") || doc.filePath.startsWith("https://")) {
      res.status(400).json({ success: false, message: "Invalid file reference" });
      return;
    }

    // Guard against path traversal — reject any path containing ".." or an absolute prefix
    if (doc.filePath.includes("..") || doc.filePath.startsWith("/") || doc.filePath.startsWith("\\")) {
      res.status(400).json({ success: false, message: "Invalid file reference" });
      return;
    }

    // Local disk fallback
    const absolutePath = path.join(process.cwd(), doc.filePath);
    if (!fs.existsSync(absolutePath)) {
      res.status(404).json({ success: false, message: "File not found on disk" });
      return;
    }
    res.setHeader("Content-Type", doc.mimeType);
    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(doc.originalName)}"`);
    res.setHeader("Content-Length", doc.fileSize);
    fs.createReadStream(absolutePath).pipe(res as any);
  } catch (e) { serverError(res, e); }
}

// ── Delete a document ───────────────────────────────────────
export async function deleteDocument(req: OrgRequest, res: Response): Promise<void> {
  try {
    const id    = req.params.id as string;
    const orgId = req.organizationId!;
    const doc   = await prisma.document.findFirst({ where: { id, organizationId: orgId } });
    if (!doc) { res.status(404).json({ success: false, message: "Not found" }); return; }

    if (useCloudinary && (doc.filePath.startsWith("http://") || doc.filePath.startsWith("https://"))) {
      // fileName stores the Cloudinary public_id
      try { await cloudinary.uploader.destroy(doc.fileName, { resource_type: "raw" }); } catch { /* best effort */ }
    } else {
      const absolutePath = path.join(process.cwd(), doc.filePath);
      try { fs.unlinkSync(absolutePath); } catch { /* already gone */ }
    }

    await prisma.document.delete({ where: { id } });
    ok(res, null, "Deleted");
  } catch (e) { serverError(res, e); }
}
