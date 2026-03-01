/**
 * FinCEN CTR Form Generator
 * Automatically populates FinCEN CTR forms with entity and transaction data
 * Generates FinCEN-compliant Currency Transaction Report forms
 */

import winston from 'winston';
import { v4 as uuidv4 } from 'uuid';
import {
  CTRForm,
  CTRLine,
  CTRCurrency,
  CTRGenerationRequest,
  CTRStatus,
} from '../types/sar-ctr.types';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/fincen-ctr-generator.log' }),
  ],
});

export class FinCenCtRGenerator {
  /**
   * Generate CTR form from transactions and entity data
   */
  async generateCTR(request: CTRGenerationRequest, entityData: any): Promise<CTRForm> {
    const ctrId = uuidv4();
    const now = new Date();
    const filingDeadline = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000); // 15 days

    // Validate input
    if (!request.transactionIds || request.transactionIds.length === 0) {
      throw new Error('At least one transaction ID required for CTR generation');
    }

    if (request.aggregatedAmount < (request.threshold || 10000)) {
      logger.warn('CTR amount below reporting threshold', {
        aggregatedAmount: request.aggregatedAmount,
        threshold: request.threshold || 10000,
      });
    }

    // Build CTR lines from transactions
    const lines = await this.buildCTRLines(request.transactionIds);

    // Create CTR form
    const ctrForm: CTRForm = {
      ctrId,
      filingVersion: '2.0', // FinCEN Form 8300 v2.0
      filerId: process.env.FINCEN_FILER_ID || 'UNKNOWN',
      reportingInstitution: process.env.FINCEN_INSTITUTION_NAME || 'Ableka Lumina',
      reportingDate: now,
      filingDeadline,
      currency: request.currency,
      totalAmount: request.aggregatedAmount,
      transactionCount: lines.length,
      entityName: entityData.name || 'Unknown Entity',
      entityType: entityData.type || 'individual',
      entityCountry: entityData.jurisdiction || 'US',
      lines,
      narrative: request.narrative || this.generateDefaultNarrative(request, entityData),
      status: 'DRAFT',
      generatedAt: now,
      createdBy: 'system',
    };

    logger.info('CTR form generated', {
      ctrId,
      entityId: request.entityId,
      lineCount: lines.length,
      totalAmount: request.aggregatedAmount,
      currency: request.currency,
    });

    return ctrForm;
  }

  /**
   * Build CTR line items from transaction data
   */
  private async buildCTRLines(transactionIds: string[]): Promise<CTRLine[]> {
    const lines: CTRLine[] = [];
    let sequence = 1;

    // TODO: Fetch transaction data from database
    // For now, create placeholder structure
    for (const txId of transactionIds) {
      lines.push({
        sequenceNumber: sequence++,
        transactionDate: new Date(),
        transactionAmount: 10000, // Placeholder
        currency: 'USD',
        transactionType: 'wire',
        counterpartyName: 'Unknown Counterparty',
        counterpartyCountry: 'US',
        sourceCountry: 'US',
        destinationCountry: 'US',
      });
    }

    return lines;
  }

  /**
   * Generate default narrative for CTR form
   */
  private generateDefaultNarrative(request: CTRGenerationRequest, entityData: any): string {
    const lines = [
      `Currency Transaction Report (CTR) for entity: ${entityData.name || 'Unknown'}`,
      `Reporting Period: ${request.transactionIds.length} transactions`,
      `Total Amount: ${request.currency} ${request.aggregatedAmount.toFixed(2)}`,
      `Reporting Institution: ${process.env.FINCEN_INSTITUTION_NAME || 'Ableka Lumina'}`,
      `Compliance Note: Transactions reported in accordance with 31 U.S.C. § 5313 and 31 CFR Chapter X.`,
    ];

    return lines.join('\n');
  }

  /**
   * Validate CTR form completeness
   */
  validateCTRForm(form: CTRForm): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check required fields
    if (!form.entityName || form.entityName.trim() === '') {
      errors.push('Entity name is required');
    }

    if (!form.filerId || form.filerId === 'UNKNOWN') {
      errors.push('Filer ID must be configured (set FINCEN_FILER_ID in environment)');
    }

    if (form.lines.length === 0) {
      errors.push('At least one transaction line required');
    }

    if (form.totalAmount === 0) {
      errors.push('Total amount cannot be zero');
    }

    if (form.reportingDate > form.filingDeadline) {
      errors.push('Filing deadline must be after reporting date');
    }

    // Validate line items
    form.lines.forEach((line, index) => {
      if (line.transactionAmount <= 0) {
        errors.push(`Line ${index + 1}: Transaction amount must be positive`);
      }

      if (!line.counterpartyName || line.counterpartyName.trim() === '') {
        errors.push(`Line ${index + 1}: Counterparty name required`);
      }

      if (!['wire', 'cash', 'check', 'other'].includes(line.transactionType)) {
        errors.push(`Line ${index + 1}: Invalid transaction type`);
      }
    });

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Export CTR to FinCEN-compliant format
   * Supports JSON and CSV exports
   */
  exportCTR(
    form: CTRForm,
    format: 'json' | 'csv' | 'xml' = 'json'
  ): string {
    // Validate form first
    const validation = this.validateCTRForm(form);
    if (!validation.isValid) {
      throw new Error(
        `CTR form validation failed: ${validation.errors.join('; ')}`
      );
    }

    switch (format) {
      case 'json':
        return this.exportAsJSON(form);
      case 'csv':
        return this.exportAsCSV(form);
      case 'xml':
        return this.exportAsXML(form);
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  /**
   * Export CTR as JSON
   */
  private exportAsJSON(form: CTRForm): string {
    const payload = {
      formVersion: form.filingVersion,
      filerId: form.filerId,
      reportingInstitution: form.reportingInstitution,
      reportingDate: form.reportingDate.toISOString(),
      filingDeadline: form.filingDeadline.toISOString(),
      currency: form.currency,
      totalAmount: form.totalAmount,
      transactionCount: form.transactionCount,
      entity: {
        name: form.entityName,
        type: form.entityType,
        country: form.entityCountry,
      },
      transactions: form.lines.map((line) => ({
        sequence: line.sequenceNumber,
        date: line.transactionDate.toISOString(),
        amount: line.transactionAmount,
        type: line.transactionType,
        counterparty: {
          name: line.counterpartyName,
          country: line.counterpartyCountry,
        },
        routing: {
          source: line.sourceCountry,
          destination: line.destinationCountry,
        },
      })),
      narrative: form.narrative,
      filingReference: `CTR-${form.ctrId.substring(0, 8).toUpperCase()}`,
    };

    return JSON.stringify(payload, null, 2);
  }

  /**
   * Export CTR as CSV
   */
  private exportAsCSV(form: CTRForm): string {
    const headers = [
      'Sequence',
      'Transaction Date',
      'Amount',
      'Currency',
      'Type',
      'Counterparty Name',
      'Counterparty Country',
      'Source Country',
      'Destination Country',
    ];

    const rows = form.lines.map((line) => [
      line.sequenceNumber,
      line.transactionDate.toISOString().split('T')[0],
      line.transactionAmount,
      form.currency,
      line.transactionType,
      `"${line.counterpartyName}"`,
      line.counterpartyCountry,
      line.sourceCountry,
      line.destinationCountry,
    ]);

    const csvContent = [
      ['Filer ID', form.filerId],
      ['Institution', form.reportingInstitution],
      ['Reporting Date', form.reportingDate.toISOString()],
      ['Total Amount', form.totalAmount],
      ['Entity Name', form.entityName],
      ['Entity Type', form.entityType],
      [],
      headers,
      ...rows,
    ]
      .map((row) => row.join(','))
      .join('\n');

    return csvContent;
  }

  /**
   * Export CTR as XML (FinCEN-compatible)
   */
  private exportAsXML(form: CTRForm): string {
    const xmlLines = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<CTRForm>',
      `  <FormVersion>${this.escapeXml(form.filingVersion)}</FormVersion>`,
      `  <FilerId>${this.escapeXml(form.filerId)}</FilerId>`,
      `  <ReportingInstitution>${this.escapeXml(form.reportingInstitution)}</ReportingInstitution>`,
      `  <ReportingDate>${form.reportingDate.toISOString()}</ReportingDate>`,
      `  <FilingDeadline>${form.filingDeadline.toISOString()}</FilingDeadline>`,
      `  <Currency>${this.escapeXml(form.currency)}</Currency>`,
      `  <TotalAmount>${form.totalAmount}</TotalAmount>`,
      `  <TransactionCount>${form.transactionCount}</TransactionCount>`,
      '  <Entity>',
      `    <Name>${this.escapeXml(form.entityName)}</Name>`,
      `    <Type>${this.escapeXml(form.entityType)}</Type>`,
      `    <Country>${this.escapeXml(form.entityCountry)}</Country>`,
      '  </Entity>',
      '  <Transactions>',
    ];

    form.lines.forEach((line) => {
      xmlLines.push('    <Transaction>');
      xmlLines.push(`      <Sequence>${line.sequenceNumber}</Sequence>`);
      xmlLines.push(`      <Date>${line.transactionDate.toISOString()}</Date>`);
      xmlLines.push(`      <Amount>${line.transactionAmount}</Amount>`);
      xmlLines.push(`      <Type>${this.escapeXml(line.transactionType)}</Type>`);
      xmlLines.push(
        `      <CounterpartyName>${this.escapeXml(line.counterpartyName)}</CounterpartyName>`
      );
      xmlLines.push(
        `      <CounterpartyCountry>${this.escapeXml(line.counterpartyCountry)}</CounterpartyCountry>`
      );
      xmlLines.push(`      <SourceCountry>${this.escapeXml(line.sourceCountry)}</SourceCountry>`);
      xmlLines.push(
        `      <DestinationCountry>${this.escapeXml(line.destinationCountry)}</DestinationCountry>`
      );
      xmlLines.push('    </Transaction>');
    });

    xmlLines.push('  </Transactions>');
    xmlLines.push(`  <Narrative>${this.escapeXml(form.narrative || '')}</Narrative>`);
    xmlLines.push('</CTRForm>');

    return xmlLines.join('\n');
  }

  /**
   * Escape XML special characters
   */
  private escapeXml(text: string): string {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&apos;',
    };
    return text.replace(/[&<>"']/g, (c) => map[c]);
  }

  /**
   * Calculate filing deadline
   */
  calculateFilingDeadline(reportDate: Date, daysToFile: number = 15): Date {
    const deadline = new Date(reportDate.getTime() + daysToFile * 24 * 60 * 60 * 1000);
    // Adjust for weekends if needed (FinCEN reports are due on business days)
    while (deadline.getDay() === 0 || deadline.getDay() === 6) {
      deadline.setDate(deadline.getDate() + 1);
    }
    return deadline;
  }

  /**
   * Convert amount between currencies (requires exchange rate service)
   */
  convertToReportingCurrency(
    amount: number,
    fromCurrency: CTRCurrency,
    toCurrency: CTRCurrency,
    exchangeRate?: number
  ): number {
    if (fromCurrency === toCurrency) {
      return amount;
    }

    if (!exchangeRate) {
      logger.warn(
        `No exchange rate provided for ${fromCurrency} to ${toCurrency} conversion; using 1:1`
      );
      return amount; // Fallback to 1:1
    }

    return amount * exchangeRate;
  }
}

// Singleton instance
let instance: FinCenCtRGenerator | null = null;

export function getFinCenCtRGenerator(): FinCenCtRGenerator {
  if (!instance) {
    instance = new FinCenCtRGenerator();
  }
  return instance;
}
