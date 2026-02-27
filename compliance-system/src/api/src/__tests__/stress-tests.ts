#!/usr/bin/env node

/**
 * STRESS TEST SUITE for Ableka Lumina Compliance Platform
 * Tests: Performance under load, rate limiting, error handling, recovery
 * 
 * Usage:
 *   npx ts-node stress-tests.ts --duration=300 --concurrency=50 --endpoint=http://localhost:4000
 */

import axios, { AxiosInstance } from 'axios';
import * as fs from 'fs';
import * as path from 'path';

interface StressTestConfig {
  baseURL: string;
  duration: number; // seconds
  concurrency: number;
  rampUp: number; // seconds to reach full concurrency
  endpoint: string;
  testToken: string;
  outputFile: string;
}

interface TestResult {
  testName: string;
  success: number;
  failed: number;
  totalRequests: number;
  duration: number;
  avgLatency: number;
  p50Latency: number;
  p95Latency: number;
  p99Latency: number;
  minLatency: number;
  maxLatency: number;
  throughput: number; // req/sec
  errorRate: number; // percent
  errors: { [key: string]: number };
  rateLimitHits: number;
}

interface GlobalMetrics {
  totalRequests: number;
  totalSuccessful: number;
  totalFailed: number;
  totalDuration: number;
  averageThroughput: number;
  peakThroughput: number;
  minLatency: number;
  maxLatency: number;
  allLatencies: number[];
}

class ComplianceStressTest {
  private config: StressTestConfig;
  private apiClient: AxiosInstance;
  private metrics: GlobalMetrics = {
    totalRequests: 0,
    totalSuccessful: 0,
    totalFailed: 0,
    totalDuration: 0,
    averageThroughput: 0,
    peakThroughput: 0,
    minLatency: Infinity,
    maxLatency: 0,
    allLatencies: [],
  };
  private latencies: number[] = [];
  private errors: { [key: string]: number } = {};
  private rateLimitHits: number = 0;

  constructor(config: Partial<StressTestConfig> = {}) {
    this.config = {
      baseURL: config.baseURL || 'http://localhost:4000',
      duration: config.duration || 300,
      concurrency: config.concurrency || 50,
      rampUp: config.rampUp || 30,
      endpoint: config.endpoint || '/api/v1/kyc-check',
      testToken: config.testToken || 'test-token',
      outputFile: config.outputFile || 'stress-test-results.json',
    };

    this.apiClient = axios.create({
      baseURL: this.config.baseURL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.testToken}`,
      },
    });
  }

  /**
   * Generate random test data
   */
  private generateTestPayload(testType: string): any {
    const randomId = Math.random().toString(36).substring(7);
    
    switch (testType) {
      case 'kyc':
        return {
          name: `Test User ${randomId}`,
          email: `test${randomId}@example.com`,
          jurisdiction: ['AE', 'US', 'IN', 'SG'][Math.floor(Math.random() * 4)],
          documentType: 'passport',
          liveness: Math.random() > 0.5,
        };

      case 'aml':
        return {
          walletAddress: `0x${randomId.padEnd(40, '0')}`,
          blockchain: ['ethereum', 'solana'][Math.floor(Math.random() * 2)],
          jurisdiction: ['AE', 'US', 'IN'][Math.floor(Math.random() * 3)],
          transactionHistory: Array.from({ length: 3 }, () => ({
            hash: `0x${Math.random().toString(16).substring(2)}`,
            value: Math.floor(Math.random() * 10000),
            timestamp: Date.now() - Math.random() * 86400000,
          })),
        };

      case 'compliance':
        return {
          from: `0x${randomId.padEnd(40, 'a')}`,
          to: `0x${randomId.padEnd(40, 'b')}`,
          amount: Math.floor(Math.random() * 1000000),
          currency: ['USD', 'AED', 'INR'][Math.floor(Math.random() * 3)],
          jurisdiction: ['AE', 'US', 'IN'][Math.floor(Math.random() * 3)],
        };

      default:
        return { test: 'data' };
    }
  }

  /**
   * Single request execution
   */
  private async executeRequest(endpoint: string, payload: any): Promise<{
    success: boolean;
    latency: number;
    status?: number;
    error?: string;
    rateLimited?: boolean;
  }> {
    const startTime = Date.now();

    try {
      const response = await this.apiClient.post(endpoint, payload);
      const latency = Date.now() - startTime;

      return {
        success: true,
        latency,
        status: response.status,
      };
    } catch (error: any) {
      const latency = Date.now() - startTime;

      if (error.response?.status === 429) {
        this.rateLimitHits++;
        return {
          success: false,
          latency,
          status: 429,
          error: 'Rate Limited',
          rateLimited: true,
        };
      }

      const errorMsg = error.response?.status === 429 
        ? 'Rate Limited'
        : error.message || 'Unknown Error';
      
      this.errors[errorMsg] = (this.errors[errorMsg] || 0) + 1;

      return {
        success: false,
        latency,
        status: error.response?.status || 0,
        error: errorMsg,
      };
    }
  }

  /**
   * Ramp-up executor (gradually increase concurrency)
   */
  private async executeWithRampUp(
    endpoint: string,
    testType: string,
    duration: number,
    targetConcurrency: number,
    rampUpTime: number
  ): Promise<TestResult> {
    const startTime = Date.now();
    let currentConcurrency = 1;
    const concurrencyRampPerSecond = (targetConcurrency - 1) / rampUpTime;
    let lastSecond = 0;
    let requestCount = 0;
    let successCount = 0;

    const promises: Promise<any>[] = [];

    return new Promise((resolve) => {
      const interval = setInterval(async () => {
        const elapsed = (Date.now() - startTime) / 1000;

        if (elapsed >= duration) {
          clearInterval(interval);
          Promise.all(promises).then(() => {
            const results: TestResult = {
              testName: `${testType} Endpoint (Ramp-Up)`,
              success: successCount,
              failed: requestCount - successCount,
              totalRequests: requestCount,
              duration: duration,
              avgLatency: this.latencies.length > 0
                ? this.latencies.reduce((a, b) => a + b, 0) / this.latencies.length
                : 0,
              p50Latency: this.percentile(this.latencies, 50),
              p95Latency: this.percentile(this.latencies, 95),
              p99Latency: this.percentile(this.latencies, 99),
              minLatency: Math.min(...this.latencies),
              maxLatency: Math.max(...this.latencies),
              throughput: requestCount / (duration / 60),
              errorRate: requestCount > 0 ? ((requestCount - successCount) / requestCount) * 100 : 0,
              errors: this.errors,
              rateLimitHits: this.rateLimitHits,
            };
            resolve(results);
          });
          return;
        }

        // Ramp up concurrency
        const newSecond = Math.floor(elapsed);
        if (newSecond > lastSecond) {
          currentConcurrency = Math.min(
            targetConcurrency,
            1 + (newSecond * concurrencyRampPerSecond)
          );
          lastSecond = newSecond;
        }

        // Submit concurrent requests
        for (let i = 0; i < Math.max(1, Math.floor(currentConcurrency)); i++) {
          const payload = this.generateTestPayload(testType);
          const promise = this.executeRequest(endpoint, payload).then((result) => {
            requestCount++;
            if (result.success) successCount++;
            this.latencies.push(result.latency);
            this.metrics.allLatencies.push(result.latency);
            this.metrics.minLatency = Math.min(this.metrics.minLatency, result.latency);
            this.metrics.maxLatency = Math.max(this.metrics.maxLatency, result.latency);
          });
          promises.push(promise);
        }
      }, 100); // Check every 100ms for smooth ramp-up
    });
  }

  /**
   * Constant load executor
   */
  private async executeConstantLoad(
    endpoint: string,
    testType: string,
    duration: number,
    concurrency: number
  ): Promise<TestResult> {
    const startTime = Date.now();
    let requestCount = 0;
    let successCount = 0;
    let throughputSamples: number[] = [];

    return new Promise((resolve) => {
      const interval = setInterval(async () => {
        const elapsed = (Date.now() - startTime) / 1000;

        if (elapsed >= duration) {
          clearInterval(interval);

          const results: TestResult = {
            testName: `${testType} Endpoint (Constant Load)`,
            success: successCount,
            failed: requestCount - successCount,
            totalRequests: requestCount,
            duration: duration,
            avgLatency: this.latencies.length > 0
              ? this.latencies.reduce((a, b) => a + b, 0) / this.latencies.length
              : 0,
            p50Latency: this.percentile(this.latencies, 50),
            p95Latency: this.percentile(this.latencies, 95),
            p99Latency: this.percentile(this.latencies, 99),
            minLatency: Math.min(...this.latencies),
            maxLatency: Math.max(...this.latencies),
            throughput: requestCount / (duration / 60),
            errorRate: requestCount > 0 ? ((requestCount - successCount) / requestCount) * 100 : 0,
            errors: this.errors,
            rateLimitHits: this.rateLimitHits,
          };
          resolve(results);
          return;
        }

        // Submit concurrent requests
        const batchPromises = [];
        for (let i = 0; i < concurrency; i++) {
          const payload = this.generateTestPayload(testType);
          const promise = this.executeRequest(endpoint, payload).then((result) => {
            requestCount++;
            if (result.success) successCount++;
            this.latencies.push(result.latency);
            this.metrics.allLatencies.push(result.latency);
            this.metrics.minLatency = Math.min(this.metrics.minLatency, result.latency);
            this.metrics.maxLatency = Math.max(this.metrics.maxLatency, result.latency);
          });
          batchPromises.push(promise);
        }

        // Track throughput
        const currentThroughput = concurrency / 1;
        throughputSamples.push(currentThroughput);
        this.metrics.peakThroughput = Math.max(this.metrics.peakThroughput, ...throughputSamples);

        await Promise.all(batchPromises);
      }, 1000); // Submit batch every second
    });
  }

  /**
   * Calculate percentile of array
   */
  private percentile(arr: number[], p: number): number {
    if (arr.length === 0) return 0;
    const sorted = arr.sort((a, b) => a - b);
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[index] || 0;
  }

  /**
   * Test spike scenario (sudden traffic spike)
   */
  async testSpike(
    endpoint: string,
    testType: string,
    normalLoad: number,
    spikeLoad: number,
    spikeDuration: number
  ): Promise<TestResult> {
    console.log(`\n🔥 Testing Spike Scenario`);
    console.log(`   Normal: ${normalLoad} req/sec → Spike: ${spikeLoad} req/sec for ${spikeDuration}s`);

    const startTime = Date.now();
    let requestCount = 0;
    let successCount = 0;
    let isSpike = false;
    const spikeStartTime = Date.now() + 15000; // Start spike after 15 seconds

    return new Promise((resolve) => {
      const interval = setInterval(async () => {
        const elapsed = (Date.now() - startTime) / 1000;

        if (elapsed >= 60) { // 60 second test
          clearInterval(interval);

          const results: TestResult = {
            testName: 'Spike Test',
            success: successCount,
            failed: requestCount - successCount,
            totalRequests: requestCount,
            duration: 60,
            avgLatency: this.latencies.length > 0
              ? this.latencies.reduce((a, b) => a + b, 0) / this.latencies.length
              : 0,
            p50Latency: this.percentile(this.latencies, 50),
            p95Latency: this.percentile(this.latencies, 95),
            p99Latency: this.percentile(this.latencies, 99),
            minLatency: Math.min(...this.latencies),
            maxLatency: Math.max(...this.latencies),
            throughput: requestCount / 60 * 60,
            errorRate: requestCount > 0 ? ((requestCount - successCount) / requestCount) * 100 : 0,
            errors: this.errors,
            rateLimitHits: this.rateLimitHits,
          };
          resolve(results);
          return;
        }

        // Determine current load
        isSpike = Date.now() - spikeStartTime < (spikeDuration * 1000);
        const currentLoad = isSpike ? spikeLoad : normalLoad;

        // Submit requests
        const batchPromises = [];
        for (let i = 0; i < currentLoad; i++) {
          const payload = this.generateTestPayload(testType);
          const promise = this.executeRequest(endpoint, payload).then((result) => {
            requestCount++;
            if (result.success) successCount++;
            this.latencies.push(result.latency);
          });
          batchPromises.push(promise);
        }

        await Promise.allSettled(batchPromises);
      }, 1000);
    });
  }

  /**
   * Run all stress tests
   */
  async runAllTests(): Promise<void> {
    console.log('\n' + '='.repeat(60));
    console.log('🚀 ABLEKA LUMINA STRESS TEST SUITE');
    console.log('='.repeat(60));

    const results: TestResult[] = [];

    // Test 1: KYC Endpoint - Ramp Up
    console.log('\n📊 Test 1: KYC Endpoint (Ramp-Up Load)');
    this.latencies = [];
    this.errors = {};
    this.rateLimitHits = 0;
    const kycRampUp = await this.executeWithRampUp(
      '/api/v1/kyc-check',
      'kyc',
      60, // 60 second test
      100,  // target 100 concurrent users
      30    // 30 second ramp-up
    );
    results.push(kycRampUp);
    console.log(`✅ Completed: ${kycRampUp.totalRequests} requests, ${kycRampUp.avgLatency.toFixed(2)}ms avg latency`);

    // Test 2: AML Endpoint - Constant Load
    console.log('\n📊 Test 2: AML Endpoint (Constant Load)');
    this.latencies = [];
    this.errors = {};
    this.rateLimitHits = 0;
    const amlConstant = await this.executeConstantLoad(
      '/api/v1/aml-check',
      'aml',
      60, // 60 second test
      50  // 50 concurrent users
    );
    results.push(amlConstant);
    console.log(`✅ Completed: ${amlConstant.totalRequests} requests, ${amlConstant.avgLatency.toFixed(2)}ms avg latency`);

    // Test 3: Compliance Endpoint - Spike
    console.log('\n📊 Test 3: Spike Test (Traffic Spike)');
    this.latencies = [];
    this.errors = {};
    this.rateLimitHits = 0;
    const spikeTest = await this.testSpike(
      '/api/v1/compliance-check',
      'compliance',
      20,  // normal: 20 req/sec
      200, // spike to: 200 req/sec
      10   // for 10 seconds
    );
    results.push(spikeTest);
    console.log(`✅ Completed spike test`);

    // Print Results
    this.printResults(results);

    // Save results to file
    this.saveResults(results);
  }

  /**
   * Print formatted results
   */
  private printResults(results: TestResult[]): void {
    console.log('\n' + '='.repeat(60));
    console.log('📈 STRESS TEST RESULTS');
    console.log('='.repeat(60));

    results.forEach((result, index) => {
      console.log(`\n Test ${index + 1}: ${result.testName}`);
      console.log(' ' + '-'.repeat(56));
      console.log(`  Total Requests:       ${result.totalRequests}`);
      console.log(`  Successful:           ${result.success} (${((result.success / result.totalRequests) * 100).toFixed(2)}%)`);
      console.log(`  Failed:               ${result.failed}`);
      console.log(`  Error Rate:           ${result.errorRate.toFixed(2)}%`);
      console.log(`  Rate Limit Hits:      ${result.rateLimitHits}`);
      console.log('');
      console.log(`  Latency (ms):`);
      console.log(`    Min:                ${result.minLatency.toFixed(2)}`);
      console.log(`    Avg:                ${result.avgLatency.toFixed(2)}`);
      console.log(`    p50:                ${result.p50Latency.toFixed(2)}`);
      console.log(`    p95:                ${result.p95Latency.toFixed(2)}`);
      console.log(`    p99:                ${result.p99Latency.toFixed(2)}`);
      console.log(`    Max:                ${result.maxLatency.toFixed(2)}`);
      console.log('');
      console.log(`  Throughput:           ${result.throughput.toFixed(2)} req/min`);
      console.log('');
      
      if (Object.keys(result.errors).length > 0) {
        console.log(`  Errors:`);
        Object.entries(result.errors).forEach(([error, count]) => {
          console.log(`    ${error}: ${count}`);
        });
      }
    });

    // Summary
    let totalRequests = 0;
    let totalSuccessful = 0;
    results.forEach(r => {
      totalRequests += r.totalRequests;
      totalSuccessful += r.success;
    });

    console.log('\n' + '='.repeat(60));
    console.log('📊 OVERALL SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total Requests:   ${totalRequests}`);
    console.log(`Total Successful: ${totalSuccessful} (${((totalSuccessful / totalRequests) * 100).toFixed(2)}%)`);
    console.log(`Min Latency:      ${this.metrics.minLatency.toFixed(2)}ms`);
    console.log(`Max Latency:      ${this.metrics.maxLatency.toFixed(2)}ms`);
    console.log(`Avg Latency:      ${(this.metrics.allLatencies.reduce((a, b) => a + b, 0) / this.metrics.allLatencies.length).toFixed(2)}ms`);
    console.log(`Peak Throughput:  ${this.metrics.peakThroughput.toFixed(2)} req/sec`);
    console.log(`Avg Throughput:   ${(totalRequests / 180).toFixed(2)} req/sec (3 mins total)`);
    console.log('\n✅ Stress test completed successfully!');
    console.log(`📁 Results saved to: ${this.config.outputFile}\n`);
  }

  /**
   * Save results to JSON file
   */
  private saveResults(results: TestResult[]): void {
    const output = {
      timestamp: new Date().toISOString(),
      config: this.config,
      results: results,
      summary: {
        totalRequests: results.reduce((sum, r) => sum + r.totalRequests, 0),
        totalSuccessful: results.reduce((sum, r) => sum + r.success, 0),
        totalFailed: results.reduce((sum, r) => sum + r.failed, 0),
        averageLatency: this.metrics.allLatencies.length > 0
          ? this.metrics.allLatencies.reduce((a, b) => a + b, 0) / this.metrics.allLatencies.length
          : 0,
        p95Latency: this.percentile(this.metrics.allLatencies, 95),
        p99Latency: this.percentile(this.metrics.allLatencies, 99),
        minLatency: this.metrics.minLatency,
        maxLatency: this.metrics.maxLatency,
      },
    };

    fs.writeFileSync(this.config.outputFile, JSON.stringify(output, null, 2));
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const config: Partial<StressTestConfig> = {
    baseURL: 'http://localhost:4000',
    duration: 300,
    concurrency: 50,
    rampUp: 30,
    endpoint: '/api/v1/kyc-check',
  };

  // Parse command line arguments
  args.forEach(arg => {
    const [key, value] = arg.split('=');
    const cleanKey = key.replace('--', '') as keyof StressTestConfig;
    if (cleanKey === 'duration' || cleanKey === 'concurrency' || cleanKey === 'rampUp') {
      config[cleanKey] = parseInt(value, 10) as any;
    } else {
      config[cleanKey] = value as any;
    }
  });

  const stressTest = new ComplianceStressTest(config);

  try {
    await stressTest.runAllTests();
    process.exit(0);
  } catch (error) {
    console.error('❌ Stress test failed:', error);
    process.exit(1);
  }
}

main();
