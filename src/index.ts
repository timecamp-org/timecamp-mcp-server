import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

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
}

// Define our MCP agent with tools
export class MyMCP extends McpAgent {
	server = new McpServer({
		name: "TimeCamp MCP Server",
		version: "1.0.0",
	});

	private static bearerToken: string = "";

	// Set bearer token statically
	static setBearerToken(token: string) {
		MyMCP.bearerToken = token;
	}

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
					const api = new TimeCampAPI(MyMCP.bearerToken);
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
					const api = new TimeCampAPI(MyMCP.bearerToken);
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
	}
}

export default {
	fetch(request: Request, env: Env, ctx: ExecutionContext) {
		const url = new URL(request.url);

		// Get bearer token from Authorization header or environment variable
		let bearerToken = env?.TIMECAMP_TOKEN || process.env?.TIMECAMP_TOKEN;
		
		// Check for Authorization header and extract token if present
		const authHeader = request.headers.get('Authorization');
		if (authHeader && authHeader.startsWith('Bearer ')) {
			bearerToken = authHeader.substring(7); // Remove 'Bearer ' prefix
		}
		
		if (bearerToken) {
			MyMCP.setBearerToken(bearerToken);
		}

		if (url.pathname === "/sse" || url.pathname === "/sse/message") {
			return MyMCP.serveSSE("/sse").fetch(request, env, ctx);
		}

		if (url.pathname === "/mcp") {
			return MyMCP.serve("/mcp").fetch(request, env, ctx);
		}

		return new Response("Not found", { status: 404 });
	},
};
