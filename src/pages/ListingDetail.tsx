import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Destination } from '../data/mockData';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { motion } from 'motion/react';
import { WifiOff, ShieldCheck, Calendar as CalendarIcon, MapPin, ArrowLeft, Camera, Notebook, Map as MapIcon, Plus, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useCart } from '../context/CartContext';
import { useAdmin, ADMIN_EMAIL } from '../hooks/useAdmin';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  isSameDay, 
  isWithinInterval, 
  addMonths, 
  subMonths,
  isBefore,
  startOfToday,
  parseISO
} from 'date-fns';
import { ptBR } from 'date-fns/locale';

const DETOX_PRODUCTS = [
  { id: 'p1', name: 'Câmera de Filme 35mm', price: 85, icon: Camera, description: 'Capture momentos sem telas.' },
  { id: 'p2', name: 'Caderno de Couro', price: 60, icon: Notebook, description: 'Para seus pensamentos offline.' },
  { id: 'p3', name: 'Mapa Físico da Região', price: 40, icon: MapIcon, description: 'Navegação analógica pura.' },
];

export const ListingDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToCart, cartTotal } = useCart();
  const { isAdmin } = useAdmin();
  const [destination, setDestination] = useState<Destination | null>(null);
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const fetchDestination = async () => {
      try {
        console.log(`Buscando destino ID: ${id} no Supabase...`);
        const { data, error } = await supabase
          .from('destinations')
          .select('*')
          .eq('id', id)
          .single();
        
        if (error) {
          console.error('ERRO TÉCNICO SUPABASE (Detail):', {
            message: error.message,
            details: error.details,
            hint: error.hint,
            code: error.code
          });
          throw error;
        }
        if (data) {
          console.log('Destino carregado com sucesso:', data.title);
          // Map data to match Destination interface
          const mappedData: Destination = {
            id: data.id,
            title: data.title || 'Sem Título',
            location: data.location || 'Localização não informada',
            description: data.description || '',
            price: data.price_per_night || data.price || 0,
            signalStrength: data.isolation_level !== undefined ? data.isolation_level : (data.signalStrength || 0),
            image: Array.isArray(data.image) ? (data.image[0] || 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&q=80&w=1000') : (data.image || 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&q=80&w=1000'),
            images: Array.isArray(data.image) ? data.image : (data.images || []),
            tags: data.tags || [],
            features: data.features || []
          };
          setDestination(mappedData);
          setSelectedImage(mappedData.image);
          
          // Update SEO dynamically
          document.title = `${mappedData.title} - Aluguel de Temporada em Uberlândia | AlugaAki`;
          const metaDescription = document.querySelector('meta[name="description"]');
          if (metaDescription) {
            metaDescription.setAttribute('content', `${mappedData.title}. ${mappedData.description.substring(0, 150)}... Aluguel de chácaras e casas de temporada em Uberlândia.`);
          }
        }
      } catch (err) {
        console.error('Erro ao carregar destino:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchDestination();
  }, [id]);

  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [bookingStatus, setBookingStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [bookedDates, setBookedDates] = useState<{id: string, check_in: string, check_out: string}[]>([]);
  const [selectedImage, setSelectedImage] = useState<string>('');

  const isDateReserved = (date: Date) => {
    return bookedDates.some(period => {
      const start = parseISO(period.check_in);
      const end = parseISO(period.check_out);
      return isWithinInterval(date, { start, end }) || isSameDay(date, start) || isSameDay(date, end);
    });
  };

  const isDateSelected = (date: Date) => {
    if (!checkIn) return false;
    const start = parseISO(checkIn);
    if (!checkOut) return isSameDay(date, start);
    const end = parseISO(checkOut);
    return (isWithinInterval(date, { start, end }) || isSameDay(date, start) || isSameDay(date, end));
  };

  const handleDateClick = (date: Date) => {
    if (isBefore(date, startOfToday())) return;
    if (isDateReserved(date)) return;

    const dateStr = format(date, 'yyyy-MM-dd');

    if (!checkIn || (checkIn && checkOut)) {
      setCheckIn(dateStr);
      setCheckOut('');
    } else {
      const start = parseISO(checkIn);
      if (isBefore(date, start)) {
        setCheckIn(dateStr);
        setCheckOut('');
      } else {
        // Check if any date in between is reserved
        const days = eachDayOfInterval({ start, end: date });
        const hasReserved = days.some(d => isDateReserved(d));
        if (hasReserved) {
          setCheckIn(dateStr);
          setCheckOut('');
        } else {
          setCheckOut(dateStr);
        }
      }
    }
  };

  useEffect(() => {
    if (!destination?.id) return;

    const fetchBookedDates = async () => {
      try {
        const { data, error } = await supabase
          .from('bookings')
          .select('id, check_in, check_out')
          .eq('destination_id', destination.id)
          .in('status', ['confirmed', 'pending']);
        
        if (error && !error.message.includes('does not exist')) {
          console.error('Error fetching booked dates:', error);
        } else if (data) {
          setBookedDates(data);
        }
      } catch (err) {
        console.error('Error in fetchBookedDates:', err);
      }
    };

    fetchBookedDates();
  }, [destination?.id]);

  const isDateRangeAvailable = () => {
    if (!checkIn || !checkOut) return true;
    const start = new Date(checkIn);
    const end = new Date(checkOut);
    
    for (const period of bookedDates) {
      const pStart = new Date(period.check_in);
      const pEnd = new Date(period.check_out);
      
      // Check for overlap
      if (start < pEnd && end > pStart) {
        return false;
      }
    }
    return true;
  };

  const calculateTotal = () => {
    if (!checkIn || !checkOut || !destination) return 0;
    const start = new Date(checkIn);
    const end = new Date(checkOut);
    const nights = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    if (nights <= 0) return 0;
    
    const subtotal = nights * destination.price;
    const serviceFee = (subtotal + cartTotal) * 0.25;
    return subtotal + cartTotal + serviceFee;
  };

  const handleBooking = async () => {
    if (!checkIn || !checkOut || !destination) {
      setBookingStatus('error');
      return;
    }

    if (!isDateRangeAvailable()) {
      setBookingStatus('error');
      alert('As datas selecionadas entram em conflito com reservas existentes. Por favor, escolha outro período.');
      return;
    }
    
    setBookingStatus('loading');
    try {
      // Check for conflicts
      const { data: existingBookings, error: fetchError } = await supabase
        .from('bookings')
        .select('*')
        .eq('destination_id', destination.id)
        .lte('check_in', checkOut)
        .gte('check_out', checkIn);

      if (fetchError && !fetchError.message.includes('does not exist')) {
        console.warn('Could not check availability on client:', fetchError);
      } else if (existingBookings && existingBookings.length > 0) {
        setBookingStatus('error');
        alert('Estas datas já estão reservadas. Por favor, escolha outro período.');
        return;
      }

      // Navigate to checkout with data
      setTimeout(() => {
        setBookingStatus('success');
        navigate('/checkout', {
          state: {
            destination,
            checkIn,
            checkOut,
            total: calculateTotal()
          }
        });
      }, 800);
    } catch (err) {
      console.error('Booking error:', err);
      setBookingStatus('error');
    }
  };

  const handleDelete = async () => {
    if (!destination) return;
    console.log('Iniciando tentativa de exclusão do destino:', destination.id);

    const { data: { session } } = await supabase.auth.getSession();
    const userEmail = session?.user?.email?.toLowerCase();
    
    if (userEmail !== ADMIN_EMAIL.toLowerCase()) {
      console.error('Tentativa de exclusão negada: Usuário não é administrador', userEmail);
      alert('Acesso negado. Apenas o administrador pode excluir anúncios.');
      return;
    }

    if (!window.confirm('Tem certeza que deseja excluir este anúncio permanentemente? Isso removerá também todas as reservas associadas.')) {
      return;
    }

    try {
      setLoading(true);
      
      // First, try to delete associated bookings to avoid foreign key constraints
      const { error: bookingsError } = await supabase
        .from('bookings')
        .delete()
        .eq('destination_id', destination.id);

      if (bookingsError && !bookingsError.message.includes('relation "bookings" does not exist')) {
        console.warn('Aviso ao excluir reservas:', bookingsError);
      }

      // Now delete the destination
      const { error } = await supabase
        .from('destinations')
        .delete()
        .eq('id', destination.id);

      if (error) throw error;
      
      alert('Anúncio excluído com sucesso!');
      navigate('/');
    } catch (err: any) {
      console.error('Erro ao excluir anúncio:', err);
      alert('Erro ao excluir anúncio: ' + (err.message || 'Erro desconhecido'));
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteBooking = async (bookingId: string) => {
    if (!window.confirm('Tem certeza que deseja excluir esta reserva?')) return;

    try {
      const { error } = await supabase
        .from('bookings')
        .delete()
        .eq('id', bookingId);

      if (error) throw error;
      
      setBookedDates(prev => prev.filter(b => b.id !== bookingId));
      alert('Reserva excluída com sucesso!');
    } catch (err: any) {
      console.error('Erro ao excluir reserva:', err);
      alert('Erro ao excluir reserva: ' + err.message);
    }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <span className="text-[10px] uppercase tracking-widest opacity-50">Carregando Santuário...</span>
    </div>
  );

  if (!destination) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4">
      <h2 className="text-2xl font-serif">Santuário não encontrado</h2>
      <Link to="/" className="text-[10px] uppercase tracking-widest border-b border-ink">Voltar para a Coleção</Link>
    </div>
  );

  return (
    <div className="min-h-screen">
      <Navbar />
      
      <main className="container mx-auto px-6 py-12">
        <Link to="/" className="flex items-center gap-2 text-[10px] uppercase tracking-widest opacity-50 mb-12 hover:opacity-100 transition-opacity">
          <ArrowLeft className="w-4 h-4" />
          Voltar para a Coleção
        </Link>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-8"
          >
            <div className="relative aspect-[4/5] overflow-hidden">
              <img 
                src={selectedImage || destination.image} 
                alt={destination.title} 
                className="w-full h-full object-cover transition-all duration-500"
                referrerPolicy="no-referrer"
              />
              <div className="absolute top-8 left-8 bg-paper/90 backdrop-blur px-6 py-3 rounded-full flex items-center gap-3">
                <WifiOff className="w-5 h-5 text-ink" />
                <span className="text-xs uppercase tracking-widest font-bold">
                  Sinal Zero Verificado
                </span>
              </div>
            </div>

            {destination.images && destination.images.length > 0 && (
              <div className="grid grid-cols-5 gap-2">
                {destination.images.map((img, idx) => (
                  <button 
                    key={idx} 
                    onClick={() => setSelectedImage(img)}
                    className={`aspect-square overflow-hidden bg-ink/5 border-2 transition-colors ${selectedImage === img ? 'border-ink' : 'border-transparent hover:border-ink/30'}`}
                  >
                    <img src={img} alt={`Gallery ${idx + 1}`} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  </button>
                ))}
              </div>
            )}
            
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-ink/5 p-6">
                <ShieldCheck className="w-6 h-6 mb-4 opacity-40" />
                <h4 className="text-[10px] uppercase tracking-widest mb-2">Certificação</h4>
                <p className="text-xs opacity-70">Selo de Ouro Digital Detox</p>
              </div>
              <div className="bg-ink/5 p-6">
                <CalendarIcon className="w-6 h-6 mb-4 opacity-40" />
                <h4 className="text-[10px] uppercase tracking-widest mb-2">Disponibilidade</h4>
                <p className="text-xs opacity-70">Vagas Sazonais Curadas</p>
              </div>
            </div>

            {/* Prepare seu Detox Analógico Section */}
            <div className="pt-12 border-t border-ink/10">
              <h3 className="text-2xl font-serif mb-8">Prepare seu Detox Analógico</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                {DETOX_PRODUCTS.map(product => (
                  <div key={product.id} className="bg-white p-6 border border-ink/5 hover:border-ink/20 transition-all group relative">
                    <product.icon className="w-8 h-8 mb-4 opacity-40 group-hover:opacity-100 transition-opacity" />
                    <h4 className="text-sm font-semibold mb-1">{product.name}</h4>
                    <p className="text-[10px] opacity-50 mb-4">{product.description}</p>
                    <div className="flex items-center justify-between mt-auto">
                      <span className="text-sm font-serif italic">R$ {product.price}</span>
                      <button 
                        onClick={() => addToCart({ id: product.id, name: product.name, price: product.price })}
                        className="w-8 h-8 rounded-full border border-ink flex items-center justify-center hover:bg-ink hover:text-paper transition-colors"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
          
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.3em] opacity-50 mb-6">
                <MapPin className="w-4 h-4" />
                {destination.location}
              </div>
              <div className="flex justify-between items-start gap-4 mb-8">
                <h1 className="text-6xl md:text-7xl font-serif">{destination.title}</h1>
                {isAdmin && (
                  <button 
                    onClick={handleDelete}
                    className="mt-4 p-3 bg-red-50 text-red-600 hover:bg-red-600 hover:text-white transition-all rounded-full shadow-sm"
                    title="Excluir Anúncio"
                  >
                    <Trash2 className="w-6 h-6" />
                  </button>
                )}
              </div>
              <p className="text-lg text-ink/70 leading-relaxed mb-12">
                {destination.description}
              </p>
              
              <div className="space-y-6 mb-12">
                <h4 className="text-[11px] uppercase tracking-widest opacity-50">Características do Santuário</h4>
                <ul className="grid grid-cols-2 gap-4">
                  {destination.features?.map((feature, i) => (
                    <li key={i} className="flex items-center gap-3 text-sm">
                      <div className="w-1.5 h-1.5 rounded-full bg-ink/20" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            
            <div className="border-t border-ink/10 pt-12">
              <div className="mb-8 p-6 bg-white border border-ink/10">
                <div className="flex items-center justify-between mb-6">
                  <h4 className="text-[10px] uppercase tracking-widest font-bold">Calendário de Disponibilidade</h4>
                  <div className="flex items-center gap-4">
                    <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="p-1 hover:bg-ink/5 rounded">
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="text-xs font-serif italic capitalize">
                      {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
                    </span>
                    <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="p-1 hover:bg-ink/5 rounded">
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-7 gap-1 mb-2">
                  {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((day, idx) => (
                    <div key={idx} className="text-[8px] text-center opacity-40 font-bold">{day}</div>
                  ))}
                </div>

                <div className="grid grid-cols-7 gap-1">
                  {(() => {
                    const start = startOfWeek(startOfMonth(currentMonth));
                    const end = endOfWeek(endOfMonth(currentMonth));
                    const days = eachDayOfInterval({ start, end });

                    return days.map(day => {
                      const isCurrentMonth = isSameDay(startOfMonth(day), startOfMonth(currentMonth));
                      const reserved = isDateReserved(day);
                      const selected = isDateSelected(day);
                      const isToday = isSameDay(day, startOfToday());
                      const isPast = isBefore(day, startOfToday()) && !isToday;

                      return (
                        <button
                          key={day.toString()}
                          onClick={() => handleDateClick(day)}
                          disabled={isPast || reserved}
                          className={`
                            aspect-square flex items-center justify-center text-[10px] transition-all relative
                            ${!isCurrentMonth ? 'opacity-10' : 'opacity-100'}
                            ${reserved ? 'bg-blue-500 text-white cursor-not-allowed' : ''}
                            ${selected ? 'bg-ink text-paper z-10' : ''}
                            ${!reserved && !selected && !isPast ? 'hover:bg-ink/5' : ''}
                            ${isPast ? 'opacity-20 cursor-not-allowed' : ''}
                            ${isToday && !selected ? 'border border-ink/20' : ''}
                          `}
                        >
                          {format(day, 'd')}
                          {reserved && (
                            <div className="absolute -top-1 -right-1 w-1.5 h-1.5 bg-blue-500 rounded-full border border-white" />
                          )}
                        </button>
                      );
                    });
                  })()}
                </div>

                <div className="mt-6 flex flex-wrap gap-4 pt-4 border-t border-ink/5">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-blue-500" />
                    <span className="text-[8px] uppercase tracking-widest opacity-50">Reservado</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-ink" />
                    <span className="text-[8px] uppercase tracking-widest opacity-50">Sua Seleção</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 border border-ink/20" />
                    <span className="text-[8px] uppercase tracking-widest opacity-50">Hoje</span>
                  </div>
                </div>
              </div>

              {bookedDates.length > 0 && (
                <div className="mb-8 p-6 bg-ink/5 border border-ink/10">
                  <h4 className="text-[10px] uppercase tracking-widest opacity-50 mb-4 flex items-center gap-2">
                    <CalendarIcon className="w-3 h-3" /> Datas Indisponíveis
                  </h4>
                  <ul className="space-y-3">
                    {bookedDates.map((period, idx) => {
                      // Adding timezone offset to prevent date shifting
                      const start = new Date(period.check_in + 'T12:00:00Z').toLocaleDateString('pt-BR');
                      const end = new Date(period.check_out + 'T12:00:00Z').toLocaleDateString('pt-BR');
                      return (
                        <li key={idx} className="text-xs opacity-70 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className="w-1.5 h-1.5 rounded-full bg-blue-500/70" />
                            {start} até {end}
                          </div>
                          {isAdmin && (
                            <button 
                              onClick={() => handleDeleteBooking(period.id)}
                              className="text-red-500 hover:text-red-700 p-1"
                              title="Excluir Reserva"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 mb-8">
                <div>
                  <label className="text-[10px] uppercase tracking-widest opacity-50 block mb-2">Check-in</label>
                  <input 
                    type="date" 
                    value={checkIn}
                    onChange={(e) => setCheckIn(e.target.value)}
                    className="w-full bg-ink/5 border-none p-3 text-sm focus:ring-1 focus:ring-ink outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-widest opacity-50 block mb-2">Check-out</label>
                  <input 
                    type="date" 
                    value={checkOut}
                    onChange={(e) => setCheckOut(e.target.value)}
                    className="w-full bg-ink/5 border-none p-3 text-sm focus:ring-1 focus:ring-ink outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between mb-8">
                <div>
                  <span className="text-[10px] uppercase tracking-widest opacity-50 block">Preço por noite</span>
                  <span className="text-4xl font-serif italic">${destination.price}</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] uppercase tracking-widest opacity-50 block">Total (incl. taxa de 15%)</span>
                  <span className="text-2xl font-serif italic">
                    {calculateTotal() > 0 ? `$${calculateTotal().toFixed(2)}` : '--'}
                  </span>
                </div>
              </div>
              
              <div className="mb-6 space-y-2">
                {cartTotal > 0 && (
                  <div className="flex justify-between text-[10px] uppercase tracking-widest opacity-60">
                    <span>Adicionais do Kit Analógico</span>
                    <span>R$ {cartTotal.toFixed(2)}</span>
                  </div>
                )}
              </div>
              
              <button 
                onClick={handleBooking}
                disabled={!isDateRangeAvailable()}
                className="w-full py-6 bg-ink text-paper text-sm uppercase tracking-[0.3em] hover:bg-ink/90 transition-all disabled:opacity-50"
              >
                {bookingStatus === 'loading' ? 'Processando...' : 'Solicitar Reserva'}
              </button>

              {!isDateRangeAvailable() && (
                <p className="text-center text-red-600 text-[10px] uppercase tracking-widest mt-4">
                  Período indisponível. Conflito com reservas existentes.
                </p>
              )}
              {bookingStatus === 'error' && (!checkIn || !checkOut) && (
                <p className="text-center text-red-600 text-[10px] uppercase tracking-widest mt-4">
                  Por favor, selecione as datas de check-in e check-out.
                </p>
              )}
              {bookingStatus === 'error' && checkIn && checkOut && (
                <p className="text-center text-red-600 text-[10px] uppercase tracking-widest mt-4">
                  Erro ao processar reserva. Tente novamente.
                </p>
              )}

              <p className="text-center text-[10px] uppercase tracking-widest opacity-40 mt-4">
                * Todas as reservas incluem uma orientação obrigatória livre de dispositivos.
              </p>
            </div>
          </motion.div>
        </div>
      </main>
      
      <Footer />
    </div>
  );
};
