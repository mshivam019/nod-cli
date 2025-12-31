import { CodeBlock } from '@/components/CodeBlock'

export function ChatComponent() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="scroll-m-20 text-4xl font-bold tracking-tight">Chat</h1>
        <p className="text-lg text-muted-foreground mt-2">
          Conversation management with LLM providers and chat history storage.
        </p>
      </div>

      <section className="space-y-4">
        <h2 className="scroll-m-20 border-b pb-2 text-2xl font-semibold tracking-tight">
          Installation
        </h2>
        <CodeBlock code={`nod add chat`} language="bash" />
      </section>

      <section className="space-y-4">
        <h2 className="scroll-m-20 border-b pb-2 text-2xl font-semibold tracking-tight">
          Options
        </h2>
        <div className="grid gap-4 md:grid-cols-2 mt-4">
          <div className="rounded-lg border p-4">
            <h4 className="font-medium">LLM Providers</h4>
            <ul className="text-sm text-muted-foreground mt-2 space-y-1">
              <li>• OpenAI (GPT-4o, GPT-4o-mini)</li>
              <li>• Anthropic (Claude 3.5)</li>
              <li>• Google Gemini (Gemini Pro)</li>
            </ul>
          </div>
          <div className="rounded-lg border p-4">
            <h4 className="font-medium">Chat History Database</h4>
            <ul className="text-sm text-muted-foreground mt-2 space-y-1">
              <li>• Supabase (PostgreSQL)</li>
              <li>• PostgreSQL (direct)</li>
              <li>• MySQL</li>
            </ul>
          </div>
        </div>
        <p className="text-sm text-muted-foreground mt-2">
          Optional: Include Langfuse for LLM observability
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="scroll-m-20 border-b pb-2 text-2xl font-semibold tracking-tight">
          Generated Files
        </h2>
        
        <h3 className="font-semibold mt-4">Chat Service (src/services/chat.service.ts)</h3>
        <CodeBlock
          code={`import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, AIMessage, SystemMessage } from '@langchain/core/messages';
import { client } from '../utils/retriever.js';
import logger from '../utils/logger.js';

const llm = new ChatOpenAI({
  openAIApiKey: process.env.OPENAI_API_KEY,
  modelName: 'gpt-4o-mini',
  temperature: 0.7
});

export const chatService = {
  async chat(
    conversationId: string,
    message: string,
    systemPrompt?: string
  ) {
    // Get conversation history
    const history = await this.getHistory(conversationId);
    
    // Build messages
    const messages = [
      new SystemMessage(systemPrompt || 'You are a helpful assistant.'),
      ...history.map(m => 
        m.role === 'user' ? new HumanMessage(m.content) : new AIMessage(m.content)
      ),
      new HumanMessage(message)
    ];

    // Generate response
    const response = await llm.invoke(messages);
    const assistantMessage = response.content as string;

    // Save to history
    await this.saveMessage(conversationId, 'user', message);
    await this.saveMessage(conversationId, 'assistant', assistantMessage);

    return { message: assistantMessage, conversationId };
  },

  async getHistory(conversationId: string) {
    const { data, error } = await client
      .from('chat_messages')
      .select('role, content')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data || [];
  },

  async saveMessage(conversationId: string, role: string, content: string) {
    const { error } = await client
      .from('chat_messages')
      .insert({ conversation_id: conversationId, role, content });

    if (error) {
      logger.error('Failed to save message:', error.message);
      throw error;
    }
  },

  async createConversation(userId?: string) {
    const { data, error } = await client
      .from('conversations')
      .insert({ user_id: userId })
      .select()
      .single();

    if (error) throw error;
    return data;
  }
};`}
          language="typescript"
        />
      </section>

      <section className="space-y-4">
        <h2 className="scroll-m-20 border-b pb-2 text-2xl font-semibold tracking-tight">
          Schema Setup
        </h2>

        <div className="bg-muted/50 p-4 rounded-lg border mb-4">
          <p className="text-sm font-medium">💡 Using Drizzle ORM?</p>
          <p className="text-sm text-muted-foreground mt-1">
            If you have Drizzle installed (via preset or <code>nod add drizzle</code>), 
            the schema below is automatically added to your <code>src/db/schema.ts</code>.
            Just run <code>npx drizzle-kit push</code> to apply changes.
          </p>
        </div>

        <p className="mb-2">For non-Drizzle projects, run this SQL in your database:</p>

        <CodeBlock
          code={`-- Conversations table
create table conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  title text,
  module text default 'general',
  metadata jsonb default '{}',
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Chat messages table
create table conversation_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references conversations(id) on delete cascade,
  message_type text not null check (message_type in ('user', 'assistant', 'system')),
  content text not null,
  metadata jsonb default '{}',
  created_at timestamp with time zone default now()
);

-- Indexes for faster queries
create index idx_conversations_user on conversations(user_id);
create index idx_messages_conversation on conversation_messages(conversation_id);`}
          language="sql"
        />
      </section>

      <section className="space-y-4">
        <h2 className="scroll-m-20 border-b pb-2 text-2xl font-semibold tracking-tight">
          Environment Variables
        </h2>
        <CodeBlock
          code={`# OpenAI
OPENAI_API_KEY=sk-...

# Or Anthropic
ANTHROPIC_API_KEY=sk-ant-...

# Or Google
GOOGLE_API_KEY=...

# Langfuse (optional)
LANGFUSE_PUBLIC_KEY=pk-...
LANGFUSE_SECRET_KEY=sk-...`}
          language="bash"
        />
      </section>

      <section className="space-y-4">
        <h2 className="scroll-m-20 border-b pb-2 text-2xl font-semibold tracking-tight">
          Usage
        </h2>
        <CodeBlock
          code={`import { chatService } from './services/chat.service.js';

// Create a new conversation
const conversation = await chatService.createConversation(userId);

// Send a message
const response = await chatService.chat(
  conversation.id,
  'What is the weather like today?',
  'You are a helpful weather assistant.'
);

console.log(response.message);

// Get conversation history
const history = await chatService.getHistory(conversation.id);`}
          language="typescript"
        />
      </section>
    </div>
  )
}
