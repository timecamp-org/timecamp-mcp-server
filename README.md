# TimeCamp MCP Server

- Why TS not Python? Official client, more materials, support for Cloudflare workers.
- Why hosted not local only? Easier to use, users don't need to install it.
- Why Cloudflare Workers? Cheap & easy.

## Setup & run

Local

```sh
pnpm start
pnpm dlx @modelcontextprotocol/inspector@latest
```

Deployment

```sh
pnpm dlx wrangler@latest deploy
```

## Not yet implemented

- Oauth authorization

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
    }
  }
}
```

Restart Claude and you should see the tools become available. 
