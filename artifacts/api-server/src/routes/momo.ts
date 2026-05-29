import { Router } from "express";
import { nanoid } from "nanoid";
import { authenticateToken } from "../middleware/auth";

const router = Router();

// In-memory store for demo MoMo statuses (in production this would use the real API)
const momoPayments = new Map<string, { status: string; phone: string; amount: string; network: string }>();

router.post("/initiate", authenticateToken, async (req, res) => {
  const { phone, network, amount, reference, description } = req.body as {
    phone?: string; network?: string; amount?: string; reference?: string; description?: string;
  };

  if (!phone || !network || !amount || !reference) {
    res.status(400).json({ error: "phone, network, amount, reference required" });
    return;
  }

  // In a real integration you would call MTN/Telecel USSD Push API here.
  // For now we simulate a pending payment.
  const ref = reference ?? nanoid(12);
  momoPayments.set(ref, { status: "pending", phone, amount, network });

  // Simulate async completion after 3 seconds (in production: webhook or polling)
  setTimeout(() => {
    const p = momoPayments.get(ref);
    if (p) p.status = "successful";
  }, 3000);

  res.json({
    success: true,
    reference: ref,
    status: "pending",
    message: `Payment request sent to ${phone}. Ask customer to approve on their phone.`,
  });
});

router.get("/status/:reference", authenticateToken, async (req, res) => {
  const reference = String(req.params.reference);
  const payment = momoPayments.get(reference);
  if (!payment) {
    res.json({ reference, status: "not_found", amount: null, phone: null, message: "Payment not found" });
    return;
  }
  res.json({
    reference,
    status: payment.status,
    amount: payment.amount,
    phone: payment.phone,
    message: payment.status === "successful" ? "Payment confirmed" : "Awaiting confirmation",
  });
});

export default router;
