"""Long-lived stdio connections to the six MCP servers.

Launches each server once on startup and re-uses its ClientSession across
requests. Calls are dispatched by ``(server, tool)`` and results are
unwrapped from the single TextContent envelope the servers return.
"""

from __future__ import annotations

import asyncio
import json
import logging
import time
from contextlib import AsyncExitStack
from dataclasses import dataclass
from typing import Any

from mcp import ClientSession
from mcp.client.stdio import StdioServerParameters, stdio_client

log = logging.getLogger(__name__)


MCP_MODULES: dict[str, str] = {
    "salesforce": "mcp_servers.salesforce_mcp.server",
    "snowflake": "mcp_servers.snowflake_mcp.server",
    "catalyst": "mcp_servers.catalyst_mcp.server",
    "netsuite": "mcp_servers.netsuite_mcp.server",
    "gong": "mcp_servers.gong_mcp.server",
    "exa": "mcp_servers.exa_mcp.server",
}


@dataclass
class _ServerSlot:
    name: str
    session: ClientSession
    lock: asyncio.Lock
    tools: list[str]


class MCPPool:
    """Holds initialized ClientSessions for every MCP server.

    Each server is launched as a subprocess on startup via ``uv run python -m
    <module>`` and kept alive for the life of the FastAPI process. All six
    sessions share one AsyncExitStack so shutdown is a single call.
    """

    def __init__(self) -> None:
        self._stack = AsyncExitStack()
        self._slots: dict[str, _ServerSlot] = {}
        self._started = False

    @property
    def servers(self) -> list[str]:
        return list(MCP_MODULES.keys())

    async def connect_all(self) -> None:
        if self._started:
            return
        await self._stack.__aenter__()
        try:
            for name, module in MCP_MODULES.items():
                t0 = time.perf_counter()
                params = StdioServerParameters(
                    command="uv",
                    args=["run", "python", "-m", module],
                )
                read, write = await self._stack.enter_async_context(stdio_client(params))
                session = await self._stack.enter_async_context(ClientSession(read, write))
                await session.initialize()
                listed = await session.list_tools()
                tool_names = [t.name for t in listed.tools]
                self._slots[name] = _ServerSlot(
                    name=name,
                    session=session,
                    lock=asyncio.Lock(),
                    tools=tool_names,
                )
                log.info(
                    "mcp_pool.connected",
                    extra={
                        "server": name,
                        "tools": tool_names,
                        "duration_ms": int((time.perf_counter() - t0) * 1000),
                    },
                )
        except BaseException:
            await self._stack.__aexit__(None, None, None)
            raise
        self._started = True

    async def close_all(self) -> None:
        if not self._started:
            return
        self._started = False
        self._slots.clear()
        await self._stack.__aexit__(None, None, None)

    def list_tools(self, server: str) -> list[str]:
        slot = self._slots.get(server)
        return list(slot.tools) if slot else []

    async def call(
        self, server: str, tool: str, arguments: dict[str, Any]
    ) -> Any:
        """Call ``tool`` on ``server`` and return the unwrapped JSON payload."""
        slot = self._slots.get(server)
        if slot is None:
            raise RuntimeError(f"MCP server not connected: {server}")

        t0 = time.perf_counter()
        # Per-server lock keeps the underlying stdio pipe in clean one-request-
        # at-a-time order. Cross-server calls still run in parallel.
        async with slot.lock:
            result = await slot.session.call_tool(tool, arguments)

        duration_ms = int((time.perf_counter() - t0) * 1000)

        if not result.content:
            log.warning("mcp_pool.empty_content", extra={"server": server, "tool": tool})
            return None

        text = result.content[0].text  # type: ignore[attr-defined]
        try:
            payload = json.loads(text)
        except json.JSONDecodeError:
            log.error(
                "mcp_pool.bad_json",
                extra={"server": server, "tool": tool, "text": text[:200]},
            )
            raise

        log.debug(
            "mcp_pool.call",
            extra={
                "server": server,
                "tool": tool,
                "args": arguments,
                "duration_ms": duration_ms,
            },
        )
        return payload


_pool: MCPPool | None = None


def set_pool(pool: MCPPool | None) -> None:
    global _pool
    _pool = pool


def get_pool() -> MCPPool:
    if _pool is None:
        raise RuntimeError("MCP pool not initialized")
    return _pool
