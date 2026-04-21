export default function Home() {
  return (
    <main style={{ fontFamily: "system-ui, sans-serif", padding: "2rem", maxWidth: 640 }}>
      <h1>MedEdBot</h1>
      <p>Multilingual medical education LINE bot, running on Vercel.</p>
      <ul>
        <li><code>POST /api/webhook</code> — LINE webhook</li>
        <li><code>GET /api/health</code> — health check</li>
        <li><code>GET /api/ping</code> — liveness probe</li>
      </ul>
    </main>
  );
}
