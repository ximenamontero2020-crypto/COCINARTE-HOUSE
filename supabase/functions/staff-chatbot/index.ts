import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const STAFF_EMAIL = 'ximenamontero2020@gmail.com';
const GEMINI_MODEL = 'gemini-3.6-flash';

type StaffChatRequest = {
  question?: string;
};

type MenuItemRow = {
  id: number;
  name: string;
};

type IngredientRow = {
  id: string;
  nombre: string;
  unidad: string;
  cantidad_actual: number | string;
  umbral_minimo: number | string;
};

type RecipeRow = {
  menu_item_id: number;
  insumo_id: string;
  cantidad_requerida: number | string;
};

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });

const numberValue = (value: number | string | null | undefined) => Number(value ?? 0) || 0;

const getBearerToken = (req: Request) => {
  const authorization = req.headers.get('Authorization') ?? req.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) return null;
  const token = authorization.slice('Bearer '.length).trim();
  return token || null;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceRoleKey) {
      console.error('Configuración incompleta para staff-chatbot.', {
        hasSupabaseUrl: Boolean(supabaseUrl),
        hasServiceRoleKey: Boolean(serviceRoleKey),
      });
      return jsonResponse({ error: 'La función no está configurada correctamente.' }, 500);
    }

    const token = getBearerToken(req);
    if (!token) {
      return jsonResponse({ error: 'Se requiere autenticación de staff.' }, 403);
    }

    // Esta función usa SUPABASE_SERVICE_ROLE_KEY y por eso esta validación es obligatoria.
    // Nunca eliminarla: service role bypassa las políticas RLS de las tablas internas.
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    const normalizedEmail = userData.user?.email?.trim().toLowerCase();

    if (userError || normalizedEmail !== STAFF_EMAIL) {
      console.error('Acceso rechazado para staff-chatbot:', userError?.message ?? 'correo no autorizado');
      return jsonResponse({ error: 'No autorizado.' }, 403);
    }

    const { question } = (await req.json().catch(() => ({ question: '' }))) as StaffChatRequest;
    const userQuestion = question?.trim();
    if (!userQuestion) {
      return jsonResponse({ reply: 'Escribe una pregunta sobre inventario, ventas o membresías.' }, 400);
    }

    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiApiKey) {
      return jsonResponse({ reply: 'La clave de Gemini no está configurada.' }, 500);
    }

    const currentMonthStart = new Date();
    currentMonthStart.setDate(1);
    currentMonthStart.setHours(0, 0, 0, 0);
    const monthStartIso = currentMonthStart.toISOString();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayStartIso = todayStart.toISOString();

    const [ingredientsResult, lowStockResult, recipesResult, menuResult, todaySalesResult, monthSalesResult, membershipResult] = await Promise.all([
      supabase.from('insumos').select('id, nombre, unidad, cantidad_actual, umbral_minimo').order('nombre'),
      supabase.rpc('get_insumos_stock_bajo'),
      supabase.from('receta_platillo').select('menu_item_id, insumo_id, cantidad_requerida'),
      supabase.from('menu_items').select('id, name').order('name'),
      supabase.from('comandas').select('productos, total, estado').gte('created_at', todayStartIso),
      supabase.from('comandas').select('productos, total, estado').gte('created_at', monthStartIso),
      supabase.from('profiles').select('membership_level'),
    ]);

    const queryError = ingredientsResult.error ?? lowStockResult.error ?? recipesResult.error ?? menuResult.error ?? todaySalesResult.error ?? monthSalesResult.error ?? membershipResult.error;
    if (queryError) {
      console.error('Error consultando contexto de staff-chatbot:', queryError);
      return jsonResponse({ error: 'No se pudo consultar el contexto del negocio.' }, 500);
    }

    const ingredients = (ingredientsResult.data ?? []) as IngredientRow[];
    const lowStock = (lowStockResult.data ?? []) as IngredientRow[];
    const recipes = (recipesResult.data ?? []) as RecipeRow[];
    const menuItems = (menuResult.data ?? []) as MenuItemRow[];
    const menuNames = new Map(menuItems.map((item) => [item.id, item.name]));

    const recipeText = recipes.length
      ? recipes.map((recipe) => {
        const ingredient = ingredients.find((item) => item.id === recipe.insumo_id);
        return `- ${menuNames.get(recipe.menu_item_id) ?? `menu_item_id ${recipe.menu_item_id}`}: ${numberValue(recipe.cantidad_requerida)} ${ingredient?.unidad ?? 'unidad'} de ${ingredient?.nombre ?? `insumo ${recipe.insumo_id}`}`;
      }).join('\n')
      : '- No hay recetas configuradas.';

    const salesSummary = (orders: Array<{ productos?: unknown; total?: number | string; estado?: string }>) => {
      const products = new Map<string, number>();
      let revenue = 0;
      let pending = 0;
      let ready = 0;

      for (const order of orders) {
        revenue += numberValue(order.total);
        if (order.estado === 'pendiente') pending += 1;
        if (order.estado === 'listo') ready += 1;
        if (!Array.isArray(order.productos)) continue;
        for (const product of order.productos) {
          if (!product || typeof product !== 'object') continue;
          const row = product as { menu_item_id?: number; nombre?: string; cantidad?: number | string };
          const name = row.menu_item_id ? menuNames.get(Number(row.menu_item_id)) ?? row.nombre ?? 'Platillo sin nombre' : row.nombre ?? 'Platillo sin nombre';
          products.set(name, (products.get(name) ?? 0) + numberValue(row.cantidad));
        }
      }

      const topProducts = [...products.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name, quantity]) => `${name}: ${quantity}`).join('; ') || 'Sin productos registrados.';
      return `ingresos: $${revenue.toFixed(2)} MXN; pedidos pendientes: ${pending}; pedidos listos: ${ready}; platillos más vendidos: ${topProducts}`;
    };

    const membershipCounts = new Map<string, number>();
    for (const row of membershipResult.data ?? []) {
      const level = String((row as { membership_level?: string | null }).membership_level ?? 'sin_nivel');
      membershipCounts.set(level, (membershipCounts.get(level) ?? 0) + 1);
    }
    const membershipText = [...membershipCounts.entries()].map(([level, count]) => `${level}: ${count}`).join('; ') || 'No hay perfiles registrados.';

    const contextText = [
      `Inventario actual:\n${ingredients.map((item) => `- ${item.nombre}: ${numberValue(item.cantidad_actual)} ${item.unidad} (mínimo ${numberValue(item.umbral_minimo)})`).join('\n') || '- Sin insumos.'}`,
      `Stock bajo:\n${lowStock.map((item) => `- ${item.nombre}: ${numberValue(item.cantidad_actual)} ${item.unidad} (mínimo ${numberValue(item.umbral_minimo)})`).join('\n') || '- No hay insumos bajo el mínimo.'}`,
      `Recetas configuradas:\n${recipeText}`,
      `Ventas de hoy: ${salesSummary((todaySalesResult.data ?? []) as Array<{ productos?: unknown; total?: number | string; estado?: string }>)}`,
      `Ventas del mes: ${salesSummary((monthSalesResult.data ?? []) as Array<{ productos?: unknown; total?: number | string; estado?: string }>)}`,
      `Clientes por nivel de membresía: ${membershipText}`,
    ].join('\n\n');

    const systemInstruction = `Eres el asistente interno de operaciones de COCINARTE HOUSE. Respondes exclusivamente a empleados autorizados sobre inventario, recetas, ventas y estadísticas agregadas de membresías.

Reglas:
- Responde en español, de forma directa, práctica y breve.
- Usa únicamente los datos reales del contexto proporcionado.
- No inventes cantidades, ventas, recetas ni niveles.
- Si un dato no está disponible, dilo claramente.
- No reveles ni solicites nombres, correos, teléfonos u otros datos personales de clientes.
- Usa las fechas indicadas para distinguir ventas de hoy y del mes.
- Señala stock bajo cuando corresponda y prioriza acciones útiles para operación.

Contexto interno actual:
${contextText}`;

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${geminiApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemInstruction }] },
          contents: [{ role: 'user', parts: [{ text: userQuestion }] }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 600 },
        }),
      },
    );

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      console.error('Gemini API error en staff-chatbot:', geminiResponse.status, errorText);
      return jsonResponse({ error: 'No se pudo obtener una respuesta de Gemini.' }, 502);
    }

    const responseJson = await geminiResponse.json();
    const reply = responseJson?.candidates?.[0]?.content?.parts?.find((part: { text?: string }) => typeof part?.text === 'string')?.text ?? 'No pude generar una respuesta útil.';
    return jsonResponse({ reply });
  } catch (error) {
    console.error('Error en staff-chatbot:', error);
    return jsonResponse({ error: 'Hubo un error al procesar la consulta.' }, 500);
  }
});
