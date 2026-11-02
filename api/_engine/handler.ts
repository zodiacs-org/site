// The underscore directory adds no Vercel function. /mcp/engine rewrites through compatibility.
import { createEngineNodeHandler } from '../../src/engine-mcp/http.js';

export default createEngineNodeHandler();
