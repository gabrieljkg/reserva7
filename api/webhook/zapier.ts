import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.VITE_SUPABASE_URL || "";
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { nome_hospede, data_entrada } = req.body;

    console.log("Webhook Zapier recebido:", { nome_hospede, data_entrada });

    if (!nome_hospede || !data_entrada) {
      return res.status(400).json({ error: "Campos 'nome_hospede' e 'data_entrada' são obrigatórios." });
    }

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
}
