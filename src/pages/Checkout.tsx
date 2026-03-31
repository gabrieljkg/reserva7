import React, { useState, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, CreditCard, QrCode, Receipt } from 'lucide-react';
import { supabase } from '../lib/supabase';

// Carrega a chave pública (usa a variável de ambiente)
const stripePublicKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
if (!stripePublicKey) {
  console.warn("VITE_STRIPE_PUBLISHABLE_KEY não configurada. O pagamento pode falhar.");
}
const stripePromise = loadStripe(stripePublicKey || "");

export const Checkout = () => { 
  const location = useLocation();
  const navigate = useNavigate();
  const bookingData = location.state;

  const [loading, setLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'credit' | 'pix' | 'boleto'>('credit');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [formData, setFormData] = useState({ 
    name: '', 
    email: '', 
    phone: '', 
    cpf: '' 
  });

  useEffect(() => {
    document.title = "Checkout - AlugaAki";
  }, []);

  if (!bookingData) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6 bg-paper">
        <h2 className="text-2xl font-serif">Nenhuma reserva em andamento</h2>
        <Link to="/" className="text-sm uppercase tracking-widest border-b border-ink flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" /> Voltar para a Coleção
        </Link>
      </div>
    );
  }

  const { destination, checkIn, checkOut, total } = bookingData;

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    if (!formData.name || !formData.email || !formData.phone || !formData.cpf) {
      setErrorMsg('Por favor, preencha todos os campos obrigatórios.');
      setLoading(false);
      return;
    }

    try {
      const stripe = await stripePromise;
      if (!stripe) throw new Error('Stripe não carregado');

      const { data: { user } } = await supabase.auth.getUser();

      const res = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          totalAmount: total,
          paymentMethodId: paymentMethod,
          payer: {
            name: formData.name,
            email: formData.email,
            cpf: formData.cpf
          },
          bookingData: {
            user_id: user?.id || null,
            destination_id: destination.id,
            check_in: new Date(checkIn).toISOString(),
            check_out: new Date(checkOut).toISOString(),
            total_price: total,
            guest_phone: formData.phone,
          }
        }), 
      });

      const session = await res.json();
      
      if (session.url) {
        window.location.href = session.url;
      } else {
        setErrorMsg('Erro do Servidor: ' + (session.error || 'Falha ao gerar sessão'));
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Erro na conexão com o Stripe.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-paper py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm opacity-60 hover:opacity-100 mb-8 transition-opacity">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </button>

        <h1 className="text-3xl font-serif mb-8 text-center">Finalizar Reserva</h1>
        
        <div className="bg-white p-8 rounded-xl shadow-sm border border-ink/10 mb-8">
          <div className="flex flex-col md:flex-row gap-6 items-center border-b border-ink/10 pb-6 mb-6">
            <img src={destination.image} alt={destination.title} className="w-32 h-24 object-cover rounded-lg" />
            <div className="flex-1 text-center md:text-left">
              <h2 className="text-xl font-medium">{destination.title}</h2>
              <p className="text-sm opacity-60">{destination.location}</p>
              <p className="text-xs mt-2 bg-ink/5 inline-block px-3 py-1 rounded-full">
                {checkIn} até {checkOut}
              </p>
            </div>
            <div className="text-center md:text-right">
              <p className="text-sm opacity-60">Total a pagar</p>
              <p className="text-3xl font-serif">R$ {total.toFixed(2)}</p>
            </div>
          </div>

          <form onSubmit={handlePayment} className="space-y-6">
            <div>
              <h3 className="text-sm uppercase tracking-widest opacity-50 mb-4">Seus Dados</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input required type="text" placeholder="Nome Completo" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full bg-ink/5 border-none p-3 rounded-lg text-sm focus:ring-2 focus:ring-ink outline-none" />
                <input required type="email" placeholder="E-mail" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full bg-ink/5 border-none p-3 rounded-lg text-sm focus:ring-2 focus:ring-ink outline-none" />
                <input required type="tel" placeholder="Telefone / WhatsApp" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="w-full bg-ink/5 border-none p-3 rounded-lg text-sm focus:ring-2 focus:ring-ink outline-none" />
                <input required type="text" placeholder="CPF" maxLength={14} value={formData.cpf} onChange={e => setFormData({...formData, cpf: e.target.value})} className="w-full bg-ink/5 border-none p-3 rounded-lg text-sm focus:ring-2 focus:ring-ink outline-none" />
              </div>
            </div>

            <div>
              <h3 className="text-sm uppercase tracking-widest opacity-50 mb-4">Forma de Pagamento</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <button type="button" onClick={() => setPaymentMethod('credit')} className={`p-4 border rounded-lg flex flex-col items-center gap-2 transition-all ${paymentMethod === 'credit' ? 'border-ink bg-ink/5' : 'border-ink/10 hover:border-ink/30'}`}>
                  <CreditCard className="w-6 h-6" />
                  <span className="text-xs font-medium">Cartão</span>
                </button>
                <button type="button" onClick={() => setPaymentMethod('pix')} className={`p-4 border rounded-lg flex flex-col items-center gap-2 transition-all ${paymentMethod === 'pix' ? 'border-ink bg-ink/5' : 'border-ink/10 hover:border-ink/30'}`}>
                  <QrCode className="w-6 h-6" />
                  <span className="text-xs font-medium">Pix</span>
                </button>
                <button type="button" onClick={() => setPaymentMethod('boleto')} className={`p-4 border rounded-lg flex flex-col items-center gap-2 transition-all ${paymentMethod === 'boleto' ? 'border-ink bg-ink/5' : 'border-ink/10 hover:border-ink/30'}`}>
                  <Receipt className="w-6 h-6" />
                  <span className="text-xs font-medium">Boleto</span>
                </button>
              </div>
            </div>

            {errorMsg && (
              <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg text-center">
                {errorMsg}
              </div>
            )}

            <button 
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-ink text-paper rounded-lg text-sm uppercase tracking-widest hover:opacity-90 transition-all disabled:opacity-50 font-medium mt-4"
            >
              {loading ? 'Processando...' : `Pagar R$ ${total.toFixed(2)}`}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

