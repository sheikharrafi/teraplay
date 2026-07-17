# TeraPlay - Online TeraBox Player

TeraPlay is a free, open-source web application that enables users to play TeraBox videos directly in their browser without requiring the official TeraBox app. Built with Next.js 14, TypeScript, and Tailwind CSS.

## Features

- 🎥 **Direct Video Playback** - Play TeraBox videos in your browser using HTML5 video player
- 🎬 **Quality Selection** - Choose from multiple video quality options when available
- 📋 **Copy Direct Links** - Copy video URLs to clipboard with one click
- ⬇️ **Download Support** - Download videos directly from the player
- 📱 **Mobile-First Design** - Fully responsive interface optimized for all devices
- 🔒 **Privacy-Focused** - No tracking, no data storage, no user accounts required
- ⚡ **Fast & Lightweight** - Minimal dependencies, optimized bundle size
- 🎨 **Modern UI** - Clean, dark-themed interface with smooth animations

## Tech Stack

- **Framework**: [Next.js 14](https://nextjs.org/) with App Router
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Deployment**: Optimized for [Vercel](https://vercel.com/)

## Prerequisites

- Node.js 18.x or higher
- npm or yarn package manager

## Quick Start

TeraPlay includes a custom backend that directly resolves TeraBox links - no external APIs required!

1. **Install dependencies**

```bash
npm install
```

2. **Run the development server**

```bash
npm run dev
```

3. **Open the app**

Navigate to [http://localhost:3000](http://localhost:3000) and paste a TeraBox URL like:
```
https://terabox.com/s/1abc123
https://1024terabox.com/s/1eBHBOzcEI-VpUGA_xIcGQg
```

That's it! The backend automatically resolves TeraBox links without any configuration.

## Configuration

### No Configuration Required! 🎉

TeraPlay works out of the box with no environment variables or external APIs needed. The backend directly communicates with TeraBox's public API to resolve video links.

### How It Works

The custom backend:
1. Parses the TeraBox share URL
2. Calls TeraBox's public API to get file information
3. Finds video files in the share
4. Generates direct download links
5. Returns video data to the frontend

All of this happens automatically without any setup!

## Development Commands

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run linter
npm run lint

# Run type checking
npm run type-check

# Run tests (if implemented)
npm test
```

## Project Structure

```
teraplay/
├── app/                      # Next.js App Router pages
│   ├── api/
│   │   └── resolve/
│   │       └── route.ts      # Video resolution API endpoint
│   ├── how-it-works/
│   │   └── page.tsx          # How it works page
│   ├── privacy/
│   │   └── page.tsx          # Privacy policy page
│   ├── layout.tsx            # Root layout with metadata
│   ├── page.tsx              # Home page
│   └── globals.css           # Global styles
├── components/               # React components
│   ├── AdSlot.tsx           # Ad placeholder component
│   ├── ErrorAlert.tsx       # Error message component
│   ├── Footer.tsx           # Footer component
│   ├── Header.tsx           # Navigation header
│   ├── LoadingSpinner.tsx   # Loading indicator
│   ├── UrlInputForm.tsx     # URL input form
│   └── VideoPlayer.tsx      # Video player with controls
├── lib/                     # Utility functions and types
│   ├── api.ts              # API client functions
│   ├── types.ts            # TypeScript type definitions
│   └── utils.ts            # Helper functions
├── public/                  # Static assets
├── .env.example            # Environment variable template
├── .env.local              # Local environment (gitignored)
├── next.config.js          # Next.js configuration
├── tailwind.config.ts      # Tailwind CSS configuration
├── tsconfig.json           # TypeScript configuration
└── package.json            # Dependencies and scripts
```

## Architecture Overview

### Request Flow

```
┌─────────────────┐
│   User Browser  │
│   (Next.js UI)  │
└────────┬────────┘
         │ 1. User submits TeraBox URL
         ▼
┌─────────────────┐
│  UrlInputForm   │
│   Component     │
└────────┬────────┘
         │ 2. POST /api/resolve
         ▼
┌─────────────────┐
│  Next.js API    │
│  Route Handler  │
│  (Custom Backend)│
└────────┬────────┘
         │ 3. Direct TeraBox API calls
         │    - Get share info
         │    - Find video files
         │    - Generate download links
         ▼
┌─────────────────┐
│  TeraBox API    │
│  (Public)       │
└────────┬────────┘
         │ 4. Returns video metadata
         ▼
┌─────────────────┐
│  VideoPlayer    │
│   Component     │
└─────────────────┘
```

### Component Hierarchy

```
RootLayout
├── Header
├── Page (Home)
│   ├── UrlInputForm
│   │   └── LoadingSpinner
│   ├── ErrorAlert
│   ├── VideoPlayer
│   └── AdSlot (multiple)
└── Footer
```

## Deployment

### Deploy to Vercel

1. **Push your code to GitHub**

2. **Import project in Vercel**
   - Go to [vercel.com](https://vercel.com)
   - Click "New Project"
   - Import your GitHub repository

3. **Deploy**
   - Vercel will automatically build and deploy your application
   - `/api/resolve` uses `puppeteer-core` + `@sparticuz/chromium` for serverless browser runtime compatibility
   - No environment variables needed!
   - Every push to main branch triggers a new deployment

### Manual Deployment

```bash
# Build the application
npm run build

# Start the production server
npm start
```

The application will be available at `http://localhost:3000`.

## API Documentation

### POST /api/resolve

Resolves a TeraBox share link to direct video URLs.

**Request:**

```json
{
  "url": "https://terabox.com/s/abc123"
}
```

**Response (Success):**

```json
{
  "success": true,
  "fileName": "video.mp4",
  "size": "750 MB",
  "thumbnail": "https://cdn.example.com/thumb.jpg",
  "directUrl": "https://cdn.example.com/video.mp4",
  "qualities": [
    { "label": "360p", "url": "https://cdn.example.com/video-360p.mp4" },
    { "label": "720p", "url": "https://cdn.example.com/video-720p.mp4" }
  ]
}
```

**Response (Error):**

```json
{
  "success": false,
  "code": "TERABOX_RESOLVE_FAILED",
  "message": "Unable to extract a direct video URL from this TeraBox link. The file may be private, blocked, or require login."
}
```

**Status Codes:**
- `200` - Successful resolution
- `400` - `INVALID_LINK`
- `500` - `CHROME_NOT_FOUND` / `BROWSER_LAUNCH_FAILED`
- `502` - `TERABOX_RESOLVE_FAILED`
- `504` - `TIMEOUT`

## Contributing

Contributions are welcome! Please follow these guidelines:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Code Style

- Use TypeScript for all new code
- Follow the existing code style (enforced by ESLint)
- Add comments for complex logic
- Ensure all tests pass before submitting PR

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Disclaimer

**Important:** TeraPlay does not host, store, or upload any video files. This application is a tool that helps users access publicly shared TeraBox links through a third-party resolver API. All videos remain on TeraBox's servers.

Users are responsible for ensuring they have the right to access any content they view. We do not control, verify, or endorse any content accessed through our service.

## Privacy

TeraPlay is designed with privacy in mind:
- ✅ No user tracking or analytics
- ✅ No data storage or logging of URLs
- ✅ No cookies or local storage for user identification
- ✅ No personal information collection

For more details, see our [Privacy Policy](https://teraplay.example.com/privacy).

## Support

If you encounter any issues or have questions:

1. Check the [FAQ](https://teraplay.example.com/how-it-works) on our website
2. Search existing [GitHub Issues](https://github.com/yourusername/teraplay/issues)
3. Open a new issue with detailed information

## Acknowledgments

- Built with [Next.js](https://nextjs.org/)
- Styled with [Tailwind CSS](https://tailwindcss.com/)
- Icons from [Heroicons](https://heroicons.com/)

---

Made with ❤️ by the TeraPlay team
