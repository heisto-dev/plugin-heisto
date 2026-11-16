import { guardedIngress } from 'elizaos-plugin-heisto';

// Call this at your actual channel ingress BEFORE persistence or bootstrap.
// Supply your trusted downstream function; do not keep a second bypass listener.
export async function receiveText(message, existingHandleMessage) {
  const outcome = await guardedIngress(message, existingHandleMessage);
  if (!outcome.delivered) {
    return { delivered: false, status: outcome.decision.route };
  }
  return { delivered: true, result: outcome.result };
}
