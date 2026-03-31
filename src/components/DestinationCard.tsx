import React from 'react';
import { motion } from 'motion/react';
import { MapPin, WifiOff, Trash2 } from 'lucide-react';
import { Destination } from '../data/mockData';
import { Link } from 'react-router-dom';

interface Props {
  destination: Destination;
  isAdmin?: boolean;
  onDelete?: (id: string | number) => void;
  key?: string | number;
}

export const DestinationCard = ({ destination, isAdmin, onDelete }: Props) => {
  const handleDelete = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onDelete && window.confirm('Tem certeza que deseja excluir este anúncio?')) {
      onDelete(destination.id);
    }
  };

  return (
    <motion.div 
      whileHover={{ y: -10 }}
      className="group relative"
    >
      {isAdmin && (
        <button 
          onClick={handleDelete}
          className="absolute top-4 left-4 z-20 bg-red-500 text-white p-2 rounded-full hover:bg-red-600 transition-colors shadow-lg"
          title="Excluir Anúncio"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      )}
      <Link to={`/imovel/${destination.id}/${destination.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}>
        <div className="relative aspect-[3/4] overflow-hidden mb-6">
          <img 
            src={destination.image} 
            alt={destination.title} 
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
            referrerPolicy="no-referrer"
          />
          <div className="absolute top-4 right-4 bg-paper/90 backdrop-blur px-3 py-1 rounded-full flex items-center gap-2">
            <WifiOff className="w-3 h-3 text-ink" />
            <span className="text-[9px] uppercase tracking-wider font-semibold">
              {destination.signalStrength === 0 ? 'Sinal Zero' : 'Detox Radical'}
            </span>
          </div>
          <div className="absolute bottom-0 left-0 w-full p-6 bg-gradient-to-t from-ink/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col gap-2">
            <div 
              className="w-full py-3 bg-paper text-ink text-[10px] uppercase tracking-widest text-center hover:bg-white transition-colors"
            >
              Ver Detalhes
            </div>
            <div 
              className="w-full py-3 bg-ink text-paper text-[10px] uppercase tracking-widest text-center hover:bg-ink/90 transition-colors"
            >
              Reservar Agora
            </div>
          </div>
        </div>
        
        <div className="flex justify-between items-start">
          <div>
            <div className="flex items-center gap-1 text-[10px] uppercase tracking-widest opacity-50 mb-1">
              <MapPin className="w-3 h-3" />
              {destination.location}
            </div>
            <h3 className="text-xl mb-2">{destination.title}</h3>
          </div>
          <div className="text-right">
            <span className="text-[10px] uppercase tracking-widest opacity-50 block">A partir de</span>
            <span className="text-lg font-serif italic">${destination.price}</span>
          </div>
        </div>
      </Link>
    </motion.div>
  );
};
