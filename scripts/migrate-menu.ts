import { createClient } from '@supabase/supabase-js';
import { menuCategories } from '../src/mocks/menu';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error('Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY');
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});

async function main() {
  // Opción segura para migración inicial:
  // borra primero para evitar duplicados si vuelves a correr el script.
  const { error: clearItemsError } = await supabase.from('menu_items').delete().neq('id', 0);
  if (clearItemsError) {
    throw new Error(`Error limpiando menu_items: ${clearItemsError.message}`);
  }

  const { error: clearCategoriesError } = await supabase.from('menu_categories').delete().neq('id', 'x');
  if (clearCategoriesError) {
    throw new Error(`Error limpiando menu_categories: ${clearCategoriesError.message}`);
  }

  // 1) Insertar categorías
  const categoriesRows = menuCategories.map((category, index) => ({
    id: category.id,
    title: category.title,
    subtitle: category.subtitle,
    image: category.image,
    orden: index + 1,
  }));

  const { error: categoriesError } = await supabase
    .from('menu_categories')
    .insert(categoriesRows);

  if (categoriesError) {
    throw new Error(`Error insertando categorías: ${categoriesError.message}`);
  }

  // 2) Insertar items
  const itemsRows = menuCategories.flatMap((category) =>
    category.items.map((item, index) => ({
      category_id: category.id,
      name: item.name,
      description: item.description,
      price: item.price,
      emoji: item.emoji,
      image: item.image,
      nutrition_calories: item.nutrition.calories,
      nutrition_protein: item.nutrition.protein,
      nutrition_carbs: item.nutrition.carbs,
      nutrition_fat: item.nutrition.fat,
      allergens: item.allergens ?? [],
      orden: index + 1,
    })),
  );

  const { error: itemsError } = await supabase.from('menu_items').insert(itemsRows);

  if (itemsError) {
    throw new Error(`Error insertando items: ${itemsError.message}`);
  }

  console.log('Migración completada.');
  console.log(`Categorías: ${categoriesRows.length}`);
  console.log(`Items: ${itemsRows.length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});