import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import { SMTPClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts';

// Resumen diario de stock bajo con proveedores preferidos.
//
// Dos formas de llamarla:
//   1. Trigger insumos_low_stock_digest (pg_net) con header x-stock-alert-secret → envía el correo.
//   2. Staff desde /staff/proveedores ("Probar alerta") con su sesión → SIEMPRE dry-run: devuelve
//      el HTML y el estado de configuración, nunca envía.
//
// Secrets (supabase secrets set …); ningún correo va en el código:
//   STOCK_ALERT_SECRET   mismo valor que private.app_config.stock_alert_secret
//   STOCK_ALERT_EMAILS   destinatarios separados por coma
//   RESEND_API_KEY (+ RESEND_FROM_EMAIL)        → proveedor preferido
//   GMAIL_USER + GMAIL_APP_PASSWORD             → SMTP de respaldo (el mismo de send-order-ready-email)
// Sin proveedor configurado: genera el HTML, lo loguea y registra "preview_only".

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-stock-alert-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type Insumo = { id: string; nombre: string; unidad: string; cantidad_actual: number | string; umbral_minimo: number | string };
type Link = { insumo_id: string; lead_days: number | null; proveedores: { nombre: string; telefono: string | null } | null };
type LowRow = { insumo: Insumo; proveedores: Array<{ nombre: string; telefono: string | null; lead_days: number | null }> };

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...corsHeaders } });

const escapeHtml = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const qty = (value: number | string) => Number(value).toLocaleString('es-MX', { maximumFractionDigits: 2 });

const todayMx = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(new Date());

function recipients(): string[] {
  return (Deno.env.get('STOCK_ALERT_EMAILS') ?? '')
    .split(',')
    .map((email) => email.trim())
    .filter((email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));
}

function provider(): 'resend' | 'smtp' | null {
  if (Deno.env.get('RESEND_API_KEY')) return 'resend';
  if (Deno.env.get('GMAIL_USER') && Deno.env.get('GMAIL_APP_PASSWORD')) return 'smtp';
  return null;
}

async function loadLowStock(admin: SupabaseClient): Promise<LowRow[]> {
  const { data: insumos, error } = await admin
    .from('insumos')
    .select('id, nombre, unidad, cantidad_actual, umbral_minimo')
    .order('nombre');
  if (error) throw error;

  const low = ((insumos ?? []) as Insumo[]).filter((i) => Number(i.cantidad_actual) <= Number(i.umbral_minimo));
  if (low.length === 0) return [];

  const { data: links, error: linksError } = await admin
    .from('insumo_proveedor')
    .select('insumo_id, lead_days, proveedores(nombre, telefono)')
    .eq('preferred', true)
    .in('insumo_id', low.map((i) => i.id));
  if (linksError) throw linksError;

  return low.map((insumo) => ({
    insumo,
    proveedores: ((links ?? []) as unknown as Link[])
      .filter((link) => String(link.insumo_id) === String(insumo.id) && link.proveedores)
      .map((link) => ({ nombre: link.proveedores!.nombre, telefono: link.proveedores!.telefono, lead_days: link.lead_days })),
  }));
}

function buildEmail(rows: LowRow[], day: string) {
  const subject = `⚠️ Stock bajo en CocinArte House: ${rows.length} ${rows.length === 1 ? 'insumo' : 'insumos'} (${day})`;
  const cell = 'padding:8px 10px;border-bottom:1px solid #eadfce;text-align:left;vertical-align:top;';
  const body = rows
    .map(({ insumo, proveedores }) => {
      const supplierText = proveedores.length
        ? proveedores
            .map((p) => `${escapeHtml(p.nombre)}${p.telefono ? ` · ${escapeHtml(p.telefono)}` : ''}${p.lead_days !== null ? ` · entrega ${p.lead_days} d` : ''}`)
            .join('<br>')
        : '<em>Sin proveedor preferido</em>';
      return `<tr><td style="${cell}"><strong>${escapeHtml(insumo.nombre)}</strong></td><td style="${cell}color:#b42318;">${qty(insumo.cantidad_actual)} ${escapeHtml(insumo.unidad)}</td><td style="${cell}">${qty(insumo.umbral_minimo)} ${escapeHtml(insumo.unidad)}</td><td style="${cell}">${supplierText}</td></tr>`;
    })
    .join('');

  const html = `<!doctype html><html lang="es-MX"><body style="margin:0;background:#f8f1e7;font-family:Arial,Helvetica,sans-serif;color:#3b2a1a;">
<div style="max-width:640px;margin:0 auto;padding:24px;">
<h1 style="font-size:20px;margin:0 0 8px;">Insumos en stock bajo</h1>
<p style="margin:0 0 16px;font-size:14px;">Hola, equipo. Estos insumos están en o por debajo de su mínimo. Revisa y pide a tu proveedor preferido para no quedarte sin nada en la operación.</p>
<table style="width:100%;border-collapse:collapse;background:#fffaf3;font-size:14px;">
<thead><tr style="background:#3b2a1a;color:#f4ead8;"><th style="${cell}">Insumo</th><th style="${cell}">Stock</th><th style="${cell}">Mínimo</th><th style="${cell}">Proveedor preferido</th></tr></thead>
<tbody>${body}</tbody></table>
<p style="margin:16px 0 0;font-size:12px;color:#7a6652;">Resumen automático de CocinArte House (${day}). Se envía como máximo una vez al día.</p>
</div></body></html>`;

  const text = [
    'Insumos en stock bajo:',
    ...rows.map(({ insumo, proveedores }) =>
      `- ${insumo.nombre}: ${qty(insumo.cantidad_actual)} ${insumo.unidad} (mínimo ${qty(insumo.umbral_minimo)}). Proveedor: ${
        proveedores.map((p) => `${p.nombre}${p.telefono ? ` ${p.telefono}` : ''}`).join(', ') || 'sin preferido'
      }`,
    ),
  ].join('\n');

  return { subject, html, text };
}

async function send(to: string[], email: { subject: string; html: string; text: string }) {
  if (provider() === 'resend') {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${Deno.env.get('RESEND_API_KEY')}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: Deno.env.get('RESEND_FROM_EMAIL') ?? 'CocinArte House <onboarding@resend.dev>',
        to,
        subject: email.subject,
        html: email.html,
        text: email.text,
      }),
    });
    if (!response.ok) throw new Error(`Resend ${response.status}: ${await response.text()}`);
    return;
  }

  const gmailUser = Deno.env.get('GMAIL_USER')!;
  const client = new SMTPClient({
    connection: { hostname: 'smtp.gmail.com', port: 465, tls: true, auth: { username: gmailUser, password: Deno.env.get('GMAIL_APP_PASSWORD')! } },
  });
  try {
    await client.send({ from: `CocinArte House <${gmailUser}>`, to, subject: email.subject, content: email.text, html: email.html });
  } finally {
    await client.close();
  }
}

async function isStaffCaller(req: Request): Promise<boolean> {
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  const url = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!token || !url || !anonKey) return false;

  const client = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data, error } = await client.rpc('is_staff');
  return !error && data === true;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) return jsonResponse({ error: 'La función no está configurada.' }, 500);

  const expectedSecret = Deno.env.get('STOCK_ALERT_SECRET');
  const fromTrigger = Boolean(expectedSecret) && req.headers.get('x-stock-alert-secret') === expectedSecret;
  if (!fromTrigger && !(await isStaffCaller(req))) {
    return jsonResponse({ error: 'No autorizado.' }, 401);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const payload = (await req.json().catch(() => ({}))) as { day?: string };
  const day = payload.day ?? todayMx();
  const to = recipients();
  const configuredProvider = provider();

  const finish = async (result: string) => {
    if (!fromTrigger) return;
    const { error } = await admin.from('stock_alert_log').update({ result, finished_at: new Date().toISOString() }).eq('day', day);
    if (error) console.error('No se pudo actualizar stock_alert_log:', error);
  };

  try {
    const rows = await loadLowStock(admin);
    const email = rows.length ? buildEmail(rows, day) : null;

    // Staff: solo vista previa, nunca envía.
    if (!fromTrigger) {
      return jsonResponse({
        dry_run: true,
        low_count: rows.length,
        recipients_count: to.length,
        provider: configuredProvider,
        subject: email?.subject ?? null,
        html: email?.html ?? null,
      });
    }

    if (!email) {
      await finish('nothing_low');
      return jsonResponse({ sent: false, reason: 'nothing_low' });
    }
    if (!configuredProvider || to.length === 0) {
      console.log('Alerta de stock bajo sin proveedor/destinatarios; HTML generado:\n', email.html);
      await finish(!configuredProvider ? 'preview_only' : 'no_recipients');
      return jsonResponse({ sent: false, reason: !configuredProvider ? 'preview_only' : 'no_recipients' });
    }

    await send(to, email);
    await finish(`sent (${configuredProvider}, ${rows.length})`);
    return jsonResponse({ sent: true, low_count: rows.length });
  } catch (error) {
    console.error('Error en send-low-stock-email:', error);
    await finish(`error: ${error instanceof Error ? error.message.slice(0, 200) : 'desconocido'}`);
    return jsonResponse({ error: 'No se pudo generar la alerta de stock bajo.' }, 500);
  }
});
