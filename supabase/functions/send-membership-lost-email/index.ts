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
  previous_level?: string;
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
    const previousLevel = request.previous_level as MembershipLevel | undefined;

    if (!userId || !previousLevel || !levelLabels[previousLevel]) {
      return jsonResponse({ error: 'Faltan user_id o previous_level válido.' }, 400);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const resendApiKey = Deno.env.get('RESEND_API_KEY');

    if (!supabaseUrl || !serviceRoleKey || !resendApiKey) {
      console.error('Configuración incompleta para enviar correo de nivel reiniciado.', {
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
      console.error('Error buscando perfil para correo de nivel reiniciado:', profileError);
      return jsonResponse({ error: 'No se pudo consultar el perfil.' }, 500);
    }

    if (!profile) {
      console.error('Perfil no encontrado para correo de nivel reiniciado:', userId);
      return jsonResponse({ error: 'Perfil no encontrado.' }, 404);
    }

    if (!profile.email) {
      console.error('El usuario no tiene correo registrado:', userId);
      return jsonResponse({ sent: false, reason: 'El usuario no tiene correo registrado.' });
    }

    const customerName = profile.name?.trim() || 'cliente';
    const levelLabel = levelLabels[previousLevel];
    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: Deno.env.get('RESEND_FROM_EMAIL') ?? 'CocinArte House <onboarding@resend.dev>',
        to: [profile.email],
        subject: 'Tu nivel en CocinArte se reinició',
        text: `Hola ${customerName},\n\nTu nivel ${levelLabel} en CocinArte se reinició al comenzar el nuevo mes.\n\nTu nivel se recalcula cada mes según tus compras del mes en curso. Puedes volver a alcanzar este nivel con tus próximas compras.\n\n¡Te esperamos en CocinArte House!`,
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
    console.error('Error en send-membership-lost-email:', error);
    return jsonResponse({ error: 'No se pudo enviar el correo de nivel reiniciado.' }, 500);
  }
});
