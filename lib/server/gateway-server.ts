import { GatewayClient } from "@/lib/gateway-client";

const DEFAULT_GATEWAY_URL = "ws://127.0.0.1:18789";

const gatewayClient = new GatewayClient();
let connectPromise: Promise<void> | null = null;

function getGatewayConfig(): { url: string; token?: string } {
  const url =
    process.env.OPENCLAW_GATEWAY_URL ||
    process.env.NEXT_PUBLIC_DEFAULT_GATEWAY_URL ||
    DEFAULT_GATEWAY_URL;

  const token =
    process.env.OPENCLAW_GATEWAY_TOKEN ||
    process.env.GATEWAY_TOKEN ||
    process.env.NEXT_PUBLIC_GATEWAY_TOKEN ||
    undefined;

  return { url, token };
}

export async function getServerGatewayClient(): Promise<GatewayClient> {
  if (gatewayClient.isConnected()) {
    return gatewayClient;
  }

  if (!connectPromise) {
    connectPromise = gatewayClient.connect(getGatewayConfig()).finally(() => {
      connectPromise = null;
    });
  }

  await connectPromise;
  return gatewayClient;
}

