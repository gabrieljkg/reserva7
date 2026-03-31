import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { Hero } from '../components/Hero';
import { DestinationCard } from '../components/DestinationCard';
import { ExperienceCard } from '../components/ExperienceCard';
import { SurvivalKitCard } from '../components/SurvivalKitCard';
import { EXPERIENCES, SURVIVAL_KITS, Destination } from '../data/mockData';
import { motion } from 'motion/react';
import { Footer } from '../components/Footer';
import { supabase } from '../lib/supabase';
import { useAdmin, ADMIN_EMAIL } from '../hooks/useAdmin';

export const Home = () => {
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchParams] = useSearchParams();
  const searchQuery = searchParams.get('q')?.toLowerCase() || '';
  const { isAdmin } = useAdmin();

  const filteredDestinations = destinations.filter(dest => 
    dest.title.toLowerCase().includes(searchQuery) || 
    dest.location.toLowerCase().includes(searchQuery) ||
    dest.description.toLowerCase().includes(searchQuery) ||
    dest.tags.some(tag => tag.toLowerCase().includes(searchQuery))
  );

  useEffect(() => {
    document.title = "AlugaAki - Aluguel de Temporada em Uberlândia | Chácaras para eventos";
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute('content', 'Encontre as melhores chácaras para eventos e casas para aluguel de temporada em Uberlândia. Anuncie seu imóvel ou reserve sua próxima estadia com o AlugaAki.');
    }
    fetchDestinations();
  }, []);

  const fetchDestinations = async () => {
    try {
      setError(null);
      console.log('Buscando destinos no Supabase...');
      const { data, error: supabaseError } = await supabase
        .from('destinations')
        .select('*');
      
      if (supabaseError) {
        console.error('ERRO TÉCNICO SUPABASE (Home):', {
          message: supabaseError.message,
          details: supabaseError.details,
          hint: supabaseError.hint,
          code: supabaseError.code
        });
        setError(supabaseError.message);
        throw supabaseError;
      }
      if (data) {
        console.log('Destinos carregados com sucesso:', data.length);
        // Map data to match Destination interface
        const mappedData = data.map((item: any) => ({
          id: item.id,
          title: item.title || 'Sem Título',
          location: item.location || 'Localização não informada',
          description: item.description || '',
          price: item.price_per_night || item.price || 0,
          signalStrength: item.isolation_level !== undefined ? item.isolation_level : (item.signalStrength || 0),
          image: Array.isArray(item.image) ? (item.image[0] || 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&q=80&w=1000') : (item.image || 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&q=80&w=1000'),
          tags: item.tags || [],
          features: item.features || []
        }));
        setDestinations(mappedData);
      }
    } catch (err: any) {
      console.error('Erro ao carregar destinos:', err);
      setError(err.message || 'Falha na conexão com o banco de dados.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string | number) => {
    console.log('Iniciando tentativa de exclusão do destino:', id);
    const { data: { session } } = await supabase.auth.getSession();
    const userEmail = session?.user?.email?.toLowerCase();
    
    if (userEmail !== ADMIN_EMAIL.toLowerCase()) {
      console.error('Tentativa de exclusão negada: Usuário não é administrador', userEmail);
      alert('Acesso negado. Apenas o administrador pode excluir anúncios.');
      return;
    }

    if (!window.confirm('Tem certeza que deseja excluir este anúncio? Isso removerá também todas as reservas associadas.')) {
      return;
    }

    try {
      setLoading(true);
      
      // First, try to delete associated bookings to avoid foreign key constraints
      const { error: bookingsError } = await supabase
        .from('bookings')
        .delete()
        .eq('destination_id', id);

      if (bookingsError && !bookingsError.message.includes('relation "bookings" does not exist')) {
        console.warn('Aviso ao excluir reservas:', bookingsError);
      }

      // Now delete the destination
      const { error: deleteError } = await supabase
        .from('destinations')
        .delete()
        .eq('id', id);

      if (deleteError) throw deleteError;
      
      // Update local state
      setDestinations(prev => prev.filter(d => d.id !== id));
      alert('Anúncio excluído com sucesso!');
    } catch (err: any) {
      console.error('Erro ao excluir anúncio:', err);
      alert('Erro ao excluir anúncio: ' + (err.message || 'Erro desconhecido'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen">
      <Navbar />
      <Hero />
      
      {/* Destinations Section */}
      <section className="py-24 container mx-auto px-6">
        <div className="flex flex-col md:flex-row justify-between items-end mb-16 gap-8">
          <div>
            <span className="text-[11px] uppercase tracking-[0.3em] opacity-50 mb-4 block">Santuários Curados</span>
            <h2 className="text-5xl md:text-6xl font-serif">A Coleção Zona Morta</h2>
          </div>
          <div className="max-w-xs text-sm text-ink/60 leading-relaxed">
            Cada local é verificado via dados de satélite para garantir conectividade zero. Sem Wi-Fi. Sem sinal. Apenas você.
          </div>
        </div>
        
        {loading ? (
          <div className="flex justify-center py-12">
            <span className="text-[10px] uppercase tracking-widest opacity-50">Carregando Santuários...</span>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-12 border border-red-100 bg-red-50/30 rounded-lg">
            <span className="text-[10px] uppercase tracking-widest text-red-600 mb-2">Erro de Conexão</span>
            <p className="text-xs text-red-500 font-mono mb-4">{error}</p>
            <button 
              onClick={() => window.location.reload()}
              className="px-6 py-2 bg-ink text-paper text-[10px] uppercase tracking-widest"
            >
              Tentar Novamente
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12">
            {filteredDestinations.length > 0 ? (
              filteredDestinations.map((dest) => (
                <DestinationCard 
                  key={dest.id} 
                  destination={dest} 
                  isAdmin={isAdmin}
                  onDelete={handleDelete}
                />
              ))
            ) : (
              <div className="col-span-full py-12 text-center">
                <p className="text-xl font-serif mb-4">Nenhum santuário encontrado para "{searchQuery}"</p>
                <button 
                  onClick={() => window.location.href = '/'}
                  className="text-[10px] uppercase tracking-widest border-b border-ink pb-1"
                >
                  Ver Todos os Santuários
                </button>
              </div>
            )}
          </div>
        )}
      </section>
      
      {/* Experiences Section */}
      <section className="py-24 bg-ink/5">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <span className="text-[11px] uppercase tracking-[0.3em] opacity-50 mb-4 block">Reconecte-se Consigo Mesmo</span>
            <h2 className="text-5xl font-serif">Rituais Analógicos</h2>
          </div>
          
          <div className="max-w-5xl mx-auto">
            {EXPERIENCES.map((exp) => (
              <ExperienceCard key={exp.id} experience={exp} />
            ))}
          </div>
        </div>
      </section>
      
      {/* Survival Kits Section */}
      <section className="py-24 container mx-auto px-6">
        <div className="flex flex-col md:flex-row justify-between items-center mb-16 gap-8">
          <h2 className="text-5xl font-serif">Kits de Sobrevivência</h2>
          <button className="text-[11px] uppercase tracking-widest border-b border-ink pb-1">
            Ver Todos os Equipamentos
          </button>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {SURVIVAL_KITS.map((kit) => (
            <SurvivalKitCard key={kit.id} kit={kit} />
          ))}
          
          <div className="bg-ink text-paper p-8 flex flex-col justify-between">
            <div>
              <h3 className="text-2xl mb-4">A Desconexão Completa</h3>
              <p className="text-xs opacity-70 leading-relaxed">
                Combine sua estadia com um kit curado e economize 15% em sua jornada de detox radical.
              </p>
            </div>
            <button className="w-full py-4 bg-paper text-ink text-[10px] uppercase tracking-widest mt-8">
              Explorar Pacotes
            </button>
          </div>
        </div>
      </section>
      
      {/* Host CTA Section */}
      <section className="py-24 bg-ink text-paper">
        <div className="container mx-auto px-6 text-center">
          <h2 className="text-4xl md:text-5xl font-serif mb-6">Ganhe dinheiro com seu imóvel</h2>
          <p className="max-w-2xl mx-auto text-lg opacity-80 mb-10 leading-relaxed">
            Tem uma chácara ou casa parada em Uberlândia? Anuncie no AlugaAki e alcance milhares de viajantes com taxas menores que os grandes apps.
          </p>
          <button 
            onClick={() => window.location.href = '/anunciar'}
            className="px-8 py-4 bg-paper text-ink text-sm uppercase tracking-widest font-bold rounded-full hover:bg-paper/90 transition-colors"
          >
            Começar a Anunciar
          </button>
        </div>
      </section>
      
      <Footer />
    </div>
  );
};
