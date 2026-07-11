import { NextResponse } from 'next/server';

export interface Channel {
  id: string;
  name: string;
  logo: string;
  url: string;
  group: string;
}

export async function POST(request: Request) {
  try {
    const { url } = await request.json();

    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    // Add generic user agent as some IPTV providers block default fetch
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': '*/*'
      }
    });
    
    if (!response.ok) {
      return NextResponse.json({ error: 'Failed to fetch M3U list. Status: ' + response.status }, { status: response.status });
    }

    if (!response.body) {
       return NextResponse.json({ error: 'Empty response from server' }, { status: 400 });
    }

    const channels: Channel[] = [];
    let currentChannel: Partial<Channel> = {};
    
    // Limits to prevent browser crash and Vercel timeout on massive lists
    const MAX_CHANNELS = 20000;
    
    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let isDone = false;

    while (!isDone && channels.length < MAX_CHANNELS) {
      const { done, value } = await reader.read();
      if (done) {
        isDone = true;
      }
      
      if (value) {
        buffer += decoder.decode(value, { stream: true });
      }

      // Process lines in the buffer
      let newlineIndex;
      while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, newlineIndex).trim();
        buffer = buffer.slice(newlineIndex + 1);

        if (!line) continue;

        if (line.startsWith('#EXTINF:')) {
          const logoMatch = line.match(/tvg-logo="([^"]+)"/);
          const groupMatch = line.match(/group-title="([^"]+)"/);
          
          const nameParts = line.split(',');
          const name = nameParts.length > 1 ? nameParts.slice(1).join(',').trim() : 'Unknown Channel';

          currentChannel = {
            id: Math.random().toString(36).substring(7),
            name: name,
            logo: logoMatch ? logoMatch[1] : '',
            group: groupMatch ? groupMatch[1] : 'Uncategorized',
          };
        } else if (!line.startsWith('#')) {
          if (currentChannel.name) {
            let channelUrl = line;
            
            // Auto-fix stream URL for browser compatibility: convert MPEG-TS (/ts) to HLS (/m3u8)
            if (channelUrl.endsWith('/ts')) {
              channelUrl = channelUrl.slice(0, -3) + '/m3u8';
            } else if (channelUrl.endsWith('.ts')) {
              channelUrl = channelUrl.slice(0, -3) + '.m3u8';
            } else if (channelUrl.includes('/ts?')) {
              channelUrl = channelUrl.replace('/ts?', '/m3u8?');
            } else if (channelUrl.includes('.ts?')) {
              channelUrl = channelUrl.replace('.ts?', '.m3u8?');
            }

            currentChannel.url = channelUrl;
            channels.push(currentChannel as Channel);
            currentChannel = {};
            
            if (channels.length >= MAX_CHANNELS) {
              break;
            }
          }
        }
      }
    }
    
    // Cancel the stream if we hit the limit early
    if (!isDone) {
      reader.cancel().catch(() => {});
    }

    return NextResponse.json({ channels });
  } catch (error: any) {
    console.error('Error parsing M3U:', error);
    return NextResponse.json({ error: 'Erro ao processar a lista: ' + error.message }, { status: 500 });
  }
}
