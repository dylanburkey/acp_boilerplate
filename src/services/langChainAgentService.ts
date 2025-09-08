/**
 * @fileoverview LangChain-powered agent service example for AI-driven request processing.
 * This service demonstrates how to integrate LangChain with ACP for intelligent agent behavior.
 * @author ACP Integration Boilerplate
 * @license MIT
 */

import {IAgentService, AgentRequest, AgentResponse} from './agentService';
import {config} from '../config';
import {Logger} from '../utils/logger';

/**
 * LangChain-powered Agent Service for AI-driven request processing.
 * 
 * This service uses OpenAI through LangChain to provide intelligent responses
 * to buyer requests. It's designed for agents that need natural language
 * understanding and generation capabilities.
 * 
 * Features:
 * - Natural language request processing
 * - Intelligent response generation
 * - Customizable AI prompts and behavior
 * - Automatic request scope validation
 * 
 * @class LangChainAgentService
 * @implements {IAgentService}
 */
export class LangChainAgentService implements IAgentService {
  /** Logger instance for this service */
  private readonly logger = Logger;
  
  /** OpenAI chat model instance (lazy loaded) */
  private chatModel: any = null;
  
  /** Flag to track if LangChain dependencies are available */
  private langChainAvailable = false;

  /**
   * Initializes the LangChain service.
   * Dependencies are loaded lazily when first needed.
   */
  constructor() {
    // Dependencies will be loaded lazily when first needed
  }

  /**
   * Initializes LangChain dependencies if available.
   * Falls back gracefully if dependencies are not installed.
   * 
   * @private
   */
  private async initializeLangChain(): Promise<void> {
    try {
      // Check if OpenAI key is configured first
      if (!config.openaiApiKey) {
        this.logger.warn('OpenAI API key not configured. LangChain features will be limited.');
        return;
      }
      
      // Use eval to avoid TypeScript compilation issues with optional dependencies
      // This allows the code to compile even without LangChain installed
      const importLangChain = new Function('return import("@langchain/openai")');
      const langChainModule = await importLangChain();
      const {ChatOpenAI} = langChainModule;
      
      this.chatModel = new ChatOpenAI({
        openAIApiKey: config.openaiApiKey,
        modelName: 'gpt-3.5-turbo',
        temperature: 0.7,
        maxTokens: 500,
      });
      
      this.langChainAvailable = true;
      this.logger.info('LangChain integration initialized successfully');
    } catch (error) {
      this.logger.warn('LangChain dependencies not available. Install with: pnpm install @langchain/openai langchain @langchain/core');
      this.logger.debug('LangChain initialization error:', error);
    }
  }

  /**
   * Processes requests using LangChain AI capabilities.
   * Falls back to simple text processing if LangChain is not available.
   * 
   * @param request - The request from the buyer
   * @returns Promise resolving to the agent response
   */
  async processRequest(request: AgentRequest): Promise<AgentResponse> {
    const startTime = Date.now();
    
    try {
      this.logger.info(`Processing LangChain request for job ${request.jobId}`);

      // Validate request scope first
      if (!this.validateRequestScope(request)) {
        return {
          success: false,
          error: 'Request outside service scope - agent cannot process this type of request',
          errorType: 'SCOPE_ERROR',
          metadata: {
            processingTime: `${Date.now() - startTime}ms`,
            withinScope: false,
            usingLangChain: false
          }
        };
      }

      // Validate required parameters
      if (!request.params || typeof request.params !== 'object') {
        return {
          success: false,
          error: 'Invalid request parameters',
          errorType: 'VALIDATION_ERROR',
          metadata: {
            processingTime: `${Date.now() - startTime}ms`,
            withinScope: true,
            usingLangChain: this.langChainAvailable
          }
        };
      }

      let result: any;

      // Initialize LangChain if not already done
      if (!this.langChainAvailable && !this.chatModel) {
        await this.initializeLangChain();
      }
      
      if (this.langChainAvailable && this.chatModel) {
        // Use LangChain for intelligent processing
        result = await this.processWithLangChain(request);
      } else {
        // Fallback to simple processing
        result = await this.processWithoutLangChain(request);
      }

      return {
        success: true,
        data: result,
        metadata: {
          processedAt: new Date().toISOString(),
          serviceVersion: '1.0.0',
          processingTime: `${Date.now() - startTime}ms`,
          withinScope: true,
          usingLangChain: this.langChainAvailable
        }
      };
    } catch (error) {
      this.logger.error(`Error in LangChain service for job ${request.jobId}:`, error);

      let errorType: AgentResponse['errorType'] = 'PROCESSING_ERROR';
      let errorMessage = 'Unknown error occurred';
      
      if (error instanceof Error) {
        errorMessage = error.message;
        
        if (error.message.includes('API key') || error.message.includes('authentication')) {
          errorType = 'SERVICE_ERROR';
        } else if (error.message.includes('timeout')) {
          errorType = 'TIMEOUT_ERROR';
        }
      }

      return {
        success: false,
        error: errorMessage,
        errorType,
        metadata: {
          processingTime: `${Date.now() - startTime}ms`,
          withinScope: true,
          usingLangChain: this.langChainAvailable
        }
      };
    }
  }

  /**
   * Processes requests using LangChain AI capabilities.
   * 
   * @param request - The agent request
   * @returns Processing result with AI-generated content
   * @private
   */
  private async processWithLangChain(request: AgentRequest): Promise<any> {
    const params = request.params || {};
    const {prompt, context, requestType} = params;
    
    // Construct the AI prompt based on service description and user request
    const systemPrompt = `You are an AI agent providing the following service: ${config.serviceDescription}
    
Service Name: ${config.serviceName}
Your role: Process requests professionally and provide helpful, accurate responses.
Keep responses concise but informative.

User Request Type: ${requestType || 'general'}
${context ? `Additional Context: ${context}` : ''}`;

    const userPrompt = prompt || JSON.stringify(request.params);

    try {
      // Use LangChain to generate response
      const response = await this.chatModel.invoke([
        {role: 'system', content: systemPrompt},
        {role: 'user', content: userPrompt}
      ]);

      return {
        response: response.content,
        requestType: requestType || 'general',
        processedWith: 'LangChain + OpenAI',
        originalPrompt: prompt,
        serviceInfo: {
          name: config.serviceName,
          description: config.serviceDescription
        }
      };
    } catch (error) {
      this.logger.error('LangChain processing error:', error);
      throw new Error(`AI processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Simple fallback processing when LangChain is not available.
   * 
   * @param request - The agent request
   * @returns Simple processing result
   * @private
   */
  private async processWithoutLangChain(request: AgentRequest): Promise<any> {
    const params = request.params || {};
    const {prompt, requestType} = params;
    
    return {
      response: `Thank you for your request. Your ${requestType || 'general'} request has been processed by ${config.serviceName}.`,
      requestType: requestType || 'general',
      processedWith: 'Simple Text Processing',
      originalPrompt: prompt,
      note: 'Install LangChain dependencies for AI-powered responses',
      serviceInfo: {
        name: config.serviceName,
        description: config.serviceDescription
      }
    };
  }

  /**
   * Validates if a request is within the agent's service scope.
   * LangChain agents typically handle text-based requests.
   * 
   * @param request - The request to validate
   * @returns True if request is within scope
   */
  validateRequestScope(request: AgentRequest): boolean {
    // Basic validation
    if (!request.jobId || !request.params) {
      this.logger.warn(`Request validation failed: Missing jobId or params for job ${request.jobId}`);
      return false;
    }

    // LangChain agents typically handle text-based requests
    const requestType = request.params.requestType;
    const allowedTypes = [
      'text-generation',
      'question-answering', 
      'analysis',
      'summarization',
      'translation',
      'writing',
      'general'
    ];

    if (requestType && !allowedTypes.includes(requestType)) {
      this.logger.warn(`Request type '${requestType}' not supported by LangChain agent service`);
      this.logger.info(`Supported types: ${allowedTypes.join(', ')}`);
      return false;
    }

    // Validate that we have some text content to work with
    const params = request.params || {};
    const {prompt, text, content, message} = params;
    if (!prompt && !text && !content && !message) {
      this.logger.warn(`Request missing text content for LangChain processing`);
      return false;
    }

    return true;
  }

  /**
   * Validates that the LangChain service is ready.
   * 
   * @returns True if service is ready
   */
  async validateService(): Promise<boolean> {
    try {
      // Basic service configuration validation
      if (!config.serviceName || !config.serviceDescription) {
        this.logger.error('Service validation failed: Missing service name or description');
        return false;
      }

      // Check if LangChain is available and configured
      if (this.langChainAvailable && this.chatModel) {
        // Test the AI model with a simple request
        try {
          await this.chatModel.invoke([
            {role: 'user', content: 'Test connection'}
          ]);
          this.logger.info('LangChain service validation successful - AI model responsive');
        } catch (error) {
          this.logger.warn('LangChain model test failed, but service can still operate in fallback mode:', error);
        }
      } else {
        this.logger.info('LangChain service validation: Running in fallback mode (no AI capabilities)');
      }

      return true;
    } catch (error) {
      this.logger.error('LangChain service validation failed:', error);
      return false;
    }
  }
}