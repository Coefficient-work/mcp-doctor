# MCP Puppeteer

| Grade | B (83/100) |
| Tools | 7 |
| Tokens | 612 |
| Transport | stdio |

# MCP Agent Readiness: example-servers/puppeteer

**Score: 83/100 (Grade B)**

| Metric | Value |
|--------|-------|
| Tools | 7 |
| Est. tokens | 612 |
| Checks | 9 |

## Checks

- [?] **tool-count** � 7 tools � reasonable surface area
- [?] **token-footprint** � ~612 tokens in tool definitions
- [?] **duplicate-names** � No duplicate tool names
- [!] **descriptions** � 4 tools have thin descriptions (<30 chars)
- [�] **destructive-warnings** � No obviously destructive operations detected
- [?] **schema-complexity** � Input schemas are reasonably sized
- [�] **pagination** � No list/search endpoints detected � pagination check skipped
- [�] **auth-clarity** � No security schemes defined in OpenAPI
- [?] **security-smells** � 1 potential security smell(s)
  - puppeteer_evaluate: possible command execution surface

---
_Static scorecard from OpenAPI ? MCP tool projection. Live protocol, drift, and agent evals coming in v0.2._

**Next:** `mcp-doctor analyze` for token optimization � `mcp-doctor competitors` for market map

## Recommended Improvements

### Thin description on `puppeteer_navigate`

**Current:**
```
Navigate to a URL
```

**Suggested:**
```
Puppeteer navigate. Use when the agent needs to perform this operation. Required params are in inputSchema.
```

### Thin description on `puppeteer_click`

**Current:**
```
Click an element on the page
```

**Suggested:**
```
Puppeteer click. Use when the agent needs to perform this operation. Required params are in inputSchema.
```

### Thin description on `puppeteer_fill`

**Current:**
```
Fill out an input field
```

**Suggested:**
```
Puppeteer fill. Use when the agent needs to perform this operation. Required params are in inputSchema.
```

### Thin description on `puppeteer_hover`

**Current:**
```
Hover an element on the page
```

**Suggested:**
```
Puppeteer hover. Use when the agent needs to perform this operation. Required params are in inputSchema.
```

### puppeteer_evaluate: possible command execution surface

**Suggested:**
```
Move sensitive fields to POST body; never expose credentials on GET tools.
```
