import fs from "fs-extra";
import * as path from "path";
import chalk from "chalk";
import prompts from "prompts";

interface AddServiceOptions {
  nonInteractive?: boolean;
  withDatabase?: boolean;
  methods?: string[];
}

export async function addService(name: string, options: AddServiceOptions = {}) {
  const defaults = {
    withDatabase: options.withDatabase ?? false,
    methods: options.methods || [
      "getAll",
      "getById",
      "create",
      "update",
      "delete",
    ],
  };

  const response = options.nonInteractive
    ? defaults
    : await prompts([
    {
      type: options.withDatabase !== undefined ? null : "confirm",
      name: "withDatabase",
      message: "Include database operations?",
      initial: true,
    },
    {
      type: options.methods ? null : "multiselect",
      name: "methods",
      message: "Select methods to generate:",
      choices: [
        { title: "Get All", value: "getAll", selected: true },
        { title: "Get By ID", value: "getById", selected: true },
        { title: "Create", value: "create", selected: true },
        { title: "Update", value: "update", selected: true },
        { title: "Delete", value: "delete", selected: true },
      ],
    },
  ]);

  const projectRoot = process.cwd();
  await createService(projectRoot, name, {
    withDatabase: response.withDatabase ?? defaults.withDatabase,
    methods: response.methods || defaults.methods,
  });
}

async function createService(projectRoot: string, name: string, config: any) {
  const servicePath = path.join(
    projectRoot,
    "src/services",
    `${name}.service.ts`,
  );

  const methods = config.methods || [
    "getAll",
    "getById",
    "create",
    "update",
    "delete",
  ];
  const withDb = config.withDatabase;

  let serviceContent = withDb
    ? `import { pool } from '../config/database';\n\n`
    : "";

  serviceContent += `export const ${name}Service = {\n`;

  if (methods.includes("getAll")) {
    serviceContent += withDb
      ? `  async getAll() {
    const result = await pool.query('SELECT * FROM ${name}s');
    return result.rows;
  },\n\n`
      : `  async getAll() {
    // TODO: Implement get all logic
    return [];
  },\n\n`;
  }

  if (methods.includes("getById")) {
    serviceContent += withDb
      ? `  async getById(id: string) {
    const result = await pool.query('SELECT * FROM ${name}s WHERE id = $1', [id]);
    return result.rows[0];
  },\n\n`
      : `  async getById(id: string) {
    // TODO: Implement get by id logic
    return { id };
  },\n\n`;
  }

  if (methods.includes("create")) {
    serviceContent += withDb
      ? `  async create(data: any) {
    const result = await pool.query(
      'INSERT INTO ${name}s (name, description) VALUES ($1, $2) RETURNING *',
      [data.name, data.description]
    );
    return result.rows[0];
  },\n\n`
      : `  async create(data: any) {
    // TODO: Implement create logic
    return { success: true, data };
  },\n\n`;
  }

  if (methods.includes("update")) {
    serviceContent += withDb
      ? `  async update(id: string, data: any) {
    const result = await pool.query(
      'UPDATE ${name}s SET name = $1, description = $2 WHERE id = $3 RETURNING *',
      [data.name, data.description, id]
    );
    return result.rows[0];
  },\n\n`
      : `  async update(id: string, data: any) {
    // TODO: Implement update logic
    return { success: true, id, data };
  },\n\n`;
  }

  if (methods.includes("delete")) {
    serviceContent += withDb
      ? `  async delete(id: string) {
    await pool.query('DELETE FROM ${name}s WHERE id = $1', [id]);
    return { success: true };
  }\n`
      : `  async delete(id: string) {
    // TODO: Implement delete logic
    return { success: true, id };
  }\n`;
  }

  serviceContent += "};\n";

  await fs.outputFile(servicePath, serviceContent);
  console.log(chalk.green(`✓ Created service: ${servicePath}`));
}
