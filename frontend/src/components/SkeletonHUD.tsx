export function SkeletonHUD() {
  return (
    <div className="fixed top-0 left-0 right-0 z-50 pointer-events-none">
      <div
        className="flex items-center justify-between px-3 py-2"
        style={{ paddingTop: 'max(8px, env(safe-area-inset-top, 8px))' }}
      >
        {/* Left: avatar + gold */}
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-white/10 animate-pulse" />
          <div className="flex flex-col gap-1">
            <div className="w-20 h-3 rounded-full bg-white/10 animate-pulse" />
            <div className="w-14 h-2 rounded-full bg-white/8 animate-pulse" />
          </div>
        </div>
        {/* Right: energy bar */}
        <div className="flex items-center gap-2">
          <div className="w-24 h-3 rounded-full bg-white/10 animate-pulse" />
          <div className="w-8 h-8 rounded-full bg-white/10 animate-pulse" />
        </div>
      </div>
    </div>
  );
}
