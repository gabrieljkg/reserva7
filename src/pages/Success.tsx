import React, { useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { CheckCircle, ArrowRight } from 'lucide-react';
import { motion } from 'motion/react';
import { useCart } from '../context/CartContext';

export function Success() {
  const [searchParams] = useSearchParams();
  const status = searchParams.get('status');
  const { clearCart } = useCart();

  useEffect(() => {
    document.title = "Sucesso - AlugaAki";
    // Clear the cart when reaching the success page
    clearCart();
  }, [clearCart]);

  return (
    <div className="min-h-screen bg-paper flex flex-col">
      <Navbar />
      <main className="flex-1 flex items-center justify-center py-24">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center max-w-md px-6"
        >
          <div className="w-20 h-20 bg-ink text-paper rounded-full flex items-center justify-center mx-auto mb-8">
            <CheckCircle className="w-10 h-10" />
          </div>
          <h2 className="text-4xl font-serif mb-4">
            {status === 'approved' ? 'Reserva Confirmada' : 'Pedido Recebido'}
          </h2>
          <p className="text-sm opacity-60 mb-8 leading-relaxed">
            {status === 'approved' 
              ? 'Sua jornada para o silêncio está garantida. Estamos processando os detalhes da sua reserva.'
              : 'Recebemos o seu pedido. Assim que o pagamento for confirmado, sua reserva será efetivada.'}
          </p>
          
          <div className="flex flex-col gap-4 items-center">
            <Link 
              to="/perfil" 
              className="bg-ink text-paper px-8 py-4 text-[10px] uppercase tracking-widest hover:bg-ink/90 transition-colors flex items-center gap-2"
            >
              Ver Detalhes no Perfil <ArrowRight className="w-3 h-3" />
            </Link>
            <Link 
              to="/" 
              className="text-[10px] uppercase tracking-widest border-b border-ink pb-1 opacity-60 hover:opacity-100 transition-opacity"
            >
              Retornar à Coleção
            </Link>
          </div>
        </motion.div>
      </main>
      <Footer />
    </div>
  );
}
