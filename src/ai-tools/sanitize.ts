/** Remove SDK validation diagnostics that can echo input values or property names. */
export function sanitizeProtocolMessage(message: any) {
  if (message.error) message.error = { code: message.error.code, message: 'The MCP request does not match a supported operation or schema.',
    ...(message.error.code === -32015 ? { data: { reason: message.error.data?.reason === 'timeout' ? 'timeout' : 'challenge_failed' } } : {}) };
  else if (message.result?.isError && !message.result?.structuredContent?.schema
    && message.result.content?.some((item: any) => item.type === 'text' && item.text.startsWith('Input validation error:'))) {
    message.result.content = [{ type: 'text', text: 'The tool arguments do not match the supported schema.' }];
  }
  return message;
}
