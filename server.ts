import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import Stripe from "stripe";

dotenv.config();

if (!process.env.STRIPE_SECRET_KEY) {
  console.warn("⚠️ AVISO: STRIPE_SECRET_KEY não foi encontrado nas variáveis de ambiente.");
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// Stripe configuration
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
if (!stripeSecretKey) {
  console.error("❌ ERRO: STRIPE_SECRET_KEY não configurada.");
}
const stripe = new Stripe(stripeSecretKey || "", {
  apiVersion: "2023-10-16" as any,
});

// Helper to get clean APP_URL
const getAppUrl = () => {
  const url = process.env.APP_URL || "";
  return url.endsWith("/") ? url.slice(0, -1) : url;
};

// Supabase configuration
const supabaseUrl = process.env.VITE_SUPABASE_URL || "";
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Webhook endpoint needs raw body for Stripe signature verification
app.post("/api/webhook/stripe", express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    if (!endpointSecret) {
      throw new Error("STRIPE_WEBHOOK_SECRET is not set");
    }
    event = stripe.webhooks.constructEvent(req.body, sig as string, endpointSecret);
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
});

// Apply JSON middleware for all other routes
app.use(express.json());

// API routes
app.post("/api/create-checkout-session", async (req, res) => {
  try {
    if (!stripeSecretKey) {
      throw new Error("STRIPE_SECRET_KEY não configurado.");
    }

    const { items, totalAmount, paymentMethodId, payer, bookingData } = req.body;
    const appUrl = getAppUrl();

    console.log(`Creating Stripe checkout session for booking, amount: ${totalAmount}, method: ${paymentMethodId}`);

    let bookingId = req.body.bookingId;

    // Se a reserva ainda não foi criada, cria no backend
    if (!bookingId && bookingData) {
      try {
        const payload = {
          user_id: bookingData.user_id,
          destination_id: bookingData.destination_id,
          check_in: bookingData.check_in,
          check_out: bookingData.check_out,
          total_price: Number(bookingData.total_price),
          commission_rate: 0.20,
          platform_fee: Number(bookingData.total_price) * 0.20,
          owner_payout: Number(bookingData.total_price) * 0.80,
          payment_method: paymentMethodId,
          guest_name: payer?.name || 'Guest',
          guest_email: payer?.email || 'guest@example.com',
          guest_phone: bookingData.guest_phone || '',
          guest_cpf: payer?.cpf || '',
          status: 'pending',
          payment_status: 'pending'
        };

        const { data: newBooking, error: insertError } = await supabase
          .from('bookings')
          .insert([payload])
          .select()
          .single();

        if (insertError) {
          if (insertError.message?.includes('no_overlapping_bookings')) {
            throw new Error("As datas selecionadas já estão ocupadas por outra reserva. Por favor, escolha outro período.");
          }
          throw new Error(`Erro ao criar reserva no banco: ${insertError.message}`);
        }
        
        bookingId = newBooking.id;
      } catch (dbError: any) {
        return res.status(400).json({ error: dbError.message || "Erro ao criar reserva no banco de dados" });
      }
    }

    if (!bookingId) {
      throw new Error("ID da reserva não fornecido e dados da reserva ausentes.");
    }

    // Map the requested payment method to Stripe's payment_method_types
    // 'credit' / 'debit' -> 'card'
    // 'pix' -> 'pix'
    // 'boleto' -> 'boleto'
    let paymentMethodTypes: Stripe.Checkout.SessionCreateParams.PaymentMethodType[] = ['card'];
    if (paymentMethodId === 'pix') {
      paymentMethodTypes = ['pix'];
    } else if (paymentMethodId === 'boleto') {
      paymentMethodTypes = ['boleto'];
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: paymentMethodTypes,
      line_items: [
        {
          price_data: {
            currency: 'brl',
            product_data: {
              name: `Reserva - ${payer?.name || 'Guest'}`,
              description: `Reserva de estadia`,
            },
            unit_amount: Math.round(Number(totalAmount) * 100), // Stripe expects amounts in cents
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${appUrl}/sucesso?status=approved`,
      cancel_url: `${appUrl}/sucesso?status=failure`,
      customer_email: payer?.email || undefined,
      metadata: {
        booking_id: bookingId
      },
      payment_intent_data: {
        metadata: {
          booking_id: bookingId
        }
      }
    });

    console.log(`Stripe Session created: ${session.id}, url: ${session.url}`);
    return res.json({ 
      id: session.id, 
      url: session.url
    });
  } catch (error: any) {
    console.error("Error creating Stripe session:", error);
    res.status(500).json({ error: error.message || "Erro interno ao criar sessão de pagamento" });
  }
});



// Webhook para receber dados do Zapier
app.post("/api/webhook/zapier", async (req, res) => {
  try {
    const { nome_hospede, data_entrada } = req.body;

    console.log("Webhook Zapier recebido:", { nome_hospede, data_entrada });

    if (!nome_hospede || !data_entrada) {
      return res.status(400).json({ error: "Campos 'nome_hospede' e 'data_entrada' são obrigatórios." });
    }

    // Salva no Supabase (tabela bookings)
    const { data, error } = await supabase
      .from('bookings')
      .insert([
        {
          guest_name: nome_hospede,
          check_in: new Date(data_entrada).toISOString(),
          status: 'pending',
          payment_status: 'pending'
        }
      ])
      .select();

    if (error) {
      console.error("Erro ao salvar dados do Zapier no Supabase:", error);
      throw error;
    }

    console.log("Dados do Zapier salvos com sucesso:", data);
    return res.status(201).json({ message: "Webhook processado com sucesso", data });
  } catch (error: any) {
    console.error("Erro no Webhook Zapier:", error);
    return res.status(500).json({ error: error.message || "Erro interno ao processar webhook" });
  }
});


// Vite middleware for development
if (process.env.NODE_ENV !== "production") {
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: "spa",
  });
  app.use(vite.middlewares);
} else {
  const distPath = path.join(process.cwd(), "dist");
  app.use(express.static(distPath));
  app.get("*", (req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });
}

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
