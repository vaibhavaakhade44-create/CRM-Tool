import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { OrgRequest } from "../middleware/orgContext";
import { ok, created, notFound, badRequest, serverError } from "../utils/response";
import { sendEmail } from "../utils/email";

const db = () => (prisma as any);

// ────────────────────────────────────────────────────────
//  PATIENTS
// ────────────────────────────────────────────────────────

export async function listPatients(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;
    const { search, page = "1", limit = "50" } = req.query as Record<string, string>;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where: any = {
      organizationId: orgId,
      isActive: true,
      ...(search && {
        OR: [
          { name: { contains: search, mode: "insensitive" } },
          { phone: { contains: search } },
          { patientCode: { contains: search, mode: "insensitive" } },
        ],
      }),
    };

    const [patients, total] = await Promise.all([
      db().patient.findMany({
        where,
        include: {
          _count: { select: { visits: true, prescriptions: true, labReports: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: parseInt(limit),
      }),
      db().patient.count({ where }),
    ]);

    ok(res, { patients, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    serverError(res, err);
  }
}

export async function getPatient(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;
    const id = req.params.id as string;

    const patient = await db().patient.findFirst({
      where: { id, organizationId: orgId },
      include: {
        visits: { orderBy: { visitDate: "desc" }, take: 10 },
        prescriptions: { orderBy: { createdAt: "desc" }, take: 5 },
        labReports: { orderBy: { conductedAt: "desc" }, take: 5 },
        appointments: {
          orderBy: [{ appointmentDate: "desc" }, { timeSlot: "desc" }],
          take: 10,
          include: { doctor: { select: { id: true, name: true, specialization: true } } },
        },
      },
    });

    if (!patient) { notFound(res, "Patient not found"); return; }
    ok(res, patient);
  } catch (err) {
    serverError(res, err);
  }
}

export async function createPatient(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;
    const { name, dob, gender, bloodGroup, phone, email, address,
            emergencyName, emergencyPhone, allergies, chronicConds, notes } = req.body;

    if (!name?.trim()) { badRequest(res, "Patient name is required"); return; }

    // Auto-generate patient code
    const count = await db().patient.count({ where: { organizationId: orgId } });
    const patientCode = `PT-${String(count + 1).padStart(5, "0")}`;

    const patient = await db().patient.create({
      data: {
        organizationId: orgId,
        patientCode,
        name: name.trim(),
        dob: dob ? new Date(dob) : null,
        gender: gender ?? null,
        bloodGroup: bloodGroup ?? null,
        phone: phone ?? null,
        email: email ?? null,
        address: address ?? null,
        emergencyName: emergencyName ?? null,
        emergencyPhone: emergencyPhone ?? null,
        allergies: Array.isArray(allergies) ? allergies : [],
        chronicConds: Array.isArray(chronicConds) ? chronicConds : [],
        notes: notes ?? null,
      },
    });

    created(res, patient);
  } catch (err) {
    serverError(res, err);
  }
}

export async function updatePatient(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;
    const id = req.params.id as string;
    const existing = await db().patient.findFirst({ where: { id, organizationId: orgId } });
    if (!existing) { notFound(res, "Patient not found"); return; }

    const fields = ["name", "dob", "gender", "bloodGroup", "phone", "email", "address",
      "emergencyName", "emergencyPhone", "allergies", "chronicConds", "notes", "isActive"];
    const data: Record<string, any> = {};
    for (const f of fields) {
      if (req.body[f] !== undefined) {
        data[f] = f === "dob" ? (req.body[f] ? new Date(req.body[f]) : null) : req.body[f];
      }
    }

    const updated = await db().patient.update({ where: { id }, data });
    ok(res, updated);
  } catch (err) {
    serverError(res, err);
  }
}

// ────────────────────────────────────────────────────────
//  PATIENT VISITS
// ────────────────────────────────────────────────────────

export async function listVisits(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;
    const { patientId, doctorId, from, to } = req.query as Record<string, string>;

    const visits = await db().patientVisit.findMany({
      where: {
        organizationId: orgId,
        ...(patientId && { patientId }),
        ...(doctorId && { doctorId }),
        ...(from || to ? { visitDate: { ...(from && { gte: new Date(from) }), ...(to && { lte: new Date(to) }) } } : {}),
      },
      include: {
        patient: { select: { id: true, name: true, patientCode: true, phone: true } },
        prescriptions: { select: { id: true, createdAt: true } },
      },
      orderBy: { visitDate: "desc" },
    });

    ok(res, visits);
  } catch (err) {
    serverError(res, err);
  }
}

export async function createVisit(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;
    const { patientId, visitDate, visitType, doctorId, chiefComplaint, diagnosis,
            vitalsBP, vitalsPulse, vitalsTemp, vitalsWeight, vitalsHeight, vitalsSpO2,
            notes, followUpDate } = req.body;

    if (!patientId) { badRequest(res, "patientId is required"); return; }

    const patient = await db().patient.findFirst({ where: { id: patientId, organizationId: orgId } });
    if (!patient) { notFound(res, "Patient not found"); return; }

    const visit = await db().patientVisit.create({
      data: {
        organizationId: orgId,
        patientId,
        visitDate: visitDate ? new Date(visitDate) : new Date(),
        visitType: visitType ?? "OPD",
        doctorId: doctorId ?? null,
        chiefComplaint: chiefComplaint ?? null,
        diagnosis: diagnosis ?? null,
        vitalsBP: vitalsBP ?? null,
        vitalsPulse: vitalsPulse ? Number(vitalsPulse) : null,
        vitalsTemp: vitalsTemp ? Number(vitalsTemp) : null,
        vitalsWeight: vitalsWeight ? Number(vitalsWeight) : null,
        vitalsHeight: vitalsHeight ? Number(vitalsHeight) : null,
        vitalsSpO2: vitalsSpO2 ? Number(vitalsSpO2) : null,
        notes: notes ?? null,
        followUpDate: followUpDate ? new Date(followUpDate) : null,
      },
    });

    created(res, visit);
  } catch (err) {
    serverError(res, err);
  }
}

export async function updateVisit(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;
    const id = req.params.id as string;
    const existing = await db().patientVisit.findFirst({ where: { id, organizationId: orgId } });
    if (!existing) { notFound(res, "Visit not found"); return; }

    const fields = ["visitType", "doctorId", "chiefComplaint", "diagnosis",
      "vitalsBP", "vitalsPulse", "vitalsTemp", "vitalsWeight", "vitalsHeight", "vitalsSpO2",
      "notes", "followUpDate"];
    const data: Record<string, any> = {};
    for (const f of fields) {
      if (req.body[f] !== undefined) {
        if (f === "followUpDate") data[f] = req.body[f] ? new Date(req.body[f]) : null;
        else if (["vitalsPulse", "vitalsSpO2"].includes(f)) data[f] = req.body[f] ? Number(req.body[f]) : null;
        else if (["vitalsTemp", "vitalsWeight", "vitalsHeight"].includes(f)) data[f] = req.body[f] ? Number(req.body[f]) : null;
        else data[f] = req.body[f];
      }
    }

    const updated = await db().patientVisit.update({ where: { id }, data });
    ok(res, updated);
  } catch (err) {
    serverError(res, err);
  }
}

// ────────────────────────────────────────────────────────
//  PRESCRIPTIONS
// ────────────────────────────────────────────────────────

export async function listPrescriptions(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;
    const { patientId } = req.query as Record<string, string>;

    const prescriptions = await db().prescription.findMany({
      where: {
        organizationId: orgId,
        ...(patientId && { patientId }),
      },
      include: { patient: { select: { id: true, name: true, patientCode: true } } },
      orderBy: { createdAt: "desc" },
    });
    ok(res, prescriptions);
  } catch (err) {
    serverError(res, err);
  }
}

export async function createPrescription(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;
    const { patientId, visitId, medicines, instructions, diet, followUpDays, validUntil } = req.body;

    if (!patientId) { badRequest(res, "patientId is required"); return; }

    const patient = await db().patient.findFirst({ where: { id: patientId, organizationId: orgId } });
    if (!patient) { notFound(res, "Patient not found"); return; }

    const prescription = await db().prescription.create({
      data: {
        organizationId: orgId,
        patientId,
        visitId: visitId ?? null,
        doctorId: req.userId ?? null,
        medicines: medicines ?? [],
        instructions: instructions ?? null,
        diet: diet ?? null,
        followUpDays: followUpDays ? Number(followUpDays) : null,
        validUntil: validUntil ? new Date(validUntil) : null,
      },
    });

    created(res, prescription);
  } catch (err) {
    serverError(res, err);
  }
}

// ────────────────────────────────────────────────────────
//  LAB REPORTS
// ────────────────────────────────────────────────────────

export async function listLabReports(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;
    const { patientId } = req.query as Record<string, string>;

    const reports = await db().labReport.findMany({
      where: {
        organizationId: orgId,
        ...(patientId && { patientId }),
      },
      include: { patient: { select: { id: true, name: true, patientCode: true } } },
      orderBy: { conductedAt: "desc" },
    });
    ok(res, reports);
  } catch (err) {
    serverError(res, err);
  }
}

export async function createLabReport(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;
    const { patientId, visitId, testName, testCategory, results, normalRange, interpretation, conductedAt, fileUrl } = req.body;

    if (!patientId || !testName?.trim()) { badRequest(res, "patientId and testName are required"); return; }

    const patient = await db().patient.findFirst({ where: { id: patientId, organizationId: orgId } });
    if (!patient) { notFound(res, "Patient not found"); return; }

    const report = await db().labReport.create({
      data: {
        organizationId: orgId,
        patientId,
        visitId: visitId ?? null,
        testName: testName.trim(),
        testCategory: testCategory ?? null,
        results: results ?? {},
        normalRange: normalRange ?? null,
        interpretation: interpretation ?? null,
        technicianId: req.userId ?? null,
        conductedAt: conductedAt ? new Date(conductedAt) : new Date(),
        fileUrl: fileUrl ?? null,
      },
    });

    created(res, report);
  } catch (err) {
    serverError(res, err);
  }
}

// ────────────────────────────────────────────────────────
//  DOCTORS
// ────────────────────────────────────────────────────────

export async function listDoctors(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;
    const { search, verified } = req.query as Record<string, string>;
    const where: any = {
      organizationId: orgId,
      isActive: true,
      ...(search && { OR: [
        { name: { contains: search, mode: "insensitive" } },
        { specialization: { contains: search, mode: "insensitive" } },
        { registrationNo: { contains: search, mode: "insensitive" } },
      ]}),
      ...(verified === "true" && { isVerified: true }),
    };
    const doctors = await db().doctor.findMany({
      where,
      include: {
        documents: true,
        _count: { select: { appointments: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    ok(res, doctors);
  } catch (err) { serverError(res, err); }
}

export async function getDoctor(req: OrgRequest, res: Response): Promise<void> {
  try {
    const doctor = await db().doctor.findFirst({
      where: { id: req.params.id, organizationId: req.organizationId },
      include: { documents: true, appointments: { orderBy: { appointmentDate: "desc" }, take: 10, include: { patient: { select: { name: true, patientCode: true } } } } },
    });
    if (!doctor) { notFound(res, "Doctor not found"); return; }
    ok(res, doctor);
  } catch (err) { serverError(res, err); }
}

export async function createDoctor(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;
    const { name, email, phone, specialization, qualification, registrationNo, experience,
            department, consultationFee, availableDays, slotDuration, bio, documents } = req.body;

    if (!name?.trim()) { badRequest(res, "Doctor name is required"); return; }
    if (!specialization?.trim()) { badRequest(res, "Specialization is required"); return; }
    if (!qualification?.trim()) { badRequest(res, "Qualification is required"); return; }
    if (!registrationNo?.trim()) { badRequest(res, "Medical registration number is required"); return; }

    const existing = await db().doctor.findFirst({ where: { organizationId: orgId, registrationNo } });
    if (existing) { badRequest(res, "A doctor with this registration number already exists"); return; }

    const doctor = await db().doctor.create({
      data: {
        organizationId: orgId,
        name: name.trim(),
        email: email || null,
        phone: phone || null,
        specialization: specialization.trim(),
        qualification: qualification.trim(),
        registrationNo: registrationNo.trim(),
        experience: experience ? Number(experience) : null,
        department: department || null,
        consultationFee: consultationFee ? Number(consultationFee) : null,
        availableDays: Array.isArray(availableDays) ? availableDays : [],
        slotDuration: slotDuration ? Number(slotDuration) : 30,
        bio: bio || null,
        documents: documents?.length
          ? { create: documents.map((d: any) => ({ docType: d.docType, docNumber: d.docNumber || null, fileUrl: d.fileUrl || null, fileName: d.fileName || null })) }
          : undefined,
      },
      include: { documents: true },
    });
    created(res, doctor, "Doctor registered. Pending verification.");
  } catch (err) { serverError(res, err); }
}

export async function updateDoctor(req: OrgRequest, res: Response): Promise<void> {
  try {
    const existing = await db().doctor.findFirst({ where: { id: req.params.id, organizationId: req.organizationId } });
    if (!existing) { notFound(res, "Doctor not found"); return; }

    const allowed = ["name","email","phone","specialization","qualification","registrationNo","experience","department","consultationFee","availableDays","slotDuration","bio","isActive"];
    const data: any = {};
    for (const f of allowed) {
      if (req.body[f] !== undefined) data[f] = req.body[f];
    }
    const updated = await db().doctor.update({ where: { id: req.params.id }, data, include: { documents: true } });
    ok(res, updated);
  } catch (err) { serverError(res, err); }
}

export async function verifyDoctor(req: OrgRequest, res: Response): Promise<void> {
  try {
    const { status, rejectionReason } = req.body as { status: string; rejectionReason?: string };
    if (!["VERIFIED","REJECTED"].includes(status)) { badRequest(res, "Status must be VERIFIED or REJECTED"); return; }

    const existing = await db().doctor.findFirst({ where: { id: req.params.id, organizationId: req.organizationId } });
    if (!existing) { notFound(res, "Doctor not found"); return; }

    const updated = await db().doctor.update({
      where: { id: req.params.id },
      data: {
        verificationStatus: status,
        isVerified: status === "VERIFIED",
        rejectionReason: status === "REJECTED" ? (rejectionReason || null) : null,
      },
    });
    ok(res, updated, status === "VERIFIED" ? "Doctor verified successfully" : "Doctor registration rejected");
  } catch (err) { serverError(res, err); }
}

export async function addDoctorDocument(req: OrgRequest, res: Response): Promise<void> {
  try {
    const doctor = await db().doctor.findFirst({ where: { id: req.params.id, organizationId: req.organizationId } });
    if (!doctor) { notFound(res, "Doctor not found"); return; }

    const { docType, docNumber, fileUrl, fileName } = req.body;
    if (!docType) { badRequest(res, "docType is required"); return; }

    const doc = await db().doctorDocument.create({
      data: { doctorId: doctor.id, docType, docNumber: docNumber || null, fileUrl: fileUrl || null, fileName: fileName || null },
    });
    created(res, doc);
  } catch (err) { serverError(res, err); }
}

// ────────────────────────────────────────────────────────
//  APPOINTMENTS
// ────────────────────────────────────────────────────────

export async function listAppointments(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;
    const { doctorId, patientId, status, date } = req.query as Record<string, string>;
    const dateFilter = date ? { gte: new Date(date + "T00:00:00"), lte: new Date(date + "T23:59:59") } : undefined;

    const appointments = await db().healthAppointment.findMany({
      where: {
        organizationId: orgId,
        ...(doctorId && { doctorId }),
        ...(patientId && { patientId }),
        ...(status && { status }),
        ...(dateFilter && { appointmentDate: dateFilter }),
      },
      include: {
        patient: { select: { id: true, name: true, patientCode: true, phone: true, bloodGroup: true } },
        doctor: { select: { id: true, name: true, specialization: true, consultationFee: true } },
      },
      orderBy: [{ appointmentDate: "asc" }, { timeSlot: "asc" }],
    });
    ok(res, appointments);
  } catch (err) { serverError(res, err); }
}

export async function createAppointment(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;
    const { patientId, doctorId, appointmentDate, timeSlot, type, chiefComplaint, notes, fee } = req.body;

    if (!patientId || !doctorId || !appointmentDate || !timeSlot) {
      badRequest(res, "patientId, doctorId, appointmentDate and timeSlot are required"); return;
    }

    const [patient, doctor] = await Promise.all([
      db().patient.findFirst({ where: { id: patientId, organizationId: orgId } }),
      db().doctor.findFirst({ where: { id: doctorId, organizationId: orgId } }),
    ]);
    if (!patient) { notFound(res, "Patient not found"); return; }
    if (!doctor) { notFound(res, "Doctor not found"); return; }
    if (!doctor.isVerified) { badRequest(res, "Doctor is not yet verified"); return; }

    const count = await db().healthAppointment.count({ where: { organizationId: orgId } });
    const appointmentNo = `APT-${String(count + 1).padStart(5, "0")}`;

    const conflict = await db().healthAppointment.findFirst({
      where: { doctorId, appointmentDate: new Date(appointmentDate), timeSlot, status: { in: ["SCHEDULED","CONFIRMED"] } },
    });
    if (conflict) { badRequest(res, "This time slot is already booked for the doctor"); return; }

    const appointment = await db().healthAppointment.create({
      data: {
        organizationId: orgId,
        appointmentNo,
        patientId,
        doctorId,
        appointmentDate: new Date(appointmentDate),
        timeSlot,
        type: type || "CONSULTATION",
        chiefComplaint: chiefComplaint || null,
        notes: notes || null,
        fee: fee ? Number(fee) : (doctor.consultationFee ? Number(doctor.consultationFee) : null),
      },
      include: {
        patient: { select: { name: true, patientCode: true, phone: true, email: true } },
        doctor: { select: { name: true, specialization: true } },
      },
    });

    // Send confirmation email to patient (non-blocking)
    if ((appointment.patient as any).email) {
      const apptDate = new Date(appointmentDate).toLocaleDateString("en-IN", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
      sendEmail({
        to: (appointment.patient as any).email,
        subject: `Appointment Confirmed — ${appointmentNo}`,
        html: `
          <div style="font-family:sans-serif;max-width:520px;margin:auto;padding:24px;background:#f8fafc;border-radius:12px;border:1px solid #e2e8f0">
            <div style="background:linear-gradient(135deg,#0f766e,#10b981);padding:20px 24px;border-radius:8px;margin-bottom:20px">
              <h2 style="color:white;margin:0;font-size:20px">🏥 Appointment Confirmed</h2>
              <p style="color:#d1fae5;margin:6px 0 0;font-size:13px">City Care Clinic</p>
            </div>
            <p style="color:#374151;font-size:14px">Dear <strong>${(appointment.patient as any).name}</strong>,</p>
            <p style="color:#374151;font-size:14px">Your appointment has been successfully booked.</p>
            <div style="background:white;border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin:16px 0">
              <table style="width:100%;font-size:13px;color:#374151;border-collapse:collapse">
                <tr><td style="padding:6px 0;color:#6b7280;width:140px">Appointment No</td><td><strong>${appointmentNo}</strong></td></tr>
                <tr><td style="padding:6px 0;color:#6b7280">Doctor</td><td><strong>${(appointment.doctor as any).name}</strong> — ${(appointment.doctor as any).specialization}</td></tr>
                <tr><td style="padding:6px 0;color:#6b7280">Date</td><td><strong>${apptDate}</strong></td></tr>
                <tr><td style="padding:6px 0;color:#6b7280">Time</td><td><strong>${timeSlot}</strong></td></tr>
                ${chiefComplaint ? `<tr><td style="padding:6px 0;color:#6b7280">Complaint</td><td>${chiefComplaint}</td></tr>` : ""}
              </table>
            </div>
            <p style="color:#6b7280;font-size:12px;margin-top:16px">To view your medical records, visit the Patient Portal and enter your patient code: <strong>${(appointment.patient as any).patientCode}</strong></p>
            <p style="color:#9ca3af;font-size:11px;margin-top:20px;border-top:1px solid #e2e8f0;padding-top:16px">City Care Clinic · Please arrive 10 minutes early.</p>
          </div>`,
      }).catch(() => {});
    }

    created(res, appointment, "Appointment booked successfully");
  } catch (err) { serverError(res, err); }
}

export async function updateAppointment(req: OrgRequest, res: Response): Promise<void> {
  try {
    const existing = await db().healthAppointment.findFirst({ where: { id: req.params.id, organizationId: req.organizationId } });
    if (!existing) { notFound(res, "Appointment not found"); return; }

    const allowed = ["status","timeSlot","appointmentDate","chiefComplaint","notes","fee","isPaid","cancelReason","type"];
    const data: any = {};
    for (const f of allowed) {
      if (req.body[f] !== undefined) {
        if (f === "appointmentDate") data[f] = new Date(req.body[f]);
        else if (f === "fee") data[f] = req.body[f] ? Number(req.body[f]) : null;
        else data[f] = req.body[f];
      }
    }
    const updated = await db().healthAppointment.update({ where: { id: req.params.id }, data });
    ok(res, updated);
  } catch (err) { serverError(res, err); }
}

// ────────────────────────────────────────────────────────
//  PATIENT PORTAL (public — no auth)
// ────────────────────────────────────────────────────────

export async function patientPortal(req: Request, res: Response): Promise<void> {
  try {
    const { patientCode, orgSlug } = req.query as { patientCode: string; orgSlug: string };
    if (!patientCode?.trim()) { badRequest(res, "Patient code is required"); return; }

    // Find org by slug if provided
    const orgWhere = orgSlug
      ? { organization: { slug: orgSlug } }
      : {};

    const patient = await db().patient.findFirst({
      where: { patientCode: patientCode.trim().toUpperCase(), isActive: true, ...orgWhere },
      include: {
        organization: { select: { name: true, logo: true, phone: true, email: true } },
        visits: { orderBy: { visitDate: "desc" }, take: 20, select: { id: true, visitDate: true, visitType: true, chiefComplaint: true, diagnosis: true, followUpDate: true, vitalsBP: true, vitalsTemp: true, vitalsPulse: true, vitalsWeight: true } },
        prescriptions: {
          orderBy: { createdAt: "desc" }, take: 10,
          select: { id: true, createdAt: true, medicines: true, instructions: true, diet: true, followUpDays: true, validUntil: true },
        },
        labReports: { orderBy: { conductedAt: "desc" }, take: 10, select: { id: true, testName: true, testCategory: true, interpretation: true, conductedAt: true, normalRange: true } },
        appointments: {
          orderBy: { appointmentDate: "desc" }, take: 10,
          include: { doctor: { select: { name: true, specialization: true } } },
          where: { status: { in: ["SCHEDULED","CONFIRMED","COMPLETED"] } },
        },
      },
    });

    if (!patient) { notFound(res, "No patient found with this code. Please check and try again."); return; }

    // Strip sensitive internal fields
    const { organizationId, ...safePatient } = patient;
    ok(res, safePatient);
  } catch (err) { serverError(res, err); }
}

// ────────────────────────────────────────────────────────
//  HEALTH DASHBOARD STATS
// ────────────────────────────────────────────────────────

// ────────────────────────────────────────────────────────
//  DOCTOR SELF-PROFILE  (matches logged-in user's email → Doctor record)
// ────────────────────────────────────────────────────────

export async function getMyDoctorProfile(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId  = req.organizationId!;
    const userId = req.userId!;

    const user = await db().user.findUnique({ where: { id: userId }, select: { email: true, name: true } });
    if (!user?.email) { notFound(res, "User not found"); return; }

    const now   = new Date();
    const today = new Date(now); today.setHours(0, 0, 0, 0);
    const todayEnd = new Date(today); todayEnd.setHours(23, 59, 59, 999);

    const doctor = await db().doctor.findFirst({
      where: { email: user.email, organizationId: orgId, isActive: true },
      include: {
        // Today's appointments
        appointments: {
          where: { appointmentDate: { gte: today, lte: todayEnd }, status: { in: ["SCHEDULED","CONFIRMED"] } },
          orderBy: { timeSlot: "asc" },
          include: { patient: { select: { id: true, name: true, patientCode: true, phone: true, bloodGroup: true, allergies: true, chronicConds: true } } },
        },
      },
    });

    if (!doctor) { notFound(res, "No doctor profile linked to your account in this organisation"); return; }

    // Also fetch upcoming (next 7 days, excluding today) separately
    const upcomingStart = new Date(todayEnd); upcomingStart.setMilliseconds(1);
    const upcomingEnd   = new Date(today); upcomingEnd.setDate(upcomingEnd.getDate() + 8);

    const upcoming = await db().healthAppointment.findMany({
      where: { doctorId: doctor.id, organizationId: orgId, appointmentDate: { gte: upcomingStart, lte: upcomingEnd }, status: { in: ["SCHEDULED","CONFIRMED"] } },
      orderBy: [{ appointmentDate: "asc" }, { timeSlot: "asc" }],
      include: { patient: { select: { id: true, name: true, patientCode: true, phone: true } } },
    });

    ok(res, { ...doctor, upcomingAppointments: upcoming });
  } catch (err) { serverError(res, err); }
}

// ────────────────────────────────────────────────────────
//  HEALTH DASHBOARD STATS
// ────────────────────────────────────────────────────────

export async function getHealthStats(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [totalPatients, todayVisits, totalPrescriptions, pendingFollowUps] = await Promise.all([
      db().patient.count({ where: { organizationId: orgId, isActive: true } }),
      db().patientVisit.count({ where: { organizationId: orgId, visitDate: { gte: today, lt: tomorrow } } }),
      db().prescription.count({ where: { organizationId: orgId } }),
      db().patientVisit.count({
        where: { organizationId: orgId, followUpDate: { gte: today, lte: new Date(today.getTime() + 7 * 86400000) } },
      }),
    ]);

    ok(res, { totalPatients, todayVisits, totalPrescriptions, pendingFollowUps });
  } catch (err) {
    serverError(res, err);
  }
}
