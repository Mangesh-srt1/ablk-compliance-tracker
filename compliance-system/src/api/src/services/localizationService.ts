/**
 * Localization Service (i18n)
 * Handles language detection and message translation
 */

import fs from 'fs';
import path from 'path';
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/i18n.log' })
  ]
});

export interface LocalizationConfig {
  language: string;
  languageCode: string;
  region: string;
  dateFormat: string;
  timeFormat: string;
  currencySymbol: string;
  decimalSeparator: string;
  thousandsSeparator: string;
  [key: string]: any;
}

/**
 * LocalizationService: Manages multi-language support and translations
 */
export class LocalizationService {
  private translations: Map<string, LocalizationConfig> = new Map();
  private defaultLanguage: string = 'en';
  private supportedLanguages: string[] = ['en', 'es', 'hi', 'ar', 'fr', 'de', 'pt', 'ja', 'zh'];
  private localesPath: string;

  constructor(localesPath?: string) {
    this.localesPath = localesPath || './src/locales';
    this.loadAllTranslations();
  }

  /**
   * Load all translation files
   */
  private loadAllTranslations(): void {
    for (const lang of this.supportedLanguages) {
      try {
        const filePath = path.join(this.localesPath, `${lang}.json`);
        if (fs.existsSync(filePath)) {
          const content = fs.readFileSync(filePath, 'utf-8');
          const translation = JSON.parse(content);
          this.translations.set(lang, translation);
          logger.debug(`Translation loaded for language: ${lang}`);
        }
      } catch (error) {
        logger.warn(`Failed to load translation for ${lang}:`, error);
      }
    }

    // Ensure default language is loaded
    if (!this.translations.has(this.defaultLanguage)) {
      logger.warn(`Default language ${this.defaultLanguage} not found. Using fallback.`);
    }
  }

  /**
   * Detect language from Accept-Language header
   * Format: "en-US,en;q=0.9,es;q=0.8"
   */
  public detectLanguage(acceptLanguageHeader?: string): string {
    if (!acceptLanguageHeader) {
      return this.defaultLanguage;
    }

    try {
      // Parse accept-language header
      const languages = acceptLanguageHeader
        .split(',')
        .map(lang => {
          const [code, q = 'q=1'] = lang.trim().split(';');
          const quality = parseFloat(q.replace('q=', ''));
          return { code: code.split('-')[0].toLowerCase(), quality };
        })
        .sort((a, b) => b.quality - a.quality);

      // Find first supported language
      for (const lang of languages) {
        if (this.supportedLanguages.includes(lang.code)) {
          return lang.code;
        }
      }

      return this.defaultLanguage;
    } catch (error) {
      logger.warn(`Error parsing Accept-Language header: ${error}`);
      return this.defaultLanguage;
    }
  }

  /**
   * Get a translated message by path
   * Path format: "api.errors.INVALID_REQUEST"
   */
  public getMessage(
    language: string,
    messagePath: string,
    defaultMessage?: string
  ): string {
    const lang = this.supportedLanguages.includes(language) ? language : this.defaultLanguage;
    const translation = this.translations.get(lang);

    if (!translation) {
      return defaultMessage || messagePath;
    }

    const keys = messagePath.split('.');
    let message: any = translation;

    for (const key of keys) {
      message = message?.[key];
      if (!message) {
        break;
      }
    }

    if (typeof message === 'string') {
      return message;
    }

    // Fallback to default language if translation not found
    if (lang !== this.defaultLanguage) {
      return this.getMessage(this.defaultLanguage, messagePath, defaultMessage);
    }

    return defaultMessage || messagePath;
  }

  /**
   * Get jurisdiction-specific message
   */
  public getJurisdictionMessage(
    language: string,
    jurisdiction: string,
    messageKey: string,
    defaultMessage?: string
  ): string {
    const messagePath = `jurisdiction_specific.${jurisdiction}.${messageKey}`;
    return this.getMessage(language, messagePath, defaultMessage);
  }

 /**
   * Format currency value according to locale
   */
  public formatCurrency(value: number, language: string): string {
    const lang = this.supportedLanguages.includes(language) ? language : this.defaultLanguage;
    const config = this.translations.get(lang);

    if (!config) {
      return value.toString();
    }

    const options: Intl.NumberFormatOptions = {
      style: 'currency',
      currency: this.mapLanguageToCurrency(lang),
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    };

    try {
      return new Intl.NumberFormat(lang, options).format(value);
    } catch (error) {
      logger.warn(`Error formatting currency for ${lang}:`, error);
      return value.toString();
    }
  }

  /**
   * Format date according to locale
   */
  public formatDate(date: Date | string, language: string): string {
    const lang = this.supportedLanguages.includes(language) ? language : this.defaultLanguage;
    const dateObj = typeof date === 'string' ? new Date(date) : date;

    if (isNaN(dateObj.getTime())) {
      return 'Invalid Date';
    }

    try {
      return dateObj.toLocaleDateString(lang);
    } catch (error) {
      logger.warn(`Error formatting date for ${lang}:`, error);
      return dateObj.toISOString().split('T')[0];
    }
  }

  /**
   * Format time according to locale
   */
  public formatTime(date: Date | string, language: string): string {
    const lang = this.supportedLanguages.includes(language) ? language : this.defaultLanguage;
    const dateObj = typeof date === 'string' ? new Date(date) : date;

    if (isNaN(dateObj.getTime())) {
      return 'Invalid Time';
    }

    try {
      return dateObj.toLocaleTimeString(lang);
    } catch (error) {
      logger.warn(`Error formatting time for ${lang}:`, error);
      return dateObj.toISOString().split('T')[1];
    }
  }

  /**
   * Map language code to currency code
   */
  private mapLanguageToCurrency(language: string): string {
    const currencyMap: Record<string, string> = {
      'en': 'USD',
      'es': 'EUR',
      'hi': 'INR',
      'ar': 'AED',
      'fr': 'EUR',
      'de': 'EUR',
      'pt': 'BRL',
      'ja': 'JPY',
      'zh': 'CNY'
    };

    return currencyMap[language] || 'USD';
  }

  /**
   * Get all supported languages
   */
  public getSupportedLanguages(): string[] {
    return [...this.supportedLanguages];
  }

  /**
   * Get language configuration
   */
  public getLanguageConfig(language: string): LocalizationConfig | null {
    const lang = this.supportedLanguages.includes(language)
      ? language
      : this.defaultLanguage;
    return this.translations.get(lang) || null;
  }

  /**
   * Reload translations (for hot reload)
   */
  public reloadTranslations(): void {
    this.translations.clear();
    this.loadAllTranslations();
    logger.info('Translations reloaded');
  }
}

/**
 * Create singleton instance
 */
let instance: LocalizationService | null = null;

export function initializeLocalizationService(
  localesPath?: string
): LocalizationService {
  if (!instance) {
    instance = new LocalizationService(localesPath);
    logger.info('LocalizationService initialized', {
      localesPath: localesPath || './src/locales',
      supportedLanguages: ['en', 'es', 'hi', 'ar', 'fr', 'de', 'pt', 'ja', 'zh']
    });
  }
  return instance;
}

export function getLocalizationService(): LocalizationService {
  if (!instance) {
    instance = new LocalizationService();
  }
  return instance;
}
