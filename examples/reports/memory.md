# MCP Memory

| Grade | A (90/100) |
| Tools | 9 |
| Tokens | 1040 |
| Transport | stdio |

# MCP Agent Readiness: memory-server

**Score: 90/100 (Grade A)**

| Metric | Value |
|--------|-------|
| Tools | 9 |
| Est. tokens | 1,040 |
| Checks | 9 |

## Checks

- [?] **tool-count** � 9 tools � reasonable surface area
- [?] **token-footprint** � ~1,040 tokens in tool definitions
- [?] **duplicate-names** � No duplicate tool names
- [?] **descriptions** � Tool descriptions look adequate for agents
- [!] **destructive-warnings** � 3 destructive tool(s) without explicit warnings in description
  - delete_entities, delete_observations, delete_relations
- [!] **schema-complexity** � 5 tools have complex input schemas
  - Deep or wide schemas increase parameter mistakes
- [�] **pagination** � No list/search endpoints detected � pagination check skipped
- [�] **auth-clarity** � No security schemes defined in OpenAPI
- [?] **security-smells** � No obvious security smells in tool definitions

---
_Static scorecard from OpenAPI ? MCP tool projection. Live protocol, drift, and agent evals coming in v0.2._

**Next:** `mcp-doctor analyze` for token optimization � `mcp-doctor competitors` for market map

## Recommended Improvements

### Destructive tool without warning

**Suggested:**
```
Add to description: 'DESTRUCTIVE: irreversible. Requires explicit confirmation.'
```
