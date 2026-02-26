/**
 * Compliance Graph
 * LangGraph orchestration for multi-agent compliance workflow
 */

import { StateGraph, START, END, CompiledStateGraph } from '@langchain/langgraph';
import winston from 'winston';
import { ComplianceSupervisorAgent } from '../agents/supervisorAgent';
import { KYCAgent } from '../agents/kycAgent';
import { AMLAgent } from '../agents/amlAgent';
import { SEBIAgent } from '../agents/sebiAgent';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/compliance-graph.log' }),
  ],
});

export interface ComplianceWorkflowState {
  transaction: any;
  kycResult?: any;
  amlResult?: any;
  sebiResult?: any;
  supervisorDecision?: any;
  finalResult: any;
  currentStep: string;
  riskScore: number;
  processingTime: number;
  errors: string[];
}

export class ComplianceGraph {
  private graph: StateGraph<ComplianceWorkflowState> | CompiledStateGraph<ComplianceWorkflowState, Partial<ComplianceWorkflowState>>;
  private supervisorAgent: ComplianceSupervisorAgent;
  private kycAgent: KYCAgent;
  private amlAgent: AMLAgent;
  private sebiAgent: SEBIAgent;

  constructor(agents: {
    supervisor: ComplianceSupervisorAgent;
    kyc: KYCAgent;
    aml: AMLAgent;
    sebi: SEBIAgent;
  }) {
    this.supervisorAgent = agents.supervisor;
    this.kycAgent = agents.kyc;
    this.amlAgent = agents.aml;
    this.sebiAgent = agents.sebi;

    this.initializeGraph();
  }

  /**
   * Initialize the compliance workflow graph
   */
  // @ts-ignore - LangChain v0.1 reducer API mismatch
  private initializeGraph(): void {
    this.graph = new StateGraph<ComplianceWorkflowState>({
      channels: {
        transaction: null,
        kycResult: { default: () => null },
        amlResult: { default: () => null },
        sebiResult: { default: () => null },
        supervisorDecision: { default: () => null },
        finalResult: { default: () => null },
        currentStep: { default: () => 'initialization' },
        riskScore: { default: () => 0 },
        processingTime: { default: () => 0 },
        errors: {
          default: () => [],
          reducer: (current: string[], update: string[]) => [...current, ...update],
        },
      },
    } as any);

    // Add workflow nodes
    this.graph.addNode('validate_transaction', this.validateTransaction.bind(this));
    this.graph.addNode('parallel_checks', this.executeParallelChecks.bind(this));
    this.graph.addNode('supervisor_review', this.supervisorReview.bind(this));
    this.graph.addNode('generate_report', this.generateReport.bind(this));
    this.graph.addNode('handle_errors', this.handleErrors.bind(this));

    // Define conditional routing
    // @ts-ignore - LangChain v0.1 edge routing type compatibility
    this.graph.addConditionalEdges('validate_transaction', this.routeAfterValidation.bind(this), {
      parallel: 'parallel_checks',
      error: 'handle_errors',
    });

    // @ts-ignore
    this.graph.addConditionalEdges('parallel_checks', this.routeAfterChecks.bind(this), {
      supervisor: 'supervisor_review',
      escalate: 'generate_report',
      error: 'handle_errors',
    });

    // @ts-ignore
    this.graph.addEdge('supervisor_review', 'generate_report');
    // @ts-ignore
    this.graph.addEdge('generate_report', END);
    // @ts-ignore
    this.graph.addEdge('handle_errors', END);

    // Set entry point
    // @ts-ignore
    this.graph.addEdge(START, 'validate_transaction');

    // Compile the graph
    this.graph = this.graph.compile();
  }

  /**
   * Validate transaction data
   */
  private async validateTransaction(
    state: ComplianceWorkflowState
  ): Promise<Partial<ComplianceWorkflowState>> {
    const { transaction } = state;

    logger.info('Validating transaction', {
      transactionId: transaction.id,
      type: transaction.type,
    });

    try {
      // Basic validation
      if (!transaction.id || !transaction.type) {
        throw new Error('Missing required transaction fields');
      }

      if (transaction.amount && transaction.amount < 0) {
        throw new Error('Invalid transaction amount');
      }

      return {
        currentStep: 'validation_complete',
      };
    } catch (error) {
      logger.error('Transaction validation failed', {
        transactionId: transaction.id,
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        errors: [error instanceof Error ? error.message : 'Validation failed'],
        currentStep: 'validation_failed',
      };
    }
  }

  /**
   * Route after validation
   */
  private routeAfterValidation(state: ComplianceWorkflowState): string {
    if (state.errors.length > 0) {
      return 'error';
    }
    return 'parallel';
  }

  /**
   * Execute parallel compliance checks
   */
  private async executeParallelChecks(
    state: ComplianceWorkflowState
  ): Promise<Partial<ComplianceWorkflowState>> {
    const { transaction } = state;
    const startTime = Date.now();

    logger.info('Executing parallel compliance checks', {
      transactionId: transaction.id,
    });

    try {
      // Determine which checks to run based on transaction type and amount
      const checksToRun = this.determineRequiredChecks(transaction);

      // Execute checks in parallel
      const checkPromises = checksToRun.map(async (checkType) => {
        switch (checkType) {
          case 'kyc':
            return { type: 'kyc', result: await this.kycAgent.check(transaction) };
          case 'aml':
            return { type: 'aml', result: await this.amlAgent.check(transaction) };
          case 'sebi':
            return { type: 'sebi', result: await this.sebiAgent.check(transaction) };
          default:
            return null;
        }
      });

      const checkResults = await Promise.allSettled(checkPromises);
      const processingTime = Date.now() - startTime;

      // Process results
      let kycResult = null;
      let amlResult = null;
      let sebiResult = null;
      let totalRiskScore = 0;
      let checkCount = 0;

      checkResults.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value) {
          const { type, result: checkResult } = result.value;

          switch (type) {
            case 'kyc':
              kycResult = checkResult;
              break;
            case 'aml':
              amlResult = checkResult;
              break;
            case 'sebi':
              sebiResult = checkResult;
              break;
          }

          if (checkResult.riskScore !== undefined) {
            totalRiskScore += checkResult.riskScore;
            checkCount++;
          }
        } else if (result.status === 'rejected') {
          logger.error(`Check failed for ${checksToRun[index]}`, {
            transactionId: transaction.id,
            error: result.reason,
          });
        }
      });

      const averageRiskScore = checkCount > 0 ? totalRiskScore / checkCount : 0;

      return {
        kycResult,
        amlResult,
        sebiResult,
        riskScore: averageRiskScore,
        processingTime,
        currentStep: 'parallel_checks_complete',
      };
    } catch (error) {
      logger.error('Parallel checks execution failed', {
        transactionId: transaction.id,
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        errors: [error instanceof Error ? error.message : 'Parallel checks failed'],
        processingTime: Date.now() - startTime,
        currentStep: 'parallel_checks_failed',
      };
    }
  }

  /**
   * Route after parallel checks
   */
  private routeAfterChecks(state: ComplianceWorkflowState): string {
    if (state.errors.length > 0) {
      return 'error';
    }

    // Escalate if high risk or multiple failed checks
    if (state.riskScore > 0.7) {
      return 'escalate';
    }

    // Supervisor review for medium risk
    if (state.riskScore > 0.3) {
      return 'supervisor';
    }

    // Auto-approve low risk
    return 'escalate'; // Still go to report generation
  }

  /**
   * Supervisor review for medium-risk transactions
   */
  private async supervisorReview(
    state: ComplianceWorkflowState
  ): Promise<Partial<ComplianceWorkflowState>> {
    const { transaction, kycResult, amlResult, sebiResult } = state;

    logger.info('Supervisor review initiated', {
      transactionId: transaction.id,
      riskScore: state.riskScore,
    });

    try {
      // Create compliance check for supervisor agent
      const check = {
        id: `supervisor-${transaction.id}-${Date.now()}`,
        transactionId: transaction.id,
        checkType: 'full' as const,
        amount: transaction.amount,
        fromAddress: transaction.fromAddress,
        toAddress: transaction.toAddress,
        userId: transaction.userId,
        metadata: {
          kycResult,
          amlResult,
          sebiResult,
        },
      };

      const supervisorResult = await this.supervisorAgent.executeCheck(check);

      return {
        supervisorDecision: supervisorResult,
        riskScore: supervisorResult.riskScore,
        currentStep: 'supervisor_review_complete',
      };
    } catch (error) {
      logger.error('Supervisor review failed', {
        transactionId: transaction.id,
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        errors: [error instanceof Error ? error.message : 'Supervisor review failed'],
        currentStep: 'supervisor_review_failed',
      };
    }
  }

  /**
   * Generate final compliance report
   */
  private async generateReport(
    state: ComplianceWorkflowState
  ): Promise<Partial<ComplianceWorkflowState>> {
    const { transaction, kycResult, amlResult, sebiResult, supervisorDecision, riskScore } = state;

    logger.info('Generating compliance report', {
      transactionId: transaction.id,
      finalRiskScore: riskScore,
    });

    // Determine final status
    let status: 'approved' | 'escalated' = 'approved';
    if (riskScore > 0.3 || (supervisorDecision && supervisorDecision.status === 'escalated')) {
      status = 'escalated';
    }

    // Compile findings and recommendations
    const findings = [];
    const recommendations = [];

    if (kycResult) {
      findings.push(...(kycResult.findings || []));
      recommendations.push(...(kycResult.recommendations || []));
    }

    if (amlResult) {
      findings.push(...(amlResult.findings || []));
      recommendations.push(...(amlResult.recommendations || []));
    }

    if (sebiResult) {
      findings.push(...(sebiResult.findings || []));
      recommendations.push(...(sebiResult.recommendations || []));
    }

    if (supervisorDecision) {
      findings.push(...(supervisorDecision.findings || []));
      recommendations.push(...(supervisorDecision.recommendations || []));
    }

    const finalResult = {
      transactionId: transaction.id,
      status,
      riskScore,
      findings,
      recommendations,
      processingTime: state.processingTime,
      timestamp: new Date().toISOString(),
      agentsUsed: this.getAgentsUsed(kycResult, amlResult, sebiResult, supervisorDecision),
    };

    return {
      finalResult,
      currentStep: 'report_generated',
    };
  }

  /**
   * Handle errors in the workflow
   */
  private async handleErrors(
    state: ComplianceWorkflowState
  ): Promise<Partial<ComplianceWorkflowState>> {
    const { transaction, errors } = state;

    logger.error('Handling workflow errors', {
      transactionId: transaction.id,
      errorCount: errors.length,
      errors,
    });

    // Create error result
    const finalResult = {
      transactionId: transaction.id,
      status: 'escalated',
      riskScore: 1.0,
      findings: errors.map((error) => ({ type: 'error', message: error })),
      recommendations: ['Manual compliance review required due to system errors'],
      processingTime: state.processingTime,
      timestamp: new Date().toISOString(),
      agentsUsed: [],
      errors,
    };

    return {
      finalResult,
      currentStep: 'errors_handled',
    };
  }

  /**
   * Execute compliance workflow
   */
  async executeWorkflow(transaction: any): Promise<any> {
    const startTime = Date.now();

    try {
      logger.info('Starting compliance workflow', {
        transactionId: transaction.id,
        type: transaction.type,
      });

      const initialState: ComplianceWorkflowState = {
        transaction,
        finalResult: null,
        currentStep: 'initialization',
        riskScore: 0,
        processingTime: 0,
        errors: [],
      };

      const finalState = await (this.graph as any).invoke(initialState);
      const totalProcessingTime = Date.now() - startTime;

      // Update processing time
      if (finalState.finalResult) {
        finalState.finalResult.processingTime = totalProcessingTime;
      }

      logger.info('Compliance workflow completed', {
        transactionId: transaction.id,
        status: finalState.finalResult?.status,
        riskScore: finalState.finalResult?.riskScore,
        processingTime: totalProcessingTime,
      });

      return finalState.finalResult;
    } catch (error) {
      logger.error('Compliance workflow execution failed', {
        transactionId: transaction.id,
        error: error instanceof Error ? error.message : String(error),
      });

      // Return error result
      return {
        transactionId: transaction.id,
        status: 'escalated',
        riskScore: 1.0,
        findings: [{ type: 'error', message: 'Workflow execution failed' }],
        recommendations: ['Manual compliance review required'],
        processingTime: Date.now() - startTime,
        timestamp: new Date().toISOString(),
        agentsUsed: [],
        errors: [error instanceof Error ? error.message : 'Workflow execution failed'],
      };
    }
  }

  /**
   * Determine which checks are required based on transaction
   */
  private determineRequiredChecks(transaction: any): string[] {
    const checks = [];

    // KYC for all transactions involving users
    if (transaction.userId) {
      checks.push('kyc');
    }

    // AML for high-value transactions
    if (transaction.amount > 50000) {
      checks.push('aml');
    }

    // SEBI for securities transactions
    if (transaction.type === 'security' || transaction.assetType === 'security') {
      checks.push('sebi');
    }

    // Default checks if none specified
    if (checks.length === 0) {
      checks.push('kyc', 'aml');
    }

    return checks;
  }

  /**
   * Get list of agents that were used
   */
  private getAgentsUsed(
    kycResult: any,
    amlResult: any,
    sebiResult: any,
    supervisorDecision: any
  ): string[] {
    const agents = [];

    if (kycResult) {
      agents.push('kyc');
    }
    if (amlResult) {
      agents.push('aml');
    }
    if (sebiResult) {
      agents.push('sebi');
    }
    if (supervisorDecision) {
      agents.push('supervisor');
    }

    return agents;
  }
}
