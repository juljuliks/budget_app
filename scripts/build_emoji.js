// Builds src/shared/ui/emoji/emoji.json from emojibase-data (Unicode / CLDR): every emoji the picker offers, in the phone
// keyboard's groups and order, with Russian and English names and tags to search by. Skin tones and the
// "component" group are left out. Run after updating emojibase-data: node scripts/build_emoji.js
const fs = require('fs');
const path = require('path');

const en = require('emojibase-data/en/data.json');
const ru = new Map(require('emojibase-data/ru/compact.json').map((e) => [e.hexcode, e]));

const COMPONENT = 2;
// words people look for when naming a spending category that CLDR doesn't have in Russian: emoji -> extra words
const EXTRA_RU = {
  '☕': 'кафе кофейня капучино латте',
  '🍽️': 'ресторан кафе обед ужин еда',
  '🍴': 'ресторан кафе еда обед',
  '🛒': 'продукты супермаркет магазин покупки еда',
  '🛍️': 'покупки шопинг магазин одежда',
  '🏠': 'квартира аренда жильё дом коммуналка',
  '🏡': 'дом квартира жильё',
  '🔑': 'аренда квартира ключи',
  '💡': 'коммуналка свет электричество',
  '💧': 'вода коммуналка',
  '🔥': 'газ отопление коммуналка',
  '📶': 'интернет связь вайфай',
  '📱': 'телефон связь мобильный',
  '📺': 'подписки телевизор кино нетфликс',
  '🎬': 'кино фильмы подписки',
  '🎵': 'музыка подписки спотифай',
  '💊': 'аптека лекарства здоровье',
  '⚕️': 'здоровье врач медицина аптека',
  '🦷': 'стоматолог зубы врач',
  '🏋️': 'спорт зал фитнес тренировки',
  '🚕': 'такси убер болт',
  '🚌': 'транспорт автобус проезд',
  '🚇': 'метро транспорт проезд',
  '⛽': 'бензин заправка топливо машина',
  '✈️': 'путешествия самолёт перелёт билеты отпуск',
  '🧳': 'путешествия отпуск багаж',
  '🏨': 'отель гостиница путешествия',
  '🍺': 'бар пиво',
  '🍷': 'бар вино',
  '🍸': 'бар коктейль',
  '🎁': 'подарки подарок',
  '👗': 'одежда платье',
  '👕': 'одежда футболка',
  '👟': 'обувь кроссовки одежда',
  '💇': 'парикмахер стрижка красота',
  '💅': 'маникюр красота',
  '🐶': 'собака питомец животные',
  '🐱': 'кошка питомец животные',
  '🎮': 'игры развлечения',
  '🎓': 'образование учёба курсы',
  '📚': 'книги учёба образование',
  '👶': 'дети ребёнок',
  '💰': 'деньги сбережения накопления',
  '🏦': 'банк кредит ипотека',
  '💳': 'карта кредит банк',
  '🔁': 'переводы перевод',
  '🔖': 'другое разное прочее',
  '🎉': 'праздник развлечения вечеринка',
  '🚗': 'машина авто',
  '🅿️': 'парковка машина',
  '🧾': 'счета чек налоги',
};
const extraOf = (emoji) => EXTRA_RU[emoji] || EXTRA_RU[emoji.replace(/\uFE0F/g, '')] || '';
const out = en
  .filter((e) => e.group !== undefined && e.group !== COMPONENT)
  .sort((a, b) => a.order - b.order)
  .map((e) => {
    const r = ru.get(e.hexcode);
    const words = [e.label, ...(e.tags || []), r?.label, ...(r?.tags || []), extraOf(e.emoji)].filter(Boolean).join(' ').toLowerCase();
    // [emoji, group, emoji version, search words]
    return [e.emoji, e.group, e.version, words];
  });

const file = path.join(__dirname, '..', 'src', 'shared', 'ui', 'emoji', 'emoji.json');
fs.mkdirSync(path.dirname(file), { recursive: true });
fs.writeFileSync(file, JSON.stringify(out));
console.log(`${out.length} emoji -> ${path.relative(process.cwd(), file)} (${Math.round(fs.statSync(file).size / 1024)} KB)`);
