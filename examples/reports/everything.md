# MCP Everything (test server)

| Grade | A (100/100) |
| Tools | 13 |
| Tokens | 1236 |
| Transport | stdio |

# MCP Agent Readiness: mcp-servers/everything

**Score: 100/100 (Grade A)**

| Metric | Value |
|--------|-------|
| Tools | 13 |
| Est. tokens | 1,236 |
| Checks | 9 |

## Checks

- [?] **tool-count** � 13 tools � reasonable surface area
- [?] **token-footprint** � ~1,236 tokens in tool definitions
- [?] **duplicate-names** � No duplicate tool names
- [?] **descriptions** � Tool descriptions look adequate for agents
- [�] **destructive-warnings** � No obviously destructive operations detected
- [?] **schema-complexity** � Input schemas are reasonably sized
- [�] **pagination** � No list/search endpoints detected � pagination check skipped
- [�] **auth-clarity** � No security schemes defined in OpenAPI
- [?] **security-smells** � No obvious security smells in tool definitions

---
_Static scorecard from OpenAPI ? MCP tool projection. Live protocol, drift, and agent evals coming in v0.2._

**Next:** `mcp-doctor analyze` for token optimization � `mcp-doctor competitors` for market map

## Recommended Improvements

No high-priority fixes suggested.