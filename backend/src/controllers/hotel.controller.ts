import { Response } from "express";
import { prisma } from "../lib/prisma";
import { ok, created, badRequest, notFound, serverError } from "../utils/response";
import { AuthRequest } from "../middleware/auth";

const db = prisma as any;

function orgId(req: AuthRequest) {
  return (req as any).organizationId as string;
}

function nextSeq(prefix: string, count: number) {
  return `${prefix}-${String(count + 1).padStart(5, "0")}`;
}

async function generateRoomNumbers(org: string, typeName: string, count: number): Promise<string[]> {
  const prefix = (typeName.trim().slice(0, 3).toUpperCase().replace(/[^A-Z]/g, "") || "RM");
  const existing = await db.hotelRoom.findMany({
    where: { organizationId: org, roomNumber: { startsWith: `${prefix}-` } },
    select: { roomNumber: true },
  });
  const usedNums = existing
    .map((r: any) => parseInt(r.roomNumber.split("-")[1], 10))
    .filter((n: number) => !isNaN(n));
  let next = usedNums.length ? Math.max(...usedNums) + 1 : 1;
  const numbers: string[] = [];
  for (let i = 0; i < count; i++) numbers.push(`${prefix}-${next + i}`);
  return numbers;
}

// ═══════════════════════════════════════════════════════════════
//  ROOM TYPES
// ═══════════════════════════════════════════════════════════════

export async function getRoomTypes(req: AuthRequest, res: Response) {
  try {
    const org = orgId(req);
    if (!org) return badRequest(res, "Organization required");
    const types = await db.roomType.findMany({
      where: { organizationId: org, isActive: true },
      include: { _count: { select: { rooms: true } } },
      orderBy: { basePrice: "asc" },
    });
    ok(res, types);
  } catch (e) { serverError(res, e); }
}

export async function createRoomType(req: AuthRequest, res: Response) {
  try {
    const org = orgId(req);
    if (!org) return badRequest(res, "Organization required");
    const { name, description, basePrice, capacity, bedType, amenities, roomCount, floor } = req.body;
    if (!name || basePrice === undefined) return badRequest(res, "name and basePrice required");
    const rt = await db.roomType.create({
      data: { organizationId: org, name, description, basePrice, capacity: capacity || 2, bedType, amenities: amenities || [] },
    });

    const count = parseInt(roomCount, 10) || 0;
    let roomsCreated = 0;
    if (count > 0) {
      const numbers = await generateRoomNumbers(org, name, count);
      await db.hotelRoom.createMany({
        data: numbers.map(roomNumber => ({
          organizationId: org, roomNumber, roomTypeId: rt.id, floor: parseInt(floor, 10) || 1,
        })),
      });
      roomsCreated = numbers.length;
    }

    created(res, { ...rt, roomsCreated }, roomsCreated > 0 ? `Room type created with ${roomsCreated} rooms` : "Room type created");
  } catch (e) { serverError(res, e); }
}

export async function updateRoomType(req: AuthRequest, res: Response) {
  try {
    const org = orgId(req);
    const { id } = req.params;
    const existing = await db.roomType.findFirst({ where: { id, organizationId: org } });
    if (!existing) return notFound(res, "Room type not found");
    const { name, description, basePrice, capacity, bedType, amenities, isActive } = req.body;
    const rt = await db.roomType.update({
      where: { id }, data: { name, description, basePrice, capacity, bedType, amenities, isActive },
    });
    ok(res, rt, "Room type updated");
  } catch (e) { serverError(res, e); }
}

// ═══════════════════════════════════════════════════════════════
//  ROOMS
// ═══════════════════════════════════════════════════════════════

export async function getRooms(req: AuthRequest, res: Response) {
  try {
    const org = orgId(req);
    if (!org) return badRequest(res, "Organization required");
    const { status, floor } = req.query as Record<string, string>;
    const where: any = { organizationId: org, isActive: true };
    if (status) where.status = status;
    if (floor)  where.floor  = parseInt(floor);
    const rooms = await db.hotelRoom.findMany({
      where,
      include: { roomType: true },
      orderBy: [{ floor: "asc" }, { roomNumber: "asc" }],
    });
    ok(res, rooms);
  } catch (e) { serverError(res, e); }
}

export async function createRoom(req: AuthRequest, res: Response) {
  try {
    const org = orgId(req);
    if (!org) return badRequest(res, "Organization required");
    const { roomNumber, roomTypeId, floor, notes } = req.body;
    if (!roomNumber || !roomTypeId) return badRequest(res, "roomNumber and roomTypeId required");
    const existing = await db.hotelRoom.findFirst({ where: { organizationId: org, roomNumber } });
    if (existing) return badRequest(res, `Room ${roomNumber} already exists`);
    const room = await db.hotelRoom.create({
      data: { organizationId: org, roomNumber, roomTypeId, floor: floor || 1, notes },
      include: { roomType: true },
    });
    created(res, room, "Room created");
  } catch (e) { serverError(res, e); }
}

export async function updateRoom(req: AuthRequest, res: Response) {
  try {
    const org = orgId(req);
    const { id } = req.params;
    const existing = await db.hotelRoom.findFirst({ where: { id, organizationId: org } });
    if (!existing) return notFound(res, "Room not found");
    const { roomNumber, roomTypeId, floor, status, notes, isActive } = req.body;
    const room = await db.hotelRoom.update({
      where: { id }, data: { roomNumber, roomTypeId, floor, status, notes, isActive },
      include: { roomType: true },
    });
    ok(res, room, "Room updated");
  } catch (e) { serverError(res, e); }
}

export async function getRoom(req: AuthRequest, res: Response) {
  try {
    const org = orgId(req);
    if (!org) return badRequest(res, "Organization required");
    const { id } = req.params;
    const room = await db.hotelRoom.findFirst({
      where: { id, organizationId: org },
      include: {
        roomType: true,
        bookings: {
          orderBy: { checkIn: "desc" }, take: 10,
          include: { guest: { select: { id: true, name: true, phone: true } } },
        },
      },
    });
    if (!room) return notFound(res, "Room not found");
    ok(res, room);
  } catch (e) { serverError(res, e); }
}

// ═══════════════════════════════════════════════════════════════
//  GUESTS
// ═══════════════════════════════════════════════════════════════

export async function getGuests(req: AuthRequest, res: Response) {
  try {
    const org = orgId(req);
    if (!org) return badRequest(res, "Organization required");
    const { q } = req.query as Record<string, string>;
    const where: any = { organizationId: org };
    if (q) where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { phone: { contains: q } },
      { email: { contains: q, mode: "insensitive" } },
    ];
    const guests = await db.guestProfile.findMany({
      where, orderBy: { name: "asc" }, take: 50,
    });
    ok(res, guests);
  } catch (e) { serverError(res, e); }
}

export async function createGuest(req: AuthRequest, res: Response) {
  try {
    const org = orgId(req);
    if (!org) return badRequest(res, "Organization required");
    const { name, phone, email, idType, idNumber, address, city, nationality, notes } = req.body;
    if (!name || !phone) return badRequest(res, "name and phone required");
    const guest = await db.guestProfile.create({
      data: { organizationId: org, name, phone, email, idType, idNumber, address, city, nationality: nationality || "Indian", notes },
    });
    created(res, guest, "Guest profile created");
  } catch (e) { serverError(res, e); }
}

export async function updateGuest(req: AuthRequest, res: Response) {
  try {
    const org = orgId(req);
    const { id } = req.params;
    const existing = await db.guestProfile.findFirst({ where: { id, organizationId: org } });
    if (!existing) return notFound(res, "Guest not found");
    const data = req.body;
    const guest = await db.guestProfile.update({ where: { id }, data });
    ok(res, guest, "Guest updated");
  } catch (e) { serverError(res, e); }
}

export async function getGuest(req: AuthRequest, res: Response) {
  try {
    const org = orgId(req);
    if (!org) return badRequest(res, "Organization required");
    const { id } = req.params;
    const guest = await db.guestProfile.findFirst({
      where: { id, organizationId: org },
      include: {
        bookings: {
          orderBy: { checkIn: "desc" }, take: 10,
          include: { room: { include: { roomType: true } } },
        },
      },
    });
    if (!guest) return notFound(res, "Guest not found");
    ok(res, guest);
  } catch (e) { serverError(res, e); }
}

// ═══════════════════════════════════════════════════════════════
//  BOOKINGS
// ═══════════════════════════════════════════════════════════════

export async function getBookings(req: AuthRequest, res: Response) {
  try {
    const org = orgId(req);
    if (!org) return badRequest(res, "Organization required");
    const { status, fromDate, toDate, page = "1" } = req.query as Record<string, string>;
    const take = 50; const skip = (parseInt(page) - 1) * take;
    const where: any = { organizationId: org };
    if (status) where.status = status;
    if (fromDate || toDate) {
      where.checkIn = {};
      if (fromDate) where.checkIn.gte = new Date(fromDate);
      if (toDate)   where.checkIn.lte = new Date(toDate);
    }
    const [bookings, total] = await Promise.all([
      db.hotelBooking.findMany({
        where, orderBy: { checkIn: "desc" }, skip, take,
        include: { room: { include: { roomType: true } }, guest: true },
      }),
      db.hotelBooking.count({ where }),
    ]);
    ok(res, { bookings, total, page: parseInt(page), pages: Math.ceil(total / take) });
  } catch (e) { serverError(res, e); }
}

export async function getBooking(req: AuthRequest, res: Response) {
  try {
    const org = orgId(req);
    if (!org) return badRequest(res, "Organization required");
    const { id } = req.params;
    const booking = await db.hotelBooking.findFirst({
      where: { id, organizationId: org },
      include: { room: { include: { roomType: true } }, guest: true },
    });
    if (!booking) return notFound(res, "Booking not found");
    ok(res, booking);
  } catch (e) { serverError(res, e); }
}

export async function createBooking(req: AuthRequest, res: Response) {
  try {
    const org = orgId(req);
    if (!org) return badRequest(res, "Organization required");
    const { roomId, guestId, checkIn, checkOut, adults, children, ratePerNight, discount, paymentMethod, source, specialRequests, notes, advancePaid } = req.body;
    if (!roomId || !guestId || !checkIn || !checkOut || ratePerNight === undefined)
      return badRequest(res, "roomId, guestId, checkIn, checkOut, ratePerNight required");

    const [roomExists, guestExists] = await Promise.all([
      db.hotelRoom.findFirst({ where: { id: roomId, organizationId: org } }),
      db.guestProfile.findFirst({ where: { id: guestId, organizationId: org } }),
    ]);
    if (!roomExists) return badRequest(res, "Room not found");
    if (!guestExists) return badRequest(res, "Guest not found");

    const ci = new Date(checkIn); const co = new Date(checkOut);
    const nights = Math.max(1, Math.ceil((co.getTime() - ci.getTime()) / 86400000));

    // Check room availability
    const conflict = await db.hotelBooking.findFirst({
      where: {
        roomId, organizationId: org,
        status: { in: ["CONFIRMED", "CHECKED_IN"] },
        OR: [{ checkIn: { lt: co }, checkOut: { gt: ci } }],
      },
    });
    if (conflict) return badRequest(res, "Room is not available for the selected dates");

    const subtotal  = parseFloat(ratePerNight) * nights;
    const disc      = parseFloat(discount || "0");
    const taxAmount = (subtotal - disc) * 0.12; // 12% GST
    const total     = subtotal - disc + taxAmount;
    const advance   = parseFloat(advancePaid || "0");
    const balance   = total - advance;

    const count = await db.hotelBooking.count({ where: { organizationId: org } });
    const bookingNumber = nextSeq("BKG", count);

    const booking = await db.hotelBooking.create({
      data: {
        organizationId: org, bookingNumber,
        roomId, guestId, checkIn: ci, checkOut: co,
        adults: adults || 1, children: children || 0,
        ratePerNight, totalNights: nights,
        subtotal, taxAmount, discount: disc, total,
        advancePaid: advance, balanceDue: balance,
        paymentMethod, source, specialRequests, notes,
      },
      include: { room: { include: { roomType: true } }, guest: true },
    });

    await db.hotelRoom.update({ where: { id: roomId }, data: { status: "RESERVED" } });
    await db.guestProfile.update({ where: { id: guestId }, data: { totalStays: { increment: 1 } } });

    created(res, booking, "Booking confirmed");
  } catch (e) { serverError(res, e); }
}

export async function updateBookingStatus(req: AuthRequest, res: Response) {
  try {
    const org = orgId(req);
    const { id } = req.params;
    const { status, notes } = req.body;

    const booking = await db.hotelBooking.findFirst({ where: { id, organizationId: org } });
    if (!booking) return notFound(res, "Booking not found");

    const updated = await db.hotelBooking.update({
      where: { id }, data: { status, notes },
      include: { room: { include: { roomType: true } }, guest: true },
    });

    // Update room status based on booking status
    const roomStatus =
      status === "CHECKED_IN"  ? "OCCUPIED"  :
      status === "CHECKED_OUT" ? "CLEANING"  :
      status === "CANCELLED"   ? "AVAILABLE" : undefined;

    if (roomStatus) {
      await db.hotelRoom.update({ where: { id: booking.roomId }, data: { status: roomStatus } });
    }
    ok(res, updated, `Booking ${status.toLowerCase().replace("_", "-")}`);
  } catch (e) { serverError(res, e); }
}

export async function getAvailableRooms(req: AuthRequest, res: Response) {
  try {
    const org = orgId(req);
    if (!org) return badRequest(res, "Organization required");
    const { checkIn, checkOut, roomTypeId } = req.query as Record<string, string>;
    if (!checkIn || !checkOut) return badRequest(res, "checkIn and checkOut required");

    const ci = new Date(checkIn); const co = new Date(checkOut);

    // Rooms with conflicting bookings
    const occupied = await db.hotelBooking.findMany({
      where: {
        organizationId: org,
        status: { in: ["CONFIRMED", "CHECKED_IN"] },
        checkIn: { lt: co },
        checkOut: { gt: ci },
      },
      select: { roomId: true },
    });
    const occupiedIds = occupied.map((b: any) => b.roomId);

    const where: any = {
      organizationId: org, isActive: true,
      id: { notIn: occupiedIds },
      status: { in: ["AVAILABLE", "CLEANING"] },
    };
    if (roomTypeId) where.roomTypeId = roomTypeId;

    const rooms = await db.hotelRoom.findMany({
      where,
      include: { roomType: true },
      orderBy: [{ floor: "asc" }, { roomNumber: "asc" }],
    });
    ok(res, rooms);
  } catch (e) { serverError(res, e); }
}

export async function getHotelDashboard(req: AuthRequest, res: Response) {
  try {
    const org = orgId(req);
    if (!org) return badRequest(res, "Organization required");
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);

    const [rooms, todayCheckIns, todayCheckOuts, upcomingBookings, monthRevenue] = await Promise.all([
      db.hotelRoom.groupBy({ by: ["status"], where: { organizationId: org, isActive: true }, _count: true }),
      db.hotelBooking.count({ where: { organizationId: org, checkIn: { gte: today, lt: tomorrow }, status: { in: ["CONFIRMED", "CHECKED_IN"] } } }),
      db.hotelBooking.count({ where: { organizationId: org, checkOut: { gte: today, lt: tomorrow }, status: "CHECKED_IN" } }),
      db.hotelBooking.findMany({
        where: { organizationId: org, checkIn: { gte: today }, status: "CONFIRMED" },
        include: { room: { include: { roomType: true } }, guest: true },
        orderBy: { checkIn: "asc" }, take: 10,
      }),
      db.hotelBooking.aggregate({
        where: { organizationId: org, createdAt: { gte: new Date(today.getFullYear(), today.getMonth(), 1) }, status: { notIn: ["CANCELLED"] } },
        _sum: { total: true },
      }),
    ]);

    const roomMap: Record<string, number> = {};
    rooms.forEach((r: any) => { roomMap[r.status] = r._count; });

    ok(res, {
      rooms: roomMap,
      todayCheckIns, todayCheckOuts,
      upcomingBookings,
      monthRevenue: parseFloat(monthRevenue._sum.total || "0"),
    });
  } catch (e) { serverError(res, e); }
}
