const logger = require('./logger');
const { formatPersianNumber, convertToPersianDigits } = require('./utils');

// نرخ‌های مالیاتی سال 1403
const TAX_BRACKETS_1403 = [
  { min: 0, max: 5_000_000, rate: 0, description: 'معاف از مالیات' },
  { min: 5_000_000, max: 10_000_000, rate: 0.1, description: '10 درصد' },
  { min: 10_000_000, max: 20_000_000, rate: 0.2, description: '20 درصد' },
  { min: 20_000_000, max: Infinity, rate: 0.3, description: '30 درصد' }
];

// معافیت‌های مالیاتی
const TAX_EXEMPTIONS = {
  personal: 5_000_000, // معافیت شخصی
  spouse: 2_000_000,   // معافیت همسر
  child: 1_000_000,    // معافیت هر فرزند
  elderly: 1_500_000,  // معافیت سالمندی
  disability: 3_000_000 // معافیت معلولیت
};

/**
 * محاسبه مالیات درآمد اشخاص حقیقی
 * @param {number} income - درآمد سالانه
 * @param {object} options - تنظیمات اضافی
 * @returns {object} نتیجه محاسبه مالیات
 */
function calculateIncomeTax(income, options = {}) {
  try {
    // اعتبارسنجی ورودی
    if (!income || income < 0) {
      throw new Error('درآمد باید عددی مثبت باشد');
    }

    const {
      hasSpouse = false,
      childrenCount = 0,
      isElderly = false,
      hasDisability = false,
      additionalExemptions = 0
    } = options;

    // محاسبه کل معافیت‌ها
    let totalExemptions = TAX_EXEMPTIONS.personal;
    
    if (hasSpouse) totalExemptions += TAX_EXEMPTIONS.spouse;
    if (childrenCount > 0) totalExemptions += (childrenCount * TAX_EXEMPTIONS.child);
    if (isElderly) totalExemptions += TAX_EXEMPTIONS.elderly;
    if (hasDisability) totalExemptions += TAX_EXEMPTIONS.disability;
    if (additionalExemptions > 0) totalExemptions += additionalExemptions;

    // درآمد مشمول مالیات
    const taxableIncome = Math.max(0, income - totalExemptions);
    
    // محاسبه مالیات
    let tax = 0;
    let taxBreakdown = [];

    for (const bracket of TAX_BRACKETS_1403) {
      if (taxableIncome > bracket.min) {
        const taxableInThisBracket = Math.min(
          taxableIncome - bracket.min,
          bracket.max - bracket.min
        );
        
        const taxInThisBracket = taxableInThisBracket * bracket.rate;
        tax += taxInThisBracket;
        
        if (taxInThisBracket > 0) {
          taxBreakdown.push({
            range: `${formatPersianNumber(bracket.min)} تا ${bracket.max === Infinity ? 'بالاتر' : formatPersianNumber(bracket.max)}`,
            rate: `${bracket.rate * 100}%`,
            taxableAmount: formatPersianNumber(taxableInThisBracket),
            taxAmount: formatPersianNumber(Math.round(taxInThisBracket)),
            description: bracket.description
          });
        }
      }
    }

    const result = {
      grossIncome: formatPersianNumber(income),
      totalExemptions: formatPersianNumber(totalExemptions),
      taxableIncome: formatPersianNumber(taxableIncome),
      totalTax: formatPersianNumber(Math.round(tax)),
      netIncome: formatPersianNumber(income - Math.round(tax)),
      effectiveRate: taxableIncome > 0 ? `${((tax / taxableIncome) * 100).toFixed(2)}%` : '0%',
      marginalRate: getMarginalRate(taxableIncome),
      taxBreakdown,
      exemptionDetails: {
        personal: formatPersianNumber(TAX_EXEMPTIONS.personal),
        spouse: hasSpouse ? formatPersianNumber(TAX_EXEMPTIONS.spouse) : '0',
        children: childrenCount > 0 ? formatPersianNumber(childrenCount * TAX_EXEMPTIONS.child) : '0',
        elderly: isElderly ? formatPersianNumber(TAX_EXEMPTIONS.elderly) : '0',
        disability: hasDisability ? formatPersianNumber(TAX_EXEMPTIONS.disability) : '0',
        additional: additionalExemptions > 0 ? formatPersianNumber(additionalExemptions) : '0'
      }
    };

    // لاگ محاسبه
    logger.logTaxCalculation('system', income, Math.round(tax));

    return result;

  } catch (error) {
    logger.error('Error in tax calculation:', error.message);
    throw error;
  }
}

/**
 * محاسبه مالیات حقوق (ماهانه)
 * @param {number} monthlySalary - حقوق ماهانه
 * @param {object} options - تنظیمات اضافی
 * @returns {object} نتیجه محاسبه مالیات ماهانه
 */
function calculateSalaryTax(monthlySalary, options = {}) {
  const annualSalary = monthlySalary * 12;
  const annualResult = calculateIncomeTax(annualSalary, options);
  
  const monthlyTax = Math.round(parseFloat(annualResult.totalTax.replace(/,/g, '')) / 12);
  const monthlyNet = monthlySalary - monthlyTax;

  return {
    monthlySalary: formatPersianNumber(monthlySalary),
    monthlyTax: formatPersianNumber(monthlyTax),
    monthlyNet: formatPersianNumber(monthlyNet),
    annualDetails: annualResult
  };
}

/**
 * محاسبه مالیات شرکت
 * @param {number} profit - سود شرکت
 * @param {string} companyType - نوع شرکت
 * @returns {object} نتیجه محاسبه مالیات شرکت
 */
function calculateCorporateTax(profit, companyType = 'general') {
  const rates = {
    general: 0.25,      // شرکت‌های عادی
    small: 0.20,        // شرکت‌های کوچک
    startup: 0.10,      // استارتاپ‌ها
    cooperative: 0.15   // تعاونی‌ها
  };

  const rate = rates[companyType] || rates.general;
  const tax = profit * rate;

  return {
    profit: formatPersianNumber(profit),
    rate: `${rate * 100}%`,
    tax: formatPersianNumber(Math.round(tax)),
    netProfit: formatPersianNumber(profit - Math.round(tax)),
    companyType
  };
}

/**
 * محاسبه مالیات بر ارزش افزوده (VAT)
 * @param {number} amount - مبلغ کالا یا خدمات
 * @param {number} vatRate - نرخ مالیات (پیش‌فرض 9%)
 * @returns {object} نتیجه محاسبه VAT
 */
function calculateVAT(amount, vatRate = 0.09) {
  const vat = amount * vatRate;
  const totalWithVAT = amount + vat;

  return {
    baseAmount: formatPersianNumber(amount),
    vatRate: `${vatRate * 100}%`,
    vatAmount: formatPersianNumber(Math.round(vat)),
    totalAmount: formatPersianNumber(Math.round(totalWithVAT))
  };
}

/**
 * تشخیص نرخ مالیاتی نهایی
 * @param {number} taxableIncome - درآمد مشمول مالیات
 * @returns {string} نرخ مالیاتی نهایی
 */
function getMarginalRate(taxableIncome) {
  for (const bracket of TAX_BRACKETS_1403) {
    if (taxableIncome >= bracket.min && taxableIncome < bracket.max) {
      return `${bracket.rate * 100}%`;
    }
  }
  return '30%'; // حداکثر نرخ
}

/**
 * ایجاد گزارش مالیاتی کامل
 * @param {number} income - درآمد
 * @param {object} options - تنظیمات
 * @returns {string} گزارش فرمت شده
 */
function generateTaxReport(income, options = {}) {
  const result = calculateIncomeTax(income, options);
  
  let report = `📊 گزارش محاسبه مالیات\n\n`;
  report += `💰 درآمد ناخالص: ${result.grossIncome} ریال\n`;
  report += `🎯 کل معافیت‌ها: ${result.totalExemptions} ریال\n`;
  report += `📈 درآمد مشمول: ${result.taxableIncome} ریال\n`;
  report += `🧮 مالیات محاسبه شده: ${result.totalTax} ریال\n`;
  report += `💵 درآمد خالص: ${result.netIncome} ریال\n`;
  report += `📊 نرخ مؤثر: ${result.effectiveRate}\n`;
  report += `🎚️ نرخ نهایی: ${result.marginalRate}\n\n`;

  if (result.taxBreakdown.length > 0) {
    report += `📋 جزئیات محاسبه:\n`;
    result.taxBreakdown.forEach((bracket, index) => {
      report += `${index + 1}. ${bracket.range}: ${bracket.taxAmount} ریال (${bracket.rate})\n`;
    });
    report += `\n`;
  }

  report += `🏷️ جزئیات معافیت‌ها:\n`;
  report += `• معافیت شخصی: ${result.exemptionDetails.personal} ریال\n`;
  if (result.exemptionDetails.spouse !== '0') {
    report += `• معافیت همسر: ${result.exemptionDetails.spouse} ریال\n`;
  }
  if (result.exemptionDetails.children !== '0') {
    report += `• معافیت فرزندان: ${result.exemptionDetails.children} ریال\n`;
  }
  if (result.exemptionDetails.elderly !== '0') {
    report += `• معافیت سالمندی: ${result.exemptionDetails.elderly} ریال\n`;
  }
  if (result.exemptionDetails.disability !== '0') {
    report += `• معافیت معلولیت: ${result.exemptionDetails.disability} ریال\n`;
  }

  report += `\n⚠️ توجه: این محاسبه بر اساس نرخ‌های سال 1403 و صرفاً جهت اطلاع است.`;

  return convertToPersianDigits(report);
}

/**
 * محاسبه ساده مالیات (برای سازگاری با کد قبلی)
 * @param {number} income - درآمد
 * @returns {object} نتیجه ساده
 */
function calculateTax(income) {
  const result = calculateIncomeTax(income);
  return {
    income: result.grossIncome,
    tax: result.totalTax
  };
}

module.exports = {
  calculateTax,
  calculateIncomeTax,
  calculateSalaryTax,
  calculateCorporateTax,
  calculateVAT,
  generateTaxReport,
  TAX_BRACKETS_1403,
  TAX_EXEMPTIONS
};