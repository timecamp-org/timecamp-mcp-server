import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { Hono } from "hono";

type Bindings = Env;

const app = new Hono<{
	Bindings: Bindings;
}>();

type Props = {
	bearerToken: string;
};

type State = null;

// TimeCamp API client class
class TimeCampAPI {
	private baseUrl = "https://app.timecamp.com/third_party/api";
	private bearerToken: string;

	constructor(bearerToken: string) {
		this.bearerToken = bearerToken;
		
		// Validate bearer token
		if (!this.bearerToken) {
			throw new Error("No bearer token provided. Please set the TIMECAMP_TOKEN environment variable or provide Authorization header.");
		}
	}

	private getHeaders() {
		return {
			"Accept": "application/json",
			"Authorization": `Bearer ${this.bearerToken}`,
			"Content-Type": "application/json",
		};
	}

	private calculateDuration(startTime: string, endTime: string): number {
		const start = new Date(startTime);
		const end = new Date(endTime);
		return Math.floor((end.getTime() - start.getTime()) / 1000); // Duration in seconds
	}

	private formatDateForAPI(dateTime: string): string {
		// Convert "2025-06-22 13:28" format to "2025-06-22 13:28:00"
		if (dateTime.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/)) {
			return dateTime + ":00";
		}
		return dateTime;
	}

	async createTimeEntry(from: string, to: string, note: string) {
		try {
			// Format and validate dates
			const startTime = this.formatDateForAPI(from);
			const endTime = this.formatDateForAPI(to);
			const duration = this.calculateDuration(startTime, endTime);

			if (duration <= 0) {
				throw new Error("End time must be after start time");
			}

			// Extract date for the API (YYYY-MM-DD format)
			const date = from.split(' ')[0];

			// Prepare request body
			const requestBody = {
				get_entries: 0,
				date: date,
				start_time: startTime,
				end_time: endTime,
				duration: duration,
				note: note,
				service: 'timecamp-mcp',
			};

			// Make API request
			const response = await fetch(`${this.baseUrl}/entries`, {
				method: "POST",
				headers: this.getHeaders(),
				body: JSON.stringify(requestBody),
			});

			if (!response.ok) {
				const errorText = await response.text();
				throw new Error(`TimeCamp API request failed with status ${response.status}: ${errorText}`);
			}

			const result = await response.json();
			return {
				success: true,
				duration: Math.floor(duration / 60), // duration in minutes
				data: result,
				message: `Successfully created time entry from ${from} to ${to} (${Math.floor(duration / 60)} minutes).`
			};
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : String(error)
			};
		}
	}

	async getTimeEntries(fromDate: string, toDate: string, userIds = "me", optFields = "tags") {
		try {
			// Prepare query parameters
			const params = new URLSearchParams({
				from: fromDate,
				to: toDate,
				user_ids: userIds,
				opt_fields: optFields,
			});

			// Make API request
			const response = await fetch(`${this.baseUrl}/entries?${params.toString()}`, {
				method: "GET",
				headers: this.getHeaders(),
			});

			if (!response.ok) {
				const errorText = await response.text();
				throw new Error(`TimeCamp API request failed with status ${response.status}: ${errorText}`);
			}

			const result = await response.json();
			
			// Process the response to remove unwanted fields and rename description to note
			const processedData = Array.isArray(result) ? result.map(entry => {
				const { task_note, locked, addons_external_id, color, description, hasEntryLocationHistory, name, duration, ...cleanEntry } = entry;
				
				// Calculate duration in hours
				const durationSeconds = parseInt(duration) || 0;
				const durationHours = (durationSeconds / 3600).toFixed(2);
				
				return {
					...cleanEntry,
					task_name: name || "",
					duration_seconds: durationSeconds,
					duration_hours: parseFloat(durationHours),
					note: description || ""
				};
			}) : result;

			return {
				success: true,
				data: processedData,
				message: `Time entries from ${fromDate} to ${toDate}`
			};
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : String(error)
			};
		}
	}

	async getTasks() {
		try {
			// Prepare query parameters
			const params = new URLSearchParams({
				ignoreAdminRights: "1"
			});

			// Make API request
			const response = await fetch(`${this.baseUrl}/tasks?${params.toString()}`, {
				method: "GET",
				headers: this.getHeaders(),
			});

			if (!response.ok) {
				const errorText = await response.text();
				throw new Error(`TimeCamp API request failed with status ${response.status}: ${errorText}`);
			}

			const result = await response.json();
			
			// Convert object to array for easier processing
			const tasksArray = Object.values(result as Record<string, unknown>);

			return {
				success: true,
				data: tasksArray,
				message: "Successfully fetched TimeCamp projects and tasks"
			};
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : String(error)
			};
		}
	}

	async deleteTimeEntry(entryId: string) {
		try {
			// Prepare request body as URL-encoded form data
			const requestBody = `id=${entryId}&service=timecamp-mcp`;

			// Make API request
			const response = await fetch(`${this.baseUrl}/entries`, {
				method: "DELETE",
				headers: {
					"Accept": "application/json",
					"Authorization": `Bearer ${this.bearerToken}`,
					"Content-Type": "application/x-www-form-urlencoded",
				},
				body: requestBody,
			});

			if (!response.ok) {
				const errorText = await response.text();
				throw new Error(`TimeCamp API request failed with status ${response.status}: ${errorText}`);
			}

			const result = await response.json();

			return {
				success: true,
				data: result,
				message: `Successfully deleted time entry with ID: ${entryId}`
			};
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : String(error)
			};
		}
	}
}

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
			},
			async ({ from, to, note }) => {
				try {
					const api = new TimeCampAPI(this.props.bearerToken);
					const result = await api.createTimeEntry(from, to, note);
					
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
	}
}

// Simple home page
app.get("/", async (c) => {
	return c.html(`
		<!DOCTYPE html>
		<html lang="en">
		<head>
			<meta charset="UTF-8">
			<meta name="viewport" content="width=device-width, initial-scale=1.0">
			<title>TimeCamp MCP Server</title>
		</head>
		<body style="font-family: system-ui; max-width: 800px; margin: 50px auto; padding: 20px;">
			<h1>TimeCamp MCP Server</h1>
			<p>This is a Model Context Protocol (MCP) server for TimeCamp integration.</p>
			<p>To use this server, connect to the <code>/sse</code> endpoint with proper authentication.</p>
			<h2>Authentication</h2>
			<p>Include your TimeCamp API token in the Authorization header:</p>
			<pre style="background: #f4f4f4; padding: 15px; border-radius: 5px;">Authorization: Bearer YOUR_TIMECAMP_TOKEN</pre>
		</body>
		</html>
	`);
});

// Mount the MCP handler with authentication
app.mount("/", (req: Request, env: Bindings, ctx: ExecutionContext) => {
	const url = new URL(req.url);
	
	// Only handle /sse routes
	if (!url.pathname.startsWith("/sse")) {
		// Let Hono handle other routes
		return app.fetch(req, env, ctx);
	}
	
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
