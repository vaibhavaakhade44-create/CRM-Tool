import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { requireOrgContext } from "../middleware/orgContext";
import {
  getRoomTypes, createRoomType, updateRoomType,
  getRooms, createRoom, updateRoom, getRoom,
  getGuests, createGuest, updateGuest, getGuest,
  getBookings, createBooking, updateBookingStatus, getAvailableRooms, getBooking,
  getHotelDashboard,
} from "../controllers/hotel.controller";

const router = Router();
router.use(authenticate, requireOrgContext);

// Room types
router.get   ("/room-types",          getRoomTypes);
router.post  ("/room-types",          createRoomType);
router.patch ("/room-types/:id",      updateRoomType);

// Rooms
router.get   ("/rooms",               getRooms);
router.get   ("/rooms/available",     getAvailableRooms);
router.post  ("/rooms",               createRoom);
router.get   ("/rooms/:id",           getRoom);
router.patch ("/rooms/:id",           updateRoom);

// Guests
router.get   ("/guests",              getGuests);
router.post  ("/guests",              createGuest);
router.get   ("/guests/:id",          getGuest);
router.patch ("/guests/:id",          updateGuest);

// Bookings
router.get   ("/bookings",            getBookings);
router.post  ("/bookings",            createBooking);
router.get   ("/bookings/:id",        getBooking);
router.patch ("/bookings/:id/status", updateBookingStatus);

// Dashboard
router.get   ("/dashboard",           getHotelDashboard);

export default router;
