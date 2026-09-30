import categoriesDb from '../db/categories';

export async function buildCategorySuggestions(limit = 3) {
  // returns top categories to suggest in notifications
  return categoriesDb.topCategories(limit);
}

export default { buildCategorySuggestions };
