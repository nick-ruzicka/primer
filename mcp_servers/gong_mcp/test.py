"""Smoke test for gong-mcp."""
from __future__ import annotations

import asyncio
import json
import sys

from mcp import ClientSession
from mcp.client.stdio import StdioServerParameters, stdio_client

SERVER_MODULE = "mcp_servers.gong_mcp.server"
ACCOUNT = "northstar_beauty"


async def main() -> int:
    params = StdioServerParameters(command="uv", args=["run", "python", "-m", SERVER_MODULE])
    async with stdio_client(params) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()
            tools = await session.list_tools()
            tool_names = [t.name for t in tools.tools]
            print(f"[gong-mcp] tools: {tool_names}")

            failures: list[str] = []
            for name in tool_names:
                try:
                    result = await session.call_tool(name, {"account_id": ACCOUNT})
                    text = result.content[0].text if result.content else "<empty>"
                    parsed = json.loads(text) if text not in ("null", "") else None
                    preview = json.dumps(parsed, indent=2)
                    if len(preview) > 900:
                        preview = preview[:900] + "\n  ..."
                    print(f"\n--- {name}({ACCOUNT}) ---\n{preview}")
                except Exception as e:
                    failures.append(f"{name}: {e}")
                    print(f"\n--- {name}({ACCOUNT}) FAILED: {e}")

            if failures:
                print(f"\n[gong-mcp] {len(failures)} tool(s) failed")
                return 1
            print(f"\n[gong-mcp] all {len(tool_names)} tool(s) ok")
            return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
