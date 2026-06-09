// Sample seed data for the MVP — replaced once the YouTube + AI pipeline ingests real videos.

export type SamplePin = {
  id: string;
  lat: number;
  lng: number;
  type: "trending" | "new" | "featured" | "traveling";
  title: string;
  creator: string;
  thumbnail: string;
  location: string;
  views: string;
  uploaded: string;
  youtubeId: string;
};

export const samplePins: SamplePin[] = [
  {
    id: "1",
    lat: 35.6762,
    lng: 139.6503,
    type: "trending",
    title: "48 Hours in Tokyo — Hidden Ramen Alleys",
    creator: "Wanderlost",
    thumbnail: "https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=800&q=80",
    location: "Tokyo, Japan",
    views: "1.2M",
    uploaded: "3 days ago",
    youtubeId: "dQw4w9WgXcQ",
  },
  {
    id: "2",
    lat: 41.0082,
    lng: 28.9784,
    type: "featured",
    title: "Istanbul Like A Local",
    creator: "Yes Theory",
    thumbnail: "https://images.unsplash.com/photo-1524231757912-21f4fe3a7200?w=800&q=80",
    location: "Istanbul, Türkiye",
    views: "890K",
    uploaded: "1 week ago",
    youtubeId: "dQw4w9WgXcQ",
  },
  {
    id: "3",
    lat: -13.1631,
    lng: -72.545,
    type: "featured",
    title: "Sunrise at Machu Picchu",
    creator: "Lost LeBlanc",
    thumbnail: "https://images.unsplash.com/photo-1587595431973-160d0d94add1?w=800&q=80",
    location: "Cusco, Peru",
    views: "2.4M",
    uploaded: "2 weeks ago",
    youtubeId: "dQw4w9WgXcQ",
  },
  {
    id: "4",
    lat: 64.9631,
    lng: -19.0208,
    type: "new",
    title: "Chasing the Northern Lights",
    creator: "Kara and Nate",
    thumbnail: "https://images.unsplash.com/photo-1531366936337-7c912a4589a7?w=800&q=80",
    location: "Iceland",
    views: "412K",
    uploaded: "Yesterday",
    youtubeId: "dQw4w9WgXcQ",
  },
  {
    id: "5",
    lat: -8.4095,
    lng: 115.1889,
    type: "traveling",
    title: "Currently in Bali — Day 4",
    creator: "Eva zu Beck",
    thumbnail: "https://images.unsplash.com/photo-1518548419970-58e3b4079ab2?w=800&q=80",
    location: "Bali, Indonesia",
    views: "203K",
    uploaded: "2 hours ago",
    youtubeId: "dQw4w9WgXcQ",
  },
  {
    id: "6",
    lat: 48.8566,
    lng: 2.3522,
    type: "trending",
    title: "Paris in Autumn",
    creator: "Mark Wiens",
    thumbnail: "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=800&q=80",
    location: "Paris, France",
    views: "678K",
    uploaded: "5 days ago",
    youtubeId: "dQw4w9WgXcQ",
  },
  {
    id: "7",
    lat: 30.0444,
    lng: 31.2357,
    type: "new",
    title: "Inside the Pyramids of Giza",
    creator: "Drew Binsky",
    thumbnail: "https://images.unsplash.com/photo-1539650116574-75c0c6d73f6e?w=800&q=80",
    location: "Cairo, Egypt",
    views: "512K",
    uploaded: "4 days ago",
    youtubeId: "dQw4w9WgXcQ",
  },
];

export const featuredDestinations = [
  { name: "Kyoto", country: "Japan", image: "https://images.unsplash.com/photo-1545569341-9eb8b30979d9?w=800&q=80", videos: 247 },
  { name: "Lisbon", country: "Portugal", image: "https://images.unsplash.com/photo-1555881400-74d7acaacd8b?w=800&q=80", videos: 183 },
  { name: "Patagonia", country: "Argentina", image: "https://images.unsplash.com/photo-1531065208531-4036c0dba3ca?w=800&q=80", videos: 96 },
  { name: "Marrakech", country: "Morocco", image: "https://images.unsplash.com/photo-1597212618440-806262de4f6b?w=800&q=80", videos: 134 },
];

export const popularCreators = [
  { name: "Lost LeBlanc", subs: "1.8M", avatar: "https://i.pravatar.cc/150?img=12", traveling: "Vietnam" },
  { name: "Kara and Nate", subs: "3.4M", avatar: "https://i.pravatar.cc/150?img=32", traveling: "Iceland" },
  { name: "Eva zu Beck", subs: "920K", avatar: "https://i.pravatar.cc/150?img=47", traveling: "Bali" },
  { name: "Drew Binsky", subs: "4.1M", avatar: "https://i.pravatar.cc/150?img=15", traveling: null },
  { name: "Mark Wiens", subs: "10M", avatar: "https://i.pravatar.cc/150?img=68", traveling: "Bangkok" },
];

export const PIN_TYPE_COLORS: Record<SamplePin["type"], string> = {
  trending: "var(--pin-trending)",
  new: "var(--pin-new)",
  featured: "var(--pin-featured)",
  traveling: "var(--pin-traveling)",
};
