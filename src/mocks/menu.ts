export type NutritionInfo = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

export type MenuItem = {
  id?: number;
  name: string;
  description: string;
  price: string;
  emoji: string;
  image: string;
  nutrition: NutritionInfo;
  allergens: string[];
  pago_en_caja_permitido?: boolean;
};

export type MenuCategory = {
  id: string;
  title: string;
  subtitle: string;
  image: string;
  items: MenuItem[];
};

export const menuCategories: MenuCategory[] = [
  {
    id: 'sandwiches',
    title: 'Sándwiches Rústicos',
    subtitle: 'Panes artesanales con ingredientes frescos del día.',
    image:
      'https://readdy.ai/api/search-image?query=Professional%20food%20photography%20of%20a%20rustic%20gourmet%20sandwich%20platter%20with%20grilled%20chicken%20avocado%20fresh%20vegetables%20and%20artisan%20sourdough%20bread%20soft%20natural%20window%20light%20shallow%20depth%20of%20field%20appetizing%20warm%20cream%20and%20soft%20sage%20olive%20tones%20clean%20light%20neutral%20background%20editorial%20food%20styling%20high%20detail&width=800&height=600&seq=cat-sandwich-01&orientation=landscape&nocache=true',
    items: [
      {
        name: 'Sándwich de Pollo Rústico',
        description: 'Pollo a la parrilla, aguacate, queso panela y aderezo de chipotle en pan de masa madre.',
        price: 'MXN 68',
        emoji: '🥪',
        image:
          'https://readdy.ai/api/search-image?query=Professional%20food%20photography%20of%20a%20rustic%20grilled%20chicken%20sandwich%20with%20sliced%20avocado%20panela%20cheese%20fresh%20lettuce%20tomato%20and%20chipotle%20sauce%20on%20toasted%20sourdough%20bread%20soft%20natural%20window%20light%20shallow%20depth%20of%20field%20appetizing%20warm%20cream%20and%20soft%20sage%20olive%20tones%20clean%20light%20neutral%20background%20editorial%20food%20styling%20high%20detail&width=800&height=800&seq=item-sandwich-pollo&orientation=squarish',
        nutrition: { calories: 520, protein: 32, carbs: 45, fat: 22 },
        allergens: ['Gluten', 'Lácteos', 'Huevo'],
      },
      {
        name: 'Sándwich Caprese',
        description: 'Tomate, mozzarella fresca, albahaca y reducción balsámica en ciabatta.',
        price: 'MXN 72',
        emoji: '🍅',
        image:
          'https://readdy.ai/api/search-image?query=Professional%20food%20photography%20of%20a%20caprese%20sandwich%20with%20fresh%20tomato%20slices%20creamy%20mozzarella%20basil%20leaves%20and%20balsamic%20glaze%20on%20ciabatta%20bread%20soft%20natural%20window%20light%20shallow%20depth%20of%20field%20appetizing%20warm%20cream%20and%20soft%20sage%20olive%20tones%20clean%20light%20neutral%20background%20editorial%20food%20styling%20high%20detail&width=800&height=800&seq=item-sandwich-caprese&orientation=squarish',
        nutrition: { calories: 480, protein: 18, carbs: 52, fat: 24 },
        allergens: ['Gluten', 'Lácteos'],
      },
      {
        name: 'Sándwich de Jamón Serrano',
        description: 'Jamón serrano, queso manchego y rúcula con un toque de aceite de oliva.',
        price: 'MXN 78',
        emoji: '🥖',
        image:
          'https://readdy.ai/api/search-image?query=Professional%20food%20photography%20of%20a%20serrano%20ham%20sandwich%20with%20manchego%20cheese%20and%20fresh%20arugula%20drizzled%20with%20olive%20oil%20on%20rustic%20baguette%20soft%20natural%20window%20light%20shallow%20depth%20of%20field%20appetizing%20warm%20cream%20and%20soft%20sage%20olive%20tones%20clean%20light%20neutral%20background%20editorial%20food%20styling%20high%20detail&width=800&height=800&seq=item-sandwich-serrano&orientation=squarish',
        nutrition: { calories: 540, protein: 28, carbs: 48, fat: 26 },
        allergens: ['Gluten', 'Lácteos'],
      },
    ],
  },
  {
    id: 'comida-rapida',
    title: 'Comida Rápida',
    subtitle: 'Clásicos reconfortantes, recién hechos y bien servidos.',
    image:
      'https://readdy.ai/api/search-image?query=Professional%20food%20photography%20of%20a%20fast%20food%20spread%20with%20a%20classic%20cheeseburger%20crispy%20golden%20french%20fries%20and%20a%20loaded%20hot%20dog%20on%20a%20wooden%20board%20soft%20natural%20window%20light%20shallow%20depth%20of%20field%20appetizing%20warm%20cream%20and%20soft%20sage%20olive%20tones%20clean%20light%20neutral%20background%20editorial%20food%20styling%20high%20detail&width=800&height=600&seq=cat-comida-rapida-01&orientation=landscape',
    items: [
      {
        name: 'Hamburguesa Clásica',
        description: 'Carne de res a la parrilla, queso americano, lechuga, tomate y salsa de la casa en pan brioche.',
        price: 'MXN 85',
        emoji: '🍔',
        image:
          'https://readdy.ai/api/search-image?query=Professional%20food%20photography%20of%20a%20classic%20cheeseburger%20with%20grilled%20beef%20patty%20melted%20american%20cheese%20lettuce%20tomato%20and%20house%20sauce%20on%20a%20brioche%20bun%20soft%20natural%20window%20light%20shallow%20depth%20of%20field%20appetizing%20warm%20cream%20and%20soft%20sage%20olive%20tones%20clean%20light%20neutral%20background%20editorial%20food%20styling%20high%20detail&width=800&height=800&seq=item-burger-clasica&orientation=squarish',
        nutrition: { calories: 650, protein: 30, carbs: 40, fat: 35 },
        allergens: ['Gluten', 'Lácteos', 'Huevo', 'Soya'],
      },
      {
        name: 'Hamburguesa de Pollo Crispy',
        description: 'Pechuga de pollo empanizada crujiente, queso, lechuga y aderezo ranch.',
        price: 'MXN 80',
        emoji: '🍗',
        image:
          'https://readdy.ai/api/search-image?query=Professional%20food%20photography%20of%20a%20crispy%20fried%20chicken%20sandwich%20with%20lettuce%20cheese%20and%20ranch%20dressing%20on%20a%20toasted%20bun%20soft%20natural%20window%20light%20shallow%20depth%20of%20field%20appetizing%20warm%20cream%20and%20soft%20sage%20olive%20tones%20clean%20light%20neutral%20background%20editorial%20food%20styling%20high%20detail&width=800&height=800&seq=item-burger-pollo&orientation=squarish',
        nutrition: { calories: 610, protein: 28, carbs: 42, fat: 32 },
        allergens: ['Gluten', 'Lácteos', 'Huevo'],
      },
      {
        name: 'Hot Dog Clásico',
        description: 'Salchicha de res, cebolla caramelizada, mostaza y catsup en pan suave.',
        price: 'MXN 55',
        emoji: '🌭',
        image:
          'https://readdy.ai/api/search-image?query=Professional%20food%20photography%20of%20a%20classic%20hot%20dog%20with%20beef%20sausage%20caramelized%20onions%20mustard%20and%20ketchup%20in%20a%20soft%20bun%20soft%20natural%20window%20light%20shallow%20depth%20of%20field%20appetizing%20warm%20cream%20and%20soft%20sage%20olive%20tones%20clean%20light%20neutral%20background%20editorial%20food%20styling%20high%20detail&width=800&height=800&seq=item-hotdog&orientation=squarish',
        nutrition: { calories: 480, protein: 16, carbs: 38, fat: 28 },
        allergens: ['Gluten', 'Soya'],
      },
      {
        name: 'Papas Fritas con Queso',
        description: 'Papas doradas y crujientes bañadas en queso cheddar fundido.',
        price: 'MXN 45',
        emoji: '🍟',
        image:
          'https://readdy.ai/api/search-image?query=Professional%20food%20photography%20of%20golden%20crispy%20french%20fries%20smothered%20in%20melted%20cheddar%20cheese%20in%20a%20paper%20cup%20soft%20natural%20window%20light%20shallow%20depth%20of%20field%20appetizing%20warm%20cream%20and%20soft%20sage%20olive%20tones%20clean%20light%20neutral%20background%20editorial%20food%20styling%20high%20detail&width=800&height=800&seq=item-papas&orientation=squarish',
        nutrition: { calories: 420, protein: 10, carbs: 38, fat: 24 },
        allergens: ['Lácteos'],
      },
    ],
  },
  {
    id: 'pastas',
    title: 'Pastas',
    subtitle: 'Recetas italianas con salsas caseras y porciones generosas.',
    image:
      'https://readdy.ai/api/search-image?query=Professional%20food%20photography%20of%20a%20rustic%20pasta%20spread%20with%20fettuccine%20alfredo%20and%20spaghetti%20bolognese%20in%20white%20bowls%20garnished%20with%20parmesan%20and%20basil%20soft%20natural%20window%20light%20shallow%20depth%20of%20field%20appetizing%20warm%20cream%20and%20soft%20sage%20olive%20tones%20clean%20light%20neutral%20background%20editorial%20food%20styling%20high%20detail&width=800&height=600&seq=cat-pastas-01&orientation=landscape',
    items: [
      {
        name: 'Fettuccine Alfredo con Pollo',
        description: 'Pasta fresca en crema de queso parmesano con tiras de pollo a la plancha.',
        price: 'MXN 95',
        emoji: '🍝',
        image:
          'https://readdy.ai/api/search-image?query=Professional%20food%20photography%20of%20fettuccine%20alfredo%20pasta%20with%20grilled%20chicken%20strips%20and%20creamy%20parmesan%20sauce%20garnished%20with%20parsley%20in%20a%20white%20bowl%20soft%20natural%20window%20light%20shallow%20depth%20of%20field%20appetizing%20warm%20cream%20and%20soft%20sage%20olive%20tones%20clean%20light%20neutral%20background%20editorial%20food%20styling%20high%20detail&width=800&height=800&seq=item-pasta-alfredo&orientation=squarish',
        nutrition: { calories: 720, protein: 35, carbs: 60, fat: 38 },
        allergens: ['Gluten', 'Lácteos'],
      },
      {
        name: 'Espagueti a la Boloñesa',
        description: 'Salsa de carne molida de res cocida a fuego lento con tomate y especias.',
        price: 'MXN 88',
        emoji: '🍝',
        image:
          'https://readdy.ai/api/search-image?query=Professional%20food%20photography%20of%20spaghetti%20bolognese%20with%20rich%20beef%20tomato%20sauce%20and%20grated%20parmesan%20on%20top%20in%20a%20rustic%20bowl%20soft%20natural%20window%20light%20shallow%20depth%20of%20field%20appetizing%20warm%20cream%20and%20soft%20sage%20olive%20tones%20clean%20light%20neutral%20background%20editorial%20food%20styling%20high%20detail&width=800&height=800&seq=item-pasta-bolonesa&orientation=squarish',
        nutrition: { calories: 680, protein: 32, carbs: 65, fat: 30 },
        allergens: ['Gluten'],
      },
      {
        name: 'Pasta al Pesto',
        description: 'Penne con pesto de albahaca, piñones y queso parmesano.',
        price: 'MXN 82',
        emoji: '🌿',
        image:
          'https://readdy.ai/api/search-image?query=Professional%20food%20photography%20of%20penne%20pasta%20tossed%20in%20fresh%20basil%20pesto%20with%20pine%20nuts%20and%20shaved%20parmesan%20soft%20natural%20window%20light%20shallow%20depth%20of%20field%20appetizing%20warm%20cream%20and%20soft%20sage%20olive%20tones%20clean%20light%20neutral%20background%20editorial%20food%20styling%20high%20detail&width=800&height=800&seq=item-pasta-pesto&orientation=squarish',
        nutrition: { calories: 640, protein: 22, carbs: 62, fat: 34 },
        allergens: ['Gluten', 'Lácteos', 'Frutos secos'],
      },
      {
        name: 'Pasta Primavera',
        description: 'Fusilli con verduras salteadas de temporada y un toque de aceite de oliva.',
        price: 'MXN 76',
        emoji: '🥦',
        image:
          'https://readdy.ai/api/search-image?query=Professional%20food%20photography%20of%20fusilli%20pasta%20primavera%20with%20sauteed%20seasonal%20vegetables%20zucchini%20bell%20pepper%20and%20cherry%20tomatoes%20soft%20natural%20window%20light%20shallow%20depth%20of%20field%20appetizing%20warm%20cream%20and%20soft%20sage%20olive%20tones%20clean%20light%20neutral%20background%20editorial%20food%20styling%20high%20detail&width=800&height=800&seq=item-pasta-primavera&orientation=squarish',
        nutrition: { calories: 520, protein: 16, carbs: 58, fat: 22 },
        allergens: ['Gluten'],
      },
    ],
  },
  {
    id: 'chilaquiles',
    title: 'Chilaquiles',
    subtitle: 'Totopos bañados en salsa, queso, crema y cebolla fresca.',
    image:
      'https://readdy.ai/api/search-image?query=Professional%20food%20photography%20of%20mexican%20chilaquiles%20with%20green%20and%20red%20salsa%20topped%20with%20cream%20crumbled%20cheese%20onion%20and%20a%20fried%20egg%20on%20a%20rustic%20plate%20soft%20natural%20window%20light%20shallow%20depth%20of%20field%20appetizing%20warm%20cream%20and%20soft%20sage%20olive%20tones%20clean%20light%20neutral%20background%20editorial%20food%20styling%20high%20detail&width=800&height=600&seq=cat-chilaquiles-01&orientation=landscape',
    items: [
      {
        name: 'Chilaquiles Verdes',
        description: 'Totopos en salsa verde de tomatillo, crema, queso fresco y cebolla.',
        price: 'MXN 65',
        emoji: '🥘',
        image:
          'https://readdy.ai/api/search-image?query=Professional%20food%20photography%20of%20chilaquiles%20verdes%20with%20green%20tomatillo%20salsa%20topped%20with%20crema%20crumbled%20queso%20fresco%20and%20sliced%20onion%20soft%20natural%20window%20light%20shallow%20depth%20of%20field%20appetizing%20warm%20cream%20and%20soft%20sage%20olive%20tones%20clean%20light%20neutral%20background%20editorial%20food%20styling%20high%20detail&width=800&height=800&seq=item-chilaquiles-verdes&orientation=squarish',
        nutrition: { calories: 580, protein: 18, carbs: 60, fat: 30 },
        allergens: ['Gluten', 'Lácteos'],
      },
      {
        name: 'Chilaquiles Rojos',
        description: 'Totopos en salsa roja de chile guajillo, crema, queso y aguacate.',
        price: 'MXN 65',
        emoji: '🌶️',
        image:
          'https://readdy.ai/api/search-image?query=Professional%20food%20photography%20of%20chilaquiles%20rojos%20with%20red%20guajillo%20salsa%20topped%20with%20crema%20crumbled%20cheese%20onion%20and%20avocado%20slices%20soft%20natural%20window%20light%20shallow%20depth%20of%20field%20appetizing%20warm%20cream%20and%20soft%20sage%20olive%20tones%20clean%20light%20neutral%20background%20editorial%20food%20styling%20high%20detail&width=800&height=800&seq=item-chilaquiles-rojos&orientation=squarish',
        nutrition: { calories: 600, protein: 20, carbs: 62, fat: 32 },
        allergens: ['Gluten', 'Lácteos'],
      },
      {
        name: 'Chilaquiles Divorciados',
        description: 'Mitad salsa verde, mitad salsa roja, con pollo deshebrado y huevo.',
        price: 'MXN 85',
        emoji: '🍳',
        image:
          'https://readdy.ai/api/search-image?query=Professional%20food%20photography%20of%20divorced%20chilaquiles%20half%20green%20half%20red%20salsa%20with%20shredded%20chicken%20a%20fried%20egg%20cream%20and%20cheese%20soft%20natural%20window%20light%20shallow%20depth%20of%20field%20appetizing%20warm%20cream%20and%20soft%20sage%20olive%20tones%20clean%20light%20neutral%20background%20editorial%20food%20styling%20high%20detail&width=800&height=800&seq=item-chilaquiles-divorciados&orientation=squarish',
        nutrition: { calories: 640, protein: 24, carbs: 64, fat: 34 },
        allergens: ['Gluten', 'Lácteos', 'Huevo'],
      },
    ],
  },
  {
    id: 'bebidas',
    title: 'Bebidas',
    subtitle: 'Café de especialidad y sabores para acompañar cada antojo.',
    image:
      'https://readdy.ai/api/search-image?query=Professional%20food%20photography%20of%20specialty%20coffee%20with%20latte%20art%20and%20hot%20chocolate%20with%20whipped%20cream%20on%20a%20rustic%20wooden%20table%20soft%20natural%20window%20light%20shallow%20depth%20of%20field%20appetizing%20warm%20cream%20and%20soft%20sage%20olive%20tones%20clean%20light%20neutral%20background%20editorial%20food%20styling%20high%20detail&width=800&height=600&seq=cat-drinks-01&orientation=landscape&nocache=true',
    items: [
      {
        name: 'Café de Especialidad',
        description: 'Un shot de espresso con leche vaporizada y latte art.',
        price: 'MXN 30',
        emoji: '☕',
        image:
          'https://readdy.ai/api/search-image?query=Professional%20food%20photography%20of%20a%20specialty%20latte%20with%20beautiful%20latte%20art%20in%20a%20ceramic%20cup%20on%20a%20saucer%20soft%20natural%20window%20light%20shallow%20depth%20of%20field%20appetizing%20warm%20cream%20and%20soft%20sage%20olive%20tones%20clean%20light%20neutral%20background%20editorial%20food%20styling%20high%20detail&width=800&height=800&seq=item-cafe&orientation=squarish',
        nutrition: { calories: 30, protein: 2, carbs: 3, fat: 2 },
        allergens: ['Lácteos'],
      },
      {
        name: 'Capuchino Clásico',
        description: 'Espresso, leche cremosa y espuma densa con un toque de canela.',
        price: 'MXN 35',
        emoji: '☕',
        image:
          'https://readdy.ai/api/search-image?query=Professional%20food%20photography%20of%20a%20classic%20cappuccino%20with%20dense%20milk%20foam%20and%20a%20dusting%20of%20cinnamon%20in%20a%20white%20ceramic%20cup%20soft%20natural%20window%20light%20shallow%20depth%20of%20field%20appetizing%20warm%20cream%20and%20soft%20sage%20olive%20tones%20clean%20light%20neutral%20background%20editorial%20food%20styling%20high%20detail&width=800&height=800&seq=item-capuchino&orientation=squarish',
        nutrition: { calories: 90, protein: 5, carbs: 8, fat: 5 },
        allergens: ['Lácteos'],
      },
      {
        name: 'Chocolate Caliente Artesanal',
        description: 'Cacao real con leche y un toque de canela.',
        price: 'MXN 40',
        emoji: '🍫',
        image:
          'https://readdy.ai/api/search-image?query=Professional%20food%20photography%20of%20an%20artisan%20hot%20chocolate%20with%20whipped%20cream%20and%20a%20dusting%20of%20cinnamon%20in%20a%20ceramic%20cup%20soft%20natural%20window%20light%20shallow%20depth%20of%20field%20appetizing%20warm%20cream%20and%20soft%20sage%20olive%20tones%20clean%20light%20neutral%20background%20editorial%20food%20styling%20high%20detail&width=800&height=800&seq=item-chocolate-caliente&orientation=squarish',
        nutrition: { calories: 220, protein: 8, carbs: 30, fat: 9 },
        allergens: ['Lácteos'],
      },
      {
        name: 'Té Chai Latte',
        description: 'Té negro con especias, leche vaporizada y un toque de miel.',
        price: 'MXN 38',
        emoji: '🍵',
        image:
          'https://readdy.ai/api/search-image?query=Professional%20food%20photography%20of%20a%20chai%20tea%20latte%20with%20steamed%20milk%20and%20cinnamon%20stick%20in%20a%20glass%20mug%20soft%20natural%20window%20light%20shallow%20depth%20of%20field%20appetizing%20warm%20cream%20and%20soft%20sage%20olive%20tones%20clean%20light%20neutral%20background%20editorial%20food%20styling%20high%20detail&width=800&height=800&seq=item-te-chai&orientation=squarish',
        nutrition: { calories: 140, protein: 4, carbs: 22, fat: 4 },
        allergens: ['Lácteos'],
      },
      {
        name: 'Agua de Horchata',
        description: 'Arroz, canela y vainilla, cremosa y naturalmente dulce.',
        price: 'MXN 28',
        emoji: '🥛',
        image:
          'https://readdy.ai/api/search-image?query=Professional%20food%20photography%20of%20a%20refreshing%20glass%20of%20horchata%20rice%20cinnamon%20and%20vanilla%20drink%20with%20a%20cinnamon%20stick%20soft%20natural%20window%20light%20shallow%20depth%20of%20field%20appetizing%20warm%20cream%20and%20soft%20sage%20olive%20tones%20clean%20light%20neutral%20background%20editorial%20food%20styling%20high%20detail&width=800&height=800&seq=item-horchata&orientation=squarish',
        nutrition: { calories: 180, protein: 2, carbs: 38, fat: 3 },
        allergens: ['Frutos secos'],
      },
      {
        name: 'Agua de Jamaica',
        description: 'Flor de jamaica infusionada, refrescante y ligeramente ácida.',
        price: 'MXN 26',
        emoji: '🍷',
        image:
          'https://readdy.ai/api/search-image?query=Professional%20food%20photography%20of%20a%20glass%20of%20hibiscus%20jamaica%20agua%20fresca%20deep%20red%20with%20ice%20and%20a%20lime%20slice%20soft%20natural%20window%20light%20shallow%20depth%20of%20field%20appetizing%20warm%20cream%20and%20soft%20sage%20olive%20tones%20clean%20light%20neutral%20background%20editorial%20food%20styling%20high%20detail&width=800&height=800&seq=item-jamaica&orientation=squarish',
        nutrition: { calories: 90, protein: 0, carbs: 22, fat: 0 },
        allergens: [],
      },
    ],
  },
  {
    id: 'smoothies',
    title: 'Smoothies',
    subtitle: 'Frutas frescas, energía para tu día.',
    image:
      'https://readdy.ai/api/search-image?query=Professional%20food%20photography%20of%20colorful%20fresh%20fruit%20smoothies%20in%20tall%20glasses%20with%20strawberry%20banana%20mango%20and%20green%20detox%20blends%20soft%20natural%20window%20light%20shallow%20depth%20of%20field%20appetizing%20warm%20cream%20and%20soft%20sage%20olive%20tones%20clean%20light%20neutral%20background%20editorial%20food%20styling%20high%20detail&width=800&height=600&seq=cat-smoothie-01&orientation=landscape&nocache=true',
    items: [
      {
        name: 'Smoothie Fresa y Plátano',
        description: 'Fresa, plátano, yogur natural y un toque de miel.',
        price: 'MXN 45',
        emoji: '🍓',
        image:
          'https://readdy.ai/api/search-image?query=Professional%20food%20photography%20of%20a%20strawberry%20banana%20smoothie%20in%20a%20tall%20glass%20topped%20with%20fresh%20strawberry%20soft%20natural%20window%20light%20shallow%20depth%20of%20field%20appetizing%20warm%20cream%20and%20soft%20sage%20olive%20tones%20clean%20light%20neutral%20background%20editorial%20food%20styling%20high%20detail&width=800&height=800&seq=item-smoothie-fresa-platano&orientation=squarish',
        nutrition: { calories: 180, protein: 5, carbs: 38, fat: 2 },
        allergens: ['Lácteos'],
      },
      {
        name: 'Smoothie Verde Detox',
        description: 'Espinaca, manzana verde, apio, piña y jengibre.',
        price: 'MXN 48',
        emoji: '🥬',
        image:
          'https://readdy.ai/api/search-image?query=Professional%20food%20photography%20of%20a%20green%20detox%20smoothie%20with%20spinach%20apple%20celery%20pineapple%20and%20ginger%20in%20a%20tall%20glass%20garnished%20with%20fresh%20mint%20soft%20natural%20window%20light%20shallow%20depth%20of%20field%20appetizing%20warm%20cream%20and%20soft%20sage%20olive%20tones%20clean%20light%20neutral%20background%20editorial%20food%20styling%20high%20detail&width=800&height=800&seq=item-smoothie-verde&orientation=squarish',
        nutrition: { calories: 140, protein: 3, carbs: 30, fat: 1 },
        allergens: [],
      },
      {
        name: 'Smoothie de Mango',
        description: 'Mango, naranja y coco, cremoso y refrescante.',
        price: 'MXN 46',
        emoji: '🥭',
        image:
          'https://readdy.ai/api/search-image?query=Professional%20food%20photography%20of%20a%20creamy%20mango%20smoothie%20with%20orange%20and%20coconut%20in%20a%20tall%20glass%20topped%20with%20mango%20chunks%20soft%20natural%20window%20light%20shallow%20depth%20of%20field%20appetizing%20warm%20cream%20and%20soft%20sage%20olive%20tones%20clean%20light%20neutral%20background%20editorial%20food%20styling%20high%20detail&width=800&height=800&seq=item-smoothie-mango&orientation=squarish',
        nutrition: { calories: 190, protein: 4, carbs: 42, fat: 2 },
        allergens: ['Lácteos', 'Coco'],
      },
    ],
  },
  {
    id: 'cheesecakes',
    title: 'Cheesecakes',
    subtitle: 'Cremosos, caseros y horneados cada mañana.',
    image:
      'https://readdy.ai/api/search-image?query=Professional%20food%20photography%20of%20a%20creamy%20cheesecake%20slice%20with%20fresh%20berries%20on%20a%20white%20plate%20soft%20natural%20window%20light%20shallow%20depth%20of%20field%20appetizing%20warm%20cream%20and%20soft%20sage%20olive%20tones%20clean%20light%20neutral%20background%20editorial%20food%20styling%20high%20detail&width=800&height=600&seq=cat-cheesecake-01&orientation=landscape&nocache=true',
    items: [
      {
        name: 'Cheesecake de Fresa Clásico',
        description: 'Base de galleta, crema de queso y fresas frescas glaseadas.',
        price: 'MXN 55',
        emoji: '🍰',
        image:
          'https://readdy.ai/api/search-image?query=Professional%20food%20photography%20of%20a%20classic%20strawberry%20cheesecake%20slice%20with%20fresh%20glazed%20strawberries%20on%20a%20white%20plate%20soft%20natural%20window%20light%20shallow%20depth%20of%20field%20appetizing%20warm%20cream%20and%20soft%20sage%20olive%20tones%20clean%20light%20neutral%20background%20editorial%20food%20styling%20high%20detail&width=800&height=800&seq=item-cheesecake-fresa&orientation=squarish',
        nutrition: { calories: 380, protein: 6, carbs: 38, fat: 22 },
        allergens: ['Gluten', 'Lácteos', 'Huevo'],
      },
      {
        name: 'Cheesecake de Maracuyá',
        description: 'Cremoso con un toque cítrico de maracuyá y ralladura de limón.',
        price: 'MXN 58',
        emoji: '🍋',
        image:
          'https://readdy.ai/api/search-image?query=Professional%20food%20photography%20of%20a%20passion%20fruit%20cheesecake%20slice%20with%20glossy%20yellow%20passion%20fruit%20glaze%20and%20lemon%20zest%20soft%20natural%20window%20light%20shallow%20depth%20of%20field%20appetizing%20warm%20cream%20and%20soft%20sage%20olive%20tones%20clean%20light%20neutral%20background%20editorial%20food%20styling%20high%20detail&width=800&height=800&seq=item-cheesecake-maracuya&orientation=squarish',
        nutrition: { calories: 360, protein: 6, carbs: 36, fat: 20 },
        allergens: ['Gluten', 'Lácteos', 'Huevo'],
      },
      {
        name: 'Cheesecake de Oreo',
        description: 'Chocolate y galleta Oreo en cada capa, irresistible.',
        price: 'MXN 52',
        emoji: '🍫',
        image:
          'https://readdy.ai/api/search-image?query=Professional%20food%20photography%20of%20an%20Oreo%20chocolate%20cheesecake%20slice%20with%20cookie%20crust%20and%20chocolate%20ganache%20topped%20with%20a%20whole%20Oreo%20cookie%20soft%20natural%20window%20light%20shallow%20depth%20of%20field%20appetizing%20warm%20cream%20and%20soft%20sage%20olive%20tones%20clean%20light%20neutral%20background%20editorial%20food%20styling%20high%20detail&width=800&height=800&seq=item-cheesecake-oreo&orientation=squarish',
        nutrition: { calories: 420, protein: 7, carbs: 42, fat: 24 },
        allergens: ['Gluten', 'Lácteos', 'Huevo', 'Soya'],
      },
    ],
  },
  {
    id: 'pasteles',
    title: 'Rebanadas de Pastel',
    subtitle: 'Postres por rebanada, perfectos para compartir (o no).',
    image:
      'https://readdy.ai/api/search-image?query=Professional%20food%20photography%20of%20assorted%20cake%20slices%20chocolate%20carrot%20and%20red%20velvet%20on%20white%20plates%20with%20fresh%20fruit%20garnish%20soft%20natural%20window%20light%20shallow%20depth%20of%20field%20appetizing%20warm%20cream%20and%20soft%20sage%20olive%20tones%20clean%20light%20neutral%20background%20editorial%20food%20styling%20high%20detail&width=800&height=600&seq=cat-pasteles-01&orientation=landscape',
    items: [
      {
        name: 'Rebanada de Pastel de Chocolate',
        description: 'Bizcocho húmedo de chocolate con ganache cremoso.',
        price: 'MXN 50',
        emoji: '🍰',
        image:
          'https://readdy.ai/api/search-image?query=Professional%20food%20photography%20of%20a%20slice%20of%20rich%20chocolate%20cake%20with%20creamy%20ganache%20layers%20on%20a%20white%20plate%20soft%20natural%20window%20light%20shallow%20depth%20of%20field%20appetizing%20warm%20cream%20and%20soft%20sage%20olive%20tones%20clean%20light%20neutral%20background%20editorial%20food%20styling%20high%20detail&width=800&height=800&seq=item-pastel-chocolate&orientation=squarish',
        nutrition: { calories: 450, protein: 6, carbs: 55, fat: 24 },
        allergens: ['Gluten', 'Lácteos', 'Huevo'],
      },
      {
        name: 'Rebanada de Pastel de Zanahoria',
        description: 'Zanahoria, nuez y betún de queso crema.',
        price: 'MXN 52',
        emoji: '🥕',
        image:
          'https://readdy.ai/api/search-image?query=Professional%20food%20photography%20of%20a%20slice%20of%20carrot%20cake%20with%20walnuts%20and%20cream%20cheese%20frosting%20on%20a%20white%20plate%20soft%20natural%20window%20light%20shallow%20depth%20of%20field%20appetizing%20warm%20cream%20and%20soft%20sage%20olive%20tones%20clean%20light%20neutral%20background%20editorial%20food%20styling%20high%20detail&width=800&height=800&seq=item-pastel-zanahoria&orientation=squarish',
        nutrition: { calories: 410, protein: 5, carbs: 48, fat: 22 },
        allergens: ['Gluten', 'Lácteos', 'Huevo', 'Frutos secos'],
      },
      {
        name: 'Rebanada de Pastel Red Velvet',
        description: 'Terciopelo rojo con betún de queso crema y migas.',
        price: 'MXN 54',
        emoji: '❤️',
        image:
          'https://readdy.ai/api/search-image?query=Professional%20food%20photography%20of%20a%20slice%20of%20red%20velvet%20cake%20with%20cream%20cheese%20frosting%20and%20red%20crumbs%20on%20a%20white%20plate%20soft%20natural%20window%20light%20shallow%20depth%20of%20field%20appetizing%20warm%20cream%20and%20soft%20sage%20olive%20tones%20clean%20light%20neutral%20background%20editorial%20food%20styling%20high%20detail&width=800&height=800&seq=item-pastel-redvelvet&orientation=squarish',
        nutrition: { calories: 430, protein: 5, carbs: 52, fat: 22 },
        allergens: ['Gluten', 'Lácteos', 'Huevo'],
      },
    ],
  },
  {
    id: 'galletas',
    title: 'Galletas',
    subtitle: 'Horneadas cada mañana, suaves por dentro y crujientes por fuera.',
    image:
      'https://readdy.ai/api/search-image?query=Professional%20food%20photography%20of%20assorted%20gourmet%20cookies%20chocolate%20chip%20oatmeal%20raisin%20and%20macadamia%20stacked%20on%20a%20wooden%20board%20soft%20natural%20window%20light%20shallow%20depth%20of%20field%20appetizing%20warm%20cream%20and%20soft%20sage%20olive%20tones%20clean%20light%20neutral%20background%20editorial%20food%20styling%20high%20detail&width=800&height=600&seq=cat-galletas-01&orientation=landscape',
    items: [
      {
        name: 'Galleta de Chispas de Chocolate',
        description: 'Masa suave con chispas de chocolate semiamargo.',
        price: 'MXN 25',
        emoji: '🍪',
        image:
          'https://readdy.ai/api/search-image?query=Professional%20food%20photography%20of%20a%20soft%20chocolate%20chip%20cookie%20with%20melty%20semisweet%20chocolate%20chunks%20on%20parchment%20paper%20soft%20natural%20window%20light%20shallow%20depth%20of%20field%20appetizing%20warm%20cream%20and%20soft%20sage%20olive%20tones%20clean%20light%20neutral%20background%20editorial%20food%20styling%20high%20detail&width=800&height=800&seq=item-galleta-chispas&orientation=squarish',
        nutrition: { calories: 220, protein: 3, carbs: 30, fat: 11 },
        allergens: ['Gluten', 'Lácteos', 'Huevo'],
      },
      {
        name: 'Galleta de Avena con Pasas',
        description: 'Avena, pasas y un toque de canela, reconfortante.',
        price: 'MXN 22',
        emoji: '🥣',
        image:
          'https://readdy.ai/api/search-image?query=Professional%20food%20photography%20of%20an%20oatmeal%20raisin%20cookie%20with%20golden%20edges%20and%20cinnamon%20on%20parchment%20paper%20soft%20natural%20window%20light%20shallow%20depth%20of%20field%20appetizing%20warm%20cream%20and%20soft%20sage%20olive%20tones%20clean%20light%20neutral%20background%20editorial%20food%20styling%20high%20detail&width=800&height=800&seq=item-galleta-avena&orientation=squarish',
        nutrition: { calories: 190, protein: 3, carbs: 32, fat: 7 },
        allergens: ['Gluten', 'Lácteos', 'Huevo'],
      },
      {
        name: 'Galleta de Macadamia',
        description: 'Nuez de macadamia y chocolate blanco, indulgente.',
        price: 'MXN 28',
        emoji: '🌰',
        image:
          'https://readdy.ai/api/search-image?query=Professional%20food%20photography%20of%20a%20macadamia%20nut%20and%20white%20chocolate%20cookie%20with%20golden%20brown%20edges%20on%20parchment%20paper%20soft%20natural%20window%20light%20shallow%20depth%20of%20field%20appetizing%20warm%20cream%20and%20soft%20sage%20olive%20tones%20clean%20light%20neutral%20background%20editorial%20food%20styling%20high%20detail&width=800&height=800&seq=item-galleta-macadamia&orientation=squarish',
        nutrition: { calories: 240, protein: 3, carbs: 28, fat: 13 },
        allergens: ['Gluten', 'Lácteos', 'Huevo', 'Frutos secos'],
      },
    ],
  },
];