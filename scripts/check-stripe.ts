import "dotenv/config";
import Stripe from "stripe";

function prefixOf(name: string): string {
  const v = process.env[name];
  if (!v) return "(no definida)";
  // Show only the mode-indicating prefix, never the full secret.
  const m = v.match(/^(sk_live|sk_test|pk_live|pk_test|whsec)_/);
  return m ? `${m[1]}_…` : `${v.slice(0, 8)}…`;
}

async function main() {
  console.log("── Variables en este .env (solo prefijo) ──");
  console.log(`STRIPE_SECRET_KEY:                 ${prefixOf("STRIPE_SECRET_KEY")}`);
  console.log(`NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: ${prefixOf("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY")}`);
  console.log(`STRIPE_WEBHOOK_SECRET:             ${prefixOf("STRIPE_WEBHOOK_SECRET")}`);

  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return;
  const stripe = new Stripe(key, { typescript: true });

  const mode = key.startsWith("sk_live") ? "LIVE 🔴" : "TEST 🧪";
  console.log(`\nModo de la clave secreta: ${mode}`);

  // Webhook endpoints exist per-mode; this lists the ones for THIS key's mode.
  const eps = await stripe.webhookEndpoints.list({ limit: 100 });
  console.log(`\n── Webhooks en modo ${mode} (${eps.data.length}) ──`);
  for (const ep of eps.data) {
    console.log(`\n  url:     ${ep.url}`);
    console.log(`  status:  ${ep.status}`);
    console.log(`  api_ver: ${ep.api_version ?? "(cuenta)"}`);
    console.log(`  eventos: ${ep.enabled_events.join(", ")}`);
  }
  if (eps.data.length === 0) {
    console.log("  (ninguno en este modo)");
  }
}

main().catch((e) => {
  console.error("Error consultando Stripe:", e?.message ?? e);
  process.exitCode = 1;
});
