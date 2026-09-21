/**
 * Seeds "City Care Clinic" with 10 doctors (each with a login),
 * 10 patients, appointments (past + upcoming), prescriptions, visits.
 *
 * Admin login:  admin@citycare.demo   / Clinic@123
 * Doctor login: <firstname>.<lastname>@citycare.demo  / Doctor@123
 * Patient portal: /patient-portal  →  PT-00001 … PT-00010
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const d = (offset: number) => {
  const dt = new Date();
  dt.setDate(dt.getDate() + offset);
  dt.setHours(0, 0, 0, 0);
  return dt;
};
const dt = (offsetDays: number, hour: number, min = 0) => {
  const x = new Date();
  x.setDate(x.getDate() + offsetDays);
  x.setHours(hour, min, 0, 0);
  return x;
};

async function main() {
  /* ── 1. Clean up old demo run ─────────────────────────────── */
  const oldOrg = await prisma.organization.findUnique({ where: { slug: "city-care-clinic" } });
  if (oldOrg) {
    console.log("Removing previous demo org …");
    await prisma.healthAppointment.deleteMany({ where: { organizationId: oldOrg.id } });
    await prisma.prescription.deleteMany({ where: { organizationId: oldOrg.id } });
    await prisma.patientVisit.deleteMany({ where: { organizationId: oldOrg.id } });
    await prisma.doctorDocument.deleteMany({ where: { doctor: { organizationId: oldOrg.id } } });
    await prisma.doctor.deleteMany({ where: { organizationId: oldOrg.id } });
    await prisma.patient.deleteMany({ where: { organizationId: oldOrg.id } });
    await prisma.userModuleAccess.deleteMany({ where: { organizationId: oldOrg.id } });
    await prisma.organizationMember.deleteMany({ where: { organizationId: oldOrg.id } });
    await prisma.organization.delete({ where: { id: oldOrg.id } });
  }

  /* ── 2. Create admin user ─────────────────────────────────── */
  const adminHash  = await bcrypt.hash(process.env.HEALTH_DEMO_ADMIN_PASSWORD  || "Clinic@123", 10);
  const doctorHash = await bcrypt.hash(process.env.HEALTH_DEMO_DOCTOR_PASSWORD || "Doctor@123",  10);

  let adminUser = await prisma.user.findUnique({ where: { email: "admin@citycare.demo" } });
  if (!adminUser) {
    adminUser = await prisma.user.create({
      data: { email: "admin@citycare.demo", name: "Clinic Admin", password: adminHash, isEmailVerified: true },
    });
  }

  /* ── 3. Create organisation ──────────────────────────────── */
  const enabledModules = ["HEALTH", "HR", "CRM", "REPORTS", "ACCOUNTS", "SUPPORT"];
  const org = await prisma.organization.create({
    data: {
      name: "City Care Clinic",
      slug: "city-care-clinic",
      businessType: "HEALTHCARE",
      currency: "INR",
      country: "India",
      enabledModules,
      members: { create: { userId: adminUser.id, role: "OWNER", isActive: true } },
    },
  });
  for (const mk of enabledModules) {
    await prisma.userModuleAccess.upsert({
      where: { userId_organizationId_moduleKey: { userId: adminUser.id, organizationId: org.id, moduleKey: mk } },
      update: {},
      create: { userId: adminUser.id, organizationId: org.id, moduleKey: mk, grantedById: adminUser.id },
    });
  }
  console.log("✅  Org:", org.name);

  /* ── 4. Doctors + their User accounts ────────────────────── */
  const doctorSeeds = [
    { name: "Dr. Priya Sharma",   email: "priya.sharma@citycare.demo",   phone: "9812345670", spec: "General Medicine",         qual: "MBBS, MD (Internal Medicine)",    reg: "MCI-PRY-2014", exp: 10, dept: "OPD",          fee: 400, days: ["MON","TUE","WED","THU","FRI"],       slot: 15, bio: "Expert in primary care, fever, infections, lifestyle diseases and preventive medicine." },
    { name: "Dr. Rajesh Patel",   email: "rajesh.patel@citycare.demo",   phone: "9823456701", spec: "Cardiology",               qual: "MBBS, MD, DM (Cardiology)",       reg: "MCI-RAJ-2009", exp: 15, dept: "Cardiology",    fee: 800, days: ["MON","WED","FRI"],                 slot: 20, bio: "Interventional cardiologist specialising in heart failure, hypertension, ECG & Echo." },
    { name: "Dr. Anita Singh",    email: "anita.singh@citycare.demo",    phone: "9834567012", spec: "Gynecology & Obstetrics",   qual: "MBBS, MS (OB-GYN)",              reg: "MCI-ANI-2016", exp:  8, dept: "Gynecology",    fee: 600, days: ["TUE","THU","SAT"],                 slot: 20, bio: "Women's health, prenatal care, high-risk pregnancies, PCOS and fertility management." },
    { name: "Dr. Suresh Mehta",   email: "suresh.mehta@citycare.demo",   phone: "9845670123", spec: "Orthopedics",              qual: "MBBS, MS (Orthopedics), DNB",     reg: "MCI-SUR-2012", exp: 12, dept: "Orthopedics",   fee: 700, days: ["MON","TUE","WED","THU","FRI","SAT"], slot: 30, bio: "Joint replacement, sports injuries, fractures, spine disorders and arthritis management." },
    { name: "Dr. Kavita Rao",     email: "kavita.rao@citycare.demo",     phone: "9856781234", spec: "Dermatology",              qual: "MBBS, MD (Dermatology)",          reg: "MCI-KAV-2017", exp:  7, dept: "Dermatology",   fee: 500, days: ["MON","WED","FRI","SAT"],            slot: 15, bio: "Skin, hair and nail disorders. ACNE, psoriasis, eczema, cosmetic dermatology." },
    { name: "Dr. Arun Nair",      email: "arun.nair@citycare.demo",      phone: "9867892345", spec: "Neurology",                qual: "MBBS, MD, DM (Neurology)",        reg: "MCI-ARU-2011", exp: 13, dept: "Neurology",     fee: 900, days: ["TUE","THU"],                       slot: 30, bio: "Headache, epilepsy, stroke, Parkinson's disease and movement disorders." },
    { name: "Dr. Deepa Joshi",    email: "deepa.joshi@citycare.demo",    phone: "9878903456", spec: "Pediatrics",               qual: "MBBS, MD (Pediatrics), DCH",      reg: "MCI-DEE-2015", exp:  9, dept: "Pediatrics",    fee: 450, days: ["MON","TUE","WED","THU","FRI"],       slot: 15, bio: "Child health, growth, vaccinations, neonatal care and adolescent medicine." },
    { name: "Dr. Vinod Sharma",   email: "vinod.sharma@citycare.demo",   phone: "9889014567", spec: "Ophthalmology",            qual: "MBBS, MS (Ophthalmology), DOMS",  reg: "MCI-VIN-2013", exp: 11, dept: "Eye Care",       fee: 600, days: ["MON","TUE","WED","FRI"],            slot: 15, bio: "Cataract, glaucoma, retinal diseases, refractive errors and corneal disorders." },
    { name: "Dr. Neha Gupta",     email: "neha.gupta@citycare.demo",     phone: "9890125678", spec: "ENT",                      qual: "MBBS, MS (ENT)",                  reg: "MCI-NEH-2018", exp:  6, dept: "ENT",           fee: 500, days: ["TUE","WED","THU","SAT"],            slot: 15, bio: "Ear, nose and throat disorders, hearing loss, sinusitis, tonsillitis, voice problems." },
    { name: "Dr. Sanjay Patel",   email: "sanjay.patel@citycare.demo",   phone: "9801236789", spec: "Psychiatry",               qual: "MBBS, MD (Psychiatry)",           reg: "MCI-SAN-2010", exp: 14, dept: "Psychiatry",    fee: 800, days: ["MON","WED","FRI"],                 slot: 45, bio: "Depression, anxiety, OCD, schizophrenia, addiction, couples and family therapy." },
  ];

  const doctors: any[] = [];
  for (const ds of doctorSeeds) {
    // Create User account for this doctor
    let u = await prisma.user.findUnique({ where: { email: ds.email } });
    if (!u) {
      u = await prisma.user.create({
        data: { email: ds.email, name: ds.name, password: doctorHash, isEmailVerified: true },
      });
    }
    // Add as STAFF member with HEALTH access
    await prisma.organizationMember.upsert({
      where: { userId_organizationId: { userId: u.id, organizationId: org.id } },
      update: {},
      create: { userId: u.id, organizationId: org.id, role: "STAFF", isActive: true },
    });
    await prisma.userModuleAccess.upsert({
      where: { userId_organizationId_moduleKey: { userId: u.id, organizationId: org.id, moduleKey: "HEALTH" } },
      update: {},
      create: { userId: u.id, organizationId: org.id, moduleKey: "HEALTH", grantedById: adminUser!.id },
    });
    // Create Doctor record
    const doc = await prisma.doctor.create({
      data: {
        organizationId: org.id,
        name: ds.name,
        email: ds.email,
        phone: ds.phone,
        specialization: ds.spec,
        qualification: ds.qual,
        registrationNo: ds.reg,
        experience: ds.exp,
        department: ds.dept,
        consultationFee: ds.fee,
        availableDays: ds.days,
        slotDuration: ds.slot,
        bio: ds.bio,
        isVerified: true,
        verificationStatus: "VERIFIED",
        isActive: true,
      },
    });
    doctors.push(doc);
    console.log("  ✅  Doctor:", doc.name, "→ login:", ds.email);
  }

  const [drPriya, drRajesh, drAnita, drSuresh, drKavita, drArun, drDeepa, drVinod, drNeha, drSanjay] = doctors;

  /* ── 5. Patients ─────────────────────────────────────────── */
  const patientSeeds = [
    { name: "Amit Gupta",        phone: "9876543210", email: "amit.gupta@gmail.com",     dob: "1975-03-20", gender: "MALE",   bg: "O_POS",  addr: "12 MG Road, Mumbai",            allergies: ["Penicillin","Aspirin"],        conds: ["Hypertension","Type 2 Diabetes"],       code: "PT-00001" },
    { name: "Sunita Devi",       phone: "9812340987", email: "sunita.devi@gmail.com",     dob: "1988-07-12", gender: "FEMALE", bg: "A_POS",  addr: "45 Gandhi Nagar, Pune",          allergies: [],                              conds: ["Gestational Diabetes (controlled)"],    code: "PT-00002" },
    { name: "Raju Kumar",        phone: "9823451234", email: "raju.kumar@gmail.com",      dob: "1990-11-05", gender: "MALE",   bg: "B_POS",  addr: "77 LB Colony, Delhi",           allergies: ["Ibuprofen"],                   conds: [],                                       code: "PT-00003" },
    { name: "Meena Shah",        phone: "9834562345", email: "meena.shah@gmail.com",      dob: "1965-01-18", gender: "FEMALE", bg: "AB_POS", addr: "23 Satellite, Ahmedabad",        allergies: [],                              conds: ["Rheumatoid Arthritis","Mild Asthma"],   code: "PT-00004" },
    { name: "Vikram Joshi",      phone: "9845673456", email: "vikram.joshi@gmail.com",    dob: "2000-09-30", gender: "MALE",   bg: "O_NEG",  addr: "56 Banjara Hills, Hyderabad",   allergies: [],                              conds: [],                                       code: "PT-00005" },
    { name: "Geeta Krishnan",    phone: "9856784567", email: "geeta.k@gmail.com",         dob: "1982-04-25", gender: "FEMALE", bg: "B_NEG",  addr: "8 Anna Nagar, Chennai",          allergies: ["Sulfa drugs"],                 conds: ["PCOS","Hypothyroidism"],                code: "PT-00006" },
    { name: "Arjun Shah",        phone: "9867895678", email: "arjun.shah@gmail.com",      dob: "1995-12-10", gender: "MALE",   bg: "A_NEG",  addr: "34 Koramangala, Bengaluru",      allergies: [],                              conds: [],                                       code: "PT-00007" },
    { name: "Rekha Pandey",      phone: "9878906789", email: "rekha.p@gmail.com",         dob: "1958-06-03", gender: "FEMALE", bg: "O_POS",  addr: "67 Civil Lines, Lucknow",        allergies: ["Codeine"],                     conds: ["Osteoporosis","Type 2 Diabetes","GERD"], code: "PT-00008" },
    { name: "Mohan Lal",         phone: "9889017890", email: "mohan.lal@gmail.com",       dob: "1970-08-14", gender: "MALE",   bg: "AB_NEG", addr: "19 New Palasia, Indore",         allergies: [],                              conds: ["Epilepsy","Depression"],                code: "PT-00009" },
    { name: "Baby Rohan Kumar",  phone: "9890128901", email: "rohan.parent@gmail.com",    dob: "2020-02-20", gender: "MALE",   bg: "B_POS",  addr: "3 Salt Lake, Kolkata",           allergies: ["Lactose"],                     conds: [],                                       code: "PT-00010" },
  ];

  const patients: any[] = [];
  for (const ps of patientSeeds) {
    const pat = await prisma.patient.create({
      data: {
        organizationId: org.id,
        patientCode: ps.code,
        name: ps.name,
        phone: ps.phone,
        email: ps.email,
        dob: new Date(ps.dob),
        gender: ps.gender as any,
        bloodGroup: ps.bg as any,
        address: ps.addr,
        allergies: ps.allergies,
        chronicConds: ps.conds,
      },
    });
    patients.push(pat);
    console.log("  ✅  Patient:", pat.name, "(", pat.patientCode, ")");
  }

  const [amit, sunita, raju, meena, vikram, geeta, arjun, rekha, mohan, rohan] = patients;

  /* ── 6. Appointments (past + UPCOMING) ────────────────────── */
  const appts = [
    // ── Past (completed) ──
    { pt: amit,   dr: drRajesh, date: dt(-10,10),  slot: "10:00 AM", type: "CONSULTATION", status: "COMPLETED", complaint: "Chest pain on exertion, fatigue",                  fee: 800,  no: "APT-00001" },
    { pt: sunita, dr: drAnita,  date: dt(-5, 11),  slot: "11:00 AM", type: "CONSULTATION", status: "COMPLETED", complaint: "Routine prenatal check-up — 28 weeks",              fee: 600,  no: "APT-00002" },
    { pt: raju,   dr: drSuresh, date: dt(-3, 14),  slot: "02:00 PM", type: "CONSULTATION", status: "COMPLETED", complaint: "Right knee pain 3 weeks, difficulty climbing stairs", fee: 700, no: "APT-00003" },
    { pt: meena,  dr: drPriya,  date: dt(-7, 9,30),slot: "09:30 AM", type: "CONSULTATION", status: "COMPLETED", complaint: "Breathlessness, morning joint stiffness",            fee: 400,  no: "APT-00004" },
    { pt: vikram, dr: drPriya,  date: dt(-2, 10,30),slot:"10:30 AM", type: "CONSULTATION", status: "COMPLETED", complaint: "High fever 103°F for 2 days, sore throat",           fee: 400,  no: "APT-00005" },
    { pt: geeta,  dr: drAnita,  date: dt(-6, 11,30),slot:"11:30 AM", type: "CONSULTATION", status: "COMPLETED", complaint: "Irregular periods, weight gain, hair loss",           fee: 600,  no: "APT-00006" },
    { pt: rekha,  dr: drArun,   date: dt(-4, 15),  slot: "03:00 PM", type: "CONSULTATION", status: "COMPLETED", complaint: "Severe headache, numbness in left hand",            fee: 900,  no: "APT-00007" },
    { pt: mohan,  dr: drSanjay, date: dt(-8, 16),  slot: "04:00 PM", type: "CONSULTATION", status: "COMPLETED", complaint: "Persistent low mood, sleep disturbance",             fee: 800,  no: "APT-00008" },
    { pt: arjun,  dr: drKavita, date: dt(-1, 13),  slot: "01:00 PM", type: "CONSULTATION", status: "COMPLETED", complaint: "Acne, oily skin, facial scarring",                  fee: 500,  no: "APT-00009" },
    { pt: rohan,  dr: drDeepa,  date: dt(-3, 10),  slot: "10:00 AM", type: "CONSULTATION", status: "COMPLETED", complaint: "Fever 102°F, vomiting, loose stools (infant)",       fee: 450,  no: "APT-00010" },

    // ── UPCOMING (scheduled / confirmed) ──
    { pt: amit,   dr: drRajesh, date: dt(1, 10),   slot: "10:00 AM", type: "FOLLOW_UP",    status: "CONFIRMED",  complaint: "Follow-up after ECG & stress test",               fee: 800,  no: "APT-00011" },
    { pt: sunita, dr: drAnita,  date: dt(2, 11),   slot: "11:00 AM", type: "FOLLOW_UP",    status: "SCHEDULED", complaint: "32-week prenatal follow-up + glucose report",       fee: 600,  no: "APT-00012" },
    { pt: raju,   dr: drSuresh, date: dt(3, 14),   slot: "02:00 PM", type: "FOLLOW_UP",    status: "SCHEDULED", complaint: "Post-MRI review, knee rehabilitation assessment",   fee: 700,  no: "APT-00013" },
    { pt: meena,  dr: drPriya,  date: dt(1, 9,30), slot: "09:30 AM", type: "FOLLOW_UP",    status: "CONFIRMED",  complaint: "RA management — ESR/CRP results review",           fee: 400,  no: "APT-00014" },
    { pt: geeta,  dr: drAnita,  date: dt(5, 11),   slot: "11:00 AM", type: "FOLLOW_UP",    status: "SCHEDULED", complaint: "PCOS treatment response, thyroid report",           fee: 600,  no: "APT-00015" },
    { pt: rekha,  dr: drArun,   date: dt(4, 15),   slot: "03:00 PM", type: "FOLLOW_UP",    status: "SCHEDULED", complaint: "Neurology follow-up — MRI brain results",           fee: 900,  no: "APT-00016" },
    { pt: mohan,  dr: drSanjay, date: dt(6, 16),   slot: "04:00 PM", type: "FOLLOW_UP",    status: "SCHEDULED", complaint: "Psychiatric review — medication response",           fee: 800,  no: "APT-00017" },
    { pt: arjun,  dr: drKavita, date: dt(7, 13),   slot: "01:00 PM", type: "FOLLOW_UP",    status: "SCHEDULED", complaint: "Acne treatment 4-week review",                      fee: 500,  no: "APT-00018" },
    { pt: vikram, dr: drNeha,   date: dt(2, 12),   slot: "12:00 PM", type: "CONSULTATION", status: "SCHEDULED", complaint: "Recurrent sore throat, hearing difficulty",         fee: 500,  no: "APT-00019" },
    { pt: rohan,  dr: drDeepa,  date: dt(1, 10,30),slot:"10:30 AM",  type: "FOLLOW_UP",    status: "CONFIRMED",  complaint: "Infant follow-up — weight check + vaccination",   fee: 450,  no: "APT-00020" },
    { pt: rekha,  dr: drVinod,  date: dt(10, 11),  slot: "11:00 AM", type: "CONSULTATION", status: "SCHEDULED", complaint: "Blurry vision, difficulty in night driving",        fee: 600,  no: "APT-00021" },
    { pt: mohan,  dr: drArun,   date: dt(14, 15),  slot: "03:00 PM", type: "CONSULTATION", status: "SCHEDULED", complaint: "Seizure episode last week — review & EEG",          fee: 900,  no: "APT-00022" },
  ];

  for (const a of appts) {
    await prisma.healthAppointment.create({
      data: {
        organizationId: org.id,
        appointmentNo: a.no,
        patientId: a.pt.id,
        doctorId: a.dr.id,
        appointmentDate: a.date,
        timeSlot: a.slot,
        type: a.type as any,
        status: a.status as any,
        chiefComplaint: a.complaint,
        fee: a.fee,
        isPaid: a.status === "COMPLETED",
      },
    });
  }
  console.log("  ✅  22 appointments (10 past + 12 upcoming)");

  /* ── 7. Patient Visits ───────────────────────────────────── */
  const visits = [
    { pt: amit,   dr: drRajesh, date: dt(-10,10), complaint: "Chest tightness on walking", diagnosis: "Hypertensive heart disease, stable angina", notes: "ECG ordered. Stress test scheduled. Continue Amlodipine.", bp: "148/92", temp: 37.0, wt: 82 },
    { pt: sunita, dr: drAnita,  date: dt(-5, 11), complaint: "Mild back pain, normal foetal movement", diagnosis: "Pregnancy 28 weeks — normal progress", notes: "Iron + folic acid continued. GTT ordered.", bp: "110/72", temp: 36.9, wt: 68 },
    { pt: raju,   dr: drSuresh, date: dt(-3, 14), complaint: "Knee swelling, locking, pain on flexion", diagnosis: "Medial meniscus tear (right knee) Grade 2", notes: "MRI ordered. RICE + knee brace. NSAIDs 7 days.", bp: "120/78", temp: 37.0, wt: 75 },
    { pt: meena,  dr: drPriya,  date: dt(-7, 9),  complaint: "Morning stiffness >1hr, finger swelling, wheeze", diagnosis: "RA flare + mild COPD exacerbation", notes: "MTX dose reviewed. Salbutamol inhaler. ESR/CRP ordered.", bp: "126/82", temp: 37.1, wt: 61 },
    { pt: vikram, dr: drPriya,  date: dt(-2, 10), complaint: "Fever 103°F 2 days, sore throat, body ache", diagnosis: "Viral pharyngitis", notes: "No antibiotics. Paracetamol + Betadine gargle. Rest.", bp: "118/74", temp: 39.4, wt: 70 },
    { pt: geeta,  dr: drAnita,  date: dt(-6, 11), complaint: "Irregular periods, weight gain, hair loss", diagnosis: "PCOS + subclinical hypothyroidism", notes: "Thyroid profile + pelvic USG ordered. Metformin started.", bp: "115/76", temp: 36.8, wt: 74 },
    { pt: rekha,  dr: drArun,   date: dt(-4, 15), complaint: "Severe headache, left hand numbness", diagnosis: "TIA (Transient Ischaemic Attack) — under investigation", notes: "CT brain done. MRI + carotid doppler ordered. Aspirin started.", bp: "162/96", temp: 37.2, wt: 66 },
    { pt: mohan,  dr: drSanjay, date: dt(-8, 16), complaint: "Persistent low mood 6 months, insomnia", diagnosis: "Major Depressive Disorder, moderate severity", notes: "Escitalopram 10mg started. CBT referral given. 2-week review.", bp: "124/80", temp: 37.0, wt: 78 },
    { pt: arjun,  dr: drKavita, date: dt(-1, 13), complaint: "Acne, oily skin, post-acne scars on cheeks", diagnosis: "Acne vulgaris Grade 3", notes: "Topical retinoid + antibiotic. Chemical peel in 4 weeks.", bp: "118/76", temp: 36.9, wt: 71 },
    { pt: rohan,  dr: drDeepa,  date: dt(-3, 10), complaint: "Fever 102°F, vomiting, loose stools", diagnosis: "Acute gastroenteritis (probable viral)", notes: "ORS, Zinc syrup. Breast/formula feed continue. ReSoMal if severe.", bp: "88/54", temp: 38.9, wt: 9 },
  ];

  const visitIdMap: Record<string, string> = {};
  for (const v of visits) {
    const visit = await prisma.patientVisit.create({
      data: {
        organizationId: org.id,
        patientId: v.pt.id,
        visitDate: v.date,
        visitType: "OPD",
        doctorId: v.dr.id,
        chiefComplaint: v.complaint,
        diagnosis: v.diagnosis,
        notes: v.notes,
        vitalsBP: v.bp,
        vitalsTemp: v.temp,
        vitalsWeight: v.wt,
        followUpDate: d(7),
      },
    });
    visitIdMap[v.pt.id] = visit.id;
  }
  console.log("  ✅  10 visit notes");

  /* ── 8. Prescriptions ────────────────────────────────────── */
  const rxs = [
    { pt: amit,   dr: drRajesh, medicines: [
        { name: "Amlodipine", dosage: "5mg", frequency: "Once daily", duration: "30 days", note: "Take in the morning" },
        { name: "Atorvastatin", dosage: "20mg", frequency: "Once at night", duration: "30 days", note: "After dinner" },
        { name: "Aspirin", dosage: "75mg", frequency: "Once daily", duration: "30 days", note: "With food" },
      ], instructions: "Avoid alcohol. Monitor BP daily.", followUpDays: 14 },
    { pt: sunita, dr: drAnita,  medicines: [
        { name: "Ferrous Sulphate", dosage: "200mg", frequency: "Twice daily", duration: "30 days", note: "After meals" },
        { name: "Folic Acid", dosage: "5mg", frequency: "Once daily", duration: "30 days", note: "Morning" },
        { name: "Calcium + Vit D3", dosage: "500mg+400IU", frequency: "Twice daily", duration: "30 days", note: "With meals" },
      ], instructions: "Monitor blood sugar 2x daily. Avoid sugar, white rice.", followUpDays: 21 },
    { pt: raju,   dr: drSuresh, medicines: [
        { name: "Diclofenac", dosage: "50mg", frequency: "Twice daily", duration: "7 days", note: "With food" },
        { name: "Pantoprazole", dosage: "40mg", frequency: "Once daily", duration: "7 days", note: "Before meals" },
        { name: "Etoricoxib", dosage: "60mg", frequency: "Once daily evening", duration: "5 days", note: "With food" },
      ], instructions: "Ice 3x/day. Avoid stairs. Crutches 2 weeks.", followUpDays: 14 },
    { pt: meena,  dr: drPriya,  medicines: [
        { name: "Methotrexate", dosage: "10mg", frequency: "Once a week (Monday)", duration: "4 weeks", note: "With food" },
        { name: "Folic Acid", dosage: "5mg", frequency: "6 days/week (skip MTX day)", duration: "4 weeks", note: "Reduces side effects" },
        { name: "Salbutamol Inhaler", dosage: "100mcg", frequency: "2 puffs SOS", duration: "Till review", note: "Use when breathless" },
        { name: "Prednisolone", dosage: "10mg", frequency: "Once daily morning", duration: "5 days", note: "Taper as advised" },
      ], instructions: "Avoid cold, dusty environments. ESR/CRP by 3 days.", followUpDays: 10 },
    { pt: vikram, dr: drPriya,  medicines: [
        { name: "Paracetamol", dosage: "650mg", frequency: "Thrice daily SOS", duration: "3 days", note: "When fever >100°F" },
        { name: "Betadine Gargle", dosage: "10ml", frequency: "Thrice daily", duration: "5 days", note: "Dilute, gargle 30 sec" },
        { name: "Cetirizine", dosage: "10mg", frequency: "Once at night", duration: "3 days", note: "For sore throat" },
      ], instructions: "Viral — no antibiotics. Rest, warm fluids.", followUpDays: undefined },
    { pt: geeta,  dr: drAnita,  medicines: [
        { name: "Metformin", dosage: "500mg", frequency: "Twice daily with meals", duration: "30 days", note: "For PCOS insulin resistance" },
        { name: "Levothyroxine", dosage: "25mcg", frequency: "Once daily empty stomach", duration: "30 days", note: "Take 30 min before breakfast" },
        { name: "Inositol", dosage: "2g", frequency: "Once daily", duration: "30 days", note: "Supplement for PCOS" },
      ], instructions: "Low-carb diet. 30 min exercise daily. Repeat thyroid after 6 weeks.", followUpDays: 30 },
    { pt: rekha,  dr: drArun,   medicines: [
        { name: "Aspirin", dosage: "150mg", frequency: "Once daily", duration: "Till review", note: "Anti-platelet — do not stop without doctor advice" },
        { name: "Atorvastatin", dosage: "40mg", frequency: "Once at night", duration: "Till review", note: "Lipid management" },
        { name: "Amlodipine", dosage: "5mg", frequency: "Once daily morning", duration: "30 days", note: "BP control" },
      ], instructions: "Avoid driving. Complete rest. Return immediately if symptoms recur.", followUpDays: 7 },
    { pt: mohan,  dr: drSanjay, medicines: [
        { name: "Escitalopram", dosage: "10mg", frequency: "Once daily morning", duration: "30 days", note: "Takes 2-4 weeks to show effect" },
        { name: "Clonazepam", dosage: "0.25mg", frequency: "Once at bedtime SOS", duration: "2 weeks", note: "For sleep — do not take with alcohol" },
        { name: "Vitamin D3", dosage: "60,000 IU", frequency: "Once a week", duration: "8 weeks", note: "With food" },
      ], instructions: "Do not stop abruptly. CBT sessions twice weekly. Avoid alcohol.", followUpDays: 14 },
    { pt: arjun,  dr: drKavita, medicines: [
        { name: "Adapalene 0.1% Gel", dosage: "Pea-sized amount", frequency: "Once at night", duration: "12 weeks", note: "Apply on affected area, not around eyes" },
        { name: "Clindamycin 1% Gel", dosage: "Thin layer", frequency: "Twice daily", duration: "12 weeks", note: "Morning & night" },
        { name: "Sunscreen SPF 50+", dosage: "2 finger lengths", frequency: "Every 2-3 hours outdoors", duration: "Ongoing", note: "Non-comedogenic formula" },
      ], instructions: "No picking/squeezing. Clean face twice daily. Review in 4 weeks.", followUpDays: 28 },
    { pt: rohan,  dr: drDeepa,  medicines: [
        { name: "ORS Sachets", dosage: "1 sachet in 200ml water", frequency: "After each loose stool", duration: "Till diarrhoea stops", note: "Give slowly with spoon" },
        { name: "Zinc Syrup", dosage: "2ml (10mg)", frequency: "Once daily", duration: "14 days", note: "Prevents recurrence" },
        { name: "Racecadotril Drops", dosage: "10mg (1ml)", frequency: "Thrice daily", duration: "5 days", note: "With water after feeds" },
      ], instructions: "Continue breastfeeding. Monitor for dehydration signs. Return if not improving in 48 hrs.", followUpDays: 3 },
  ];

  for (const rx of rxs) {
    await prisma.prescription.create({
      data: {
        organizationId: org.id,
        patientId: rx.pt.id,
        visitId: visitIdMap[rx.pt.id],
        doctorId: rx.dr.id,
        medicines: rx.medicines,
        instructions: rx.instructions,
        followUpDays: rx.followUpDays,
      },
    });
  }
  console.log("  ✅  10 prescriptions");

  console.log(`
🎉  Health demo complete!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Admin:   admin@citycare.demo  /  Clinic@123
  Doctors: <name>@citycare.demo /  Doctor@123
           e.g. priya.sharma@citycare.demo
  Patients: PT-00001 … PT-00010
  Upcoming: APT-00011 … APT-00022
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

  await prisma.$disconnect();
}

main().catch(console.error);
