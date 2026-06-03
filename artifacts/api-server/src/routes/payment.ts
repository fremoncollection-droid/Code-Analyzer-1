import { Router } from "express";
import crypto from "node:crypto";
import { authenticateToken } from "../middleware/auth";

const router = Router();
const PAYSTACK_BASE = "https://api.paystack.co";

router.post("/charge-momo", authenticateToken, async (req, res) => {
  const { email, amount, phoneNumber, provider } = req.body as {
    email?: string;
    amount?: number;
    phoneNumber?: string;
    provider?: "mtn" | "vod";
  };

  if (!email || !amount || !phoneNumber || !provider) {
    res.status(400).json({ error: "email, amount, phoneNumber, and provider are required" });
    return;
  }

  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) {
    res.status(500).json({ error: "Paystack is not configured on this server" });
    return;
  }

  const amountInPesewas = Math.round(amount * 100);

  try {
    const paystackRes = await fetch(`${PAYSTACK_BASE}/charge`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        amount: amountInPesewas,
        currency: "GHS",
        mobile_money: {
          phone: phoneNumber,
          provider,
        },
      }),
    });

    const data = (await paystackRes.json()) as any;

    if (!data.status) {
      res.status(400).json({ error: data.message ?? "Paystack charge failed" });
      return;
    }

    const { reference, status } = data.data;
    res.json({ success: true, reference, status });
  } catch (err) {
    req.log.error({ err }, "Paystack charge-momo error");
    res.status(500).json({ error: "Failed to initiate mobile money charge" });
  }
});

router.post("/paystack-webhook", (req, res) => {
  res.sendStatus(200);

  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) return;

  const signature = req.headers["x-paystack-signature"] as string | undefined;
  if (!signature) {
    req.log.warn("Paystack webhook received without signature — ignored");
    return;
  }

  const hash = crypto
    .createHmac("sha512", secretKey)
    .update(req.body as Buffer)
    .digest("hex");

  if (hash !== signature) {
    req.log.warn("Paystack webhook signature mismatch — ignored");
    return;
  }

  let event: { event: string; data: any };
  try {
    event = JSON.parse((req.body as Buffer).toString("utf8"));
  } catch {
    req.log.warn("Paystack webhook body could not be parsed");
    return;
  }

  if (event.event === "charge.success") {
    const { reference, amount, currency, channel } = event.data;
    const amountInGHS = (amount / 100).toFixed(2);
    req.log.info(
      { reference, amountInGHS, currency, channel },
      `Paystack charge.success — ref: ${reference}, GHS ${amountInGHS}`,
    );
  }
});

export default router;
