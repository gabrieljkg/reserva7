import React, { useState, useEffect, useRef } from 'react';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'motion/react';
import { MessageSquare, User, Send, Search, ChevronRight, Clock } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

interface Chat {
  id: string;
  user_id: string;
  created_at: string;
  last_message_at: string;
  user_email?: string;
  user_name?: string;
  unread_count_admin?: number;
}

interface Message {
  id: string;
  chat_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  is_admin: boolean;
}

const ADMIN_EMAIL = 'gabrielcalid@gmail.com';
const NOTIFICATION_SOUND_URL = 'https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3';

export const AdminChat = () => {
  const [session, setSession] = useState<any>(null);
  const [chats, setChats] = useState<Chat[]>([]);
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const chatsRef = useRef<Chat[]>([]);

  useEffect(() => {
    chatsRef.current = chats;
  }, [chats]);

  useEffect(() => {
    audioRef.current = new Audio(NOTIFICATION_SOUND_URL);
    
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (!session || session.user.email !== ADMIN_EMAIL) {
        navigate('/perfil');
      } else {
        fetchChats();
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (!session || session.user.email !== ADMIN_EMAIL) {
        navigate('/perfil');
      }
    });

    // Real-time subscription for new chats and unread updates
    const chatsChannel = supabase
      .channel('admin_chats_list')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'chats' 
      }, (payload) => {
        if (payload.eventType === 'INSERT') {
          const newChat = payload.new as Chat;
          setChats(prev => {
            if (prev.find(c => c.id === newChat.id)) return prev;
            return [newChat, ...prev];
          });
          audioRef.current?.play().catch(() => {});
        } else if (payload.eventType === 'UPDATE') {
          const updatedChat = payload.new as Chat;
          setChats(prev => {
            const oldChat = prev.find(c => c.id === updatedChat.id);
            // If it's a new message (unread count increased), play sound
            if (oldChat && (updatedChat.unread_count_admin || 0) > (oldChat.unread_count_admin || 0)) {
              audioRef.current?.play().catch(() => {});
            }
            return prev.map(c => c.id === updatedChat.id ? { ...c, ...updatedChat } : c);
          });
        }
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
      supabase.removeChannel(chatsChannel);
    };
  }, [navigate]);

  useEffect(() => {
    if (selectedChat?.id) {
      fetchMessages(selectedChat.id);
      resetUnreadCount(selectedChat.id);
      
      const channel = supabase
        .channel(`admin_chat:${selectedChat.id}`)
        .on('postgres_changes', { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'messages',
          filter: `chat_id=eq.${selectedChat.id}`
        }, (payload) => {
          const newMessage = payload.new as Message;
          setMessages(prev => {
            if (prev.find(m => m.id === newMessage.id)) return prev;
            return [...prev, newMessage];
          });
          if (!newMessage.is_admin) {
            resetUnreadCount(selectedChat.id);
          }
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [selectedChat?.id]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const resetUnreadCount = async (chatId: string) => {
    try {
      await supabase
        .from('chats')
        .update({ unread_count_admin: 0 })
        .eq('id', chatId);
    } catch (err) {
      console.error('Error resetting unread count:', err);
    }
  };

  const fetchChats = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('chats')
        .select('*')
        .order('last_message_at', { ascending: false });

      if (error) {
        console.error('Error fetching chats:', error);
      } else {
        setChats(data || []);
      }
    } catch (err) {
      console.error('Unexpected error in fetchChats:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (chatId: string) => {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('chat_id', chatId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching messages:', error);
    } else {
      setMessages(data || []);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedChat || !session || sending) return;

    const messageContent = newMessage.trim();
    setNewMessage('');
    setSending(true);

    try {
      const { error } = await supabase
        .from('messages')
        .insert([{
          chat_id: selectedChat.id,
          sender_id: session.user.id,
          content: messageContent,
          is_admin: true
        }]);

      if (error) {
        console.error('Error sending message:', error);
        setNewMessage(messageContent);
      } else {
        await supabase
          .from('chats')
          .update({ last_message_at: new Date().toISOString() })
          .eq('id', selectedChat.id);
      }
    } catch (err) {
      console.error('Unexpected error in handleSendMessage:', err);
      setNewMessage(messageContent);
    } finally {
      setSending(false);
    }
  };

  const filteredChats = chats.filter(chat => 
    (chat.user_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (chat.user_email || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    chat.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!session || session.user.email !== ADMIN_EMAIL) return null;

  return (
    <div className="min-h-screen bg-paper flex flex-col">
      <Navbar />
      <main className="flex-1 container mx-auto px-6 py-24">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-serif mb-2">Caixa de Entrada</h1>
            <p className="text-xs opacity-50 uppercase tracking-widest">Gerencie suas conversas com os clientes</p>
          </div>
          <Link to="/admin/reservas" className="text-[10px] uppercase tracking-widest border-b border-ink/30 hover:border-ink pb-1 transition-colors">
            Voltar para Reservas
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-[750px]">
          {/* Chat List */}
          <div className="lg:col-span-4 bg-white border border-ink/10 flex flex-col overflow-hidden rounded-2xl shadow-sm">
            <div className="p-4 border-b border-ink/10 bg-ink/5">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-30" />
                <input
                  type="text"
                  placeholder="Buscar por nome ou e-mail..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-white border-none p-3 pl-10 text-sm outline-none focus:ring-1 focus:ring-ink rounded-xl shadow-sm"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="p-8 text-center opacity-50 text-sm">Carregando conversas...</div>
              ) : filteredChats.length === 0 ? (
                <div className="p-8 text-center opacity-50 text-sm">Nenhuma conversa encontrada.</div>
              ) : (
                filteredChats.map((chat) => (
                  <button
                    key={chat.id}
                    onClick={() => setSelectedChat(chat)}
                    className={`w-full p-4 flex items-center gap-4 hover:bg-ink/5 transition-colors border-b border-ink/5 text-left relative ${
                      selectedChat?.id === chat.id ? 'bg-ink/5' : ''
                    }`}
                  >
                    <div className="w-12 h-12 bg-ink/10 rounded-full flex items-center justify-center flex-shrink-0 relative">
                      <User className="w-6 h-6 opacity-30" />
                      {chat.unread_count_admin && chat.unread_count_admin > 0 && (
                        <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center font-bold border-2 border-white">
                          {chat.unread_count_admin}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start mb-1">
                        <h3 className={`text-sm truncate ${chat.unread_count_admin ? 'font-bold' : 'font-medium'}`}>
                          {chat.user_name || 'Usuário Anon'}
                        </h3>
                        <span className="text-[8px] opacity-50 uppercase tracking-widest whitespace-nowrap ml-2">
                          {new Date(chat.last_message_at || chat.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-xs opacity-50 truncate">{chat.user_email || 'Sem e-mail'}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 opacity-20" />
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Chat Window */}
          <div className="lg:col-span-8 bg-white border border-ink/10 flex flex-col overflow-hidden rounded-2xl shadow-sm">
            {selectedChat ? (
              <>
                {/* Header */}
                <div className="p-4 border-b border-ink/10 flex justify-between items-center bg-ink text-paper">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-paper/20 rounded-full flex items-center justify-center">
                      <User className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-serif">{selectedChat.user_name || 'Usuário'}</h3>
                      <p className="text-[10px] uppercase tracking-widest opacity-50">{selectedChat.user_email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-[10px] uppercase tracking-widest opacity-50">
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      <span>ID: {selectedChat.id.slice(0, 8)}</span>
                    </div>
                  </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-paper/30">
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.is_admin ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[70%] p-4 rounded-2xl text-sm shadow-sm ${
                          msg.is_admin
                            ? 'bg-ink text-paper rounded-tr-none'
                            : 'bg-white border border-ink/10 text-ink rounded-tl-none'
                        }`}
                      >
                        {msg.content}
                        <p className={`text-[8px] mt-2 opacity-50 ${msg.is_admin ? 'text-right' : 'text-left'}`}>
                          {new Date(msg.created_at).toLocaleString([], { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <form onSubmit={handleSendMessage} className="p-6 bg-white border-t border-ink/10 flex gap-4">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Escreva sua resposta..."
                    className="flex-1 bg-ink/5 border-none p-4 text-sm outline-none focus:ring-1 focus:ring-ink rounded-xl"
                  />
                  <button
                    type="submit"
                    disabled={!newMessage.trim() || sending}
                    className="bg-ink text-paper px-8 rounded-xl hover:bg-ink/90 transition-colors disabled:opacity-50 flex items-center gap-2 font-bold text-[10px] uppercase tracking-widest"
                  >
                    {sending ? (
                      <div className="w-4 h-4 border-2 border-paper/30 border-t-paper rounded-full animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                    <span>{sending ? 'Enviando...' : 'Responder'}</span>
                  </button>
                </form>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-12 opacity-30">
                <div className="w-24 h-24 bg-ink/5 rounded-full flex items-center justify-center mb-6">
                  <MessageSquare className="w-12 h-12" />
                </div>
                <h3 className="text-2xl font-serif mb-2">Sua Caixa de Entrada</h3>
                <p className="text-sm max-w-xs">Selecione uma conversa à esquerda para começar a responder seus clientes em tempo real.</p>
              </div>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};
