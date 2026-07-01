import { Router } from "express";
import { AdminController } from "./controllers/admin.controller";
import { PaymentController } from "./controllers/payment.controller";
import { SSEController } from "./controllers/sse.controller";
import { TicketController } from "./controllers/ticket.controller";

const router = Router();

// Routes Đặt vé & Thanh toán
router.post("/tickets/hold", TicketController.holdTicket);
router.post("/tickets/pay", PaymentController.pay);

// Route Real-time (SSE)
router.get("/tickets/stream", SSEController.streamTickets);

// Route Admin
router.get("/admin/stats", AdminController.getStats);

export const appRoutes = router;
