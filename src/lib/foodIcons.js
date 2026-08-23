// Icone immagine per alimento, stesso schema delle icone esercizio (vedi
// exerciseIcons.js) — file statici in public/food-icons/{slug}.{ext}, fallback
// automatico all'emoji finché l'immagine non esiste (vedi FoodIcon.jsx).
import { slugifyFoodName } from './nutritionStats'

const ICON_EXTENSIONS = ['png', 'jpg', 'jpeg']

export function getFoodIconPaths(food) {
  const slug = slugifyFoodName(food?.name)
  if (!slug) return []
  return ICON_EXTENSIONS.map(ext => `${import.meta.env.BASE_URL}food-icons/${slug}.${ext}`)
}
