# TimeCamp MCP Server

- Why TS not Python? Official client, more materials, support for Cloudflare workers.
- Why hosted not local only? Easier to use, users don't need to install it.
- Why Cloudflare Workers? Cheap & easy.

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