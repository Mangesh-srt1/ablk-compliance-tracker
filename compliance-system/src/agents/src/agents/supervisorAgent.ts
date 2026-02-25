/**
 * Compliance Supervisor Agent
 * Main orchestrator for compliance workflow using LangGraph
 */

import { BaseMessage, HumanMessage, AIMessage } from '@langchain/core/messages';
import { StateGraph, START, END } from '@langchain/langgraph';
import { ChatAnthropic } from '@langchain/anthropic';
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/supervisor-agent.log' })
  ]
});

export interface ComplianceCheck {
  id: string;
  transactionId: string;
  checkType: 'kyc' | 'aml' | 'sebi' | 'full';
  amount?: number;
  fromAddress?: string;
  toAddress?: string;
  userId?: string;
  metadata?: any;
}

export interface ComplianceResult {
  checkId: string;
  status: 'approved' | 'rejected' | 'escalated' | 'pending';
  riskScore: number;
  findings: any[];
  recommendations: string[];
  processingTime: number;
  agentUsed: string[];
}

export interface SupervisorState {
  check: ComplianceCheck;
  results: ComplianceResult[];
  currentStep: string;
  riskScore: number;
  escalated: boolean;
  completed: boolean;
  messages: BaseMessage[];
}

export class ComplianceSupervisorAgent {
  private model: ChatAnthropic;
  private graph: StateGraph<SupervisorState>;

  constructor() {
    // Initialize Grok/Claude model
    this.model = new ChatAnthropic({
      modelName: 'claude-3-sonnet-20240229',
      temperature: 0.1,
      maxTokens: 2000,
      apiKey: process.env.GROK_API_KEY || process.env.ANTHROPIC_API_KEY,
    });

    this.initializeGraph();
  }

  /**
   * Initialize the LangGraph workflow
   */
  private initializeGraph(): void {
    this.graph = new StateGraph<SupervisorState>({
      channels: {
        check: null,
        results: {
          default: () => [],
          reducer: (current: ComplianceResult[], update: ComplianceResult[]) => [
            ...current,
            ...update
          ]
        },
        currentStep: {
          default: () => 'initialization'
        },
        riskScore: {
          default: () => 0
        },
        escalated: {
          default: () => false
        },
        completed: {
          default: () => false
        },
        messages: {
          default: () => [],
          reducer: (current: BaseMessage[], update: BaseMessage[]) => [
            ...current,
            ...update
          ]
        }
      }
    });

    // Add nodes
    this.graph.addNode('analyze_transaction', this.analyzeTransaction.bind(this));
    this.graph.addNode('route_check', this.routeCheck.bind(this));
    this.graph.addNode('aggregate_results', this.aggregateResults.bind(this));
    this.graph.addNode('make_decision', this.makeDecision.bind(this));
    this.graph.addNode('escalate_if_needed', this.escalateIfNeeded.bind(this));

    // Add edges
    this.graph.addEdge(START, 'analyze_transaction');
    this.graph.addEdge('analyze_transaction', 'route_check');
    this.graph.addEdge('route_check', 'aggregate_results');
    this.graph.addEdge('aggregate_results', 'make_decision');
    this.graph.addEdge('make_decision', 'escalate_if_needed');
    this.graph.addEdge('escalate_if_needed', END);

    // Compile the graph
    this.graph = this.graph.compile();
  }

  /**
   * Analyze transaction and determine required checks
   */
  private async analyzeTransaction(state: SupervisorState): Promise<Partial<SupervisorState>> {
    const { check } = state;

    logger.info('Analyzing transaction', {
      checkId: check.id,
      transactionId: check.transactionId,
      checkType: check.checkType
    });

    const prompt = `Analyze this compliance check and determine what specific checks are needed:

Transaction Details:
- ID: ${check.transactionId}
- Type: ${check.checkType}
- Amount: ${check.amount || 'N/A'}
- From: ${check.fromAddress || 'N/A'}
- To: ${check.toAddress || 'N/A'}
- User ID: ${check.userId || 'N/A'}

Based on SEBI and DPDP compliance requirements, determine:
1. Which agents should be invoked (KYC, AML, SEBI)
2. Priority level (low, medium, high)
3. Any special considerations

Return a JSON response with:
{
  "requiredChecks": ["kyc", "aml", "sebi"],
  "priority": "medium",
  "reasoning": "Brief explanation",
  "riskFactors": ["List of risk factors identified"]
}`;

    const message = new HumanMessage(prompt);
    const response = await this.model.invoke([message]);

    let analysis;
    try {
      analysis = JSON.parse(response.content as string);
    } catch (error) {
      logger.error('Failed to parse analysis response', { error, response: response.content });
      analysis = {
        requiredChecks: ['kyc', 'aml'],
        priority: 'medium',
        reasoning: 'Default analysis due to parsing error',
        riskFactors: []
      };
    }

    return {
      currentStep: 'analysis_complete',
      messages: [message, response]
    };
  }

  /**
   * Route check to appropriate agents
   */
  private async routeCheck(state: SupervisorState): Promise<Partial<SupervisorState>> {
    // This would invoke the individual agents (KYC, AML, SEBI)
    // For now, simulate routing logic

    const { check } = state;
    const requiredChecks = this.determineRequiredChecks(check);

    logger.info('Routing check to agents', {
      checkId: check.id,
      requiredChecks
    });

    // In a real implementation, this would invoke the actual agents
    // and collect their results
    const mockResults: ComplianceResult[] = requiredChecks.map(agentType => ({
      checkId: check.id,
      status: 'approved',
      riskScore: Math.random() * 0.3, // Low risk for demo
      findings: [],
      recommendations: [`${agentType.toUpperCase()} check passed`],
      processingTime: Math.random() * 1000 + 500,
      agentUsed: [agentType]
    }));

    return {
      results: mockResults,
      currentStep: 'routing_complete'
    };
  }

  /**
   * Aggregate results from all agents
   */
  private async aggregateResults(state: SupervisorState): Promise<Partial<SupervisorState>> {
    const { results } = state;

    logger.info('Aggregating agent results', {
      checkId: state.check.id,
      resultCount: results.length
    });

    // Calculate overall risk score
    const totalRiskScore = results.reduce((sum, result) => sum + result.riskScore, 0);
    const averageRiskScore = results.length > 0 ? totalRiskScore / results.length : 0;

    // Combine findings
    const allFindings = results.flatMap(result => result.findings);
    const allRecommendations = results.flatMap(result => result.recommendations);

    return {
      riskScore: averageRiskScore,
      currentStep: 'aggregation_complete'
    };
  }

  /**
   * Make final compliance decision
   */
  private async makeDecision(state: SupervisorState): Promise<Partial<SupervisorState>> {
    const { riskScore, check } = state;

    logger.info('Making compliance decision', {
      checkId: check.id,
      riskScore
    });

    let status: 'approved' | 'rejected' | 'escalated' = 'approved';
    let escalated = false;

    // Decision logic based on risk score
    if (riskScore > 0.7) {
      status = 'escalated';
      escalated = true;
    } else if (riskScore > 0.3) {
      status = 'escalated';
      escalated = true;
    } else {
      status = 'approved';
    }

    return {
      escalated,
      completed: true,
      currentStep: 'decision_complete'
    };
  }

  /**
   * Escalate if needed
   */
  private async escalateIfNeeded(state: SupervisorState): Promise<Partial<SupervisorState>> {
    const { escalated, check } = state;

    if (escalated) {
      logger.warn('Compliance check escalated', {
        checkId: check.id,
        riskScore: state.riskScore
      });

      // Here you would trigger escalation workflows
      // - Notify compliance officers
      // - Create escalation tickets
      // - Send alerts
    }

    return {
      currentStep: 'escalation_complete'
    };
  }

  /**
   * Execute compliance check
   */
  async executeCheck(check: ComplianceCheck): Promise<ComplianceResult> {
    const startTime = Date.now();

    try {
      logger.info('Starting compliance check execution', {
        checkId: check.id,
        transactionId: check.transactionId
      });

      const initialState: SupervisorState = {
        check,
        results: [],
        currentStep: 'initialization',
        riskScore: 0,
        escalated: false,
        completed: false,
        messages: []
      };

      const finalState = await this.graph.invoke(initialState);

      const processingTime = Date.now() - startTime;

      const result: ComplianceResult = {
        checkId: check.id,
        status: finalState.escalated ? 'escalated' : 'approved',
        riskScore: finalState.riskScore,
        findings: finalState.results.flatMap(r => r.findings),
        recommendations: finalState.results.flatMap(r => r.recommendations),
        processingTime,
        agentUsed: finalState.results.flatMap(r => r.agentUsed)
      };

      logger.info('Compliance check completed', {
        checkId: check.id,
        status: result.status,
        riskScore: result.riskScore,
        processingTime
      });

      return result;

    } catch (error) {
      logger.error('Error executing compliance check', {
        checkId: check.id,
        error: error instanceof Error ? error.message : String(error)
      });

      // Return error result
      return {
        checkId: check.id,
        status: 'escalated',
        riskScore: 1.0,
        findings: [{ type: 'error', message: 'Check execution failed' }],
        recommendations: ['Manual review required'],
        processingTime: Date.now() - startTime,
        agentUsed: ['supervisor']
      };
    }
  }

  /**
   * Determine required checks based on transaction
   */
  private determineRequiredChecks(check: ComplianceCheck): string[] {
    const checks = [];

    // Always include KYC for financial transactions
    if (check.checkType === 'full' || check.checkType === 'kyc') {
      checks.push('kyc');
    }

    // Include AML for transfers above threshold
    if ((check.amount && check.amount > 50000) || check.checkType === 'full' || check.checkType === 'aml') {
      checks.push('aml');
    }

    // Include SEBI for securities transactions
    if (check.checkType === 'sebi' || check.checkType === 'full') {
      checks.push('sebi');
    }

    // Default to KYC + AML if no specific type
    if (checks.length === 0) {
      checks.push('kyc', 'aml');
    }

    return checks;
  }
}