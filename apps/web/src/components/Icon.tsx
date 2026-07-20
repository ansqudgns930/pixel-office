interface IconProps { name: string; size?: number }

const PATHS: Record<string, string> = {
  play: "M6 4l12 8-12 8V4z",
  board: "M4 4h4v16H4V4zm6 0h4v10h-4V4zm6 0h4v7h-4V4z",
  building: "M5 21V4a1 1 0 011-1h5a1 1 0 011 1v17M14 21V9a1 1 0 011-1h3a1 1 0 011 1v12M3 21h18M8 7h1M8 11h1M8 15h1",
  grid: "M4 4h6v6H4V4zm10 0h6v6h-6V4zM4 14h6v6H4v-6zm10 0h6v6h-6v-6z",
  layers: "M12 3l9 5-9 5-9-5 9-5zM3 13l9 5 9-5M3 17l9 5 9-5",
  gear: "M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 13.5l1.6-.9-1-1.7-1.8.5a6.9 6.9 0 00-1.2-.7l-.3-1.9h-2l-.3 1.9a6.9 6.9 0 00-1.2.7l-1.8-.5-1 1.7 1.6.9a6.9 6.9 0 000 1.4l-1.6.9 1 1.7 1.8-.5c.36.28.77.51 1.2.7l.3 1.9h2l.3-1.9a6.9 6.9 0 001.2-.7l1.8.5 1-1.7-1.6-.9a6.9 6.9 0 000-1.4z",
  menu: "M4 6h16M4 12h16M4 18h16"
};

export default function Icon({ name, size = 16 }: IconProps) {
  const d = PATHS[name];
  if (!d) return null;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}
