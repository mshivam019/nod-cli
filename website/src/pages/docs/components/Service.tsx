import { CodeBlock } from '@/components/CodeBlock'

export function ServiceComponent() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="scroll-m-20 text-4xl font-bold tracking-tight">Service</h1>
        <p className="text-lg text-muted-foreground mt-2">
          Generate business logic services with CRUD operations and optional database integration.
        </p>
      </div>

      <section className="space-y-4">
        <h2 className="scroll-m-20 border-b pb-2 text-2xl font-semibold tracking-tight">
          Installation
        </h2>
        <CodeBlock
          code={`nod add service <name>`}
          language="bash"
        />
      </section>

      <section className="space-y-4">
        <h2 className="scroll-m-20 border-b pb-2 text-2xl font-semibold tracking-tight">
          Options
        </h2>
        <p>The command will prompt you for:</p>
        <ul className="list-disc list-inside space-y-2 text-muted-foreground">
          <li><strong>Include Database Operations</strong> - Generate SQL queries</li>
          <li><strong>Methods</strong> - Select which CRUD methods to generate:
            <ul className="list-disc list-inside ml-6 mt-1">
              <li>Get All</li>
              <li>Get By ID</li>
              <li>Create</li>
              <li>Update</li>
              <li>Delete</li>
            </ul>
          </li>
        </ul>
      </section>

      <section className="space-y-4">
        <h2 className="scroll-m-20 border-b pb-2 text-2xl font-semibold tracking-tight">
          Generated Files
        </h2>
        
        <h3 className="font-semibold mt-4">Service without Database (src/services/email.ts)</h3>
        <CodeBlock
          code={`export const emailService = {
  async getAll() {
    // TODO: Implement get all logic
    return [];
  },

  async getById(id: string) {
    // TODO: Implement get by id logic
    return { id };
  },

  async create(data: any) {
    // TODO: Implement create logic
    return { success: true, data };
  },

  async update(id: string, data: any) {
    // TODO: Implement update logic
    return { success: true, id, data };
  },

  async delete(id: string) {
    // TODO: Implement delete logic
    return { success: true, id };
  }
};`}
          language="typescript"
        />

        <h3 className="font-semibold mt-6">Service with Database (src/services/products.ts)</h3>
        <CodeBlock
          code={`import { pool } from '../config/database';

export const productsService = {
  async getAll() {
    const result = await pool.query('SELECT * FROM products');
    return result.rows;
  },

  async getById(id: string) {
    const result = await pool.query('SELECT * FROM products WHERE id = $1', [id]);
    return result.rows[0];
  },

  async create(data: any) {
    const result = await pool.query(
      'INSERT INTO products (name, description) VALUES ($1, $2) RETURNING *',
      [data.name, data.description]
    );
    return result.rows[0];
  },

  async update(id: string, data: any) {
    const result = await pool.query(
      'UPDATE products SET name = $1, description = $2 WHERE id = $3 RETURNING *',
      [data.name, data.description, id]
    );
    return result.rows[0];
  },

  async delete(id: string) {
    await pool.query('DELETE FROM products WHERE id = $1', [id]);
    return { success: true };
  }
};`}
          language="typescript"
        />
      </section>

      <section className="space-y-4">
        <h2 className="scroll-m-20 border-b pb-2 text-2xl font-semibold tracking-tight">
          Usage
        </h2>
        <CodeBlock
          code={`import { productsService } from './services/products.js';

// In your controller
async function getAllProducts(req, res) {
  const products = await productsService.getAll();
  res.json(products);
}

async function createProduct(req, res) {
  const product = await productsService.create(req.body);
  res.status(201).json(product);
}`}
          language="typescript"
        />
      </section>
    </div>
  )
}
