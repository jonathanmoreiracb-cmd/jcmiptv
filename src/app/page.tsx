'use client';

import { useState, useMemo, useEffect } from 'react';
import { Channel } from './api/parse/route';
import VideoPlayer from '@/components/VideoPlayer';
import { Play, Search, Tv, ImageOff, Loader2, Link as LinkIcon, Trash2, Database } from 'lucide-react';
import Player from 'video.js/dist/types/player';
import { saveChannelsToCache, getCachedChannels, clearCachedChannels } from '@/utils/db';

export default function Home() {
  const [m3uUrl, setM3uUrl] = useState('');
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null);
  const [playerRef, setPlayerRef] = useState<Player | null>(null);
  const [isCachedData, setIsCachedData] = useState(false);
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);

  // Load saved link and cached channels on mount
  useEffect(() => {
    const savedUrl = localStorage.getItem('m3u_url');
    if (savedUrl) {
      setM3uUrl(savedUrl);
    }

    async function loadCache() {
      try {
        const cached = await getCachedChannels();
        if (cached && cached.length > 0) {
          setChannels(cached);
          setActiveChannel(cached[0]);
          setIsCachedData(true);
        }
      } catch (err) {
        console.error('Error loading database cache:', err);
      }
    }
    loadCache();
  }, []);

  // Resolve active channel stream URL to a secure HTTPS link
  useEffect(() => {
    if (!activeChannel) {
      setResolvedUrl(null);
      return;
    }

    setResolving(true);
    setResolvedUrl(null);

    let streamUrl = activeChannel.url;

    // Apply the ts to m3u8 fix first
    if (streamUrl.endsWith('/ts')) {
      streamUrl = streamUrl.slice(0, -3) + '/m3u8';
    } else if (streamUrl.endsWith('.ts')) {
      streamUrl = streamUrl.slice(0, -3) + '.m3u8';
    } else if (streamUrl.includes('/ts?')) {
      streamUrl = streamUrl.replace('/ts?', '/m3u8?');
    } else if (streamUrl.includes('.ts?')) {
      streamUrl = streamUrl.replace('.ts?', '.m3u8?');
    }

    fetch(`/api/resolve?url=${encodeURIComponent(streamUrl)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.url) {
          setResolvedUrl(data.url);
        } else {
          setResolvedUrl(streamUrl);
        }
      })
      .catch((err) => {
        console.error('Error resolving stream URL:', err);
        setResolvedUrl(streamUrl);
      })
      .finally(() => {
        setResolving(false);
      });
  }, [activeChannel]);

  const handleLoadPlaylist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!m3uUrl) return;

    setLoading(true);
    setError('');
    
    try {
      const res = await fetch('/api/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: m3uUrl }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Falha ao carregar a lista');
      }

      const fetchedChannels = data.channels || [];
      setChannels(fetchedChannels);
      if (fetchedChannels.length > 0) {
        setActiveChannel(fetchedChannels[0]);
      }

      // Save to localStorage and IndexedDB cache
      localStorage.setItem('m3u_url', m3uUrl);
      await saveChannelsToCache(fetchedChannels);
      setIsCachedData(false);
    } catch (err: any) {
      setError(err.message || 'Ocorreu um erro ao processar a lista.');
    } finally {
      setLoading(false);
    }
  };

  const handleClearCache = async () => {
    if (confirm('Tem certeza que deseja limpar a lista salva e o cache local?')) {
      localStorage.removeItem('m3u_url');
      await clearCachedChannels();
      setM3uUrl('');
      setChannels([]);
      setActiveChannel(null);
      setIsCachedData(false);
      setError('');
    }
  };

  const filteredChannels = useMemo(() => {
    return channels.filter((channel) =>
      channel.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [channels, searchQuery]);

  const handleChannelSelect = (channel: Channel) => {
    setActiveChannel(channel);
  };

  const handlePlayerReady = (player: Player) => {
    setPlayerRef(player);
  };

  const videoJsOptions = useMemo(() => {
    if (!resolvedUrl) return null;

    return {
      autoplay: true,
      controls: true,
      responsive: true,
      fluid: true,
      sources: [
        {
          src: resolvedUrl,
          type: resolvedUrl.toLowerCase().includes('m3u8') ? 'application/x-mpegURL' : 'video/mp4',
        },
      ],
    };
  }, [resolvedUrl]);

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-200 font-sans selection:bg-indigo-500/30">
      {/* Header section */}
      <header className="border-b border-white/5 bg-neutral-900/50 backdrop-blur-xl sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-indigo-500/10 rounded-lg ring-1 ring-indigo-500/20">
              <Tv className="w-6 h-6 text-indigo-400" />
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-white">
              JCM <span className="text-indigo-400">IPTV</span>
            </h1>
          </div>

          <form onSubmit={handleLoadPlaylist} className="flex flex-col sm:flex-row gap-3 max-w-4xl">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <LinkIcon className="h-5 w-5 text-neutral-500" />
              </div>
              <input
                type="url"
                value={m3uUrl}
                onChange={(e) => setM3uUrl(e.target.value)}
                placeholder="Cole a URL da sua lista M3U aqui..."
                className="block w-full pl-10 pr-3 py-3 bg-neutral-900 border border-white/10 rounded-xl text-neutral-200 placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all shadow-sm text-sm"
                required
              />
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 sm:flex-initial px-6 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-neutral-800 disabled:text-neutral-500 text-white font-medium rounded-xl transition-colors shadow-sm flex items-center justify-center gap-2 whitespace-nowrap text-sm"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Carregando</span>
                  </>
                ) : (
                  <>
                    <Play className="w-5 h-5" />
                    <span>Carregar Lista</span>
                  </>
                )}
              </button>
              {(channels.length > 0 || m3uUrl) && (
                <button
                  type="button"
                  onClick={handleClearCache}
                  className="px-4 py-3 bg-neutral-900 hover:bg-red-950/30 hover:text-red-400 border border-white/5 hover:border-red-500/20 text-neutral-400 font-medium rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 text-sm"
                  title="Limpar Playlist Salva"
                >
                  <Trash2 className="w-5 h-5" />
                  <span className="hidden md:inline">Limpar Salvos</span>
                </button>
              )}
            </div>
          </form>
          <div className="flex flex-wrap items-center gap-3 mt-3">
            {error && <p className="text-sm text-red-400 flex items-center gap-2">{error}</p>}
            {isCachedData && !loading && (
              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 rounded-full text-xs text-indigo-400 font-medium animate-fade-in shadow-inner">
                <Database className="w-3.5 h-3.5" />
                <span>Canais carregados da memória local</span>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8 h-[calc(100vh-140px)]">
        <div className="flex flex-col lg:flex-row gap-6 h-full">
          {/* Left Column: Playlist */}
          <div className="w-full lg:w-1/3 flex flex-col bg-neutral-900/30 rounded-2xl border border-white/5 overflow-hidden ring-1 ring-white/5">
            <div className="p-4 border-b border-white/5 bg-neutral-900/50">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-4 w-4 text-neutral-500" />
                </div>
                <input
                  type="text"
                  placeholder="Buscar canal..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="block w-full pl-9 pr-3 py-2.5 bg-neutral-950 border border-white/5 rounded-lg text-sm text-neutral-200 placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 transition-all"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
              {channels.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-neutral-500 space-y-3 p-6 text-center">
                  <Tv className="w-12 h-12 opacity-20" />
                  <p className="text-sm">Sua lista de canais aparecerá aqui.</p>
                </div>
              ) : filteredChannels.length === 0 ? (
                <div className="py-8 text-center text-neutral-500 text-sm">
                  Nenhum canal encontrado.
                </div>
              ) : (
                filteredChannels.slice(0, 500).map((channel) => (
                  <button
                    key={channel.id}
                    onClick={() => handleChannelSelect(channel)}
                    className={`w-full flex items-center gap-4 p-3 rounded-xl transition-all duration-200 text-left group ${
                      activeChannel?.id === channel.id
                        ? 'bg-indigo-500/10 border-indigo-500/20 shadow-inner ring-1 ring-indigo-500/30'
                        : 'hover:bg-white/5 border-transparent border'
                    }`}
                  >
                    <div className="w-12 h-12 bg-neutral-950 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0 ring-1 ring-white/5 group-hover:ring-white/10 transition-all">
                      {channel.logo ? (
                        <img
                          src={channel.logo}
                          alt={channel.name}
                          className="w-full h-full object-contain p-1"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                            (e.target as HTMLImageElement).parentElement?.classList.add('fallback-icon');
                          }}
                        />
                      ) : (
                        <ImageOff className="w-5 h-5 text-neutral-600" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium truncate ${activeChannel?.id === channel.id ? 'text-indigo-400' : 'text-neutral-200'}`}>
                        {channel.name}
                      </p>
                      {channel.group && (
                        <p className="text-xs text-neutral-500 truncate mt-0.5">
                          {channel.group}
                        </p>
                      )}
                    </div>
                    {activeChannel?.id === channel.id && (
                      <div className="w-2 h-2 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.8)] mr-2" />
                    )}
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Right Column: Player */}
          <div className="w-full lg:w-2/3 flex flex-col min-h-[300px] lg:min-h-0 bg-neutral-900/20 rounded-2xl border border-white/5 p-4 lg:p-6 ring-1 ring-white/5">
            {activeChannel ? (
              <div className="w-full h-full flex flex-col">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 bg-neutral-900 rounded-lg flex items-center justify-center overflow-hidden ring-1 ring-white/10">
                    {activeChannel.logo ? (
                      <img src={activeChannel.logo} alt={activeChannel.name} className="w-full h-full object-contain p-1" />
                    ) : (
                      <Tv className="w-6 h-6 text-neutral-600" />
                    )}
                  </div>
                  <div>
                    <h2 className="text-xl font-medium text-white">{activeChannel.name}</h2>
                    {activeChannel.group && <p className="text-sm text-neutral-400">{activeChannel.group}</p>}
                  </div>
                </div>
                <div className="flex-1 w-full relative">
                  {resolving && (
                    <div className="absolute inset-0 bg-neutral-950/80 rounded-xl flex flex-col items-center justify-center text-indigo-400 gap-3 z-10">
                      <Loader2 className="w-8 h-8 animate-spin" />
                      <span className="text-sm font-medium">Resolvendo link seguro...</span>
                    </div>
                  )}
                  {videoJsOptions && !resolving && (
                    <VideoPlayer options={videoJsOptions} onReady={handlePlayerReady} />
                  )}
                </div>
              </div>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-neutral-500 space-y-4">
                <div className="w-24 h-24 rounded-full bg-neutral-900/50 flex items-center justify-center ring-1 ring-white/5">
                  <Play className="w-8 h-8 opacity-20 ml-2" />
                </div>
                <p>Selecione um canal para assistir</p>
              </div>
            )}
          </div>
        </div>
      </main>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background-color: rgba(255, 255, 255, 0.1);
          border-radius: 10px;
        }
        .custom-scrollbar:hover::-webkit-scrollbar-thumb {
          background-color: rgba(255, 255, 255, 0.2);
        }
      `}</style>
    </div>
  );
}
