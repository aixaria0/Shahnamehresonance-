import { MetadataRoute } from 'next'

export const dynamic = 'force-static'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'رزونانس شاهنامه',
    short_name: 'شاهنامه',
    description: 'خردِ باستان در کالبدِ سیلیکون - حکیم فردوسی هوشمند',
    start_url: '/',
    display: 'standalone',
    background_color: '#09170e',
    theme_color: '#c66f00',
    icons: [
      {
        src: 'https://picsum.photos/seed/shahnameh-icon/192/192',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: 'https://picsum.photos/seed/shahnameh-icon/512/512',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  }
}
