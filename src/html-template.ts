export function getIndexHtml(): string {
	return `
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
			
			<h2>Available Tools</h2>
			<p>This MCP server provides the following tools for TimeCamp integration:</p>
			<ul style="line-height: 1.6;">
				<li><strong>add_timecamp_time_entry</strong> - Create a new time entry with start time, end time, note, and optional task</li>
				<li><strong>get_timecamp_time_entries</strong> - Retrieve time entries for a specified date range</li>
				<li><strong>get_timecamp_tasks</strong> - Fetch all available TimeCamp projects and tasks</li>
				<li><strong>delete_timecamp_time_entry</strong> - Delete a specific time entry by ID</li>
				<li><strong>update_timecamp_time_entry</strong> - Update an existing time entry (time, note, or task assignment)</li>
			</ul>
			<h2>Authentication</h2>
			<p>Include your TimeCamp API token in the Authorization header:</p>
			<pre style="background: #f4f4f4; padding: 15px; border-radius: 5px;">Authorization: Bearer YOUR_TIMECAMP_TOKEN</pre>
			
			<h2>Configuration Example</h2>
			<p>To configure this MCP server in your client application, add the following configuration:</p>
			<pre style="background: #f4f4f4; padding: 15px; border-radius: 5px; overflow-x: auto;">{
  "mcpServers": {
    "timecamp": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote",
        "https://my-mcp-server.timecamp-s-a.workers.dev/sse",
        "--header",
        "Authorization:\${AUTH_HEADER}"
      ],
      "env": {
        "AUTH_HEADER": "Bearer &lt;auth-token&gt;"
      }
    }
  }
}</pre>
			<p><strong>Note:</strong> Replace <code>&lt;auth-token&gt;</code> with your actual TimeCamp API token.</p>
		</body>
		</html>
	`;
} 