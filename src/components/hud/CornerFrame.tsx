export default function CornerFrame() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-10">
      <div className="absolute left-2 top-2 h-6 w-6 border-l-2 border-t-2 border-[#333]" />
      <div className="absolute right-2 top-2 h-6 w-6 border-r-2 border-t-2 border-[#333]" />
      <div className="absolute bottom-2 left-2 h-6 w-6 border-b-2 border-l-2 border-[#333]" />
      <div className="absolute bottom-2 right-2 h-6 w-6 border-b-2 border-r-2 border-[#333]" />
      <div className="scanlines absolute inset-0 opacity-40" />
    </div>
  );
}
