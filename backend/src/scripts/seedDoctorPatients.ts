import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const ORG_SLUG = "city-care-clinic";
const PATIENTS_PER_DOCTOR = 22;

const DOCTORS = [
  { name: "Dr. Rohit Verma",    specialization: "Orthopedics",       qualification: "MBBS, MS (Orthopedics)",        registrationNo: "MCI-NEWDOC-1001", department: "Orthopedics",       fee: 700, exp: 9,  days: ["MON","WED","FRI"],                 complaint: "Knee/joint pain and mobility assessment",       diagnosis: "Osteoarthritis — mild to moderate",              medicines: [{ name: "Aceclofenac",  dosage: "100mg", frequency: "1-0-1", duration: "5 days" }, { name: "Calcium + Vit D3", dosage: "500mg", frequency: "0-1-0", duration: "30 days" }] },
  { name: "Dr. Meera Kulkarni", specialization: "Gynecology",        qualification: "MBBS, MD (OBG)",                registrationNo: "MCI-NEWDOC-1002", department: "Gynecology",        fee: 650, exp: 11, days: ["TUE","THU","SAT"],                 complaint: "Routine antenatal / gynecological checkup",      diagnosis: "Normal antenatal profile",                       medicines: [{ name: "Folic Acid",   dosage: "5mg",   frequency: "0-1-0", duration: "30 days" }, { name: "Iron + Folic",     dosage: "1 tab", frequency: "1-0-0", duration: "30 days" }] },
  { name: "Dr. Aditya Rao",     specialization: "General Medicine",  qualification: "MBBS, MD (Internal Medicine)",  registrationNo: "MCI-NEWDOC-1003", department: "OPD",               fee: 400, exp: 6,  days: ["MON","TUE","WED","THU","FRI"],     complaint: "Fever, body ache and cold",                      diagnosis: "Viral fever",                                     medicines: [{ name: "Paracetamol",  dosage: "500mg", frequency: "1-1-1", duration: "3 days" }, { name: "Cetirizine",       dosage: "10mg",  frequency: "0-0-1", duration: "5 days" }] },
  { name: "Dr. Kavya Iyer",     specialization: "Dermatology",       qualification: "MBBS, MD (Dermatology)",        registrationNo: "MCI-NEWDOC-1004", department: "Dermatology",       fee: 500, exp: 8,  days: ["MON","WED","FRI","SAT"],           complaint: "Skin rash and itching",                          diagnosis: "Allergic contact dermatitis",                     medicines: [{ name: "Levocetirizine", dosage: "5mg", frequency: "0-0-1", duration: "7 days" }, { name: "Calamine Lotion", dosage: "Apply", frequency: "2x/day", duration: "7 days" }] },
  { name: "Dr. Naveen Chauhan", specialization: "Cardiology",        qualification: "MBBS, DM (Cardiology)",         registrationNo: "MCI-NEWDOC-1005", department: "Cardiology",        fee: 900, exp: 14, days: ["TUE","THU"],                       complaint: "Chest discomfort and routine BP review",         diagnosis: "Essential hypertension — controlled",             medicines: [{ name: "Telmisartan",  dosage: "40mg",  frequency: "1-0-0", duration: "30 days" }, { name: "Atorvastatin",     dosage: "10mg",  frequency: "0-0-1", duration: "30 days" }] },
  { name: "Dr. Sneha Bansal",   specialization: "Pediatrics",        qualification: "MBBS, MD (Pediatrics)",         registrationNo: "MCI-NEWDOC-1006", department: "Pediatrics",        fee: 450, exp: 7,  days: ["MON","TUE","WED","THU","FRI"],     complaint: "Growth check and vaccination follow-up",          diagnosis: "Healthy growth — vaccination up to date",         medicines: [{ name: "Vitamin D3 drops", dosage: "400IU", frequency: "0-1-0", duration: "30 days" }] },
];

const FIRST_M = ["Aarav","Vivaan","Aditya","Vihaan","Arjun","Sai","Reyansh","Ayaan","Krishna","Ishaan","Rudra","Yash","Aryan","Kabir","Dev","Rehan","Vedant","Shaurya","Atharv","Ansh","Manish","Rakesh","Deepak","Sanjay","Vikas","Naveen","Prashant","Anil","Sunil","Ramesh","Mahesh","Ganesh","Vijay","Ajay","Rohit","Rahul","Amit","Sumit","Manoj","Alok","Harsh","Nikhil","Tarun","Gaurav","Siddharth"];
const FIRST_F = ["Ananya","Diya","Ira","Myra","Sara","Aadhya","Kiara","Anika","Navya","Pari","Riya","Ishita","Tara","Aditi","Meera","Kavya","Priya","Neha","Pooja","Sunita","Rekha","Anjali","Swati","Preeti","Nisha","Kirti","Divya","Shreya","Sneha","Bhavna","Rachna","Simran","Komal","Radha","Lakshmi","Geeta","Sarita","Jyoti","Manju","Usha","Ritu","Sonal","Payal","Vandana","Shalini"];
const LAST = ["Sharma","Verma","Gupta","Patel","Reddy","Rao","Nair","Iyer","Menon","Joshi","Mehta","Shah","Chopra","Malhotra","Kapoor","Bhatt","Desai","Pillai","Kulkarni","Agarwal","Bansal","Chauhan","Yadav","Mishra","Tripathi","Pandey","Dubey","Saxena","Trivedi","Sinha","Ghosh","Das","Bose","Roy","Sen","Chatterjee","Dutta","Kaur","Singh","Thakur"];
const CITIES = ["Mumbai","Pune","Delhi","Bengaluru","Hyderabad","Chennai","Kolkata","Ahmedabad","Jaipur","Lucknow","Indore","Nagpur","Surat","Bhopal","Patna","Ranchi","Kanpur","Nashik"];
const BLOOD_GROUPS = ["A_POS","A_NEG","B_POS","B_NEG","AB_POS","AB_NEG","O_POS","O_NEG"];
const ALLERGY_POOL = ["Penicillin","Aspirin","Sulfa drugs","Peanuts","Dust","Ibuprofen","Latex","Pollen"];
const COND_POOL = ["Hypertension","Type 2 Diabetes","Asthma","Hypothyroidism","Migraine"];
const TIME_SLOTS = ["09:00-09:30","09:30-10:00","10:00-10:30","10:30-11:00","11:00-11:30","11:30-12:00","14:00-14:30","14:30-15:00","15:00-15:30","15:30-16:00","16:00-16:30","16:30-17:00"];

function pick<T>(arr: T[], i: number): T { return arr[i % arr.length]; }
function rand<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function randDob(): Date {
  const year = 1950 + Math.floor(Math.random() * 66); // 1950-2015
  const month = Math.floor(Math.random() * 12);
  const day = 1 + Math.floor(Math.random() * 28);
  return new Date(year, month, day);
}
function pad(n: number, width: number): string { return String(n).padStart(width, "0"); }

async function main() {
  const org = await prisma.organization.findUnique({ where: { slug: ORG_SLUG }, select: { id: true, name: true } });
  if (!org) throw new Error(`Organization with slug "${ORG_SLUG}" not found`);
  console.log(`Seeding into org: ${org.name} (${org.id})`);

  let patientCount = await prisma.patient.count({ where: { organizationId: org.id } });
  let apptCount = await prisma.healthAppointment.count({ where: { organizationId: org.id } });
  let globalNameIndex = 0;

  let totalPatients = 0, totalAppointments = 0, totalVisits = 0, totalPrescriptions = 0;

  for (const docSpec of DOCTORS) {
    const doctor = await prisma.doctor.create({
      data: {
        organizationId: org.id,
        name: docSpec.name,
        email: docSpec.name.toLowerCase().replace(/^dr\.\s*/, "").replace(/\s+/g, ".") + "@citycare.demo",
        phone: `98${pad(10000000 + globalNameIndex * 7, 8)}`,
        specialization: docSpec.specialization,
        qualification: docSpec.qualification,
        registrationNo: docSpec.registrationNo,
        experience: docSpec.exp,
        department: docSpec.department,
        consultationFee: docSpec.fee,
        availableDays: docSpec.days,
        slotDuration: 30,
        bio: `${docSpec.specialization} specialist with ${docSpec.exp} years of experience.`,
        isVerified: true,
        verificationStatus: "VERIFIED",
      },
    });
    console.log(`\n✅ Doctor created: ${doctor.name} (${doctor.specialization})`);

    for (let i = 0; i < PATIENTS_PER_DOCTOR; i++) {
      const isMale = globalNameIndex % 2 === 0;
      const first = isMale ? pick(FIRST_M, globalNameIndex) : pick(FIRST_F, globalNameIndex);
      const last = pick(LAST, globalNameIndex + 3);
      const name = `${first} ${last}`;
      globalNameIndex++;
      patientCount++;

      const patientCode = `PT-${pad(patientCount, 5)}`;
      const dob = randDob();
      const hasAllergy = Math.random() < 0.35;
      const hasCond = Math.random() < 0.3;

      const patient = await prisma.patient.create({
        data: {
          organizationId: org.id,
          patientCode,
          name,
          dob,
          gender: isMale ? "MALE" : "FEMALE",
          bloodGroup: rand(BLOOD_GROUPS) as any,
          phone: `9${pad(700000000 + patientCount * 3, 9)}`,
          email: `${first.toLowerCase()}.${last.toLowerCase()}${patientCount}@gmail.com`,
          address: `${1 + (patientCount % 90)} ${rand(["MG Road","Park Street","Civil Lines","Ring Road","Station Road","Model Town","Gandhi Nagar"])}, ${pick(CITIES, patientCount)}`,
          allergies: hasAllergy ? [rand(ALLERGY_POOL)] : [],
          chronicConds: hasCond ? [rand(COND_POOL)] : [],
        },
      });
      totalPatients++;

      // Appointment with this patient's assigned doctor
      apptCount++;
      const daysOffset = Math.floor(Math.random() * 40) - 20; // -20..+19 days from today
      const appointmentDate = new Date();
      appointmentDate.setDate(appointmentDate.getDate() + daysOffset);
      const status = daysOffset < -2 ? "COMPLETED" : daysOffset < 0 ? "COMPLETED" : daysOffset === 0 ? "CONFIRMED" : "SCHEDULED";

      await prisma.healthAppointment.create({
        data: {
          organizationId: org.id,
          appointmentNo: `APT-${pad(apptCount, 5)}`,
          patientId: patient.id,
          doctorId: doctor.id,
          appointmentDate,
          timeSlot: pick(TIME_SLOTS, patientCount),
          type: "CONSULTATION",
          status: status as any,
          chiefComplaint: docSpec.complaint,
          fee: docSpec.fee,
          isPaid: status === "COMPLETED",
        },
      });
      totalAppointments++;

      // Visit record for completed encounters
      if (status === "COMPLETED") {
        const visit = await prisma.patientVisit.create({
          data: {
            organizationId: org.id,
            patientId: patient.id,
            visitDate: appointmentDate,
            visitType: "OPD",
            doctorId: doctor.id,
            chiefComplaint: docSpec.complaint,
            diagnosis: docSpec.diagnosis,
            vitalsBP: `${110 + (patientCount % 20)}/${70 + (patientCount % 12)}`,
            vitalsPulse: 68 + (patientCount % 25),
            vitalsTemp: 36.5 + (patientCount % 10) / 10,
            vitalsWeight: 45 + (patientCount % 40),
            notes: `Reviewed by ${doctor.name}. ${docSpec.diagnosis}.`,
            followUpDate: Math.random() < 0.5 ? new Date(appointmentDate.getTime() + 14 * 86400000) : null,
          },
        });
        totalVisits++;

        // Prescription for ~55% of completed visits
        if (Math.random() < 0.55) {
          await prisma.prescription.create({
            data: {
              organizationId: org.id,
              patientId: patient.id,
              visitId: visit.id,
              doctorId: doctor.id,
              medicines: docSpec.medicines,
              instructions: "Take medicines after food. Stay hydrated.",
              diet: "Light, home-cooked meals; avoid oily/spicy food.",
              followUpDays: 7,
              validUntil: new Date(appointmentDate.getTime() + 14 * 86400000),
            },
          });
          totalPrescriptions++;
        }
      }
    }
    console.log(`   → ${PATIENTS_PER_DOCTOR} patients added for ${doctor.name}`);
  }

  console.log(`\n✅ Done. Created ${DOCTORS.length} doctors, ${totalPatients} patients, ${totalAppointments} appointments, ${totalVisits} visits, ${totalPrescriptions} prescriptions.`);
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); prisma.$disconnect(); process.exit(1); });
