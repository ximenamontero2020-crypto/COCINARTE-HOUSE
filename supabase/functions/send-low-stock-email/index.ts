import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type LowStockRequest = {
  insumo_nombre?: string;
  cantidad_actual?: number | string;
  umbral_minimo?: number | string;
  unidad?: string;
};

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const request = (await req.json().catch(() => ({}))) as LowStockRequest;
    const ingredientName = request.insumo_nombre?.trim();
    const unit = request.unidad?.trim();
    const currentQuantity = Number(request.cantidad_actual);
    const minimumThreshold = Number(request.umbral_minimo);

    if (
      !ingredientName ||
      !unit ||
      !Number.isFinite(currentQuantity) ||
      !Number.isFinite(minimumThreshold)
    ) {
      return jsonResponse({ error: 'Faltan datos válidos del insumo.' }, 400);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const resendApiKey = Deno.env.get('RESEND_API_KEY');

    if (!supabaseUrl || !serviceRoleKey || !resendApiKey) {
      console.error('Configuración incompleta para enviar correo de stock bajo.', {
        hasSupabaseUrl: Boolean(supabaseUrl),
        hasServiceRoleKey: Boolean(serviceRoleKey),
        hasResendApiKey: Boolean(resendApiKey),
      });
      return jsonResponse({ error: 'La función no está configurada correctamente.' }, 500);
    }

    // El service role solo se inicializa para mantener el mismo patrón de las funciones
    // de correo existentes; esta función no consulta tablas porque el trigger ya envía los datos.
    createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });

    const formattedCurrent = currentQuantity.toFixed(2);
    const formattedThreshold = minimumThreshold.toFixed(2);
    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: Deno.env.get('RESEND_FROM_EMAIL') ?? 'CocinArte House <onboarding@resend.dev>',
        to: ['ximenamontero2020@gmail.com'],
        subject: `⚠️ Stock bajo: ${ingredientName}`,
        text: `Hola,\n\nEl insumo ${ingredientName} está en stock bajo.\n\nCantidad actual: ${formattedCurrent} ${unit}\nUmbral mínimo: ${formattedThreshold} ${unit}\n\nRecuerda reabastecerlo pronto para mantener la operación de CocinArte House.`,
      }),
    });

    if (!resendResponse.ok) {
      const errorText = await resendResponse.text();
      console.error('Resend API error:', resendResponse.status, errorText);
      return jsonResponse({ error: 'Resend no pudo enviar el correo.' }, 502);
    }

    const resendResult = await resendResponse.json();
    return jsonResponse({ sent: true, id: resendResult?.id ?? null });
  } catch (error) {
    console.error('Error en send-low-stock-email:', error);
    return jsonResponse({ error: 'No se pudo enviar el correo de stock bajo.' }, 500);
  }
});
