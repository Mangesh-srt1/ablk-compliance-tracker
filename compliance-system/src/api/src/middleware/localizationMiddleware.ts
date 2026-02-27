/**
 * Localization Middleware
 * Detects language and makes i18n service available to routes
 */

import { Request, Response, NextFunction } from 'express';
import { getLocalizationService } from '../services/localizationService';
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/localization-middleware.log' })
  ]
});

/**
 * Extend Express Request interface to include language
 */
declare global {
  namespace Express {
    interface Request {
      language: string;
      i18n: {
        getMessage: (messagePath: string, defaultMessage?: string) => string;
        formatCurrency: (value: number) => string;
        formatDate: (date: Date | string) => string;
        formatTime: (date: Date | string) => string;
        getJurisdictionMessage: (jurisdiction: string, messageKey: string, defaultMessage?: string) => string;
      };
    }
  }
}

/**
 * Localization middleware factory
 */
export function localizationMiddleware() {
  const localizationService = getLocalizationService();

  return (req: Request, res: Response, next: NextFunction) => {
    try {
      // Detect language from query param, then header, then default
      let language = (req.query.language as string) || 
                     (req.headers['accept-language'] as string) ||
                     'en';

      // Parse language if it contains region (e.g., "en-US" -> "en")
      if (language.includes('-')) {
        language = language.split('-')[0];
      }

      language = language.toLowerCase();

      // Validate language
      const supportedLanguages = localizationService.getSupportedLanguages();
      if (!supportedLanguages.includes(language)) {
        language = 'en'; // Fallback to English
      }

      req.language = language;

      // Create i18n helper object
      req.i18n = {
        getMessage: (messagePath: string, defaultMessage?: string) =>
          localizationService.getMessage(language, messagePath, defaultMessage),
        
        formatCurrency: (value: number) =>
          localizationService.formatCurrency(value, language),
        
        formatDate: (date: Date | string) =>
          localizationService.formatDate(date, language),
        
        formatTime: (date: Date | string) =>
          localizationService.formatTime(date, language),
        
        getJurisdictionMessage: (jurisdiction: string, messageKey: string, defaultMessage?: string) =>
          localizationService.getJurisdictionMessage(language, jurisdiction, messageKey, defaultMessage)
      };

      logger.debug(`Language detected for request: ${language}`, {
        userAgent: req.get('user-agent'),
        acceptLanguage: req.get('accept-language'),
        queryLanguage: req.query.language
      });

      next();
    } catch (error) {
      logger.error('Error in localization middleware:', error);
      req.language = 'en'; // Fallback
      next();
    }
  };
}

/**
 * Get translation error response
 */
export function getLocalizedError(
  req: Request,
  errorCode: string,
  defaultMessage: string,
  statusCode: number = 400
): {
  status: 'error';
  code: string;
  message: string;
  language: string;
  statusCode: number;
} {
  const message = req.i18n.getMessage(`error_codes.${errorCode}`, defaultMessage);
  return {
    status: 'error',
    code: errorCode,
    message,
    language: req.language,
    statusCode
  };
}

/**
 * Get translated success response
 */
export function getLocalizedSuccess(
  req: Request,
  messageKey: string,
  data?: any,
  defaultMessage?: string
): any {
  const message = req.i18n.getMessage(messageKey, defaultMessage);
  return {
    status: 'success',
    message,
    language: req.language,
    timestamp: new Date().toISOString(),
    ...(data && { data })
  };
}
