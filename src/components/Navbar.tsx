import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Menu, Search, User, ShoppingBag, Plus, Calendar } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { supabase } from '../lib/supabase';
import { useAdmin } from '../hooks/useAdmin';

export const Navbar = () => {
  const { totalItems } = useCart();
  const [session, setSession] = useState<any>(null);
  const { isAdmin } = useAdmin();

  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [isSearchOpen, setIsSearchOpen] = useState(searchParams.get('q') ? true : false);
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');

  useEffect(() => {
    if (searchQuery) {
      setSearchParams({ q: searchQuery });
    } else if (isSearchOpen) {
      setSearchParams({});
    }
  }, [searchQuery, setSearchParams, isSearchOpen]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <nav className="sticky top-0 z-50 bg-paper/80 backdrop-blur-md">
      <div className="nav-grid flex items-center justify-between">
        <div className="flex items-center">
          {!isSearchOpen ? (
            <button 
              onClick={() => setIsSearchOpen(true)}
              className="nav-item flex items-center gap-2 hover:opacity-60 transition-opacity"
            >
              <Menu className="w-4 h-4" />
              <span>Explorar</span>
            </button>
          ) : (
            <div className="nav-item flex items-center gap-2 bg-paper/50 px-3 py-1 rounded-full border border-ink/10">
              <Search className="w-4 h-4 opacity-40" />
              <input 
                autoFocus
                type="text" 
                placeholder="Para onde vamos?"
                className="bg-transparent border-none outline-none text-xs w-40 placeholder:italic"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onBlur={() => !searchQuery && setIsSearchOpen(false)}
              />
            </div>
          )}
          <div className="nav-item hidden md:flex items-center gap-2">
            <Search className="w-4 h-4" />
            <span>Zonas Mortas</span>
          </div>
        </div>
        
        <Link to="/" className="text-2xl font-serif tracking-widest uppercase py-4 px-8 border-x border-ink/20">
          Unplugged Bliss
        </Link>
        
        <div className="flex items-center">
          <Link to="/anunciar" className="nav-item hidden lg:flex items-center gap-2 bg-ink text-paper px-4 py-2 rounded-full hover:bg-ink/80 transition-colors">
            <Plus className="w-4 h-4" />
            <span className="font-semibold">Anunciar meu Imóvel</span>
          </Link>
          <Link to="/perfil" className="nav-item hidden md:flex items-center gap-2">
            {session?.user?.user_metadata?.avatar_url ? (
              <img 
                src={session.user.user_metadata.avatar_url} 
                alt="Avatar" 
                className="w-5 h-5 rounded-full object-cover border border-ink/20"
              />
            ) : (
              <User className="w-4 h-4" />
            )}
            <span>{session?.user?.user_metadata?.full_name?.split(' ')[0] || 'Perfil'}</span>
          </Link>
          {isAdmin && (
            <Link to="/admin/reservas" className="nav-item hidden lg:flex items-center gap-2 text-red-600 font-bold">
              <Calendar className="w-4 h-4" />
              <span>Reservas</span>
            </Link>
          )}
          <Link to="/checkout" className="nav-item flex items-center gap-2 relative">
            <ShoppingBag className="w-4 h-4" />
            <span className="hidden sm:inline">Carrinho</span>
            {totalItems > 0 && (
              <span className="absolute -top-1 -right-1 bg-ink text-paper text-[8px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
                {totalItems}
              </span>
            )}
          </Link>
        </div>
      </div>
    </nav>
  );
};
