# TimeCamp MCP Server

- Why TS not Python? Official client, more materials, support for Cloudflare workers.
- Why hosted and not local only? Easier to use, users don't need to install it.
- Why Cloudflare Workers? Cheap & easy.

### This MCP server provides the following tools for TimeCamp integration:

- **add_timecamp_time_entry** - Create a new time entry with start time, end time, note, and optional task
- **get_timecamp_time_entries** - Retrieve time entries for a specified date range
- **get_timecamp_tasks** - Fetch all available TimeCamp projects and tasks
- **delete_timecamp_time_entry** - Delete a specific time entry by ID
- **update_timecamp_time_entry** - Update an existing time entry (time, note, or task assignment)

## Example prompt

```
Create Timecamp time entries based on these tasks I done. 
I writ tasks by putting -HH:MM, which is the end time for the task, so each time entry should take from end end time of previous entry.
Try to match timecamp task, so first you have to fetch my timecamp tasks.
Note should be single sentence in English with 3-12 words.
Ignore "[minutes:: ...]" as this is estimate.

- [x] -9:43 emails & org [completion:: 2025-06-21]
- [x] -12:10 #tech new version of reports [[(project) XYZ]] [completion:: 2025-06-21]
- [x] -12:58 (evening) Buy shoes + relax [completion:: 2025-06-21] 
- [x] -14:30 relax [completion:: 2025-06-21]
- [x] -15:30 #tech Notifications still not working for one more person from our group [completion:: 2025-06-21]
- [x] -15:40 I don't remember [completion:: 2025-06-21] 
- [x] -17:09 #tech Client - database connection problem [[(process) Technical support]] [minutes:: 15] [completion:: 2025-06-21]
- [x] -17:35 break [completion:: 2025-06-21]
- [x] -19:17 #tech Client [[(project) Client]] [[(process) Technical support]] [minutes:: 10] [completion:: 2025-06-21] 	- - [x] -19:21 (evening) Fill timesheet [completion:: 2025-06-21]
```

## Setup & run

Local

```sh
pnpm start
npx mcp-remote http://localhost:8787/sse --header "Authorization: Bearer <api_token>"
```

Deploy

```sh
pnpm dlx wrangler@latest deploy
pnpm dlx wrangler@latest tail
npx mcp-remote https://my-mcp-server.timecamp-s-a.workers.dev/sse --header "Authorization: Bearer <api_token>"
```

Test

```sh
pnpm dlx @modelcontextprotocol/inspector@latest
```

## Connect Claude Desktop to your MCP server

You can also connect to your remote MCP server from local MCP clients, by using the [mcp-remote proxy](https://www.npmjs.com/package/mcp-remote). 

To connect to your MCP server from Claude Desktop, follow [Anthropic's Quickstart](https://modelcontextprotocol.io/quickstart/user) and within Claude Desktop go to Settings > Developer > Edit Config.

Update with this configuration:

```json
{
  "mcpServers": {
    "timecamp": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote",
        "https://my-mcp-server.timecamp-s-a.workers.dev/sse", // or http://localhost:8787/sse
        "--header",
        "Authorization:${AUTH_HEADER}"
      ],
      "env": {
        "AUTH_HEADER": "Bearer <auth-token>"
      }
    },
    "timecamp_url": { // if MCP client supports url
      "url": "https://my-mcp-server.timecamp-s-a.workers.dev/sse",
      "headers": {
        "Authorization": "Bearer <auth-token>...."
      }
    },
  }
}
```

Restart Claude and you should see the tools become available. 

If you have MacOS Claude Desktop - 'Server transport closed unexpectedly' see https://github.com/modelcontextprotocol/servers/issues/1748#issuecomment-2896004925.

## Not yet implemented

- Oauth authorization (https://github.com/huanshenyi/mcp-server-bearer-auth/tree/main)
- Problem with MCP using URL in Cursor