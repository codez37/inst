function detectLanguage(text) {
  const persianRegex = /[\u0600-\u06FF]/;
  return persianRegex.test(text) ? 'fa' : 'en';
}

function translate(key, lang = 'fa') {
  const translations = {
    fa: {
      welcome: 'سلام! من دستیار مالیاتی شما هستم.',
      help: 'برای محاسبه مالیات، فقط کافیه درآمدتون رو بنویسید.'
    },
    en: {
      welcome: 'Hello! I am your tax assistant.',
      help: 'Just write your income to calculate the tax.'
    }
  };

  return translations[lang][key] || key;
}

module.exports = { detectLanguage, translate };