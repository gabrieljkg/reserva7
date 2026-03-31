import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, X, Send, User } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'motion/react';

interface Message {
  id: string;
  chat_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  is_admin: boolean;
}

export function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [session, setSession] = useState<any>(null);
  const [chatId, setChatId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        getOrCreateChat(session.user);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user) {
        getOrCreateChat(session.user);
      } else {
        setChatId(null);
        setMessages([]);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (chatId) {
      fetchMessages();
      
      const channel = supabase
        .channel(`chat:${chatId}`)
        .on('postgres_changes', { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'messages',
          filter: `chat_id=eq.${chatId}`
        }, (payload) => {
          setMessages(prev => [...prev, payload.new as Message]);
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [chatId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const getOrCreateChat = async (user: any) => {
    if (!user) return;
    try {
      const userMetadata = user.user_metadata;
      const userName = userMetadata?.full_name || userMetadata?.name || user.email?.split('@')[0] || 'Usuário';
      const userEmail = user.email;

      // Check if chat exists
      const { data: existingChat, error: fetchError } = await supabase
        .from('chats')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (fetchError) {
        console.error('Error fetching chat:', fetchError);
        return;
      }

      if (existingChat) {
        setChatId(existingChat.id);
        // Update metadata in case it changed
        await supabase
          .from('chats')
          .update({ 
            user_name: userName, 
            user_email: userEmail 
          })
          .eq('id', existingChat.id);
      } else {
        // Create new chat with metadata
        const { data: newChat, error: createError } = await supabase
          .from('chats')
          .insert([{ 
            user_id: user.id,
            user_name: userName,
            user_email: userEmail
          }])
          .select()
          .maybeSingle();

        if (createError) {
          console.error('Error creating chat:', createError);
          return;
        }
        if (newChat) setChatId(newChat.id);
      }
    } catch (err) {
      console.error('Unexpected error in getOrCreateChat:', err);
    }
  };

  const fetchMessages = async () => {
    if (!chatId) return;
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
    if (!newMessage.trim() || !chatId || !session || sending) return;

    const messageContent = newMessage.trim();
    setNewMessage('');
    setSending(true);

    try {
      const { error } = await supabase
        .from('messages')
        .insert([{
          chat_id: chatId,
          sender_id: session.user.id,
          content: messageContent,
          is_admin: false
        }]);

      if (error) {
        console.error('Error sending message:', error);
        alert('Erro ao enviar mensagem. Verifique sua conexão.');
        setNewMessage(messageContent); // Restore message on error
      } else {
        // Update last_message_at and increment unread count for admin
        // We do this in the background to not block the UI
        supabase
          .from('chats')
          .select('unread_count_admin')
          .eq('id', chatId)
          .maybeSingle()
          .then(({ data: currentChat }) => {
            const newCount = (currentChat?.unread_count_admin || 0) + 1;
            return supabase
              .from('chats')
              .update({ 
                last_message_at: new Date().toISOString(),
                unread_count_admin: newCount
              })
              .eq('id', chatId);
          });
      }
    } catch (err) {
      console.error('Unexpected error in handleSendMessage:', err);
      setNewMessage(messageContent);
    } finally {
      setSending(false);
    }
  };

  if (!session) return null; // Only show chat for logged in users for now

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="absolute bottom-20 right-0 w-80 sm:w-96 h-[500px] bg-white rounded-2xl shadow-2xl border border-ink/10 flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="bg-ink p-4 flex justify-between items-center text-paper">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-paper/20 rounded-full flex items-center justify-center">
                  <User className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-serif">Suporte AlugaAki</h3>
                  <p className="text-[10px] uppercase tracking-widest opacity-50">Online</p>
                </div>
              </div>
              <button onClick={() => setIsOpen(false)} className="hover:opacity-70 transition-opacity">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-paper/30">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6">
                  <MessageSquare className="w-8 h-8 opacity-20 mb-2" />
                  <p className="text-sm opacity-50">Olá! Como podemos ajudar você hoje?</p>
                </div>
              ) : (
                messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.is_admin ? 'justify-start' : 'justify-end'}`}
                  >
                    <div
                      className={`max-w-[80%] p-3 rounded-2xl text-sm ${
                        msg.is_admin
                          ? 'bg-white border border-ink/10 text-ink rounded-tl-none'
                          : 'bg-ink text-paper rounded-tr-none'
                      }`}
                    >
                      {msg.content}
                      <p className={`text-[8px] mt-1 opacity-50 ${msg.is_admin ? 'text-left' : 'text-right'}`}>
                        {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <form onSubmit={handleSendMessage} className="p-4 bg-white border-t border-ink/10 flex gap-2">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Digite sua mensagem..."
                className="flex-1 bg-ink/5 border-none p-3 text-sm outline-none focus:ring-1 focus:ring-ink rounded-xl"
              />
              <button
                type="submit"
                disabled={!newMessage.trim() || sending}
                className="bg-ink text-paper p-3 rounded-xl hover:bg-ink/90 transition-colors disabled:opacity-50"
              >
                {sending ? (
                  <div className="w-4 h-4 border-2 border-paper/30 border-t-paper rounded-full animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-14 h-14 bg-ink text-paper rounded-full shadow-lg flex items-center justify-center hover:scale-110 transition-transform duration-300"
      >
        {isOpen ? <X className="w-6 h-6" /> : <MessageSquare className="w-6 h-6" />}
      </button>
    </div>
  );
}
