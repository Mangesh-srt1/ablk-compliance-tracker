/**
 * Workflow API Service
 * Handles all API calls to the workflow backend service
 */

import axios, { AxiosInstance } from 'axios';
import { Workflow, WorkflowTestResult, ExecutionContext } from '../types/workflow.types';

const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api/v1';

class WorkflowAPIService {
  private apiClient: AxiosInstance;

  constructor() {
    this.apiClient = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add auth token to requests if available
    this.apiClient.interceptors.request.use((config) => {
      const token = localStorage.getItem('authToken');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });
  }

  /**
   * Create a new workflow
   */
  async createWorkflow(workflow: Omit<Workflow, 'id' | 'createdAt' | 'updatedAt'>): Promise<Workflow> {
    try {
      const response = await this.apiClient.post('/workflows', workflow);
      return response.data;
    } catch (error: any) {
      throw new Error(`Failed to create workflow: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Fetch workflow by ID
   */
  async getWorkflow(workflowId: string): Promise<Workflow> {
    try {
      const response = await this.apiClient.get(`/workflows/${workflowId}`);
      return response.data;
    } catch (error: any) {
      throw new Error(`Failed to fetch workflow: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * List all workflows (with pagination)
   */
  async listWorkflows(page = 1, limit = 20): Promise<{ workflows: Workflow[]; total: number }> {
    try {
      const response = await this.apiClient.get('/workflows', {
        params: { page, limit },
      });
      return response.data;
    } catch (error: any) {
      throw new Error(`Failed to list workflows: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Update an existing workflow (draft only)
   */
  async updateWorkflow(workflowId: string, updates: Partial<Workflow>): Promise<Workflow> {
    try {
      const response = await this.apiClient.put(`/workflows/${workflowId}`, updates);
      return response.data;
    } catch (error: any) {
      throw new Error(`Failed to update workflow: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Delete a workflow (draft only)
   */
  async deleteWorkflow(workflowId: string): Promise<void> {
    try {
      await this.apiClient.delete(`/workflows/${workflowId}`);
    } catch (error: any) {
      throw new Error(`Failed to delete workflow: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Publish a workflow (move from draft to active)
   */
  async publishWorkflow(workflowId: string): Promise<Workflow> {
    try {
      const response = await this.apiClient.post(`/workflows/${workflowId}/publish`);
      return response.data;
    } catch (error: any) {
      throw new Error(`Failed to publish workflow: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Test a workflow with sample data (dry-run)
   */
  async testWorkflow(workflowId: string, context: ExecutionContext): Promise<WorkflowTestResult> {
    try {
      const response = await this.apiClient.post(`/workflows/${workflowId}/test`, { context });
      return response.data;
    } catch (error: any) {
      throw new Error(`Failed to test workflow: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Get workflow versions
   */
  async getWorkflowVersions(workflowId: string): Promise<Workflow[]> {
    try {
      const response = await this.apiClient.get(`/workflows/versions/${workflowId}`);
      return response.data.versions;
    } catch (error: any) {
      throw new Error(`Failed to fetch versions: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Rollback to previous version
   */
  async rollbackWorkflow(workflowId: string, version: number): Promise<Workflow> {
    try {
      const response = await this.apiClient.post(`/workflows/${workflowId}/rollback`, { version });
      return response.data;
    } catch (error: any) {
      throw new Error(`Failed to rollback workflow: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Get deployment history
   */
  async getDeploymentHistory(workflowId: string): Promise<any[]> {
    try {
      const response = await this.apiClient.get(`/workflows/${workflowId}/deployments`);
      return response.data.deployments;
    } catch (error: any) {
      throw new Error(`Failed to fetch deployment history: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Clone a workflow
   */
  async cloneWorkflow(workflowId: string, newName: string): Promise<Workflow> {
    try {
      const response = await this.apiClient.post(`/workflows/${workflowId}/clone`, { name: newName });
      return response.data;
    } catch (error: any) {
      throw new Error(`Failed to clone workflow: ${error.response?.data?.message || error.message}`);
    }
  }
}

export const workflowAPI = new WorkflowAPIService();
export default WorkflowAPIService;
