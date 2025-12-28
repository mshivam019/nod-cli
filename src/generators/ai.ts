import * as fs from 'fs-extra';
import * as path from 'path';
import { ProjectConfig } from '../types/index.js';

export async function generateRAGService(projectPath: string, config: ProjectConfig, ext: string) {
  const isTS = ext === 'ts';
  
  // Retriever utility
  const retrieverContent = isTS
    ? `import { OpenAIEmbeddings } from '@langchain/openai';
import { createClient } from '@supabase/supabase-js';
import config from '../config/config.js';

const openAIApiKey = config.openaiApiKey;

export const embeddings = new OpenAIEmbeddings({ 
  openAIApiKey,
  model: 'text-embedding-3-small'
});

const sbApiKey = config.supabaseApiKey;
const sbUrl = config.supabaseUrl;
export const client = createClient(sbUrl!, sbApiKey!);

export const supabaseAuthAdmin = client.auth.admin;
`
    : `import { OpenAIEmbeddings } from '@langchain/openai';
import { createClient } from '@supabase/supabase-js';
import config from '../config/config.js';

const openAIApiKey = config.openaiApiKey;

export const embeddings = new OpenAIEmbeddings({ 
  openAIApiKey,
  model: 'text-embedding-3-small'
});

const sbApiKey = config.supabaseApiKey;
const sbUrl = config.supabaseUrl;
export const client = createClient(sbUrl, sbApiKey);

export const supabaseAuthAdmin = client.auth.admin;
`;

  // RAG Service
  const ragServiceContent = isTS
    ? `import logger from '../utils/logger.js';
import { client as supabaseClient, embeddings } from '../utils/retriever.js';

// Create embedding for query text
const createQueryEmbedding = async (text: string): Promise<number[]> => {
  try {
    const [embedding] = await embeddings.embedDocuments([text]);
    return embedding;
  } catch (error: any) {
    logger.error('Error creating query embedding:', error.message);
    throw error;
  }
};

interface VectorSearchOptions {
  matchCount?: number;
  tableName?: string;
  matchFunction?: string;
  minSimilarity?: number;
}

interface SearchResult {
  content: string;
  metadata: any;
  similarity: number;
}

const ragService = {
  /**
   * Perform vector similarity search
   */
  async vectorSearch(queryText: string, options: VectorSearchOptions = {}): Promise<SearchResult[]> {
    const { 
      matchCount = 10, 
      matchFunction = 'match_documents',
      minSimilarity = 0.5 
    } = options;
    
    try {
      const queryEmbedding = await createQueryEmbedding(queryText);
      
      const { data, error } = await supabaseClient.rpc(matchFunction, {
        query_embedding: queryEmbedding,
        match_count: matchCount,
      });
      
      if (error) {
        logger.error('Vector search failed:', error.message);
        throw error;
      }
      
      return (data || [])
        .filter((d: any) => d.similarity >= minSimilarity)
        .map((d: any) => ({
          content: d.content,
          metadata: d.metadata,
          similarity: d.similarity
        }));
    } catch (error: any) {
      logger.error('Error in vector search:', error.message);
      throw error;
    }
  },

  /**
   * Get context for RAG-enhanced responses
   */
  async getContext(query: string, options: VectorSearchOptions = {}): Promise<string> {
    const results = await this.vectorSearch(query, options);
    
    if (results.length === 0) {
      return '';
    }
    
    return results
      .map((r, i) => \`[Source \${i + 1}] (Relevance: \${(r.similarity * 100).toFixed(1)}%)\\n\${r.content}\`)
      .join('\\n\\n');
  },

  /**
   * Create and store embeddings for documents
   */
  async createEmbedding(text: string): Promise<number[]> {
    return createQueryEmbedding(text);
  },

  /**
   * Store document with embedding
   */
  async storeDocument(
    tableName: string,
    content: string,
    metadata: any = {}
  ): Promise<void> {
    try {
      const embedding = await createQueryEmbedding(content);
      
      const { error } = await supabaseClient
        .from(tableName)
        .insert({
          content,
          embedding,
          metadata
        });
      
      if (error) {
        logger.error('Error storing document:', error.message);
        throw error;
      }
      
      logger.info('Document stored successfully');
    } catch (error: any) {
      logger.error('Error in storeDocument:', error.message);
      throw error;
    }
  }
};

export default ragService;
`
    : `import logger from '../utils/logger.js';
import { client as supabaseClient, embeddings } from '../utils/retriever.js';

// Create embedding for query text
const createQueryEmbedding = async (text) => {
  try {
    const [embedding] = await embeddings.embedDocuments([text]);
    return embedding;
  } catch (error) {
    logger.error('Error creating query embedding:', error.message);
    throw error;
  }
};

const ragService = {
  /**
   * Perform vector similarity search
   */
  async vectorSearch(queryText, options = {}) {
    const { 
      matchCount = 10, 
      matchFunction = 'match_documents',
      minSimilarity = 0.5 
    } = options;
    
    try {
      const queryEmbedding = await createQueryEmbedding(queryText);
      
      const { data, error } = await supabaseClient.rpc(matchFunction, {
        query_embedding: queryEmbedding,
        match_count: matchCount,
      });
      
      if (error) {
        logger.error('Vector search failed:', error.message);
        throw error;
      }
      
      return (data || [])
        .filter((d) => d.similarity >= minSimilarity)
        .map((d) => ({
          content: d.content,
          metadata: d.metadata,
          similarity: d.similarity
        }));
    } catch (error) {
      logger.error('Error in vector search:', error.message);
      throw error;
    }
  },

  /**
   * Get context for RAG-enhanced responses
   */
  async getContext(query, options = {}) {
    const results = await this.vectorSearch(query, options);
    
    if (results.length === 0) {
      return '';
    }
    
    return results
      .map((r, i) => \`[Source \${i + 1}] (Relevance: \${(r.similarity * 100).toFixed(1)}%)\\n\${r.content}\`)
      .join('\\n\\n');
  },

  /**
   * Create and store embeddings for documents
   */
  async createEmbedding(text) {
    return createQueryEmbedding(text);
  },

  /**
   * Store document with embedding
   */
  async storeDocument(tableName, content, metadata = {}) {
    try {
      const embedding = await createQueryEmbedding(content);
      
      const { error } = await supabaseClient
        .from(tableName)
        .insert({
          content,
          embedding,
          metadata
        });
      
      if (error) {
        logger.error('Error storing document:', error.message);
        throw error;
      }
      
      logger.info('Document stored successfully');
    } catch (error) {
      logger.error('Error in storeDocument:', error.message);
      throw error;
    }
  }
};

export default ragService;
`;

  await fs.ensureDir(path.join(projectPath, 'src/utils'));
  await fs.outputFile(path.join(projectPath, `src/utils/retriever.${ext}`), retrieverContent);
  await fs.outputFile(path.join(projectPath, `src/services/rag.service.${ext}`), ragServiceContent);
}

export async function generateChatService(projectPath: string, config: ProjectConfig, ext: string) {
  const hasLangfuse = config.ai?.langfuse;
  const isTS = ext === 'ts';

  const chatServiceContent = isTS
    ? `import logger from '../utils/logger.js';
import { supabase } from '../helpers/supabase.helper.js';
import { ChatOpenAI } from '@langchain/openai';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';
${hasLangfuse ? `import { langfuseHandler } from '../config/config.js';` : ''}

interface Message {
  id: string;
  conversation_id: string;
  message_type: 'user' | 'assistant' | 'system';
  content: string;
  metadata?: any;
  created_at: string;
}

interface Conversation {
  id: string;
  user_id: string;
  title?: string;
  module?: string;
  metadata?: any;
  created_at: string;
}

const chatService = {
  /**
   * Create a new conversation
   */
  async createConversation(
    userId: string, 
    module: string = 'general', 
    modelName: string = 'gpt-4o-mini',
    title?: string
  ): Promise<Conversation> {
    try {
      const { data, error } = await supabase
        .from('conversations')
        .insert({
          user_id: userId,
          title: title,
          module: module.trim().toLowerCase(),
          metadata: { model_name: modelName }
        })
        .select()
        .single();

      if (error) {
        logger.error('Error creating conversation:', error);
        throw error;
      }

      logger.info('Conversation created', { conversationId: data.id, userId, module });
      return data;
    } catch (error) {
      logger.error('Error in createConversation:', error);
      throw error;
    }
  },

  /**
   * Add a message to conversation
   */
  async addMessage(
    conversationId: string, 
    messageType: 'user' | 'assistant' | 'system', 
    content: string, 
    metadata: any = {}
  ): Promise<Message> {
    try {
      const { data, error } = await supabase
        .from('conversation_messages')
        .insert({
          conversation_id: conversationId,
          message_type: messageType,
          content: content,
          metadata: metadata
        })
        .select()
        .single();

      if (error) {
        logger.error('Error adding message:', error);
        throw error;
      }
      return data;
    } catch (error) {
      logger.error('Error in addMessage:', error);
      throw error;
    }
  },

  /**
   * Get conversation history
   */
  async getConversationHistory(conversationId: string, limit: number = 50): Promise<Message[]> {
    try {
      const { data, error } = await supabase
        .from('conversation_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })
        .limit(limit);

      if (error) {
        logger.error('Error getting conversation history:', error);
        throw error;
      }
      return data || [];
    } catch (error) {
      logger.error('Error in getConversationHistory:', error);
      throw error;
    }
  },

  /**
   * Generate AI response
   */
  async generateResponse(
    messages: { role: string; content: string }[],
    options: {
      model?: string;
      temperature?: number;
      maxTokens?: number;
      systemPrompt?: string;
    } = {}
  ): Promise<string> {
    const {
      model = 'gpt-4o-mini',
      temperature = 0.7,
      maxTokens = 2000,
      systemPrompt = 'You are a helpful assistant.'
    } = options;

    try {
      const llm = new ChatOpenAI({
        model,
        temperature,
        maxTokens,
        openAIApiKey: process.env.OPENAI_API_KEY,
        ${hasLangfuse ? `callbacks: [langfuseHandler],` : ''}
      });

      const formattedMessages: [string, string][] = [
        ['system', systemPrompt],
        ...messages.map(m => [m.role, m.content] as [string, string])
      ];

      const prompt = ChatPromptTemplate.fromMessages(formattedMessages);
      const chain = prompt.pipe(llm).pipe(new StringOutputParser());
      
      const response = await chain.invoke({});
      return response;
    } catch (error) {
      logger.error('Error generating AI response:', error);
      throw error;
    }
  },

  /**
   * Generate AI title for conversation
   */
  async generateAITitle(firstMessage: string): Promise<string> {
    try {
      const llm = new ChatOpenAI({
        model: 'gpt-4o-mini',
        temperature: 0,
        maxTokens: 50,
        openAIApiKey: process.env.OPENAI_API_KEY,
      });

      const prompt = ChatPromptTemplate.fromMessages([
        ['system', 'Generate a short, concise title (max 6 words) for a conversation. Return only the title, no quotes.'],
        ['human', 'User message: {message}\\n\\nTitle:']
      ]);

      const chain = prompt.pipe(llm).pipe(new StringOutputParser());
      const aiTitle = await chain.invoke({ message: firstMessage.substring(0, 200) });

      return aiTitle.replace(/['"]/g, '').trim().substring(0, 60);
    } catch (error) {
      logger.error('Error generating AI title:', error);
      return firstMessage.length > 50 ? firstMessage.substring(0, 47) + '...' : firstMessage;
    }
  },

  /**
   * Update conversation title
   */
  async updateConversationTitle(conversationId: string, title: string, userId?: string): Promise<Conversation> {
    try {
      let query = supabase
        .from('conversations')
        .update({ title: title })
        .eq('id', conversationId);

      if (userId) {
        query = query.eq('user_id', userId);
      }

      const { data, error } = await query.select().single();

      if (error) {
        logger.error('Error updating conversation title:', error);
        throw error;
      }
      return data;
    } catch (error) {
      logger.error('Error in updateConversationTitle:', error);
      throw error;
    }
  },

  /**
   * Delete conversation (soft delete)
   */
  async deleteConversation(conversationId: string, _userId: string): Promise<Conversation> {
    try {
      const { data: existing, error: fetchError } = await supabase
        .from('conversations')
        .select('user_id, metadata')
        .eq('id', conversationId)
        .single();

      if (fetchError) throw fetchError;

      const updatedMetadata = {
        ...existing.metadata,
        deleted_user_id: existing.user_id,
      };

      const { data, error } = await supabase
        .from('conversations')
        .update({ user_id: null, metadata: updatedMetadata })
        .eq('id', conversationId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      logger.error('Error in deleteConversation:', error);
      throw error;
    }
  }
};

export default chatService;
`
    : `import logger from '../utils/logger.js';
import { supabase } from '../helpers/supabase.helper.js';
import { ChatOpenAI } from '@langchain/openai';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';
${hasLangfuse ? `import { langfuseHandler } from '../config/config.js';` : ''}

const chatService = {
  /**
   * Create a new conversation
   */
  async createConversation(userId, module = 'general', modelName = 'gpt-4o-mini', title) {
    try {
      const { data, error } = await supabase
        .from('conversations')
        .insert({
          user_id: userId,
          title: title,
          module: module.trim().toLowerCase(),
          metadata: { model_name: modelName }
        })
        .select()
        .single();

      if (error) {
        logger.error('Error creating conversation:', error);
        throw error;
      }

      logger.info('Conversation created', { conversationId: data.id, userId, module });
      return data;
    } catch (error) {
      logger.error('Error in createConversation:', error);
      throw error;
    }
  },

  /**
   * Add a message to conversation
   */
  async addMessage(conversationId, messageType, content, metadata = {}) {
    try {
      const { data, error } = await supabase
        .from('conversation_messages')
        .insert({
          conversation_id: conversationId,
          message_type: messageType,
          content: content,
          metadata: metadata
        })
        .select()
        .single();

      if (error) {
        logger.error('Error adding message:', error);
        throw error;
      }
      return data;
    } catch (error) {
      logger.error('Error in addMessage:', error);
      throw error;
    }
  },

  /**
   * Get conversation history
   */
  async getConversationHistory(conversationId, limit = 50) {
    try {
      const { data, error } = await supabase
        .from('conversation_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })
        .limit(limit);

      if (error) {
        logger.error('Error getting conversation history:', error);
        throw error;
      }
      return data || [];
    } catch (error) {
      logger.error('Error in getConversationHistory:', error);
      throw error;
    }
  },

  /**
   * Generate AI response
   */
  async generateResponse(messages, options = {}) {
    const {
      model = 'gpt-4o-mini',
      temperature = 0.7,
      maxTokens = 2000,
      systemPrompt = 'You are a helpful assistant.'
    } = options;

    try {
      const llm = new ChatOpenAI({
        model,
        temperature,
        maxTokens,
        openAIApiKey: process.env.OPENAI_API_KEY,
        ${hasLangfuse ? `callbacks: [langfuseHandler],` : ''}
      });

      const formattedMessages = [
        ['system', systemPrompt],
        ...messages.map(m => [m.role, m.content])
      ];

      const prompt = ChatPromptTemplate.fromMessages(formattedMessages);
      const chain = prompt.pipe(llm).pipe(new StringOutputParser());
      
      const response = await chain.invoke({});
      return response;
    } catch (error) {
      logger.error('Error generating AI response:', error);
      throw error;
    }
  },

  /**
   * Generate AI title for conversation
   */
  async generateAITitle(firstMessage) {
    try {
      const llm = new ChatOpenAI({
        model: 'gpt-4o-mini',
        temperature: 0,
        maxTokens: 50,
        openAIApiKey: process.env.OPENAI_API_KEY,
      });

      const prompt = ChatPromptTemplate.fromMessages([
        ['system', 'Generate a short, concise title (max 6 words) for a conversation. Return only the title, no quotes.'],
        ['human', 'User message: {message}\\n\\nTitle:']
      ]);

      const chain = prompt.pipe(llm).pipe(new StringOutputParser());
      const aiTitle = await chain.invoke({ message: firstMessage.substring(0, 200) });

      return aiTitle.replace(/['"]/g, '').trim().substring(0, 60);
    } catch (error) {
      logger.error('Error generating AI title:', error);
      return firstMessage.length > 50 ? firstMessage.substring(0, 47) + '...' : firstMessage;
    }
  },

  /**
   * Update conversation title
   */
  async updateConversationTitle(conversationId, title, userId) {
    try {
      let query = supabase
        .from('conversations')
        .update({ title: title })
        .eq('id', conversationId);

      if (userId) {
        query = query.eq('user_id', userId);
      }

      const { data, error } = await query.select().single();

      if (error) {
        logger.error('Error updating conversation title:', error);
        throw error;
      }
      return data;
    } catch (error) {
      logger.error('Error in updateConversationTitle:', error);
      throw error;
    }
  },

  /**
   * Delete conversation (soft delete)
   */
  async deleteConversation(conversationId, _userId) {
    try {
      const { data: existing, error: fetchError } = await supabase
        .from('conversations')
        .select('user_id, metadata')
        .eq('id', conversationId)
        .single();

      if (fetchError) throw fetchError;

      const updatedMetadata = {
        ...existing.metadata,
        deleted_user_id: existing.user_id,
      };

      const { data, error } = await supabase
        .from('conversations')
        .update({ user_id: null, metadata: updatedMetadata })
        .eq('id', conversationId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      logger.error('Error in deleteConversation:', error);
      throw error;
    }
  }
};

export default chatService;
`;

  await fs.outputFile(path.join(projectPath, `src/services/chat.service.${ext}`), chatServiceContent);
}

export async function generateModelConfig(projectPath: string, ext: string) {
  const isTS = ext === 'ts';
  
  const modelConfigContent = isTS
    ? `/**
 * Model Configuration Utility
 * Manages model selection based on request origin domains.
 */

import logger from './logger.js';

class ModelConfig {
  private config: Record<string, string>;

  constructor() {
    this.config = this.loadConfig();
  }

  private loadConfig(): Record<string, string> {
    try {
      const configJson = process.env.MODEL_DOMAIN_MAPPING;
      if (!configJson) {
        logger.warn('MODEL_DOMAIN_MAPPING not found. Using default configuration.');
        return this.getDefaultConfig();
      }

      const config = JSON.parse(configJson);
      logger.info('Model domain mapping loaded successfully');
      return config;
    } catch (error: any) {
      logger.error('Error loading model configuration:', error.message);
      return this.getDefaultConfig();
    }
  }

  private getDefaultConfig(): Record<string, string> {
    return {
      'o3': 'o3',
      'mini': 'gpt-4o-mini',
      'default': 'gpt-4o'
    };
  }

  extractDomain(req: any): string | null {
    try {
      if (req.headers.origin) {
        const url = new URL(req.headers.origin);
        return url.hostname;
      }
      if (req.headers.referer) {
        const url = new URL(req.headers.referer);
        return url.hostname;
      }
      if (req.headers.host) {
        return req.headers.host.split(':')[0];
      }
      return null;
    } catch (error) {
      return null;
    }
  }

  getModelForRequest(req: any): string {
    const domain = this.extractDomain(req);
    
    if (!domain) {
      return this.config.default;
    }

    const domainLower = domain.toLowerCase();
    
    for (const [prefix, model] of Object.entries(this.config)) {
      if (prefix === 'default') continue;
      
      if (domainLower.startsWith(prefix.toLowerCase())) {
        logger.debug(\`Domain '\${domain}' matches prefix '\${prefix}', using model '\${model}'\`);
        return model;
      }
    }

    return this.config.default;
  }

  getConfig(): Record<string, string> {
    return { ...this.config };
  }
}

export default new ModelConfig();
`
    : `/**
 * Model Configuration Utility
 * Manages model selection based on request origin domains.
 */

import logger from './logger.js';

class ModelConfig {
  constructor() {
    this.config = this.loadConfig();
  }

  loadConfig() {
    try {
      const configJson = process.env.MODEL_DOMAIN_MAPPING;
      if (!configJson) {
        logger.warn('MODEL_DOMAIN_MAPPING not found. Using default configuration.');
        return this.getDefaultConfig();
      }

      const config = JSON.parse(configJson);
      logger.info('Model domain mapping loaded successfully');
      return config;
    } catch (error) {
      logger.error('Error loading model configuration:', error.message);
      return this.getDefaultConfig();
    }
  }

  getDefaultConfig() {
    return {
      'o3': 'o3',
      'mini': 'gpt-4o-mini',
      'default': 'gpt-4o'
    };
  }

  extractDomain(req) {
    try {
      if (req.headers.origin) {
        const url = new URL(req.headers.origin);
        return url.hostname;
      }
      if (req.headers.referer) {
        const url = new URL(req.headers.referer);
        return url.hostname;
      }
      if (req.headers.host) {
        return req.headers.host.split(':')[0];
      }
      return null;
    } catch (error) {
      return null;
    }
  }

  getModelForRequest(req) {
    const domain = this.extractDomain(req);
    
    if (!domain) {
      return this.config.default;
    }

    const domainLower = domain.toLowerCase();
    
    for (const [prefix, model] of Object.entries(this.config)) {
      if (prefix === 'default') continue;
      
      if (domainLower.startsWith(prefix.toLowerCase())) {
        logger.debug(\`Domain '\${domain}' matches prefix '\${prefix}', using model '\${model}'\`);
        return model;
      }
    }

    return this.config.default;
  }

  getConfig() {
    return { ...this.config };
  }
}

export default new ModelConfig();
`;

  await fs.outputFile(path.join(projectPath, `src/utils/modelConfig.${ext}`), modelConfigContent);
}

export async function generateSourceConfig(projectPath: string, ext: string) {
  const isTS = ext === 'ts';
  
  const sourceConfigContent = isTS
    ? `/**
 * Source Configuration Utility
 * Manages source determination based on request origin domains.
 */

import logger from './logger.js';

class SourceConfig {
  extractDomain(req: any): string | null {
    try {
      if (req.headers.origin) {
        const url = new URL(req.headers.origin);
        return url.hostname;
      }
      if (req.headers.referer) {
        const url = new URL(req.headers.referer);
        return url.hostname;
      }
      if (req.headers.host) {
        return req.headers.host.split(':')[0];
      }
      return null;
    } catch (error) {
      return null;
    }
  }

  getSourceForRequest(req: any): string {
    const domain = this.extractDomain(req);
    
    if (!domain) {
      logger.debug('No domain found in request, using default source');
      return 'default';
    }

    const domainLower = domain.toLowerCase();
    const domainParts = domainLower.split('-');
    const firstPart = domainParts[0];
    
    if (firstPart && firstPart !== 'localhost') {
      logger.debug(\`Domain '\${domain}' split to '\${firstPart}'\`);
      return firstPart;
    }

    return 'default';
  }
}

export default new SourceConfig();
`
    : `/**
 * Source Configuration Utility
 * Manages source determination based on request origin domains.
 */

import logger from './logger.js';

class SourceConfig {
  extractDomain(req) {
    try {
      if (req.headers.origin) {
        const url = new URL(req.headers.origin);
        return url.hostname;
      }
      if (req.headers.referer) {
        const url = new URL(req.headers.referer);
        return url.hostname;
      }
      if (req.headers.host) {
        return req.headers.host.split(':')[0];
      }
      return null;
    } catch (error) {
      return null;
    }
  }

  getSourceForRequest(req) {
    const domain = this.extractDomain(req);
    
    if (!domain) {
      logger.debug('No domain found in request, using default source');
      return 'default';
    }

    const domainLower = domain.toLowerCase();
    const domainParts = domainLower.split('-');
    const firstPart = domainParts[0];
    
    if (firstPart && firstPart !== 'localhost') {
      logger.debug(\`Domain '\${domain}' split to '\${firstPart}'\`);
      return firstPart;
    }

    return 'default';
  }
}

export default new SourceConfig();
`;

  await fs.outputFile(path.join(projectPath, `src/utils/sourceConfig.${ext}`), sourceConfigContent);
}

export async function generateSelectionMiddleware(projectPath: string, ext: string, includeModel: boolean = true, includeSource: boolean = true) {
  const isTS = ext === 'ts';
  
  // Model Selection Middleware
  if (includeModel) {
    const modelSelectionContent = isTS
      ? `/**
 * Model Selection Middleware
 * Automatically selects the appropriate model based on request origin domain.
 */

import modelConfig from '../utils/modelConfig.js';
import logger from '../utils/logger.js';

export const modelSelection = (req: any, _res: any, next: any) => {
  try {
    const selectedModel = modelConfig.getModelForRequest(req);
    req.selectedModel = selectedModel;
    
    logger.debug(\`Request from \${modelConfig.extractDomain(req) || 'unknown'} assigned model: \${selectedModel}\`);
    
    next();
  } catch (error) {
    logger.error('Error in model selection middleware:', error);
    req.selectedModel = 'gpt-4o';
    next();
  }
};

export const getModelForRequest = (req: any): string => {
  return modelConfig.getModelForRequest(req);
};

export default modelSelection;
`
      : `/**
 * Model Selection Middleware
 * Automatically selects the appropriate model based on request origin domain.
 */

import modelConfig from '../utils/modelConfig.js';
import logger from '../utils/logger.js';

export const modelSelection = (req, res, next) => {
  try {
    const selectedModel = modelConfig.getModelForRequest(req);
    req.selectedModel = selectedModel;
    
    logger.debug(\`Request from \${modelConfig.extractDomain(req) || 'unknown'} assigned model: \${selectedModel}\`);
    
    next();
  } catch (error) {
    logger.error('Error in model selection middleware:', error);
    req.selectedModel = 'gpt-4o';
    next();
  }
};

export const getModelForRequest = (req) => {
  return modelConfig.getModelForRequest(req);
};

export default modelSelection;
`;

    await fs.outputFile(path.join(projectPath, `src/middleware/modelSelection.middleware.${ext}`), modelSelectionContent);
  }

  // Source Selection Middleware
  if (includeSource) {
    await generateSourceSelectionMiddleware(projectPath, ext);
  }
}

export async function generateSourceSelectionMiddleware(projectPath: string, ext: string) {
  const isTS = ext === 'ts';
  
  const sourceSelectionContent = isTS
    ? `/**
 * Source Selection Middleware
 * Automatically determines the request source based on the request origin domain.
 */

import sourceConfig from '../utils/sourceConfig.js';
import logger from '../utils/logger.js';

export const sourceSelection = (req: any, _res: any, next: any) => {
  try {
    const requestSource = sourceConfig.getSourceForRequest(req);
    const domain = sourceConfig.extractDomain(req);
    
    req.requestSource = requestSource;
    req.requestDomain = domain;
    
    logger.debug(\`Request from \${domain || 'unknown'} assigned source: \${requestSource}\`);
    
    next();
  } catch (error) {
    logger.error('Error in source selection middleware:', error);
    req.requestSource = 'default';
    next();
  }
};

export const getSourceForRequest = (req: any): string => {
  return sourceConfig.getSourceForRequest(req);
};

export default sourceSelection;
`
    : `/**
 * Source Selection Middleware
 * Automatically determines the request source based on the request origin domain.
 */

import sourceConfig from '../utils/sourceConfig.js';
import logger from '../utils/logger.js';

export const sourceSelection = (req, res, next) => {
  try {
    const requestSource = sourceConfig.getSourceForRequest(req);
    const domain = sourceConfig.extractDomain(req);
    
    req.requestSource = requestSource;
    req.requestDomain = domain;
    
    logger.debug(\`Request from \${domain || 'unknown'} assigned source: \${requestSource}\`);
    
    next();
  } catch (error) {
    logger.error('Error in source selection middleware:', error);
    req.requestSource = 'default';
    next();
  }
};

export const getSourceForRequest = (req) => {
  return sourceConfig.getSourceForRequest(req);
};

export default sourceSelection;
`;

  await fs.outputFile(path.join(projectPath, `src/middleware/sourceSelection.middleware.${ext}`), sourceSelectionContent);
}
