import React, { useState, useEffect } from 'react';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { supabase } from '../lib/supabase';
import { motion } from 'motion/react';
import { Calendar, MapPin, User, Mail, Phone, Receipt, Trash2, CheckCircle, XCircle, Clock, ArrowLeft, RefreshCw, Search } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAdmin, ADMIN_EMAIL } from '../hooks/useAdmin';

export const AdminReservations = () => {
  const { isAdmin, loading: adminLoading } = useAdmin();
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const navigate = useNavigate();

  useEffect(() => {
    document.title = "Painel Administrativo - AlugaAki";
    if (!adminLoading) {
      if (!isAdmin) {
        navigate('/perfil');
      } else {
        fetchBookings();
      }
    }
  }, [isAdmin, adminLoading, navigate]);

  const fetchBookings = async () => {
    setLoading(true);
    try {
      // 1. Fetch all bookings
      const { data: bookingsData, error: bookingsError } = await supabase
        .from('bookings')
        .select('*')
        .order('created_at', { ascending: false });

      if (bookingsError) throw bookingsError;

      if (!bookingsData || bookingsData.length === 0) {
        setBookings([]);
        return;
      }

      // 2. Extract unique destination IDs
      const destinationIds = Array.from(new Set(bookingsData.map(b => b.destination_id)));

      // 3. Fetch destinations for these IDs
      const { data: destinationsData, error: destinationsError } = await supabase
        .from('destinations')
        .select('id, title, location')
        .in('id', destinationIds);

      if (destinationsError) throw destinationsError;

      // 4. Join in memory
      const joinedData = bookingsData.map(booking => {
        const dest = destinationsData?.find(d => d.id === booking.destination_id);
        return {
          ...booking,
          destinations: dest ? {
            title: dest.title || 'Santuário',
            location: dest.location || 'Localização não informada'
          } : null
        };
      });

      setBookings(joinedData);
    } catch (err: any) {
      console.error('Error fetching bookings:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const updateBookingStatus = async (id: string, status: string) => {
    setActionLoading(id);
    try {
      const { error } = await supabase
        .from('bookings')
        .update({ status })
        .eq('id', id);

      if (error) throw error;
      
      setBookings(prev => prev.map(b => b.id === id ? { ...b, status } : b));
    } catch (err: any) {
      alert('Erro ao atualizar status: ' + err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const deleteBooking = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja excluir esta reserva permanentemente?')) return;
    
    setActionLoading(id);
    try {
      const { error } = await supabase
        .from('bookings')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      setBookings(prev => prev.filter(b => b.id !== id));
    } catch (err: any) {
      alert('Erro ao excluir reserva: ' + err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const filteredBookings = bookings.filter(booking => {
    const matchesSearch = 
      booking.guest_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      booking.guest_email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      booking.destinations?.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      booking.id.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || booking.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-paper flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <span className="text-[10px] uppercase tracking-widest opacity-50">Carregando Reservas...</span>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper flex flex-col">
      <Navbar />
      <main className="flex-1 container mx-auto px-6 py-24">
        <div className="flex flex-col md:flex-row justify-between items-end mb-16 gap-8">
          <div>
            <Link to="/perfil" className="text-[10px] uppercase tracking-widest opacity-50 flex items-center gap-2 mb-4 hover:opacity-100 transition-opacity">
              <ArrowLeft className="w-3 h-3" /> Voltar ao Perfil
            </Link>
            <h1 className="text-5xl font-serif">Histórico de Reservas</h1>
          </div>
          <button 
            onClick={fetchBookings}
            className="flex items-center gap-2 text-[10px] uppercase tracking-widest border-b border-ink pb-1 hover:opacity-70 transition-opacity"
          >
            <RefreshCw className="w-3 h-3" /> Atualizar Lista
          </button>
        </div>

        <div className="mb-12 flex flex-col md:flex-row gap-6 items-center justify-between border-b border-ink/10 pb-8">
          <div className="relative w-full md:w-96">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 opacity-30" />
            <input 
              type="text" 
              placeholder="Buscar por hóspede, e-mail ou destino..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white border border-ink/10 py-3 pl-12 pr-4 text-xs focus:outline-none focus:border-ink/30"
            />
          </div>
          
          <div className="flex gap-2 overflow-x-auto w-full md:w-auto pb-2 md:pb-0">
            {['all', 'pending', 'confirmed', 'cancelled'].map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-4 py-2 text-[9px] uppercase tracking-widest font-bold border transition-all whitespace-nowrap ${
                  statusFilter === status 
                    ? 'bg-ink text-paper border-ink' 
                    : 'bg-white text-ink border-ink/10 hover:border-ink/30'
                }`}
              >
                {status === 'all' ? 'Todos' : 
                 status === 'pending' ? 'Pendentes' : 
                 status === 'confirmed' ? 'Confirmados' : 'Cancelados'}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="p-4 bg-red-50 text-red-600 text-sm mb-8 border border-red-100">
            Erro: {error}
          </div>
        )}

        <div className="space-y-6">
          {filteredBookings.length === 0 ? (
            <div className="py-24 text-center border border-dashed border-ink/20">
              <p className="text-sm opacity-50">Nenhuma reserva encontrada com os filtros atuais.</p>
            </div>
          ) : (
            filteredBookings.map((booking) => (
              <motion.div 
                key={booking.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white border border-ink/10 p-8 flex flex-col lg:flex-row gap-8 items-start lg:items-center justify-between"
              >
                <div className="flex-1 space-y-4">
                  <div className="flex items-center gap-3">
                    <span className={`text-[9px] uppercase tracking-widest px-2 py-1 font-bold ${
                      booking.status === 'confirmed' ? 'bg-green-100 text-green-700' :
                      booking.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                      'bg-amber-100 text-amber-700'
                    }`}>
                      {booking.status === 'confirmed' ? 'Confirmada' : 
                       booking.status === 'cancelled' ? 'Cancelada' : 'Pendente'}
                    </span>
                    <span className={`text-[9px] uppercase tracking-widest px-2 py-1 font-bold ${
                      booking.payment_status === 'paid' ? 'bg-blue-100 text-blue-700' :
                      booking.payment_status === 'failed' ? 'bg-red-100 text-red-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {booking.payment_status === 'paid' ? 'Pago' : 
                       booking.payment_status === 'failed' ? 'Falhou' : 'Pendente'}
                    </span>
                    <span className="text-[9px] uppercase tracking-widest opacity-30">ID: {booking.id.slice(0, 8)}</span>
                  </div>

                  <div>
                    <h3 className="text-2xl font-serif mb-1">{booking.destinations?.title || 'Santuário Desconhecido'}</h3>
                    <div className="flex items-center gap-2 text-xs opacity-50">
                      <MapPin className="w-3 h-3" />
                      {booking.destinations?.location || 'Localização não informada'}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-xs">
                        <Calendar className="w-4 h-4 opacity-30" />
                        <span className="font-mono">{booking.check_in} — {booking.check_out}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <User className="w-4 h-4 opacity-30" />
                        <span>{booking.guest_name}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <Mail className="w-4 h-4 opacity-30" />
                        <span className="opacity-50">{booking.guest_email}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <Phone className="w-4 h-4 opacity-30" />
                        <span className="opacity-50">{booking.guest_phone || 'Não informado'}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <Receipt className="w-4 h-4 opacity-30" />
                        <span className="opacity-50">CPF: {booking.guest_cpf || 'Não informado'}</span>
                      </div>
                    </div>
                    <div className="flex flex-col justify-end items-start md:items-end space-y-2">
                      <div className="flex flex-col items-start md:items-end">
                        <span className="text-[8px] uppercase tracking-widest opacity-40">Repasse Anfitrião (80%)</span>
                        <span className="text-xs font-mono">${Number(booking.owner_payout || booking.total_price * 0.8).toFixed(2)}</span>
                      </div>
                      <div className="flex flex-col items-start md:items-end">
                        <span className="text-[8px] uppercase tracking-widest opacity-40">Comissão Plataforma (20%)</span>
                        <span className="text-xs font-mono">${Number(booking.platform_fee || booking.total_price * 0.2).toFixed(2)}</span>
                      </div>
                      <div className="pt-2 border-t border-ink/10 flex flex-col items-start md:items-end w-full md:w-auto">
                        <span className="text-[10px] uppercase tracking-widest opacity-40">Total Pago</span>
                        <span className="text-2xl font-serif italic">${booking.total_price}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3 lg:flex-col lg:w-48">
                  {booking.status !== 'confirmed' && (
                    <button 
                      onClick={() => updateBookingStatus(booking.id, 'confirmed')}
                      disabled={actionLoading === booking.id}
                      className="flex-1 lg:w-full flex items-center justify-center gap-2 bg-green-600 text-white py-3 text-[9px] uppercase tracking-widest font-bold hover:bg-green-700 transition-colors disabled:opacity-50"
                    >
                      <CheckCircle className="w-3 h-3" /> Confirmar
                    </button>
                  )}
                  {booking.status !== 'cancelled' && (
                    <button 
                      onClick={() => updateBookingStatus(booking.id, 'cancelled')}
                      disabled={actionLoading === booking.id}
                      className="flex-1 lg:w-full flex items-center justify-center gap-2 bg-amber-600 text-white py-3 text-[9px] uppercase tracking-widest font-bold hover:bg-amber-700 transition-colors disabled:opacity-50"
                    >
                      <XCircle className="w-3 h-3" /> Cancelar
                    </button>
                  )}
                  <button 
                    onClick={() => deleteBooking(booking.id)}
                    disabled={actionLoading === booking.id}
                    className="flex-1 lg:w-full flex items-center justify-center gap-2 bg-red-600 text-white py-3 text-[9px] uppercase tracking-widest font-bold hover:bg-red-700 transition-colors disabled:opacity-50"
                  >
                    <Trash2 className="w-3 h-3" /> Excluir
                  </button>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};
