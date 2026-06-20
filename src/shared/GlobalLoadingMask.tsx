import React from "react";

export default function GlobalLoadingMask({ visible }: { visible: boolean }) {
  if (!visible) return null;

  return (
    <div className="global-loading-mask" role="status" aria-live="polite" aria-label="页面加载中">
      <div className="global-loading-card">
        <div className="global-loading-spinner" aria-hidden="true" />
        <div className="global-loading-text">加载中...</div>
      </div>
    </div>
  );
}
