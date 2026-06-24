import React, { useEffect, useState } from "react";

const loadingMaskDelayMs = 220;

export default function GlobalLoadingMask({ visible }: { visible: boolean }) {
  const [shouldRender, setShouldRender] = useState(false);

  useEffect(() => {
    if (!visible) {
      setShouldRender(false);
      return;
    }

    const timer = window.setTimeout(() => setShouldRender(true), loadingMaskDelayMs);
    return () => window.clearTimeout(timer);
  }, [visible]);

  if (!visible || !shouldRender) return null;

  return (
    <div className="global-loading-mask" role="status" aria-live="polite" aria-label="页面加载中">
      <div className="global-loading-card">
        <div className="global-loading-spinner" aria-hidden="true" />
        <div className="global-loading-text">加载中...</div>
      </div>
    </div>
  );
}
