import React, { useState, useEffect } from 'react';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { supabase } from '../lib/supabase';
import { motion } from 'motion/react';
import { User, Mail, Phone, Lock, LogOut, Camera, MapPin, ShieldCheck, Copy, Check, Share2, MessageSquare } from 'lucide-react';
import { Link } from 'react-router-dom';

export const Profile = () => {
  const [session, setSession] = useState<any>(null);
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const ADMIN_EMAIL = 'gabrielcalid@gmail.com';

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    phone: '',
    fullName: ''
  });

  const [isEditing, setIsEditing] = useState(false);
  const [editPhone, setEditPhone] = useState('');
  const [editName, setEditName] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editCep, setEditCep] = useState('');
  const [editAvatarUrl, setEditAvatarUrl] = useState('');
  const [airbnbSyncActive, setAirbnbSyncActive] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [updateLoading, setUpdateLoading] = useState(false);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [userBookings, setUserBookings] = useState<any[]>([]);
  const [bookingsLoading, setBookingsLoading] = useState(false);

  useEffect(() => {
    document.title = "Meu Perfil - AlugaAki";
    const params = new URLSearchParams(window.location.search);
    const status = params.get('status');

    if (status === 'success') {
      setMessage({ type: 'success', text: 'Pagamento recebido! Estamos finalizando sua reserva. Isso pode levar alguns segundos...' });
      
      // Poll for new bookings if we just came back from a successful payment
      const interval = setInterval(() => {
        if (session?.user?.id) {
          fetchUserBookings(session.user.id);
        }
      }, 3000);

      // Stop polling after 30 seconds
      const timeout = setTimeout(() => {
        clearInterval(interval);
      }, 30000);

      return () => {
        clearInterval(interval);
        clearTimeout(timeout);
      };
    } else if (status === 'failure') {
      setMessage({ type: 'error', text: 'O pagamento não foi concluído. Por favor, tente novamente.' });
    } else if (status === 'pending') {
      setMessage({ type: 'success', text: 'Seu pagamento está pendente de aprovação. Avisaremos assim que for confirmado.' });
    }
  }, [session]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        setEditPhone(session.user.user_metadata?.phone || '');
        setEditName(session.user.user_metadata?.full_name || '');
        setEditAddress(session.user.user_metadata?.address || '');
        setEditCep(session.user.user_metadata?.cep || '');
        setEditAvatarUrl(session.user.user_metadata?.avatar_url || '');
        setAirbnbSyncActive(session.user.user_metadata?.airbnb_sync_active || false);
        fetchUserBookings(session.user.id);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        setEditPhone(session.user.user_metadata?.phone || '');
        setEditName(session.user.user_metadata?.full_name || '');
        setEditAddress(session.user.user_metadata?.address || '');
        setEditCep(session.user.user_metadata?.cep || '');
        setEditAvatarUrl(session.user.user_metadata?.avatar_url || '');
        setAirbnbSyncActive(session.user.user_metadata?.airbnb_sync_active || false);
        fetchUserBookings(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchUserBookings = async (userId: string) => {
    setBookingsLoading(true);
    try {
      const { data, error } = await supabase
        .from('bookings')
        .select(`
          *,
          destinations (
            title,
            location
          )
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error && !error.message.includes('relation "bookings" does not exist')) {
        console.error('Error fetching user bookings:', error);
      } else if (data) {
        setUserBookings(data);
      }
    } catch (err) {
      console.error('Error in fetchUserBookings:', err);
    } finally {
      setBookingsLoading(false);
    }
  };

  const handleDeleteBooking = async (bookingId: string) => {
    if (!window.confirm('Tem certeza que deseja cancelar esta reserva?')) return;

    try {
      const { error } = await supabase
        .from('bookings')
        .delete()
        .eq('id', bookingId);

      if (error) throw error;
      
      setUserBookings(prev => prev.filter(b => b.id !== bookingId));
      setMessage({ type: 'success', text: 'Reserva cancelada com sucesso!' });
    } catch (error: any) {
      setMessage({ type: 'error', text: 'Erro ao cancelar reserva: ' + error.message });
    }
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 200;
          const MAX_HEIGHT = 200;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
          setEditAvatarUrl(dataUrl);
          
          // Auto-save avatar
          setAvatarLoading(true);
          supabase.auth.updateUser({
            data: { avatar_url: dataUrl }
          }).then(({ error }) => {
            if (error) {
              setMessage({ type: 'error', text: 'Erro ao salvar a foto de perfil.' });
            } else {
              setMessage({ type: 'success', text: 'Foto de perfil atualizada com sucesso!' });
            }
          }).finally(() => {
            setAvatarLoading(false);
          });
        };
        img.src = reader.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email: formData.email,
          password: formData.password,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({
          email: formData.email,
          password: formData.password,
          options: {
            data: {
              full_name: formData.fullName,
              phone: formData.phone,
            }
          }
        });
        if (error) throw error;
        setMessage({ type: 'success', text: 'Cadastro realizado! Verifique seu e-mail para confirmar a conta.' });
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Erro na autenticação' });
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const handleUpdateProfile = async () => {
    setUpdateLoading(true);
    setMessage(null);
    try {
      const { data, error } = await supabase.auth.updateUser({
        data: { 
          phone: editPhone, 
          full_name: editName,
          address: editAddress,
          cep: editCep,
          avatar_url: editAvatarUrl,
          airbnb_sync_active: airbnbSyncActive
        }
      });
      if (error) throw error;
      setMessage({ type: 'success', text: 'Perfil atualizado com sucesso!' });
      setIsEditing(false);
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Erro ao atualizar perfil' });
    } finally {
      setUpdateLoading(false);
    }
  };

  const handleCopyEmail = () => {
    const email = `${session.user.id}@robot.zapier.com`;
    navigator.clipboard.writeText(email).then(() => {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    });
  };

  const handleToggleAirbnbSync = async (active: boolean) => {
    setAirbnbSyncActive(active);
    // Auto-save this setting
    try {
      await supabase.auth.updateUser({
        data: { airbnb_sync_active: active }
      });
    } catch (err) {
      console.error('Error updating airbnb sync:', err);
    }
  };

  if (session) {
    return (
      <div className="min-h-screen bg-paper flex flex-col">
        <Navbar />
        <main className="flex-1 container mx-auto px-6 py-24">
          <div className="max-w-2xl mx-auto bg-white p-8 border border-ink/10">
            <div className="flex items-center gap-4 mb-8">
              <div className="relative w-16 h-16 bg-ink/5 rounded-full flex items-center justify-center overflow-hidden group">
                {avatarLoading ? (
                  <div className="w-5 h-5 border-2 border-ink border-t-transparent rounded-full animate-spin"></div>
                ) : (isEditing ? editAvatarUrl : session.user.user_metadata?.avatar_url) ? (
                  <img 
                    src={isEditing ? editAvatarUrl : session.user.user_metadata?.avatar_url} 
                    alt="Avatar" 
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <User className="w-8 h-8 opacity-50" />
                )}
                
                <label className="absolute inset-0 bg-ink/50 flex items-center justify-center cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity">
                  <Camera className="w-6 h-6 text-paper" />
                  <input 
                    type="file" 
                    accept="image/*" 
                    className="hidden" 
                    onChange={handleAvatarChange}
                    disabled={avatarLoading}
                  />
                </label>
              </div>
              <div>
                <h1 className="text-2xl font-serif">{session.user.user_metadata?.full_name || 'Usuário'}</h1>
                <p className="text-sm opacity-50">{session.user.email}</p>
              </div>
            </div>

            {message && (
              <div className={`p-4 mb-6 text-sm ${message.type === 'error' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                {message.text}
              </div>
            )}

            {isEditing ? (
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] uppercase tracking-widest opacity-50 block mb-2">Nome Completo</label>
                  <input 
                    type="text" 
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    className="w-full bg-ink/5 border-none p-3 text-sm outline-none focus:ring-1 focus:ring-ink"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-widest opacity-50 block mb-2">Telefone</label>
                  <input 
                    type="tel" 
                    value={editPhone}
                    onChange={e => setEditPhone(e.target.value)}
                    className="w-full bg-ink/5 border-none p-3 text-sm outline-none focus:ring-1 focus:ring-ink"
                    placeholder="(00) 00000-0000"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-widest opacity-50 block mb-2">CEP</label>
                  <input 
                    type="text" 
                    value={editCep}
                    onChange={e => setEditCep(e.target.value)}
                    className="w-full bg-ink/5 border-none p-3 text-sm outline-none focus:ring-1 focus:ring-ink"
                    placeholder="00000-000"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-widest opacity-50 block mb-2">Endereço</label>
                  <input 
                    type="text" 
                    value={editAddress}
                    onChange={e => setEditAddress(e.target.value)}
                    className="w-full bg-ink/5 border-none p-3 text-sm outline-none focus:ring-1 focus:ring-ink"
                    placeholder="Rua, Número, Bairro, Cidade - UF"
                  />
                </div>
                <div className="flex gap-4 pt-4">
                  <button 
                    onClick={handleUpdateProfile}
                    disabled={updateLoading}
                    className="flex-1 bg-ink text-paper py-3 text-[10px] uppercase tracking-widest font-bold hover:bg-ink/90 transition-colors disabled:opacity-50"
                  >
                    {updateLoading ? 'Salvando...' : 'Salvar Alterações'}
                  </button>
                  <button 
                    onClick={() => {
                      setIsEditing(false);
                      setEditPhone(session.user.user_metadata?.phone || '');
                      setEditName(session.user.user_metadata?.full_name || '');
                      setEditAddress(session.user.user_metadata?.address || '');
                      setEditCep(session.user.user_metadata?.cep || '');
                      setEditAvatarUrl(session.user.user_metadata?.avatar_url || '');
                    }}
                    disabled={updateLoading}
                    className="flex-1 bg-ink/10 text-ink py-3 text-[10px] uppercase tracking-widest font-bold hover:bg-ink/20 transition-colors disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="p-4 bg-ink/5 flex justify-between items-center">
                  <div>
                    <h3 className="text-[10px] uppercase tracking-widest opacity-50 mb-2">Telefone</h3>
                    <p>{session.user.user_metadata?.phone || 'Não informado'}</p>
                  </div>
                  <button 
                    onClick={() => setIsEditing(true)}
                    className="text-xs border-b border-ink/30 hover:border-ink pb-0.5 transition-colors uppercase tracking-widest"
                  >
                    Editar
                  </button>
                </div>

                <div className="p-4 bg-ink/5 flex justify-between items-center">
                  <div>
                    <h3 className="text-[10px] uppercase tracking-widest opacity-50 mb-2">Nome Completo</h3>
                    <p>{session.user.user_metadata?.full_name || 'Não informado'}</p>
                  </div>
                  <button 
                    onClick={() => setIsEditing(true)}
                    className="text-xs border-b border-ink/30 hover:border-ink pb-0.5 transition-colors uppercase tracking-widest"
                  >
                    Editar
                  </button>
                </div>

                <div className="p-4 bg-ink/5 flex justify-between items-center">
                  <div>
                    <h3 className="text-[10px] uppercase tracking-widest opacity-50 mb-2">Endereço</h3>
                    <p>{session.user.user_metadata?.address || 'Não informado'}</p>
                  </div>
                  <button 
                    onClick={() => setIsEditing(true)}
                    className="text-xs border-b border-ink/30 hover:border-ink pb-0.5 transition-colors uppercase tracking-widest"
                  >
                    Editar
                  </button>
                </div>

                <div className="p-4 bg-ink/5 flex justify-between items-center">
                  <div>
                    <h3 className="text-[10px] uppercase tracking-widest opacity-50 mb-2">CEP</h3>
                    <p>{session.user.user_metadata?.cep || 'Não informado'}</p>
                  </div>
                  <button 
                    onClick={() => setIsEditing(true)}
                    className="text-xs border-b border-ink/30 hover:border-ink pb-0.5 transition-colors uppercase tracking-widest"
                  >
                    Editar
                  </button>
                </div>

                {session.user.email === ADMIN_EMAIL && (
                  <div className="p-6 bg-ink text-paper flex flex-col gap-6">
                    <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                      <div className="flex items-center gap-3">
                        <ShieldCheck className="w-6 h-6 opacity-50" />
                        <div>
                          <h3 className="text-[10px] uppercase tracking-widest opacity-50 mb-1">Acesso Administrativo</h3>
                          <p className="text-sm font-serif">Gerenciamento de Reservas</p>
                        </div>
                      </div>
                      <Link 
                        to="/admin/reservas"
                        className="w-full md:w-auto px-6 py-3 bg-paper text-ink text-[10px] uppercase tracking-widest font-bold hover:bg-white transition-colors text-center"
                      >
                        Acessar Painel
                      </Link>
                    </div>
                    
                    <div className="flex flex-col md:flex-row justify-between items-center gap-4 pt-6 border-t border-paper/10">
                      <div className="flex items-center gap-3">
                        <MessageSquare className="w-6 h-6 opacity-50" />
                        <div>
                          <h3 className="text-[10px] uppercase tracking-widest opacity-50 mb-1">Suporte ao Cliente</h3>
                          <p className="text-sm font-serif">Chat de Atendimento</p>
                        </div>
                      </div>
                      <Link 
                        to="/admin/chat"
                        className="w-full md:w-auto px-6 py-3 bg-paper text-ink text-[10px] uppercase tracking-widest font-bold hover:bg-white transition-colors text-center"
                      >
                        Acessar Chat
                      </Link>
                    </div>
                  </div>
                )}

                <div className="pt-8 border-t border-ink/10">
                  <h2 className="text-2xl font-serif mb-6">Integrações</h2>
                  <div className="p-6 bg-ink/5 border border-ink/10">
                    <div className="flex justify-between items-center mb-4">
                      <div className="flex items-center gap-3">
                        <Share2 className="w-5 h-5 opacity-50" />
                        <div>
                          <h3 className="text-sm font-serif">Sincronizar Airbnb</h3>
                          <p className="text-[10px] uppercase tracking-widest opacity-50">Importação automática de reservas</p>
                        </div>
                      </div>
                      <button 
                        onClick={() => handleToggleAirbnbSync(!airbnbSyncActive)}
                        className={`w-12 h-6 rounded-full transition-colors relative ${airbnbSyncActive ? 'bg-ink' : 'bg-ink/20'}`}
                      >
                        <div className={`absolute top-1 w-4 h-4 bg-paper rounded-full transition-all ${airbnbSyncActive ? 'left-7' : 'left-1'}`} />
                      </button>
                    </div>
                    
                    {airbnbSyncActive && (
                      <div className="mt-4 p-4 bg-white border border-ink/5 text-sm">
                        <p className="opacity-70 mb-3">
                          Para importar suas reservas automaticamente, encaminhe seus e-mails de confirmação do Airbnb para:
                        </p>
                        <div className="flex items-center gap-2 bg-ink/5 p-2 rounded">
                          <code className="flex-1 text-xs font-mono truncate">a7uygnis@robot.zapier.com</code>
                          <button 
                            onClick={handleCopyEmail}
                            className="flex items-center gap-2 px-3 py-1.5 hover:bg-ink/5 rounded transition-colors text-[10px] uppercase tracking-widest font-bold"
                            title="Copiar E-mail"
                          >
                            {copySuccess ? (
                              <>
                                <Check className="w-3 h-3 text-green-600" />
                                <span>Copiado</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3 opacity-50" />
                                <span>Copiar E-mail</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-8 border-t border-ink/10">
                  {session.user.user_metadata?.airbnb_sync_active && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
                      <div className="flex items-center gap-3 mb-3">
                        <Share2 className="w-5 h-5 text-blue-600" />
                        <h3 className="text-blue-800 font-bold">Sincronização com Airbnb Ativa</h3>
                      </div>
                      <p className="text-blue-700 text-sm mb-4">
                        Para importar suas reservas automaticamente, encaminhe seus e-mails de confirmação do Airbnb para o endereço abaixo:
                      </p>
                      <div className="flex items-center gap-2 bg-white p-3 rounded border border-blue-200">
                        <code className="flex-1 text-xs font-mono text-blue-900 truncate">
                          {session.user.id}@robot.zapier.com
                        </code>
                        <button 
                          onClick={() => {
                            navigator.clipboard.writeText(`${session.user.id}@robot.zapier.com`);
                            setCopySuccess(true);
                            setTimeout(() => setCopySuccess(false), 2000);
                          }}
                          className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-[10px] uppercase tracking-widest font-bold"
                        >
                          {copySuccess ? (
                            <>
                              <Check className="w-3 h-3" />
                              <span>Copiado</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>Copiar E-mail</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  )}

                  <h2 className="text-2xl font-serif mb-6">Minhas Reservas</h2>
                  {bookingsLoading ? (
                    <p className="text-xs opacity-50 uppercase tracking-widest">Carregando suas reservas...</p>
                  ) : userBookings.length === 0 ? (
                    <div className="p-8 border border-dashed border-ink/20 text-center">
                      <p className="text-sm opacity-50 mb-4">Você ainda não tem reservas.</p>
                      <Link to="/" className="text-[10px] uppercase tracking-widest border-b border-ink pb-1">Explorar Santuários</Link>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {userBookings.map((booking) => (
                        <div key={booking.id} className="p-6 bg-ink/5 border border-ink/10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                          <div>
                            <h3 className="text-lg font-serif">{booking.destinations?.title || 'Santuário'}</h3>
                            <p className="text-xs opacity-50 mb-2">{booking.destinations?.location}</p>
                            <div className="flex items-center gap-4 text-[10px] uppercase tracking-widest opacity-70">
                              <span>{new Date(booking.check_in + 'T12:00:00Z').toLocaleDateString('pt-BR')} — {new Date(booking.check_out + 'T12:00:00Z').toLocaleDateString('pt-BR')}</span>
                              <span className={`px-2 py-0.5 rounded-full ${
                                booking.status === 'confirmed' ? 'bg-green-100 text-green-700' : 
                                booking.status === 'cancelled' ? 'bg-red-100 text-red-700' : 
                                'bg-amber-100 text-amber-700'
                              }`}>
                                {booking.status === 'confirmed' ? 'Confirmada' : 
                                 booking.status === 'cancelled' ? 'Cancelada' : 'Pendente'}
                              </span>
                            </div>
                          </div>
                          <button 
                            onClick={() => handleDeleteBooking(booking.id)}
                            className="text-[10px] uppercase tracking-widest text-red-600 border-b border-red-600/30 hover:border-red-600 pb-0.5 transition-colors"
                          >
                            Cancelar Reserva
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <button 
                  onClick={handleLogout}
                  className="flex items-center gap-2 text-sm text-red-600 hover:opacity-70 transition-opacity mt-8"
                >
                  <LogOut className="w-4 h-4" />
                  Sair da conta
                </button>
              </div>
            )}
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper flex flex-col">
      <Navbar />
      <main className="flex-1 container mx-auto px-6 py-24 flex items-center justify-center">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md bg-white p-8 border border-ink/10"
        >
          <h1 className="text-3xl font-serif mb-2 text-center">
            {isLogin ? 'Bem-vindo de volta' : 'Crie sua conta'}
          </h1>
          <p className="text-xs text-center opacity-50 uppercase tracking-widest mb-8">
            {isLogin ? 'Acesse seu santuário' : 'Junte-se ao Unplugged Bliss'}
          </p>

          {message && (
            <div className={`p-4 mb-6 text-sm ${message.type === 'error' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
              {message.text}
            </div>
          )}

          <form onSubmit={handleAuth} className="space-y-4">
            {!isLogin && (
              <>
                <div>
                  <label className="text-[10px] uppercase tracking-widest opacity-50 block mb-2">Nome Completo</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-30" />
                    <input 
                      type="text" 
                      required
                      value={formData.fullName}
                      onChange={e => setFormData({...formData, fullName: e.target.value})}
                      className="w-full bg-ink/5 border-none p-3 pl-10 text-sm outline-none focus:ring-1 focus:ring-ink"
                      placeholder="Seu nome"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-widest opacity-50 block mb-2">Telefone</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-30" />
                    <input 
                      type="tel" 
                      required
                      value={formData.phone}
                      onChange={e => setFormData({...formData, phone: e.target.value})}
                      className="w-full bg-ink/5 border-none p-3 pl-10 text-sm outline-none focus:ring-1 focus:ring-ink"
                      placeholder="(00) 00000-0000"
                    />
                  </div>
                </div>
              </>
            )}

            <div>
              <label className="text-[10px] uppercase tracking-widest opacity-50 block mb-2">E-mail</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-30" />
                <input 
                  type="email" 
                  required
                  value={formData.email}
                  onChange={e => setFormData({...formData, email: e.target.value})}
                  className="w-full bg-ink/5 border-none p-3 pl-10 text-sm outline-none focus:ring-1 focus:ring-ink"
                  placeholder="seu@email.com"
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] uppercase tracking-widest opacity-50 block mb-2">Senha</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-30" />
                <input 
                  type="password" 
                  required
                  value={formData.password}
                  onChange={e => setFormData({...formData, password: e.target.value})}
                  className="w-full bg-ink/5 border-none p-3 pl-10 text-sm outline-none focus:ring-1 focus:ring-ink"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <button 
              type="submit" 
              disabled={loading}
              className="w-full bg-ink text-paper py-4 text-[10px] uppercase tracking-widest font-bold hover:bg-ink/90 transition-colors disabled:opacity-50 mt-4"
            >
              {loading ? 'Processando...' : (isLogin ? 'Entrar' : 'Cadastrar')}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button 
              type="button"
              onClick={() => setIsLogin(!isLogin)}
              className="text-xs opacity-50 hover:opacity-100 border-b border-ink/30 pb-1"
            >
              {isLogin ? 'Não tem uma conta? Cadastre-se' : 'Já tem uma conta? Entre'}
            </button>
          </div>
        </motion.div>
      </main>
      <Footer />
    </div>
  );
};
