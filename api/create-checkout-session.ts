import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: "2023-10-16" as any,
});

const supabaseUrl = process.env.VITE_SUPABASE_URL || "";
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const getAppUrl = () => {
  let url = "http://localhost:3000";
  if (process.env.APP_URL) {
    url = process.env.APP_URL;
  } else if (process.env.VERCEL_URL) {
    url = `https://${process.env.VERCEL_URL}`;
  }
  return url.endsWith("/") ? url.slice(0, -1) : url;
};

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { totalAmount, paymentMethodId, payer, bookingData } = req.body;
    const appUrl = getAppUrl();

    let bookingId = req.body.bookingId;

    if (!bookingId && bookingData) {
      try {
        // 1. Verificar se já existem reservas para essas datas (Prevenir erro no_overlapping_bookings)
        const { data: existingBookings, error: checkError } = await supabase
          .from('bookings')
          .select('id')
          .eq('destination_id', bookingData.destination_id)
          .neq('status', 'cancelled') // Ignorar reservas canceladas
          .filter('check_in', 'lt', bookingData.check_out)
          .filter('check_out', 'gt', bookingData.check_in);

        if (checkError) {
          console.warn(`Erro ao verificar disponibilidade: ${checkError.message}`);
        } else if (existingBookings && existingBookings.length > 0) {
          return res.status(400).json({ 
            error: "As datas selecionadas já estão ocupadas por outra reserva. Por favor, escolha outro período ou destino." 
          });
        }

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
            unit_amount: Math.round(Number(totalAmount) * 100),
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

    return res.json({ 
      id: session.id, 
      url: session.url
    });
  } catch (error: any) {
    console.error("Error creating Stripe session:", error);
    return res.status(500).json({ error: error.message || "Erro interno ao criar sessão de pagamento" });
  }
}
