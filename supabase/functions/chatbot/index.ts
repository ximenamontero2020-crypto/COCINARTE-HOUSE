import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type ChatRequest = {
  question?: string;
};

type MenuCategoryRow = {
  id: string;
  title: string;
  subtitle: string;
  image: string;
  orden: number;
};

type MenuItemRow = {
  id: number;
  category_id: string;
  name: string;
  description: string;
  price: string;
  emoji: string;
  image: string;
  nutrition_calories: number | null;
  nutrition_protein: number | null;
  nutrition_carbs: number | null;
  nutrition_fat: number | null;
  allergens: string[] | null;
  orden: number;
};

const publicHours = [
  { day: 'Lunes a Viernes', hours: '7:00 — 21:00' },
  { day: 'Sábado', hours: '8:00 — 18:00' },
  { day: 'Domingo', hours: 'cerrado' },
];

const publicLocation = 'Campus Tecmilenio, Zona Universitaria';

const formatPrice = (value: unknown): string => {
  if (typeof value === 'number') return `$${value.toFixed(2)}`;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return 'No disponible';
    return trimmed;
  }
  return 'No disponible';
};

const buildMenuContext = async (): Promise<{ menuText: string; statusText: string; contextText: string }> => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    return {
      menuText: 'El menú no está disponible porque no se pudo acceder a Supabase.',
      statusText: 'El estado del semáforo no está disponible porque no se pudo acceder a Supabase.',
      contextText: 'No hay conexión a Supabase disponible para consultar datos en tiempo real.',
    };
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  const [categoriesResult, itemsResult, statusResult, countResult] = await Promise.all([
    supabase.from('menu_categories').select('*').order('orden', { ascending: true }),
    supabase.from('menu_items').select('*').order('orden', { ascending: true }),
    supabase.from('cafeteria_status').select('id, manual_level, manual_set_by, manual_set_at').eq('id', 1).maybeSingle(),
    supabase.rpc('get_active_pending_orders_count'),
  ]);

  const categories = (categoriesResult.data ?? []) as MenuCategoryRow[];
  const items = (itemsResult.data ?? []) as MenuItemRow[];
  const pendingCount = countResult.data ?? 0;

  let statusText = 'El estado del semáforo no está disponible actualmente.';

  if (!statusResult.error && statusResult.data) {
    const manualLevel = statusResult.data.manual_level as string | null;
    const manualSetAt = statusResult.data.manual_set_at as string | null;

    const manualActive =
      !!manualLevel && !!manualSetAt && Date.now() - new Date(manualSetAt).getTime() < 2 * 60 * 60 * 1000;

    const resolvedLevel =
      manualActive
        ? manualLevel
        : pendingCount <= 5
          ? 'green'
          : pendingCount <= 15
            ? 'yellow'
            : 'red';

    const levelLabels: Record<string, string> = {
      green: 'Poca gente',
      yellow: 'Regular',
      red: 'Mucha gente',
    };

    statusText = `Estado del semáforo: ${levelLabels[resolvedLevel] ?? 'Desconocido'} (pedidos activos: ${pendingCount}).`;

    if (manualActive) {
      statusText += ' El estado fue sobrescrito manualmente por el staff y expira automáticamente.';
    }
  }

  const menuByCategory = categories.map((category) => {
    const categoryItems = items
      .filter((item) => item.category_id === category.id)
      .sort((a, b) => (a.orden ?? 999) - (b.orden ?? 999));

    const itemText = categoryItems.length
      ? categoryItems
          .map((item) => {
            const allergens = Array.isArray(item.allergens) ? item.allergens.join(', ') : 'Sin información';
            return `- ${item.name}: ${item.description}. Precio: ${formatPrice(item.price)}. Alérgenos: ${allergens}.`;
          })
          .join('\n')
      : '- No hay platillos registrados en esta categoría.';

    return `${category.title}: ${category.subtitle}\n${itemText}`;
  });

  const menuText = menuByCategory.length
    ? menuByCategory.join('\n\n')
    : 'El menú no está disponible en este momento o no hay categorías registradas.';

  const scheduleText = publicHours
    .map((entry) => `${entry.day}: ${entry.hours}`)
    .join(' | ');

  const contextText = [
    `Horarios: ${scheduleText}`,
    `Ubicación: ${publicLocation}`,
    `Estado del semáforo: ${statusText}`,
    `Menú actual:\n${menuText}`,
  ].join('\n');

  return { menuText, statusText, contextText };
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { question } = (await req.json().catch(() => ({ question: '' }))) as ChatRequest;
    const userQuestion = (question ?? '').trim();

    if (!userQuestion) {
      return new Response(JSON.stringify({ reply: 'Necesito que me hagas una pregunta sobre la cafetería.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    console.log('Gemini API key presente:', !!geminiApiKey);
    if (!geminiApiKey) {
      return new Response(
        JSON.stringify({
          reply: 'La clave de Gemini no está configurada en Supabase. No puedo responder con IA en este momento.',
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        },
      );
    }

    const { contextText, menuText, statusText } = await buildMenuContext();

    const systemPrompt = `Eres el asistente oficial de COCINARTE HOUSE. Ayuda con preguntas relacionadas con la cafetería, incluyendo el menú, precios, horarios, ubicación, semáforo, pedidos y temas relacionados.

Reglas:
- Usa solo la información real del contexto.
- No inventes productos, precios ni horarios.
- Si el menú está vacío o no está disponible, dilo claramente.
- Si la pregunta del usuario no tiene absolutamente ninguna relación con la cafetería (por ejemplo, política, tareas escolares, clima, deportes u otros temas totalmente ajenos), responde exactamente: "Solo puedo ayudarte con temas de la cafetería: menú, precios, pedidos, horarios, ubicación y el estado del servicio."
- No inventes información ni intentes responder sobre temas ajenos a la cafetería bajo ninguna circunstancia.
- Responde en español, con tono amable y directo.
- Si no encuentras respuesta exacta, dilo honestamente y ofrece alternativas útiles.

Contexto actual:
${contextText}
`;

    const geminiModelName = 'gemini-3.6-flash';
    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${geminiModelName}:generateContent?key=${geminiApiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: systemPrompt }],
          },
          contents: [
            {
              role: 'user',
              parts: [{ text: userQuestion }],
            },
          ],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 500,
          },
        }),
      },
    );

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      console.error('Gemini API error:', geminiResponse.status, errorText);
      return new Response(
        JSON.stringify({
          reply: 'No pude obtener una respuesta de Gemini en este momento. Inténtalo de nuevo más tarde.',
        }),
        {
          status: 502,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        },
      );
    }

    const responseJson = await geminiResponse.json();
    const reply =
      responseJson?.candidates?.[0]?.content?.parts?.find((part: { text?: string }) => typeof part?.text === 'string')?.text ??
      'No pude generar una respuesta útil en este momento.';

    return new Response(
      JSON.stringify({
        reply,
        debug: {
          menuText,
          statusText,
        },
      }),
      {
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      },
    );
  } catch (error) {
    console.error('Error en chatbot:', error);
    return new Response(
      JSON.stringify({
        reply: 'Hubo un error al procesar tu pregunta. Inténtalo de nuevo más tarde.',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      },
    );
  }
});
