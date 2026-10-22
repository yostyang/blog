"use client";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="wrap" id="main">
      <div className="empty">
        <p>页面加载出了点问题</p>
        <p>
          <button className="btn" type="button" onClick={reset}>
            重试
          </button>
        </p>
      </div>
    </main>
  );
}
