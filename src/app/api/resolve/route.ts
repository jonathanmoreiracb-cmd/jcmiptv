import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  let initialUrl = '';
  try {
    const { searchParams } = new URL(request.url);
    const url = searchParams.get('url');

    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }
    initialUrl = url;

    let currentUrl = url;
    let redirectsCount = 0;
    const MAX_REDIRECTS = 3;

    while (redirectsCount < MAX_REDIRECTS) {
      const response = await fetch(currentUrl, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        },
        redirect: 'manual',
      });

      if (response.status === 302 || response.status === 301 || response.status === 307 || response.status === 308) {
        let location = response.headers.get('location');
        if (location) {
          // Resolve relative redirect location if needed
          if (location.startsWith('/')) {
            const parsedUrl = new URL(currentUrl);
            location = `${parsedUrl.protocol}//${parsedUrl.host}${location}`;
          }
          
          // Secure the URL (force HTTPS and remove HTTP port :80)
          if (location.startsWith('http://')) {
            location = location.replace('http://', 'https://');
          }
          location = location.replace(':80/', '/');
          
          currentUrl = location;
          redirectsCount++;
          continue;
        }
      }
      break;
    }

    return NextResponse.json({ url: currentUrl });
  } catch (error: any) {
    console.error('Error resolving URL:', error);
    // If it fails, fallback to the original requested URL
    return NextResponse.json({ url: initialUrl || '' });
  }
}
