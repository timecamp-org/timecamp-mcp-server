import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { Hono } from "hono";
import { TimeCampAPI } from "./timecamp-api.js";
import { getIndexHtml } from "./html-template.js";

type Bindings = Env;

const app = new Hono<{
	Bindings: Bindings;
}>();

type Props = {
	bearerToken: string;
};

type State = null;

// Define our MCP agent with tools
export class MyMCP extends McpAgent<Bindings, State, Props> {
	server = new McpServer({
		name: "TimeCamp MCP Server",
		version: "1.0.0",
	});

	async init() {
		// TimeCamp time entry tool
		this.server.tool(
			"add_timecamp_time_entry",
			{
				from: z.string().describe("Start time in format YYYY-MM-DD HH:MM (e.g. 2025-06-22 13:28)"),
				to: z.string().describe("End time in format YYYY-MM-DD HH:MM (e.g. 2025-06-22 15:28)"),
				note: z.string().describe("Note/description for the time entry"),
				task_id: z.string().optional().describe("Optional TimeCamp task ID to associate with the time entry"),
			},
			async ({ from, to, note, task_id }) => {
				try {
					const api = new TimeCampAPI(this.props.bearerToken);
					const result = await api.createTimeEntry(from, to, note, task_id);
					
					if (result.success) {
						return {
							content: [
								{
									type: "text",
									text: `${result.message} Response: ${JSON.stringify(result.data, null, 2)}`,
								},
							],
						};
					} else {
						return {
							content: [
								{
									type: "text",
									text: `Error creating time entry: ${result.error}`,
								},
							],
						};
					}
				} catch (error) {
					return {
						content: [
							{
								type: "text",
								text: `Error creating time entry: ${error instanceof Error ? error.message : String(error)}`,
							},
						],
					};
				}
			}
		);

		// TimeCamp get time entries tool
		this.server.tool(
			"get_timecamp_time_entries",
			{
				from: z.string().describe("Start date in format YYYY-MM-DD (e.g. 2025-06-22)"),
				to: z.string().describe("End date in format YYYY-MM-DD (e.g. 2025-06-22)"),
			},
			async ({ from, to }) => {
				try {
					const api = new TimeCampAPI(this.props.bearerToken);
					const result = await api.getTimeEntries(from, to, "me", "tags");
					
					if (result.success) {
						return {
							content: [
								{
									type: "text",
									text: `${result.message}:\n${JSON.stringify(result.data, null, 2)}`,
								},
							],
						};
					} else {
						return {
							content: [
								{
									type: "text",
									text: `Error fetching time entries: ${result.error}`,
								},
							],
						};
					}
				} catch (error) {
					return {
						content: [
							{
								type: "text",
								text: `Error fetching time entries: ${error instanceof Error ? error.message : String(error)}`,
							},
						],
					};
				}
			}
		);

		// TimeCamp get projects and tasks tool
		this.server.tool(
			"get_timecamp_tasks",
			{},
			async () => {
				try {
					const api = new TimeCampAPI(this.props.bearerToken);
					const result = await api.getTasks();
					
					if (result.success) {
						return {
							content: [
								{
									type: "text",
									text: `${result.message}:\n${JSON.stringify(result.data, null, 2)}`,
								},
							],
						};
					} else {
						return {
							content: [
								{
									type: "text",
									text: `Error fetching tasks: ${result.error}`,
								},
							],
						};
					}
				} catch (error) {
					return {
						content: [
							{
								type: "text",
								text: `Error fetching tasks: ${error instanceof Error ? error.message : String(error)}`,
							},
						],
					};
				}
			}
		);

		// TimeCamp delete time entry tool
		this.server.tool(
			"delete_timecamp_time_entry",
			{
				entryId: z.string().describe("ID of the time entry to delete"),
			},
			async ({ entryId }) => {
				try {
					const api = new TimeCampAPI(this.props.bearerToken);
					const result = await api.deleteTimeEntry(entryId);
					
					if (result.success) {
						return {
							content: [
								{
									type: "text",
									text: `${result.message} Response: ${JSON.stringify(result.data, null, 2)}`,
								},
							],
						};
					} else {
						return {
							content: [
								{
									type: "text",
									text: `Error deleting time entry: ${result.error}`,
								},
							],
						};
					}
				} catch (error) {
					return {
						content: [
							{
								type: "text",
								text: `Error deleting time entry: ${error instanceof Error ? error.message : String(error)}`,
							},
						],
					};
				}
			}
		);

		// TimeCamp update time entry tool
		this.server.tool(
			"update_timecamp_time_entry",
			{
				entryId: z.string().describe("ID of the time entry to update"),
				from: z.string().optional().describe("Optional Start time in format HH:MM (e.g. 13:28)"),
				to: z.string().optional().describe("Optional End time in format HH:MM (e.g. 15:28)"),
				note: z.string().optional().describe("Optional Note/description for the time entry"),
				task_id: z.string().optional().describe("Optional TimeCamp task ID to associate with the time entry"),
			},
			async ({ entryId, from, to, note, task_id }) => {
				try {
					const api = new TimeCampAPI(this.props.bearerToken);
					const result = await api.updateTimeEntry(entryId, from, to, note, task_id);
					
					if (result.success) {
						return {
							content: [
								{
									type: "text",
									text: `${result.message} Response: ${JSON.stringify(result.data, null, 2)}`,
								},
							],
						};
					} else {
						return {
							content: [
								{
									type: "text",
									text: `Error updating time entry: ${result.error}`,
								},
							],
						};
					}
				} catch (error) {
					return {
						content: [
							{
								type: "text",
								text: `Error updating time entry: ${error instanceof Error ? error.message : String(error)}`,
							},
						],
					};
				}
			}
		);
	}
}

// Simple home page
app.get("/", async (c) => {
	return c.html(getIndexHtml());
});

// Mount the MCP handler with authentication
app.all("/sse/*", async (c) => {
	const req = c.req.raw;
	const env = c.env;
	const ctx = c.executionCtx;
	
	// Get bearer token from Authorization header or environment variable
	const authHeader = req.headers.get("authorization");
	let bearerToken = env?.TIMECAMP_TOKEN || "";
	
	// If Authorization header is present, use it instead
	if (authHeader) {
		// Remove "Bearer " prefix if present
		bearerToken = authHeader.startsWith("Bearer ")
			? authHeader.substring(7)
			: authHeader;
	}
	
	// Check if we have a token
	if (!bearerToken) {
		return new Response("Unauthorized: No bearer token provided", { status: 401 });
	}

	// Set the bearer token in the context props
	(ctx as any).props = {
		bearerToken: bearerToken,
	};

	// Return the MCP agent response
	return MyMCP.mount("/sse").fetch(req, env, ctx);
});

// Legacy routes for backward compatibility
app.get("/mcp", (c: any) => {
	return c.redirect("/sse", 301);
});

export default app;
