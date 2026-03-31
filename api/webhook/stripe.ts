import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
if (!stripeSecretKey) {
  console.error("❌ ERRO: STRIPE_SECRET_KEY não configurada.");
}
const stripe = new Stripe(stripeSecretKey || "", {
  apiVersion: "2023-10-16" as any,
});

const supabaseUrl = process.env.VITE_SUPABASE_URL || "";
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const config = {
  api: {
    bodyParser: false,
  },
};

async function buffer(readable: any) {
  const chunks = [];
  for await (const chunk of readable) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    if (!endpointSecret) {
      throw new Error("STRIPE_WEBHOOK_SECRET is not set");
    }
    const buf = await buffer(req);
    event = stripe.webhooks.constructEvent(buf, sig as string, endpointSecret);
  } catch (err: any) {
    console.error(`Webhook Error: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  console.log(`Stripe Webhook received: ${event.type}`);

  if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
    const session = event.data.object as Stripe.Checkout.Session;
    const bookingId = session.metadata?.booking_id;
    const paymentId = session.payment_intent as string;

    if (bookingId) {
      console.log(`Payment approved for booking ${bookingId}. Updating record...`);

      const { error } = await supabase
        .from("bookings")
        .update({
          status: "confirmed",
          payment_status: "paid",
          payment_id: paymentId,
        })
        .eq("id", bookingId);

      if (error) {
        console.error("Error updating booking from webhook:", error);
      } else {
        console.log(`Booking ${bookingId} updated successfully for payment ${paymentId}.`);
      }
    }
  }

  res.send();
}
