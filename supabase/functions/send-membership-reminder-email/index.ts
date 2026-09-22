import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type MembershipLevel = 'bronce' | 'plata' | 'oro';

type MembershipRequest = {
  user_id?: string;
  current_level?: string;
  current_spend?: number | string;
};

type ProfileRow = {
  name: string | null;
  email: string | null;
};

const levelLabels: Record<MembershipLevel, string> = {
  bronce: 'Bronce',
  plata: 'Plata',
  oro: 'Oro',
};

const minimumSpend: Record<MembershipLevel, number> = {
  bronce: 499,
  plata: 799,
  oro: 1500,
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
    const request = (await req.json().catch(() => ({}))) as MembershipRequest;
    const userId = request.user_id?.trim();
    const currentLevel = request.current_level as MembershipLevel | undefined;
    const currentSpend = Number(request.current_spend ?? 0);

    if (!userId || !currentLevel || !levelLabels[currentLevel] || !Number.isFinite(currentSpend)) {
      return jsonResponse({ error: 'Faltan datos válidos para el recordatorio.' }, 400);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const resendApiKey = Deno.env.get('RESEND_API_KEY');

    if (!supabaseUrl || !serviceRoleKey || !resendApiKey) {
      console.error('Configuración incompleta para enviar recordatorio de membresía.', {
        hasSupabaseUrl: Boolean(supabaseUrl),
        hasServiceRoleKey: Boolean(serviceRoleKey),
        hasResendApiKey: Boolean(resendApiKey),
      });
      return jsonResponse({ error: 'La función no está configurada correctamente.' }, 500);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('name, email')
      .eq('id', userId)
      .maybeSingle<ProfileRow>();

    if (profileError) {
      console.error('Error buscando perfil para recordatorio de membresía:', profileError);
      return jsonResponse({ error: 'No se pudo consultar el perfil.' }, 500);
    }

    if (!profile) {
      console.error('Perfil no encontrado para recordatorio de membresía:', userId);
      return jsonResponse({ error: 'Perfil no encontrado.' }, 404);
    }

    if (!profile.email) {
      console.error('El usuario no tiene correo registrado:', userId);
      return jsonResponse({ sent: false, reason: 'El usuario no tiene correo registrado.' });
    }

    const amountRemaining = Math.max(0, minimumSpend[currentLevel] - currentSpend);
    const levelLabel = levelLabels[currentLevel];
    const customerName = profile.name?.trim() || 'cliente';
    const formattedAmount = amountRemaining.toFixed(2);
    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: Deno.env.get('RESEND_FROM_EMAIL') ?? 'CocinArte House <onboarding@resend.dev>',
        to: [profile.email],
        subject: `¡No pierdas tu nivel ${levelLabel} en CocinArte!`,
        text: `Hola ${customerName},\n\nTu nivel actual es ${levelLabel}. Aún te faltan $${formattedAmount} MXN en compras antes de que termine el mes para mantenerlo.\n\nTu nivel se recalcula al inicio de cada mes. ¡Todavía estás a tiempo de conservar tu nivel en CocinArte!`,
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
    console.error('Error en send-membership-reminder-email:', error);
    return jsonResponse({ error: 'No se pudo enviar el recordatorio de membresía.' }, 500);
  }
});
