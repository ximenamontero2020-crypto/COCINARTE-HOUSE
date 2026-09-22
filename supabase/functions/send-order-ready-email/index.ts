import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import { SMTPClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts';
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type OrderRequest = {
  order_id?: string | number;
  record?: {
    id?: string | number;
    estado?: string;
  };
  old_record?: {
    estado?: string;
  } | null;
};

type OrderRow = {
  id: string | number;
  user_id: string | null;
  numero_pedido: string;
  total: number | string;
  estado: string;
};

type ProfileRow = {
  name: string | null;
  email: string | null;
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
    const request = (await req.json().catch(() => ({}))) as OrderRequest;
    const orderId = request.order_id ?? request.record?.id;
    if (orderId === undefined || orderId === null || String(orderId).trim() === '') {
      return jsonResponse({ error: 'Falta order_id.' }, 400);
    }

    if (request.old_record?.estado === 'listo' || request.record?.estado !== undefined && request.record.estado !== 'listo') {
      return jsonResponse({ sent: false, reason: 'El cambio no corresponde a pasar el pedido a listo.' });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
   const gmailUser = Deno.env.get('GMAIL_USER');
const gmailPassword = Deno.env.get('GMAIL_APP_PASSWORD');

if (!supabaseUrl || !serviceRoleKey || !gmailUser || !gmailPassword) {
  console.error('Configuración incompleta para enviar correo de pedido listo.', {
    hasSupabaseUrl: Boolean(supabaseUrl),
    hasServiceRoleKey: Boolean(serviceRoleKey),
    hasGmailUser: Boolean(gmailUser),
    hasGmailPassword: Boolean(gmailPassword),
  });
  return jsonResponse({ error: 'La función no está configurada correctamente.' }, 500);
}

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });

    const { data: order, error: orderError } = await supabase
      .from('comandas')
      .select('id, user_id, numero_pedido, total, estado')
      .eq('id', orderId)
      .maybeSingle<OrderRow>();

    if (orderError) {
      console.error('Error buscando pedido para notificación:', orderError);
      return jsonResponse({ error: 'No se pudo consultar el pedido.' }, 500);
    }

    if (!order) {
      console.error('Pedido no encontrado para notificación:', orderId);
      return jsonResponse({ error: 'Pedido no encontrado.' }, 404);
    }

    if (order.estado !== 'listo') {
      return jsonResponse({ sent: false, reason: 'El pedido todavía no está listo.' });
    }

    if (!order.user_id) {
      return jsonResponse({ sent: false, reason: 'Pedido de invitado sin cuenta.' });
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('name, email')
      .eq('id', order.user_id)
      .maybeSingle<ProfileRow>();

    if (profileError) {
      console.error('Error buscando perfil para notificación:', profileError);
      return jsonResponse({ error: 'No se pudo consultar el perfil.' }, 500);
    }

    if (!profile?.email) {
      console.error('El usuario del pedido no tiene correo en profiles:', order.user_id);
      return jsonResponse({ sent: false, reason: 'El usuario no tiene correo registrado.' });
    }

    const total = typeof order.total === 'number' ? order.total.toFixed(2) : String(order.total);
    const customerName = profile.name?.trim() || 'cliente';
    const client = new SMTPClient({
  connection: {
    hostname: 'smtp.gmail.com',
    port: 465,
    tls: true,
    auth: {
      username: gmailUser,
      password: gmailPassword,
    },
  },
});

try {
  await client.send({
    from: `CocinArte House <${gmailUser}>`,
    to: profile.email,
    subject: `¡Tu pedido ${order.numero_pedido} está listo!`,
    content: `Hola ${customerName},\n\nTu pedido ${order.numero_pedido} está listo para recoger.`,
  });
} finally {
  await client.close();
}

return jsonResponse({ sent: true });
  } catch (error) {
    console.error('Error en send-order-ready-email:', error);
    return jsonResponse({ error: 'No se pudo enviar el correo del pedido.' }, 500);
  }
});
